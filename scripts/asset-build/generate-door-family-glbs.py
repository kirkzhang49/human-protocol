#!/usr/bin/env python3
"""Human Protocol — Premium Door Family GLB generator.

Self-contained, merge-safe.  Does NOT touch any registry / catalog /
footprint / ingested-packs / QA files.  Writes only:

  src/assets/textures/environment/doors/image2-sources/*.png
  src/assets/textures/environment/doors/hp_door_family_atlas.png
  src/assets/textures/environment/doors/hp_door_family_atlas.regions.json
  src/assets/models-cooked/environment/doors/hp_door_residential_access.glb
  src/assets/models-cooked/environment/doors/hp_door_clinic_memory.glb
  src/assets/models-cooked/environment/doors/hp_door_reclamation_archive.glb
  src/assets/models-cooked/environment/doors/hp_door_industrial_access.glb
  .tmp/door-families/residential_access-closeup.png
  .tmp/door-families/clinic_memory-closeup.png
  .tmp/door-families/reclamation_archive-closeup.png
  .tmp/door-families/industrial_access-closeup.png

Door blueprint (all four):
  Double-leaf door in a heavy frame.
  Opening size ~4.4 m wide x 3.3 m tall x 0.40 m deep.
  Frame base sits at y=0 (min Y = 0).
  Parts: frame_left_jamb, frame_right_jamb, frame_lintel, leaf_left,
         leaf_right, center_seam, threshold, hardware + status lens.

Run:
    python3 scripts/asset-build/generate-door-family-glbs.py
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------
REPO    = Path(__file__).resolve().parents[2]
TEX_DIR = REPO / "src/assets/textures/environment/doors"
SRC_DIR = TEX_DIR / "image2-sources"
GLB_DIR = REPO / "src/assets/models-cooked/environment/doors"
TMP_DIR = REPO / ".tmp/door-families"
ATLAS_PNG     = TEX_DIR / "hp_door_family_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_door_family_atlas.regions.json"

for _d in (TEX_DIR, SRC_DIR, GLB_DIR, TMP_DIR):
    _d.mkdir(parents=True, exist_ok=True)

RNG        = np.random.default_rng(20260613)
ATLAS_SIZE = 2048   # full master atlas (written to disk for reference / runtime)
# Per-family mini-atlas size: each family embeds its own compact atlas in the GLB
# so we don't pay 500 KB per GLB for the full 2048 sheet.
FAMILY_ATLAS_SIZE = 768

# --------------------------------------------------------------------------
# Palette
# --------------------------------------------------------------------------
# Residential — warm wood / cream laminate + restrained cyan
WOOD_DARK   = (96,  64,  32)
WOOD_MID    = (156, 110,  62)
WOOD_HI     = (206, 158,  98)
WOOD_GRAIN  = (120,  82,  40)   # grain line colour
CREAM_DARK  = (182, 170, 150)
CREAM_MID   = (216, 206, 190)
CREAM_HI    = (242, 236, 226)
STEEL_DARK  = (60,  64,  72)
STEEL_MID   = (110, 116, 128)
STEEL_HI    = (196, 204, 218)

# Clinic — white / pale-blue ceramic + frosted glass + soft cyan
WHITE_TILE  = (232, 236, 242)
PALE_BLUE   = (180, 200, 226)
FROST_WHITE = (224, 230, 240)
RUBBER_SEAL = (20,  22,  24)
RUBBER_MID2 = (36,  40,  44)

# Archive — graphite + aged brass + amber + cyan  (lifted per spec)
GRAPHITE_DARK = (36,  40,  46)
GRAPHITE_MID  = (58,  64,  72)
GRAPHITE_HI   = (92, 100, 112)
BRASS_DARK    = (66,  48,  18)
BRASS_MID     = (162, 126,  54)
BRASS_HI      = (210, 174,  96)
AMBER_DARK    = (32,  14,   2)
AMBER_MID     = (196, 114,  24)
AMBER_HI      = (238, 178,  58)

# Industrial — brushed steel, iron frame, hazard yellow/black stripe, cyan
IND_STEEL_DARK  = (44,  48,  54)
IND_STEEL_MID   = (78,  84,  92)
IND_STEEL_HI    = (138, 148, 162)
IND_IRON_DARK   = (24,  26,  28)
IND_IRON_MID    = (46,  50,  56)
IND_IRON_HI     = (72,  78,  86)
IND_HAZARD_YEL  = (212, 168,  0)
IND_HAZARD_BLK  = (22,  22,  22)
IND_RIVET       = (96, 104, 116)
IND_RIVET_HI    = (182, 192, 208)

# Shared accents
CYAN          = (48, 220, 255)
CYAN_DIM      = (20, 100, 140)
BLACK_RECESS  = (14,  16,  19)


# --------------------------------------------------------------------------
# Noise / gradient helpers
# --------------------------------------------------------------------------
def _noise(w: int, h: int, scale: float, seed_offset: int = 0) -> np.ndarray:
    rng = np.random.default_rng(20260613 + seed_offset)
    gw  = max(2, int(w * scale))
    gh  = max(2, int(h * scale))
    small = rng.standard_normal((gh, gw))
    img = Image.fromarray(
        ((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype("uint8")
    )
    img = img.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr * 2.0 - 1.0


def _vgrad(w: int, h: int, top, bottom) -> Image.Image:
    top    = np.array(top,    dtype=np.float32)
    bottom = np.array(bottom, dtype=np.float32)
    t   = np.linspace(0.0, 1.0, h)[:, None, None]
    arr = top[None, None, :] * (1 - t) + bottom[None, None, :] * t
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


def _to_rgba(arr: np.ndarray, alpha: int = 255) -> Image.Image:
    arr  = np.clip(arr, 0, 255).astype("uint8")
    rgba = np.dstack([arr, np.full(arr.shape[:2], alpha, dtype="uint8")])
    return Image.fromarray(rgba, "RGBA")


def _hgrad(w: int, h: int, left, right) -> Image.Image:
    left  = np.array(left,  dtype=np.float32)
    right = np.array(right, dtype=np.float32)
    t   = np.linspace(0.0, 1.0, w)[None, :, None]
    arr = left[None, None, :] * (1 - t) + right[None, None, :] * t
    arr = np.repeat(arr, h, axis=0)
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


# --------------------------------------------------------------------------
# Premium Image2 tile painters
# --------------------------------------------------------------------------

def tile_wood_laminate(w=320, h=320) -> Image.Image:
    """Premium warm wood-grain laminate.
    Directional horizontal grain bands + fine vertical streaks (anisotropic),
    3 recessed panel insets with inner shadow lines, a top-highlight sheen,
    and subtle cross-grain micro-noise for depth.
    """
    base = _vgrad(w, h, WOOD_HI, WOOD_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Coarse horizontal grain bands
    coarse = _noise(w, h, 0.10, 10)
    arr += coarse[..., None] * np.array([18, 12, 6], dtype=np.float32)

    # Fine horizontal grain lines (dominant anisotropic direction)
    fine = _noise(w, h, 0.35, 11)
    arr += fine[..., None] * np.array([8, 5, 2], dtype=np.float32)

    # Vertical anisotropic streaks (secondary — much weaker)
    rng2 = np.random.default_rng(101)
    for _ in range(28):
        x0 = int(rng2.integers(0, w))
        ww = int(rng2.integers(1, 3))
        v  = float(rng2.uniform(-4, 6))
        arr[:, max(0, x0):min(w, x0 + ww), 0] += v * 0.7
        arr[:, max(0, x0):min(w, x0 + ww), 1] += v * 0.45
        arr[:, max(0, x0):min(w, x0 + ww), 2] += v * 0.18

    # Micro-noise for fine pore texture
    micro = _noise(w, h, 0.80, 12)
    arr += micro[..., None] * 3.0

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Three recessed panel insets with inner bevel shadow
    for i, yc in enumerate((h // 4, h // 2, 3 * h // 4)):
        ph = max(14, h // 7)
        # outer shadow edge
        d.rectangle([8, yc - ph, w - 8, yc + ph],
                    outline=(*WOOD_DARK, 200), width=2)
        # inner highlight edge (lifted top/left)
        d.rectangle([10, yc - ph + 2, w - 10, yc + ph - 2],
                    outline=(*WOOD_HI, 90), width=1)
        # inner shadow (bottom/right)
        d.rectangle([12, yc - ph + 4, w - 12, yc + ph - 4],
                    outline=(*WOOD_GRAIN, 70), width=1)

    # Panel seam lines between thirds
    for y_line in (h // 3, 2 * h // 3):
        d.line([(0, y_line), (w, y_line)],       fill=(*WOOD_DARK, 180), width=2)
        d.line([(0, y_line + 1), (w, y_line + 1)], fill=(*WOOD_HI,  60),  width=1)

    # Top specular sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sheen)
    ds.ellipse([-w // 2, -h // 3, w + w // 2, h // 3], fill=(*WOOD_HI, 35))
    img = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(20)))

    # Edge wear — scuff darkening on right edge
    edge_arr = np.asarray(img, dtype=np.float32)
    for col in range(w - 6, w):
        f = (col - (w - 6)) / 5.0
        edge_arr[:, col, :3] *= (1.0 - f * 0.18)
    img = Image.fromarray(np.clip(edge_arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_cream_laminate(w=320, h=320) -> Image.Image:
    """Premium cream/off-white laminate.
    Micro-speckle (ceramic-like), three deeply recessed inset panels
    with four-sided bevel shadow+highlight, horizontal seam lines,
    corner scuff wear.
    """
    base = _vgrad(w, h, CREAM_HI, CREAM_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Micro-speckle for ceramic paint feel
    spk = _noise(w, h, 0.90, 13)
    arr += spk[..., None] * 3.5

    # Wider noise for subtle tone variation
    blob = _noise(w, h, 0.08, 15)
    arr += blob[..., None] * 5.0

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Recessed panel insets — 3 panels, full bevel (shadow bottom+right, hi top+left)
    panel_positions = [h // 5, h // 2, 4 * h // 5]
    for yc in panel_positions:
        ph = max(16, h // 7)
        pw_inset = w - 18
        lft = (w - pw_inset) // 2
        rgt = lft + pw_inset
        # outer groove
        d.rectangle([lft, yc - ph, rgt, yc + ph], outline=(*CREAM_DARK, 210), width=2)
        # inset shadow (bottom+right inside edge)
        d.line([(lft + 2, yc + ph - 2), (rgt - 2, yc + ph - 2)], fill=(*CREAM_DARK, 140), width=1)
        d.line([(rgt - 2, yc - ph + 2), (rgt - 2, yc + ph - 2)], fill=(*CREAM_DARK, 140), width=1)
        # highlight (top+left inside edge)
        d.line([(lft + 2, yc - ph + 2), (rgt - 2, yc - ph + 2)], fill=(*CREAM_HI, 160),  width=1)
        d.line([(lft + 2, yc - ph + 2), (lft + 2, yc + ph - 2)], fill=(*CREAM_HI, 160),  width=1)
        # inner panel surface (slightly lighter)
        d.rectangle([lft + 4, yc - ph + 4, rgt - 4, yc + ph - 4],
                    outline=(*CREAM_MID, 60), width=1)

    # Horizontal seam lines (laminate sheets)
    for y_line in (h // 3, 2 * h // 3):
        d.line([(0, y_line), (w, y_line)], fill=(*CREAM_DARK, 130), width=1)
        d.line([(0, y_line + 1), (w, y_line + 1)], fill=(*CREAM_HI, 80), width=1)

    # Corner scuff — faint dark smudges
    corner_arr = np.asarray(img, dtype=np.float32)
    for r_row in range(8):
        for r_col in range(8):
            f = 1.0 - (r_row + r_col) / 12.0
            corner_arr[r_row, r_col, :3] *= max(0.84, f)
    img = Image.fromarray(np.clip(corner_arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_brushed_steel(w=320, h=80) -> Image.Image:
    """Premium brushed-steel control band.
    Dense horizontal micro-scratches + anisotropic grain highlight,
    top/bottom edge seams, subtle oval specular, faint vertical tick marks.
    """
    base = _vgrad(w, h, STEEL_HI, STEEL_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Dense horizontal scratch lines (fine frequency)
    fine = _noise(w, h, 0.85, 14)
    arr += fine[..., None] * np.array([7, 7, 9], dtype=np.float32)

    # Medium frequency brushing
    med = _noise(w, h, 0.40, 141)
    arr += med[..., None] * 5.0

    # Individual horizontal scratch passes
    rng2 = np.random.default_rng(20)
    for _ in range(120):
        y  = int(rng2.integers(0, h))
        v  = float(rng2.uniform(-5, 4))
        arr[y, :, :] += v * np.array([0.9, 0.9, 1.1])

    # Anisotropic highlight band (central bright stripe)
    center_y = h // 2
    for row in range(h):
        dist = abs(row - center_y) / max(1, h // 2)
        hi_f = max(0.0, 1.0 - dist * 2.8) * 14
        arr[row, :, :] += hi_f

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Top/bottom edge seam lines
    d.line([(0, 1), (w, 1)],       fill=(*STEEL_HI,   190), width=2)
    d.line([(0, 2), (w, 2)],       fill=(*STEEL_HI,   100), width=1)
    d.line([(0, h - 2), (w, h - 2)], fill=(*STEEL_DARK, 230), width=2)
    d.line([(0, h - 3), (w, h - 3)], fill=(*STEEL_DARK, 120), width=1)

    # Vertical tick marks (every ~40px, subtle)
    for xt in range(40, w, 40):
        d.line([(xt, 3), (xt, h - 3)], fill=(*STEEL_DARK, 70), width=1)

    # Soft oval specular
    spec = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(spec)
    ds.ellipse([w // 4, -h, 3 * w // 4, h * 2], fill=(*STEEL_HI, 30))
    img = Image.alpha_composite(img, spec.filter(ImageFilter.GaussianBlur(6)))

    return img


def tile_cyan_status_strip(w=240, h=60) -> Image.Image:
    """Premium cyan identity-scan/status strip.
    Dark recessed background, triple glowing scan lines,
    vertical tick grid, inner glow bloom, thin border.
    """
    img = Image.new("RGBA", (w, h), (4, 10, 16, 255))
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)

    # Micro noise for screen grain
    grain = _noise(w, h, 0.95, 90)
    arr += grain[..., None] * np.array([1, 3, 4], dtype=np.float32)
    img = _to_rgba(arr)

    d = ImageDraw.Draw(img)

    # Three horizontal glowing scan lines
    for i in range(3):
        y = int(h * (0.20 + i * 0.30))
        d.line([(6, y), (w - 6, y)], fill=(*CYAN, 240), width=2)
        d.line([(6, y - 1), (w - 6, y - 1)], fill=(*CYAN, 80), width=1)
        d.line([(6, y + 1), (w - 6, y + 1)], fill=(*CYAN, 60), width=1)

    # Vertical tick grid
    for x in range(14, w - 6, 20):
        d.line([(x, 6), (x, h - 6)], fill=(*CYAN_DIM, 160), width=1)

    # Small square data blocks
    for xi in range(20, w - 20, 32):
        d.rectangle([xi, h // 2 - 3, xi + 8, h // 2 + 3], fill=(*CYAN_DIM, 200))

    # Inner glow bloom
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg   = ImageDraw.Draw(glow)
    dg.rectangle([4, 4, w - 4, h - 4], fill=(*CYAN, 60))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(10)))

    # Border
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, w - 2, h - 2], outline=(*CYAN_DIM, 180), width=1)

    return img


def tile_observation_lens(w=160, h=160) -> Image.Image:
    """Premium round observation lens.
    Chrome bezel with highlight+shadow arc, dark iris recess,
    concentric cyan rings with glow, scratched chrome imperfection,
    inner pupil deep black.
    """
    img = Image.new("RGBA", (w, h), (*BLACK_RECESS, 255))
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)

    # Circular background noise for lens body
    circ = _noise(w, h, 0.30, 91)
    arr += circ[..., None] * 2.0
    img = _to_rgba(arr)

    d  = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    # Outer chrome bezel (dark ring + highlight arc)
    d.ellipse([cx - 74, cy - 74, cx + 74, cy + 74], fill=(*STEEL_MID, 255))
    d.ellipse([cx - 72, cy - 72, cx + 72, cy + 72], fill=(*STEEL_DARK, 255))
    # Bezel highlight arc (top-left)
    d.arc([cx - 70, cy - 70, cx + 70, cy + 70], start=200, end=340, fill=(*STEEL_HI, 220), width=4)
    # Bezel shadow arc (bottom-right)
    d.arc([cx - 70, cy - 70, cx + 70, cy + 70], start=20, end=160, fill=(*BLACK_RECESS, 200), width=3)

    # Inner recess
    d.ellipse([cx - 64, cy - 64, cx + 64, cy + 64], fill=(*BLACK_RECESS, 255))

    # Cyan iris rings (outermost to innermost)
    for r_px, col, wd in (
        (60, CYAN,      3),
        (50, CYAN_DIM,  2),
        (38, CYAN,      4),
        (26, CYAN_DIM,  2),
        (14, CYAN,      2),
    ):
        d.ellipse([cx - r_px, cy - r_px, cx + r_px, cy + r_px],
                  outline=(*col, 230), width=wd)

    # Pupil
    d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(*BLACK_RECESS, 255))

    # Inner glow bloom
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg   = ImageDraw.Draw(glow)
    dg.ellipse([cx - 54, cy - 54, cx + 54, cy + 54], fill=(*CYAN, 55))
    img  = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(10)))

    return img


def tile_white_ceramic(w=320, h=320) -> Image.Image:
    """Premium white/pale-blue ceramic.
    Micro-speckle paint texture, faint grout lines, subtle tile grid,
    top specular sheen, edge darkening (fired glaze edge).
    """
    base = _vgrad(w, h, WHITE_TILE, PALE_BLUE)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Micro-speckle (ceramic surface)
    spk = _noise(w, h, 0.95, 20)
    arr += spk[..., None] * 3.5

    # Subtle blob variation (glaze pooling)
    blob = _noise(w, h, 0.06, 21)
    arr += blob[..., None] * 4.0

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Horizontal grout seams
    for y_line in (h // 4, h // 2, 3 * h // 4):
        d.line([(0, y_line), (w, y_line)], fill=(*PALE_BLUE, 140), width=2)
        d.line([(0, y_line + 1), (w, y_line + 1)], fill=(*WHITE_TILE, 120), width=1)

    # Vertical grout lines
    for x_line in (w // 3, 2 * w // 3):
        d.line([(x_line, 0), (x_line, h)], fill=(*PALE_BLUE, 90), width=1)

    # Fired-glaze edge darkening
    edge_arr = np.asarray(img, dtype=np.float32)
    for col in range(6):
        f = (6 - col) / 6.0 * 0.12
        edge_arr[:, col, :3] *= (1.0 - f)
        edge_arr[:, w - 1 - col, :3] *= (1.0 - f)
    for row in range(4):
        f = (4 - row) / 4.0 * 0.08
        edge_arr[row, :, :3] *= (1.0 - f)
    img = Image.fromarray(np.clip(edge_arr, 0, 255).astype("uint8"), "RGBA")

    # Top specular sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds    = ImageDraw.Draw(sheen)
    ds.ellipse([-w // 3, -h // 4, w + w // 3, h // 4], fill=(*WHITE_TILE, 40))
    img   = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(18)))

    return img


def tile_frosted_glass(w=240, h=320) -> Image.Image:
    """Premium frosted-glass vision panel.
    Multi-layer milky diffusion noise, bevel edge frame with highlight+shadow,
    faint internal caustic blobs, inner glow.
    """
    base = _vgrad(w, h, FROST_WHITE, PALE_BLUE)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Base milky noise
    n1 = _noise(w, h, 0.05, 21)
    arr += n1[..., None] * 8.0

    # Finer frost noise
    n2 = _noise(w, h, 0.25, 211)
    arr += n2[..., None] * 4.0

    img = _to_rgba(arr, alpha=220)

    # Milky haze layers
    for blur_r, alpha in ((18, 50), (8, 30)):
        haze = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        dh   = ImageDraw.Draw(haze)
        dh.rectangle([0, 0, w, h], fill=(*FROST_WHITE, alpha))
        img  = Image.alpha_composite(img, haze.filter(ImageFilter.GaussianBlur(blur_r)))

    d = ImageDraw.Draw(img)

    # Bevelled edge frame — outer dark line + inner highlight
    d.rectangle([2, 2, w - 2, h - 2], outline=(*PALE_BLUE, 220), width=3)
    d.rectangle([5, 5, w - 5, h - 5], outline=(*FROST_WHITE, 160), width=2)
    # Shadow on bottom+right
    d.line([(2, h - 2), (w - 2, h - 2)], fill=(*PALE_BLUE, 180), width=2)
    d.line([(w - 2, 2), (w - 2, h - 2)], fill=(*PALE_BLUE, 180), width=2)
    # Highlight on top+left
    d.line([(2, 2), (w - 2, 2)],       fill=(*FROST_WHITE, 200), width=2)
    d.line([(2, 2), (2, h - 2)],       fill=(*FROST_WHITE, 200), width=2)

    # Faint internal caustic blobs
    rng2 = np.random.default_rng(212)
    caustic = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dc = ImageDraw.Draw(caustic)
    for _ in range(6):
        rx = int(rng2.integers(w // 6, 5 * w // 6))
        ry = int(rng2.integers(h // 6, 5 * h // 6))
        rr = int(rng2.integers(12, 30))
        dc.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], fill=(*FROST_WHITE, 25))
    img = Image.alpha_composite(img, caustic.filter(ImageFilter.GaussianBlur(12)))

    return img


def tile_rubber_gasket(w=80, h=320) -> Image.Image:
    """Premium rubber door-seal gasket.
    Dark matte rubber, horizontal compression ridges, slight sheen at top,
    side edge darkening (compressed/deformed look).
    """
    arr  = _noise(w, h, 0.12, 22)
    base = np.array(RUBBER_MID2, dtype=np.float32)[None, None, :]
    arr_rgb = np.clip(base + arr[..., None] * 5, 0, 255)

    # Vertical gradient (darker at centre recess)
    for col in range(w):
        dist = abs(col - w // 2) / (w // 2)
        darken = (1.0 - dist * 0.25)
        arr_rgb[:, col, :] *= darken

    img  = _to_rgba(arr_rgb)
    d    = ImageDraw.Draw(img)

    # Horizontal compression ridges
    for y_line in range(10, h, 18):
        d.line([(3, y_line), (w - 3, y_line)], fill=(*RUBBER_SEAL, 210), width=1)
        d.line([(3, y_line + 1), (w - 3, y_line + 1)], fill=(*RUBBER_MID2, 100), width=1)

    # Top sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds    = ImageDraw.Draw(sheen)
    ds.ellipse([-w, -20, w * 2, 30], fill=(*RUBBER_MID2, 60))
    img   = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(6)))

    # Side edge compression darkening
    edge_arr = np.asarray(img, dtype=np.float32)
    for col in range(4):
        f = (4 - col) / 4.0 * 0.30
        edge_arr[:, col, :3] *= (1.0 - f)
        edge_arr[:, w - 1 - col, :3] *= (1.0 - f)
    img = Image.fromarray(np.clip(edge_arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_graphite_door(w=320, h=320) -> Image.Image:
    """Premium dark graphite powdercoat.
    Lifted off pure black, subtle directional grain (vertical),
    three recessed panels with inset shadows, top specular,
    edge scuff wear. Low-light readable.
    """
    base = _vgrad(w, h, GRAPHITE_HI, GRAPHITE_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Coarse powdercoat granularity
    n1 = _noise(w, h, 0.08, 30)
    arr += n1[..., None] * 10.0

    # Fine directional (vertical) grain
    n2 = _noise(w, h, 0.30, 31)
    arr += n2[..., None] * 5.0

    # Vertical wipe marks (subtle directional burnishing)
    rng2 = np.random.default_rng(300)
    for _ in range(18):
        x0 = int(rng2.integers(0, w))
        ww = int(rng2.integers(1, 4))
        v  = float(rng2.uniform(-4, 6))
        arr[:, max(0, x0):min(w, x0 + ww), :] += v

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Vertical panel-seam lines
    for x in (w // 3, 2 * w // 3):
        d.line([(x, 0), (x, h)],         fill=(*GRAPHITE_DARK, 210), width=2)
        d.line([(x + 1, 0), (x + 1, h)], fill=(*GRAPHITE_HI,   70),  width=1)

    # Horizontal mid seam
    d.line([(0, h // 2), (w, h // 2)], fill=(*GRAPHITE_DARK, 130), width=1)

    # Recessed panel insets (2 per half)
    for yc in (h // 4, 3 * h // 4):
        d.rectangle([14, yc - 22, w - 14, yc + 22], outline=(*GRAPHITE_DARK, 200), width=2)
        d.rectangle([16, yc - 20, w - 16, yc + 20], outline=(*GRAPHITE_HI,   60),  width=1)
        # inner shadow bottom-right
        d.line([(16, yc + 20), (w - 16, yc + 20)], fill=(*GRAPHITE_DARK, 150), width=1)
        d.line([(w - 16, yc - 20), (w - 16, yc + 20)], fill=(*GRAPHITE_DARK, 150), width=1)

    # Top specular sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds    = ImageDraw.Draw(sheen)
    ds.ellipse([-w // 4, -h // 3, w + w // 4, h // 2], fill=(*GRAPHITE_HI, 30))
    img   = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(20)))

    # Edge wear scuff
    edge_arr = np.asarray(img, dtype=np.float32)
    for col in range(6):
        f = (6 - col) / 6.0 * 0.22
        edge_arr[:, col, :3] *= (1.0 - f)
    img = Image.fromarray(np.clip(edge_arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_aged_brass(w=640, h=80) -> Image.Image:
    """Premium aged brass.
    Directional horizontal brushed streaks, green-brown patina spots,
    bright highlight seam, oxidation darkening, edge wear.
    """
    base = _vgrad(w, h, BRASS_HI, BRASS_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Coarse brush noise
    n1 = _noise(w, h, 0.50, 32)
    arr += n1[..., None] * 18.0

    # Fine horizontal streaks
    rng2 = np.random.default_rng(320)
    for _ in range(90):
        y  = int(rng2.integers(0, h))
        v  = float(rng2.uniform(-8, 6))
        arr[y, :, 0] += v * 1.0
        arr[y, :, 1] += v * 0.7
        arr[y, :, 2] += v * 0.2

    # Patina spots — greenish-brown desaturation blobs
    spk = (_noise(w, h, 0.30, 33) > 0.58).astype(np.float32)
    arr[..., 0] -= spk * 20
    arr[..., 1] -= spk * 8
    arr[..., 2] += spk * 12

    # Oxidation darkening in recessed areas
    n2 = (_noise(w, h, 0.15, 331) < -0.50).astype(np.float32)
    arr[..., :] -= n2[..., None] * np.array([10, 8, 4])

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Bright highlight seam (top edge — catches key light)
    d.line([(0, 1), (w, 1)],     fill=(*BRASS_HI, 210),  width=3)
    d.line([(0, 2), (w, 2)],     fill=(*BRASS_HI, 120),  width=1)
    # Shadow seam (bottom edge)
    d.line([(0, h - 2), (w, h - 2)], fill=(22, 14, 4, 240),  width=3)
    d.line([(0, h - 3), (w, h - 3)], fill=(40, 28, 8, 140),  width=1)

    # Rivet holes suggestion — small dark dots along center
    for xi in range(40, w - 20, 80):
        d.ellipse([xi - 3, h // 2 - 3, xi + 3, h // 2 + 3],
                  fill=(22, 14, 4, 200), outline=(*BRASS_HI, 100), width=1)

    return img


def tile_amber_glass(w=320, h=320) -> Image.Image:
    """Premium warm amber archive-glass slit.
    Deep amber gradient, multi-level internal glow, subtle refractive noise,
    thin frame edge.
    """
    base = _vgrad(w, h, AMBER_HI, AMBER_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Refractive haze noise
    n1 = _noise(w, h, 0.06, 34)
    arr += n1[..., None] * np.array([10, 6, 2], dtype=np.float32)

    # Fine internal structure
    n2 = _noise(w, h, 0.35, 341)
    arr += n2[..., None] * np.array([5, 3, 1], dtype=np.float32)

    img = _to_rgba(arr, alpha=236)

    # Internal glow — layered hot core
    # scale is the margin fraction from each edge so x0 = w*margin, x1 = w*(1-margin)
    for blur_r, fill_alpha, margin in ((30, 90, 0.12), (14, 55, 0.22), (6, 30, 0.32)):
        glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        dg   = ImageDraw.Draw(glow)
        dg.ellipse([w * margin, h * 0.10, w * (1.0 - margin), h * 0.80],
                   fill=(*AMBER_HI, fill_alpha))
        img  = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(blur_r)))

    d = ImageDraw.Draw(img)
    # Thin border
    d.rectangle([1, 1, w - 2, h - 2], outline=(22, 14, 4, 180), width=2)

    return img


def tile_archive_scan_lens(w=160, h=160) -> Image.Image:
    """Premium archive identity-scan lens.
    Amber/brass outer ring + shadow arc, graphite recess, multi-ring
    amber→cyan progression, bright glow pupil centre.
    """
    img = Image.new("RGBA", (w, h), (*BLACK_RECESS, 255))
    d   = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    # Outer brass ring
    d.ellipse([cx - 74, cy - 74, cx + 74, cy + 74], fill=(*BRASS_MID, 255))
    d.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(*BLACK_RECESS, 255))

    # Brass ring highlight arc
    d.arc([cx - 72, cy - 72, cx + 72, cy + 72], start=200, end=340, fill=(*BRASS_HI, 220), width=5)
    # Brass ring shadow arc
    d.arc([cx - 72, cy - 72, cx + 72, cy + 72], start=20, end=160, fill=(22, 14, 4, 200), width=4)

    # Inner rings: brass → amber → graphite → cyan
    for r_px, col, wd in (
        (64, BRASS_MID,    4),
        (56, GRAPHITE_MID, 2),
        (48, AMBER_MID,    5),
        (38, GRAPHITE_MID, 2),
        (30, CYAN,         5),
        (22, CYAN_DIM,     2),
        (14, CYAN,         3),
    ):
        d.ellipse([cx - r_px, cy - r_px, cx + r_px, cy + r_px],
                  outline=(*col, 240), width=wd)

    # Deep black pupil
    d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(*BLACK_RECESS, 255))

    # Cyan glow bloom
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg   = ImageDraw.Draw(glow)
    dg.ellipse([cx - 56, cy - 56, cx + 56, cy + 56], fill=(*CYAN, 55))
    img  = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(12)))

    # Amber outer glow
    glow2 = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg2   = ImageDraw.Draw(glow2)
    dg2.ellipse([cx - 70, cy - 70, cx + 70, cy + 70], fill=(*AMBER_MID, 28))
    img   = Image.alpha_composite(img, glow2.filter(ImageFilter.GaussianBlur(8)))

    return img


# ===========================================================================
# INDUSTRIAL FAMILY tiles
# ===========================================================================

def tile_ind_brushed_steel_leaf(w=320, h=320) -> Image.Image:
    """Heavy brushed/riveted steel door leaf.
    Dense directional grain (vertical brushing direction),
    two large recessed panel insets with inner shadow + highlight bevel,
    3x3 hex/cross bolt heads in corners, top specular + edge wear.
    """
    base = _vgrad(w, h, IND_STEEL_HI, IND_STEEL_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Vertical directional grain (brushed direction)
    n_vert = _noise(w, h, 0.06, 50)
    arr += n_vert[..., None] * np.array([14, 14, 18], dtype=np.float32)

    # Fine vertical micro-scratches
    rng2 = np.random.default_rng(501)
    for _ in range(140):
        x0 = int(rng2.integers(0, w))
        ww = int(rng2.integers(1, 3))
        v  = float(rng2.uniform(-5, 6))
        arr[:, max(0, x0):min(w, x0 + ww), 0] += v * 0.9
        arr[:, max(0, x0):min(w, x0 + ww), 1] += v * 0.9
        arr[:, max(0, x0):min(w, x0 + ww), 2] += v * 1.1

    # Medium grain cross-noise
    n_cross = _noise(w, h, 0.40, 51)
    arr += n_cross[..., None] * 4.0

    # Anisotropic highlight (central vertical bright band)
    for col in range(w):
        dist = abs(col - w // 2) / max(1, w // 2)
        hi_f = max(0.0, 1.0 - dist * 2.2) * 12
        arr[:, col, :] += hi_f

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Two large recessed panels (upper + lower half)
    for yc in (h // 4, 3 * h // 4):
        ph = h // 5
        pw = int(w * 0.78)
        lft = (w - pw) // 2
        rgt = lft + pw
        # Outer groove
        d.rectangle([lft, yc - ph, rgt, yc + ph], outline=(*IND_STEEL_DARK, 220), width=3)
        # Inner shadow bottom+right
        d.line([(lft + 3, yc + ph - 3), (rgt - 3, yc + ph - 3)],
               fill=(*IND_STEEL_DARK, 180), width=2)
        d.line([(rgt - 3, yc - ph + 3), (rgt - 3, yc + ph - 3)],
               fill=(*IND_STEEL_DARK, 180), width=2)
        # Inner highlight top+left
        d.line([(lft + 3, yc - ph + 3), (rgt - 3, yc - ph + 3)],
               fill=(*IND_STEEL_HI, 180), width=2)
        d.line([(lft + 3, yc - ph + 3), (lft + 3, yc + ph - 3)],
               fill=(*IND_STEEL_HI, 180), width=2)
        # Inner panel surface — slightly brighter
        d.rectangle([lft + 6, yc - ph + 6, rgt - 6, yc + ph - 6],
                    outline=(*IND_STEEL_MID, 50), width=1)

    # Bolt heads — 2x2 grid in each panel corner (hex approximated as small circle)
    bolt_positions = []
    for yc in (h // 4, 3 * h // 4):
        ph = h // 5
        pw = int(w * 0.78)
        lft = (w - pw) // 2
        rgt = lft + pw
        margin = 12
        for bx in (lft + margin, rgt - margin):
            for by in (yc - ph + margin, yc + ph - margin):
                bolt_positions.append((bx, by))

    for bx, by in bolt_positions:
        r = 5
        # Hex bolt face (circle + hex lines)
        d.ellipse([bx - r, by - r, bx + r, by + r], fill=(*IND_RIVET, 255),
                  outline=(*IND_STEEL_DARK, 220), width=1)
        # Cross slot
        d.line([(bx - 3, by), (bx + 3, by)], fill=(*IND_STEEL_DARK, 220), width=1)
        d.line([(bx, by - 3), (bx, by + 3)], fill=(*IND_STEEL_DARK, 220), width=1)
        # Highlight
        d.ellipse([bx - r + 1, by - r + 1, bx - 1, by - 1], fill=(*IND_RIVET_HI, 160))

    # Vertical center seam line
    d.line([(w // 2, 0), (w // 2, h)], fill=(*IND_STEEL_DARK, 100), width=2)
    d.line([(w // 2 + 1, 0), (w // 2 + 1, h)], fill=(*IND_STEEL_HI, 50), width=1)

    # Top specular
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds    = ImageDraw.Draw(sheen)
    ds.ellipse([-w // 3, -h // 2, w + w // 3, h // 3], fill=(*IND_STEEL_HI, 32))
    img   = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(22)))

    # Edge wear (both vertical edges scuffed)
    edge_arr = np.asarray(img, dtype=np.float32)
    for col in range(8):
        f = (8 - col) / 8.0 * 0.25
        edge_arr[:, col, :3] *= (1.0 - f)
        edge_arr[:, w - 1 - col, :3] *= (1.0 - f)
    img = Image.fromarray(np.clip(edge_arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_ind_iron_frame(w=200, h=320) -> Image.Image:
    """Heavy dark iron door frame.
    Near-black iron oxide surface, subtle highlight rim,
    faint cast-iron surface noise, edge brightening.
    """
    base = _vgrad(w, h, IND_IRON_MID, IND_IRON_DARK)
    arr  = np.asarray(base.convert("RGB"), dtype=np.float32)

    # Iron surface granularity
    n1 = _noise(w, h, 0.12, 60)
    arr += n1[..., None] * 5.0

    # Fine cast-iron pores
    n2 = _noise(w, h, 0.80, 61)
    arr += n2[..., None] * 2.0

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Inner rim highlight (catches light on the door-side edge)
    d.line([(2, 0), (2, h)], fill=(*IND_IRON_HI, 160), width=2)
    d.line([(3, 0), (3, h)], fill=(*IND_IRON_MID, 80), width=1)

    # Outer edge shadow (wall side)
    d.line([(w - 2, 0), (w - 2, h)], fill=(*IND_IRON_DARK, 220), width=2)

    # Horizontal structural bolt-line suggestions
    for y_line in (h // 3, 2 * h // 3):
        d.line([(4, y_line), (w - 4, y_line)], fill=(*IND_IRON_HI, 80), width=1)
        # Small bolt on frame
        bx = w // 2
        d.ellipse([bx - 4, y_line - 4, bx + 4, y_line + 4],
                  fill=(*IND_RIVET, 220), outline=(*IND_IRON_DARK, 180), width=1)
        d.line([(bx - 2, y_line), (bx + 2, y_line)], fill=(*IND_IRON_DARK, 200), width=1)
        d.line([(bx, y_line - 2), (bx, y_line + 2)], fill=(*IND_IRON_DARK, 200), width=1)

    # Top specular
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds    = ImageDraw.Draw(sheen)
    ds.ellipse([0, -h // 2, w, h // 3], fill=(*IND_IRON_HI, 25))
    img   = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(12)))

    return img


def tile_ind_hazard_stripe(w=320, h=80) -> Image.Image:
    """Yellow-and-black diagonal hazard caution stripe band.
    Crisp diagonal stripes, slight wear at edges, subtle scuff texture.
    This is the only place yellow appears — strict hazard-only use.
    """
    img = Image.new("RGBA", (w, h), (*IND_HAZARD_BLK, 255))
    d   = ImageDraw.Draw(img)

    stripe_w = 24   # px width of each colour stripe
    # Draw alternating diagonal stripes (45 degrees, from top-left to bottom-right)
    total_range = w + h + stripe_w * 2
    for start in range(-h, total_range, stripe_w * 2):
        # Yellow stripe polygon
        pts = [
            (start, 0),
            (start + stripe_w, 0),
            (start + stripe_w + h, h),
            (start + h, h),
        ]
        d.polygon(pts, fill=(*IND_HAZARD_YEL, 255))

    # Subtle horizontal grain across stripes (wear / dirt)
    arr = np.asarray(img, dtype=np.float32)
    n   = _noise(w, h, 0.70, 70)
    arr += n[..., None] * 4.0
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), "RGBA")
    d   = ImageDraw.Draw(img)

    # Edge scuff — darken top and bottom strips
    scuff_arr = np.asarray(img, dtype=np.float32)
    for row in range(6):
        f = (6 - row) / 6.0 * 0.30
        scuff_arr[row, :, :3] *= (1.0 - f)
        scuff_arr[h - 1 - row, :, :3] *= (1.0 - f)
    img = Image.fromarray(np.clip(scuff_arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_ind_louvered_vent(w=240, h=160) -> Image.Image:
    """Industrial louvered vent panel.
    Slanted vent slats (steel-coloured), dark vent interior visible through gaps,
    outer frame edge, mild surface noise.
    """
    img = Image.new("RGBA", (w, h), (*IND_IRON_DARK, 255))
    d   = ImageDraw.Draw(img)

    slat_h    = 14   # each slat height
    slat_gap  = 4    # dark gap between slats
    slat_tilt = 8    # tilt offset px (makes them look angled)
    frame_pad = 10   # outer frame inset

    y = frame_pad
    while y + slat_h < h - frame_pad:
        # Vent slat (steel-coloured)
        pts = [
            (frame_pad,         y + slat_tilt),
            (w - frame_pad,     y),
            (w - frame_pad,     y + slat_h - slat_tilt),
            (frame_pad,         y + slat_h),
        ]
        d.polygon(pts, fill=(*IND_STEEL_MID, 255))
        # Slat highlight (top edge)
        d.line([(frame_pad, y + slat_tilt), (w - frame_pad, y)],
               fill=(*IND_STEEL_HI, 200), width=2)
        # Slat shadow (bottom edge)
        d.line([(frame_pad, y + slat_h), (w - frame_pad, y + slat_h - slat_tilt)],
               fill=(*IND_STEEL_DARK, 220), width=2)
        y += slat_h + slat_gap

    # Outer frame
    d.rectangle([frame_pad - 2, frame_pad - 2, w - frame_pad + 2, h - frame_pad + 2],
                outline=(*IND_IRON_HI, 180), width=2)
    # Inner shadow
    d.rectangle([frame_pad + 1, frame_pad + 1, w - frame_pad - 1, h - frame_pad - 1],
                outline=(*IND_IRON_DARK, 200), width=1)

    # Mild surface noise
    arr = np.asarray(img, dtype=np.float32)
    n   = _noise(w, h, 0.60, 71)
    arr += n[..., None] * 3.0
    img = Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), "RGBA")

    return img


def tile_ind_lock_bar(w=240, h=60) -> Image.Image:
    """Industrial recessed handle / lock-bar.
    Horizontal bar with recessed inset shadow, cross-bolts at ends,
    brushed steel surface.
    """
    img = Image.new("RGBA", (w, h), (*IND_STEEL_DARK, 255))
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)

    # Brushed horizontal grain
    n   = _noise(w, h, 0.65, 72)
    arr += n[..., None] * np.array([8, 8, 10], dtype=np.float32)
    rng2 = np.random.default_rng(720)
    for _ in range(60):
        y  = int(rng2.integers(0, h))
        v  = float(rng2.uniform(-4, 4))
        arr[y, :, :] += v

    img = _to_rgba(arr)
    d   = ImageDraw.Draw(img)

    # Recessed bar recess (dark inset)
    bar_y0, bar_y1 = h // 4, 3 * h // 4
    bar_x0, bar_x1 = 16, w - 16
    d.rectangle([bar_x0, bar_y0, bar_x1, bar_y1], fill=(*IND_IRON_DARK, 255))
    # Inset shadow bottom+right
    d.line([(bar_x0, bar_y1), (bar_x1, bar_y1)], fill=(*IND_IRON_DARK, 200), width=2)
    d.line([(bar_x1, bar_y0), (bar_x1, bar_y1)], fill=(*IND_IRON_DARK, 200), width=2)
    # Inset highlight top+left
    d.line([(bar_x0, bar_y0), (bar_x1, bar_y0)], fill=(*IND_STEEL_HI, 160), width=2)
    d.line([(bar_x0, bar_y0), (bar_x0, bar_y1)], fill=(*IND_STEEL_HI, 160), width=2)

    # Handle bar centre
    cy = h // 2
    d.rectangle([bar_x0 + 10, cy - 6, bar_x1 - 10, cy + 6], fill=(*IND_STEEL_MID, 255))
    d.line([(bar_x0 + 10, cy - 6), (bar_x1 - 10, cy - 6)], fill=(*IND_STEEL_HI, 180), width=2)

    # Cross bolt at each end of bar
    for bx in (bar_x0 + 6, bar_x1 - 6):
        d.ellipse([bx - 5, cy - 5, bx + 5, cy + 5], fill=(*IND_RIVET, 255),
                  outline=(*IND_IRON_DARK, 200), width=1)
        d.line([(bx - 3, cy), (bx + 3, cy)], fill=(*IND_IRON_DARK, 200), width=1)
        d.line([(bx, cy - 3), (bx, cy + 3)], fill=(*IND_IRON_DARK, 200), width=1)
        d.ellipse([bx - 4, cy - 4, bx - 1, cy - 1], fill=(*IND_RIVET_HI, 160))

    return img


def tile_ind_cyan_status_lens(w=160, h=160) -> Image.Image:
    """Industrial cyan status lens — heavier bezel, stronger glow.
    Iron hex-nut outer ring, concentric cyan rings, bright core glow.
    """
    img = Image.new("RGBA", (w, h), (*BLACK_RECESS, 255))
    d   = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    # Iron hex outer ring (approximated with octagon + circle)
    d.ellipse([cx - 74, cy - 74, cx + 74, cy + 74], fill=(*IND_IRON_MID, 255))
    d.ellipse([cx - 68, cy - 68, cx + 68, cy + 68], fill=(*BLACK_RECESS, 255))

    # Iron ring highlight arc
    d.arc([cx - 72, cy - 72, cx + 72, cy + 72], start=210, end=340, fill=(*IND_IRON_HI, 220), width=5)
    # Iron ring shadow arc
    d.arc([cx - 72, cy - 72, cx + 72, cy + 72], start=30, end=160, fill=(*IND_IRON_DARK, 220), width=4)

    # Inner recess
    d.ellipse([cx - 62, cy - 62, cx + 62, cy + 62], fill=(*BLACK_RECESS, 255))

    # Cyan rings (outermost to innermost)
    for r_px, col, wd in (
        (58, CYAN,     4),
        (48, CYAN_DIM, 2),
        (38, CYAN,     5),
        (28, CYAN_DIM, 2),
        (18, CYAN,     4),
        (10, CYAN_DIM, 2),
    ):
        d.ellipse([cx - r_px, cy - r_px, cx + r_px, cy + r_px],
                  outline=(*col, 240), width=wd)

    # Bright pupil glow
    d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(*CYAN, 255))

    # Strong cyan bloom
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg   = ImageDraw.Draw(glow)
    dg.ellipse([cx - 60, cy - 60, cx + 60, cy + 60], fill=(*CYAN, 70))
    img  = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(14)))

    return img


# --------------------------------------------------------------------------
# Atlas tile registry: id -> (painter, (x, y, w, h))
# Atlas is 2048x2048, organised in four 512-px-tall bands
# Band 0 (y=0..511):   Residential family
# Band 1 (y=512..1023): Clinic family
# Band 2 (y=1024..1535): Archive family
# Band 3 (y=1536..2047): Industrial family
# --------------------------------------------------------------------------
TILES: dict = {
    # ---- Residential family (y band: 0-511) ----
    "wood_laminate":          (tile_wood_laminate,     (  8,   8, 320, 320)),
    "cream_laminate":         (tile_cream_laminate,    (344,   8, 320, 320)),
    "brushed_steel":          (tile_brushed_steel,     (680,   8, 320,  80)),
    "observation_lens":       (tile_observation_lens,  (680,  96, 160, 160)),

    # ---- Clinic family (y band: 512-1023) ----
    "white_ceramic":          (tile_white_ceramic,     (  8, 520, 320, 320)),
    "frosted_glass":          (tile_frosted_glass,     (344, 520, 240, 320)),
    "rubber_gasket":          (tile_rubber_gasket,     (600, 520,  80, 320)),

    # ---- Archive family (y band: 1040-1535) ----
    "graphite_door":          (tile_graphite_door,     (  8,1048, 320, 320)),
    "aged_brass":             (tile_aged_brass,        (344,1048, 640,  80)),
    "amber_glass":            (tile_amber_glass,       (  8,1380, 320, 120)),
    "archive_scan_lens":      (tile_archive_scan_lens, (344,1380, 160, 160)),

    # ---- Shared (fits in Residential band unused space) ----
    "cyan_status_strip":      (tile_cyan_status_strip, (680, 272, 240,  60)),

    # ---- Industrial family (y band: 1548-2047) ----
    "ind_steel_leaf":         (tile_ind_brushed_steel_leaf, (  8,1548, 320, 320)),
    "ind_iron_frame":         (tile_ind_iron_frame,         (344,1548, 200, 320)),
    "ind_hazard_stripe":      (tile_ind_hazard_stripe,      (560,1548, 320,  80)),
    "ind_louvered_vent":      (tile_ind_louvered_vent,      (560,1640, 240, 160)),
    "ind_lock_bar":           (tile_ind_lock_bar,           (560,1812, 240,  60)),
    "ind_cyan_lens":          (tile_ind_cyan_status_lens,   (344,1880, 160, 160)),
}


def build_atlas():
    """Build the full 2048x2048 master atlas (for disk / runtime reference)."""
    atlas   = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (*GRAPHITE_DARK, 255))
    regions = {}
    for rid, (painter, (x, y, w, h)) in TILES.items():
        tile = painter(w, h)
        if tile.size != (w, h):
            tile = tile.resize((w, h), Image.BICUBIC)
        atlas.paste(tile, (x, y), tile)
        tile.save(SRC_DIR / f"{rid}.png")
        regions[rid] = [x, y, w, h]
    atlas.save(ATLAS_PNG, optimize=True)
    payload = {
        "atlas":     ATLAS_PNG.name,
        "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
        "format":    "[x, y, w, h] in pixels, top-left origin",
        "regions":   regions,
    }
    ATLAS_REGIONS.write_text(json.dumps(payload, indent=2) + "\n")
    return atlas, regions


# Per-family tile lists — only these are packed into the mini-atlas for each GLB.
FAMILY_TILES = {
    "residential": ["wood_laminate", "cream_laminate", "brushed_steel",
                    "observation_lens", "cyan_status_strip"],
    "clinic":      ["white_ceramic", "frosted_glass", "rubber_gasket",
                    "observation_lens", "cyan_status_strip"],
    "archive":     ["graphite_door", "aged_brass", "amber_glass",
                    "archive_scan_lens", "cyan_status_strip"],
    "industrial":  ["ind_steel_leaf", "ind_iron_frame", "ind_hazard_stripe",
                    "ind_louvered_vent", "ind_lock_bar", "ind_cyan_lens"],
}


def build_family_atlas(family_name: str, master_regions: dict) -> tuple[Image.Image, dict]:
    """Build a compact per-family atlas from the already-painted source tiles.

    Tiles are loaded from SRC_DIR (written by build_atlas above) and packed
    into a FAMILY_ATLAS_SIZE square.  Returns (atlas_image, family_regions)
    where regions use coordinates inside this mini-atlas.
    """
    S = FAMILY_ATLAS_SIZE
    atlas = Image.new("RGBA", (S, S), (*GRAPHITE_DARK, 255))
    tile_ids = FAMILY_TILES[family_name]

    # Compute scale factor from master 2048 → family 768 (approx)
    # We re-read the source PNGs (already saved) and pack them in a single-row
    # or two-row layout scaled to fit inside S×S.
    # Simple greedy strip-packer: sort by height desc, place left-to-right,
    # wrap to new row when row is full.
    src_tiles = []
    for rid in tile_ids:
        src = Image.open(SRC_DIR / f"{rid}.png").convert("RGBA")
        src_tiles.append((rid, src))

    # Target max tile dimension so everything fits in S×S
    # Scale each tile so max(w,h) <= target_max, preserving aspect ratio
    # Then pack greedily
    MARGIN = 4
    target_max = S // 2 - MARGIN * 2   # ~380 px max per tile side
    scaled = []
    for rid, src in src_tiles:
        ow, oh = src.size
        scale = min(1.0, target_max / max(ow, oh))
        nw, nh = max(1, int(ow * scale)), max(1, int(oh * scale))
        scaled.append((rid, src.resize((nw, nh), Image.BICUBIC), nw, nh))

    # Strip packer
    regions_fam = {}
    cx, cy, row_h = MARGIN, MARGIN, 0
    for rid, tile, tw, th in scaled:
        if cx + tw + MARGIN > S:
            cy += row_h + MARGIN
            cx, row_h = MARGIN, 0
        atlas.paste(tile, (cx, cy), tile)
        regions_fam[rid] = [cx, cy, tw, th]
        cx   += tw + MARGIN
        row_h = max(row_h, th)

    return atlas, regions_fam


# --------------------------------------------------------------------------
# UV helpers — use _ACTIVE_ATLAS_SIZE which is set per-build to the family atlas size
# --------------------------------------------------------------------------
_ACTIVE_ATLAS_SIZE = FAMILY_ATLAS_SIZE  # overridden before each builder call


def _uv_rect(region_id, regions, pad=2):
    S = _ACTIVE_ATLAS_SIZE
    x, y, w, h = regions[region_id]
    u0 = (x + pad) / S
    u1 = (x + w - pad) / S
    # trimesh flips V on GLB export (gltf_v = 1 - python_v), then Blender's
    # glTF importer treats gltf_v directly as top-origin row fraction.
    # Net result: the V we store here gets double-inverted, so we pre-invert
    # once so the round-trip lands on the correct atlas tile row.
    # v0 (top of tile in image) → larger glTF v after flip → sample higher row ✓
    v0 = 1.0 - (y + h - pad) / S
    v1 = 1.0 - (y + pad) / S
    return u0, v0, u1, v1


def _uv_center(region_id, regions):
    S = _ACTIVE_ATLAS_SIZE
    x, y, w, h = regions[region_id]
    # Same pre-inversion as _uv_rect — trimesh will flip V again on export.
    return (x + w * 0.5) / S, 1.0 - (y + h * 0.5) / S


# --------------------------------------------------------------------------
# Material factory
# --------------------------------------------------------------------------
def make_mat(name, region_id, regions, atlas, *,
             metallic=0.2, rough=0.6, alpha=255, emissive=None, double=False):
    mat = PBRMaterial(
        name=name,
        baseColorTexture=atlas,
        metallicFactor=float(metallic),
        roughnessFactor=float(rough),
        baseColorFactor=[1.0, 1.0, 1.0, float(alpha / 255.0)],
        doubleSided=bool(double),
    )
    if alpha < 255:
        mat.alphaMode = "BLEND"
    if emissive is not None:
        mat.emissiveFactor = [c / 255.0 for c in emissive]
    return mat


# --------------------------------------------------------------------------
# Geometry helpers (face_box, bevel_box, cyl, place, add)
# --------------------------------------------------------------------------
_FACE_SPECS = (
    ("px", 0,  1), ("nx", 0, -1),
    ("py", 1,  1), ("ny", 1, -1),
    ("pz", 2,  1), ("nz", 2, -1),
)


def face_box(extents, region_id, regions, atlas, mat, faces=None):
    """24-vert box with per-face UV mapped onto `region_id`."""
    hx, hy, hz = (e / 2.0 for e in extents)
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    cu, cv = _uv_center(region_id, regions)
    verts, uvs, tris = [], [], []
    only = set(faces) if faces else None
    for fname, axis, sign in _FACE_SPECS:
        a1, a2 = [i for i in range(3) if i != axis]
        h = [hx, hy, hz]
        corners = []
        for s1, s2 in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = [0.0, 0.0, 0.0]
            p[axis] = sign * h[axis]
            p[a1]   = s1 * h[a1]
            p[a2]   = s2 * h[a2]
            corners.append(p)
        if only is None or fname in only:
            quad_uv = [(u0, v1), (u1, v1), (u1, v0), (u0, v0)]
        else:
            quad_uv = [(cu, cv)] * 4
        base = len(verts)
        verts.extend(corners)
        uvs.extend(quad_uv)
        if sign > 0:
            tris.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        else:
            tris.extend([[base, base + 2, base + 1], [base, base + 3, base + 2]])
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(tris), process=False)
    mesh.visual = TextureVisuals(uv=np.array(uvs), material=mat, image=atlas)
    return mesh


def bevel_box(extents, region_id, regions, atlas, mat, bevel=0.02):
    """Chamfered convex-hull box — centre UV sample."""
    hx, hy, hz = (e / 2.0 for e in extents)
    b = min(bevel, hx * 0.49, hy * 0.49, hz * 0.49)
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((sx * (hx - b), sy * hy,       sz * hz))
                pts.append((sx * hx,       sy * (hy - b), sz * hz))
                pts.append((sx * hx,       sy * hy,       sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(pts)).convex_hull
    cu, cv = _uv_center(region_id, regions)
    mesh.visual = TextureVisuals(
        uv=np.full((len(mesh.vertices), 2), [cu, cv]),
        material=mat, image=atlas)
    return mesh


def cyl(radius, height, region_id, regions, atlas, mat, sections=36, axis="y"):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    cu, cv = _uv_center(region_id, regions)
    mesh.visual = TextureVisuals(
        uv=np.full((len(mesh.vertices), 2), [cu, cv]),
        material=mat, image=atlas)
    return mesh


def place(mesh, translate=(0, 0, 0)):
    mesh.apply_translation(translate)
    return mesh


def add(scene, mesh, name):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


# --------------------------------------------------------------------------
# Finalize — ground (min Y = 0) + centre X/Z
# --------------------------------------------------------------------------
def _bake_translate(scene, tx, ty, tz):
    t = np.array([tx, ty, tz], dtype=np.float64)
    for geom in scene.geometry.values():
        if hasattr(geom, "vertices"):
            geom.vertices += t


def finalize(scene):
    b    = scene.bounds
    cx   = (b[0][0] + b[1][0]) / 2
    cz   = (b[0][2] + b[1][2]) / 2
    miny = b[0][1]
    _bake_translate(scene, -cx, -miny, -cz)
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(v), 3) for v in size]


# ==========================================================================
# Door geometry constants
# ==========================================================================
FRAME_W   = 4.40
FRAME_H   = 3.30
FRAME_D   = 0.40

JAMB_W    = 0.18
LINTEL_H  = 0.20
THRESH_H  = 0.06
SEAM_W    = 0.06
FRAME_BEVEL = 0.022

LEAF_W    = (FRAME_W - 2 * JAMB_W - SEAM_W) / 2
LEAF_H    = FRAME_H - LINTEL_H - THRESH_H
LEAF_D    = 0.24
LEAF_X    = JAMB_W + SEAM_W / 2 + LEAF_W / 2

PANEL_W   = LEAF_W * 0.68
PANEL_H   = LEAF_H * 0.26
PANEL_Z   = LEAF_D / 2 + 0.008


# ==========================================================================
# 1. Residential Access Door
# ==========================================================================
def build_residential_access(regions, atlas):
    """Warm wood/cream laminate leaves, brushed-steel control band,
    cyan observation lens + seam. ~4.4 x 3.3 x 0.40 m
    """
    s = trimesh.Scene()

    wood   = make_mat("res_wood",   "wood_laminate",     regions, atlas, metallic=0.05, rough=0.68)
    cream  = make_mat("res_cream",  "cream_laminate",    regions, atlas, metallic=0.05, rough=0.62)
    steel  = make_mat("res_steel",  "brushed_steel",     regions, atlas, metallic=0.78, rough=0.32)
    cyan_m = make_mat("res_cyan",   "cyan_status_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    lens_m = make_mat("res_lens",   "observation_lens",  regions, atlas,
                      metallic=0.4, rough=0.18, emissive=CYAN_DIM)

    # Frame — face_box so the cream laminate reads light (same center-UV reason).
    add(s, place(face_box((JAMB_W, FRAME_H, FRAME_D), "cream_laminate", regions, atlas, cream),
                 (-FRAME_W / 2 + JAMB_W / 2, FRAME_H / 2, 0)), "frame_left_jamb")
    add(s, place(face_box((JAMB_W, FRAME_H, FRAME_D), "cream_laminate", regions, atlas, cream),
                 ( FRAME_W / 2 - JAMB_W / 2, FRAME_H / 2, 0)), "frame_right_jamb")
    add(s, place(face_box((FRAME_W, LINTEL_H, FRAME_D), "cream_laminate", regions, atlas, cream),
                 (0, FRAME_H - LINTEL_H / 2, 0)), "frame_lintel")
    add(s, place(bevel_box((FRAME_W, THRESH_H, FRAME_D), "brushed_steel", regions, atlas,
                           steel, bevel=0.012),
                 (0, THRESH_H / 2, 0)), "threshold")

    # Leaves — face_box so the full warm wood-grain tile reads (a bevel_box
    # centre-UV sample lands on a baked panel-shadow and reads dark).
    add(s, place(face_box((LEAF_W, LEAF_H, LEAF_D), "wood_laminate", regions, atlas, wood),
                 (-LEAF_X, THRESH_H + LEAF_H / 2, 0)), "leaf_left")
    add(s, place(face_box((LEAF_W, LEAF_H, LEAF_D), "wood_laminate", regions, atlas, wood),
                 ( LEAF_X, THRESH_H + LEAF_H / 2, 0)), "leaf_right")

    # Recessed cream panels on each leaf (3 per side)
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        lz = LEAF_D / 2
        y_base     = THRESH_H + 0.20
        row_stride = (LEAF_H - 0.40) / 3.0
        for ri in range(3):
            py = y_base + ri * row_stride + PANEL_H / 2 + 0.05
            add(s, place(face_box((PANEL_W, PANEL_H, 0.022), "cream_laminate",
                                  regions, atlas, cream, faces={"pz"}),
                         (lx, py, lz + 0.002)), f"panel_{side}_{ri}")

    # Brushed-steel control band
    for side, sx in (("l", -1), ("r", 1)):
        lx   = sx * LEAF_X
        lz   = LEAF_D / 2
        band_y = THRESH_H + 0.38
        add(s, place(face_box((LEAF_W - 0.04, 0.12, 0.018), "brushed_steel",
                              regions, atlas, steel, faces={"pz"}),
                     (lx, band_y, lz + 0.004)), f"steel_band_{side}")

    # Center seam — slim cyan strip
    add(s, place(face_box((SEAM_W, LEAF_H + 0.10, 0.022), "cyan_status_strip",
                          regions, atlas, cyan_m, faces={"pz"}),
                 (0, THRESH_H + LEAF_H / 2, LEAF_D / 2 + 0.002)), "center_seam")

    # Observation lens
    lens_y = THRESH_H + LEAF_H * 0.82
    add(s, place(face_box((0.12, 0.12, 0.022), "observation_lens",
                          regions, atlas, lens_m, faces={"pz"}),
                 (-LEAF_X * 0.4, lens_y, LEAF_D / 2 + 0.006)), "status_lens")

    # Status strip below lintel
    add(s, place(face_box((FRAME_W - JAMB_W * 2 - 0.04, 0.022, 0.016),
                          "cyan_status_strip", regions, atlas, cyan_m, faces={"pz"}),
                 (0, FRAME_H - LINTEL_H - 0.02, FRAME_D / 2 + 0.002)), "status_strip_top")

    return s, len(s.geometry)


# ==========================================================================
# 2. Clinic Memory Door
# ==========================================================================
def build_clinic_memory(regions, atlas):
    """Sterile frosted medical ward door. ~4.4 x 3.3 x 0.40 m"""
    s = trimesh.Scene()

    ceramic  = make_mat("cli_ceramic",  "white_ceramic",     regions, atlas,
                        metallic=0.05, rough=0.38,
                        emissive=(88, 94, 102))
    frost    = make_mat("cli_frost",    "frosted_glass",     regions, atlas,
                        metallic=0.0,  rough=0.08, alpha=218,
                        emissive=(84, 90, 100))
    gasket_m = make_mat("cli_gasket",   "rubber_gasket",     regions, atlas,
                        metallic=0.02, rough=0.95)
    cyan_m   = make_mat("cli_cyan",     "cyan_status_strip", regions, atlas,
                        metallic=0.2,  rough=0.3, emissive=CYAN)
    lens_m   = make_mat("cli_lens",     "observation_lens",  regions, atlas,
                        metallic=0.3,  rough=0.18, emissive=CYAN_DIM)

    # Frame
    add(s, place(bevel_box((JAMB_W, FRAME_H, FRAME_D), "white_ceramic", regions, atlas,
                           ceramic, bevel=FRAME_BEVEL),
                 (-FRAME_W / 2 + JAMB_W / 2, FRAME_H / 2, 0)), "frame_left_jamb")
    add(s, place(bevel_box((JAMB_W, FRAME_H, FRAME_D), "white_ceramic", regions, atlas,
                           ceramic, bevel=FRAME_BEVEL),
                 ( FRAME_W / 2 - JAMB_W / 2, FRAME_H / 2, 0)), "frame_right_jamb")
    add(s, place(bevel_box((FRAME_W, LINTEL_H, FRAME_D), "white_ceramic", regions, atlas,
                           ceramic, bevel=FRAME_BEVEL),
                 (0, FRAME_H - LINTEL_H / 2, 0)), "frame_lintel")
    add(s, place(bevel_box((FRAME_W, THRESH_H, FRAME_D), "rubber_gasket", regions, atlas,
                           gasket_m, bevel=0.010),
                 (0, THRESH_H / 2, 0)), "threshold")

    # Leaves
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        add(s, place(bevel_box((LEAF_W, LEAF_H, LEAF_D), "white_ceramic", regions, atlas,
                               ceramic, bevel=0.016),
                     (lx, THRESH_H + LEAF_H / 2, 0)), f"leaf_{side}")

    # Frosted-glass vision panel per leaf
    panel_fw = LEAF_W * 0.52
    panel_fh = LEAF_H * 0.30
    panel_fy = THRESH_H + LEAF_H * 0.72
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        lz = LEAF_D / 2
        add(s, place(face_box((panel_fw, panel_fh, 0.018), "frosted_glass",
                              regions, atlas, frost, faces={"pz"}),
                     (lx, panel_fy, lz + 0.004)), f"vision_panel_{side}")
        # Rubber bezel around vision panel
        for axis, ext, off in (
            ("h_top",   (panel_fw + 0.04, 0.04, 0.016),
             (0,  panel_fh / 2 + 0.02, 0)),
            ("h_bot",   (panel_fw + 0.04, 0.04, 0.016),
             (0, -panel_fh / 2 - 0.02, 0)),
            ("v_left",  (0.04, panel_fh, 0.016),
             (-panel_fw / 2 - 0.02, 0, 0)),
            ("v_right", (0.04, panel_fh, 0.016),
             ( panel_fw / 2 + 0.02, 0, 0)),
        ):
            nm = f"bezel_{side}_{axis}"
            dx, dy, _ = off
            add(s, place(face_box(ext, "rubber_gasket", regions, atlas, gasket_m,
                                  faces={"pz"}),
                         (lx + dx, panel_fy + dy, lz + 0.003)), nm)

    # Rubber gasket seam
    add(s, place(bevel_box((SEAM_W * 0.8, LEAF_H + 0.04, FRAME_D + 0.01),
                           "rubber_gasket", regions, atlas, gasket_m, bevel=0.010),
                 (0, THRESH_H + LEAF_H / 2, 0)), "center_seam")

    # Cyan status strip
    add(s, place(face_box((FRAME_W - JAMB_W * 2 - 0.04, 0.022, 0.016),
                          "cyan_status_strip", regions, atlas, cyan_m, faces={"pz"}),
                 (0, FRAME_H - LINTEL_H - 0.02, FRAME_D / 2 + 0.002)), "status_strip")

    # Status lens
    add(s, place(face_box((0.14, 0.14, 0.022), "observation_lens",
                          regions, atlas, lens_m, faces={"pz"}),
                 (0, FRAME_H - LINTEL_H * 0.6, FRAME_D / 2 + 0.006)), "status_lens")

    return s, len(s.geometry)


# ==========================================================================
# 3. Reclamation Archive Door
# ==========================================================================
def build_reclamation_archive(regions, atlas):
    """Heavy archive-core blast door. ~4.4 x 3.3 x 0.40 m"""
    s = trimesh.Scene()

    graph  = make_mat("arc_graphite", "graphite_door",     regions, atlas,
                      metallic=0.28, rough=0.52)
    brass  = make_mat("arc_brass",    "aged_brass",        regions, atlas,
                      metallic=0.92, rough=0.26)
    amber  = make_mat("arc_amber",    "amber_glass",       regions, atlas,
                      metallic=0.0,  rough=0.10, alpha=236,
                      emissive=AMBER_MID)
    cyan_m = make_mat("arc_cyan",     "cyan_status_strip", regions, atlas,
                      metallic=0.2,  rough=0.3,  emissive=CYAN)
    lens_m = make_mat("arc_lens",     "archive_scan_lens", regions, atlas,
                      metallic=0.38, rough=0.16, emissive=CYAN_DIM)

    # Frame — graphite
    add(s, place(face_box((JAMB_W, FRAME_H, FRAME_D), "graphite_door", regions, atlas, graph),
                 (-FRAME_W / 2 + JAMB_W / 2, FRAME_H / 2, 0)), "frame_left_jamb")
    add(s, place(face_box((JAMB_W, FRAME_H, FRAME_D), "graphite_door", regions, atlas, graph),
                 ( FRAME_W / 2 - JAMB_W / 2, FRAME_H / 2, 0)), "frame_right_jamb")
    add(s, place(face_box((FRAME_W, LINTEL_H, FRAME_D), "graphite_door", regions, atlas, graph),
                 (0, FRAME_H - LINTEL_H / 2, 0)), "frame_lintel")

    # Brass rails on frame
    for side, sx in (("l", -1), ("r", 1)):
        add(s, place(bevel_box((0.06, FRAME_H - 0.02, FRAME_D - 0.02),
                               "aged_brass", regions, atlas, brass, bevel=0.012),
                     (sx * (FRAME_W / 2 - 0.03), FRAME_H / 2, 0)), f"frame_brass_rail_{side}")

    # Brass lintel overlay
    add(s, place(bevel_box((FRAME_W - 0.04, 0.07, FRAME_D - 0.02),
                           "aged_brass", regions, atlas, brass, bevel=0.012),
                 (0, FRAME_H - 0.04, 0)), "frame_brass_lintel")

    # Threshold — brass
    add(s, place(bevel_box((FRAME_W, THRESH_H, FRAME_D), "aged_brass", regions, atlas,
                           brass, bevel=0.010),
                 (0, THRESH_H / 2, 0)), "threshold")

    # Leaves — graphite
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        add(s, place(face_box((LEAF_W, LEAF_H, LEAF_D), "graphite_door", regions, atlas, graph),
                     (lx, THRESH_H + LEAF_H / 2, 0)), f"leaf_{side}")

    # Brass edge strips on leaves
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        for ex, eside in ((-1, "in"), (1, "out")):
            bx = lx + ex * (LEAF_W / 2 - 0.025)
            add(s, place(bevel_box((0.05, LEAF_H, 0.06),
                                   "aged_brass", regions, atlas, brass, bevel=0.010),
                         (bx, THRESH_H + LEAF_H / 2, LEAF_D / 2 - 0.02)),
                f"leaf_brass_edge_{side}_{eside}")

    # Recessed graphite panels + brass borders
    arc_panel_w = LEAF_W * 0.68
    arc_panel_h = LEAF_H * 0.22
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        lz = LEAF_D / 2
        for ri, yf in enumerate((0.26, 0.55)):
            py = THRESH_H + LEAF_H * yf
            add(s, place(face_box((arc_panel_w, arc_panel_h, 0.020),
                                  "graphite_door", regions, atlas, graph, faces={"pz"}),
                         (lx, py, lz + 0.002)), f"panel_{side}_{ri}")
            add(s, place(face_box((arc_panel_w + 0.06, 0.025, 0.018),
                                  "aged_brass", regions, atlas, brass, faces={"pz"}),
                         (lx, py + arc_panel_h / 2 + 0.013, lz + 0.003)),
                f"panel_brass_top_{side}_{ri}")
            add(s, place(face_box((arc_panel_w + 0.06, 0.025, 0.018),
                                  "aged_brass", regions, atlas, brass, faces={"pz"}),
                         (lx, py - arc_panel_h / 2 - 0.013, lz + 0.003)),
                f"panel_brass_bot_{side}_{ri}")

    # Amber-glass slit
    amber_slit_w = LEAF_W * 0.70
    amber_slit_h = 0.10
    amber_y      = THRESH_H + LEAF_H * 0.82
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * LEAF_X
        lz = LEAF_D / 2
        add(s, place(face_box((amber_slit_w, amber_slit_h, 0.022),
                              "amber_glass", regions, atlas, amber, faces={"pz"}),
                     (lx, amber_y, lz + 0.006)), f"amber_slit_{side}")

    # Center seam — cyan
    add(s, place(face_box((SEAM_W * 0.6, LEAF_H + 0.08, 0.022),
                          "cyan_status_strip", regions, atlas, cyan_m, faces={"pz"}),
                 (0, THRESH_H + LEAF_H / 2, LEAF_D / 2 + 0.004)), "center_seam")

    # Cyan strip below lintel
    add(s, place(face_box((FRAME_W - JAMB_W * 2 - 0.06, 0.032, 0.018),
                          "cyan_status_strip", regions, atlas, cyan_m, faces={"pz"}),
                 (0, FRAME_H - LINTEL_H - 0.025, FRAME_D / 2 + 0.003)), "status_strip_top")

    # Archive scan lens
    add(s, place(face_box((0.16, 0.16, 0.024),
                          "archive_scan_lens", regions, atlas, lens_m, faces={"pz"}),
                 (0, FRAME_H - LINTEL_H * 0.65, FRAME_D / 2 + 0.008)), "status_lens")

    # Brass base sill
    add(s, place(face_box((FRAME_W - 0.06, 0.05, FRAME_D - 0.02),
                          "aged_brass", regions, atlas, brass),
                 (0, THRESH_H - 0.02, 0)), "brass_sill")

    return s, len(s.geometry)


# ==========================================================================
# 4. Industrial Access Door (NEW)
# ==========================================================================
def build_industrial_access(regions, atlas):
    """Heavy maintenance / power-district blast door.
    Brushed/riveted STEEL leaves, dark IRON frame, YELLOW-AND-BLACK hazard
    caution stripe band, corner BOLT heads, louvered VENT panel,
    recessed handle/lock bar, small CYAN status lens.
    Cold facility menace — cyan accent, yellow only as hazard stripe.
    ~4.4 x 3.3 x 0.40 m
    """
    s = trimesh.Scene()

    # Industrial frame is thicker (heavier look)
    IND_JAMB_W   = 0.22
    IND_LINTEL_H = 0.24
    IND_THRESH_H = 0.08
    IND_LEAF_W   = (FRAME_W - 2 * IND_JAMB_W - SEAM_W) / 2
    IND_LEAF_H   = FRAME_H - IND_LINTEL_H - IND_THRESH_H
    IND_LEAF_X   = IND_JAMB_W + SEAM_W / 2 + IND_LEAF_W / 2
    IND_LEAF_D   = 0.28   # chunkier than residential

    # Materials
    steel_m  = make_mat("ind_steel",   "ind_steel_leaf",   regions, atlas,
                        metallic=0.85, rough=0.28)
    iron_m   = make_mat("ind_iron",    "ind_iron_frame",   regions, atlas,
                        metallic=0.80, rough=0.45)
    hazard_m = make_mat("ind_hazard",  "ind_hazard_stripe", regions, atlas,
                        metallic=0.10, rough=0.60)
    vent_m   = make_mat("ind_vent",    "ind_louvered_vent", regions, atlas,
                        metallic=0.75, rough=0.35)
    lock_m   = make_mat("ind_lock",    "ind_lock_bar",      regions, atlas,
                        metallic=0.82, rough=0.30)
    cyan_m   = make_mat("ind_cyan",    "ind_cyan_lens",     regions, atlas,
                        metallic=0.3,  rough=0.2, emissive=CYAN)
    # Rivet bolt heads (steel sample)
    rivet_m  = make_mat("ind_rivet",   "ind_steel_leaf",    regions, atlas,
                        metallic=0.92, rough=0.22)

    # --- Frame (iron) ---
    add(s, place(bevel_box((IND_JAMB_W, FRAME_H, FRAME_D), "ind_iron_frame",
                           regions, atlas, iron_m, bevel=0.026),
                 (-FRAME_W / 2 + IND_JAMB_W / 2, FRAME_H / 2, 0)), "frame_left_jamb")
    add(s, place(bevel_box((IND_JAMB_W, FRAME_H, FRAME_D), "ind_iron_frame",
                           regions, atlas, iron_m, bevel=0.026),
                 ( FRAME_W / 2 - IND_JAMB_W / 2, FRAME_H / 2, 0)), "frame_right_jamb")
    add(s, place(bevel_box((FRAME_W, IND_LINTEL_H, FRAME_D), "ind_iron_frame",
                           regions, atlas, iron_m, bevel=0.026),
                 (0, FRAME_H - IND_LINTEL_H / 2, 0)), "frame_lintel")

    # Heavy corner bolt clusters on frame (4 corners)
    bolt_r = 0.06
    for cx_f, cy_f, bname in (
        (-FRAME_W / 2 + IND_JAMB_W / 2, FRAME_H - IND_LINTEL_H - 0.10, "corner_bolt_tl"),
        ( FRAME_W / 2 - IND_JAMB_W / 2, FRAME_H - IND_LINTEL_H - 0.10, "corner_bolt_tr"),
        (-FRAME_W / 2 + IND_JAMB_W / 2, IND_THRESH_H + 0.14,            "corner_bolt_bl"),
        ( FRAME_W / 2 - IND_JAMB_W / 2, IND_THRESH_H + 0.14,            "corner_bolt_br"),
    ):
        add(s, place(cyl(bolt_r, 0.05, "ind_steel_leaf", regions, atlas, rivet_m,
                         sections=6, axis="z"),
                     (cx_f, cy_f, FRAME_D / 2 + 0.025)), bname)

    # Threshold (steel, heavy)
    add(s, place(bevel_box((FRAME_W, IND_THRESH_H, FRAME_D), "ind_steel_leaf",
                           regions, atlas, steel_m, bevel=0.014),
                 (0, IND_THRESH_H / 2, 0)), "threshold")

    # --- Door leaves (steel) ---
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * IND_LEAF_X
        add(s, place(bevel_box((IND_LEAF_W, IND_LEAF_H, IND_LEAF_D), "ind_steel_leaf",
                               regions, atlas, steel_m, bevel=0.022),
                     (lx, IND_THRESH_H + IND_LEAF_H / 2, 0)), f"leaf_{side}")

    # --- Hazard stripe band — horizontal, lower third of each leaf ---
    hazard_h    = 0.22
    hazard_y    = IND_THRESH_H + IND_LEAF_H * 0.26
    hazard_w    = IND_LEAF_W - 0.04
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * IND_LEAF_X
        lz = IND_LEAF_D / 2
        add(s, place(face_box((hazard_w, hazard_h, 0.018), "ind_hazard_stripe",
                              regions, atlas, hazard_m, faces={"pz"}),
                     (lx, hazard_y, lz + 0.004)), f"hazard_stripe_{side}")
        # Iron border strips above and below hazard band
        for yoff, bsuffix in ((hazard_h / 2 + 0.018, "top"), (-hazard_h / 2 - 0.018, "bot")):
            add(s, place(face_box((hazard_w + 0.04, 0.028, 0.016), "ind_iron_frame",
                                  regions, atlas, iron_m, faces={"pz"}),
                         (lx, hazard_y + yoff, lz + 0.005)), f"hazard_border_{side}_{bsuffix}")

    # --- Louvered vent panel — upper right of each leaf ---
    vent_w  = IND_LEAF_W * 0.48
    vent_h  = IND_LEAF_H * 0.22
    vent_y  = IND_THRESH_H + IND_LEAF_H * 0.68
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * IND_LEAF_X
        lz = IND_LEAF_D / 2
        # Position vent toward outer edge of leaf
        vx = lx + sx * IND_LEAF_W * 0.18
        add(s, place(face_box((vent_w, vent_h, 0.020), "ind_louvered_vent",
                              regions, atlas, vent_m, faces={"pz"}),
                     (vx, vent_y, lz + 0.004)), f"vent_{side}")
        # Iron bezel around vent
        for ext, dx2, dy2, bsuf in (
            ((vent_w + 0.04, 0.032, 0.016), 0,                 vent_h / 2 + 0.016, "top"),
            ((vent_w + 0.04, 0.032, 0.016), 0,                -vent_h / 2 - 0.016, "bot"),
            ((0.032, vent_h, 0.016),        -vent_w / 2 - 0.016, 0,                "lft"),
            ((0.032, vent_h, 0.016),         vent_w / 2 + 0.016, 0,                "rgt"),
        ):
            add(s, place(face_box(ext, "ind_iron_frame", regions, atlas, iron_m,
                                  faces={"pz"}),
                         (vx + dx2, vent_y + dy2, lz + 0.005)), f"vent_bezel_{side}_{bsuf}")

    # --- Recessed lock/handle bar — per leaf, centre height ---
    lock_y = IND_THRESH_H + IND_LEAF_H * 0.47
    lock_w = IND_LEAF_W * 0.58
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * IND_LEAF_X
        lz = IND_LEAF_D / 2
        add(s, place(face_box((lock_w, 0.10, 0.022), "ind_lock_bar",
                              regions, atlas, lock_m, faces={"pz"}),
                     (lx, lock_y, lz + 0.004)), f"lock_bar_{side}")

    # --- Center seam — slim iron strip (not glowing — mechanical feel) ---
    add(s, place(bevel_box((SEAM_W * 0.9, IND_LEAF_H + 0.08, FRAME_D + 0.02),
                           "ind_iron_frame", regions, atlas, iron_m, bevel=0.012),
                 (0, IND_THRESH_H + IND_LEAF_H / 2, 0)), "center_seam")

    # --- Cyan status lens — upper centre of lintel ---
    add(s, place(face_box((0.18, 0.18, 0.026), "ind_cyan_lens",
                          regions, atlas, cyan_m, faces={"pz"}),
                 (0, FRAME_H - IND_LINTEL_H * 0.55, FRAME_D / 2 + 0.010)), "status_lens")

    # --- Small cyan status strip below lintel (matches other families' pattern) ---
    strip_w = FRAME_W - IND_JAMB_W * 2 - 0.08
    add(s, place(face_box((strip_w, 0.028, 0.018), "ind_cyan_lens",
                          regions, atlas, cyan_m, faces={"pz"}),
                 (0, FRAME_H - IND_LINTEL_H - 0.022, FRAME_D / 2 + 0.004)), "status_strip")

    # --- Additional corner bolt heads on leaf face (visual detail) ---
    for side, sx in (("l", -1), ("r", 1)):
        lx = sx * IND_LEAF_X
        lz = IND_LEAF_D / 2
        for byi, by_frac in enumerate((0.12, 0.88)):
            for bxi, bx_frac in enumerate((-0.38, 0.38)):
                bx = lx + bx_frac * IND_LEAF_W
                by = IND_THRESH_H + IND_LEAF_H * by_frac
                add(s, place(cyl(0.038, 0.018, "ind_steel_leaf", regions, atlas,
                                 rivet_m, sections=6, axis="z"),
                             (bx, by, lz + IND_LEAF_D * 0.1)), f"leaf_bolt_{side}_{byi}_{bxi}")

    return s, len(s.geometry)


# ==========================================================================
# Isometric close-up renderer (painter's algorithm)
# ==========================================================================
def _get_avg_color(geom):
    try:
        mat = getattr(geom.visual, "material", None)
        if mat is not None and hasattr(mat, "baseColorTexture") and mat.baseColorTexture is not None:
            img = mat.baseColorTexture
            if hasattr(img, "mode"):
                px = np.array(img.convert("RGB").resize((8, 8), Image.BICUBIC))
                return px.mean(axis=(0, 1)).astype(np.uint8)
        return np.array([46, 50, 54], dtype=np.uint8)
    except Exception:
        return np.array([46, 50, 54], dtype=np.uint8)


def closeup_render(scene, size=800, bg=(12, 13, 16)):
    """3/4-view close-up render."""
    az, el = math.radians(32), math.radians(20)
    cay, say = math.cos(az), math.sin(az)
    cel, sel = math.cos(el), math.sin(el)
    rot_y = np.array([[cay, 0, say], [0, 1, 0], [-say, 0, cay]])
    rot_x = np.array([[1, 0, 0], [0, cel, -sel], [0, sel, cel]])
    M = rot_x @ rot_y

    light1 = np.array([0.50,  0.85,  0.30]);  light1 /= np.linalg.norm(light1)
    light2 = np.array([-0.40, 0.35,  0.80]);  light2 /= np.linalg.norm(light2)
    light3 = np.array([0.0,   0.20, -0.90]);  light3 /= np.linalg.norm(light3)

    tris, depths, colors = [], [], []
    for _, geom in scene.geometry.items():
        v   = geom.vertices @ M.T
        avg = _get_avg_color(geom)
        fc  = np.tile(avg, (len(geom.faces), 1))
        for fi, face in enumerate(geom.faces):
            p  = v[face]
            n  = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            n  /= nn
            l1  = max(0.0, float(np.dot(n, light1)))
            l2  = max(0.0, float(np.dot(n, light2)))
            l3  = max(0.0, float(np.dot(n, light3)))
            shade = 0.20 + 0.58 * l1 + 0.12 * l2 + 0.10 * l3
            base  = fc[fi] if fi < len(fc) else fc[0]
            r = int(min(255, base[0] * shade + l1 * 14 + l3 * 8))
            g = int(min(255, base[1] * shade + l1 *  7))
            b = int(min(255, base[2] * shade + l2 * 12 + l3 * 5))
            colors.append((r, g, b))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())

    img = Image.new("RGB", (size, size), bg)
    d   = ImageDraw.Draw(img)
    if not tris:
        return img
    allpts = np.concatenate(tris)
    mn, mx = allpts.min(axis=0), allpts.max(axis=0)
    ext = (mx - mn).max()
    if ext < 1e-6:
        return img
    scale = (size * 0.90) / ext
    off   = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + off
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


# ==========================================================================
# Audit helper
# ==========================================================================
def audit_glb(glb_path: Path):
    data     = glb_path.read_bytes()
    reloaded = trimesh.load(trimesh.util.wrap_as_stream(data), file_type="glb")
    geoms    = reloaded.geometry if hasattr(reloaded, "geometry") else {}
    mat_names = []
    textured  = 0
    total_v   = 0
    for gname, g in geoms.items():
        m    = getattr(g.visual, "material", None)
        mname = getattr(m, "name", None)
        has_tex = getattr(m, "baseColorTexture", None) is not None
        if has_tex:
            textured += 1
        mat_names.append(mname)
        total_v += len(g.vertices)
    bounds = reloaded.bounds
    size   = (bounds[1] - bounds[0]).tolist() if bounds is not None else [0, 0, 0]
    miny   = float(bounds[0][1]) if bounds is not None else 0.0
    return {
        "path":           str(glb_path),
        "bytes":          len(data),
        "parts":          len(geoms),
        "material_count": len(mat_names),
        "textured_parts": textured,
        "total_verts":    total_v,
        "sizeMeters":     [round(v, 3) for v in size],
        "minY":           round(miny, 4),
    }


# ==========================================================================
# Main
# ==========================================================================
DOORS = [
    # (model_key, family_name, builder, bg_colour)
    ("hp_door_residential_access",  "residential", build_residential_access,  (12, 13, 16)),
    ("hp_door_clinic_memory",        "clinic",      build_clinic_memory,        (16, 17, 20)),
    ("hp_door_reclamation_archive",  "archive",     build_reclamation_archive,  (8,  9,  12)),
    ("hp_door_industrial_access",    "industrial",  build_industrial_access,    (10, 12, 14)),
]

RENDER_NAMES = {
    "hp_door_residential_access":  "residential_access",
    "hp_door_clinic_memory":        "clinic_memory",
    "hp_door_reclamation_archive":  "reclamation_archive",
    "hp_door_industrial_access":    "industrial_access",
}


def main():
    global _ACTIVE_ATLAS_SIZE
    print("== Human Protocol — Door Family GLB generator (4 families) ==")
    master_atlas, master_regions = build_atlas()
    print(f"atlas -> {ATLAS_PNG.relative_to(REPO)} "
          f"({ATLAS_PNG.stat().st_size:,} bytes), {len(master_regions)} regions, "
          f"size={ATLAS_SIZE}x{ATLAS_SIZE}")

    audits = []
    for model_key, family_name, builder, bg in DOORS:
        print(f"\nBuilding {model_key} ...")

        # Build compact per-family atlas, set active size for UV calculations
        fam_atlas, fam_regions = build_family_atlas(family_name, master_regions)
        _ACTIVE_ATLAS_SIZE = FAMILY_ATLAS_SIZE

        scene, parts = builder(fam_regions, fam_atlas)
        size = finalize(scene)

        glb_path = GLB_DIR / f"{model_key}.glb"
        data     = scene.export(file_type="glb")
        glb_path.write_bytes(data)
        print(f"  written -> {glb_path.relative_to(REPO)} ({len(data):,} B)  "
              f"parts={parts}  size={size}")

        rname    = RENDER_NAMES[model_key]
        img      = closeup_render(scene, size=800, bg=bg)
        img_path = TMP_DIR / f"{rname}-closeup.png"
        img.save(img_path)
        print(f"  render  -> {img_path.relative_to(REPO)}")

        info = audit_glb(glb_path)
        audits.append(info)

    print("\n" + "=" * 72)
    print("AUDIT")
    print("=" * 72)
    for a in audits:
        glb_name = Path(a["path"]).name
        print(
            f"  {glb_name}\n"
            f"    bytes={a['bytes']:,}  parts={a['parts']}  "
            f"materials={a['material_count']}  textured_parts={a['textured_parts']}\n"
            f"    size={a['sizeMeters']}  minY={a['minY']}  verts={a['total_verts']}"
        )

    audit_path = TMP_DIR / "door-family-audit.json"
    audit_path.write_text(json.dumps(audits, indent=2) + "\n")
    print(f"\naudit json -> {audit_path.relative_to(REPO)}")
    print(f"renders    -> {TMP_DIR.relative_to(REPO)}/")

    print("\n--- CONSTRAINT CHECK ---")
    all_pass = True
    for a in audits:
        name   = Path(a["path"]).name
        miny   = a["minY"]
        width  = a["sizeMeters"][0]
        kb     = a["bytes"] / 1024
        gnd_ok = abs(miny) < 0.02
        wid_ok = abs(width - FRAME_W) < 0.12
        kb_ok  = kb < 330
        tex_ok = a["textured_parts"] > 0
        if not all((gnd_ok, wid_ok, kb_ok, tex_ok)):
            all_pass = False
        print(f"  {name}")
        print(f"    grounded (minY~0): {'PASS' if gnd_ok else 'FAIL'}  minY={miny}")
        print(f"    width~4.4:         {'PASS' if wid_ok else 'FAIL'}  width={width}")
        print(f"    <330 KB:           {'PASS' if kb_ok  else 'FAIL'}  {kb:.1f} KB")
        print(f"    textured parts:    {'PASS' if tex_ok else 'FAIL'}  {a['textured_parts']} parts")

    if all_pass:
        print("\nAll constraints PASSED.")
    else:
        print("\nSome constraints FAILED — see above.")


if __name__ == "__main__":
    main()
