# Quality Gates

## Visual Gate

An asset is not done until it passes these checks:

- It reads instantly from the expected player distance.
- Its silhouette matches the role before color or text is considered.
- Its contact shadow or base makes it feel grounded.
- Its texture is visible under the target room lighting.
- It does not look like SVG flats, raw primitives, or unrelated blocks stacked together.
- It has restraint: cyan/blue light for facility identity, red only for danger/locked/error states.
- Bloom and emissive surfaces do not turn into white blocks.

For Human Protocol horror escape-room tone:

- Use cold gray-white, smoked titanium black, medical cyan, old metal/gold accents.
- Keep red small and meaningful.
- Make fear come from quiet service-machine intent, not messy red-black chaos.
- Make boss machines feel like maintenance supervisors or industrial tools, not random mecha excess unless the blueprint asks for it.

## Texture Gate

When users ask "is this real texture?", verify:

```bash
node - <<'NODE'
const fs=require('fs');
for (const file of fs.readdirSync('src/assets/models/environment/level02').filter(f=>f.endsWith('.glb'))) {
  const b=fs.readFileSync('src/assets/models/environment/level02/'+file);
  const jsonLen=b.readUInt32LE(12);
  const json=JSON.parse(b.slice(20,20+jsonLen).toString('utf8'));
  const textured=(json.materials||[])
    .filter(m=>m.pbrMetallicRoughness?.baseColorTexture)
    .map(m=>m.name);
  const images=(json.images||[]).map(i=>i.name || i.uri || 'embedded');
  console.log(file, {images, textured});
}
NODE
```

Then show the PNGs or a generated contact sheet. If textures are embedded but too subtle to see, say so and fix the art, not the explanation.

## Config Gate

For Human Protocol, every production asset should be reachable by config:

- model key registered in asset resolver/import map
- validator knows the key
- level or room kit references it semantically
- fallback behavior exists for missing optional art
- dynamic gameplay content is not baked into GLB
- official level smoke or campaign QA still passes

## Physics Gate

Check these before claiming gameplay readiness:

- Props do not block exits or critical paths.
- Pickup collision/interaction positions do not overlap.
- Door thresholds sit on the floor and preserve player navigation.
- Flying enemies do not have fake floor bases unless the blueprint calls for docked display.
- Ground enemies have low, readable contact and do not skate.
- Boss weapons have sockets or named parts for hit windows and VFX.

## Claiming Gate

Use precise language:

- "GLB embeds texture" means engineering success only.
- "Texture is visible in first-person" requires browser/render evidence.
- "Applied to game" means config references the asset and validation passes.
- "Polished in Blender" means source blend, named parts, materials, and export all changed.
- "Ready" requires checks and any missing visual review called out honestly.
