// Gold Monster — logic.js (Regenerated)
// Fixes critical issues from the previous build:
// 1) A broken comment near the top caused a JS syntax error, so NOTHING ran. (See prior file snippet) 
// 2) Several RGBA strings were malformed (",58" vs ".58") which affected chart rendering.
// This version is clean, defensive, and fully wired.

/* =========================
   UTILITIES
========================= */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

function clamp(n, a, b){ return Math.min(b, Math.max(a, n)); }
function roundToStep(n, step){ return Math.round(n/step)*step; }

function nowLocalString(){
  const d = new Date();
  const pad = (x)=> String(x).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* Piercing comparisons matter:
   using strict float equality can flicker; so we compare using a fixed rounding to 2 decimals for ounce. */
function normalizePrice(p){
  if (p == null || Number.isNaN(p)) return null;
  return Math.round(p * 100) / 100;
}

function toNumberLoose(v){
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const cleaned = s.replace(/,/g,"").replace(/\s+/g,"");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatNumber(n, digits=0){
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {maximumFractionDigits: digits, minimumFractionDigits: digits});
}

function pctChange(newV, oldV){
  if (!Number.isFinite(newV) || !Number.isFinite(oldV) || oldV === 0) return null;
  return ((newV - oldV) / oldV) * 100;
}
function absChange(newV, oldV){
  if (!Number.isFinite(newV) || !Number.isFinite(oldV)) return null;
  return (newV - oldV);
}
function signClass(delta){
  if (!Number.isFinite(delta) || delta === 0) return {dir:"—", cls:"is-muted"};
  if (delta > 0) return {dir:"▲", cls:"is-green"};
  return {dir:"▼", cls:"is-red"};
}
function safeText(el, text){ if (el) el.textContent = text; }

function toast(msg, kind="info"){
  let t = $("#toast");
  if (!t){
    t = document.createElement("div");
    t.id="toast";
    t.style.position="fixed";
    t.style.left="50%";
    t.style.bottom="16px";
    t.style.transform="translateX(-50%)";
    t.style.zIndex="9999";
    t.style.padding="12px 14px";
    t.style.borderRadius="16px";
    t.style.border="1px solid rgba(255,255,255,.12)";
    t.style.backdropFilter="blur(14px)";
    t.style.boxShadow="0 18px 60px rgba(0,0,0,.55)";
    t.style.fontFamily="Inter, system-ui, sans-serif";
    t.style.fontWeight="800";
    t.style.fontSize="12px";
    t.style.maxWidth="92vw";
    t.style.textAlign="center";
    document.body.appendChild(t);
  }
  const bg = kind==="ok"
    ? "rgba(61,255,156,.14)"
    : kind==="bad"
      ? "rgba(255,90,120,.14)"
      : "rgba(255,255,255,.06)";
  t.style.background = bg;
  t.textContent = msg;
  t.style.opacity="1";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=>{ t.style.opacity="0"; }, 2400);
}

/* =========================
   CONFIG
========================= */
let CFG = null;
async function loadConfig(){
  const res = await fetch("./config.json", {cache:"no-store"});
  CFG = await res.json();
  return CFG;
}

/* =========================
   STATE
========================= */
const state = {
  paused:false,
  online:navigator.onLine,
  lastFetchOk:true,

  liveOunce:null,
  prevLiveOunce:null,
  liveOunceNorm:null,
  prevLiveOunceNorm:null,

  usdToIqd:null,              // null -> USD mode
  marginIqd:0,
  liveUnit:"mithqal",         // mithqal or gram

  // expectation
  expOunce:null,
  expUsdToIqd:null,
  expMarginIqd:0,
  expKarat:"21",
  expUnit:"mithqal",

  // tax finder
  taxLocalPrice:null,
  taxKarat:"21",
  taxUnit:"mithqal",

  // derived cache for deltas (so each karat has its own delta)
  derivedPrev: new Map(),
  lastDeltas: new Map(),
  lastOunceDeltaAbs: null,
  lastOunceDeltaPct: null,
};

/* =========================
   CONNECTION STATUS
========================= */
function setOnlineStatus(isOnline, reason=""){
  state.online = isOnline;
  const pill = $("#connPill");
  const dot = $("#connDot");
  const text = $("#connText");
  if (!pill || !dot || !text) return;

  if (isOnline){
    dot.style.background = "rgba(61,255,156,.95)";
    dot.style.boxShadow = "0 0 0 4px rgba(61,255,156,.18)";
    text.textContent = "Online";
    pill.style.borderColor = "rgba(61,255,156,.24)";
    pill.style.background = "rgba(61,255,156,.06)";
    if (reason) toast(`Online — ${reason}`, "ok");
  }else{
    dot.style.background = "rgba(255,90,120,.95)";
    dot.style.boxShadow = "0 0 0 4px rgba(255,90,120,.16)";
    text.textContent = "Offline";
    pill.style.borderColor = "rgba(255,90,120,.22)";
    pill.style.background = "rgba(255,90,120,.06)";
    if (reason) toast(`Offline — ${reason}`, "bad");
  }
}
window.addEventListener("online", ()=> setOnlineStatus(true, "connection restored"));
window.addEventListener("offline", ()=> setOnlineStatus(false, "connection lost"));

