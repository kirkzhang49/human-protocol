# Human Protocol Puzzle Image2 Assert Workflow

Date: 2026-06-13

This is the durable workflow for future /build puzzle machines, 2D puzzle overlays, route-control devices, exit/elevator interactables, and Codex/Claude asset merges.

The sprint lesson is simple: the quality jump does not come from "more texture." It comes from an asserted puzzle loop, a strong physical silhouette, Image2 cut into useful parts, and math-owned geometry that survives WebGPU first-person view.

```txt
play assertion
  -> visual target sketch
  -> cut Image2 parts / atlas regions
  -> math-owned 3D geometry
  -> WebGPU bake
  -> browser + config assertions
  -> Codex/Claude merge report
```

## Play Assertions

Write this before art/code:

```txt
puzzleKind:
  playerReads: what is obvious from 2-3m before opening UI
  playerAction: the one-sentence interaction loop
  worldResult: door / puzzle / robot room / pickup / exit change
  failureRule: reset, strike, reshuffle, retry, or lockout behavior
  configControl: values exposed to /build
  validationMustCatch: impossible chains and invalid references
  cameraReveal: target door/room/elevator reveal after success
  runtimeMustNotBake: live state, localized text, answer data, selected outputs
```

Example:

```txt
color_sequence:
  playerReads: seven physical lamps on a facility wall
  playerAction: watch one replay, then input lamps in the same order
  worldResult: unlocks the bound door
  failureRule: wrong order resets; after configured strikes the sequence can reshuffle
  configControl: colors, sequence length, strikes, replay source, bound door
  validationMustCatch: too few lamps, invalid colors, missing door, self-lock
  cameraReveal: optional door release
  runtimeMustNotBake: current answer sequence, strike count, replay progress
```

## Image2 Contract

Image2 is a source for parts and material identity, not a front-poster shortcut.

Use Image2 for:

- target sketches/contact sheets;
- transparent cutouts: lens highlights, grime, scratches, screws, gaskets, warning strips, edge wear, glass glints;
- opaque tiles: smoked metal, old medical plastic, brushed brass, amber/cyan glass, rubber, copper, black recesses;
- GUI plates for overlays, with live text/numbers still rendered by React/CSS.

Hard fail:

- one full UI image pasted onto the front of a GLB;
- floating color balls or unowned cubes;
- baked instruction text on the 3D machine;
- one 2MB+ atlas embedded into every model as a full decal;
- claiming Image2 was used without source PNGs, atlas regions, or GLB audit.

Expected paths:

```txt
src/assets/textures/environment/<family>/image2-sources/*.png
src/assets/textures/environment/<family>/<atlas>.png
src/assets/textures/environment/<family>/<atlas>.regions.json
src/assets/gui/<overlay-family>/*.png
```

Region JSON uses `[x, y, w, h]` and records atlas size. Blender UV helpers must intentionally Y-flip regions.

## Math Bake Contract

Geometry owns the premium feel:

- distinct silhouette for every puzzle family;
- measured `sizeMeters` and grounded pivot;
- named parts for lenses, sockets, panels, hatches, rails, handles, cable lanes, output lamps, and collision proxies;
- bevels and weighted normals;
- cutout inlays 1-3mm proud on real faces, never floating poster planes;
- emissive materials for ready/active/error/release states;
- readable first-person focus at 2m;
- readable builder iso silhouette.

Minimum Blender helper set:

```py
def uv_rect_from_region(region_id, regions, atlas_size, padding_px=2):
    # normalized u0, v0, u1, v1 with Blender Y flip
    ...

def surface_region_inlay(name, region_id, center, size, normal, proud=0.002):
    # small region on a real machine face
    ...

def lens_socket(name, center, radius, color, state):
    # bezel + glass + emissive core, not a colored flat disc
    ...
```

## Overlay GUI Contract

2D puzzle overlays should read as facility instruments:

- Image2 owns frames, slots, robot portraits, glass plates, rotary rings, and mechanical ornament.
- React/CSS owns live text, numbers, progress, localization, and state.
- Close buttons stay small but reachable.
- Remove obvious labels like color names on lamps when the visual already communicates the state.
- Use physical states: recessed slot, lit cell, compression pulse, denied stamp, release glow.
- Support keyboard and pointer/touch if the puzzle ships to runtime.

## Assertions To Add

Asset assertions:

- GLB embeds expected atlas and no obsolete poster atlas.
- Material names with `baseColorTexture` are audited.
- Bounds match registry `sizeMeters`.
- Premium machines have distinct bounds and vertex counts.
- No single front decal plane covers more than about 35% of the front face.
- Runtime manifest maps model keys to cooked/native/proxy honestly.

Gameplay assertions:

- puzzle opens from the bound interaction;
- correct solution triggers the configured target;
- wrong input follows `failureRule`;
- route/key/door validation catches impossible chains;
- old drafts or legacy kinds still compile if promised;
- browser playtest loads without console errors.

Visual assertions:

- first-person screenshot proves interaction focus readability;
- builder preview screenshot proves silhouette readability;
- contact sheet or atlas render proves Image2 cuts are real.

## Codex + Claude Merge Protocol

Use this when two agents work in parallel:

1. Split by family or layer. Example: Codex owns `color_sequence` and `archive_merge`; Claude owns `circuit_grid` and `route_switch`.
2. Agree on shared contracts first: atlas path, region JSON format, Blender helper names, model keys, registry keys, QA assertions.
3. Preserve each other's silhouette unless replacement is explicitly requested.
4. Merge into one helper toolkit: UV helpers, socket/lens modules, material builders, screenshot harness, GLB audits.
5. Rebuild only owned model keys when script filters exist.
6. Bump `BUILDER_RUNTIME_PACK_ENGINE_VERSION` only when cached runtime output changes.
7. Finish with evidence: changed files, asset sizes, atlas audit, screenshots/renders, config assertions, commands run, and remaining risk.

Hard fail:

- claiming browser verification without screenshot or report path;
- claiming texture work without source/atlas/GLB evidence;
- claiming premium 3D while keeping a flat poster face;
- reverting another agent's unrelated work.

## Minimum Done Bar

For a premium puzzle machine or overlay:

- play assertions are written;
- Image2 sources/cuts/atlas are committed or documented;
- geometry owns silhouette and interaction focus;
- `/build` exposes safe config controls when player-authored;
- validators catch impossible use;
- WebGPU/builder bake path maps the model key;
- old maps/drafts are preserved;
- `npx tsc -b`, relevant builder QA, and `git diff --check` pass;
- at least one render/browser screenshot is named in the report.
