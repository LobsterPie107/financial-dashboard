# Dashboard Specs

## General
- **Live URL:** https://lobsterpie107.github.io/financial-dashboard/
- **Password:** 123456
- **Platform:** GitHub Pages (free tier, repo made public but password-gated)
- **Tech stack:** Vanilla JS, Chart.js (CDN v4.4.7), Yahoo Finance API, hkej scraping
- **Dark theme** throughout

## Layout: 3 Tabs
Markets | Portfolio | News

Tabs switch via JS (class toggle on `.tab` and `.tab-content` elements).

---

## 1. Markets Tab

### Index Cards (rendered into `#indexCards`)
Six cards shown at top (2x3 grid):
- HSI, SSE, DJIA, S&P 500, Nasdaq, Crude Oil
- Each shows: price + change% with ▲/▼ and color (green/green if positive, red if negative)
- Oil shows `$` prefix on price

### 6-Month Chart (main `#mainChart` canvas)
- Interactive line chart
- Latest price label rendered on the end point via `afterDraw` plugin
- X axis: date labels (short month + day)
- Y axis: numeric labels — oil gets `$` prefix, large numbers get `k` suffix
- Buttons below chart to switch ticker: HSI, S&P 500, Nasdaq, Shanghai, Oil WTI
- Button calls `switchChart(idx)` function

---

## 2. Portfolio Tab

### P&L Summary (`#pnlSummary`)
Above the table — shows Total Value + total P&L $ and % with color coding.

### Portfolio Table (`#portfolioTable`)
9 rows with columns:
Name | Price | Change% | Market Value | P&L $ | P&L %

### 1M Price vs Cost Charts (`#portfolioCharts`)
- Each stock gets a bordered card with a 140px mini line chart
- **Two datasets per chart:**
  1. Price line (green if PnL positive, red if negative) — solid
  2. Cost line (amber, dashed `[4,4]`) — horizontal benchmark at `costPrice`
- **Y axis visible** with `$` labels
- **X axis visible** with date labels (max 6 ticks)
- Header shows stock name + PnL%
- Chart data sourced from `pricesData[].timestamps[]` and `pricesData[].closes[]`

---

## 3. News Tab

Three sections, each one `<li>` with a concise **summary** string (not a list of headlines):

### Dollar Reserve (`#dollarNews`)
- Concise one-liner summarizing all dollar news
- If no data: "No relevant news today"

### HK Real Estate (`#reNews`)
- Price trend summary: Kwun Tong + Mong Kok current avg $/sqft and % change since 2022
- Followed by latest scraped article summaries (max 3 recent)
- Also renders the RE chart below

### Stock Watch (`#stockNews`)
- Per-ticker one-liner summaries
- Max 2 news items per stock
- Source data from `newsData.stockNews`

---

## RE Chart (`#reChart`)
- Two lines: Kwun Tong (blue `#4a7cff`) + Mong Kok (amber `#f59e0b`)
- Y-axis: `$/sqft` with `$` prefix on tick labels
- 18 quarterly data points: 2022-Q1 to 2026-Q2
- Kwun Tong starting $8,200, ending $4,300 (-47.6%)
- Mong Kok starting $12,000, ending $6,500 (-45.8%)

---

## Data Architecture

### File: `data/market-data.json`
```json
{
  "fetched": "ISO timestamp",
  "data": [
    {
      "symbol": "^GSPC",
      "name": "S&P 500",
      "price": 7357.49,
      "prevClose": 6932.05,
      "currency": "USD",
      "timestamps": [...],   // unix timestamps (seconds)
      "closes": [...]        // price values
    }
  ]
}
```
5 tickers: `^HSI`, `000001.SS`, `^DJI`, `^GSPC`, `^IXIC`, `CL=F`

### File: `data/prices.json`
```json
{
  "fetched": "ISO timestamp",
  "data": [
    {
      "symbol": "0939.HK",
      "name": "CCB",
      "price": 8.21,
      "prevClose": 8.73,
      "currency": "HKD",
      "timestamps": [...],   // unix timestamps (seconds)
      "closes": [...]        // ~23 points (1 month daily)
    }
  ]
}
```
9 tickers matching portfolio.

### File: `data/real-estate.json`
```json
{
  "title": "HK Commercial Office Price (per sqft)",
  "kwunTong": [
    { "date": "2022-Q1", "label": "2022 Q1", "value": 8200 },
    ...
  ],
  "mongKok": [...],
  "sources": ["Google AI Overview", "28Hse", "SeeHSE", "Homedash", "Centanet", "Midland"],
  "note": "Interpolated across 18 quarters from ~6 known price points"
}
```

