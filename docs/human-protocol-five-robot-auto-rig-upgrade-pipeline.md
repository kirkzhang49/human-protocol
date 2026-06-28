# Human Protocol Five-Robot Auto-Rig Upgrade Pipeline

Generated: 2026-06-19

## Goal

This plan adapts useful ideas from the external `auto-rig-3d` reference into the
Human Protocol enemy robot asset pipeline. The goal is not to copy that private
repo or its browser product structure. Human Protocol remains the source of
truth for model keys, visual profiles, level config, Raw WebGPU compilation,
runtime enemy animation, and QA.

The immediate production rule is conservative: generate audit evidence and
candidate scores first, then replace official GLBs only after source scripts,
rollback paths, render evidence, Raw WebGPU rebuilds, and browser screenshots
prove the result is better.

## Prototype-First Correction

The auto-rig-3d integration must not use the five Human Protocol prompts as
fresh random robot prompts. Each HP entry must start from the current official
robot asset as identity evidence:

1. Read the official `modelKey`, source GLB, cooked GLB, target height, texture
   atlas, emissive map, role, and geometry intent from this audit/plan.
2. Build an `official-prototype` genome proxy in auto-rig-3d that preserves the
   HP robot identity: profile, body plan, role silhouette, material palette,
   hover/contact rule, and source/cooked GLB evidence paths.
3. Put that `official-prototype` proxy first in the auto-rig candidate board and
   automatically use it as the frozen identity lock.
4. Generate only same-modelKey improvement branches below that lock. Branches
   may improve silhouette, part hierarchy, detail breakup, material value
   separation, and emissive restraint, but must not switch into unrelated
   robot families.
5. `Save HP` handoffs must include both selected branch and locked official
   prototype metadata. Human Protocol import remains candidate-only until QA.

This is still a procedural proxy, not direct mesh editing of the official GLB.
Direct GLB-to-genome retargeting is a later feature. The current accepted
workflow is official GLB evidence -> editable proxy genome -> locked evolution
-> candidate GLB import -> QA -> possible official replacement.

## Current Asset Map

| Game role | Runtime archetype / trigger | modelKey | Source GLB | Cooked GLB | Texture evidence | Runtime notes |
| --- | --- | --- | --- | --- | --- | --- |
| Flying repair / medical drone | `repair_drone` | `hp_enemy_repair_drone_horror` | `src/assets/models/enemies/hp_enemy_repair_drone_horror.glb` | `src/assets/models-cooked/enemies/hp_enemy_repair_drone_horror.glb` | `src/assets/textures/enemies/hp_enemy_repair_drone_atlas.webp`, `hp_enemy_repair_drone_emissive.webp` | Small fast flying enemy. Runtime altitude helper adds hover height; no fake ground base is allowed. |
| Low clamp repair robot | `clamp_bot` | `hp_enemy_clamp_repair_horror` | `src/assets/models/enemies/hp_enemy_clamp_repair_horror.glb` | `src/assets/models-cooked/enemies/hp_enemy_clamp_repair_horror.glb` | `src/assets/textures/enemies/hp_enemy_clamp_repair_atlas.webp`, `hp_enemy_clamp_repair_emissive.webp` | Fast low ground pressure enemy. Must read as contact-heavy and grabbing. |
| Shield / archive technician | `shield_tech` | `hp_enemy_shield_technician_horror` | `src/assets/models/enemies/hp_enemy_shield_technician_horror.glb` | `src/assets/models-cooked/enemies/hp_enemy_shield_technician_horror.glb` | `src/assets/textures/enemies/hp_enemy_shield_technician_atlas.webp`, `hp_enemy_shield_technician_emissive.webp` | Taller support unit. Shield must be physical plates/generator blocks, not a magic bubble. |
| Custodian foreman / ordinary boss | `custodian_elite`, `tier=leader`, normal boss use | `hp_enemy_custodian_foreman_horror` | `src/assets/models/enemies/hp_enemy_custodian_foreman_horror.glb` | `src/assets/models-cooked/enemies/hp_enemy_custodian_foreman_horror.glb` | `src/assets/textures/enemies/hp_enemy_custodian_foreman_atlas.webp`, `hp_enemy_custodian_foreman_emissive.webp` | Maintenance supervisor platform. Should feel like industrial service machinery, not random hero mecha. |
| Reclamation Mother final boss | Level 05 boss: `custodian_elite` + `tier=boss` + `textureAtlasKey=custodian_boss` | `hp_enemy_reclamation_mother_final_horror` | `src/assets/models/enemies/hp_enemy_reclamation_mother_final_horror.glb` | `src/assets/models-cooked/enemies/hp_enemy_reclamation_mother_final_horror.glb` | `src/assets/textures/enemies/hp_enemy_reclamation_mother_final_atlas.webp`, `hp_enemy_reclamation_mother_final_emissive.webp` | Unique Level 05 final machine. It must not be just a scaled foreman. |

