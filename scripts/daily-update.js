const https = require('https');
const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = 'C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard';
const WORKSPACE = 'C:/Users/OpenClaw/.openclaw/workspace';

// ========== 1. Fetch Index & Oil Data ==========
const INDICES = [
  { symbol: '^HSI', name: 'HSI', fileKey: 'hsi' },
  { symbol: '^GSPC', name: 'S&P 500', fileKey: 'sp500' },
  { symbol: '^IXIC', name: 'Nasdaq', fileKey: 'nasdaq' },
  { symbol: '000001.SS', name: 'Shanghai Comp', fileKey: 'shanghai' },
  { symbol: 'CL=F', name: 'Crude Oil WTI', fileKey: 'oil' },
];

const TICKERS = [
  '0700.HK', '9988.HK', '3690.HK', '0005.HK', '0883.HK',
  '1299.HK', '0388.HK', '0823.HK', '0002.HK', '0066.HK', '2388.HK', 'VOO'
];

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('Parse error: ' + e.message)); }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

async function fetchMarkets() {
  const results = [];
  for (const idx of INDICES) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(idx.symbol)}?range=6mo&interval=1d`;
      const json = await fetchJSON(url);
      if (json.chart.result && json.chart.result[0]) {
        const r = json.chart.result[0];
        const meta = r.meta;
        const quotes = r.indicators.quote[0];
        results.push({
          symbol: idx.symbol, name: idx.name,
          price: meta.regularMarketPrice || null,
          prevClose: meta.chartPreviousClose || null,
          currency: meta.currency || 'USD',
          timestamps: r.timestamp || [],
          closes: (quotes.close || []).map(v => v !== null ? v : null)
        });
      }
    } catch(e) {
      results.push({ symbol: idx.symbol, name: idx.name, error: e.message });
    }
  }
  fs.writeFileSync(path.join(DASHBOARD_DIR, 'data/market-data.json'),
    JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
  console.log('Markets: ' + results.length + ' done');
}

async function fetchPrices() {
  const results = [];
  for (const ticker of TICKERS) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`;
      const json = await fetchJSON(url);
      if (json.chart.result && json.chart.result[0]) {
        const r = json.chart.result[0];
        const meta = r.meta;
        const quotes = r.indicators.quote[0];
        results.push({
          symbol: ticker,
          name: '',
          price: meta.regularMarketPrice || null,
          prevClose: meta.chartPreviousClose || null,
          currency: meta.currency || 'HKD',
          timestamps: r.timestamp || [],
          closes: (quotes.close || []).map(v => v !== null ? v : null)
        });
      }
    } catch(e) {
      results.push({ symbol: ticker, name: '', error: e.message });
    }
  }
  fs.writeFileSync(path.join(DASHBOARD_DIR, 'data/prices.json'),
    JSON.stringify({ fetched: new Date().toISOString(), data: results }, null, 2), 'utf8');
  console.log('Prices: ' + results.length + ' done');
}

// ========== 2. Fetch hkej.com News ==========
async function scrapeHKEJ() {
  const realEstatePath = path.join(DASHBOARD_DIR, 'data/real-estate.json');
  let existing = { data: [] };
  try { existing = JSON.parse(fs.readFileSync(realEstatePath, 'utf8')); } catch(e) {}

  const urls = [
    { url: 'https://www.hkej.com/property/business', section: '工商舖' },
    { url: 'https://www.hkej.com/property/latest', section: '最新' }
  ];

  for (const source of urls) {
    try {
      const html = await fetchText(source.url);
      // Extract article links with titles and dates
      const articleRegex = /<a[^>]*href="(\/property\/article\/id\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = articleRegex.exec(html)) !== null) {
        const title = match[2].trim();
        const url = 'https://www.hkej.com' + match[1];
        // Check if already in data
        if (!existing.data.some(d => d.url === url)) {
          // Extract date from nearby text
          const dateRegex = /(\d{4})年(\d{1,2})月(\d{1,2})日/g;
          const dateMatches = [];
          let dm;
          while ((dm = dateRegex.exec(html)) !== null) {
            dateMatches.push(dm);
          }
          const lastDate = dateMatches.length > 0 ? `${dateMatches[dateMatches.length-1][1]}-${dateMatches[dateMatches.length-1][2].padStart(2,'0')}-${dateMatches[dateMatches.length-1][3].padStart(2,'0')}` : new Date().toISOString().slice(0,10);

          existing.data.push({
            date: lastDate,
            title: title,
            source: 'hkej',
            url: url,
            keyPoint: title,
            category: source.section === '工商舖' ? 'Commercial' : 'Latest'
          });
        }
      }
    } catch(e) {
      console.log('Scrape error for ' + source.url + ': ' + e.message);
    }
  }

  // Keep last 100 entries max
  if (existing.data.length > 100) existing.data = existing.data.slice(-100);

  // Sort by date
  existing.data.sort((a, b) => b.date.localeCompare(a.date));

  existing.fetched = new Date().toISOString();
  fs.writeFileSync(realEstatePath, JSON.stringify(existing, null, 2), 'utf8');
  console.log('Real estate: ' + existing.data.length + ' entries');
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

// ========== 3. Dollar Currency News ==========
async function searchDollarNews() {
  const newsPath = path.join(DASHBOARD_DIR, 'data/news.json');
  let existing = { dollarNews: [], reNews: [], stockNews: [] };
  try { existing = JSON.parse(fs.readFileSync(newsPath, 'utf8')); } catch(e) {}
  return existing;
}

// ========== 4. Git Commit & Push ==========
function gitPush() {
  const exec = require('child_process').execSync;
  const git = 'C:/PROGRA~1/Git/cmd/git.exe';
  try {
    exec(`"${git}" add -A`, { cwd: DASHBOARD_DIR });
    exec(`"${git}" commit -m "Daily update ${new Date().toISOString().slice(0,10)}"`, { cwd: DASHBOARD_DIR });
    exec(`"${git}" push`, { cwd: DASHBOARD_DIR });
    console.log('Git push done');
  } catch(e) {
    console.log('Git error (may be nothing to commit): ' + e.message);
  }
}

// ========== MAIN ==========
async function main() {
  console.log('Dashboard update started: ' + new Date().toISOString());

  // Initialize data dirs
  if (!fs.existsSync(path.join(DASHBOARD_DIR, 'data')))
    fs.mkdirSync(path.join(DASHBOARD_DIR, 'data'), { recursive: true });

  // Fetch data
  await Promise.all([
    fetchMarkets(),
    fetchPrices(),
    scrapeHKEJ()
  ]);

  // Init news if empty
  const news = await searchDollarNews();
  if (!news.dollarNews || news.dollarNews.length === 0) {
    news.dollarNews = [{ title: 'Daily briefing data loads at 8am HKT', date: new Date().toISOString().slice(0,10), source: 'system' }];
  }
  if (!news.stockNews || news.stockNews.length === 0) {
    news.stockNews = [{ title: 'Stock watch news loads at 8am HKT', date: new Date().toISOString().slice(0,10), source: 'system' }];
  }
  news.fetched = new Date().toISOString();
  fs.writeFileSync(path.join(DASHBOARD_DIR, 'data/news.json'), JSON.stringify(news, null, 2), 'utf8');

  // Push
  gitPush();

  console.log('Dashboard update complete!');
}

main().catch(console.error);
