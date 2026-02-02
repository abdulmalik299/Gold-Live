# Gold Live Monster

## What you get
- Live ounce (XAU) price with persistent ▲/▼ deltas (only linked to live price changes).
- Karat cards (24K/22K/21K/18K) per mithqal or gram.
- USD→IQD conversion: empty => USD ($), filled => IQD.
- IQD-only margin slider (0..20000 step 1000) applied to IQD conversions.
- Expectation calculator (custom ounce + USD→IQD + karat + unit + margin).
- Tax (margin) finder: enter local price → computes margin and sets the main slider.
- Connection status pill (Online/Offline).
- Premium chart:
  - Updates only when price changes (noise filter ≥ $0.10)
  - Segment color green/red
  - Pan + zoom
  - Multi-timeframe (1H/24H/7D)
  - Web Worker downsampling for smooth charting
- Shared history so new visitors don't start from zero (data/history.json).

## Why DIRECT can fail on GitHub Pages
Browsers often block the API call due to CORS. This project auto-falls back to FEED mode:
- data/latest.json
- data/history.json

These files are updated server-side by GitHub Actions (no CORS issue).

## Required GitHub settings
Repository → Settings → Actions → General → Workflow permissions:
- ✅ **Read and write permissions**
Then run the workflow once: Actions → **Update Gold Feed** → Run workflow.

## Notes
- GitHub Actions schedule is every 5 minutes. DIRECT mode can still update every 1s if CORS is allowed.
