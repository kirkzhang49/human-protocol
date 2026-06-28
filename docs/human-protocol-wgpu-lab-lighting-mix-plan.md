# Human Protocol × WGPU Robot Lab — lighting/GUI math absorption plan

This is a **math/rules** absorption, not a renderer port. Human Protocol keeps its
Raw WebGPU level renderer and AGE passes; we only lift the *formulas and policies*
that make 2D UI, 3D rooms, Image2 decals, and lighting read as one system across
`/build` preview and quick/deep playtest.

## 1. What we absorb from the WGPU Robot Lab

The lab's value is its **2D-over-3D readability math** and **decal/grounding rules**,
documented in `webgpu-robot-lab/docs/HUMAN_PROTOCOL_IMAGE2_GUI_ART_DIRECTION.md`:

1. **Linear-light UI readability.** Composite UI over the 3D scene in *linear*
   space and solve panel alpha so body text always clears the contrast target,
   instead of stacking opaque black scrims:
   - `linear(c)` sRGB transfer, `Y = 0.2126R+0.7152G+0.0722B`,
   - `contrast = (max(Y1,Y2)+0.05)/(min(Y1,Y2)+0.05)`,
   - `C_out = α·C_ui_linear + (1−α)·C_scene_linear`,
   - `shadow_ui = max(0.66, shadow_raw)` — a translucent panel over a bright cyan
     floor or white practical keeps a visible separating shadow.
   Body text ≥ **4.5:1**, weak hints ≥ **3:1**.
2. **Image2 layers as in-world surfaces.** The lab places 2D atlas/texture planes
   as screens, wall panels, and stickers in the 3D world (`addAtlasPlane` /
   `addTexturePlane`), not just floating overlays. The rule set: `transparent`,
   `depthWrite:false`, `toneMapped:false` for emissive screens, double-sided,
   a slight polygon offset, and a stable render order so decals never z-fight or
   occlude interaction focus.
3. **Contact / grounding shadows.** Dynamic objects get a soft footprint quad so
   props, puzzle machines, pickups, and robots have weight (AGE
   `AgeGroundingPass.planQuads`: grounded-only, strongest-first, radius clamped,
   opacity scaled by strength/kind/height and **capped at 0.42** — weight, not a
   heavy black ring).
4. **One light profile for preview and playtest.** Preview and runtime derive
   ambient/key/fill/fog/bloom/shadow/exposure from the *same* tokens so the editor
   view matches what the player walks into.

## 2. What Human Protocol already has (reuse, don't reinvent)

- **Raw WebGPU lighting** — `src/render/raw-webgpu/RawWebGpuLevelRenderer.ts` +
  `RawVisualDirector.ts` (sRGB→linear, scene tone, practicals). Mature; untouched.
- **Plan lighting** — `tools/raw-webgpu-compiler/raw-webgpu-plan-lighting.mjs` and
  `runtime-pack/builderLightingBake.ts#presentationFrom` already derive runtime
  ambient/directional/fog/bloom from `clampLighting(project.lighting)`.
- **GUI math** — `src/ui/guiMath.ts` (sRGB transfer, luminance, contrast, touch
  targets, shadow clamp) + `src/styles/gui-math.css` + `npm run gui:math-audit`.
- **AGE passes** — `packages/age-render-webgpu` grounding pass + escape-room
  visual profile carry the contact-shadow policy math.
- **Builder lighting** — `src/build/BuilderEnvironment.ts#projectLighting /
  clampLighting` is the single lighting rig source for the editor.

## 3. What we deliberately do NOT port

- Not the lab's Three.js/WebGPU renderer or its hardcoded room geometry.
- No changes to the official 1–10 campaign gameplay, layout, or IDs.
- No baked text in Image2 — language/size/contrast/QA stay in React/CSS live text.
- No purely-decorative CSS glow pretending to be a lighting upgrade.
- No new heavy dependency, no ceiling/overlay that blocks the `/build` edit view.
- No change to puzzle mechanics semantics.

## 4. Layering contract

```
3D world (Raw WebGPU runtime / R3F /build preview)
  └─ lit by BuilderVisualProfile tokens (same source as runtime presentation)
  └─ Image2 decals = in-world surfaces (screens / wall panels / frames)
        material: transparent, depthWrite:false, toneMapped:false (emissive),
        polygon-offset toward camera, stable render order, never over focus
  └─ contact-shadow quads (shared footprint+opacity math, cap 0.42)
2D overlays (React/CSS, z above world)
  └─ panel alpha / border / shadow solved by sceneAwareUiTokens(sceneTone)
  └─ all labels/detail = live text; close button stays small
```

- **/build preview** and **runtime playtest** consume the same lighting profile
  (`BuilderVisualProfile`) so fog/key/shadow/glow match. Preview is visual-only
  (React/CSS) — changing it does **not** bump the runtime pack engine version.
- **Overlays** never bake their background into a single full-screen image; they
  composite the dark facility-glass panel over whatever 3D scene is behind, with
  alpha chosen by the readability math.
- **Physical screens** (puzzle consoles, story-clue frames, exit/elevator panels)
  are Image2/emissive surfaces in the world; their *text* is live interaction copy
  or runtime text, never painted into the texture.

## 5. Image2 GUI / 3D decal spec (for future passes)

- **No baked text.** Leave live-text safe zones; render copy in React/CSS or the
  existing interaction-copy pipeline.
- **Readability math, not vibes.** Drive panel background alpha, border alpha,
  text tone, and shadow floor from `sceneAwareUiTokens` /
  `chooseReadablePanelAlpha` / `clampUiShadow`. Targets: body 4.5:1, hint 3:1,
  shadow floor 0.66.
- **Transparent decal depth strategy.** `depthWrite:false`, a small polygon /
  z offset toward the camera (`hybridDepthEpsilonMeters = 0.03` is the UI/world
  hybrid epsilon), `toneMapped:false` for emissive screens, double-sided for wall
  decals, fixed render order so decals sort above the wall but below interaction
  markers and never occlude buttons.
- **Asset addressing.** Reference existing asset id / model key / material key
  maps; never hardcode file paths in renderer code.
- **Quantity bound (from the lab's ornament lesson).** Decals dress real geometry
  edges/screens; they are not full-front UI posters glued onto a wall.

## 6. Where this plan is realized in code

- `src/ui/guiMath.ts` — `compositeLinear`, `compositeLuminance`,
  `chooseReadablePanelAlpha`, `clampUiShadow`, `readableTextToneForScene`,
  `sceneAwareUiTokens` (the §1.1 math).
- `src/build/BuilderVisualProfile.ts` — one profile for preview + runtime
  presentation parity (§1.4), incl. a UI scene tone estimate.
- Overlays (`ArchiveMergeOverlay`, `SequencePlaybackOverlay`, …) +
  `src/styles/overlays.css` — scene-aware readable panels (§1.1).
- `BuilderPreview3D.tsx` — profile-driven lights/fog/shadow, a story-clue wall
  screen decal (§1.2), and unified contact shadows (§1.3).
