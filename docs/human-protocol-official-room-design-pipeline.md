# Human Protocol — Official Room Design Pipeline (AI level production)

Goal: a repeatable way to generate **high-quality, story-driven, mechanically
paced, verifiable** official rooms with `/build`, so we can eventually re-author
Level 1–10 instead of hand-writing config. This doc is the contract the next AI
follows. Everything here is grounded in the current code (paths cited inline).

> Audit anytime with `node scripts/tools/official-level-brief-audit.mjs` — it
> reads the live config + asset registry and prints exit/puzzle/story/combat,
> unresolved assets, and `/build`-rebuildability per level.

---

## 1. What `/build` can express today (the level grammar)

Source of truth: `src/build/BuilderTypes.ts` (`BuilderProject`), compiled by
`src/build/compileBuilderProjectToLevel.ts` into a runtime `LevelDefinition`
(`src/game/config/schema/levelConfig.ts`).

| Concept | `/build` field | Notes / values |
|---|---|---|
| Rooms | `rooms[]` | `style`: `maintenance \| sterile \| hazard \| residential \| exit \| museum \| core`; rectangular or shaped rooms; 2D center+size; per-room `env` (floor/wall/ceiling preset, color, height, ceiling visible) |
| Doors | `doors[]` | `lockType`: `none \| key_item \| survive_wave \| puzzle_complete`; `doorFamily`, `keyRoomId`, `puzzleKind`, `puzzleRoomId` |
| Exit | `exitRoomId` | compiled to the elevator exit + cinematic |
| Keys / pickups | `pickups[]` | `kind`: `key_item \| repairKit \| coreCell`; key items can be placed directly or granted by a puzzle |
| Puzzles | `puzzles[]` (`BuilderPuzzleInstance`) | `kind`: `color_sequence \| code_lock \| circuit_grid \| surveillance_match \| valve_matrix \| archive_merge \| gallery_reading`; `circuit_grid` compiles to runtime `tool_calibration`; `code_lock` is import/registry-aware but fresh generic authoring still needs compile/hint work |
| Route switches | `routeSwitches[]` | one key → 1–4 outputs (`open_door \| reveal_puzzle \| start_robots`) |
| Enemies | `robots[]` | `archetype`: `repair_drone \| clamp_bot \| shield_tech \| custodian_elite`; `count`, `tier`, optional position; official imports preserve wave trigger/reinforcement metadata |
| Wave chains | planned `/build` combat authoring | finite core waves clear doors or start the next wave; optional final pressure loop is never a door/open-exit condition. See `docs/human-protocol-build-wave-chain-authoring.md` |
| Furniture / props | `props[]` | `modelKey` from `src/build/BuilderAssetCatalog.ts` (`builderPropCatalog`), `rotationY`, `scale` |
| Story clue | `props[]` with group `故事线索` + `prop.story{title,clue,hint}` | live text; rendered as a lit wall screen in preview |
| Lighting | `lighting` | `ambient, keyColor, keyIntensity, fog, bloom, shadow` (one rig; clamped in `BuilderEnvironment.ts`) |
| Story shell | `story{templateId,victoryLine,transitionLine}` | facility-voice ending lines |
| Official source bridge | `sourceLevel` | imported built-in levels preserve rich fields such as `mapInteractions`, `puzzles`, `articles`, `switches`, `bigScreens`, `objectiveChain`, `events`, `environmentStates`, `dialogues`, `cinematicBeats`, `bossPhases`, and `presentation` so a draft can round-trip without silently deleting official-only metadata |

**First-class authoring gaps today**: fresh generic `code_lock` compile/hint flow,
`bigScreens` clue authoring, `environmentStates`, `bossPhases`, `choices`,
`quizzes`, `campaignRoutes`, generic (non-route) `switches`, runtime event
chains, wave-chain authoring, and objective-chain editing. `tool_calibration` is
**not** a missing runtime family for `/build`; it is authored through
`circuit_grid`, then compiled to runtime `tool_calibration`.

---

## 2. Difficulty curve: Level 1–10 (what each teaches)

Audit truth (`official-level-brief-audit.mjs`): every official level already has
exit ✅ / puzzle ✅ / story ✅ / combat ✅ and passes the validator with 0 errors.
The progression below is the *design intent* to preserve on rebuild.

