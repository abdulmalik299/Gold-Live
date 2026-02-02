// logic.js — Gold Monster (fully working)
// Key requirements implemented:
// - Live ounce price from https://api.gold-api.com/price/XAU (DIRECT mode if CORS allows)
// - Fallback FEED mode for GitHub Pages: reads ./data/latest.json + ./data/history.json (updated by Actions)
// - Up/Down indicators (▲/▼) for ounce + each karat card are driven ONLY by live price changes
//   (NOT by sliders). They persist (do NOT reset to zero/white each second).
// - USD→IQD input toggles currency display; if empty show $.
// - Unit selector: Mithqal (5g) or Gram.
// - Margin slider IQD only (0..20000 step 1000) applied to IQD conversions.
// - Expectation calculator (expected ounce, USD→IQD, karat, unit, margin).
// - Tax finder: (localPrice - calculatedLivePrice) => margin; sets main slider.
// - Chart: updates only when price change >= $0.10; segment green/red; multi-timeframe 1H/24H/7D;
//   Web Worker for downsampling; persistent history from data/history.json + localStorage merge.
// - Updated timestamp changes ONLY when price changes (>= $0.10).

/* ======================== Utilities ======================== */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

function toNum(v){
  const s = String(v ?? "").trim().replace(/,/g,"");
  if(!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function fmt(n, digits=0){
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : "—";
}
function clamp(n, a, b){ return Math.min(b, Math.max(a, n)); }
function roundStep(n, step){ return Math.round(n/step)*step; }
function isoNow(){ return new Date().toISOString(); }
function localStamp(iso){
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString();
}
function pct(newV, oldV){
  if(!Number.isFinite(newV) || !Number.isFinite(oldV) || oldV === 0) return null;
  return ((newV - oldV) / oldV) * 100;
}
function sign(delta){
  if(!Number.isFinite(delta) || delta === 0) return { dir:"—", cls:"is-muted" };
  return delta > 0 ? { dir:"▲", cls:"is-green" } : { dir:"▼", cls:"is-red" };
}

/* ======================== Config + State ======================== */
let CFG = null;

const state = {
  paused: false,
  mode: "—",            // DIRECT | FEED
  ounce: null,          // last displayed ounce price (USD)
  lastChangeOunce: null,// baseline for delta (only updates on change >= threshold)
  ounceDeltaAbs: null,
  ounceDeltaPct: null,
  ounceDeltaSign: {dir:"—", cls:"is-muted"},

  // controls
  usdToIqd: null,
  unit: "mithqal",      // mithqal | gram
  margin: 0,            // IQD (applies only if usdToIqd filled)

  // expectation
  exp: { ounce: null, usdToIqd: null, karat: "21", unit: "mithqal", margin: 0 },

  // chart points (merged from shared history + local)
  points: [],
  timeframe: "1h",

  // per-card delta baselines (to keep deltas stable between change events)
  karatBaselines: new Map(), // key -> baseline value
  karatDeltas: new Map(),    // key -> {abs, pct, sign}

  chart: null,
  worker: null,
};

/* ======================== Load config ======================== */
async function loadConfig(){
  const r = await fetch("./config.json", { cache:"no-store" });
  CFG = await r.json();
  $("#noiseText").textContent = `Noise rule: ≥ $${fmt(CFG.noiseThresholdUSD, 2)}`;
}

/* ======================== Connection UI ======================== */
function setConnUI(online, hintText=null){
  const dot = $("#connDot");
  const pill = $("#connPill");
  const text = $("#connText");
  if(!dot || !pill || !text) return;

  if(online){
    dot.style.background = "rgba(61,255,156,.95)";
    dot.style.boxShadow = "0 0 0 4px rgba(61,255,156,.18)";
    pill.style.borderColor = "rgba(61,255,156,.24)";
    pill.style.background = "rgba(61,255,156,.06)";
    text.textContent = "Online";
  }else{
    dot.style.background = "rgba(255,90,120,.95)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,90,120,.16)";
    pill.style.borderColor = "rgba(255,90,120,.22)";
    pill.style.background = "rgba(255,90,120,.06)";
    text.textContent = "Offline";
  }
  if(hintText) $("#hintText").textContent = hintText;
}

/* ======================== Math for prices ======================== */
function karatFactor(k){ return CFG.karats[String(k)]; }
function unitGrams(unit){ return unit === "gram" ? 1 : CFG.constants.mithqalGram; }

function perUnitUSD(ounceUsd, karat, unit){
  // per gram 24k = ounceUsd / 31.1035
  const perGram24 = ounceUsd / CFG.constants.ounceToGram;
  return perGram24 * karatFactor(karat) * unitGrams(unit);
}

function computePrice({ ounceUsd, karat, unit, usdToIqd, marginIQD }){
  const baseUSD = perUnitUSD(ounceUsd, karat, unit);
  if(!usdToIqd){
    return { currency:"$", digits:2, base: baseUSD, margin: 0, total: baseUSD };
  }
  const baseIQD = baseUSD * usdToIqd;
  const m = Number.isFinite(marginIQD) ? marginIQD : 0;
  return { currency:"IQD", digits:0, base: baseIQD, margin: m, total: baseIQD + m };
}

/* ======================== Inputs: numeric-only ======================== */
function attachNumeric(el, onChange){
  if(!el) return;
  const handler = () => {
    const raw = el.value;
    // allow digits, dot, minus; keep one dot
    const cleaned = raw.replace(/[^\d.\-]/g,"").replace(/(?!^)-/g,"");
    const parts = cleaned.split(".");
    const fixed = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
    if(fixed !== raw) el.value = fixed;
    onChange?.();
  };
  el.addEventListener("input", handler);
  el.addEventListener("change", handler);
}

/* ======================== Ounce rendering (persistent deltas) ======================== */
function renderMode(){ $("#modeText").textContent = state.mode; }
function renderUpdated(iso){ $("#updatedText").textContent = iso ? localStamp(iso) : "—"; }

function renderOunce(){
  const v = state.ounce;
  $("#ounceValue").textContent = Number.isFinite(v) ? fmt(v,2) : "—";

  const dirEl = $("#ounceDir");
  const absEl = $("#ounceAbs");
  const pctEl = $("#ouncePct");

  const s = state.ounceDeltaSign || {dir:"—", cls:"is-muted"};
  dirEl.textContent = s.dir;
  dirEl.classList.remove("is-green","is-red","is-muted");
  dirEl.classList.add(s.cls);

  if(state.ounceDeltaAbs == null){
    absEl.textContent = "—";
    pctEl.textContent = "—";
    absEl.classList.remove("is-green","is-red");
    pctEl.classList.remove("is-green","is-red");
    return;
  }

  const cls = state.ounceDeltaAbs > 0 ? "is-green" : "is-red";
  absEl.classList.remove("is-green","is-red"); pctEl.classList.remove("is-green","is-red");
  absEl.classList.add(cls); pctEl.classList.add(cls);

  absEl.textContent = `${fmt(Math.abs(state.ounceDeltaAbs),2)}$`;
  pctEl.textContent = `${fmt(Math.abs(state.ounceDeltaPct ?? 0),3)}%`;
}

/* ======================== Karat cards ======================== */
function buildKaratCards(){
  const host = $("#karats");
  host.innerHTML = "";
  const order = ["24","22","21","18"];

  order.forEach(k => {
    const el = document.createElement("div");
    el.className = "kcard";
    el.dataset.k = k;
    el.innerHTML = `
      <div class="kcard__top">
        <div style="min-width:0">
          <div class="kcard__k">${k}K</div>
          <div class="kcard__unit" data-unit>—</div>
        </div>
        <div class="pill pill--muted" style="padding:8px 10px;font-size:11px;box-shadow:none;background:rgba(255,255,255,.02)">
          <span class="pill__label">Mode</span><span data-mode>—</span>
        </div>
      </div>

      <div class="kcard__price">
        <span data-total>—</span> <span class="tiny" data-cur>—</span>
      </div>

      <!-- IMPORTANT: delta uses ONLY live price changes (not margin slider) -->
      <div class="kcard__delta">
        <span class="dir" data-dir>—</span>
        <span class="delta" data-abs>—</span>
        <span class="sep">•</span>
        <span class="delta" data-pct>—</span>
      </div>

      <div class="metaGrid">
        <div class="meta">
          <div class="meta__label">Base</div>
          <div class="meta__value" data-base>—</div>
        </div>
        <div class="meta">
          <div class="meta__label">Margin</div>
          <div class="meta__value" data-margin>—</div>
        </div>
      </div>
    `;
    host.appendChild(el);
  });
}

function renderKarats(){
  const ounce = state.ounce;
  const usdToIqd = state.usdToIqd;
  const unit = state.unit;
  const marginIQD = usdToIqd ? state.margin : 0;

  $$(".kcard").forEach(card => {
    const k = card.dataset.k;
    card.querySelector("[data-unit]").textContent = unit === "gram" ? "Per gram" : "Per mithqal";

    if(!Number.isFinite(ounce)){
      for(const sel of ["[data-mode]","[data-total]","[data-cur]","[data-base]","[data-margin]","[data-dir]","[data-abs]","[data-pct]"]){
        card.querySelector(sel).textContent = "—";
      }
      return;
    }

    // Price output includes margin only in IQD mode
    const r = computePrice({ ounceUsd: ounce, karat:k, unit, usdToIqd, marginIQD });

    card.querySelector("[data-mode]").textContent = usdToIqd ? "IQD" : "USD";
    card.querySelector("[data-total]").textContent = fmt(r.total, r.digits);
    card.querySelector("[data-cur]").textContent = r.currency;
    card.querySelector("[data-base]").textContent = `${fmt(r.base, r.digits)} ${r.currency}`;
    card.querySelector("[data-margin]").textContent = (r.currency === "IQD") ? `${fmt(r.margin,0)} IQD` : "—";

    // Delta logic (NOT based on margin): we measure movement of BASE price
    const key = `${k}|${unit}|${usdToIqd ? "IQD" : "USD"}|BASE`;
    const baseline = state.karatBaselines.get(key);

    if(Number.isFinite(baseline)){
      const da = r.base - baseline;
      const dp = pct(r.base, baseline);
      const info = sign(da);

      const dirEl = card.querySelector("[data-dir]");
      const absEl = card.querySelector("[data-abs]");
      const pctEl = card.querySelector("[data-pct]");

      dirEl.textContent = info.dir;
      dirEl.classList.remove("is-green","is-red","is-muted");
      dirEl.classList.add(info.cls);

      const cls = da > 0 ? "is-green" : da < 0 ? "is-red" : "is-muted";
      absEl.classList.remove("is-green","is-red"); pctEl.classList.remove("is-green","is-red");
      if(cls !== "is-muted"){ absEl.classList.add(cls); pctEl.classList.add(cls); }

      absEl.textContent = `${fmt(Math.abs(da), r.digits)} ${r.currency}`;
      pctEl.textContent = `${fmt(Math.abs(dp ?? 0), 3)}%`;
    }else{
      card.querySelector("[data-dir]").textContent = "—";
      card.querySelector("[data-abs]").textContent = "—";
      card.querySelector("[data-pct]").textContent = "—";
      // baseline will be set on first valid change event
    }
  });
}

/* ======================== Chart (Worker + Chart.js) ======================== */
function loadLocalPoints(){
  try{
    const raw = localStorage.getItem("gold_monster_points_v1");
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch{ return []; }
}
function saveLocalPoints(points){
  try{
    localStorage.setItem("gold_monster_points_v1", JSON.stringify(points.slice(-CFG.chart.maxPoints)));
  }catch{}
}
function mergePoints(a, b){
  const map = new Map();
  for(const p of (a||[])){
    if(p?.t && Number.isFinite(Number(p.p))) map.set(String(p.t), {t:String(p.t), p:Number(p.p)});
  }
  for(const p of (b||[])){
    if(p?.t && Number.isFinite(Number(p.p))) map.set(String(p.t), {t:String(p.t), p:Number(p.p)});
  }
  return [...map.values()].sort((x,y)=> x.t < y.t ? -1 : 1).slice(-CFG.chart.maxPoints);
}

function ensureChart(){
  if(state.chart) return;
  const canvas = $("#chart");
  if(!canvas || !window.Chart) return;

  state.worker = new Worker("./chart-worker.js");
  state.worker.onmessage = (ev) => {
    const { type, payload } = ev.data || {};
    if(type !== "built") return;
    const { labels, data, shownCount } = payload;

    state.chart.data.labels = labels;
    state.chart.data.datasets[0].data = data;
    state.chart.update("none");

    $("#pointsCount").textContent = String(shownCount);
  };

  state.chart = new Chart(canvas, {
    type: "line",
    data: { labels: [], datasets: [{
      label: "XAU (oz)",
      data: [],
      pointRadius: 0,
      tension: .22,
      borderWidth: 2,
      borderColor: "rgba(247,196,107,.92)",
      fill: true,
      backgroundColor: (ctx) => {
        const c = ctx.chart;
        const area = c.chartArea;
        if(!area) return "rgba(247,196,107,.10)";
        const g = c.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, "rgba(247,196,107,.26)");
        g.addColorStop(.6, "rgba(247,196,107,.08)");
        g.addColorStop(1, "rgba(247,196,107,0)");
        return g;
      },
      segment: {
        borderColor: (seg) => {
          const { p0, p1 } = seg;
          if(!p0 || !p1) return "rgba(247,196,107,.92)";
          return p1.parsed.y >= p0.parsed.y
            ? "rgba(61,255,156,.90)"
            : "rgba(255,90,120,.90)";
        }
      }
    }]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (it) => ` ${fmt(it.parsed.y,2)} $` } },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" }
        }
      },
      scales: {
        x: { ticks: { color:"rgba(255,255,255,.58)", maxTicksLimit: 7 }, grid: { color:"rgba(255,255,255,.06)" } },
        y: { ticks: { color:"rgba(255,255,255,.58)", callback: (v) => fmt(v,0) }, grid: { color:"rgba(255,255,255,.06)" } }
      }
    }
  });

  $("#zIn")?.addEventListener("click",  () => state.chart?.zoom(1.15));
  $("#zOut")?.addEventListener("click", () => state.chart?.zoom(0.87));
  $("#zReset")?.addEventListener("click",() => state.chart?.resetZoom());
}

