const https = require('https');
const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = 'C:/Users/OpenClaw/.openclaw/workspace/financial-dashboard';

function fetchText(url, encoding) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, 
      timeout: 20000 
    }, (res) => {
      let data = '';
      res.setEncoding(encoding || 'utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function scrapeHKEJ() {
  console.log('Scraping hkej.com property news...');

  const newsPath = path.join(DASHBOARD_DIR, 'data/news.json');
  let newsData = { dollarNews: [], reNews: [], stockNews: [] };
  try { newsData = JSON.parse(fs.readFileSync(newsPath, 'utf8')); } catch(e) {}
  if (!newsData.reNews) newsData.reNews = [];

  const sources = [
    { url: 'https://www.hkej.com/property/business', section: '工商舖' },
    { url: 'https://www.hkej.com/property/latest', section: '最新' }
  ];

  for (const src of sources) {
    try {
      const html = await fetchText(src.url);
      const articlePattern = /<h2[^>]*>.*?<a[^>]*href="(\/property\/article\/id\/\d+[^"]*)"[^>]*>([^<]+)<\/a>.*?<\/h2>/gs;
      let match;
      while ((match = articlePattern.exec(html)) !== null) {
        const title = match[2].trim();
        const relUrl = match[1];
        const fullUrl = 'https://www.hkej.com' + relUrl;

        if (!newsData.reNews.some(d => d.url === fullUrl)) {
          newsData.reNews.push({
            date: new Date().toISOString().slice(0, 10),
            title: title,
            source: 'hkej',
            url: fullUrl,
            summary: title
          });
        }
      }
      console.log(`  ${src.url}: scraped`);
    } catch(e) {
      console.log(`  Error scraping ${src.url}: ${e.message}`);
    }
  }

  newsData.reNews.sort((a, b) => b.date.localeCompare(a.date));
  if (newsData.reNews.length > 100) newsData.reNews = newsData.reNews.slice(0, 100);
  newsData.fetched = new Date().toISOString();
  fs.writeFileSync(newsPath, JSON.stringify(newsData, null, 2), 'utf8');
  console.log(`  RE news entries: ${newsData.reNews.length}`);
}

