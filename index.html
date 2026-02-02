<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#0b0a10" />
  <title>Gold Monster — Live XAU + Karat/Mithqal Calculator</title>
  <meta name="description" content="Luxury live gold ounce price with IQD conversion, mithqal/gram, margin slider, expectation tools, tax estimator, and Samsung-like calculator." />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="./style.css" />
  <link rel="manifest" href="./manifest.webmanifest" />
  <link rel="icon" href="./assets/icon.svg" type="image/svg+xml" />
</head>
<body>
  <div class="bg-aurora" aria-hidden="true"></div>
  <div class="noise" aria-hidden="true"></div>

  <header class="topbar">
    <div class="topbar__left">
      <div class="brand">
        <div class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="32" height="32" role="img" aria-label="Gold Monster">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#ffdd8a"/>
                <stop offset="0.55" stop-color="#f7b955"/>
                <stop offset="1" stop-color="#b57a25"/>
              </linearGradient>
            </defs>
            <path fill="url(#g1)" d="M32 4l18 10v18L32 60 14 32V14L32 4z"/>
            <path fill="rgba(0,0,0,.22)" d="M32 4v56L14 32V14L32 4z"/>
            <path fill="rgba(255,255,255,.22)" d="M32 4l18 10v18L32 60V4z"/>
          </svg>
        </div>
        <div class="brand__text">
          <div class="brand__title">Gold Monster</div>
          <div class="brand__sub">Live XAU • Premium Tools • IQD Ready</div>
        </div>
      </div>
    </div>

    <div class="topbar__right">
      <div class="status">
        <div class="pill" id="connPill" title="Connection status">
          <span class="dot" id="connDot"></span>
          <span id="connText">Checking…</span>
        </div>
        <div class="pill pill--muted" title="Last update time">
          <span class="mini-label">Updated</span>
          <span id="updatedAt">—</span>
        </div>
      </div>
      <button class="btn btn--ghost" id="themeBtn" type="button" aria-label="Toggle sparkle mode">
        <span class="btn__icon">✦</span>
        <span class="btn__label">Sparkle</span>
      </button>
    </div>
  </header>

  <main class="shell">
    <section class="hero-grid">
      <div class="card card--hero">
        <div class="card__head">
          <div class="hgroup">
            <h1 class="h1">Live Gold (XAU) — Ounce</h1>
            <p class="muted">Real-time pull from API. Chart updates only when the price changes.</p>
          </div>
          <div class="hero-actions">
            <button class="btn btn--primary" id="refreshBtn" type="button">
              <span class="btn__icon">⟳</span>
              <span class="btn__label">Refresh</span>
            </button>
            <button class="btn btn--ghost" id="pauseBtn" type="button">
              <span class="btn__icon" id="pauseIcon">Ⅱ</span>
              <span class="btn__label" id="pauseLabel">Pause</span>
            </button>
          </div>
        </div>

        <div class="hero-metrics">
          <div class="metric metric--main">
            <div class="metric__label">Ounce price</div>
            <div class="metric__value">
              <span id="liveOunceValue">—</span>
              <span id="liveOunceCurrency" class="currency">$</span>
            </div>
            <div class="metric__delta">
              <span id="liveOunceDir" class="dir">—</span>
              <span id="liveOunceDeltaAbs" class="delta">—</span>
              <span class="sep">•</span>
              <span id="liveOunceDeltaPct" class="delta">—</span>
            </div>
          </div>

          <div class="metric metric--secondary">
            <div class="metric__label">USD → IQD</div>
            <div class="inputline">
              <input id="usdToIqdInput" class="input" inputmode="decimal" placeholder="e.g. 1500" aria-label="USD to IQD price" />
              <button class="mini-btn" id="usdToIqdClear" type="button" title="Clear">✕</button>
            </div>
            <div class="hint">If empty, results stay in <b>$</b>. If filled, results convert to <b>IQD</b>.</div>
          </div>

          <div class="metric metric--secondary">
            <div class="metric__label">Unit</div>
            <div class="seg" role="tablist" aria-label="Unit selector">
              <button class="seg__btn is-on" id="unitLiveMithqal" type="button" role="tab" aria-selected="true">Mithqal</button>
              <button class="seg__btn" id="unitLiveGram" type="button" role="tab" aria-selected="false">Gram</button>
            </div>
            <div class="hint">Mithqal = 5g. Ounce = 31.1035g.</div>
          </div>
        </div>

        <div class="hero-body">
          <div class="chart-wrap">
            <canvas id="priceChart" height="130" aria-label="Gold price chart" role="img"></canvas>
            <div class="chart-footer">
              <div class="chart-badges">
                <span class="badge">Line</span>
                <span class="badge badge--muted">Auto-zoom</span>
                <span class="badge badge--muted">Hover details</span>
              </div>
              <div class="chart-controls">
                <button class="mini-btn" id="chartZoomIn" type="button" title="Zoom in">＋</button>
                <button class="mini-btn" id="chartZoomOut" type="button" title="Zoom out">－</button>
                <button class="mini-btn" id="chartReset" type="button" title="Reset zoom">⟲</button>
              </div>
            </div>
          </div>

          <div class="karat-grid" id="karatGrid">
            <!-- cards created by JS -->
          </div>
        </div>
      </div>

      <aside class="stack">
        <section class="card">
          <div class="card__head">
            <h2 class="h2">Margin Slider (IQD only)</h2>
            <p class="muted">Local taxes/margin per unit. Applies only when converting to IQD.</p>
          </div>
          <div class="sliderbox">
            <div class="sliderrow">
              <input id="marginSlider" type="range" min="0" max="20000" step="1000" value="0" aria-label="Margin slider" />
              <div class="sliderpill">
                <span id="marginValue">0</span><span class="tiny">IQD</span>
              </div>
            </div>
            <div class="sliderhelp">
              <span>0</span><span>20,000</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="mini-grid">
            <div class="mini">
              <div class="mini__label">Live unit</div>
              <div class="mini__value" id="liveUnitLabel">Mithqal</div>
            </div>
            <div class="mini">
              <div class="mini__label">Polling</div>
              <div class="mini__value" id="pollingLabel">1s</div>
            </div>
            <div class="mini">
              <div class="mini__label">Chart points</div>
              <div class="mini__value" id="chartPointsLabel">0</div>
            </div>
            <div class="mini">
              <div class="mini__label">Status</div>
              <div class="mini__value" id="engineLabel">Live</div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <h2 class="h2">Tax (Margin) Finder</h2>
            <p class="muted">Write the daily local gold price per selected unit. We calculate the margin and push it to the main slider.</p>
          </div>

          <div class="formgrid">
            <label class="field">
              <span class="field__label">Local price</span>
              <input id="localPriceInput" class="input" inputmode="decimal" placeholder="Enter local price" />
            </label>

            <label class="field">
              <span class="field__label">Karat</span>
              <select id="taxKaratSelect" class="select">
                <option value="21">21K</option>
                <option value="22">22K</option>
                <option value="18">18K</option>
                <option value="24">24K</option>
              </select>
            </label>

            <label class="field">
              <span class="field__label">Unit</span>
              <select id="taxUnitSelect" class="select">
                <option value="mithqal">Mithqal</option>
                <option value="gram">Gram</option>
              </select>
            </label>

            <button class="btn btn--primary btn--full" id="calcTaxBtn" type="button">
              <span class="btn__icon">⇄</span>
              <span class="btn__label">Calculate & Apply</span>
            </button>
          </div>

          <div class="resultline">
            <div class="resultline__label">Computed margin</div>
            <div class="resultline__value"><span id="taxAmountValue">—</span> <span class="tiny">IQD</span></div>
          </div>
          <div class="hint">If margin is outside 0–20,000 it will clamp and round to nearest 1,000.</div>
        </section>

        <section class="card">
          <div class="card__head">
            <h2 class="h2">Advanced Calculator</h2>
            <p class="muted">Samsung-like layout with history (toggle). Division symbol is ÷.</p>
          </div>

          <div class="calc" id="calc">
            <div class="calc__top">
              <div class="calc__screen">
                <div class="calc__expr" id="calcExpr" aria-label="Calculator expression"> </div>
                <div class="calc__out" id="calcOut" aria-label="Calculator result">0</div>
              </div>
              <div class="calc__actions">
                <button class="mini-btn" id="calcHistoryBtn" type="button" title="Show/Hide history">☰</button>
                <button class="mini-btn" id="calcClearHistBtn" type="button" title="Clear history">🧹</button>
              </div>
            </div>

            <div class="calc__history is-hidden" id="calcHistory" aria-label="Calculator history"></div>

            <div class="calc__keys" aria-label="Calculator buttons">
              <!-- Row 1 -->
              <button class="key key--alt" data-key="C">C</button>
              <button class="key key--alt" data-key="±">±</button>
              <button class="key key--alt" data-key="%">%</button>
              <button class="key key--op" data-key="÷">÷</button>

              <!-- Row 2 -->
              <button class="key" data-key="7">7</button>
              <button class="key" data-key="8">8</button>
              <button class="key" data-key="9">9</button>
              <button class="key key--op" data-key="×">×</button>

              <!-- Row 3 -->
              <button class="key" data-key="4">4</button>
              <button class="key" data-key="5">5</button>
              <button class="key" data-key="6">6</button>
              <button class="key key--op" data-key="−">−</button>

              <!-- Row 4 -->
              <button class="key" data-key="1">1</button>
              <button class="key" data-key="2">2</button>
              <button class="key" data-key="3">3</button>
              <button class="key key--op" data-key="+">+</button>

              <!-- Row 5 -->
              <button class="key key--wide" data-key="0">0</button>
              <button class="key" data-key=".">.</button>
              <button class="key key--eq" data-key="=">=</button>
            </div>
          </div>
        </section>

      </aside>
    </section>

    <section class="card card--wide">
      <div class="card__head">
        <div class="hgroup">
          <h2 class="h2">Expectation Calculator</h2>
          <p class="muted">Forecast with your own ounce price + USD→IQD. Includes karat + unit selection and margin slider.</p>
        </div>
        <div class="pill pill--muted"><span class="mini-label">Mode</span><span>Manual</span></div>
      </div>

      <div class="expect-grid">
        <div class="expect-controls">
          <label class="field">
            <span class="field__label">Expected ounce price</span>
            <input id="expectOunceInput" class="input" inputmode="decimal" placeholder="Enter ounce price (USD)" />
          </label>

          <label class="field">
            <span class="field__label">USD → IQD</span>
            <input id="expectUsdToIqdInput" class="input" inputmode="decimal" placeholder="e.g. 1500" />
          </label>

          <div class="field">
            <span class="field__label">Karat</span>
            <div class="seg seg--wrap" role="tablist" aria-label="Expected karat selector">
              <button class="seg__btn is-on" data-exp-karat="21" type="button" role="tab" aria-selected="true">21K</button>
              <button class="seg__btn" data-exp-karat="22" type="button" role="tab" aria-selected="false">22K</button>
              <button class="seg__btn" data-exp-karat="18" type="button" role="tab" aria-selected="false">18K</button>
              <button class="seg__btn" data-exp-karat="24" type="button" role="tab" aria-selected="false">24K</button>
            </div>
          </div>

          <div class="field">
            <span class="field__label">Unit</span>
            <div class="seg" role="tablist" aria-label="Expected unit selector">
              <button class="seg__btn is-on" id="unitExpMithqal" type="button" role="tab" aria-selected="true">Mithqal</button>
              <button class="seg__btn" id="unitExpGram" type="button" role="tab" aria-selected="false">Gram</button>
            </div>
          </div>

          <div class="field">
            <span class="field__label">Margin slider (IQD)</span>
            <div class="sliderrow">
              <input id="expectMarginSlider" type="range" min="0" max="20000" step="1000" value="0" />
              <div class="sliderpill"><span id="expectMarginValue">0</span><span class="tiny">IQD</span></div>
            </div>
          </div>
        </div>

        <div class="expect-output">
          <div class="expect-card">
            <div class="expect-card__title">Expected price</div>
            <div class="expect-card__value" id="expectResultValue">—</div>
            <div class="expect-card__sub">
              <span id="expectKaratLabel">21K</span>
              <span class="sep">•</span>
              <span id="expectUnitLabel">Mithqal</span>
              <span class="sep">•</span>
              <span id="expectCurrencyLabel">IQD</span>
            </div>
          </div>

          <div class="expect-mini-grid">
            <div class="mini">
              <div class="mini__label">Base</div>
              <div class="mini__value" id="expectBaseValue">—</div>
            </div>
            <div class="mini">
              <div class="mini__label">Margin</div>
              <div class="mini__value" id="expectMarginApplied">—</div>
            </div>
            <div class="mini">
              <div class="mini__label">Per gram</div>
              <div class="mini__value" id="expectPerGramValue">—</div>
            </div>
            <div class="mini">
              <div class="mini__label">Per mithqal</div>
              <div class="mini__value" id="expectPerMithqalValue">—</div>
            </div>
          </div>

          <div class="note">
            <div class="note__icon">★</div>
            <div class="note__text">
              Tip: if you leave USD→IQD empty, the manual section will stay in dollars.
              When USD→IQD is filled, it switches to IQD and applies margin.
            </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="footer">
      <div class="footer__row">
        <div class="footer__left">
          <span class="tiny muted">© <span id="yearNow"></span> Gold Monster</span>
          <span class="tiny muted">• Built for fast decisions</span>
        </div>
        <div class="footer__right">
          <span class="tiny muted">API: gold-api.com</span>
        </div>
      </div>
    </footer>
  </main>

  <!-- Libraries (CDN) -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.umd.min.js"></script>

  <script type="module" src="./logic.js"></script>

  <noscript>
    <div class="noscript">
      This page needs JavaScript to run the live data + calculators.
    </div>
  </noscript>
</body>
</html>
