# Gold Monster – GitHub Actions Price History

This folder adds **automatic shared chart history** for GitHub Pages.

## What this does
- Every **5 minutes**, GitHub Actions:
  - Fetches live XAU gold price
  - Appends it to `data/history.json`
  - Commits the update automatically
- Your site loads this file so **all visitors see the same chart history**

## How to use
1. Copy `.github/` and `data/` folders into your main repository
2. Commit & push
3. Go to **GitHub → Actions → Enable workflows**
4. Wait 5 minutes (or run manually via *workflow_dispatch*)

## Notes
- GitHub Pages is static — this is the only safe way to share live history
- Chart length is capped at **2000 points**
- You can change the cron schedule anytime

## API
Source: https://api.gold-api.com/price/XAU

## GitHub Actions (shared history)

GitHub Pages is static, so the website cannot write to `history.json` by itself.
This repo includes a workflow that **updates `history.json` every 5 minutes** using GitHub Actions.

### Enable it
1. Push this repo to GitHub.
2. Go to **Settings → Actions → General**
3. Under **Workflow permissions**, select:
   - ✅ **Read and write permissions**
   - ✅ **Allow GitHub Actions to create and approve pull requests** (optional)
4. Go to **Actions** tab → enable workflows if prompted.
5. Run it once manually: **Actions → Update gold history.json → Run workflow**.

### What it does
- Fetches the current XAU ounce price from `config.json` (`apiUrl`)
- Appends to `history.json` only when price changes (rounded to 2 decimals)
- Keeps up to `chartMaxPoints` points
