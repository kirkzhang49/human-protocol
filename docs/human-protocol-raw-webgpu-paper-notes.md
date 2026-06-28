# Human Protocol Raw WebGPU Paper Notes

Source: `/Users/zhengkaizhang/Downloads/WebGPU Rendering and Lighting for a Low-Poly Indoor Glass Showcase FPS.pdf`

Captured: 2026-06-06

## Why This Paper Matters

The paper strongly supports a specialized raw WebGPU renderer for Human Protocol instead of trying to clone a generic Three.js renderer. The main thesis is:

- Use semantic, room-aware rendering instead of a universal scene renderer.
- Make glass, emissive strips, display cases, doors, route lines, pickups, and room zones first-class engine concepts.
- Solve the museum look through local lighting, reflections, transparency, and material roles, not through a global color grade.

This maps directly to our current problem: the raw renderer already has geometry, material roles, texture arrays, bloom, tone mapping, contact-shadow sketches, transparent-pass sketches, and robot clip data, but the image still feels wrong because the key "museum renderer" systems are not yet complete.

## Current Engine Mapping

Already started or present:

- Raw render plan for Level 3 museum.
- Geometry binary and material table.
- Base-color and material texture arrays.
- Material roles and palette tuning.
- Museum lighting director layer.
- Transparent material pass scaffold.
- Emissive light extraction scaffold.
- Grounding/contact shadow scaffold.
- Reflection probe scaffold.
- Bloom, tone map, FXAA, cinematic color pipeline.
- Robot animation bridge using GLB clip metadata.
- Script pipeline for Three.js resource bridge and raw render plan compilation.

Main gaps the paper confirms:

- Real WBOIT glass pass is not finished.
- Emissive materials are not yet converted into physically meaningful local lights.
- Local lights are still a small fixed shader loop, not clustered forward+.
- Reflections are still approximate, not room-probe/planar/SSR hybrid.
- Contact shadows need object/decal based grounding.
- Lighting director needs offline perceptual optimization against the shipping tone mapper.
- Render graph is missing, so passes and transient textures are still manually wired.
- Material role policy should drive transparency, reflections, bloom, decals, and contact behavior.

## Transparency And Glass

Recommendation from the paper:

- Shipping default: weighted blended OIT.
- Optional hero/debug mode: depth peeling.
- Use sorted alpha only when ordering is guaranteed.

Why it matters for us:

- Our display cases and glass covers currently read as cyan overlays.
- WBOIT gives stable first-person glass without per-frame sorting.
- It also fits WebGPU well: opaque pass first, then transparent accumulation targets, then fullscreen resolve.

Suggested engine component:

- `RawGlassOitPass`
- Shader: `shaders/glassOit.wgsl`
- Inputs: transparent draw list, material role, depth, scene color.
- Outputs: `accum` and `revealage`, then resolved composited color.

Baseline formats:

- `accum`: `rgba16float`
- `revealage`: `r8unorm` by default, `r16float` for high quality

Useful WBOIT formula record:

```text
a = min(1, alpha) * 8.0 + 0.01
b = 1.0 - 0.95 * z_ndc
w = clamp(a^3 * 1e8 * b^3, 1e-2, 3e2)

out.rgb = accum.rgb / max(accum.a, 1e-5)
out.a   = 1.0 - revealage
```

Our next use:

- Display cases, transparent covers, glass walls, archive panels.
- Make glass darker and thinner by absorption, not by painting a cyan sheet over the scene.

## Emissive Materials To Real Lights

Recommendation from the paper:

- Treat glTF emissive as surface luminance.
- Derive helper lights from emissive patches.
- Calibrate light strength before bloom and tone mapping.

Why it matters for us:

- Door red/blue lights, screens, pickup cores, route strips, and label strips should illuminate the room locally.
- They currently mostly affect material glow/bloom, so the museum lacks "lit object islands".

Useful formulas:

```text
E_tex  = decode_sRGB(emissiveTexture.rgb)
E_fact = emissiveFactor.rgb
s      = emissiveStrength
L_rgb  = s * E_tex * E_fact
Y      = dot(L_rgb, [0.2126, 0.7152, 0.0722])
A      = emitting area in square meters

Area light peak intensity:
I_max = Y * A

One-sided flux:
Phi_1s = pi * Y * A

Flux-equivalent point:
I_point_flux = (Y * A) / 4

On-axis-equivalent point:
I_point_axis = Y * A
```

glTF-style cutoff:

```text
attenuation(d) = max(min(1 - (d / range)^4, 1), 0) / d^2
```

