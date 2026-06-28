#!/usr/bin/env python3
"""Human Protocol Level 05 Reclamation Core - v3.2 hero furniture Image2 pack.

This generator is intentionally narrower and stricter than the removed v2 pack
and the v3 texture-negative case:

* It consumes five real Image2-generated parts sheets copied into provenance.
* Every region produces a transparent cutout PNG before atlas packing.
* Every atlas region has a semantic name plus source-sheet crop coordinates.
* GLB meshes use named regions with real area UVs, not center-color sampling.
* Geometry is a first-pass hero batch: five critical-path assets with many
  named parts, bevels, cylinders, lenses, trim, pads, and screw details.

Run:
    python3 scripts/asset-build/generate-level05-reclamation-furniture-image2-v3-hero-assets.py
"""

from __future__ import annotations

import json
import math
import os
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import trimesh
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

from hp_image2_pbr_maps import derive_pbr_maps


REPO = Path(__file__).resolve().parents[2]
TEX_DIR = REPO / "src/assets/textures/environment/level05-reclamation-furniture-image2-v3"
SRC_DIR = TEX_DIR / "image2-sources"
CUTOUT_DIR = TEX_DIR / "image2-cutouts"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level05-reclamation-furniture-image2-v3-hero"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_hero.json"
TMP_DIR = REPO / ".tmp/level05-reclamation-furniture-image2-v3-hero"
REPORT_DIR = REPO / "src/assets/manifests/reports"

ATLAS_SIZE = 2048
CELL = 256
ATLAS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_hero_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_hero_atlas.regions.json"
PBR_NORMAL_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_hero_normal.png"
PBR_METALLIC_ROUGHNESS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_hero_metallicroughness.png"
PBR_OCCLUSION_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_hero_occlusion.png"
PROMPT_LEDGER = REPORT_DIR / "level05_reclamation_furniture_image2_v3_hero_prompt_ledger.md"
PROVENANCE_JSON = REPORT_DIR / "level05_reclamation_furniture_image2_v3_hero_source_provenance.json"

PACK_ID = "hp_level05_reclamation_furniture_image2_v3_hero"
SOURCE_ID = "level05-reclamation-furniture-image2-v3-hero"
THEME_ID = "hp_reclamation_core_v3"
GROUP = "核心"
PBR_MAPS: dict[str, Image.Image] = {}

for directory in (TEX_DIR, SRC_DIR, CUTOUT_DIR, GLB_DIR, MANIFEST.parent, TMP_DIR, REPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


SOURCE_SHEETS = {
    "gate": {
        "file": "intake_identity_gate_parts_image2.png",
        "modelKey": "room_l5_v3_intake_identity_gate",
        "prompt": (
            "High-detail orthographic Image2 parts sheet for a sci-fi intake "
            "identity gate: black ribbed fabric pads, white ceramic curved "
            "panels, graphite frames, brass trim, cyan biometric glass lenses, "
            "gaskets, screws, isolated parts on neutral background."
        ),
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/"
            "ig_0373a8457b231815016a3fdc4197588199941c9d6ff0e893a4.png"
        ),
    },
    "monolith": {
        "file": "three_lock_monolith_parts_image2.png",
        "modelKey": "room_l5_v3_three_lock_monolith",
        "prompt": (
            "High-detail orthographic Image2 parts sheet for a three-lock "
            "monolith: sculpted graphite panels, three mechanical lock rings, "
            "brass rims, cyan and amber lenses, ceramic fins, black padded "
            "strips, screws and gaskets."
        ),
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/"
            "ig_0b916caec4914cd3016a3fdc83922c8199ae8875f77683159f.png"
        ),
    },
    "table": {
        "file": "core_route_map_table_parts_image2.png",
        "modelKey": "room_l5_v3_core_route_map_table",
        "prompt": (
            "High-detail orthographic Image2 parts sheet for a core route map "
            "table: black glass map panels with subtle cyan line glow, white "
            "ceramic rim arcs, graphite pedestal shells, padded anemone rolls, "
            "brass brackets, cyan edge lenses."
        ),
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/"
            "ig_0b916caec4914cd3016a3fdcb879fc819981503f75bdc452e5.png"
        ),
    },
    "vault": {
        "file": "release_key_vault_parts_image2.png",
        "modelKey": "room_l5_v3_release_key_vault",
        "prompt": (
            "High-detail orthographic Image2 parts sheet for a three-key release "
            "vault: white ceramic door panels, dark graphite door slab, brass "
            "key sockets with cyan rings, black padded bolsters, hinges, "
            "drawers, screws and gaskets."
        ),
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/"
            "ig_0b916caec4914cd3016a3fdcfdad648199ab42fe089893c75d.png"
        ),
    },
    "altar": {
        "file": "reclamation_core_altar_parts_image2.png",
        "modelKey": "room_l5_v3_reclamation_core_altar",
        "prompt": (
            "High-detail orthographic Image2 parts sheet for a reclamation core "
            "altar: layered cyan glass core lens, amber secondary lens, graphite "
            "pedestal panels, white ceramic petal fins, black ribbed cushion "
            "arcs, brass rings, sockets, screws and light strips."
        ),
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/"
            "ig_0b916caec4914cd3016a3fdd38013481998fcb77a4bcbe8bda.png"
        ),
    },
}


@dataclass(frozen=True)
class RegionSpec:
    region_id: str
    source_id: str
    crop: tuple[int, int, int, int]
    note: str


