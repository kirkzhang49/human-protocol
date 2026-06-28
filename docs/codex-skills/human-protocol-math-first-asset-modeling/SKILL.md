---
name: human-protocol-math-first-asset-modeling
description: "Use when creating, polishing, validating, or handing off Human Protocol or WGPU Robot Lab assets: blueprint-first robot/furniture/room modeling, math-first candidate search, Blender GLB generation, image2 texture atlases, config-ready room kits, enemy visual profiles, physics/collision checks, and QA reports for commercial-quality escape-room assets."
---

# Human Protocol Math-First Asset Modeling

## Core Rule

Build assets from a reusable blueprint, score candidate parameters mathematically, then generate Blender/GLB output and prove it in manifests, texture sheets, config, QA, and browser review. Do not treat "file exists" as "asset is good."

## Default Workflow

1. Inspect the target repo first.
   - Human Protocol usually lives at the standalone repo root, for example `/Users/zhengkaizhang/Documents/human-protocol`.
   - WGPU Robot Lab usually lives at `/Users/zhengkaizhang/Documents/webgpu-robot-lab`.
   - Do not mix repos unless the user explicitly asks for cross-repo handoff.

2. Define the asset blueprint.
   - Record role, silhouette, scale in meters, config key, material slots, interaction state, collision proxy, LOD/mobile expectation, and runtime-changeable content.
   - Robots need archetype blueprints: small flying, small ground repair, shield/service tech, supervisor/boss, final large entity.
   - Rooms need kit blueprints: floor, ceiling, wall, doors, light anchors, pickup visibility, combat lanes, and puzzle zones.
   - Puzzle machines need a play assertion first: what the player sees, what they do, what must change in the world, and what cannot be solved or broken by bad config.

3. Run math before Blender when the result affects shape, palette, lighting, or readability.
   - Use C++ for large searches and Node/Python only for orchestration or reports.
   - Score candidates for silhouette, contact shadow, readable pickups, room-light harmony, material contrast, emissive restraint, physics fit, and config reuse.
   - Keep reports as JSON manifests with current score, best score, top candidates, best params, penalties, and replacement recommendation.

4. Generate or polish in Blender.
   - Use scripts for repeatability; keep `.blend` sources and generated `.glb` outputs.
   - Apply bevels, weighted normals, named material slots, clear object names, grounded pivots, and collision-friendly proportions.
   - For animation, separate authored poses/states from runtime timing; do not fake a GLB improvement with UI-only offsets.

5. Use real image2 texture evidence.
   - Prefer project-owned high-quality atlas PNGs for primary visible material identity.
   - Dedicated wrap textures are required for hero pickups and recognisable props.
   - Generate a contact sheet or texture audit when the user questions whether texture work is real.
   - For puzzle machines and overlays, use the Image2 assert workflow: sketch target -> cut transparent PNG parts -> pack region atlas -> UV onto geometry -> prove in WebGPU. Do not paste a whole UI poster onto a 3D object.

6. Wire assets through config.
   - Register model keys, visual profiles, room kits, lighting presets, pickup layouts, enemy profiles, and validator references.
   - Reusable code owns verbs; config owns level nouns, pacing, references, and curated variant keys.

7. Validate before claiming success.
   - Run relevant build/config/playthrough checks.
   - Inspect GLB JSON for embedded `images`, `textures`, and material `baseColorTexture` when texture issues are suspected.
   - Browser screenshots are only claimed when actually captured; otherwise say that browser visual review is pending.

## Read These References

- Use [references/asset-pipeline.md](references/asset-pipeline.md) before planning or implementing a new asset family.
- Use [references/puzzle-machine-image2-workflow.md](references/puzzle-machine-image2-workflow.md) before building or reviewing Human Protocol puzzle machines, 2D puzzle overlays, route-switch consoles, or Codex/Claude asset merges.
- Use [references/quality-gates.md](references/quality-gates.md) before saying an asset is finished.
- Use [references/handoff-and-config.md](references/handoff-and-config.md) when integrating assets into Human Protocol levels or passing assets between WGPU lab and the game.
