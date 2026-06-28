# Human Protocol Audio Assets

This folder is the **drop-in contract** for runtime audio. The audio framework
discovers files here at build time with `import.meta.glob`, so you can add or
remove tracks without touching any code. **Missing files never crash the game** —
the engine falls back to the procedural Web Audio synth (SFX) or to silence
(music).

Author music/stingers in Suno (or any source you can license), transcode to a
small web-friendly format (`.mp3` recommended; `.ogg`/`.wav` also accepted), drop
them into the matching folder using the exact filenames below, and they play
immediately.

> License first, taste second. Every shipped file needs a license note under
> `licenses/`. See `licenses/README.md` and `licenses/suno-tracks-template.md`.

## Folders

| Folder      | Purpose                                              | Player                       |
| ----------- | ---------------------------------------------------- | ---------------------------- |
| `music/`    | Looping background music beds (one per music state). | `MusicDirector`              |
| `stingers/` | Short one-shot transition flourishes (no loop).      | `MusicDirector`              |
| `sfx/`      | Sample-based sound effects.                          | `SampleSfxPlayer` (→ synth)  |
| `licenses/` | Source / license / commercial-status notes.          | —                            |

## Music (`music/`) — looping beds

The `MusicDirector` crossfades between these by game state (`src/game/audio`).
Drop any subset; states without a file fall back to silence (except `explore`,
which falls back to the bundled `last-human-bay.mp3`).

| Filename                   | Music state | When it plays                                  |
| -------------------------- | ----------- | ---------------------------------------------- |
| `build-workshop-loop.mp3`  | `build`     | Inside the `/build` level editor.              |
| `hp-explore-loop.mp3`      | `explore`   | Normal exploration (default gameplay bed).     |
| `hp-puzzle-loop.mp3`       | `puzzle`    | Puzzle overlays / `puzzle` objective urgency.  |
| `hp-combat-loop.mp3`       | `combat`    | Active enemies / wave pressure.                |
| `hp-boss-loop.mp3`         | `boss`      | Boss / elite wave alive.                       |
| `hp-exit-loop.mp3`         | `exit`      | Exit unlocked / exit cinematic. *(optional)*   |
| `hp-transition-loop.mp3`   | `transition`| Level transition. *(optional)*                 |
| `hp-victory-loop.mp3`      | `victory`   | Victory screen. *(optional)*                   |

`last-human-bay.mp3` is the bundled placeholder explore bed. Add
`hp-explore-loop.mp3` to override it.

Currently bundled user-provided demo beds:

- `build-workshop-loop.mp3` from `Glass Hatch.wav` drives `/build`.
- `hp-puzzle-loop.mp3` from `Cyan Relay Loop.wav` drives puzzle overlays and
  puzzle-urgency objectives.

Combat and boss have no dedicated tracks yet. Until `hp-combat-loop.mp3` or
`hp-boss-loop.mp3` are provided, those states keep the explore bed instead of
dropping to silence.

## Stingers (`stingers/`) — one-shots that duck the music

Played once on a state edge; the music bed ducks under them and recovers.

| Filename                       | Trigger                         |
| ------------------------------ | ------------------------------- |
| `exit-unlock-stinger.mp3`      | Exit unlocks.                   |
| `level-transition-stinger.mp3` | Level transition begins.        |
| `victory-stinger.mp3`          | Victory.                        |

## SFX (`sfx/`) — samples with synth fallback

The `SampleSfxPlayer` maps audio-cue keys to these filenames. If a file is
present it plays (with rough pan + intensity); if not, the existing
`SynthAudioEngine` covers that cue. See `src/game/audio/sfxManifest.ts` for the
full key→filename map. Suggested files:

```
puzzle-open.mp3   puzzle-select.mp3  puzzle-merge.mp3   puzzle-correct.mp3
puzzle-wrong.mp3  puzzle-success.mp3 puzzle-fail.mp3
door-open.mp3     button-press.mp3   pickup.mp3         revive.mp3   death.mp3
weapon-pulse.mp3  weapon-rail.mp3    weapon-shock.mp3
player-hit.mp3    enemy-hit.mp3      robot-death.mp3
transition.mp3    victory.mp3
```

Keep SFX short (< ~1.5s) and quiet enough to layer.
