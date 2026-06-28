# Level 04 Memory Clinic Furniture v1 RAG Memory

Status: active repo-local asset memory, June 2026.

This file summarizes the reusable production memory for the Level 4 memory clinic furniture batch. Exact prompts and provenance remain in the linked JSON ledgers; this document is the human-readable retrieval card.

## Retrieval Tags

- `human-protocol`
- `asset-pipeline`
- `image2`
- `math-first`
- `builder-pack`
- `raw-webgpu`
- `level04`
- `memory-clinic`
- `medical-scifi`
- `escape-horror`
- `furniture`
- `puzzle-host`
- `mobile-readable`

## What To Reuse

- Premium sci-fi cinema hospital language: white ceramic, smoked titanium, frosted glass, medical cyan, blue upholstery, restrained lime accents.
- Gameplay-first furniture planning: every prop needs a role such as landmark, cover, puzzle host, narration, or exit guidance.
- Image2 master atlas plus cropped material sources, not one baked poster texture per object.
- Deterministic Blender generation with source `.blend`, named material slots, simple collision, and builder footprints.
- Raw WebGPU and builder thumbnails as acceptance evidence, not just GLB existence.

## Model Keys

- `hp_l4_cineclinic_decon_gate`
- `hp_l4_cineclinic_reception_counter`
- `hp_l4_cineclinic_waiting_sofa_row`
- `hp_l4_cineclinic_lime_ottoman`
- `hp_l4_cineclinic_side_table_planter`
- `hp_l4_cineclinic_triage_kiosk`
- `hp_l4_cineclinic_med_cabinet`
- `hp_l4_cineclinic_record_wall_cabinet`
- `hp_l4_cineclinic_exam_table`
- `hp_l4_cineclinic_memory_recliner`
- `hp_l4_cineclinic_scan_arch`
- `hp_l4_cineclinic_projection_pod`
- `hp_l4_cineclinic_rescue_speaker_panel`
- `hp_l4_cineclinic_cable_trolley`
- `hp_l4_cineclinic_observation_desk`
- `hp_l4_cineclinic_surgical_light`
- `hp_l4_cineclinic_monitor_arm`
- `hp_l4_cineclinic_privacy_screen`
- `hp_l4_cineclinic_sedation_gate`
- `hp_l4_cineclinic_theater_wall`

## Evidence Files

- promptLedger: `src/assets/manifests/reports/level04_memory_clinic_furniture_v1_prompt_ledger.json`
- provenance: `src/assets/manifests/reports/level04_memory_clinic_furniture_v1_source_provenance.json`
- runtimeManifest: `src/assets/manifests/runtime/human_protocol_level04_memory_clinic_furniture_v1.json`
- builderManifest: `src/assets/manifests/builder/hp_level04_memory_clinic_furniture_v1.json`
- mathReport: `src/assets/manifests/reports/level04_memory_clinic_furniture_v1_math_report.json`
- blenderReport: `src/assets/manifests/reports/level04_memory_clinic_furniture_v1_blender_report.json`
- masterAtlas: `src/assets/textures/environment/level04-memory-clinic-furniture-v1/image2-sources/level04_memory_clinic_furniture_v2_imagegen_material_atlas_master.png`
- atlas: `src/assets/textures/environment/level04-memory-clinic-furniture-v1/hp_level04_memory_clinic_furniture_v1_atlas.png`
- atlasRegions: `src/assets/textures/environment/level04-memory-clinic-furniture-v1/hp_level04_memory_clinic_furniture_v1_atlas.regions.json`
- modelDirectory: `src/assets/models-cooked/environment/level04-memory-clinic-furniture-v1`
- sourceBlendDirectory: `src/assets/source_blend/level04-memory-clinic-furniture-v1`
- thumbnails: `src/assets/thumbnails/builder/hp-level04-memory-clinic-furniture-v1`

## JSONL Cards

Machine-readable cards: `src/assets/manifests/reports/asset-rag-memory/level04-memory-clinic-furniture-v1.jsonl`

## Gaps / Notes

- Built-in image generation did not expose a separate API call id; the generated image id from the saved source path is recorded where available.
- User reference screenshots are recorded as local art-direction references only and are not redistributed as texture sources.
- Future batches should add cards immediately after provenance + QA, before the next asset batch starts.
