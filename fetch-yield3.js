const https = require('https');
// Fetch the Treasury coupon issues CSV for 2yr-30yr rates
https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?field_tdr_date_value=2026&type=daily_treasury_yield_curve&page&_format=csv', {headers:{'User-Agent':'Mozilla/5.0'}}, function(res) {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const lines = d.split('\n');
    console.log('Total lines:', lines.length);
    console.log('Header line:', lines[0]);
    
    // Now also fetch the coupon issues data which has 2yr, 3yr, 5yr, 10yr, 30yr
    https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?field_tdr_date_value=2026&type=daily_treasury_long_term_rate&page&_format=csv', {headers:{'User-Agent':'Mozilla/5.0'}}, function(res2) {
      let d2 = '';
      res2.on('data', c => d2 += c);
      res2.on('end', () => {
        console.log('\n--- Long term rates ---');
        const lines2 = d2.split('\n');
        console.log('Header:', lines2[0]);
        console.log('First row:', lines2[1]);
        
        // Also try the coupon issues (different type)
        https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?field_tdr_date_value=2026&type=daily_treasury_real_long_term&page&_format=csv', {headers:{'User-Agent':'Mozilla/5.0'}}, function(res3) {
          let d3 = '';
          res3.on('data', c => d3 += c);
          res3.on('end', () => {
            console.log('\n--- Real long term ---');
            const lines3 = d3.split('\n');
            console.log('Header:', lines3[0]);
            console.log('First row:', lines3[1]);
            
            // Try the main yield curve view
            https.get('https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve&field_tdr_date_value=2026', {headers:{'User-Agent':'Mozilla/5.0','Accept':'text/html'}}, function(res4) {
              let d4 = '';
              res4.on('data', c => d4 += c);
              res4.on('end', () => {
                // Find all table headers to know what columns exist
                const headers = d4.match(/<th[^>]*scope="col"[^>]*>([^<]+)<\/th>/g);
                if (headers) {
                  console.log('\n--- All column headers ---');
                  headers.forEach(h => console.log(h.replace(/<[^>]+>/g, '').trim()));
                }
                // Find data in the table
                const tbodyStart = d4.indexOf('<tbody>');
                const tbodyEnd = d4.indexOf('</tbody>', tbodyStart);
                if (tbodyStart > -1 && tbodyEnd > -1) {
                  const tbody = d4.substring(tbodyStart, tbodyEnd);
                  const rows = tbody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
                  if (rows) {
                    console.log('\n--- First data row (most recent) ---');
                    console.log(rows[0].replace(/<[^>]+>/g, ' ').trim());
                    console.log('\n--- Second data row ---');
                    console.log(rows[1].replace(/<[^>]+>/g, ' ').trim());
                  }
                }
              });
            });
          });
        });
      });
    });
  });
});
