# Human Protocol Puzzle Actor Refactor

Status: implemented as a compatibility refactor.

This document records the puzzle actor layer added to keep the current game stable while preparing the config system for future 3D puzzle objects.

## Goal

The refactor has two goals:

- Keep current gameplay stable: existing official levels and builder playtests still use the proven runtime puzzle fields.
- Improve future extensibility: upcoming 3D puzzle objects can share one config vocabulary for visible objects, hitboxes, hosted props, interactions, and state bindings.

The key principle is conservative compatibility. The current runtime source of truth for `hit_sequence` remains `targets[]`. The new `actors[]` field is a mirrored semantic layer until the runtime is intentionally migrated to actor-first puzzle handling.

## Stability Contract

Current gameplay stability is preserved by these rules:

- `hit_sequence.targets[]` still drives weapon-hit detection, puzzle order, progress, success, and failure.
- `PuzzleActorBridge` can synthesize actors from existing targets, so old levels do not need new config to keep working.
- Builder import stores official actor/source metadata as `sourceActor`, but compile still emits legacy-compatible `targets[]`.
- Builder compile emits `actors[]` for future use, while keeping the matching `targets[]` in place.
- Runtime bake uses the resolved actor/target bridge for visuals, but actor-target position, room, and color are validated to stay aligned.
- No level-specific puzzle behavior was hidden in runtime code.

Important guardrail:

Until `hit_sequence` is migrated to an actor-first runtime, a target-compatible actor must not move independently from its target. If they diverge, the player may see one object but hit-test another. The validator and official bridge audit intentionally reject that mismatch.

## Extension Contract

`LevelPuzzleActorDefinition` is the shared object vocabulary for future puzzle authoring:

```ts
interface LevelPuzzleActorDefinition {
  id: string;
  role: string;
  kind: "target" | "control" | "clue" | "stateful_prop" | "hotspot";
  roomId: string;
  position: Vec3Tuple;
  rotation?: Vec3Tuple;
  visualKey?: string;
  materialKey?: string;
  colorKey?: LevelPuzzleColorKey;
  inputMode?: "weapon_hit" | "interact" | "inspect" | "rotate" | "drag" | "none";
  hitbox?: { shape: "sphere" | "box"; radius?: number; halfSize?: Vec3Tuple };
  anchorPropId?: string;
  interactionId?: string;
  targetId?: string;
  stateKey?: string;
}
```

Recommended meanings:

- `target`: an object that receives direct puzzle input, such as an orb, switch node, or hit target.
- `control`: an object the player operates, such as a panel, lever, dial, router, or calibrator.
- `clue`: an inspectable or readable puzzle clue.
- `stateful_prop`: a world prop with puzzle state, such as a rotating statue, valve, or moveable archive piece.
- `hotspot`: an interaction zone hosted on a larger prop or wall object.

This keeps future 3D puzzles from inventing separate fields for every object family.

## Bridge Responsibilities

The bridge layer owns conversion between old and future forms:

- `puzzleActorFromHitSequenceTarget(target)` creates a compatibility actor from an existing color target.
- `puzzleActorFromBuilderComponent(component, colorKey)` turns builder-placed puzzle components into actors.
- `colorPuzzleTargetFromPuzzleActor(actor, colorKey, label)` keeps current color puzzle target output compatible.
- `puzzleActorsForLevelPuzzle(puzzle)` returns explicit actors plus synthesized compatibility actors.

Builder import/compile responsibility:

- Import official hit-sequence targets into builder components with `sourceTarget` and `sourceActor`.
- Preserve inferred pedestal/host prop links such as orb pedestals.
- Compile color sequence puzzles with both `targets[]` and mirrored `actors[]`.

Bake/runtime-pack responsibility:

- Resolve visuals through the actor bridge.
- Keep model/light placement aligned with the same compatibility actor used by the target bake.

## Validation Rules

The config validator and official bridge audit enforce:

- actor ids are unique within a puzzle
- actor `roomId` exists
- actor `interactionId` exists when provided
- actor `anchorPropId` exists when provided
- actor hitboxes are positive
- generated authoring only uses curated visual/material keys
- hit-sequence compatibility actors reference real target ids
- only one actor can represent a given hit-sequence target
- actor room, color, and position must match the target while runtime remains target-first

These checks are intentionally strict because they prevent the most dangerous failure mode: visuals and gameplay collision drifting apart.

## How To Extend Safely

For a new 3D puzzle family:

1. Add or extend the puzzle schema with `actors[]`; keep puzzle-specific rules separate from object placement.
2. Use `kind`, `role`, `inputMode`, `hitbox`, `anchorPropId`, `interactionId`, and `stateKey` before adding one-off fields.
3. Add validator checks for every new reference and every required actor role.
4. Add builder import/compile bridge coverage if the puzzle must round-trip between official config and `/build`.
5. Add runtime support only for reusable verbs: inspect, interact, rotate, drag, hit, state transition, success/fail actions.
6. Demonstrate the mechanic in one official or smoke config.
7. Run unit tests, `qa:builder`, and `build`.

Do not:

- hide official puzzle order, door opening, key grants, or enemy triggers in runtime code
- let builder visuals bake from a different source than config validation
- let actor coordinates diverge from legacy hit targets before actor-first runtime migration
- make per-level hardcoded exceptions for official Level 3 or builder playtest

## Current Verification

After the refactor, these checks passed:

```bash
npm run test:unit -- src/build/official-bridge/OfficialBridge.test.ts src/build/BuilderOfficialRoundTrip.test.ts src/game/systems/InteractionSystem.article.test.ts src/render/raw-webgpu/RawRoomRuntime.keyItems.test.ts
npm run qa:builder
npm run build
```

Coverage includes:

- official Level 3 import/compile round-trip
- five museum color orbs, including the blue orb
- hosted interactions that should not bake duplicate puzzle machines
- official/builder runtime pack asset lookup
- generated authoring boundary validation
- builder runtime resource map

## Migration Path

Current stage: compatibility mirror.

```text
target-first runtime
  -> actor bridge mirrors target semantics
  -> builder preserves sourceActor metadata
  -> validator/audit prevent drift
```

Future actor-first stage:

```text
actors[] become runtime puzzle object registry
  -> targets[] can become a compatibility export
  -> hit/inspect/interact/rotate/drag share one object pipeline
  -> builder and official configs remain parallel
```

The future migration should be explicit and tested. Until then, the current contract protects gameplay stability while leaving the data model ready for richer 3D puzzle work.
