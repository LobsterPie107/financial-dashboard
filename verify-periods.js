const fs = require('fs');
const j = JSON.parse(fs.readFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/data/prices.json', 'utf8'));
j.data.forEach(function(s) {
  const cls = s.closes.map(v => parseFloat(v)).filter(v => v !== null);
  const ts = s.timestamps;
  const len = cls.length;
  const latest = cls[len - 1];
  
  // Simulate YTD logic - find first Jan 2026 entry
  let firstThisYear = null;
  for (let i = 0; i < ts.length; i++) {
    const d = new Date(ts[i] * 1000);
    if (d.getFullYear() === 2026) {
      firstThisYear = i;
      break;
    }
  }
  const chgYtd = firstThisYear !== null ? ((latest - cls[firstThisYear]) / cls[firstThisYear] * 100) : null;
  
  // 1w: last vs 5 trading days ago
  const idx1w = Math.max(0, len - 6);
  const chg1w = ((latest - cls[idx1w]) / cls[idx1w] * 100);
  
  // 1m: last vs 21 trading days ago
  const idx1m = Math.max(0, len - 22);
  const chg1m = ((latest - cls[idx1m]) / cls[idx1m] * 100);
  
  console.log(s.symbol + 
    ' | 1w: ' + chg1w.toFixed(1) + '% (idx ' + idx1w + '/' + len + ')' +
    ' | 1m: ' + chg1m.toFixed(1) + '% (idx ' + idx1m + '/' + len + ')' +
    ' | YTD: ' + (chgYtd !== null ? chgYtd.toFixed(1) + '%' : 'N/A') +
    ' | first Jan: ' + new Date(ts[firstThisYear] * 1000).toISOString().substring(0,10)
  );
});
