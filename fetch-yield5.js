const https = require('https');
// Fetch ALL yield curve data for 2026 to build historical chart
https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?field_tdr_date_value=2026&type=daily_treasury_yield_curve&page&_format=csv', {headers:{'User-Agent':'Mozilla/5.0'}}, function(res) {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const lines = d.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
    
    // Build JSON: for each date, we have maturity rates
    const maturities = ['1 Mo','2 Mo','3 Mo','6 Mo','1 Yr','2 Yr','3 Yr','5 Yr','7 Yr','10 Yr','20 Yr','30 Yr'];
    const maturityIndices = maturities.map(m => headers.indexOf(m));
    
    // Get most recent 60 days of data
    const dataRows = lines.slice(1, 61).map(line => {
      const parts = line.split(',');
      const row = { date: parts[0] };
      maturityIndices.forEach((idx, i) => {
        if (idx > -1 && parts[idx] && parts[idx] !== 'N/A') {
          row[maturities[i]] = parseFloat(parts[idx]);
        }
      });
      return row;
    });
    
    // Output as JSON for the app to use
    const result = {
      date: dataRows[0].date,
      latest: {},
      history: dataRows.reverse() // oldest first for chart
    };
    maturities.forEach(m => {
      if (dataRows[0][m] !== undefined) {
        result.latest[m] = dataRows[0][m];
      }
    });
    
    console.log(JSON.stringify(result, null, 2));
  });
});
