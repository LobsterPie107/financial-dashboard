const fs = require('fs');
const h = fs.readFileSync('C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard/index.html', 'utf8');
const si = h.indexOf('<script>') + 8;
const ei = h.indexOf('</script>', si);
const js = h.substring(si, ei);
const pairs = [
  ['curly', /\{/g, /\}/g],
  ['paren', /\(/g, /\)/g],
  ['bracket', /\[/g, /\]/g]
];
pairs.forEach(function(p) {
  const o = (js.match(p[1]) || []).length;
  const c = (js.match(p[2]) || []).length;
  console.log(p[0] + ': ' + o + '/' + c + ' balanced=' + (o === c));
});
console.log('Has yield curve rendering:', h.includes('function renderYieldCurve'));
console.log('Has treasury table:', h.includes('function renderTreasuryTable'));
console.log('Has rates news:', h.includes('function renderRatesNews'));
console.log('Has tabTreasury id:', h.includes('id="tabTreasury"'));
console.log('Has treasury button:', h.includes('US Treasury'));
