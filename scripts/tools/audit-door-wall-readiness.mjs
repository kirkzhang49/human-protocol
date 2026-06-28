// Read-only door / wall readiness audit.
//
// Reads the live official config pack + the door visual-intent resolver + the
// builder asset registry/catalog and reports, per campaign Level 1-10:
//   - every door reference (visualKey/skinKey/materialKey/lock) and which real
//     GLB it resolves to via DoorVisualIntent;
//   - every room wall/floor material reference and the placed wall-art props;
//   - which door/wall modelKeys look like OLD PLACEHOLDERS (generic security
//     door stretched to fit, or a material-only difference);
//   - which doors/walls have NO clear style family (per the door-wall art
//     system's 6 door + 8 wall classes);
//   - which referenced wall-art props are MISSING a build-catalog / registry
//     entry (would render as a gray placeholder cube);
//   - a prioritised replacement list.
//
// It NEVER mutates config, runtime, or assets. It only writes a JSON + Markdown
// snapshot under .tmp/door-wall-readiness/ for the next asset-production AI.
//
// See: docs/human-protocol-door-wall-art-system.md, docs/human-protocol-asset-agent-md.md
//
// Run: node scripts/tools/audit-door-wall-readiness.mjs
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

// --- Known style families (mirrors door-wall-art-system.md) -----------------

// Door authoring keys → { class, note }. Anything not here = NO_STYLE_FAMILY.
const DOOR_STYLE_FAMILY = {
  service_elevator_door: { cls: "3_exit_elevator", note: "exit hero" },
  museum_gallery_door: { cls: "5_archive_gallery", note: "museum slide" },
  yellow_access_door: { cls: "1_interior_industrial", note: "industrial blast door (legacy yellow key)" },
  industrial_access_door: { cls: "1_interior_industrial", note: "steel/hazard maintenance blast door" },
  residential_access_door: { cls: "2_residential", note: "warm domestic / hidden facility" },
  clinic_memory_door: { cls: "4_clinic_ward", note: "frosted medical ward door" },
  reclamation_archive_door: { cls: "6_archive_core", note: "graphite/brass archive blast door" },
  identity_archive_door: { cls: "archive_identity", note: "identity archive" },
  exit_panel: { cls: "3_exit_elevator", note: "exit panel" },
};
const DOOR_SKIN_FAMILY = {
  service_elevator_hero: "3_exit_elevator",
  identity_archive: "archive_identity",
};

// The 4 door GLBs that really exist (doors.ts + level03.ts). The generic
// security door is the placeholder stand-in everything unknown collapses into.
const REAL_DOOR_GLBS = new Set([
  "door_identity_archive",
  "door_service_elevator_inner_cyan",
  "room_door_security",
  "age_museum_gallery_door",
  // Premium reusable door families (doors.ts).
  "door_residential_access",
  "door_clinic_memory",
  "door_reclamation_archive",
  "door_industrial_access",
]);
const GENERIC_PLACEHOLDER_DOOR_GLB = "room_door_security";

// Wall/floor material colour-profile keys that exist in AssetResolver today.
const KNOWN_MATERIAL_KEYS = new Set([
  "maintenance_bay_wet_floor",
  "maintenance_bay_glass_wall",
  "sterile_lab_floor",
  "sterile_lab_wall",
  "hazard_hall_floor",
  "hazard_hall_wall",
  "red_exit_floor",
  "red_exit_wall",
  "residential_floor",
  "residential_wall",
  "museum_floor",
  "museum_wall",
  "service_elevator_metal",
]);

// Heuristics for spotting placeholder / legacy modelKeys & material tints.
const PLACEHOLDER_KEY_RE = /(placeholder|generic|temp|_tmp|untitled|^cube$|^box$|default)/i;
// Material keys used purely as a door state TINT (not a physical material).
const TINT_ONLY_MATERIAL_RE = /^(terminal_red|terminal_cyan|yellow_access_metal)$/;
// Tags / modelKey hints that a prop is acting as wall art.
const WALL_ART_HINT_RE = /(wall|panel|mural|photo|monitor|screen|window|backdrop|barrier)/i;

const server = await createServer({ appType: "custom", logLevel: "error", server: { middlewareMode: true } });

