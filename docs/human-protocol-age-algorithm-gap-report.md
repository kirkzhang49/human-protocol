# Human Protocol AGE Algorithm Gap Report

This note maps the Deep Research AGE proposal to the current Human Protocol math-first asset pipeline.

Related engine principle notes:

- `human-protocol-age-math-binary-lighting-engine-principles.md`: maps advanced math, binary encoding, and lighting math research into Human Protocol AGE rules for PBR lighting objectives, GLB/KTX2 packaging, screenshot QA, and blueprint-first asset validation.

## Already Present

- Level 01 lighting Objective v2/v3/v5 with contact shadow, reflection, volumetric/depth, pickup, enemy silhouette, elevator state color, bloom, flat-light, performance-budget, and screenshot-proxy scores.
- Enemy visual objectives for silhouette, cyan core, metal/specular, horror restraint, room-light harmony, contact shadow, geometry role, edge refinement, user appeal, premium read, and red/emissive penalties.
- Enemy GLB geometry search for local-axis repair, animation ownership, anchor integrity, and hard application constraints.
- Level 02 furniture Objective v1 for size, bevel, contact, PBR, room harmony, layout fit, and story role.
- Level 02 texture visibility audit/contact sheet for PNG-level luminance/contrast/edge visibility.
- Config validators, art QA, campaign smoke, and build checks.

## Main Missing Pieces

1. No single AGE schema layer yet: asset blueprint, range math, roomkit, QA report, and repair patch are still scattered across scripts and manifests.
2. Hard gates and soft art scores are not consistently separated across all objectives.
3. Texture QA exists at PNG level, but not yet at face/UV/runtime screenshot level.
4. Atlas region use and face-to-atlas alignment are not enforced before Blender export.
5. Collision proxy fit is mostly implied by layout/contact rather than scored as a first-class gate.
6. Cheap generated look is not consistently penalized outside enemy visual v4.
7. Repair suggestions are prose in some reports; they are not compact JSON patches everywhere.
8. Screenshot/render pass QA is only partial: Level 01 has screenshot sampler, but furniture/robot generation does not yet require RGB/depth/normal/object/material passes.
9. Human A/B preference learning is not yet a data structure.
10. Runtime heat is not yet a first-class asset field, so combat-hot, room-warm, and cold-static assets can still be packaged with the wrong compression/loading policy.
11. GUI assets do not yet declare their composition layer: post-tonemap HUD, pre-tonemap emissive, world-depth-tested, or depth-faded label.
12. WebGPU/WGSL buffer-layout rules are not yet represented in AGE schemas: alignment, stride, packed flags, numeric keys, SoA/AoSoA grouping, and storage/uniform ownership.
13. Agent behavior lacks a shared layered-control ladder: state machine/local steering, ORCA-style local avoidance, LQR/HJB local stabilizer, and offline PPO/DD-PPO research path.

## Implemented Now

Added `scripts/optimizer/level01_lighting_director_objective_v5.cpp`, `npm run assets:level01:lighting:search:v5`, and the config preset `hp:cyan_lockdown_arena_v5_age_director`.

Level 01 v5 keeps the same runtime ceiling as the previous art pass:

- 12 dynamic lights.
- 2 shadow-casting spotlights.
- 1 floor glow layer.
- Door-state color separation through locked red / unlocked cyan instead of brute-force brightness.
- Separate local light ownership for weapon pickup, repair table, left/right enemy rims, ceiling spine, and elevator beacon.

The accepted preset is the registry/QA version, not an automatic blind copy of the highest-scoring C++ candidate. The search report is used to find stable parameter ranges; `npm run lighting:qa` remains the hard gate for exposure, pickup readability, elevator state color, reflection, and dynamic-light budget.

Added `scripts/optimizer/level02_furniture_objective_v2.cpp` and `npm run assets:level02:furniture:search:v2`.

Objective v2 adds these report-layer upgrades without replacing current kit parameters:

- `textureVisibilityScore`
- `atlasRegionUseScore`
- `collisionProxyFitScore`
- `premiumHardSurfaceScore`
- `configReuseScore`
- `cheapGeneratedLookPenalty`
- `textureAtlasFailurePenalty`
- `collisionMismatchPenalty`
- `performancePenalty`
- hard gate pass/fail per candidate
- JSON `repairPatch` per target

## Next Algorithm Steps

1. Run Level 02 lighting Objective v4 with PBR material stability, SH/probe diffuse proxy, soft shadow composition, and runtime binary budget terms.
2. Feed Objective v2 best furniture candidates into Blender generation only after hard gates pass.
3. Add UV/atlas checker export from Blender: face region, UV coverage, stretch, visible-face assignment.
4. Add collision proxy overlay report for furniture and pickups.
5. Add runtime screenshot QA for Level 02 fixed views: foyer, light puzzle room, boss closet, exit.
6. Create shared schemas under `src/assets/schemas` or `docs/schemas`: `asset_blueprint`, `range_math`, `qa_report`, `repair_patch`.
7. Start human preference records for A/B rankings instead of changing weights only by hand.
8. Add `runtimeHeat` and `compositionLayer` to asset/report schemas before accepting more generated GUI, robot, and room assets.
9. Add a WGSL-layout note to every future GPU buffer schema: alignment, stride, packing, and whether data is SoA, AoS, or AoSoA.
10. Add an agent-control gate: any ORCA/LQR/RL prototype must report success rate, collision rate, path length, jerk, CPU/GPU cost, and fallback behavior before entering gameplay.