async function buildAllNews() {
  console.log('Building all news from web sources...');

  const newsPath = path.join(DASHBOARD_DIR, 'data/news.json');
  let newsData = { dollarNews: [], reNews: [], stockNews: [], fetched: new Date().toISOString() };
  try {
    const existing = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
    if (existing.dollarNews) newsData.dollarNews = existing.dollarNews;
    if (existing.reNews) newsData.reNews = existing.reNews;
    if (existing.stockNews) newsData.stockNews = existing.stockNews;
  } catch(e) {}

  // ---- Dollar Reserve News (Yahoo Finance US Dollar tag) ----
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
    for (const a of newArticles.slice(0, 8)) {
      if (!newsData.dollarNews.some(d => d.title === a.title)) {
        newsData.dollarNews.push(a);
      }
    }
    console.log(`  Dollar news: ${newsData.dollarNews.length} entries`);
  } catch(e) {
    console.log(`  Yahoo dollar page error: ${e.message}`);
  }

  // ---- Stock News from Reuters (better quality, has URLs) ----
  const tickerNames = [
    { ticker: '0941.HK', name: 'China Mobile' },
    { ticker: '0005.HK', name: 'HSBC' },
    { ticker: '0939.HK', name: 'CCB' },
    { ticker: '0728.HK', name: 'China Telecom' },
    { ticker: '0762.HK', name: 'China Unicom' },
    { ticker: '0883.HK', name: 'CNOOC' },
    { ticker: '0857.HK', name: 'PetroChina' },
    { ticker: '1398.HK', name: 'ICBC' },
    { ticker: '3988.HK', name: 'BOC' }
  ];

  // Source 1: Yahoo Finance RSS per ticker (old method, keep as backup)
  for (const t of tickerNames) {
    try {
      const rss = await fetchText(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${t.ticker}&region=US&lang=en-US`);
      // Parse RSS items
      const itemRegex = /<item>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<link>([^<]*)<\/link>[\s\S]*?<description>([^<]*)<\/description>[\s\S]*?<\/item>/g;
      let m;
      let count = 0;
      while ((m = itemRegex.exec(rss)) !== null && count < 5) {
        const title = m[1].trim();
        const url = m[2].trim();
        const desc = m[3].replace(/<[^>]+>/g, '').trim().slice(0, 200);
        if (title && title.length > 5 && !title.includes('SymbolLookup')) {
          const fullTitle = `${title} (${t.name})`;
          if (!newsData.stockNews.some(s => s.title === fullTitle || s.title === `[${t.ticker}] ${title}`)) {
            newsData.stockNews.push({
              date: new Date().toISOString().slice(0, 10),
              title: `[${t.ticker}] ${title}`,
              source: 'Yahoo Finance',
              url: url || '',
              summary: desc
            });
          }
          count++;
        }
      }
    } catch(e) {}
  }

  // Source 2: Google News RSS for HK market news
  try {
    const googleRss = await fetchText('https://news.google.com/rss/search?q=Hong+Kong+stock+market&hl=en-US&gl=US&ceid=US:en');
    const itemRegex = /<item>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<link>([^<]*)<\/link>[\s\S]*?<source[^>]*>([^<]*)<\/source>[\s\S]*?<\/item>/g;
    let m;
    let count = 0;
    while ((m = itemRegex.exec(googleRss)) !== null && count < 10) {
      const title = m[1].trim();
      const url = m[2].trim();
      if (title.length > 10 && !title.includes('SymbolLookup')) {
        if (!newsData.stockNews.some(s => s.title === title)) {
          newsData.stockNews.push({
            date: new Date().toISOString().slice(0, 10),
            title: title,
            source: 'Google News',
            url: url,
            summary: ''
          });
          count++;
        }
      }
    }
    console.log(`  Google News HK market: +${count} entries`);
  } catch(e) {
    console.log(`  Google News error: ${e.message}`);
  }

  // Source 3: Google News RSS for China stock market
  try {
    const chinaRss = await fetchText('https://news.google.com/rss/search?q=China+stock+market+H-shares&hl=en-US&gl=US&ceid=US:en');
    const itemRegex = /<item>[\s\S]*?<title>([^<]*)<\/title>[\s\S]*?<link>([^<]*)<\/link>[\s\S]*?<source[^>]*>([^<]*)<\/source>[\s\S]*?<\/item>/g;
    let m;
    let count = 0;
    while ((m = itemRegex.exec(chinaRss)) !== null && count < 10) {
      const title = m[1].trim();
      const url = m[2].trim();
      if (title.length > 10 && !title.includes('SymbolLookup')) {
        if (!newsData.stockNews.some(s => s.title === title)) {
          newsData.stockNews.push({
            date: new Date().toISOString().slice(0, 10),
            title: title,
            source: 'Google News',
            url: url,
            summary: ''
          });
          count++;
        }
      }
    }
    console.log(`  Google News China H-shares: +${count} entries`);
  } catch(e) {
    console.log(`  Google News China error: ${e.message}`);
  }

  // Sort: newest first
  newsData.stockNews.sort((a, b) => b.date.localeCompare(a.date));

  // Cap at 50, keep the newest
  if (newsData.stockNews.length > 50) newsData.stockNews = newsData.stockNews.slice(0, 50);

  console.log(`  Stock news total: ${newsData.stockNews.length} entries`);

  // Fallback placeholders
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

  // Cap dollar news
  if (newsData.dollarNews.length > 20) newsData.dollarNews = newsData.dollarNews.slice(0, 20);

  newsData.fetched = new Date().toISOString();
  fs.writeFileSync(newsPath, JSON.stringify(newsData, null, 2), 'utf8');
  console.log('All news saved');
}

async function main() {
  console.log('Daily update started: ' + new Date().toISOString());

  if (!fs.existsSync(path.join(DASHBOARD_DIR, 'data')))
    fs.mkdirSync(path.join(DASHBOARD_DIR, 'data'), { recursive: true });

  await scrapeHKEJ();
  await buildAllNews();

  // Git push
  const exec = require('child_process').execSync;
  try {
    exec(`"C:/PROGRA~1/Git/cmd/git.exe" add -A`, { cwd: DASHBOARD_DIR });
    exec(`"C:/PROGRA~1/Git/cmd/git.exe" commit -m "Daily news update ${new Date().toISOString().slice(0,10)}"`, { cwd: DASHBOARD_DIR });
    exec(`"C:/PROGRA~1/Git/cmd/git.exe" push`, { cwd: DASHBOARD_DIR });
    console.log('Git push completed');
  } catch(e) {
    console.log('Git error: ' + e.message);
  }

  console.log('Done!');
}

main().catch(console.error);