| # | Level | New mechanic taught | Reuses | Player learns | Puzzle type(s) |
|---|---|---|---|---|---|
| 1 | 维修舱 maintenance_bay | move, interact, first locked door, first wave | — | the interact loop + “solve to open” | circuit_grid |
| 2 | 居住模拟间 residential_simulation | key-item door, branching `choices`, more rooms | doors, waves | keys gate space; choices fork story | surveillance_match |
| 3 | 人类博物馆 human_museum | multi-puzzle hub (3), tool_calibration, story density | keys, waves | reading the room for clues | tool_calibration, hit_sequence, surveillance_match |
| 4 | 记忆诊所 memory_clinic | `code_lock` + `bigScreens` hints, valve_matrix | keys, choices | screens feed the lock | code_lock, valve_matrix |
| 5 | 回收核心 reclamation_core | `quizzes`, biggest map (8 rooms), 3 puzzles | everything | synthesis / mid-campaign exam | hit_sequence, circuit_grid, valve_matrix |
| 6 | 霓虹前厅 cyberpunk_foyer | tone shift (neon), tight 3-room slice | circuit_grid | re-entry, compact pacing | circuit_grid |
| 7 | 监控档案区 surveillance_hub | surveillance match focus | doors, waves | observe-then-match | surveillance_match |
| 8 | 配电管廊 power_district | route/power chaining (2 puzzles) | circuit/valve | routing power across rooms | circuit_grid, valve_matrix |
| 9 | 伪宅黑市 counterfeit_home | identity/code reveal | surveillance | deception/identity beat | surveillance_match, code_lock |
| 10 | 黑诊所核心 black_clinic_core | finale: 3 puzzles + boss | all puzzles | mastery + boss | valve_matrix, circuit_grid, surveillance_match |

**Lowest-risk `/build` official v2 slices today: L6, L7, L8.** That does not
mean the editor is limited to those levels: built-in L1-L10 can already import
as editable drafts, and rich official metadata can round-trip through
`sourceLevel`. The remaining blockers are first-class authoring gaps, especially
fresh `code_lock` + bigScreen clue flow, `choices`, `quizzes`, and full
`bossPhases` editing. `tool_calibration` is already covered through
`circuit_grid`.

---

## 3. Per-level design anchors

Theme / space / core puzzle / exit logic / combat pressure / hero asset:

- **L1 维修舱** — facility wakeup; cramped maintenance; circuit_grid opens the
  bay door; exit = elevator after first wave; pressure low (tutorial); hero:
  fuse box + maintenance cabinet.
- **L2 居住模拟间** — uncanny “home”; apartment loop; surveillance_match; key door
  + a story choice; pressure rising; hero: fake family photo wall.
- **L3 人类博物馆** — exhibition of “humans”; 7-room hub; 3 puzzles gate one exit;
  pressure medium; hero: museum display cases / archive columns.
- **L4 记忆诊所** — clinical horror; code_lock fed by bigScreen hints + valve;
  pressure medium-high; hero: clinic beds / amber archive screens.
- **L5 回收核心** — industrial recycling; 8-room synthesis + quiz; pressure high;
  hero: reclamation machinery.
- **L6 霓虹前厅** — neon foyer re-entry; 3 rooms; circuit_grid; single sweep wave;
  hero: neon mural (story clue).
- **L7 监控档案区** — surveillance archive; observe-then-match; light combat;
  hero: camera mast + monitor wall.
- **L8 配电管廊** — power conduits; route power via circuit + valve; hero: power
  bus / conduits.
- **L9 伪宅黑市** — counterfeit home market; identity reveal via code; hero: forged
  family portraits.
- **L10 黑诊所核心** — finale core; 3 puzzles + boss; hero: surgeon boss rig.

---

## 4. Rules the AI MUST follow (enforced by the validator)

These map 1:1 to `src/game/config/validation/*` error codes — a generated level
is rejected if it breaks them. Run `npm run qa:builder` + import into `/build`.

- **Must have a reachable exit.** `map.exit.unreachable`,
  `graph.exit.unreachable.locked`, `graph.exit.interaction.blocked`.
- **No self-lock.** `key.behind.own.lock` (a key cannot sit behind the door it
  opens); `graph.interaction.self_blocked` (an interaction can’t require an
  objective only it completes); `graph.critical_door.blocked`.
- **No premature mechanics/enemies.** Waves/robots start via wave triggers /
  route `start_robots`, never spawned pre-objective; puzzle reveals gate on the
  graph (`graph.puzzle.unreachable`). Don’t place a machine/enemy that the golden
  path reaches before its trigger.
- **Every lock needs a valid target.** `door.lock.key.missing`,
  `door.lock.puzzle.missing`, `door.lock.wave.missing`, `door.lock.choice.missing`.
- **No placeholder/unknown assets** (generated profile is gated):
  `authoring.generated.visual.disallowed/unknown/primitive`,
  `authoring.generated.material.disallowed/unknown`. Only curated
  `builderPropCatalog` / environment model keys. Audit flags `unresolved-assets`.