function buildChart(){
  ensureChart();
  if(!state.worker) return;
  state.worker.postMessage({
    type: "build",
    payload: { points: state.points, timeframe: state.timeframe, maxShown: CFG.chart.maxShown }
  });
}

function maybeAddPoint(price, iso){
  const last = state.points.length ? state.points[state.points.length-1] : null;
  const thr = CFG.noiseThresholdUSD;

  if(last && Number.isFinite(last.p)){
    if(Math.abs(price - last.p) < thr) return false;
  }
  state.points.push({ t: iso, p: price });
  if(state.points.length > CFG.chart.maxPoints){
    state.points.splice(0, state.points.length - CFG.chart.maxPoints);
  }
  saveLocalPoints(state.points);
  return true;
}

/* ======================== Fetching: DIRECT and FEED ======================== */
async function fetchDirectOnce(){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), CFG.poll.directTimeoutMs);
  try{
    const r = await fetch(CFG.apiUrl, { cache:"no-store", signal: ctrl.signal });
    clearTimeout(t);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    // accept multiple shapes: {price}, number, {data:{price}}, etc.
    const raw = (typeof j === "number") ? j : (j?.price ?? j?.value ?? j?.data?.price ?? null);
    const p = Number(raw);
    if(!Number.isFinite(p)) throw new Error("Bad price");
    return { price: Math.round(p*100)/100, updated_at: isoNow(), source: "direct" };
  }catch(e){
    clearTimeout(t);
    throw e;
  }
}

