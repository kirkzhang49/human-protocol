# Human Protocol AGE Math, Binary, And Lighting Engine Principles

This document turns the supplied advanced-math / binary-encoding / lighting-math research note into durable engineering rules for the Human Protocol Agentic Game Asset Engine.

Source:

- `/Users/zhengkaizhang/Downloads/高等数学、二进制编码与光影数学在3D美术与图形学中的应用与效率提升.pdf`
- `/Users/zhengkaizhang/Downloads/面向3D游戏引擎与Agent建模的高阶数学、底层编码与光影数学研究报告.pdf`

## Core Thesis

Human Protocol should not pursue premium assets by hand-tuned taste alone. The target is a self-owned engine layer:

```text
art intent
  -> typed blueprint IR
  -> range math and hard gates
  -> candidate search
  -> Blender / GLB generation
  -> binary/runtime packaging
  -> render and screenshot QA
  -> repair patches
  -> accepted config kit
```

The most valuable engine work is not a single clever formula. It is the coupling of:

- math objective functions
- data representation
- sampling strategy
- cache / compression strategy
- runtime validation
- human preference calibration

## Priority Stack

For our current game, the highest ROI order is:

1. PBR / BRDF sanity and exposure constraints.
2. Linear algebra, coordinate systems, normals, TBN, transforms, and animation anchors.
3. Probability, Monte Carlo thinking, candidate search, variance reduction, and multi-view QA.
4. Spherical harmonics / probe / frequency approximations for cheap diffuse lighting.
5. Discrete geometry for mesh quality: Laplacian smoothing, curvature, UV, ARAP-style edits.
6. Binary layout and compression: GLB, KTX2/BasisU, ASTC/BC, alignment, SoA, packed flags.
7. Acceleration structures and spatial encoding: Morton codes, BVH, grid / probe / page caches.

Do not start by chasing the deepest abstract math. Start where the output becomes visibly better, faster, and more reproducible.

## Lighting Rules

Lighting objectives must approximate real visual judgment rather than simply reward brightness.

Required math terms for future room lighting objectives:

- `whiteReadabilityScore`: critical areas are bright enough for real gameplay.
- `cinematicKeyFillRatio`: key light and fill light keep a visible hierarchy.
- `pbrMaterialStabilityScore`: white light does not turn furniture into flat plastic.
- `floorReflectionCompositionScore`: floor reflections have a center pool, edge falloff, and contact darkness.
- `softShadowCompositionScore`: shadows are soft, grounded, and not straight cheap bands.
- `shProbeDiffuseScore`: hemisphere/ambient/fog behave like low-frequency diffuse probes.
- `contactShadowScore`: table, sofa, robot, pickup, and cabinet bases do not float.
- `wallGradientScore`: walls carry a readable gradient, not pure black or flat gray.
- `ceilingStructureReadScore`: ceiling grid is readable but does not steal the frame.
- `pickupReadabilityScore`: medkit, energy, key, and story item silhouettes survive room lighting.
- `enemySilhouetteUnderRoomLightScore`: robots read against walls and floor.
- `lockedStateColorScore`: red locked states and cyan unlocked states are clear but not cheap.

Penalties:

- over-bright whiteout
- black crush
- flat clinical lighting
- washed texture
- hard shadow bands
- cheap red horror
- emissive bloom blocks
- runtime performance risk

## Level 01 Director Lighting Rule

Level 01 now uses `hp:cyan_lockdown_arena_v5_age_director` as the accepted
math-range lighting preset.

The useful idea is not "make the room brighter." It is to assign each light a
job while staying inside the same runtime budget:

- screen / entry pool: first-frame orientation and memory-screen focus;
- repair surgical area: white-cyan prop readability without flattening the room;
- weapon pickup pool: low local cue for critical pickup visibility;
- left/right enemy rim lights: robot silhouette at spawn lanes;
- ceiling spine: structure read without extra shadows;
- elevator state area / floor reflection / status spot: locked red and unlocked
  cyan as state beacons, with color separation carrying the lock feedback;
- hero and repair spotlights: two real shadow casters only;
- floor glow: low-cost shape and route cue, not a replacement for real light.

Acceptance gates:

- `npm run lighting:qa` must pass with `dynamicLightCount <= 12`,
  `shadowCastingSpotCount <= 3`, `brightestSample <= 1.65`, and clear elevator
  state color separation.
