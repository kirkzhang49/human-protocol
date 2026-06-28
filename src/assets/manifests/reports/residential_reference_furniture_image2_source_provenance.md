# Residential Reference Furniture Image2 Source Provenance

Recorded: 2026-06-19
Generating account: `kirkzhang49@gmail.com`
Generation date: 2026-06-19

This ledger records the prompt, source image, license status, reference inputs,
and derivative processing for the reusable residential reference furniture
material textures.

## Source Status

- Asset pack/runtime manifest: `human_protocol_environment_asset_factory_residential_reference_v1`
- Texture report: `src/assets/manifests/reports/residential_reference_furniture_image2_texture_report.json`
- Machine-readable ledger: `src/assets/manifests/reports/residential_reference_furniture_image2_source_provenance.json`
- Source image directory: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/`
- Packed tile directory: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/`
- Atlas: `src/assets/textures/environment/residential-reference-furniture-image2/hp_residential_reference_image2_atlas.png`
- Contact sheet: `src/assets/textures/environment/residential-reference-furniture-image2/hp_residential_reference_image2_contact_sheet.png`

## License Record

The texture sources are OpenAI image-generation outputs made inside the
Codex/OpenAI workflow for this project. Based on OpenAI Terms of Use and
OpenAI Services Agreement checked on 2026-06-19, the project record treats
the outputs as user/customer-owned generated output, subject to OpenAI terms,
the user's responsibility for inputs, and normal project legal review.

References checked:

- OpenAI Terms of Use, effective 2026-01-01: https://openai.com/policies/row-terms-of-use/
- OpenAI Services Agreement: https://openai.com/policies/services-agreement/
- Repo terms pointer: `docs/provenance/openai-imagegen-terms-2026-06-19.md`

License label used in manifests:

```text
openai-generated-output-user-owned-subject-to-openai-terms
```

License classification:

```text
owned-generated-output
```

Release clearance status:

```text
cleared-for-project-use-call-id-not-exposed
```

Reason: these are low-risk generic residential material swatches, not
third-party stock texture packs. The source PNGs, prompts, references, and
derivative outputs are archived in repo, and the generating account/date are
recorded above. The built-in image tool did not expose generation call IDs, so
the ledger records that field as unavailable rather than treating the material
as an unknown-license asset.

These are not third-party stock texture packs. The two user-provided furniture
screenshots were used only as high-level art direction references and are not
redistributed as source textures.

## Reference Inputs

| Input | Use | Build inclusion |
| --- | --- | --- |
| `/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 2.53.26 PM.png` | High-level residential showroom direction: rounded coffee tables, warm stone, walnut/oak, ivory upholstery, restrained staging | Not included |
| `/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 2.53.52 PM.png` | High-level residential furniture direction: fluted sideboards, entry benches, room-divider shelves, clean model-home lighting | Not included |

## Source Images And Prompts

### `warm_walnut_ribbed`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/warm_walnut_ribbed.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-f7e5c9fe-3150-4b3e-824e-0e8784e19819.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/warm_walnut_ribbed.png`
- Used by: walnut ribs, pedestals, sideboard bodies, dark walnut accents.

```text
Use case: stylized-concept
Asset type: seamless-ish game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square warm walnut ribbed wood material texture inspired by high-end residential showroom coffee tables and fluted sideboards. It must be a usable bitmap texture, not a render of furniture.
Input images: The two attached user screenshots are style references for warm residential furniture, rounded coffee tables, fluted wood, ivory upholstery, pale oak, warm stone, and clean staged showroom lighting.
Subject: warm walnut wood with subtle vertical ribbed/fluted grain, mild natural color variation, tasteful residential furniture finish.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile material, premium furniture catalog quality, warm brown walnut, clean but not plastic, fine wood pores and ribs.
Avoid: furniture objects, room scene, text, labels, borders, icons, people, shadows cast by objects, sci-fi panels, cyan lights, cameras, logos, watermark, seams that look like a grid.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `pale_oak_slats`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/pale_oak_slats.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-ab15f2d0-54e2-4b4a-96ec-e707d3172f15.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/pale_oak_slats.png`
- Used by: pale oak slats, entry panels, closet frames.

