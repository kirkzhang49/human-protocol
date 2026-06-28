# QA And Release

Use this when verifying Human Protocol changes.

## Core Commands

Run from the standalone repo root, for example `/Users/zhengkaizhang/Documents/human-protocol`.

```bash
npm run qa:build-official -- --level=level_01_maintenance_bay
npm run qa:build-official -- --level=level_02_residential_simulation
npm run smoke:campaign
npm run build
git diff --check
```

Meanings:

- `npm run qa:build-official -- --level=...`: focused builder-native official QA. Use for Level 1/2 source-shell, `/build`, runtime pack, door, puzzle, wave, or surface changes.
- `npm run qa:playthrough`: real campaign progression script. Use only when the maintained campaign route is intentionally changed or the user asks for full campaign-style proof.
- `npm run smoke:campaign`: config validation, graph reachability, smoke level checks, and fast runtime sanity.
- `npm run build`: TypeScript/Vite production build.
- `git diff --check`: catches whitespace and patch hygiene issues before commit.

For art, model, package, or platform work:

```bash
npm run art:qa
npm run build:platform
npm run check:budget
```

Use `art:qa` for visual key/asset manifest work. Use `build:platform` and `check:budget` before platform packaging or deploy discussions.

## Browser QA

After UI or renderer changes, start the dev server and inspect with the in-app Browser when available.

Useful URLs:

- `http://127.0.0.1:5173/?debug=0&level=level_01_maintenance_bay&lang=zh`
- `http://127.0.0.1:5173/?debug=0&level=level_02_residential_simulation&lang=zh`
- `http://127.0.0.1:5173/?debug=0&level=level_03_human_museum&lang=zh` when touching the museum exception
- `http://127.0.0.1:5173/?debug=0&level=smoke_big_screen_formula_combo&lang=zh`

Check both mobile landscape and desktop:

- HUD readability and no overlapping controls.
- Weapon buttons and skill/utility buttons stay separated on mobile.
- Pointer lock works during combat; ESC opens pause/settings.
- Language switch leaves no Chinese residue in English.
- Debug panels and raw IDs are hidden when `debug=0`.
- Door prompts trigger across the door area, not only a tiny point.
- Keys, pickups, screens, orbs, books, and panels are visible enough to understand.

## Real Playthrough Expectations

For current official work, prove the maintained slice: Level 1/2 builder-native official and Level 3 only when the museum exception is touched. Level 4+ are intentionally not default gates until rebuilt. Debug invulnerability is acceptable for puzzle QA, but scripts should still follow actual objectives:

- collect required weapons/items
- open doors by configured locks
- complete puzzles in configured order
- answer quizzes
- fight or simulate waves by configured triggers
- enter exits and advance to the next configured level once

If "next level" appears twice, an overlay stacks inside another overlay, or a level skips unexpectedly, inspect completion routing and modal state before touching copy.

## Common Failure Triage

- Missing key or invisible pickup: check `map.keyItems`, drop rules, `visualKey`, pickup radius, and objective guidance.
- Closed room with no path: check door `fromRoomId/toRoomId`, default state, lock, key location, and validator graph output.
- Puzzle validates but cannot be played: check target room positions, interaction radius, weapon accepted by puzzle, and room collision.
- English still shows Chinese: check config localization, static UI strings, and level text fallback.
- Third-party or downloadable file appears to players: check public routes, static docs links, and visible UI entry points.
- Build passes but game logic fails: update `qa:playthrough` or smoke configs so the bad path is reproduced.
