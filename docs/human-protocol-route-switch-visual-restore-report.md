# Route-Switch Visual Restore Report

Date: 2026-06-13

Goal: fix the route-switch visual regression (overlay read like a flat black web
modal / button-card panel) and make both the 3D console and the 2D overlay read
as one industrial facility router — wide low body, central direction ring, four
colour-coded output tubes, brass/cyan accents. Routing logic, schema, map config,
gameplay semantics, asset IDs, and official levels unchanged.

## 1. Changed files
- `src/ui/RouteSwitchOverlay.tsx` — outputs restructured from octagon button
  cards → physical console deck with output **bays + colour tubes**.
- `src/styles/overlays.css` — `.route-switch-deck` / `.plate-bay` / `.plate-tube`
  styling (replaces the flat `.plate-bg` octagon); denied keyframes preserved.
- `scripts/asset-build/generate-route-switch-gui-image2.py` — added sprites:
  `output_bay`, `output_tube_{cyan,amber,green,violet,off}`, `hazard_skirt`.
- `src/assets/gui/route-switch/route_switch_parts_image2.png` (+ `.regions.json`)
  — regenerated atlas (29 regions, 1024×1592). Background board unchanged.

NOT changed: `hp_builder_route_switch_console.glb` (modelKey
`builder_route_switch_console`), the registry, the 2D runtime atlas's background,
`BUILDER_RUNTIME_PACK_ENGINE_VERSION` (no GLB change → no stale-pack risk), and
all route-switch gameplay/runtime code.

## 2. 3D route console — verified already good (no change)
A Blender render of the current cooked GLB
(`.tmp/route-console-current.png`) shows it is already the older good
industrial direction: wide low graphite body, central brass/cyan direction
ring on the deck, **four colour-coded output tubes in brass sockets**, brass
trim, cable rail, hazard base — readable as a route-control machine, not a flat
card. The "bad" references the brief cited were the 2D overlay and the L05 route
**key** pedestal, not this console. Left unchanged to avoid deep-pack churn; the
overlay was rebuilt to match it.

## 3. 2D overlay — rebuilt as a console close-up
- Outputs are now physical **bays** (`output_bay` recessed brass-rimmed socket)
  each holding a **colour-coded glass tube** (`output_tube_cyan/amber/green/violet`
  by slot, `output_tube_off` when locked) + the kind icon + status LED + a small
  diegetic label, mirroring the machine's four output tubes. No more rectangular
  button cards (`option_plate_*` octagons are no longer used by the overlay).
- The row sits on a **brass deck rail** with a **hazard skirt** below — reads as
  the console's front face. The central brass/amber **direction ring** is the
  hero; the cyan pointer rotates to the selected bay.
- Runtime text kept small/diegetic; the per-output detail line is hidden
  (`.plate-detail { display:none }`) to avoid web-modal clutter.

### Behavior preserved (unchanged)
- No key: `world.chooseRouteSwitchState` still called → returns false, state
  unchanged; overlay shows the amber **key-lens pulse** + clicked-**bay shake**
  (the existing `is-denied` / `plate-denied` classes + nonce, untouched).
- With key: the 0.78s dial rotation → `chooseRouteSwitchState` → close-on-commit
  flow is exactly as the prior reveal-camera task left it (not modified here).
- EN/ZH runtime labels intact; no baked text in any PNG.
- Close button, Escape, and the mobile/landscape media query preserved (bay width
  clamp + nowrap row); bays use `aspect-ratio` so they scale down on mobile.

## 4. Evidence
- 3D console close-up (already-good, unchanged): `.tmp/route-console-current.png`
- Overlay **locked / no-key** state (dim tubes, amber "缺少授权" denied glow):
  `.tmp/route-redesign/overlay-locked.png`
- Overlay **authorized / selected-output** state (lit cyan/amber/green/violet
  tubes, selected bay LED + glow, dial pointer): `.tmp/route-redesign/overlay-authorized.png`
- New GUI atlas: `src/assets/gui/route-switch/route_switch_parts_image2.png`
- (Prior "bad" web-modal overlay reference: `.tmp/route-switch-denied-after.png`)

The overlay screenshots are rendered from the **real** `overlays.css` + the real
regenerated atlas via headless Chrome (reconstructed overlay DOM), not the full
playtest; the runtime is independently proven by `route-switch-runtime-qa`.

## 5. Commands run + results
```text
python3 scripts/asset-build/generate-route-switch-gui-image2.py   # 29 regions, 1024x1592
npx tsc -b --pretty false                                         # exit 0
node scripts/qa/route-switch-runtime-qa.mjs                       # ALL PASS
npm run qa:builder                                                # ALL PASS (thumbnail 193/193, WGPU 237/237)
git diff --check  (repo root)                                     # clean
```

## 6. Remaining risks
- Overlay evidence is a CSS-state render (real CSS + atlas), not a live in-game
  capture; behavior verified by `route-switch-runtime-qa`.
- Tube colour is by slot index (cyan/amber/green/violet), decorative — it mirrors
  the machine's four tubes and does not encode output kind (kind is shown by the
  icon + label), so semantics are unchanged.
- The 3D console GLB was intentionally left as-is; if a future pass wants the
  overlay tube colours to exactly match the GLB tube colours (red/amber/blue/
  green), update both `TUBE_COLORS` and the GLB tube materials together.
