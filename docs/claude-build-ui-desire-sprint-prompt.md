# Claude Prompt — Build UI Desire Sprint

Act like a world-class game editor UX director, premium sci-fi UI designer, and senior React/Three.js engineer.

The weak point is not functionality anymore. `/build` already has enough tools, but it still feels like an internal editor. The goal is to make players open the builder and immediately want to keep building rooms, placing furniture, deleting bad assets, repainting surfaces, and generating a playable escape-room pack.

Use this target image as the visual direction:

`/Users/zhengkaizhang/Documents/smallGames-main/games/human-protocol/docs/assets/human-protocol-builder-ui-desire-target-image2-v1.png`

Do not copy the image literally and do not build a fake static mock. Preserve the existing real builder functionality, but redesign the shell, hierarchy, asset browser, inspector, and asset-delete flow until the app feels like a premium Sims-like escape-room construction toy.

## Product Target

When the work is done, `/build` should feel like:

- A playable sci-fi construction game, not a spreadsheet editor.
- The center 3D room builder is the hero. Panels support it instead of stealing attention.
- Furniture thumbnails feel desirable and inspectable.
- Deleting placed furniture is obvious and safe.
- Hiding bad catalog assets in dev is obvious, reversible, and queues them for later real deletion.
- The user can understand at a glance: what is selected, what can be built, whether the room is playable, and how to test it.

## Must Inspect First

Inspect these files before editing:

- `src/build/BuildPage.tsx`
- `src/build/BuilderAssetBrowser.tsx`
- `src/build/BuilderInspectorPanel.tsx`
- `src/build/BuilderBuildToolbar.tsx`
- `src/build/BuilderPreview3D.tsx`
- `src/build/BuilderCanvas2D.tsx`
- `src/build/BuilderAssetCatalog.ts`
- `src/build/generatedBuilderAssetCatalog.ts`
- `src/styles/builder.css`
- `src/build/BuilderLevelImport.ts`
- `src/build/BuilderStorage.ts`
- `vite.config.ts`

Also inspect the current `/build?fromLevel=level_01_maintenance_bay` flow. This imported official-level draft is the main design test case.

## Missing Asset Creation / Baking Requirement

The target image intentionally contains furniture, wall pieces, floor looks, and lighting/material richness that may not exist in the current catalog. Do **not** respond with “the assets are missing” and do **not** use generic cubes/placeholders. If a desirable piece from the target direction is missing, create and bake a small curated asset pack yourself, then wire it into the live builder.

This is part of the sprint, not optional polish.

### Must Inspect Asset Pipeline

Before creating assets, inspect:

- `scripts/asset-build/generate-hp-official-remaster-batch01.mjs`
- `scripts/asset-build/generate-hp-cyberpunk-batch01.mjs`
- `scripts/asset-build/generate-builder-asset-pack-registry.mjs`
- `src/assets/manifests/builder/`
- `src/assets/registry/environment/generatedBuilderAssetPacks.ts`
- `src/build/generatedBuilderAssetCatalog.ts`
- `src/build/generatedBuilderAssetFootprints.ts`
- `src/build/BuilderEnvironment.ts`
- `src/build/BuilderSurfaceTextures.ts`
- `src/build/BuilderSurfaceArt.tsx`

Prefer the existing deterministic/programmatic GLB and manifest pipeline. If the current scripts do not cleanly support this new pack, add a small new deterministic generator script rather than hand-editing generated files.

### New Builder Desire Pack

Create a new curated pack, for example:

- GLB output folder: `src/assets/models-cooked/environment/hp-builder-desire-pack01/`
- Manifest: `src/assets/manifests/builder/hp_builder_desire_pack_v1.json`
- Generator script if needed: `scripts/asset-build/generate-hp-builder-desire-pack01.mjs`

The pack should be small but high-impact. Target 10-16 pieces total, all real GLBs with useful dimensions, metadata, catalog entries, 2D footprints, and 3D preview/playtest compatibility.

Include at least these categories:

