# Level 01 Workcell Image2 Source Provenance

- Asset family: `hp_level01_workcell_image2_v1`
- License label: `owned-generated-output`
- Terms label: `openai-generated-output-user-owned-subject-to-openai-terms`
- Generation date: `2026-06-20`
- Tool: built-in `image_gen`
- Tool call id: `not-exposed-by-built-in-image_gen`
- Repo source: `src/assets/textures/environment/level01-workcell-image2/image2-sources/level01_workcell_image2_reference_board_v1.png`
- SHA-256: `599bfcfe5ab52d202d499ff4f19025e3bf73724fc3f9c067c3b392b3dd241364`
- Atlas: `src/assets/textures/environment/level01-workcell-image2/hp_level01_workcell_image2_atlas.png`
- Regions: `src/assets/textures/environment/level01-workcell-image2/hp_level01_workcell_image2_atlas.regions.json`
- Fixed-rect cuts: `src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts`

## Fixed Crop Regions

- `cart_dark_powdercoat` sourceRect=[15, 370, 106, 72] atlasRect=[0, 0, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/cart_dark_powdercoat.png` intent=dark gray powder-coated tool-cart body panels
- `worn_black_panel` sourceRect=[126, 370, 100, 72] atlasRect=[256, 0, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/worn_black_panel.png` intent=slightly used black industrial metal face
- `brushed_steel` sourceRect=[233, 370, 78, 72] atlasRect=[512, 0, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/brushed_steel.png` intent=brushed steel trim and hydraulic metal
- `safety_yellow` sourceRect=[393, 370, 83, 72] atlasRect=[768, 0, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/safety_yellow.png` intent=yellow caution paint, edge-worn
- `hazard_stripe` sourceRect=[482, 370, 78, 72] atlasRect=[0, 256, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/hazard_stripe.png` intent=yellow-black hazard striping for edges and lips
- `lift_white_enamel` sourceRect=[777, 370, 104, 72] atlasRect=[256, 256, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/lift_white_enamel.png` intent=off-white enamel maintenance panels
- `lift_scuffed_white` sourceRect=[887, 370, 86, 72] atlasRect=[512, 256, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/lift_scuffed_white.png` intent=used white repair-table rim panels
- `tool_pegboard` sourceRect=[126, 770, 94, 75] atlasRect=[768, 256, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/tool_pegboard.png` intent=white pegboard holes for wall-mounted tool panel
- `dark_tool_plate` sourceRect=[225, 770, 110, 75] atlasRect=[0, 512, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/dark_tool_plate.png` intent=dark tool tray / drawer insert
- `cyan_diagnostic_glass` sourceRect=[452, 770, 115, 75] atlasRect=[256, 512, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/cyan_diagnostic_glass.png` intent=small cyan diagnostic glass, restrained accent only
- `stainless_basin` sourceRect=[404, 865, 158, 155] atlasRect=[512, 512, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/stainless_basin.png` intent=stainless wash-basin bowl and rim
- `rubber_wheel_tread` sourceRect=[586, 1044, 118, 196] atlasRect=[768, 512, 256, 256] cut=`src/assets/textures/environment/level01-workcell-image2/fixed-rect-cuts/rubber_wheel_tread.png` intent=dark rubber wheel/tread material

## Prompt

```text
Use case: stylized-concept
Asset type: Human Protocol Level 1 industrial workcell Image2 material/reference board for game asset atlas source
Primary request: Create a single high-resolution material/reference board for five reusable maintenance bay furniture props: mobile repair tool cart, hydraulic lift repair table, wall-mounted tool board, prosthetic spare parts cabinet, sterile parts wash basin.
Scene/backdrop: clean robot-facility maintenance bay workcell reference board, orthographic product/material sheet, no perspective room scene.
Subject: five distinct industrial furniture/material regions arranged in a tidy grid, with surfaces and detail patches suitable for cropping into an atlas: dark gray industrial metal, white enamel maintenance panels, yellow-black hazard striping, small cyan-blue diagnostic glass/acrylic indicators, rubber wheels, hydraulic pistons, pegboard holes, sterile basin metal.
Style/medium: realistic-to-stylized game texture reference board, sharp PBR-like material details, low-poly-friendly, production asset source.
Composition/framing: square image, evenly spaced rectangular panels/regions, clear boundaries between material zones, enough margin for deterministic rectangular crops; no text labels.
Lighting/mood: neutral studio lighting, clean but used, subtle scuffs and edge wear, no grime piles.
Color palette: deep neutral grays, off-white enamel, safety yellow/black accents, restrained cyan-blue diagnostics only.
Materials/textures: brushed metal, powder coated metal, enamel panels, rubber, glass/acrylic, warning tape, pegboard, stainless basin, minor scratches.
Constraints: no text, no logos, no watermark, no human characters, no large cyan areas, no clutter, no trash, no UI, no transparent background required.
Avoid: muddy dirty junkyard look, organic shapes, excessive neon, fantasy/sci-fi weapons, readable writing.
```