REGION_SPECS = [
    # Intake gate sheet.
    RegionSpec("gate_black_ribbed_pad", "gate", (12, 18, 220, 760), "large stitched black fabric side pad"),
    RegionSpec("gate_white_ceramic_panel", "gate", (455, 24, 220, 435), "curved white ceramic panel"),
    RegionSpec("gate_graphite_round_frame", "gate", (1090, 84, 415, 320), "rounded graphite scanner frame"),
    RegionSpec("gate_brass_trim_bar", "gate", (1088, 468, 420, 84), "brushed brass horizontal trim"),
    RegionSpec("gate_cyan_biometric_lens", "gate", (458, 720, 390, 145), "cyan glass biometric lens"),
    RegionSpec("gate_black_gasket_bar", "gate", (28, 808, 392, 94), "black gasket bars and thin rails"),
    RegionSpec("gate_status_light_bank", "gate", (1000, 724, 430, 120), "amber white cyan red status light parts"),

    # Monolith sheet.
    RegionSpec("monolith_graphite_body", "monolith", (330, 18, 260, 720), "sculpted graphite monolith body"),
    RegionSpec("monolith_lock_ring_graphite", "monolith", (592, 22, 205, 205), "brass and graphite lock ring"),
    RegionSpec("monolith_cyan_lens_ring", "monolith", (592, 235, 205, 205), "cyan active lock lens"),
    RegionSpec("monolith_amber_lens_ring", "monolith", (592, 448, 205, 205), "amber warning lock lens"),
    RegionSpec("monolith_white_ceramic_fin", "monolith", (836, 82, 165, 335), "curved white ceramic side fin"),
    RegionSpec("monolith_black_ribbed_pad", "monolith", (1118, 34, 165, 690), "tall stitched black pad"),
    RegionSpec("monolith_brass_handle", "monolith", (585, 806, 140, 58), "small brass handles and bars"),

    # Route map table sheet.
    RegionSpec("table_black_glass_map_top", "table", (18, 26, 855, 205), "black glass tabletop with cyan route lines"),
    RegionSpec("table_black_glass_map_side", "table", (20, 260, 855, 165), "secondary black glass map surface"),
    RegionSpec("table_cyan_edge_lens", "table", (20, 452, 450, 78), "cyan glass edge strip"),
    RegionSpec("table_white_ceramic_rim", "table", (536, 452, 410, 64), "curved white ceramic rim strip"),
    RegionSpec("table_graphite_pedestal_shell", "table", (1140, 40, 280, 350), "curved graphite pedestal shell"),
    RegionSpec("table_black_soft_roll", "table", (530, 604, 155, 280), "stitched black padded roll"),
    RegionSpec("table_brass_connector", "table", (1030, 460, 122, 330), "brass connector plates"),

    # Release vault sheet.
    RegionSpec("vault_black_ribbed_pad", "vault", (18, 18, 190, 760), "large black stitched side bolster"),
    RegionSpec("vault_white_ceramic_door", "vault", (388, 20, 220, 425), "white ceramic vault door panel"),
    RegionSpec("vault_graphite_door_slab", "vault", (618, 20, 350, 438), "dark graphite main safe door"),
    RegionSpec("vault_key_socket_cyan", "vault", (1248, 18, 160, 160), "brass key socket with cyan ring"),
    RegionSpec("vault_brass_hinge_handle", "vault", (452, 600, 350, 90), "brass handle and hinge rods"),
    RegionSpec("vault_cyan_window", "vault", (804, 708, 300, 122), "cyan inspection glass window"),
    RegionSpec("vault_black_drawer_inset", "vault", (1200, 618, 310, 126), "black recessed drawer tray"),

    # Core altar sheet.
    RegionSpec("altar_cyan_core_lens", "altar", (18, 16, 315, 315), "large layered cyan energy core lens"),
    RegionSpec("altar_amber_lens", "altar", (350, 20, 180, 180), "amber secondary glass lens"),
    RegionSpec("altar_graphite_pedestal_panel", "altar", (565, 25, 340, 360), "curved graphite pedestal shell panel"),
    RegionSpec("altar_white_ceramic_petal", "altar", (54, 322, 292, 260), "white ceramic petal fins"),
    RegionSpec("altar_black_padded_arc", "altar", (382, 470, 430, 176), "stitched black padded arc"),
    RegionSpec("altar_brass_ring_segment", "altar", (1278, 18, 190, 165), "brass circular ring segment"),
    RegionSpec("altar_socket_panel", "altar", (1078, 392, 180, 110), "black connector socket panel"),
]


def load_source_sheets() -> dict[str, Image.Image]:
    images: dict[str, Image.Image] = {}
    for source_id, info in SOURCE_SHEETS.items():
        path = SRC_DIR / info["file"]
        if not path.exists():
            raise FileNotFoundError(f"missing Image2 source sheet: {path}")
        images[source_id] = Image.open(path).convert("RGBA")
    return images


def _border_connected_background_mask(rgb: np.ndarray) -> np.ndarray:
    """Find light studio background connected to crop edges."""
    rgb16 = rgb.astype(np.int16)
    brightness = rgb16.mean(axis=2)
    chroma = rgb16.max(axis=2) - rgb16.min(axis=2)
    candidate = ((brightness > 224) & (chroma < 42)) | (brightness > 246)
    h, w = candidate.shape
    seen = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        if candidate[0, x]:
            queue.append((0, x))
        if candidate[h - 1, x]:
            queue.append((h - 1, x))
    for y in range(h):
        if candidate[y, 0]:
            queue.append((y, 0))
        if candidate[y, w - 1]:
            queue.append((y, w - 1))

    while queue:
        y, x = queue.popleft()
        if y < 0 or y >= h or x < 0 or x >= w or seen[y, x] or not candidate[y, x]:
            continue
        seen[y, x] = True
        queue.extend(((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)))
    return seen


def make_transparent_cutout(crop: Image.Image) -> tuple[Image.Image, dict[str, float | int]]:
    rgba = crop.convert("RGBA")
    arr = np.array(rgba)
    bg = _border_connected_background_mask(arr[:, :, :3])
    alpha_hard = np.full(bg.shape, 255, dtype=np.uint8)
    alpha_hard[bg] = 0
    alpha = Image.fromarray(alpha_hard).filter(ImageFilter.GaussianBlur(0.75))
    out = arr.copy()
    out[:, :, 3] = np.array(alpha, dtype=np.uint8)
    transparent = int((out[:, :, 3] < 250).sum())
    total = int(out.shape[0] * out.shape[1])
    return Image.fromarray(out), {
        "transparentPixelsLt250": transparent,
        "opaquePixelsGte250": total - transparent,
        "transparentRatio": round(transparent / max(1, total), 4),
    }


def matte_from_cutout(cutout: Image.Image) -> tuple[Image.Image, list[int]]:
    arr = np.array(cutout.convert("RGBA"))
    visible = arr[:, :, 3] > 24
    if visible.any():
        rgb = np.median(arr[:, :, :3][visible], axis=0).astype(np.uint8)
    else:
        rgb = np.array([34, 36, 38], dtype=np.uint8)
    matte = Image.new("RGBA", cutout.size, (int(rgb[0]), int(rgb[1]), int(rgb[2]), 255))
    matte.alpha_composite(cutout)
    return matte, [int(rgb[0]), int(rgb[1]), int(rgb[2])]