Suggested engine components:

- `RawEmissiveLightExtraction` v2
- `RawGeneratedLightBuffer`
- Integration with `RenderLightBudget`
- Per-role emissive source rules:
  - door locked red
  - door access cyan
  - pickup health
  - pickup energy
  - route gold
  - screen label
  - exhibit warm label

Acceptance targets:

- Door red light visibly spills onto nearby door frame and floor.
- Energy pickup creates a small amber light island.
- Screen/label lights bloom locally without washing walls.
- Global cyan ambient can be reduced because local sources carry readability.

## Lighting Director Optimization

Recommendation from the paper:

- The lighting director should be an offline optimizer, not a runtime AI.
- Evaluate candidate lighting after the shipping tone mapper.
- Score in OKLab.
- Optimize for dark base, local light islands, cool-warm zoning, readable contrast, highlight safety, and temporal stability.

Why it matters for us:

- Our "ugly color" issue is not only a color grade issue.
- The current room is too uniformly lit and too cyan.
- The museum needs dark background surfaces plus distinct warm/cool pools.

Decision vector:

```text
x = {
  per-light intensity,
  per-light RGB or CCT/tint,
  per-light range / cone / soft radius,
  room ambient offsets,
  emissive multipliers,
  global exposure,
  bloom threshold
}
```

Objective terms to keep:

```text
J = lambda_base      * J_base
  + lambda_islands   * J_islands
  + lambda_zoning    * J_zoning
  + lambda_contrast  * J_contrast
  + lambda_highlight * J_highlight
  + lambda_energy    * J_energy
  + lambda_temporal  * J_temporal
```

Practical constraints:

- Non-negative light intensity.
- Per-room light count cap.
- Power budget cap.
- Exposure range cap.
- Bloom threshold range cap.
- Glass/label highlight clipping cap.
- Room-to-room transition continuity.

Suggested scripts:

- `scripts/optimizer/museum_lighting_director_solver.cpp` v2
- `scripts/optimizer/run-museum-lighting-director-solver.mjs`
- Output into:
  - `lightingProfiles`
  - `rawVisualColorTuning`
  - `rawRolePaletteTuning`
  - `rawArtDirection`

Important next change:

- Stop optimizing only a global grade.
- Optimize room-local light sources and room probes.

## Contact Shadows And Grounding

Recommendation from the paper:

- Default: projected ellipse/decal shadows.
- Optional: capsule shadows for humanoids/robots.
- Optional: short-radius GTAO/SSAO if depth/normal buffers already exist.

Why it matters for us:

- Furniture, display cases, pickups, and robots still feel detached.
- The museum looks like floating low-poly chunks without reliable grounding.

Suggested component:

- `RawContactShadowDecalPass`
- Upgrade or replace current `RawGroundingPass` with object bounds based decals.

Useful decal model:

```text
object bounds -> receiver plane -> ellipse/decal OBB
shadow = radial_falloff * height_fade * normal_fade * strength
```

Acceptance targets:

- Display cases sit on the floor.
- Door frames and archive columns have base contact.
- Robots have stable foot/body grounding.
- Pickups have small readable contact shadows.

## Reflections

Recommendation from the paper:

- Use a hybrid:
  1. planar reflection for hero floors/case faces
  2. SSR for dynamic detail
  3. room-local probe as stable fallback
  4. global environment last

For our low-poly indoor museum, the paper especially favors analytic room probes:

```text
P = shaded point
R = reflection ray
room box = AABB/OBB

1. Intersect P + tR with room box.
2. Identify hit wall/floor/ceiling.
3. Sample wall/floor/ceiling atlas or room color.
4. Mix local cubemap or highlight data if available.
5. Prefilter/fade by roughness and Fresnel.
```

Suggested component order:

1. `RawAnalyticRoomProbePass`
2. Upgrade `RawReflectionProbePass`
3. One planar reflection for selected polished floor/case surfaces
4. SSR later, after mini G-buffer exists

Why this matters:

- Current metal/glass looks plasticky because reflection is generic.
- A room-local probe will make surfaces share the same room identity.
- It is cheaper and more stable than SSR as the first step.

## Renderer Architecture

The paper's proposed architecture:

- Clustered forward+ opaque renderer.
- Mini G-buffer only for AO, SSR, and post.
- WBOIT transparency.
- Planar + SSR + room-probe reflections.
- Contact shadow decals.
- Central render graph with transient textures.
- Semantic material roles as policy drivers.

Human Protocol component plan:

```text
RawRenderGraph
  Frame begin
  Visibility and room cull
  Cluster build compute
  Opaque forward+
  Mini G-buffer extract
  Contact shadow decals / AO
  Room probe / planar / SSR
  WBOIT glass pass
  WBOIT resolve
  Bloom prefilter and blur
  Tone map and color grade
  UI and weapon overlay
```

Compact GPU records to evolve toward:

```text
MaterialRec:
  role
  texBaseLayer
  texNormLayer
  texMRLayer
  texEmissiveLayer
  flags
  params0
  params1

LightRec:
  position_range
  color_intensity
  direction_type
  spotAngles_misc
  roomMask
  flags

InstanceRec:
  affine3x4
  materialIndex
  objectFlags
```

Main rule:

- `material.role` should decide:
  - opaque vs WBOIT
  - reflection source
  - contact shadow participation
  - bloom contribution
  - decal eligibility
  - palette constraints
  - lighting priority

## How This Helps Us Beat Three.js

The advantage is not "more complete PBR".

The advantage is specialization:

- The renderer knows rooms.
- The renderer knows glass cases.
- The renderer knows route lines.
- The renderer knows door states.
- The renderer knows museum display lighting.
- The renderer knows pickups and robot silhouettes.

This lets us:

- Batch by compact material roles.
- Avoid arbitrary material graph complexity.
- Use deterministic transparency.
- Use room-local lights/probes.
- Generate light proxies from emissive assets.
- Keep Three.js as a toolchain/reference layer, not the hot runtime path.

## Immediate Next Steps

Priority 1: Fix glass properly.

- Implement real WBOIT accumulation and resolve.
- Feed `RawTransparentMaterialPass` from material roles, not legacy overlay.
- Remove any remaining cyan glass overlay defaults.

Priority 2: Make emissive assets become lights.

- Upgrade `RawEmissiveLightExtraction`.
- Estimate emissive area from bounds/material role.
- Convert luminance to local light intensity using the paper formulas.
- Feed generated lights through `RawGeneratedLightBuffer`.

Priority 3: Add analytic room probe.

- Use room AABB and material/atlas colors.
- Blend by roughness/Fresnel.
- Apply to glass, floor, metal trim, display cases, and robots.

Priority 4: Upgrade grounding.

- Convert current contact shadow into object-bound decal ellipses.
- Use plan instance bounds and dynamic enemy bounds.

Priority 5: Solver v2.

- Add probe samples on floor, walls, case glass, labels, doors, pickups, and camera path.
- Score after our shipping tone mapper in OKLab.
- Output room-local lighting and palette constraints, not only full-screen grade.

Priority 6: Render graph.

- Organize color, depth, shadow, OIT, bloom, FXAA, and future probe buffers.
- Make transient texture ownership explicit.
- This becomes important before clustered lights and SSR.

## Current Human Protocol Specific Diagnosis

Robot motion:

- The current clip bridge must be generated from the same GLB source as raw geometry.
- If geometry chunks and animation nodes come from different GLB variants, motion can look like only small parts are moving.
- The source-of-truth should be raw GLB for both geometry chunks and animation clips, with cooked GLB recorded only as runtime fallback metadata.

Color:

- The current "strange color" is mostly a lighting architecture issue.
- Global cyan ambient/fog/floor reflection is carrying too much of the image.
- The paper supports reducing global wash and replacing it with local light islands, emissive-derived lights, room probes, and role-specific reflection.

Museum feeling:

- The room will not feel like a museum from color grade alone.
- Museum feeling needs:
  - transparent display cases
  - lit labels
  - warm exhibit islands
  - darker negative space
  - door status lights
  - grounded cabinets
  - controlled floor reflection
  - room-local reflection coherence

## Validation Checklist

Use this URL for raw:

```text
http://127.0.0.1:5177/?level=level_03_human_museum&renderer=raw-webgpu&rawLook=cinematic&t=paper
```

Compare against Three.js:

```text
http://127.0.0.1:5177/?level=level_03_human_museum&t=three
```

Pass criteria:

- No raw WebGPU validation errors.
- Glass cases are transparent, not cyan sheets.
- Door red/blue lights affect nearby geometry locally.
- Pickups have local glow and readable silhouettes.
- Display cases and furniture are grounded.
- Floor reflection is visible but not a full-room cyan wash.
- Robot clip animation moves coherent body parts, not isolated chunks.
- Bright lights bloom after tone mapping, without washing the room.
- Color remains stable while walking through rooms.

## Implementation Log

2026-06-05 raw engine pass:

