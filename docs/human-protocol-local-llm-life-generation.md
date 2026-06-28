# Human Protocol Local LLM Life Generation

## 1. Core Idea

The long-term Steam version should not ask a local model to generate an entire game in one shot.

The stable structure is:

```text
player sentence
-> LifeOutline
-> one level config at a time
-> validator
-> repair loop
-> smoke simulation
-> playable level
-> player choices and performance summary
-> next level config
```

This lets a small local model, such as Qwen3-4B with a project LoRA, behave like a reliable director inside a strict game engine instead of pretending to be an unlimited game developer.

The model creates intent and draft content. The runtime, templates, validator, and fallback system make the result playable.

## 2. Product Structure

### Steam Main Game

The hand-made campaign is still the trust anchor.

```text
Prologue:
  5 levels
  player discovers they are not human

Route A:
  Preserve Human Layer
  10 levels

Route B:
  Accept Maintenance
  10 levels

Route C:
  Rebuild Humanity
  10 levels
```

The three official routes should be authored by us, then expressed in the same config format used by generated levels. They become both the real game and the training examples for the local model.

### Custom Life Mode

After the 5-level prologue, the player can choose:

```text
Preserve Human Layer
Accept Maintenance
Rebuild Humanity
Custom Life
```

Custom Life lets the player type something like:

```text
I want to experience a life where I betrayed my only friend and the repair system makes me relive it.
```

The local model first generates a full outline, then generates only the next level when needed.

## 3. Why Outline First

Generating one full 10-level route as complete playable configs is too risky for a 4B model:

- it forgets long-term foreshadowing
- it makes broken door/key/puzzle dependencies
- it repeats rooms and emotional beats
- it produces too much invalid JSON
- it cannot judge combat pacing well

Generating an outline first solves most of that:

- the long-term story is stored outside the model
- each level has one clear emotional target
- each level can be validated separately
- player choices can affect future levels naturally
- failed generation only loses one level, not the whole route

## 4. Main Data Objects

### LifeOutline

`LifeOutline` is the high-level story plan for a generated life.

```ts
export type LifeRouteTone = "human_layer" | "repair_logic" | "rebuild_human" | "unknown_signal";

export type LifeOutline = {
  schemaVersion: "hp.life_outline.v1";
  id: string;
  title: string;
  playerPrompt: string;
  routeTone: LifeRouteTone;
  totalLevels: number;
  theme: string;
  coreMemoryLie: string;
  endingPromise: string;
  forbiddenReveals: string[];
  recurringSymbols: string[];
  robotDirectorVoice: string;
  levels: LifeOutlineLevel[];
};

export type LifeOutlineLevel = {
  index: number;
  title: string;
  emotionalBeat: string;
  roomFantasy: string;
  gameplayTemplate: LevelTemplateId;
  requiredReveal: string;
  optionalTwist?: string;
  bossRole?: string;
  preferredRobotTiers: Array<"normal" | "elite" | "leader" | "boss">;
  puzzleMotif: "key_door" | "color_sequence" | "direction_code" | "memory_choice" | "three_lock_arms";
  exitPromise: string;
};
```

### LifeRunState

`LifeRunState` is the saved state of a player's generated life.

```ts
export type LifeRunState = {
  outlineId: string;
  currentLevelIndex: number;
  completedLevelSummaries: GeneratedLevelSummary[];
  routeScores: {
    human_layer: number;
    repair_logic: number;
    rebuild_human: number;
    unknown_signal: number;
  };
  playerPatterns: {
    combatStyle: "melee_first" | "gun_first" | "avoidant" | "mixed";
    puzzleStyle: "fast" | "careful" | "error_prone";
    deathCount: number;
    reviveCount: number;
  };
};
```

### GeneratedLevelBrief

The model should generate a brief before generating the actual level config.