Current config/runtime entry points:

- `src/assets/enemyModelAssets.ts` imports the five cooked GLBs and owns `EnemyModelKey` plus `modelKeyForEnemy`.
- `src/game/config/enemyVisualProfiles.json` carries the current palette/search score metadata.
- `src/game/visual/VisualProfile.ts` maps archetype visual keys to model keys and scale hints.
- `src/game/config/validation/authoringValidator.ts` whitelists generated enemy model keys and texture atlas keys.
- `src/render/raw-webgpu/RawThreeEnemyOracle.tsx`, `src/render/raw-webgpu/RawWebGpuRuntimeHelpers.ts`, and `src/render/raw-webgpu/RawWebGpuLevelRenderer.ts` provide target heights, altitude, clip playback, and Raw fallback behavior.
- `src/render/raw-webgpu/RawRobotAnimationBridge.ts` contains current readability overrides for specific model keys and some exact mesh/node-name cases. This is useful evidence of weak implicit contracts and should become audit output before new replacements.
- `src/assets/models-cooked/enemies/*/.raw-webgpu/level_*.json` and `src/assets/manifests/generated/raw-webgpu/raw_robot_animation_bridge_level_*.json` are generated evidence, not files to patch by hand.

## What Auto-Rig-3D Contributes

The useful reference pipeline can be decomposed into these reusable stages:

1. Intent/profile contract: define family, role, body-plan anchors, allowed mutation ranges, forbidden drift, material roles, and export expectations before generating geometry.
2. Canonical rig and support graph: require visible parts to be bound to a semantic control/bone and reject free-floating decoration.
3. Part socket binding: attach weapon/tool/core/pod parts to stable sockets and validate socket presence.
4. Physics/contact QA: score connectedness, feet/paw grounding, hover semantics, backpack embedding, weapon/tool clearance, and motion clearance.
5. Candidate search: generate many bounded variants, rank with hard gates first and scores second, and preserve diverse top candidates instead of only the nearest score maximum.
6. Art grammar: mutate silhouette channels such as negative space, panel breakup, core frames, tool mass, shoulder/stance width, pod split, wedge/flare, and named gaps.
7. Material/color craft: evaluate palette, value separation, emissive coverage, core contrast, material premium, and pseudo-bake style cavity/edge evidence.
8. Visual gallery and audit: write contact sheets, before/after reports, score tables, and rank-order checks so rank 1 is the best actual candidate.
9. Strict pseudo-bake / QA: treat final acceptance as a bundle of GLB contract, material evidence, score breakdown, Raw/runtime integration, and screenshots.

## What Must Not Be Copied Directly

- The fixed canonical humanoid robot rig cannot be used as-is. Human Protocol has five curated facility archetypes: hover drone, low clamp, support technician, supervisor, and final reclamation boss.
- Weapon-grip and sword assumptions do not apply broadly. Human Protocol needs repair arms, clamp jaws, shield plates, scanner pods, tool arms, and boss attack sockets.
- Browser MVP schemas, worker/API routing, and product UI concepts do not belong in the game repo.
- Auto-rig renderer/WebGPU preview logic is incompatible with Human Protocol Raw WebGPU and Three enemy oracle runtime paths.
- Candidate JSON/GLB exports from auto-rig should not be copied into Human Protocol. Only algorithms and evidence habits should be adapted.
- Generated Raw WebGPU JSON must not be hand-patched. Source GLB, source Blender scripts, manifests, registry entries, and compilers are the editable chain.

## Human Protocol Reusable Verbs To Add

The first production step should add reusable scripts and manifests, not one-off renderer branches:

- `auditHpEnemyRobotAutoRigReadiness`: read model keys, GLB metadata, material/texture evidence, Raw WebGPU cooked evidence, bounds, clip names, and implicit runtime contracts.
- `scoreHpEnemyRobotCandidate`: produce component scores for silhouette, support/contact, material craft, emissive restraint, texture evidence, and runtime integration.
- `compareHpEnemyRobotCandidate`: compare an official GLB against a candidate GLB using the same schema before any replacement.
- `generateHpEnemyRobotCandidate` later: deterministic Blender generation or polish from a blueprint, writing source `.blend`, candidate GLB, texture/atlas evidence, and candidate manifest.
- `rankHpEnemyRobotCandidates`: keep diverse candidates per robot role and forbid rank order mismatches.
- `qaHpEnemyRobotRuntime`: rebuild Raw WebGPU evidence, run art/config QA, capture Three/Raw screenshots, and write a QA bundle.

