const https = require('https');
const fs = require('fs');

const tickers = [
  { symbol: '0941.HK', name: 'China Mobile' },
  { symbol: '0005.HK', name: 'HSBC' },
  { symbol: '0939.HK', name: 'CCB' },
  { symbol: '0728.HK', name: 'China Telecom' },
  { symbol: '0762.HK', name: 'China Unicom' },
  { symbol: '0883.HK', name: 'CNOOC' },
  { symbol: '0857.HK', name: 'CNPC' },
  { symbol: '1398.HK', name: 'ICBC' },
  { symbol: '3988.HK', name: 'BOC' }
];

const results = [];
let completed = 0;

tickers.forEach(t => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?range=6mo&interval=1d`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const result = json.chart.result;
        if (result && result[0]) {
          const meta = result[0].meta;
          results.push({
            symbol: t.symbol,
            name: t.name,
            price: meta.regularMarketPrice || null,
            prevClose: meta.chartPreviousClose || null,
            currency: meta.currency || 'HKD',
            timestamps: result[0].timestamp || [],
            closes: (result[0].indicators.quote[0].close || []).map(v => v !== null ? v : null),
            volume: ((result[0].indicators.quote[0].volume || []).filter(v => v !== null).pop()) || null
          });
        } else {
          results.push({ symbol: t.symbol, name: t.name, error: 'No data', price: null });
        }
      } catch(e) {
        results.push({ symbol: t.symbol, name: t.name, error: e.message, price: null });
      }
      completed++;
      if (completed === tickers.length) {
        fs.writeFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/prices.json',
          JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
        console.log('Done: ' + results.length + ' tickers');
      }
    });
  }).on('error', (e) => {
    results.push({ symbol: t.symbol, name: t.name, error: e.message, price: null });
    completed++;
    if (completed === tickers.length) {
      fs.writeFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/prices.json',
        JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
      console.log('Done with errors');
    }
  });
});