- `npm run enemy:color:qa` must still pass under the accepted lighting preset.
- C++ math search reports are range-finding evidence. They may suggest values,
  but the registry preset is accepted only after the runtime-oriented QA script
  passes.

## Level 02 White Light Rule

Level 02 is a residential simulation, not a maintenance lockdown room. It may use stronger white ceiling light than Level 01.

The white light is accepted only if it also passes:

- furniture texture visibility
- restrained domestic warmth
- uncanny service-horror accent
- floor reflection layers
- soft contact shadows
- puzzle and pickup readability
- low red-emissive footprint
- no white-plastic PBR look

Bright is not enough. The room must feel like a clean residential area that is slightly wrong.

## Asset Modeling Rules

Every serious asset should begin with a blueprint and a range schema.

Hard gates:

- GLB exports and loads.
- No detached or floating parts.
- UV regions are used by visible faces.
- Collision proxy fits visible mesh.
- Critical silhouette is readable in gameplay view.
- Emissive area is bounded.
- Texture detail survives runtime lighting.
- Config keys exist and validate.

Soft scores:

- premium hard-surface shape balance
- cubeness penalty
- bevel health
- material layering
- texture visibility
- atlas region use
- room-light harmony
- contact shadow
- config reuse
- performance budget

Robots, furniture, doors, pickups, walls, floors, ceilings, and light fixtures should share this contract. A model that only looks good in one Blender still is not accepted.

## Binary And Runtime Packaging Rules

The asset engine must treat binary representation as part of art quality.

Rules:

- Prefer GLB over glTF with base64 payloads for runtime delivery.
- Track texture atlas usage and prepare for KTX2/BasisU.
- For platform packaging, prefer GPU-ready compressed textures: BC/ASTC/ETC through KTX2 where possible.
- Store normal maps with XY-only options when practical, then reconstruct Z in shader.
- Keep material flags packable into compact integers.
- Separate render mesh, collision proxy, and solver representation.
- Use SoA-like data for high-frequency GPU/runtime access.
- Keep IDs, manifests, and config keys stable.

This does not make the image more physically correct by itself. It lets the same art budget load faster, render more reliably, and scale into desktop-quality builds.

Runtime compression rule after the robot hitch finding:

- Transmission compression is not the same as frame-time optimization.
- Combat-hot robots must not require meshopt, Draco, or quantization decode at runtime.
- For enemies, prefer a cooked-but-uncompressed runtime GLB: prune, dedup, weld, join, and material palette are allowed; geometry/texture recompression is not.
- Environment props may still use meshopt/WebP cooking when they are static, culled by room visibility, and validated by the performance sampler.
- KTX2/BasisU remains an experiment for memory/loading pressure, not an automatic FPS fix.

PWA loading rule:

- PWA is a startup, reinstall, offline, and weak-network recovery layer. It does
  not make the WebGL frame loop faster by itself.
- Precache only the app shell: `index.html`, manifest, metadata, icon, and the
  hashed JS/CSS entry files.
- Runtime-cache large GLB, texture, image, audio, and future WASM files only
  after normal gameplay requests them. Do not install-time precache every robot,
  room asset, and music file, because that can make the first playable session
  slower.
- Register the service worker after window load / idle time so it does not
  compete with first-scene asset loading.
- Treat PWA as a partner to preloading: preload hot robots in the game layer;
  let PWA make the second launch and offline retry cheaper.

## Screenshot QA Contract

The next AGE renderer layer should not accept assets or lighting from beauty screenshots alone.

Required QA passes over time:

- beauty RGB
- depth
- normal
- material ID
- object ID
- roughness / metallic proxy
- shadow or contact pass
- UV checker

Fixed QA views:

- gameplay camera
- pickup close view
- enemy view
- door / exit view
- mobile crop
- art showcase view

Metrics should be computed from those passes first. VLM or CLIP-like critique can assist, but should not own hard pass/fail.

## AGE GUI / Image2 Ornament Rules

The Human Protocol GUI pass showed a useful failure mode: isolated direct PNG
resources looked worse than the full composition sketch. The fix is to prompt
and evaluate GUI resources as a connected AGE design system, not as separate
buttons.

Current approved direction board:

```txt
/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/sketches/human-protocol-age-gui-resource-board-v3-math-ornament.png
```