```ts
export type GeneratedLevelBrief = {
  outlineId: string;
  levelIndex: number;
  title: string;
  emotionalGoal: string;
  playerShouldLearn: string;
  roomPlan: Array<{
    roomId: string;
    purpose: "safe" | "combat" | "puzzle" | "boss" | "exit";
    visualTheme: string;
    clueRole?: string;
  }>;
  lockPlan: Array<{
    lockId: string;
    opens: string;
    requires: string;
  }>;
  combatPlan: Array<{
    roomId: string;
    pressure: "low" | "medium" | "high";
    enemyMix: string;
  }>;
};
```

Only after the brief passes cheap validation should the model generate `LevelDefinition`.

## 5. Generation Pipeline

### Step 1: Player Prompt Normalization

Input:

```text
I want a life about being abandoned by my family.
```

Output:

```json
{
  "theme": "abandonment",
  "routeTone": "human_layer",
  "contentIntensity": "psychological_horror",
  "recommendedTotalLevels": 5,
  "forbiddenContent": []
}
```

Fallback:

If the model cannot classify the prompt, use a generic theme:

```text
theme = identity fracture
routeTone = unknown_signal
totalLevels = 3
```

### Step 2: Generate LifeOutline

The model creates the whole life outline, not full configs.

Rules:

- every level must have one emotional beat
- every level must have one gameplay template
- reveals must escalate, not repeat
- final reveal must connect to the player's original sentence
- no level can depend on a custom asset that does not exist

Fallback:

If the outline fails validation twice, use a fixed 3-level fallback outline:

```text
Level 1: The Room That Knows Your Name
Level 2: The Door That Repairs Your Memory
Level 3: The Machine That Calls You Human
```

### Step 3: Generate One Level Brief

For the next unplayed level, provide:

- `LifeOutline`
- completed level summaries
- route scores
- available room templates
- available robot archetypes
- available puzzle templates
- performance budget

The model outputs `GeneratedLevelBrief`.

Fallback:

If the brief creates an impossible lock chain, replace only the lock plan with a known safe template.

### Step 4: Generate LevelDefinition

The model generates the actual `LevelDefinition`.

Rules:

- only use known `visualKey`, `materialKey`, `archetypeId`, `tier`, `gameplayTemplate`
- enemy counts are pressure tags, not free numbers
- every locked door must have a reachable unlock source
- every key item must be either placed in a reachable room or dropped by a reachable enemy
- every puzzle must have visible clue surfaces
- every level must have an exit interaction

### Step 5: Validate and Repair

The existing `ConfigValidator` should be extended into a generation gate.

Validation layers:

```text
Schema validation
Reference validation
Room graph reachability
Lock/key dependency validation
Puzzle solvability validation
Enemy budget validation
Mobile/desktop ergonomics validation
Localization completeness warning
```

Repair loop:

```text
attempt 1:
  ask model to repair from validator errors

attempt 2:
  freeze room graph, ask model to repair only broken references and locks

attempt 3:
  replace puzzle/lock chain with safe template

attempt 4:
  use full fallback level template, keep only title/theme/dialogue
```

### Step 6: Smoke Simulation

Before the player sees the level, run a fast simulation:

```text
load level
start game
complete required pickups
open required doors
solve puzzle using expected answers
defeat required wave/boss
unlock exit
enter exit
reach victory/transition
```

If smoke fails:

- do not show the broken level
- run repair again
- if still failing, use fallback template

### Step 7: Post-Level Summary

After a player finishes a generated level, summarize:

```ts
export type GeneratedLevelSummary = {
  levelIndex: number;
  title: string;
  outcome: "completed" | "abandoned";
  keyMemory: string;
  playerChoice?: string;
  routeDelta: Partial<Record<LifeRouteTone, number>>;
  deaths: number;
  reviveUsed: boolean;
  combatStyle: "melee_first" | "gun_first" | "avoidant" | "mixed";
  puzzleErrors: number;
  nextLevelSeed: string;
};
```

This summary becomes part of the prompt for the next level.

## 6. Qwen3-4B LoRA Responsibility

