# Asset Pipeline Reference

## Blueprint Fields

Every generated asset family should define:

- `assetFamily`: stable family name, not a one-off room name.
- `modelKey` or `visualKey`: the config-facing reference.
- `role`: gameplay and story purpose.
- `scaleMeters`: width, height, depth, and player-camera readability distance.
- `silhouette`: the few shapes that must read first.
- `materialSlots`: named slots such as body, trim, glass, emissive, screen, decal, warning.
- `textureSources`: atlas or wrap PNGs used by each material slot.
- `states`: powered/off, locked/unlocked, damaged, solved, pickup-available, enemy-hit, enemy-dead.
- `collisionProxy`: box/capsule/cylinder plan and what should block player/enemies.
- `runtimeContent`: digits, passwords, symbols, clue text, color state, or screen content that must not be baked.
- `qaEvidence`: math report, GLB report, contact sheet, render/screenshot, build checks.

## Math-First Search

Use math search when hand tuning would be fragile:

- lighting presets and room palette
- robot color/emissive/roughness/metalness
- room furniture size, bevel, contact grounding, cover height
- pickup readability and glow restraint
- hand/weapon grip contact and occlusion
- animation amplitude/timing when it affects combat readability

Good objective reports include:

- `currentScore`, `bestScore`, `delta`
- weighted component scores
- penalties and why they triggered
- top 8-12 candidates
- best candidate parameters
- a recommendation that says whether to apply or keep report-only

Use C++ for large searches. Use Node scripts to compile/run/report. Keep generated reports in `src/assets/manifests` for Human Protocol or `asset-lab/reports` for WGPU Robot Lab.

## Blender Generation

Prefer deterministic Blender scripts for first-class assets:

- Generate named parts; avoid anonymous cube piles.
- Set origin/pivot so placement and animation are stable.
- Use bevels and weighted normals on visible hard-surface edges.
- Use material slots that match config and texture names.
- Export GLB from selected root objects only.
- Save source `.blend` next to generated assets when the user wants future polish.

Common failure modes to avoid:

- detail floating away as a plane instead of being projected/UVed onto the mesh
- oversized rods, handles, or antennae crossing through unrelated objects
- robot limbs that look like stacked room furniture
- floor/ceiling patterns accidentally using screen/terminal assets
- UI-only animation changes pretending to be GLB animation polish
- textures technically embedded but invisible in first-person lighting

## Image2 Texture Rule

Treat "image2" as visible bitmap art, not procedural noise:

- Primary furniture and room surfaces need strong atlas regions: panels, screws, seams, wear, trims, vents, glass, labels.
- Hero pickups need dedicated wrap textures: key, medkit, energy cell, repair cabinet.
- Screens should use terminal atlases, while dynamic numbers/colors stay runtime-rendered.
- Small props may use atlas crops plus geometry details instead of one giant wrap.
- Always verify material `baseColorTexture` and show a contact sheet when in doubt.
