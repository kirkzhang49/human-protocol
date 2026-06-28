#!/usr/bin/env python3
"""Human Protocol — Level 02 Residential Simulation furniture Image2 pack.

Self-contained, merge-safe generator for the Level 02 "/build" furniture pack.
It does NOT touch any shared generated catalog/registry/footprint files. It only
produces the isolated Level 02 pack:

  - procedural Image2 source tiles (image2-sources/*.png) — one per material slot
  - one packed atlas + region JSON
  - 10 furniture GLBs (named parts + named materials + atlas inlays + emissives)
  - the hp.builder.assetPack.v1 manifest (sizeMeters measured from the geometry)
  - an isometric contact sheet + atlas proof sheet under .tmp/

Design language (Level 02): false comfort under surveillance, but furniture
first. Warm laminate, cream upholstery, soft yellow lamps, brass trim, thick
back panels, over-regular seams, and hidden inspection plates carry the control
theme. Cyan is limited to small recessed leaks, never a front-facing device
identity.

Image2 contract: EACH named material slot gets its own PBRMaterial with a
dedicated baseColorTexture PIL image (not a flat color). Body surfaces are
face-box mapped so the tile reads on every visible face. Small atlas-region
inlays add screw/detail/lens detail ~6mm proud on real geometry. No full
board pasted onto a prop.

Run:
    python3 scripts/asset-build/generate-level02-furniture-image2-assets.py
"""

from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
TEX_DIR = os.path.join(ROOT, "src/assets/textures/environment/level02-furniture-image2")
SRC_DIR = os.path.join(TEX_DIR, "image2-sources")
MODEL_DIR = os.path.join(ROOT, "src/assets/models-cooked/environment/level02-furniture-image2")
MANIFEST_PATH = os.path.join(ROOT, "src/assets/manifests/builder/hp_level02_furniture_image2_v1.json")
TMP_DIR = os.path.join(ROOT, ".tmp/level02-furniture-image2")
EVIDENCE_DIR = os.path.join(ROOT, ".tmp/level01-03-furniture-polish/level02")
ATLAS_PATH = os.path.join(TEX_DIR, "hp_level02_furniture_image2_atlas.png")
REGIONS_PATH = os.path.join(TEX_DIR, "hp_level02_furniture_image2_atlas.regions.json")

for d in (SRC_DIR, MODEL_DIR, os.path.dirname(MANIFEST_PATH), TMP_DIR, EVIDENCE_DIR):
    os.makedirs(d, exist_ok=True)

RNG = np.random.default_rng(20260613)  # deterministic seed

# --------------------------------------------------------------------------- #
# Palette (sampled from the Level 02 board / style plan)
# --------------------------------------------------------------------------- #
COL = {
    "laminate": (118, 84, 52),
    "laminate_dark": (78, 54, 33),
    "laminate_hi": (148, 108, 70),
    "cream": (214, 201, 174),
    "cream_dark": (181, 166, 138),
    "cream_hi": (232, 222, 200),
    "beige_plastic": (176, 162, 134),
    "beige_dark": (132, 120, 98),
    "beige_hi": (200, 188, 162),
    "brass": (176, 142, 78),
    "brass_dark": (120, 95, 50),
    "brass_hi": (210, 178, 110),
    "warm_glass": (240, 206, 132),
    "cyan": (78, 226, 236),
    "cyan_dim": (40, 120, 132),
    "lens_dark": (16, 22, 28),
    "fabric": (203, 190, 162),
    "wall_muted": (150, 138, 116),
    "wall_dark": (108, 98, 82),
    "shadow": (18, 16, 14),
}


def _c01(rgb, a=1.0):
    return [rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0, a]


# --------------------------------------------------------------------------- #
# Atlas regions for the SHARED atlas (inlays + detail panels only)
# Body materials each get their own dedicated PIL image.
# --------------------------------------------------------------------------- #
ATLAS_SIZE = 512
TILE = 128
PAD = 6


def _cell(col, row):
    x = col * TILE + PAD
    y = row * TILE + PAD
    s = TILE - 2 * PAD
    return [x, y, s, s]


REGION_LAYOUT = {
    "laminate.wood": _cell(0, 0),
    "cream.upholstery": _cell(1, 0),
    "old.beige.plastic": _cell(2, 0),
    "warm.lamp.glass": _cell(3, 0),
    "brass.edge.trim": _cell(0, 1),
    "cyan.scanner.strip": _cell(1, 1),
    "camera.lens": _cell(2, 1),
    "stitched.fabric.patch": _cell(3, 1),
    "fake.wallpaper.fragment": _cell(0, 2),
    "hidden.service.panel": _cell(1, 2),
}


# --------------------------------------------------------------------------- #
# Noise helpers
# --------------------------------------------------------------------------- #
def _noise_arr(w, h, amp, base_col, seed):
    """Return (H,W,3) uint8 with noise perturbed from base_col."""
    rng = np.random.default_rng(seed)
    arr = rng.normal(0, amp, (h, w, 3))
    out = np.clip(np.array(base_col, dtype=float) + arr, 0, 255).astype(np.uint8)
    return out


def _vgrad_arr(w, h, top, bot):
    """Vertical gradient (H,W,3)."""
    t = np.linspace(0, 1, h)[:, None, None]
    top = np.array(top, dtype=np.float32)
    bot = np.array(bot, dtype=np.float32)
    arr = (top[None, None, :] * (1 - t) + bot[None, None, :] * t)
    arr = np.repeat(arr, w, axis=1)
    return np.clip(arr, 0, 255).astype(np.uint8)


def _value_noise_2d(w, h, cells, seed):
    """Smooth value noise in [0,1]."""
    rng2 = np.random.default_rng(seed)
    gy = max(2, cells)
    gx = max(2, cells)
    grid = rng2.random((gy + 1, gx + 1))
    fy = np.linspace(0, gy, h, endpoint=False)
    fx = np.linspace(0, gx, w, endpoint=False)
    y0 = np.floor(fy).astype(int)
    x0 = np.floor(fx).astype(int)
    ty = (fy - y0)[:, None]
    tx = (fx - x0)[None, :]
    ty = ty * ty * (3 - 2 * ty)
    tx = tx * tx * (3 - 2 * tx)
    c00 = grid[np.ix_(y0, x0)]
    c10 = grid[np.ix_(y0 + 1, x0)]
    c01 = grid[np.ix_(y0, x0 + 1)]
    c11 = grid[np.ix_(y0 + 1, x0 + 1)]
    t_arr = c00 * (1 - tx) + c01 * tx
    b_arr = c10 * (1 - tx) + c11 * tx
    return t_arr * (1 - ty) + b_arr * ty


# --------------------------------------------------------------------------- #
# Per-material tile painters — each returns an RGBA Image
# (Level 02 body materials get DEDICATED images, not atlas crops)
# --------------------------------------------------------------------------- #