GUI ornament is allowed, but only under mathematical control.

Required GUI objective terms:

- `liveTextSafeZoneRatio >= 0.62` for rectangular plates.
- `ornamentDensity <= 0.18` of each asset area.
- `touchTargetMinPx >= 44`.
- `combatCenterMinPx >= 58`.
- `contrastRatio >= 4.5` for body text backing.
- `shadowClamp >= 0.66` for readable overlay shading.
- `gridAlignmentPx = 8` for panel edges, gutters, text baselines, and icon sockets.
- `lineHierarchy = 1px hairline / 2px primary rail / 4px glow edge`.
- `radialSymmetryScore` for weapon rings, joystick rings, radar wells, and action buttons.
- `bilateralSymmetryScore` for HUD, loading, objective, and dialogue plates.

Allowed ornament zones:

- outer border rails;
- corner brackets;
- circular ring etching;
- radar wells;
- progress trough rims;
- low-opacity edge glow.

Forbidden ornament zones:

- live text rectangles;
- live number / percent regions;
- progress fill lanes;
- SVG glyph centers;
- crosshair exclusion zone;
- thumb control center;
- any Heat / Temp / Overheat / Thermal HUD row.

Prompting feedback:

Do not ask image2 to "make a button" or "make a HUD asset" in isolation. Ask for
a cohesive resource board first, with math constraints visible in the prompt.
After the board is approved, cut or regenerate individual transparent PNG plates
from that style. HTML/CSS owns all text, glyphs, numbers, progress, language,
touch boxes, and runtime math.

### Combat GUI Viewport Solver Rule

Combat HUD placement must be derived from the active browser window, not from
fixed screen assumptions.

The runtime solver writes viewport-derived CSS variables:

- `--hp-vw`, `--hp-vh`: current visual viewport size.
- `--hp-edge`, `--hp-gap`: safe-area edge and inter-panel gap.
- `--hp-hud-w`, `--hp-hud-h`: left status panel rectangle.
- `--hp-settings-w`, `--hp-settings-h`: top-right settings rectangle.
- `--hp-objective-max-w`: maximum mission strip width after subtracting the
  left HUD and right settings reserves.
- `--hp-action-cluster`, `--hp-action-panel-w`: bottom-right weapon/action
  rectangle.
- `--hp-type-xs/sm/md/lg`: type scale derived from viewport height and area.

Layout contract:

1. Left HUD, mission strip, and settings occupy non-overlapping top rectangles.
2. On compact windows, the mission strip moves below the left HUD instead of
   trying to remain centered across the whole screen.
3. Bottom-right weapons own their own action rectangle; centered prompts shrink
   by that reserve rather than drawing underneath it.
4. Font size is derived from viewport math and clamped, never from raw `vw`
   alone.
5. `npm run gui:layout-audit` must pass for representative desktop, laptop,
   compact landscape, and mobile landscape viewports before accepting a combat
   GUI pass.

## Candidate Search Rules

Large candidate counts help only when the objective is right.

Use C++ search for broad sweeps, but require:

- current baseline score
- best score
- score delta
- per-term scores
- per-term penalties
- top 12 candidates
- best candidate params
- replacement recommendation
- repair hints

If a search with more families stops improving, improve the objective instead of only increasing candidates.

## 3D Engine And Agent Modeling Paper Digest

The 3D engine / Agent modeling PDF is useful to AGE as a roadmap, not as a
drop-in algorithm source. Its metadata marks it as a generated research report,
so any paper, patent, or public technical claim must be traced back to primary
sources. Internally, it is still valuable because it connects the same systems
we are already building: asset compression, render budgets, lighting math, GUI
composition, and layered agent control.

The core lesson for Human Protocol is:

```text
high-order math
  -> discrete engine operator
  -> packed runtime data
  -> budgeted GPU/CPU execution
  -> QA metric
  -> accepted config/runtime rule
```

Do not treat Laplacian, PDE, SH, PRT, ORCA, PPO, meshopt, KTX2, BVH, or HDR UI
as independent buzzwords. AGE should only absorb them when they become one of
these reusable engine levers:

- reduce bytes, draw calls, light count, shadow count, shader cost, or frame
  variance;
- improve asset handoff quality through deterministic geometry/material/collision
  checks;
- improve visual stability under real gameplay cameras, mobile crops, and HUD
  overlays;