- Archive desk with lamp, papers, small objects, and readable silhouette.
- Tall glass display vitrine / specimen case.
- Brass/dark-metal safe or lockbox.
- Low bookcase or divider shelf.
- Leather/clinic chair or accent chair.
- Compact security console / lab workstation.
- Bed pod or recovery cot that feels like an escape-room clue object.
- Wall clue board / framed diagram / portrait panel.
- Ceiling strip light or wall washer.
- Small tabletop prop cluster if the existing system supports tabletop placement; otherwise make it a floor-safe decorative prop.

### Real Thumbnail / Screenshot Requirement

The current builder can use procedural/SVG thumbnails, but the target quality bar needs real asset appeal. For the new desirable assets, do not rely only on SVG footprint thumbnails.

Implement or reuse a small thumbnail capture path:

- Preferred: render each GLB in a deterministic thumbnail scene and save PNG/WebP thumbnails, e.g. under `src/assets/thumbnails/builder/hp-builder-desire-pack01/`.
- If a full browser capture pipeline is too heavy, create a Node/Three/offscreen/headless script that renders each GLB against a transparent or dark studio background.
- If that is not practical in this sprint, generate clean image thumbnails from the model/style spec and save them as catalog thumbnails, but keep them clearly tied to the actual modelKey.
- SVG footprint thumbnails may remain as fallback for old assets, but the new pack should show image thumbnails in the asset browser.
- The catalog card should show the real thumbnail first, with the footprint/collision info as a secondary overlay or mini badge.

Suggested files:

- `scripts/asset-build/generate-builder-asset-thumbnails.mjs`
- `src/assets/thumbnails/builder/hp-builder-desire-pack01/*.png`
- `src/build/BuilderAssetThumbnails.ts` or equivalent mapping.
- `src/build/BuilderAssetBrowser.tsx` and `BuilderInspectorPanel.tsx` should consume these thumbnails.

Thumbnail acceptance:

- Every new desire-pack furniture item has a real image thumbnail.
- Thumbnails are visually consistent: same camera angle, lighting, padding, and background.
- Thumbnails do not stretch, crop awkwardly, or show blank/black renders.
- `npm run qa:builder` or an equivalent script verifies thumbnail coverage for the new pack.

Style target:

- Not generic office furniture.
- Sci-fi escape-room objects with purpose: clue, lock, memory archive, surveillance, lab, elevator, home simulation.
- Materials should read clearly in 3D: dark wood, brass, aged metal, smoked glass, cyan emissive strips, warm desk lights.
- Each item needs a recognizable thumbnail and non-generic 2D footprint.

Budget target:

- Keep each GLB reasonably lightweight.
- Avoid huge texture images unless necessary.
- Prefer procedural geometry and simple baked/material colors.
- If textures are created, keep them deterministic and small.

### Wall / Floor / Room Surface Baking

Also create or extend builder room surface assets and presets. The target image needs floors and walls that make rooms feel like real places, not flat rectangles.

Add a curated material/surface set, for example:

- Archive wood parquet floor with brass inlay.
- Hazard maintenance floor with diagonal stripe plates.
- Dark lab tile floor with subtle seams and stains.
- Museum stone floor with route inlay.
- Rubber/black industrial floor with tiny speckles.
- Wall panel set: dark metal panel, warm archive wall, glass observation wall, hazard striped wall trim, clean lab wall.
- Optional ceiling strips / wall washer presets if they can be represented in the builder.

Wire these into:

- Environment tab swatches.
- Room inspector floor/wall/ceiling material controls.
- 2D blueprint previews.
- 3D preview materials.
- Saved builder metadata.
- Playtest/runtime pack path where feasible.

If current 3D surface rendering only supports procedural CanvasTexture, improve that path enough for the new presets to be visibly different in 3D. Do not leave the new surfaces visible only in 2D.

### Asset Integration Acceptance

After this sprint:

- New furniture appears in `/build` catalog without manually editing generated files in an unsafe way.
- New furniture can be placed, selected, duplicated, deleted, saved, exported, and playtested.
- New furniture has real 2D footprints, not generic squares.
- New furniture appears as real GLB in 3D preview and deep playtest where the current asset path supports it.
- New furniture uses real image thumbnails in the catalog/inspector; SVG footprints remain only as fallback or small collision overlays.
- New wall/floor presets are visible in the catalog/environment tab and in the 3D room.
- `/build?fromLevel=level_01_maintenance_bay` can use the new material/furniture polish without breaking official level import.
- `npm run qa:builder` includes or extends checks for the new pack count, registry/catalog/footprint agreement, and basic compile/playtest compatibility.

