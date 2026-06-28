# Level 03 Raw-WebGPU Lighting Deep Research Brief

## Goal

Diagnose why `level_03_human_museum` in the raw-WebGPU renderer still reads as too gray / flat / low-end compared with the intended premium dark museum look and compared with the Three.js version.

We want guidance on whether the gap is primarily:

1. missing renderer features versus Three.js,
2. wrong color / material parameters,
3. wrong lighting-profile math,
4. bad interaction between the above.

This brief is meant to be pasted into a deeper research workflow with all relevant local facts included.

## Current runtime target

- Level: `level_03_human_museum`
- Renderer: `raw-webgpu`
- Main config file:
  - `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/game/config/levels/level03HumanMuseum.ts`

## Visual symptom summary

Primary complaints from art direction / QA:

- room still feels gray and not premium,
- floor and ceiling feel chalky / flattened,
- blacks are not rich enough,
- museum walls sometimes look acceptable, but floor/ceiling/non-framed surfaces lose depth,
- overall result feels less “expensive dark museum” than expected,
- Three.js reference appears to retain more richness, material separation, and spatial feel.

## Actual lighting + material pipeline in use

### 1. Room material base values

Source:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/game/visual/AssetResolver.ts`

Current museum materials:

`museum_floor`
- color: `#1d2627`
- activeColor: `#2c3a3a`
- emissive: `#152a2d`
- activeEmissive: `#31595f`
- accent: `#cfe7e5`
- metalness: `0.42`
- roughness: `0.43`
- opacity: `0.82`
- glowOpacity: `0.28`

`museum_wall`
- color: `#202b2d`
- activeColor: `#344144`
- emissive: `#173236`
- activeEmissive: `#426e72`
- accent: `#d6ebe8`
- metalness: `0.52`
- roughness: `0.36`
- opacity: `0.94`
- glowOpacity: `0.32`

### 2. Lighting profile generator math

Source:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/tools/raw-webgpu-compiler/raw-webgpu-plan-lighting.mjs`

The room profile is procedurally derived from:

- room area / height,
- room light count,
- dynamic light pressure,
- warm light share,
- cyan light share,
- floor glow count,
- area light count,
- spot light count,
- room style tags (`museum`, `clinic`, `residential`, `maintenance`).

Generated outputs per room:

- artist:
  - `exposure`
  - `contrast`
  - `saturation`
  - `warmth`
- bounce:
  - `floor`
  - `ceiling`
  - `side`
  - `shadowDepth`
- algorithm:
  - `ao`
  - `probe`
  - `material`
  - `localLight`
  - `shadowReceiver`

Important formulas currently in use include:

- `exposureBase = 1.02 + museum*0.08 + clinic*0.12 + residential*0.05 - maintenance*0.02`
- `contrast = 1.04 + museum*0.09 + maintenance*0.07 - clinic*0.03 - lightDensity*0.018`
- `saturation = 1.00 + cyanLightShare*0.05 + warmLightShare*0.035 - bloom*0.025`
- `warmth = 0.46 + warmLightShare*0.22 - cyanLightShare*0.18 + residential*0.08 - clinic*0.05`
- `floorBounce = 0.18 + floorGlowCount*0.055 + areaLightCount*0.032 + residential*0.10 + museum*0.06`
- `ceilingWash = 0.14 + min(0.12, height/30) + areaLightCount*0.04 + clinic*0.08`
- `sideFill = 0.12 + min(0.10, sqrt(area)/70) + spotLightCount*0.025 + museum*0.04`
- `shadowDepth = 0.72 + contrast*0.12 - ambient*0.08 - floorBounce*0.08 + maintenance*0.08`
- `ao = 0.72 + edgeDensity*0.18 + museum*0.16 + maintenance*0.12 - ambient*0.10`
- `probe = 0.64 + floorBounce*0.72 + ceilingWash*0.38 + sideFill*0.42 + cyanLightShare*0.10`
- `material = 0.76 + contrast*0.22 + museum*0.08 + clinic*0.05 - bloom*0.04`

### 3. Current lighting algorithm tuning actually applied

Source summary from render plan:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/render_plan_level_03_human_museum.json`