## Scoring Schema V1

The first script should use an explainable report-only score. It is not a final art oracle.

| Component | Purpose | Example evidence |
| --- | --- | --- |
| `silhouetteScore` | Does the bounding shape and role anchor match the robot blueprint? | normalized width/height/depth, role-specific aspect targets, boss scale distinction |
| `supportContactScore` | Does the model obey hover or ground contact expectations? | minY, pivot hint, runtime altitude, no floor base for drone, clear ground plan for clamp/ground robots |
| `materialCraftScore` | Are material slots/textures meaningful and non-generic? | material names, baseColorTexture count, image names, atlas files, metallic/roughness evidence |
| `emissiveRestraintScore` | Are glow channels present but not whole-body chaos? | emissive texture/factor counts, expected cyan/amber/red role hints |
| `textureEvidenceScore` | Is there real texture evidence beyond file existence? | GLB embedded images, external atlas/emissive WebP files, texture naming, size bytes |
| `runtimeIntegrationScore` | Can the runtime and Raw path actually use it? | model key registration, visual profile, validator whitelist, required clips, Raw cooked sidecars |

Reports should also include `replacementRecommendation` as one of:

- `report_only`
- `candidate_generation_ready`
- `qa_required_before_replacement`
- `do_not_replace`

## Per-Robot Upgrade Targets

### 1. `repair_drone` -> `hp_enemy_repair_drone_horror`

- Silhouette: compact hovering medical/maintenance pod, horizontal probe arms, real side/rear thruster pods, underside clamp/cable hook.
- Hierarchy: `Body`, `HeadOrSensor`, `Core`, `ToolArmA/B`, `ThrusterA/B`, `WarningLightA/B`; pivot should stay hover-centered.
- Contact/flight: must not use a fake ground base; score should reward hover-centered geometry and runtime altitude, while still checking death/drop pose evidence.
- Material palette: worn off-white shell, smoked titanium/gunmetal internals, cyan scanner, tiny amber/red fault light.
- Emissive restraint: scanner eye/status strip only; no whole body glow.
- Texture plan: family atlas should show panels, screw seams, medical plastic, vents, and small hazard marks; emissive mask should isolate scanner/fault lamp.
- Animation/pose sockets: scanner/core, two repair arm sockets, thruster pods, hit/death tumble readability.

### 2. `clamp_bot` -> `hp_enemy_clamp_repair_horror`

- Silhouette: low wide service crawler with two large forward clamps; contact shadow and front grab read must dominate.
- Hierarchy: low chassis, left/right clamp arms, small sensor stack, treads/wheels/feet, core, warning lamp.
- Contact/flight: ground enemy must visually sit on or just above the floor after runtime normalization; no skating.
- Material palette: off-white/gray service shell, dark rubber contact parts, cyan sensor, restrained amber hazard striping.
- Emissive restraint: small sensor/core; attack warning can pulse amber/red.
- Texture plan: clamp jaws need darker wear, edge highlights, hinge detail, and contact-side grime.
- Animation/pose sockets: clamp tips and front impact hitbox should be addressable; attack windup opens jaws before strike.

### 3. `shield_tech` -> `hp_enemy_shield_technician_horror`

- Silhouette: taller support robot with physical shield plates/generator blocks and narrow diagnostic head/sensor.
- Hierarchy: service-cart or stable leg base, central body, shield plate cluster, archive/tool arms, scanner screen/core.
- Contact/flight: stable ground/support stance; shield plates should not enlarge into magic halo or transparent bubble.
- Material palette: facility cyan graphite, archive glass, smoked titanium, small amber maintenance warning.
- Emissive restraint: cyan diagnostic lines and shield generator cores; red only for attack/error.
- Texture plan: archive panel lines, plate bevels, sensor glass, sealed compartments.
- Animation/pose sockets: shield plate pivot/socket, scanner/core, support VFX socket, hit reaction exposing core.

### 4. `custodian_foreman` / `custodian_elite` -> `hp_enemy_custodian_foreman_horror`

- Silhouette: forklift base + repair table + maintenance supervisor tool arms; broad and heavy but practical.
- Hierarchy: industrial base, chest/worktable core, asymmetric tool arms, warning tower, clamps, service plates.
- Contact/flight: bottom-centered ground platform with readable mass and collision proxy; no random thin mecha legs.
- Material palette: off-white/gray/gunmetal, amber hazard accents, limited red emergency core.
- Emissive restraint: central core and tower warning only; avoid red-black demon palette.
- Texture plan: larger atlas with scuffed service panels, tool wear, edge trim, warning decals integrated into geometry.
- Animation/pose sockets: tool slam sockets, weak core, tower warning, boss phase/hit windows.

