#!/usr/bin/env python3
"""Generate a compact shared parts atlas for builder puzzle machines.

This atlas only carries *small* material decals (screen glass, brushed brass
trim, warning hazard stripes, micro ticks, socket rims, screws, gaskets). It is
never used as a full-front UI poster. Geometry owns the silhouette; the atlas
only enhances small flush faces.

Output:
  src/assets/textures/environment/builder-puzzle-machines/hp_builder_machine_parts_atlas_v2.png
  src/assets/textures/environment/builder-puzzle-machines/hp_builder_machine_parts_atlas_v2.regions.json

Run with:
  python3 scripts/asset-build/generate-builder-machine-parts-atlas.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/textures/environment/builder-puzzle-machines"
ATLAS_SIZE = 768

# Region layout, [x, y, w, h] in atlas pixels. Matches WGPU lab regions.json format.
REGIONS: dict[str, tuple[int, int, int, int]] = {
    "screen.glass.cyan": (18, 18, 210, 150),
    "screen.glass.amber": (240, 18, 210, 150),
    "screen.glass.dark": (462, 18, 210, 150),
    "trim.brass.long": (18, 186, 732, 54),
    "trim.cyan.rail": (18, 252, 732, 34),
    "warning.stripe.amber": (18, 298, 450, 72),
    "microticks.horizontal": (480, 298, 270, 72),
    "socket.round.large": (18, 384, 168, 168),
    "socket.round.small": (198, 384, 120, 120),
    "screw.cross": (198, 516, 60, 60),
    "screw.hex": (264, 516, 60, 60),
    "gasket.corner": (330, 384, 120, 120),
    "bus.copper.bar": (462, 384, 288, 72),
    "cable.lane.dark": (462, 468, 288, 84),
}


def _vgrad(h: int, w: int, top: np.ndarray, bottom: np.ndarray) -> np.ndarray:
    t = np.linspace(0.0, 1.0, h)[:, None, None]
    return (top[None, None, :] * (1 - t) + bottom[None, None, :] * t) * np.ones((h, w, 1))


def _radial(h: int, w: int, inner: np.ndarray, outer: np.ndarray, cx=0.5, cy=0.45, power=1.0) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    nx = (xx / max(1, w - 1) - cx)
    ny = (yy / max(1, h - 1) - cy)
    r = np.clip(np.sqrt(nx * nx + ny * ny) / 0.72, 0.0, 1.0)[..., None] ** power
    return inner[None, None, :] * (1 - r) + outer[None, None, :] * r


def _noise(h: int, w: int, amp: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return (rng.random((h, w, 1)) - 0.5) * 2 * amp


def _brushed(h: int, w: int, base: np.ndarray, seed: int, streak=0.06) -> np.ndarray:
    rng = np.random.default_rng(seed)
    lines = (rng.random((1, w, 1)) - 0.5) * 2 * streak
    img = base[None, None, :] * np.ones((h, w, 1)) + lines
    img += _noise(h, w, 0.02, seed + 1)
    return img


def _put(atlas: np.ndarray, region: tuple[int, int, int, int], tile: np.ndarray) -> None:
    x, y, w, h = region
    atlas[y : y + h, x : x + w, :3] = np.clip(tile[:, :, :3], 0, 1)
    if tile.shape[2] == 4:
        atlas[y : y + h, x : x + w, 3] = np.clip(tile[:, :, 3], 0, 1)
    else:
        atlas[y : y + h, x : x + w, 3] = 1.0


def _rgb(*vals: float) -> np.ndarray:
    return np.array(vals, dtype=np.float64)


def screen_glass(w: int, h: int, glow: np.ndarray, seed: int) -> np.ndarray:
    base = _radial(h, w, glow * 0.55 + _rgb(0.02, 0.05, 0.06), _rgb(0.01, 0.02, 0.03), power=1.4)
    # faint horizontal scanlines
    yy = np.arange(h)[:, None, None]
    scan = (np.sin(yy / 3.0) * 0.5 + 0.5) * 0.05
    base = base * (1 - scan) + glow * scan * 0.6
    base += _noise(h, w, 0.012, seed)
    # soft inner bezel darkening at edges
    yy2, xx2 = np.mgrid[0:h, 0:w]
    edge = np.minimum.reduce([xx2, w - 1 - xx2, yy2, h - 1 - yy2]) / 14.0
    edge = np.clip(edge, 0, 1)[..., None]
    base *= 0.45 + 0.55 * edge
    return base


def brass_strip(w: int, h: int, seed: int) -> np.ndarray:
    base = _vgrad(h, w, _rgb(0.78, 0.58, 0.26), _rgb(0.34, 0.22, 0.08))
    base += _brushed(h, w, _rgb(0.0, 0.0, 0.0), seed, streak=0.05)
    # top highlight line
    base[: max(1, h // 12), :, :] += 0.18
    return base


def copper_bus(w: int, h: int, seed: int) -> np.ndarray:
    base = _vgrad(h, w, _rgb(0.72, 0.42, 0.24), _rgb(0.3, 0.14, 0.08))
    base += _brushed(h, w, _rgb(0.0, 0.0, 0.0), seed, streak=0.04)
    # terminal bolt dots
    yy, xx = np.mgrid[0:h, 0:w]
    for cx in np.linspace(0.08, 0.92, 8):
        d = np.sqrt((xx / w - cx) ** 2 + (yy / h - 0.5) ** 2)
        ring = np.clip(1 - np.abs(d - 0.045) / 0.012, 0, 1)[..., None]
        base = base * (1 - ring * 0.7) + _rgb(0.05, 0.04, 0.03)[None, None, :] * ring * 0.7
    return base


def cyan_rail(w: int, h: int, seed: int) -> np.ndarray:
    base = _vgrad(h, w, _rgb(0.16, 0.78, 0.86), _rgb(0.04, 0.3, 0.36))
    base += _noise(h, w, 0.03, seed)
    base[: max(1, h // 8), :, :] += 0.2
    return base


def hazard_stripes(w: int, h: int, seed: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    diag = ((xx + yy) // 36) % 2
    amber = _rgb(0.86, 0.5, 0.1)
    dark = _rgb(0.06, 0.05, 0.04)
    base = np.where(diag[..., None] > 0, amber[None, None, :], dark[None, None, :]).astype(np.float64)
    base += _noise(h, w, 0.02, seed)
    return base


def micro_ticks(w: int, h: int, seed: int) -> np.ndarray:
    base = _vgrad(h, w, _rgb(0.1, 0.12, 0.13), _rgb(0.04, 0.05, 0.06))
    yy, xx = np.mgrid[0:h, 0:w]
    major = (xx % 40 < 2)
    minor = (xx % 10 < 1) & (yy > h * 0.45)
    tick = (major | minor)[..., None]
    base = np.where(tick, _rgb(0.2, 0.85, 0.92)[None, None, :], base)
    return base


def socket_rim(w: int, h: int, seed: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx / (w - 1) - 0.5
    ny = yy / (h - 1) - 0.5
    r = np.sqrt(nx * nx + ny * ny) * 2
    metal = _radial(h, w, _rgb(0.6, 0.62, 0.64), _rgb(0.18, 0.2, 0.22), power=0.9)
    bore = np.clip((0.55 - r) / 0.1, 0, 1)[..., None]
    inner = _rgb(0.02, 0.03, 0.04)[None, None, :]
    base = metal * (1 - bore) + inner * bore
    ring = np.clip(1 - np.abs(r - 0.62) / 0.05, 0, 1)[..., None]
    base = base * (1 - ring * 0.5) + _rgb(0.05, 0.05, 0.06)[None, None, :] * ring * 0.5
    base += _noise(h, w, 0.015, seed)
    return base


def screw(w: int, h: int, kind: str, seed: int) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx / (w - 1) - 0.5
    ny = yy / (h - 1) - 0.5
    r = np.sqrt(nx * nx + ny * ny) * 2
    head = _radial(h, w, _rgb(0.55, 0.57, 0.6), _rgb(0.2, 0.22, 0.24), power=1.1)
    mask = (r < 0.8)[..., None]
    base = np.where(mask, head, _rgb(0.06, 0.07, 0.08)[None, None, :])
    if kind == "cross":
        slot = ((np.abs(nx) < 0.06) | (np.abs(ny) < 0.06)) & (r < 0.6)
    else:  # hex
        ang = np.arctan2(ny, nx)
        slot = (np.abs(((ang % (np.pi / 3)) - np.pi / 6)) < 0.16) & (r > 0.3) & (r < 0.62)
    base = np.where(slot[..., None], _rgb(0.04, 0.05, 0.06)[None, None, :], base)
    base += _noise(h, w, 0.01, seed)
    return base


def gasket(w: int, h: int, seed: int) -> np.ndarray:
    base = _vgrad(h, w, _rgb(0.07, 0.08, 0.09), _rgb(0.02, 0.025, 0.03))
    yy, xx = np.mgrid[0:h, 0:w]
    rib = (xx % 16 < 6)
    base = np.where(rib[..., None], base * 1.4, base * 0.7)
    base += _noise(h, w, 0.012, seed)
    return base


def cable_lane(w: int, h: int, seed: int) -> np.ndarray:
    base = _vgrad(h, w, _rgb(0.05, 0.06, 0.07), _rgb(0.015, 0.02, 0.025))
    yy, xx = np.mgrid[0:h, 0:w]
    for cy in (0.28, 0.5, 0.72):
        d = np.abs(yy / h - cy)
        tube = np.clip(1 - d / 0.07, 0, 1)[..., None]
        hl = np.clip(1 - np.abs(yy / h - (cy - 0.03)) / 0.012, 0, 1)[..., None]
        base = base * (1 - tube * 0.6) + _rgb(0.09, 0.11, 0.12)[None, None, :] * tube * 0.6
        base += hl * 0.12
    base += _noise(h, w, 0.01, seed)
    return base


def build() -> None:
    atlas = np.zeros((ATLAS_SIZE, ATLAS_SIZE, 4), dtype=np.float64)
    atlas[:, :, :3] = 0.02
    atlas[:, :, 3] = 1.0

    def tile(region_id: str):
        _, _, w, h = REGIONS[region_id]
        return w, h

    _put(atlas, REGIONS["screen.glass.cyan"], screen_glass(*tile("screen.glass.cyan"), _rgb(0.18, 0.85, 0.95), 11))
    _put(atlas, REGIONS["screen.glass.amber"], screen_glass(*tile("screen.glass.amber"), _rgb(0.95, 0.62, 0.18), 12))
    _put(atlas, REGIONS["screen.glass.dark"], screen_glass(*tile("screen.glass.dark"), _rgb(0.1, 0.16, 0.2), 13))
    _put(atlas, REGIONS["trim.brass.long"], brass_strip(*tile("trim.brass.long"), 21))
    _put(atlas, REGIONS["trim.cyan.rail"], cyan_rail(*tile("trim.cyan.rail"), 22))
    _put(atlas, REGIONS["warning.stripe.amber"], hazard_stripes(*tile("warning.stripe.amber"), 31))
    _put(atlas, REGIONS["microticks.horizontal"], micro_ticks(*tile("microticks.horizontal"), 32))
    _put(atlas, REGIONS["socket.round.large"], socket_rim(*tile("socket.round.large"), 41))
    _put(atlas, REGIONS["socket.round.small"], socket_rim(*tile("socket.round.small"), 42))
    _put(atlas, REGIONS["screw.cross"], screw(*tile("screw.cross"), "cross", 51))
    _put(atlas, REGIONS["screw.hex"], screw(*tile("screw.hex"), "hex", 52))
    _put(atlas, REGIONS["gasket.corner"], gasket(*tile("gasket.corner"), 61))
    _put(atlas, REGIONS["bus.copper.bar"], copper_bus(*tile("bus.copper.bar"), 71))
    _put(atlas, REGIONS["cable.lane.dark"], cable_lane(*tile("cable.lane.dark"), 81))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Alpha is fully opaque everywhere; store as quantized RGB so the embedded GLB
    # texture stays small (this atlas is embedded once per consuming machine).
    rgb = Image.fromarray((np.clip(atlas[:, :, :3], 0, 1) * 255).astype(np.uint8))
    img = rgb.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    png_path = OUT_DIR / "hp_builder_machine_parts_atlas_v2.png"
    img.save(png_path, optimize=True)

    regions_path = OUT_DIR / "hp_builder_machine_parts_atlas_v2.regions.json"
    regions_path.write_text(
        json.dumps({"atlasSize": [ATLAS_SIZE, ATLAS_SIZE], "regions": REGIONS}, indent=2) + "\n"
    )
    print(f"wrote {png_path} ({png_path.stat().st_size} bytes)")
    print(f"wrote {regions_path}")


if __name__ == "__main__":
    build()
