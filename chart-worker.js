// chart-worker.js
// Purpose: build timeframe slices + downsample for ultra-smooth charting.
// Input: points [{t: ISO, p: number}] + timeframe (1h/24h/7d).
// Output: labels[] + data[].

function parseT(t){
  const d = new Date(t);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function downsample(points, maxOut){
  if(points.length <= maxOut) return points;
  const bucketSize = Math.ceil(points.length / maxOut);
  const out = [];
  for(let i=0;i<points.length;i+=bucketSize){
    const bucket = points.slice(i, i + bucketSize);
    const first = bucket[0];
    const last  = bucket[bucket.length - 1];
    let sum = 0;
    for(const p of bucket) sum += p.p;
    const avg = sum / Math.max(1, bucket.length);
    const mid = bucket[Math.floor(bucket.length/2)];
    out.push(first);
    if(bucket.length > 2) out.push({t: mid.t, p: avg});
    if(bucket.length > 1) out.push(last);
  }
  if(out.length > maxOut){
    const step = out.length / maxOut;
    const trimmed = [];
    for(let i=0;i<maxOut;i++){
      trimmed.push(out[Math.floor(i*step)]);
    }
    return trimmed;
  }
  return out;
}

self.onmessage = (ev) => {
  const { type, payload } = ev.data || {};
  if(type !== "build") return;

  const { points, timeframe, maxShown } = payload || {};
  const now = Date.now();
  let win = 60 * 60 * 1000;
  if(timeframe === "24h") win = 24 * 60 * 60 * 1000;
  if(timeframe === "7d")  win = 7  * 24 * 60 * 60 * 1000;
  const minT = now - win;

  const pts = (points || [])
    .map(p => ({ t: String(p.t || ""), p: Number(p.p) }))
    .filter(p => p.t && Number.isFinite(p.p) && parseT(p.t) >= minT)
    .sort((a,b) => parseT(a.t) - parseT(b.t));

  const shown = downsample(pts, Math.max(120, maxShown || 520));

  const labels = shown.map(p => {
    const d = new Date(p.t);
    if(timeframe === "7d"){
      return d.toLocaleDateString(undefined,{month:"2-digit",day:"2-digit"}) + " " +
             d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"});
    }
    return d.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  });

  const data = shown.map(p => p.p);

  self.postMessage({
    type: "built",
    payload: { labels, data, shownCount: shown.length, rawCount: pts.length }
  });
};
