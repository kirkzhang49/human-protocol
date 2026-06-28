# Codex prompt — paint the shared PBR material library

Copy everything in the fenced block below to Codex. It generates 30 texture maps
(10 materials × 3 maps) for the Human Protocol horror-museum game.

```
You are a senior game texture artist. Generate a SHARED PBR material library for a
dark, premium "human museum / horror facility" game (cold, cinematic, graphite-and-brass
gallery mood). Output real image files only — no code commentary.

For EACH material below, produce THREE seamless, tileable 1024×1024 PNG maps:
  <key>_basecolor.png   sRGB color, mid-brightness (target average luma 0.12–0.55 —
                        never near-black, never blown out; it must read in dim lighting)
  <key>_normal.png      tangent-space normal, OpenGL (+Y up), base #8080ff with surface detail
  <key>_orm.png         linear packed: R=ambient occlusion, G=roughness, B=metallic

Hard rules:
- Perfectly seamless/tileable (no visible seam when repeated 2×2).
- No baked-in lighting, no big highlights/shadows, no logos/text.
- Metallic materials: orm.B ≈ 1.0; non-metal: orm.B = 0.
- Keep grain fine and physically plausible; museum-grade, not noisy.

Materials (use these EXACT key names in the filenames):
1.  pbr_white_marble    — warm cream/white marble, fine grey veining, polished (rough ~0.25)
2.  pbr_dark_marble     — graphite-black marble, subtle silver veining; basecolor luma ~0.13 (dark but NOT pure black), polished (rough ~0.3)
3.  pbr_brass_polished  — warm polished brass, metallic, faint micro-scratches (rough ~0.25, metal 1)
4.  pbr_brass_aged      — darker patinated/aged brass, metallic (rough ~0.45, metal 1)
5.  pbr_wood_walnut     — dark walnut, straight fine grain, satin (rough ~0.45)
6.  pbr_stone_concrete  — neutral grey microcement / cast stone, matte (rough ~0.75)
7.  pbr_steel_brushed   — dark brushed gunmetal, horizontal brush lines, metallic (rough ~0.4, metal 1)
8.  pbr_glass_frosted   — frosted glass, pale translucent white, very low roughness (rough ~0.12)
9.  pbr_bone_ivory      — aged ivory/bone, hairline cracks, off-white (rough ~0.5)
10. pbr_velvet_oxblood  — deep red velvet fabric, soft directional sheen, non-metal (rough ~0.7)

Deliver all 30 files named exactly <key>_basecolor.png / <key>_normal.png / <key>_orm.png.
```

After Codex finishes, put all 30 PNGs in:
`games/human-protocol/src/assets/textures/environment/shared-pbr/`
…and give me that path — I'll wire them into the bake pipeline and re-cook.
