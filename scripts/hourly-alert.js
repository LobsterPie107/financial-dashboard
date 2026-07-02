const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '..', 'data');

// 1. Fetch fresh prices
console.log('Fetching prices...');
try {
  execSync('node scripts/fetch-prices.js', { cwd: __dirname + '/..', timeout: 60000, stdio: 'pipe' });
} catch (e) {
  console.error('fetch-prices error:', e.message);
}

// 2. Load the data
const prices = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'prices.json'), 'utf8'));

// 3. Load dividend data for ex-div adjustment
let divData = [];
try {
  divData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'div-data.json'), 'utf8'));
} catch (e) {
  console.log('No div-data.json available, using raw prices');
}

// Build a lookup: symbol -> list of recent dividends
const divLookup = {};
divData.forEach(s => {
  if (s.recentDividends && s.recentDividends.length > 0) {
    divLookup[s.symbol] = s.recentDividends;
  }
});

// 4. Check for 2%+ movers with ex-div adjustment
const alerts = [];
prices.data.forEach(s => {
  const closes = (s.closes || []).filter(c => c !== null && c !== undefined);
  const timestamps = (s.timestamps || []).filter((t, i) => s.closes[i] !== null && s.closes[i] !== undefined);
  const len = closes.length;
  if (len >= 2) {
    const price = s.price;
    const prevClose = closes[len - 2];
    const prevTs = timestamps[len - 2];
    
    if (prevClose > 0) {
      // Raw change percentage
      const rawChg = ((price - prevClose) / prevClose) * 100;
      
      // Check if today is an ex-div date: compare today's timestamp (intraday) with div exDates
      const todayStr = new Date().toISOString().slice(0, 10);
      const recentDivs = divLookup[s.symbol] || [];
      const exDivToday = recentDivs.filter(d => d.exDate === todayStr);
      
      let adjChg = rawChg;
      let note = '';
      
      if (exDivToday.length > 0) {
        // Adjust: the previous close effectively includes the dividend
        // Adjusted previous close = prevClose - dividend amount
        const divAmt = exDivToday[0].amount;
        const adjPrev = prevClose - divAmt;
        if (adjPrev > 0) {
          adjChg = ((price / adjPrev) - 1) * 100;
        }
        note = `(ex-div $${divAmt.toFixed(3)} adj: ${adjChg.toFixed(1)}%)`;
        console.log(`  ${s.name}: raw ${rawChg.toFixed(1)}% -> div-adjusted ${adjChg.toFixed(1)}% (div $${divAmt.toFixed(3)})`);
      }
      
      // Check against adjusted change
      if (Math.abs(adjChg) >= 2) {
        const direction = adjChg > 0 ? 'UP' : 'DOWN';
        alerts.push({
          name: s.name,
          symbol: s.symbol,
          change: adjChg,
          rawChange: rawChg,
          price: price,
          prevClose: prevClose,
          direction: direction,
          exDivAdjustment: exDivToday.length > 0 ? exDivToday[0].amount : null,
          note: note
        });
        console.log(`ALERT: ${s.name} (${s.symbol}) ${direction} ${Math.abs(adjChg).toFixed(1)}% now $${price} ${note}`);
      } else {
        console.log(`  ${s.name}: ${rawChg.toFixed(1)}% raw, ${adjChg.toFixed(1)}% adj - no alert`);
      }
    }
  } else {
    console.log(`  ${s.symbol}: skipping (${len} data points)`);
  }
});

// 5. Output result as JSON for the cron to read
const result = {
  timestamp: new Date().toISOString(),
  hasAlerts: alerts.length > 0,
  alerts: alerts,
  nosAlertMsg: alerts.length === 0 ? 'No 2%+ movers this hour.' : null
};

const resultPath = path.join(DATA_DIR, '_alert_result.json');
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

console.log('---RESULT---');
console.log(JSON.stringify(result));
