# HP Enemy Robot Auto-Rig Upgrade Audit

Generated: 2026-06-19T21:58:35.533Z

This is a report-only audit for the five Human Protocol enemy robot GLBs. It adapts the auto-rig-3d habit of hard gates, visual evidence, material scoring, and proxy/candidate reporting, but it does not replace official assets.

## Summary

- Robots audited: 5
- Average readiness: 0.912
- Recommendation counts: candidate_generation_ready=5

| robot | modelKey | overall | silhouette | contact | material | emissive | texture | runtime | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| repair_drone | `hp_enemy_repair_drone_horror` | 0.927 | 0.997 | 1.000 | 0.750 | 0.917 | 0.900 | 1.000 | candidate_generation_ready |
| clamp_bot | `hp_enemy_clamp_repair_horror` | 0.928 | 1.000 | 1.000 | 0.750 | 0.917 | 0.900 | 1.000 | candidate_generation_ready |
| shield_tech | `hp_enemy_shield_technician_horror` | 0.924 | 0.978 | 1.000 | 0.750 | 0.917 | 0.900 | 1.000 | candidate_generation_ready |
| custodian_foreman | `hp_enemy_custodian_foreman_horror` | 0.894 | 0.832 | 1.000 | 0.750 | 0.883 | 0.900 | 1.000 | candidate_generation_ready |
| reclamation_mother | `hp_enemy_reclamation_mother_final_horror` | 0.887 | 0.790 | 1.000 | 0.750 | 0.883 | 0.900 | 1.000 | candidate_generation_ready |

## Robot Details

### repair_drone / `hp_enemy_repair_drone_horror`

- Role: small flying repair/medical drone
- Source GLB: `src/assets/models/enemies/hp_enemy_repair_drone_horror.glb` (829 KB)
- Cooked GLB: `src/assets/models-cooked/enemies/hp_enemy_repair_drone_horror.glb` (576 KB)
- Textures: atlas yes, emissive yes
- Cooked GLB: 74 nodes, 31 meshes, 3 materials, 2 images, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Bounds: 0.920 x 1.498 x 0.948; node names: 29/29 named
- Raw representative: level_05_reclamation_core, 65196 vertices, 21732 triangles, 18 node chunks, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Blockers: none
- Runtime-normalized size estimate: 0.811w x 1.320h x 0.835d meters.
- Cooked GLB uses generic PaletteMaterial names; next candidate should expose stable Human Protocol material slots.
- GLB has embedded palette images and external atlas/emissive files exist; visual visibility still needs screenshot evidence.
- Raw WebGPU representative uses rigid-node-palette with 72 joints.
- RawRobotAnimationBridge has model-specific readability overrides; new candidates should reduce exact mesh-name dependence.
- Drone audit treats hover-centered geometry as good; official QA must still check there is no visible fake floor base.

### clamp_bot / `hp_enemy_clamp_repair_horror`

- Role: low ground clamp repair robot
- Source GLB: `src/assets/models/enemies/hp_enemy_clamp_repair_horror.glb` (1.0 MB)
- Cooked GLB: `src/assets/models-cooked/enemies/hp_enemy_clamp_repair_horror.glb` (645 KB)
- Textures: atlas yes, emissive yes
- Cooked GLB: 142 nodes, 65 meshes, 3 materials, 2 images, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Bounds: 1.570 x 1.790 x 1.201; node names: 31/31 named
- Raw representative: level_05_reclamation_core, 76548 vertices, 25516 triangles, 33 node chunks, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Blockers: none
- Runtime-normalized size estimate: 1.245w x 1.420h x 0.953d meters.
- Cooked GLB uses generic PaletteMaterial names; next candidate should expose stable Human Protocol material slots.
- GLB has embedded palette images and external atlas/emissive files exist; visual visibility still needs screenshot evidence.
- Raw WebGPU representative uses rigid-node-palette with 140 joints.
- RawRobotAnimationBridge has model-specific readability overrides; new candidates should reduce exact mesh-name dependence.

### shield_tech / `hp_enemy_shield_technician_horror`

