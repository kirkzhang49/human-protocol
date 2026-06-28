# Level 4 Memory Clinic Surfaces Image2 Prompt Ledger v4

Asset family: `level04_memory_clinic_surfaces_image2_tileable_v4`

Generation date: 2026-06-26
Tool path: Codex built-in `image_gen` / Image2
Call id: `not-exposed-by-built-in-imagegen`
License label: `owned-generated-output`

This v4 set supersedes earlier v1/v3 surface candidates for runtime surface work.
The v1 set looked too procedural/CAD-like. The v3 set had stronger Image2 scene
quality but used perspective source-painting compositions, so it is not suitable
for direct wall/floor/ceiling tiling. v4 is explicitly prompted as square,
orthographic, seamless/tileable material source art.

## Runtime Build Integration

Integrated on 2026-06-26 as `/build` selectable surface presets:

- Floor preset: `floor_level04_memory_clinic_lab_image2_tileable_v4`
- Wall preset: `wall_level04_memory_clinic_lab_image2_tileable_v4`
- Ceiling preset: `ceiling_level04_memory_clinic_lab_image2_tileable_v4`

Source PNGs remain in `src/assets/textures/environment/level04-memory-clinic-surfaces/image2-candidates/`.
Runtime Build imports use optimized JPG derivatives in `src/assets/textures/environment/builder-surfaces/`.

## Wall

- Asset id: `memory_clinic_wall_tileable_image2_candidate_v4`
- Source image: `/Users/zhengkaizhang/.codex/generated_images/019efce3-bb6a-7520-993e-0d7a650e2685/ig_0b066e4447f4346b016a3eedb93a84819487ffc62aa2f97a2a.png`
- Project output: `src/assets/textures/environment/level04-memory-clinic-surfaces/image2-candidates/memory_clinic_wall_tileable_image2_candidate_v4.png`
- Prompt:

```text
Use case: stylized-concept
Asset type: seamless tileable Image2 base-color material texture for Human Protocol Level 4 memory clinic walls.
Primary request: Create a square seamless tileable wall albedo texture that can repeat across 3D room walls without visible borders.
Subject: pale off-white memory clinic wall material: ceramic medical panels, frosted cyan diagnostic seams, small brushed titanium service strips, tiny amber service light accents, screw heads, hairline cracks, fingerprints, dust, grime in seams, subtle uneven glaze.
Style/medium: high-end AI-generated game material art, realistic painterly sci-fi clinic surface, clearly generated bitmap source art rather than procedural noise.
Composition/framing: perfectly orthographic flat material texture, seamless on all four edges, no perspective, no horizon, no objects, no text, no symbols, no labels. Include enough mid-size panel variation to avoid a boring grid, but make the left/right and top/bottom edges tile cleanly.
Lighting/mood: neutral baked albedo feel with very soft ambient light, no strong directional shadows, no cast shadows.
Color palette: warm off-white ceramic, cool blue-grey grime, cyan glow accents, tiny muted amber indicators.
Materials/textures: satin ceramic glaze, frosted translucent cyan strips, brushed metal seams, micro scratches, worn screw rings.
Constraints: must be seamless/tileable, no hard border frame, no room perspective, no black void, no logo, no watermark, no readable text, no CAD/vector look, no perfect mechanical repetition.
```

## Floor

- Asset id: `memory_clinic_floor_tileable_image2_candidate_v4`
- Source image: `/Users/zhengkaizhang/.codex/generated_images/019efce3-bb6a-7520-993e-0d7a650e2685/ig_0b066e4447f4346b016a3eee19ba988194a2d455453ffff31b.png`
- Project output: `src/assets/textures/environment/level04-memory-clinic-surfaces/image2-candidates/memory_clinic_floor_tileable_image2_candidate_v4.png`
- Prompt:

```text
Use case: stylized-concept
Asset type: seamless tileable Image2 base-color material texture for Human Protocol Level 4 memory clinic floors.
Primary request: Create a square seamless tileable floor albedo texture that can repeat across 3D room floors without visible borders.
Subject: pale memory clinic floor material: off-white resin-coated composite slabs, frosted cyan guidance grooves embedded under resin, brushed metal seam rails, small circular service ports, faint machine-wheel scuffs, micro scratches, grime in seams, worn panel corners, subtle wet-cleaned streaks.
Style/medium: high-end AI-generated game material art, realistic painterly sci-fi clinic floor surface, clearly generated bitmap source art rather than procedural noise.
Composition/framing: perfectly orthographic flat floor material texture, seamless on all four edges, no perspective, no horizon, no objects, no text, no symbols, no labels. Design panel seams so the left/right and top/bottom edges tile cleanly.
Lighting/mood: neutral baked albedo feel with soft ambient illumination, no strong directional shadows, no cast shadows.
Color palette: pale graphite-white flooring, cool blue-grey seams, cyan underglow strips, tiny muted amber service dots.
Materials/textures: resin coating, ceramic composite slabs, brushed metal rails, translucent cyan groove covers, fine dust, scratches, subtle stains.
Constraints: must be seamless/tileable, no hard border frame, no room perspective, no black void, no logo, no watermark, no readable text, no CAD/vector look, no perfect mechanical repetition.
```

## Ceiling

- Asset id: `memory_clinic_ceiling_tileable_image2_candidate_v4`
- Source image: `/Users/zhengkaizhang/.codex/generated_images/019efce3-bb6a-7520-993e-0d7a650e2685/ig_0b066e4447f4346b016a3eee70b4388194a5dddd4a29ec5f6f.png`
- Project output: `src/assets/textures/environment/level04-memory-clinic-surfaces/image2-candidates/memory_clinic_ceiling_tileable_image2_candidate_v4.png`
- Prompt:

```text
Use case: stylized-concept
Asset type: seamless tileable Image2 base-color material texture for Human Protocol Level 4 memory clinic ceilings.
Primary request: Create a square seamless tileable ceiling albedo texture that can repeat across 3D room ceilings without visible borders.
Subject: pale memory clinic ceiling material: off-white modular ceiling panels, recessed cyan light strips, narrow vents, brushed aluminum access hatches, small screw plates, frosted diagnostic conduits, faint condensation marks, dust in recesses, subtle cracks and maintenance grime.
Style/medium: high-end AI-generated game material art, realistic painterly sci-fi clinic ceiling surface, clearly generated bitmap source art rather than procedural noise.
Composition/framing: perfectly orthographic flat ceiling material texture, seamless on all four edges, no perspective, no horizon, no objects, no text, no symbols, no labels. Arrange panels and light strips so all four borders tile cleanly.
Lighting/mood: neutral baked albedo feel, soft self-lit cyan strips, no cast shadows, no strong directional lighting.
Color palette: off-white ceiling panels, muted grey rails, cyan light strip accents, tiny dim amber maintenance indicators.
Materials/textures: satin ceramic coating, brushed metal rails, translucent light diffusers, vent perforations, screw heads, grime in seams.
Constraints: must be seamless/tileable, no hard border frame, no room perspective, no black void, no logo, no watermark, no readable text, no CAD/vector look, no perfect mechanical repetition.
```