- improve agent behavior through layered control and measurable safety, not
  black-box intelligence.

### Missing Rules Added From The Agent Modeling Paper

The new report adds useful pressure in five places where this document was still
too soft.

1. Runtime heat must decide binary policy:
   - `combat_hot`: player, enemies, weapons, projectiles, hit effects, door
     status hardware. No runtime meshopt, Draco, or quantization decode on the
     critical path. Prefer cooked, joined, deduped, palette-stable GLB with
     all shader/material variants warmed.
   - `room_warm`: current-room doors, pickups, puzzle markers, terminals,
     screen props, and room-shell trim. Compression is allowed only if it is
     preloaded before gameplay and validated against p95 frame time.
   - `cold_static`: far rooms, static shell panels, museum props, archival
     backdrops, and optional showcase pieces. These may use meshopt/WebP/KTX2
     experiments when visual QA passes and first-use decode is hidden behind a
     loading or room-transfer phase.

2. GUI must be a layered HDR contract, not a PNG skin:
   - screen HUD text, live numbers, crosshair, menus, and mobile controls live
     in post-tonemap overlay space for maximum readability;
   - diegetic screens, holograms, door panels, warning glows, and world-space
     labels may pre-compose into HDR/emissive space so they can share bloom and
     exposure;
   - world-space UI should depth-test, avoid depth-write, and use a small
     view/clip bias instead of always-on-top hacks;
   - every accepted GUI asset must declare whether it is `post_tonemap_ui`,
     `pre_tonemap_emissive`, `world_depth_tested`, or `depth_faded_label`.

3. WebGPU/WGSL layout is an asset rule:
   - instance buffers, light lists, material tables, GUI glyph/plate records,
     and indirect draw records must be designed as SoA/AoSoA-friendly data;
   - 16-byte alignment, explicit stride, packed flags, stable IDs, and numeric
     keys are part of the schema, not cleanup after the fact;
   - hot loops should avoid per-frame `filter/map/sort/slice`, string keys,
     clone-heavy vector snapshots, and diagnostic work unless `perf=1` or a
     development build asks for it.

4. Lighting must use a transport ladder:
   - current-room hero lighting may use real dynamic lights and selected
     shadows;
   - adjacent rooms should use fewer real lights, emissive strips, floor glows,
     and cached/probe-like approximations;
   - far visible rooms should keep mood through SH/probe/emissive terms before
     they become real dynamic lights;
   - PRT, Gaussian splat relighting, path guiding, and real path tracing are
     WGPU Robot Lab research items until a benchmark proves runtime value.

5. Agent intelligence must be layered:
   - state machines and local steering are the shipping baseline;
   - Kalman/Bayes smoothing, social-force fields, and ORCA-style reciprocal
     avoidance are the next layer for dense robot motion;
   - LQR/HJB belongs in stable local controllers such as camera, vehicle,
     drone, grip, tool, or puppet stabilizers;
   - PPO/DD-PPO is an offline training and research route, not a live gameplay
     dependency unless it compiles down to cheap inference and has collision,
     path length, jerk, and success-rate metrics.

Research graduation gate:

An advanced idea can enter Human Protocol only when it has:

- primary-source trace or a local benchmark proving the claim;
- a baseline and ablation;
- p50/p95 frame time, memory, bytes, draw calls, and visual-error numbers where
  relevant;
- a rollback path and a config/manifest flag;
- a clear owner: WGPU Robot Lab for reusable asset intelligence, Human Protocol
  for shipped runtime behavior.

### Immediate Absorption

These ideas are useful now:

1. Asset data pipeline: quantized geometry, meshopt-style vertex/index ordering,
   GLB cooking, texture atlas accounting, and KTX2/BasisU experiments.
2. Runtime visibility budget: current/adjacent/critical room culling, door/prop
   culling, dynamic light top-k, limited shadow casters, shader/visual LOD, and
   instanced repeated environment meshes.
3. Lighting stack: keep a PBR/GGX-compatible base, then add stylized color,
   bloom, haze, and screen-space effects as controlled offsets. Distant lights
   should collapse into emissive/glow/probe approximations before becoming real
   dynamic lights.
4. GUI composition: keep HUD text and live numbers in post-tonemap screen UI;
   keep diegetic screens and holograms in a controlled emissive layer that can
   participate in bloom/exposure without destroying readability.
