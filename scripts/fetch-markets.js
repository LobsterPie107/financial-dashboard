const https = require('https');
const fs = require('fs');

const indices = [
  { symbol: '^HSI', name: 'HSI' },
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '000001.SS', name: 'Shanghai Comp' },
  { symbol: 'CL=F', name: 'Crude Oil WTI' }
];

const results = [];
let completed = 0;

indices.forEach(t => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?range=6mo&interval=1d`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const result = json.chart.result;
        if (result && result[0]) {
          const meta = result[0].meta;
          const quotes = result[0].indicators.quote[0];
          results.push({
            symbol: t.symbol,
            name: t.name,
            price: meta.regularMarketPrice || null,
            prevClose: meta.chartPreviousClose || null,
            currency: meta.currency || 'USD',
            timestamps: result[0].timestamp || [],
            closes: (quotes.close || []).map(v => v !== null ? v : null)
          });
        } else {
          results.push({ symbol: t.symbol, name: t.name, error: 'No data' });
        }
      } catch(e) {
        results.push({ symbol: t.symbol, name: t.name, error: e.message });
      }
      completed++;
      if (completed === indices.length) {
        fs.writeFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/market-data.json',
          JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
        console.log('Done: ' + results.length + ' indices');
      }
    });
  }).on('error', (e) => {
    results.push({ symbol: t.symbol, name: t.name, error: e.message });
    completed++;
    if (completed === indices.length) {
      fs.writeFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/market-data.json',
        JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
      console.log('Done with errors');
    }
  });
});