async function readFeed(){
  const [latestR, histR] = await Promise.all([
    fetch("./data/latest.json", { cache:"no-store" }),
    fetch("./data/history.json", { cache:"no-store" }),
  ]);
  const latest = latestR.ok ? await latestR.json() : null;
  const hist   = histR.ok ? await histR.json() : null;
  return { latest, hist };
}

/* ======================== Update pipeline ======================== */
function onPriceChanged(newPrice, iso){
  // Update persistent ounce delta vs last change baseline:
  if(state.lastChangeOunce == null){
    state.lastChangeOunce = newPrice;
    state.ounceDeltaAbs = 0;
    state.ounceDeltaPct = 0;
    state.ounceDeltaSign = {dir:"—", cls:"is-muted"};
  }else{
    const da = newPrice - state.lastChangeOunce;
    const dp = pct(newPrice, state.lastChangeOunce);
    state.ounceDeltaAbs = da;
    state.ounceDeltaPct = dp;
    state.ounceDeltaSign = sign(da);
    // baseline moves ONLY on change event (so the delta stays stable until next change)
    state.lastChangeOunce = newPrice;
  }

  // Update karat baselines (BASE values only) so their deltas also persist:
  const ounce = newPrice;
  const unit = state.unit;
  const usdToIqd = state.usdToIqd;
  const curMode = usdToIqd ? "IQD" : "USD";
  for(const k of ["24","22","21","18"]){
    const r = computePrice({ ounceUsd: ounce, karat:k, unit, usdToIqd, marginIQD: 0 }); // BASE only
    const key = `${k}|${unit}|${curMode}|BASE`;
    if(!state.karatBaselines.has(key)){
      state.karatBaselines.set(key, r.base);
    }else{
      // baseline becomes new base on change event
      state.karatBaselines.set(key, r.base);
    }
  }

  // Add chart point (noise threshold handled there too)
  maybeAddPoint(newPrice, iso);
  buildChart();

  // updated time changes ONLY on price change event
  renderUpdated(iso);
}

