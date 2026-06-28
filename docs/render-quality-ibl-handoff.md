# Handoff — Render-quality / IBL work (for codex)

> Current policy update: this handoff is historical. Default-on global Raw
> renderer look changes are no longer the production direction. `renderer=raw-webgpu`
> should select the backend only; lighting and color decisions belong in each
> official level's source / Raw render plan / level tuning. See
> `docs/raw-webgpu-per-level-lighting-policy.md`.

_Context: a multi-session "make the 3D assets look more AA" effort. The guiding
insight (from an audit): **asset quality is capped by `MIN(modeling, texturing,
what the renderer can DISPLAY)`** — and the renderer was throwing away quality it
already had (full PBR sampled but bloom/FXAA hard-disabled, 2K textures clamped to
512, no IBL). So the work order is: unlock the renderer first, then feed it real data._

## TL;DR — what to do first
1. **Open the game normally in a browser** (no URL flags). Confirm it still renders
   (not black). This validates the one thing that can't be checked headlessly: the
   lighting uniform buffer grew 160→200 floats for IBL. If it's black even without
   flags → revert `RawWebGpuConstants.ts` + the IBL edits (see §6) and report.
2. Then A/B the new looks via URL flags: `?rawIbl=1`, `?rawAgx=0`, `?rawFull=0`.
3. **Do NOT `git add .`** — the working tree is mixed with another agent's
   in-progress work (see §2).

## 1. What's COMMITTED already (don't redo)
- `79bf516` "prop decimation, catalog prune" = the geometry work: 12 static GLBs
  decimated (~12.6 MB cooked geometry saved, all bbox-verified) + 13 orphan GLBs
  deleted (~13 MB). Enemy/viewmodel decimations were deliberately **reverted**
  (optimize collapsed their node rigs; enemies use native-raw so zero cook benefit).
- Several concurrent `/build` commits (`a124100`, `2f7d009`, `e202a04`, …).

## 2. UNCOMMITTED working tree — MINE vs CONCURRENT (critical before any commit)
**MINE (the render-quality work, safe to stage together):**
- `src/render/raw-webgpu/RawWebGpuQuality.ts`     — Phase 0 + AgX + IBL flags + particle count
- `src/render/raw-webgpu/RawWebGpuLevelRenderer.ts` — AgX uniform plumbing + IBL SH compute
- `src/render/raw-webgpu/RawWebGpuConstants.ts`   — IBL: lighting uniform 160→200
- `src/render/raw-webgpu/shaders/levelProxy.wgsl` — AgX + normal weight + IBL (SH9 + specular)
- `src/render/raw-webgpu/shaders/gpuParticles.wgsl` — particle dim
- `scripts/asset-build/generate-level06-10-hero-assets.py` — Phase 2 UV-bug fix
- `tools/raw-webgpu-compiler/raw-webgpu-plan-geometry.mjs` — Phase 2 shared-pbr → cook wiring

**CONCURRENT — another agent, do NOT touch/commit:**
`MaterialTable.ts`, `compileBuilderRuntimePack.ts`, `BuilderRuntimePackTypes.ts`
(v24 bump), `RawRoomRuntime.ts`, `App.tsx`, `AGENTS.md`, `scripts/qa/*` (door-reveal,
verify-enemy-layer-collision, _revealcap deletion), `docs/*`, `services/`, `.claude/`.

→ To commit my work: `git add` the 7 files above explicitly. Verify first:
`cd <repo> && npm run --prefix games/human-protocol …` tsc passes (it does as of handoff).

## 3. What I built (all reversible)

### Phase 0 — renderer unlock (LIVE, default-ON)
- `rawFullEffectsEnabled()` was hard-coded `=> false` since the engine landed →
  bloom/FXAA/full lighting+AO+material scalars never ran. Now default true.
  **Revert/A-B: `?rawFull=0`.** Mobile stays auto-protected (rawMobileMode gates it).
- Normal-map strength `0.78 → 0.92` (levelProxy.wgsl, more surface detail).
- NOT done (deliberately): texture cap 512→2K (needs a **plan recompile** + VRAM
  test — the runtime reads `plan.geometry.baseColorTextureSize=512`, plus a
  `Math.min(1024)` runtime clamp AND a compiler `clampInteger(…,1024)`; all three
  must lift together). Mipmaps left opt-in (`?rawMipmaps=1`) — author flagged seam
  risk on atlased UVs.

### AgX tonemap (LIVE, default-ON)
- `agx_tonemap()` in levelProxy.wgsl, wired into the **active** tonemap
  `raw_output_transform` (NOT `aces_film`@~732 which is dead code), toggled by
  `camera.fog_params.z`. **Revert/A-B: `?rawAgx=0`.** User has eyeballed it = OK.

### Particles (LIVE)
- gpuParticles.wgsl brightness `×0.6` (stops dust blooming into "light dots") +
  count `360→200` (full-effects branch in rawGpuParticleCount). `?rawParticles=0` off.

### Phase 1 IBL (default-OFF, `?rawIbl=1`)  ← newest, NEEDS in-browser verify
- SH9 diffuse irradiance (directional ambient) + analytic environment specular
  (Karis `env_brdf_approx`, no LUT/cubemap) — kills the flat-grey metal reflection.
