# Sample SFX

Optional sample-based sound effects. The `SampleSfxPlayer`
(`src/game/audio/SampleSfxPlayer.ts`) maps audio-cue keys to the filenames
below. If a file exists it plays (with rough stereo pan + intensity); if not,
the procedural `SynthAudioEngine` covers that cue — so the game always has
sound.

Accepted formats: `.mp3` (recommended), `.ogg`, `.wav`. Keep clips short
(< ~1.5s).

Filenames the engine looks for (see `sfxManifest.ts` for the full key→file map):

| Filename             | Covers cue keys                                        |
| -------------------- | ------------------------------------------------------ |
| `puzzle-open.mp3`    | `archive_panel_open`, `gallery_reader_open`            |
| `puzzle-select.mp3`  | `archive_tile_slide`, `gallery_card_tick`              |
| `puzzle-merge.mp3`   | `archive_tile_merge`, `archive_identity_stamp`         |
| `puzzle-correct.mp3` | `gallery_correct_stamp`                                |
| `puzzle-wrong.mp3`   | `archive_denied`, `gallery_wrong_deny`                 |
| `puzzle-success.mp3` | `archive_unlock`                                        |
| `puzzle-fail.mp3`    | `archive_rollback`                                     |
| `door-open.mp3`      | `system_exit_open`, `gallery_door_release`             |
| `button-press.mp3`   | `ui_confirm`, `ui_start`                               |
| `pickup.mp3`         | `ui_upgrade_select`                                    |
| `revive.mp3`         | `ui_revive`                                            |
| `death.mp3`          | `ui_death`                                             |
| `weapon-pulse.mp3`   | `weapon_pulse_rifle`                                   |
| `weapon-rail.mp3`    | `weapon_rail_lance`                                    |
| `weapon-shock.mp3`   | `weapon_shock_burst`                                   |
| `player-hit.mp3`     | `player_hit`                                           |
| `enemy-hit.mp3`      | `enemy_hit`                                            |
| `robot-death.mp3`    | `enemy_destroyed`                                      |
| `transition.mp3`     | `system_transition`                                   |
| `victory.mp3`        | `system_victory`                                      |

Add a license note under `../licenses/` before shipping. See `../README.md`.