5. Agent control: use state machines and local steering first, then add ORCA-like
   local avoidance and Kalman-style smoothing where many dynamic actors need it.

This matches the runtime work already started: `RenderPerformance`,
`RenderVisibility`, shared obstacle spatial indexing, dynamic light top-k,
effect/projectile caps, detailed enemy caps, and instanced room-shell assets.

### Middle-Term Absorption

These ideas should be planned, but not rushed into the current game loop:

1. SH/light-probe approximation for room diffuse lighting so far rooms can keep
   mood without real point/spot lights.
2. A render metric sampler that records p50/p95 frame time, renderer info,
   dynamic lights, shadow casters, visible rooms, visible props, and active
   effects per level.
3. KTX2/BasisU asset packaging with visual-error reports for GUI, room atlases,
   enemy atlases, and generated level textures.
4. GPU instance atlas for repeated decals, pickups, wall strips, puzzle markers,
   and non-gameplay glows.
5. ORCA-lite or grid-based reciprocal avoidance for future dense robot/crowd
   scenes, with success rate, collision rate, path length, and jerk metrics.

### Long-Term Research Only

These are not first fixes for Human Protocol performance:

1. Full real-time path tracing and path guiding.
2. PRT/Gaussian-splat relighting as a shipping runtime dependency.
3. PPO or DD-PPO inside the live gameplay loop.
4. DOBB-BVH or advanced BVH variants unless we move into true ray queries,
   complex animated collision proxies, or an offline asset-lab acceleration
   benchmark.
5. OpenPBR material inversion as a required runtime feature.

They remain good WGPU Robot Lab research topics, especially if we want demos,
papers, or patents. They should graduate into Human Protocol only after a small
benchmark proves the product value.

### K-D Tree Decision

K-d trees do not directly reduce the cost of WebGL/Three dynamic lighting or
shadow maps. They help find candidates faster on CPU. For the current game,
uniform grids / spatial hashes are the better default for projectiles, enemies,
obstacles, and nearby interactions because movement is mostly top-down and
dynamic. BVH is the better concept for ray queries, mesh collision, occlusion, or
path tracing. A k-d tree may be useful later for mostly static probes, light
anchors, authoring-time nearest-neighbor queries, or asset-lab geometry search,
but it is not the next FPS breakthrough.

### Optimization Roadmap From This Digest

Next Human Protocol optimization should be measurement first:

1. Add a runtime performance sampler that can print or export per-level p95
   frame time, renderer triangles/calls, active lights, shadow casters, visible
   rooms, visible props, projectile/effect counts, and quality tier changes.
2. Use those samples to tune `RenderPerformance` thresholds and budgets per
   desktop/mobile instead of guessing.
3. Convert remaining repeated visual-only meshes into instance sets or batched
   geometry. Prioritize room trims, glows, puzzle markers, decals, pickup
   beacons, and non-interactive small props.
4. Split light responsibility: current room gets real dynamic lights; adjacent
   rooms get fewer real lights; far/critical rooms get emissive/glow/probe.
5. Start the KTX2/BasisU experiment only after runtime object budgets are under
   control. Texture compression helps loading/memory more than immediate FPS
   when the frame is currently light/draw/shadow bound.

The practical rule is: before adding a heavier math system, prove which budget is
actually hot. If frame time is dominated by draw/light/shadow cost, reduce
render participation. If loading or memory is hot, optimize GLB/KTX2. If CPU
nearby queries are hot, improve spatial indexing. If behavior feels unintelligent
but frame time is fine, then work on agent control.

## Engine Roadmap From The Math/Binary/Lighting Paper

Near term:

1. Level 02 lighting Objective v4: brighter residential white light with PBR, SH/probe, soft shadow, reflection, and runtime-budget proxies.
2. Shared `asset_objective_v1`: cubeness, bevel, UV/atlas, texture visibility, collision fit, and config reuse for furniture and robots.
3. Runtime screenshot sampler for Level 02: foyer, living room, light puzzle room, care room, exit.

Middle term:

1. `AssetSpec` schema for room prop, enemy, pickup, door, room kit, and lighting kit.
2. GLB + texture manifest validator that detects embedded image use, atlas face assignment, and material texture references.
3. Collision overlay QA and pathing checkpoints per prop collider.
4. KTX2/BasisU packaging experiment for image2 texture families.

