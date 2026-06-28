const https = require('https');
https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value=2026', {headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}}, function(res) {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Size:', d.length);
    // Look for CSV data or JSON data references
    const m = d.match(/data-csv-url="([^"]+)"/i);
    if (m) console.log('CSV URL:', m[1]);
    const m2 = d.match(/data-json-url="([^"]+)"/i);
    if (m2) console.log('JSON URL:', m2[1]);
    // Look for yield curve data embedded in the page
    const idx = d.indexOf('yield-curve');
    if (idx > -1) console.log('yield-curve found at', idx, 'context:', d.substring(idx, idx+300));
    // Look for table data
    const tIdx = d.indexOf('<table');
    if (tIdx > -1) console.log('Table found at', tIdx, 'context:', d.substring(tIdx, tIdx+500));
  });
});
