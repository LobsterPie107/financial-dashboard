const https = require('https');
const url = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?field_tdr_date_value=2026&type=daily_treasury_yield_curve&page&_format=csv';
https.get(url, {headers:{'User-Agent':'Mozilla/5.0'}}, function(res) {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const lines = d.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
    const maturities = ['1 Mo','2 Mo','3 Mo','6 Mo','1 Yr','2 Yr','3 Yr','5 Yr','7 Yr','10 Yr','20 Yr','30 Yr'];
    const idxs = maturities.map(m => headers.indexOf(m));
    
    // Build JSON: date -> {maturity: rate}
    const history = lines.slice(1).reverse().map(line => {
      const parts = line.split(',');
      if (!parts[0] || parts[0] === 'Date') return null;
      const row = {date: parts[0]};
      idxs.forEach((idx, i) => {
        if (idx > -1 && parts[idx] && parts[idx] !== 'N/A') {
          row[maturities[i]] = parseFloat(parseFloat(parts[idx]).toFixed(2));
        }
      });
      return row;
    }).filter(r => r && r.date);
    
    const result = {
      latestDate: history[history.length - 1]?.date,
      latest: {},
      history: history
    };
    if (history.length) {
      const latest = history[history.length - 1];
      maturities.forEach(m => {
        if (latest[m] !== undefined) result.latest[m] = latest[m];
      });
    }
    
    console.log(JSON.stringify(result));
  });
});
