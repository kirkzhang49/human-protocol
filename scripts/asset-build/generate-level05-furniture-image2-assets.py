#!/usr/bin/env python3
"""Human Protocol — Level 05 Reclamation Core furniture Image2 pack.

Self-contained, merge-safe generator.  Does NOT touch any shared catalog /
registry / footprint files.  It only writes Level 05-isolated paths:

  src/assets/textures/environment/level05-furniture-image2/image2-sources/*.png
  src/assets/textures/environment/level05-furniture-image2/hp_level05_furniture_image2_atlas.png
  src/assets/textures/environment/level05-furniture-image2/hp_level05_furniture_image2_atlas.regions.json
  src/assets/models-cooked/environment/level05-furniture-image2/*.glb
  src/assets/manifests/builder/hp_level05_furniture_image2_v1.json
  .tmp/level05-furniture-image2/*  (evidence: contact sheet + GLB audit)

Design language — Reclamation Core:
  Identity archive pressure.  Dark graphite powdercoat, black recesses, aged
  brass rails, copper bus bars, amber archive glass, cyan identity scanners.
  Heavy, final, premium.  Cyan/amber accents; red only for danger; no
  bloom-white blocks.

Atlas regions (11 tiles):
  graphite_powdercoat, black_recess_plate, aged_brass_rail, copper_bus_bar,
  amber_archive_glass, cyan_identity_scan_strip, white_identity_ceramic_plate,
  rubber_cable_socket, drawer_front, edge_wear, circular_core_lens

9 GLBs:
  room_l5_img2_archive_server_column
  room_l5_img2_identity_capsule_cabinet
  room_l5_img2_data_spine_rack
  room_l5_img2_biometric_filing_throne
  room_l5_img2_retrieval_conveyor_table
  room_l5_img2_lockbox_pedestal
  room_l5_img2_core_memory_altar
  room_l5_img2_heavy_archive_elevator_door
  room_l5_img2_route_key_pedestal

Run:
    python3 scripts/asset-build/generate-level05-furniture-image2-assets.py
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
REPO = Path(__file__).resolve().parents[2]
TEX_DIR = REPO / "src/assets/textures/environment/level05-furniture-image2"
SRC_DIR = TEX_DIR / "image2-sources"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level05-furniture-image2"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level05_furniture_image2_v1.json"
TMP_DIR = REPO / ".tmp/level05-furniture-image2"
ATLAS_PNG = TEX_DIR / "hp_level05_furniture_image2_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level05_furniture_image2_atlas.regions.json"

for _d in (TEX_DIR, SRC_DIR, GLB_DIR, MANIFEST.parent, TMP_DIR,
           REPO / ".tmp/level01-05-furniture-image2-production"):
    _d.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(20260613)
ATLAS_SIZE = 1024

# --------------------------------------------------------------------------
# Palette — Reclamation Core
# --------------------------------------------------------------------------
# Lifted from near-black so the big graphite masses read their silhouette,
# bevel edges and panel faces in low-light /build thumbnails — still clearly a
# dark graphite powdercoat (Reclamation Core black-gold mood), not brightened.
GRAPHITE_DARK = (38, 42, 48)
GRAPHITE_MID  = (58, 64, 72)
GRAPHITE_HI   = (92, 100, 110)
BLACK_RECESS   = (14, 16, 19)
BRASS_DARK    = (72, 54, 22)
BRASS_MID     = (166, 130, 58)
BRASS_HI      = (210, 176, 100)
COPPER_DARK   = (80, 42, 18)
COPPER_MID    = (172, 90, 42)
COPPER_HI     = (216, 136, 76)
AMBER_DARK    = (36, 18, 4)
AMBER_MID     = (200, 120, 28)
AMBER_HI      = (240, 180, 60)
CYAN          = (48, 220, 255)
CYAN_DIM      = (20, 100, 140)
WHITE_CERAMIC = (228, 224, 218)
RUBBER_DARK   = (18, 16, 14)
RUBBER_MID    = (36, 34, 30)
EDGE_WEAR_COL = (56, 58, 50)


# --------------------------------------------------------------------------
# Noise / gradient helpers
# --------------------------------------------------------------------------
def _noise(w: int, h: int, scale: float, seed_offset: int = 0) -> np.ndarray:
    """Smooth value noise in [-1, 1]."""
    rng = np.random.default_rng(20260613 + seed_offset)
    gw = max(2, int(w * scale))
    gh = max(2, int(h * scale))
    small = rng.standard_normal((gh, gw))
    img = Image.fromarray(
        ((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype("uint8")
    )
    img = img.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr * 2.0 - 1.0


def _vgrad(w: int, h: int, top, bottom) -> Image.Image:
    top = np.array(top, dtype=np.float32)
    bottom = np.array(bottom, dtype=np.float32)
    t = np.linspace(0.0, 1.0, h)[:, None, None]
    arr = top[None, None, :] * (1 - t) + bottom[None, None, :] * t
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


def _to_rgba(arr: np.ndarray, alpha: int = 255) -> Image.Image:
    arr = np.clip(arr, 0, 255).astype("uint8")
    rgba = np.dstack([arr, np.full(arr.shape[:2], alpha, dtype="uint8")])
    return Image.fromarray(rgba, "RGBA")


# --------------------------------------------------------------------------
# Source tile painters — each returns RGBA and is saved to image2-sources
# --------------------------------------------------------------------------

def tile_graphite_powdercoat(w=320, h=320) -> Image.Image:
    """Dark graphite powdercoat with micro-texture grain and panel seams."""
    base = _vgrad(w, h, GRAPHITE_HI, GRAPHITE_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.07, 1)[..., None] * 10
    arr += _noise(w, h, 0.20, 2)[..., None] * 4
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    # subtle panel seams
    for x in (w // 3, 2 * w // 3):
        d.line([(x, 0), (x, h)], fill=(*GRAPHITE_DARK, 200), width=2)
    d.line([(0, h // 2), (w, h // 2)], fill=(*GRAPHITE_DARK, 120), width=1)
    # top-right specular sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sheen)
    ds.ellipse([-w // 4, -h // 3, w + w // 4, h // 2], fill=(*GRAPHITE_HI, 30))
    img = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(18)))
    return img


def tile_black_recess_plate(w=320, h=320) -> Image.Image:
    """Near-black recessed panel — very dark with faint cavity gradient."""
    base = _vgrad(w, h, (14, 15, 18), BLACK_RECESS)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.06, 3)[..., None] * 3
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    # inset recess frame
    d.rectangle([6, 6, w - 6, h - 6], outline=(18, 20, 22, 200), width=3)
    d.rectangle([14, 14, w - 14, h - 14], outline=(4, 4, 5, 255), width=1)
    return img


def tile_aged_brass_rail(w=640, h=80) -> Image.Image:
    """Aged brass rail — brushed vertical streaks, patina speckle, highlight seam."""
    base = _vgrad(w, h, BRASS_HI, BRASS_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    streak = _noise(w, h, 0.5, 4)
    arr += streak[..., None] * 16
    # aged patina (greenish speckle)
    spk = (_noise(w, h, 0.3, 5) > 0.62).astype(np.float32)
    arr[..., 1] -= spk * 18
    arr[..., 2] += spk * 10
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    d.line([(0, 3), (w, 3)], fill=(*BRASS_HI, 180), width=2)
    d.line([(0, h - 4), (w, h - 4)], fill=(30, 20, 8, 220), width=2)
    return img


def tile_copper_bus_bar(w=640, h=60) -> Image.Image:
    """Copper bus bar — warm reddish-copper with horizontal mill lines and oxide."""
    base = _vgrad(w, h, COPPER_HI, COPPER_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.6, 6)[..., None] * 12
    # mill-line horizontal streaks
    rng2 = np.random.default_rng(606)
    for _ in range(28):
        y = int(rng2.integers(0, h))
        v = float(rng2.uniform(-10, 6))
        arr[y, :, :] += v
    # oxide (slight green tinge in recesses)
    oxide = (_noise(w, h, 0.25, 7) < -0.50).astype(np.float32)
    arr[..., 1] += oxide * 14
    arr[..., 2] += oxide * 6
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    d.line([(0, 2), (w, 2)], fill=(*COPPER_HI, 200), width=2)
    d.line([(0, h - 3), (w, h - 3)], fill=(*COPPER_DARK, 200), width=2)
    return img


def tile_amber_archive_glass(w=320, h=320) -> Image.Image:
    """Warm amber archive glass — deep amber gradient with internal glow."""
    base = _vgrad(w, h, AMBER_HI, AMBER_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.06, 8)[..., None] * 8
    img = _to_rgba(arr, alpha=235)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse([w * 0.15, h * 0.1, w * 0.85, h * 0.75], fill=(*AMBER_HI, 80))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(24)))
    return img


def tile_cyan_identity_scan_strip(w=240, h=60) -> Image.Image:
    """Cyan identity scanner strip — glowing scan lines on dark background."""
    img = Image.new("RGBA", (w, h), (4, 10, 14, 255))
    d = ImageDraw.Draw(img)
    # three parallel scan lines
    for i in range(3):
        y = int(h * (0.22 + i * 0.28))
        d.line([(8, y), (w - 8, y)], fill=(*CYAN, 230), width=2)
    # tick marks
    for x in range(16, w - 8, 24):
        d.line([(x, 8), (x, h - 8)], fill=(*CYAN_DIM, 180), width=1)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.rectangle([4, 4, w - 4, h - 4], fill=(*CYAN, 55))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(8)))
    return img


def tile_white_identity_ceramic_plate(w=200, h=200) -> Image.Image:
    """White identity ceramic plate — near-white with subtle mold seam."""
    arr = _noise(w, h, 0.05, 9)
    base = np.array(WHITE_CERAMIC, dtype=np.float32)[None, None, :]
    arr_rgb = np.clip(base + arr[..., None] * 6, 0, 255)
    img = _to_rgba(arr_rgb)
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, w - 6, h - 6], outline=(180, 176, 170, 200), width=2)
    # subtle cyan scan slit at bottom
    d.rectangle([w // 4, h - 18, 3 * w // 4, h - 10], fill=(*CYAN_DIM, 160))
    return img


def tile_rubber_cable_socket(w=160, h=160) -> Image.Image:
    """Rubber cable socket — dark matte rubber with recessed hex socket."""
    arr = _noise(w, h, 0.1, 10)
    base = np.array(RUBBER_MID, dtype=np.float32)[None, None, :]
    arr_rgb = np.clip(base + arr[..., None] * 5, 0, 255)
    img = _to_rgba(arr_rgb)
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    # hex socket
    r = 36
    pts = [(int(cx + r * math.cos(math.radians(60 * i - 30))),
            int(cy + r * math.sin(math.radians(60 * i - 30)))) for i in range(6)]
    d.polygon(pts, fill=(*BLACK_RECESS, 255), outline=(*RUBBER_DARK, 255))
    # inner socket pin circle
    d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(*COPPER_DARK, 255))
    return img


def tile_drawer_front(w=320, h=200) -> Image.Image:
    """Archive drawer front — graphite with inset recess and brass pull handle."""
    base = _vgrad(w, h, GRAPHITE_MID, GRAPHITE_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.08, 11)[..., None] * 6
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    rows = 3
    for r_i in range(rows):
        y0 = int(h * r_i / rows) + 4
        y1 = int(h * (r_i + 1) / rows) - 4
        d.rectangle([6, y0, w - 6, y1], outline=(*BLACK_RECESS, 255), width=2)
        # brass pull bar
        cx = w // 2
        cy = (y0 + y1) // 2
        d.rectangle([cx - 32, cy - 6, cx + 32, cy + 6],
                    fill=(*BRASS_MID, 255), outline=(*BRASS_DARK, 255), width=1)
    return img


def tile_edge_wear(w=256, h=80) -> Image.Image:
    """Edge wear — graphite with bright metallic chips and scratch lines."""
    base = _vgrad(w, h, GRAPHITE_MID, GRAPHITE_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.15, 12)[..., None] * 8
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    rng2 = np.random.default_rng(1212)
    for _ in range(40):
        x = int(rng2.integers(0, w))
        y = int(rng2.integers(0, h))
        length = int(rng2.integers(4, 18))
        bright = int(rng2.integers(100, 180))
        col = (bright, bright - 10, bright - 20)
        d.line([(x, y), (x + length, y + int(rng2.integers(-2, 3)))],
               fill=(*col, 255), width=1)
    # corner brighter chips
    for sx, sy in ((8, 8), (w - 8, 8), (8, h - 8), (w - 8, h - 8)):
        d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=(*GRAPHITE_HI, 220))
    return img


def tile_circular_core_lens(w=200, h=200) -> Image.Image:
    """Circular core lens — cyan-glowing concentric rings, dark center iris."""
    img = Image.new("RGBA", (w, h), (*BLACK_RECESS, 255))
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    # concentric rings (brass outer, cyan middle, deep core)
    for r_px, col, wd in (
        (92, BRASS_MID, 4),
        (78, GRAPHITE_MID, 3),
        (60, CYAN, 5),
        (44, CYAN_DIM, 3),
        (28, (6, 10, 14), 0),
    ):
        d.ellipse([cx - r_px, cy - r_px, cx + r_px, cy + r_px],
                  fill=None if wd else (*BLACK_RECESS, 255),
                  outline=(*col, 240) if wd else None,
                  width=wd)
    # deep black center
    d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(*BLACK_RECESS, 255))
    # small cyan iris lines
    for angle in range(0, 360, 30):
        rad = math.radians(angle)
        x1 = int(cx + 30 * math.cos(rad))
        y1 = int(cy + 30 * math.sin(rad))
        x2 = int(cx + 58 * math.cos(rad))
        y2 = int(cy + 58 * math.sin(rad))
        d.line([(x1, y1), (x2, y2)], fill=(*CYAN_DIM, 180), width=1)
    # glow halo
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse([cx - 68, cy - 68, cx + 68, cy + 68], fill=(*CYAN, 50))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(10)))
    # lens glint
    glint = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dgl = ImageDraw.Draw(glint)
    dgl.ellipse([cx - 14, cy - 18, cx + 4, cy], fill=(*CYAN, 210))
    img = Image.alpha_composite(img, glint.filter(ImageFilter.GaussianBlur(3)))
    return img


# Atlas tile registry: id -> (painter, (x, y, w, h))
TILES = {
    "graphite_powdercoat":         (tile_graphite_powdercoat,         (8,    8,   320, 320)),
    "black_recess_plate":          (tile_black_recess_plate,          (344,  8,   320, 320)),
    "amber_archive_glass":         (tile_amber_archive_glass,         (680,  8,   320, 320)),
    "aged_brass_rail":             (tile_aged_brass_rail,             (8,    344, 640,  80)),
    "copper_bus_bar":              (tile_copper_bus_bar,              (8,    440, 640,  60)),
    "cyan_identity_scan_strip":    (tile_cyan_identity_scan_strip,    (664,  344, 240,  60)),
    "drawer_front":                (tile_drawer_front,                (8,    516, 320, 200)),
    "edge_wear":                   (tile_edge_wear,                   (344,  516, 256,  80)),
    "white_identity_ceramic_plate":(tile_white_identity_ceramic_plate,(616,  424, 200, 200)),
    "rubber_cable_socket":         (tile_rubber_cable_socket,         (344,  612, 160, 160)),
    "circular_core_lens":          (tile_circular_core_lens,          (520,  624, 200, 200)),
}


def build_atlas():
    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (*GRAPHITE_DARK, 255))
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
        "atlas": ATLAS_PNG.name,
        "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
        "format": "[x, y, w, h] in pixels, top-left origin",
        "regions": regions,
    }
    ATLAS_REGIONS.write_text(json.dumps(payload, indent=2) + "\n")
    return atlas, regions


# --------------------------------------------------------------------------
# UV helpers
# --------------------------------------------------------------------------
def _uv_rect(region_id, regions, pad=2):
    x, y, w, h = regions[region_id]
    u0 = (x + pad) / ATLAS_SIZE
    u1 = (x + w - pad) / ATLAS_SIZE
    v0 = (y + pad) / ATLAS_SIZE
    v1 = (y + h - pad) / ATLAS_SIZE
    return u0, v0, u1, v1


def _uv_center(region_id, regions):
    x, y, w, h = regions[region_id]
    return (x + w * 0.5) / ATLAS_SIZE, (y + h * 0.5) / ATLAS_SIZE


# --------------------------------------------------------------------------
# Material factory
# --------------------------------------------------------------------------
def make_mat(name, region_id, regions, atlas, *,
             metallic=0.3, rough=0.6, alpha=255, emissive=None, double=False):
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
# Geometry helpers
# --------------------------------------------------------------------------
_FACE_SPECS = (
    ("px", 0, 1), ("nx", 0, -1),
    ("py", 1, 1), ("ny", 1, -1),
    ("pz", 2, 1), ("nz", 2, -1),
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
    """Chamfered convex-hull box — center UV sample."""
    hx, hy, hz = (e / 2.0 for e in extents)
    b = min(bevel, hx * 0.49, hy * 0.49, hz * 0.49)
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((sx * (hx - b), sy * hy, sz * hz))
                pts.append((sx * hx, sy * (hy - b), sz * hz))
                pts.append((sx * hx, sy * hy, sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(pts)).convex_hull
    cu, cv = _uv_center(region_id, regions)
    mesh.visual = TextureVisuals(
        uv=np.full((len(mesh.vertices), 2), [cu, cv]),
        material=mat, image=atlas)
    return mesh


def cyl(radius, height, region_id, regions, atlas, mat, sections=36, axis="y"):
    """Cylinder along `axis`, center UV sample."""
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
# Finalize helpers — bake vertex translations so GLB accessor bounds are correct
# --------------------------------------------------------------------------
def _bake_translate(scene, tx, ty, tz):
    t = np.array([tx, ty, tz], dtype=np.float64)
    for geom in scene.geometry.values():
        if hasattr(geom, "vertices"):
            geom.vertices += t


def finalize(scene):
    """Ground at y=0, centre X/Z. Returns [sx, sy, sz] in metres."""
    b = scene.bounds
    cx = (b[0][0] + b[1][0]) / 2
    cz = (b[0][2] + b[1][2]) / 2
    miny = b[0][1]
    _bake_translate(scene, -cx, -miny, -cz)
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(v), 3) for v in size]


def finalize_wall(scene):
    """Wall-mount: centre X/Z only; y pivot stays at geometric centre."""
    b = scene.bounds
    cx = (b[0][0] + b[1][0]) / 2
    cz = (b[0][2] + b[1][2]) / 2
    _bake_translate(scene, -cx, 0.0, -cz)
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(v), 3) for v in size]


# ==========================================================================
# 9 Level 05 asset builders
# ==========================================================================

def build_archive_server_column(regions, atlas):
    """Tall graphite server tower, vertical rows of amber/cyan slot bays, brass corner rails.
    ~0.8 × 2.2 × 0.8 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_server_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    recess = make_mat("l5_server_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    brass  = make_mat("l5_server_brass",    "aged_brass_rail",      regions, atlas, metallic=0.9, rough=0.3)
    amber  = make_mat("l5_server_amber",    "amber_archive_glass",  regions, atlas, metallic=0.0, rough=0.15,
                      alpha=240, emissive=AMBER_MID)
    cyan   = make_mat("l5_server_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    wear   = make_mat("l5_server_wear",     "edge_wear",            regions, atlas, metallic=0.4, rough=0.5)

    # Main tower body — face_box so each side shows the graphite gradient/seams
    # (readable side faces in low light; brass corner rails carry the bevel edge).
    add(s, place(face_box((0.74, 2.10, 0.74), "graphite_powdercoat", regions, atlas, graph),
                 (0, 1.05, 0)), "server_body")
    # Heavy base plinth (slightly wider)
    add(s, place(bevel_box((0.80, 0.12, 0.80), "graphite_powdercoat", regions, atlas, graph, bevel=0.016),
                 (0, 0.06, 0)), "server_base")
    # Top cap
    add(s, place(bevel_box((0.80, 0.08, 0.80), "edge_wear", regions, atlas, wear, bevel=0.014),
                 (0, 2.16, 0)), "server_top_cap")

    # Brass corner rails (full height)
    for dx, dz in ((0.36, 0.36), (-0.36, 0.36), (0.36, -0.36), (-0.36, -0.36)):
        add(s, place(bevel_box((0.06, 2.10, 0.06), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                     (dx, 1.05, dz)), f"server_rail_{int(dx*100)}_{int(dz*100)}")

    # Slot bays: 5 rows of amber glow slots behind black recess panels
    for row in range(5):
        y = 0.32 + row * 0.34
        # Recess panel (full width)
        add(s, place(face_box((0.66, 0.28, 0.04), "black_recess_plate", regions, atlas, recess,
                              faces={"pz"}), (0, y, 0.375)), f"server_recess_{row}")
        # Amber glow slot inset
        add(s, place(face_box((0.52, 0.12, 0.022), "amber_archive_glass", regions, atlas, amber,
                              faces={"pz"}), (0, y, 0.388)), f"server_amber_{row}")
        # Cyan scan strip across top of each slot
        add(s, place(face_box((0.60, 0.025, 0.022), "cyan_identity_scan_strip", regions, atlas, cyan,
                              faces={"pz"}), (0, y + 0.13, 0.386)), f"server_cyan_{row}")

    # Copper bus bar along the left side
    add(s, place(face_box((0.06, 1.60, 0.04), "copper_bus_bar", regions, atlas,
                          make_mat("l5_server_copper", "copper_bus_bar", regions, atlas,
                                   metallic=0.7, rough=0.35)),
                 (-0.40, 1.10, 0.20)), "server_copper_bus")

    return s, len(s.geometry)


def build_identity_capsule_cabinet(regions, atlas):
    """Upright cabinet holding 4 vertical amber identity capsules, brass frame, black recess.
    ~1.1 × 2.0 × 0.6 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_idc_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    recess = make_mat("l5_idc_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    brass  = make_mat("l5_idc_brass",    "aged_brass_rail",      regions, atlas, metallic=0.9, rough=0.3)
    amber  = make_mat("l5_idc_amber",    "amber_archive_glass",  regions, atlas, metallic=0.0, rough=0.12,
                      alpha=235, emissive=AMBER_MID)
    cyan   = make_mat("l5_idc_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    ceram  = make_mat("l5_idc_ceramic",  "white_identity_ceramic_plate", regions, atlas,
                      metallic=0.05, rough=0.45)

    # Cabinet body — face_box for readable side faces in low light.
    add(s, place(face_box((1.04, 1.90, 0.54), "graphite_powdercoat", regions, atlas, graph),
                 (0, 0.95, 0)), "idc_body")
    # Base plinth
    add(s, place(bevel_box((1.10, 0.10, 0.60), "graphite_powdercoat", regions, atlas, graph, bevel=0.012),
                 (0, 0.05, 0)), "idc_plinth")
    # Brass top cornice
    add(s, place(bevel_box((1.10, 0.10, 0.60), "aged_brass_rail", regions, atlas, brass, bevel=0.016),
                 (0, 1.95, 0)), "idc_cornice")
    # Brass vertical frame pillars
    for dx in (-0.48, 0.48):
        add(s, place(bevel_box((0.08, 1.90, 0.08), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                     (dx, 0.95, 0.27)), f"idc_pillar_{int(dx*100)}")

    # 4 capsule bays (2 wide × 2 tall)
    capsule_mat = amber
    for ri in range(2):
        for ci in range(2):
            cx2 = -0.24 + ci * 0.48
            cy2 = 0.50 + ri * 0.80
            # Black recess surround
            add(s, place(face_box((0.40, 0.70, 0.04), "black_recess_plate", regions, atlas, recess,
                                  faces={"pz"}), (cx2, cy2, 0.275)),
                f"idc_recess_{ri}_{ci}")
            # Amber capsule column (tall pill shape approximated as cylinder)
            cap = cyl(0.10, 0.56, "amber_archive_glass", regions, atlas, capsule_mat, sections=28)
            add(s, place(cap, (cx2, cy2, 0.27)), f"idc_capsule_{ri}_{ci}")
            # Cyan scan strip at base of each capsule
            add(s, place(face_box((0.32, 0.022, 0.022), "cyan_identity_scan_strip", regions, atlas, cyan,
                                  faces={"pz"}), (cx2, cy2 - 0.31, 0.285)),
                f"idc_capsule_scan_{ri}_{ci}")

    # Ceramic identity plate on front (label zone)
    add(s, place(face_box((0.82, 0.14, 0.012), "white_identity_ceramic_plate", regions, atlas, ceram,
                          faces={"pz"}), (0, 1.76, 0.278)), "idc_id_plate")
    # Cyan scan seam at door base
    add(s, place(face_box((1.00, 0.018, 0.020), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, 0.12, 0.278)), "idc_base_scan")

    return s, len(s.geometry)


def build_data_spine_rack(regions, atlas):
    """Rack of horizontal data blades with copper bus bars + cyan scan strips on a central spine.
    ~1.0 × 2.0 × 0.7 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_dsr_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    recess = make_mat("l5_dsr_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    brass  = make_mat("l5_dsr_brass",    "aged_brass_rail",      regions, atlas, metallic=0.9, rough=0.3)
    copper = make_mat("l5_dsr_copper",   "copper_bus_bar",       regions, atlas, metallic=0.7, rough=0.35)
    cyan   = make_mat("l5_dsr_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    wear   = make_mat("l5_dsr_wear",     "edge_wear",            regions, atlas, metallic=0.4, rough=0.5)

    # Rack frame — face_box for readable side faces in low light.
    add(s, place(face_box((0.96, 1.96, 0.66), "graphite_powdercoat", regions, atlas, graph),
                 (0, 0.98, 0)), "dsr_frame")
    # Base/plinth
    add(s, place(bevel_box((1.00, 0.08, 0.70), "edge_wear", regions, atlas, wear, bevel=0.012),
                 (0, 0.04, 0)), "dsr_base")
    # Top cap
    add(s, place(bevel_box((1.00, 0.08, 0.70), "aged_brass_rail", regions, atlas, brass, bevel=0.014),
                 (0, 1.96, 0)), "dsr_top_cap")

    # Central spine (graphite, vertical)
    add(s, place(face_box((0.08, 1.80, 0.06), "graphite_powdercoat", regions, atlas, graph),
                 (0, 1.00, 0.28)), "dsr_spine")
    # Copper bus bars down the spine (left and right)
    for dx in (-0.06, 0.06):
        add(s, place(face_box((0.04, 1.72, 0.04), "copper_bus_bar", regions, atlas, copper),
                     (dx, 1.00, 0.26)), f"dsr_bus_bar_{int(dx*100)}")

    # 6 horizontal data blades
    for row in range(6):
        y = 0.24 + row * 0.28
        # Blade body (recess style)
        add(s, place(face_box((0.82, 0.22, 0.06), "black_recess_plate", regions, atlas, recess,
                              faces={"pz", "py", "ny"}), (0, y, 0.325)),
            f"dsr_blade_{row}")
        # Cyan scan strip on front face
        add(s, place(face_box((0.74, 0.018, 0.022), "cyan_identity_scan_strip", regions, atlas, cyan,
                              faces={"pz"}), (0, y + 0.09, 0.338)),
            f"dsr_blade_scan_{row}")
        # Copper connector nub on right side
        add(s, place(bevel_box((0.06, 0.06, 0.08), "copper_bus_bar", regions, atlas, copper, bevel=0.010),
                     (0.46, y, 0.30)), f"dsr_connector_{row}")

    # Brass rack-ear tabs (left and right)
    for dx in (-0.46, 0.46):
        add(s, place(bevel_box((0.08, 1.80, 0.08), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                     (dx, 1.00, -0.28)), f"dsr_rail_ear_{int(dx*100)}")

    return s, len(s.geometry)


def build_biometric_filing_throne(regions, atlas):
    """Heavy throne built from filing drawers + brass armrests + cyan scan headrest (ominous).
    ~1.1 × 1.7 × 1.1 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_thr_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.60)
    drwr   = make_mat("l5_thr_drawer",   "drawer_front",         regions, atlas, metallic=0.15, rough=0.65)
    brass  = make_mat("l5_thr_brass",    "aged_brass_rail",      regions, atlas, metallic=0.9, rough=0.3)
    cyan   = make_mat("l5_thr_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    ceram  = make_mat("l5_thr_ceramic",  "white_identity_ceramic_plate", regions, atlas,
                      metallic=0.05, rough=0.45)
    recess = make_mat("l5_thr_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)

    # Seat base: filing drawer block (throne seat)
    add(s, place(bevel_box((1.04, 0.52, 1.00), "drawer_front", regions, atlas, drwr, bevel=0.016),
                 (0, 0.26, 0)), "throne_seat_block")
    # Seat plinth (graphite, grounding)
    add(s, place(bevel_box((1.10, 0.08, 1.06), "graphite_powdercoat", regions, atlas, graph, bevel=0.014),
                 (0, 0.04, 0)), "throne_plinth")

    # Backrest: tall filing drawer column
    add(s, place(bevel_box((1.04, 0.88, 0.22), "drawer_front", regions, atlas, drwr, bevel=0.016),
                 (0, 0.96, -0.40)), "throne_backrest")
    # Back graphite frame
    add(s, place(bevel_box((1.10, 0.92, 0.30), "graphite_powdercoat", regions, atlas, graph, bevel=0.018),
                 (0, 0.96, -0.47)), "throne_back_frame")

    # Brass armrests (left and right, angled top)
    for dx, nm in ((-0.52, "l"), (0.52, "r")):
        add(s, place(bevel_box((0.14, 0.08, 0.96), "aged_brass_rail", regions, atlas, brass, bevel=0.016),
                     (dx, 0.60, 0.04)), f"throne_armrest_{nm}")
        # Armrest side post
        add(s, place(bevel_box((0.14, 0.52, 0.14), "aged_brass_rail", regions, atlas, brass, bevel=0.014),
                     (dx, 0.30, -0.42)), f"throne_arm_post_{nm}")

    # Cyan scan headrest (ominous crown)
    add(s, place(bevel_box((0.90, 0.16, 0.14), "graphite_powdercoat", regions, atlas, graph, bevel=0.014),
                 (0, 1.48, -0.39)), "throne_headrest_frame")
    add(s, place(face_box((0.78, 0.10, 0.022), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, 1.48, -0.32)), "throne_scan_headrest")
    # Ceramic identity plate on headrest
    add(s, place(face_box((0.40, 0.08, 0.012), "white_identity_ceramic_plate", regions, atlas, ceram,
                          faces={"pz"}), (0, 1.52, -0.31)), "throne_id_plate")

    # 3 drawer fronts on seat front face
    for i, dx in enumerate((-0.32, 0.0, 0.32)):
        add(s, place(face_box((0.28, 0.22, 0.022), "drawer_front", regions, atlas, drwr,
                              faces={"pz"}), (dx, 0.28, 0.505)),
            f"throne_drawer_face_{i}")

    # Cyan base scan seam
    add(s, place(face_box((1.00, 0.018, 0.020), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, 0.10, 0.505)), "throne_base_scan")

    return s, len(s.geometry)


def build_retrieval_conveyor_table(regions, atlas):
    """Low heavy table with recessed conveyor belt slot, amber glass inlay, brass edge.
    ~1.8 × 0.8 × 1.0 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_rct_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    brass  = make_mat("l5_rct_brass",    "aged_brass_rail",      regions, atlas, metallic=0.9, rough=0.3)
    amber  = make_mat("l5_rct_amber",    "amber_archive_glass",  regions, atlas, metallic=0.0, rough=0.15,
                      alpha=235, emissive=AMBER_MID)
    recess = make_mat("l5_rct_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    rubber = make_mat("l5_rct_rubber",   "rubber_cable_socket",  regions, atlas, metallic=0.05, rough=0.9)
    cyan   = make_mat("l5_rct_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    wear   = make_mat("l5_rct_wear",     "edge_wear",            regions, atlas, metallic=0.4, rough=0.5)

    # Main table body
    add(s, place(bevel_box((1.76, 0.60, 0.94), "graphite_powdercoat", regions, atlas, graph, bevel=0.020),
                 (0, 0.38, 0)), "conv_body")
    # Heavy base legs/plinth block
    add(s, place(bevel_box((1.80, 0.08, 0.98), "graphite_powdercoat", regions, atlas, graph, bevel=0.014),
                 (0, 0.04, 0)), "conv_plinth")
    # Brass edge trim (top perimeter)
    add(s, place(face_box((1.82, 0.04, 0.96), "aged_brass_rail", regions, atlas, brass),
                 (0, 0.70, 0)), "conv_brass_top")
    add(s, place(face_box((1.82, 0.04, 0.96), "edge_wear", regions, atlas, wear),
                 (0, 0.66, 0)), "conv_edge_wear")

    # Recessed conveyor slot (centre of top surface)
    add(s, place(face_box((1.50, 0.04, 0.34), "black_recess_plate", regions, atlas, recess,
                          faces={"py"}), (0, 0.69, 0)), "conv_slot_recess")
    # Amber glass inlay inside slot
    add(s, place(face_box((1.40, 0.02, 0.26), "amber_archive_glass", regions, atlas, amber,
                          faces={"py"}), (0, 0.71, 0)), "conv_amber_inlay")
    # Cyan scanner rail down each long side of slot
    for dz in (-0.18, 0.18):
        add(s, place(face_box((1.50, 0.018, 0.022), "cyan_identity_scan_strip", regions, atlas, cyan,
                              faces={"py"}), (0, 0.718, dz)),
            f"conv_scan_rail_{int(dz*100)}")

    # Rubber cable-socket panels on both ends
    for dx in (-0.86, 0.86):
        add(s, place(face_box((0.06, 0.24, 0.40), "rubber_cable_socket", regions, atlas, rubber,
                              faces={"px" if dx > 0 else "nx"}), (dx, 0.48, 0)),
            f"conv_cable_panel_{int(dx*100)}")

    # Front face identification plate zone
    add(s, place(face_box((0.80, 0.20, 0.022), "black_recess_plate", regions, atlas, recess,
                          faces={"pz"}), (0, 0.40, 0.472)), "conv_id_zone")

    return s, len(s.geometry)


def build_lockbox_pedestal(regions, atlas):
    """Squat graphite pedestal with black lockbox + brass clamps + cyan lock lens.
    ~0.7 × 1.1 × 0.7 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_lbp_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    recess = make_mat("l5_lbp_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    brass  = make_mat("l5_lbp_brass",    "aged_brass_rail",      regions, atlas, metallic=0.9, rough=0.3)
    cyan   = make_mat("l5_lbp_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    lens   = make_mat("l5_lbp_lens",     "circular_core_lens",   regions, atlas, metallic=0.3, rough=0.2,
                      emissive=CYAN_DIM)
    wear   = make_mat("l5_lbp_wear",     "edge_wear",            regions, atlas, metallic=0.4, rough=0.5)

    # Pedestal body
    add(s, place(bevel_box((0.64, 0.68, 0.64), "graphite_powdercoat", regions, atlas, graph, bevel=0.018),
                 (0, 0.34, 0)), "lbp_pedestal")
    # Pedestal base
    add(s, place(bevel_box((0.70, 0.08, 0.70), "edge_wear", regions, atlas, wear, bevel=0.014),
                 (0, 0.04, 0)), "lbp_base")
    # Brass base ring
    add(s, place(bevel_box((0.70, 0.04, 0.70), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                 (0, 0.10, 0)), "lbp_base_ring")

    # Lockbox on top
    add(s, place(bevel_box((0.58, 0.28, 0.58), "black_recess_plate", regions, atlas, recess, bevel=0.014),
                 (0, 0.82, 0)), "lbp_lockbox")
    # Brass clamp straps (4 edges of lockbox)
    for dx, dz in ((0.28, 0), (-0.28, 0), (0, 0.28), (0, -0.28)):
        nm = f"lbp_clamp_{int(dx*100)}_{int(dz*100)}"
        if dx != 0:
            add(s, place(bevel_box((0.06, 0.28, 0.54), "aged_brass_rail", regions, atlas, brass, bevel=0.010),
                         (dx, 0.82, 0)), nm)
        else:
            add(s, place(bevel_box((0.54, 0.28, 0.06), "aged_brass_rail", regions, atlas, brass, bevel=0.010),
                         (0, 0.82, dz)), nm)
    # Lockbox top plate
    add(s, place(bevel_box((0.58, 0.04, 0.58), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                 (0, 0.98, 0)), "lbp_lid")
    # Cyan scan ring around lid
    add(s, place(face_box((0.60, 0.018, 0.60), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"py"}), (0, 0.975, 0)), "lbp_cyan_ring")
    # Circular cyan lock lens centered on lid
    add(s, place(face_box((0.12, 0.025, 0.12), "circular_core_lens", regions, atlas, lens,
                          faces={"py"}), (0, 1.003, 0)), "lbp_lock_lens")

    return s, len(s.geometry)


def build_core_memory_altar(regions, atlas):
    """Stepped altar base with circular cyan core lens + brass rails + amber side glass.
    Premium hero piece. ~1.3 × 1.3 × 1.3 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_alt_graphite", "graphite_powdercoat", regions, atlas, metallic=0.25, rough=0.50)
    recess = make_mat("l5_alt_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    brass  = make_mat("l5_alt_brass",    "aged_brass_rail",      regions, atlas, metallic=0.92, rough=0.28)
    amber  = make_mat("l5_alt_amber",    "amber_archive_glass",  regions, atlas, metallic=0.0, rough=0.12,
                      alpha=230, emissive=AMBER_MID)
    cyan   = make_mat("l5_alt_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    lens   = make_mat("l5_alt_lens",     "circular_core_lens",   regions, atlas, metallic=0.3, rough=0.15,
                      emissive=CYAN)
    wear   = make_mat("l5_alt_wear",     "edge_wear",            regions, atlas, metallic=0.4, rough=0.5)
    copper = make_mat("l5_alt_copper",   "copper_bus_bar",       regions, atlas, metallic=0.7, rough=0.35)

    # Step 1 — widest base
    add(s, place(bevel_box((1.26, 0.22, 1.26), "graphite_powdercoat", regions, atlas, graph, bevel=0.022),
                 (0, 0.11, 0)), "altar_step1")
    # Step 1 brass edge
    add(s, place(face_box((1.30, 0.04, 1.30), "aged_brass_rail", regions, atlas, brass),
                 (0, 0.23, 0)), "altar_step1_brass")

    # Step 2
    add(s, place(bevel_box((1.00, 0.20, 1.00), "graphite_powdercoat", regions, atlas, graph, bevel=0.020),
                 (0, 0.32, 0)), "altar_step2")
    add(s, place(face_box((1.04, 0.04, 1.04), "aged_brass_rail", regions, atlas, brass),
                 (0, 0.43, 0)), "altar_step2_brass")

    # Step 3 — narrowest
    add(s, place(bevel_box((0.74, 0.18, 0.74), "graphite_powdercoat", regions, atlas, graph, bevel=0.018),
                 (0, 0.51, 0)), "altar_step3")
    add(s, place(face_box((0.78, 0.04, 0.78), "aged_brass_rail", regions, atlas, brass),
                 (0, 0.60, 0)), "altar_step3_brass")

    # Central core column
    core_col = cyl(0.18, 0.60, "graphite_powdercoat", regions, atlas, graph, sections=40)
    add(s, place(core_col, (0, 0.92, 0)), "altar_core_column")
    # Copper bus rings around column
    for cy_y in (0.64, 0.88, 1.12):
        ring = cyl(0.22, 0.04, "copper_bus_bar", regions, atlas, copper, sections=40)
        add(s, place(ring, (0, cy_y, 0)), f"altar_copper_ring_{int(cy_y*100)}")
    # Amber side glass panels (4 sides, between steps 2 and 3)
    for angle in (0, 90, 180, 270):
        rad = math.radians(angle)
        px2 = 0.46 * math.sin(rad)
        pz2 = 0.46 * math.cos(rad)
        panel = face_box((0.22, 0.36, 0.04), "amber_archive_glass", regions, atlas, amber,
                         faces={"pz" if math.cos(rad) > 0.5 else
                                "nz" if math.cos(rad) < -0.5 else
                                "px" if math.sin(rad) > 0.5 else "nx"})
        panel.apply_transform(
            trimesh.transformations.rotation_matrix(math.radians(angle), (0, 1, 0)))
        add(s, place(panel, (px2, 0.55, pz2)), f"altar_amber_glass_{angle}")

    # Cyan scan ring at top of column
    scan_ring = cyl(0.26, 0.022, "cyan_identity_scan_strip", regions, atlas, cyan, sections=40)
    add(s, place(scan_ring, (0, 1.22, 0)), "altar_scan_ring")
    # Crown: circular core lens cap
    add(s, place(face_box((0.30, 0.06, 0.30), "graphite_powdercoat", regions, atlas, graph,
                          faces={"py"}), (0, 1.25, 0)), "altar_crown_base")
    add(s, place(face_box((0.26, 0.04, 0.26), "circular_core_lens", regions, atlas, lens,
                          faces={"py"}), (0, 1.29, 0)), "altar_core_lens")
    # Brass corner posts on step 1
    for dx2, dz2 in ((0.58, 0.58), (-0.58, 0.58), (0.58, -0.58), (-0.58, -0.58)):
        add(s, place(bevel_box((0.06, 0.64, 0.06), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                     (dx2, 0.43, dz2)), f"altar_rail_{int(dx2*100)}_{int(dz2*100)}")
    # Edge wear on base
    add(s, place(bevel_box((1.30, 0.04, 1.30), "edge_wear", regions, atlas, wear, bevel=0.014),
                 (0, 0.02, 0)), "altar_base_wear")

    return s, len(s.geometry)


def build_heavy_archive_elevator_door(regions, atlas):
    """Heavy double-panel archive door in brass+graphite frame, vertical seam, cyan status lens.
    WALL fixture — pivot at base centre (finalize_wall: centre X/Z only, y = geometric centre).
    ~2.2 × 2.6 × 0.4 m.
    Mount note: place at wall face, pivot base at floor level. groundY will be negative
    (approx -1.3 m) — expected for a wall fixture centred vertically at y=0.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_aed_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    brass  = make_mat("l5_aed_brass",    "aged_brass_rail",      regions, atlas, metallic=0.92, rough=0.28)
    recess = make_mat("l5_aed_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    cyan   = make_mat("l5_aed_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    lens   = make_mat("l5_aed_lens",     "circular_core_lens",   regions, atlas, metallic=0.3, rough=0.2,
                      emissive=CYAN_DIM)
    wear   = make_mat("l5_aed_wear",     "edge_wear",            regions, atlas, metallic=0.4, rough=0.5)
    copper = make_mat("l5_aed_copper",   "copper_bus_bar",       regions, atlas, metallic=0.7, rough=0.35)

    # Outer frame (thick brass+graphite surround)
    add(s, bevel_box((2.24, 2.64, 0.40), "graphite_powdercoat", regions, atlas, graph, bevel=0.022),
        "door_frame_body")
    # Brass outer frame overlay (face_box so texture reads on front)
    add(s, face_box((2.24, 2.64, 0.44), "aged_brass_rail", regions, atlas, brass,
                    faces={"px", "nx", "py", "ny"}), "door_frame_brass")

    # Left panel
    add(s, place(bevel_box((1.04, 2.30, 0.28), "graphite_powdercoat", regions, atlas, graph, bevel=0.018),
                 (-0.54, 0, 0.04)), "door_panel_l")
    # Right panel
    add(s, place(bevel_box((1.04, 2.30, 0.28), "graphite_powdercoat", regions, atlas, graph, bevel=0.018),
                 (0.54, 0, 0.04)), "door_panel_r")

    # Recessed insets on each panel (3 per side)
    for dx3, side in ((-0.54, "l"), (0.54, "r")):
        for ri, y_off in enumerate((-0.70, 0.0, 0.70)):
            add(s, place(face_box((0.80, 0.60, 0.022), "black_recess_plate", regions, atlas, recess,
                                  faces={"pz"}), (dx3, y_off, 0.185)),
                f"door_recess_{side}_{ri}")

    # Central vertical seam strip (the gap between doors, emissive cyan)
    add(s, face_box((0.06, 2.40, 0.06), "cyan_identity_scan_strip", regions, atlas, cyan),
        "door_seam_glow")
    # Seam copper spine
    add(s, face_box((0.03, 2.40, 0.03), "copper_bus_bar", regions, atlas, copper),
        "door_seam_copper")

    # Brass lintel (top horizontal bar)
    add(s, place(face_box((2.20, 0.14, 0.40), "aged_brass_rail", regions, atlas, brass),
                 (0, 1.25, 0)), "door_lintel")
    # Brass sill
    add(s, place(face_box((2.20, 0.10, 0.40), "aged_brass_rail", regions, atlas, brass),
                 (0, -1.27, 0)), "door_sill")
    # Brass side jambs
    for dx4 in (-1.07, 1.07):
        add(s, place(bevel_box((0.10, 2.64, 0.40), "aged_brass_rail", regions, atlas, brass, bevel=0.014),
                     (dx4, 0, 0)), f"door_jamb_{int(dx4*100)}")

    # Cyan status lens (upper centre)
    add(s, place(face_box((0.14, 0.14, 0.024), "circular_core_lens", regions, atlas, lens,
                          faces={"pz"}), (0, 1.10, 0.22)), "door_status_lens")
    # Cyan scan strips across top and base
    add(s, place(face_box((2.00, 0.022, 0.024), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, 1.20, 0.20)), "door_top_scan")
    add(s, place(face_box((2.00, 0.022, 0.024), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, -1.20, 0.20)), "door_base_scan")

    # Edge wear on frame edges
    add(s, place(face_box((2.24, 0.04, 0.44), "edge_wear", regions, atlas, wear,
                          faces={"py"}), (0, 1.30, 0)), "door_top_wear")

    return s, len(s.geometry)


def build_route_key_pedestal(regions, atlas):
    """Slim graphite pedestal with angled top + brass route-key socket + cyan lens.
    ~0.5 × 1.1 × 0.5 m.
    """
    s = trimesh.Scene()
    graph  = make_mat("l5_rkp_graphite", "graphite_powdercoat", regions, atlas, metallic=0.2, rough=0.55)
    brass  = make_mat("l5_rkp_brass",    "aged_brass_rail",      regions, atlas, metallic=0.92, rough=0.28)
    cyan   = make_mat("l5_rkp_cyan",     "cyan_identity_scan_strip", regions, atlas,
                      metallic=0.2, rough=0.3, emissive=CYAN)
    lens   = make_mat("l5_rkp_lens",     "circular_core_lens",   regions, atlas, metallic=0.3, rough=0.2,
                      emissive=CYAN_DIM)
    recess = make_mat("l5_rkp_recess",   "black_recess_plate",  regions, atlas, metallic=0.1, rough=0.7)
    rubber = make_mat("l5_rkp_rubber",   "rubber_cable_socket",  regions, atlas, metallic=0.05, rough=0.9)
    edge   = make_mat("l5_rkp_edge",     "edge_wear",            regions, atlas, metallic=0.55, rough=0.4)

    # Pedestal body — face_box so the graphite gradient/seams give vertical form
    # (the lower 2/3 must read as the main mass in a 256px thumbnail, not a void).
    add(s, place(face_box((0.44, 0.88, 0.44), "graphite_powdercoat", regions, atlas, graph),
                 (0, 0.44, 0)), "rkp_body")
    # Vertical edge-wear highlight strips on all four corners → readable silhouette.
    for ex, ez in ((0.225, 0.225), (0.225, -0.225), (-0.225, 0.225), (-0.225, -0.225)):
        add(s, place(bevel_box((0.03, 0.84, 0.03), "edge_wear", regions, atlas, edge, bevel=0.008),
                     (ex, 0.46, ez)), f"rkp_edge_{ex}_{ez}")
    # Brass service band around the mid body (functional face layer).
    add(s, place(face_box((0.47, 0.07, 0.47), "aged_brass_rail", regions, atlas, brass),
                 (0, 0.52, 0)), "rkp_mid_band")
    # Cyan vertical service slit on the lower front (interaction accent).
    add(s, place(face_box((0.06, 0.30, 0.016), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, 0.30, 0.222)), "rkp_service_slit")
    # Base plate (wider, brass)
    add(s, place(bevel_box((0.50, 0.06, 0.50), "aged_brass_rail", regions, atlas, brass, bevel=0.014),
                 (0, 0.03, 0)), "rkp_base")
    # Base scan seam
    add(s, place(face_box((0.44, 0.016, 0.018), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"}), (0, 0.08, 0.222)), "rkp_base_scan")

    # Collar / neck
    add(s, place(bevel_box((0.38, 0.08, 0.38), "aged_brass_rail", regions, atlas, brass, bevel=0.012),
                 (0, 0.92, 0)), "rkp_collar")

    # Angled top head (15 degree forward tilt)
    head = face_box((0.40, 0.18, 0.14), "graphite_powdercoat", regions, atlas, graph)
    head.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-15), (1, 0, 0)))
    add(s, place(head, (0, 1.02, 0.02)), "rkp_head")

    # Brass route-key socket recess (angled)
    socket_outer = face_box((0.22, 0.14, 0.024), "aged_brass_rail", regions, atlas, brass,
                            faces={"pz"})
    socket_outer.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-15), (1, 0, 0)))
    add(s, place(socket_outer, (0, 1.03, 0.08)), "rkp_socket_brass")

    socket_inner = face_box((0.12, 0.08, 0.024), "rubber_cable_socket", regions, atlas, rubber,
                            faces={"pz"})
    socket_inner.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-15), (1, 0, 0)))
    add(s, place(socket_inner, (0, 1.02, 0.09)), "rkp_socket_rubber")

    # Cyan lens beside socket
    lens_mesh = face_box((0.08, 0.08, 0.024), "circular_core_lens", regions, atlas, lens,
                         faces={"pz"})
    lens_mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-15), (1, 0, 0)))
    add(s, place(lens_mesh, (-0.12, 1.03, 0.085)), "rkp_lens")

    # Cyan scan strip across head front
    scan_strip = face_box((0.36, 0.018, 0.016), "cyan_identity_scan_strip", regions, atlas, cyan,
                          faces={"pz"})
    scan_strip.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-15), (1, 0, 0)))
    add(s, place(scan_strip, (0, 1.11, 0.095)), "rkp_head_scan")

    # Side cable conduit
    add(s, place(bevel_box((0.06, 0.72, 0.06), "graphite_powdercoat", regions, atlas, graph, bevel=0.010),
                 (0.21, 0.46, 0.16)), "rkp_conduit")

    return s, len(s.geometry)


# ==========================================================================
# Asset manifest list
# ==========================================================================
ASSETS = [
    ("room_l5_img2_archive_server_column", build_archive_server_column, dict(
        label="档案服务器列塔", family="cabinet", footprintFamily="cabinet",
        mount="floor", clueCapacity=2, canHoldSmallProps=False, solid=True)),
    ("room_l5_img2_identity_capsule_cabinet", build_identity_capsule_cabinet, dict(
        label="身份胶囊柜", family="cabinet", footprintFamily="cabinet",
        mount="floor", clueCapacity=3, canHoldSmallProps=False, solid=True)),
    ("room_l5_img2_data_spine_rack", build_data_spine_rack, dict(
        label="数据脊柱机架", family="cabinet", footprintFamily="cabinet",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True)),
    ("room_l5_img2_biometric_filing_throne", build_biometric_filing_throne, dict(
        label="生物计量存档宝座", family="sofa_bench", footprintFamily="chair",
        mount="floor", clueCapacity=2, canHoldSmallProps=False, solid=True)),
    ("room_l5_img2_retrieval_conveyor_table", build_retrieval_conveyor_table, dict(
        label="检索传送台", family="desk", footprintFamily="table",
        mount="floor", clueCapacity=2, canHoldSmallProps=True, solid=True)),
    ("room_l5_img2_lockbox_pedestal", build_lockbox_pedestal, dict(
        label="锁盒基座", family="control_console", footprintFamily="pedestal",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True)),
    ("room_l5_img2_core_memory_altar", build_core_memory_altar, dict(
        label="核心记忆祭坛", family="display_case", footprintFamily="pedestal",
        mount="floor", clueCapacity=3, canHoldSmallProps=False, solid=True)),
    ("room_l5_img2_heavy_archive_elevator_door", build_heavy_archive_elevator_door, dict(
        label="重型档案电梯门", family="wall_panel_or_picture_frame", footprintFamily="wall_panel",
        mount="wall", wallPreferred="back", clueCapacity=1, canHoldSmallProps=False, solid=False,
        mountNote="Wall fixture. Pivot at base centre (y=0 = wall centre height). groundY ≈ -1.3 — expected.")),
    ("room_l5_img2_route_key_pedestal", build_route_key_pedestal, dict(
        label="路线密钥基座", family="control_console", footprintFamily="pedestal",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True)),
]

GROUP = "核心"
SOURCE = "level05-image2-furniture"
THEME = "hp_reclamation_core"

# Wall-mount assets that use finalize_wall instead of finalize
WALL_MOUNTS = {"room_l5_img2_heavy_archive_elevator_door"}


# ==========================================================================
# Isometric renderer (numpy painter's algorithm, no GL)
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


def iso_render(scene, size=320):
    """Dark amber/cyan-lit isometric render for Reclamation Core."""
    az, el = math.radians(38), math.radians(25)
    cay, say = math.cos(az), math.sin(az)
    cel, sel = math.cos(el), math.sin(el)
    rot_y = np.array([[cay, 0, say], [0, 1, 0], [-say, 0, cay]])
    rot_x = np.array([[1, 0, 0], [0, cel, -sel], [0, sel, cel]])
    M = rot_x @ rot_y
    # Key light: warm amber from upper-left; fill: cyan from lower-right
    light1 = np.array([0.5, 0.9, 0.3])
    light1 /= np.linalg.norm(light1)
    light2 = np.array([-0.4, 0.4, 0.8])
    light2 /= np.linalg.norm(light2)

    tris, depths, colors = [], [], []
    for _, geom in scene.geometry.items():
        v = geom.vertices @ M.T
        avg = _get_avg_color(geom)
        fc = np.tile(avg, (len(geom.faces), 1))
        for fi, face in enumerate(geom.faces):
            p = v[face]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            n /= nn
            l1 = max(0.0, float(np.dot(n, light1)))
            l2 = max(0.0, float(np.dot(n, light2)))
            # Amber-tinted key + cyan fill
            shade = 0.22 + 0.65 * l1 + 0.13 * l2
            base = fc[fi] if fi < len(fc) else fc[0]
            # Add warm amber tint to key-lit faces
            r = int(min(255, base[0] * shade + l1 * 8))
            g = int(min(255, base[1] * shade + l1 * 4))
            b = int(min(255, base[2] * shade + l2 * 6))
            colors.append((r, g, b))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())

    # Very dark background matching graphite theme
    img = Image.new("RGB", (size, size), (10, 11, 14))
    d = ImageDraw.Draw(img)
    if not tris:
        return img
    allpts = np.concatenate(tris)
    mn, mx = allpts.min(axis=0), allpts.max(axis=0)
    ext = (mx - mn).max()
    if ext < 1e-6:
        return img
    scale = (size * 0.84) / ext
    off = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + off
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


def beauty_render(scene, size=512):
    """Premium beauty render with amber key + cyan fill, dark background."""
    az, el = math.radians(28), math.radians(18)
    cay, say = math.cos(az), math.sin(az)
    cel, sel = math.cos(el), math.sin(el)
    rot_y = np.array([[cay, 0, say], [0, 1, 0], [-say, 0, cay]])
    rot_x = np.array([[1, 0, 0], [0, cel, -sel], [0, sel, cel]])
    M = rot_x @ rot_y
    light1 = np.array([0.6, 0.8, 0.3])
    light1 /= np.linalg.norm(light1)
    light2 = np.array([-0.3, 0.5, 0.8])
    light2 /= np.linalg.norm(light2)
    light3 = np.array([0.0, 0.2, -0.9])  # back rim
    light3 /= np.linalg.norm(light3)

    tris, depths, colors = [], [], []
    for _, geom in scene.geometry.items():
        v = geom.vertices @ M.T
        avg = _get_avg_color(geom)
        fc = np.tile(avg, (len(geom.faces), 1))
        for fi, face in enumerate(geom.faces):
            p = v[face]
            n = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(n)
            if nn < 1e-9:
                continue
            n /= nn
            l1 = max(0.0, float(np.dot(n, light1)))
            l2 = max(0.0, float(np.dot(n, light2)))
            l3 = max(0.0, float(np.dot(n, light3)))
            shade = 0.18 + 0.60 * l1 + 0.12 * l2 + 0.10 * l3
            base = fc[fi] if fi < len(fc) else fc[0]
            r = int(min(255, base[0] * shade + l1 * 12 + l3 * 6))
            g = int(min(255, base[1] * shade + l1 * 6))
            b = int(min(255, base[2] * shade + l2 * 10 + l3 * 4))
            colors.append((r, g, b))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())

    img = Image.new("RGB", (size, size), (8, 9, 12))
    d = ImageDraw.Draw(img)
    if not tris:
        return img
    allpts = np.concatenate(tris)
    mn, mx = allpts.min(axis=0), allpts.max(axis=0)
    ext = (mx - mn).max()
    if ext < 1e-6:
        return img
    scale = (size * 0.92) / ext
    off = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + off
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


def make_contact_sheet(scenes, atlas, regions):
    """9-asset contact sheet + atlas thumbnail + region swatches."""
    from PIL import ImageFont
    cell = 340
    cols, rows_assets = 3, 3
    sheet_w = cols * cell
    sheet_h = rows_assets * cell + 512 + 48
    sheet = Image.new("RGB", (sheet_w, sheet_h), (10, 10, 13))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
        font_sm = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
        font_sm = font

    d.text((8, 6), "Level 05 Reclamation Core — Image2 pack contact sheet", fill=(200, 210, 220), font=font)

    for i, (key, scene) in enumerate(scenes):
        r_i, c_i = divmod(i, cols)
        tile = iso_render(scene, cell - 20)
        tile = tile.resize((cell - 8, cell - 24), Image.BICUBIC)
        sheet.paste(tile, (c_i * cell + 4, r_i * cell + 22))
        label = key.replace("room_l5_img2_", "")
        d.text((c_i * cell + 8, r_i * cell + 24), label, fill=(220, 210, 190), font=font)
        d.text((c_i * cell + 8, r_i * cell + 38), "(textured atlas)", fill=(80, 200, 210), font=font_sm)

    # Atlas at bottom
    y0 = rows_assets * cell + 16
    atlas_disp = atlas.convert("RGB").resize((512, 512))
    sheet.paste(atlas_disp, (4, y0))
    d.text((4, y0 - 14), "Atlas 1024×1024 — 11 region cuts", fill=(180, 210, 215), font=font)

    # Region swatches beside atlas
    swatch_w = 90
    swatch_h = 70
    ids = list(regions.keys())
    pad = 6
    for j, rid in enumerate(ids):
        x_s, y_s, w_s, h_s = regions[rid]
        swatch = atlas.crop((x_s, y_s, x_s + w_s, y_s + h_s)).convert("RGB").resize((swatch_w, swatch_h))
        col_i = j % 3
        row_i = j // 3
        px2 = 524 + col_i * (swatch_w + pad)
        py2 = y0 + row_i * (swatch_h + 18)
        sheet.paste(swatch, (px2, py2))
        d.text((px2, py2 + swatch_h + 2), rid.replace("_", " "), fill=(160, 190, 200), font=font_sm)

    return sheet


# ==========================================================================
# Main
# ==========================================================================
def main():
    print("== Level 05 Reclamation Core — furniture Image2 pack ==")
    atlas, regions = build_atlas()
    print(f"atlas -> {ATLAS_PNG.relative_to(REPO)} ({ATLAS_PNG.stat().st_size} bytes), "
          f"{len(regions)} regions")

    manifest_assets = []
    audit = []
    scenes = []

    for model_key, builder, spec in ASSETS:
        scene, parts = builder(regions, atlas)

        if model_key in WALL_MOUNTS:
            size = finalize_wall(scene)
            mount_note = spec.get("mountNote", "Wall fixture: centre X/Z; y pivot at geometric centre.")
        else:
            size = finalize(scene)
            mount_note = None

        glb_path = GLB_DIR / f"{model_key}.glb"
        data = scene.export(file_type="glb")
        glb_path.write_bytes(data)
        nb = len(data)
        scenes.append((model_key, scene))

        # texture audit per node
        reloaded = trimesh.load(trimesh.util.wrap_as_stream(data), file_type="glb")
        mats_audit = []
        for gname, g in reloaded.geometry.items():
            m = getattr(g.visual, "material", None)
            mats_audit.append({
                "node": gname,
                "material": getattr(m, "name", None),
                "baseColorTexture": getattr(m, "baseColorTexture", None) is not None,
            })
        audit.append({
            "modelKey": model_key,
            "glb": str(glb_path.relative_to(REPO)),
            "bytes": nb,
            "parts": parts,
            "sizeMeters": size,
            **({"mountNote": mount_note} if mount_note else {}),
            "materials": mats_audit,
        })
        print(f"  {model_key:48s} {nb:7d} B  parts={parts:3d}  size={size}")

        entry = {
            "modelKey": model_key,
            "label": spec["label"],
            "assetKind": "furniture",
            "family": spec["family"],
            "group": GROUP,
            "source": SOURCE,
            "sourceAssetId": f"{model_key}_v1",
            "themeId": THEME,
            "glbFile": os.path.relpath(glb_path, MANIFEST.parent).replace(os.sep, "/"),
            "sizeMeters": size,
            "solid": spec.get("solid", True),
            "mount": spec.get("mount", "floor"),
            "canHoldSmallProps": spec.get("canHoldSmallProps", False),
            "clueCapacity": spec.get("clueCapacity", 0),
            "footprintFamily": spec["footprintFamily"],
            "tags": ["level:05", "theme:reclamation-core", "style:image2",
                     f"family:{spec['family']}"],
        }
        if "wallPreferred" in spec:
            entry["wallPreferred"] = spec["wallPreferred"]
        if mount_note:
            entry["mountNote"] = mount_note
        manifest_assets.append(entry)

    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_level05_furniture_image2_v1",
        "label": "Level 05 Reclamation Core",
        "sourceTool": "generate-level05-furniture-image2-assets.py",
        "generatedAt": "2026-06-13",
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
            "size": [ATLAS_SIZE, ATLAS_SIZE],
        },
        "assets": manifest_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"manifest -> {MANIFEST.relative_to(REPO)} ({len(manifest_assets)} assets)")

    (TMP_DIR / "glb-texture-audit.json").write_text(json.dumps(audit, indent=2) + "\n")

    # Evidence: contact sheet
    sheet = make_contact_sheet(scenes, atlas, regions)
    sheet_path = TMP_DIR / "level05-furniture-image2-contact-sheet.png"
    sheet.save(sheet_path)
    print(f"contact sheet -> {sheet_path.relative_to(REPO)}")

    # Beauty renders: core_memory_altar + archive_server_column
    for beauty_key in ("room_l5_img2_core_memory_altar", "room_l5_img2_archive_server_column"):
        for mk, sc in scenes:
            if mk == beauty_key:
                br = beauty_render(sc, size=512)
                label = beauty_key.replace("room_l5_img2_", "")
                br_path = TMP_DIR / f"level05-beauty-{label}.png"
                br.save(br_path)
                print(f"beauty render -> {br_path.relative_to(REPO)}")

    print(f"\nevidence -> {TMP_DIR.relative_to(REPO)}/")


if __name__ == "__main__":
    main()
