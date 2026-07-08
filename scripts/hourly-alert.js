const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ===== CONFIG =====
const DATA_DIR = path.join(__dirname, '..', 'data');
const HK_TZ = 'Asia/Hong_Kong';

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
      const rawChg = ((price - prevClose) / prevClose) * 100;
      
      const todayStr = new Date().toISOString().slice(0, 10);
      const recentDivs = divLookup[s.symbol] || [];
      const exDivToday = recentDivs.filter(d => d.exDate === todayStr);
      
      let adjChg = rawChg;
      let note = '';
      
      if (exDivToday.length > 0) {
        const divAmt = exDivToday[0].amount;
        const adjPrev = prevClose - divAmt;
        if (adjPrev > 0) {
          adjChg = ((price / adjPrev) - 1) * 100;
        }
        note = `(ex-div adj)`;
      }
      
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
          note: note
        });
        console.log(`ALERT: ${s.name} ${direction} ${Math.abs(adjChg).toFixed(1)}% $${price} ${note}`);
      }
    }
  }
});

// 5. Generate output message
// If no alerts, write EMPTY result = no notification
const result = {
  timestamp: new Date().toISOString(),
  hasAlerts: alerts.length > 0,
  alerts: alerts,
  // Pre-built alert message — no model processing needed
  message: alerts.length === 0 
    ? '' 
    : [
        '🚨 **Portfolio Alert**\n',
        alerts.map(a => {
          const dir = a.direction === 'UP' ? '⬆️' : '⬇️';
          const sgn = a.direction === 'UP' ? '+' : '';
          return `  ${a.name}: ${dir} ${sgn}${a.change.toFixed(1)}% at HK$${a.price.toFixed(2)} ${a.note}`;
        }).join('\n'),
        '',
        alerts.length >= 3 ? 'Broad movement across holdings.' : ''
      ].filter(x => x).join('\n')
};

const resultPath = path.join(DATA_DIR, '_alert_result.json');
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));

console.log('---RESULT---');
console.log(JSON.stringify(result));
