# Playtest To Official Pipeline Improvement Plan

Status: goal review only. Do not execute this plan automatically.

This plan describes future improvements for making official `/build` edits safer and more exact. It is intentionally not an implementation checklist for the current handoff.

2026-06-20 direction update: Level 1/2 are builder-native official levels. Their official playable source is the official builder JSON plus a small copy/campaign shell; old `LevelDefinition` source metadata must not override build-authored rooms, furniture, surfaces, puzzle visuals, door locks, or waves. Level 3 remains the special museum official chain. Level 4+ are no longer default promotion/QA targets until they are rebuilt.

## Goal

Make admin edits in `/build` produce an auditable, low-guesswork path back to official campaign levels:

- The editor should show what changed by semantic role, room, and source layer.
- QA should prove the builder source, compiled `LevelDefinition`, Raw WebGPU/runtime pack outputs, and browser playtest agree. For Level 1/2, old official source parity is intentionally not a goal.
- Rebuilds should invalidate stale browser caches and IndexedDB-backed resources deterministically.
- Visual differences should be caught by data checks first and browser/pixel checks second.

## Proposed Milestones

1. Draft Diff Assistant

   Add a CLI or builder-side diff that compares exported `hp.config.v1` / `hp.builder.v1` against the official builder source by semantic role:

   - room surface presets
   - fixture placements
   - interaction visual keys
   - robot/enemy visual keys
   - pickups and skill assets
   - lighting profile and local room lighting
   - exit-room declared fixtures

   The output should be reviewable before any source file is touched.

2. Admin Sync Dry Run

   Add a command that proposes source edits without applying them:

   ```bash
   npm run official:sync-dry-run -- --level=<levelId> --draft=<export.json>
   ```

   The dry run should list exact target files and JSON/config paths. It should not rewrite official content automatically until a human reviews the proposed patch.

3. Flexible VisualBakeContract Schema

   Move repeated visual expectations into a durable, layered contract system. Do
   not create one complete hand-written contract per official level; that would
   become a second source of truth beside `LevelDefinition`.

   Use this shape instead:

   - `globalRules`: hard rules shared by all formal levels, such as no white
     boxes/proxy cubes/fallback materials, no hidden synthesized fixtures, and
     source-role traceability across Raw plans and runtime packs.
   - `roleRules`: expectations by semantic role, such as `roomSurface`, `door`,
     `keyItem`, `interaction`, `puzzleStation`, `enemy`, `skillPickup`,
     `viewmodel`, `exitFixture`, and `ambientProp`.
   - `familyProfiles`: reusable visual families, such as `maintenance_bay`,
     `residential_simulation`, `human_museum`, `memory_clinic`, and
     `reclamation_core`. Profiles declare allowed room kits, material families,
     lighting ranges, fixture families, and known forbidden fallbacks.
   - `levelOverrides`: small per-level exceptions or high-risk assertions only,
     for example Level 3 museum rooms requiring bridged floor/wall/ceiling
     surfaces, or exit rooms denying legacy pads and hidden ceiling fixtures.
   - `derivedChecks`: checks generated from official `LevelDefinition`, builder
     import, trial JSON, Raw WebGPU render plans, and builder runtime packs, so
     humans do not repeat every prop, room, and asset in contract data.

   The QA runner should load these layered rules for the currently maintained official slice,
   derive expected roles from source data by default, and use explicit schema
   entries only for reusable rule families or intentional exceptions.

4. Raw WebGPU Preflight

   Before writing generated Raw plans, run a preflight contract that checks:

   - source room surfaces can resolve to builder presets
   - texture assets exist and are bakeable
   - shell geometry will be removed only for rooms with declared replacements
   - hero overlays cannot cover bridged floor surfaces
   - generated model keys are stable and unique

5. Runtime Pack Parity Gate

   Expand runtime-pack checks beyond surface textures:

   - robot cooked resources use native `hp_enemy_*` assets
   - skill assets do not reuse pickup assets unless explicitly allowed
   - viewmodel, pickup, deployed, projectile, and effect roles are separated
   - interaction props do not fallback to white boxes or proxy cubes
   - source maps point back to semantic official/build roles

6. Browser Cache And IndexedDB Versioning

   Tie builder and Raw WebGPU cache invalidation to a content hash made from:

   - official source level revision
   - builder import bridge revision
   - Raw compiler revision
   - runtime pack schema revision
   - render plan asset hash

   The `/build` page should clear or migrate stale IndexedDB records when the hash changes, so normal and incognito modes do not disagree after a bake.

7. Builder UI Trigger

   Add an admin-only button in `/build` for official imported levels:

   - export current draft
   - run pipeline diff
   - show source-layer drift
   - link to generated QA report
   - optionally generate a dry-run patch summary

   This should remain admin-only. Non-official custom maps should continue using the normal builder runtime plan path.

8. Visual Browser QA Layer

   Add focused browser/pixel checks for high-risk rooms:

   - official Level 3 exhibit rooms
   - exit/elevator rooms
   - skill pickup/deployed/explosion paths
   - builder imported official preview rooms

   Pixel checks should verify expected materials occupy visible area, but they should not replace semantic report checks.

9. CI Staging

   Split the pipeline into staged gates:

   - fast semantic gate for local editing
   - Raw compile/resource gate after rebuild
   - browser visual gate for renderer/material changes
   - full all-level campaign gate before release

## Acceptance Definition

The future pipeline is accurate enough when an official `/build` JSON can be reviewed and promoted with:

- one dry-run diff report
- one source patch
- one rebuild
- one focused QA pass
- clear focused warnings for the maintained official slice, with Level 4+ debt excluded unless that level is being rebuilt

No future agent should need to guess whether a white block, stale surface, hidden exit fixture, robot proxy, or reused skill asset came from official source, builder import, trial JSON, Raw compile, runtime pack, or browser cache.
