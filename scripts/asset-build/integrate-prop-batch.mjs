// Batch-integrate generated procedural props (room_l<NN>_p<NN>) into the registries:
//   props.ts (import + entry), BuilderAssetCatalog.ts (entry), BuilderAssetFootprints.tsx (footprint),
//   and thumbnails (preview PNG -> 256 webp). Idempotent: skips keys already present.
// Reads .tmp/modeling/build90.log for sizeMeters and .tmp/modeling/specs/<key>.json for label/footprint.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SPECDIR = path.join(ROOT, ".tmp/modeling/specs");
const PREVIEWDIR = path.join(ROOT, ".tmp/modeling");
const LOG = path.join(ROOT, ".tmp/modeling/build90.log");
const PROPS_TS = path.join(ROOT, "src/assets/registry/environment/props.ts");
const CATALOG_TS = path.join(ROOT, "src/build/BuilderAssetCatalog.ts");
const FOOT_TSX = path.join(ROOT, "src/build/BuilderAssetFootprints.tsx");
const THUMBDIR = path.join(ROOT, "src/assets/thumbnails/builder/core");

const VALID_FOOT = new Set(["table","chair","sofa","bed","cabinet","wall_panel","crate","books","lamp","display_case","column","barrier","pedestal","generic"]);
const FOOT_MAP = { bench:"table", desk:"table", shelf:"cabinet", rack:"cabinet", locker:"cabinet", light:"lamp", lamp:"lamp", screen:"wall_panel", panel:"wall_panel", monitor:"wall_panel", console:"table", machine:"cabinet", barrier:"barrier", stanchion:"barrier", pillar:"column", plinth:"pedestal", pedestal:"pedestal", case:"display_case", vitrine:"display_case", box:"crate", crate:"crate", bin:"crate" };
const GROUP = { l01:"维修", l02:"居住", l04:"诊疗", l05:"核心", l06:"赛博", l07:"核心", l08:"维修", l09:"居住", l10:"诊疗" };

const sizeByKey = {};
for (const line of fs.readFileSync(LOG, "utf8").split("\n")) {
  const m = line.match(/(room_l\d\d_p\d\d)\s+SIZEMETERS\s+(\[[^\]]+\])/);
  if (m) sizeByKey[m[1]] = JSON.parse(m[2]);
}

const keys = Object.keys(sizeByKey).sort();
console.log("keys with sizeMeters:", keys.length);

const camel = (k) => k.split("_").map((p, i) => i === 0 ? p : p[0].toUpperCase() + p.slice(1)).join("") ;
const footFor = (raw) => { const f = String(raw || "").toLowerCase(); return VALID_FOOT.has(f) ? f : (FOOT_MAP[f] || "generic"); };

const rows = [];
for (const key of keys) {
  const specPath = path.join(SPECDIR, key + ".json");
  if (!fs.existsSync(specPath)) { console.log("  no spec for", key); continue; }
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const glb = path.join(ROOT, "src/assets/models-cooked/environment/props", "hp_" + key + ".glb");
  if (!fs.existsSync(glb)) { console.log("  no GLB for", key); continue; }
  rows.push({
    key, importVar: camel(key) + "Url", label: (spec.label || key).replace(/"/g, "'"),
    foot: footFor(spec.footprint), solid: spec.solid !== false, size: sizeByKey[key],
    group: GROUP[key.slice(5, 8)] || "核心",
  });
}
console.log("integrable rows:", rows.length);

// ---- props.ts ----
let props = fs.readFileSync(PROPS_TS, "utf8");
const importAnchor = 'import roomMuseumClocheDomeUrl from "../../models-cooked/environment/props/hp_room_museum_cloche_dome.glb?url";';
const entryAnchor = '  room_museum_cloche_dome: { modelKey: "room_museum_cloche_dome", url: roomMuseumClocheDomeUrl, category: "room", sizeMeters: [0.683, 0.727, 0.683] },';
const newImports = rows.filter(r => !props.includes(`hp_${r.key}.glb?url`)).map(r => `import ${r.importVar} from "../../models-cooked/environment/props/hp_${r.key}.glb?url";`).join("\n");
const newEntries = rows.filter(r => !new RegExp(`\\b${r.key}:`).test(props)).map(r => `  ${r.key}: { modelKey: "${r.key}", url: ${r.importVar}, category: "room", sizeMeters: [${r.size.join(", ")}] },`).join("\n");
if (newImports) props = props.replace(importAnchor, importAnchor + "\n  // generated prop batch (levels 1,2,4-10)\n" + newImports);
if (newEntries) props = props.replace(entryAnchor, entryAnchor + "\n" + newEntries);
fs.writeFileSync(PROPS_TS, props);
console.log("props.ts: +imports", newImports ? newImports.split("\n").length : 0, "+entries", newEntries ? newEntries.split("\n").length : 0);

// ---- BuilderAssetCatalog.ts ----
let cat = fs.readFileSync(CATALOG_TS, "utf8");
const catAnchor = '  { modelKey: "room_museum_cloche_dome", label: "玻璃钟罩展座", group: "博物馆", source: "blender-procedural", sizeMeters: [0.683, 0.727, 0.683], solid: true },';
const newCat = rows.filter(r => !new RegExp(`modelKey: "${r.key}"`).test(cat)).map(r => `  { modelKey: "${r.key}", label: "${r.label}", group: "${r.group}", source: "blender-procedural", sizeMeters: [${r.size.join(", ")}], solid: ${r.solid} },`).join("\n");
if (newCat) cat = cat.replace(catAnchor, catAnchor + "\n  // generated prop batch (levels 1,2,4-10)\n" + newCat);
fs.writeFileSync(CATALOG_TS, cat);
console.log("catalog: +entries", newCat ? newCat.split("\n").length : 0);

// ---- BuilderAssetFootprints.tsx ----
let foot = fs.readFileSync(FOOT_TSX, "utf8");
const footAnchor = '  room_museum_cloche_dome: "display_case",';
const newFoot = rows.filter(r => !new RegExp(`\\b${r.key}:`).test(foot)).map(r => `  ${r.key}: "${r.foot}",`).join("\n");
if (newFoot) foot = foot.replace(footAnchor, footAnchor + "\n" + newFoot);
fs.writeFileSync(FOOT_TSX, foot);
console.log("footprints: +entries", newFoot ? newFoot.split("\n").length : 0);

// ---- thumbnails ----
fs.mkdirSync(THUMBDIR, { recursive: true });
let thumbs = 0;
for (const r of rows) {
  const png = path.join(PREVIEWDIR, r.key + ".png");
  if (!fs.existsSync(png)) continue;
  await sharp(png).resize(256, 256, { fit: "contain", background: { r: 18, g: 20, b: 26, alpha: 1 } }).webp({ quality: 88 }).toFile(path.join(THUMBDIR, r.key + ".webp"));
  thumbs++;
}
console.log("thumbnails written:", thumbs);
console.log("DONE integrate-prop-batch");