- Lighting uniform appended `sh_coeff: array<vec4,9>` + `sh_meta` (160→200 floats,
  existing offsets unchanged). CPU computes SH from ambient+hemisphere+directional
  in `writeLighting`. Flag rides `sh_meta.x`.
- **Default-off path is byte-identical** (SH multiplies by `sh_meta.x=0` → 0).
- `?rawIbl=1` to enable, `?rawIblIntensity=0.6` to dial.
- **Specular is SH-blurry** — good for rough metals, NOT mirror-sharp.

### Phase 2 PBR authoring (additive, INERT until a recompile)
- Fixed the degenerate single-point UV bug in the hero-asset generator
  (`np.full(...,[cu,cv])` → real box/cylindrical unwrap; 22/22 meshes now multi-texel).
  Generator-only → needs a **hero-asset regen** to bake in.
- Wired the already-painted `shared-pbr` library (normal/ORM) into the native-raw
  compile path (`raw-webgpu-plan-geometry.mjs`) — was being dropped (plan
  `materialTextures` layers = 0). Additive (placeholders still dropped) → needs a
  **plan recompile** to take effect.

## 4. NEXT STEPS (prioritized)
1. **Verify the renderer changes in a browser** (the gate). Normal load → no black;
   `?rawIbl=1` → SH ambient + colored metal reflections look reasonable; if ambient
   is tinted/off, tune the SH derivation constants in `writeLighting` (`base`/`grad`).
2. **Specular cubemap (real sharp reflections)** — currently BLOCKED: no HDRI in
   repo, cmgen not installed, network was down. When unblocked: get a Poly Haven
   CC0 HDRI → Filament cmgen → prefiltered cubemap + BRDF LUT → **new bind group** +
   shader specular IBL. This is the single riskiest renderer edit (bind-group layout
   mismatch = total black, unverifiable headlessly) — do it incrementally, default-off.
3. **Offline recompile** (makes Phase 2 PBR + committed decimation visible). Do in a
   CLEAN window (after the concurrent agent's pipeline changes are committed):
   `regen hero assets` (UV fix) → `npm run raw-webgpu:rebuild`. Watch for the
   concurrent v24 bump / MaterialTable / layer-offset changes baking in.
4. **Texture 512→2K** (Phase 0 leftover): lift the 3 clamps together + recompile
   plan + test VRAM per tier (4× at 1k, 16× at 2k; keep rescue ≤512).
5. **Commit** my 7 files (§2) once browser-verified.
6. **Deferred roadmap** (from the asset-quality research): `hp-pbr-bake` skill
   (per-asset high→low normal/AO bake), `hp-prop-modeling` v2 (LLM Blender Python +
   real UVs), auto-rig cohesion fix, asset-consistency CI gate in `art:qa`.

## 5. Gotchas / lessons (please respect)
- **WGSL cannot be GPU-verified headlessly.** tsc doesn't check shader strings.
  Validate WGSL syntax with `wgsl_reflect` (a temp install lives at
  `/tmp/wgslcheck/node_modules/wgsl_reflect/wgsl_reflect.module.js`), and ALWAYS
  load in a real browser + check the console. A WGSL compile error = total black
  screen, and URL toggles can't save it (the function is in the source regardless).
- **WGSL here needs explicit `vec3<f32>()` splats** for scalar±vector (house
  convention; bare `vec - scalar` may not compile). Match it.
- **The "phantom" trap:** a background workflow's implement agents got rate-limited
  and silently changed nothing while reporting success-ish — always confirm edits
  actually landed (`git diff` / grep the live value), don't trust a workflow summary.
- **Don't fan out renderer edits to parallel agents** — coupled WGSL/bind-group
  changes break everything if wrong. Use workflows for read-only investigation;
  implement renderer changes by hand, incrementally, default-off.
- **Mixed working tree** — there is an active concurrent agent. `git status -s`
  before editing any shared file; never `git add .`.

## 6. Quick revert reference
- Phase 0: `?rawFull=0` (runtime) or revert RawWebGpuQuality.ts `rawFullEffectsEnabled`.
- AgX: `?rawAgx=0`.
- IBL: `?rawIbl=1` is opt-in (off by default). To fully back out the uniform-resize:
  `git checkout -- RawWebGpuConstants.ts RawWebGpuLevelRenderer.ts RawWebGpuQuality.ts
  src/render/raw-webgpu/shaders/levelProxy.wgsl` (this also drops AgX + Phase 0 — do
  surgically if you only want to drop IBL: remove the `sh_coeff`/`sh_meta` struct
  fields, the `eval_sh9`/`env_brdf_approx` fns, the two injection sites, the
  `LIGHT_SH_FLOATS` const change, and the writeLighting SH block).
- Particles: `?rawParticles=0`.

## 7. URL flags (A/B testing)
`?rawFull=0|1` `?rawAgx=0|1` `?rawIbl=0|1` `?rawIblIntensity=<0..4>`
`?rawParticles=0|1` `?rawMipmaps=1` `?rawEnv=<0.5..3>` `?rawShadowMap=1`
`?rawGpuProfile=1` (per-pass GPU timing, needs timestamp-query).
