# Deep Research Prompt: Why does our raw-WebGPU museum lighting still look gray / flat?

I need you to analyze a rendering/look-dev problem in a 3D game level. Please do **not** assume you can inspect any local files. Everything important is included below.

## Core problem

We have a level called **Human Museum** rendered in a custom **raw-WebGPU** pipeline. The desired look is:

- premium dark museum
- rich blacks
- natural bright ceiling
- controlled warm reflections
- readable exhibits
- subtle horror atmosphere without muddy grayness

But the current result still looks:

- too gray
- too flat
- too chalky on floor and ceiling
- not “expensive” enough
- weaker than a Three.js reference version

I want you to diagnose whether the issue is mostly:

1. wrong lighting math,
2. wrong material / color parameters,
3. missing renderer features versus Three.js,
4. or an interaction between those.

## Level + renderer context

- Level id: `level_03_human_museum`
- Renderer: `raw-webgpu`
- Lighting preset id: `hp:human_museum_gallery_lighting_v1`

## The most important room materials

### `museum_floor`

- color: `#1d2627`
- activeColor: `#2c3a3a`
- emissive: `#152a2d`
- activeEmissive: `#31595f`
- accent: `#cfe7e5`
- dangerAccent: `#b84b43`
- metalness: `0.42`
- roughness: `0.43`
- opacity: `0.82`
- glowOpacity: `0.28`

### `museum_wall`

- color: `#202b2d`
- activeColor: `#344144`
- emissive: `#173236`
- activeEmissive: `#426e72`
- accent: `#d6ebe8`
- dangerAccent: `#b84b43`
- metalness: `0.52`
- roughness: `0.36`
- opacity: `0.94`
- glowOpacity: `0.32`

## Raw room-lighting profile algorithm

The renderer generates per-room lighting profiles from room geometry and light distribution.

Inputs include:

- room area
- room height
- room light count
- dynamic light pressure
- warm light share
- cyan light share
- floor glow count
- area light count
- spot light count
- style tags like museum / clinic / residential / maintenance

### Current formulas

```txt
exposureBase = 1.02 + museum*0.08 + clinic*0.12 + residential*0.05 - maintenance*0.02
exposure = exposureBase + ambient*0.10 + hemisphere*0.05 - dynamicLightPressure*0.055

contrast = 1.04 + museum*0.09 + maintenance*0.07 - clinic*0.03 - lightDensity*0.018

saturation = 1.00 + cyanLightShare*0.05 + warmLightShare*0.035 - bloom*0.025

warmth = 0.46 + warmLightShare*0.22 - cyanLightShare*0.18 + residential*0.08 - clinic*0.05

floorBounce = 0.18 + floorGlowCount*0.055 + areaLightCount*0.032 + residential*0.10 + museum*0.06

ceilingWash = 0.14 + min(0.12, height/30) + areaLightCount*0.04 + clinic*0.08

sideFill = 0.12 + min(0.10, sqrt(area)/70) + spotLightCount*0.025 + museum*0.04

shadowDepth = 0.72 + contrast*0.12 - ambient*0.08 - floorBounce*0.08 + maintenance*0.08

ao = 0.72 + edgeDensity*0.18 + museum*0.16 + maintenance*0.12 - ambient*0.10

probe = 0.64 + floorBounce*0.72 + ceilingWash*0.38 + sideFill*0.42 + cyanLightShare*0.10

material = 0.76 + contrast*0.22 + museum*0.08 + clinic*0.05 - bloom*0.04

localLight = 0.78 + lightDensity*0.035 + floorGlowCount*0.045 + areaLightCount*0.035 + spotLightCount*0.025

shadowReceiver = 0.62 + shadowDepth*0.34 + museum*0.08 - floorBounce*0.10
```

Generated outputs per room:

- artist:
  - exposure
  - contrast
  - saturation
  - warmth
- bounce:
  - floor
  - ceiling
  - side
  - shadowDepth
- algorithm:
  - ao
  - probe
  - material
  - localLight
  - shadowReceiver

## Current lighting tuning actually applied

Metadata:

- schema: `hp.raw-webgpu.level03-lighting-tuning.v3`
- algorithm: `age-cpp-museum-toe-gallery-v1`
- source label: `human_museum_lighting_age_solver.cpp`

Global tuning values:

```json
{
  "shadowStrengthHigh": 0.760379,
  "shadowStrengthBalanced": 0.52028,
  "shadowBias": 0.0026,
  "normalBias": 0.0085,
  "specularGain": 0.971771,
  "contactGain": 1.02,
  "wallGuard": 0.861468,
  "warmGalleryPoolBudget": 0.48,
  "selectedCandidateId": "age-cpp-natural-graphite-gallery-003064319",
  "selectedFamily": "natural-graphite-gallery",
  "bestScore": 148.37919,
  "materialTargetVersion": "hp.age.museum-material-targets.v1"
}
```

## Current color-grade tuning actually applied

Metadata:

- schema: `hp.raw-webgpu.visual-color-tuning.v1`
- algorithm: `manual-premium-museum-color-body-v2`
- candidates evaluated: `10000001`
- score: `99.00317`
- currentScore: `48.614021`
- improvement: `50.38915`

Active params:

```json
{
  "exposureScale": 1.23,
  "contrastScale": 1.08,
  "saturationScale": 1.14,
  "blackScale": 0.76,
  "cyanRedLift": 0.11,
  "cyanGreenScale": 0.9,
  "cyanBlueScale": 1.0,
  "cyanNeutralMix": 0.22,
  "bloomScale": 0.9,
  "fogGuardScale": 1.02
}
```