/* =========================
   CALC ENGINE
========================= */
function unitMultiplier(unit){
  return (unit === "gram") ? 1 : CFG.mithqalGram;
}
function karatFactor(k){ return CFG.karats[String(k)]; }

function basePerUnitFromOunceUSD(ounceUsd, k, unit){
  // per gram 24k in USD
  const perGram24 = ounceUsd / CFG.ounceToGram;
  const factor = karatFactor(k);
  const grams = unitMultiplier(unit);
  return perGram24 * factor * grams;
}

function computeDisplayPrice({ounceUsd, karat, unit, usdToIqd, marginIqd}){
  const baseUsd = basePerUnitFromOunceUSD(ounceUsd, karat, unit);
  if (!usdToIqd){
    return {mode:"USD", value: baseUsd, base: baseUsd, marginApplied: 0, currency:"$"};
  }
  const baseIqd = baseUsd * usdToIqd;
  const margin = Number.isFinite(marginIqd) ? marginIqd : 0;
  return {mode:"IQD", value: baseIqd + margin, base: baseIqd, marginApplied: margin, currency:"IQD"};
}

/* =========================
   DOM BUILDERS
========================= */
function buildKaratCards(){
  const grid = $("#karatGrid");
  if (!grid) return;
  grid.innerHTML = "";
  ["24","22","21","18"].forEach(k=>{
    const card = document.createElement("div");
    card.className = "kcard";
    card.dataset.karat = k;
    card.innerHTML = `
      <div class="kcard__top">
        <div>
          <div class="kcard__name">${k}K</div>
          <div class="kcard__unit" data-unit-label>—</div>
        </div>
        <div class="pill pill--muted" style="padding:8px 10px;font-size:11px;">
          <span class="mini-label">Mode</span>
          <span data-mode>—</span>
        </div>
      </div>

      <div class="kcard__price"><span data-price>—</span> <span data-currency class="tiny">—</span></div>

      <div class="kcard__delta">
        <span class="dir is-muted" data-dir>—</span>
        <span class="delta" data-delta-abs>—</span>
        <span class="sep">•</span>
        <span class="delta" data-delta-pct>—</span>
      </div>

      <div class="kcard__meta">
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
    grid.appendChild(card);
  });
}

/* =========================
   CHART
========================= */
let chart = null;

function ensureZoomPlugin(){
  // In Chart.js v4, zoom plugin attaches itself when loaded. Just guard usage.
  return !!(window.Chart && window.ChartZoom) || !!(window.Chart && window.Chart.registry);
}

function createChart(){
  const canvas = $("#priceChart");
  if (!canvas || !window.Chart) return;

  const data = {
    labels: [],
    datasets: [{
      label: "XAU (oz)",
      data: [],
      pointRadius: 0,
      tension: 0.22,
      borderWidth: 2,
      borderColor: "rgba(247,196,107,.85)",
      fill: true,
      backgroundColor: (ctx)=>{
        const chart = ctx.chart;
        const {ctx: c, chartArea} = chart;
        if (!chartArea) return "rgba(247,196,107,.08)";
        const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, "rgba(247,196,107,.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        return g;
      },
      segment: {
        borderColor: (c)=>{
          const {p0, p1} = c;
          if (!p0 || !p1) return "rgba(247,196,107,.85)";
          return (p1.parsed.y >= p0.parsed.y)
            ? "rgba(61,255,156,.85)"
            : "rgba(255,90,120,.85)";
        }
      }
    }]
  };

  chart = new Chart(canvas, {
    type: "line",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {mode: "index", intersect: false},
      plugins: {
        legend: {display:false},
        decimation: {enabled: true, algorithm: "lttb", samples: 250},
        tooltip: {
          callbacks: {
            label: (item)=> ` ${formatNumber(item.parsed.y, 2)} $`
          }
        },
        zoom: {
          pan: {enabled: true, mode: "x"},
          zoom: {wheel: {enabled: true}, pinch: {enabled: true}, mode: "x"}
        }
      },
      scales: {
        x: {
          ticks: {color: "rgba(255,255,255,.58)", maxTicksLimit: 6},
          grid: {color: "rgba(255,255,255,.06)"}
        },
        y: {
          ticks: {color: "rgba(255,255,255,.58)", callback: (v)=> formatNumber(v, 0)},
          grid: {color: "rgba(255,255,255,.06)"}
        }
      }
    }
  });

  $("#chartZoomIn")?.addEventListener("click", ()=> chart?.zoom(1.15));
  $("#chartZoomOut")?.addEventListener("click", ()=> chart?.zoom(0.87));
  $("#chartReset")?.addEventListener("click", ()=> chart?.resetZoom());

/* =========================
   CHART HISTORY (GitHub Pages friendly)
   - We ship a seed file: history.json (static, in repo).
   - We also persist locally (per device) via localStorage.
   NOTE: A static site cannot write a shared JSON for all visitors without a backend.
========================= */
function chartHistoryKey(){
  return (CFG && CFG.storageKeys && CFG.storageKeys.chartHistory) ? CFG.storageKeys.chartHistory : "gm_chart_history_v1";
}

async function loadSeedHistory(){
  try{
    const res = await fetch("./history.json", {cache:"no-store"});
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !Array.isArray(j.labels) || !Array.isArray(j.prices)) return null;
    return j;
  }catch(_){
    return null;
  }
}

function loadLocalHistory(){
  try{
    const raw = localStorage.getItem(chartHistoryKey());
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || !Array.isArray(j.labels) || !Array.isArray(j.prices)) return null;
    return j;
  }catch(_){
    return null;
  }
}

function persistChartHistory(){
  if (!chart) return;
  const payload = {
    labels: chart.data.labels.slice(- (CFG.chartMaxPoints || 900)),
    prices: chart.data.datasets[0].data.slice(- (CFG.chartMaxPoints || 900)),
    updatedAt: new Date().toISOString()
  };
  try{ localStorage.setItem(chartHistoryKey(), JSON.stringify(payload)); }catch(_){}
}

async function hydrateChartHistory(){
  if (!chart) return;
  const local = loadLocalHistory();
  const seed = await loadSeedHistory();
  const src = (local && local.prices && local.prices.length) ? local : seed;

  if (src && src.prices && src.prices.length){
    // Keep only the most recent max points
    const max = CFG.chartMaxPoints || 900;
    const labels = src.labels.slice(-max);
    const prices = src.prices.slice(-max);
    chart.data.labels = labels;
    chart.data.datasets[0].data = prices;
    chart.update("none");
    safeText($("#chartPointsLabel"), String(labels.length));
  }
}
}

function chartAddPoint(price){
  if (!chart) return;
  const t = new Date();
  chart.data.labels.push(t.toLocaleTimeString());
  chart.data.datasets[0].data.push(price);

  const max = CFG.chartMaxPoints || 900;
  while (chart.data.labels.length > max){
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update("none");
  safeText($("#chartPointsLabel"), String(chart.data.labels.length));
  persistChartHistory();
}

/* =========================
   LIVE DATA FETCH
========================= */
async function fetchLiveOunce(){
  if (state.paused) return;

  try{
    const res = await fetch(CFG.apiUrl, {cache:"no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const price = (typeof j === "number") ? j : (j?.price ?? j?.value ?? j?.data?.price ?? null);
    const p = toNumberLoose(price);
    if (!Number.isFinite(p)) throw new Error("Invalid price in response");

    state.lastFetchOk = true;
    setOnlineStatus(true);

    const oldRaw = state.liveOunce;
    const oldNorm = state.liveOunceNorm;

    state.liveOunce = p;
    state.liveOunceNorm = normalizePrice(p);

    const changed = (oldNorm == null) || (state.liveOunceNorm !== oldNorm);

    // Only advance "previous" when the price actually changes.
    if (changed){
      state.prevLiveOunce = oldRaw;
      state.prevLiveOunceNorm = oldNorm;
    }
    if (changed){
      safeText($("#updatedAt"), nowLocalString());
      chartAddPoint(state.liveOunceNorm);
    }
    renderAll(changed);
  }catch(err){
    state.lastFetchOk = false;
    setOnlineStatus(navigator.onLine, navigator.onLine ? "API unreachable" : "connection lost");
    // show a one-time toast when first failing
    if (fetchLiveOunce._lastFail !== true){
      toast("Live API failed. If you opened the HTML file directly, use a local server. (CORS)", "bad");
    }
    fetchLiveOunce._lastFail = true;
    renderAll(false);
  }
}

/* =========================
   RENDERERS
========================= */
function renderOunce(changed=false){
  const val = state.liveOunceNorm;
  safeText($("#liveOunceValue"), val==null ? "—" : formatNumber(val, 2));
  safeText($("#liveOunceCurrency"), state.usdToIqd ? "IQD" : "$");

  let abs = absChange(state.liveOunceNorm, state.prevLiveOunceNorm);
  let pct = pctChange(state.liveOunceNorm, state.prevLiveOunceNorm);

  if (changed && Number.isFinite(abs) && abs !== 0){
    state.lastOunceDeltaAbs = abs;
    state.lastOunceDeltaPct = pct;
  }
  if (!changed && state.lastOunceDeltaAbs != null){
    abs = state.lastOunceDeltaAbs;
    pct = state.lastOunceDeltaPct;
  }
  const dirInfo = signClass(abs);

  const dirEl = $("#liveOunceDir");
  const absEl = $("#liveOunceDeltaAbs");
  const pctEl = $("#liveOunceDeltaPct");

  safeText(dirEl, dirInfo.dir);
  dirEl.classList.remove("is-green","is-red","is-muted");
  dirEl.classList.add(dirInfo.cls);

  if (abs == null){
    safeText(absEl, "—");
    safeText(pctEl, "—");
    absEl.classList.remove("is-green","is-red");
    pctEl.classList.remove("is-green","is-red");
  }else{
    const cls = abs>0 ? "is-green" : (abs<0 ? "is-red" : "");
    absEl.classList.remove("is-green","is-red");
    pctEl.classList.remove("is-green","is-red");
    if (cls){ absEl.classList.add(cls); pctEl.classList.add(cls); }

    safeText(absEl, `${formatNumber(Math.abs(abs), 2)}$`);
    safeText(pctEl, `${formatNumber(Math.abs(pct ?? 0), 3)}%`);
  }
}

function renderKaratCards(changed=false, inputChanged=false){
  const ounce = state.liveOunceNorm;
  const usdToIqd = state.usdToIqd;
  const unit = state.liveUnit;

  $$(".kcard").forEach(card=>{
    const k = card.dataset.karat;
    const res = (ounce==null) ? null : computeDisplayPrice({
      ounceUsd: ounce,
      karat: k,
      unit,
      usdToIqd,
      marginIqd: usdToIqd ? state.marginIqd : 0
    });

    const priceEl = card.querySelector("[data-price]");
    const currEl = card.querySelector("[data-currency]");
    const modeEl = card.querySelector("[data-mode]");
    const unitEl = card.querySelector("[data-unit-label]");
    const baseEl = card.querySelector("[data-base]");
    const marginEl = card.querySelector("[data-margin]");
    const dirEl = card.querySelector("[data-dir]");
    const absEl = card.querySelector("[data-delta-abs]");
    const pctEl = card.querySelector("[data-delta-pct]");

    safeText(unitEl, unit==="gram" ? "Per gram" : "Per mithqal");

    if (!res){
      safeText(priceEl, "—"); safeText(currEl, "—"); safeText(modeEl, "—");
      safeText(baseEl, "—"); safeText(marginEl, "—");
      safeText(dirEl, "—"); safeText(absEl, "—"); safeText(pctEl, "—");
      return;
    }

    safeText(modeEl, res.mode);
    safeText(currEl, res.currency === "IQD" ? "IQD" : "$");

    const digits = res.currency === "IQD" ? 0 : 2;
    safeText(priceEl, formatNumber(res.value, digits));
    safeText(baseEl, `${formatNumber(res.base, digits)} ${res.currency}`);
    safeText(marginEl, res.currency === "IQD" ? `${formatNumber(res.marginApplied,0)} IQD` : "—");

    const key = `live|${k}|${unit}|${res.currency}`;
    const prev = state.derivedPrev.get(key);
    const next = res.value;

    // Keep last visible delta instead of resetting to 0 each poll.
    let abs = null, pct = null;
    const last = state.lastDeltas.get(key);

    const canCompute = Number.isFinite(prev) && Number.isFinite(next);
    if ((changed || inputChanged) && canCompute){
      abs = next - prev;
      pct = prev !== 0 ? (abs / prev) * 100 : null;
      if (Number.isFinite(abs) && abs !== 0){
        state.lastDeltas.set(key, {abs, pct});
      }else if (last){
        abs = last.abs;
        pct = last.pct;
      }
    }else if (last){
      abs = last.abs;
      pct = last.pct;
    }

    // Advance the reference snapshot only when the ounce changed OR user changed inputs,
    // so we don't "eat" the delta by re-storing the same value every second.
    if ((changed || inputChanged) || !Number.isFinite(prev)){
      if (Number.isFinite(next)) state.derivedPrev.set(key, next);
    }

    const dirInfo = signClass(abs);
    safeText(dirEl, dirInfo.dir);
    dirEl.classList.remove("is-green","is-red","is-muted");
    dirEl.classList.add(dirInfo.cls);

    if (abs == null){
      safeText(absEl, "—");
      safeText(pctEl, "—");
      absEl.classList.remove("is-green","is-red");
      pctEl.classList.remove("is-green","is-red");
    }else{
      const cls = abs>0 ? "is-green" : (abs<0 ? "is-red" : "");
      absEl.classList.remove("is-green","is-red");
      pctEl.classList.remove("is-green","is-red");
      if (cls){ absEl.classList.add(cls); pctEl.classList.add(cls); }

      const absDigits = (res.currency==="IQD") ? 0 : 2;
      safeText(absEl, `${formatNumber(Math.abs(abs), absDigits)} ${res.currency}`);
      safeText(pctEl, `${formatNumber(Math.abs(pct ?? 0), 3)}%`);
    }
  });
}

function renderLiveMeta(){
  safeText($("#liveUnitLabel"), state.liveUnit==="gram" ? "Gram" : "Mithqal");
  safeText($("#pollingLabel"), `${(CFG.pollMs/1000).toFixed(0)}s`);
  safeText($("#engineLabel"), state.paused ? "Paused" : "Live");
}

function renderExpectation(){
  const ounce = state.expOunce;
  const usdToIqd = state.expUsdToIqd;
  const k = state.expKarat;
  const unit = state.expUnit;

  if (!Number.isFinite(ounce)){
    safeText($("#expectResultValue"), "—");
    safeText($("#expectBaseValue"), "—");
    safeText($("#expectMarginApplied"), "—");
    safeText($("#expectPerGramValue"), "—");
    safeText($("#expectPerMithqalValue"), "—");
    safeText($("#expectCurrencyLabel"), usdToIqd ? "IQD" : "$");
    return;
  }

  const res = computeDisplayPrice({
    ounceUsd: ounce,
    karat: k,
    unit,
    usdToIqd,
    marginIqd: usdToIqd ? state.expMarginIqd : 0
  });

  safeText($("#expectKaratLabel"), `${k}K`);
  safeText($("#expectUnitLabel"), unit==="gram" ? "Gram" : "Mithqal");
  safeText($("#expectCurrencyLabel"), res.currency);

  const digits = res.currency==="IQD" ? 0 : 2;
  safeText($("#expectResultValue"), `${formatNumber(res.value, digits)} ${res.currency}`);
  safeText($("#expectBaseValue"), `${formatNumber(res.base, digits)} ${res.currency}`);
  safeText($("#expectMarginApplied"), res.currency==="IQD" ? `${formatNumber(res.marginApplied,0)} IQD` : "—");

  const perG = computeDisplayPrice({ounceUsd: ounce, karat:k, unit:"gram", usdToIqd, marginIqd: 0});
  const perM = computeDisplayPrice({ounceUsd: ounce, karat:k, unit:"mithqal", usdToIqd, marginIqd: 0});
  safeText($("#expectPerGramValue"), `${formatNumber(perG.value, perG.currency==="IQD"?0:2)} ${perG.currency}`);
  safeText($("#expectPerMithqalValue"), `${formatNumber(perM.value, perM.currency==="IQD"?0:2)} ${perM.currency}`);
}

function renderAll(changed=false, inputChanged=false){
  renderOunce(changed);
  renderLiveMeta();
  renderKaratCards(changed, inputChanged);
  renderExpectation();
}

/* =========================
   INPUT VALIDATION
========================= */
function attachNumericInput(el, onChange){
  if (!el) return;
  const handler = ()=>{
    const raw = el.value;
    const cleaned = raw
      .replace(/[^\d\.\-]/g,"")
      .replace(/(?!^)-/g,"");
    const parts = cleaned.split(".");
    const fixed = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : cleaned;
    if (fixed !== raw) el.value = fixed;
    onChange?.();
  };
  el.addEventListener("input", handler);
  el.addEventListener("change", handler);
}

/* =========================
   TAX FINDER -> SLIDER SYNC
========================= */
function computeTaxAndApply(){
  const local = state.taxLocalPrice;
  const ounce = state.liveOunceNorm;
  const usdToIqd = state.usdToIqd;

  if (!Number.isFinite(local)) return toast("Enter local price first.", "bad");
  if (!Number.isFinite(ounce)) return toast("Live ounce not ready yet.", "bad");
  if (!Number.isFinite(usdToIqd)) return toast("Fill USD→IQD (IQD mode) first.", "bad");

  const res = computeDisplayPrice({
    ounceUsd: ounce,
    karat: state.taxKarat,
    unit: state.taxUnit,
    usdToIqd,
    marginIqd: 0
  });

  // You asked: (calculated live price) - (local price) = taxes amount.
  // That value may be negative (if local is higher than base). The slider needs positive margin,
  // so we set margin = max(0, local - base) in practice.
  const taxesAsWritten = res.value - local;
  const marginPractical = Math.max(0, -taxesAsWritten);
  const clamped = clamp(marginPractical, CFG.margin.min, CFG.margin.max);
  const rounded = roundToStep(clamped, CFG.margin.step);

  safeText($("#taxAmountValue"), formatNumber(rounded,0));

  state.marginIqd = rounded;
  const slider = $("#marginSlider");
  slider.value = String(rounded);
  safeText($("#marginValue"), formatNumber(rounded,0));
  renderAll(false, true);

  toast("Margin applied to main slider.", "ok");
}

/* =========================
   CALCULATOR
========================= */
const calcState = { expr:"", out:"0", lastWasEq:false, history: [] };

function escapeHtml(s){
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function loadCalcHistory(){
  try{
    const raw = localStorage.getItem(CFG.storageKeys.calcHistory);
    if (raw){
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) calcState.history = arr.slice(0, 60);
    }
  }catch{}
}
function saveCalcHistory(){
  try{
    localStorage.setItem(CFG.storageKeys.calcHistory, JSON.stringify(calcState.history.slice(0,60)));
  }catch{}
}

function renderCalc(){
  safeText($("#calcExpr"), calcState.expr || " ");
  safeText($("#calcOut"), calcState.out || "0");

  const box = $("#calcHistory");
  if (!box) return;
  box.innerHTML = "";
  calcState.history.forEach(item=>{
    const div = document.createElement("div");
    div.className = "hist-item";
    div.innerHTML = `<div class="hist-eq">${escapeHtml(item.eq)}</div><div class="hist-res">${escapeHtml(item.res)}</div>`;
    box.appendChild(div);
  });
}

// Evaluate expression with + − × ÷ and % (unary)
function evalExpression(expr){
  const cleaned = expr
    .replaceAll("−","-")
    .replaceAll("×","*")
    .replaceAll("÷","/")
    .replace(/\s+/g,"");

  if (!cleaned) return 0;

  const tokens = [];
  let i=0;
  while (i < cleaned.length){
    const ch = cleaned[i];
    if (/[0-9.]/.test(ch)){
      let j=i+1;
      while (j<cleaned.length && /[0-9.]/.test(cleaned[j])) j++;
      tokens.push({t:"num", v: cleaned.slice(i,j)});
      i=j; continue;
    }
    if (ch === "%"){ tokens.push({t:"pct"}); i++; continue; }
    if ("+-*/()".includes(ch)){ tokens.push({t:"op", v: ch}); i++; continue; }
    throw new Error("Bad character");
  }

  const out = [];
  const ops = [];
  const prec = {"+":1,"-":1,"*":2,"/":2};
  const leftAssoc = {"+":true,"-":true,"*":true,"/":true};
  let prevType = "start";

  for (const t of tokens){
    if (t.t === "num"){ out.push(t); prevType="num"; continue; }
    if (t.t === "pct"){ out.push(t); prevType="pct"; continue; }

    if (t.t === "op"){
      if (t.v === "("){ ops.push(t); prevType="("; continue; }
      if (t.v === ")"){
        while (ops.length && ops[ops.length-1].v !== "("){ out.push(ops.pop()); }
        if (!ops.length) throw new Error("Mismatched paren");
        ops.pop(); prevType=")"; continue;
      }

      if (t.v === "-" && (prevType==="start" || prevType==="(" || prevType==="op")){
        out.push({t:"num", v:"0"});
      }

      const myPrec = prec[t.v] ?? 0;
      while (ops.length){
        const top = ops[ops.length-1];
        if (top.v === "(") break;
        const topPrec = prec[top.v] ?? 0;
        if (topPrec > myPrec || (topPrec === myPrec && leftAssoc[t.v])) out.push(ops.pop());
        else break;
      }
      ops.push(t);
      prevType="op";
    }
  }
  while (ops.length){
    const top = ops.pop();
    if (top.v === "(") throw new Error("Mismatched paren");
    out.push(top);
  }

  const stack = [];
  for (const t of out){
    if (t.t === "num"){ 
      const n = Number(t.v); 
      if (!Number.isFinite(n)) throw new Error("Bad number");
      stack.push(n);
      continue;
    }
    if (t.t === "pct"){
      if (!stack.length) throw new Error("Bad percent");
      const n = stack.pop();
      stack.push(n/100);
      continue;
    }
    if (t.t === "op"){
      const b = stack.pop();
      const a = stack.pop();
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error("Bad op args");
      let r=0;
      if (t.v==="+") r=a+b;
      else if (t.v==="-") r=a-b;
      else if (t.v==="*") r=a*b;
      else if (t.v==="/") r = b===0 ? Infinity : a/b;
      else throw new Error("Bad op");
      stack.push(r);
    }
  }
  if (stack.length !== 1) throw new Error("Bad expression");
  return stack[0];
}

function calcPress(key){
  const isOp = ["+","−","×","÷"].includes(key);
  const isDigit = /^[0-9]$/.test(key);

  if (key === "C"){
    calcState.expr = "";
    calcState.out = "0";
    calcState.lastWasEq = false;
    renderCalc();
    return;
  }

  if (key === "±"){
    if (!calcState.expr){
      const n = Number(calcState.out);
      calcState.out = Number.isFinite(n) ? String(-n) : "0";
      renderCalc();
      return;
    }
    const m = calcState.expr.match(/(-?\d+(\.\d+)?)$/);
    if (m){
      const before = calcState.expr.slice(0, -m[0].length);
      const n = Number(m[0]);
      calcState.expr = before + String(-n);
      renderCalc();
    }
    return;
  }

  if (key === "="){
    if (!calcState.expr) return;
    try{
      const r = evalExpression(calcState.expr);
      const resStr = Number.isFinite(r) ? String(r) : "Error";
      calcState.history.unshift({eq: calcState.expr, res: resStr, t: Date.now()});
      calcState.history = calcState.history.slice(0, 60);
      saveCalcHistory();
      calcState.out = resStr;
      calcState.expr = "";
      calcState.lastWasEq = true;
    }catch{
      calcState.out = "Error";
      calcState.lastWasEq = true;
    }
    renderCalc();
    return;
  }

  if (calcState.lastWasEq){
    if (isDigit || key === "."){
      calcState.expr = "";
      calcState.out = "0";
    }else if (isOp || key === "%"){
      calcState.expr = calcState.out;
    }
    calcState.lastWasEq = false;
  }

  if (isDigit){ calcState.expr += key; renderCalc(); return; }

  if (key === "."){
    const tail = calcState.expr.split(/[+\-−×÷*/]/).pop();
    if (tail.includes(".")) return;
    calcState.expr += ".";
    renderCalc();
    return;
  }

  if (key === "%"){ calcState.expr += "%"; renderCalc(); return; }

  if (isOp){
    if (!calcState.expr) calcState.expr = calcState.out;
    calcState.expr = calcState.expr.replace(/[+\-−×÷]$/,"");
    calcState.expr += key;
    renderCalc();
    return;
  }
}

/* =========================
   PREFS
========================= */
function savePrefs(){
  const prefs = {
    usdToIqd: $("#usdToIqdInput")?.value ?? "",
    marginIqd: $("#marginSlider")?.value ?? "0",
    liveUnit: state.liveUnit,
    expOunce: $("#expectOunceInput")?.value ?? "",
    expUsdToIqd: $("#expectUsdToIqdInput")?.value ?? "",
    expMarginIqd: $("#expectMarginSlider")?.value ?? "0",
    expKarat: state.expKarat,
    expUnit: state.expUnit,
  };
  try{ localStorage.setItem(CFG.storageKeys.prefs, JSON.stringify(prefs)); }catch{}
}

function restorePrefs(){
  try{
    const raw = localStorage.getItem(CFG.storageKeys.prefs);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return;

    if (p.usdToIqd != null) $("#usdToIqdInput").value = p.usdToIqd;
    if (p.marginIqd != null) $("#marginSlider").value = p.marginIqd;
    if (p.liveUnit) state.liveUnit = p.liveUnit;

    if (p.expOunce != null) $("#expectOunceInput").value = p.expOunce;
    if (p.expUsdToIqd != null) $("#expectUsdToIqdInput").value = p.expUsdToIqd;
    if (p.expMarginIqd != null) $("#expectMarginSlider").value = p.expMarginIqd;
    if (p.expKarat) state.expKarat = p.expKarat;
    if (p.expUnit) state.expUnit = p.expUnit;
  }catch{}
}

/* =========================
   EVENTS + INIT
========================= */
function bindUI(){
  safeText($("#yearNow"), String(new Date().getFullYear()));

  $("#themeBtn")?.addEventListener("click", ()=>{
    const on = document.documentElement.getAttribute("data-sparkle") === "on";
    document.documentElement.setAttribute("data-sparkle", on ? "off" : "on");
  });

  $("#pauseBtn")?.addEventListener("click", ()=>{
    state.paused = !state.paused;
    safeText($("#pauseIcon"), state.paused ? "▶" : "Ⅱ");
    safeText($("#pauseLabel"), state.paused ? "Resume" : "Pause");
    toast(state.paused ? "Live updates paused." : "Live updates resumed.", state.paused ? "bad" : "ok");
    renderLiveMeta();
  });

  $("#refreshBtn")?.addEventListener("click", ()=> fetchLiveOunce());

  // USD→IQD
  const usdEl = $("#usdToIqdInput");
  attachNumericInput(usdEl, ()=>{
    const n = toNumberLoose(usdEl.value);
    state.usdToIqd = Number.isFinite(n) ? n : null;
    renderAll(false, true);
    savePrefs();
  });
  $("#usdToIqdClear")?.addEventListener("click", ()=>{
    usdEl.value = "";
    state.usdToIqd = null;
    renderAll(false, true);
    savePrefs();
  });

  // margin slider
  const ms = $("#marginSlider");
  ms.addEventListener("input", ()=>{
    state.marginIqd = toNumberLoose(ms.value) ?? 0;
    safeText($("#marginValue"), formatNumber(state.marginIqd,0));
    renderAll(false, true);
    savePrefs();
  });

  // live unit seg
  const setLiveUnit = (u)=>{
    state.liveUnit = u;
    $("#unitLiveMithqal")?.classList.toggle("is-on", u==="mithqal");
    $("#unitLiveGram")?.classList.toggle("is-on", u==="gram");
    $("#unitLiveMithqal")?.setAttribute("aria-selected", u==="mithqal");
    $("#unitLiveGram")?.setAttribute("aria-selected", u==="gram");
    renderAll(false, true);
    savePrefs();
  };
  $("#unitLiveMithqal")?.addEventListener("click", ()=> setLiveUnit("mithqal"));
  $("#unitLiveGram")?.addEventListener("click", ()=> setLiveUnit("gram"));

  // tax finder
  attachNumericInput($("#localPriceInput"), ()=>{ state.taxLocalPrice = toNumberLoose($("#localPriceInput").value); });
  $("#taxKaratSelect")?.addEventListener("change", (e)=>{ state.taxKarat = e.target.value; });
  $("#taxUnitSelect")?.addEventListener("change", (e)=>{ state.taxUnit = e.target.value; });
  $("#calcTaxBtn")?.addEventListener("click", computeTaxAndApply);

  // expectation
  attachNumericInput($("#expectOunceInput"), ()=>{
    state.expOunce = toNumberLoose($("#expectOunceInput").value);
    renderExpectation(); savePrefs();
  });
  attachNumericInput($("#expectUsdToIqdInput"), ()=>{
    const n = toNumberLoose($("#expectUsdToIqdInput").value);
    state.expUsdToIqd = Number.isFinite(n) ? n : null;
    renderExpectation(); savePrefs();
  });

  $$("[data-exp-karat]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.expKarat = btn.dataset.expKarat;
      $$("[data-exp-karat]").forEach(b=>{
        b.classList.toggle("is-on", b.dataset.expKarat === state.expKarat);
        b.setAttribute("aria-selected", b.dataset.expKarat === state.expKarat ? "true" : "false");
      });
      renderExpectation(); savePrefs();
    });
  });

  const setExpUnit = (u)=>{
    state.expUnit = u;
    $("#unitExpMithqal")?.classList.toggle("is-on", u==="mithqal");
    $("#unitExpGram")?.classList.toggle("is-on", u==="gram");
    $("#unitExpMithqal")?.setAttribute("aria-selected", u==="mithqal");
    $("#unitExpGram")?.setAttribute("aria-selected", u==="gram");
    renderExpectation(); savePrefs();
  };
  $("#unitExpMithqal")?.addEventListener("click", ()=> setExpUnit("mithqal"));
  $("#unitExpGram")?.addEventListener("click", ()=> setExpUnit("gram"));

  const ems = $("#expectMarginSlider");
  ems.addEventListener("input", ()=>{
    state.expMarginIqd = toNumberLoose(ems.value) ?? 0;
    safeText($("#expectMarginValue"), formatNumber(state.expMarginIqd,0));
    renderExpectation(); savePrefs();
  });

  // calculator
  loadCalcHistory();
  renderCalc();
  $("#calc")?.addEventListener("click", (e)=>{
    const btn = e.target.closest("[data-key]");
    if (!btn) return;
    calcPress(btn.dataset.key);
  });
  $("#calcHistoryBtn")?.addEventListener("click", ()=> $("#calcHistory")?.classList.toggle("is-hidden"));
  $("#calcClearHistBtn")?.addEventListener("click", ()=>{
    calcState.history = []; saveCalcHistory(); renderCalc(); toast("History cleared.", "ok");
  });

  window.addEventListener("keydown", (e)=>{
    const map = {"/":"÷","*":"×","-":"−","Enter":"=","Backspace":"C"};
    if (e.key in map) calcPress(map[e.key]);
    else if (/^[0-9]$/.test(e.key)) calcPress(e.key);
    else if (e.key === ".") calcPress(".");
    else if (e.key === "+") calcPress("+");
    else if (e.key === "%") calcPress("%");
  });
}

function applyRestoredToState(){
  state.usdToIqd = toNumberLoose($("#usdToIqdInput")?.value) ?? null;
  state.marginIqd = toNumberLoose($("#marginSlider")?.value) ?? 0;
  safeText($("#marginValue"), formatNumber(state.marginIqd,0));

  state.expOunce = toNumberLoose($("#expectOunceInput")?.value);
  state.expUsdToIqd = toNumberLoose($("#expectUsdToIqdInput")?.value) ?? null;
  state.expMarginIqd = toNumberLoose($("#expectMarginSlider")?.value) ?? 0;
  safeText($("#expectMarginValue"), formatNumber(state.expMarginIqd,0));

  // reflect unit UI
  $("#unitLiveMithqal")?.classList.toggle("is-on", state.liveUnit==="mithqal");
  $("#unitLiveGram")?.classList.toggle("is-on", state.liveUnit==="gram");
  $("#unitExpMithqal")?.classList.toggle("is-on", state.expUnit==="mithqal");
  $("#unitExpGram")?.classList.toggle("is-on", state.expUnit==="gram");

  $$("[data-exp-karat]").forEach(b=>{
    b.classList.toggle("is-on", b.dataset.expKarat === state.expKarat);
    b.setAttribute("aria-selected", b.dataset.expKarat === state.expKarat ? "true" : "false");
  });
}

async function main(){
  setOnlineStatus(navigator.onLine);
  await loadConfig();

  buildKaratCards();
  createChart();
  await initChartFromHistory();
  bindUI();
  restorePrefs();
  applyRestoredToState();
  renderAll();

  // start polling
  await fetchLiveOunce();
  setInterval(fetchLiveOunce, CFG.pollMs);
}

main().catch((e)=>{
  console.error(e);
  toast("Fatal error. Open DevTools console for details.", "bad");
});
