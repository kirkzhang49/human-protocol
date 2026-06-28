# /build: premium room styles · door-family picker · real-GLB playtest doors · rotatable building presets

Date: 2026-06-13

Answers the request: "配合现在这些东西是否都进了 build，然后能不能在 build 里多做几套美术风格好的房子（也不用全部是房的），但是要能连接上，然后房间也要可以旋转" — plus the two follow-up choices: **可旋转的建筑预设** (rotatable multi-room building presets) and **加门族选择器** (a door-family picker that also makes the playtest render the real door GLBs).

No official level (L1–L10) layout/ID/lock/progression changed. The old Level 3 exit-elevator system is intact. All additions are confined to the `/build` editor + the generated-config allow-list.

---

## 0. "Did everything make it into /build?"

- **Furniture / props:** yes — 231/231 catalog thumbnails, 275/275 WGPU modelKeys linked (`qa:builder`). The Image2 furniture packs are pickable in the 家具 catalog.
- **New door families** were level-art (visualKey → GLB), not /build-pickable — **now they are**, via the new door-family picker (§C).
- **Room styles** were capped at 5 — **now 7** (§A).

---

## A. Premium room-style presets (museum / core)

`BuilderRoomStyle` gains `"museum"` (博物馆展厅) and `"core"` (回收核心井).

Changed files:
- `src/build/BuilderTypes.ts` — `BuilderRoomStyle` += museum, core.
- `src/build/BuilderAssetCatalog.ts` — `builderRoomStyles` += two curated entries (museum_floor/museum_wall; museum_floor/service_elevator_metal).
- `src/build/BuilderEnvironment.ts` — `styleFloorDefault` / `styleWallDefault` records += museum, core (tsc-required exhaustiveness).
- `src/build/BuilderAssetFootprints.tsx` — explicit floor `<pattern>`s for museum/core + a generic fallback so any future style always has a valid `url(#builder-floor-<style>)`.
- `src/game/config/validation/authoringValidator.ts` — `generatedRoomMaterialKeys` += `museum_wall` (museum_floor + service_elevator_metal already allowed).

These are real curated material pairs (no debug placeholders) and respect the generated-config boundary.

---

## B. Rotatable building presets + room rotation

Two ways to lay down varied, **connectable** architecture — not all of it enclosed:

### B1. Building presets (drop a connected cluster, rotate as a unit)
`src/build/BuilderBuildingPresets.ts` (NEW) defines 5 presets, each a pre-furnished, internally door-connected room cluster authored in preset-local coordinates:

| id | label | shape | rooms | door family |
|---|---|---|---|---|
| residential_l | L 形居所 | enclosed | 客厅/卧室/厨房 | residential |
| central_court | 中央庭院 | **open** (中庭广场) | 中庭/北展厅/东舱 | reclamation + industrial |
| twin_clinic | 双子诊疗区 | enclosed | 走廊/左诊室/右诊室 | clinic |
| industrial_loop | 工业回廊 | enclosed (环形三门) | 控制室/机房/配电井 | industrial |
| museum_atrium | 博物馆中庭 | **open** (大中庭) | 中庭/左翼/右翼 | reclamation |

- `stampBuildingPreset(preset, dropCenter, quarterTurns)` assigns fresh ids (`createBuilderId`), rotates the whole cluster by 90°·k about the origin, then offsets to the drop point. Doors carry **no** position (the compiler derives the shared edge), so rotating the rooms rotates the openings for free — no schema change.
- `suggestBuildingDropCenter` lands the cluster clear to the right of every existing room; the author then drags it to snap against existing rooms (and 一键修复 auto-snaps + auto-doors the seam — "能连接上").
- UI: a **建筑预设** section in the 房间 catalog with a `⟳ 0/90/180/270°` toggle; click a tile to stamp at the chosen orientation.
- Wiring: `BuildPage.stampBuilding` + `buildingTurns` state; `BuilderAssetBrowser` props `onStampBuilding` / `buildingTurns` / `onRotateBuilding`.

