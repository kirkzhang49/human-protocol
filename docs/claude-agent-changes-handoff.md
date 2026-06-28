# Human Protocol — Claude-agent changes handoff (for Codex)

_Last updated: 2026-06-14. Scope: `games/human-protocol`._

This doc summarizes the changes a Claude agent made across one working session so another
agent (Codex) can continue without re-deriving or accidentally reverting them. It groups
work by feature, lists the files, the **non-obvious design decisions / gotchas**, and how to
verify. Matching long-form notes live in the Claude memory index (`hp-i18n-architecture`,
`hp-root-menu`, `hp-focus-reveal-camera`).

## TL;DR
1. **Full bilingual (zh⇄en)** for the whole player game **and** the `/build` editor, with an
   automated coverage gate (`npm run i18n:qa`).
2. **New root menu at `/`** — a 4-action "facility console" (no level cards), WebGL liquid
   background, self-hosted fonts, settings modal, loading transition, BGM.
3. **Door/spawn "focus reveal" camera** rewritten to be **rotate-only from the player's eye**
   (no more flying through walls); Raw-WebGPU room visibility fixed to match.
4. **Removed the browser fullscreen prompt** ("press and hold Esc…") by dropping auto
   `requestFullscreen()`.

## Verify everything
```bash
npx tsc -b --pretty false      # type gate (app code is clean; see Known issues for test files)
npm run build                  # tsc -b + vite build + PWA SW
npm run i18n:qa                # bilingual coverage gate — must print "i18n coverage OK"
npm run qa:root-menu           # headless-Chrome root menu QA — 16/16, screenshots in .tmp/qa-root-menu
node scripts/qa/door-reveal-anim-qa.mjs   # focus-reveal room-visibility logic test
```

---

## 1. Bilingual / i18n

The game is **Chinese-primary**; English is produced at render time. `GameLanguage = "zh"|"en"`
(`src/game/core/GameSettings.ts`, default `zh`, `?lang` URL override).

### Player UI
- Most overlays branch inline: `language === "en" ? "EN" : "中文"`.
- Centralized/shared + previously-leaked strings live in **`src/i18n/playerStrings.ts`**
  (`playerStrings(lang)`, `puzzleColorLabel`, `articleWallArtLabel`, `buildArchetypeLabel`,
  plus the whole `rootMenu` block). Add new player-UI chrome here, not as a raw literal.
- Fixed hardcoded leaks in: `App.tsx` BootLoading, `RunProgressOverlay`, `ArticleQuizOverlay`,
  `SequencePlaybackOverlay`, `GalleryReadingOverlay`, `ToolCalibrationOverlay`, `GameFlowOverlay`.

### Level / runtime content (the big one)
- Chinese string literals are **dictionary keys**, translated by
  **`src/game/config/LevelLocalization.ts`** (`world.configText`, `localizedFlow`,
  `localizedObjective`, `localizedWavePresentation`, etc.).
- Dictionaries are now modular under **`src/game/config/localization/`**:
  - `commonEnglish.ts` — shared objective copy **and** `commonFlowEnglish` (death/victory/
    transition/title defaults from `campaignDefaults.ts`). Used as a **fallback layer** so all
    levels get shared flow/objective copy without duplicating it.
  - `cyberLevels.ts` → `level06.ts`–`level10.ts` — full English for the cyberpunk campaign
    (06–10 had **zero** English before).
  - `extraLevels.ts` → `level01patch.ts`–`level05patch.ts` — supplemental English for 01–05
    (new content added after the original inline dicts were written), **deep-merged** over the
    inline base.
  - `galleryArchiveText.ts` — the shared gallery-reading corpus (was rendered raw Chinese;
    `GalleryReadingOverlay` now routes through `world.configText`).
- `LevelLocalization` deep-merges base (01–05 inline) + extra patches + cyber + gallery, and
  `localizedFlow` / `localizedPresentationObjective` / `localizedWavePresentation` apply the
  shared fallback then per-level override.
- **Gotcha:** structured fields (title/exit/flow/objective title-detail-hudLabel/dialogue/wave/
  choice/article/quiz) render via the `localized*` helpers (englishByLevel), **not** configText.
  Putting them only in a text dict falsely passes naive checks but still shows Chinese.

