# Human Protocol Math-First Asset Modeling Skill

This document mirrors the local Codex skill installed at:

`/Users/zhengkaizhang/.codex/skills/human-protocol-math-first-asset-modeling`

Use it as the durable repo record for future Human Protocol and WGPU Robot Lab asset agents.

## Trigger

Use this method when creating, polishing, validating, or handing off Human Protocol or WGPU Robot Lab assets:

- blueprint-first robot, furniture, pickup, door, room, and viewmodel assets
- math-first candidate search for shape, palette, lighting, readability, physics, and animation
- Blender GLB generation and polish
- image2 texture atlas integration
- config-ready room kits and enemy visual profiles
- QA reports, manifests, texture sheets, build checks, and browser review

## Core Rule

Build assets from a reusable blueprint, score candidate parameters mathematically, generate Blender/GLB output, then prove it with manifests, texture sheets, config wiring, QA, and visual review. Do not treat "file exists" as "asset is good."

## Workflow

1. Inspect the target repo first.
   - Human Protocol: `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol`
   - WGPU Robot Lab: `/Users/zhengkaizhang/Documents/webgpu-robot-lab`
   - Do not mix repos unless the user explicitly asks for cross-repo handoff.

2. Define the blueprint.
   - Include role, silhouette, scale, config key, material slots, interaction states, collision proxy, LOD/mobile expectation, and runtime-changeable content.
   - Robots need archetype blueprints: flying repair drone, ground clamp bot, shield/service tech, supervisor/boss, final large entity.
   - Rooms need kit blueprints: floor, ceiling, wall, doors, light anchors, pickup visibility, combat lanes, and puzzle zones.
   - Puzzle machines need play assertions first: what the player sees, what they do, what changes in the world, and what validators must prevent.

3. Run math before Blender when the result affects shape, palette, lighting, readability, contact, or physics.
   - Use C++ for large searches.
   - Use Node/Python for orchestration, Blender generation, and reports.
   - Keep reports as JSON manifests with current score, best score, top candidates, best params, penalties, and replacement recommendation.

4. Generate or polish in Blender.
   - Use deterministic scripts.
   - Keep `.blend` sources and generated `.glb` outputs.
   - Use named parts, named materials, bevels, weighted normals, stable pivots, and collision-friendly proportions.

5. Use real image2 texture evidence.
   - Prefer project-owned high-quality atlas PNGs for primary visible material identity.
   - Use dedicated wrap textures for hero pickups and recognisable props.
   - Generate a texture contact sheet or audit when texture authenticity is questioned.
   - For puzzle machines and 2D puzzle overlays, follow `docs/human-protocol-puzzle-image2-assert-workflow.md`: target sketch -> cut Image2 parts -> atlas regions -> math-owned geometry -> WebGPU assertions -> Codex/Claude merge report.

6. Wire assets through config.
   - Register model keys, visual profiles, room kits, lighting presets, pickup layouts, enemy profiles, and validator references.
   - Reusable code owns verbs; config owns level nouns, pacing, references, and curated variant keys.

7. Validate before claiming success.
   - Run relevant build/config/playthrough checks.
   - Inspect GLB JSON for embedded `images`, `textures`, and material `baseColorTexture` when texture issues are suspected.
   - Claim browser screenshot review only when actually captured.

## Quality Gates

An asset is not done until:

- It reads instantly from expected player distance.
- Its silhouette matches the role before color/text is considered.
- Its contact shadow or base makes it feel grounded.
- Its texture is visible under target room lighting.
- It does not look like SVG flats, raw primitives, or unrelated blocks stacked together.
- Cyan/blue light carries facility identity, while red is reserved for danger/locked/error states.
- Bloom and emissive surfaces do not turn into white blocks.

## Texture Gate

When checking whether GLBs really contain textures:

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

Then show the PNGs or a generated contact sheet. If textures are embedded but too subtle to see, fix the art instead of defending the file.

## Config/Handoff Checklist

For each production asset family:

- GLB path
- source `.blend` path if future polish matters
- texture PNG/atlas paths
- model or visual key
- intended scale and placement
- material slots and texture sources
- collision proxy recommendation
- dynamic content rules
- config files changed
- validation commands run
- known visual risks or pending browser review

## Room Kit Pattern

Create reusable room kits as named presets, not locked one-off rooms:

- `maintenance_combat_bay_v1`
- `cyan_lockdown_arena_v1`
- `residential_simulation_false_home_v1`
- `memory_clinic_observation_v1`
- `reclamation_core_platform_v1`

Kit configs should describe reusable floor, ceiling, wall, door, lighting, props, pickups, spawns, state colors, and optional story decals/screens.

## Robot Profile Pattern

Keep robot visuals curated:

- `repair_drone`: small, slim flying frame, horizontal probe arms, no floor base while flying.
- `clamp_bot`: short, wider ground repair enemy, low center of gravity.
- `shield_tech`: calm service-device posture, readable shield/utility silhouette.
- `custodian_foreman`: maintenance supervisor pressure, tool hammer/arm as threat.
- `reclamation_mother`: final large machine, strong silhouette but still Human Protocol facility language.

Enemy config may tune tier, core color, warning color, scale, hit reaction cadence, and light intensity. It should not randomize every limb or material.
