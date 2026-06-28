# Human Protocol Asset-First Renderer Cleanup Plan

## Goal

Move Human Protocol from a mixed old-demo/procedural/new-GLB renderer into a clean asset-first architecture.

The official campaign should prefer high-quality GLB assets and config-driven placement. Temporary boxes, planes, fallback robots, and old demo drawing paths should be removed from official level rendering even if that means some visuals need follow-up repair.

## Core Rules

- Config owns level nouns: room kits, door skins, puzzle visuals, pickup visuals, enemy archetypes, and model variants.
- Code owns reusable verbs: render a room shell, render a configured door, render a configured pickup, render an enemy model, animate an enemy state.
- Official levels should not depend on old arena floor, old obstacle visuals, procedural lamps, procedural keys, or hardcoded per-level visual special cases.
- Important interactables must be real assets or clearly routed through model assets: doors, key drops, color puzzle targets, boss rewards, robots, floor, wall, ceiling, and terminal panels.

## Current Structural Problems

1. `Arena.tsx` still mixes old arena rendering, configured map lighting, configured doors, and generic map geometry.
2. `MapGeometryRenderer.tsx` contains too many unrelated systems: room shells, props, decals, pickups, interactions, puzzle targets, clue surfaces, big screens, and environment states.
3. Visual walls are full room walls and do not share the collision wall door-opening segmentation, so doors can render behind walls.
4. Enemy rendering still contains old procedural and instanced fallback paths next to new GLB rendering.
5. Level 2 color puzzle targets and clue surfaces are drawn as temporary primitives instead of high-quality assets.
6. Boss key drops are technically present but visually too small and not called out enough.
7. Campaign transition UI can briefly show stale state during level changes and needs a dedicated pass.

## Target Folder Shape

```text
src/render/environment/
  ConfiguredMapLighting.tsx
  ConfiguredDoorRenderer.tsx
  ConfiguredRoomShell.tsx
  ConfiguredPickupRenderer.tsx
  ConfiguredPuzzleRenderer.tsx
  EnvironmentModelInstance.tsx

src/render/enemies/
  EnemyRobotRenderer.tsx
  EnemyModelInstance.tsx
  enemyModelPresentation.ts

src/assets/
  enemyModelAssets.ts
  environmentModelAssets.ts
  modelKeys.ts

src/game/visual/
  AssetResolver.ts
  visualModelMap.ts
```

## Execution Phases

### Phase 1: Renderer Boundaries

- Keep `Arena.tsx` as a composition root only.
- Move configured map lighting to `ConfiguredMapLighting.tsx`.
- Move configured door rendering to `ConfiguredDoorRenderer.tsx`.
- Move room shell rendering to `ConfiguredRoomShell.tsx`.
- Keep official campaign rendering off old arena-only surfaces.

### Phase 2: Door and Wall Correctness

- Reuse `createRoomWallSegments` for visual wall segments.
- Render wall GLBs per segment instead of full room-side walls.
- Keep door assets visible in the carved wall openings.
- Keep collision and visual openings aligned.

### Phase 3: Asset-First Interactables

- Replace procedural Level 2 color lamps with GLB assets.
- Replace floor color clue planes with embedded floor-light GLB assets.
- Improve boss key drops with a large GLB, outline beacon, and strong vertical callout.
- Route pickup and key visuals through one configured pickup renderer.

### Phase 4: Robots

- Remove official dependency on procedural small enemy fallback paths.
- Keep GLB silhouette changes in asset files or asset-refinement scripts, not runtime scale hacks.
- Map:
  - `repair_drone` to a small slim flying robot.
  - `clamp_bot` to a wide, fat, grounded maintenance robot.
  - `custodian_elite` to the intended large supervisor/hammer-style model.
  - final boss to the final boss model only.
- Move enemy color palette to a reusable presentation map and keep red accents lower saturation.

### Phase 5: Config Validation

- Validate every official `visualKey` resolves to a known model path or approved primitive.
- Validate room doors cut visual/collision wall openings.
- Validate boss key drops have visible pickup model configuration.
- Validate puzzle targets have high-quality configured assets.

### Phase 6: Campaign UI

- Reproduce `level_02 -> level_03` transition.
- Add level revision/snapshot guards so victory and transition overlays cannot show stale next-level labels.

## First Batch

1. Save this plan.
2. Extract configured lighting and door rendering from `Arena.tsx`.
3. Make room wall visuals use wall segments with door openings.
4. Increase boss key visibility.
5. Run build, campaign smoke, and art QA.
