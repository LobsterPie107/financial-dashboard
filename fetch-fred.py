import urllib.request
import json
import os
from datetime import datetime

FRED_SERIES = [
    {'id': 'TREAST', 'name': 'Fed_Holdings', 'label': 'Fed Treasury SOMA Holdings'},
    {'id': 'FORTREASNET99996', 'name': 'TIC_Total', 'label': 'Total Foreign Treasury Flows'},
    {'id': 'FORLTTREASNET99990', 'name': 'TIC_Official', 'label': 'Foreign Official Treasury Flows'},
    {'id': 'CPIAUCSL', 'name': 'CPI', 'label': 'CPI YoY%', 'transform': 'pc1'},
    {'id': 'PCEPILFE', 'name': 'CorePCE', 'label': 'Core PCE YoY%', 'transform': 'pc1'},
    {'id': 'PAYEMS', 'name': 'NFP', 'label': 'NFP Change', 'transform': 'chg'},
]

def fetch_csv(series_id, transform=None, start_date='2000-01-01', end_date='2026-06-01'):
    url = f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}&cosd={start_date}&coed={end_date}'
    if transform:
        url += f'&transformation={transform}'
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; DashboardBot/1.0)'}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode('utf-8')

def parse_csv(csv_text):
    lines = csv_text.strip().split('\n')[1:]
    dates, values = [], []
    for line in lines:
        parts = line.split(',')
        if len(parts) >= 2:
            try:
                v = float(parts[1])
                dates.append(parts[0])
                values.append(v)
            except ValueError:
                pass
    return dates, values

def annual_sum(dates, values, start_year=2000, end_year=2025):
    yearly = {}
    for y in range(start_year, end_year + 1):
        yearly[str(y)] = 0
    for d, v in zip(dates, values):
        year = d[:4]
        if year.isdigit() and int(year) >= start_year and int(year) <= end_year:
            yearly[year] = yearly.get(year, 0) + v
    return yearly