def build_atlas() -> tuple[Image.Image, dict[str, dict]]:
    images = load_source_sheets()
    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (0, 0, 0, 0))
    regions: dict[str, dict] = {}

    for index, spec in enumerate(REGION_SPECS):
        col = index % (ATLAS_SIZE // CELL)
        row = index // (ATLAS_SIZE // CELL)
        ax, ay = col * CELL, row * CELL
        source = images[spec.source_id]
        x, y, w, h = spec.crop
        raw_crop = source.crop((x, y, x + w, y + h))
        cutout, cutout_stats = make_transparent_cutout(raw_crop)
        cutout_path = CUTOUT_DIR / f"{spec.region_id}.png"
        cutout.save(cutout_path)
        matte, matte_rgb = matte_from_cutout(cutout)
        crop = matte.resize((CELL, CELL), Image.LANCZOS)
        atlas.paste(crop, (ax, ay))
        regions[spec.region_id] = {
            "atlasRect": [ax, ay, CELL, CELL],
            "sourceId": spec.source_id,
            "sourceModelKey": SOURCE_SHEETS[spec.source_id]["modelKey"],
            "sourceImage2Sheet": str((SRC_DIR / SOURCE_SHEETS[spec.source_id]["file"]).relative_to(REPO)),
            "sourceCrop": [x, y, w, h],
            "transparentCutout": str(cutout_path.relative_to(REPO)),
            "alphaCutApplied": True,
            "alphaCutStats": cutout_stats,
            "atlasTileMode": "transparent-cutout-composited-on-region-median-matte",
            "atlasMatteRgb": matte_rgb,
            "note": spec.note,
            "image2Assert": True,
        }

    ATLAS_PNG.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(ATLAS_PNG)
    ATLAS_REGIONS.write_text(
        json.dumps(
            {
                "schemaVersion": "hp.image2.semanticAtlasRegions.v1.1",
                "atlas": str(ATLAS_PNG.relative_to(REPO)),
                "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
                "cellSize": CELL,
                "sourceSheets": {
                    key: {
                        "file": str((SRC_DIR / value["file"]).relative_to(REPO)),
                        "modelKey": value["modelKey"],
                        "prompt": value["prompt"],
                        "generatedCache": value["generatedCache"],
                    }
                    for key, value in SOURCE_SHEETS.items()
                },
                "regions": regions,
            },
            indent=2,
        )
        + "\n",
    )
    return atlas, regions


def _uv_rect(region_id: str, regions: dict[str, dict]) -> tuple[float, float, float, float]:
    x, y, w, h = regions[region_id]["atlasRect"]
    # glTF texture coordinates use v=0 at the bottom; atlas rects are recorded
    # in PNG pixels from the top-left. Flip Y here once so every helper samples
    # the intended Image2 region instead of the row below it.
    return x / ATLAS_SIZE, 1.0 - ((y + h) / ATLAS_SIZE), (x + w) / ATLAS_SIZE, 1.0 - (y / ATLAS_SIZE)


def _uv_center(region_id: str, regions: dict[str, dict]) -> tuple[float, float]:
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    return (u0 + u1) / 2, (v0 + v1) / 2


def material(region_id: str, atlas: Image.Image, metallic=0.05, roughness=0.55) -> PBRMaterial:
    return PBRMaterial(
        name=region_id,
        baseColorTexture=atlas,
        normalTexture=PBR_MAPS.get("normal"),
        occlusionTexture=PBR_MAPS.get("occlusion"),
        metallicRoughnessTexture=PBR_MAPS.get("metallicRoughness"),
        metallicFactor=metallic,
        roughnessFactor=roughness,
        baseColorFactor=[1.0, 1.0, 1.0, 1.0],
    )


def set_pbr_maps(atlas: Image.Image) -> None:
    global PBR_MAPS
    PBR_MAPS = derive_pbr_maps(atlas, PBR_NORMAL_PNG, PBR_METALLIC_ROUGHNESS_PNG, PBR_OCCLUSION_PNG)


def _normalise(values: np.ndarray) -> np.ndarray:
    lo = float(values.min())
    hi = float(values.max())
    if hi - lo < 1e-8:
        return np.full(values.shape, 0.5, dtype=np.float64)
    return (values - lo) / (hi - lo)


def _uv_from_unit(region_id: str, regions: dict[str, dict], u_unit: np.ndarray, v_unit: np.ndarray) -> np.ndarray:
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    return np.column_stack((u0 + u_unit * (u1 - u0), v1 - v_unit * (v1 - v0)))


def _box_project_uv(mesh: trimesh.Trimesh, region_id: str, regions: dict[str, dict]) -> np.ndarray:
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    spans = np.ptp(verts, axis=0)
    axes = np.argsort(spans)[-2:]
    u_axis, v_axis = int(axes[1]), int(axes[0])
    return _uv_from_unit(region_id, regions, _normalise(verts[:, u_axis]), _normalise(verts[:, v_axis]))


def _cylinder_project_uv(mesh: trimesh.Trimesh, region_id: str, regions: dict[str, dict], axis: str) -> np.ndarray:
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    if axis == "y":
        height_values = verts[:, 1]
        angle = np.arctan2(verts[:, 2], verts[:, 0])
    elif axis == "x":
        height_values = verts[:, 0]
        angle = np.arctan2(verts[:, 2], verts[:, 1])
    elif axis == "z":
        height_values = verts[:, 2]
        angle = np.arctan2(verts[:, 1], verts[:, 0])
    else:
        raise ValueError(f"unsupported cylinder axis {axis}")
    u_unit = (angle + math.pi) / math.tau
    v_unit = _normalise(height_values)
    return _uv_from_unit(region_id, regions, u_unit, v_unit)


def _cylinder_z_with_cap_uv(radius: float, height: float, region_id: str, regions: dict[str, dict], sections: int) -> trimesh.Trimesh:
    verts: list[list[float]] = []
    u_units: list[float] = []
    v_units: list[float] = []
    faces: list[list[int]] = []
    half = height / 2.0

    for i in range(sections + 1):
        a = math.tau * i / sections
        x, y = math.cos(a) * radius, math.sin(a) * radius
        u = i / sections
        base = len(verts)
        verts.extend([[x, y, -half], [x, y, half]])
        u_units.extend([u, u])
        v_units.extend([0.0, 1.0])
        if i < sections:
            faces.extend([[base, base + 2, base + 3], [base, base + 3, base + 1]])

    top_center = len(verts)
    verts.append([0.0, 0.0, half])
    u_units.append(0.5)
    v_units.append(0.5)
    top_start = len(verts)
    for i in range(sections):
        a = math.tau * i / sections
        x, y = math.cos(a) * radius, math.sin(a) * radius
        verts.append([x, y, half])
        u_units.append(0.5 + math.cos(a) * 0.48)
        v_units.append(0.5 + math.sin(a) * 0.48)
    for i in range(sections):
        faces.append([top_center, top_start + i, top_start + ((i + 1) % sections)])

    bottom_center = len(verts)
    verts.append([0.0, 0.0, -half])
    u_units.append(0.5)
    v_units.append(0.5)
    bottom_start = len(verts)
    for i in range(sections):
        a = math.tau * i / sections
        x, y = math.cos(a) * radius, math.sin(a) * radius
        verts.append([x, y, -half])
        u_units.append(0.5 + math.cos(a) * 0.48)
        v_units.append(0.5 + math.sin(a) * 0.48)
    for i in range(sections):
        faces.append([bottom_center, bottom_start + ((i + 1) % sections), bottom_start + i])

    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)
    mesh.visual = TextureVisuals(
        uv=_uv_from_unit(region_id, regions, np.array(u_units), np.array(v_units)),
        material=None,
    )
    return mesh


def _sphere_project_uv(mesh: trimesh.Trimesh, region_id: str, regions: dict[str, dict]) -> np.ndarray:
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    center = (verts.min(axis=0) + verts.max(axis=0)) / 2
    rel = verts - center
    angle = np.arctan2(rel[:, 2], rel[:, 0])
    u_unit = (angle + math.pi) / math.tau
    v_unit = _normalise(rel[:, 1])
    return _uv_from_unit(region_id, regions, u_unit, v_unit)


_FACE_SPECS = (
    ("px", 0, 1),
    ("nx", 0, -1),
    ("py", 1, 1),
    ("ny", 1, -1),
    ("pz", 2, 1),
    ("nz", 2, -1),
)


def _tag(mesh: trimesh.Trimesh, region_id: str) -> trimesh.Trimesh:
    mesh.metadata["region_id"] = region_id
    return mesh


def face_box(extents, region_id: str, regions: dict[str, dict], atlas: Image.Image, faces=None, metallic=0.05, roughness=0.55):
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
    mat = material(region_id, atlas, metallic=metallic, roughness=roughness)
    mesh.visual = TextureVisuals(uv=np.array(uvs), material=mat, image=atlas)
    return _tag(mesh, region_id)


