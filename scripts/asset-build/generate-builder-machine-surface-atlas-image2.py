#!/usr/bin/env python3
"""Generate the builder puzzle-machine *surface* material atlas (Image2 pass).

Unlike the old front-poster decal sheet, this pass is split into two kinds of
real material art:

  A. Transparent PNG cutouts (alpha) — wear, grime, scratches, screws, gaskets,
     lens highlights, blank nameplates, hazard tape, micro ticks, cable scuff.
     These overlay flush onto real geometry so an edge looks worn / a corner
     looks dirty without changing the silhouette.

  B. Opaque material tiles — smoked powdercoat, aged medical plastic, brushed
     brass, cyan/amber smoked glass, dark rubber, copper bus, black recess.
     These UV onto the LARGE faces of the machine bodies so the big flush panels
     stop reading as flat Blender plastic.

Every source is first written as its own file under `image2-sources/`, then all
sources are packed into one 3D surface atlas the Blender baker UVs from. No
readable text, no logos, no UI layout, no puzzle answers are baked in.

Outputs:
  src/assets/textures/environment/builder-puzzle-machines/image2-sources/<name>.png
  src/assets/textures/environment/builder-puzzle-machines/hp_builder_machine_surface_atlas_image2.png
  src/assets/textures/environment/builder-puzzle-machines/hp_builder_machine_surface_atlas_image2.regions.json
  .tmp/puzzle-machine-surface-sources-contact.png   (review contact sheet)
  .tmp/puzzle-machine-surface-atlas.png             (atlas preview on checker)

Run with:
  python3 scripts/asset-build/generate-builder-machine-surface-atlas-image2.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
TEX_DIR = ROOT / "src/assets/textures/environment/builder-puzzle-machines"
SRC_DIR = TEX_DIR / "image2-sources"
TMP_DIR = ROOT / ".tmp"
ATLAS_SIZE = 2048

# ---------------------------------------------------------------------------
# Atlas layout. [x, y, w, h] in atlas pixels. Top half = large opaque material
# tiles (big-face UV). Bottom half = transparent cutout overlays.
# ---------------------------------------------------------------------------
REGIONS: dict[str, tuple[int, int, int, int]] = {
    # B. opaque material tiles (480x480) — two rows of four.
    "smoked_powdercoat_panel": (16, 16, 480, 480),
    "aged_medical_plastic_panel": (528, 16, 480, 480),
    "brushed_brass_panel": (1040, 16, 480, 480),
    "cyan_smoked_glass_panel": (1552, 16, 480, 480),
    "amber_archive_glass_panel": (16, 528, 480, 480),
    "dark_rubber_panel": (528, 528, 480, 480),
    "copper_bus_panel": (1040, 528, 480, 480),
    "black_recess_panel": (1552, 528, 480, 480),
    # A. transparent cutouts — long wear/grime strips.
    "edge_wear_gold_alpha": (16, 1056, 992, 200),
    "edge_wear_cyan_alpha": (1040, 1056, 992, 200),
    "hazard_stripe_alpha": (16, 1280, 992, 200),
    "cable_scuff_alpha": (1040, 1280, 992, 200),
    "micro_ticks_alpha": (16, 1504, 992, 200),
    "panel_scratches_alpha": (1040, 1504, 992, 200),
    # A. transparent cutouts — squares + nameplate.
    "screw_cross_alpha": (16, 1728, 256, 256),
    "screw_hex_alpha": (288, 1728, 256, 256),
    "rubber_gasket_alpha": (560, 1728, 256, 256),
    "lens_highlight_alpha": (832, 1728, 256, 256),
    "grime_corner_alpha": (1104, 1728, 256, 256),
    "blank_nameplate_alpha": (1376, 1728, 656, 256),
}

TILE_NAMES = [n for n in REGIONS if n.endswith("_panel")]
CUTOUT_NAMES = [n for n in REGIONS if n.endswith("_alpha")]


# ---------------------------------------------------------------------------
# Procedural helpers (numpy float [0,1]).
# ---------------------------------------------------------------------------
def _rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def _smooth_noise(h: int, w: int, scale: int, seed: int) -> np.ndarray:
    rng = _rng(seed)
    lh = max(2, h // max(1, scale))
    lw = max(2, w // max(1, scale))
    base = (rng.random((lh, lw)) * 255).astype(np.uint8)
    img = Image.fromarray(base).resize((w, h), Image.BILINEAR)
    return np.asarray(img, dtype=np.float64) / 255.0


def _fbm(h: int, w: int, seed: int, octaves: int = 4, scale: int = 64) -> np.ndarray:
    out = np.zeros((h, w))
    amp = 1.0
    total = 0.0
    s = scale
    for o in range(octaves):
        out += amp * _smooth_noise(h, w, max(1, s), seed + o * 17)
        total += amp
        amp *= 0.5
        s = max(1, s // 2)
    return out / total


def _vgrad(h: int, w: int, top: np.ndarray, bottom: np.ndarray) -> np.ndarray:
    t = np.linspace(0.0, 1.0, h)[:, None, None]
    grad = top[None, None, :] * (1 - t) + bottom[None, None, :] * t
    return grad * np.ones((h, w, 1))


def _radial(h: int, w: int, inner: np.ndarray, outer: np.ndarray, cx=0.5, cy=0.45, power=1.0) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx / max(1, w - 1) - cx
    ny = yy / max(1, h - 1) - cy
    r = np.clip(np.sqrt(nx * nx + ny * ny) / 0.72, 0.0, 1.0)[..., None] ** power
    return inner[None, None, :] * (1 - r) + outer[None, None, :] * r


def _edge_vignette(h: int, w: int, falloff: int = 26) -> np.ndarray:
    yy, xx = np.mgrid[0:h, 0:w]
    e = np.minimum.reduce([xx, w - 1 - xx, yy, h - 1 - yy]) / falloff
    return np.clip(e, 0, 1)


def _c(*vals: float) -> np.ndarray:
    return np.array(vals, dtype=np.float64)


def _to_rgba(rgb: np.ndarray, alpha: np.ndarray | None) -> Image.Image:
    rgb = np.clip(rgb, 0, 1)
    if alpha is None:
        a = np.ones(rgb.shape[:2])
    else:
        a = np.clip(alpha, 0, 1)
    arr = np.dstack([rgb, a[..., None] if a.ndim == 2 else a])
    return Image.fromarray((arr * 255).astype(np.uint8), "RGBA")


def _scratches(draw: ImageDraw.ImageDraw, w: int, h: int, seed: int, count: int, color, length, wide=1, jitter=True):
    rng = _rng(seed)
    for _ in range(count):
        x0 = rng.uniform(0, w)
        y0 = rng.uniform(0, h)
        ang = rng.uniform(0, np.pi)
        ln = rng.uniform(length * 0.4, length)
        x1 = x0 + np.cos(ang) * ln
        y1 = y0 + np.sin(ang) * ln
        a = int(rng.uniform(60, 200)) if jitter else 255
        col = (color[0], color[1], color[2], a)
        draw.line([(x0, y0), (x1, y1)], fill=col, width=int(rng.uniform(1, wide + 1)))


# ---------------------------------------------------------------------------
# B. Opaque material tiles.
# ---------------------------------------------------------------------------
def smoked_powdercoat(w, h, seed):
    base = _vgrad(h, w, _c(0.085, 0.10, 0.115), _c(0.045, 0.055, 0.065))
    grain = (_fbm(h, w, seed, 5, 10) - 0.5) * 0.05
    speck = (_fbm(h, w, seed + 3, 2, 3) - 0.5) * 0.025
    base += (grain + speck)[..., None]
    vig = _edge_vignette(h, w, 30)[..., None]
    base *= 0.7 + 0.3 * vig
    return base, None


def aged_medical_plastic(w, h, seed):
    base = np.ones((h, w, 3)) * _c(0.46, 0.50, 0.45)
    mott = _fbm(h, w, seed, 4, 70)[..., None]
    base = base * (0.82 + 0.3 * mott)
    # yellowed stains drifting warm
    stain = _fbm(h, w, seed + 5, 3, 40)
    warm = np.clip((stain - 0.55) / 0.4, 0, 1)[..., None]
    base = base * (1 - warm * 0.4) + _c(0.40, 0.36, 0.24)[None, None, :] * warm * 0.4
    base += (_fbm(h, w, seed + 9, 5, 8) - 0.5)[..., None] * 0.03
    return base, None


def brushed_brass(w, h, seed):
    base = _vgrad(h, w, _c(0.74, 0.56, 0.26), _c(0.40, 0.28, 0.11))
    rng = _rng(seed)
    streak = (rng.random((1, w)) - 0.5)[..., None] * 0.10
    base += streak * np.ones((h, 1, 1))
    base += (_fbm(h, w, seed + 2, 4, 30) - 0.5)[..., None] * 0.05
    # darker oxidized edges
    vig = _edge_vignette(h, w, 34)[..., None]
    base *= 0.74 + 0.26 * vig
    img = _to_rgba(base, None)
    d = ImageDraw.Draw(img, "RGBA")
    _scratches(d, w, h, seed + 7, 40, (210, 180, 110), max(w, h) * 0.18, wide=1)
    _scratches(d, w, h, seed + 8, 14, (60, 70, 40), max(w, h) * 0.10, wide=2)  # oxidation drag
    return np.asarray(img, dtype=np.float64)[..., :3] / 255.0, None


def cyan_smoked_glass(w, h, seed):
    base = _radial(h, w, _c(0.07, 0.30, 0.34), _c(0.015, 0.05, 0.07), power=1.3)
    fog = _fbm(h, w, seed, 3, 90)[..., None]
    base += fog * _c(0.02, 0.10, 0.12)[None, None, :]
    # diagonal reflection streak
    yy, xx = np.mgrid[0:h, 0:w]
    diag = np.clip(1 - np.abs((xx - yy) / w - 0.1) / 0.06, 0, 1)[..., None]
    base += diag * 0.12
    # faint scanlines
    scan = (np.sin(yy / 3.0) * 0.5 + 0.5)[..., None] * 0.03
    base += scan
    return base, None


def amber_archive_glass(w, h, seed):
    base = _radial(h, w, _c(0.34, 0.22, 0.06), _c(0.04, 0.025, 0.01), power=1.4)
    yy, xx = np.mgrid[0:h, 0:w]
    scan = (np.sin(yy / 2.4) * 0.5 + 0.5)[..., None] * 0.05
    base = base * (1 - scan) + _c(0.5, 0.32, 0.1)[None, None, :] * scan
    base += _fbm(h, w, seed, 3, 80)[..., None] * _c(0.05, 0.03, 0.01)[None, None, :]
    vig = _edge_vignette(h, w, 24)[..., None]
    base *= 0.55 + 0.45 * vig
    return base, None


def dark_rubber(w, h, seed):
    base = np.ones((h, w, 3)) * _c(0.035, 0.04, 0.045)
    bump = (_fbm(h, w, seed, 5, 6) - 0.5)[..., None] * 0.04
    base += bump
    wear = np.clip((_fbm(h, w, seed + 4, 3, 50) - 0.6) / 0.4, 0, 1)[..., None]
    base += wear * 0.03
    return base, None


def copper_bus(w, h, seed):
    base = _vgrad(h, w, _c(0.66, 0.40, 0.22), _c(0.30, 0.16, 0.08))
    rng = _rng(seed)
    streak = (rng.random((1, w)) - 0.5)[..., None] * 0.08
    base += streak * np.ones((h, 1, 1))
    base += (_fbm(h, w, seed + 1, 4, 24) - 0.5)[..., None] * 0.05
    img = _to_rgba(base, None)
    d = ImageDraw.Draw(img, "RGBA")
    _scratches(d, w, h, seed + 6, 30, (200, 140, 90), max(w, h) * 0.2, wide=1)
    return np.asarray(img, dtype=np.float64)[..., :3] / 255.0, None


def black_recess(w, h, seed):
    base = _radial(h, w, _c(0.05, 0.058, 0.07), _c(0.012, 0.015, 0.02), power=1.6)
    dust = np.clip((_fbm(h, w, seed, 2, 4) - 0.7) / 0.3, 0, 1)[..., None]
    base += dust * 0.05
    return base, None


# ---------------------------------------------------------------------------
# A. Transparent cutouts (return rgb, alpha).
# ---------------------------------------------------------------------------
def _edge_wear(w, h, seed, color):
    rgb = np.ones((h, w, 3)) * (np.array(color) / 255.0)[None, None, :]
    alpha = np.zeros((h, w))
    img_a = Image.fromarray((alpha * 255).astype(np.uint8))
    d = ImageDraw.Draw(img_a)
    rng = _rng(seed)
    # wear hugs the top edge band (UV'd along a real edge)
    band = int(h * 0.5)
    for _ in range(90):
        x0 = rng.uniform(0, w)
        y0 = rng.uniform(0, band)
        ang = rng.uniform(-0.4, 0.4)
        ln = rng.uniform(w * 0.02, w * 0.12)
        x1 = x0 + np.cos(ang) * ln
        y1 = y0 + np.sin(ang) * ln * 0.4
        d.line([(x0, y0), (x1, y1)], fill=int(rng.uniform(120, 255)), width=int(rng.uniform(1, 3)))
    # chip blotches along the very edge
    for _ in range(26):
        cx = rng.uniform(0, w)
        cy = rng.uniform(0, h * 0.18)
        r = rng.uniform(2, 7)
        d.ellipse([cx - r, cy - r, cx + r, cy + r * 0.6], fill=int(rng.uniform(120, 230)))
    a = np.asarray(img_a, dtype=np.float64) / 255.0
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))) / 255.0
    return rgb, a


def edge_wear_gold(w, h, seed):
    return _edge_wear(w, h, seed, (224, 188, 104))


def edge_wear_cyan(w, h, seed):
    return _edge_wear(w, h, seed, (130, 232, 255))


def grime_corner(w, h, seed):
    yy, xx = np.mgrid[0:h, 0:w]
    # strongest in top-left corner, fades out
    nx = xx / (w - 1)
    ny = yy / (h - 1)
    falloff = np.clip(1 - np.sqrt(nx * nx + ny * ny) / 0.85, 0, 1)
    grime = _fbm(h, w, seed, 4, 40)
    alpha = falloff * np.clip((grime - 0.35) / 0.5, 0, 1) * 0.85
    col = _c(0.16, 0.14, 0.09)[None, None, :] * (0.6 + 0.6 * grime[..., None])
    return col, alpha


def panel_scratches(w, h, seed):
    rgb = np.ones((h, w, 3)) * _c(0.78, 0.80, 0.82)[None, None, :]
    img_a = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img_a)
    _scratch_alpha(d, w, h, seed, 120, max_alpha=110, length=max(w, h) * 0.18)
    a = np.asarray(img_a, dtype=np.float64) / 255.0 * 0.5
    return rgb, a


def _scratch_alpha(draw, w, h, seed, count, max_alpha, length):
    rng = _rng(seed)
    for _ in range(count):
        x0 = rng.uniform(0, w)
        y0 = rng.uniform(0, h)
        ang = rng.uniform(0, np.pi)
        ln = rng.uniform(length * 0.3, length)
        x1 = x0 + np.cos(ang) * ln
        y1 = y0 + np.sin(ang) * ln
        draw.line([(x0, y0), (x1, y1)], fill=int(rng.uniform(40, max_alpha)), width=1)


def _screw(w, h, seed, kind):
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx / (w - 1) - 0.5
    ny = yy / (h - 1) - 0.5
    r = np.sqrt(nx * nx + ny * ny) * 2
    head_r = 0.84
    # metal head shading
    rgb = _radial(h, w, _c(0.62, 0.64, 0.67), _c(0.22, 0.24, 0.27), power=1.1)
    alpha = np.clip((head_r - r) / 0.05, 0, 1)
    # rim shadow
    rim = np.clip(1 - np.abs(r - 0.78) / 0.08, 0, 1)
    rgb = rgb * (1 - rim[..., None] * 0.5)
    if kind == "cross":
        slot = ((np.abs(nx) < 0.07) | (np.abs(ny) < 0.07)) & (r < 0.62)
    else:
        ang = np.arctan2(ny, nx)
        slot = (np.abs(((ang % (np.pi / 3)) - np.pi / 6)) < 0.18) & (r > 0.18) & (r < 0.64)
    rgb = np.where(slot[..., None], _c(0.05, 0.06, 0.07)[None, None, :], rgb)
    # tiny specular highlight
    hl = np.clip(1 - np.sqrt((nx + 0.18) ** 2 + (ny + 0.2) ** 2) / 0.18, 0, 1)
    rgb += hl[..., None] * 0.25
    return rgb, alpha


def screw_cross(w, h, seed):
    return _screw(w, h, seed, "cross")


def screw_hex(w, h, seed):
    return _screw(w, h, seed, "hex")


def rubber_gasket(w, h, seed):
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx / (w - 1) - 0.5
    ny = yy / (h - 1) - 0.5
    r = np.sqrt(nx * nx + ny * ny) * 2
    ring = (r > 0.6) & (r < 0.94)
    alpha = np.where(ring, 1.0, 0.0)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255.0
    ang = np.arctan2(ny, nx)
    rib = (np.sin(ang * 40) * 0.5 + 0.5) * 0.25
    rgb = (_c(0.05, 0.055, 0.06)[None, None, :] * np.ones((h, w, 1))) * (0.7 + rib[..., None])
    return rgb, alpha


def lens_highlight(w, h, seed):
    yy, xx = np.mgrid[0:h, 0:w]
    nx = xx / (w - 1) - 0.42
    ny = yy / (h - 1) - 0.38
    blob = np.clip(1 - np.sqrt((nx / 0.5) ** 2 + (ny / 0.34) ** 2), 0, 1) ** 1.6
    streak = np.clip(1 - np.abs((xx - yy) / w - 0.05) / 0.04, 0, 1) * np.clip(1 - np.abs(ny) / 0.4, 0, 1)
    alpha = np.clip(blob * 0.8 + streak * 0.5, 0, 1)
    rgb = np.ones((h, w, 3)) * _c(0.96, 0.98, 1.0)[None, None, :]
    return rgb, alpha


def blank_nameplate(w, h, seed):
    pad = 14
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # brushed metal plate, rounded, beveled — NO text.
    base = _vgrad(h, w, _c(0.52, 0.54, 0.57), _c(0.30, 0.32, 0.35))
    rng = _rng(seed)
    streak = (rng.random((1, w)) - 0.5)[..., None] * 0.08
    base += streak * np.ones((h, 1, 1))
    plate = _to_rgba(base, None)
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([pad, pad, w - pad, h - pad], radius=22, fill=255)
    img.paste(plate, (0, 0), mask)
    # bevel highlight + corner screw dots
    d.rounded_rectangle([pad, pad, w - pad, h - pad], radius=22, outline=(210, 215, 220, 180), width=3)
    for sx, sy in [(pad + 24, pad + 24), (w - pad - 24, pad + 24), (pad + 24, h - pad - 24), (w - pad - 24, h - pad - 24)]:
        d.ellipse([sx - 7, sy - 7, sx + 7, sy + 7], fill=(40, 44, 48, 255))
        d.ellipse([sx - 4, sy - 4, sx + 4, sy + 4], fill=(150, 155, 160, 255))
    arr = np.asarray(img, dtype=np.float64) / 255.0
    return arr[..., :3], arr[..., 3]


def hazard_stripe(w, h, seed):
    yy, xx = np.mgrid[0:h, 0:w]
    diag = ((xx + yy) // 44) % 2
    amber = _c(0.80, 0.50, 0.08)
    dark = _c(0.06, 0.05, 0.04)
    rgb = np.where(diag[..., None] > 0, amber[None, None, :], dark[None, None, :]).astype(np.float64)
    rgb += (_fbm(h, w, seed, 4, 20) - 0.5)[..., None] * 0.06
    # band alpha with worn nicks + transparent top/bottom margin
    margin = int(h * 0.14)
    alpha = np.ones((h, w))
    alpha[:margin, :] = 0
    alpha[-margin:, :] = 0
    nick = np.clip((_fbm(h, w, seed + 3, 4, 16) - 0.62) / 0.3, 0, 1)
    alpha = np.clip(alpha - nick * 0.9, 0, 1)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.5))) / 255.0
    return rgb, alpha


def micro_ticks(w, h, seed):
    img_a = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img_a)
    baseline_y = int(h * 0.62)
    d.line([(int(w * 0.03), baseline_y), (int(w * 0.97), baseline_y)], fill=200, width=2)
    n = 64
    for i in range(n + 1):
        x = int(w * 0.03 + (w * 0.94) * i / n)
        major = i % 8 == 0
        th = int(h * 0.30) if major else int(h * 0.16)
        d.line([(x, baseline_y), (x, baseline_y - th)], fill=230 if major else 150, width=2 if major else 1)
    a = np.asarray(img_a, dtype=np.float64) / 255.0
    rgb = np.ones((h, w, 3)) * _c(0.62, 0.86, 0.92)[None, None, :]
    return rgb, a


def cable_scuff(w, h, seed):
    rgb = np.ones((h, w, 3)) * _c(0.10, 0.10, 0.11)[None, None, :]
    img_a = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img_a)
    rng = _rng(seed)
    for _ in range(40):
        x0 = rng.uniform(0, w)
        y0 = rng.uniform(h * 0.2, h * 0.8)
        ln = rng.uniform(w * 0.05, w * 0.22)
        ang = rng.uniform(-0.5, 0.5)
        x1 = x0 + np.cos(ang) * ln
        y1 = y0 + np.sin(ang) * ln
        d.line([(x0, y0), (x1, y1)], fill=int(rng.uniform(40, 130)), width=int(rng.uniform(3, 10)))
    a = np.asarray(img_a.filter(ImageFilter.GaussianBlur(2.0)), dtype=np.float64) / 255.0 * 0.55
    return rgb, a


SYNTH = {
    "smoked_powdercoat_panel": smoked_powdercoat,
    "aged_medical_plastic_panel": aged_medical_plastic,
    "brushed_brass_panel": brushed_brass,
    "cyan_smoked_glass_panel": cyan_smoked_glass,
    "amber_archive_glass_panel": amber_archive_glass,
    "dark_rubber_panel": dark_rubber,
    "copper_bus_panel": copper_bus,
    "black_recess_panel": black_recess,
    "edge_wear_gold_alpha": edge_wear_gold,
    "edge_wear_cyan_alpha": edge_wear_cyan,
    "hazard_stripe_alpha": hazard_stripe,
    "cable_scuff_alpha": cable_scuff,
    "micro_ticks_alpha": micro_ticks,
    "panel_scratches_alpha": panel_scratches,
    "screw_cross_alpha": screw_cross,
    "screw_hex_alpha": screw_hex,
    "rubber_gasket_alpha": rubber_gasket,
    "lens_highlight_alpha": lens_highlight,
    "grime_corner_alpha": grime_corner,
    "blank_nameplate_alpha": blank_nameplate,
}


def build() -> None:
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (0, 0, 0, 0))

    seed = 1000
    sources: dict[str, Image.Image] = {}
    for name, (x, y, w, h) in REGIONS.items():
        rgb, alpha = SYNTH[name](w, h, seed)
        seed += 1
        img = _to_rgba(rgb, alpha)
        sources[name] = img
        img.save(SRC_DIR / f"{name}.png", optimize=True)
        atlas.paste(img, (x, y), img if name.endswith("_alpha") else None)

    atlas_path = TEX_DIR / "hp_builder_machine_surface_atlas_image2.png"
    # Posterize RGB to 6 bits (alpha preserved) so the embedded GLB texture stays
    # well under the 1.2MB budget; the loss is imperceptible on matte surfaces.
    a_arr = np.asarray(atlas).astype(np.uint16)
    rgb_q = ((a_arr[..., :3] // 4) * 4).astype(np.uint8)
    atlas_quant = Image.fromarray(np.dstack([rgb_q, a_arr[..., 3].astype(np.uint8)]))
    atlas_quant.save(atlas_path, optimize=True)

    regions_path = TEX_DIR / "hp_builder_machine_surface_atlas_image2.regions.json"
    regions_path.write_text(json.dumps({"atlasSize": [ATLAS_SIZE, ATLAS_SIZE], "regions": REGIONS}, indent=2) + "\n")

    _contact_sheet(sources)
    _atlas_preview(atlas)

    size = atlas_path.stat().st_size
    print(f"wrote {atlas_path} ({size} bytes, {size/1024/1024:.2f} MB)")
    print(f"wrote {regions_path}")
    print(f"wrote {len(sources)} source PNGs to {SRC_DIR}")
    if size > 1_200_000:
        print(f"WARNING: atlas {size} bytes exceeds 1.2MB target")


def _contact_sheet(sources: dict[str, Image.Image]) -> None:
    cell = 230
    cols = 5
    rows = (len(sources) + cols - 1) // cols
    pad = 16
    label = 22
    W = cols * (cell + pad) + pad
    H = rows * (cell + pad + label) + pad
    sheet = Image.new("RGB", (W, H), (24, 26, 30))
    # checker behind to show transparency
    checker = Image.new("RGB", (cell, cell), (60, 62, 66))
    cd = ImageDraw.Draw(checker)
    for yy in range(0, cell, 20):
        for xx in range(0, cell, 20):
            if (xx // 20 + yy // 20) % 2 == 0:
                cd.rectangle([xx, yy, xx + 20, yy + 20], fill=(44, 46, 50))
    d = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate(sources.items()):
        r, c = divmod(i, cols)
        x = pad + c * (cell + pad)
        y = pad + r * (cell + pad + label)
        sheet.paste(checker, (x, y))
        thumb = img.resize((cell, cell), Image.BILINEAR)
        sheet.paste(thumb, (x, y), thumb)
        d.text((x, y + cell + 4), name, fill=(210, 214, 220))
    sheet.save(TMP_DIR / "puzzle-machine-surface-sources-contact.png")
    print(f"wrote {TMP_DIR / 'puzzle-machine-surface-sources-contact.png'}")


def _atlas_preview(atlas: Image.Image) -> None:
    checker = Image.new("RGB", atlas.size, (60, 62, 66))
    cd = ImageDraw.Draw(checker)
    step = 64
    for yy in range(0, atlas.size[1], step):
        for xx in range(0, atlas.size[0], step):
            if (xx // step + yy // step) % 2 == 0:
                cd.rectangle([xx, yy, xx + step, yy + step], fill=(40, 42, 46))
    checker.paste(atlas, (0, 0), atlas)
    checker.resize((1024, 1024), Image.BILINEAR).save(TMP_DIR / "puzzle-machine-surface-atlas.png")
    print(f"wrote {TMP_DIR / 'puzzle-machine-surface-atlas.png'}")


if __name__ == "__main__":
    build()
