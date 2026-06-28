# Puzzle Machine Image2 Assert Workflow

Use this reference when building, repairing, or reviewing Human Protocol puzzle machines, 2D puzzle overlays, route-switch consoles, door/elevator interactables, or multi-agent asset passes.

The core lesson from the /build puzzle-machine sprint:

```txt
play assertion
  -> visual target sketch
  -> cut Image2 parts / atlas regions
  -> math-owned 3D geometry
  -> WebGPU bake
  -> browser + config assertions
  -> Codex/Claude merge report
```

Do not begin with "make a prettier GLB." Begin with the exact gameplay and readability assertions that the asset must satisfy.

## 1. Play Assertions First

Every puzzle family needs a short assertion block before art or code:

- `playerReads`: what the player understands from 2-3 meters before opening UI.
- `playerAction`: the primary input loop, in one sentence.
- `worldResult`: which door, puzzle, robot room, pickup, or exit changes.
- `failureRule`: what happens on wrong input and whether the player can retry.
- `configControl`: which values the builder can change without editing code.
- `validationMustCatch`: impossible locks, hidden required consoles, duplicate bindings, unreachable keys, route loops, and exit reachability.
- `cameraReveal`: whether success should cut/turn camera to a door, puzzle, robot room, or elevator.
- `runtimeMustNotBake`: numbers, color order, selected outputs, answer text, localization, and stateful progress.

Example:

```txt
color_sequence:
  playerReads: seven physical lamps on a facility wall
  playerAction: watch one replay, then input lamps in the same order
  worldResult: unlocks the bound door
  failureRule: wrong order resets; after configured strikes the sequence can reshuffle
  configControl: colors, sequence length, strikes, replay source, bound door
  validationMustCatch: too few lamps, duplicate invalid colors, missing door, self-lock
  cameraReveal: optional door release
  runtimeMustNotBake: current answer sequence, strike count, replay progress
```

## 2. Image2 Is A Parts Source, Not A Poster

Image2 should create high-quality parts and material identity:

- sketch/contact sheet for the target mood and silhouette;
- transparent cutouts for lens highlights, scratches, grime, screws, gaskets, warning strips, nameplates, glass glints, edge wear;
- opaque tiles for brushed metal, old medical plastic, smoked glass, rubber, copper bus, black recesses;
- GUI plates for overlays, with text/numbers still rendered live by React/CSS.

Hard fail:

- a full UI screenshot pasted onto a 3D face;
- color balls floating in front of a flat board;
- baked Chinese/English instruction text on the GLB;
- one atlas embedded as a 2MB+ full-front decal in every machine;
- Image2 art that hides the functional geometry instead of dressing it.

Required source deliverables:

```txt
src/assets/textures/environment/<family>/image2-sources/*.png
src/assets/textures/environment/<family>/<atlas>.png
src/assets/textures/environment/<family>/<atlas>.regions.json
src/assets/gui/<overlay-family>/*.png
```

Region JSON should use `[x, y, w, h]` in pixels and a recorded atlas size. Blender helpers must Y-flip UVs intentionally.

## 3. Math-Owned Geometry

Geometry carries the premium feel. Image2 only dresses it.

Required:

- distinct silhouette per puzzle family;
- grounded pivot and measured `sizeMeters`;
- named parts for lenses, sockets, rails, panels, hatches, handles, cable lanes, output lamps, and collision proxies;
- bevels and weighted normals on visible hard-surface edges;
- proud inlays around 1-3mm above the target surface, not floating planes;
- emissive state materials for active/ready/error/release states;
- atlas UVs only on real faces and small part inlays;
- first-person readability at 2m and builder-preview readability from iso view.

Useful helper pattern:

```py
def uv_rect_from_region(region_id, regions, atlas_size, padding_px=2):
    # Return normalized u0, v0, u1, v1 with Blender's Y-flipped UV convention.
    ...

def surface_region_inlay(name, region_id, center, size, normal, proud=0.002):
    # Create a small quad on a real machine face; do not use this as a whole UI face.
    ...
```

## 4. Overlay GUI Rules

2D puzzle overlays should look like facility tools, not generic web games:

- Image2 owns frames, slots, robot portraits, glass plates, rotary rings, and mechanical ornament.
- React/CSS owns all live text, numbers, selection state, progress, localization, and accessibility labels.
- Keep close buttons small but reachable; do not make them dominate the panel.
- Remove labels that merely restate obvious lamps/buttons.
- Prefer physical states: recessed slot, lit cell, compression pulse, denied stamp, release glow.
- Every overlay must have keyboard and pointer/touch operation if the puzzle is expected in player runtime.

## 5. WebGPU Bake Assertions

Add or run assertions that prove the output, not just the intention:

- GLB embeds the expected atlas image and no obsolete full-poster image.
- Materials using texture slots are listed by name.
- Machine bounds match registry `sizeMeters` within tolerance.
- Distinct premium machines have distinct bounds and vertex counts.
- No single front decal plane covers more than roughly 35% of the front area.
- Runtime pack manifest maps model keys to cooked/native/proxy status honestly.
- Browser playtest loads the cooked GLB pack without console errors.
- First-person screenshot proves the interactable focus is readable.
- Builder preview screenshot proves the silhouette reads from iso/split view.

When behavior changes, add gameplay assertions too:

- puzzle opens from the bound interaction;
- correct solution unlocks or triggers the configured target;
- wrong input follows the failure rule;
- route/key/door validation catches impossible chains;
- old drafts or legacy puzzle kinds still compile if promised.

## 6. Codex + Claude Merge Method

Use explicit ownership so two agents do not overwrite each other:

1. Split by asset family or layer, not by the same file when possible.
   - Example: Codex owns `color_sequence` and `archive_merge`; Claude owns `circuit_grid` and `route_switch`.
2. Agree on shared contracts first.
   - atlas path, region JSON format, Blender helper names, model keys, registry keys, QA assertions.
3. Preserve each other's silhouette unless the merge prompt explicitly authorizes replacement.
4. Merge into one helper toolkit.
   - shared UV helpers, lens/socket modules, material builders, screenshot harness, GLB audits.
5. Rebuild only the owned model keys when filtering is available.
6. Bump the builder runtime pack version only when cached runtime output changes.
7. End with a merged evidence report:
   - changed files;
   - asset sizes;
   - atlas usage audit;
   - screenshots/renders;
   - config/runtime assertions;
   - commands run;
   - remaining visual or automation risks.

Hard fail for merge reports:

- claiming "used Image2" without showing source PNGs, atlas regions, or GLB texture audit;
- claiming "premium 3D" when the asset is still a flat poster;
- claiming "browser verified" without a captured screenshot or explicit pending note;
- reverting another agent's unrelated work.

## 7. Minimum Done Bar

For a new premium puzzle machine or overlay, "done" means:

- play assertions written;
- Image2 sources/cuts/atlas committed or documented;
- geometry owns silhouette and interaction focus;
- config controls exposed through builder if player-authored;
- validators catch impossible use;
- WebGPU/builder bake path maps the model key;
- old maps/drafts are not wiped;
- `tsc`, relevant builder QA, and diff-check pass;
- at least one render or browser screenshot is named in the report.