async function tick(){
  if(state.paused) return;

  // Try DIRECT first
  try{
    const d = await fetchDirectOnce();
    state.mode = "DIRECT";
    renderMode();
    setConnUI(true, "Direct API (1s). If CORS blocks on GitHub Pages, auto-fallback to FEED mode.");

    const prev = state.ounce;
    state.ounce = d.price;

    const thr = CFG.noiseThresholdUSD;
    const changed = (prev == null) || (Math.abs(state.ounce - prev) >= thr);

    if(changed){
      onPriceChanged(state.ounce, d.updated_at);
    }

    renderOunce();
    renderKarats();
    return;
  }catch{
    // fall through to FEED
  }

  // FEED mode
  state.mode = "FEED";
  renderMode();

  try{
    const { latest, hist } = await readFeed();
    const hint = "FEED mode: GitHub Actions updates data/latest.json + data/history.json. (Set Actions permissions to Read & Write.)";
    const price = latest && Number.isFinite(Number(latest.price)) ? Number(latest.price) : null;

    if(price == null){
      setConnUI(false, hint);
      renderOunce();
      renderKarats();
      return;
    }
    setConnUI(true, hint);

    // hydrate points from shared history + local (always merge; stable)
    const seedPts = Array.isArray(hist?.points) ? hist.points : [];
    const normalizedSeed = seedPts.map(p=>({t:String(p.t||""), p:Number(p.p)})).filter(p=>p.t && Number.isFinite(p.p));
    state.points = mergePoints(normalizedSeed, loadLocalPoints());

    const prev = state.ounce;
    state.ounce = Math.round(price*100)/100;

    const thr = CFG.noiseThresholdUSD;
    const changed = (prev == null) || (Math.abs(state.ounce - prev) >= thr);

    if(changed){
      onPriceChanged(state.ounce, latest.updated_at || isoNow());
    }

    renderOunce();
    renderKarats();
  }catch{
    setConnUI(false, "Offline or feed files missing. Ensure data/latest.json and data/history.json exist in repo.");
  }
}