Long term:

1. Multi-pass render QA with depth/normal/object/material outputs.
2. Human A/B preference records for premium horror and readable gameplay.
3. Repair-agent loop that emits compact JSON patches rather than rebuilding everything.
4. Runtime renderer upgrades that can use probes, reflection caches, and screen-space effects without giving up web deployability.

## WGPU Robot Lab Reading Notes For AGE

WGPU Robot Lab should be treated as the AGE research bench, not as another game folder. Its useful contribution is not only WebGPU rendering; it is the structure around rendering:

```text
robot / prop / room goal
  -> typed blueprint or package registry entry
  -> formula / solver / QA report in WGPU Robot Lab
  -> preview, action capture, socket review, export preset
  -> accepted GLB / manifest / config handoff
  -> Human Protocol runtime consumes the result
```

What the lab already proves:

- A robot is a package, not a mesh. `mechaRegistry`, `MechaBlueprint`, `MECHA_ASSET_SCHEMA`, export presets, sockets, material slots, skill loadouts, and action clips form a stable contract.
- First-person hands and weapons need measured review, not taste-only iteration. The socket overlay, contact-pair review views, grip QA reports, and capture actions are the right foundation for AGE validation.
- Human Protocol room assets can be previewed in a controlled WGPU/Three lab scene before being promoted into official level config.
- Formula work belongs in WGPU Robot Lab first: grip search, hand refiner, spatial contact / Morton broad phase, DDG / Poisson prototypes, asset cooker reports, GUI math, and enemy visual objectives.
- Export presets force an explicit target: `WEB_SMALL`, `WEB_BOSS`, or `STEAM_HERO`. This is useful because the same asset family can have different triangle, material, texture, socket, animation, LOD, and runtime budgets.

How this helps Human Protocol immediately:

- Keep Human Protocol focused on reusable runtime verbs: load GLB, instance repeated assets, render configured lighting, resolve config keys, run gameplay systems, and verify campaign playthrough.
- Move durable modeling math back to WGPU Robot Lab when it starts becoming reusable. Human Protocol may keep level-specific search scripts temporarily, but accepted formulas should become WGPU specs/reports.
- Promote only accepted WGPU artifacts into Human Protocol config. A beauty render, a generated GLB, or a chat note is not enough; the handoff should include model key, dimensions, material slots, socket names, collision proxy expectation, texture evidence, QA report, and export budget.
- Use WGPU capture/review URLs as the front door for asset QA. The important views are not arbitrary screenshots; they are fixed review cameras, action captures, socket overlays, room-preview captures, and mobile-safe crops.
- Treat binary packaging as part of the art pipeline. Source assets stay editable; runtime assets can be cooked only after visual/collision acceptance.

AGE boundary rule:

```text
WGPU Robot Lab owns reusable asset intelligence.
Human Protocol owns shipped gameplay configuration and runtime behavior.
```

When in doubt, ask which side should own the truth:

- Shape, socket, contact, material, lighting objective, export preset, and asset QA truth: WGPU Robot Lab.
- Level pacing, room graph, puzzle state, enemy spawning, pickup placement, input, HUD state, and official runtime validation: Human Protocol.

Practical next AGE docs to create or strengthen:

1. `AssetSpec` templates for room prop, enemy, pickup, viewmodel, lighting kit, and export runtime bundle.
2. A WGPU-to-Human handoff checklist that maps WGPU `robotId` / `assetId` to Human Protocol `modelKey`, `visualKey`, room kit, and validator entry.
3. A screenshot QA matrix that names fixed views: gameplay, pickup close, enemy read, door state, first-person grip, mobile crop, and art showcase.
4. A report schema that carries hard fail masks, soft scores, artifact paths, budget numbers, and the smallest allowed repair patch.
5. A performance bridge from WGPU reports to Human Protocol runtime metrics: draw calls, triangles, dynamic lights, shadow casters, texture memory, GLB bytes, and p95 frame time.

The important product lesson is: AGE should let agents explore widely, but every accepted result must collapse into typed data, deterministic checks, and small repairable deltas. WGPU Robot Lab is where that exploration becomes measurable before Human Protocol takes on the shipping risk.

## Non-Negotiable Principle

The engine should let an agent imagine, but the engine must verify.

LLM output is a proposal. Math, schema, runtime, screenshots, and human preference data are the truth layer.