Tuning file:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_lighting_algorithm_tuning_level_03_human_museum.json`

Current tuning metadata:

- schema: `hp.raw-webgpu.level03-lighting-tuning.v3`
- algorithm: `age-cpp-museum-toe-gallery-v1`
- source: `webgpu-robot-lab/scripts/human_museum_lighting_age_solver.cpp`

Global tuning values now active:

- `shadowStrengthHigh = 0.760379`
- `shadowStrengthBalanced = 0.52028`
- `shadowBias = 0.0026`
- `normalBias = 0.0085`
- `specularGain = 0.971771`
- `contactGain = 1.02`
- `wallGuard = 0.861468`
- `warmGalleryPoolBudget = 0.48`
- selected family: `natural-graphite-gallery`
- best score: `148.37919`

### 4. Current color-grade tuning actually applied

File:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_visual_color_tuning_level_03_human_museum.json`

Metadata:

- schema: `hp.raw-webgpu.visual-color-tuning.v1`
- algorithm: `manual-premium-museum-color-body-v2`
- candidates evaluated: `10000001`
- score: `99.00317`
- currentScore: `48.614021`
- improvement: `50.38915`

Active grade params:

- `exposureScale = 1.23`
- `contrastScale = 1.08`
- `saturationScale = 1.14`
- `blackScale = 0.76`
- `cyanRedLift = 0.11`
- `cyanGreenScale = 0.9`
- `cyanBlueScale = 1.0`
- `cyanNeutralMix = 0.22`
- `bloomScale = 0.9`
- `fogGuardScale = 1.02`

Observed concern: despite stronger grade tuning, the result still reads gray rather than rich/dark/premium.

### 5. Current role palette tuning actually applied

File:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_role_palette_tuning_level_03_human_museum.json`

Metadata:

- schema: `hp.raw-webgpu.role-palette.v1`
- algorithm: `cpp-final-frame-role-palette-solver-v3`
- candidates evaluated: `10000000`

Important active roles:

- `ceiling_surface`: target `[0.62, 0.57, 0.46]`, mix `0.46`
- `floor_surface`: target `[0.39, 0.34, 0.255]`, mix `0.56`
- `neutral_surface`: target `[0.3, 0.285, 0.24]`, mix `0.52`
- `structural_dark`: target `[0.04372, 0.03455, 0.042251]`, mix `0.872956`
- `exhibit_warm`: target `[0.703372, 0.509355, 0.292294]`, mix `0.68429`
- `robot_body`: target `[0.560248, 0.561243, 0.506881]`, mix `0.195672`

Observed concern: floor/ceiling/neutral targets may still be too light / too desaturated / too beige-gray for the intended premium dark museum.

### 6. Current material pipeline

File:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_material_pipeline_level_03_human_museum.json`

Summary:

- total materials: `103`
- generated slots: `324`
- existing slots: `25`
- generated textures: `176`
- glass materials: `4`
- transparent candidates: `9`

Role counts:

- `neutral_surface`: `23`
- `structural_dark`: `20`
- `exhibit_warm`: `13`
- `robot_body`: `10`
- `route_gold`: `10`
- `cyan_emissive`: `6`
- `glass_shell`: `4`

Concern: material classification may still push too many surfaces toward neutral gray-brown rather than premium graphite-black with controlled warm reflections.

## Example generated room profile

From `level_03_gallery_lobby`:

- formula: `hp.raw.room-lighting-profile.v2+age-cpp-museum-toe-gallery-v1`
- inputs:
  - area `198`
  - height `4`
  - roomLightCount `5`
  - areaLightCount `1`
  - floorGlowCount `0`
  - spotLightCount `0`
  - dynamicLightPressure `0.633333`
  - warmLightShare `0.8`
  - cyanLightShare `0`
- artist:
  - exposure `1.058766`
  - contrast `1.255136`
  - saturation `1.05045`
  - warmth `0.454876`
