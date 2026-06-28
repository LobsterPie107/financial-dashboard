const https = require('https');
// Treasury data API for yield curve
// This endpoint returns the daily treasury par yield curve rates
const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates?filter=record_date:gte:2026-05-01&sort=-record_date&format=json';

// Actually let's try the Treasury's data-csv-url pattern
// First get the page to find the CSV URL for the latest date
https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value=2026', {headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}}, function(res) {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Extract the CSV data URL
    // Look for a pattern like /resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/2026
    const csvUrl = d.match(/href="([^"]*daily-treasury-rates[^"]*csv[^"]*)"/i);
    if (csvUrl) {
      console.log('Found CSV:', csvUrl[1]);
      const fullUrl = 'https://home.treasury.gov' + csvUrl[1];
      console.log('Full URL:', fullUrl);
      // Now fetch that CSV
      https.get(fullUrl, {headers:{'User-Agent':'Mozilla/5.0'}}, function(res2) {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => {
          console.log('CSV data length:', d2.length);
          // Show first 500 chars of CSV
          console.log('First part:', d2.substring(0, 1000));
        });
      });
    } else {
      console.log('No CSV URL found');
      // Try to extract from the table
      // Find yield-curve table data
      const start = d.indexOf('<tbody>');
      const end = d.indexOf('</tbody>', start);
      if (start > -1 && end > -1) {
        const tbody = d.substring(start, end);
        console.log('Table body length:', tbody.length);
        // Find first few rows
        const rows = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
        if (rows) {
          console.log('First 3 rows:');
          rows.slice(0, 3).forEach((r, i) => {
            console.log(`Row ${i}:`, r.replace(/<[^>]+>/g, ' ').trim());
          });
        }
      }
    }
  });
});