def bevel_box(extents, region_id: str, regions: dict[str, dict], atlas: Image.Image, bevel=0.025, metallic=0.05, roughness=0.55):
    hx, hy, hz = (e / 2.0 for e in extents)
    b = min(bevel, hx * 0.48, hy * 0.48, hz * 0.48)
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((sx * (hx - b), sy * hy, sz * hz))
                pts.append((sx * hx, sy * (hy - b), sz * hz))
                pts.append((sx * hx, sy * hy, sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(pts)).convex_hull
    mat = material(region_id, atlas, metallic=metallic, roughness=roughness)
    mesh.visual = TextureVisuals(uv=_box_project_uv(mesh, region_id, regions), material=mat, image=atlas)
    return _tag(mesh, region_id)


def cyl(radius, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=48, axis="y", metallic=0.1, roughness=0.45):
    mesh = _cylinder_z_with_cap_uv(radius, height, region_id, regions, sections)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    elif axis == "z":
        pass
    else:
        raise ValueError(f"unsupported cylinder axis {axis}")
    mat = material(region_id, atlas, metallic=metallic, roughness=roughness)
    mesh.visual = TextureVisuals(uv=np.asarray(mesh.visual.uv), material=mat, image=atlas)
    return _tag(mesh, region_id)


def disc_y(radius, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=96, metallic=0.05, roughness=0.18):
    verts = [[0.0, 0.0, 0.0]]
    u_units = [0.5]
    v_units = [0.5]
    faces = []
    for i in range(sections):
        a = math.tau * i / sections
        verts.append([math.cos(a) * radius, 0.0, math.sin(a) * radius])
        u_units.append(0.5 + math.cos(a) * 0.48)
        v_units.append(0.5 + math.sin(a) * 0.48)
    for i in range(sections):
        faces.append([0, 1 + ((i + 1) % sections), 1 + i])
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)
    mat = material(region_id, atlas, metallic=metallic, roughness=roughness)
    mesh.visual = TextureVisuals(
        uv=_uv_from_unit(region_id, regions, np.array(u_units), np.array(v_units)),
        material=mat,
        image=atlas,
    )
    return _tag(mesh, region_id)


def sphere(radius, region_id: str, regions: dict[str, dict], atlas: Image.Image, scale=(1, 1, 1), subdivisions=2, metallic=0.05, roughness=0.35):
    mesh = trimesh.creation.icosphere(radius=radius, subdivisions=subdivisions)
    mesh.apply_scale(scale)
    mat = material(region_id, atlas, metallic=metallic, roughness=roughness)
    mesh.visual = TextureVisuals(uv=_sphere_project_uv(mesh, region_id, regions), material=mat, image=atlas)
    return _tag(mesh, region_id)


def ring_disc(outer, inner, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, axis="z", sections=72, metallic=0.5, roughness=0.38):
    outer_mesh = cyl(outer, height, region_id, regions, atlas, sections=sections, axis=axis, metallic=metallic, roughness=roughness)
    inner_mesh = cyl(inner, height * 1.08, region_id, regions, atlas, sections=sections, axis=axis, metallic=metallic, roughness=roughness)
    # Convex primitives stay separate; this reads as a ring plus dark center in Raw.
    return [outer_mesh, inner_mesh]


def place(mesh, translate=(0, 0, 0), rotate=None):
    if rotate:
        angle, axis = rotate
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(translate)
    return mesh


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def add_screws(scene, regions, atlas, region_id, positions, radius=0.028, depth=0.018, axis="z"):
    for i, pos in enumerate(positions):
        add(scene, place(cyl(radius, depth, region_id, regions, atlas, sections=20, axis=axis, metallic=0.45), pos), f"screw_{i:02d}_{region_id}")


def ribbed_pad(scene, prefix, center, size, region_id, regions, atlas, ribs=4, axis="vertical"):
    x, y, z = center
    sx, sy, sz = size
    add(scene, place(bevel_box([sx, sy, sz], region_id, regions, atlas, bevel=0.07, roughness=0.82), center), f"{prefix}_pad_backing")
    if axis == "vertical":
        step = sx / (ribs + 1)
        for i in range(ribs):
            rx = x - sx / 2 + step * (i + 1)
            add(scene, place(cyl(step * 0.28, sy * 0.92, region_id, regions, atlas, sections=28, axis="y", roughness=0.9), (rx, y, z - sz * 0.58)), f"{prefix}_raised_vertical_rib_{i}")
    else:
        step = sy / (ribs + 1)
        for i in range(ribs):
            ry = y - sy / 2 + step * (i + 1)
            add(scene, place(cyl(step * 0.22, sx * 0.9, region_id, regions, atlas, sections=28, axis="x", roughness=0.9), (x, ry, z - sz * 0.58)), f"{prefix}_raised_horizontal_rib_{i}")


def finalize(scene: trimesh.Scene):
    bounds = scene.bounds
    cx = (bounds[0][0] + bounds[1][0]) / 2
    cz = (bounds[0][2] + bounds[1][2]) / 2
    miny = bounds[0][1]
    delta = np.array([-cx, -miny, -cz], dtype=np.float64)
    for geom in scene.geometry.values():
        geom.vertices += delta
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(v), 3) for v in size]


def build_intake_identity_gate(regions, atlas):
    s = trimesh.Scene()
    ribbed_pad(s, "left", (-1.28, 1.34, -0.05), (0.42, 2.48, 0.18), "gate_black_ribbed_pad", regions, atlas, ribs=4)
    ribbed_pad(s, "right", (1.28, 1.34, -0.05), (0.42, 2.48, 0.18), "gate_black_ribbed_pad", regions, atlas, ribs=4)

    for x, angle in ((-0.46, math.radians(-8)), (0.46, math.radians(8))):
        add(s, place(bevel_box([0.46, 2.18, 0.08], "gate_white_ceramic_panel", regions, atlas, bevel=0.045, roughness=0.38), (x, 1.42, -0.16), (angle, (0, 1, 0))), f"curved_ceramic_leaf_{x}")
        add(s, place(bevel_box([0.055, 2.1, 0.065], "gate_brass_trim_bar", regions, atlas, bevel=0.014, metallic=0.75), (x + (0.26 if x < 0 else -0.26), 1.42, -0.205), (angle, (0, 1, 0))), f"ceramic_brass_edge_{x}")

    add(s, place(bevel_box([2.42, 0.12, 0.18], "gate_graphite_round_frame", regions, atlas, bevel=0.035, metallic=0.42), (0, 2.62, -0.08)), "top_graphite_frame")
    add(s, place(bevel_box([2.42, 0.12, 0.18], "gate_graphite_round_frame", regions, atlas, bevel=0.035, metallic=0.42), (0, 0.18, -0.08)), "bottom_graphite_frame")
    for x in (-0.88, 0.88):
        add(s, place(bevel_box([0.10, 2.28, 0.13], "gate_graphite_round_frame", regions, atlas, bevel=0.028, metallic=0.42), (x, 1.38, -0.08)), f"inner_graphite_stile_{x}")
    add(s, place(bevel_box([1.18, 0.28, 0.075], "gate_cyan_biometric_lens", regions, atlas, bevel=0.09, roughness=0.18), (0, 1.34, -0.235)), "cyan_biometric_lens")
    add(s, place(bevel_box([1.45, 0.08, 0.05], "gate_brass_trim_bar", regions, atlas, bevel=0.018, metallic=0.75), (0, 1.08, -0.26)), "lower_brass_trim")
    add(s, place(bevel_box([1.45, 0.08, 0.05], "gate_black_gasket_bar", regions, atlas, bevel=0.016, roughness=0.7), (0, 1.62, -0.26)), "upper_black_gasket")
    for i, x in enumerate(np.linspace(-0.42, 0.42, 5)):
        add(s, place(bevel_box([0.10, 0.22, 0.045], "gate_status_light_bank", regions, atlas, bevel=0.035), (x, 0.55, -0.265)), f"status_lens_{i}")
    add_screws(s, regions, atlas, "gate_brass_trim_bar", [(-1.42, 2.62, -0.21), (1.42, 2.62, -0.21), (-1.42, 0.18, -0.21), (1.42, 0.18, -0.21)], radius=0.022)
    return s, 30


