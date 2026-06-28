# Level 02 Furniture Image2 Source Provenance

Recorded: 2026-06-19
Generating account: `kirkzhang49@gmail.com`
Generation date: 2026-06-19

This ledger records the prompt, source image, license status, reference inputs,
and derivative processing for the Level 02 furniture Image2 material atlas.

## Source Status

- Asset pack: `hp_level02_furniture_image2_v1`
- Source image: `src/assets/textures/environment/level02-furniture-image2/image2-real-sources/hp_level02_imagegen_texture_atlas_source.png`
- Source metadata: `src/assets/textures/environment/level02-furniture-image2/image2-real-sources/hp_level02_imagegen_texture_atlas_source.metadata.json`
- Machine-readable ledger: `src/assets/manifests/reports/level02_furniture_image2_source_provenance.json`
- OpenAI image generation call id: `ig_09cc2af1f5429f06016a35a40c882881989efda669c30d115d`
- Repo terms pointer: `docs/provenance/openai-imagegen-terms-2026-06-19.md`

## License Record

The Image2 source atlas is recorded as OpenAI-generated output made inside the
Codex/OpenAI workflow for this project. Based on OpenAI terms checked on
2026-06-19, the project record treats the output as user-owned generated output,
subject to OpenAI terms, the user's responsibility for inputs, and normal
project legal review.

References:

- OpenAI Terms of Use: https://openai.com/policies/row-terms-of-use/
- OpenAI Services Agreement: https://openai.com/policies/services-agreement/

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
cleared-for-project-use
```

This is not a third-party stock texture pack. The user reference screenshots
were used only for high-level art direction and are not redistributed as source
textures.

## Build Prompt

```text
Create a single square 2D texture atlas image for a refined residential furniture asset pack, 2048x2048 if possible. Divide it into four equal clean quadrants with subtle margins, no labels, no text, no objects, seamless-ish material surfaces only.
Top-left: premium warm walnut and oak wood veneer, calm long grain, amber-brown with honey highlights, no knots bigger than small flecks, elegant contemporary furniture finish.
Top-right: warm white lacquered cabinet panel material, satin finish, faint cream-grey undertones, very subtle inset-panel shadow/groove feeling, clean residential kitchen cabinetry, not futuristic.
Bottom-left: abstract residential art panel material, muted earth tones, ivory, sienna, olive, charcoal, soft organic brush bands like modern wall art, calm high-end living room taste, no faces, no symbols.
Bottom-right: muted bookshelf book-spine material, vertical narrow bands of warm neutrals, faded navy, terracotta, olive, cream, varied widths, quiet library feeling, no readable text.
Overall: clean, premium, low noise, no sci-fi cyan, no camera lenses, no glowing strips, no dirt, no grime, no random beads or wires.
```

## Reference Inputs

| Input | Use | Build inclusion |
| --- | --- | --- |
| `/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 10.52.05 AM.png` | High-level material/art direction: warm walnut, ivory, restrained residential art | Not included |
| `/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 10.29.30 AM.png` | High-level silhouette/art direction: gallery furniture proportion and restraint | Not included |

## Source Crops And Use

| Region | Source | Current use | Processing |
| --- | --- | --- | --- |
| `walnut_large_grain` | OpenAI image_gen source crop | Dining table tabletop | Center fit, atlas bleed |
| `warm_lacquer_panel` | OpenAI image_gen source crop | Wardrobe, kitchen, elevator panels | Center crop, light blur, faint panel lines, strong border removed |
| `residential_art_panel` | OpenAI image_gen source crop | Family portrait console art | Center fit, atlas bleed |
| `muted_book_spines` | OpenAI image_gen source crop | Bookshelf book fronts | Center fit, atlas bleed |
| `honed_stone_warm_vein` | Deterministic procedural fallback | Evidence/reserve, not primary final counter texture | Script-generated |
| `ivory_boucle_fabric` | Deterministic procedural fallback | Evidence/reserve, upholstery mostly clean PBR | Script-generated |
| `shadow_trim_gap` | Deterministic procedural fallback | Hidden seam/control hints only | Script-generated |

## Required Future Rule

Any future Image2 or generated texture source for this pack must record:

- prompt
- model/tool
- call id or source batch id when available
- source image path
- crop/region mapping
- license label
- reference inputs and whether they are redistributed
- derivative processing
- generated outputs that depend on the source

Do not replace this with chat memory. The repo metadata is the source of truth.
