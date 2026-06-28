// One-off: measure the 4 painted glass-slot frames in the root-menu Image2 by
// scanning pixel "cyanness" in headless Chrome. Prints slot rects as fractions of
// the 1672x941 image so the DOM overlay can be seated exactly on the painted bevels.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(ROOT, ".tmp", "qa-root-menu");
const PROFILE = path.join(OUT, "measure-profile");
const IMG = path.join(ROOT, "src/assets/gui/root-menu/hp-root-menu-bg.jpg");
const CHROME = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find(existsSync);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const b64 = readFileSync(IMG).toString("base64");
const html = `<!doctype html><meta charset=utf8><body style="margin:0;background:#000">
<canvas id=c></canvas><script>
const img = new Image();
img.onload = () => {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.getElementById('c'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  const x0 = Math.floor(w*0.26), x1 = Math.floor(w*0.74);
  const cyanAt = (x,y) => { const i=(y*w+x)*4; return Math.max(0, Math.min(d[i+1],d[i+2]) - d[i]); };
  // per-row mean cyanness in central band
  const rows = [];
  for (let y=0;y<h;y++){ let s=0; for (let x=x0;x<x1;x+=2) s+=cyanAt(x,y); rows.push(s/((x1-x0)/2)); }
  const max = Math.max(...rows), thr = max*0.42;
  // contiguous bands above threshold = frame edge rows; merge gaps <=3
  const bands = []; let st=-1;
  for (let y=0;y<h;y++){ if (rows[y]>=thr){ if(st<0) st=y; } else { if(st>=0){ bands.push([st,y-1]); st=-1; } } }
  if (st>=0) bands.push([st,h-1]);
  // keep only bands in the central vertical region (0.28..0.74) and wide enough
  const central = bands.filter(([a,b]) => (a+b)/2 > h*0.28 && (a+b)/2 < h*0.74);
  // cluster edge-bands into frames: a frame = top edge .. bottom edge. Pair consecutive.
  // Simpler: take the overall min top and max bottom of central bands, split into 4 equal? No —
  // detect 4 frames by grouping bands whose centers are within slotPitch.
  window.__scan = { w, h, max, thr, bands: central.map(([a,b]) => [ (a/h).toFixed(4), (b/h).toFixed(4) ]) };
  // x-extent: for the row at first band center, find left/right where cyanness>thr*0.6
  if (central.length){
    const yc = Math.round((central[0][0]+central[0][1])/2);
    let L=-1,R=-1; for (let x=Math.floor(w*0.1);x<Math.floor(w*0.9);x++){ if(cyanAt(x,yc)>thr*0.5){ if(L<0)L=x; R=x; } }
    window.__scan.xL = (L/w).toFixed(4); window.__scan.xR = (R/w).toFixed(4);
  }
  document.title = "DONE";
};
img.src = "data:image/jpeg;base64,${b64}";
</script>`;
const htmlPath = path.join(OUT, "_measure.html");
writeFileSync(htmlPath, html);

if (!CHROME) { console.log("no chrome"); process.exit(0); }
mkdirSync(PROFILE, { recursive: true });
try { rmSync(path.join(PROFILE, "DevToolsActivePort")); } catch {}
const chrome = spawn(CHROME, ["--headless=new","--remote-debugging-port=0",`--user-data-dir=${PROFILE}`,"--no-first-run","--allow-file-access-from-files","about:blank"], { stdio:["ignore","pipe","pipe"] });
let wsUrl=null;
for (let i=0;i<100;i++){ const pf=path.join(PROFILE,"DevToolsActivePort"); if(existsSync(pf)){ const [p,b]=readFileSync(pf,"utf8").trim().split("\n"); if(p&&b){ wsUrl=`ws://127.0.0.1:${p}${b}`; break; } } await sleep(150); }
const ws = new WebSocket(wsUrl); await new Promise((r)=>ws.addEventListener("open",r));
let id=1; const pend=new Map();
ws.addEventListener("message",(e)=>{ const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){ const {res}=pend.get(m.id); pend.delete(m.id); res(m.result);} });
const send=(method,params={},sessionId)=>{ const i=id++; ws.send(JSON.stringify({id:i,method,params,sessionId})); return new Promise((res)=>pend.set(i,{res})); };
const { targetId } = await send("Target.createTarget",{url:"about:blank"});
const { sessionId } = await send("Target.attachToTarget",{targetId,flatten:true});
await send("Page.enable",{},sessionId); await send("Runtime.enable",{},sessionId);
await send("Page.navigate",{url:`file://${htmlPath}`},sessionId);
await sleep(1500);
const r = await send("Runtime.evaluate",{expression:"JSON.stringify(window.__scan||null)",returnByValue:true},sessionId);
console.log(r.result?.value || "no scan");
ws.close(); chrome.kill("SIGTERM");
process.exit(0);
