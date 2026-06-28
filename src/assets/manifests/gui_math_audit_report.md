# Human Protocol GUI Math Audit

Generated: 2026-06-19T17:11:26.075Z

Critical: 0
Warning: 3

## Formula Contract

- sRGB -> linear: `c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4`
- luminance: `Y = 0.2126 R_linear + 0.7152 G_linear + 0.0722 B_linear`
- contrast: `(max(Y1,Y2)+0.05)/(min(Y1,Y2)+0.05)`
- linear overlay: `C_out = alpha*C_ui + (1-alpha)*C_scene`
- depth visibility: `visible_ui = z_ui <= z_scene + epsilon`
- UI shadow clamp: `shadow_ui = max(0.66, shadow_raw)`
- loading progress: `p = 0.72 + (0.92 - 0.72) * (1 - (1 - t)^3)`

## Image2 GUI Contract

- Source of truth: /Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/math/gui/HUMAN_PROTOCOL_IMAGE2_GUI_MATH_SYSTEM.md
- Target export: author at 2x UI scale, export with transparent alpha
- Depth mode: overlay samples scene exposure/depth stats; world-space panels may write depth

## Issues

- [warning] overlay-button-height: .flow-panel .config-pack-actions button min-height 36px < 44px
- [warning] overlay-button-height: .flow-panel .config-pack-body > button min-height 36px < 44px
- [warning] letter-spacing-nonzero: Non-zero letter-spacing appears 75 time(s); keep compact GUI text at 0 unless specifically art-directed

