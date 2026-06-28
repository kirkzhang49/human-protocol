#!/usr/bin/env python3
"""Generate the Level 03 "Human Museum" furniture Image2 asset pack.

Self-contained, merge-safe candidate. Does NOT touch shared /build catalog or
registry files. It only writes Level 03-isolated paths:

  src/assets/textures/environment/level03-furniture-image2/image2-sources/*.png
  src/assets/textures/environment/level03-furniture-image2/hp_level03_furniture_image2_atlas.png
  src/assets/textures/environment/level03-furniture-image2/hp_level03_furniture_image2_atlas.regions.json
  src/assets/models-cooked/environment/level03-furniture-image2/*.glb
  src/assets/manifests/builder/hp_level03_furniture_image2_v1.json
  .tmp/level03-furniture-image2/*  (evidence: contact sheet + glb audit)

Pipeline (matches docs/human-protocol-puzzle-image2-assert-workflow.md):
  Image2 source PNGs (Pillow) -> packed atlas + regions.json
  -> math-owned trimesh geometry with named parts/materials, bevels, atlas UV
  -> GLB export (shared atlas image is de-duplicated by trimesh)
  -> manifest (measured bounds) + contact sheet + GLB texture audit.

No Blender / no network. Deterministic (fixed RNG seed).
Tools: Pillow, numpy, trimesh.
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
TEX_DIR = REPO / "src/assets/textures/environment/level03-furniture-image2"
SRC_DIR = TEX_DIR / "image2-sources"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level03-furniture-image2"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level03_furniture_image2_v1.json"
TMP_DIR = REPO / ".tmp/level03-furniture-image2"
ATLAS_PNG = TEX_DIR / "hp_level03_furniture_image2_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level03_furniture_image2_atlas.regions.json"

for d in (TEX_DIR, SRC_DIR, GLB_DIR, MANIFEST.parent, TMP_DIR):
    d.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(20260613)
ATLAS_SIZE = 1024

# --------------------------------------------------------------------------
# Palette (sampled to match the Level 03 museum board)
# --------------------------------------------------------------------------
ENAMEL_DARK = (12, 13, 16)
ENAMEL_LIT = (30, 33, 39)
GLASS_DARK = (10, 18, 21)
GLASS_LIT = (30, 47, 52)
BRASS_DARK = (78, 58, 27)
BRASS_LIT = (190, 150, 78)
BRASS_HI = (224, 192, 120)
CYAN = (60, 224, 255)
AMBER_DARK = (40, 24, 6)
AMBER_LIT = (214, 142, 38)
VELVET_DARK = (42, 10, 16)
VELVET_LIT = (96, 22, 30)
WOOD_DARK = (24, 19, 14)
WOOD_LIT = (46, 36, 26)


def _noise(w: int, h: int, scale: float) -> np.ndarray:
    """Smooth value noise in [-1, 1]."""
    small = RNG.standard_normal((max(2, int(h * scale)), max(2, int(w * scale))))
    img = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype("uint8"))
    img = img.resize((w, h), Image.BICUBIC).filter(ImageFilter.GaussianBlur(1.2))
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return arr * 2.0 - 1.0


def _vgrad(w: int, h: int, top, bottom) -> Image.Image:
    top = np.array(top, dtype=np.float32)
    bottom = np.array(bottom, dtype=np.float32)
    t = np.linspace(0.0, 1.0, h)[:, None, None]
    arr = (top[None, None, :] * (1 - t) + bottom[None, None, :] * t)
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


def _to_rgba(arr: np.ndarray, alpha=255) -> Image.Image:
    arr = np.clip(arr, 0, 255).astype("uint8")
    rgba = np.dstack([arr, np.full(arr.shape[:2], alpha, dtype="uint8")])
    return Image.fromarray(rgba, "RGBA")


# --------------------------------------------------------------------------
# Source tile painters -- each returns an RGBA tile and is saved to image2-sources
# --------------------------------------------------------------------------

def tile_black_enamel(w=320, h=320) -> Image.Image:
    base = _vgrad(w, h, ENAMEL_LIT, ENAMEL_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.08)[..., None] * 8
    # subtle panel seams + soft top sheen
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    for x in (w // 3, 2 * w // 3):
        d.line([(x, 0), (x, h)], fill=(6, 6, 8, 255), width=2)
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sheen)
    ds.ellipse([-w * 0.2, -h * 0.5, w * 1.2, h * 0.3], fill=(60, 66, 78, 40))
    img = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(14)))
    return img


def tile_smoked_glass(w=320, h=320) -> Image.Image:
    base = _vgrad(w, h, GLASS_LIT, GLASS_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.05)[..., None] * 6
    img = _to_rgba(arr, alpha=235)
    glare = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glare)
    dg.polygon([(w * 0.1, 0), (w * 0.32, 0), (w * 0.05, h), (-w * 0.18, h)], fill=(150, 180, 188, 46))
    dg.polygon([(w * 0.62, 0), (w * 0.72, 0), (w * 0.5, h), (w * 0.4, h)], fill=(120, 150, 160, 30))
    img = Image.alpha_composite(img, glare.filter(ImageFilter.GaussianBlur(6)))
    return img


def tile_amber_glass(w=320, h=320) -> Image.Image:
    base = _vgrad(w, h, AMBER_LIT, AMBER_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.06)[..., None] * 7
    img = _to_rgba(arr, alpha=240)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.ellipse([w * 0.2, h * 0.15, w * 0.8, h * 0.7], fill=(255, 196, 96, 70))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(22)))
    return img


def tile_aged_brass(w=656, h=80) -> Image.Image:
    base = _vgrad(w, h, BRASS_HI, BRASS_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    # vertical brushed streaks
    streak = _noise(w, h, 0.5)
    streak = np.asarray(Image.fromarray(((streak + 1) * 127).astype("uint8")).filter(
        ImageFilter.GaussianBlur(0.4)), dtype=np.float32) / 255.0 * 2 - 1
    arr += streak[..., None] * 14
    # patina speckle
    spk = (_noise(w, h, 0.3) > 0.65).astype(np.float32)
    arr[..., 1] -= spk * 20
    arr[..., 2] += spk * 8
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    d.line([(0, 2), (w, 2)], fill=(*BRASS_HI, 180), width=2)
    d.line([(0, h - 3), (w, h - 3)], fill=(40, 28, 12, 220), width=2)
    return img


def tile_cyan_scanner(w=240, h=60) -> Image.Image:
    img = Image.new("RGBA", (w, h), (6, 12, 14, 255))
    d = ImageDraw.Draw(img)
    for i in range(3):
        y = int(h * (0.25 + i * 0.25))
        d.line([(6, y), (w - 6, y)], fill=(*CYAN, 235), width=2)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glow)
    dg.rectangle([6, 6, w - 6, h - 6], fill=(*CYAN, 60))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(9)))
    return img


def tile_dark_velvet(w=400, h=104) -> Image.Image:
    base = _vgrad(w, h, VELVET_LIT, VELVET_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    nap = _noise(w, h, 0.4)
    arr += nap[..., None] * 16
    # soft horizontal nap rolls
    roll = (np.sin(np.linspace(0, math.pi * 3, h))[:, None] * 10)
    arr += roll[..., None]
    return _to_rgba(arr)


def tile_archive_drawer(w=320, h=200) -> Image.Image:
    base = _vgrad(w, h, WOOD_LIT, WOOD_DARK)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += _noise(w, h, 0.4)[..., None] * 7
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    rows = 3
    for r in range(rows):
        y0 = int(h * r / rows) + 3
        y1 = int(h * (r + 1) / rows) - 3
        d.rectangle([4, y0, w - 4, y1], outline=(10, 8, 6, 255), width=2)
        # brass pull
        cx = w // 2
        cy = (y0 + y1) // 2
        d.rectangle([cx - 26, cy - 5, cx + 26, cy + 5], fill=(*BRASS_LIT, 255))
        d.rectangle([cx - 26, cy - 5, cx + 26, cy + 5], outline=(40, 28, 12, 255), width=1)
    return img


def tile_glass_glare(w=320, h=200) -> Image.Image:
    img = Image.new("RGBA", (w, h), (4, 8, 10, 255))
    glare = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glare)
    dg.polygon([(w * 0.05, 0), (w * 0.3, 0), (w * 0.12, h), (-w * 0.1, h)], fill=(200, 222, 230, 120))
    dg.polygon([(w * 0.55, 0), (w * 0.66, 0), (w * 0.46, h), (w * 0.36, h)], fill=(150, 178, 190, 70))
    img = Image.alpha_composite(img, glare.filter(ImageFilter.GaussianBlur(5)))
    return img


def tile_dust_grime(w=320, h=200) -> Image.Image:
    img = Image.new("RGBA", (w, h), (10, 10, 11, 255))
    dust = (_noise(w, h, 0.25) > 0.5).astype(np.float32)
    dust += (_noise(w, h, 0.6) > 0.7).astype(np.float32) * 0.6
    arr = np.asarray(img.convert("RGB"), dtype=np.float32)
    arr += dust[..., None] * np.array([60, 58, 52])
    # heavier grime in the corners
    yy, xx = np.mgrid[0:h, 0:w]
    corner = ((xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2)
    arr += (corner[..., None]) * np.array([40, 38, 34])
    return _to_rgba(arr)


def tile_blank_plaque(w=320, h=200) -> Image.Image:
    base = _vgrad(w, h, (60, 62, 68), (28, 30, 34))
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    # brushed metal, NO text/labels
    streak = _noise(w, h, 0.6)
    arr += streak[..., None] * 10
    img = _to_rgba(arr)
    d = ImageDraw.Draw(img)
    d.rectangle([6, 6, w - 6, h - 6], outline=(*BRASS_LIT, 220), width=3)
    d.rectangle([14, 14, w - 14, h - 14], outline=(18, 18, 20, 200), width=1)
    return img


def tile_camera_lens(w=200, h=200) -> Image.Image:
    img = Image.new("RGBA", (w, h), (8, 8, 10, 255))
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    for r, col in ((92, (24, 24, 28)), (70, (14, 14, 16)), (50, (8, 10, 12))):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*col, 255), outline=(40, 40, 46, 255), width=2)
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=(6, 14, 18, 255))
    glint = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dg = ImageDraw.Draw(glint)
    dg.ellipse([cx - 14, cy - 18, cx + 6, cy + 2], fill=(*CYAN, 200))
    img = Image.alpha_composite(img, glint.filter(ImageFilter.GaussianBlur(4)))
    return img


# id -> (painter, rect[x,y,w,h]) ; rects hand-packed inside ATLAS_SIZE
TILES = {
    "black.enamel.plinth": (tile_black_enamel, (8, 8, 320, 320)),
    "smoked.display.glass": (tile_smoked_glass, (344, 8, 320, 320)),
    "amber.exhibit.glass": (tile_amber_glass, (680, 8, 320, 320)),
    "archive.drawer.front": (tile_archive_drawer, (8, 344, 320, 200)),
    "aged.brass.frame": (tile_aged_brass, (344, 344, 656, 80)),
    "dark.velvet.strip": (tile_dark_velvet, (344, 440, 400, 104)),
    "cyan.scanner.strip": (tile_cyan_scanner, (760, 440, 240, 60)),
    "glass.glare.mask": (tile_glass_glare, (8, 560, 320, 200)),
    "dust.grime.mask": (tile_dust_grime, (344, 560, 320, 200)),
    "blank.floor.plaque": (tile_blank_plaque, (680, 560, 320, 200)),
    "security.camera.lens": (tile_camera_lens, (8, 776, 200, 200)),
}


def build_atlas():
    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (6, 7, 9, 255))
    regions = {}
    for rid, (painter, (x, y, w, h)) in TILES.items():
        tile = painter(w, h)
        if tile.size != (w, h):
            tile = tile.resize((w, h), Image.BICUBIC)
        atlas.paste(tile, (x, y), tile)
        src_name = rid.replace(".", "_") + ".png"
        tile.save(SRC_DIR / src_name)
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
# UV + geometry helpers (math-owned bake)
# --------------------------------------------------------------------------

def uv_rect_from_region(region_id, regions, atlas_size=ATLAS_SIZE, padding_px=2):
    """Normalized (u0, v0, u1, v1). glTF + PIL share a top-left origin, so v is
    not flipped here; faces are wound so the tile reads upright."""
    x, y, w, h = regions[region_id]
    u0 = (x + padding_px) / atlas_size
    u1 = (x + w - padding_px) / atlas_size
    v0 = (y + padding_px) / atlas_size
    v1 = (y + h - padding_px) / atlas_size
    return u0, v0, u1, v1


def region_center_uv(region_id, regions, atlas_size=ATLAS_SIZE):
    x, y, w, h = regions[region_id]
    return ((x + w * 0.5) / atlas_size, (y + h * 0.5) / atlas_size)


def make_material(name, region_id, regions, atlas, *, metallic=0.4, rough=0.6,
                  alpha=255, emissive=None, double=False):
    mat = PBRMaterial(
        name=name,
        baseColorTexture=atlas,
        metallicFactor=float(metallic),
        roughnessFactor=float(rough),
        baseColorFactor=[255, 255, 255, alpha],
        doubleSided=bool(double),
    )
    if alpha < 255:
        mat.alphaMode = "BLEND"
    if emissive is not None:
        mat.emissiveFactor = [c / 255.0 for c in emissive]
    return mat


# box faces: name -> (axis, sign)
_FACES = (("px", 0, 1), ("nx", 0, -1), ("py", 1, 1),
          ("ny", 1, -1), ("pz", 2, 1), ("nz", 2, -1))


def face_box(extents, region_id, regions, atlas, mat, faces=None):
    """Clean box (24 verts) with each face UV-mapped onto `region_id`.
    `faces` restricts which faces receive the region (others get region center)."""
    hx, hy, hz = (e / 2.0 for e in extents)
    u0, v0, u1, v1 = uv_rect_from_region(region_id, regions)
    cu, cv = region_center_uv(region_id, regions)
    verts, uvs, tris = [], [], []
    only = set(faces) if faces else None
    for fname, axis, sign in _FACES:
        # two in-plane axes
        a1, a2 = [i for i in range(3) if i != axis]
        h = [hx, hy, hz]
        corners = []
        for s1, s2 in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = [0.0, 0.0, 0.0]
            p[axis] = sign * h[axis]
            p[a1] = s1 * h[a1]
            p[a2] = s2 * h[a2]
            corners.append(p)
        if only is None or fname in only:
            quad_uv = [(u0, v1), (u1, v1), (u1, v0), (u0, v0)]
        else:
            quad_uv = [(cu, cv)] * 4
        base = len(verts)
        verts.extend(corners)
        uvs.extend(quad_uv)
        # outward winding
        if sign > 0:
            tris.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        else:
            tris.extend([[base, base + 2, base + 1], [base, base + 3, base + 2]])
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(tris), process=False)
    mesh.visual = TextureVisuals(uv=np.array(uvs), material=mat, image=atlas)
    return mesh


def bevel_box(extents, region_id, regions, atlas, mat, bevel=0.02):
    """Chamfered box (convex hull) carrying a flat region color -- for frames,
    posts, legs, clamps where bevels matter more than precise tiling."""
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
    cu, cv = region_center_uv(region_id, regions)
    mesh.visual = TextureVisuals(uv=np.full((len(mesh.vertices), 2), [cu, cv]), material=mat, image=atlas)
    return mesh


def cyl(radius, height, region_id, regions, atlas, mat, sections=40, axis="y"):
    """Cylinder oriented along `axis` ('y' upright by default; trimesh builds
    along Z natively, so rotate to match)."""
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    # axis == "z": native, no rotation
    cu, cv = region_center_uv(region_id, regions)
    mesh.visual = TextureVisuals(uv=np.full((len(mesh.vertices), 2), [cu, cv]), material=mat, image=atlas)
    return mesh


def place(mesh, translate=(0, 0, 0)):
    mesh.apply_translation(translate)
    return mesh


# --------------------------------------------------------------------------
# Asset builders -- each returns (scene, parts_count). Parts carry named
# materials + node names. Geometry is centered on x/z and grounded (min y = 0).
# --------------------------------------------------------------------------

def _apply_vertex_translation(scene, tx, ty, tz):
    """Apply translation directly to vertex data of every geometry in the scene.

    scene.apply_translation() only updates scene-graph node matrices, which are
    NOT reflected in GLB accessor min/max (those record local vertex positions).
    This function bakes the offset into the vertices so the GLB audit reads the
    correct groundY / size values.
    """
    t = np.array([tx, ty, tz], dtype=np.float64)
    for geom in scene.geometry.values():
        if hasattr(geom, "vertices"):
            geom.vertices += t


def finalize(scene):
    """Center X/Z and ground the scene so minY == 0. Bakes into vertex data."""
    b = scene.bounds
    cx = (b[0][0] + b[1][0]) / 2
    cz = (b[0][2] + b[1][2]) / 2
    miny = b[0][1]
    _apply_vertex_translation(scene, -cx, -miny, -cz)
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(size[0]), 3), round(float(size[1]), 3), round(float(size[2]), 3)]


def finalize_wall(scene):
    """For wall-mounted assets: center X/Z but keep vertical pivot at the
    geometric centre of the frame (y=0 stays mid-height). This way the runtime
    can place the asset's origin at a sensible wall height and it won't be
    half-buried in the floor.  Still bakes the x/z shift into vertices."""
    b = scene.bounds
    cx = (b[0][0] + b[1][0]) / 2
    cz = (b[0][2] + b[1][2]) / 2
    # Do NOT shift y – wall pivot is already centred vertically by construction.
    _apply_vertex_translation(scene, -cx, 0.0, -cz)
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(size[0]), 3), round(float(size[1]), 3), round(float(size[2]), 3)]


def add(scene, mesh, name):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def build_display_plinth(regions, atlas):
    s = trimesh.Scene()
    enamel = make_material("enamel_plinth", "black.enamel.plinth", regions, atlas, metallic=0.2, rough=0.5)
    brass = make_material("brass_frame", "aged.brass.frame", regions, atlas, metallic=0.9, rough=0.35)
    glass = make_material("smoked_glass", "smoked.display.glass", regions, atlas, metallic=0.0, rough=0.08, alpha=140, double=True)
    glare = make_material("glass_glare", "glass.glare.mask", regions, atlas, metallic=0.0, rough=0.1, alpha=120, emissive=(60, 70, 74))
    cyan = make_material("base_scanner", "cyan.scanner.strip", regions, atlas, metallic=0.3, rough=0.3, emissive=CYAN)
    plaque = make_material("floor_plaque", "blank.floor.plaque", regions, atlas, metallic=0.7, rough=0.4)
    add(s, place(face_box((0.86, 0.62, 0.86), "black.enamel.plinth", regions, atlas, enamel), (0, 0.31, 0)), "plinth_base")
    add(s, place(face_box((0.9, 0.05, 0.9), "aged.brass.frame", regions, atlas, brass), (0, 0.64, 0)), "brass_cap")
    add(s, place(face_box((0.78, 0.02, 0.78), "blank.floor.plaque", regions, atlas, plaque, faces={"py"}), (0, 0.665, 0)), "label_plate")
    add(s, place(face_box((0.86, 0.025, 0.86), "cyan.scanner.strip", regions, atlas, cyan), (0, 0.6, 0)), "scanner_ring")
    # brass corner posts
    for i, (dx, dz) in enumerate(((0.39, 0.39), (-0.39, 0.39), (0.39, -0.39), (-0.39, -0.39))):
        add(s, place(bevel_box((0.05, 0.74, 0.05), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (dx, 1.06, dz)), f"post_{i}")
    # smoked glass vitrine
    add(s, place(face_box((0.8, 0.72, 0.8), "smoked.display.glass", regions, atlas, glass), (0, 1.06, 0)), "vitrine_glass")
    add(s, place(face_box((0.86, 0.05, 0.86), "aged.brass.frame", regions, atlas, brass), (0, 1.45, 0)), "vitrine_cap")
    # proud glare inlay on the front glass
    add(s, place(face_box((0.5, 0.5, 0.012), "glass.glare.mask", regions, atlas, glare, faces={"pz"}), (0, 1.08, 0.41)), "front_glare")
    return s, len(s.geometry)


def build_archive_card_cabinet(regions, atlas):
    s = trimesh.Scene()
    enamel = make_material("enamel_body", "black.enamel.plinth", regions, atlas, metallic=0.2, rough=0.5)
    brass = make_material("brass_trim", "aged.brass.frame", regions, atlas, metallic=0.9, rough=0.35)
    drawer = make_material("drawer_front", "archive.drawer.front", regions, atlas, metallic=0.3, rough=0.6)
    dust = make_material("top_dust", "dust.grime.mask", regions, atlas, metallic=0.1, rough=0.9)
    add(s, place(face_box((1.06, 1.42, 0.46), "black.enamel.plinth", regions, atlas, enamel), (0, 0.71, 0)), "cabinet_body")
    add(s, place(face_box((1.1, 0.06, 0.5), "aged.brass.frame", regions, atlas, brass), (0, 1.44, 0)), "cabinet_cap")
    add(s, place(face_box((1.0, 0.02, 0.44), "dust.grime.mask", regions, atlas, dust, faces={"py"}), (0, 1.46, 0)), "dust_layer")
    # 4 rows x 3 cols of drawer fronts (proud 2mm)
    cols, rows = 3, 4
    fw, fh = 0.3, 0.28
    for r in range(rows):
        for c in range(cols):
            x = (c - 1) * 0.34
            y = 0.28 + r * 0.32
            add(s, place(face_box((fw, fh, 0.03), "archive.drawer.front", regions, atlas, drawer, faces={"pz"}),
                         (x, y, 0.235)), f"drawer_{r}_{c}")
    # brass kick rail
    add(s, place(bevel_box((1.04, 0.06, 0.46), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0, 0.04, 0)), "kick_rail")
    return s, len(s.geometry)


def build_mural_lightbox(regions, atlas):
    """Wall-mounted backlit mural lightbox with brass frame.

    Wall-mount pivot: y=0 is the vertical centre of the frame.  The runtime
    places this at a sensible wall height (e.g. y=1.2m).  We use finalize_wall()
    which centres X/Z only and leaves y centred so groundY stays ≈ -0.54
    (half the frame height) — this is correct for a wall asset; it should NOT
    be grounded like a floor prop.

    Added volume vs. original: deeper backing box (0.10 instead of 0.06),
    thicker brass frame bars (0.12 × 0.12), corner boss rivets, deeper amber
    panel, visible cable conduit bracket at back.
    """
    s = trimesh.Scene()
    enamel = make_material("back_box", "black.enamel.plinth", regions, atlas, metallic=0.2, rough=0.6)
    brass = make_material("frame_brass", "aged.brass.frame", regions, atlas, metallic=0.9, rough=0.32)
    amber = make_material("amber_panel", "amber.exhibit.glass", regions, atlas, metallic=0.0, rough=0.2, alpha=235, emissive=AMBER_LIT)
    glass = make_material("front_smoked", "smoked.display.glass", regions, atlas, metallic=0.0, rough=0.1, alpha=120, double=True)
    glare = make_material("mural_glare", "glass.glare.mask", regions, atlas, metallic=0.0, rough=0.1, alpha=120, emissive=(50, 56, 60))

    # Backing box — deeper (z=0.10) for real 3-D read at 2-3 m
    add(s, face_box((1.58, 1.06, 0.10), "black.enamel.plinth", regions, atlas, enamel), "back_box")
    # Amber illuminated panel behind the smoked glass
    add(s, place(face_box((1.34, 0.88, 0.06), "amber.exhibit.glass", regions, atlas, amber, faces={"pz", "py", "ny", "px", "nx"}), (0, 0, 0.055)), "amber_glass")
    # Smoked glass front face
    add(s, place(face_box((1.38, 0.92, 0.02), "smoked.display.glass", regions, atlas, glass, faces={"pz"}), (0, 0, 0.095)), "front_glass")
    # Brass frame bars — thicker (0.12 × 0.12) to read as cast metal at distance
    add(s, place(bevel_box((1.62, 0.12, 0.12), "aged.brass.frame", regions, atlas, brass, bevel=0.024), (0, 0.49, 0.03)), "frame_top")
    add(s, place(bevel_box((1.62, 0.12, 0.12), "aged.brass.frame", regions, atlas, brass, bevel=0.024), (0, -0.49, 0.03)), "frame_bottom")
    add(s, place(bevel_box((0.12, 1.10, 0.12), "aged.brass.frame", regions, atlas, brass, bevel=0.024), (0.75, 0, 0.03)), "frame_left")
    add(s, place(bevel_box((0.12, 1.10, 0.12), "aged.brass.frame", regions, atlas, brass, bevel=0.024), (-0.75, 0, 0.03)), "frame_right")
    # Corner boss rivets (4 corners) — brass spheroids for detail at close range
    for ri, (bx, by) in enumerate(((0.72, 0.47), (-0.72, 0.47), (0.72, -0.47), (-0.72, -0.47))):
        boss = trimesh.creation.icosphere(radius=0.042, subdivisions=2)
        boss.apply_translation((bx, by, 0.092))
        cu, cv = region_center_uv("aged.brass.frame", regions)
        boss.visual = TextureVisuals(uv=np.full((len(boss.vertices), 2), [cu, cv]),
                                     material=brass, image=atlas)
        add(s, boss, f"rivet_{ri}")
    # Glare streak on the glass
    add(s, place(face_box((0.42, 0.72, 0.01), "glass.glare.mask", regions, atlas, glare, faces={"pz"}), (-0.28, 0.04, 0.108)), "glare_streak")
    # Wall mounting bracket / cable conduit box at the back
    add(s, place(bevel_box((0.24, 0.06, 0.08), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0, 0.40, -0.09)), "bracket_top")
    add(s, place(bevel_box((0.24, 0.06, 0.08), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0, -0.40, -0.09)), "bracket_bottom")
    return s, len(s.geometry)


def build_specimen_bench(regions, atlas):
    """Museum specimen bench with velvet cushion and brass legs.

    Geometry is placed so minY == 0 (legs bottom at floor), no finalize shift
    needed for y. Layout:
      legs:    h=0.40, centre y=0.20  => y 0.00 – 0.40
      seat:    h=0.14, centre y=0.47  => y 0.40 – 0.54  (sits on leg tops)
      seam:    h=0.03, centre y=0.48  => y 0.465 – 0.495
      cushion: h=0.10, centre y=0.57  => y 0.52 – 0.62
      back-rail added for volume/silhouette
    """
    s = trimesh.Scene()
    enamel = make_material("bench_base", "black.enamel.plinth", regions, atlas, metallic=0.2, rough=0.5)
    brass = make_material("bench_brass", "aged.brass.frame", regions, atlas, metallic=0.9, rough=0.35)
    velvet = make_material("bench_velvet", "dark.velvet.strip", regions, atlas, metallic=0.0, rough=0.95)
    # Legs first — bottom at y=0, top at y=0.40
    for i, (dx, dz) in enumerate(((0.78, 0.22), (-0.78, 0.22), (0.78, -0.22), (-0.78, -0.22))):
        add(s, place(bevel_box((0.08, 0.40, 0.08), "aged.brass.frame", regions, atlas, brass, bevel=0.016), (dx, 0.20, dz)), f"leg_{i}")
    # Cross stretchers between legs at mid-height for visual depth
    add(s, place(bevel_box((1.56, 0.06, 0.06), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0, 0.18, 0.22)), "stretcher_front")
    add(s, place(bevel_box((1.56, 0.06, 0.06), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0, 0.18, -0.22)), "stretcher_back")
    # Seat frame: sits on top of legs
    add(s, place(face_box((1.74, 0.14, 0.56), "black.enamel.plinth", regions, atlas, enamel), (0, 0.47, 0)), "seat_frame")
    # Brass seam at seat top edge
    add(s, place(face_box((1.74, 0.03, 0.56), "aged.brass.frame", regions, atlas, brass), (0, 0.545, 0)), "brass_seam")
    # Velvet cushion on top
    add(s, place(face_box((1.62, 0.10, 0.50), "dark.velvet.strip", regions, atlas, velvet), (0, 0.615, 0)), "velvet_cushion")
    # Low back rail (gives the bench a gallery reading silhouette)
    add(s, place(bevel_box((1.68, 0.08, 0.06), "aged.brass.frame", regions, atlas, brass, bevel=0.016), (0, 0.70, -0.25)), "back_rail")
    add(s, place(bevel_box((0.06, 0.28, 0.06), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (-0.80, 0.54, -0.25)), "back_post_l")
    add(s, place(bevel_box((0.06, 0.28, 0.06), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0.80, 0.54, -0.25)), "back_post_r")
    return s, len(s.geometry)


def build_queue_rail(regions, atlas):
    s = trimesh.Scene()
    enamel = make_material("rail_base", "black.enamel.plinth", regions, atlas, metallic=0.2, rough=0.5)
    brass = make_material("rail_brass", "aged.brass.frame", regions, atlas, metallic=0.95, rough=0.3)
    velvet = make_material("rail_velvet", "dark.velvet.strip", regions, atlas, metallic=0.0, rough=0.95)
    for i, x in enumerate((-0.7, 0.7)):
        add(s, place(cyl(0.13, 0.04, "black.enamel.plinth", regions, atlas, enamel), (x, 0.02, 0)), f"base_{i}")
        add(s, place(cyl(0.025, 0.9, "aged.brass.frame", regions, atlas, brass), (x, 0.47, 0)), f"post_{i}")
        add(s, place(bevel_box((0.09, 0.09, 0.09), "aged.brass.frame", regions, atlas, brass, bevel=0.02), (x, 0.95, 0)), f"finial_{i}")
    # sagging velvet rope (slight catenary via three segments)
    seg = [(-0.46, 0.78), (0.0, 0.7), (0.46, 0.78)]
    for i, (x, y) in enumerate(seg):
        add(s, place(bevel_box((0.5, 0.05, 0.05), "dark.velvet.strip", regions, atlas, velvet, bevel=0.02), (x, y, 0)), f"rope_{i}")
    return s, len(s.geometry)


def build_evidence_round_table(regions, atlas):
    s = trimesh.Scene()
    enamel = make_material("table_body", "black.enamel.plinth", regions, atlas, metallic=0.25, rough=0.5)
    brass = make_material("table_brass", "aged.brass.frame", regions, atlas, metallic=0.92, rough=0.32)
    glass = make_material("table_glass", "smoked.display.glass", regions, atlas, metallic=0.0, rough=0.1, alpha=150, double=True)
    cyan = make_material("table_scanner", "cyan.scanner.strip", regions, atlas, metallic=0.3, rough=0.3, emissive=CYAN)
    add(s, place(cyl(0.5, 0.06, "black.enamel.plinth", regions, atlas, enamel), (0, 0.72, 0)), "table_top")
    add(s, place(cyl(0.46, 0.02, "smoked.display.glass", regions, atlas, glass), (0, 0.76, 0)), "glass_inset")
    add(s, place(cyl(0.5, 0.025, "cyan.scanner.strip", regions, atlas, cyan), (0, 0.69, 0)), "scanner_rim")
    add(s, place(cyl(0.52, 0.03, "aged.brass.frame", regions, atlas, brass), (0, 0.66, 0)), "brass_rim")
    add(s, place(cyl(0.1, 0.66, "black.enamel.plinth", regions, atlas, enamel), (0, 0.33, 0)), "column")
    add(s, place(cyl(0.28, 0.04, "aged.brass.frame", regions, atlas, brass), (0, 0.02, 0)), "foot")
    return s, len(s.geometry)


def build_label_terminal(regions, atlas):
    """Floor-standing label terminal with angled display head.

    Pedestal placed with bottom at y=0 (centre at y=0.46). All upper parts
    built relative to the grounded pedestal so finalize() only needs to centre
    X/Z and the groundY accessor will read 0.
    """
    s = trimesh.Scene()
    enamel = make_material("term_body", "black.enamel.plinth", regions, atlas, metallic=0.25, rough=0.5)
    brass = make_material("term_brass", "aged.brass.frame", regions, atlas, metallic=0.92, rough=0.32)
    cyan = make_material("term_scanner", "cyan.scanner.strip", regions, atlas, metallic=0.3, rough=0.3, emissive=CYAN)
    amber = make_material("term_amber", "amber.exhibit.glass", regions, atlas, metallic=0.0, rough=0.2, alpha=235, emissive=AMBER_LIT)
    plaque = make_material("term_plaque", "blank.floor.plaque", regions, atlas, metallic=0.7, rough=0.4)
    lens = make_material("term_lens", "security.camera.lens", regions, atlas, metallic=0.4, rough=0.3, emissive=(20, 80, 96))

    # Pedestal: h=0.92, centre y=0.46 => bottom at y=0, top at y=0.92
    add(s, place(face_box((0.46, 0.92, 0.46), "black.enamel.plinth", regions, atlas, enamel), (0, 0.46, 0)), "pedestal")
    # Grounding foot / base plate — flush with floor, wider than pedestal
    add(s, place(bevel_box((0.52, 0.04, 0.52), "aged.brass.frame", regions, atlas, brass, bevel=0.012), (0, 0.02, 0)), "base_plate")
    # Brass collar at pedestal top
    add(s, place(face_box((0.5, 0.05, 0.5), "aged.brass.frame", regions, atlas, brass), (0, 0.945, 0)), "collar")
    # Neck stub before head
    add(s, place(bevel_box((0.18, 0.14, 0.18), "black.enamel.plinth", regions, atlas, enamel, bevel=0.02), (0, 1.04, 0)), "neck")
    # Angled head: thickened slab (0.16 deep instead of 0.10) for real volume
    head = face_box((0.46, 0.32, 0.16), "black.enamel.plinth", regions, atlas, enamel)
    head.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-28), (1, 0, 0)))
    add(s, place(head, (0, 1.08, 0.04)), "head")
    # Label panel inlaid into head face
    panel = face_box((0.36, 0.22, 0.014), "blank.floor.plaque", regions, atlas, plaque, faces={"pz"})
    panel.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-28), (1, 0, 0)))
    add(s, place(panel, (0, 1.09, 0.12)), "label_panel")
    # Cyan scanner strip across the top of the head
    strip = face_box((0.40, 0.03, 0.014), "cyan.scanner.strip", regions, atlas, cyan, faces={"pz"})
    strip.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-28), (1, 0, 0)))
    add(s, place(strip, (0, 1.20, 0.15)), "scanner_strip")
    # Amber status bar below the panel
    amberbar = face_box((0.40, 0.03, 0.014), "amber.exhibit.glass", regions, atlas, amber, faces={"pz"})
    amberbar.apply_transform(trimesh.transformations.rotation_matrix(math.radians(-28), (1, 0, 0)))
    add(s, place(amberbar, (0, 0.99, 0.06)), "amber_bar")
    # Camera lens nub on the corner
    add(s, place(cyl(0.05, 0.06, "security.camera.lens", regions, atlas, lens, axis="z"), (0.16, 1.22, 0.16)), "camera_lens")
    return s, len(s.geometry)


def build_preservation_case(regions, atlas):
    """Tall preservation / specimen display case with smoked glass vitrine.

    Pedestal base placed with bottom at y=0 (centre y=0.25). All upper parts
    stacked relative to this so finalize() groundY accessor reads 0.

    Added volume: wider base moulding, thicker brass corner clamps, visible
    amber exhibit-glow core, heavier top cap with dust film. The glass column
    is a proper 3-D vitrine shell (not a pane) using double-sided alpha glass.
    """
    s = trimesh.Scene()
    enamel = make_material("case_base", "black.enamel.plinth", regions, atlas, metallic=0.2, rough=0.5)
    brass = make_material("case_brass", "aged.brass.frame", regions, atlas, metallic=0.92, rough=0.32)
    glass = make_material("case_glass", "smoked.display.glass", regions, atlas, metallic=0.0, rough=0.08, alpha=130, double=True)
    amber = make_material("case_amber", "amber.exhibit.glass", regions, atlas, metallic=0.0, rough=0.2, alpha=220, emissive=AMBER_LIT)
    dust = make_material("case_dust", "dust.grime.mask", regions, atlas, metallic=0.1, rough=0.9)

    # ---- Base plinth: h=0.50, bottom at y=0, centre y=0.25 ----
    add(s, place(face_box((0.78, 0.50, 0.78), "black.enamel.plinth", regions, atlas, enamel), (0, 0.25, 0)), "case_base")
    # Wide brass moulding / footing that extends beyond the base for contact shadow
    add(s, place(bevel_box((0.88, 0.06, 0.88), "aged.brass.frame", regions, atlas, brass, bevel=0.018), (0, 0.03, 0)), "base_foot")
    # Brass cap at top of base plinth
    add(s, place(face_box((0.82, 0.06, 0.82), "aged.brass.frame", regions, atlas, brass), (0, 0.53, 0)), "base_cap")

    # ---- Smoked glass vitrine column: h=1.10, centre y=1.11, range 0.56–1.66 ----
    add(s, place(face_box((0.68, 1.10, 0.68), "smoked.display.glass", regions, atlas, glass), (0, 1.11, 0)), "glass_column")

    # ---- Specimen / amber glow core inside the vitrine ----
    # Inner amber box (visible through glass) + extra glow ring
    add(s, place(face_box((0.32, 0.88, 0.32), "amber.exhibit.glass", regions, atlas, amber), (0, 1.10, 0)), "specimen_glow")
    add(s, place(cyl(0.28, 0.06, "amber.exhibit.glass", regions, atlas, amber), (0, 1.00, 0)), "glow_base_ring")
    add(s, place(cyl(0.28, 0.06, "amber.exhibit.glass", regions, atlas, amber), (0, 1.60, 0)), "glow_top_ring")

    # ---- Top cap with dust film ----
    add(s, place(face_box((0.82, 0.08, 0.82), "aged.brass.frame", regions, atlas, brass), (0, 1.70, 0)), "top_cap")
    add(s, place(face_box((0.70, 0.02, 0.70), "dust.grime.mask", regions, atlas, dust, faces={"py"}), (0, 1.745, 0)), "dust_film")

    # ---- Brass corner clamps — thick enough to read as structural members ----
    for i, (dx, dz) in enumerate(((0.32, 0.32), (-0.32, 0.32), (0.32, -0.32), (-0.32, -0.32))):
        # Full-height clamp rail
        add(s, place(bevel_box((0.10, 1.06, 0.10), "aged.brass.frame", regions, atlas, brass, bevel=0.018),
                     (dx, 1.11, dz)), f"clamp_{i}")
        # Clamp head knuckle
        add(s, place(bevel_box((0.16, 0.08, 0.16), "aged.brass.frame", regions, atlas, brass, bevel=0.024),
                     (dx, 1.60, dz)), f"clamp_head_{i}")
        # Lower clamp foot
        add(s, place(bevel_box((0.14, 0.06, 0.14), "aged.brass.frame", regions, atlas, brass, bevel=0.018),
                     (dx, 0.58, dz)), f"clamp_foot_{i}")
    return s, len(s.geometry)


# modelKey -> (builder, manifest spec)
ASSETS = [
    ("room_l3_img2_display_plinth", build_display_plinth, dict(
        label="展柜基座", family="display_case", footprintFamily="display_case",
        mount="floor", clueCapacity=2, canHoldSmallProps=True)),
    ("room_l3_img2_archive_card_cabinet", build_archive_card_cabinet, dict(
        label="档案卡片柜", family="drawer_chest", footprintFamily="cabinet",
        mount="floor", clueCapacity=3, canHoldSmallProps=True)),
    ("room_l3_img2_mural_lightbox", build_mural_lightbox, dict(
        label="壁画灯箱", family="wall_panel_or_picture_frame", footprintFamily="wall_panel",
        mount="wall", wallPreferred="back", clueCapacity=1, canHoldSmallProps=False)),
    ("room_l3_img2_specimen_bench", build_specimen_bench, dict(
        label="标本长凳", family="sofa_bench", footprintFamily="sofa",
        mount="floor", clueCapacity=0, canHoldSmallProps=False)),
    ("room_l3_img2_queue_rail", build_queue_rail, dict(
        label="参观栏杆", family="wall_panel_or_picture_frame", footprintFamily="barrier",
        mount="floor", clueCapacity=0, canHoldSmallProps=False)),
    ("room_l3_img2_evidence_round_table", build_evidence_round_table, dict(
        label="证物圆桌", family="desk", footprintFamily="table",
        mount="floor", clueCapacity=2, canHoldSmallProps=True)),
    ("room_l3_img2_label_terminal", build_label_terminal, dict(
        label="展签终端", family="control_console", footprintFamily="pedestal",
        mount="floor", clueCapacity=1, canHoldSmallProps=False)),
    ("room_l3_img2_preservation_case", build_preservation_case, dict(
        label="保存柜", family="display_case", footprintFamily="display_case",
        mount="floor", clueCapacity=2, canHoldSmallProps=True)),
]

GROUP = "博物馆"
SOURCE = "level03-image2-furniture"
THEME = "hp_museum_smoked_glass"


def main():
    print("== Level 03 furniture Image2 pack ==")
    atlas, regions = build_atlas()
    print(f"atlas -> {ATLAS_PNG.relative_to(REPO)} ({ATLAS_PNG.stat().st_size} bytes), {len(regions)} regions")

    # Assets that use wall-pivot finalise (vertical centre stays at y=0)
    WALL_MOUNTS = {"room_l3_img2_mural_lightbox"}

    manifest_assets = []
    audit = []
    for model_key, builder, spec in ASSETS:
        scene, parts = builder(regions, atlas)
        if model_key in WALL_MOUNTS:
            size = finalize_wall(scene)
        else:
            size = finalize(scene)
        glb_path = GLB_DIR / f"{model_key}.glb"
        data = scene.export(file_type="glb")
        glb_path.write_bytes(data)

        # texture audit: reload + list materials with baseColorTexture
        reloaded = trimesh.load(trimesh.util.wrap_as_stream(data), file_type="glb")
        mats = []
        for gname, g in reloaded.geometry.items():
            m = getattr(g.visual, "material", None)
            mats.append({
                "node": gname,
                "material": getattr(m, "name", None),
                "baseColorTexture": getattr(m, "baseColorTexture", None) is not None,
            })
        audit.append({
            "modelKey": model_key,
            "glb": str(glb_path.relative_to(REPO)),
            "bytes": len(data),
            "parts": parts,
            "sizeMeters": size,
            "materials": mats,
        })
        print(f"  {model_key:34s} {len(data):7d} B  parts={parts:2d}  size={size}")

        manifest_assets.append({
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
            "solid": True,
            "mount": spec.get("mount", "floor"),
            **({"wallPreferred": spec["wallPreferred"]} if "wallPreferred" in spec else {}),
            "canHoldSmallProps": spec.get("canHoldSmallProps", False),
            "clueCapacity": spec.get("clueCapacity", 0),
            "footprintFamily": spec["footprintFamily"],
            "tags": ["level:03", "theme:human-museum", "style:image2", f"family:{spec['family']}"],
        })

    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_level03_furniture_image2_v1",
        "label": "HP 第三关 人类博物馆家具包 (Image2)",
        "sourceTool": "generate-level03-furniture-image2-assets.py",
        "generatedAt": "2026-06-13",
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
            "size": [ATLAS_SIZE, ATLAS_SIZE],
        },
        "assets": manifest_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"manifest -> {MANIFEST.relative_to(REPO)} ({len(manifest_assets)} assets)")

    (TMP_DIR / "glb-texture-audit.json").write_text(json.dumps(audit, indent=2) + "\n")

    # contact sheet: atlas + labeled region swatches
    make_contact_sheet(atlas, regions)
    print(f"evidence -> {TMP_DIR.relative_to(REPO)}/")


def make_contact_sheet(atlas, regions):
    from PIL import ImageFont
    pad = 24
    cols = 4
    sw = 150
    ids = list(regions.keys())
    rows = (len(ids) + cols - 1) // cols
    sheet_w = max(ATLAS_SIZE // 2 + pad * 3 + cols * 40, cols * (sw + pad) + pad)
    atlas_disp = atlas.convert("RGB").resize((512, 512))
    grid_h = rows * (sw + 28) + pad
    sheet = Image.new("RGB", (max(sheet_w, 512 + pad * 2), 512 + grid_h + pad * 3), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    d.text((pad, 8), "Level 03 Human Museum — Image2 atlas (1024) + region swatches", fill=(220, 220, 220), font=font)
    sheet.paste(atlas_disp, (pad, 28))
    y0 = 28 + 512 + pad
    for i, rid in enumerate(ids):
        r = i // cols
        c = i % cols
        x, y, w, h = regions[rid]
        swatch = atlas.crop((x, y, x + w, y + h)).convert("RGB").resize((sw, sw))
        px = pad + c * (sw + pad)
        py = y0 + r * (sw + 28)
        sheet.paste(swatch, (px, py))
        d.text((px, py + sw + 4), rid, fill=(200, 210, 215), font=font)
    out = TMP_DIR / "level03-image2-contact-sheet.png"
    sheet.save(out)
    print(f"contact sheet -> {out.relative_to(REPO)} ({out.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