- Added `RawGlassOitPass` as the default transparent path. It renders glass into weighted accum/reveal textures, then resolves the transparent layer over the opaque scene with premultiplied blending.
- Kept `RawTransparentMaterialPass` as a `rawGlassOit=0` fallback for debugging.
- Added `RawAnalyticRoomProbePass`. It consumes `rawArtDirection.reflectionDirectives` and feeds room-level probe/specular/contact tuning back into `RawMuseumLightingDirector`.
- Upgraded `RawEmissiveLightExtraction` to v2 behavior. It now consumes art-direction local light directives for source instance, role, color, radius, decay, priority, and anchor position before falling back to regex roles.
- Expanded generated light budget from 4 to 6 within the existing shader maximum of 10 lights.
- Improved contact shadow sizing for museum props and cabinet-like low cases from bounds, instead of treating all props with the same footprint.
- Hardened desktop pointer lock by focusing the gameplay canvas before requesting pointer lock.

Still pending after this implementation:

- True screen-space refraction blur for thick glass.
- Clustered or tiled lights beyond the current 10-light uniform loop.
- SSR/planar reflection textures. Current probe is analytic and cheap, not screen-space.
- Decal projection pass for labels, route glyphs, door symbols, pickup icons.
- Material Palette Solver v2 that optimizes per-role OKLCH constraints against screenshots, not only manifest metrics.

## GLB Loader Report Notes

The GLB loader report does help the raw engine, but the useful change is not to put mesh arrays back into a large `loader.js`.

Recommended direction:

- Treat `loader.js` / `RawWebGpuAssetLoader` as a self-owned asset runtime layer.
- Keep the renderer focused on GPU passes, draw lists, bind groups, and frame orchestration.
- Keep author assets as `master.glb` / source files, then compile packed runtime assets.
- Prefer Meshopt + `KHR_mesh_quantization` for low-poly indoor geometry.
- Prefer KTX2 `KHR_texture_basisu` for texture transport.
- Use Draco only for assets where decode cost and binary size actually win.
- Split packed assets by room/chunk so the engine can lazy-load and prefetch nearby museum rooms.

Current phase-0 loader architecture:

- `RawWebGpuAssetLoader.ts` loads the compiled raw render plan, geometry buffer, and robot animation bridge.
- This keeps loading out of `RawWebGpuLevelRenderer`.
- Future `loader.js` can wrap the same boundary as a standalone runtime package.

2026-06-05 loader phase-1:

- Added `scripts/asset-build/build-raw-webgpu-cooked-loader-manifest.mjs`.
- It uses Three.js `GLTFLoader` + Meshopt decoder to read cooked GLBs without using Three.js for rendering.
- It outputs `raw_cooked_glb_loader_manifest_level_03_human_museum.json`.
- The manifest records scene graph, meshes, material texture slots, emissive/transparent materials, glTF extensions, bounds, and animation clips.
- `RawWebGpuAssetLoader.ts` now loads this cooked GLB manifest beside the compiled raw plan.
- This gives the raw engine a non-destructive bridge for information currently lost by the flattening compiler.

First phase-1 findings:

- 25 cooked GLBs parsed.
- 346 meshes and 114 materials were recovered through the loader.
- 50 robot animation clips are visible to the cooked GLB loader.
- 44 emissive materials and 8 transparent materials are visible before raw flattening.
- Major preservation gaps are glTF extension preservation, emissive-to-local-light extraction, and transparent material role propagation.

2026-06-05 loader/render phase-2:

- `RawWebGpuCanvas` now passes the cooked GLB manifest into `RawWebGpuLevelRenderer`.
- `RawEmissiveLightExtraction` consumes cooked emissive materials as a second semantic source beside authored art-direction directives.
- Door, screen, exhibit, route, pickup, and enemy-core lights can now be generated from cooked GLB material names, bounds, emissive colors, and emissive intensities.
- Generated cooked lights still go through the existing light budget, so this does not add unbounded per-frame lights.
- `RawTransparentMaterialPass` and `RawGlassOitPass` also use cooked transparent material metadata to avoid missing OIT when raw flattening loses alpha/transparent intent.
- Browser QA passed on `renderer=raw-webgpu&rawGlassOit=1` inside gameplay with 0 raw WebGPU validation errors.

Next loader milestones:

- Replace fixed Level 3 URLs with a manifest-driven asset graph.
- Add chunk status: `unloaded`, `loading`, `resident`, `evictable`.
- Add a packed GLB parser path that outputs our internal buffers, not a Three.js scene graph.
- Add Meshopt/KTX2 decoder hooks.
- Upload GPU buffers/textures through one reusable allocator.
- Stream room chunks based on player position and mission route.
- Split transparent draw batches so glass/OIT only draws glass instances instead of replaying the whole draw list.
- Promote cooked animation clip metadata into the raw robot animation sampler so the five robot model families use real clip channels end to end.

