# Suno Track License Template

Copy this block into a new file per track (e.g. `hp-combat-loop.md`) and fill it
in before shipping on CrazyGames / itch / direct sale. No proof archived ⇒
local-dev/demo only.

```
# <Track / file name>

## File
- Runtime file: src/assets/audio/<music|stingers|sfx>/<filename>
- Original source file: <path to original WAV/MP3>
- Runtime transcode: <format, bitrate, channels, duration, size>

## Source Metadata
- Platform: Suno (<model/version if known>)
- Account / plan at generation time: <account, plan tier>
- Track id: <suno track id>
- Created: <ISO date>
- Prompt summary: <high-level prompt; NO named artists/songs/OST references>

## Copyright / Commercial Status
- Status: user-provided AI-generated music.
- Commercial use under the plan above: <yes/no/unknown>
- Game redistribution allowed: <yes/no/unknown>
- Proof archived: <link/screenshot of Suno terms + track page>

## Risk Notes
- Do not claim CC0/royalty-free unless Suno terms/proof are archived.
- Do not regenerate using named artists/songs/film/game OST or copyrighted
  melody/lyrics.
- Procedural Web Audio fallback stays available so the game can ship silently or
  with replacement audio if licensing changes.
```
