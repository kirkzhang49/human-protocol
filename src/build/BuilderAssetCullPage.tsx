import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { builderPropCatalog, type BuilderPropEntry } from "./BuilderAssetCatalog";
import { isBuilderTemporarilyHidden } from "./builderTemporaryHidden";
import { isBuilderDiscarded } from "./builderDiscardedAssets";
import { assetThumbnailUrl } from "./BuilderAssetThumbnails";
import { isEnvironmentModelKey, type EnvironmentModelKey } from "../assets/environmentModelAssets";
import { EnvironmentModelInstance } from "../render/environment/EnvironmentModelInstance";

/**
 * Asset-cull page (DEV only) — /build?assetCull=1
 *
 * A curation gallery of every /build prop catalog asset that is NOT temporarily
 * hidden (i.e. everything currently usable in the editor). Each asset shows its
 * 2D studio thumbnail in the grid + a live rotatable 3D preview in the
 * inspector, and a keep / discard toggle. The decision set persists in
 * localStorage; export the discard (or keep) list as the cull plan.
 *
 * Keyboard on the focused card: K = keep, X = discard, ←/→ = move focus.
 */

type Decision = "keep" | "discard";
const STORAGE_KEY = "hp-asset-cull-v1";

function loadDecisions(): Record<string, Decision> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Decision>) : {};
  } catch {
    return {};
  }
}