def build_three_lock_monolith(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([0.92, 2.28, 0.28], "monolith_graphite_body", regions, atlas, bevel=0.065, metallic=0.42), (0, 1.16, 0)), "sculpted_graphite_body")
    for x in (-0.48, 0.48):
        add(s, place(bevel_box([0.12, 2.14, 0.16], "monolith_brass_handle", regions, atlas, bevel=0.026, metallic=0.75), (x, 1.18, -0.10)), f"vertical_brass_edge_{x}")
    for x in (-0.58, 0.58):
        ribbed_pad(s, f"side_{x}", (x, 1.18, -0.05), (0.25, 2.08, 0.16), "monolith_black_ribbed_pad", regions, atlas, ribs=3)
    for x in (-0.74, 0.74):
        add(s, place(bevel_box([0.20, 1.55, 0.08], "monolith_white_ceramic_fin", regions, atlas, bevel=0.038), (x, 1.18, -0.10), (math.radians(8 if x < 0 else -8), (0, 1, 0))), f"white_side_fin_{x}")

    for i, (y, lens_region) in enumerate(((0.63, "monolith_lock_ring_graphite"), (1.16, "monolith_cyan_lens_ring"), (1.69, "monolith_amber_lens_ring"))):
        add(s, place(cyl(0.245, 0.055, "monolith_lock_ring_graphite", regions, atlas, sections=72, axis="z", metallic=0.65), (0, y, -0.185)), f"lock_outer_ring_{i}")
        add(s, place(cyl(0.145, 0.065, lens_region, regions, atlas, sections=72, axis="z", metallic=0.2), (0, y, -0.225)), f"lock_status_lens_{i}")
        add(s, place(cyl(0.052, 0.085, "monolith_graphite_body", regions, atlas, sections=36, axis="z", metallic=0.4), (0, y, -0.265)), f"lock_center_knob_{i}")
        add_screws(s, regions, atlas, "monolith_brass_handle", [(-0.19, y + 0.18, -0.275), (0.19, y + 0.18, -0.275), (-0.19, y - 0.18, -0.275), (0.19, y - 0.18, -0.275)], radius=0.018)
    add(s, place(bevel_box([0.72, 0.10, 0.08], "monolith_brass_handle", regions, atlas, bevel=0.02, metallic=0.75), (0, 2.24, -0.18)), "top_brass_handle")
    add(s, place(bevel_box([0.72, 0.10, 0.08], "monolith_brass_handle", regions, atlas, bevel=0.02, metallic=0.75), (0, 0.10, -0.18)), "bottom_brass_handle")
    return s, 45


def build_core_route_map_table(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([1.86, 0.11, 1.02], "table_black_glass_map_top", regions, atlas, bevel=0.045, roughness=0.18), (0, 0.94, 0)), "black_glass_route_map_top")
    add(s, place(bevel_box([1.62, 0.055, 0.77], "table_black_glass_map_side", regions, atlas, bevel=0.025, roughness=0.2), (0, 1.02, 0)), "raised_secondary_glass")
    for z in (-0.55, 0.55):
        add(s, place(bevel_box([1.74, 0.09, 0.08], "table_white_ceramic_rim", regions, atlas, bevel=0.03), (0, 0.98, z)), f"ceramic_long_rim_{z}")
    for x in (-0.96, 0.96):
        add(s, place(bevel_box([0.08, 0.09, 0.84], "table_brass_connector", regions, atlas, bevel=0.022, metallic=0.75), (x, 0.985, 0)), f"brass_end_band_{x}")
    add(s, place(bevel_box([0.92, 0.72, 0.48], "table_graphite_pedestal_shell", regions, atlas, bevel=0.08, metallic=0.42), (0, 0.44, 0)), "curved_graphite_pedestal")
    add(s, place(bevel_box([1.16, 0.13, 0.66], "table_graphite_pedestal_shell", regions, atlas, bevel=0.045, metallic=0.42), (0, 0.83, 0.13)), "graphite_top_collar_bridge")
    add(s, place(bevel_box([1.50, 0.055, 0.92], "table_black_glass_map_side", regions, atlas, bevel=0.018, roughness=0.28), (0, 0.885, 0.18)), "shadowed_under_table_plate")
    for x in (-0.38, -0.13, 0.13, 0.38):
        add(s, place(cyl(0.055, 0.78, "table_black_soft_roll", regions, atlas, sections=36, axis="z", roughness=0.9), (x, 0.74, -0.62)), f"front_padded_roll_{x}")
    for x in (-0.52, 0.52):
        add(s, place(bevel_box([0.14, 0.60, 0.13], "table_cyan_edge_lens", regions, atlas, bevel=0.06, roughness=0.16), (x, 0.56, -0.31)), f"cyan_pedestal_lens_{x}")
    for x in (-0.48, 0.48):
        add(s, place(bevel_box([0.18, 0.14, 0.10], "table_brass_connector", regions, atlas, bevel=0.025, metallic=0.75), (x, 0.84, -0.31)), f"brass_upper_bracket_{x}")
    for x, z in ((-0.58, -0.28), (0.58, -0.28), (-0.58, 0.44), (0.58, 0.44)):
        add(s, place(bevel_box([0.16, 0.17, 0.08], "table_brass_connector", regions, atlas, bevel=0.018, metallic=0.75), (x, 0.79, z)), f"visible_brass_support_foot_{x}_{z}")
    add_screws(s, regions, atlas, "table_brass_connector", [(-0.78, 1.05, -0.58), (0.78, 1.05, -0.58), (-0.78, 1.05, 0.58), (0.78, 1.05, 0.58)], radius=0.018)
    return s, 38


