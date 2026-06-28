# Human Protocol — Level Brief Template (AI-fillable)

Copy this whole block per level. Fill every field. It is the input contract for
an AI that will author a `/build` project, validate it, and (after review)
promote it to an official `LevelDefinition`. Read
`docs/human-protocol-official-room-design-pipeline.md` first — it defines what
`/build` can express and the validator rules referenced as `[rule]` below.

Only use mechanics in §1 of the pipeline doc. Anything else → tag
`NEEDS ENGINE SUPPORT:` and leave out of the buildable spec.

---

```yaml
# ── Identity ───────────────────────────────────────────────
level_id: level_07_surveillance_hub_v2        # snake_case, unique; never reuse an official id you intend to keep
level_name_cn: 监控档案区                       # player-facing Chinese name
level_name_en_internal: Surveillance Hub       # internal English label
authoring_profile: generated                   # generated (asset-gated) | internal
campaign_slot: 7                               # 1-10 design slot it targets (does NOT overwrite official until promoted)

# ── Emotional beat ─────────────────────────────────────────
emotional_beat: >
  Being watched, then realizing the watcher was never connected. Dread → cold
  recognition. One archive-voice victory line lands the twist.
tone_tags: [clinical, surveillance, quiet-dread]

# ── Room graph ─────────────────────────────────────────────
# List rooms (id, cn label, style maintenance|sterile|hazard|residential|exit,
# approx size mxm) and doors (from→to, lock none|key_item|survive_wave|puzzle_complete).
rooms:
  - { id: hub_spawn,   label: 接待廊,   style: sterile,    size: "8x6" }
  - { id: hub_monitor, label: 监控墙,   style: hazard,     size: "10x8" }
  - { id: hub_archive, label: 档案室,   style: residential,size: "8x6" }
  - { id: hub_exit,    label: 撤离梯,   style: exit,       size: "6x5" }
doors:
  - { id: d_a, from: hub_spawn,   to: hub_monitor, lock: none }
  - { id: d_b, from: hub_monitor, to: hub_archive, lock: key_item, key_room: hub_archive }   # ⚠ key must NOT be behind its own door [key.behind.own.lock]
  - { id: d_exit, from: hub_monitor, to: hub_exit, lock: puzzle_complete, puzzle_kind: surveillance_match }

# ── Golden path ────────────────────────────────────────────
golden_path: >
  spawn → monitor wall (read cameras) → grab archive key → solve surveillance_match
  at the exit console → exit. Exit gated behind the surveillance puzzle. [graph.exit.unreachable.locked]

# ── Optional loop ──────────────────────────────────────────
optional_loop: >
  Archive side-room holds a story-clue portrait + a coreCell pickup; skippable.

# ── Puzzle chain ───────────────────────────────────────────
# kinds: color_sequence | circuit_grid | surveillance_match | valve_matrix | archive_merge | gallery_reading
# (code_lock / tool_calibration = NEEDS ENGINE SUPPORT)
puzzles:
  - { id: pz_watch, kind: surveillance_match, room: hub_monitor, gates_door: d_exit }

# ── Key / door / exit chain ────────────────────────────────
key_door_exit_chain: >
  archive_key (in hub_archive) → unlocks d_b → reach exit console → surveillance
  puzzle complete → d_exit opens → elevator exit. No self-locks. [door.lock.*]

# ── Enemy budget ───────────────────────────────────────────
# archetypes: repair_drone | clamp_bot | shield_tech | custodian_elite
enemy_budget:
  waves: 1
  groups:
    - { room: hub_monitor, archetype: clamp_bot, count: 2, trigger: after_key_pickup }  # never spawn at t=0 on spawn
  pressure: low-medium

# ── Asset list (must exist in builderPropCatalog / environment registry) ──
assets_used:
  - room_museum_wall_label_panel
  - camera/monitor props (confirm exact modelKey in builderPropCatalog)
assets_missing:               # tag for later production; do NOT placeholder
  - NEEDS ASSET: dedicated surveillance monitor-bank prop (else reuse existing)

# ── Image2 GUI / decal needs ───────────────────────────────
image2_needs: >
  Reuse existing puzzle-machine + overlay Image2. NO baked text. Any new decal
  follows the depthWrite-false / polygon-offset / toneMapped-false rule and the
  sceneAwareUiTokens readability math (lighting-mix-plan doc).

# ── Audio needs ────────────────────────────────────────────
audio_needs: >
  Existing puzzle/door/exit cues; one threat sting on wave start. No new SFX
  required for first pass.

# ── Validation commands ────────────────────────────────────
validation:
  - npx tsc -b --pretty false
  - npm run qa:builder
  - node scripts/tools/official-level-brief-audit.mjs   # confirm exit/puzzle/story/combat, unresolved-assets=0
  - npm run smoke:campaign                               # only after promotion to the pack
  - git diff --check

# ── Screenshots required (save under .tmp/) ────────────────
screenshots:
  - /build 1440x900 (2D + 3D preview + right story/lighting panel, no overflow)
  - quick playtest room with ceiling + door + elevator + puzzle console + pickup
  - the puzzle overlay on BOTH a dark and a lit background (text readable)

# ── Acceptance (all must pass) ─────────────────────────────
acceptance:
  - reachable exit, exit locked behind intended gate
  - no self-lock / orphan key / opener-less door
  - no premature enemy/machine before its trigger
  - all assets curated (no placeholders), deep-bake shows real models
  - >=1 story clue + facility victory line, no baked text in Image2
  - validator 0 errors; tsc/qa:builder/smoke/diff clean
```

---

### How to use this template (for the authoring AI)

1. Fill the YAML above. Resolve every `confirm exact modelKey` against
   `src/build/BuilderAssetCatalog.ts`. Tag truly-missing assets, never
   placeholder.
2. Translate it into a `BuilderProject` (`src/build/BuilderTypes.ts`) — rooms,
   doors, pickups, puzzles, robots, props, lighting, `exitRoomId`.
3. Validate + playtest per §5 of the pipeline doc; iterate until the validator is
   error-free and the audit row is all-✅.
4. Stop at the custom-pack stage (`createSingleLevelConfigPack`) and hand back for
   review **before** any change to `humanProtocolBasePack`.