2026-06-06 robot animation findings:

- It is valid to use Three.js `GLTFLoader` or a thinner `loader.js` path purely as a parser/cook boundary, then render with our own raw WebGPU renderer.
- The current five Level 3 enemy GLBs, including the Three runtime `models-cooked/enemies` files, report `skinCount: 0`; they are rigid hierarchy robot models, not skinned meshes.
- Raw enemy geometry and animation bridge generation now use the same cooked enemy GLBs that Three loads at runtime instead of silently substituting source `models/enemies` files.
- The immediate monster clip risk is therefore chunk/node/matrix/budget coherence, not missing GPU joint-palette skinning for these assets.
- Raw WebGPU now avoids partial chunk playback: if an animated enemy cannot fit all chunks in the instance buffer, it falls back to a one-instance static whole-model draw instead of rendering a broken partial robot.
- `npm run raw-webgpu:robot-animation:qa` checks that robot clips, node chunks, and sampled hierarchy matrices remain coherent after loader or model changes.

2026-06-06 authored texture authority rule:

- Image2/authored texture materials are texture-authoritative in raw WebGPU.
- Materials with base-color texture names like `image2`, `atlas`, `wall_art`, `gallery_door`, `wrap`, `decal`, `paint`, `poster`, or `art` must preserve the authored bitmap color.
- These materials use `baseColorFactor = [1, 1, 1, alpha]`, `paletteColorFactor = [0, 0, 0, 0]`, and semantic strength/local-light/occlusion params set to zero.
- The shader must not multiply these textures by door cyan, exhibit warm, screen cyan, or instance tint. Use room lights, geometry, and reflection probes for integration instead of whole-surface color wash.
- Museum doors should express state through physical door motion and interaction UI, not small red/amber/cyan lamps baked into the door asset.
- WGPU Robot Lab handoff assets for Level 3 should keep Image2 wall art and door textures in their original palette; any status color must be a separate, optional gameplay layer, not part of the baked surface.
- Museum wall art must be authored as double-sided Image2 planes slightly in front of the backing/frame, not as a tinted cube face coplanar with glass or black backing. If a painting renders black, debug in this order: generated base-color WebP, raw material texture authority, backplate depth ordering, then room-facing rotation.
- Level 3 museum lighting should be AGE room-profile driven: warm white picture lights and exhibit pools should make wall art, pickups, terminals, doors, and display cases readable; cyan/red status lights are optional gameplay accents and should stay under a small area budget.
- Image2 wall art UV orientation rule: avoid atlas sub-rects for gallery paintings. Crop each painting into a standalone Image2 texture, map the full image with UV `(0, 0, 1, 1)`, then validate the exported GLB through `GLTFLoader` before compiling raw assets. In the current Blender -> glTF -> raw path, the final readable front face should report lower/bottom vertices with larger V than upper/top vertices. Do not fix upside-down paintings with per-instance rotation first; fix the asset UV contract and keep readable art on one front face with a matte backplate.

## Reference Links Listed In The Paper

These links are recorded from the PDF reference list for future verification:

- https://casual-effects.blogspot.com/2015/03/implemented-weighted-blended-order.html
- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- https://bottosson.github.io/posts/oklab/
- https://www.pbr-book.org/3ed-2018/Color_and_Radiometry/Radiometry
- https://www.realtimerendering.com/blog/physical-units-for-lights/
- https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_lights_punctual/README.md
- https://docs.acescentral.com/system-components/output-transforms/
- https://github.com/KhronosGroup/ToneMapping/blob/main/PBR_Neutral/README.md
- https://ceres-solver.org/
- https://dev.epicgames.com/documentation/unreal-engine/decal-actors-in-unreal-engine?lang=en-US
- https://threejs.org/docs/pages/WebGPURenderer.html
- https://www.cse.chalmers.se/~uffe/clustered_shading_preprint.pdf
- https://threejs.org/docs/pages/TSL.html
- https://dev.epicgames.com/documentation/unreal-engine/planar-reflections-in-unreal-engine?lang=en-US
- https://seblagarde.wordpress.com/wp-content/uploads/2012/08/parallax_corrected_cubemap-siggraph2012.pdf
- https://www.proun-game.com/Oogst3D/CODING/InteriorMapping/InteriorMapping.pdf
