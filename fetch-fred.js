const https = require('https');
const fs = require('fs');
const path = require('path');

const SERIES = [
  { id: 'CPIAUCSL', name: 'CPI', transform: 'pc1', label: 'CPI YoY%' },
  { id: 'PCEPILFE', name: 'CorePCE', transform: 'pc1', label: 'Core PCE YoY%' },
  { id: 'PAYEMS', name: 'NFP', transform: 'chg', label: 'NFP Change' },
  { id: 'FORLTTREASNET99990', name: 'TIC_Official', transform: null, label: 'Foreign Official Treasury Flows' },
  { id: 'FORTREASNET99996', name: 'TIC_Total', transform: null, label: 'Total Foreign Treasury Flows' }
];

function fetchCSV(seriesId, transform) {
  return new Promise((resolve, reject) => {
    let baseUrl = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=' + encodeURIComponent(seriesId) + '&cosd=2025-06-01&coed=2026-06-01';
    if (transform) baseUrl += '&transformation=' + transform;
    // For TIC series, fetch since 2000
    if (seriesId.startsWith('FORLT') || seriesId.startsWith('FORTRE')) {
      baseUrl = baseUrl.replace('cosd=2025-06-01', 'cosd=2000-01-01');
    }
    
    https.get(baseUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DashboardBot/1.0)' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  const outputDir = path.join(__dirname, 'data');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  for (const series of SERIES) {
    try {
      const csv = await fetchCSV(series.id, series.transform);
      const lines = csv.trim().split('\n').slice(1);
      const dates = [];
      const values = [];
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const v = parseFloat(parts[1]);
          if (!isNaN(v)) {
            dates.push(parts[0]);
            values.push(v);
          }
        }
      }
      const out = {
        series: series.name,
        label: series.label,
        fetched: new Date().toISOString(),
        dates,
        values
      };
      fs.writeFileSync(path.join(outputDir, series.name + '.json'), JSON.stringify(out, null, 2));
      console.log('Fetched ' + series.name + ': ' + dates.length + ' data points');
    } catch (e) {
      console.error('Failed for ' + series.name + ': ' + e.message);
    }
  }
}

main();