/* ======================== Expectation ======================== */
function renderExpectation(){
  const o = state.exp.ounce;
  const usd = state.exp.usdToIqd;
  const karat = state.exp.karat;
  const unit = state.exp.unit;
  const margin = state.exp.margin;

  const out = $("#expResult");
  const cur = $("#expCur");

  if(!Number.isFinite(o) || !Number.isFinite(usd)){
    out.textContent = "—";
    cur.textContent = "IQD";
    return;
  }
  const r = computePrice({ ounceUsd:o, karat, unit, usdToIqd: usd, marginIQD: margin });
  out.textContent = fmt(r.total, r.digits);
  cur.textContent = r.currency;
}

/* ======================== Tax Finder ======================== */
function applyTax(){
  const local = toNum($("#localPrice").value);
  const ounce = state.ounce;
  const usdToIqd = state.usdToIqd;

  if(!Number.isFinite(local) || !Number.isFinite(ounce) || !Number.isFinite(usdToIqd)){
    $("#taxResult").textContent = "—";
    return;
  }

  const karat = $("#taxKarat").value;
  const unit  = $("#taxUnit").value;

  // requirement: "calculated live gold price of karats - local shoppers price = taxes amount"
  // To set slider as taxes amount (positive), we do: taxes = local - calculatedBase (so if local is higher, margin positive).
  const baseIQD = computePrice({ ounceUsd: ounce, karat, unit, usdToIqd, marginIQD: 0 }).base;
  const taxes = Math.max(0, local - baseIQD);

  const rounded = roundStep(clamp(taxes, CFG.margin.min, CFG.margin.max), CFG.margin.step);

  $("#taxResult").textContent = fmt(rounded, 0);

  // push to main slider
  state.margin = rounded;
  $("#margin").value = String(rounded);
  $("#marginVal").textContent = fmt(rounded, 0);

  renderKarats();
}