Qwen3-4B LoRA should do:

- classify player prompt into theme and route tone
- generate `LifeOutline`
- generate one `GeneratedLevelBrief`
- generate one `LevelDefinition`
- repair validator errors
- write short Chinese and English copy
- select robot archetype/tier from a fixed registry
- create route-aware dialogue variants

Qwen3-4B LoRA should not do:

- real-time enemy AI
- frame-by-frame director control
- combat balance math
- arbitrary 3D asset generation
- unrestricted map editing
- final authority on whether a level is playable
- long-form official campaign writing without human review

## 7. Hardest Tasks and Fallbacks

| Task | Why Hard For 4B | Fallback |
| --- | --- | --- |
| 10-level story consistency | long memory and foreshadowing are fragile | store `LifeOutline` and per-level summaries outside the model |
| door/key/puzzle graph | references and dependency chains break easily | template lock graphs + graph validator |
| combat pacing | model cannot feel FPS timing | pressure tags mapped to fixed spawn tables |
| strict JSON | small models leak prose or omit fields | constrained output + schema + repair |
| high-quality horror writing | text can become generic | hand-authored route bible + glossary + rewrite prompt |
| custom life abstraction | player prompts can be vague | classify into theme library first |
| localization | translation may drift terms | project glossary + localized copy validator |
| performance budget | model may spawn too many things | budget clamp after generation |

## 8. Template Library

The model should not invent level mechanics from nothing. It should choose and combine templates.

Initial templates:

```text
safe_room_intro
key_door_boss_key
color_orb_sequence
direction_code_four_rooms
infinite_hall_escape
three_lock_arms
memory_chair_choice
boss_arena_exit_unlock
resource_scavenge
false_home_simulation
```

Each template needs:

- room count range
- required interactions
- required puzzle type
- allowed enemy pressure
- default objective chain
- fallback map layout
- mobile readability notes
- desktop readability notes

## 9. Robot Registry

The model should select from robot templates created by Wgpu Robot Lab.

Example registry entry:

```ts
export type RobotTemplate = {
  id: string;
  displayName: string;
  roles: Array<"maintenance" | "medical" | "clamp" | "security" | "archive" | "boss_platform">;
  allowedTiers: Array<"normal" | "elite" | "leader" | "boss">;
  gameplayTags: Array<"fast" | "tank" | "ranged" | "melee" | "summoner" | "objective_guard">;
  visualTags: Array<"white_medical" | "hazard_yellow" | "red_core" | "glass_face" | "industrial_forklift">;
  performanceCost: 1 | 2 | 3 | 4 | 5;
};
```

The model can say:

```json
{
  "robotTemplateId": "repair_clamp_bot",
  "tier": "elite",
  "roleInStory": "It holds doors open only after replacing the player's memory."
}
```

The runtime decides final stats, LOD, and spawn limits.

## 10. Local Model Packaging

Recommended model tiers:

```text
Low Memory:
  Qwen 1.5B/2B class
  template variants and simple one-level generation

Default:
  Qwen3-4B LoRA
  custom life outline + one-level generation

High Quality:
  Qwen 7B/8B LoRA or no-LoRA model with stronger prompt
  better prose and longer route planning
```

The Steam build should not require the high-quality model.

Recommended packaging:

```text
Base game:
  official campaign
  config runtime
  validator
  template library

Optional Local AI Pack:
  default 4B quantized model
  LoRA adapter
  prompt examples

Optional High Quality AI Pack:
  7B/8B model
```

The game must remain playable without the model.

## 11. Training Data Plan

Do not train from scratch.

Use:

```text
base model
+ project LoRA / QLoRA
+ strict prompts
+ validator repair loop
```

Training examples should be structured:

```text
player prompt -> normalized theme
theme -> LifeOutline
LifeOutline + level index -> GeneratedLevelBrief
GeneratedLevelBrief -> LevelDefinition
validator errors -> repaired LevelDefinition
Chinese copy -> English copy with glossary
robot registry + story role -> enemy wave config
```

