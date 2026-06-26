const https = require('https');
const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = 'C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

async function scrapeHKEJ() {
  console.log('Scraping hkej.com property news...');

  const realEstatePath = path.join(DASHBOARD_DIR, 'data/real-estate.json');
  let existing = { data: [] };
  try { existing = JSON.parse(fs.readFileSync(realEstatePath, 'utf8')); } catch(e) {}

  const sources = [
    { url: 'https://www.hkej.com/property/business', section: '工商舖' },
    { url: 'https://www.hkej.com/property/latest', section: '最新' }
  ];

  for (const src of sources) {
    try {
      const html = await fetchText(src.url);
      // Extract articles from template section
      const articlePattern = /<h2[^>]*>.*?<a[^>]*href="(\/property\/article\/id\/\d+[^"]*)"[^>]*>([^<]+)<\/a>.*?<\/h2>/gs;
      let match;
      while ((match = articlePattern.exec(html)) !== null) {
        const title = match[2].trim();
        const relUrl = match[1];
        const fullUrl = 'https://www.hkej.com' + relUrl;

        if (!existing.data.some(d => d.url === fullUrl)) {
          existing.data.push({
            date: new Date().toISOString().slice(0, 10),
            title: title,
            source: 'hkej',
            url: fullUrl,
            keyPoint: title,
            category: src.section === '工商舖' ? 'Commercial' : 'Latest'
          });
        }
      }
      console.log(`  ${src.url}: scraped`);
    } catch(e) {
      console.log(`  Error scraping ${src.url}: ${e.message}`);
    }
  }

  // Keep last 100, sort newest first
  existing.data.sort((a, b) => b.date.localeCompare(a.date));
  if (existing.data.length > 100) existing.data = existing.data.slice(0, 100);

  existing.fetched = new Date().toISOString();
  fs.writeFileSync(realEstatePath, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`  Total entries: ${existing.data.length}`);
}

async function buildDollarNews() {
  console.log('Building dollar reserve news from feeds...');

  const sources = [
    { url: 'https://www.reuters.com/world/us/', name: 'Reuters US' },
    { url: 'https://www.ft.com/us-dollar', name: 'FT Dollar' },
    { url: 'https://www.bloomberg.com/markets/currencies', name: 'Bloomberg FX' }
  ];

  const newsPath = path.join(DASHBOARD_DIR, 'data/news.json');
  let newsData = { dollarNews: [], reNews: [], stockNews: [], fetched: new Date().toISOString() };
  try {
    const existing = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
    if (existing.dollarNews) newsData.dollarNews = existing.dollarNews;
    if (existing.stockNews) newsData.stockNews = existing.stockNews;
  } catch(e) {}

  // Scrape the dollar reserve articles from Yahoo Finance
  const yahooUrl = 'https://finance.yahoo.com/tag/us-dollar/';
  try {
    const html = await fetchText(yahooUrl);
    const linkPattern = /<a[^>]*href="(https?:\/\/finance\.yahoo\.com\/news\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    const newArticles = [];
    while ((match = linkPattern.exec(html)) !== null) {
      const title = match[2].trim();
      const url = match[1].includes('http') ? match[1] : 'https://finance.yahoo.com' + match[1];
      if (title.length > 10 && !newArticles.some(a => a.title === title)) {
        newArticles.push({
          date: new Date().toISOString().slice(0, 10),
          title: title,
          source: 'Yahoo Finance',
          url: url,
          summary: ''
        });
      }
    }
    // Only add new ones
    for (const a of newArticles.slice(0, 8)) {
      if (!newsData.dollarNews.some(d => d.title === a.title)) {
        newsData.dollarNews.push(a);
      }
    }
    console.log(`  Dollar news: ${newsData.dollarNews.length} entries`);

    // Also get stock-specific news for portfolio companies
    const tickers = ['0941.HK', '0005.HK', '0939.HK', '0728.HK', '0762.HK', '0883.HK', '0857.HK', '1398.HK', '3988.HK'];
    for (const t of tickers) {
      try {
        const newsUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${t}&region=US&lang=en-US`;
        const rss = await fetchText(newsUrl);
        const itemPattern = /<title>([^<]+)<\/title>/g;
        let m;
        let count = 0;
        while ((m = itemPattern.exec(rss)) !== null && count < 3) {
          const itemTitle = m[1].trim();
          if (itemTitle && itemTitle.length > 5 && !itemTitle.includes('Yahoo Finance') && !itemTitle.includes('SymbolLookup')) {
            if (!newsData.stockNews.some(s => s.title === itemTitle)) {
              newsData.stockNews.push({
                date: new Date().toISOString().slice(0, 10),
                title: `[${t}] ${itemTitle}`,
                source: 'Yahoo Finance',
                url: '',
                summary: ''
              });
            }
            count++;
          }
        }
      } catch(e) {}
    }
    console.log(`  Stock news: ${newsData.stockNews.length} entries`);

  } catch(e) {
    console.log(`  Yahoo error: ${e.message}`);
  }

  // Fallback: add placeholder if empty
  if (newsData.dollarNews.length === 0) {
    newsData.dollarNews = [
      { date: new Date().toISOString().slice(0, 10), title: 'Dollar index update: awaiting data feed', source: 'system', url: '', summary: '' }
    ];
  }
  if (newsData.stockNews.length === 0) {
    newsData.stockNews = [
      { date: new Date().toISOString().slice(0, 10), title: 'Stock news: awaiting data feed', source: 'system', url: '', summary: '' }
    ];
  }

  // Keep capped
  if (newsData.dollarNews.length > 20) newsData.dollarNews = newsData.dollarNews.slice(0, 20);
  if (newsData.stockNews.length > 30) newsData.stockNews = newsData.stockNews.slice(0, 30);

  newsData.fetched = new Date().toISOString();
  fs.writeFileSync(newsPath, JSON.stringify(newsData, null, 2), 'utf8');
  console.log('Dollar + stock news saved');
}

async function main() {
  console.log('Daily update started: ' + new Date().toISOString());

  if (!fs.existsSync(path.join(DASHBOARD_DIR, 'data')))
    fs.mkdirSync(path.join(DASHBOARD_DIR, 'data'), { recursive: true });

  await scrapeHKEJ();
  await buildDollarNews();

  // Git push
  const exec = require('child_process').execSync;
  try {
    exec(`"C:/PROGRA~1/Git/cmd/git.exe" add -A`, { cwd: DASHBOARD_DIR });
    exec(`"C:/PROGRA~1/Git/cmd/git.exe" commit -m "Manual news content update ${new Date().toISOString().slice(0,10)}"`, { cwd: DASHBOARD_DIR });
    exec(`"C:/PROGRA~1/Git/cmd/git.exe" push`, { cwd: DASHBOARD_DIR });
    console.log('Git push completed');
  } catch(e) {
    console.log('Git error: ' + e.message);
  }

  console.log('Done!');
}

main().catch(console.error);
