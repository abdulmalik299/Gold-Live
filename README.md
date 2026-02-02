# Gold Monster (Regenerated)

Open `index.html` directly, but for best results (and to avoid CORS restrictions in some browsers/regions),
run a local static server:

- VS Code Live Server, or
- `python -m http.server 8000` then open `http://localhost:8000/`

## What was wrong before?
- `logic.js` had a broken comment near the top which caused a JavaScript syntax error. When JS fails to parse, **none of the buttons, chart, or live price can work**.
- Some RGBA values were malformed in JS/CSS and could cause chart rendering issues.

This regenerated build fixes those issues and rewires everything cleanly.