### 5. `reclamation_mother` -> `hp_enemy_reclamation_mother_final_horror`

- Silhouette: unique tall final machine, archive chamber/server spine/repair altar fused to a mobile industrial base.
- Hierarchy: massive base, central identity core/chamber, server spine, asymmetric clamp/scanner/surgery/cable-reader arms.
- Contact/flight: large grounded boss with strong collision proxy; must stay within Human Protocol facility language.
- Material palette: white-blue archive panels, dark machinery, red core warning, amber industrial accents.
- Emissive restraint: core/chamber and small screen strips; no monster face, no full-body glow.
- Texture plan: boss atlas can be larger; must show archive panels, cable bundles, worn chamber trim, black-glass sensors.
- Animation/pose sockets: multi-arm attack sockets, core vulnerability socket, phase sockets, death/collapse pose into inert repair altar.

## Execution Plan

### Phase 0: Auto-rig UI handoff loop

The intended artist/tool loop is:

1. Open auto-rig-3d with one of the Human Protocol robot prompt entry points, for example `?hpRobot=hp-repair-drone#robots`.
2. Generate, lock, sculpt, recolor, material-polish, branch, compare, and keep iterating inside auto-rig-3d.
3. Press `Save HP` in auto-rig-3d. This downloads a `human-protocol/auto-rig-robot-handoff@1` JSON file containing the active `modelKey`, edited prompt, selected robot asset JSON, lock state, scores, operations, preference events, and import instructions.
4. Import that handoff from the Human Protocol repo:

```bash
node scripts/asset-build/import-hp-enemy-robot-auto-rig-handoff.mjs \
  --handoff <downloaded-handoff.json> \
  --auto-rig-root /Users/zhengkaizhang/Documents/Codex/2026-06-19/human-protocol-l2-furniture-polish/references/auto-rig-3d \
  --export-glb
```

The importer writes a candidate package under
`src/assets/models-cooked/enemies/auto-rig-candidates/<modelKey>/<handoffId>/`.
It does not replace official source or cooked GLBs. Replacement remains gated by
the audit, visual gallery, Raw WGPU rebuild, and screenshot QA steps below.

Human Protocol prompt entry names exposed in the auto-rig UI:

| Entry name / URL param | modelKey | Initial candidate requirement |
| --- | --- | --- |
| `hp-repair-drone` | `hp_enemy_repair_drone_horror` | First candidate is `hp-official-proxy-hp_enemy_repair_drone_horror`; no skids/floor base; editable genome; hardGate pass. |
| `hp-clamp-bot` | `hp_enemy_clamp_repair_horror` | First candidate is `hp-official-proxy-hp_enemy_clamp_repair_horror`; low crab/clamp profile; editable genome; hardGate pass. |
| `hp-shield-tech` | `hp_enemy_shield_technician_horror` | First candidate is `hp-official-proxy-hp_enemy_shield_technician_horror`; physical tower-shield support profile; editable genome; hardGate pass. |
| `hp-custodian-foreman` | `hp_enemy_custodian_foreman_horror` | First candidate is `hp-official-proxy-hp_enemy_custodian_foreman_horror`; construction/tool foreman profile; editable genome; hardGate pass. |
| `hp-reclamation-mother` | `hp_enemy_reclamation_mother_final_horror` | First candidate is `hp-official-proxy-hp_enemy_reclamation_mother_final_horror`; boss guardian archive-core profile; editable genome; hardGate pass. |

Direct local UI links while the auto-rig dev server is running:

- `http://127.0.0.1:5187/?hpRobot=hp-repair-drone#robots`
- `http://127.0.0.1:5187/?hpRobot=hp-clamp-bot#robots`
- `http://127.0.0.1:5187/?hpRobot=hp-shield-tech#robots`
- `http://127.0.0.1:5187/?hpRobot=hp-custodian-foreman#robots`
- `http://127.0.0.1:5187/?hpRobot=hp-reclamation-mother#robots`

Full completion checklist for each robot:

