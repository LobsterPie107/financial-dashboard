const https = require('https');
const fs = require('fs');
const path = require('path');

const FRED_SERIES = [
  { id: 'CPIAUCSL', name: 'CPI', transform: 'pc1', label: 'CPI YoY%' },
  { id: 'PCEPILFE', name: 'CorePCE', transform: 'pc1', label: 'Core PCE YoY%' },
  { id: 'PAYEMS', name: 'NFP', transform: 'chg', label: 'NFP Change' },
  { id: 'FORLTTREASNET99990', name: 'TIC_Official', transform: null, label: 'Foreign Official Treasury Flows' },
  { id: 'FORTREASNET99996', name: 'TIC_Total', transform: null, label: 'Total Foreign Treasury Flows' },
  // Fed Treasury holdings (SOMA) - weekly, in millions of $
  { id: 'WSHOTS', name: 'Fed_Holdings', transform: null, label: 'Fed Treasury SOMA Holdings' }
];

function fetchCSV(seriesId, transform, startDate, endDate) {
  return new Promise((resolve, reject) => {
    let baseUrl = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + encodeURIComponent(seriesId) + '&cosd=' + startDate + '&coed=' + endDate;
    if (transform) baseUrl += '&transformation=' + transform;
    
    https.get(baseUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardBot/1.0)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Fetch Treasury debt held by public data
function fetchTreasuryData() {
  return new Promise((resolve, reject) => {
    let url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?page[size]=10000&sort=record_date&fields=record_date,debt_held_public_amt,tot_pub_debt_out_amt';
    // Only need year-end data, but fetch all and filter
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.data || []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const outputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  // Fetch all FRED series
  for (const series of FRED_SERIES) {
    try {
      let startDate = '2025-06-01', endDate = '2026-06-01';
      if (series.name.startsWith('TIC_') || series.name === 'Fed_Holdings') {
        startDate = '2000-01-01';
      }
      const csv = await fetchCSV(series.id, series.transform, startDate, endDate);
      const lines = csv.trim().split('\n').slice(1);
      const dates = [];
      const values = [];
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const v = parseFloat(parts[1]);
          if (!isNaN(v)) {
            dates.push(parts[0]);
            values.push(v);
          }
        }
      }
      const out = {
        series: series.name,
        label: series.label,
        fetched: new Date().toISOString(),
        dates,
        values
      };
      fs.writeFileSync(path.join(outputDir, series.name + '.json'), JSON.stringify(out, null, 2));
      console.log('Fetched ' + series.name + ': ' + dates.length + ' data points');
    } catch (e) {
      console.error('Failed for ' + series.name + ': ' + e.message);
    }
  }
  
  // Fetch Treasury year-end debt data
  try {
    const treasuryData = await fetchTreasuryData();
    // Pick year-end (Dec 31 or closest to it) records
    const yearEndMap = {};
    for (const row of treasuryData) {
      const d = row.record_date;
      if (d && d.endsWith('12-31') || (d && d.endsWith('12-30')) || (d && d.endsWith('12-29'))) {
        const year = d.substring(0, 4);
        if (year >= '2000' && !yearEndMap[year]) {
          yearEndMap[year] = {
            date: d,
            debt_held_public: parseFloat(row.debt_held_public_amt) / 1e6,  // convert to $M
            tot_public: parseFloat(row.tot_pub_debt_out_amt) / 1e6
          };
        }
      }
    }
    // Fill gaps - use closest available date
    for (const row of treasuryData) {
      const year = row.record_date.substring(0, 4);
      if (year >= '2000' && year <= '2026') {
        if (!yearEndMap[year]) {
          yearEndMap[year] = {
            date: row.record_date,
            debt_held_public: parseFloat(row.debt_held_public_amt) / 1e6,
            tot_public: parseFloat(row.tot_pub_debt_out_amt) / 1e6
          };
        }
      }
    }
    
    const years = Object.keys(yearEndMap).sort();
    const out = {
      series: 'Treasury_Debt',
      label: 'Treasury Debt Held by Public',
      fetched: new Date().toISOString(),
      years,
      yearEnd: years.map(y => yearEndMap[y])
    };
    fs.writeFileSync(path.join(outputDir, 'Treasury_Debt.json'), JSON.stringify(out, null, 2));
    console.log('Fetched Treasury debt: ' + years.length + ' year-end records');
  } catch (e) {
    console.error('Failed for Treasury debt: ' + e.message);
  }
}

main();
