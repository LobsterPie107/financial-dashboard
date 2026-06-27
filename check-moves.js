// Stock move alert checker
// This script is called every evening to check for big daily moves
// and alert Chef via WeChat if any stock moves >2%

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = 'C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data';
const LAST_CHECK_FILE = path.join(DATA_DIR, 'last-alert.json');

const STOCKS = [
  {ticker:'0941.HK', name:'China Mobile'},
  {ticker:'0005.HK', name:'HSBC'},
  {ticker:'0939.HK', name:'CCB'},
  {ticker:'0728.HK', name:'China Telecom'},
  {ticker:'0762.HK', name:'China Unicom'},
  {ticker:'0883.HK', name:'CNOOC'},
  {ticker:'0857.HK', name:'CNPC'},
  {ticker:'1398.HK', name:'ICBC'},
  {ticker:'3988.HK', name:'BOC'}
];

function fetchPrices() {
  return new Promise((resolve, reject) => {
    const q = STOCKS.map(s => s.ticker).join(',');
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent('^HSI') + '?range=1d&interval=1d';
    https.get(url, {headers:{'User-Agent':'Mozilla/5.0'}}, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        // We need per-stock data, use the prices.json already fetched
        try {
          const pricesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'prices.json'), 'utf8'));
          resolve(pricesData.data || []);
        } catch(e) {
          reject(e);
        }
      });
    });
  });
}

async function check() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'prices.json'), 'utf8'));
    const stocks = data.data || [];
    
    // Read last alert state to avoid double-notifying
    let lastAlert = {};
    try {
      lastAlert = JSON.parse(fs.readFileSync(LAST_CHECK_FILE, 'utf8'));
    } catch(e) {}
    
    const alerts = [];
    
    stocks.forEach(s => {
      const stockInfo = STOCKS.find(st => st.ticker === s.symbol);
      if (!stockInfo) return;
      
      const price = parseFloat(s.price);
      const prevClose = parseFloat(s.prevClose);
      if (!price || !prevClose) return;
      
      const chgPct = ((price - prevClose) / prevClose) * 100;
      
      if (Math.abs(chgPct) >= 2) {
        const key = s.symbol;
        const prevAlert = lastAlert[key] || '';
        const thisAlert = chgPct.toFixed(1) + '%';
        
        // Only alert if this is a new alert (different from last)
        if (prevAlert !== thisAlert) {
          alerts.push({
            ticker: s.symbol,
            name: stockInfo.name,
            chgPct: chgPct,
            price: price,
            prevClose: prevClose,
            key: key,
            alert: thisAlert
          });
          lastAlert[key] = thisAlert;
        }
      }
    });
    
    // Save last alert state
    fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify(lastAlert, null, 2));
    
    if (alerts.length) {
      // Build message
      const lines = alerts.map(a => {
        const dir = a.chgPct >= 0 ? '+' : '';
        return a.name + ' (' + a.ticker.replace('.HK','') + '): ' + dir + a.chgPct.toFixed(1) + '% (now $' + a.price.toFixed(2) + ', prev $' + a.prevClose.toFixed(2) + ')';
      });
      const msg = 'Stock Movement Alert:\n' + lines.join('\n');
      
      // Output the alert as JSON for the cron job to handle
      console.log(JSON.stringify({
        alert: true,
        message: msg,
        alerts: alerts
      }));
    } else {
      console.log(JSON.stringify({alert: false, message: 'No significant moves (>2%) detected'}));
    }
    
  } catch(e) {
    console.error('Error checking moves:', e.message);
    process.exit(1);
  }
}

check();
