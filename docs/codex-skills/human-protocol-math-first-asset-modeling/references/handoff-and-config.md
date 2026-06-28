# Handoff And Config

## Repo Roles

Use WGPU Robot Lab as the asset lab when the user wants to preview, evolve, compare, or build reusable IP assets. Use Human Protocol for game-ready config integration, official level layouts, validators, smoke tests, and runtime behavior.

Do not assume both repos should change. Cross-repo work needs explicit user intent or a handoff document.

## Human Protocol Integration Checklist

For each new asset family:

1. Put GLBs under the appropriate `src/assets/models/...` folder.
2. Put texture PNGs under `src/assets/textures/...` and keep source atlases if relevant.
3. Put `.blend` sources under `src/assets/source_blend/...` if future Blender polish matters.
4. Add or update a manifest under `src/assets/manifests`.
5. Register model keys in asset imports/resolvers.
6. Add validator coverage for new model/visual keys.
7. Reference assets through level config or reusable room kits.
8. Run QA: `git diff --check`, config/art QA, build, and campaign smoke when progression may be affected.

## Room Kit Pattern

Create reusable room kits as named presets, not locked one-off rooms:

- `maintenance_combat_bay_v1`
- `cyan_lockdown_arena_v1`
- `residential_simulation_false_home_v1`
- `memory_clinic_observation_v1`
- `reclamation_core_platform_v1`

Kit configs should describe reusable pieces:

- floor family
- ceiling family
- wall family
- door family
- lighting preset
- prop set
- pickup layout
- spawn layout
- allowed state colors
- optional decals or story screens

## Robot Profile Pattern

Keep robot visuals curated:

- `repair_drone`: small, slim flying frame, horizontal probe arms, no floor base while flying.
- `clamp_bot`: short, wider ground repair enemy, low center of gravity.
- `shield_tech`: calm service-device posture, readable shield/utility silhouette.
- `custodian_foreman`: maintenance supervisor pressure, tool hammer/arm as threat.
- `reclamation_mother`: final large machine, stronger silhouette but still Human Protocol facility language.

Enemy config may tune tier, core color, warning color, scale, hit reaction cadence, and light intensity. It should not randomize every limb or material.

## Handoff Notes

When handing assets to another Human Protocol agent, include:

- exact model keys and file paths
- intended scale and placement
- material slots and texture sources
- collision proxy recommendation
- config keys to use
- dynamic content rules
- validation commands already run
- known visual risks or pending browser review