export function BuilderAssetCullPage() {
  // Dedupe by modelKey, drop temp-hidden → the live editor catalog.
  const entries = useMemo<BuilderPropEntry[]>(() => {
    const seen = new Set<string>();
    const out: BuilderPropEntry[] = [];
    for (const e of builderPropCatalog) {
      if (isBuilderTemporarilyHidden(e.modelKey) || isBuilderDiscarded(e.modelKey) || seen.has(e.modelKey)) continue;
      seen.add(e.modelKey);
      out.push(e);
    }
    return out.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  }, []);

  const [decisions, setDecisions] = useState<Record<string, Decision>>(loadDecisions);
  const [group, setGroup] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [onlyUndecided, setOnlyUndecided] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedKey, setFocusedKey] = useState<string | null>(() => null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(decisions));
    } catch {
      /* storage full / blocked — selection just won't persist */
    }
  }, [decisions]);

  const groups = useMemo(() => ["all", ...Array.from(new Set(entries.map((e) => e.group)))], [entries]);
  const sources = useMemo(
    () => ["all", ...Array.from(new Set(entries.map((e) => e.source ?? "(自制/程序化)")))],
    [entries],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (group !== "all" && e.group !== group) return false;
      if (source !== "all" && (e.source ?? "(自制/程序化)") !== source) return false;
      if (onlyUndecided && decisions[e.modelKey]) return false;
      if (q && !(`${e.label} ${e.modelKey} ${e.group}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [entries, group, source, onlyUndecided, search, decisions]);

  const counts = useMemo(() => {
    let keep = 0;
    let discard = 0;
    for (const e of entries) {
      const d = decisions[e.modelKey];
      if (d === "keep") keep++;
      else if (d === "discard") discard++;
    }
    return { total: entries.length, keep, discard, undecided: entries.length - keep - discard };
  }, [entries, decisions]);

  const setDecision = useCallback((key: string, d: Decision) => {
    setDecisions((prev) => {
      const next = { ...prev };
      if (next[key] === d) delete next[key];
      else next[key] = d;
      return next;
    });
  }, []);

  // Keyboard triage on the focused card.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) return;
      if (!focusedKey) return;
      const idx = visible.findIndex((e) => e.modelKey === focusedKey);
      if (ev.key === "k" || ev.key === "K") setDecision(focusedKey, "keep");
      else if (ev.key === "x" || ev.key === "X") setDecision(focusedKey, "discard");
      else if (ev.key === "ArrowRight" && idx >= 0 && idx < visible.length - 1) setFocusedKey(visible[idx + 1].modelKey);
      else if (ev.key === "ArrowLeft" && idx > 0) setFocusedKey(visible[idx - 1].modelKey);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedKey, visible, setDecision]);

  const keysBy = useCallback(
    (d: Decision | "undecided") =>
      entries
        .filter((e) => (d === "undecided" ? !decisions[e.modelKey] : decisions[e.modelKey] === d))
        .map((e) => e.modelKey),
    [entries, decisions],
  );

  const copy = useCallback((label: string, keys: string[]) => {
    navigator.clipboard?.writeText(JSON.stringify(keys, null, 2)).then(
      () => window.alert(`已复制 ${label}：${keys.length} 个 modelKey`),
      () => window.alert("复制失败（剪贴板被拦截）"),
    );
  }, []);

  const download = useCallback(() => {
    const payload = { keep: keysBy("keep"), discard: keysBy("discard"), undecided: keysBy("undecided") };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "hp-asset-cull-selection.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [keysBy]);

  const focused = focusedKey ? entries.find((e) => e.modelKey === focusedKey) ?? null : null;

  return (
    <div className="cull-page">
      <style>{CULL_STYLES}</style>
      <header className="cull-head">
        <div className="cull-title">
          资产取舍 · Asset Cull
          <span className="cull-counts">
            共 <b>{counts.total}</b> · 留 <b className="ok">{counts.keep}</b> · 扔{" "}
            <b className="bad">{counts.discard}</b> · 未定 <b>{counts.undecided}</b>
          </span>
        </div>
        <div className="cull-filters">
          <input placeholder="搜索 名称 / modelKey…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g === "all" ? "全部分组" : g}
              </option>
            ))}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {sources.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "全部来源" : s}
              </option>
            ))}
          </select>
          <label className="cull-check">
            <input type="checkbox" checked={onlyUndecided} onChange={(e) => setOnlyUndecided(e.target.checked)} />
            只看未定
          </label>
          <button onClick={() => copy("要扔的(discard)", keysBy("discard"))}>复制要扔的</button>
          <button onClick={() => copy("要留的(keep)", keysBy("keep"))}>复制要留的</button>
          <button onClick={download}>下载选择 JSON</button>
        </div>
      </header>

      <div className="cull-body">
        <div className="cull-grid">
          {visible.map((e) => {
            const d = decisions[e.modelKey];
            const thumb = assetThumbnailUrl(e.modelKey);
            return (
              <div
                key={e.modelKey}
                className={`cull-card${focusedKey === e.modelKey ? " focused" : ""}`}
                data-state={d ?? "none"}
                onClick={() => setFocusedKey(e.modelKey)}
              >
                <div className="cull-thumb">
                  {thumb ? <img src={thumb} alt={e.label} loading="lazy" /> : <span className="cull-noimg">无缩略图</span>}
                  {d ? <span className={`cull-tag ${d}`}>{d === "keep" ? "留" : "扔"}</span> : null}
                </div>
                <div className="cull-label">{e.label}</div>
                <div className="cull-key">{e.modelKey}</div>
                <div className="cull-badges">
                  <span>{e.group}</span>
                  {e.source ? <span className="src">{e.source}</span> : null}
                  <span className="dim">
                    {e.sizeMeters.map((n) => n.toFixed(2)).join("×")}m
                  </span>
                </div>
                <div className="cull-actions">
                  <button
                    className="keep"
                    data-on={d === "keep"}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDecision(e.modelKey, "keep");
                    }}
                  >
                    留
                  </button>
                  <button
                    className="discard"
                    data-on={d === "discard"}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setDecision(e.modelKey, "discard");
                    }}
                  >
                    扔
                  </button>
                </div>
              </div>
            );
          })}
          {visible.length === 0 ? <div className="cull-empty">没有符合筛选的资产</div> : null}
        </div>

        <aside className="cull-inspector">
          {focused ? (
            <>
              <div className="cull-3d">
                <AssetViewer entry={focused} />
              </div>
              <div className="cull-insp-meta">
                <div className="cull-insp-label">{focused.label}</div>
                <div className="cull-key">{focused.modelKey}</div>
                <div className="cull-badges">
                  <span>{focused.group}</span>
                  {focused.source ? <span className="src">{focused.source}</span> : null}
                  <span className="dim">{focused.sizeMeters.map((n) => n.toFixed(2)).join("×")}m</span>
                  {!isEnvironmentModelKey(focused.modelKey) ? <span className="warn">无 3D 模型</span> : null}
                </div>
                <div className="cull-insp-actions">
                  <button className="keep" data-on={decisions[focused.modelKey] === "keep"} onClick={() => setDecision(focused.modelKey, "keep")}>
                    留 (K)
                  </button>
                  <button
                    className="discard"
                    data-on={decisions[focused.modelKey] === "discard"}
                    onClick={() => setDecision(focused.modelKey, "discard")}
                  >
                    扔 (X)
                  </button>
                </div>
                <div className="cull-hint">点卡片切换 · K 留 / X 扔 / ←→ 移动焦点 · 选择自动保存在浏览器</div>
              </div>
            </>
          ) : (
            <div className="cull-insp-empty">← 点一个资产看 3D 预览</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AssetViewer({ entry }: { entry: BuilderPropEntry }) {
  const renderable = isEnvironmentModelKey(entry.modelKey);
  const [w, h, d] = entry.sizeMeters;
  const span = Math.max(w, h, d);
  const dist = span * 2.4 + 0.8;
  return (
    <Canvas key={entry.modelKey} dpr={[1, 2]} camera={{ position: [dist * 0.8, h * 0.7 + span * 0.6, dist], fov: 38 }} gl={{ antialias: true }}>
      <color attach="background" args={["#0b0a08"]} />
      <ambientLight intensity={0.75} />
      <hemisphereLight intensity={0.5} color="#cfd6e2" groundColor="#231708" />
      <directionalLight position={[6, 11, 5]} intensity={1.15} />
      <directionalLight position={[-7, 5, -5]} color="#ffb066" intensity={0.5} />
      <gridHelper args={[Math.max(8, span * 4), 24, "#3a2e1a", "#171310"]} position={[0, 0, 0]} />
      <Suspense fallback={null}>
        {renderable ? <EnvironmentModelInstance modelKey={entry.modelKey as EnvironmentModelKey} position={[0, 0, 0]} /> : null}
      </Suspense>
      <OrbitControls
        target={[0, h * 0.45, 0]}
        autoRotate
        autoRotateSpeed={0.8}
        enableDamping
        minDistance={span * 0.6 + 0.3}
        maxDistance={dist * 3}
      />
    </Canvas>
  );
}

const CULL_STYLES = `
.cull-page { position: fixed; inset: 0; display: flex; flex-direction: column; background: #0b0a08; color: #efe6d4;
  font-family: "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif; font-size: 13px; }
.cull-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  padding: 10px 16px; border-bottom: 1px solid #322818; background: linear-gradient(180deg,#161109,#0d0b07); }
.cull-title { font-weight: 600; letter-spacing: .04em; color: #efd9a4; display: flex; align-items: baseline; gap: 14px; }
.cull-counts { font-weight: 400; color: #9d8d6b; font-size: 12px; }
.cull-counts b { color: #efe6d4; } .cull-counts b.ok { color: #5ee8c8; } .cull-counts b.bad { color: #ff7a5c; }
.cull-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cull-filters input[type=text], .cull-filters input:not([type]), .cull-filters select {
  background: #060504; border: 1px solid #322818; border-radius: 6px; color: #efe6d4; padding: 5px 8px; font-size: 12px; }
.cull-filters input { width: 200px; }
.cull-check { display: flex; align-items: center; gap: 5px; color: #c9bda4; font-size: 12px; }
.cull-filters button { background: linear-gradient(180deg,#1a150d,#120f09); border: 1px solid #4a3a1e; border-radius: 6px;
  color: #efd9a4; padding: 5px 10px; font-size: 12px; cursor: pointer; }
.cull-filters button:hover { border-color: #c9a14f; box-shadow: 0 0 9px #c9a14f22; }
.cull-body { flex: 1; display: flex; min-height: 0; }
.cull-grid { flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 12px; padding: 14px; align-content: start; }
.cull-card { background: linear-gradient(180deg,#15110b,#0d0b07); border: 1px solid #2c2316; border-radius: 10px;
  padding: 8px; cursor: pointer; transition: border-color .12s, box-shadow .12s, transform .08s; display: flex; flex-direction: column; }
.cull-card:hover { border-color: #5a481f; box-shadow: 0 6px 16px #000a, 0 0 12px #c9a14f1c; transform: translateY(-1px); }
.cull-card.focused { border-color: #7ff2ff; box-shadow: 0 0 0 1px #7ff2ff, 0 0 16px #7ff2ff33; }
.cull-card[data-state=keep] { border-color: #2f7d52; box-shadow: inset 0 0 0 1px #5ee8c855; }
.cull-card[data-state=discard] { border-color: #7d2f2f; box-shadow: inset 0 0 0 1px #ff7a5c55; opacity: .62; }
.cull-thumb { position: relative; aspect-ratio: 1; border-radius: 7px; overflow: hidden; margin-bottom: 6px;
  background: radial-gradient(circle at 50% 80%, #221b12, #0c0a07 78%); display: flex; align-items: center; justify-content: center; }
.cull-thumb img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 4px 8px #000a); }
.cull-noimg { color: #5a4f3a; font-size: 11px; }
.cull-tag { position: absolute; top: 6px; right: 6px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; }
.cull-tag.keep { background: #0d2a1d; color: #5ee8c8; box-shadow: 0 0 0 1px #2f7d52; }
.cull-tag.discard { background: #2a0f0d; color: #ff7a5c; box-shadow: 0 0 0 1px #7d2f2f; }
.cull-label { font-weight: 600; color: #ece1c8; font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cull-key { color: #7a6c52; font-size: 10px; font-family: ui-monospace,monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cull-badges { display: flex; flex-wrap: wrap; gap: 4px; margin: 5px 0 7px; }
.cull-badges span { font-size: 9.5px; padding: 1px 6px; border-radius: 99px; background: #100d08; border: 1px solid #2c2316; color: #9d8d6b; }
.cull-badges .src { color: #c9a14f; border-color: #4a3a1e; }
.cull-badges .dim { color: #6a5c44; } .cull-badges .warn { color: #ff7a5c; border-color: #7d2f2f; }
.cull-actions { display: flex; gap: 6px; margin-top: auto; }
.cull-actions button, .cull-insp-actions button { flex: 1; padding: 5px 0; border-radius: 6px; font-size: 12px; font-weight: 600;
  cursor: pointer; border: 1px solid #2c2316; background: #100d08; color: #9d8d6b; }
.cull-actions button.keep[data-on=true], .cull-insp-actions button.keep[data-on=true] {
  background: linear-gradient(180deg,#0f3326,#0a241a); color: #5ee8c8; border-color: #2f7d52; }
.cull-actions button.discard[data-on=true], .cull-insp-actions button.discard[data-on=true] {
  background: linear-gradient(180deg,#33120f,#240c0a); color: #ff7a5c; border-color: #7d2f2f; }
.cull-empty, .cull-insp-empty { color: #6a5c44; padding: 40px; text-align: center; grid-column: 1/-1; }
.cull-inspector { width: 340px; flex: none; border-left: 1px solid #322818; background: #0a0806; display: flex; flex-direction: column; }
.cull-3d { height: 340px; flex: none; background: #0b0a08; }
.cull-insp-meta { padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.cull-insp-label { font-weight: 600; font-size: 15px; color: #efd9a4; }
.cull-insp-actions { display: flex; gap: 8px; margin-top: 8px; }
.cull-hint { color: #6a5c44; font-size: 11px; margin-top: 10px; line-height: 1.5; }
.cull-insp-empty { margin: auto; }
.cull-grid::-webkit-scrollbar { width: 10px; } .cull-grid::-webkit-scrollbar-thumb { background: #2a2214; border-radius: 6px; }
`;
