# Human Protocol Puzzle Machine Atlas Math Handoff

Date: 2026-06-13

Before executing a new puzzle-machine pass, use the reusable assertion workflow:

- `docs/human-protocol-puzzle-image2-assert-workflow.md`

## Problem

The current builder puzzle machine pass is not acceptable as a commercial visual target. The main failure is not "not enough Image2"; it is the wrong Image2 usage.

Do not paste a whole generated UI image onto the front of a 3D console. That makes the object read as a flat signboard, loses scale, and looks worse in first-person WebGPU than in the builder.

The correct target is:

```txt
typed machine blueprint
  -> named geometry parts
  -> small atlas regions / UV slots
  -> emissive state materials
  -> GLB with stable object names
  -> builder preview + Raw WebGPU playtest QA
```

Image2 should provide high-quality small parts: lens masks, brass trim strips, screen glass, dial ticks, screws, gaskets, socket rims, warning rails, micro labels, grime, and material identity. 3D geometry must provide the real shape.

## WGPU Lab References

Use these as the source of truth for math/atlas discipline:

- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/AGENT_MATH_GUIDE.md`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/docs/BLUEPRINT_FIRST_ASSET_PIPELINE.md`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/docs/HUMAN_PROTOCOL_ESCAPE_ROOM_TEXTURE_NAMING.md`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/docs/HUMAN_PROTOCOL_IMAGE2_GUI_ART_DIRECTION.md`

Reusable atlas / region examples:

- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_door_terminal_atlas_v1.svg`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_door_terminal_atlas_v1.regions.json`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_switch_panel_atlas_v1.svg`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_switch_panel_atlas_v1.regions.json`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_screen_glyph_atlas_v1.regions.json`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_image2_terminal_screen_atlas_v1.png`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_image2_dynamic_digits_atlas_v1.png`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_image2_environment_surfaces_atlas_v1.png`

Reusable GLB shape references:

- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/terminal_direction_ring.glb`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/terminal_archive_reader.glb`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/age_museum_color_orb_pedestal.glb`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/terminal_code_keypad.glb`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/room-terminal-wall.glb`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/switch_panel_wall_cyan.glb`
- `/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/switch_panel_floor_lever.glb`

New generated decal source to inspect, not automatically accept:

```txt
/Users/zhengkaizhang/.codex/generated_images/019ebc1d-995d-7180-96a0-992adf53da64/ig_07654f6abcb97016016a2d779cfa3c819ba2a48b181760b095.png
```

This sheet contains useful small parts, but it must be sliced/assigned by region. It must not be embedded as one full front decal.

## Current Bad Asset Symptoms

Files currently involved:

- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/scripts/asset-build/generate-builder-puzzle-machine-glbs.py`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/textures/environment/builder-puzzle-machines/hp_builder_puzzle_machine_decals_image2.png`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_color_sequence.glb`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_archive_merge.glb`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_circuit_grid.glb`
- `/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/src/assets/models-cooked/environment/builder-puzzle-machines/hp_builder_route_switch_console.glb`

Observed failures:

- The color sequence console reads as a flat grey printed board, not a premium physical light machine.
- Colored balls float in front of a panel instead of living in lenses/sockets.
- The large atlas appears embedded into multiple GLBs; current files are about 2.4MB each.
- First-person view makes the flatness obvious.

Keep the localized Blender BSDF fix already in the script:

```py
def principled_bsdf(material):
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
```

## Required Machine Blueprints

### Codex owns these two first

#### 1. `color_sequence` / 灯序复放墙

Role:

Wall-mounted memory-light machine. It should look like a physical 7-lens replay wall, not a UI panel.

Shape:

- Size about `1.25m W x 1.25m H x 0.22m D`.
- Heavy dark wall backplate with brass/cyan trim.
- Seven real recessed lens sockets in one readable row or shallow arc.
- Each lens is actual geometry: bezel ring, inner glass disc, emissive core.
- One small replay status rail and one small lock/ready lamp.
- No color-name text baked on the model.

Runtime/state:

- The 2D overlay may animate the sequence, but the 3D prop must also show seven colored physical lamps.
- The answer sequence must not be painted as a static clue on the machine face unless the config says it is a clue board.

Texture use:

- Use atlas regions only for lens glass texture, brass trim strips, tiny screws, warning ticks, and screen-glass grime.
- Do not use a single full-front decal.

QA:

- From 2m first-person distance, the player must identify seven lamps and the active interaction point.
- From builder 3D preview distance, it must not read as a grey square.

#### 2. `archive_merge` / 身份压缩柜

Role:

A physical identity-compression cabinet, not a 2048 phone screen. The puzzle UI can be 2D, but the world object must feel like a machine that stores identity tiles.

Shape:

- Size about `0.95m W x 1.45m H x 0.42m D`.
- Upright cabinet with thick base, side rails, top status slot, and recessed 4x4 tile bay.
- Tiles should be physical cells with bevels, not flat CSS squares on a plane.
- Default target is `64`, but builder config can change it.
- One small archive-reader slot, one target-number display, and a key-release hatch.

Texture use:

- Use dynamic digit atlas or small region planes for target numbers.
- Use material slots for tile states; do not bake every number permanently into the GLB.
- Optional tiny live-number plates can use atlas crop quads.

QA:

- From 2m first-person distance, it must read as cabinet + grid + target display.
- It must not look like a flat web UI pasted onto a cabinet.

### Claude owns these two in parallel

#### 3. `circuit_grid` / 工具档案校准

Use the old museum/electric-circuit feel if it looked better. The target is a physical calibration niche with rotatable line modules, sockets, and a power bus.

References:

- `terminal_direction_ring.glb`
- `room-fuse-box.glb`
- `hp_switch_panel_atlas_v1.svg`
- `hp_screen_glyph_atlas_v1.regions.json`

QA:

- Must read as a circuit/calibration machine before opening the overlay.
- Rotatable modules should be represented physically in 3D even if interaction happens in 2D overlay.

#### 4. `route_switch` / 路由控制台

Role:

Multi-room control device. It consumes one route key and triggers 1-4 configured outputs: open/close a locked door, reveal/enable a puzzle console, activate robots in a room, or toggle a room mechanism.

Shape:

- Floor or wall console with a direction ring, output sockets, and 1-4 cable lanes.
- Must visibly differ from puzzle consoles.
- Use WGPU switch-panel GLBs or atlas language as reference.

QA:

- From room distance, player should read "control router" without opening UI.
- Builder selection UI must show selected door, puzzle, and room robot output clearly.

## Shared Atlas Contract

Create or adopt a single shared atlas manifest, for example:

```txt
src/assets/textures/environment/builder-puzzle-machines/hp_builder_machine_parts_atlas_v2.png
src/assets/textures/environment/builder-puzzle-machines/hp_builder_machine_parts_atlas_v2.regions.json
```

Suggested region ids:

```txt
lamp.lens.red
lamp.lens.blue
lamp.lens.yellow
lamp.lens.green
lamp.lens.purple
lamp.lens.white
lamp.lens.cyan
trim.brass.long
trim.black.long
trim.cyan.rail
socket.round.small
socket.round.large
screw.cross
screw.hex
screen.glass.dark
screen.glass.cyan
screen.error.red
digit.panel.empty
warning.stripe.amber
gasket.corner
microticks.horizontal
```

Region format can follow WGPU lab:

```json
{
  "atlasSize": [1536, 1536],
  "regions": {
    "lamp.lens.red": [24, 24, 160, 160]
  }
}
```

Blender helper required:

```py
def uv_rect_from_region(region_id, regions, atlas_size, padding_px=2):
    # Returns normalized u0, v0, u1, v1 with Y flipped for Blender UVs.
