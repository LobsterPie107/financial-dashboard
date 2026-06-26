const https = require('https');
const fs = require('fs');

const tickers = [
  { symbol: '0700.HK', name: 'Tencent' },
  { symbol: '9988.HK', name: 'Alibaba' },
  { symbol: '3690.HK', name: 'Meituan' },
  { symbol: '0005.HK', name: 'HSBC' },
  { symbol: '0883.HK', name: 'CNOOC' },
  { symbol: '1299.HK', name: 'AIA' },
  { symbol: '0388.HK', name: 'HKEX' },
  { symbol: '0823.HK', name: 'Link REIT' },
  { symbol: '0002.HK', name: 'CLP' },
  { symbol: '0066.HK', name: 'MTR' },
  { symbol: '2388.HK', name: 'BOC HK' },
  { symbol: 'VOO', name: 'VOO' }
];

const results = [];
let completed = 0;

tickers.forEach(t => {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t.symbol)}?range=1mo&interval=1d`;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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
            closes: (result[0].indicators.quote[0].close || []).map(v => v !== null ? v : null)
          });
        }
      } catch(e) {
        results.push({ symbol: t.symbol, name: t.name, error: e.message });
      }
      completed++;
      if (completed === tickers.length) {
        fs.writeFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/prices.json',
          JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
        console.log('Done: ' + results.length + ' tickers');
      }
    });
  }).on('error', (e) => {
    results.push({ symbol: t.symbol, name: t.name, error: e.message });
    completed++;
    if (completed === tickers.length) {
      fs.writeFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/prices.json',
        JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
      console.log('Done with errors');
    }
  });
});