- bounce:
  - floor `0.11252`
  - ceiling `0.687565`
  - side `0.66`
  - shadowDepth `0.795555`
- algorithm:
  - ao `0.778683`
  - probe `0.94`
  - material `1.24`
  - localLight `0.986696`
  - shadowReceiver `0.685887`
  - specular `1.005934`
  - contact `0.945998`
  - wallGuard `0.835721`

## Renderer behavior worth checking

Source:
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawWebGpuLevelRenderer.ts`

The renderer currently applies:

- shadow strength based on quality tier plus tuning globals,
- `shadowBias` and `normalBias`,
- bloom intensity / threshold / radius scaling,
- FXAA strength,
- per-frame room visibility-driven static batches,
- shadow camera fit based on room size and directional light direction.

Relevant current values:

- shadow bias clamp: `0.0012` to `0.006`
- normal bias clamp: `0.0035` to `0.014`
- bloom threshold depends on configured preset plus visual-director lift

Potential gap vs Three.js:

- weaker or simpler specular / reflection model,
- less nuanced tone mapping,
- simpler environment probe behavior,
- different AO/contact-shadow accumulation,
- weaker material response on dark polished surfaces,
- no equivalent of whatever Three.js path gives the museum floor its premium depth.

## Hypotheses to investigate

Please evaluate these in priority order:

1. **Material base colors are already too gray before lighting**
   - `museum_floor` and `museum_wall` may be starting from a mid-gray teal-black instead of a richer near-black graphite / obsidian base.

2. **Role palette tuning is washing large surfaces toward neutral brown-gray**
   - `floor_surface`, `ceiling_surface`, `neutral_surface`, and `robot_body` may be over-mixed.

3. **The lighting profile math over-rewards visibility/readability and under-rewards premium darkness**
   - especially `floorBounce`, `probe`, `material`, and `ceilingWash`.

4. **Color-grade tuning is compensating for weak underlying lighting/material response**
   - `exposureScale` and `blackScale` may be fighting each other.

5. **Raw-WebGPU lacks an important Three.js-like feature**
   - e.g. stronger reflection capture, a better tonemapper, richer specular BRDF response, screen-space reflection substitute, or better contact AO.

6. **Bloom / fog / wallGuard are preserving readability but flattening perceived richness**
   - especially if highlights are controlled but blacks do not deepen proportionally.

## Questions for deep research

1. Looking at the current formulas and parameter outputs, what is the most likely reason the museum still reads gray rather than premium dark?
2. Which three variables or formulas should be changed first for the biggest improvement?
3. Which gap seems like a missing rendering feature versus just wrong numbers?
4. Compared with a typical premium Three.js gallery look, what are we missing:
   - tonemapping?
   - reflection response?
   - shadowing?
   - environment probe?
   - material roughness/metalness handling?
5. If we want:
   - natural bright ceiling,
   - richer black walls,
   - less chalky floor,
   - controlled warm museum reflections,
   - readable exhibit objects,
   what should the target parameter direction be?
6. If only one algorithm pass is rewritten, should it be:
   - room lighting profile generation,
   - visual color tuning,
   - role palette solver,
   - material pipeline classification,
   - renderer shading / tonemapping?

## Files to inspect locally

- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/game/config/levels/level03HumanMuseum.ts`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/game/visual/AssetResolver.ts`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/tools/raw-webgpu-compiler/raw-webgpu-plan-lighting.mjs`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/tools/raw-webgpu-compiler/raw-webgpu-tuning-inputs.mjs`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/tools/raw-webgpu-compiler/compile-raw-webgpu-render-plan.mjs`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/render/raw-webgpu/RawWebGpuLevelRenderer.ts`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_lighting_algorithm_tuning_level_03_human_museum.json`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_visual_color_tuning_level_03_human_museum.json`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_role_palette_tuning_level_03_human_museum.json`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/raw_material_pipeline_level_03_human_museum.json`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/manifests/generated/raw-webgpu/render_plan_level_03_human_museum.json`