### B2. Per-room 90° rotation
`BuildPage.rotateSelection` now handles a selected **room**: swaps width/depth (axis-aligned), keeps the center fixed, and carries the room's furniture around with it (90° CW about the center, prop `rotationY += π/2`). The toolbar ⟳ button + `R` are enabled for rooms (`BuilderBuildToolbar` `canRotate`).

### Structural proof
`scripts/qa/check-building-presets.mjs` (NEW) replicates `sharedEdge` (doorWidth 3.2 → minOverlap 3.4, touch tol 0.6) and asserts, **for all four rotations of every preset**, that every door lands on a real shared edge and no two rooms overlap → **ALL PASS**.

---

## C. Door-family picker + real-GLB playtest doors

### C1. Picker
- `src/build/BuilderTypes.ts` — `BuilderDoorFamily` = auto | residential | clinic | reclamation | industrial | elevator; `BuilderDoor.doorFamily?`.
- `src/build/BuilderAssetCatalog.ts` — `builderDoorFamilies` (label + visualKey + materialKey + skinKey + accent) + `builderDoorFamilyEntry`.
- `src/build/BuilderInspectorPanel.tsx` — a **门族（外观）** card in the door inspector with one swatch-chip per family. Exit doors show "始终使用闭馆电梯门外观" (the family is intentionally ignored — see precedence below).
- `src/styles/builder.css` — `.builder-doorfamily-grid` chips.

### C2. Compile mapping (exit cinematic preserved)
`src/build/compileBuilderProjectToLevel.ts`: when `door.doorFamily` is set and ≠ `auto`, it overrides the lock-driven `visualKey`/`materialKey`/`skinKey` — but this runs **before** the exit-room elevator override, so the door fronting the exit room always stays the 闭馆电梯门 and the closing cinematic is never double-driven.

### C3. Validator
`src/game/config/validation/authoringValidator.ts` — `generatedDoorMaterialKeys` += `residential_wall` / `sterile_lab_wall` / `museum_wall` / `hazard_hall_wall` (the per-family door-surround materials). Door `visualKey` is validated by primitive (`"door"`), and all five family visualKeys resolve to a real GLB through `DoorVisualIntent`, so compiled /build levels still pass `ConfigValidator`.

### C4. Real-GLB doors in the playtest
- **three.js / compat playtest:** already renders the real door GLB — picking a family sets the level door `visualKey`, which `ConfiguredDoorRenderer` + `DoorVisualIntent` resolve to the cooked GLB. No further work needed.
- **raw-WebGPU deep playtest:** previously procedural. `src/build/runtime-pack/compileBuilderRuntimePack.ts` now, for any **non-exit** door whose family GLB is cooked into the deep pack, renders the **real GLB** (frame+leaf as one mesh) scaled to the wall opening (`DOOR_GAP_WIDTH` 3.6 m ÷ native 4.4 m ≈ 0.82, which also drops native 3.3 m height under the ~2.82 m shell so it never pokes the ceiling), lifting as a unit so it still opens. Exit doors keep the tuned procedural elevator treatment; the **fast/proxy pack** keeps the procedural frame+leaf (identical to the furniture cooked/proxy split). The procedural status light is still emitted for red→cyan lock feedback.

### Proof
New QA case **6f** in `scripts/qa/builder-headless-check.mjs`: with a door GLB injected into the cooked library, the deep pack emits a `door_leaf_<id>` instance using the cooked GLB, scaled ~0.82, with a `vertical_lift` open animation, **no** procedural frame, and a `cooked-glb` WGPU resource; the fast pack keeps the procedural frame. → PASS (`door_service_elevator_inner_cyan renders as a scaled lifting GLB ...`).

---

## QA (all green)

