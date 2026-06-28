# Human Protocol Config Systems

This reference maps the current data-driven level vocabulary. Use it when adding or repairing config-driven content.

## Main Schema

Primary type: `games/human-protocol/src/game/config/schema/levelConfig.ts`.

High-value `LevelDefinition` areas:

- `map.rooms`: room bounds, labels, mood, material keys, collision/wall rendering, aesthetic skin.
- `map.doors`: room links, door position, size, lock type, messages, visual/material keys.
- `map.interactions`: terminals, exits, articles, quizzes, big screens, keypads, memory echoes, switches.
- `map.keyItems`: keys placed in rooms or dropped by enemies/waves.
- `map.pickups`: repair kits, core cells, other resources.
- `map.navigation`: critical path, optional rooms, mobile-readable door count, backtracking budget.
- `objectiveChain`: HUD objective order and completion conditions.
- `waves`: enemy groups, triggers, reinforcements, rewards, elite/boss tiers.
- `runtimeEvents`: generic trigger -> action chains.
- `puzzles`: `hit_sequence` and `code_lock`.
- `articles` and `quizzes`: reading, question gates, wrong-answer waves, correct-answer actions.
- `switches`: room switch state machines that can open/close/lock/unlock doors.
- `bigScreens`: diegetic TV/terminal clues with stateful displays.
- `environmentStates`, `bossPhases`, `presentation`: pacing, pressure, dialogue, alerts.

## Runtime Actions

`LevelRuntimeEventAction` is the shared "do something" language. Use actions instead of adding level-specific logic.

Important actions include:

- `open_door`, `close_door`, `unlock_door`, `lock_door`
- `grant_key_item`
- `start_wave`
- `complete_objective`
- `unlock_exit`
- `queue_dialogue`
- `set_environment_state`
- `set_big_screen_state`
- `camera_impact`
- memory/upgrade actions such as `add_memory` and `open_upgrade`

Whenever adding an action type, update schema, `GameWorld.runConfiguredAction`, `ConfigValidator.validateRuntimeEventAction`, graph simulation, and smoke QA.

## Puzzle Config

Use `hit_sequence` when the player attacks visible targets in a specific order. The clue can be environmental and split across rooms.

```ts
{
  id: "core_three_color_path",
  type: "hit_sequence",
  roomId: "core_lock_room",
  clue: {
    type: "environment_marking",
    sequence: ["blue_orb", "yellow_orb", "red_orb"],
    revealOnRoomEnter: true,
    surfaces: [
      { id: "entry_floor_path", roomId: "hint_room", surface: "floor", sequence: ["blue_orb", "yellow_orb"] },
      { id: "side_wall_mark", roomId: "side_room", surface: "wall", sequence: ["red_orb"] }
    ]
  },
  targets: [
    { id: "blue_orb", roomId: "core_lock_room", colorKey: "blue" },
    { id: "yellow_orb", roomId: "core_lock_room", colorKey: "yellow" },
    { id: "red_orb", roomId: "side_room", colorKey: "red" }
  ],
  success: {
    actions: [
      { type: "open_door", doorId: "core_gate" },
      { type: "complete_objective", objectiveId: "solve_core_three_color_path" }
    ]
  }
}
```

Use `code_lock` when a keypad accepts a fixed, direction-room-digit, or formula-derived answer. Formula answers must use the safe arithmetic evaluator path, not `eval`.

```ts
{
  id: "clinic_formula_code",
  type: "code_lock",
  interactionId: "clinic_keypad",
  code: {
    source: "formula",
    formula: {
      expression: "3 + 8 - 5",
      display: "3 + 8 - 5 = 6",
      answer: "386",
      padLength: 3,
      resultMode: "first_digits"
    }
  },
  input: { length: 3 },
  success: { opensDoorId: "theater_door" }
}
```

## Big Screens

`bigScreens[]` is the reusable TV/terminal clue system. A screen can show `off`, `digits`, `color_sequence`, `formula`, or `text`. It can be activated by interacting with it or by runtime actions.

```ts
{
  id: "body_formula_screen",
  roomId: "body_room",
  interactionId: "body_screen_interaction",
  initialStateId: "off",
  activationStateId: "formula_hint",
  modelKey: "terminal_puzzle_big_screen",
  visualKey: "terminal_puzzle_big_screen",
  states: [
    { id: "off", mode: "off", powered: false },
    {
      id: "formula_hint",
      mode: "formula",
      powered: true,
      formula: { expression: "3 + 8 - 5", display: "3 + 8 - 5 = 6", answer: "6" }
    }
  ]
}
```

One screen can show one number, several digits, a formula, a color order, or short text. Prefer making screen content runtime-rendered instead of baking clue text into a model.

## Articles And Quizzes

Use `articles[]` for readable story documents and `quizzes[]` for gated comprehension. Wrong answers can spawn waves; correct answers can start bosses, open doors, or complete objectives.

```ts
{
  id: "last_human_check",
  roomId: "archive_room",
  interactionId: "archive_quiz_panel",
  articleId: "last_human_file",
  options: [
    { id: "truth", label: "The subject protected the experiment.", correct: true },
    { id: "lie", label: "The subject never entered the lab.", correct: false }
  ],
  wrongAnswer: {
    actions: [{ type: "start_wave", waveId: "archive_wrong_answer_wave", repeat: true }]
  },
  correctAnswer: {
    actions: [{ type: "start_wave", waveId: "reclamation_boss_wave" }]
  }
}
```

Keep quiz options at 3-5 choices for mobile readability.

## Switches

Use `switches[]` for future maze logic. A state can open some doors and close others. The maintained official slice should prove only the systems it actively uses; Level 4+ are not default coverage targets until rebuilt, so smoke configs should prove reusable switch behavior.

```ts
{
  id: "reroute_switch",
  roomId: "control_room",
  interactionId: "reroute_switch_panel",
  initialStateId: "north_open",
  oneShot: false,
  states: [
    { id: "north_open", label: "North line", actions: [{ type: "open_door", doorId: "north_gate" }, { type: "close_door", doorId: "east_gate" }] },
    { id: "east_open", label: "East line", actions: [{ type: "close_door", doorId: "north_gate" }, { type: "open_door", doorId: "east_gate" }] }
  ]
}
```

## ID Conventions

- Use stable, descriptive IDs: `level_04_body_formula_screen`, `level_05_last_human_check`.
- Prefix official level content with `level_XX`.
- Prefix smoke/sample levels with `smoke_`.
- State references may use compound IDs such as `screen_id:state_id`; validators and objectives should understand those pairs.
- Player-facing labels should be short and in-world. Avoid raw implementation names like "three-lock door" or "demo continue".
