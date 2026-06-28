#!/usr/bin/env python3
"""Human Protocol — Level 06-10 hero machine generator (vertical slice batch 01).

Produces 3 hero interactive machines as merge-safe trimesh GLBs + a shared body
atlas, then writes an hp.builder.assetPack.v1 manifest. Follows the exact same
pure-Python (trimesh + numpy + PIL, NO Blender) pipeline as the Level 01-05
furniture-image2 generators.

Hero assets (driven by docs/human-protocol-door-wall-art-system.md + asset-agent
rules + the Level 06-10 GUI/asset draft pack):
  1. room_l610_hero_route_switch_console      (Level 07 transit switchyard main puzzle)
  2. room_l610_hero_lockdown_override_console  (Level 09 containment maintenance main puzzle)
  3. room_l610_hero_final_protocol_console     (Level 10 core terminal final puzzle)

Each carries a real Image2 GUI panel baked onto its console screen face — the
composed background_image2.png from src/assets/gui/level0{7,9,10}/. The matching
parts_image2.png + *.regions.json (state slices: locked/active/solved/disabled/
danger/choice) stay available for runtime state-layer swapping; NO gameplay text
or puzzle answer is baked into any texture.

Run:  python3 scripts/asset-build/generate-level06-10-hero-assets.py
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

# --- Paths -------------------------------------------------------------------
REPO = Path(__file__).resolve().parents[2]
PACK_DIR_NAME = "level06-10-hero"
TEX_DIR = REPO / "src/assets/textures/environment/level06-10-hero"
SRC_DIR = TEX_DIR / "image2-sources"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level06-10-hero"
ATLAS_PNG = TEX_DIR / "hp_level06_10_hero_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level06_10_hero_atlas.regions.json"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level06_10_hero_v1.json"
TMP_DIR = REPO / ".tmp/level06-10-hero-assets"
GUI_DIR = REPO / "src/assets/gui"

for d in (TEX_DIR, SRC_DIR, GLB_DIR, MANIFEST.parent, TMP_DIR):
    d.mkdir(parents=True, exist_ok=True)

ATLAS_SIZE = 640  # per-asset atlas; each GLB embeds only its own screen + body tiles
SCREEN_H = ATLAS_SIZE * 9 // 16  # 16:9 GUI panel baked full-width at the top

# --- Pack metadata -----------------------------------------------------------
GROUP = "赛博"  # existing BuilderPropGroup — no group-plumbing change needed
SOURCE = "level06-10-hero-image2"
THEME = "hp_level06_10_hero"
PACK_ID = "hp_level06_10_hero_v1"
PACK_LABEL = "Level 06-10 Hero Machines"

# --- Palette (Human Protocol facility language) ------------------------------
GRAPHITE = (44, 49, 56)
GRAPHITE_HI = (78, 86, 96)
ENAMEL = (198, 204, 212)
ENAMEL_HI = (228, 232, 238)
CHROME = (158, 166, 178)
CHROME_HI = (204, 212, 222)
BLACK_GLASS = (14, 16, 20)
STEEL = (120, 128, 138)
BRASS = (150, 116, 60)
AMBER = (214, 150, 46)
AMBER_HI = (255, 196, 96)
RED = (188, 40, 34)
RED_HI = (236, 58, 46)
CYAN = (60, 214, 232)
CYAN_HI = (150, 244, 255)
CYAN_DIM = (30, 120, 132)
WARN = (224, 168, 48)


# --- PIL tile helpers --------------------------------------------------------
def _noise(w, h, base, amp=14, seed=0):
    rng = np.random.default_rng(seed)
    n = rng.normal(0, amp, (h, w, 3))
    arr = np.clip(np.array(base, dtype=np.float64)[None, None, :] + n, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def _vgrad(w, h, top, bot):
    arr = np.zeros((h, w, 3), dtype=np.float64)
    for y in range(h):
        t = y / max(1, h - 1)
        arr[y, :, :] = np.array(top) * (1 - t) + np.array(bot) * t
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def tile_metal(base, hi, seed):
    def painter(w, h):
        img = _vgrad(w, h, hi, base)
        img.alpha_composite(_noise(w, h, base, amp=10, seed=seed).point(lambda p: int(p * 0.35)) if False else _noise(w, h, base, amp=9, seed=seed))
        d = ImageDraw.Draw(img)
        for x in range(0, w, max(8, w // 10)):
            d.line([(x, 0), (x, h)], fill=(*hi, 26), width=1)
        return img
    return painter


def tile_glass(base, seed):
    def painter(w, h):
        img = _vgrad(w, h, base, (max(0, base[0] - 6), max(0, base[1] - 6), max(0, base[2] - 6)))
        d = ImageDraw.Draw(img)
        d.line([(int(w * 0.18), 0), (int(w * 0.34), h)], fill=(120, 150, 170, 40), width=max(2, w // 60))
        return img.filter(ImageFilter.GaussianBlur(0.6))
    return painter


def tile_strip(col, seed):
    def painter(w, h):
        img = _vgrad(w, h, tuple(int(c * 0.4) for c in col), col)
        d = ImageDraw.Draw(img)
        d.rectangle([2, int(h * 0.35), w - 2, int(h * 0.65)], fill=(*[min(255, int(c * 1.2)) for c in col], 255))
        return img.filter(ImageFilter.GaussianBlur(0.5))
    return painter


def tile_lamp(col):
    def painter(w, h):
        img = Image.new("RGBA", (w, h), (8, 9, 11, 255))
        d = ImageDraw.Draw(img)
        cx, cy = w / 2, h / 2
        # Saturated coloured lens: stays the lamp's colour (no white blow-out),
        # darkening toward the rim, with a tiny bright core.
        for r in range(min(w, h) // 2, 0, -1):
            t = r / (min(w, h) / 2)
            c = tuple(int(min(255, col[i] * (0.55 + 0.45 * (1 - t)))) for i in range(3))
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*c, 255))
        # Saturated core = the lamp's own colour (no white blow-out / cream cast).
        cr = max(2, min(w, h) // 6)
        d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(*col, 255))
        return img
    return painter


def tile_hazard(col):
    def painter(w, h):
        img = Image.new("RGBA", (w, h), (16, 16, 18, 255))
        d = ImageDraw.Draw(img)
        step = max(10, w // 8)
        for i in range(-h, w, step):
            d.polygon([(i, 0), (i + step // 2, 0), (i + step // 2 + h, h), (i + h, h)], fill=(*col, 255))
        return img
    return painter


def tile_wear(seed):
    def painter(w, h):
        img = _noise(w, h, (40, 42, 46), amp=16, seed=seed)
        d = ImageDraw.Draw(img)
        rng = np.random.default_rng(seed + 7)
        for _ in range(18):
            x, y = rng.integers(0, w), rng.integers(0, h)
            d.line([(x, y), (x + rng.integers(-12, 12), y + rng.integers(-4, 4))], fill=(90, 94, 100, 120), width=1)
        return img
    return painter


def tile_warning(seed):
    def painter(w, h):
        # Red/amber hazard plate so a warning decal reads as danger, not khaki.
        img = Image.new("RGBA", (w, h), (84, 24, 18, 255))
        dd = ImageDraw.Draw(img)
        step = max(8, w // 7)
        for i in range(-h, w, step * 2):
            dd.polygon([(i, 0), (i + step, 0), (i + step + h, h), (i + h, h)], fill=(212, 150, 40, 255))
        d = ImageDraw.Draw(img)
        cx = w // 2
        d.polygon([(cx, int(h * 0.2)), (int(w * 0.78), int(h * 0.78)), (int(w * 0.22), int(h * 0.78))],
                  outline=(*AMBER_HI, 255), width=max(2, w // 40))
        d.rectangle([cx - max(2, w // 40), int(h * 0.36), cx + max(2, w // 40), int(h * 0.6)], fill=(*AMBER_HI, 255))
        d.ellipse([cx - max(2, w // 40), int(h * 0.64), cx + max(2, w // 40), int(h * 0.7)], fill=(*AMBER_HI, 255))
        return img
    return painter


# --- Atlas layout: per-asset 1024 atlas = one baked GUI screen + body tiles --
# Each hero console gets its OWN atlas: the composed Image2 GUI panel
# (background_image2.png) is baked full-width at the top so the in-world console
# screen shows real panel art; procedural body tiles fill the strip below. The
# matching parts_image2.png + *.regions.json keep the locked/active/solved/...
# state slices for runtime layer swapping (not baked here).
BODY_TILES = {
    "graphite": tile_metal(GRAPHITE, GRAPHITE_HI, 1),
    "black_glass": tile_glass((22, 26, 32), 2),
    "steel": tile_metal((116, 124, 136), (178, 186, 198), 3),
    "brass": tile_metal((128, 98, 44), (196, 158, 92), 4),
    "amber_panel": tile_metal((122, 86, 30), AMBER_HI, 5),
    "red_panel": tile_metal((104, 30, 26), (218, 76, 62), 6),
    "enamel": tile_metal(ENAMEL, ENAMEL_HI, 13),
    "chrome": tile_metal(CHROME, CHROME_HI, 14),
    "cyan_strip": tile_strip(CYAN, 7),
    "amber_strip": tile_strip(AMBER, 8),
    "red_strip": tile_strip(RED_HI, 9),
    "lamp_cyan": tile_lamp(CYAN),
    "lamp_amber": tile_lamp(AMBER_HI),
    "lamp_red": tile_lamp(RED_HI),
    "hazard_amber": tile_hazard(AMBER),
    "hazard_red": tile_hazard(RED_HI),
    "edge_wear": tile_wear(11),
    "warning": tile_warning(12),
}


def build_asset_atlas(short, gui_bg_path, save_sources=False):
    """Build a 640 atlas for one hero asset: the GUI panel baked full-width at
    the top (region id "screen"), procedural body tiles below. When
    gui_bg_path is None the asset has no console screen — the whole atlas is
    body tiles (larger, for more body detail)."""
    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (*GRAPHITE, 255))
    regions = {}

    if gui_bg_path is not None:
        gui = Image.open(gui_bg_path).convert("RGBA").resize((ATLAS_SIZE, SCREEN_H), Image.LANCZOS)
        atlas.alpha_composite(gui, (0, 0))
        regions["screen"] = [0, 0, ATLAS_SIZE, SCREEN_H]
        tile = 64
        cursor_x, cursor_y = 0, SCREEN_H + 8
    else:
        tile = 96
        cursor_x, cursor_y = 0, 0
    for rid, painter in BODY_TILES.items():
        if cursor_x + tile > ATLAS_SIZE:
            cursor_x = 0
            cursor_y += tile
        img = painter(tile, tile)
        atlas.alpha_composite(img, (cursor_x, cursor_y))
        regions[rid] = [cursor_x, cursor_y, tile, tile]
        if save_sources:
            img.save(SRC_DIR / f"{rid}.png")
        cursor_x += tile

    # The GUI panel + body tiles are fully opaque — embed as RGB to keep GLBs lean.
    atlas = atlas.convert("RGB")
    atlas_path = TEX_DIR / f"hp_level06_10_hero_{short}_atlas.png"
    atlas.save(atlas_path, optimize=True)
    return atlas, regions, atlas_path


# --- UV / geometry helpers (mirrors level05 generator) -----------------------
_FACE_SPECS = (
    ("px", 0, 1), ("nx", 0, -1),
    ("py", 1, 1), ("ny", 1, -1),
    ("pz", 2, 1), ("nz", 2, -1),
)


def _uv_rect(region_id, regions, pad=2):
    x, y, w, h = regions[region_id]
    return ((x + pad) / ATLAS_SIZE, (y + pad) / ATLAS_SIZE,
            (x + w - pad) / ATLAS_SIZE, (y + h - pad) / ATLAS_SIZE)


def _uv_center(region_id, regions):
    x, y, w, h = regions[region_id]
    return (x + w * 0.5) / ATLAS_SIZE, (y + h * 0.5) / ATLAS_SIZE


def _box_project_uv(mesh, region_id, regions):
    """Per-vertex box (triplanar) projection into the region rect.

    Replaces the old single-point ``np.full(..., [cu, cv])`` collapse so each
    vertex samples a real position inside its atlas region (was: 1 texel for
    the whole mesh). Picks the dominant vertex-normal axis and projects the
    other two bbox-normalised coords. Stays inside ``_uv_rect`` (no atlas
    bleed); same vertex/face count, so cook/material plumbing is untouched.
    """
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    v = mesh.vertices
    vn = mesh.vertex_normals
    mn = v.min(0)
    ext = np.ptp(v, 0)
    ext[ext == 0] = 1.0
    nrm = (v - mn) / ext
    ax = np.abs(vn).argmax(1)
    uv = np.empty((len(v), 2))
    for i, a in enumerate(ax):
        o = [k for k in range(3) if k != a]
        uv[i] = nrm[i, o]
    uv[:, 0] = u0 + uv[:, 0] * (u1 - u0)
    uv[:, 1] = v0 + uv[:, 1] * (v1 - v0)
    return uv


def _cyl_unwrap_uv(mesh, region_id, regions, axis=1):
    """Cylindrical unwrap (theta->u, height->v) into the region rect.

    ``axis`` is the post-rotation height axis index (0=x, 1=y, 2=z). Gives a
    real seam-wrapped UV instead of the old single-point collapse, so the
    brushed/noise atlas detail (and any future normal/ORM) actually samples.
    """
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    v = mesh.vertices
    o = [k for k in range(3) if k != axis]
    theta = np.arctan2(v[:, o[1]], v[:, o[0]])
    uu = (theta + math.pi) / (2 * math.pi)
    hcol = v[:, axis]
    rng = np.ptp(hcol) or 1.0
    vv = (hcol - hcol.min()) / rng
    return np.stack([u0 + uu * (u1 - u0), v0 + vv * (v1 - v0)], 1)


def make_mat(name, region_id, regions, atlas, *, metallic=0.3, rough=0.6, alpha=255, emissive=None, double=False):
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


def face_box(extents, region_id, regions, atlas, mat, faces=None):
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
        if sign > 0:
            tris.extend([[base, base + 1, base + 2], [base, base + 2, base + 3]])
        else:
            tris.extend([[base, base + 2, base + 1], [base, base + 3, base + 2]])
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(tris), process=False)
    mesh.visual = TextureVisuals(uv=np.array(uvs), material=mat, image=atlas)
    return mesh


def bevel_box(extents, region_id, regions, atlas, mat, bevel=0.02):
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
    # Per-vertex box projection (was a single atlas-centre texel for the whole
    # hull); gives a real UV gradient so albedo/normal/ORM detail samples.
    mesh.visual = TextureVisuals(uv=_box_project_uv(mesh, region_id, regions), material=mat, image=atlas)
    return mesh


def cyl(radius, height, region_id, regions, atlas, mat, sections=40, axis="y"):
    # trimesh cylinders are built along +Z by default; rotate so `height`
    # follows the requested axis (matches the level05 generator helper).
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    # Post-rotation height axis: y->1, x->0, else (z, unrotated)->2.
    height_axis = 1 if axis == "y" else (0 if axis == "x" else 2)
    # Cylindrical unwrap (was a single atlas-centre texel for the whole mesh).
    mesh.visual = TextureVisuals(
        uv=_cyl_unwrap_uv(mesh, region_id, regions, axis=height_axis), material=mat, image=atlas)
    return mesh


def place(mesh, translate=(0, 0, 0), rot=None):
    if rot is not None:
        deg, axis = rot
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(deg), axis))
    mesh.apply_translation(translate)
    return mesh


def add(scene, mesh, name):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


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


# --- Data-driven spec translator --------------------------------------------
# Sub-agents design assets as part-lists (JSON); this fixed, tested translator
# turns a part-list into trimesh geometry. Each part picks a PALETTE name; the
# palette maps name -> (region, metallic, rough, alpha, emissive, double).
PALETTE = {
    # NOTE: the thumbnail studio has no environment map, so HIGH metallic renders
    # near-black AND flat faces grazed by the key light go dark. Keep metallic low
    # and give structural surfaces a small self-glow floor (<=0.45/channel, the
    # documented clinical-surface fix) so they read their albedo even when unlit.
    "graphite": ("graphite", 0.18, 0.6, 255, (22, 25, 30), False),
    "steel": ("steel", 0.28, 0.45, 255, (50, 51, 53), False),
    "chrome": ("chrome", 0.30, 0.3, 255, (82, 84, 88), False),
    "enamel": ("enamel", 0.0, 0.7, 255, (110, 114, 120), False),
    "brass": ("brass", 0.40, 0.35, 255, (52, 42, 22), False),
    "black": ("black_glass", 0.30, 0.35, 255, (16, 18, 22), False),
    "glass": ("black_glass", 0.10, 0.12, 110, (16, 40, 48), True),
    "glass_amber": ("amber_strip", 0.00, 0.35, 130, AMBER_HI, True),
    "glass_cyan": ("cyan_strip", 0.05, 0.30, 130, (20, 70, 80), True),
    "cyan": ("cyan_strip", 0.20, 0.30, 255, CYAN, False),
    "cyan_glow": ("cyan_strip", 0.20, 0.28, 255, CYAN_HI, False),
    "cyan_dim": ("cyan_strip", 0.20, 0.35, 255, CYAN_DIM, False),
    "amber": ("amber_panel", 0.40, 0.45, 255, None, False),
    "amber_glow": ("amber_strip", 0.20, 0.30, 255, AMBER_HI, False),
    "red": ("red_panel", 0.45, 0.45, 255, None, False),
    "red_glow": ("red_strip", 0.20, 0.30, 255, RED_HI, False),
    "cyan_lamp": ("lamp_cyan", 0.20, 0.25, 255, CYAN, False),
    "amber_lamp": ("lamp_amber", 0.20, 0.25, 255, AMBER_HI, False),
    "red_lamp": ("lamp_red", 0.20, 0.25, 255, RED_HI, False),
    "hazard_amber": ("hazard_amber", 0.30, 0.50, 255, None, False),
    "hazard_red": ("hazard_red", 0.30, 0.50, 255, None, False),
    "wear": ("edge_wear", 0.40, 0.55, 255, None, False),
    "warning": ("warning", 0.20, 0.50, 255, (80, 60, 16), False),
    "screen": ("screen", 0.10, 0.30, 255, (120, 128, 134), False),
}


def build_from_spec(spec, regions, atlas):
    """Build a scene from a JSON part-list. Robust to a missing GUI 'screen'
    region (falls back to black) so a spec authored for a screen still builds
    when guiKit is None."""
    s = trimesh.Scene()
    short = spec.get("short") or spec["modelKey"]
    cache = {}

    def mat_for(pal):
        if pal not in PALETTE:
            pal = "graphite"
        if pal == "screen" and "screen" not in regions:
            pal = "black"
        if pal not in cache:
            region, metal, rough, alpha, emis, double = PALETTE[pal]
            cache[pal] = (region, make_mat(f"{short}_{pal}", region, regions, atlas,
                                           metallic=metal, rough=rough, alpha=alpha,
                                           emissive=emis, double=double))
        return cache[pal]

    for i, p in enumerate(spec.get("parts", [])):
        region, mat = mat_for(p.get("pal", "graphite"))
        rot = (p["rot"][0], tuple(p["rot"][1])) if p.get("rot") else None
        pos = tuple(p.get("pos", [0, 0, 0]))
        name = p.get("name", f"{short}_p{i}")
        prim = p.get("prim", "box")
        if prim == "box":
            mesh = bevel_box(tuple(p["ext"]), region, regions, atlas, mat, bevel=p.get("bevel", 0.015))
        elif prim == "cyl":
            mesh = cyl(float(p["radius"]), float(p["height"]), region, regions, atlas, mat,
                       axis=p.get("axis", "y"), sections=int(p.get("sections", 36)))
        elif prim == "faceq":
            mesh = face_box(tuple(p["ext"]), region, regions, atlas, mat, faces={p.get("face", "pz")})
        else:
            continue
        add(s, place(mesh, pos, rot=rot), name)
    return s, len(s.geometry)


GUI_BG_BY_KIT = {
    "level06_frozen_archive": GUI_DIR / "level06/frozen_archive_background_image2.png",
    "level07_transit_route_switch": GUI_DIR / "level07/transit_route_switch_background_image2.png",
    "level08_identity_playback": GUI_DIR / "level08/identity_playback_background_image2.png",
    "level09_lockdown_override": GUI_DIR / "level09/lockdown_override_background_image2.png",
    "level10_final_protocol": GUI_DIR / "level10/final_protocol_background_image2.png",
}

SPEC_FILE = Path(__file__).resolve().parent / "level06-10-asset-specs.json"


def load_spec_assets():
    """Load JSON part-list specs into ASSETS-compatible (modelKey, builder, spec) tuples."""
    if not SPEC_FILE.exists():
        return []
    out = []
    for sp in json.loads(SPEC_FILE.read_text()):
        sp["short"] = sp["modelKey"].replace("room_l610_", "")
        gui = sp.get("guiKit")
        entry = dict(
            label=sp["label"], short=sp["short"], family=sp["family"],
            footprintFamily=sp["footprintFamily"], mount=sp.get("mount", "floor"),
            clueCapacity=sp.get("clueCapacity", 0), canHoldSmallProps=sp.get("canHoldSmallProps", False),
            solid=sp.get("solid", True), levelTag=sp["level"], themeTag=sp.get("theme", "level06-10"),
            guiKit=gui, guiBg=(GUI_BG_BY_KIT[gui] if gui else None),
        )
        if sp.get("wallPreferred"):
            entry["wallPreferred"] = sp["wallPreferred"]
        out.append((sp["modelKey"], (lambda r, a, _sp=sp: build_from_spec(_sp, r, a)), entry))
    return out


# --- Builders ----------------------------------------------------------------
def build_route_switch_console(regions, atlas):
    """L07 transit switchyard main puzzle. Wide amber/black console with a
    rail-route map screen, a 3-lever bank, brass top rail and amber/cyan status
    lamps. ~1.85 x 1.18 x 0.72 m."""
    s = trimesh.Scene()
    graph = make_mat("l610_rs_graphite", "graphite", regions, atlas, metallic=0.35, rough=0.55)
    amber = make_mat("l610_rs_amber", "amber_panel", regions, atlas, metallic=0.4, rough=0.45)
    steel = make_mat("l610_rs_steel", "steel", regions, atlas, metallic=0.7, rough=0.4)
    brass = make_mat("l610_rs_brass", "brass", regions, atlas, metallic=0.85, rough=0.32)
    wear = make_mat("l610_rs_wear", "edge_wear", regions, atlas, metallic=0.4, rough=0.55)
    hazard = make_mat("l610_rs_hazard", "hazard_amber", regions, atlas, metallic=0.3, rough=0.5)
    screen = make_mat("l610_rs_screen", "screen", regions, atlas, metallic=0.1, rough=0.32, emissive=(70, 50, 18))
    cyanl = make_mat("l610_rs_lamp_cyan", "lamp_cyan", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN)
    amberl = make_mat("l610_rs_lamp_amber", "lamp_amber", regions, atlas, metallic=0.2, rough=0.25, emissive=AMBER_HI)

    add(s, place(bevel_box((1.85, 0.12, 0.72), "edge_wear", regions, atlas, wear, bevel=0.02), (0, 0.06, 0)), "rs_base")
    add(s, place(face_box((1.80, 0.05, 0.74), "hazard_amber", regions, atlas, hazard, faces={"pz"}), (0, 0.11, 0.0)), "rs_hazard_strip")
    add(s, place(bevel_box((1.78, 0.62, 0.62), "graphite", regions, atlas, graph, bevel=0.022), (0, 0.45, 0)), "rs_body")
    # Amber side cheeks
    for sx in (-1, 1):
        add(s, place(bevel_box((0.10, 0.60, 0.64), "amber_panel", regions, atlas, amber, bevel=0.014), (sx * 0.88, 0.46, 0)), f"rs_cheek_{sx}")
    # Angled top deck holding the rail-map screen (tilted ~22 deg toward player)
    deck = bevel_box((1.62, 0.06, 0.5), "steel", regions, atlas, steel, bevel=0.014)
    add(s, place(deck, (0, 0.84, 0.06), rot=(-22, (1, 0, 0))), "rs_deck")
    sc = face_box((1.30, 0.02, 0.40), "screen", regions, atlas, screen, faces={"py"})
    add(s, place(sc, (0, 0.885, 0.07), rot=(-22, (1, 0, 0))), "rs_screen")
    # Brass top rail behind the deck
    add(s, place(cyl(0.022, 1.5, "brass", regions, atlas, brass, axis="x"), (0, 1.0, -0.2)), "rs_top_rail")
    for sx in (-1, 1):
        add(s, place(cyl(0.02, 0.2, "brass", regions, atlas, brass, axis="y"), (sx * 0.74, 0.92, -0.2)), f"rs_rail_post_{sx}")
    # 3-lever bank on the lower front face
    for i, lx in enumerate((-0.42, 0.0, 0.42)):
        add(s, place(bevel_box((0.16, 0.10, 0.12), "graphite", regions, atlas, graph, bevel=0.01), (lx, 0.30, 0.33)), f"rs_lever_slot_{i}")
        add(s, place(cyl(0.018, 0.22, "steel", regions, atlas, steel, axis="y"), (lx, 0.40, 0.36), rot=(20, (1, 0, 0))), f"rs_lever_{i}")
        add(s, place(cyl(0.04, 0.05, "amber_panel" if i != 1 else "cyan_strip", regions, atlas, amber if i != 1 else cyanl, axis="y"), (lx, 0.52, 0.40), rot=(20, (1, 0, 0))), f"rs_lever_knob_{i}")
    # Status lamps
    add(s, place(face_box((0.09, 0.02, 0.09), "lamp_cyan", regions, atlas, cyanl, faces={"py"}), (-0.7, 0.765, 0.2)), "rs_lamp_cyan")
    add(s, place(face_box((0.09, 0.02, 0.09), "lamp_amber", regions, atlas, amberl, faces={"py"}), (0.7, 0.765, 0.2)), "rs_lamp_amber")
    # Back cable trunk
    add(s, place(bevel_box((0.5, 0.5, 0.1), "graphite", regions, atlas, graph, bevel=0.01), (0, 0.42, -0.34)), "rs_cable_trunk")
    return s, len(s.geometry)


def build_lockdown_override_console(regions, atlas):
    """L09 containment maintenance main puzzle. Red/black console with a
    breaker cover, a pressure gauge, side pipe stubs, warning Image2 screen and
    red/cyan danger lamps. ~1.45 x 1.28 x 0.68 m."""
    s = trimesh.Scene()
    graph = make_mat("l610_lo_graphite", "graphite", regions, atlas, metallic=0.35, rough=0.55)
    red = make_mat("l610_lo_red", "red_panel", regions, atlas, metallic=0.45, rough=0.45)
    black = make_mat("l610_lo_black", "black_glass", regions, atlas, metallic=0.5, rough=0.3)
    steel = make_mat("l610_lo_steel", "steel", regions, atlas, metallic=0.7, rough=0.4)
    brass = make_mat("l610_lo_brass", "brass", regions, atlas, metallic=0.85, rough=0.32)
    wear = make_mat("l610_lo_wear", "edge_wear", regions, atlas, metallic=0.4, rough=0.55)
    hazard = make_mat("l610_lo_hazard", "hazard_red", regions, atlas, metallic=0.3, rough=0.5)
    warning = make_mat("l610_lo_warn", "warning", regions, atlas, metallic=0.2, rough=0.5, emissive=(80, 60, 16))
    screen = make_mat("l610_lo_screen", "screen", regions, atlas, metallic=0.1, rough=0.32, emissive=(70, 24, 20))
    redl = make_mat("l610_lo_lamp_red", "lamp_red", regions, atlas, metallic=0.2, rough=0.25, emissive=RED_HI)
    cyanl = make_mat("l610_lo_lamp_cyan", "lamp_cyan", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN)

    add(s, place(bevel_box((1.45, 0.12, 0.68), "edge_wear", regions, atlas, wear, bevel=0.02), (0, 0.06, 0)), "lo_base")
    add(s, place(face_box((1.40, 0.06, 0.7), "hazard_red", regions, atlas, hazard, faces={"pz"}), (0, 0.12, 0.0)), "lo_hazard_strip")
    add(s, place(bevel_box((1.36, 0.92, 0.58), "graphite", regions, atlas, graph, bevel=0.022), (0, 0.60, 0)), "lo_body")
    # Red upper bezel band
    add(s, place(face_box((1.36, 0.18, 0.6), "red_panel", regions, atlas, red, faces={"pz", "px", "nx"}), (0, 1.0, 0)), "lo_red_band")
    # Angled warning screen
    sc = face_box((0.86, 0.02, 0.40), "screen", regions, atlas, screen, faces={"py"})
    add(s, place(sc, (-0.0, 0.92, 0.18), rot=(-26, (1, 0, 0))), "lo_screen")
    add(s, place(bevel_box((0.96, 0.05, 0.46), "black_glass", regions, atlas, black, bevel=0.01), (0, 0.90, 0.16), rot=(-26, (1, 0, 0))), "lo_screen_bezel")
    # Physical breaker cover on the lower front (thick hinged plate) + red handle
    add(s, place(bevel_box((0.62, 0.34, 0.06), "black_glass", regions, atlas, black, bevel=0.012), (0.0, 0.46, 0.31)), "lo_breaker_cover")
    add(s, place(face_box((0.62, 0.34, 0.005), "warning", regions, atlas, warning, faces={"pz"}), (0.0, 0.46, 0.342)), "lo_breaker_warn")
    add(s, place(cyl(0.03, 0.20, "red_panel", regions, atlas, red, axis="x"), (0.0, 0.46, 0.37)), "lo_breaker_handle")
    # Pressure gauge (brass ring + dark dial) upper-left
    add(s, place(cyl(0.12, 0.05, "brass", regions, atlas, brass, axis="z"), (-0.48, 0.78, 0.30)), "lo_gauge_ring")
    add(s, place(cyl(0.095, 0.02, "black_glass", regions, atlas, black, axis="z"), (-0.48, 0.78, 0.325)), "lo_gauge_face")
    add(s, place(cyl(0.06, 0.012, "lamp_red", regions, atlas, redl, axis="z"), (-0.48, 0.78, 0.34)), "lo_gauge_lens")
    # Side pipe stubs
    for sx in (-1, 1):
        add(s, place(cyl(0.05, 0.22, "steel", regions, atlas, steel, axis="x"), (sx * 0.76, 0.5, -0.1)), f"lo_pipe_{sx}")
        add(s, place(cyl(0.07, 0.04, "brass", regions, atlas, brass, axis="x"), (sx * 0.66, 0.5, -0.1)), f"lo_pipe_flange_{sx}")
    # Danger / solved lamps
    add(s, place(face_box((0.10, 0.02, 0.10), "lamp_red", regions, atlas, redl, faces={"py"}), (0.5, 1.085, 0.0)), "lo_lamp_red")
    add(s, place(face_box((0.10, 0.02, 0.10), "lamp_cyan", regions, atlas, cyanl, faces={"py"}), (0.2, 1.085, 0.0)), "lo_lamp_cyan")
    return s, len(s.geometry)


def build_final_protocol_console(regions, atlas):
    """L10 core terminal final puzzle. Low black-glass altar with a cyan
    protocol ring disc, six key slots, an upright final-protocol screen and
    cyan vertical seams. Altar/shrine silhouette. ~1.34 x 1.06 x 1.34 m."""
    s = trimesh.Scene()
    black = make_mat("l610_fp_black", "black_glass", regions, atlas, metallic=0.55, rough=0.25)
    graph = make_mat("l610_fp_graphite", "graphite", regions, atlas, metallic=0.4, rough=0.5)
    steel = make_mat("l610_fp_steel", "steel", regions, atlas, metallic=0.75, rough=0.35)
    brass = make_mat("l610_fp_brass", "brass", regions, atlas, metallic=0.85, rough=0.3)
    cyans = make_mat("l610_fp_cyan", "cyan_strip", regions, atlas, metallic=0.2, rough=0.3, emissive=CYAN)
    ring = make_mat("l610_fp_ring", "cyan_strip", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN_HI)
    screen = make_mat("l610_fp_screen", "screen", regions, atlas, metallic=0.1, rough=0.3, emissive=(20, 56, 64))
    cyanl = make_mat("l610_fp_lamp", "lamp_cyan", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN_HI)

    # Octagon-ish base + altar body via stacked beveled boxes
    add(s, place(bevel_box((1.34, 0.10, 1.34), "graphite", regions, atlas, graph, bevel=0.03), (0, 0.05, 0)), "fp_base")
    add(s, place(cyl(0.66, 0.06, "brass", regions, atlas, brass, axis="y", sections=8), (0, 0.13, 0)), "fp_base_ring")
    add(s, place(bevel_box((1.02, 0.62, 1.02), "black_glass", regions, atlas, black, bevel=0.04), (0, 0.45, 0)), "fp_body")
    # Cyan vertical seams on the four faces
    for ang, (dx, dz, rw) in zip((0, 90, 180, 270), ((0, 0.52, "z"), (0.52, 0, "x"), (0, -0.52, "z"), (-0.52, 0, "x"))):
        if rw == "z":
            add(s, place(face_box((0.05, 0.5, 0.02), "cyan_strip", regions, atlas, cyans, faces={"pz" if dz > 0 else "nz"}), (dx, 0.45, dz)), f"fp_seam_{ang}")
        else:
            add(s, place(face_box((0.02, 0.5, 0.05), "cyan_strip", regions, atlas, cyans, faces={"px" if dx > 0 else "nx"}), (dx, 0.45, dz)), f"fp_seam_{ang}")
    # Top deck
    add(s, place(bevel_box((1.06, 0.06, 1.06), "graphite", regions, atlas, graph, bevel=0.02), (0, 0.79, 0)), "fp_deck")
    # Protocol ring disc (cyan) + dark inner disc => annulus read
    add(s, place(cyl(0.46, 0.018, "cyan_strip", regions, atlas, ring, axis="y"), (0, 0.825, 0)), "fp_ring")
    add(s, place(cyl(0.33, 0.022, "black_glass", regions, atlas, black, axis="y"), (0, 0.83, 0)), "fp_ring_inner")
    # Six key slots around the ring
    for i in range(6):
        a = math.radians(i * 60)
        kx, kz = 0.40 * math.cos(a), 0.40 * math.sin(a)
        add(s, place(bevel_box((0.07, 0.03, 0.05), "steel", regions, atlas, steel, bevel=0.006), (kx, 0.84, kz)), f"fp_keyslot_{i}")
        add(s, place(face_box((0.045, 0.012, 0.03), "lamp_cyan", regions, atlas, cyanl, faces={"py"}), (kx, 0.856, kz)), f"fp_keylamp_{i}")
    # Upright final-protocol screen rising from the back of the deck
    add(s, place(bevel_box((0.66, 0.5, 0.06), "black_glass", regions, atlas, black, bevel=0.012), (0, 1.12, -0.34)), "fp_screen_panel")
    add(s, place(face_box((0.58, 0.42, 0.01), "screen", regions, atlas, screen, faces={"pz"}), (0, 1.12, -0.305)), "fp_screen")
    add(s, place(face_box((0.66, 0.03, 0.06), "cyan_strip", regions, atlas, cyans, faces={"py"}), (0, 1.375, -0.34)), "fp_screen_crest")
    return s, len(s.geometry)


# --- Builders (Batch 02) -----------------------------------------------------
def build_cryo_record_pod(regions, atlas):
    """L06 hero clue container. Frosted glass cryo capsule on a graphite base
    with an inner cyan ID shard, base/top cyan rings and a small frozen-archive
    status screen. ~0.82 x 1.86 x 0.82 m."""
    s = trimesh.Scene()
    graph = make_mat("l610_cr_graphite", "graphite", regions, atlas, metallic=0.35, rough=0.55)
    steel = make_mat("l610_cr_steel", "steel", regions, atlas, metallic=0.7, rough=0.4)
    glass = make_mat("l610_cr_glass", "black_glass", regions, atlas, metallic=0.1, rough=0.12, alpha=120, double=True)
    frost = make_mat("l610_cr_frost", "cyan_strip", regions, atlas, metallic=0.1, rough=0.5, alpha=150, emissive=(20, 60, 70), double=True)
    cyans = make_mat("l610_cr_cyan", "cyan_strip", regions, atlas, metallic=0.2, rough=0.3, emissive=CYAN)
    shard = make_mat("l610_cr_shard", "cyan_strip", regions, atlas, metallic=0.3, rough=0.2, emissive=CYAN_HI)
    screen = make_mat("l610_cr_screen", "screen", regions, atlas, metallic=0.1, rough=0.32, emissive=(24, 56, 64))
    lamp = make_mat("l610_cr_lamp", "lamp_cyan", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN)

    add(s, place(bevel_box((0.82, 0.14, 0.82), "graphite", regions, atlas, graph, bevel=0.02), (0, 0.07, 0)), "cr_base")
    add(s, place(cyl(0.34, 0.05, "cyan_strip", regions, atlas, cyans, axis="y"), (0, 0.16, 0)), "cr_base_ring")
    add(s, place(cyl(0.30, 0.10, "steel", regions, atlas, steel, axis="y"), (0, 0.24, 0)), "cr_base_collar")
    # Glass capsule
    add(s, place(cyl(0.30, 1.30, "black_glass", regions, atlas, glass, axis="y"), (0, 0.95, 0)), "cr_capsule")
    add(s, place(cyl(0.305, 0.40, "cyan_strip", regions, atlas, frost, axis="y"), (0, 0.70, 0)), "cr_frost_low")
    # Inner ID shard
    add(s, place(bevel_box((0.10, 0.5, 0.06), "cyan_strip", regions, atlas, shard, bevel=0.01), (0, 0.95, 0), rot=(12, (0, 0, 1))), "cr_shard")
    # Top cap + cyan ring
    add(s, place(cyl(0.32, 0.10, "steel", regions, atlas, steel, axis="y"), (0, 1.65, 0)), "cr_cap")
    add(s, place(cyl(0.34, 0.04, "cyan_strip", regions, atlas, cyans, axis="y"), (0, 1.74, 0)), "cr_cap_ring")
    # Front status screen on the base collar
    add(s, place(bevel_box((0.26, 0.18, 0.03), "graphite", regions, atlas, graph, bevel=0.008), (0, 0.30, 0.30)), "cr_screen_bezel")
    add(s, place(face_box((0.22, 0.14, 0.01), "screen", regions, atlas, screen, faces={"pz"}), (0, 0.30, 0.318)), "cr_screen")
    add(s, place(face_box((0.06, 0.02, 0.06), "lamp_cyan", regions, atlas, lamp, faces={"py"}), (0.2, 0.215, 0.2)), "cr_lamp")
    return s, len(s.geometry)


def build_memory_projection_pedestal(regions, atlas):
    """L08 memory-theater hero display. Octagonal brass/black pedestal with a
    central amber hologram volume, an amber halo ring and an upright identity
    playback screen. ~1.02 x 1.34 x 1.02 m."""
    s = trimesh.Scene()
    black = make_mat("l610_mp_black", "black_glass", regions, atlas, metallic=0.5, rough=0.28)
    graph = make_mat("l610_mp_graphite", "graphite", regions, atlas, metallic=0.4, rough=0.5)
    brass = make_mat("l610_mp_brass", "brass", regions, atlas, metallic=0.85, rough=0.3)
    holo = make_mat("l610_mp_holo", "amber_strip", regions, atlas, metallic=0.0, rough=0.4, alpha=130, emissive=AMBER_HI, double=True)
    ambers = make_mat("l610_mp_amber", "amber_strip", regions, atlas, metallic=0.2, rough=0.3, emissive=AMBER_HI)
    screen = make_mat("l610_mp_screen", "screen", regions, atlas, metallic=0.1, rough=0.3, emissive=(60, 42, 16))
    lamp = make_mat("l610_mp_lamp", "lamp_amber", regions, atlas, metallic=0.2, rough=0.25, emissive=AMBER_HI)

    add(s, place(cyl(0.5, 0.12, "graphite", regions, atlas, graph, axis="y", sections=8), (0, 0.06, 0)), "mp_base")
    add(s, place(cyl(0.46, 0.05, "brass", regions, atlas, brass, axis="y", sections=8), (0, 0.14, 0)), "mp_base_ring")
    add(s, place(cyl(0.34, 0.5, "black_glass", regions, atlas, black, axis="y", sections=8), (0, 0.41, 0)), "mp_column")
    add(s, place(cyl(0.40, 0.04, "amber_strip", regions, atlas, ambers, axis="y", sections=8), (0, 0.66, 0)), "mp_halo")
    # Hologram volume
    add(s, place(cyl(0.22, 0.46, "amber_strip", regions, atlas, holo, axis="y"), (0, 0.92, 0)), "mp_holo")
    add(s, place(bevel_box((0.16, 0.34, 0.10), "amber_strip", regions, atlas, holo, bevel=0.01), (0, 0.92, 0)), "mp_holo_core")
    # Upright playback screen at back
    add(s, place(bevel_box((0.6, 0.44, 0.06), "black_glass", regions, atlas, black, bevel=0.012), (0, 1.05, -0.30)), "mp_screen_panel")
    add(s, place(face_box((0.52, 0.36, 0.01), "screen", regions, atlas, screen, faces={"pz"}), (0, 1.05, -0.27)), "mp_screen")
    add(s, place(face_box((0.6, 0.03, 0.06), "amber_strip", regions, atlas, ambers, faces={"py"}), (0, 1.28, -0.30)), "mp_screen_crest")
    for sx in (-1, 1):
        add(s, place(face_box((0.05, 0.02, 0.05), "lamp_amber", regions, atlas, lamp, faces={"py"}), (sx * 0.3, 0.165, 0.3)), f"mp_lamp_{sx}")
    return s, len(s.geometry)


def build_track_relay_cabinet(regions, atlas):
    """L07 supporting clue. Tall graphite relay cabinet with amber side panel,
    recessed cable grooves, brass numbered tag plates and a small route relay
    screen. ~0.92 x 1.98 x 0.6 m."""
    s = trimesh.Scene()
    graph = make_mat("l610_tr_graphite", "graphite", regions, atlas, metallic=0.35, rough=0.55)
    amber = make_mat("l610_tr_amber", "amber_panel", regions, atlas, metallic=0.4, rough=0.45)
    steel = make_mat("l610_tr_steel", "steel", regions, atlas, metallic=0.7, rough=0.4)
    brass = make_mat("l610_tr_brass", "brass", regions, atlas, metallic=0.85, rough=0.3)
    wear = make_mat("l610_tr_wear", "edge_wear", regions, atlas, metallic=0.4, rough=0.55)
    hazard = make_mat("l610_tr_hazard", "hazard_amber", regions, atlas, metallic=0.3, rough=0.5)
    screen = make_mat("l610_tr_screen", "screen", regions, atlas, metallic=0.1, rough=0.32, emissive=(60, 44, 18))
    lamp = make_mat("l610_tr_lamp", "lamp_amber", regions, atlas, metallic=0.2, rough=0.25, emissive=AMBER_HI)

    add(s, place(bevel_box((0.92, 0.12, 0.6), "edge_wear", regions, atlas, wear, bevel=0.018), (0, 0.06, 0)), "tr_base")
    add(s, place(bevel_box((0.86, 1.78, 0.5), "graphite", regions, atlas, graph, bevel=0.02), (0, 1.0, 0)), "tr_body")
    add(s, place(face_box((0.86, 0.06, 0.52), "hazard_amber", regions, atlas, hazard, faces={"pz"}), (0, 0.16, 0)), "tr_hazard")
    # Cable grooves (recessed steel strips)
    for i, gy in enumerate((0.55, 0.95, 1.35)):
        add(s, place(face_box((0.7, 0.10, 0.02), "steel", regions, atlas, steel, faces={"pz"}), (0, gy, 0.245)), f"tr_groove_{i}")
    # Brass numbered tag plates
    for i, ty in enumerate((0.72, 1.12, 1.52)):
        add(s, place(face_box((0.14, 0.10, 0.02), "brass", regions, atlas, brass, faces={"pz"}), (-0.28, ty, 0.255)), f"tr_tag_{i}")
    # Amber side panel
    add(s, place(face_box((0.04, 1.5, 0.4), "amber_panel", regions, atlas, amber, faces={"px"}), (0.43, 1.0, 0)), "tr_amber_side")
    # Top relay screen
    add(s, place(bevel_box((0.5, 0.32, 0.04), "graphite", regions, atlas, graph, bevel=0.01), (0, 1.66, 0.24)), "tr_screen_bezel")
    add(s, place(face_box((0.44, 0.26, 0.01), "screen", regions, atlas, screen, faces={"pz"}), (0, 1.66, 0.262)), "tr_screen")
    add(s, place(face_box((0.08, 0.02, 0.08), "lamp_amber", regions, atlas, lamp, faces={"py"}), (0.3, 1.892, 0.0)), "tr_lamp")
    return s, len(s.geometry)


def build_pressure_containment_tank(regions, atlas):
    """L09 hero room prop. Vertical steel pressure tank with brass collar rings,
    a pressure gauge, side pipe stubs, a top valve wheel, a red hazard band and
    a small warning screen. ~1.0 x 2.08 x 1.0 m."""
    s = trimesh.Scene()
    graph = make_mat("l610_pt_graphite", "graphite", regions, atlas, metallic=0.35, rough=0.55)
    steel = make_mat("l610_pt_steel", "steel", regions, atlas, metallic=0.75, rough=0.35)
    brass = make_mat("l610_pt_brass", "brass", regions, atlas, metallic=0.85, rough=0.3)
    red = make_mat("l610_pt_red", "red_panel", regions, atlas, metallic=0.45, rough=0.45)
    black = make_mat("l610_pt_black", "black_glass", regions, atlas, metallic=0.5, rough=0.3)
    hazard = make_mat("l610_pt_hazard", "hazard_red", regions, atlas, metallic=0.3, rough=0.5)
    screen = make_mat("l610_pt_screen", "screen", regions, atlas, metallic=0.1, rough=0.32, emissive=(64, 26, 22))
    redl = make_mat("l610_pt_lamp", "lamp_red", regions, atlas, metallic=0.2, rough=0.25, emissive=RED_HI)

    add(s, place(bevel_box((1.0, 0.12, 1.0), "graphite", regions, atlas, graph, bevel=0.02), (0, 0.06, 0)), "pt_base")
    add(s, place(cyl(0.40, 1.56, "steel", regions, atlas, steel, axis="y"), (0, 0.92, 0)), "pt_tank")
    add(s, place(cyl(0.42, 0.06, "brass", regions, atlas, brass, axis="y"), (0, 0.42, 0)), "pt_collar_low")
    add(s, place(cyl(0.42, 0.06, "brass", regions, atlas, brass, axis="y"), (0, 1.42, 0)), "pt_collar_high")
    add(s, place(cyl(0.42, 0.10, "hazard_red", regions, atlas, hazard, axis="y"), (0, 0.92, 0)), "pt_hazard_band")
    # Dome top + valve wheel
    add(s, place(cyl(0.30, 0.16, "steel", regions, atlas, steel, axis="y"), (0, 1.78, 0)), "pt_dome")
    add(s, place(cyl(0.16, 0.05, "red_panel", regions, atlas, red, axis="y"), (0, 1.92, 0)), "pt_valve_hub")
    for i in range(4):
        a = math.radians(i * 90)
        add(s, place(bevel_box((0.30, 0.04, 0.05), "red_panel", regions, atlas, red, bevel=0.008), (0, 1.92, 0), rot=(i * 45, (0, 1, 0))), f"pt_valve_spoke_{i}")
    # Gauge + pipes
    add(s, place(cyl(0.11, 0.05, "brass", regions, atlas, brass, axis="z"), (0.30, 1.15, 0.34)), "pt_gauge_ring")
    add(s, place(cyl(0.085, 0.02, "black_glass", regions, atlas, black, axis="z"), (0.30, 1.15, 0.36)), "pt_gauge_face")
    add(s, place(cyl(0.05, 0.012, "lamp_red", regions, atlas, redl, axis="z"), (0.30, 1.15, 0.375)), "pt_gauge_lens")
    for sx in (-1, 1):
        add(s, place(cyl(0.05, 0.30, "steel", regions, atlas, steel, axis="x"), (sx * 0.42, 0.6, 0.0)), f"pt_pipe_{sx}")
    # Warning screen
    add(s, place(bevel_box((0.34, 0.22, 0.04), "graphite", regions, atlas, graph, bevel=0.008), (-0.28, 1.2, 0.32)), "pt_screen_bezel")
    add(s, place(face_box((0.28, 0.16, 0.01), "screen", regions, atlas, screen, faces={"pz"}), (-0.28, 1.2, 0.342)), "pt_screen")
    return s, len(s.geometry)


def build_core_server_obelisk(regions, atlas):
    """L10 hero room prop. Tall tapered black monolith with cyan vertical light
    seams, a cyan top cap, an inset protocol readout screen and base lamps.
    Strong sparse silhouette. ~0.72 x 2.54 x 0.72 m."""
    s = trimesh.Scene()
    black = make_mat("l610_ob_black", "black_glass", regions, atlas, metallic=0.55, rough=0.22)
    graph = make_mat("l610_ob_graphite", "graphite", regions, atlas, metallic=0.4, rough=0.5)
    steel = make_mat("l610_ob_steel", "steel", regions, atlas, metallic=0.75, rough=0.35)
    cyans = make_mat("l610_ob_cyan", "cyan_strip", regions, atlas, metallic=0.2, rough=0.3, emissive=CYAN)
    capm = make_mat("l610_ob_cap", "cyan_strip", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN_HI)
    screen = make_mat("l610_ob_screen", "screen", regions, atlas, metallic=0.1, rough=0.3, emissive=(20, 56, 64))
    lamp = make_mat("l610_ob_lamp", "lamp_cyan", regions, atlas, metallic=0.2, rough=0.25, emissive=CYAN_HI)

    add(s, place(bevel_box((0.72, 0.12, 0.72), "graphite", regions, atlas, graph, bevel=0.02), (0, 0.06, 0)), "ob_base")
    add(s, place(bevel_box((0.6, 0.06, 0.6), "steel", regions, atlas, steel, bevel=0.012), (0, 0.15, 0)), "ob_base_plate")
    # Tapered body (two stacked beveled boxes, narrower on top)
    add(s, place(bevel_box((0.46, 1.3, 0.46), "black_glass", regions, atlas, black, bevel=0.03), (0, 0.83, 0)), "ob_body_low")
    add(s, place(bevel_box((0.36, 0.9, 0.36), "black_glass", regions, atlas, black, bevel=0.03), (0, 1.85, 0)), "ob_body_high")
    # Cyan vertical seams on the four faces of the lower body
    for dx, dz, face in ((0, 0.231, "pz"), (0, -0.231, "nz"), (0.231, 0, "px"), (-0.231, 0, "nx")):
        if face in ("pz", "nz"):
            add(s, place(face_box((0.04, 1.2, 0.01), "cyan_strip", regions, atlas, cyans, faces={face}), (dx, 0.83, dz)), f"ob_seam_{face}")
        else:
            add(s, place(face_box((0.01, 1.2, 0.04), "cyan_strip", regions, atlas, cyans, faces={face}), (dx, 0.83, dz)), f"ob_seam_{face}")
    # Cyan top cap
    add(s, place(bevel_box((0.30, 0.12, 0.30), "cyan_strip", regions, atlas, capm, bevel=0.02), (0, 2.42, 0)), "ob_cap")
    # Inset protocol readout screen
    add(s, place(face_box((0.30, 0.42, 0.01), "screen", regions, atlas, screen, faces={"pz"}), (0, 1.0, 0.231)), "ob_screen")
    for sx in (-1, 1):
        add(s, place(face_box((0.05, 0.02, 0.05), "lamp_cyan", regions, atlas, lamp, faces={"py"}), (sx * 0.22, 0.185, 0.22)), f"ob_lamp_{sx}")
    return s, len(s.geometry)


def build_specimen_glass_case(regions, atlas):
    """L08 story prop (no console screen). Thick glass display box on a brass
    base with an internal dark specimen silhouette, brass corner posts and a
    low amber base light. ~0.82 x 1.42 x 0.82 m."""
    s = trimesh.Scene()
    graph = make_mat("l610_sg_graphite", "graphite", regions, atlas, metallic=0.4, rough=0.5)
    brass = make_mat("l610_sg_brass", "brass", regions, atlas, metallic=0.85, rough=0.3)
    glass = make_mat("l610_sg_glass", "black_glass", regions, atlas, metallic=0.1, rough=0.1, alpha=90, double=True)
    black = make_mat("l610_sg_black", "black_glass", regions, atlas, metallic=0.4, rough=0.4)
    steel = make_mat("l610_sg_steel", "steel", regions, atlas, metallic=0.7, rough=0.4)
    ambers = make_mat("l610_sg_amber", "amber_strip", regions, atlas, metallic=0.2, rough=0.3, emissive=AMBER)

    add(s, place(bevel_box((0.82, 0.22, 0.82), "graphite", regions, atlas, graph, bevel=0.02), (0, 0.11, 0)), "sg_base")
    add(s, place(bevel_box((0.74, 0.06, 0.74), "brass", regions, atlas, brass, bevel=0.014), (0, 0.25, 0)), "sg_base_ring")
    add(s, place(face_box((0.76, 0.03, 0.76), "amber_strip", regions, atlas, ambers, faces={"py"}), (0, 0.225, 0)), "sg_base_light")
    # Internal specimen silhouette (abstract dark shard)
    add(s, place(bevel_box((0.14, 0.7, 0.10), "black_glass", regions, atlas, black, bevel=0.02), (0, 0.66, 0), rot=(8, (0, 0, 1))), "sg_specimen")
    add(s, place(bevel_box((0.22, 0.10, 0.18), "black_glass", regions, atlas, black, bevel=0.02), (0, 0.34, 0)), "sg_specimen_foot")
    # Thick glass box
    add(s, place(bevel_box((0.62, 0.92, 0.62), "black_glass", regions, atlas, glass, bevel=0.02), (0, 0.74, 0)), "sg_glass")
    # Brass corner posts
    for dx in (-0.3, 0.3):
        for dz in (-0.3, 0.3):
            add(s, place(bevel_box((0.05, 0.92, 0.05), "brass", regions, atlas, brass, bevel=0.008), (dx, 0.74, dz)), f"sg_post_{dx}_{dz}")
    # Brass top cap
    add(s, place(bevel_box((0.7, 0.08, 0.7), "brass", regions, atlas, brass, bevel=0.014), (0, 1.24, 0)), "sg_cap")
    add(s, place(bevel_box((0.5, 0.05, 0.5), "steel", regions, atlas, steel, bevel=0.01), (0, 1.31, 0)), "sg_cap_plate")
    return s, len(s.geometry)


# --- Asset registry ----------------------------------------------------------
ASSETS = [
    ("room_l610_hero_route_switch_console", build_route_switch_console, dict(
        label="轨道路由控制台", short="route_switch", family="control_console", footprintFamily="cabinet",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True,
        levelTag="07", themeTag="transit-switchyard", guiKit="level07_transit_route_switch",
        guiBg=GUI_DIR / "level07/transit_route_switch_background_image2.png")),
    ("room_l610_hero_lockdown_override_console", build_lockdown_override_console, dict(
        label="封锁解除控制台", short="lockdown_override", family="control_console", footprintFamily="cabinet",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True,
        levelTag="09", themeTag="containment-maintenance", guiKit="level09_lockdown_override",
        guiBg=GUI_DIR / "level09/lockdown_override_background_image2.png")),
    ("room_l610_hero_final_protocol_console", build_final_protocol_console, dict(
        label="终极协议控制台", short="final_protocol", family="control_console", footprintFamily="pedestal",
        mount="floor", clueCapacity=1, canHoldSmallProps=True, solid=True,
        levelTag="10", themeTag="core-terminal", guiKit="level10_final_protocol",
        guiBg=GUI_DIR / "level10/final_protocol_background_image2.png")),
    # --- Batch 02 ---
    ("room_l610_hero_cryo_record_pod", build_cryo_record_pod, dict(
        label="冷冻档案荚", short="cryo_record_pod", family="display_case", footprintFamily="column",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True,
        levelTag="06", themeTag="cryogenic-records", guiKit="level06_frozen_archive",
        guiBg=GUI_DIR / "level06/frozen_archive_background_image2.png")),
    ("room_l610_hero_memory_projection_pedestal", build_memory_projection_pedestal, dict(
        label="记忆投影展台", short="memory_projection_pedestal", family="display_case", footprintFamily="pedestal",
        mount="floor", clueCapacity=1, canHoldSmallProps=True, solid=True,
        levelTag="08", themeTag="memory-theater", guiKit="level08_identity_playback",
        guiBg=GUI_DIR / "level08/identity_playback_background_image2.png")),
    ("room_l610_track_relay_cabinet", build_track_relay_cabinet, dict(
        label="路由继电柜", short="track_relay_cabinet", family="cabinet", footprintFamily="cabinet",
        mount="floor", clueCapacity=1, canHoldSmallProps=False, solid=True,
        levelTag="07", themeTag="transit-switchyard", guiKit="level07_transit_route_switch",
        guiBg=GUI_DIR / "level07/transit_route_switch_background_image2.png")),
    ("room_l610_pressure_containment_tank", build_pressure_containment_tank, dict(
        label="压力收容罐", short="pressure_containment_tank", family="cabinet", footprintFamily="column",
        mount="floor", clueCapacity=0, canHoldSmallProps=False, solid=True,
        levelTag="09", themeTag="containment-maintenance", guiKit="level09_lockdown_override",
        guiBg=GUI_DIR / "level09/lockdown_override_background_image2.png")),
    ("room_l610_core_server_obelisk", build_core_server_obelisk, dict(
        label="核心服务器方尖碑", short="core_server_obelisk", family="cabinet", footprintFamily="column",
        mount="floor", clueCapacity=0, canHoldSmallProps=False, solid=True,
        levelTag="10", themeTag="core-terminal", guiKit="level10_final_protocol",
        guiBg=GUI_DIR / "level10/final_protocol_background_image2.png")),
    ("room_l610_specimen_glass_case", build_specimen_glass_case, dict(
        label="标本展柜", short="specimen_glass_case", family="display_case", footprintFamily="display_case",
        mount="floor", clueCapacity=1, canHoldSmallProps=True, solid=True,
        levelTag="08", themeTag="memory-theater", guiKit=None,
        guiBg=None)),
]


# --- Lightweight numpy iso render for contact sheet --------------------------
def _avg_color(geom):
    try:
        img = geom.visual.material.baseColorTexture
        arr = np.asarray(img.convert("RGB")).reshape(-1, 3)
        return tuple(int(c) for c in arr.mean(axis=0))
    except Exception:
        return (120, 124, 130)


def iso_render(scene, size=360):
    img = Image.new("RGBA", (size, size), (18, 20, 24, 255))
    d = ImageDraw.Draw(img)
    az, el = math.radians(35), math.radians(26)
    Rz = np.array([[math.cos(az), 0, math.sin(az)], [0, 1, 0], [-math.sin(az), 0, math.cos(az)]])
    Rx = np.array([[1, 0, 0], [0, math.cos(el), -math.sin(el)], [0, math.sin(el), math.cos(el)]])
    R = Rx @ Rz
    b = scene.bounds
    center = (b[0] + b[1]) / 2
    scale = size * 0.62 / max(b[1] - b[0])
    key = np.array([0.4, 0.8, 0.5]); key /= np.linalg.norm(key)
    faces_acc = []
    for geom in scene.geometry.values():
        if not hasattr(geom, "vertices"):
            continue
        col = np.array(_avg_color(geom))
        v = (np.asarray(geom.vertices) - center) @ R.T
        for f in geom.faces:
            tri = v[f]
            n = np.cross(tri[1] - tri[0], tri[2] - tri[0])
            ln = np.linalg.norm(n)
            if ln < 1e-9:
                continue
            n = n / ln
            shade = 0.35 + 0.65 * max(0.0, float(n @ key))
            depth = tri[:, 2].mean()
            pts = [(size / 2 + p[0] * scale, size / 2 - p[1] * scale) for p in tri]
            faces_acc.append((depth, pts, tuple(int(min(255, c * shade)) for c in col)))
    for _, pts, col in sorted(faces_acc, key=lambda t: t[0]):
        d.polygon(pts, fill=(*col, 255))
    return img


def make_contact_sheet(scenes, labels, atlas, cols=8):
    cols = min(cols, max(1, len(scenes)))
    tile = 300
    cell = tile + 34
    rows = (len(scenes) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * tile, rows * cell + 40), (12, 13, 16, 255))
    d = ImageDraw.Draw(sheet)
    for i, (sc, label) in enumerate(zip(scenes, labels)):
        cx, cy = (i % cols) * tile, (i // cols) * cell
        sheet.alpha_composite(iso_render(sc, tile), (cx, cy))
        d.text((cx + 6, cy + tile + 4), label[:46], fill=(214, 220, 228, 255))
    return sheet


# --- Main --------------------------------------------------------------------
def main():
    manifest_assets = []
    audit = []
    atlas_index = {}
    scenes, labels, atlases = [], [], []
    all_assets = ASSETS + load_spec_assets()

    for idx, (model_key, builder, spec) in enumerate(all_assets):
        atlas, regions, atlas_path = build_asset_atlas(spec["short"], spec["guiBg"], save_sources=(idx == 0))
        atlas_index[model_key] = {
            "atlas": str(atlas_path.relative_to(REPO)),
            "guiBackground": str(spec["guiBg"].relative_to(REPO)) if spec["guiBg"] else None,
            "guiKit": spec["guiKit"],
            "regions": regions,
        }
        scene, parts = builder(regions, atlas)
        size = finalize(scene)
        glb_path = GLB_DIR / f"{model_key}.glb"
        data = scene.export(file_type="glb")
        glb_path.write_bytes(data)

        # Texture audit (reload + list material baseColorTexture presence)
        reloaded = trimesh.load(trimesh.util.wrap_as_stream(data), file_type="glb")
        mats = []
        geoms = reloaded.geometry.values() if hasattr(reloaded, "geometry") else [reloaded]
        for g in geoms:
            mat = getattr(getattr(g, "visual", None), "material", None)
            mats.append({
                "material": getattr(mat, "name", None),
                "baseColorTexture": bool(getattr(mat, "baseColorTexture", None) is not None),
            })
        audit.append({"modelKey": model_key, "parts": parts, "sizeMeters": size,
                      "bytes": len(data), "materials": mats})

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
            "solid": spec.get("solid", True),
            "mount": spec.get("mount", "floor"),
            "canHoldSmallProps": spec.get("canHoldSmallProps", False),
            "clueCapacity": spec.get("clueCapacity", 0),
            "footprintFamily": spec["footprintFamily"],
            **({"wallPreferred": spec["wallPreferred"]} if spec.get("wallPreferred") else {}),
            "tags": [f"level:{spec['levelTag']}", f"theme:{spec['themeTag']}",
                     "style:image2", "kind:hero-machine",
                     f"family:{spec['family']}"] + ([f"gui:{spec['guiKit']}"] if spec.get("guiKit") else []),
        })
        scenes.append(scene)
        atlases.append(atlas)
        labels.append(f"{model_key}  {size[0]}x{size[1]}x{size[2]}m  {len(data)//1024}KB")
        print(f"wrote {glb_path.relative_to(REPO)}  parts={parts}  size={size}  {len(data)//1024}KB")

    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": PACK_LABEL,
        "sourceTool": "generate-level06-10-hero-assets.py",
        "generatedAt": "2026-06-13",
        "atlas": {
            "mode": "per-asset",
            "size": [ATLAS_SIZE, ATLAS_SIZE],
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
        },
        "guiImage2": "src/assets/gui/level06-10-gui-image2-manifest.json",
        "assets": manifest_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    ATLAS_REGIONS.write_text(json.dumps({
        "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
        "format": "[x, y, w, h] in pixels, top-left origin; one atlas per asset",
        "perAsset": atlas_index,
    }, indent=2) + "\n")
    (TMP_DIR / "glb-texture-audit.json").write_text(json.dumps(audit, indent=2) + "\n")

    sheet = make_contact_sheet(scenes, labels, atlases[0])
    sheet.convert("RGB").save(TMP_DIR / "level06-10-hero-contact-sheet.png")

    print(f"wrote {MANIFEST.relative_to(REPO)}  ({len(manifest_assets)} assets)")
    print(f"wrote {(TMP_DIR / 'level06-10-hero-contact-sheet.png').relative_to(REPO)}")
    print(f"wrote {(TMP_DIR / 'glb-texture-audit.json').relative_to(REPO)}")


if __name__ == "__main__":
    main()
