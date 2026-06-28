#!/usr/bin/env python3
"""Audit the route-switch Image2 GUI assets.

Checks:
  1. parts PNG is RGBA and actually has transparent pixels (it is a sprite sheet).
  2. regions.json declares every required region, each in-bounds, each with real
     opaque content (not an empty/transparent rectangle).
  3. background PNG is fully opaque (it is a backing plate, never a cutout).

Exit code 1 on any failure. Run:
  python3 scripts/asset-build/audit-route-switch-gui.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
GUI = ROOT / "src/assets/gui/route-switch"
PARTS = GUI / "route_switch_parts_image2.png"
REGIONS = GUI / "route_switch_parts_image2.regions.json"
BACKGROUND = GUI / "route_switch_background_image2.png"

REQUIRED = [
    "frame_corner_tl", "frame_corner_tr", "frame_corner_br", "frame_corner_bl",
    "dial_ring", "dial_hub", "dial_pointer_cyan",
    "option_plate_enabled", "option_plate_disabled", "option_plate_selected",
    "key_lens_authorized", "key_lens_locked",
    "icon_door", "icon_puzzle", "icon_robot", "icon_standby",
    "wire_cyan", "wire_amber",
    "status_led_on", "status_led_off",
    "scanline_strip", "brass_bracket",
]


def main() -> int:
    failures: list[str] = []

    if not PARTS.exists():
        return _fail([f"missing {PARTS}"])
    parts = Image.open(PARTS).convert("RGBA")
    arr = np.asarray(parts)
    alpha = arr[:, :, 3]
    transparent_frac = float((alpha == 0).mean())
    if transparent_frac < 0.05:
        failures.append(f"parts sheet not transparent enough: {transparent_frac:.3f} fully-transparent px (want >=0.05)")
    else:
        print(f"PASS parts transparency: {transparent_frac*100:.1f}% fully-transparent pixels, size={parts.size}")

    if not REGIONS.exists():
        return _fail(failures + [f"missing {REGIONS}"])
    data = json.loads(REGIONS.read_text())
    aw, ah = data["atlasSize"]
    regions = data["regions"]
    if (aw, ah) != parts.size:
        failures.append(f"atlasSize {data['atlasSize']} != PNG size {list(parts.size)}")

    seen = set()
    for name in REQUIRED:
        if name not in regions:
            failures.append(f"region missing: {name}")
            continue
        seen.add(name)
        x, y, w, h = regions[name]
        if w <= 0 or h <= 0 or x < 0 or y < 0 or x + w > aw or y + h > ah:
            failures.append(f"region out of bounds: {name} {regions[name]} atlas={aw}x{ah}")
            continue
        crop = alpha[y:y + h, x:x + w]
        opaque_frac = float((crop > 8).mean())
        if opaque_frac < 0.02:
            failures.append(f"region has no visible content: {name} (opaque {opaque_frac:.3f})")
    extra = [n for n in regions if n not in seen]
    if extra:
        print(f"note: {len(extra)} extra region(s) beyond required: {extra}")
    if not failures:
        print(f"PASS regions: {len(REQUIRED)}/{len(REQUIRED)} required regions present, in-bounds, non-empty")

    if not BACKGROUND.exists():
        failures.append(f"missing {BACKGROUND}")
    else:
        bg = Image.open(BACKGROUND)
        if bg.mode == "RGBA":
            bg_alpha = np.asarray(bg)[:, :, 3]
            if int(bg_alpha.min()) < 255:
                failures.append(f"background has transparent pixels (min alpha {int(bg_alpha.min())}); must be opaque")
            else:
                print(f"PASS background opaque (RGBA all 255), size={bg.size}")
        else:
            print(f"PASS background opaque (mode={bg.mode}), size={bg.size}")

    if failures:
        return _fail(failures)
    print("ALL PASS route-switch GUI audit")
    return 0


def _fail(failures: list[str]) -> int:
    for f in failures:
        print(f"FAIL {f}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
