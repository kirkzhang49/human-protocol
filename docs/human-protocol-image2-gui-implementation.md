# Human Protocol Image2 GUI Implementation

This repo consumes the WGPU Robot Lab image2 GUI math contract.

Start here:

```txt
/Users/zhengkaizhang/Documents/webgpu-robot-lab/docs/HUMAN_PROTOCOL_IMAGE2_GUI_ART_DIRECTION.md
/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/HUMAN_PROTOCOL_IMAGE2_GUI_MATH_SYSTEM.md
```

Runtime files:

```txt
src/ui/guiMath.ts
src/styles/gui-math.css
scripts/qa/gui-math-audit.mjs
src/assets/gui/
src/assets/manifests/runtime/gui_age_v3_asset_manifest.json
src/assets/manifests/reports/gui_math_audit_report.json
```

## Rules

- Image2 can generate plates, frames, rings, and loading art.
- React/CSS owns all live text, numbers, progress, glyphs, and language.
- HUD art uses two visible status rows only: Health and Stamina. Do not add a
  Heat/Temp/Overheat row to GUI assets.
- Keep combat controls at or above `44px`; prefer `58px+`.
- Keep text contrast at `4.5:1` for body text and `3:1` for large HUD text.
- Composite UI in linear-light terms; do not tune final readability only by
  sRGB screenshots.
- Screen overlay UI may sample scene exposure/depth, but should not be fully
  crushed by world shadows.

## Current Formula Anchors

```txt
visibleProgressScale(progress) = max(0.025, clamp01(progress))
loadingAssetProgress(asset) = 0.10 + clamp01(asset) * 0.58
loadingGpuProgress(t) = 0.72 + (0.92 - 0.72) * (1 - (1 - t)^3)
```

These formulas drive boot/loading perception and are checked by
`npm run gui:math-audit`.

## GUI Integration Plan

1. Keep heat as an internal combat pacing value only; do not expose it in the
   visible HUD.
2. Generate image2 plates from the no-heat sketch:
   `/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/sketches/human-protocol-image2-gui-sketch-v2-no-heat.png`.
3. Generate mobile landscape plates from:
   `/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/sketches/human-protocol-image2-mobile-gui-sketch-v1-no-heat.png`.
4. Add final PNG plates under `src/assets/gui/` only after alpha/safe-zone QA.
5. Wire plates as CSS backgrounds while keeping live React text, bars, progress,
   glyphs, and language in code.
6. Run `npm run gui:math-audit`, `npm run build`, and `npm run smoke:campaign`.

## AGE v5 Safe Desktop/Mobile Runtime Assets

The current active GUI plates were cut from:

```txt
/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/extracted-age-v5/human-protocol-age-gui-resource-board-v5-safe-desktop-mobile.png
```

Active game assets:

```txt
src/assets/gui/hp-gui-hud-frame-age-v3.png
src/assets/gui/hp-gui-flow-entry-panel-age-v5.png
src/assets/gui/hp-gui-flow-victory-panel-age-v5.png
src/assets/gui/hp-gui-flow-death-panel-age-v5.png
src/assets/gui/hp-gui-objective-strip-age-v4.png
src/assets/gui/hp-gui-objective-strip-mobile-age-v5.png
src/assets/gui/hp-gui-button-wide-age-v5.png
src/assets/gui/hp-gui-button-small-age-v5.png
src/assets/gui/hp-gui-stat-chip-age-v5.png
src/assets/gui/hp-gui-dialogue-toast-age-v3.png
src/assets/gui/hp-gui-mobile-action-age-v3.png
src/assets/gui/hp-gui-joystick-plate-age-v3.png
src/assets/gui/hp-gui-interact-pill-age-v3.png
```

These PNGs own only the plate ornament. CSS/React still owns all text, progress,
bar fill, glyph, cooldown, language, and touch math.

Desktop mission/objective uses the richer v4 strip for visual weight. Mobile and
short-height objective views use the v5 mobile strip for safer text bounds.

The manifest also records CSS selector bindings, and `npm run gui:math-audit`
checks that the expected PNG filenames are still referenced by CSS.

## Mobile Plan

- Keep phone play landscape-first.
- Preserve current left/right thumb zones from `src/ui/MobileControls.tsx`.
- Do not use image2 art as the clickable area; CSS target boxes remain the
  source of truth.
- Joystick outer target stays `114-132px`; visual knob can be smaller because
  the parent target receives input.
- Combat buttons stay `64-98px`; prefer `58px+` clear visual center.
- Avoid bottom-center art that overlaps joystick, dash, or weapon cluster.