```text
Use case: stylized-concept
Asset type: seamless-ish game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square pale oak vertical slat material texture inspired by warm entry benches, built-in closets, and light oak residential storage furniture. It must be a usable bitmap texture, not a render of furniture.
Input images: The two attached user screenshots are style references for warm residential furniture, pale oak slats, clean showroom lighting, soft residential staging.
Subject: pale oak laminate / light natural oak with thin vertical slat rhythm, subtle grain, warm beige-gold undertone.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile material, premium furniture catalog quality, clean residential warmth, slightly over-regular but not sci-fi.
Avoid: furniture objects, room scene, text, labels, borders, icons, people, shadows cast by objects, cyan lights, cameras, logos, watermark, obvious grid seams.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `warm_stone_oval`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/warm_stone_oval.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-56492d28-a1df-4c52-9d66-70aada2c6ab5.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/warm_stone_oval.png`
- Used by: coffee table tops, sideboard stone slabs, bowls.

```text
Use case: stylized-concept
Asset type: seamless-ish game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square warm honed stone material texture inspired by rounded stone coffee table tops in clean residential showroom images. It must be a usable bitmap texture, not a furniture render.
Input images: The two attached user screenshots are style references for warm stone oval coffee tables, soft beige interiors, calm residential staging.
Subject: warm beige limestone / travertine-like honed stone, subtle cloudy veining, gentle mineral speckles, quiet premium finish.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile material, premium furniture catalog quality, soft cream beige, low contrast, elegant not busy.
Avoid: table object, room scene, text, labels, borders, icons, people, strong marble veins, dark cracks, cyan lights, logos, watermark, obvious grid seams.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `ivory_boucle_clean`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/ivory_boucle_clean.image2.png`
- Alt source retained: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/ivory_boucle_clean_alt.image2.png`
- Original captured files: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-7ec26505-b846-40cb-86de-ce505d0b8ba7.png`, `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-6cc11cc5-5152-4acc-873b-5f10146ddfc9.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/ivory_boucle_clean.png`
- Used by: cushions, folded ivory textile props.

```text
Use case: stylized-concept
Asset type: seamless-ish game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square ivory boucle upholstery fabric material texture inspired by soft residential sofas, bench cushions, and clean staged model-home furniture. It must be a usable bitmap texture, not a furniture render.
Input images: The two attached user screenshots are style references for cream sofas, ivory cushions, warm quiet staged residential interiors.
Subject: ivory boucle woven fabric, soft looped yarn texture, subtle warm cream variation, premium cushion material.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile textile material, soft, clean, high-end residential catalog quality, understated.
Avoid: sofa object, room scene, text, labels, borders, icons, people, strong stains, patterned flowers, cyan lights, logos, watermark, obvious grid seams.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `warm_white_lacquer`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/warm_white_lacquer.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-d3402005-2966-4634-b360-fa7fbbc4f6d2.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/warm_white_lacquer.png`
- Used by: cleaner closet body, warm painted cabinet panels.

```text
Use case: stylized-concept
Asset type: seamless-ish game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square warm white lacquer cabinet panel material texture inspired by clean residential built-in closets and staged storage furniture. It must be a usable bitmap texture, not a furniture render.
Input images: The two attached user screenshots are style references for warm white residential cabinetry, soft showroom lighting, quiet model-home furniture.
Subject: warm white lacquered cabinet surface with very subtle brush/orange-peel finish, faint panel wear, off-white cream tone.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile material, premium but restrained, clean residential showroom, slight warmth, no pure flat color.
Avoid: furniture object, room scene, text, labels, borders, icons, people, strong stains, sci-fi panels, cyan lights, cameras, logos, watermark, obvious grid seams.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `muted_book_spines`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/muted_book_spines.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-4befca0e-04a8-4d4c-bf14-64d8944c9a4d.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/muted_book_spines.png`
- Used by: restrained book blocks and accent materials.

```text
Use case: stylized-concept
Asset type: game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square muted residential book-spine material texture for open shelves, inspired by staged model-home shelves. It must be a usable bitmap texture, not a room or shelf render.
Input images: The two attached user screenshots are style references for warm residential shelving, quiet staged decorative books, beige/wood showroom interiors.
Subject: tightly arranged muted book spines and a few fabric storage spines, warm neutrals, sage, muted blue-gray, cream, walnut brown; no readable text.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge, vertical book-spine rhythm.
Style: realistic catalog-quality shelf material, quiet residential staging, tasteful and low contrast.
Avoid: actual shelf object, room scene, readable words, labels, borders, icons, people, bright colors, cyan lights, cameras, logos, watermark, obvious grid seams.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `shadow_gap_panel`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/shadow_gap_panel.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-74819c43-b8da-44b3-8769-84e05060811b.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/shadow_gap_panel.png`
- Used by: rear plates, underside seams, shadow gaps.