### File: `data/news.json`
```json
{
  "fetched": "ISO timestamp",
  "dollarNews": [...],   // from Yahoo Finance dollar tag
  "reNews": [...],        // from hkej.com scraping
  "stockNews": [...]      // from Yahoo Finance RSS per ticker
}
```

---

## Rendering Flow
1. `checkPW()` / `checkPw()` → unlock overlay, call `initDashboard()`
2. `initDashboard()` → `await loadData()`, then renders all sections
3. `loadData()` → 4 parallel fetches (market-data, prices, real-estate, news)
4. Renders: index cards → main chart → portfolio → mini charts → news → RE chart

---

## Data Refresh
- `scripts/daily-update.js` — fetches prices + news, scrapes hkej, commits & pushes
- Runs via 8am HKT cron job
- Git commit message: `"Manual news content update YYYY-MM-DD"`
- Uses Windows Credential Manager for GitHub auth
- Never uses `windows exec` — uses `require('child_process').execSync`

---

## Style Guide
- Background: dark (`#0f0f1a`, `#1a1a2e`, `#16213e`)
- Positive: green (`#22c55e`)
- Negative: red (`#ef4444`)
- Text: light gray (`#e0e0e0`, `#8892b0`, `#4a5568`)
- Accent: blue (`#4a7cff`)
- Borders: dark blue-gray (`#1e2d3d`, `#2a3a5c`)
- Font: system sans-serif
- Chart color theme matches

---

## Data Format Rules (IMPORTANT — JS uses these field names)
- **marketData[]** objects: `symbol`, `name`, `price`, `prevClose`, `currency`, `timestamps`, `closes`
- **pricesData[]** objects: same keys as marketData
- **indexCards** mapping: `^HSI`→HSI, `000001.SS`→SSE, `^DJI`→DJIA, `^GSPC`→S&P 500, `^IXIC`→NASDAQ, `CL=F`→Crude Oil
- **portfolio config** in HTML: `PORTFOLIO_STOCKS` const array
- News articles stored with `{date, title, source, url, summary}` fields
- RE data stored with `{date, label, value}` per district

---

## Fixed Bugs (Don't Re-introduce)

| Date | Bug | Fix |
|------|-----|-----|
| 2026-06-25 | Emoji encoding corruption → `????` | Removed all emojis from HTML |
| 2026-06-26 | `document.getElementById('totalVal')` → null | Render to `#pnlSummary` instead |
| 2026-06-26 | `regularMarketPrice` doesn't match data | Use `price` and `prevClose` |
| 2026-06-26 | `m.chartData` doesn't exist | Use `m.timestamps` + `m.closes` |
| 2026-06-26 | Duplicate `const chart = m.chartData` crashed script block | Fixed double declaration |
| 2026-06-26 | `mainChart.data.datasets[0].data` length 0 | switchMainChart timing fixed |
| 2026-06-26 | `idx-*` elements missing from HTML | Added card elements to static HTML |
| 2026-06-26 | `renderPortfolioCharts` 1 dataset only (no cost line) | Added Cost dataset with dashed line |
| 2026-06-26 | Mini chart y-axis ticks hidden | Restored y/x axis labels |
| 2026-06-26 | Two contradictory password functions | Both `checkPW` and `checkPw` exist; both need `await` |

---

## Password Functions
There are two sets of password handlers (legacy):

1. **Lowercase `checkPw`** (early code) — uses `CORRECT_PW` const, `pwErr` element, `await initDashboard()`
2. **Uppercase `checkPW`** (later code, duplicate) — hardcodes "123456", uses `pwError` element, NO await
3. HTML button uses `onclick="checkPw()"` (lowercase, correct)
4. DOMContentLoaded listener also calls `checkPW()` (uppercase, legacy)

---

## Known Limitations
- Dollar reserve news scraping from Yahoo Finance is unreliable — often returns "No relevant news today"
- `checkPW()` (uppercase) doesn't await initDashboard — can cause rendering race on Enter key
- `news.json` `dollarNews` and `reNews` are empty arrays on some runs — only `stockNews` has data
- `index.html` is > 25KB single-file (all JS inline)
- GitHub Pages CDN can take 1-30 min to reflect pushed changes
- `reDataHistory` declared as `let reDataHistory = []` not `let reDataHistory = null` — loads fine from JSON

---

## Future Improvements (Not Yet Done)
- Wire `daily-update.js` into the 8am HKT cron properly
- Change password from "123456"
- Better dollar reserve news source (not just Yahoo Finance)
- Fix duplicate password functions (consolidate to one)
