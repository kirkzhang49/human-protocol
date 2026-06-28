# Audio License Notes

本目录记录所有进入游戏包体的音乐和音效来源。规则：license first, taste second.

## Shipping Rules

- 正式上传 CrazyGames、itch 或自售版本前，每个音频文件都必须有来源、作者/平台、生成或下载日期、license/terms、商业使用状态和风险备注。
- AI 生成音乐必须记录平台、账号/套餐权限、track id、生成日期和当时的商业使用条款截图或链接。
- 禁止使用 non-commercial、stream-only、只允许试听、来源不清、或模仿真实版权歌手/歌曲/OST 的音乐。
- 当前没有 license 证明的音频，只能作为本地开发/内部 demo 占位。

## Bundled Audio

See `last-human-bay.md` for the current main BGM (bundled `explore` bed).
See `glass-hatch-build-workshop-loop.md` for the current `/build` music bed.
See `cyan-relay-puzzle-loop.md` for the current puzzle music bed.

## Pending User Audio (Suno)

The audio framework auto-discovers files dropped into `../music/`, `../stingers/`
and `../sfx/` (see `../README.md` for the drop-in contract). Every such file that
ships needs a license note here. Use `suno-tracks-template.md` as the per-track
template. Until a track has archived proof, it is local-dev/demo only and must
not be uploaded to public platforms.