1. Open the matching `hpRobot` URL. The UI must auto-load the official proxy as rank 1 and lock it as the identity parent.
2. Improve that locked prototype only: use evolve, color, sculpt, and polish controls while preserving the same `modelKey`, profile, body plan, and role-specific silhouette.
3. Confirm the selected branch still has editable genome, official prototype metadata, and hardGate pass in the candidate board.
4. Press `Save HP` and keep the downloaded handoff JSON as the only cross-repo transfer artifact.
5. Run the Human Protocol importer with `--export-glb`. The importer writes a candidate package under `src/assets/models-cooked/enemies/auto-rig-candidates/<modelKey>/<handoffId>/`.
6. Review `import-report.md` and `import-report.json`; require `exportGlbProduced=true`, `validationResult=pass`, `selected.hardGate=true`, and an empty `hardFailMask`.
7. Capture visual evidence from auto-rig and Human Protocol preview/browser. Compare against the current official GLB before considering replacement.
8. Only after candidate evidence is accepted, replace source/cooked GLBs through the normal asset pipeline, rebuild generated Raw WGPU manifests, run TypeScript/build/art/Raw QA, and commit provenance.

Current 2026-06-19 prototype-first evidence:

- Auto-rig smoke report: `exports/human-protocol-handoffs/hp-robots-2026-06-19T23-30-57-336Z/port-smoke-report.md`
- Candidate imports:
  - `src/assets/models-cooked/enemies/auto-rig-candidates/hp_enemy_repair_drone_horror/hp_enemy_repair_drone_horror-afe2d0f3/`
  - `src/assets/models-cooked/enemies/auto-rig-candidates/hp_enemy_clamp_repair_horror/hp_enemy_clamp_repair_horror-d2364c00/`
  - `src/assets/models-cooked/enemies/auto-rig-candidates/hp_enemy_shield_technician_horror/hp_enemy_shield_technician_horror-472cf234/`
  - `src/assets/models-cooked/enemies/auto-rig-candidates/hp_enemy_custodian_foreman_horror/hp_enemy_custodian_foreman_horror-2fdc796a/`
  - `src/assets/models-cooked/enemies/auto-rig-candidates/hp_enemy_reclamation_mother_final_horror/hp_enemy_reclamation_mother_final_horror-e987b3f3/`

These current candidates are import-ready evidence, not official replacements.

### Phase A: Report-only audit

Implement a script that reads the current five official/cooked GLBs, config entries, Raw WebGPU sidecars, and texture evidence. Output:

- `src/assets/manifests/reports/hp_enemy_robot_auto_rig_upgrade_audit.json`
- `src/assets/manifests/reports/hp_enemy_robot_auto_rig_upgrade_audit.md`

This phase must not change official GLBs, cooked GLBs, generated Raw JSON, or level references.

### Phase B: Candidate schema and review board evidence

Add a candidate directory only after the audit schema is stable:

```text
src/assets/models-cooked/enemies/auto-rig-candidates/
```

Each candidate needs:

- source blueprint JSON
- source Blender script or documented generator command
- candidate GLB
- texture/atlas evidence
- audit JSON/MD entry
- side-by-side screenshots/contact sheet
- replacement recommendation

### Phase C: Blender candidate generator

Use Human Protocol blueprints and deterministic Blender scripts. Auto-rig ideas should become bounded shape/material operators:

- drone pod split, thruster span, tool-arm length
- clamp jaw width, low chassis ratio, contact footprint
- shield plate scale, sensor stack height, support base width
- foreman tool-arm mass, workstation/forklift base, warning tower
- mother spine height, chamber width, asymmetric arm mix

### Phase D: Runtime replacement gate

Before replacing an official GLB:

1. Keep old file available through git history and preferably copy candidate provenance into reports.
2. Verify model key, clip names, material/texture evidence, and Raw sidecars.
3. Rebuild Raw WebGPU source outputs using existing scripts, never hand-edit generated JSON.
4. Run `git diff --check`.
5. Run `npx tsc -p tsconfig.app.json --noEmit`.
6. Run `npm run art:qa` and `npm run raw-webgpu:robot-animation:qa` when runtime-facing robot assets or animation bridge evidence changed.
7. Capture desktop/mobile screenshots or a focused robot preview/contact sheet before claiming visual readiness.

## First Implementation Slice

The first safe implementation slice is the audit/score script. It should:

- Parse GLB JSON chunks and report scenes, nodes, meshes, materials, textures, images, animations, material texture usage, and bounds where available.
- Read external texture file existence and file sizes.
- Read `enemyVisualProfiles.json`, `enemyModelAssets.ts`, `VisualProfile.ts`, and validator model-key whitelist evidence.
- Read Raw WebGPU sidecars for each model and summarize vertex count, triangle count, material count, node count, rigid skin mode, clip names, hidden-node rule counts, and level coverage.
- Emit role-specific score components with notes and replacement recommendations.

This gives the team a stable, game-native production line entrance: every future generator/polish pass can be judged by the same report before it touches official assets.