def main():
    output_dir = 'data'
    os.makedirs(output_dir, exist_ok=True)
    
    # Fetch all FRED series
    all_data = {}
    for series in FRED_SERIES:
        try:
            start = '2025-06-01' if series['name'] in ('CPI', 'CorePCE', 'NFP') else '2000-01-01'
            end = '2026-06-01'
            csv = fetch_csv(series['id'], series.get('transform'), start, end)
            dates, values = parse_csv(csv)
            out = {
                'series': series['name'],
                'label': series['label'],
                'fetched': datetime.now().isoformat(),
                'dates': dates,
                'values': values
            }
            with open(os.path.join(output_dir, series['name'] + '.json'), 'w') as f:
                json.dump(out, f, indent=2)
            print(f'Fetched {series["name"]}: {len(dates)} data points')
            all_data[series['name']] = out
        except Exception as e:
            print(f'Failed for {series["name"]}: {e}')
    
    # ===== Compute 4-category Treasury STOCK CHART =====
    # Show holdings levels as share of total outstanding
    tic_o = all_data.get('TIC_Official')
    tic_t = all_data.get('TIC_Total')
    fed = all_data.get('Fed_Holdings')
    
    if tic_o and tic_t and fed:
        # Compute cumulative net foreign holdings (change from 2000)
        official_annual = annual_sum(tic_o['dates'], tic_o['values'])
        total_foreign_annual = annual_sum(tic_t['dates'], tic_t['values'])
        private_annual = {}
        for y in official_annual.keys():
            private_annual[y] = total_foreign_annual[y] - official_annual[y]
        
        # Fed: pick year-end value
        fed_yearly = {}
        for y in range(2000, 2026):
            y_str = str(y)
            year_data = [(d, v) for d, v in zip(fed['dates'], fed['values']) if d.startswith(y_str)]
            if year_data:
                fed_yearly[y_str] = year_data[-1][1]
            else:
                fed_yearly[y_str] = None
        
        years = sorted(official_annual.keys())
        
        # Fetch Treasury debt held by public
        try:
            treasury_url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?page[size]=10000&sort=record_date&fields=record_date,debt_held_public_amt'
            req = urllib.request.Request(treasury_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                treasury_data = json.loads(response.read().decode('utf-8'))
            
            # Pick year-end debt_held_public (in $, convert to $M)
            debt_public = {}
            for row in treasury_data.get('data', []):
                d = row.get('record_date', '')
                year = d[:4]
                if year >= '2000' and year <= '2025':
                    dhp = row.get('debt_held_public_amt', 'null')
                    if dhp != 'null':
                        val = float(dhp) / 1e6
                        if year not in debt_public or d > max(debt_public.get(year, {}).get('date', ''), d):
                            debt_public[year] = {'date': d, 'value': val}
            
            # Build annual flows chart (bars, in $B)
            # Foreign Official flow, Foreign Private flow, Fed flow, Domestic flow
            chart_labels = []
            foreign_o_flows = []
            foreign_p_flows = []
            fed_flows = []
            domestic_flows = []
            
            prev_fed = fed_yearly.get('2002')
            prev_dhp = debt_public.get('2002', {}).get('value')
            
            for y in years:
                chart_labels.append(y)
                foreign_o_flows.append(round(official_annual[y] / 1000, 1))  # $M to $B
                foreign_p_flows.append(round(private_annual[y] / 1000, 1))
                
                # Fed flow = change in holdings from previous year
                curr_fed = fed_yearly.get(y)
                if curr_fed is not None and prev_fed is not None:
                    fed_flows.append(round((curr_fed - prev_fed) / 1000, 1))
                else:
                    fed_flows.append(None)
                prev_fed = curr_fed
                
                # Domestic flow = change in total debt held by public - (foreign total + fed change)
                curr_dhp = debt_public.get(y, {}).get('value')
                if curr_dhp is not None and prev_dhp is not None and curr_fed is not None and prev_fed is not None:
                    total_change = curr_dhp - prev_dhp
                    foreign_total = (official_annual[y] + private_annual[y]) / 1000  # $B
                    fed_change = (curr_fed - prev_fed) / 1000  # $B
                    domestic_flows.append(round(total_change / 1000 - foreign_total - fed_change, 1))
                else:
                    domestic_flows.append(None)
                prev_dhp = curr_dhp
            
            chart_data = {
                'series': 'TIC_AnnualFlows',
                'label': 'US Treasury Net Purchases by Holder ($B)',
                'fetched': datetime.now().isoformat(),
                'labels': chart_labels,
                'categories': {
                    'Foreign Official': foreign_o_flows,
                    'Foreign Private': foreign_p_flows,
                    'Federal Reserve': fed_flows,
                    'US Domestic': domestic_flows
                }
            }
            
            with open(os.path.join(output_dir, 'TIC_Categories.json'), 'w') as f:
                json.dump(chart_data, f, indent=2)
            print(f'Computed TIC 4-category flows: {len(chart_labels)} years')
            
        except Exception as e:
            print(f'Failed for Treasury debt: {e}')
            # Fallback: just 3 categories (no domestic)
            chart_labels = years
            foreign_o_flows = [round(official_annual[y] / 1000, 1) for y in years]
            foreign_p_flows = [round(private_annual[y] / 1000, 1) for y in years]
            
            prev_fed = fed_yearly.get('2002')
            fed_flows = []
            for y in years:
                curr_fed = fed_yearly.get(y)
                if curr_fed is not None and prev_fed is not None:
                    fed_flows.append(round((curr_fed - prev_fed) / 1000, 1))
                else:
                    fed_flows.append(None)
                prev_fed = curr_fed
            
            chart_data = {
                'series': 'TIC_AnnualFlows_3Cat',
                'label': 'US Treasury Net Purchases by Holder ($B)',
                'fetched': datetime.now().isoformat(),
                'labels': chart_labels,
                'categories': {
                    'Foreign Official': foreign_o_flows,
                    'Foreign Private': foreign_p_flows,
                    'Federal Reserve': fed_flows
                }
            }
            
            with open(os.path.join(output_dir, 'TIC_Categories.json'), 'w') as f:
                json.dump(chart_data, f, indent=2)
            print(f'Computed TIC 3-category flows: {len(chart_labels)} years')
    else:
        print('Missing TIC or Fed data')

if __name__ == '__main__':
    main()
