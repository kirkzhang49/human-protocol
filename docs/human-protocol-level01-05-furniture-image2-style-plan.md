# Human Protocol Level 01-05 Furniture Image2 Style Plan

Date: 2026-06-13

Use this plan with `docs/human-protocol-puzzle-image2-assert-workflow.md`: Image2 provides sketches, material parts, and atlas regions; Blender/math owns the furniture silhouette and WebGPU-ready geometry.

## Shared Rules

- No baked UI instructions, no readable labels, no logos.
- React/config owns live text and state. GLB owns physical form.
- Each level gets a sketch board and one source atlas direction.
- Atlas regions should become small material/part cuts: glass, screws, rails, edge wear, panels, fabric, rubber, grime, vents, sockets.
- Furniture must be readable from builder iso view and first-person 2-3m view.

## Level 01 - Maintenance Bay

Style: cold repair object facility, white enamel metal, brushed steel, black rubber, cyan diagnostics, tiny amber hazard marks.

Furniture targets:

- repair workbench
- wall parts cabinet
- battery cart
- diagnostic locker
- folded gurney
- service stool
- floor utility crate
- ceiling service light

Image2 board:

`docs/art/level-furniture-image2/level01-maintenance-bay-furniture-image2-board.png`

Atlas cuts:

- enamel panel tile
- brushed steel strip
- cyan glass lens
- rubber gasket
- hazard edge strip
- screw heads
- vent grille
- grime corner
- edge wear

## Level 02 - Residential Simulation

Style: false comfort under surveillance, warm laminate, cream upholstery, soft yellow lamps, hidden cyan scanners, domestic shapes with facility seams.

Furniture targets:

- modular sofa
- dining table with observation slots
- nursery bed with clinical rails
- family portrait console
- kitchen counter with service panel
- wardrobe scanner
- camera lamp
- end-room elevator furniture

Image2 board:

`docs/art/level-furniture-image2/level02-residential-simulation-furniture-image2-board.png`

Atlas cuts:

- laminate wood
- cream upholstery
- old beige plastic
- warm lamp glass
- brass edge trim
- cyan scanner strip
- tiny camera lens
- stitched fabric patch
- fake wallpaper fragment

## Level 03 - Human Museum

Style: exhibit horror, smoked glass, black enamel plinths, aged brass, amber exhibit lighting, archive drawers, controlled viewing rails.

Furniture targets:

- glass display plinth
- archive card cabinet
- mural lightbox frame
- specimen bench
- industrial velvet queue rail
- evidence round table
- museum label terminal with no text
- preservation case with robotic clamps

Image2 board:

`docs/art/level-furniture-image2/level03-human-museum-furniture-image2-board.png`

Atlas cuts:

- smoked display glass
- black enamel plinth panel
- aged brass frame strip
- cyan scanner strip
- amber exhibit lamp glass
- dark velvet strip
- archive drawer front
- glass glare mask
- dust/grime mask
- blank floor plaque

## Level 04 - Memory Clinic

Style: treatment-as-editing, frosted medical glass, white ceramic enamel, pale blue sterile plastic, stainless rails, soft cyan screens.

Furniture targets:

- reclining treatment chair
- memory scan arch
- therapy console
- medicine cabinet
- observation desk
- record cabinet
- surgical light
- neural cable trolley

Image2 board:

`docs/art/level-furniture-image2/level04-memory-clinic-furniture-image2-board.png`

Atlas cuts:

- frosted medical glass
- white ceramic panel
- pale blue plastic
- stainless rail
- cyan screen glass
- memory vial glass
- restraint strap fabric
- rubber cable loop
- sterile gasket
- circular sensor

## Level 05 - Reclamation Core

Style: identity archive pressure, dark graphite powdercoat, black recesses, aged brass rails, copper bus bars, amber archive glass, cyan identity scanners.

Furniture targets:

- archive server column
- identity capsule cabinet
- data spine rack
- biometric filing throne
- retrieval conveyor table
- lockbox pedestal
- core memory altar
- heavy archive elevator door
- route key pedestal

Image2 board:

`docs/art/level-furniture-image2/level05-reclamation-core-furniture-image2-board.png`

Atlas cuts:

- graphite powdercoat
- black recess plate
- aged brass rail
- copper bus bar
- amber archive glass
- cyan identity scan strip
- white identity ceramic plate
- rubber cable socket
- drawer front
- edge wear
- circular core lens

## Next Production Step

For each level:

1. Slice the board into source PNGs under `src/assets/textures/environment/level0X-furniture/image2-sources/`.
2. Pack one atlas PNG + `.regions.json`.
3. Generate Blender furniture GLBs with named parts and UVed atlas cuts.
4. Register model keys in the asset catalog/import map.
5. Add bounds/thumbnail checks and browser screenshots before claiming finished.