Dataset milestones:

```text
MVP:
  100-300 high-quality examples
  enough to prove style and schema following

Good default:
  800-1500 examples
  enough to improve repair and template selection

Steam-ready:
  3000-5000 examples
  includes bad configs, repair examples, route summaries, localization pairs
```

The official 35-level campaign should be converted into training data after it is stable.

## 12. Prompt Roles

Use separate prompts instead of one giant prompt.

### Story Planner

Input:

- player sentence
- route tone choices
- theme library
- content limits

Output:

- `LifeOutline`

### Level Director

Input:

- `LifeOutline`
- current level beat
- completed summaries
- available templates
- robot registry

Output:

- `GeneratedLevelBrief`
- then `LevelDefinition`

### Repair Agent

Input:

- invalid `LevelDefinition`
- validator errors
- allowed repair scope

Output:

- patched `LevelDefinition`

### Summarizer

Input:

- completed level state
- player choices
- deaths
- puzzle errors

Output:

- `GeneratedLevelSummary`

## 13. Loading Screen as Fiction

Local generation time should become part of the game mood.

Example:

```text
Local protocol rebuilding the next memory...
Selecting room shell: apartment corridor / repair ward / archived classroom
Assigning maintenance units...
Checking if the exit can still be reached...
Validating that the subject still believes the story...
```

This turns waiting into atmosphere instead of a technical delay.

## 14. Minimum MVP

The first useful version does not need full 10-level generated lives.

MVP target:

```text
1. player enters one sentence
2. game generates a 3-level LifeOutline
3. game generates level 1 only
4. validator repairs it
5. player plays level 1
6. game summarizes player outcome
7. game generates level 2 from the summary
```

Success criteria:

- generation never produces an unplayable white screen
- every generated level has an exit
- every lock has a reachable unlock
- every puzzle has a visible clue
- combat budget never exceeds performance limits
- generated text feels like Human Protocol, not generic sci-fi

## 15. Implementation Phases

### Phase 1: Data Shapes

- add `LifeOutline`
- add `LifeRunState`
- add `GeneratedLevelBrief`
- add `GeneratedLevelSummary`
- save generated lives to localStorage first

### Phase 2: Template Library

- encode 5-8 safe templates
- each template outputs a partial `LevelDefinition`
- model fills theme, copy, room labels, robot choices

### Phase 3: Validator Gate

- split validator into public generation API
- return machine-readable repair instructions
- add smoke simulation status

### Phase 4: Local Model Adapter

- start with external local server API
- support mock model for QA
- support Qwen3-4B prompt mode before LoRA
- add LoRA later

### Phase 5: One-Level Custom Life

- generate one playable custom level
- save it as custom config pack
- let player replay/export/delete

### Phase 6: Sequential Life

- generate outline
- generate level 1
- summarize outcome
- generate level 2
- continue until ending

### Phase 7: Steam Packaging

- make AI model optional
- add low-memory mode
- add high-quality model pack later
- make base campaign playable without local AI

## 16. Non-Negotiable Design Rules

1. The model never bypasses validator.
2. The model never directly controls runtime combat.
3. The model never spawns unlimited enemies.
4. The model never chooses unknown assets.
5. The model never ships a level without smoke simulation.
6. The official campaign is hand-authored first.
7. Generated levels use the same config format as official levels.
8. Broken generated levels fall back to safe templates.
9. Player waiting time is presented as in-world protocol generation.
10. The game remains playable without any local model installed.

## 17. Next Best Step

The next best implementation step is:

```text
Create LifeOutline schema + generated life save slot + 3 safe template definitions.
```

Do not connect the real local model first.

First prove that a mock generator can:

```text
player sentence
-> LifeOutline
-> level 1 template config
-> validator
-> smoke pass
-> save custom generated level
```

Once that path is stable, plug Qwen3-4B into the same adapter.