- Role: taller support/archive shield technician
- Source GLB: `src/assets/models/enemies/hp_enemy_shield_technician_horror.glb` (1.0 MB)
- Cooked GLB: `src/assets/models-cooked/enemies/hp_enemy_shield_technician_horror.glb` (640 KB)
- Textures: atlas yes, emissive yes
- Cooked GLB: 142 nodes, 65 meshes, 3 materials, 2 images, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Bounds: 2.195 x 3.560 x 1.313; node names: 31/31 named
- Raw representative: level_05_reclamation_core, 76584 vertices, 25528 triangles, 33 node chunks, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Blockers: none
- Runtime-normalized size estimate: 0.999w x 1.620h x 0.598d meters.
- Cooked GLB uses generic PaletteMaterial names; next candidate should expose stable Human Protocol material slots.
- GLB has embedded palette images and external atlas/emissive files exist; visual visibility still needs screenshot evidence.
- Raw WebGPU representative uses rigid-node-palette with 140 joints.
- RawRobotAnimationBridge has model-specific readability overrides; new candidates should reduce exact mesh-name dependence.

### custodian_foreman / `hp_enemy_custodian_foreman_horror`

- Role: maintenance supervisor / ordinary boss platform
- Source GLB: `src/assets/models/enemies/hp_enemy_custodian_foreman_horror.glb` (1.1 MB)
- Cooked GLB: `src/assets/models-cooked/enemies/hp_enemy_custodian_foreman_horror.glb` (703 KB)
- Textures: atlas yes, emissive yes
- Cooked GLB: 144 nodes, 66 meshes, 3 materials, 2 images, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Bounds: 4.292 x 3.398 x 2.901; node names: 32/32 named
- Raw representative: level_05_reclamation_core, 85032 vertices, 28344 triangles, 33 node chunks, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Blockers: none
- Runtime-normalized size estimate: 3.347w x 2.650h x 2.262d meters.
- Cooked GLB uses generic PaletteMaterial names; next candidate should expose stable Human Protocol material slots.
- GLB has embedded palette images and external atlas/emissive files exist; visual visibility still needs screenshot evidence.
- Raw WebGPU representative uses rigid-node-palette with 142 joints.
- RawRobotAnimationBridge has model-specific readability overrides; new candidates should reduce exact mesh-name dependence.

### reclamation_mother / `hp_enemy_reclamation_mother_final_horror`

- Role: Level 05 final reclamation core boss
- Source GLB: `src/assets/models/enemies/hp_enemy_reclamation_mother_final_horror.glb` (1.1 MB)
- Cooked GLB: `src/assets/models-cooked/enemies/hp_enemy_reclamation_mother_final_horror.glb` (711 KB)
- Textures: atlas yes, emissive yes
- Cooked GLB: 144 nodes, 66 meshes, 3 materials, 2 images, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Bounds: 5.926 x 4.750 x 4.046; node names: 32/32 named
- Raw representative: level_05_reclamation_core, 85608 vertices, 28536 triangles, 33 node chunks, clips idle, move, attack_windup, attack_strike, attack_recover, hit_light, hit_heavy, stagger, death, spawn_boot
- Blockers: none
- Runtime-normalized size estimate: 3.805w x 3.050h x 2.598d meters.
- Cooked GLB uses generic PaletteMaterial names; next candidate should expose stable Human Protocol material slots.
- GLB has embedded palette images and external atlas/emissive files exist; visual visibility still needs screenshot evidence.
- Raw WebGPU representative uses rigid-node-palette with 142 joints.
- RawRobotAnimationBridge has model-specific readability overrides; new candidates should reduce exact mesh-name dependence.
- Final boss must remain distinct from custodian foreman; future compare pass should include foreman-vs-mother silhouette distance.
- Model key is present in JSON profile but not direct VisualProfile.ts fallback; JSON/config path should remain authoritative.

## Next Steps

1. Use this audit as the baseline before generating any candidate GLB.
2. Put candidates under `src/assets/models-cooked/enemies/auto-rig-candidates/` with source scripts and evidence.
3. Do not patch generated Raw WebGPU JSON by hand; rebuild it from source if a candidate is promoted.
4. Before official replacement, run `git diff --check`, `npx tsc -p tsconfig.app.json --noEmit`, relevant art/Raw QA, and capture visual evidence.