def build_release_key_vault(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([1.22, 1.48, 0.48], "vault_graphite_door_slab", regions, atlas, bevel=0.07, metallic=0.42), (0, 0.82, 0)), "graphite_vault_body")
    add(s, place(bevel_box([1.36, 1.60, 0.14], "vault_black_drawer_inset", regions, atlas, bevel=0.045, roughness=0.72), (0, 0.86, -0.18)), "shadow_gap_behind_front_door_frame")
    for x in (-0.78, 0.78):
        ribbed_pad(s, f"vault_pad_{x}", (x, 0.84, -0.03), (0.26, 1.48, 0.18), "vault_black_ribbed_pad", regions, atlas, ribs=3)
    for x in (-0.58, 0.58):
        add(s, place(bevel_box([0.095, 1.50, 0.075], "vault_black_drawer_inset", regions, atlas, bevel=0.018, roughness=0.78), (x, 0.90, -0.355)), f"outer_vertical_black_door_gasket_{x}")
    for y in (0.30, 1.52):
        add(s, place(bevel_box([1.02, 0.075, 0.075], "vault_black_drawer_inset", regions, atlas, bevel=0.018, roughness=0.78), (0, y, -0.355)), f"outer_horizontal_black_door_gasket_{y}")
    add(s, place(bevel_box([0.045, 1.18, 0.065], "vault_black_drawer_inset", regions, atlas, bevel=0.014, roughness=0.82), (0, 0.93, -0.385)), "thin_center_door_split_shadow")
    for x in (-0.32, 0.32):
        add(s, place(bevel_box([0.34, 1.22, 0.055], "vault_white_ceramic_door", regions, atlas, bevel=0.04), (x, 0.93, -0.28), (math.radians(5 if x < 0 else -5), (0, 1, 0))), f"white_ceramic_door_leaf_{x}")
    for i, y in enumerate((0.55, 0.90, 1.25)):
        add(s, place(bevel_box([0.42, 0.24, 0.045], "vault_black_drawer_inset", regions, atlas, bevel=0.035, roughness=0.62), (0.02, y, -0.350)), f"recessed_socket_shadow_plate_{i}")
        add(s, place(cyl(0.145, 0.055, "vault_key_socket_cyan", regions, atlas, sections=64, axis="z", metallic=0.6), (0.02, y, -0.335)), f"release_key_socket_{i}")
        add(s, place(cyl(0.055, 0.065, "vault_cyan_window", regions, atlas, sections=40, axis="z", roughness=0.16), (0.02, y, -0.375)), f"release_key_cyan_core_{i}")
        add(s, place(bevel_box([0.26, 0.036, 0.050], "vault_brass_hinge_handle", regions, atlas, bevel=0.012, metallic=0.78), (0.02, y + 0.17, -0.392)), f"brass_socket_alignment_tick_top_{i}")
        add(s, place(bevel_box([0.26, 0.036, 0.050], "vault_brass_hinge_handle", regions, atlas, bevel=0.012, metallic=0.78), (0.02, y - 0.17, -0.392)), f"brass_socket_alignment_tick_bottom_{i}")
    for y in (0.48, 1.18):
        add(s, place(cyl(0.055, 0.86, "vault_brass_hinge_handle", regions, atlas, sections=36, axis="x", metallic=0.75), (0, y, -0.38)), f"horizontal_brass_handle_{y}")
    for x in (0.58,):
        add(s, place(cyl(0.07, 1.16, "vault_brass_hinge_handle", regions, atlas, sections=40, axis="y", metallic=0.75), (x, 0.88, -0.31)), "right_vertical_hinge")
    for y in (0.44, 0.88, 1.32):
        add(s, place(cyl(0.082, 0.16, "vault_brass_hinge_handle", regions, atlas, sections=40, axis="y", metallic=0.78), (0.62, y, -0.365)), f"stacked_brass_hinge_knuckle_{y}")
        add(s, place(cyl(0.050, 0.14, "vault_black_drawer_inset", regions, atlas, sections=32, axis="y", roughness=0.82), (0.62, y, -0.400)), f"black_hinge_shadow_collar_{y}")
    add(s, place(bevel_box([0.78, 0.18, 0.10], "vault_cyan_window", regions, atlas, bevel=0.07, roughness=0.18), (0, 1.62, -0.34)), "top_cyan_inspection_window")
    add(s, place(bevel_box([0.92, 0.26, 0.055], "vault_black_drawer_inset", regions, atlas, bevel=0.028, roughness=0.76), (0, 1.62, -0.395)), "top_window_recessed_black_gasket")
    for y in (0.20, 0.34):
        add(s, place(bevel_box([1.02, 0.13, 0.12], "vault_black_drawer_inset", regions, atlas, bevel=0.035, roughness=0.55), (0, y, -0.32)), f"bottom_recessed_drawer_{y}")
    for x in (-0.43, 0.43):
        add(s, place(bevel_box([0.30, 0.13, 0.22], "vault_black_drawer_inset", regions, atlas, bevel=0.030, roughness=0.62), (x, 0.08, -0.06)), f"heavy_graphite_floor_foot_{x}")
    add_screws(s, regions, atlas, "vault_brass_hinge_handle", [(-0.52, 1.50, -0.39), (0.52, 1.50, -0.39), (-0.52, 0.18, -0.39), (0.52, 0.18, -0.39)], radius=0.018)
    return s, 51


def build_reclamation_core_altar(regions, atlas):
    s = trimesh.Scene()
    add(s, place(cyl(0.58, 0.54, "altar_graphite_pedestal_panel", regions, atlas, sections=80, axis="y", metallic=0.42), (0, 0.29, 0)), "round_graphite_base")
    add(s, place(cyl(0.38, 0.48, "altar_graphite_pedestal_panel", regions, atlas, sections=72, axis="y", metallic=0.42), (0, 0.72, 0)), "tall_inner_pedestal")
    add(s, place(cyl(0.46, 0.11, "altar_brass_ring_segment", regions, atlas, sections=80, axis="y", metallic=0.75), (0, 1.00, 0)), "brass_top_ring")
    add(s, place(cyl(0.36, 0.08, "altar_cyan_core_lens", regions, atlas, sections=96, axis="y", roughness=0.14), (0, 1.08, 0)), "cyan_core_lens_top")
    add(s, place(cyl(0.18, 0.09, "altar_amber_lens", regions, atlas, sections=64, axis="y", roughness=0.18), (0, 1.16, 0)), "amber_inner_lens")
    add(s, place(disc_y(0.345, "altar_cyan_core_lens", regions, atlas, sections=112, roughness=0.12), (0, 1.208, 0)), "visible_cyan_lens_inlay")
    add(s, place(disc_y(0.155, "altar_amber_lens", regions, atlas, sections=80, roughness=0.14), (0, 1.216, 0)), "visible_amber_lens_inlay")
    for i in range(8):
        a = math.tau * i / 8.0
        x, z = math.cos(a) * 0.70, math.sin(a) * 0.70
        panel = bevel_box([0.16, 0.68, 0.06], "altar_white_ceramic_petal", regions, atlas, bevel=0.035)
        panel.apply_transform(trimesh.transformations.rotation_matrix(-a, (0, 1, 0)))
        add(s, place(panel, (x, 0.68, z)), f"white_ceramic_petal_{i}")
    for i in range(6):
        a = math.tau * (i + 0.5) / 6.0
        x, z = math.cos(a) * 0.48, math.sin(a) * 0.48
        pad = cyl(0.055, 0.42, "altar_black_padded_arc", regions, atlas, sections=32, axis="x", roughness=0.88)
        pad.apply_transform(trimesh.transformations.rotation_matrix(-a, (0, 1, 0)))
        add(s, place(pad, (x, 0.52, z)), f"curved_black_padded_arc_{i}")
    for i in range(6):
        a = math.tau * i / 6.0
        x, z = math.cos(a) * 0.62, math.sin(a) * 0.62
        add(s, place(cyl(0.045, 0.035, "altar_socket_panel", regions, atlas, sections=28, axis="y", metallic=0.4), (x, 0.23, z)), f"socket_port_{i}")
    for i in range(4):
        a = math.tau * i / 4.0
        x, z = math.cos(a) * 0.28, math.sin(a) * 0.28
        add(s, place(sphere(0.035, "altar_cyan_core_lens", regions, atlas, scale=(1, 0.35, 1), subdivisions=2, roughness=0.16), (x, 1.24, z)), f"small_cyan_orb_{i}")
    return s, 33


