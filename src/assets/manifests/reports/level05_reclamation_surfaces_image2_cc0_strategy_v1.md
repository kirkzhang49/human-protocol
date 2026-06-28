# Level 05 Surface Strategy: Image2 vs CC0

- Generated: `2026-06-27`
- Scope: Level 5 floor, wall, ceiling surfaces for the new v3 furniture set.
- Recommendation: use a dedicated Image2 surface pack first; use CC0 only as a separately audited fallback.

## Current State

Level 5 already has builder surface presets, but it does not yet have a complete Level 5 v3 surface evidence chain matching the new furniture language.

- Core rooms mostly use `floor_reclamation_core_metal`, `wall_reclamation_core_panel`, and a ceiling that often reuses the wall preset.
- Entry/east rooms reuse Level 1 maintenance Image2/facility presets.
- Archive room reuses memory-clinic presets.
- `level_05_platform` has an older room-id runtime Image2 floor hook in `human_protocol_hero_floor_image2_ingested_manifest.json`, but this is not a full builder floor/wall/ceiling pack.

## Preferred Image2 Pass

Create three new builder presets:

- `floor_level05_reclamation_core_image2_v3`
- `wall_level05_reclamation_core_image2_v3`
- `ceiling_level05_reclamation_core_image2_v3`

Use the same art vocabulary as the furniture: graphite panels, white ceramic shells, black ribbed gasket/pad details, aged brass seams, cyan glass lenses, and small red warning accents only where meaningful.

Evidence required: prompt ledger, copied source PNGs, generated cache/tool id when exposed, license label, classification, color/normal/rough runtime maps, builder preset wiring, official builder room references, Raw WebGPU compile, and browser/viewer screenshot.

## CC0 Alternative

CC0 is allowed only after source audit. For each material candidate, record source URL, author/publisher, license page, commercial-use/modification/redistribution status, local raw archive, adapted output path, and risk notes.

Right now I did not import new CC0 for Level 5 surfaces. The risk is aesthetic as much as legal: generic metal/concrete scans can make the custom Image2 furniture look pasted into a stock room unless the CC0 sources are heavily art-directed.