- **No mobile UI overflow / over-complex nav.** `navigation.mobile.complex`
  warns when the room graph is too dense for the mobile minimap; keep branching
  modest. (Image2 plates carry **no baked text** — live React/CSS only; see
  `docs/human-protocol-wgpu-lab-lighting-mix-plan.md`.)
- **Have objectives.** `objectives.missing` warns when there’s no objective chain.

---

## 5. Recommended `/build` → official config flow

1. **Seed from an existing level (optional).** `/build?fromLevel=<id>` →
   `builderProjectFromBuiltInLevel(levelId)` (`src/build/BuilderLevelImport.ts`)
   imports a built-in level into a `BuilderProject` (drops the unsupported
   features in §1 — that’s expected for a rebuild).
2. **Author** rooms/doors/keys/puzzles/route-switches/robots/props/lighting in
   `/build`. Keep the golden path linear-ish; gate the exit behind the core
   puzzle/key.
3. **Playtest in-editor.** 快速生成 (fast / proxy pack) for layout; 深度烘焙
   (deep / cooked-glb) for real furniture & lighting
   (`generateBuilderPlaytestPack`, modes `fast|deep`).
4. **Validate.** The editor runs `validateLevelConfig`
   (`src/game/config/ConfigValidator.ts`); fix all errors, review warnings.
5. **Export.** `compileBuilderProjectToLevel(project)` → `LevelDefinition`;
   `createSingleLevelConfigPack(level)` (`ConfigPackStore.ts`) wraps it as a
   custom pack (saved to the custom-pack store; **does not** touch the official
   pack).
6. **Promote to official (manual, reviewed).** Only when approved: add the
   compiled `LevelDefinition` as a new file under `src/game/config/levels/…` and
   register it in `humanProtocolBasePack` (`ConfigPackStore.ts`). **Never
   overwrite the existing Level 1–10 definitions** — add alongside (e.g. a `-v2`
   id) until a deliberate swap.
7. **Re-run acceptance** (§6) + `npm run smoke:campaign`.

---

## 6. Per-level acceptance checklist

A level is shippable when ALL pass:

- [ ] `validateLevelConfig` → 0 errors (warnings triaged).
- [ ] Audit row: exit ✅ puzzle ✅ story ✅ combat ✅, `unresolved-assets=0`.
- [ ] Golden path reaches the exit; exit is locked behind the intended gate.
- [ ] No self-lock / no orphaned key / no door with no opener.
- [ ] Each puzzle is reachable only after its prerequisites; no enemy/machine
      triggers before its beat.
- [ ] All props use curated `builderPropCatalog` / environment keys (no
      placeholders); deep-bake playtest shows real models, not proxies.
- [ ] Story: at least one story-clue prop or article + a facility-voice victory
      line; **no baked text in Image2**.
- [ ] Mobile: no `navigation.mobile.complex`; `/build` 1440×900 catalog/preview
      no horizontal overflow; quick playtest readable.
- [ ] Combat budget within `combatLimits`; first wave not at spawn instant.
- [ ] `npx tsc -b`, `npm run qa:builder`, `npm run smoke:campaign`,
      `git diff --check` all clean.
- [ ] Screenshots saved to `.tmp/` (build 2D/3D, one puzzle overlay on dark and
      lit backgrounds, quick playtest with ceiling/door/elevator/puzzle/pickup).

---

## 7. Needs engine / editor support (gap backlog)

To make L1–L5, L9, L10 fully `/build`-authorable:
- fresh `code_lock` authoring + bigScreen clue binding — blocks L4,L9 style rebuilds.
- `choices` (branching story events) — blocks L2,L4.
- `quizzes` (article + quiz gate) — blocks L5.
- wave-chain authoring (finite core waves, clear-to-open doors, optional non-blocking pressure loop) — needed before treating boss phases as generic.
- `bossPhases` authoring (boss encounter rig) — blocks full L10-style finale rebuilds and any future boss-heavy official slice.
- generic non-route `switches`, runtimeEvents action chains, and objectiveChain editing — needed for richer official parity beyond route switches.
- `environmentStates` and first-class `bigScreens` authoring — currently preserved on import but not fully new-authored.
- Optional, droppable on rebuild (no field today, but a level plays without them):
  `campaignRoutes` (campaign meta) and some presentation-only atmosphere beats.

Until then, the **lowest-risk vertical slice** is L6 + L7 (both compact, two
distinct puzzle families, 3–4 rooms each), followed by L8 to exercise
`circuit_grid -> tool_calibration` plus `valve_matrix`. See
`.tmp/official-room-redesign/level01-10-first-pass.md`.