```

## Geometry Rules

Hard fail if any premium console uses:

- one large front decal as the main visual;
- floating colored balls or unowned cubes;
- baked explanatory text on the 3D model;
- identical silhouette for multiple puzzle families;
- per-GLB embedded 2MB+ copy of the same atlas without need.

Required:

- Named objects for each functional part.
- Bevels and weighted normals.
- Grounded pivot and sensible bounds.
- Physical lenses, sockets, rails, handles, hatches, and cable exits.
- Emissive materials for active state.
- Small texture regions only where they enhance materials.

## Validation Targets

Add or run checks that prove:

- GLB sizes are reasonable or intentionally justified.
- Each of the four premium machines has distinct bounds and vertex counts.
- No machine has a single decal plane covering more than about 35% of front area.
- The shared atlas path is registered once and reusable.
- Builder preview and playtest use the same model keys.
- Browser screenshots exist for:
  - builder 3D overview,
  - first-person close view of `color_sequence`,
  - first-person close view of `archive_merge`,
  - first-person close view of `circuit_grid`,
  - first-person close view of `route_switch`.

## Claude Prompt

Use this prompt for the parallel asset pass:

```txt
You are continuing Human Protocol in /Users/zhengkaizhang/Documents/smallGames-main. Do not revert Codex or user changes. The current puzzle-machine asset pass is visually rejected because it pasted large Image2 panels onto consoles. Read:

/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/docs/human-protocol-puzzle-machine-atlas-math-handoff.md
/Users/zhengkaizhang/Documents/webgpu-robot-lab/AGENT_MATH_GUIDE.md
/Users/zhengkaizhang/Documents/webgpu-robot-lab/docs/BLUEPRINT_FIRST_ASSET_PIPELINE.md
/Users/zhengkaizhang/Documents/webgpu-robot-lab/docs/HUMAN_PROTOCOL_ESCAPE_ROOM_TEXTURE_NAMING.md

Your ownership for this pass:

1. circuit_grid / 工具档案校准
2. builder_route_switch_console / 路由控制台

Use WGPU lab atlas/region discipline:
- region JSON + named UV quads;
- geometry owns silhouette and physical parts;
- Image2/SVG atlases only provide small material decals, lens masks, trim, screens, sockets, screws, ticks;
- no full-front UI decal;
- no baked explanatory text;
- no floating unowned cubes.

Useful WGPU references:
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/terminal_direction_ring.glb
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/room-fuse-box.glb
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/switch_panel_wall_cyan.glb
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/switch_panel_floor_lever.glb
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_switch_panel_atlas_v1.svg
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_switch_panel_atlas_v1.regions.json
/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/room/textures/hp_screen_glyph_atlas_v1.regions.json

Keep existing runtime/schema behavior and model keys. Improve the Blender generation and baked GLBs only where needed, plus minimal registry/QA changes if required. Codex will handle color_sequence and archive_merge separately.

Acceptance:
- circuit_grid reads as physical electric/tool calibration before overlay opens;
- route switch reads as multi-room control console, visually distinct from puzzles;
- GLB first-person close screenshots prove no flat grey poster look;
- qa/build commands at least: npx tsc -b, npm run qa:builder, git diff --check. Run browser QA if you touch preview/runtime mapping.
```
