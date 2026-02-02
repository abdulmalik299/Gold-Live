# Gold Monster

Open `index.html` directly to run. For best results (and to avoid CORS issues), run a local static server:

- VS Code Live Server, or
- `python -m http.server 8000` then open `http://localhost:8000/`

Features:
- Live XAU ounce price with up/down deltas
- Karat prices (24/22/21/18) per Mithqal or Gram
- USD→IQD conversion input (auto switches currency)
- Margin slider (0–20,000 step 1,000) in IQD mode
- Expectation calculator (manual ounce + USD→IQD + margin + selectors)
- Tax finder that computes margin and applies to main slider
- Connection status (online/offline) + toasts
- Samsung-like calculator with history and ÷ symbol
- High-performance chart that updates only when price changes