Observed concern: despite this tuning, the scene still reads gray / not premium.

## Current role-palette tuning actually applied

Metadata:

- schema: `hp.raw-webgpu.role-palette.v1`
- algorithm: `cpp-final-frame-role-palette-solver-v3`
- candidates evaluated: `10000000`

Important role targets:

```json
{
  "ceiling_surface": { "targetColor": [0.62, 0.57, 0.46], "mix": 0.46 },
  "floor_surface":   { "targetColor": [0.39, 0.34, 0.255], "mix": 0.56 },
  "neutral_surface": { "targetColor": [0.3, 0.285, 0.24], "mix": 0.52 },
  "structural_dark": { "targetColor": [0.04372, 0.03455, 0.042251], "mix": 0.872956 },
  "exhibit_warm":    { "targetColor": [0.703372, 0.509355, 0.292294], "mix": 0.68429 },
  "robot_body":      { "targetColor": [0.560248, 0.561243, 0.506881], "mix": 0.195672 }
}
```

Observed concern: large surfaces may still be pushed toward dull neutral brown-gray rather than rich graphite-black.

## Current material pipeline summary

```json
{
  "totalMaterials": 103,
  "generatedSlots": 324,
  "existingSlots": 25,
  "generatedTextures": 176,
  "glassMaterials": 4,
  "transparentCandidates": 9,
  "roleCounts": {
    "neutral_surface": 23,
    "screen_label": 4,
    "route_gold": 10,
    "cyan_emissive": 6,
    "structural_dark": 20,
    "exhibit_warm": 13,
    "glass_shell": 4,
    "danger_red": 1,
    "switch_inactive": 4,
    "robot_body": 10,
    "pickup_key": 1,
    "pickup_energy": 1,
    "pickup_health": 3,
    "switch_active": 3
  }
}
```

Concern: too many materials may be landing in neutral / structural categories with tuning that suppresses richness.

## Example generated profile for the main gallery lobby

```json
{
  "roomId": "level_03_gallery_lobby",
  "style": "human_museum_gallery combat museum hp:human_museum_gallery_v1 hp:human_museum_gallery_lighting_v1 combat",
  "formula": "hp.raw.room-lighting-profile.v2+age-cpp-museum-toe-gallery-v1",
  "inputs": {
    "area": 198,
    "height": 4,
    "roomLightCount": 5,
    "floorGlowCount": 0,
    "areaLightCount": 1,
    "spotLightCount": 0,
    "dynamicLightPressure": 0.633333,
    "warmLightShare": 0.8,
    "cyanLightShare": 0
  },
  "artist": {
    "exposure": 1.058766,
    "contrast": 1.255136,
    "saturation": 1.05045,
    "warmth": 0.454876
  },
  "bounce": {
    "floor": 0.11252,
    "ceiling": 0.687565,
    "side": 0.66,
    "shadowDepth": 0.795555
  },
  "algorithm": {
    "ao": 0.778683,
    "probe": 0.94,
    "material": 1.24,
    "localLight": 0.986696,
    "shadowReceiver": 0.685887,
    "specular": 1.005934,
    "contact": 0.945998,
    "wallGuard": 0.835721
  }
}
```

## Current renderer behaviors relevant to the diagnosis

The raw-WebGPU runtime currently applies:

- shadow strength based on quality tier + tuning globals
- `shadowBias`
- `normalBias`
- bloom intensity / threshold / radius scaling
- FXAA strength
- directional-shadow camera fitting based on room size and light direction

Shadow/bloom related implementation facts:

- shadow bias clamp: `0.0012` to `0.006`
- normal bias clamp: `0.0035` to `0.014`
- shadow strength derived from quality tier + tuning
- bloom threshold and bloom strength are also modulated by runtime logic

This may differ from the Three.js look in:

- specular response
- reflection handling
- tone mapping
- contact AO quality
- shadow richness
- material dark-surface separation

## My current hypotheses

Please evaluate these, not just one of them:

1. Base museum materials are too gray before lighting even begins.
2. Palette tuning over-mixes floor / ceiling / neutral surfaces toward gray-brown.
3. The room-lighting formula rewards readability too much and premium darkness too little.
4. The color-grade pass is compensating for weak material / lighting foundations.
5. Raw-WebGPU is missing a feature Three.js effectively gives us, such as:
   - stronger environment reflections,
   - better tonemapping,
   - better dark-surface specular shaping,
   - better AO/contact shadow behavior.
6. Ceiling / floor bounce values are too high in a way that flattens the museum.

## What I want from you

Please answer in this structure:

### A. Most likely root cause ranking

Rank the top causes from most likely to least likely.

### B. What raw-WebGPU is probably missing versus Three.js

Be concrete. Do not just say “better lighting.” Identify what kind of renderer feature or shading response is likely absent.

### C. Which variables should be changed first

Give the top 5 variables / formulas / tuning groups I should change first.

### D. What target direction should the premium museum use

I want guidance for:

- richer black walls
- less chalky gray floor
- bright but elegant ceiling
- readable exhibits
- subtle warm reflection accents
- restrained cyan

### E. If only one subsystem is rewritten first, which should it be?

Choose one:

- room lighting profile generation
- visual color tuning
- role palette solver
- material pipeline classification
- renderer shading / tonemapping

And explain why.

### F. Specific proposed parameter direction

Do not just give abstract advice. Propose likely better ranges / directions for:

- museum floor base color
- museum wall base color
- contrast
- exposure
- floorBounce
- ceilingWash
- probe
- material
- blackScale
- neutral_surface mix
- floor_surface mix
- ceiling_surface mix

If useful, compare against high-end dark gallery / luxury showroom rendering principles.