/* ======================== Calculator ======================== */
const calc = { expr:"", out:"0", history:[], lastEq:false };

function loadCalc(){
  try{
    const raw = localStorage.getItem("gold_monster_calc_v1");
    if(raw){
      const arr = JSON.parse(raw);
      if(Array.isArray(arr)) calc.history = arr.slice(0,60);
    }
  }catch{}
}
function saveCalc(){
  try{ localStorage.setItem("gold_monster_calc_v1", JSON.stringify(calc.history.slice(0,60))); }catch{}
}
function renderCalc(){
  $("#cExpr").textContent = calc.expr || " ";
  $("#cOut").textContent  = calc.out  || "0";
  const box = $("#history");
  box.innerHTML = "";
  calc.history.forEach(it => {
    const d = document.createElement("div");
    d.className = "hItem";
    d.innerHTML = `<div class="hEq">${it.eq}</div><div class="hRes">${it.res}</div>`;
    box.appendChild(d);
  });
}
function evalCalc(expr){
  const cleaned = expr
    .replaceAll("−","-")
    .replaceAll("×","*")
    .replaceAll("÷","/")
    .replace(/\s+/g,"");
  if(!cleaned) return 0;

  // allow only safe chars
  if(!/^[0-9+\-*/().%]+$/.test(cleaned)) throw new Error("bad");

  // percent: 50% => (50/100)
  const pctFixed = cleaned.replace(/(\d+(\.\d+)?)%/g,"($1/100)");
  const fn = Function(`"use strict"; return (${pctFixed});`);
  const r = fn();
  if(!Number.isFinite(r)) throw new Error("nan");
  return r;
}
function press(k){
  const isOp = ["+","−","×","÷"].includes(k);
  const isD  = /^\d$/.test(k);

  if(k === "C"){ calc.expr=""; calc.out="0"; calc.lastEq=false; renderCalc(); return; }
  if(k === "±"){
    const n = Number(calc.out);
    calc.out = Number.isFinite(n) ? String(-n) : "0";
    renderCalc(); return;
  }
  if(k === "="){
    if(!calc.expr) return;
    try{
      const r = evalCalc(calc.expr);
      const res = String(r);
      calc.history.unshift({ eq: calc.expr, res });
      calc.history = calc.history.slice(0,60);
      saveCalc();
      calc.out = res;
      calc.expr = "";
      calc.lastEq = true;
    }catch{
      calc.out="Error";
      calc.lastEq=true;
    }
    renderCalc(); return;
  }

  if(calc.lastEq){
    if(isD || k === "."){ calc.expr=""; calc.out="0"; }
    else if(isOp || k === "%"){ calc.expr = calc.out; }
    calc.lastEq = false;
  }

  if(isD){ calc.expr += k; renderCalc(); return; }
  if(k === "."){
    const tail = calc.expr.split(/[+\-−×÷*/]/).pop();
    if(tail.includes(".")) return;
    calc.expr += ".";
    renderCalc(); return;
  }
  if(k === "%"){ calc.expr += "%"; renderCalc(); return; }

  if(isOp){
    if(!calc.expr) calc.expr = calc.out;
    // replace last operator
    calc.expr = calc.expr.replace(/[+\-−×÷]$/,"");
    calc.expr += k;
    renderCalc(); return;
  }
}

/* ======================== UI wiring ======================== */
function setUnit(u){
  state.unit = u;
  $("#unitMithqal").classList.toggle("is-on", u === "mithqal");
  $("#unitGram").classList.toggle("is-on", u === "gram");
  renderKarats();
}

