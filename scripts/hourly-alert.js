const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 1. Fetch fresh prices
console.log('Fetching prices...');
try {
  execSync('node scripts/fetch-prices.js', { cwd: __dirname + '/..', timeout: 60000, stdio: 'pipe' });
} catch (e) {
  console.error('fetch-prices error:', e.message);
}

// 2. Load the data
const prices = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'prices.json'), 'utf8'));

// 3. Check for 2%+ movers
const alerts = [];
prices.data.forEach(s => {
  const closes = (s.closes || []).filter(c => c !== null && c !== undefined);
  const len = closes.length;
  if (len >= 2) {
    const price = s.price;
    const prev = closes[len - 2];
    if (prev > 0) {
      const chg = ((price - prev) / prev) * 100;
      if (Math.abs(chg) >= 2) {
        const direction = chg > 0 ? 'UP' : 'DOWN';
        alerts.push({
          name: s.name,
          symbol: s.symbol,
          change: chg,
          price: price,
          prevClose: prev,
          direction: direction
        });
        console.log(`ALERT: ${s.name} (${s.symbol}) ${direction} ${Math.abs(chg).toFixed(1)}% now $${price} vs prev $${prev}`);
      }
    }
  }
});

// 4. Output result as JSON for the cron to read
const result = {
  timestamp: new Date().toISOString(),
  hasAlerts: alerts.length > 0,
  alerts: alerts,
  nosAlertMsg: alerts.length === 0 ? 'No 2%+ movers this hour.' : null
};

// Write result to temp file
const resultPath = path.join(__dirname, '..', 'data', '_alert_result.json');
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

// Also output for stdout
console.log('---RESULT---');
console.log(JSON.stringify(result));
