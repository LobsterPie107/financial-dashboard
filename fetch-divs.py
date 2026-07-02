import yfinance as yf
import json
import sys
from collections import OrderedDict

tickers = ['0941.HK','0005.HK','0939.HK','0728.HK','0762.HK','0883.HK','0857.HK','1398.HK','3988.HK']
results = []
for t in tickers:
    try:
        stock = yf.Ticker(t)
        info = stock.info
        
        # Get all dividend history (up to 10 recent dividends)
        dividends = []
        try:
            divs = stock.dividends.tail(10)
            for dt, amt in divs.items():
                dividends.append({
                    'exDate': dt.strftime('%Y-%m-%d'),
                    'amount': round(amt, 6)
                })
        except:
            pass
        
        # Also get splits for reference
        splits = []
        try:
            sp = stock.splits.tail(5)
            for dt, ratio in sp.items():
                splits.append({
                    'date': dt.strftime('%Y-%m-%d'),
                    'ratio': ratio
                })
        except:
            pass
        
        entry = OrderedDict([
            ('symbol', t),
            ('name', info.get('shortName') or info.get('longName') or t),
            ('dividendYield', info.get('dividendYield')),
            ('dividendRate', info.get('dividendRate')),
            ('trailingAnnualDivYield', info.get('trailingAnnualDividendYield')),
            ('trailingAnnualDivRate', info.get('trailingAnnualDividendRate')),
            ('recentDividends', dividends),
            ('splits', splits),
            ('price', info.get('currentPrice') or info.get('regularMarketPrice')),
            ('payoutRatio', info.get('payoutRatio'))
        ])
        results.append(entry)
        print(f"{t} ({entry['name']}): recentDivs={len(dividends)} yield={entry['dividendYield']}")
    except Exception as e:
        results.append({'symbol': t, 'error': str(e)})
        print(f"{t}: ERROR {e}")

with open('data/div-data.json', 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print("DONE")