ASSETS = [
    (
        "room_l5_v3_intake_identity_gate",
        build_intake_identity_gate,
        {
            "label": "L5 V3 Intake Identity Gate",
            "family": "wall_panel_or_picture_frame",
            "footprintFamily": "wall_panel",
            "mount": "floor",
            "solid": False,
            "canHoldSmallProps": False,
            "clueCapacity": 1,
        },
    ),
    (
        "room_l5_v3_three_lock_monolith",
        build_three_lock_monolith,
        {
            "label": "L5 V3 Three Lock Monolith",
            "family": "control_console",
            "footprintFamily": "pedestal",
            "mount": "floor",
            "solid": True,
            "canHoldSmallProps": False,
            "clueCapacity": 2,
        },
    ),
    (
        "room_l5_v3_core_route_map_table",
        build_core_route_map_table,
        {
            "label": "L5 V3 Core Route Map Table",
            "family": "desk",
            "footprintFamily": "table",
            "mount": "floor",
            "solid": True,
            "canHoldSmallProps": True,
            "clueCapacity": 2,
            "supportSurfaces": [
                {
                    "id": "route_map_top",
                    "kind": "tabletop",
                    "localCenter": [0, 0.995, 0],
                    "size": [1.55, 0.75],
                    "maxChildHeight": 0.45,
                }
            ],
        },
    ),
    (
        "room_l5_v3_release_key_vault",
        build_release_key_vault,
        {
            "label": "L5 V3 Release Key Vault",
            "family": "safe",
            "footprintFamily": "cabinet",
            "mount": "floor",
            "solid": True,
            "canHoldSmallProps": False,
            "clueCapacity": 3,
        },
    ),
    (
        "room_l5_v3_reclamation_core_altar",
        build_reclamation_core_altar,
        {
            "label": "L5 V3 Reclamation Core Altar",
            "family": "display_case",
            "footprintFamily": "pedestal",
            "mount": "floor",
            "solid": True,
            "canHoldSmallProps": False,
            "clueCapacity": 3,
        },
    ),
]


def region_average(region_id, regions, atlas):
    x, y, w, h = regions[region_id]["atlasRect"]
    crop = atlas.crop((x, y, x + w, y + h)).convert("RGB").resize((8, 8), Image.BICUBIC)
    return np.array(crop).mean(axis=(0, 1)).astype(np.uint8)


def _get_avg_color(geom, regions, atlas):
    region_id = geom.metadata.get("region_id")
    if region_id in regions:
        return region_average(region_id, regions, atlas)
    return np.array([64, 68, 72], dtype=np.uint8)


def iso_render(scene, regions, atlas, size=360):
    az, el = math.radians(34), math.radians(23)
    cay, say = math.cos(az), math.sin(az)
    cel, sel = math.cos(el), math.sin(el)
    rot_y = np.array([[cay, 0, say], [0, 1, 0], [-say, 0, cay]])
    rot_x = np.array([[1, 0, 0], [0, cel, -sel], [0, sel, cel]])
    matrix = rot_x @ rot_y
    key = np.array([0.52, 0.84, 0.30])
    key /= np.linalg.norm(key)
    cyan_fill = np.array([-0.38, 0.48, 0.80])
    cyan_fill /= np.linalg.norm(cyan_fill)

    tris, depths, colors = [], [], []
    for geom in scene.geometry.values():
        verts = geom.vertices @ matrix.T
        avg = _get_avg_color(geom, regions, atlas)
        for face in geom.faces:
            p = verts[face]
            normal = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(normal)
            if nn < 1e-9:
                continue
            normal /= nn
            l1 = max(0.0, float(np.dot(normal, key)))
            l2 = max(0.0, float(np.dot(normal, cyan_fill)))
            shade = 0.22 + 0.62 * l1 + 0.18 * l2
            colors.append((
                int(min(255, avg[0] * shade + l1 * 12)),
                int(min(255, avg[1] * shade + l1 * 8 + l2 * 4)),
                int(min(255, avg[2] * shade + l2 * 14)),
            ))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())

    img = Image.new("RGB", (size, size), (8, 9, 12))
    d = ImageDraw.Draw(img)
    if not tris:
        return img
    all_points = np.concatenate(tris)
    mn, mx = all_points.min(axis=0), all_points.max(axis=0)
    extent = (mx - mn).max()
    if extent < 1e-6:
        return img
    scale = (size * 0.86) / extent
    offset = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + offset
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


def make_contact_sheet(scenes, atlas, regions):
    cell = 360
    cols = 5
    rows = 1
    source_thumb_w = 300
    sheet_w = cols * cell
    sheet_h = rows * cell + 520 + 760
    sheet = Image.new("RGB", (sheet_w, sheet_h), (10, 10, 13))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
        font_sm = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
        font_sm = font

    d.text((12, 8), "Level 05 v3.2 hero furniture - Image2 cutouts -> area UV -> local table bridge polish", fill=(220, 225, 230), font=font)
    for i, (key, scene) in enumerate(scenes):
        x = i * cell
        tile = iso_render(scene, regions, atlas, cell - 18)
        sheet.paste(tile, (x + 9, 26))
        d.text((x + 12, 30), key.replace("room_l5_v3_", ""), fill=(230, 218, 190), font=font_sm)

    atlas_y = rows * cell + 20
    sheet.paste(atlas.convert("RGB").resize((512, 512), Image.BICUBIC), (10, atlas_y))
    d.text((12, atlas_y + 514), "2048 atlas: 35 semantic regions, cutout-composited from 5 Image2 sheets", fill=(160, 220, 230), font=font_sm)
    swatch_x = 540
    for i, region_id in enumerate(regions.keys()):
        rx, ry, rw, rh = regions[region_id]["atlasRect"]
        swatch = atlas.crop((rx, ry, rx + rw, ry + rh)).convert("RGB").resize((72, 72), Image.BICUBIC)
        x = swatch_x + (i % 10) * 96
        y = atlas_y + (i // 10) * 112
        sheet.paste(swatch, (x, y))
        d.text((x, y + 74), region_id.replace("_", " ")[:16], fill=(180, 195, 205), font=font_sm)

    source_y = atlas_y + 560
    for i, (source_id, info) in enumerate(SOURCE_SHEETS.items()):
        img = Image.open(SRC_DIR / info["file"]).convert("RGB")
        thumb = img.resize((source_thumb_w, int(source_thumb_w * img.height / img.width)), Image.BICUBIC)
        x = 10 + i * (source_thumb_w + 52)
        sheet.paste(thumb, (x, source_y))
        d.text((x, source_y + thumb.height + 4), f"{source_id}: real Image2 source sheet", fill=(210, 210, 218), font=font_sm)
    out = TMP_DIR / "level05-v3-hero-contact-sheet.png"
    sheet.save(out)
    return out


def write_provenance(audit):
    provenance = {
        "schemaVersion": "hp.image2.sourceProvenance.v1",
        "packId": PACK_ID,
        "revision": "v3.2-transparent-cutout-area-uv-table-bridge-polish",
        "negativeCaseReplaces": "hp_level05_reclamation_furniture_image2_v2",
        "generatedAt": "2026-06-27",
        "licenseLabel": "openai-generated-output-user-owned-subject-to-openai-terms",
        "classification": "owned-generated-output",
        "generatingAccount": "Codex built-in image_gen; account not exposed",
        "generationCallId": "not-exposed-by-codex-imagegen",
        "image2Sources": {
            key: {
                "modelKey": value["modelKey"],
                "copiedTo": str((SRC_DIR / value["file"]).relative_to(REPO)),
                "generatedCache": value["generatedCache"],
                "prompt": value["prompt"],
            }
            for key, value in SOURCE_SHEETS.items()
        },
        "atlas": str(ATLAS_PNG.relative_to(REPO)),
        "regions": str(ATLAS_REGIONS.relative_to(REPO)),
        "cutoutDirectory": str(CUTOUT_DIR.relative_to(REPO)),
        "audit": audit,
        "qaGate": [
            "Each model owns an independent Image2 parts sheet.",
            "Each atlas region has a saved transparent cutout PNG with alpha stats.",
            "Atlas regions carry sourceSheet + sourceCrop evidence.",
            "GLB audit requires baseColorTexture=true for all geometry materials.",
            "GLB audit requires area UV coverage instead of center-sampled color blocks.",
            "Minimum part counts are greater than v2 blockout furniture.",
        ],
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, indent=2) + "\n")

    lines = [
        "# Level 05 v3.2 Hero Furniture Image2 Prompt Ledger",
        "",
        "This pack replaces the deleted v2 negative case. v3.2 uses one independent Image2 parts sheet per hero object, transparent cutouts, area UV mapping, and a local table bridge polish pass.",
        "",
        "- License label: `openai-generated-output-user-owned-subject-to-openai-terms`",
        "- Classification: `owned-generated-output`",
        "- Generation call id: `not-exposed-by-codex-imagegen`",
        "",
    ]
    for source_id, info in SOURCE_SHEETS.items():
        lines.extend(
            [
                f"## {source_id} / `{info['modelKey']}`",
                "",
                f"- Copied source: `{(SRC_DIR / info['file']).relative_to(REPO)}`",
                f"- Generated cache: `{info['generatedCache']}`",
                f"- Prompt: {info['prompt']}",
                f"- Transparent cutouts: `{CUTOUT_DIR.relative_to(REPO)}/<region>.png`",
                "- Named cut regions:",
            ]
        )
        for spec in [item for item in REGION_SPECS if item.source_id == source_id]:
            lines.append(f"  - `{spec.region_id}` crop={list(spec.crop)} - {spec.note}")
        lines.append("")
    PROMPT_LEDGER.write_text("\n".join(lines))