def paint_laminate_body(w=320, h=320):
    """Wood laminate with horizontal grain streaks and subtle panel seams."""
    arr = _vgrad_arr(w, h, COL["laminate_hi"], COL["laminate_dark"])
    # grain noise
    noise = _value_noise_2d(w, h, 12, 101)
    arr = np.clip(arr.astype(float) + noise[..., None] * 20 - 10, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    # horizontal grain lines
    rng2 = np.random.default_rng(202)
    for _ in range(38):
        y = int(rng2.integers(0, h))
        col = COL["laminate_dark"] if rng2.random() > 0.5 else COL["laminate"]
        d.line([(0, y), (w, y + int(rng2.integers(-2, 2)))], fill=col, width=1)
    # panel seam dividers (vertical, subtle)
    for x in (w // 3, 2 * w // 3):
        d.line([(x, 0), (x, h)], fill=COL["laminate_dark"], width=2)
    # top sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sheen)
    ds.ellipse([-w // 2, -h, w + w // 2, h // 3], fill=(*COL["laminate_hi"], 50))
    img = Image.alpha_composite(img.convert("RGBA"), sheen.filter(ImageFilter.GaussianBlur(14)))
    return img


def paint_cream_upholstery(w=256, h=256):
    """Cream fabric with subtle tufting dimples and stitching seam."""
    arr = _noise_arr(w, h, 5, COL["cream"], 12)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    # tufting grid dimples
    for cx in range(28, w, 52):
        for cy in range(28, h, 52):
            d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=COL["cream_dark"])
    # perimeter stitch line
    inset = 12
    for x in range(inset, w - inset, 10):
        d.line([(x, inset), (x + 5, inset)], fill=COL["cream_dark"], width=2)
        d.line([(x, h - inset), (x + 5, h - inset)], fill=COL["cream_dark"], width=2)
    for y in range(inset, h - inset, 10):
        d.line([(inset, y), (inset, y + 5)], fill=COL["cream_dark"], width=2)
        d.line([(w - inset, y), (w - inset, y + 5)], fill=COL["cream_dark"], width=2)
    return img.filter(ImageFilter.GaussianBlur(0.8)).convert("RGBA")


def paint_beige_plastic_body(w=256, h=256):
    """Beige plastic body with panel outlines, scuffs, and mold lines."""
    arr = _noise_arr(w, h, 4, COL["beige_plastic"], 13)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    # mold seam line
    d.rectangle([6, 6, w - 6, h - 6], outline=COL["beige_dark"], width=2)
    d.line([(6, h // 2), (w - 6, h // 2)], fill=COL["beige_dark"], width=2)
    # scuff marks
    rng2 = np.random.default_rng(313)
    for _ in range(32):
        x, y = int(rng2.integers(0, w)), int(rng2.integers(0, h))
        d.line([(x, y), (x + int(rng2.integers(-12, 12)), y)],
               fill=COL["beige_dark"], width=1)
    # corner screws
    for sx, sy in ((18, 18), (w - 18, 18), (18, h - 18), (w - 18, h - 18)):
        d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=COL["brass_dark"])
        d.line([(sx - 3, sy), (sx + 3, sy)], fill=(40, 32, 20), width=1)
    return img.convert("RGBA")


def paint_brass_trim(w=320, h=64):
    """Brushed brass edge trim with vertical sheen sweep."""
    arr = _vgrad_arr(w, h, COL["brass_hi"], COL["brass_dark"])
    # vertical sheen
    sheen = np.sin(np.linspace(0, math.pi, w))
    arr = np.clip(arr.astype(float) + sheen[None, :, None] * 24 - 8, 0, 255).astype(np.uint8)
    noise = _value_noise_2d(w, h, 18, 414)
    arr = np.clip(arr.astype(float) + noise[..., None] * 8 - 4, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    d.line([(0, 2), (w, 2)], fill=COL["brass_hi"], width=2)
    d.line([(0, h - 3), (w, h - 3)], fill=COL["brass_dark"], width=2)
    return img.convert("RGBA")


def paint_warm_glass_shade(w=256, h=256):
    """Warm amber lamp glass with radial glow gradient."""
    arr = _vgrad_arr(w, h, COL["warm_glass"], (180, 140, 60))
    img = Image.fromarray(arr, "RGB")
    # radial glow
    cx, cy = w / 2, h / 2
    rmax = math.hypot(cx, cy)
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = math.hypot(x - cx, y - cy) / rmax
            g = 1.0 - 0.5 * t
            r, gg, b = img.getpixel((x, y))
            px[x, y] = (int(min(255, r * g + 30 * (1 - t))),
                        int(min(255, gg * g + 20 * (1 - t))),
                        int(b * g))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse([w // 4, h // 4, 3 * w // 4, 3 * h // 4],
               fill=(*COL["warm_glass"], 80))
    result = Image.alpha_composite(img.convert("RGBA"),
                                   glow.filter(ImageFilter.GaussianBlur(18)))
    return result


def paint_cyan_scanner_body(w=256, h=64):
    """Dim hidden scanner seam, intentionally more shadow gap than light strip."""
    img = Image.new("RGBA", (w, h), (18, 20, 18, 255))
    d = ImageDraw.Draw(img)
    band = h // 2
    for k in range(-3, 4):
        a = max(0, 1.0 - abs(k) / 4.0) * 0.42
        c = tuple(int(COL["cyan_dim"][i] * a + COL["lens_dark"][i] * (1 - a)) for i in range(3))
        d.line([(0, band + k), (w, band + k)], fill=(*c, 255), width=1)
    # sparse calibration pin marks, mostly visible as seams
    for x in range(0, w, 42):
        d.line([(x, band - 5), (x, band + 5)], fill=(30, 74, 78, 255), width=1)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.rectangle([0, band - 2, w, band + 2], fill=(*COL["cyan_dim"], 20))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(2)))
    return img


def paint_camera_lens_tex(w=128, h=128):
    """Hidden surveillance camera lens."""
    img = Image.new("RGBA", (w, h), (*COL["lens_dark"], 255))
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    for r, col in ((58, (24, 28, 32)), (44, (14, 16, 18)), (28, (8, 10, 12))):
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  fill=(*col, 255), outline=(40, 44, 50, 255), width=2)
    d.ellipse([cx - 16, cy - 16, cx + 16, cy + 16], fill=(6, 9, 12, 255))
    glint = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glint)
    dg.ellipse([cx - 8, cy - 12, cx + 2, cy - 2], fill=(*COL["cyan"], 200))
    img = Image.alpha_composite(img, glint.filter(ImageFilter.GaussianBlur(3)))
    return img


def paint_wallpaper_body(w=256, h=256):
    """Domestic wallpaper fragment: muted stripe + diamond motif."""
    arr = _noise_arr(w, h, 3, COL["wall_muted"], 17)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    for x in range(0, w, 22):
        d.line([(x, 0), (x, h)], fill=COL["wall_dark"], width=1)
    for cx in range(16, w, 44):
        for cy in range(16, h, 44):
            d.polygon([(cx, cy - 8), (cx + 8, cy), (cx, cy + 8), (cx - 8, cy)],
                      outline=COL["cream_dark"])
    return img.filter(ImageFilter.GaussianBlur(0.5)).convert("RGBA")


def paint_service_panel_tex(w=128, h=128):
    """Hidden service panel: beige with seam, screws, and cyan slit."""
    arr = _noise_arr(w, h, 4, COL["beige_plastic"], 18)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, w - 6, h - 6], outline=COL["beige_dark"], width=2)
    d.line([(6, h // 2), (w - 6, h // 2)], fill=COL["beige_dark"], width=2)
    for sx, sy in ((16, 16), (w - 16, 16), (16, h - 16), (w - 16, h - 16)):
        d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=COL["brass_dark"])
        d.line([(sx - 3, sy), (sx + 3, sy)], fill=(40, 32, 20), width=1)
    d.rectangle([w // 2 - 22, h - 26, w // 2 + 22, h - 16], fill=COL["lens_dark"])
    d.line([(w // 2 - 20, h - 21), (w // 2 + 20, h - 21)], fill=COL["cyan"], width=1)
    return img.convert("RGBA")


def paint_stitched_fabric(w=116, h=116):
    """Stitched fabric patch for cushion/sofa detail."""
    arr = _noise_arr(w, h, 4, COL["fabric"], 16)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    inset = 10
    d.rectangle([inset, inset, w - inset, h - inset], outline=COL["cream_dark"], width=2)
    for x in range(inset, w - inset, 10):
        d.line([(x, inset), (x + 5, inset)], fill=COL["laminate_dark"], width=2)
        d.line([(x, h - inset), (x + 5, h - inset)], fill=COL["laminate_dark"], width=2)
    for y in range(inset, h - inset, 10):
        d.line([(inset, y), (inset, y + 5)], fill=COL["laminate_dark"], width=2)
        d.line([(w - inset, y), (w - inset, y + 5)], fill=COL["laminate_dark"], width=2)
    return img.convert("RGBA")


# These are the shared-atlas painters used for the atlas JSON (reference parity)
def paint_laminate(w, h):
    return paint_laminate_body(w, h)


def paint_cream(w, h):
    return paint_cream_upholstery(w, h)


def paint_beige(w, h):
    return paint_beige_plastic_body(w, h)


def paint_warm_glass(w, h):
    return paint_warm_glass_shade(w, h)


def paint_brass(w, h):
    return paint_brass_trim(w, h)


def paint_cyan_strip(w, h):
    return paint_cyan_scanner_body(w, h)


def paint_lens(w, h):
    return paint_camera_lens_tex(w, h)


def paint_stitched(w, h):
    return paint_stitched_fabric(w, h)


def paint_wallpaper(w, h):
    return paint_wallpaper_body(w, h)


def paint_service_panel(w, h):
    return paint_service_panel_tex(w, h)


PAINTERS = {
    "laminate.wood": paint_laminate,
    "cream.upholstery": paint_cream,
    "old.beige.plastic": paint_beige,
    "warm.lamp.glass": paint_warm_glass,
    "brass.edge.trim": paint_brass,
    "cyan.scanner.strip": paint_cyan_strip,
    "camera.lens": paint_lens,
    "stitched.fabric.patch": paint_stitched,
    "fake.wallpaper.fragment": paint_wallpaper,
    "hidden.service.panel": paint_service_panel,
}


def build_atlas():
    """Paint each source tile, save it, and pack the atlas + region JSON."""
    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (10, 9, 8, 255))
    for region_id, (x, y, w, h) in REGION_LAYOUT.items():
        tile = PAINTERS[region_id](w, h)
        if tile.size != (w, h):
            tile = tile.resize((w, h), Image.BICUBIC)
        slug = region_id.replace(".", "_")
        tile.convert("RGBA").save(os.path.join(SRC_DIR, f"{slug}.png"))
        atlas.paste(tile.convert("RGBA"), (x, y), tile.convert("RGBA"))
    atlas_rgb = atlas.convert("RGB")
    atlas_rgb.save(ATLAS_PATH)
    regions_doc = {
        "atlas": "hp_level02_furniture_image2_atlas.png",
        "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
        "origin": "top-left",
        "note": "Image2 material/part cuts for Level 02 residential simulation. [x,y,w,h] px.",
        "regions": {k: v for k, v in REGION_LAYOUT.items()},
    }
    with open(REGIONS_PATH, "w") as f:
        json.dump(regions_doc, f, indent=2)
    return atlas_rgb


# --------------------------------------------------------------------------- #
# Geometry helpers — face-box UV mapping + bevel_box + cylinder
# --------------------------------------------------------------------------- #
_FACES = (("px", 0, 1), ("nx", 0, -1), ("py", 1, 1),
          ("ny", 1, -1), ("pz", 2, 1), ("nz", 2, -1))


def face_box(extents, mat, faces=None):
    """Clean box (24 verts) with each face UV-mapped across the full material.
    `faces` limits which faces get (u0..u1, v0..v1); others get (0.5, 0.5) center.
    """
    hx, hy, hz = (e / 2.0 for e in extents)
    verts, uvs, tris = [], [], []
    for fname, axis, sign in _FACES:
        a1, a2 = [i for i in range(3) if i != axis]
        h_arr = [hx, hy, hz]
        corners = []
        for s1, s2 in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = [0.0, 0.0, 0.0]
            p[axis] = sign * h_arr[axis]
            p[a1] = s1 * h_arr[a1]
            p[a2] = s2 * h_arr[a2]
            corners.append(p)
        use_full = (faces is None) or (fname in faces)
        if use_full:
            quad_uv = [(0.02, 0.98), (0.98, 0.98), (0.98, 0.02), (0.02, 0.02)]
        else:
            quad_uv = [(0.5, 0.5)] * 4
        base = len(verts)
        verts.extend(corners)
        uvs.extend(quad_uv)
        if sign > 0:
            tris.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        else:
            tris.extend([[base, base + 2, base + 1], [base, base + 3, base + 2]])
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(tris), process=False)
    mesh.visual = TextureVisuals(uv=np.array(uvs), material=mat)
    return mesh


def bevel_box(extents, mat, bevel=0.018):
    """Chamfered box for edges with a solid-color center UV sample."""
    hx, hy, hz = (e / 2.0 for e in extents)
    b = min(bevel, hx * 0.45, hy * 0.45, hz * 0.45)
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((sx * (hx - b), sy * hy, sz * hz))
                pts.append((sx * hx, sy * (hy - b), sz * hz))
                pts.append((sx * hx, sy * hy, sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(pts)).convex_hull
    mesh.visual = TextureVisuals(
        uv=np.full((len(mesh.vertices), 2), [0.5, 0.5]),
        material=mat)
    return mesh


def cylinder_mesh(radius, height, mat, sections=32, axis="y"):
    """Cylinder with uniform UV pointing at material center."""
    m = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == "y":
        m.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    m.visual = TextureVisuals(uv=np.full((len(m.vertices), 2), [0.5, 0.5]), material=mat)
    return m


def soft_box(extents, mat, exponent=0.38, rings=18, sections=32):
    """Superellipsoid cushion/soft-box.

    This is for upholstered parts only. It avoids the "stacked cubes" look while
    keeping a compact furniture footprint. exponent < 1 gives broad faces with
    rounded edges; exponent near 1 becomes a pillow/ellipsoid.
    """
    hx, hy, hz = (e / 2.0 for e in extents)

    def signed_pow(value, power):
        return math.copysign(abs(value) ** power, value)

    verts = []
    uvs = []
    etas = np.linspace(-math.pi / 2, math.pi / 2, rings + 1)
    omegas = np.linspace(-math.pi, math.pi, sections, endpoint=False)
    for i, eta in enumerate(etas):
        ce = math.cos(eta)
        se = math.sin(eta)
        for j, omega in enumerate(omegas):
            co = math.cos(omega)
            so = math.sin(omega)
            x = hx * signed_pow(ce, exponent) * signed_pow(co, exponent)
            y = hy * signed_pow(se, exponent)
            z = hz * signed_pow(ce, exponent) * signed_pow(so, exponent)
            verts.append((x, y, z))
            uvs.append((j / sections, i / rings))

    faces = []
    for i in range(rings):
        for j in range(sections):
            a = i * sections + j
            b = i * sections + ((j + 1) % sections)
            c = (i + 1) * sections + ((j + 1) % sections)
            d = (i + 1) * sections + j
            faces.append((a, b, c))
            faces.append((a, c, d))

    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)
    mesh.visual = TextureVisuals(uv=np.array(uvs), material=mat)
    return mesh


def make_mat(name, img, *, rough=0.65, metal=0.0, emissive=None, alpha=1.0):
    """Create a PBRMaterial with a dedicated baseColorTexture PIL image."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    kw = dict(
        name=name,
        baseColorTexture=img,
        metallicFactor=float(metal),
        roughnessFactor=float(rough),
        baseColorFactor=[1.0, 1.0, 1.0, float(alpha)],
    )
    if emissive is not None:
        kw["emissiveFactor"] = [emissive[0] / 255.0, emissive[1] / 255.0, emissive[2] / 255.0]
    if alpha < 1.0:
        kw["alphaMode"] = "BLEND"
    return PBRMaterial(**kw)


def make_emissive_flat(name, rgb, emissive_rgb, rough=0.3):
    """Small emissive part (scanner seam, glow slot) — tiny solid texture."""
    img = Image.new("RGBA", (4, 4), (*rgb, 255))
    return PBRMaterial(
        name=name,
        baseColorTexture=img,
        metallicFactor=0.0,
        roughnessFactor=float(rough),
        baseColorFactor=[1.0, 1.0, 1.0, 1.0],
        emissiveFactor=[emissive_rgb[0] / 255.0, emissive_rgb[1] / 255.0, emissive_rgb[2] / 255.0],
    )


def make_hidden_control_seam(name):
    """Near-black teal seam used where control hardware should feel hidden."""
    return make_emissive_flat(name, (18, 36, 36), (10, 34, 36), rough=0.72)


def make_shadow_gap_mat(name):
    img = paint_sofa_groove(64, 64) if "sofa_groove" in globals() else Image.new("RGBA", (4, 4), (22, 18, 14, 255))
    return make_mat(name, img, rough=0.9, metal=0.0)


# --------------------------------------------------------------------------- #
# Scene assembly helpers
# --------------------------------------------------------------------------- #
def place(mesh, translate=(0, 0, 0)):
    mesh.apply_translation(translate)
    return mesh


def add(scene, mesh, name):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def finalize(scene):
    """Ground scene at y=0 and center x/z."""
    b = scene.bounds
    cx = (b[0][0] + b[1][0]) / 2
    cz = (b[0][2] + b[1][2]) / 2
    miny = b[0][1]
    scene.apply_translation((-cx, -miny, -cz))
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(size[0]), 3), round(float(size[1]), 3), round(float(size[2]), 3)]


# --------------------------------------------------------------------------- #
# The 10 Level 02 pieces — fully textured body materials
# --------------------------------------------------------------------------- #

def paint_sofa_groove(w=64, h=64):
    """Very dark shadow groove between sofa cushions — almost black with a faint fabric hint."""
    arr = _noise_arr(w, h, 3, (28, 24, 20), 99)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    # faint horizontal seam line at mid-height
    d.line([(0, h // 2), (w, h // 2)], fill=(18, 14, 10), width=2)
    return img.convert("RGBA")


def paint_sofa_frame(w=256, h=256):
    """Darker warm-laminate frame behind back cushions — distinct from cream upholstery."""
    arr = _vgrad_arr(w, h, COL["laminate_dark"], (55, 38, 24))
    noise = _value_noise_2d(w, h, 8, 555)
    arr = np.clip(arr.astype(float) + noise[..., None] * 14 - 7, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    for _ in range(18):
        rng2 = np.random.default_rng(556)
        y = int(rng2.integers(0, h))
        d.line([(0, y), (w, y)], fill=COL["laminate_dark"], width=1)
    return img.convert("RGBA")


def build_modular_sofa():
    """Modular sofa: soft domestic cushions, rounded arms, brass furniture trim,
    thick back shell, and only underside/back hidden-control hints.

    Cushion separation: each seat cushion is 0.68m wide with an 80mm groove gap.
    Back cushions are 0.26m deep and sit proud of a darker laminate back frame.
    Stitched seam strips run across all 3 seat tops.
    Material contrast: dark laminate plinth/frame vs cream upholstery vs brass rail.
    """
    s = trimesh.Scene()

    lam = make_mat("l2_laminate_body",    paint_laminate_body(256, 256),    rough=0.65, metal=0.0)
    frm = make_mat("l2_sofa_frame",       paint_sofa_frame(256, 256),       rough=0.70, metal=0.0)
    cre = make_mat("l2_cream_upholstery", paint_cream_upholstery(256, 256),  rough=0.88, metal=0.0)
    cre_d = make_mat("l2_cream_dark",     paint_cream_upholstery(128, 128),  rough=0.85, metal=0.0)
    groove_mat = make_mat("l2_sofa_groove", paint_sofa_groove(64, 64),       rough=0.95, metal=0.0)
    brs = make_mat("l2_brass_trim",       paint_brass_trim(256, 48),         rough=0.32, metal=0.88)
    cymat = make_hidden_control_seam("l2_sofa_hidden_shadow_seam")
    lens_mat = make_mat("l2_camera_lens", paint_camera_lens_tex(128, 128),   rough=0.2, metal=0.0)
    stitch_mat = make_mat("l2_stitched_fabric", paint_stitched_fabric(116, 116), rough=0.90, metal=0.0)

    # --- Grounding: Low laminate plinth with subtle feet cut-outs ---
    # Main plinth slab (laminate, beveled, 0.18m tall = ground shadow + foot clearance)
    add(s, place(bevel_box((2.30, 0.18, 0.94), lam, bevel=0.016), (0, 0.09, 0)), "sofa_plinth")
    # 4 small block feet proud under plinth corners (darker laminate for shadow contrast)
    for fx, fz in ((-0.95, 0.40), (0.95, 0.40), (-0.95, -0.40), (0.95, -0.40)):
        add(s, place(bevel_box((0.14, 0.04, 0.12), frm, bevel=0.008), (fx, 0.02, fz)),
            f"sofa_foot_{'+' if fx>0 else '-'}{'f' if fz>0 else 'b'}")

    # --- Dark laminate back frame (the structural wall behind back cushions) ---
    # This is the dominant dark tone that contrasts cream cushions
    add(s, place(bevel_box((2.20, 0.54, 0.18), frm, bevel=0.014), (0, 0.56, -0.38)), "sofa_low_back_shell")
    # Side cheeks of frame visible above arms
    for name, xpos in (("sofa_frame_cheek_l", -1.01), ("sofa_frame_cheek_r", 1.01)):
        add(s, place(bevel_box((0.10, 0.62, 0.86), frm, bevel=0.014), (xpos, 0.52, 0)), name)

    # --- Arms: cream upholstery over laminate frame, beveled for rounded volume ---
    for name, xpos in (("sofa_arm_l", -1.06), ("sofa_arm_r", 1.06)):
        add(s, place(soft_box((0.22, 0.48, 0.84), cre_d, exponent=0.42), (xpos, 0.44, 0.01)), name)

    # --- Seat base slab (cream dark, runs under 3 cushions) ---
    # Slightly narrower than cushion span so groove extends all the way to the base
    add(s, place(face_box((2.20, 0.14, 0.80), cre_d), (0, 0.27, 0.03)), "sofa_seat_base")

    # --- 3 separated seat cushions: 0.68m wide, 0.08m gap between each ---
    # Positions: left=-0.74, center=0.0, right=+0.74
    # Cushion edges: ±0.34 from center → gap between adjacent cushions = (0.74-0.34)-(0.34) = 0.06m actual
    # We keep 0.74 spacing but use 0.66m width → visible gap = 0.08m per side = reads clearly
    for i, x in enumerate((-0.74, 0.0, 0.74)):
        # Seat cushion: puffed top via large bevel, sits proud of seat_base
        add(s, place(soft_box((0.66, 0.22, 0.72), cre, exponent=0.34), (x, 0.52, 0.04)),
            f"sofa_seat_cushion_{i}")
        # Stitch seam strip across front face of each seat cushion (py face = top)
        add(s, place(face_box((0.50, 0.008, 0.28), stitch_mat, faces={"py"}),
                     (x, 0.640, 0.18)), f"sofa_stitch_top_{i}")
        # Upholstery front-face seam strip (pz face = front of cushion)
        add(s, place(face_box((0.50, 0.18, 0.010), stitch_mat, faces={"pz"}),
                     (x, 0.52, 0.40)), f"sofa_stitch_front_{i}")

        # Back cushion: taller, deeper, puffed — sits against back frame
        add(s, place(soft_box((0.66, 0.50, 0.22), cre, exponent=0.36), (x, 0.73, -0.32)),
            f"sofa_back_cushion_{i}")

    # --- Groove strips in the seat gaps (shadow/seam between cushions) ---
    # These sit in the 80mm gaps at x = ±0.37 (between cushions at -0.74/0, 0/+0.74)
    for gx in (-0.37, 0.37):
        add(s, place(face_box((0.08, 0.22, 0.72), groove_mat), (gx, 0.52, 0.04)),
            f"sofa_seat_groove_{'l' if gx<0 else 'r'}")
        # Back cushion groove
        add(s, place(face_box((0.08, 0.52, 0.26), groove_mat), (gx, 0.73, -0.34)),
            f"sofa_back_groove_{'l' if gx<0 else 'r'}")

    # --- Brass accent rail (face-boxed, horizontal strip along front of plinth) ---
    add(s, place(face_box((2.28, 0.06, 0.06), brs), (0, 0.22, 0.47)), "sofa_brass_rail")
    # Brass arm-top accent strip (small, on top of each arm)
    for name, xpos in (("sofa_brass_arm_l", -1.06), ("sofa_brass_arm_r", 1.06)):
        add(s, place(face_box((0.20, 0.030, 0.88), brs), (xpos, 0.71, 0.01)), name)

    # --- Hidden control seam: narrow dark recess tucked under the plinth lip ---
    add(s, place(face_box((1.24, 0.014, 0.012), cymat), (0, 0.030, 0.474)), "sofa_hidden_under_plinth_seam")

    # --- Hidden camera pin: rear corner inlay, not readable as a frontal device ---
    add(s, place(face_box((0.038, 0.038, 0.006), lens_mat, faces={"nz"}),
                 (0.96, 0.55, -0.474)), "sofa_rear_pin_lens")

    return s


def build_dining_table():
    """Observation dining table disguised as a plain residential dining table.
    Hidden-control hints sit under the front lip and inside tiny rear pinholes.
    """
    s = trimesh.Scene()

    lam = make_mat("l2_laminate_top",    paint_laminate_body(320, 320),  rough=0.58, metal=0.0)
    lam_d = make_mat("l2_laminate_dark", paint_sofa_frame(256, 128),     rough=0.72, metal=0.0)
    brs = make_mat("l2_brass_edge",      paint_brass_trim(256, 48),      rough=0.30, metal=0.90)
    cymat = make_hidden_control_seam("l2_table_hidden_shadow_seam")
    lens_mat = make_mat("l2_camera_lens",  paint_camera_lens_tex(128, 128), rough=0.2, metal=0.0)
    svc_mat = make_mat("l2_service_panel", paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)
    lam_inl = make_mat("l2_laminate_inlay", paint_laminate_body(128, 128), rough=0.55, metal=0.0)

    # Table top (laminate, all faces)
    add(s, place(face_box((1.78, 0.06, 0.92), lam), (0, 0.74, 0)), "table_top")
    # Underframe (dark laminate — now clearly darker tone than top surface)
    add(s, place(bevel_box((1.66, 0.12, 0.80), lam_d, bevel=0.012), (0, 0.65, 0)), "table_top_underframe")
    # Legs (4x laminate cylinder, beveled post)
    leg_mat = make_mat("l2_laminate_leg", paint_laminate_body(64, 64), rough=0.72, metal=0.0)
    for sx in (-0.78, 0.78):
        for sz in (-0.38, 0.38):
            leg = cylinder_mesh(0.045, 0.58, leg_mat, sections=16)
            add(s, place(leg, (sx, 0.29, sz)),
                f"table_leg_{'+' if sx>0 else '-'}{'front' if sz>0 else 'back'}")
    # Brass edge (thin band, all faces)
    add(s, place(face_box((1.80, 0.034, 0.94), brs), (0, 0.709, 0)), "table_brass_edge")
    # Three underside gaps: readable as joinery shadows, not top-facing scanner slots.
    for i, x in enumerate((-0.45, 0.0, 0.45)):
        add(s, place(face_box((0.22, 0.012, 0.018), cymat), (x, 0.665, 0.405)),
            f"table_under_lip_shadow_gap_{i}")
    # Laminate inlay on top surface (proud 6mm)
    add(s, place(face_box((0.9, 0.008, 0.5), lam_inl, faces={"py"}),
                 (0, 0.776, -0.10)), "table_laminate_inlay")
    # Rear inspection plate and pinhole: control trace is hidden from the main viewing face.
    add(s, place(face_box((0.26, 0.08, 0.008), svc_mat, faces={"nz"}),
                 (0.60, 0.65, -0.407)), "table_rear_inspection_plate")
    add(s, place(face_box((0.034, 0.034, 0.008), lens_mat, faces={"nz"}),
                 (-0.60, 0.65, -0.407)), "table_rear_pin_lens")
    return s


def paint_clinical_rail(w=192, h=32):
    """White clinical rail — sterile white plastic with mold seam, distinct from beige frame."""
    arr = _noise_arr(w, h, 3, (228, 224, 216), 441)
    img = Image.fromarray(arr, "RGB")
    d = ImageDraw.Draw(img)
    # mold parting seam line along center
    d.line([(0, h // 2), (w, h // 2)], fill=(180, 178, 170), width=1)
    # end caps
    for x in (6, w - 6):
        d.rectangle([x - 4, 4, x + 4, h - 4], outline=(160, 158, 152), width=1)
    return img.convert("RGBA")


def build_nursery_bed():
    """Nursery / care bed: soft mattress, fine domestic guard rails, wood base,
    and hidden underside maintenance hints.

    Fix: rails are now WHITE not beige so they contrast sharply against the dark laminate frame.
    Mattress sits visibly proud above the frame. Pillow has stitched cover detail.
    """
    s = trimesh.Scene()

    lam = make_mat("l2_bed_frame",     paint_laminate_body(256, 128),      rough=0.68, metal=0.0)
    lam_d = make_mat("l2_bed_plinth",  paint_sofa_frame(192, 64),          rough=0.72, metal=0.0)
    cre = make_mat("l2_mattress",      paint_cream_upholstery(256, 256),    rough=0.92, metal=0.0)
    rail_mat = make_mat("l2_rail_white", paint_clinical_rail(192, 32),      rough=0.40, metal=0.15)
    bei_d = make_mat("l2_beige_post",  paint_beige_plastic_body(64, 64),    rough=0.55, metal=0.1)
    stitch_mat = make_mat("l2_pillow_stitch", paint_stitched_fabric(96, 96), rough=0.90, metal=0.0)
    cymat = make_hidden_control_seam("l2_bed_hidden_shadow_seam")
    lens_mat = make_mat("l2_camera_lens", paint_camera_lens_tex(128, 128),  rough=0.2, metal=0.0)
    svc_mat = make_mat("l2_service_panel", paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)

    # Grounding plinth (very dark laminate, visible as base shadow)
    add(s, place(bevel_box((1.54, 0.10, 0.88), lam_d, bevel=0.012), (0, 0.05, 0)), "bed_plinth")
    # Base frame (laminate, beveled — sits on plinth)
    add(s, place(bevel_box((1.48, 0.36, 0.82), lam, bevel=0.016), (0, 0.28, 0)), "bed_base_frame")
    # Mattress (cream, puffed bevel — clearly proud above frame, high contrast)
    add(s, place(soft_box((1.40, 0.16, 0.74), cre, exponent=0.32), (0, 0.54, 0)), "bed_mattress")
    # Pillow (cream, bevel + stitched seam on top)
    add(s, place(soft_box((0.46, 0.10, 0.32), cre, exponent=0.42), (-0.42, 0.65, 0)), "bed_pillow")
    add(s, place(face_box((0.34, 0.008, 0.20), stitch_mat, faces={"py"}),
                 (-0.42, 0.710, 0.0)), "bed_pillow_stitch")

    # Fine guard rails: thin enough to read as furniture, not a sci-fi cage.
    for side, z in (("front", 0.40), ("back", -0.40)):
        add(s, place(face_box((1.46, 0.038, 0.038), rail_mat), (0, 0.92, z)),
            f"bed_rail_top_{side}")
        add(s, place(face_box((1.46, 0.030, 0.030), rail_mat), (0, 0.70, z)),
            f"bed_rail_mid_{side}")
        for i in range(6):
            x = -0.55 + i * 0.22
            bar = cylinder_mesh(0.011, 0.43, rail_mat, sections=10)
            add(s, place(bar, (x, 0.72, z)), f"bed_bar_{side}_{i}")

    # Posts (beige, cylinder — anchors the rails)
    for pname, xp in (("bed_post_l", -0.72), ("bed_post_r", 0.72)):
        p = cylinder_mesh(0.040, 1.00, bei_d, sections=14)
        add(s, place(p, (xp, 0.50, 0)), pname)

    # Hidden seam and inspection plate live under/behind the frame instead of on the front face.
    add(s, place(face_box((0.86, 0.014, 0.012), cymat), (0, 0.024, 0.414)), "bed_under_frame_shadow_seam")
    add(s, place(face_box((0.034, 0.034, 0.006), lens_mat, faces={"nz"}),
                 (0.66, 0.78, -0.414)), "bed_rear_pin_lens")
    add(s, place(face_box((0.30, 0.11, 0.006), svc_mat, faces={"nz"}),
                 (0.14, 0.28, -0.415)), "bed_rear_inspection_plate")
    return s


def build_portrait_console():
    """Family portrait console: ordinary framed wall picture with a small shelf.
    The unsettling part is the over-thick back and hidden underside seam.
    """
    s = trimesh.Scene()

    wall_mat = make_mat("l2_wallpaper_back",   paint_wallpaper_body(256, 256),   rough=0.82, metal=0.0)
    brs_mat = make_mat("l2_brass_frame",       paint_brass_trim(256, 48),        rough=0.36, metal=0.75)
    lam_mat = make_mat("l2_laminate_shelf",    paint_laminate_body(256, 64),     rough=0.62, metal=0.0)
    brs_trim = make_mat("l2_brass_trim_small", paint_brass_trim(128, 32),        rough=0.32, metal=0.85)
    wp_mat = make_mat("l2_wallpaper_portrait", paint_wallpaper_body(256, 256),   rough=0.80, metal=0.0)
    brs_col = make_mat("l2_brass_column",      paint_brass_trim(48, 256),        rough=0.40, metal=0.72)
    cymat = make_hidden_control_seam("l2_console_hidden_shadow_seam")
    lens_mat = make_mat("l2_camera_lens",   paint_camera_lens_tex(128, 128), rough=0.2, metal=0.0)
    svc_mat = make_mat("l2_service_panel",  paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)

    # Backplate (wallpaper texture, thick — gives depth to the console)
    add(s, place(bevel_box((1.32, 0.96, 0.08), wall_mat, bevel=0.012),
                 (0, 0.48, -0.04)), "console_backplate")
    # Brass picture frame (thicker for volume, bevel)
    add(s, place(bevel_box((1.12, 0.76, 0.09), brs_mat, bevel=0.016),
                 (0, 0.52, 0.025)), "console_frame")
    # Wallpaper portrait inlay inside frame (slightly proud)
    add(s, place(face_box((0.90, 0.58, 0.008), wp_mat, faces={"pz"}),
                 (0, 0.56, 0.074)), "console_portrait")
    # Brass side columns — give clear side silhouette (the main fix for "flat slab")
    for name, xpos in (("console_column_l", -0.60), ("console_column_r", 0.60)):
        add(s, place(bevel_box((0.08, 0.94, 0.12), brs_col, bevel=0.012),
                     (xpos, 0.48, 0.00)), name)
    # Brass cornice top (horizontal bar across top — caps the frame)
    add(s, place(bevel_box((1.34, 0.08, 0.12), brs_trim, bevel=0.010),
                 (0, 0.94, 0.00)), "console_cornice")
    # Shelf (laminate — clearly different wood tone from brass)
    add(s, place(face_box((1.30, 0.08, 0.18), lam_mat), (0, 0.04, 0.06)), "console_shelf")
    # Brass trim on shelf front edge
    add(s, place(face_box((1.14, 0.040, 0.080), brs_trim), (0, 0.085, 0.075)), "console_brass_trim")
    # Hidden underside shadow seam and rear access plate.
    add(s, place(face_box((0.62, 0.010, 0.014), cymat), (0, 0.165, 0.075)), "console_under_shelf_shadow_seam")
    add(s, place(face_box((0.032, 0.032, 0.008), lens_mat, faces={"nz"}),
                 (0.48, 0.78, -0.084)), "console_rear_pin_lens")
    add(s, place(face_box((0.18, 0.14, 0.008), svc_mat, faces={"nz"}),
                 (-0.44, 0.20, -0.084)), "console_rear_access_plate")
    return s


def build_kitchen_counter():
    """Residential kitchen counter: cabinet doors, drawers, handles, sink and faucet.
    Control traces are tucked under the counter lip and rear access panel.
    """
    s = trimesh.Scene()

    bei_mat = make_mat("l2_counter_body",   paint_beige_plastic_body(256, 256), rough=0.72, metal=0.0)
    lam_mat = make_mat("l2_counter_top",    paint_laminate_body(320, 128),      rough=0.58, metal=0.0)
    brs_mat = make_mat("l2_counter_brass",  paint_brass_trim(320, 48),          rough=0.30, metal=0.88)
    bei_d_mat = make_mat("l2_counter_dark", paint_beige_plastic_body(128, 128), rough=0.70, metal=0.0)
    door_mat = make_mat("l2_counter_door",  paint_beige_plastic_body(128, 256), rough=0.72, metal=0.0)
    hdl_mat = make_mat("l2_door_handle",    paint_brass_trim(64, 16),           rough=0.30, metal=0.88)
    cymat = make_hidden_control_seam("l2_counter_hidden_shadow_seam")
    lam_inl = make_mat("l2_lam_inlay_top",  paint_laminate_body(128, 128), rough=0.55, metal=0.0)
    svc_mat = make_mat("l2_service_panel",  paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)
    bei_inl = make_mat("l2_bei_inlay",      paint_beige_plastic_body(128, 128), rough=0.70, metal=0.0)

    # Counter body (beige, beveled for plinth feel)
    add(s, place(bevel_box((1.86, 0.78, 0.64), bei_mat, bevel=0.016), (0, 0.39, 0)), "counter_body")
    # Counter top (laminate, all faces)
    add(s, place(face_box((1.92, 0.06, 0.70), lam_mat), (0, 0.81, 0)), "counter_top")
    # Brass edge trim
    add(s, place(face_box((1.94, 0.032, 0.72), brs_mat), (0, 0.78, 0)), "counter_brass_edge")
    # Sink basin (beige dark, recessed) plus small faucet so it reads as kitchen first.
    add(s, place(bevel_box((0.42, 0.10, 0.36), bei_d_mat, bevel=0.012), (0.5, 0.80, 0)), "counter_sink_basin")
    add(s, place(cylinder_mesh(0.018, 0.22, hdl_mat, sections=12), (0.50, 0.94, -0.10)), "counter_faucet_stem")
    add(s, place(cylinder_mesh(0.014, 0.24, hdl_mat, sections=12, axis="z"), (0.50, 1.05, 0.00)), "counter_faucet_spout")
    # Doors and handles
    for i, x in enumerate((-0.62, 0.0, 0.62)):
        add(s, place(face_box((0.56, 0.58, 0.03), door_mat), (x, 0.40, 0.33)), f"counter_door_{i}")
        h = cylinder_mesh(0.012, 0.20, hdl_mat, sections=10, axis="y")
        add(s, place(h, (x + 0.22, 0.40, 0.36)), f"counter_handle_{i}")
        add(s, place(face_box((0.48, 0.08, 0.018), door_mat, faces={"pz"}),
                     (x, 0.70, 0.352)), f"counter_drawer_face_{i}")
        add(s, place(cylinder_mesh(0.010, 0.18, hdl_mat, sections=10, axis="y"),
                     (x + 0.16, 0.70, 0.368)), f"counter_drawer_pull_{i}")
    # Laminate inlay on top surface
    add(s, place(face_box((0.7, 0.006, 0.5), lam_inl, faces={"py"}),
                 (-0.45, 0.812, 0)), "counter_laminate_inlay")
    # Inspection plate moved low and small; reads as cabinetry hardware, not a console.
    add(s, place(face_box((0.24, 0.16, 0.006), svc_mat, faces={"nz"}),
                 (-0.62, 0.28, -0.345)), "counter_rear_inspection_plate")
    # Beige inlay (right door center)
    add(s, place(face_box((0.30, 0.30, 0.006), bei_inl, faces={"pz"}),
                 (0.62, 0.40, 0.345)), "counter_beige_inlay")
    # Hidden shadow seam under the front overhang.
    add(s, place(face_box((0.92, 0.010, 0.012), cymat), (0, 0.765, 0.354)), "counter_under_lip_shadow_seam")
    return s


def build_scanner_wardrobe():
    """Plain wardrobe: thick carcass, framed doors, ordinary handles, hidden door-gap scan."""
    s = trimesh.Scene()

    lam_d = make_mat("l2_wardrobe_body",   paint_laminate_body(256, 320),    rough=0.68, metal=0.0)
    bei_d = make_mat("l2_wardrobe_plinth", paint_beige_plastic_body(256, 64), rough=0.70, metal=0.0)
    brs_d = make_mat("l2_wardrobe_brass",  paint_brass_trim(256, 48),         rough=0.38, metal=0.72)
    lam_door = make_mat("l2_wardrobe_door", paint_laminate_body(256, 512),   rough=0.62, metal=0.0)
    hdl_mat = make_mat("l2_wardrobe_handle", paint_brass_trim(64, 16),        rough=0.28, metal=0.88)
    cymat = make_hidden_control_seam("l2_wardrobe_hidden_shadow_seam")
    lens_mat = make_mat("l2_camera_lens",  paint_camera_lens_tex(128, 128), rough=0.2, metal=0.0)
    svc_mat = make_mat("l2_service_panel", paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)
    lam_inl = make_mat("l2_lam_inlay_door", paint_laminate_body(128, 256),   rough=0.60, metal=0.0)

    # Carcass (laminate dark, beveled)
    add(s, place(bevel_box((1.16, 1.96, 0.60), lam_d, bevel=0.014), (0, 0.98, 0)), "wardrobe_carcass")
    # Plinth (beige dark, grounding base)
    add(s, place(bevel_box((1.18, 0.10, 0.62), bei_d, bevel=0.010), (0, 0.05, 0)), "wardrobe_plinth")
    # Cornice (brass dark, beveled)
    add(s, place(bevel_box((1.20, 0.08, 0.64), brs_d, bevel=0.012), (0, 1.98, 0)), "wardrobe_cornice")
    # Doors (2x laminate, face-box so wood grain reads on front face)
    for i, x in enumerate((-0.29, 0.29)):
        add(s, place(face_box((0.54, 1.78, 0.04), lam_door), (x, 0.99, 0.30)), f"wardrobe_door_{i}")
        h = cylinder_mesh(0.014, 0.34, hdl_mat, sections=12, axis="y")
        add(s, place(h, (x + (0.20 if i else -0.20), 0.99, 0.33)), f"wardrobe_handle_{i}")
    # Door gap: very thin dark control seam, not a glowing scanner line.
    add(s, place(face_box((0.010, 1.20, 0.006), cymat, faces={"nz"}), (0, 0.98, -0.305)), "wardrobe_rear_center_shadow_gap")
    # Laminate door inlay (left door center zone)
    add(s, place(face_box((0.40, 0.7, 0.006), lam_inl, faces={"pz"}),
                 (-0.29, 1.30, 0.325)), "wardrobe_laminate_inlay")
    # Rear/inner hints only.
    add(s, place(face_box((0.030, 0.030, 0.006), lens_mat, faces={"nz"}),
                 (0.46, 1.78, -0.305)), "wardrobe_rear_pin_lens")
    add(s, place(face_box((0.24, 0.24, 0.006), svc_mat, faces={"nz"}),
                 (0.29, 0.40, -0.305)), "wardrobe_rear_access_plate")
    return s


def build_camera_lamp():
    """Residential floor lamp: warm shade and brass base, with control hardware hidden in collar."""
    s = trimesh.Scene()

    brs_b = make_mat("l2_lamp_base",     paint_brass_trim(128, 32),        rough=0.42, metal=0.72)
    brs_t = make_mat("l2_lamp_base_tri", paint_brass_trim(64, 16),         rough=0.32, metal=0.88)
    bei_p = make_mat("l2_lamp_pole",     paint_beige_plastic_body(64, 256), rough=0.52, metal=0.20)
    wg_mat = make_mat("l2_lamp_shade",   paint_warm_glass_shade(256, 256),  rough=0.38, metal=0.0,
                      emissive=COL["warm_glass"])
    wg_core = make_emissive_flat("l2_lamp_warm_core", COL["warm_glass"], COL["warm_glass"], rough=0.4)
    cy_ring = make_hidden_control_seam("l2_lamp_hidden_collar_seam")
    lens_mat = make_mat("l2_camera_lens", paint_camera_lens_tex(128, 128), rough=0.2, metal=0.0)
    wg_inl = make_mat("l2_warm_glass_inlay", paint_warm_glass_shade(128, 128), rough=0.38, metal=0.0,
                      emissive=COL["warm_glass"])

    # Brass base (flat disk, bevel)
    add(s, place(bevel_box((0.40, 0.06, 0.40), brs_b, bevel=0.012), (0, 0.03, 0)), "lamp_base")
    add(s, place(bevel_box((0.32, 0.03, 0.32), brs_t, bevel=0.010), (0, 0.075, 0)), "lamp_base_trim")
    # Pole (beige, cylinder)
    pole = cylinder_mesh(0.028, 1.30, bei_p, sections=20)
    add(s, place(pole, (0, 0.72, 0)), "lamp_pole")
    # Shade (warm glass cylinder, emissive)
    shade = cylinder_mesh(0.22, 0.34, wg_mat, sections=32)
    add(s, place(shade, (0, 1.46, 0)), "lamp_shade")
    # Warm core glow
    add(s, place(bevel_box((0.18, 0.20, 0.18), wg_core, bevel=0.020), (0, 1.46, 0)), "lamp_warm_core")
    # Hidden collar seam and rear pinhole.
    add(s, place(face_box((0.14, 0.010, 0.006), cy_ring, faces={"nz"}), (0, 1.30, -0.205)), "lamp_rear_collar_shadow_seam")
    add(s, place(face_box((0.026, 0.026, 0.006), lens_mat, faces={"nz"}),
                 (0, 1.34, -0.205)), "lamp_rear_pin_lens")
    # Warm glass inlay (glow inset on shade front)
    add(s, place(face_box((0.18, 0.22, 0.006), wg_inl, faces={"pz"}),
                 (0, 1.46, 0.225)), "lamp_warm_glass_inlay")
    return s


def build_elevator_fixture():
    """Residential elevator end fixture disguised as a tall built-in cabinet."""
    s = trimesh.Scene()

    lam_d = make_mat("l2_elev_surround",  paint_laminate_body(256, 512),    rough=0.68, metal=0.0)
    brs_d = make_mat("l2_elev_jamb",      paint_brass_trim(64, 320),         rough=0.38, metal=0.72)
    brs_h = make_mat("l2_elev_lintel",    paint_brass_trim(256, 48),         rough=0.32, metal=0.88)
    bei_d = make_mat("l2_elev_door",      paint_beige_plastic_body(128, 512), rough=0.68, metal=0.0)
    bei_k = make_mat("l2_elev_kick",      paint_beige_plastic_body(256, 64),  rough=0.72, metal=0.0)
    cymat = make_hidden_control_seam("l2_elev_hidden_shadow_seam")
    wp_mat = make_mat("l2_elev_wallpaper", paint_wallpaper_body(128, 256),   rough=0.82, metal=0.0)
    lens_mat = make_mat("l2_camera_lens",  paint_camera_lens_tex(128, 128),  rough=0.2, metal=0.0)
    svc_mat = make_mat("l2_service_panel", paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)
    brs_inl = make_mat("l2_brass_inlay",   paint_brass_trim(256, 32),         rough=0.32, metal=0.88)

    # Surround (laminate dark, beveled)
    add(s, place(bevel_box((1.36, 2.14, 0.18), lam_d, bevel=0.014), (0, 1.07, -0.18)), "elevator_surround")
    # Jambs (brass, left + right, beveled for thickness)
    add(s, place(bevel_box((0.16, 2.10, 0.22), brs_d, bevel=0.012), (-0.58, 1.05, -0.06)), "elevator_jamb_l")
    add(s, place(bevel_box((0.16, 2.10, 0.22), brs_d, bevel=0.012), (0.58, 1.05, -0.06)), "elevator_jamb_r")
    # Lintel (brass, face box)
    add(s, place(face_box((1.36, 0.16, 0.22), brs_h), (0, 2.06, -0.06)), "elevator_lintel")
    # Doors (beige, face-box so plastic texture reads on front)
    add(s, place(face_box((0.49, 1.86, 0.06), bei_d), (-0.25, 0.98, 0.02)), "elevator_door_l")
    add(s, place(face_box((0.49, 1.86, 0.06), bei_d), (0.25, 0.98, 0.02)), "elevator_door_r")
    # Kick plate (beige dark)
    add(s, place(bevel_box((1.10, 0.10, 0.10), bei_k, bevel=0.010), (0, 0.05, 0.02)), "elevator_kick")
    # Door split shadow, deliberately too regular but not visibly sci-fi.
    add(s, place(face_box((0.010, 1.58, 0.012), cymat), (0, 0.98, 0.06)), "elevator_center_shadow_split")
    # Wallpaper inlays (left and right jamb sides — disguise surveillance as domestic decor)
    add(s, place(face_box((0.12, 0.9, 0.006), wp_mat, faces={"pz"}),
                 (-0.58, 1.40, 0.055)), "elevator_wallpaper_l")
    # Rear/side maintenance hints.
    add(s, place(face_box((0.030, 0.030, 0.006), lens_mat, faces={"nz"}),
                 (0.50, 1.86, -0.175)), "elevator_rear_pin_lens")
    add(s, place(face_box((0.18, 0.26, 0.006), svc_mat, faces={"nx"}),
                 (-0.685, 0.45, -0.06)), "elevator_side_access_plate")
    # Brass trim inlay (horizontal, at top of doors)
    add(s, place(face_box((1.0, 0.06, 0.006), brs_inl, faces={"pz"}),
                 (0, 1.96, 0.055)), "elevator_brass_trim")
    return s


def build_observation_bookshelf():
    """Observation bookshelf: domestic silhouette, but the back panel hides a cyan service seam,
    camera lens, brass keyed shelf rails, and staggered empty slots.
    """
    s = trimesh.Scene()

    lam = make_mat("l2_bookshelf_laminate", paint_laminate_body(256, 512), rough=0.68, metal=0.0)
    lam_d = make_mat("l2_bookshelf_dark_back", paint_sofa_frame(256, 512), rough=0.74, metal=0.0)
    brs = make_mat("l2_bookshelf_brass_rail", paint_brass_trim(256, 48), rough=0.32, metal=0.88)
    cream = make_mat("l2_book_cream", paint_cream_upholstery(96, 192), rough=0.78, metal=0.0)
    beige = make_mat("l2_book_beige", paint_beige_plastic_body(96, 192), rough=0.72, metal=0.0)
    wall = make_mat("l2_back_wallpaper_insert", paint_wallpaper_body(128, 256), rough=0.84, metal=0.0)
    svc = make_mat("l2_bookshelf_service_panel", paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)
    lens = make_mat("l2_bookshelf_camera_lens", paint_camera_lens_tex(128, 128), rough=0.2, metal=0.0)
    cyan = make_hidden_control_seam("l2_bookshelf_hidden_shadow_seam")

    add(s, place(bevel_box((1.20, 0.12, 0.46), lam_d, bevel=0.012), (0, 0.06, 0)), "bookshelf_shadow_plinth")
    add(s, place(bevel_box((1.18, 1.74, 0.16), lam_d, bevel=0.016), (0, 0.92, -0.20)), "bookshelf_dark_back_panel")
    add(s, place(bevel_box((0.12, 1.72, 0.48), lam, bevel=0.014), (-0.56, 0.92, 0)), "bookshelf_left_side")
    add(s, place(bevel_box((0.12, 1.72, 0.48), lam, bevel=0.014), (0.56, 0.92, 0)), "bookshelf_right_side")
    add(s, place(face_box((1.18, 0.08, 0.50), brs), (0, 1.75, 0)), "bookshelf_top_brass_cap")
    for i, y in enumerate((0.34, 0.70, 1.06, 1.42)):
        add(s, place(face_box((1.08, 0.045, 0.46), brs), (0, y, 0.02)), f"bookshelf_shelf_rail_{i}")
        add(s, place(face_box((0.84, 0.006, 0.32), wall, faces={"pz"}), (0, y + 0.10, 0.235)), f"bookshelf_wallpaper_patch_{i}")
    # Staggered archive/books, deliberately irregular so it reads less like a raw grid.
    book_rows = [
        (-0.37, 0.45, 0.03, 0.10, 0.24, cream),
        (-0.22, 0.45, 0.03, 0.08, 0.30, beige),
        (-0.05, 0.45, 0.03, 0.11, 0.22, cream),
        (0.18, 0.45, 0.03, 0.16, 0.26, beige),
        (0.38, 0.45, 0.03, 0.10, 0.20, cream),
        (-0.42, 0.82, 0.03, 0.14, 0.20, beige),
        (-0.18, 0.82, 0.03, 0.08, 0.28, cream),
        (0.07, 0.82, 0.03, 0.11, 0.25, beige),
        (0.32, 0.82, 0.03, 0.13, 0.30, cream),
        (-0.32, 1.18, 0.03, 0.12, 0.25, cream),
        (-0.08, 1.18, 0.03, 0.09, 0.21, beige),
        (0.18, 1.18, 0.03, 0.16, 0.28, cream),
        (0.42, 1.18, 0.03, 0.10, 0.23, beige),
    ]
    for i, (x, y, z, bw, bh, mat) in enumerate(book_rows):
        add(s, place(bevel_box((bw, bh, 0.075), mat, bevel=0.004), (x, y + bh / 2, z + 0.10)), f"bookshelf_archive_spine_{i}")
    add(s, place(face_box((0.30, 0.12, 0.008), svc, faces={"nz"}), (-0.24, 1.48, -0.285)), "bookshelf_rear_access_plate")
    add(s, place(face_box((0.030, 0.030, 0.008), lens, faces={"nz"}), (0.40, 1.52, -0.285)), "bookshelf_rear_pin_lens")
    add(s, place(face_box((0.30, 0.010, 0.006), cyan, faces={"nz"}), (0.0, 0.205, -0.285)), "bookshelf_rear_shadow_gap")
    return s


def build_carekeeper_armchair():
    """Carekeeper armchair: readable domestic chair, but with monitor seams in the arms and a
    hidden camera in the back cushion. More silhouette-rich than the default sofa.
    """
    s = trimesh.Scene()

    lam = make_mat("l2_armchair_laminate", paint_laminate_body(256, 256), rough=0.68, metal=0.0)
    lam_d = make_mat("l2_armchair_dark_frame", paint_sofa_frame(192, 192), rough=0.74, metal=0.0)
    cream = make_mat("l2_armchair_cream_cushion", paint_cream_upholstery(256, 256), rough=0.9, metal=0.0)
    stitch = make_mat("l2_armchair_stitch_patch", paint_stitched_fabric(116, 116), rough=0.92, metal=0.0)
    brs = make_mat("l2_armchair_brass_trim", paint_brass_trim(192, 40), rough=0.34, metal=0.86)
    lens = make_mat("l2_armchair_camera_lens", paint_camera_lens_tex(128, 128), rough=0.2, metal=0.0)
    cyan = make_hidden_control_seam("l2_armchair_hidden_shadow_seam")
    svc = make_mat("l2_armchair_service_panel", paint_service_panel_tex(128, 128), rough=0.72, metal=0.0)

    add(s, place(bevel_box((0.92, 0.12, 0.88), lam_d, bevel=0.012), (0, 0.06, 0)), "armchair_shadow_plinth")
    add(s, place(soft_box((0.74, 0.22, 0.66), cream, exponent=0.34), (0, 0.42, 0.07)), "armchair_seat_cushion")
    add(s, place(soft_box((0.78, 0.74, 0.18), cream, exponent=0.40), (0, 0.83, -0.31)), "armchair_back_cushion")
    add(s, place(bevel_box((0.84, 0.70, 0.12), lam_d, bevel=0.014), (0, 0.76, -0.42)), "armchair_rear_wood_shell")
    for name, x in (("armchair_left_arm", -0.46), ("armchair_right_arm", 0.46)):
        add(s, place(soft_box((0.18, 0.54, 0.78), lam, exponent=0.46), (x, 0.50, 0.02)), name)
        add(s, place(face_box((0.14, 0.026, 0.70), brs), (x, 0.79, 0.02)), f"{name}_brass_cap")
        add(s, place(face_box((0.026, 0.010, 0.12), cyan, faces={"nz"}), (x, 0.63, -0.405)), f"{name}_rear_under_arm_shadow_gap")
    add(s, place(face_box((0.46, 0.008, 0.32), stitch, faces={"py"}), (0, 0.535, 0.14)), "armchair_seat_stitch_panel")
    add(s, place(face_box((0.034, 0.034, 0.008), lens, faces={"nz"}), (0.0, 0.92, -0.516)), "armchair_rear_pin_lens")
    add(s, place(face_box((0.20, 0.16, 0.008), svc, faces={"nz"}), (-0.20, 0.37, -0.445)), "armchair_rear_access_plate")
    for i, x in enumerate((-0.31, 0.31)):
        for z in (-0.28, 0.34):
            add(s, place(cylinder_mesh(0.035, 0.26, lam_d, sections=14), (x, 0.18, z)), f"armchair_tapered_foot_{i}_{z:+.2f}")
    return s


# --------------------------------------------------------------------------- #
# Clean residential color pass (v2)
# --------------------------------------------------------------------------- #
# These late definitions intentionally override the older painter functions.
# Pipeline:
#   1. Clear: remove noisy procedural panels, visible cyan strips, big lenses.
#   2. Base: assign five quiet residential materials by role.
#   3. Accent: add brass/stitched/wallpaper only as small trim.
#   4. Control: express surveillance through dark gaps and rear plates.
#   5. Prove: regenerate GLB, manifest, contact sheet, thumbnails, Raw WGPU.

L2_COLOR_PIPELINE = {
    "pass": "level02_showroom_clean_color_v3",
    "materialSlots": {
        "wood": "light warm oak, low contrast, subtle horizontal grain",
        "upholstery": "clean warm ivory fabric, almost no speckle",
        "cabinet": "showroom matte warm-white painted laminate",
        "brass": "soft champagne brass, trim only",
        "hiddenControl": "warm gray joinery shadow seams under/behind furniture",
    },
    "emissiveRule": "visible cyan removed; hidden control reads as shadow, not light",
    "clutterRule": "no large front service panels, no obvious camera disks, no busy random noise, no dirty black cracks",
}

L2_ASSET_BLUEPRINTS = {
    "room_l2_img2_modular_sofa": {
        "role": "living anchor",
        "scaleMeters": "2.3w x 1.0h x 1.0d",
        "silhouette": "three soft cushions, thick arms, low wooden plinth",
        "materials": ["upholstery", "wood", "brass", "hiddenControl"],
        "collisionProxy": "solid sofa box, keep depth under 1.0m",
        "hiddenControlHint": "rear pinhole and under-plinth shadow seam",
        "expectedPlacement": "living lane wall or room center edge",
    },
    "room_l2_img2_observation_dining_table": {
        "role": "plain dining/work table",
        "scaleMeters": "1.8w x 0.8h x 0.95d",
        "silhouette": "rectangular top, four legs, thin brass edge",
        "materials": ["wood", "brass", "hiddenControl"],
        "collisionProxy": "solid table top footprint, legs decorative",
        "hiddenControlHint": "under-lip dark gaps and rear pinhole",
        "expectedPlacement": "living room center, readable at 3-5m",
    },
    "room_l2_img2_nursery_bed": {
        "role": "child/care bed",
        "scaleMeters": "1.55w x 1.0h x 0.9d",
        "silhouette": "soft mattress, pillow, thin guard rails",
        "materials": ["upholstery", "wood", "cabinet", "hiddenControl"],
        "collisionProxy": "solid bed box, no path blocking beyond 0.9m depth",
        "hiddenControlHint": "rear access plate and underside seam",
        "expectedPlacement": "care nook wall",
    },
    "room_l2_img2_family_portrait_console": {
        "role": "framed family picture and shelf",
        "scaleMeters": "1.35w x 1.0h x 0.25d",
        "silhouette": "picture frame, shelf, thick concealed back",
        "materials": ["wallpaper", "wood", "brass", "hiddenControl"],
        "collisionProxy": "thin wall-mounted prop",
        "hiddenControlHint": "underside shelf seam and rear plate",
        "expectedPlacement": "back wall clue",
    },
    "room_l2_img2_service_kitchen_counter": {
        "role": "kitchen counter",
        "scaleMeters": "1.95w x 0.85h x 0.75d",
        "silhouette": "cabinet doors, drawers, sink, faucet, counter slab",
        "materials": ["cabinet", "wood", "brass", "hiddenControl"],
        "collisionProxy": "solid counter box",
        "hiddenControlHint": "rear access plate and under-lip seam",
        "expectedPlacement": "service/kitchen wall",
    },
    "room_l2_img2_scanner_wardrobe": {
        "role": "ordinary wardrobe",
        "scaleMeters": "1.2w x 2.0h x 0.65d",
        "silhouette": "two framed doors, handles, plinth, cornice",
        "materials": ["wood", "brass", "hiddenControl"],
        "collisionProxy": "solid cabinet footprint",
        "hiddenControlHint": "over-regular center door gap and rear plate",
        "expectedPlacement": "wall-backed storage",
    },
    "room_l2_img2_camera_lamp": {
        "role": "floor lamp",
        "scaleMeters": "0.45w x 1.65h x 0.45d",
        "silhouette": "warm shade, slender pole, small base",
        "materials": ["brass", "cabinet", "warmGlass", "hiddenControl"],
        "collisionProxy": "non-solid filler; avoid lane blocking",
        "hiddenControlHint": "shade collar shadow seam",
        "expectedPlacement": "corner filler",
    },
    "room_l2_img2_living_end_elevator_fixture": {
        "role": "built-in end cabinet/elevator disguise",
        "scaleMeters": "1.35w x 2.15h x 0.35d",
        "silhouette": "tall cabinet doors, jambs, lintel, kick plate",
        "materials": ["wood", "cabinet", "brass", "hiddenControl"],
        "collisionProxy": "wall-backed cabinet slab",
        "hiddenControlHint": "too-regular center split and side access plate",
        "expectedPlacement": "level end wall",
    },
    "room_l2_img2_observation_bookshelf": {
        "role": "bookshelf",
        "scaleMeters": "1.25w x 1.8h x 0.7d",
        "silhouette": "side boards, shelf rails, irregular books",
        "materials": ["wood", "wallpaper", "book cloth", "hiddenControl"],
        "collisionProxy": "solid bookshelf box",
        "hiddenControlHint": "rear plate and under-shelf shadow gap",
        "expectedPlacement": "wall-backed clue furniture",
    },
    "room_l2_img2_carekeeper_armchair": {
        "role": "soft armchair",
        "scaleMeters": "1.1w x 1.2h x 1.1d",
        "silhouette": "thick cushion, broad arms, rear shell, feet",
        "materials": ["upholstery", "wood", "brass", "hiddenControl"],
        "collisionProxy": "solid chair box",
        "hiddenControlHint": "under-arm seams and rear access plate",
        "expectedPlacement": "living lane filler/anchor",
    },
}


def _clean_tile(w, h, base, seed, noise=1.8, vertical=False):
    rng2 = np.random.default_rng(seed)
    arr = np.zeros((h, w, 3), dtype=np.float32)
    arr[:, :] = np.array(base, dtype=np.float32)
    if vertical:
        grad = np.linspace(-5, 5, h)[:, None, None]
    else:
        grad = np.linspace(4, -4, h)[:, None, None]
    arr += grad
    arr += rng2.normal(0, noise, (h, w, 1))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def paint_laminate_body(w=320, h=320):
    img = _clean_tile(w, h, (204, 183, 150), 7201, noise=0.5)
    d = ImageDraw.Draw(img)
    for y in range(18, h, 34):
        d.line([(0, y), (w, y + 1)], fill=(176, 150, 116, 42), width=1)
    for y in range(8, h, 21):
        d.line([(0, y), (w, y)], fill=(222, 202, 168, 28), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.35))


def paint_sofa_frame(w=256, h=256):
    img = _clean_tile(w, h, (172, 148, 116), 7202, noise=0.45)
    d = ImageDraw.Draw(img)
    for y in range(14, h, 38):
        d.line([(0, y), (w, y)], fill=(146, 122, 94, 34), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.35))


def paint_cream_upholstery(w=256, h=256):
    img = _clean_tile(w, h, (244, 240, 230), 7203, noise=0.25)
    d = ImageDraw.Draw(img)
    for x in range(0, w, 12):
        d.line([(x, 0), (x, h)], fill=(218, 210, 194, 25), width=1)
    for y in range(0, h, 14):
        d.line([(0, y), (w, y)], fill=(246, 241, 229, 24), width=1)
    inset = 12
    d.rounded_rectangle([inset, inset, w - inset, h - inset], radius=10, outline=(206, 196, 176, 58), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.35))


def paint_beige_plastic_body(w=256, h=256):
    img = _clean_tile(w, h, (238, 235, 224), 7204, noise=0.25)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([7, 7, w - 7, h - 7], radius=8, outline=(188, 181, 164, 55), width=1)
    d.line([(10, h // 2), (w - 10, h // 2)], fill=(198, 190, 174, 38), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.25))


def paint_brass_trim(w=320, h=64):
    img = _clean_tile(w, h, (202, 180, 126), 7205, noise=0.3)
    d = ImageDraw.Draw(img)
    for x in range(0, w, 18):
        d.line([(x, 0), (x + 4, h)], fill=(218, 194, 140, 34), width=1)
    d.line([(0, 2), (w, 2)], fill=(226, 202, 148, 70), width=1)
    d.line([(0, h - 3), (w, h - 3)], fill=(152, 124, 78, 60), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.25))


def paint_warm_glass_shade(w=256, h=256):
    img = _clean_tile(w, h, (232, 206, 150), 7206, noise=0.4, vertical=True)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse([w * 0.22, h * 0.18, w * 0.78, h * 0.82], fill=(252, 226, 166, 42))
    return Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(22)))


def paint_cyan_scanner_body(w=256, h=64):
    img = Image.new("RGBA", (w, h), (156, 150, 136, 255))
    d = ImageDraw.Draw(img)
    band = h // 2
    d.line([(0, band), (w, band)], fill=(118, 112, 100, 255), width=1)
    for x in range(0, w, 64):
        d.point((x, band), fill=(126, 118, 104, 255))
    return img.filter(ImageFilter.GaussianBlur(0.3))


def paint_camera_lens_tex(w=128, h=128):
    img = Image.new("RGBA", (w, h), (142, 146, 138, 255))
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=(120, 124, 118, 255), outline=(168, 166, 154, 255), width=1)
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=(78, 82, 78, 255))
    d.ellipse([cx - 4, cy - 5, cx - 1, cy - 2], fill=(190, 176, 132, 120))
    return img.filter(ImageFilter.GaussianBlur(0.2))


def paint_wallpaper_body(w=256, h=256):
    img = _clean_tile(w, h, (214, 208, 194), 7207, noise=0.4)
    d = ImageDraw.Draw(img)
    for x in range(0, w, 34):
        d.line([(x, 0), (x, h)], fill=(184, 178, 164, 32), width=1)
    for x in range(17, w, 34):
        d.line([(x, 0), (x, h)], fill=(232, 226, 212, 24), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.3))


def paint_service_panel_tex(w=128, h=128):
    img = _clean_tile(w, h, (218, 214, 202), 7208, noise=0.35)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, w - 10, h - 10], radius=8, outline=(166, 158, 144, 58), width=1)
    d.line([(22, h - 24), (w - 22, h - 24)], fill=(156, 150, 138, 42), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.25))


def paint_stitched_fabric(w=116, h=116):
    img = _clean_tile(w, h, (232, 224, 208), 7209, noise=0.4)
    d = ImageDraw.Draw(img)
    inset = 10
    d.rounded_rectangle([inset, inset, w - inset, h - inset], radius=8, outline=(188, 176, 154, 55), width=1)
    for x in range(inset + 5, w - inset, 14):
        d.line([(x, inset), (x + 5, inset)], fill=(164, 150, 126, 50), width=1)
        d.line([(x, h - inset), (x + 5, h - inset)], fill=(164, 150, 126, 50), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.25))


def paint_sofa_groove(w=64, h=64):
    img = _clean_tile(w, h, (166, 158, 144), 7210, noise=0.12)
    d = ImageDraw.Draw(img)
    d.line([(0, h // 2), (w, h // 2)], fill=(124, 116, 104, 55), width=1)
    return img


def paint_clinical_rail(w=192, h=32):
    img = _clean_tile(w, h, (236, 234, 226), 7211, noise=0.35)
    d = ImageDraw.Draw(img)
    d.line([(0, h // 2), (w, h // 2)], fill=(196, 194, 184, 40), width=1)
    return img.filter(ImageFilter.GaussianBlur(0.2))


def make_hidden_control_seam(name):
    img = Image.new("RGBA", (4, 4), (150, 142, 126, 255))
    return PBRMaterial(
        name=name,
        baseColorTexture=img,
        metallicFactor=0.0,
        roughnessFactor=0.78,
        baseColorFactor=[1.0, 1.0, 1.0, 1.0],
        emissiveFactor=[0.0, 0.0, 0.0],
    )


def bevel_box(extents, mat, bevel=0.018):
    """Clean chamfered box for residential furniture.

    Keep the rounded/chamfered silhouette for cushions, arms, plinths and wood
    cases, but rely on the showroom-light material pass to avoid dirty facets.
    """
    hx, hy, hz = (e / 2.0 for e in extents)
    b = min(bevel, hx * 0.35, hy * 0.35, hz * 0.35)
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((sx * (hx - b), sy * hy, sz * hz))
                pts.append((sx * hx, sy * (hy - b), sz * hz))
                pts.append((sx * hx, sy * hy, sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(pts)).convex_hull
    mesh.visual = TextureVisuals(
        uv=np.full((len(mesh.vertices), 2), [0.5, 0.5]),
        material=mat)
    return mesh


PIECES = [
    ("room_l2_img2_modular_sofa", "看护沙发", "sofa_bench", "sofa", "floor", "none",
     True, 0, build_modular_sofa, ["lane:living", "role:anchor", "style:l2-residential-sim"]),
    ("room_l2_img2_observation_dining_table", "观察餐桌", "desk", "table", "floor", "none",
     True, 0, build_dining_table, ["lane:living", "role:interactive", "style:l2-residential-sim"]),
    ("room_l2_img2_nursery_bed", "儿童看护床", "bed_or_exam_table", "bed", "floor", "none",
     True, 0, build_nursery_bed, ["lane:care", "role:anchor", "style:l2-residential-sim"]),
    ("room_l2_img2_family_portrait_console", "全家福管制台", "wall_panel_or_picture_frame", "wall_panel", "wall", "back",
     False, 2, build_portrait_console, ["lane:surveillance", "role:clue", "style:l2-residential-sim"]),
    ("room_l2_img2_service_kitchen_counter", "服务厨房台", "control_console", "table", "floor", "none",
     True, 0, build_kitchen_counter, ["lane:service", "role:interactive", "style:l2-residential-sim"]),
    ("room_l2_img2_scanner_wardrobe", "衣柜扫描舱", "cabinet", "cabinet", "floor", "back",
     True, 2, build_scanner_wardrobe, ["lane:surveillance", "role:hero", "style:l2-residential-sim"]),
    ("room_l2_img2_camera_lamp", "看护落地灯", "wall_panel_or_picture_frame", "lamp", "floor", "none",
     False, 0, build_camera_lamp, ["lane:surveillance", "role:filler", "style:l2-residential-sim"]),
    ("room_l2_img2_living_end_elevator_fixture", "尽头电梯饰柜", "cabinet", "cabinet", "floor", "back",
     True, 0, build_elevator_fixture, ["lane:exit", "role:hero", "style:l2-residential-sim"]),
    ("room_l2_img2_observation_bookshelf", "观察书柜", "bookshelf", "books", "floor", "back",
     True, 2, build_observation_bookshelf, ["lane:surveillance", "role:clue", "style:l2-residential-sim"]),
    ("room_l2_img2_carekeeper_armchair", "看护单椅", "chair", "chair", "floor", "none",
     True, 1, build_carekeeper_armchair, ["lane:living", "role:filler", "style:l2-residential-sim"]),
]


# --------------------------------------------------------------------------- #
# Isometric contact-sheet renderer (numpy painter's algorithm, no GL needed)
# --------------------------------------------------------------------------- #
def iso_render(scene, size=320):
    az, el = math.radians(35), math.radians(28)
    cay, say = math.cos(az), math.sin(az)
    cel, sel = math.cos(el), math.sin(el)
    rot_y = np.array([[cay, 0, say], [0, 1, 0], [-say, 0, cay]])
    rot_x = np.array([[1, 0, 0], [0, cel, -sel], [0, sel, cel]])
    M = rot_x @ rot_y
    light = np.array([0.4, 0.8, 0.5])
    light = light / np.linalg.norm(light)

    tris, depths, colors = [], [], []
    for name, geom in scene.geometry.items():
        v = geom.vertices @ M.T
        try:
            # Try to get a representative color from the material
            mat = geom.visual.material if hasattr(geom.visual, 'material') else None
            if mat is not None and hasattr(mat, 'baseColorTexture') and mat.baseColorTexture is not None:
                img = mat.baseColorTexture
                if hasattr(img, 'mode'):
                    px = np.array(img.convert("RGB"))
                    avg_col = px.mean(axis=(0, 1)).astype(np.uint8)
                else:
                    avg_col = np.array([170, 160, 140], dtype=np.uint8)
            else:
                avg_col = np.array([170, 160, 140], dtype=np.uint8)
            fc = np.tile(avg_col, (len(geom.faces), 1))
        except Exception:
            fc = np.tile([170, 160, 140], (len(geom.faces), 1))
        for fi, face in enumerate(geom.faces):
            p = v[face]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            shade = 0.68 + 0.32 * max(0.0, float(np.dot(n / nn, light)))
            base = fc[fi] if fi < len(fc) else fc[0]
            colors.append(tuple(int(min(255, c * shade)) for c in base))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())

    img = Image.new("RGB", (size, size), (224, 218, 206))
    d = ImageDraw.Draw(img)
    if not tris:
        return img
    allpts = np.concatenate(tris)
    mn, mx = allpts.min(axis=0), allpts.max(axis=0)
    ext = (mx - mn).max()
    scale = (size * 0.82) / ext
    off = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + off
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


def contact_sheet(scenes, atlas):
    cell = 320
    cols, rows = 4, 3
    sheet = Image.new("RGB", (cols * cell, rows * cell), (224, 218, 206))
    draw = ImageDraw.Draw(sheet)
    for i, (key, scene) in enumerate(scenes):
        r, c = divmod(i, cols)
        tile = iso_render(scene, cell)
        sheet.paste(tile, (c * cell, r * cell))
        label = key.replace("room_l2_img2_", "")
        draw.text((c * cell + 8, r * cell + 6), label, fill=(78, 64, 48))
        draw.text((c * cell + 8, r * cell + 22), "(showroom clean)", fill=(96, 108, 104))
    # atlas proof in the last two cells
    ax = (cols - 2) * cell + 20
    ay = (rows - 1) * cell + 20
    sheet.paste(atlas.resize((cell * 2 - 40, cell - 40)), (ax, ay))
    draw.text((ax, ay - 16), "Image2 atlas (clean material cuts)", fill=(78, 64, 48))
    return sheet


def beauty_render(scene, size=480):
    """Close-up beauty render: tighter zoom, warmer light, show material contrast."""
    az, el = math.radians(22), math.radians(18)
    cay, say = math.cos(az), math.sin(az)
    cel, sel = math.cos(el), math.sin(el)
    rot_y = np.array([[cay, 0, say], [0, 1, 0], [-say, 0, cay]])
    rot_x = np.array([[1, 0, 0], [0, cel, -sel], [0, sel, cel]])
    M = rot_x @ rot_y
    # Two light directions for contrast
    light1 = np.array([0.6, 0.8, 0.4])
    light1 = light1 / np.linalg.norm(light1)
    light2 = np.array([-0.3, 0.5, 0.7])
    light2 = light2 / np.linalg.norm(light2)

    tris, depths, colors = [], [], []
    for name, geom in scene.geometry.items():
        v = geom.vertices @ M.T
        try:
            mat = geom.visual.material if hasattr(geom.visual, 'material') else None
            if mat is not None and hasattr(mat, 'baseColorTexture') and mat.baseColorTexture is not None:
                img = mat.baseColorTexture
                if hasattr(img, 'mode'):
                    img_small = img.convert("RGB").resize((8, 8), Image.BICUBIC)
                    px = np.array(img_small)
                    avg_col = px.mean(axis=(0, 1)).astype(np.uint8)
                else:
                    avg_col = np.array([170, 160, 140], dtype=np.uint8)
            else:
                avg_col = np.array([170, 160, 140], dtype=np.uint8)
            fc = np.tile(avg_col, (len(geom.faces), 1))
        except Exception:
            fc = np.tile([170, 160, 140], (len(geom.faces), 1))
        for fi, face in enumerate(geom.faces):
            p = v[face]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            l1 = max(0.0, float(np.dot(n / nn, light1)))
            l2 = max(0.0, float(np.dot(n / nn, light2)))
            shade = 0.30 + 0.55 * l1 + 0.15 * l2
            base = fc[fi] if fi < len(fc) else fc[0]
            colors.append(tuple(int(min(255, c * shade)) for c in base))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())

    img = Image.new("RGB", (size, size), (18, 16, 14))
    d = ImageDraw.Draw(img)
    if not tris:
        return img
    allpts = np.concatenate(tris)
    mn, mx = allpts.min(axis=0), allpts.max(axis=0)
    ext = (mx - mn).max()
    scale = (size * 0.90) / ext
    off = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + off
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main():
    atlas_img = build_atlas()

    assets = []
    scenes = []
    audit_rows = []
    for (model_key, label, family, footprint, mount, wall_pref,
         solid, clue, builder, tags) in PIECES:
        scene = builder()
        size_m = finalize(scene)
        glb_path = os.path.join(MODEL_DIR, f"{model_key}.glb")
        scene.export(glb_path)
        nbytes = os.path.getsize(glb_path)
        scenes.append((model_key, scene))
        audit_rows.append((model_key, size_m, len(scene.geometry), nbytes))
        assets.append({
            "modelKey": model_key,
            "label": label,
            "assetKind": "furniture",
            "family": family,
            "group": "居住",
            "source": "level02-image2-furniture",
            "sourceAssetId": f"{model_key}_v1",
            "themeId": "hp_level02_residential_sim",
            "glbFile": os.path.relpath(glb_path, os.path.dirname(MANIFEST_PATH)).replace(os.sep, "/"),
            "sizeMeters": size_m,
            "solid": solid,
            "mount": mount,
            "wallPreferred": wall_pref,
            "canHoldSmallProps": solid and footprint in ("table", "cabinet"),
            "clueCapacity": clue,
            "footprintFamily": footprint,
            "tags": tags,
        })

    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_level02_furniture_image2_v1",
        "label": "HP 居住模拟家具包 (Image2)",
        "sourceTool": "level02-image2-furniture",
        "generatedAt": "2026-06-13",
        "atlas": "src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_atlas.png",
        "assets": assets,
    }
    with open(MANIFEST_PATH, "w") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Evidence: contact sheet
    sheet = contact_sheet(scenes, atlas_img)
    sheet_path = os.path.join(EVIDENCE_DIR, "level02-contact-sheet.png")
    sheet.save(sheet_path)
    # Also write to old TMP_DIR location for compatibility
    sheet.save(os.path.join(TMP_DIR, "level02-furniture-image2-contact-sheet.png"))

    # Beauty renders for 2 key pieces
    for beauty_key, beauty_label in [
        ("room_l2_img2_modular_sofa", "sofa"),
        ("room_l2_img2_service_kitchen_counter", "kitchen_counter"),
    ]:
        for model_key, scene in scenes:
            if model_key == beauty_key:
                br = beauty_render(scene, size=480)
                br_path = os.path.join(EVIDENCE_DIR, f"level02-beauty-{beauty_label}.png")
                br.save(br_path)

    # Write build log
    log_path = os.path.join(EVIDENCE_DIR, "level02-build-log.txt")
    blueprint_path = os.path.join(EVIDENCE_DIR, "level02-clean-color-blueprint.json")
    with open(blueprint_path, "w") as f:
        json.dump({
            "pipeline": L2_COLOR_PIPELINE,
            "assets": L2_ASSET_BLUEPRINTS,
            "qaEvidence": {
                "contactSheet": sheet_path,
                "buildLog": log_path,
                "atlas": ATLAS_PATH,
                "manifest": MANIFEST_PATH,
            },
        }, f, indent=2)
        f.write("\n")
    with open(log_path, "w") as f:
        f.write("Level 02 furniture Image2 build — CLEAN RESIDENTIAL COLOR PASS v2\n")
        f.write(f"atlas: {ATLAS_PATH} ({ATLAS_SIZE}x{ATLAS_SIZE}), {len(REGION_LAYOUT)} regions\n")
        f.write("Image2 contract: each body material has dedicated PBRMaterial.baseColorTexture\n")
        f.write("Color pipeline: clear noisy procedural color -> five restrained residential materials -> hidden-control dark seams\n")
        f.write(f"Blueprint evidence: {blueprint_path}\n\n")
        for key, size_m, ngeom, nbytes in audit_rows:
            f.write(f"{key:42s} size={size_m} parts={ngeom:3d} {nbytes/1024:8.1f} KB\n")
    # Also write to TMP_DIR for compatibility
    import shutil
    shutil.copy(log_path, os.path.join(TMP_DIR, "build-log.txt"))

    print("Atlas:", ATLAS_PATH)
    print("Regions:", REGIONS_PATH)
    print("Manifest:", MANIFEST_PATH)
    print("Contact sheet:", sheet_path)
    print("Build log:", log_path)
    print("\nmodel_key, sizeMeters, parts, KB")
    for key, size_m, ngeom, nbytes in audit_rows:
        print(f"  {key:42s} {size_m} parts={ngeom} {nbytes/1024:.1f}KB")


if __name__ == "__main__":
    main()