- `npx tsc -b --pretty false` → **0**
- `npm run qa:builder` → **ALL PASS** (incl. new `1a-door-family` compile/sanitize/validate case + `6f` door-GLB case; thumbnails 231/231, WGPU 275/275)
- `node scripts/qa/check-building-presets.mjs` → **ALL PASS** (every preset door shares an edge, no internal overlaps, **and stamped clusters land clear of the starter project**, ×4 rotations)
- `node scripts/qa/builder-exit-elevator-check.mjs` → **ALL PASS** (exit elevator + cinematic intact)
- `node scripts/qa/route-switch-runtime-qa.mjs` → **ALL PASS**
- `npm run smoke:campaign` → **PASS**, L1→L10
- `git diff --check` → clean

## Adversarial review (4-dimension, 10 agents) — 4 confirmed, 2 fixed, 2 surfaced

A multi-agent review (door-compile/validator · real-GLB runtime · presets/rotation · gameplay-ID) confirmed 4 issues.

**Fixed in this pass (both this feature set's own bugs):**

1. **Door-family material was silently stripped to `terminal_cyan`.** `compileBuilderProjectToLevel` runs `sanitizeGeneratedLevelMaterialFamilies` after the door loop; its door pass rewrites any door material that is a room-surface key (which the four family wall materials are) to a fallback — so picking residential/clinic/reclamation/industrial lost the surround material (and the new validator allow-list entries were dead code). **Fix:** the four GLB-backed family visualKeys are now exempt from the door material sanitizer (`doorFamilyVisualKeys`), so the wall surround survives. Proven by new QA `1a-door-family` (reclamation→museum_wall, residential→residential_wall survive compile+sanitize+validate; exit door still forced to the elevator).

2. **`suggestBuildingDropCenter` could drop a wide cluster onto existing rooms.** The old fixed `+12` margin ignored the cluster's own leftward extent, so 博物馆中庭 (28 m wide) overlapped the starter's 清剿机房 even un-rotated. **Fix:** it now computes the *rotated* cluster AABB and offsets so the cluster's left edge lands `gap` past the rightmost existing wall, vertically centered on the existing rooms' average z. Proven by the new placement check in `check-building-presets.mjs` (no overlap vs the real starter project, ×4 rotations).

**Surfaced, intentionally not changed here (see next section).**

## Known divergence from the PRIOR door sprints (not this task; needs a level-remaster)

The review also confirmed a real **render-path divergence on official levels**, inherited from the earlier door-family/industrial sprints (documented in `human-protocol-door-family-restore-report.md` §6/§11 "raw plan recompile deferred"):

- Official L01/L02/L04/L05/L06/L07/L08/L09 maps now use the premium door visualKeys (`industrial_access_door`, `residential_access_door`, `clinic_memory_door`, `reclamation_archive_door`).
- The three.js / `?compat=1` path resolves those through `DoorVisualIntent` → the new door GLBs.
- **But none of the precompiled raw-WebGPU render plans were re-cooked** — they still bake `room_door_security`. Raw-WebGPU is the *primary* path for official levels, so in normal play those doors still render the OLD generic door; only the compat fallback shows the new family doors.

Impact is **visual only** (no gameplay/ID/lock/layout change; campaign smoke L1→L10 passes). It predates this task and the proper fix is the deferred **level-remaster pass that recompiles the raw render plans** to consume the door families. Flagging it so it is decided explicitly rather than left silent — this feature set deliberately did not re-cook official render plans (out of scope, and exactly the work those prior reports deferred).

## Out of scope / notes

- Building presets land clear of existing rooms; connecting them to the rest of the map is the author's drag (or 一键修复), by design.
- Post-stamp the cluster's rooms are ordinary individual objects; "rotate as a unit" is chosen at stamp time (the no-schema-change path). Individual rooms rotate via §B2.
- L2/L5 `map.ts` diffs in the working tree are the earlier door-art sprint (documented in `human-protocol-door-family-restore-report.md`), not this feature set.
