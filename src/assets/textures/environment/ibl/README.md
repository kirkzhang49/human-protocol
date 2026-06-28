# Offline-baked IBL (Image-Based Lighting) assets

Pre-computed lighting probe for the cold/neutral **museum gallery** look used by Level 03.
These are **data-only assets** — the WebGPU renderer integration (texture upload + WGSL
sampling) is intentionally **not** done here and is left to the main programmer.

Baked offline with **Filament `cmgen` v1.71.6** (Apache-2.0) from a **Poly Haven CC0** HDRI.
Re-bake recipe is at the bottom of this file.

```
ibl/
  museum_neutral/
    specular-ldr/     prefiltered specular cubemap, 8-bit sRGB PNG  (PRIMARY, simplest path)
    specular-hdr/     prefiltered specular cubemap, Radiance .hdr   (faithful highlights)
    specular-rgbm/    prefiltered specular cubemap, RGBM-in-RGBA8 PNG (HDR packed for the web)
    sh9_irradiance.json        diffuse irradiance, 9 RGB SH coefficients (use THIS)
    sh9_irradiance.filament.txt raw cmgen text dump (reference only)
  brdf-lut/
    brdf_dfg_singlescatter_256.png  split-sum DFG / BRDF LUT (classic, RG = scale,bias)
    brdf_dfg_multiscatter_256.png   multiscatter GGX DFG LUT (energy-compensated)
```

## Source

- HDRI: **`museum_of_ethnography`** (Poly Haven, **CC0**), 2k equirectangular, `2048x1024`.
  Chosen for a neutral, even, artificial-light museum gallery — low blown-highlight area,
  reads well in the dark L03 scenes (source mean luma ~0.43, p99 ~9.5, max ~88).
- A fallback HDRI (`sculpture_exhibition`, also CC0) was downloaded but **not** baked.

## 1) Prefiltered specular environment cubemap (roughness -> mip)

6 cube faces per mip level, standard cubemap face naming:
`px,nx,py,ny,pz,nz` = +X,-X,+Y,-Y,+Z,-Z. cmgen's axis convention is the standard
right-handed cubemap layout (already mirrored for sampling; baked with default
`--no-mirror` OFF). **+Y is up.**

| mip / file prefix | face size | roughness (perceptual) |
|---|---|---|
| `px.png` … `nz.png` (no prefix) | 256² | base / mirror level (skybox), roughness 0 |
| `m0_*` | 256² | 0.0   |
| `m1_*` | 128² | 0.25  |
| `m2_*` | 64²  | 0.5   |
| `m3_*` | 32²  | 0.75  |
| `m4_*` | 16²  | 1.0   |

So there are **6 mip levels** (base + m0..m4); 6 faces each = **36 files per variant**.
Roughness is linear across the 5 `m*` levels (`m_i` roughness ≈ `i/4`). To sample at
runtime: `lod = perceptualRoughness * (mipCount-1)` against the `m*` chain (skip the
unprefixed base unless you want a sharp mirror/skybox level).

### Which variant to upload
- **`specular-ldr`** (sRGB PNG) — easiest. Upload as `rgba8unorm-srgb` cube. Highlights are
  clamped to 1.0 (museum spots lose punch in chrome reflections, but ambient/specular still
  reads correctly). Good enough for first integration.
- **`specular-hdr`** (`.hdr`) — faithful. Decode Radiance RGBE on load and upload as
  **`rgba16float`** cube (the engine already creates `rgba16float` targets, so this is
  in-budget). Use this if mirror/brass reflections of bright fixtures look flat.
- **`specular-rgbm`** (RGBM in RGBA8 PNG) — HDR packed into a plain `rgba8unorm` (NON-srgb)
  texture; decode in WGSL as `rgb = rgba.rgb * rgba.a * MaxRange` with Filament's
  `MaxRange = 16.0`. Bandwidth-cheap HDR for the web. **Do not** sample as sRGB.