## Visual Redesign Requirements

### Overall Shell

Redesign the builder as a premium dark glass sci-fi game editor:

- Keep top bar / left asset browser / central 3D stage / right inspector / bottom toolbar, but make them feel intentional and high-end.
- The 3D stage should visually dominate. Avoid huge blank grid, tiny unreadable controls, and overly flat dark panels.
- Use richer contrast: cyan for selection, amber for critical path, green for playable, red for danger/delete, warm room lights for “home/building” desire.
- No overlapping UI. Must fit 1440x900 and 1366x768.
- Keep Chinese player-facing labels.
- Avoid explanatory tutorial paragraphs inside the UI. Use compact labels, badges, tooltips, and status chips.

### Left Asset Browser

Make the asset browser feel like a toy-box/workshop:

- Tabs: 房间 / 家具 / 机器人 / 门锁 / 环境.
- Large furniture thumbnail cards, 2-column on desktop.
- Each card shows: thumbnail, label, size, group/theme chip, favorite button, instance-place affordance, and a dev-only quarantine/delete icon.
- Add a “待删除” tray/shelf under the catalog showing assets queued for deletion, with restore and clear/local-copy actions.
- Search and filters should feel polished, not cramped.
- Hidden/quarantined assets must not appear in the catalog after deletion.
- Do not make catalog cards look like generic buttons; they should look like tangible asset cards.

### Center Stage

Make the center stage feel like the actual product:

- Keep 2D / Split / 3D Edit modes, but in Split/3D the 3D room should feel like a beautiful cutaway diorama.
- Improve selected object/room affordances: cyan outline, resize handles, transform gizmo, clear hover state.
- The mini blueprint should be collapsible, visually polished, and not block the center of the 3D work area.
- Make doors visibly open/closed/locked in the builder view. Door openings should be unmistakable.
- When placing furniture, show ghost placement, collision footprint, snap line, and a tiny readable status chip.

### Right Inspector

Make the inspector feel like a property panel from a commercial editor:

- Header with selected object thumbnail/name/type.
- Compact sections: Transform, Materials, Lighting, Gameplay, Physics/Collision.
- Furniture: position, rotation, scale, collision toggle, duplicate, delete instance.
- Room: floor/wall/ceiling material swatches, mood chips, light sliders, exit/spawn role.
- Door: lock type, source room, target room, key/puzzle/wave binding.
- Destructive actions must be separated and visually clear.

### Bottom Toolbar

Make it feel like a game build tool tray:

- Big clear active tool state.
- Icons + short labels for select, room, door, furniture, robot, pan, floor brush, wall brush, light, ceiling.
- Status chips: 可玩, 路径, 门锁, 敌人, 导出.
- Keep Generate/Deep Playtest prominent, but do not let it crowd the build tools.

## Asset Deletion / Quarantine System

There are two different delete actions. They must never be confused:

1. **Delete placed instance**
   - Deletes only the selected prop/room/robot/door from the current project.
   - Existing Delete key behavior should remain, but improve discoverability in UI.
   - This must not affect the asset catalog.

2. **Hide/quarantine catalog asset (DEV only)**
   - This is for assets the user dislikes.
   - It removes the asset from the build catalog immediately.
   - It queues a deletion record into a “ready to delete” folder, so the human can later ask Codex to physically delete the files.
   - It must be reversible from the “待删除” tray.

Implement this safely:

- Do **not** physically delete GLBs, source folders, generated registries, or imports from the browser.
- Do **not** move actual model files automatically. Moving source files will break imports/build.
- Implement a soft-quarantine layer:
  - New module suggestion: `src/build/BuilderAssetQuarantine.ts`
  - Local persistence: localStorage, so the asset disappears immediately and stays hidden after reload.
  - Repo queue folder: `docs/pending-delete/builder-assets/`
  - For each quarantined asset, create or update a JSON record like `docs/pending-delete/builder-assets/<modelKey>.json` in dev mode.
  - Record at least: modelKey, label, group, source, sourceAssetId, sizeMeters, queuedAt, reason, and candidate source paths if resolvable.
  - Also maintain a small index JSON in that folder.
