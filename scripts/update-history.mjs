#!/usr/bin/env node
/**
 * Gold Monster — Update history.json for GitHub Pages (static)
 *
 * This script:
 * - Fetches current XAU ounce price from config.json apiUrl
 * - Appends a point to history.json only if the price changed (rounded to 2 decimals)
 * - Keeps at most chartMaxPoints points
 *
 * history.json schema:
 * {
 *   "version": 1,
 *   "source": "github-actions",
 *   "updated_at": "YYYY-MM-DD HH:MM:SSZ",
 *   "points": [ { "t": "ISO", "p": 2050.12 }, ... ]
 * }
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJson(p){
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj){
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function norm2(n){
  return Math.round(n * 100) / 100;
}

const repoRoot = path.resolve(__dirname, "..");
const cfgPath = path.join(repoRoot, "config.json");
const histPath = path.join(repoRoot, "history.json");

const cfg = readJson(cfgPath);
const apiUrl = cfg.apiUrl || "https://api.gold-api.com/price/XAU";
const maxPoints = Number(cfg.chartMaxPoints || 900);

let hist;
try{
  hist = readJson(histPath);
}catch{
  hist = { version: 1, source: "github-actions", updated_at: null, points: [] };
}

async function main(){
  const res = await fetch(apiUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const j = await res.json();

  // gold-api.com typically returns {price: number, ...}
  const raw = (typeof j === "number") ? j : (j?.price ?? j?.value ?? j?.data?.price ?? null);
  const price = Number(raw);
  if (!Number.isFinite(price)) throw new Error("Invalid price in response");

  const p = norm2(price);
  const last = hist.points?.length ? hist.points[hist.points.length - 1] : null;
  const lastP = last && Number.isFinite(last.p) ? Number(last.p) : null;

  if (lastP === p){
    console.log("No change. Skipping write.");
    return;
  }

  const iso = new Date().toISOString();
  const point = { t: iso, p };

  if (!Array.isArray(hist.points)) hist.points = [];
  hist.points.push(point);

  while (hist.points.length > maxPoints){
    hist.points.shift();
  }

  hist.version = 1;
  hist.source = "github-actions";
  hist.updated_at = iso;

  writeJson(histPath, hist);
  console.log(`Appended: ${p} at ${iso} (points=${hist.points.length})`);
}

main().catch((e)=>{
  console.error(e);
  process.exit(1);
});