try {
  const { humanProtocolBasePack } = await server.ssrLoadModule("/src/game/config/ConfigPackStore.ts");
  const { isEnvironmentModelKey, environmentModelAssets } = await server.ssrLoadModule(
    "/src/assets/environmentModelAssets.ts",
  );
  const { builderPropCatalog } = await server.ssrLoadModule("/src/build/BuilderAssetCatalog.ts");
  const { doorVisualIntentForDefinition } = await server.ssrLoadModule(
    "/src/game/visual/intents/DoorVisualIntent.ts",
  );

  const catalogKeys = new Set(builderPropCatalog.map((e) => e.modelKey));
  const resolves = (modelKey) =>
    Boolean(modelKey) && (isEnvironmentModelKey(modelKey) || catalogKeys.has(modelKey));

  const levelsById = new Map(humanProtocolBasePack.levels.map((l) => [l.id, l]));
  const rows = [];

  for (const levelId of humanProtocolBasePack.campaignLevelIds) {
    const level = levelsById.get(levelId);
    if (!level) {
      rows.push({ levelId, error: "level not found in pack" });
      continue;
    }
    const map = level.map ?? {};
    const doorsCfg = map.doors ?? [];
    const rooms = map.rooms ?? [];
    const props = map.props ?? [];

    // --- Doors -------------------------------------------------------------
    const doors = doorsCfg.map((d) => {
      let resolvedGlb = null;
      try {
        resolvedGlb = doorVisualIntentForDefinition(d).modelKey;
      } catch {
        resolvedGlb = "ERROR_RESOLVING";
      }
      const fam =
        DOOR_STYLE_FAMILY[d.visualKey]?.cls ?? DOOR_SKIN_FAMILY[d.skinKey] ?? null;
      const isGenericPlaceholder = resolvedGlb === GENERIC_PLACEHOLDER_DOOR_GLB;
      // Authored size vs the generic GLB's native footprint (1.55 x 2.35 x 0.35).
      const sz = Array.isArray(d.size) ? d.size : null;
      const stretched =
        isGenericPlaceholder && sz && (sz[0] > 2.2 || sz[1] > 2.8);
      const issues = [];
      if (!fam) issues.push("NO_STYLE_FAMILY");
      if (isGenericPlaceholder) issues.push("GENERIC_DOOR_GLB");
      if (stretched) issues.push("STRETCHED_GENERIC");
      if (d.materialKey && TINT_ONLY_MATERIAL_RE.test(d.materialKey))
        issues.push("TINT_ONLY_MATERIAL");
      if (!REAL_DOOR_GLBS.has(resolvedGlb)) issues.push("UNRESOLVED_DOOR_GLB");
      return {
        id: d.id,
        label: d.label,
        visualKey: d.visualKey ?? null,
        skinKey: d.skinKey ?? null,
        materialKey: d.materialKey ?? null,
        lockType: d.lock?.type ?? d.defaultState ?? null,
        size: sz,
        resolvedGlb,
        styleFamily: fam ?? "NONE",
        isExit: d.id === level.exit?.cinematic?.doorId,
        issues,
      };
    });

    // --- Walls (room surfaces) --------------------------------------------
    const walls = rooms.map((r) => {
      const renderWalls = r.geometry?.renderWalls !== false;
      const wallKey = r.wallMaterialKey ?? r.geometry?.wallMaterialKey ?? null;
      const floorKey = r.floorMaterialKey ?? r.geometry?.floorMaterialKey ?? null;
      const issues = [];
      if (renderWalls && !wallKey) issues.push("NO_WALL_MATERIAL");
      if (wallKey && !KNOWN_MATERIAL_KEYS.has(wallKey)) issues.push("UNKNOWN_WALL_MATERIAL");
      if (floorKey && !KNOWN_MATERIAL_KEYS.has(floorKey)) issues.push("UNKNOWN_FLOOR_MATERIAL");
      if (wallKey && PLACEHOLDER_KEY_RE.test(wallKey)) issues.push("PLACEHOLDER_WALL_KEY");
      return {
        roomId: r.id,
        aesthetic: r.aesthetic?.style ?? null,
        wallMaterialKey: wallKey,
        floorMaterialKey: floorKey,
        renderWalls,
        // Walls have no per-segment art asset today — colour-profile only.
        styleFamily: wallKey ?? "NONE",
        issues,
      };
    });

    // --- Wall-art props ----------------------------------------------------
    const wallArtProps = props.filter((p) => {
      const tagHit = (p.tags ?? []).some((t) => WALL_ART_HINT_RE.test(t)) || p.mount === "wall";
      const keyHit = p.modelKey && WALL_ART_HINT_RE.test(p.modelKey);
      return Boolean(tagHit || keyHit);
    });
    const wallArt = wallArtProps.map((p) => {
      const issues = [];
      if (!resolves(p.modelKey)) issues.push("MISSING_CATALOG_ENTRY");
      if (p.modelKey && PLACEHOLDER_KEY_RE.test(p.modelKey)) issues.push("PLACEHOLDER_KEY");
      return { id: p.id, modelKey: p.modelKey, roomId: p.roomId, issues };
    });

    // --- Replacement priority ---------------------------------------------
    const doorReplace = doors.filter((d) => d.issues.length).map((d) => ({
      kind: "door",
      ref: d.id,
      detail: `${d.visualKey ?? d.skinKey ?? "?"} → ${d.resolvedGlb}`,
      issues: d.issues,
      priority:
        (d.issues.includes("STRETCHED_GENERIC") ? 3 : 0) +
        (d.issues.includes("NO_STYLE_FAMILY") ? 2 : 0) +
        (d.issues.includes("UNRESOLVED_DOOR_GLB") ? 3 : 0) +
        (d.isExit ? 1 : 0),
    }));
    const wallReplace = walls.filter((w) => w.issues.length).map((w) => ({
      kind: "wall",
      ref: w.roomId,
      detail: `${w.wallMaterialKey ?? "no-wall-material"}`,
      issues: w.issues,
      priority: (w.issues.includes("NO_WALL_MATERIAL") ? 3 : 0) + (w.issues.includes("UNKNOWN_WALL_MATERIAL") ? 2 : 0),
    }));
    const artReplace = wallArt.filter((a) => a.issues.length).map((a) => ({
      kind: "wall_art",
      ref: a.id,
      detail: a.modelKey,
      issues: a.issues,
      priority: a.issues.includes("MISSING_CATALOG_ENTRY") ? 3 : 1,
    }));
    const replacePriority = [...doorReplace, ...wallReplace, ...artReplace].sort(
      (a, b) => b.priority - a.priority,
    );

    rows.push({
      levelId,
      title: level.title,
      counts: { doors: doors.length, rooms: walls.length, wallArt: wallArt.length },
      doors,
      walls,
      wallArt,
      replacePriority,
    });
  }

  // --- Console / Markdown report -------------------------------------------
  const md = [];
  const push = (s = "") => {
    md.push(s);
    console.log(s);
  };
  push("# Human Protocol — Door / Wall Readiness Audit\n");
  push("Read-only. Resolves doors through DoorVisualIntent; flags placeholders / missing style families / missing catalog entries.\n");
  push("Real door GLBs today: door_service_elevator_inner_cyan, age_museum_gallery_door, door_identity_archive, room_door_security (generic).\n");
  push("Walls are colour-profile only (no per-segment art asset) — see docs/human-protocol-door-wall-art-system.md §0/§5.\n");

  let totalDoorIssues = 0;
  let totalWallIssues = 0;
  let totalArtMissing = 0;

  for (const r of rows) {
    if (r.error) {
      push(`## ${r.levelId} — ERROR: ${r.error}\n`);
      continue;
    }
    push(`## ${r.levelId} — ${r.title}`);
    push(`doors=${r.counts.doors} rooms=${r.counts.rooms} wall-art-props=${r.counts.wallArt}\n`);

    push("**Doors**");
    push("| id | visual/skin | →GLB | style family | lock | exit | issues |");
    push("|---|---|---|---|---|---|---|");
    for (const d of r.doors) {
      if (d.issues.length) totalDoorIssues += 1;
      push(
        `| ${d.id} | ${d.visualKey ?? d.skinKey ?? "?"} | ${d.resolvedGlb} | ${d.styleFamily} | ${d.lockType ?? "?"} | ${d.isExit ? "✔" : ""} | ${d.issues.join(", ") || "ok"} |`,
      );
    }
    push("");

    push("**Walls (room surfaces — colour profile)**");
    push("| room | aesthetic | wallMaterial | floorMaterial | issues |");
    push("|---|---|---|---|---|");
    for (const w of r.walls) {
      if (w.issues.length) totalWallIssues += 1;
      push(
        `| ${w.roomId} | ${w.aesthetic ?? "?"} | ${w.wallMaterialKey ?? "—"} | ${w.floorMaterialKey ?? "—"} | ${w.issues.join(", ") || "ok"} |`,
      );
    }
    push("");

    const missingArt = r.wallArt.filter((a) => a.issues.length);
    totalArtMissing += missingArt.length;
    if (missingArt.length) {
      push("**Wall-art props with issues**");
      for (const a of missingArt) push(`- ${a.id} (${a.modelKey}) — ${a.issues.join(", ")}`);
      push("");
    }

    if (r.replacePriority.length) {
      push("**Replacement priority (high→low)**");
      for (const p of r.replacePriority)
        push(`- [P${p.priority}] ${p.kind}: ${p.ref} — ${p.detail} — ${p.issues.join(", ")}`);
      push("");
    }
  }

  push("## Summary");
  push(`- doors with issues: ${totalDoorIssues}`);
  push(`- room surfaces with issues: ${totalWallIssues}`);
  push(`- wall-art props missing catalog/registry: ${totalArtMissing}`);
  push("- Biggest structural gap: only 4 real door GLBs exist; interior/blast/boss doors collapse to the generic stretched mesh (needs new GLBs + DoorVisualIntent branches).");

  const outDir = path.join(process.cwd(), ".tmp/door-wall-readiness");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "door-wall-readiness.json"), JSON.stringify(rows, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "door-wall-readiness.md"), md.join("\n") + "\n");
  console.log(`\nwrote ${path.join(outDir, "door-wall-readiness.json")}`);
  console.log(`wrote ${path.join(outDir, "door-wall-readiness.md")}`);
} finally {
  await server.close();
}
