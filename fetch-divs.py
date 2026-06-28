import yfinance as yf
import json

tickers = ['0941.HK','0005.HK','0939.HK','0728.HK','0762.HK','0883.HK','0857.HK','1398.HK','3988.HK']
results = []
for t in tickers:
    try:
        stock = yf.Ticker(t)
        info = stock.info
        results.append({
            'symbol': t,
            'dividendYield': info.get('dividendYield'),
            'dividendRate': info.get('dividendRate'),
            'trailingAnnualDividendYield': info.get('trailingAnnualDividendYield'),
            'trailingAnnualDividendRate': info.get('trailingAnnualDividendRate'),
            'price': info.get('currentPrice') or info.get('regularMarketPrice'),
            'payoutRatio': info.get('payoutRatio')
        })
        print(f"{t}: yield={results[-1]['dividendYield']} rate={results[-1]['dividendRate']} tdy={results[-1]['trailingAnnualDividendYield']} tdr={results[-1]['trailingAnnualDividendRate']} price={results[-1]['price']}")
    except Exception as e:
        results.append({'symbol': t, 'error': str(e)})
        print(f"{t}: ERROR {e}")

with open('div-data.json', 'w') as f:
    json.dump(results, f, indent=2)
print("DONE")
