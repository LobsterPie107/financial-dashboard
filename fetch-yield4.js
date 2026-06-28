const https = require('https');
// Fetch the full yield curve CSV
https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?field_tdr_date_value=2026&type=daily_treasury_yield_curve&page&_format=csv', {headers:{'User-Agent':'Mozilla/5.0'}}, function(res) {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const lines = d.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',');
    console.log('Headers:', headers.map(h => h.replace(/"/g,'').trim()).join(' | '));
    
    // Find latest date (they go by rows in the CSV)
    // First data line is the most recent date
    const latestLine = lines[1].split(',');
    console.log('\nDate:', latestLine[0]);
    
    // Map specific maturities
    const wanted = ['"1 Mo"','"2 Mo"','"3 Mo"','"6 Mo"','"1 Yr"','"2 Yr"','"3 Yr"','"5 Yr"','"7 Yr"','"10 Yr"','"20 Yr"','"30 Yr"'];
    console.log('\nLatest (June 26, 2026):');
    wanted.forEach(w => {
      const idx = lines[0].split(',').indexOf(w);
      if (idx > -1) {
        console.log(`${w.replace(/"/g,'')}: ${latestLine[idx]}%`);
      }
    });
    
    // Also check if there's a more recent date (June 26 is the last)
    console.log('\nAll dates:');
    lines.slice(1, 10).forEach(l => {
      const parts = l.split(',');
      if (parts[0] && parts[0] !== 'Date') console.log(parts[0]);
    });
  });
});
