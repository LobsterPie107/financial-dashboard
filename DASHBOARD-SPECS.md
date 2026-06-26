# Dashboard Spec - Master Reference

## Password
- Current: `123456`

## Portfolio
- 9 HK dividend stocks, 10,000 shares each
- Ticker / Cost Price:
  - 0941.HK (China Mobile) $67.34
  - 0005.HK (HSBC) $123.35
  - 0939.HK (CCB) $5.60
  - 0728.HK (China Telecom) $3.79
  - 0762.HK (China Unicom) $5.95
  - 0883.HK (CNOOC) $11.31
  - 0857.HK (CNPC) $3.39
  - 1398.HK (ICBC) $4.97
  - 3988.HK (BOC) $3.36

## Layout: 3 Tabs
Markets | Portfolio | News

## Markets Tab
- Index cards: HSI, SSE, DJIA, S&P 500, Nasdaq, Oil WTI (price + change%)
- 6-month interactive chart with latest price label, x/y axis with numbers visible
- Market buttons to switch chart ticker: HSI, S&P 500, Nasdaq, Shanghai, Oil WTI
- Chart type: line, dark theme

## Portfolio Tab
- Table: Name | Price | Change% | Market Value | P&L $ | P&L %
- Total Value + P&L summary above table
- **1M Price vs Cost charts** — individual mini charts per stock showing:
  - Cost line (horizontal benchmark)
  - Price line (1 month)
  - X/Y axis with numbers

## News Tab
3 sections:
1. Dollar Reserve — summaries not headlines
2. HK Commercial Real Estate — chart summary + scraped articles
3. Stock Watch — per-ticker one-liner summaries, max 2 per stock

## RE Chart
- Two lines: Kwun Tong (blue) + Mong Kok (amber)
- Y-axis: $/sqft labels
- From 2022-Q1 to 2026-Q2 (18 quarters)
- Kwun Tong: $8,200 -> $4,300 (-47.6%)
- Mong Kok: $12,000 -> $6,500 (-45.8%)

## Display & Formatting
- Dark theme
- English locale (en-US) for dates
- No emojis in HTML (encoding corruption)
- Plain ASCII text for labels

## Data Sources
- Yahoo Finance API (free)
- hkej.com property section (scraped)
- Chart.js for all charts

## Data Refresh
- daily-update.js fetches prices + news + commits/pushes
- Runs via 8am HKT cron

## Core Rules
1. Cost line required in portfolio charts (horizontal benchmark)
2. Always show x/y axis with numbers
3. Price data label at end of line
4. No emojis in HTML
5. Verify against deployed (not just local)
6. News = summaries, not headlines
7. Regular pushes (not force push) to avoid GitHub Pages confusion
