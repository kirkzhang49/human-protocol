---
name: human-protocol-config-game-dev
description: Use when working on the Human Protocol game in the smallGames repo, especially config-driven 3D escape-room levels, builder-native official Level 1/2, Level 3 museum exceptions, LevelDefinition schema changes, reusable puzzle/door/key/article/quiz/switch/big-screen systems, runtime event wiring, validation, mobile-first HUD/UI, asset resolver handoff, and focused real playthrough QA.
---

# Human Protocol Config Game Dev

## Quick Start

Prefer the standalone repo root. In this migrated project it is `/Users/zhengkaizhang/Documents/human-protocol`.

Core rule: code owns reusable verbs; config owns level nouns, order, pacing, and references. New level content should be a `LevelDefinition` change. New mechanic families should become generic schema + runtime + validator capabilities, then be demonstrated in at least one official or smoke config.

Official production rule as of 2026-06-20: Level 1/2 are builder-native official levels. Their playable source is official builder JSON plus a lightweight source shell for copy/campaign fields; old official `map.ts`, `waves.ts`, raw plans, and source metadata must not override build-authored rooms, props, surfaces, puzzle visuals, door locks, or waves. Level 3 keeps its museum/boss/GUI/lighting official exception chain. Level 4+ are not default QA or maintenance targets until rebuilt.

Current maintained official slice:

- Level 1 source of truth: `src/game/config/levels/level01-maintenance-bay/level.official.builder.json`. It is currently a clean builder shell with authored rooms, service-elevator pieces, and the connected human-reference triptych decal. Do not resurrect old Level 1 furniture, floor, wall, or ceiling dressing from legacy source unless the user explicitly asks to rebuild that content.
- Level 2 source of truth: `src/game/config/levels/level02-residential-simulation/level.official.builder.json`. Preserve its builder-authored residential rooms, color-sequence panel/orb visuals, lighting and fixture assets, waves, and door progression. The light-room key is a real movable `key_item` pickup bound by `linkedDoorId`; `compileBuilderProjectToLevel` should prefer that pickup position and still protect against placing the key behind its own locked door.
- Level 3 source of truth is still the museum exception path; keep its curated museum/boss/GUI/lighting behavior unless the user explicitly asks to migrate it.
- Level 4+ are not part of the default official QA slice.

When debugging official `/build` or playtest visuals, trace the whole builder-native chain before editing: official builder JSON -> `normalizeOfficialBuilderProject` / `builderProjectFromBuiltInLevel` -> `compileBuilderProjectToLevel` -> official bridge/runtime pack -> Raw WebGPU render plan. Do not fix Level 1/2 official regressions by restoring old official templates or letting old source-shell metadata override builder-authored content.

Read only the reference needed for the task:

- `references/config-systems.md`: current config vocabulary, examples, and ID conventions.
- `references/implementation-patterns.md`: where to wire schema, runtime, renderers, i18n, and validation.
- `references/qa-and-release.md`: commands and browser/manual checks for real playable QA.
- `references/asset-and-visual-design.md`: config-linked art, UI, model handoff, and visual quality rules.

## Workflow

1. Inspect the task surface with `rg` before editing. Typical files live under `src/game/config`, `src/game/core`, `src/render`, `src/ui`, `src/game/visual`, and `scripts`.
2. Classify the work:
   - Content-only: edit level config, localization, art keys, pacing, waves, objectives, or copy.
   - Reusable mechanic: add schema/types, runtime state, interaction handling, renderer/UI, validator coverage, smoke/sample config, and QA script support.
3. Keep official levels data-driven. Do not hide level-specific door opening, puzzle answers, enemy waves, or progression in runtime systems.
4. For Level 1/2 official fixes, keep the builder-native authoring direction: preserve build-authored rooms, props, pickups, puzzles, surfaces, waves, and runtime-pack assets; treat source shells as copy/campaign metadata only.
5. For every new player-facing interaction, cover the full chain: config type -> state/progress -> runtime action/trigger -> visual affordance -> validator reference checks -> smoke or official level sample -> i18n text.
6. Run verification in the order in `references/qa-and-release.md`. If visual UI or 3D rendering changed, also perform browser QA on mobile landscape and desktop.

## Raw WebGPU / Visual Bake Contract Work

For visual regressions in official levels or `/build` playtests, treat Raw WebGPU and builder deep-bake as the acceptance path. Do not stop at a Three.js/R3F preview fix.

- Inspect the semantic chain before editing: official `LevelDefinition`, builder import/trial JSON, runtime visual registries, Raw WebGPU render plan, builder runtime resource pack, and material/sidecar manifests.
- Prefer reusable contract checks over level-specific renderer patches. A Level 3-only guard is acceptable for the museum exception; Level 1/2 guards should prove builder-native runtime pack output cannot be overwritten by stale source shells. Do not require Level 4+ visual contracts unless that level is actively being rebuilt.
- For Level 1/2, check whether the issue is in `/build` preview, deep playtest, official runtime, export/import normalization, or runtime-pack indexing before changing art or old source files. Color panels, light fixtures, keys, and puzzle machines should come from builder-authored model/visual keys, not stale `sourceInteraction` or `sourcePuzzle` data.
- Contract checks should compare semantic roles/modelKeys/source layers (`official`, `builder-import`, `trial-json`, `raw-plan`, `runtime-pack`) and report hidden synthesis such as extra exit pads, floor glows, ceiling fixtures, fallback white materials, proxy cubes, or pickup assets reused as skills.
- Generated Raw JSON is an output, not the source of truth. Fix source config, compiler rules, registry entries, GLB/material generation, or resource-pack indexing, then rebuild.
- Before accepting visual/runtime fixes, run the focused contract QA plus builder WGPU resource QA; add browser/pixel QA when the fix changes visible framing, materials, or interaction affordances.

## Guardrails

- Never bypass `ConfigValidator` when adding config references. Missing IDs, unreachable exits, self-blocked doors, bad lock chains, and mobile enemy budgets must be caught before play.
- Avoid hardcoded Chinese/English UI strings in runtime for official content. Use level localization/config where possible, and check both `lang=zh` and `lang=en`.
- Normal player UI should not expose debug panels, raw IDs, config dumps, or "demo continue" style labels.
- Keep visual config constrained. Let levels choose room kits, floor/wall materials, lighting mood, and a few semantic variants, but keep props, pickups, weapons, panels, robots, and interactable objects on a consistent shared art direction.
- Mobile-first means large touch targets, no overlapping weapon/skill controls, landscape guard, readable HUD, and no tiny puzzle text. Desktop should support pointer lock plus ESC pause/settings.
- For story tone, use the existing "Last Human / robot escape horror" direction: short in-world labels, tense clues, and names that sound like places or systems, not puzzle implementation terms.
- If behavior changes can affect maintained campaign progression, run or update the focused real playthrough or build-official QA instead of relying only on build success. Do not revive Level 4+ QA as a default gate unless the user explicitly asks to rebuild those levels.