## 2) BRDF / DFG LUT (2D)

`brdf-lut/brdf_dfg_*_256.png`, **256×256**. View-independent, scene-independent —
one LUT for the whole game. Indexed by `uv = (NoV, perceptualRoughness)`.
- single-scatter: **R = DFG scale, G = DFG bias** (B unused). Classic split-sum:
  `specular = prefilteredColor * (F0 * dfg.r + dfg.g)`.
- multiscatter: energy-compensated GGX (Filament packs scale in G — see Filament docs
  `EnvironmentBRDF`). Pick ONE to match your BRDF; default to single-scatter unless the
  shader already does multiscatter compensation.
Upload as **`rgba8unorm` (linear, NOT sRGB)** with **clamp-to-edge** + linear filtering.

## 3) Diffuse irradiance — SH9

`sh9_irradiance.json` → `coefficients_rgb`: **9 × RGB** float triples.
cmgen **"pre-scaled" / irradiance** convention with **auto windowing** (ringing reduction):
the cosine-lobe convolution AND the per-band `Ylm` normalization are **already folded in**,
so the shader just evaluates the SH basis at the world-space normal and dots:

```
irradiance(n) = Σ_{i=0..8}  coeff[i] * basis_i(n)
basis order   = [ Y00, Y1-1, Y10, Y11, Y2-2, Y2-1, Y20, Y21, Y22 ]
              = [ 1, y, z, x, x*y, y*z, 3z²-1, x*z, x²-y² ]   (n = (x,y,z), +Y up)
```

Pass the 9 coefficients as a uniform (`array<vec3<f32>,9>` / 9×`vec4` padded).
This already returns **diffuse irradiance** (divide by π only if your diffuse BRDF expects
radiance; the Filament convention here returns the irradiance term directly — verify against
your existing diffuse path).

---

## What the renderer integration needs (handoff to main programmer)

1. **3 bind-group resources** (one shared IBL bind group, e.g. group(2)):
   - `texture_cube<f32>` specular env + a filtering `sampler` (trilinear, mip clamp).
     Build a cube texture with `dimension:"cube"`, `mipLevelCount:6`, upload 6 faces per
     mip from `specular-*`. Choose format per variant table above.
   - `texture_2d<f32>` BRDF LUT + a `sampler` (clamp, linear, NO mips, NON-sRGB).
   - SH9 as a **uniform** (`array<vec4<f32>,9>`, xyz = coeff, w padding) — no texture needed.
2. **Sampling**: reflection vector `R = reflect(-V, N)`; `lod = roughness*5` on the `m*`
   chain; combine with `dfg` per the split-sum formula above; add `SH(N)*albedo` diffuse.
3. **No WGSL is shipped here.** Nothing in `src/render/raw-webgpu/shaders/` was touched.
   These are passive assets; wire the bind group + a dozen lines of WGSL on your side.

## Re-bake recipe (deterministic)

```sh
# tools: Filament cmgen (github.com/google/filament releases, mac tgz -> filament/bin/cmgen)
cmgen --type=cubemap --format=png  --size=256 --ibl-samples=2048 --sh-window=auto \
      --deploy=OUT/ldr  museum_of_ethnography_2k.hdr     # -> specular-ldr + sh.txt
cmgen --type=cubemap --format=hdr  --size=256 --ibl-samples=2048 --sh-window=auto \
      --deploy=OUT/hdr  museum_of_ethnography_2k.hdr     # -> specular-hdr
cmgen --type=cubemap --format=rgbm --size=256 --ibl-samples=2048 --sh-window=auto \
      --deploy=OUT/rgbm museum_of_ethnography_2k.hdr     # -> specular-rgbm (.rgbm == PNG)
cmgen --ibl-dfg=OUT/brdf_dfg_singlescatter_256.png                   --size=256
cmgen --ibl-dfg=OUT/brdf_dfg_multiscatter_256.png --ibl-dfg-multiscatter --size=256
```
