#!/usr/bin/env node
/**
 * scripts/update-feed.mjs
 * GitHub Actions job fetches the API server-side (no CORS) and writes:
 *   data/latest.json   (always updated)
 *   data/history.json  (only appended when abs(change) >= threshold)
 *
 * NOTE: GitHub Actions schedules are minimum 5 minutes. That is fine for shared history on GH Pages.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const cfg = JSON.parse(fs.readFileSync(path.join(root, "config.json"), "utf8"));
const apiUrl = cfg.apiUrl;
const threshold = Number(cfg.noiseThresholdUSD ?? 0.10);
const maxPoints = Number(cfg.chart?.maxPoints ?? 9000);

const latestPath = path.join(root, "data", "latest.json");
const historyPath = path.join(root, "data", "history.json");

function readJsonSafe(p, fallback){
  try{ return JSON.parse(fs.readFileSync(p, "utf8")); }catch{ return fallback; }
}
function writeJson(p, obj){
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function norm2(n){ return Math.round(n*100)/100; }

let latest = readJsonSafe(latestPath, {v:1, updated_at:null, price:null, currency:"USD", source:"github-actions"});
let history = readJsonSafe(historyPath, {v:1, updated_at:null, points:[], source:"github-actions"});
if(!Array.isArray(history.points)) history.points = [];

async function main(){
  const res = await fetch(apiUrl, { cache:"no-store" });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const raw = (typeof j === "number") ? j : (j?.price ?? j?.value ?? j?.data?.price ?? null);
  const p = Number(raw);
  if(!Number.isFinite(p)) throw new Error("Invalid price from API");

  const price = norm2(p);
  const iso = new Date().toISOString();

  latest = { v:1, updated_at: iso, price, currency:"USD", source:"github-actions" };
  writeJson(latestPath, latest);

  const last = history.points.length ? history.points[history.points.length-1] : null;
  const lastP = last && Number.isFinite(Number(last.p)) ? Number(last.p) : null;

  if(lastP == null || Math.abs(price - lastP) >= threshold){
    history.points.push({ t: iso, p: price });
    while(history.points.length > maxPoints) history.points.shift();
    history.v = 1;
    history.updated_at = iso;
    history.source = "github-actions";
    writeJson(historyPath, history);
    console.log(`Saved history point: ${price} (>= ${threshold})`);
  }else{
    console.log(`Noise (< ${threshold}). Not saved to history.`);
  }
}

main().catch((e)=>{
  console.error(e);
  process.exit(1);
});
