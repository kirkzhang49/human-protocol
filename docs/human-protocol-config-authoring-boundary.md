# Human Protocol Config Authoring Boundary

This document defines the style boundary between official/internal level configs and player/LLM-generated configs.

## Goal

Generated configs should create rooms, routes, objectives, puzzles, enemy pacing, story beats, and item placement without breaking the game's visual identity.

The game should feel like one consistent expensive facility. Generated content must not freely reskin every pickup, key, robot, panel, and weapon.

## Profiles

`LevelDefinition.authoringProfile` supports:

- `internal`: official hand-authored levels and smoke tests. Full config power is available.
- `generated`: local LLM/player-authored levels. Style control is constrained by `ConfigValidator`.

Custom imported packs are validated as `generated` even if the JSON claims `internal`.

## Allowed Generated Style Control

Generated levels may choose:

- room skin/floor/wall material from curated room kits
- room mood, pressure, and broad lighting accent
- door family from curated door skins/door visuals
- terminal state color from curated materials such as `terminal_cyan` and `terminal_red`
- puzzle orb color using the standard orb family
- enemy tier plus curated core/warning light, atlas, scale, and light intensity

## Fixed Object Families

Generated levels should not invent object styles. These stay consistent:

- repair kits and core cells: fixed crate/pickup family
- keys/access cards: curated key-card family only
- books/articles: archive book family
- keypads and quiz panels: direction keypad family
- big screens/TVs: terminal big-screen family
- puzzle targets: standard orb family
- robots: archetype + tier + curated light/atlas variants
- player weapons and arms: not controlled by level config

## Validator Enforcement

Generated validation currently checks:

- unknown visual/material/skin keys become errors
- key items must use curated key-card visuals
- pickups must use the fixed pickup family
- interactions must use allowed visuals for their interaction type
- puzzle targets must use puzzle-orb visuals matching their color
- code clues must use the digit decal family
- big screens must use the curated big-screen family
- generated enemy configs cannot recolor robot body/armor directly

This keeps enough freedom for procedural escape-room design while preserving art consistency.