function setTimeframe(tf){
  state.timeframe = tf;
  $$("[data-tf]").forEach(b => b.classList.toggle("is-on", b.dataset.tf === tf));
  buildChart();
}

/* ======================== Init ======================== */
async function init(){
  await loadConfig();

  // build cards
  buildKaratCards();
  renderMode();
  renderUpdated(null);

  // merge shared + local points at start
  try{
    const { hist } = await readFeed();
    const seedPts = Array.isArray(hist?.points) ? hist.points : [];
    const normalizedSeed = seedPts.map(p=>({t:String(p.t||""), p:Number(p.p)})).filter(p=>p.t && Number.isFinite(p.p));
    state.points = mergePoints(normalizedSeed, loadLocalPoints());
  }catch{
    state.points = loadLocalPoints();
  }
  $("#pointsCount").textContent = String(state.points.length);
  buildChart();

  // connection listeners
  window.addEventListener("online",  ()=> setConnUI(true));
  window.addEventListener("offline", ()=> setConnUI(false));

  // inputs
  attachNumeric($("#usdToIqd"), ()=>{
    state.usdToIqd = toNum($("#usdToIqd").value);
    renderKarats();
  });
  $("#usdClear")?.addEventListener("click", ()=>{
    $("#usdToIqd").value = "";
    state.usdToIqd = null;
    renderKarats();
  });

  $("#margin")?.addEventListener("input", ()=>{
    state.margin = toNum($("#margin").value) ?? 0;
    $("#marginVal").textContent = fmt(state.margin,0);
    renderKarats();
  });

  $("#unitMithqal")?.addEventListener("click", ()=> setUnit("mithqal"));
  $("#unitGram")?.addEventListener("click", ()=> setUnit("gram"));

  $("#pauseBtn")?.addEventListener("click", ()=>{
    state.paused = !state.paused;
    $("#pauseIcon").textContent = state.paused ? "▶" : "Ⅱ";
    $("#pauseLabel").textContent = state.paused ? "Resume" : "Pause";
  });

  $("#refreshBtn")?.addEventListener("click", ()=> tick());

  $("#glowBtn")?.addEventListener("click", ()=> document.body.classList.toggle("glow"));

  // timeframe
  $$("[data-tf]").forEach(b => b.addEventListener("click", ()=> setTimeframe(b.dataset.tf)));

  // expectation
  attachNumeric($("#expOunce"), ()=>{
    state.exp.ounce = toNum($("#expOunce").value);
    renderExpectation();
  });
  attachNumeric($("#expUsdToIqd"), ()=>{
    state.exp.usdToIqd = toNum($("#expUsdToIqd").value);
    renderExpectation();
  });
  $("#expKarat")?.addEventListener("change", ()=>{ state.exp.karat = $("#expKarat").value; renderExpectation(); });
  $("#expUnit")?.addEventListener("change", ()=>{ state.exp.unit  = $("#expUnit").value;  renderExpectation(); });
  $("#expMargin")?.addEventListener("input", ()=>{
    state.exp.margin = toNum($("#expMargin").value) ?? 0;
    $("#expMarginVal").textContent = fmt(state.exp.margin,0);
    renderExpectation();
  });

  // tax finder
  attachNumeric($("#localPrice"), ()=>{});
  $("#applyTax")?.addEventListener("click", applyTax);

  // calculator
  loadCalc(); renderCalc();
  $("#keys")?.addEventListener("click", (e)=>{
    const b = e.target.closest("[data-k]");
    if(!b) return;
    press(b.dataset.k);
  });
  $("#histToggle")?.addEventListener("click", ()=> $("#history").classList.toggle("is-hidden"));
  $("#histClear")?.addEventListener("click", ()=>{ calc.history=[]; saveCalc(); renderCalc(); });

  // First tick
  await tick();

  // Polling:
  // - A fast 1s timer that calls tick() (DIRECT tries first). FEED will still be safe.
  // - FEED files are polled too; updates only on change.
  setInterval(()=> tick(), CFG.poll.directMs);
}

init().catch((e)=>{
  console.error(e);
  setConnUI(false, "App failed to start. Check the console for errors.");
});
