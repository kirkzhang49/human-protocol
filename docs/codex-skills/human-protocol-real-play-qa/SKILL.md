---
name: human-protocol-real-play-qa
description: Use when QAing Human Protocol levels, campaign flow, puzzle rooms, or mobile/desktop game progression. Runs the real 1-5 playthrough script with local no-damage debug mode, then follows with smoke/build/browser checks.
---

# Human Protocol Real Play QA

## Overview

Use this skill whenever the user asks to QA Human Protocol, verify levels 1-5, check whether campaign configs truly play through, or debug a level that may be stuck. The core rule is: run the real playthrough first; do not substitute static validators for gameplay QA.

## Real Playthrough

Work from the game repo, usually:

```bash
cd "/Users/zhengkaizhang/Documents/small games 3d"
npm run qa:playthrough
```

This script drives `GameWorld` through the actual runtime systems: objective tracker, doors, pickups, puzzles, waves, weapons, projectiles, deaths/revive, scene flow, and dialogue. It uses local QA no-damage so combat cannot randomly end the test early, but it still requires real pickups, real wave combat, real puzzle hits, real key collection, and real exits.

If the script fails, treat it as a gameplay blocker. Read the error state, inspect the named level/objective/wave/puzzle, fix the config or system, and rerun `npm run qa:playthrough` from level 1 until all five levels pass.

## Follow-Up Checks

After the real playthrough passes, run:

```bash
npm run smoke:campaign
npm run build
git diff --check
```

If UI, localization, mobile controls, title flow, or pause/settings changed, also start or reuse the dev server and inspect the relevant route in Browser. Normal player routes should not show config authoring/download tools unless explicitly opened with config/debug authoring params.

## Debug Mode

Local no-damage/debug play is intentionally for QA and puzzle verification:

- `?debug=qa`
- `?qa=1`
- `?noDamage=1`

These should only enable no-damage on localhost/127.0.0.1. In reports, describe it as QA no-damage or puzzle debug, not as a player-facing cheat.

## Report Format

Report the highest-signal facts:

- Whether levels 1-5 passed through real play.
- Any blockers found and fixed, with affected level/objective.
- Commands run and whether they passed.
- Remaining risks, especially browser/mobile UI checks that were not run.

Keep the report short; include exact level IDs only when they help the user understand the result.
