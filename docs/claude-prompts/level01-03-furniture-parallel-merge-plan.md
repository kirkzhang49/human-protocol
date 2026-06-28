# Level 01-03 Furniture Parallel Merge Plan

Date: 2026-06-13

Three Claude Code sessions can run in parallel, but they must stay in isolated level-specific paths.

## Prompt Files

- `docs/claude-prompts/level01-furniture-image2-claude-prompt.md`
- `docs/claude-prompts/level02-furniture-image2-claude-prompt.md`
- `docs/claude-prompts/level03-furniture-image2-claude-prompt.md`

## Isolation Rule

Each Claude owns:

- one `scripts/asset-build/generate-level0X-furniture-image2-assets.py`
- one `src/assets/textures/environment/level0X-furniture-image2/`
- one `src/assets/models-cooked/environment/level0X-furniture-image2/`
- one `src/assets/manifests/builder/hp_level0X_furniture_image2_v1.json`
- one `docs/human-protocol-level0X-furniture-image2-report.md`

They must not edit shared generated catalog fragments.

## Codex Merge After Claude Finishes

1. Inspect all three reports and manifests.
2. Run each manifest with:
   `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --manifest <manifest> --check --pending`
3. Register the three manifests into the generated builder pack index via:
   `node scripts/asset-build/generate-builder-asset-pack-registry.mjs --emit --manifest <manifest>`
   repeated for Level 01, 02, and 03, or equivalent safe merge.
4. Generate thumbnails if the project requires thumbnail coverage.
5. Run:
   - `npx tsc -b`
   - `npm run qa:builder`
   - `git diff --check` from repo root
6. Browser-check `/build` and confirm the new groups/entries appear in the furniture catalog.
