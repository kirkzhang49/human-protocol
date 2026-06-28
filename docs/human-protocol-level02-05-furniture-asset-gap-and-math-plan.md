# Human Protocol Level 02-05 Furniture Asset Gap And Math Plan

Date: 2026-06-03

## Goal

Build Human Protocol room furniture as reusable, config-addressable assets instead of one-off scene decorations. The immediate implementation target is Level 02, because it already has the clearest gameplay rooms: recovery foyer, central combat living room, boss side room, and three-color light-control room.

The rule for this pass is math-first:

- Search before rendering.
- Use 50,000 design families and 5,000,000 candidates per Level 02 furniture asset.
- Write the winning candidate and top alternatives into a manifest.
- Generate GLB files from the winning parameters.
- Register each asset with a stable `modelKey`.
- Place Level 02 furniture through `map.props`, so future config or LLM-authored rooms can reuse the same kit.

## Existing References Found

The repo already has a first pass of asset math refinement:

- `scripts/optimizer/math-polish-assets-v1.mjs`
- `src/assets/manifests/reports/human_protocol_asset_math_polish_v1_report.json`
- `docs/human-protocol-agent-native-asset-lab-vnext.md`

That pass uses the same research direction requested here:

- typed part programs
- hard constraints before soft art scoring
- silhouette/support/contact/material/readability/repairability scores
- machine-readable reports
- deterministic candidate search

The pass also cites these external notes as design sources:

- `/Users/zhengkaizhang/Downloads/面向 Agent 的程序化与精确建模游戏引擎研究报告.pdf`
- `/Users/zhengkaizhang/.codex/attachments/b996d584-12e0-4e05-8d69-bff6bff0620f/pasted-text.txt`

## Furniture Objective V1

The Level 02 furniture objective extends the previous furniture scoring with room-specific constraints:

- `premiumSilhouetteScore`: size, proportion, negative space, non-toy scale.
- `contactShadowProxyScore`: feet, plinths, floor footprint, no floating feel.
- `affordanceReadabilityScore`: sofa, table, lamp, closet, dock, photo wall, and control panel should read instantly in first person.
- `roomLightHarmonyScore`: muted residential/maintenance palette should work under cyan gray Level 01/02 lighting.
- `pbrMaterialScore`: metalness, roughness, controlled emissive, fabric softness, and glass/edge response.
- `combatLayoutFitScore`: assets must create cover and room identity without blocking critical paths.
- `storyRoleScore`: Level 02 must feel like a fake home built inside a maintenance facility.
- `panelLayeringScore`: bevels, frame depth, rails, drawers, vents, seams, and nested surfaces should give premium hard-surface depth.

Penalties:

- `overEmissivePenalty`: bright parts cannot become white blocks.
- `redConflictPenalty`: red is reserved for locked/danger states and cannot dominate furniture.
- `clutterPenalty`: detail cannot become noisy stickers.
- `pathBlockPenalty`: oversized furniture cannot break combat navigation.
- `toyScalePenalty`: furniture cannot feel like small props scattered on a floor.
- `flatBoxPenalty`: simple rectangular blocks without layered construction are rejected.

## Level 02 First-Batch Assets

These are the assets to generate and register first.

| modelKey | Room Use | Purpose |
| --- | --- | --- |
| `room_lounge_sofa_residential` | Recovery foyer, living room | Fake-home silhouette, readable cover, low warm contrast. |
| `room_lounge_low_table_residential` | Recovery foyer, living room | Low table/cover with embedded service tray and cyan edge. |
| `room_fake_family_photo_wall` | Recovery foyer, living room | Human absence clue; photo frames are abstract and runtime-safe, no baked puzzle answer. |
| `room_residential_rug_panel` | Foyer and central combat lane | Floor identity layer, breaks flat grid, adds reflective low-angle composition. |
| `light_residential_lamp_warm` | Light-control room | Warm puzzle lamp body, physical hit target visual. |
| `light_residential_lamp_white` | Light-control room | White puzzle lamp body, physical hit target visual. |
| `light_residential_lamp_blue` | Light-control room | Blue puzzle lamp body, physical hit target visual. |
| `terminal_family_light_control_pedestal` | Light-control room | Three-color sequence control furniture, not the answer itself. |
| `room_carekeeper_service_closet` | Boss room | Tall service closet with residential face and exposed maintenance core. |
| `room_service_robot_dock_residential` | Boss room, living room edges | Dock/charging furniture that sells robot maintenance presence. |

## Level 02 Layout Intent

Recovery foyer:

- Put the sofa, low table, rug panel, and photo wall near the start.
- Make it readable as a rest space, but too artificial to feel safe.
- Keep repair kits visible and physically unobstructed.

Central living combat room:

- Use the rug panel and low table as visual floor anchors.
- Add sofa/dock clusters near side lanes for cover and story.
- Keep the center open enough for endless robot waves.
- Avoid old generic crates as the primary identity.

Boss side room:

- Add service closet and robot dock near walls.
- Leave the boss spawn/key drop readable.
- Make the room feel like the hidden machinery behind the fake home.

Light-control room:

- Replace generic switch cubes with three physical lamp assets.
- Add a pedestal so the color puzzle feels like room equipment, not a debug target.
- Keep all three targets visible from the entrance and reachable by weapon hit.

## Level 03-05 Missing Furniture Families

These are not all generated in this first pass, but should use the same objective and report structure.

Level 03 Human Museum:

- `room_museum_display_case_human_scale`
- `room_museum_hologram_plinth`
- `room_museum_archive_server_wall`
- `room_museum_voice_speaker_array`
- `room_museum_body_reference_case`
- `room_museum_rail_lightbox`

Level 04 Memory Clinic:

- `room_clinic_reception_counter`
- `room_clinic_waiting_bench`
- `room_clinic_therapy_chair`
- `room_clinic_monitor_arm_cluster`
- `room_clinic_sedation_tower`
- `room_clinic_theater_stage_wall`

Level 05 Reclamation Core:

- `room_core_lock_status_pylon`
- `room_core_brake_clamp`
- `room_core_energy_generator`
- `room_core_reclamation_chamber`
- `room_core_platform_dais`
- `room_core_mother_dock_frame`
- `room_core_identity_file_capsule`

## Config Reuse Contract

Each generated asset must have:

- stable `modelKey`
- GLB under `src/assets/models/environment/level02/` for this pass
- source Blender file under `src/assets/source_blend/level02/`
- manifest entry with winner score and candidate parameters
- dimensions in `environmentModelAssets.ts`
- validator entry in `ConfigValidator.ts`
- optional prop-set entry in `roomPresentationKits.json`
- placement only through `map.props` in official level config

Do not bake puzzle answers, room numbers, or irreversible story text into these models. The physical object can imply purpose; the specific sequence and objective remain in config.
