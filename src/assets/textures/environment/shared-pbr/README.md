# Shared PBR Material Library (Image2 — Codex-painted)

A small set of **premium, reusable** PBR materials. EVERY prop (all 100) references these
by key, so the GPU texture-array stays well under the 256-layer hard limit (each material
is deduped by key at cook time → painted once, reused everywhere).

## Drop location & naming (Codex outputs here)
`src/assets/textures/environment/shared-pbr/<key>_<slot>.png`

- slots: `basecolor`, `normal`, `orm`  (ORM = R:ambient-occlusion, G:roughness, B:metallic)
- size: **1024×1024**, PNG, **seamless / tileable** (edges wrap)
- normal map: tangent-space, OpenGL convention (+Y up), mostly flat blue `#8080ff` with detail
- basecolor: **linear-ish, mid-brightness** — NOT near-black and NOT blown white (target luma ~0.12–0.55 so it lights correctly in our dark levels)

## The 10 materials to paint
| key | look |
|---|---|
| `pbr_white_marble`    | warm cream/white marble, fine grey veining, polished |
| `pbr_dark_marble`     | graphite-black marble, subtle silver veining (target luma ~0.13, NOT pure black) |
| `pbr_brass_polished`  | warm polished brass, metallic, faint micro-scratches |
| `pbr_brass_aged`      | darker patinated/aged brass, metallic |
| `pbr_wood_walnut`     | dark walnut, straight fine grain, satin |
| `pbr_stone_concrete`  | neutral grey microcement / cast stone, matte |
| `pbr_steel_brushed`   | dark brushed gunmetal steel, horizontal brush, metallic |
| `pbr_glass_frosted`   | frosted glass panel, pale translucent white, very low roughness |
| `pbr_bone_ivory`      | aged ivory / bone, hairline cracks, off-white |
| `pbr_velvet_oxblood`  | deep red velvet fabric, soft sheen, non-metallic |

Emissive accents (cyan/warm glows) are NOT painted — they use emissiveFactor (no texture).

See `CODEX_PROMPT.md` in this folder for the exact prompt to feed Codex.