```text
Use case: stylized-concept
Asset type: game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square hidden shadow gap / rear access panel material texture for subtle Human Protocol residential furniture control cues. It must be a usable bitmap texture, not a sci-fi panel render.
Input images: The two attached user screenshots are style references for clean residential furniture with warm wood and quiet shadow gaps.
Subject: dark warm-brown recessed backing material with subtle dust, faint bevel-like seams, hidden maintenance cover impression, quiet shadow inside furniture backs and toe-kicks.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile material, understated, residential furniture shadow gap, slightly too precise and controlled, no obvious surveillance.
Avoid: bright lights, cyan strips, camera lenses, screws arranged like robot panels, readable labels, warning symbols, room scene, text, borders, icons, people, logos, watermark.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

### `woven_basket_oak`

- Source file: `src/assets/textures/environment/residential-reference-furniture-image2/image2-generated-sources/woven_basket_oak.image2.png`
- Original captured file: `/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-34fcd653-00b0-49d1-857c-917cae3cda50.png`
- Packed tile: `src/assets/textures/environment/residential-reference-furniture-image2/image2-sources/woven_basket_oak.png`
- Used by: storage basket material.

```text
Use case: stylized-concept
Asset type: seamless-ish game material texture tile for a 3D furniture GLB baseColorTexture
Primary request: Generate a square woven oak basket / rattan storage material texture inspired by residential entry benches and staged storage cubbies. It must be a usable bitmap texture, not a basket object render.
Input images: The two attached user screenshots are style references for warm residential entry furniture, storage benches, pale oak, woven natural accents.
Subject: natural woven rattan / oak fiber basket surface, warm tan strips, subtle shadows in weave, clean high-end residential storage material.
Composition: straight-on flat orthographic material swatch, fills the entire square image edge to edge.
Style: realistic tactile woven material, premium residential catalog quality, warm tan, understated and clean.
Avoid: basket object silhouette, room scene, text, labels, borders, icons, people, strong stains, cyan lights, logos, watermark, obvious grid seams.
Technical: square tile, suitable for UV wrapping as a base color texture; no perspective, no vignette, no frame.
```

## Derivative Processing

1. User supplied the generated image files via local `/var/folders/.../codex-clipboard-*.png` paths.
2. Files were copied into `image2-generated-sources/` with stable material names.
3. `scripts/asset-build/generate-residential-reference-furniture-image2-textures.py` center-fits each source into exact tile rectangles, writes packed tiles in `image2-sources/`, and packs the atlas/contact sheet.
4. `scripts/asset-build/blender-generate-residential-reference-furniture-batch01.py` loads the packed tile PNGs into Blender Image Texture nodes connected to Base Color and smart-projects UVs.
5. Raw GLBs are exported under `src/assets/models/environment/props/`.
6. Cooked GLBs are written under `src/assets/models-cooked/environment/props/`.
7. `src/assets/manifests/reports/residential_reference_furniture_glb_texture_audit.json` verifies `baseColorTexture` exists in raw and cooked GLBs.

## Dependent Outputs

- `src/assets/textures/environment/residential-reference-furniture-image2/hp_residential_reference_image2_atlas.png`
- `src/assets/textures/environment/residential-reference-furniture-image2/hp_residential_reference_image2_atlas.regions.json`
- `src/assets/textures/environment/residential-reference-furniture-image2/hp_residential_reference_image2_contact_sheet.png`
- `src/assets/manifests/reports/residential_reference_furniture_image2_texture_report.json`
- `src/assets/manifests/reports/residential_reference_furniture_batch01_blender_report.json`
- `src/assets/manifests/reports/residential_reference_furniture_glb_texture_audit.json`
- `src/assets/models/environment/props/hp_furniture_residential_*.glb`
- `src/assets/models-cooked/environment/props/hp_furniture_residential_*.glb`

## Restrictions

- Do not replace these sources with procedural fallback textures without updating this ledger.
- Do not use the user reference screenshots as direct texture sources unless their rights are separately recorded.
- Do not patch generated Raw WebGPU JSON as the source of license or provenance truth.
- Before commercial release, keep the account/date/terms pointer in the license ledger and only add generation call IDs if a future tool exposes them.