- If browser filesystem writes are not directly possible, add a Vite dev-only middleware endpoint in `vite.config.ts`:
  - `POST /__hp_builder/quarantine_asset`
  - Validate payload shape.
  - Write the pending-delete JSON record and index.
  - This endpoint must be dev-only and harmless in production.
  - In production or if the endpoint is unavailable, keep localStorage-only quarantine and show a “本地隐藏” status.
- The catalog must filter out both local quarantined keys and queued keys.
- Existing projects containing a quarantined modelKey should not crash:
  - Placed instances may remain visible.
  - Inspector/card should show “资产已加入待删除”.
  - Offer “恢复资产” or “删除此实例”.
- The “待删除” tray should show queued assets and allow restore.

## Do Not Do

- Do not replace real builder functionality with a static mock.
- Do not remove existing build/playtest/export behavior.
- Do not physically delete asset files.
- Do not hardcode one-off Level 1 behavior into generic UI.
- Do not make a landing page or marketing page.
- Do not add long explanatory text blocks in the UI.
- Do not make the UI dominated by one flat dark-blue palette; add material warmth and contrast.
- Do not spend the sprint only on tests. Implement the UI first; then run focused verification.

## Suggested Implementation Shape

You may choose better names, but this is the intended direction:

- `src/build/BuilderAssetQuarantine.ts`
  - localStorage keys
  - queued asset types
  - helpers: `isBuilderAssetHidden`, `hideBuilderAsset`, `restoreBuilderAsset`, `loadQueuedBuilderAssets`
  - dev endpoint client: `queueBuilderAssetForDeletion`
- `src/build/BuilderAssetBrowser.tsx`
  - premium card layout
  - dev-only quarantine icon
  - pending-delete tray
  - catalog filtering
- `src/build/BuilderInspectorPanel.tsx`
  - stronger selected object header
  - clearer delete instance vs asset quarantine separation
- `src/build/BuilderBuildToolbar.tsx`
  - polished game-like tool tray
- `src/build/BuildPage.tsx`
  - central status/toasts, import-level status, layout refinements
- `src/styles/builder.css`
  - major v-next UI layer
- `vite.config.ts`
  - optional dev-only quarantine endpoint
- `docs/pending-delete/builder-assets/.gitkeep`
  - queue folder exists

## Acceptance Criteria

Functional:

- `/build` still opens and existing starter draft works.
- `/build?fromLevel=level_01_maintenance_bay` opens an imported official-level draft.
- Placed instance delete still works.
- Catalog asset quarantine hides the asset immediately.
- Quarantined asset appears in “待删除”.
- Restore brings asset back.
- In dev mode, quarantine writes a JSON deletion record under `docs/pending-delete/builder-assets/` if the endpoint is available.
- No actual GLB/source file is deleted automatically.
- Save, validate, export JSON, compatible playtest, and generate/deep playtest remain reachable.

Visual:

- The page should be visibly closer to the target image than the current screenshot.
- Furniture cards should look desirable.
- Selected room/prop state should be obvious.
- Door/lock status should be visually obvious.
- The 3D stage should feel like the main product, not a preview panel.

Verification:

- `npm run build`
- `npm run qa:builder`
- `git diff --check`
- Manually open or browser-smoke:
  - `http://127.0.0.1:5173/build`
  - `http://127.0.0.1:5173/build?fromLevel=level_01_maintenance_bay`
- In the final report, include:
  - Changed files
  - What visual hierarchy changed
  - How quarantine/delete works
  - Verification commands and results
  - Remaining visual risks

## Quality Bar

Self-score before final:

- Visual desire / “I want to keep building”: target 9/10
- Asset browser clarity: target 9/10
- 3D stage focus: target 8.5/10
- Inspector clarity: target 8.5/10
- Delete/quarantine safety: target 10/10
- 1366x768 fit: target 9/10

If the result is only “cleaner” but not more desirable, keep iterating. The correct feeling is: “I opened this to fix a room, but now I want to keep decorating and hit Deep Playtest.”