### Builder (`/build`)
- Separate language source: **`src/build/i18n/builderLanguage.tsx`**
  (`useBuilderLanguageState` in `BuildPage` → `BuilderLanguageProvider` → `useBuilderLanguage()`),
  reusing `GameSettings`; topbar EN⇄中文 toggle.
- Catalog labels: **`src/build/i18n/catalogLabels.ts`** `bl(label, lang)` — a non-invasive
  zh→en map (does not touch catalog data). Components call `bl(entry.label, language)`.
- All ~16 builder components converted; **r3f rule**: components under a `<Canvas>` get
  `language` as a **prop**, never `useBuilderLanguage()` (context doesn't cross the Canvas).
- Builder content-data (authored level/room/asset names) stays Chinese — translated at play time.

### Coverage gate
- **`scripts/qa/i18n-coverage-qa.mjs`** (`npm run i18n:qa`): loads every campaign level via Vite
  `ssrLoadModule`, runs each through the `localized*` helpers (field-precise) + `configText`, and
  fails on any English-mode output containing CJK. Skips builder-only/geometry subtrees
  (`props`, `rooms`, `authoringMetadata`). Keep it at exit 0.

---

## 2. Root menu (`/`)

A **facility master console** — exactly four actions, NOT a level selector. Do **not** add
official level cards to root.

- `src/ui/RootMenuPage.tsx` — actions: 开始游戏→`/play?level=level_01_maintenance_bay`,
  创意工坊→`/build`, 设置 (modal), 退出 (safe `window.close()` + fallback).
- Background art: **centered 4-frame** `src/assets/gui/root-menu/hp-root-menu-bg.jpg`
  (the user explicitly preferred the centered frames over a left-console plate).
- Fonts: self-hosted **Oxanium** (display) + **Saira** (body), OFL, in `src/assets/fonts/`,
  `@font-face` in `root-menu.css`.
- `src/styles/root-menu.css` — slot frames seated on the painted art via image-space fraction
  CSS vars (`--rm-slot-left/width/h`, `--rm-slot{1..4}-top`), settings modal, loading overlay.
- BGM: **`src/ui/useRootMenuMusic.ts`** plays the builder's `build` bed
  (`build-workshop-loop.mp3`) via `MusicDirector`, unlocked on first gesture, volume = master×music.
- Routing: `App.tsx` `isRootMenuRoute()` — bare `/` (no game-intent params) → menu;
  `/play`, `/?level=`, and preview deep-links still boot the game (preserves QA tooling).
- Return-to-menu: game `PauseOverlay` has a 返回主页面/Main Menu button → `/`; builder **ESC**
  opens a menu overlay (reuses `.root-menu-modal*` classes) with language + 返回主页面 + 继续.

### Alignment + fluid (critical, cost many iterations)
- **Alignment rule:** `.root-menu-bg` is the **authoritative image** — plain
  `background-size:cover; background-position:center`, **NO scale/parallax**. `.rm-slot-stage`
  uses the identical cover-box math (`width:max(100vw,100vh*ar)…; translate(-50%,-50%)`), so
  slots land on the painted frames at any aspect. (The cover-box equals `background-size:cover`
  algebraically.)
- **Fluid = transparent overlay only:** `src/ui/RootMenuFlowBackground.tsx` is a raw-WebGL
  fragment shader (one fullscreen pass, no new dep, NOT the game renderer) that paints a
  **screen-blended** liquid glow (cyan scan + amber warning currents + motes + cursor flowmap +
  autonomous roaming side-glows + ~6.5s breathing), masked to the side walls/floor so the center
  stays readable. It does **not** render/displace the photo — so it can never affect alignment.
  An earlier version rendered the image in the shader at plain cover while CSS used scale(1.06);
  the mismatch caused "完全没对齐". Do not reintroduce image displacement in the shader.
- **WebGL/StrictMode gotcha:** do **not** call `WEBGL_lose_context.loseContext()` in the effect
  cleanup — React StrictMode dev double-mount leaves the immediate remount on a dead context
  (blank/white screen). Just delete program/shaders/buffer.
- Perf/a11y: DPR≤1.5, paused on `document.hidden`, `prefers-reduced-motion` → one still frame.
- To re-measure slot fractions if the bg art changes: `scripts/qa/measure-root-menu-frames.mjs`
  (headless pixel scan) or a PIL crop of the frame column.

### QA
`scripts/qa/root-menu-browser-qa.mjs` (`npm run qa:root-menu`): headless-Chrome CDP, 5 viewports
(2560×1440 / 1920×1080 / 1440×900 / 1366×768 / mobile-landscape) — asserts 4 slots, **0 level
cards**, routes, settings open, reduced-motion still frame, no console errors. Screenshots in
`.tmp/qa-root-menu/`.

---

## 3. Focus-reveal camera (door open / enemy spawn)

When a route switch / puzzle opens a door (+ spawns enemies), `GameWorld.beginFocusReveal`
plays a `FocusRevealState` cinematic (advanced by `FocusRevealSystem`). Both rigs —
`src/render/CameraRig.tsx` (Three) and `src/render/raw-webgpu/RawWebGpuCanvas.tsx` (Raw) —
consume the same state: `cameraPosition.lerp(reveal.cameraPosition, blend)` +
`lookTarget.lerp(reveal.targetPosition, blend)` (`focusRevealCamera.ts:focusRevealBlend`).

- **Key change (`GameWorld.resolveFocusRevealTarget`):** `reveal.cameraPosition` is now anchored
  at the **player's eye** (`player.position.y + playerConfig.cockpitHeight`). The reveal is
  **rotate-only** — the gaze turns to face the door; the camera never translates. The old
  `focusRevealCameraPosition()` flew the camera to `target + dir*3.4`, which for a room-B door
  walked the camera **through walls** ("穿墙 / 像人走过去"). That helper was removed.
- **Raw-path pairing (the "enemies above the ceiling" fix):**
  `RawRoomRuntime.currentRoomId` used to **swap the whole current room** to `reveal.roomId`
  (built for the old fly-in camera). With the rotate-only camera staying in the player's room,
  swapping the visibility scenario **and lighting** off the camera's room misframed the shot and
  popped geometry above the ceiling line. Now `currentRoomId` stays the **player's** room, and
  `RawRoomRuntime.frame()` **adds** the reveal room (+ its baked scenario's visible rooms/doors)
  to the visible set — so a route-opened room still renders through the door without the swap.
  `visibilityKey` now includes `activeFocusReveal?.roomId`.
- Three path was already player-room-based (`RenderVisibility.isRoomRenderVisible`) and looked
  correct; the Raw fix brings it in line.
- Verified by `scripts/qa/door-reveal-anim-qa.mjs` (current room stays player's room; reveal room
  is in the visible set).

---

## 4. Fullscreen prompt removed

`App.tsx useLandscapeLock` no longer calls `requestFullscreen()` — current Chrome shows a
persistent "To exit full screen, press and hold Esc" prompt on fullscreen entry, which the user
rejected. It now only does a best-effort `screen.orientation.lock("landscape")`; the
`LandscapeGuard` rotate overlay remains the portrait fallback. Trade-off: `orientation.lock`
usually needs fullscreen on mobile browser tabs, so auto landscape-lock only reliably engages for
an installed PWA now.

---

## Known issues / caveats (please read before building)
- **`npm run build` test-file gate:** a concurrent effort added vitest + `*.test.ts` files; some
  have type errors. `tsconfig.app.json` now `exclude`s `src/**/*.test.ts(x)` so the production
  build/typecheck is green (tests run via `vitest`). If you re-include tests in the app tsconfig,
  fix those test type errors first.
- **WebGPU in CI/headless:** headless Chrome has no WebGPU adapter, so it falls back to the Three
  (asset-light) renderer — the real **Raw-WebGPU** look (and the reveal framing in §3) can't be
  screenshotted in automation. Verify those on a real machine via `npm run dev`.
- **Pre-existing, NOT from these changes:** `npm run smoke:campaign` reports
  `FAIL physical walkability level_03_human_museum` (map reachability of some keys/interactions)
  — unrelated to any change above.
- **Remote route doors:** the rotate-only reveal intentionally does not fly to a door in a
  non-adjacent room (no through-wall). If a remote reveal should still show the target room,
  add a deliberate "facility cam" cut rather than translating the camera.
- **Smoke levels** are dev fixtures (not in `campaignLevelIds`) and are excluded from the player
  i18n scope.