def uv_audit_for_geom(geom) -> dict[str, object]:
    uv = getattr(geom.visual, "uv", None)
    if uv is None:
        return {
            "hasUv": False,
            "uvSpan": [0.0, 0.0],
            "uvArea": 0.0,
            "areaMapped": False,
        }
    uv_arr = np.asarray(uv, dtype=np.float64)
    if uv_arr.size == 0:
        return {
            "hasUv": False,
            "uvSpan": [0.0, 0.0],
            "uvArea": 0.0,
            "areaMapped": False,
        }
    span = np.ptp(uv_arr, axis=0)
    area = float(span[0] * span[1])
    return {
        "hasUv": True,
        "uvSpan": [round(float(span[0]), 6), round(float(span[1]), 6)],
        "uvArea": round(area, 8),
        "areaMapped": area > 0.00005 and float(span[0]) > 0.001 and float(span[1]) > 0.001,
    }


def export_assets(atlas, regions):
    manifest_assets = []
    audit = []
    scenes = []
    for model_key, builder, spec in ASSETS:
        scene, expected_parts = builder(regions, atlas)
        size = finalize(scene)
        glb_path = GLB_DIR / f"{model_key}.glb"
        data = trimesh.exchange.gltf.export_glb(scene, include_normals=True)
        glb_path.write_bytes(data)
        scenes.append((model_key, scene))

        reloaded = trimesh.load(trimesh.util.wrap_as_stream(data), file_type="glb")
        mats = []
        for geom_name, geom in reloaded.geometry.items():
            mat = getattr(geom.visual, "material", None)
            uv_audit = uv_audit_for_geom(geom)
            mats.append(
                {
                    "node": geom_name,
                    "material": getattr(mat, "name", None),
                    "baseColorTexture": getattr(mat, "baseColorTexture", None) is not None,
                    **uv_audit,
                }
            )
        vertex_count = int(sum(len(g.vertices) for g in reloaded.geometry.values()))
        triangle_count = int(sum(len(g.faces) for g in reloaded.geometry.values()))
        base_textured = sum(1 for item in mats if item["baseColorTexture"])
        uv_nodes = sum(1 for item in mats if item["hasUv"])
        area_uv_nodes = sum(1 for item in mats if item["areaMapped"])
        center_sample_nodes = sum(1 for item in mats if item["hasUv"] and not item["areaMapped"])
        missing_uv_nodes = sum(1 for item in mats if not item["hasUv"])
        audit.append(
            {
                "modelKey": model_key,
                "glb": str(glb_path.relative_to(REPO)),
                "bytes": len(data),
                "sizeMeters": size,
                "expectedNamedParts": expected_parts,
                "geometryNodes": len(reloaded.geometry),
                "vertices": vertex_count,
                "triangles": triangle_count,
                "materialsWithBaseColorTexture": base_textured,
                "uvNodes": uv_nodes,
                "areaUvNodes": area_uv_nodes,
                "centerSampleUvNodes": center_sample_nodes,
                "missingUvNodes": missing_uv_nodes,
                "areaUvCoverageRatio": round(area_uv_nodes / max(1, len(reloaded.geometry)), 4),
                "materials": mats,
            }
        )
        print(
            f"  {model_key:38s} {len(data):7d} B nodes={len(reloaded.geometry):2d} "
            f"verts={vertex_count:5d} areaUV={area_uv_nodes:2d}/{len(reloaded.geometry):2d} size={size}"
        )

        manifest_assets.append(
            {
                "modelKey": model_key,
                "label": spec["label"],
                "assetKind": "furniture",
                "family": spec["family"],
                "group": GROUP,
                "source": SOURCE_ID,
                "sourceAssetId": f"{model_key}_v1",
                "themeId": THEME_ID,
                "glbFile": os.path.relpath(glb_path, MANIFEST.parent).replace(os.sep, "/"),
                "sizeMeters": size,
                "solid": spec["solid"],
                "mount": spec["mount"],
                "canHoldSmallProps": spec["canHoldSmallProps"],
                "clueCapacity": spec["clueCapacity"],
                "footprintFamily": spec["footprintFamily"],
                "tags": [
                    "level:05",
                    "theme:reclamation-core",
                    "style:image2-v3.2",
                    "source:independent-image2-sheet",
                    "texture:transparent-cutout",
                    "uv:area-mapped",
                    f"family:{spec['family']}",
                ],
                **({"supportSurfaces": spec["supportSurfaces"]} if "supportSurfaces" in spec else {}),
            }
        )

    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP Level 05 Reclamation Core Hero Furniture v3.2 (Image2 Cutout UV + Table Polish)",
        "sourceTool": "generate-level05-reclamation-furniture-image2-v3-hero-assets.py",
        "generatedAt": "2026-06-27",
        "revision": "v3.2-transparent-cutout-area-uv-table-bridge-polish",
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
            "size": [ATLAS_SIZE, ATLAS_SIZE],
        },
        "assets": manifest_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    (TMP_DIR / "glb-texture-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    contact = make_contact_sheet(scenes, atlas, regions)
    write_provenance(audit)
    print(f"manifest -> {MANIFEST.relative_to(REPO)} ({len(manifest_assets)} assets)")
    print(f"atlas -> {ATLAS_PNG.relative_to(REPO)} ({len(regions)} regions)")
    print(f"contact -> {contact.relative_to(REPO)}")
    print(f"provenance -> {PROVENANCE_JSON.relative_to(REPO)}")
    return audit


def main():
    print("== Level 05 Reclamation Core v3.2 hero furniture Image2 pack ==")
    atlas, regions = build_atlas()
    set_pbr_maps(atlas)
    export_assets(atlas, regions)


if __name__ == "__main__":
    main()
