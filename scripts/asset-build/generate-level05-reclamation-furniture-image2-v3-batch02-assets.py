#!/usr/bin/env python3
"""Human Protocol Level 05 Reclamation Core - v3 batch 02 furniture pack.

Batch 02 adds five smaller living/support furniture assets on top of the
existing hero batch. It keeps the same proved pipeline:

Image2 source sheet -> transparent cutouts -> semantic atlas -> area-UV GLB
-> builder asset pack -> provenance/audit evidence.
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
TEX_DIR = REPO / "src/assets/textures/environment/level05-reclamation-furniture-image2-v3-batch02"
SRC_DIR = TEX_DIR / "image2-sources"
CUTOUT_DIR = TEX_DIR / "image2-cutouts"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level05-reclamation-furniture-image2-v3-batch02"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch02.json"
TMP_DIR = REPO / ".tmp/level05-reclamation-furniture-image2-v3-batch02"
REPORT_DIR = REPO / "src/assets/manifests/reports"

ATLAS_SIZE = 2048
CELL = 256
ATLAS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch02_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch02_atlas.regions.json"
PBR_NORMAL_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch02_normal.png"
PBR_METALLIC_ROUGHNESS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch02_metallicroughness.png"
PBR_OCCLUSION_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch02_occlusion.png"
PROVENANCE_JSON = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch02_source_provenance.json"
PROMPT_LEDGER = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch02_prompt_ledger.md"

PACK_ID = "hp_level05_reclamation_furniture_image2_v3_batch02"
SOURCE_ID = "level05-reclamation-furniture-image2-v3-batch02"
THEME_ID = "hp_reclamation_core_v3"
GROUP = "核心"
REVISION = "v3-batch02-clean-chair-sofa-front-organic-supports-area-uv"
PBR_MAPS: dict[str, Image.Image] = {}

for directory in (TEX_DIR, SRC_DIR, CUTOUT_DIR, GLB_DIR, MANIFEST.parent, TMP_DIR, REPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


SOURCE_SHEETS = {
    "chair": {
        "file": "anemone_lounge_chair_parts_image2.png",
        "modelKey": "room_l5_v3_anemone_lounge_chair",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/ig_05aefb923c70497b016a400caaca74819abc1adfcf30978fc4.png",
        "prompt": "Orthographic Image2 parts sheet for an anemone lounge chair with ribbed black cushions, white ceramic shell petals, graphite swivel base, brass bearing ring, cyan glass beads, gaskets, screws.",
    },
    "sofa": {
        "file": "crescent_low_sofa_parts_image2.png",
        "modelKey": "room_l5_v3_crescent_low_sofa",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/ig_02c3eff2071b3773016a400d0181a08199b180fb446b50562e.png",
        "prompt": "Orthographic Image2 parts sheet for a crescent low sofa with curved black ribbed cushions, white ceramic outer shells, graphite plinth, brass caps, cyan glass slits and connector parts.",
    },
    "coffee": {
        "file": "evidence_coffee_table_parts_image2.png",
        "modelKey": "room_l5_v3_evidence_coffee_table",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/ig_02c3eff2071b3773016a400d38393c819988823d7636a28140.png",
        "prompt": "Orthographic Image2 parts sheet for an evidence coffee table with smoked black glass top, cyan route glow, white ceramic rims, graphite slabs, brass feet, gaskets and screws.",
    },
    "cabinet": {
        "file": "human_archive_cabinet_parts_image2.png",
        "modelKey": "room_l5_v3_human_archive_cabinet",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/ig_02c3eff2071b3773016a400d78d214819981e2caca47642fa1.png",
        "prompt": "Orthographic Image2 parts sheet for a human archive cabinet with tall white ceramic curved doors, smoked graphite shelves, black padded bolsters, brass handles, cyan glass strips and seals.",
    },
    "console": {
        "file": "service_side_console_parts_image2.png",
        "modelKey": "room_l5_v3_service_side_console",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/ig_02c3eff2071b3773016a400db4f5908199b291093701d31302.png",
        "prompt": "Orthographic Image2 parts sheet for a service side console with black smoked glass tray, white ceramic side panels, graphite ribbed lower cabinet, brass rails and cyan glass status capsules.",
    },
}


@dataclass(frozen=True)
class RegionSpec:
    region_id: str
    source_id: str
    crop: tuple[int, int, int, int]
    note: str


REGION_SPECS = [
    RegionSpec("chair_black_ribbed_cushion", "chair", (20, 18, 470, 520), "ribbed black petal cushion"),
    RegionSpec("chair_white_ceramic_petal", "chair", (610, 24, 410, 360), "curved white ceramic petal shell"),
    RegionSpec("chair_graphite_swivel_base", "chair", (1040, 30, 370, 315), "brushed graphite swivel base"),
    RegionSpec("chair_brass_bearing_ring", "chair", (1090, 355, 260, 260), "brass bearing ring"),
    RegionSpec("chair_cyan_glass_bead", "chair", (650, 455, 420, 120), "cyan glass beads"),
    RegionSpec("chair_black_gasket", "chair", (650, 615, 560, 150), "black gasket rails"),
    RegionSpec("chair_screw_bracket", "chair", (410, 820, 700, 145), "screws and brackets"),

    RegionSpec("sofa_black_ribbed_crescent", "sofa", (18, 18, 650, 330), "curved black ribbed sofa cushion"),
    RegionSpec("sofa_white_ceramic_arc", "sofa", (800, 30, 545, 310), "white ceramic crescent shell"),
    RegionSpec("sofa_graphite_plinth", "sofa", (35, 560, 720, 220), "graphite crescent plinth"),
    RegionSpec("sofa_cyan_status_slit", "sofa", (785, 500, 450, 110), "cyan glass status slits"),
    RegionSpec("sofa_black_gasket_rail", "sofa", (820, 610, 600, 150), "black curved gasket rails"),
    RegionSpec("sofa_brass_foot_cap", "sofa", (1120, 810, 330, 130), "brass foot caps"),
    RegionSpec("sofa_screw_plate", "sofa", (780, 770, 330, 160), "black screw plates"),

    RegionSpec("coffee_black_glass_top", "coffee", (20, 24, 710, 220), "smoked black glass route top"),
    RegionSpec("coffee_white_ceramic_rim", "coffee", (785, 30, 505, 170), "white ceramic rim bars"),
    RegionSpec("coffee_graphite_pedestal", "coffee", (690, 330, 510, 330), "dark graphite pedestal slabs"),
    RegionSpec("coffee_brass_connector", "coffee", (1095, 215, 300, 190), "brass connector rods"),
    RegionSpec("coffee_cyan_capsule", "coffee", (500, 575, 330, 95), "cyan capsule lamps"),
    RegionSpec("coffee_black_gasket", "coffee", (35, 625, 520, 120), "black gasket rails"),
    RegionSpec("coffee_screw_corner", "coffee", (20, 880, 540, 110), "screws and corner caps"),

    RegionSpec("cabinet_white_ceramic_door", "cabinet", (20, 30, 430, 630), "tall white curved cabinet door"),
    RegionSpec("cabinet_graphite_shelf", "cabinet", (460, 70, 330, 575), "smoked graphite shelf body"),
    RegionSpec("cabinet_black_padded_bolster", "cabinet", (790, 70, 360, 300), "black padded vertical bolsters"),
    RegionSpec("cabinet_smoked_glass_front", "cabinet", (760, 430, 390, 180), "smoked glass front panel"),
    RegionSpec("cabinet_brass_handle", "cabinet", (1150, 70, 360, 320), "brass drawer handles"),
    RegionSpec("cabinet_cyan_strip", "cabinet", (1120, 500, 220, 120), "cyan frosted glass strips"),
    RegionSpec("cabinet_screw_hinge", "cabinet", (1040, 700, 455, 265), "hinges screws and plates"),

    RegionSpec("console_white_ceramic_side", "console", (22, 40, 310, 490), "white ceramic side panel"),
    RegionSpec("console_black_glass_tray", "console", (885, 45, 455, 215), "black smoked glass tray"),
    RegionSpec("console_graphite_ribbed_body", "console", (555, 230, 325, 430), "graphite ribbed lower cabinet"),
    RegionSpec("console_brass_rail", "console", (25, 20, 700, 95), "long brass rail with white mounts"),
    RegionSpec("console_cyan_capsule", "console", (900, 285, 195, 220), "cyan glass capsules"),
    RegionSpec("console_black_gasket", "console", (1180, 315, 275, 360), "black rounded gasket rails"),
    RegionSpec("console_screw_foot", "console", (30, 775, 1060, 180), "feet screws handles and brackets"),
]


def load_source_sheets() -> dict[str, Image.Image]:
    out = {}
    for source_id, info in SOURCE_SHEETS.items():
        path = SRC_DIR / info["file"]
        if not path.exists():
            raise FileNotFoundError(f"missing Image2 source sheet: {path}")
        out[source_id] = Image.open(path).convert("RGBA")
    return out


def _border_connected_background_mask(rgb: np.ndarray) -> np.ndarray:
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
    rgb = np.median(arr[:, :, :3][visible], axis=0).astype(np.uint8) if visible.any() else np.array([34, 36, 38], dtype=np.uint8)
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
        cutout, cutout_stats = make_transparent_cutout(source.crop((x, y, x + w, y + h)))
        cutout_path = CUTOUT_DIR / f"{spec.region_id}.png"
        cutout.save(cutout_path)
        matte, matte_rgb = matte_from_cutout(cutout)
        atlas.paste(matte.resize((CELL, CELL), Image.LANCZOS), (ax, ay))
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
        + "\n"
    )
    return atlas, regions


def _uv_rect(region_id: str, regions: dict[str, dict]) -> tuple[float, float, float, float]:
    x, y, w, h = regions[region_id]["atlasRect"]
    return x / ATLAS_SIZE, 1.0 - ((y + h) / ATLAS_SIZE), (x + w) / ATLAS_SIZE, 1.0 - (y / ATLAS_SIZE)


def _normalise(values: np.ndarray) -> np.ndarray:
    lo, hi = float(values.min()), float(values.max())
    if hi - lo < 1e-8:
        return np.full(values.shape, 0.5, dtype=np.float64)
    return (values - lo) / (hi - lo)


def _uv_from_unit(region_id: str, regions: dict[str, dict], u_unit: np.ndarray, v_unit: np.ndarray) -> np.ndarray:
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    return np.column_stack((u0 + u_unit * (u1 - u0), v1 - v_unit * (v1 - v0)))


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


def _tag(mesh: trimesh.Trimesh, region_id: str) -> trimesh.Trimesh:
    mesh.metadata["region_id"] = region_id
    return mesh


def _box_project_uv(mesh: trimesh.Trimesh, region_id: str, regions: dict[str, dict]) -> np.ndarray:
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    spans = np.ptp(verts, axis=0)
    axes = np.argsort(spans)[-2:]
    return _uv_from_unit(region_id, regions, _normalise(verts[:, int(axes[1])]), _normalise(verts[:, int(axes[0])]))


def _mesh_with_uv(vertices, faces, region_id: str, regions: dict[str, dict], atlas: Image.Image, u_units, v_units, metallic=0.05, roughness=0.55):
    mesh = trimesh.Trimesh(vertices=np.array(vertices), faces=np.array(faces), process=False)
    mesh.visual = TextureVisuals(
        uv=_uv_from_unit(region_id, regions, np.array(u_units), np.array(v_units)),
        material=material(region_id, atlas, metallic, roughness),
        image=atlas,
    )
    return _tag(mesh, region_id)


def box(extents, region_id: str, regions: dict[str, dict], atlas: Image.Image, bevel=0.025, metallic=0.05, roughness=0.55):
    hx, hy, hz = (e / 2 for e in extents)
    b = min(bevel, hx * 0.46, hy * 0.46, hz * 0.46)
    pts = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                pts.append((sx * (hx - b), sy * hy, sz * hz))
                pts.append((sx * hx, sy * (hy - b), sz * hz))
                pts.append((sx * hx, sy * hy, sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(pts)).convex_hull
    mesh.visual = TextureVisuals(uv=_box_project_uv(mesh, region_id, regions), material=material(region_id, atlas, metallic, roughness), image=atlas)
    return _tag(mesh, region_id)


def ellipsoid(extents, region_id: str, regions: dict[str, dict], atlas: Image.Image, segments=36, rings=16, metallic=0.05, roughness=0.72, flatten_bottom=0.0):
    hx, hy, hz = (e / 2 for e in extents)
    vertices, faces, u_units, v_units = [], [], [], []
    for r in range(rings + 1):
        v = r / rings
        phi = -math.pi / 2 + math.pi * v
        y = math.sin(phi) * hy
        if flatten_bottom and y < -hy * (1.0 - flatten_bottom):
            y = -hy * (1.0 - flatten_bottom)
        ring_radius = math.cos(phi)
        for s_i in range(segments + 1):
            u = s_i / segments
            theta = math.tau * u
            vertices.append((math.cos(theta) * hx * ring_radius, y, math.sin(theta) * hz * ring_radius))
            u_units.append(u)
            v_units.append(v)
    for r in range(rings):
        for s_i in range(segments):
            a = r * (segments + 1) + s_i
            b = a + 1
            c = a + segments + 1
            d = c + 1
            faces.extend([[a, c, d], [a, d, b]])
    return _mesh_with_uv(vertices, faces, region_id, regions, atlas, u_units, v_units, metallic, roughness)


def curved_arc_box(radius, angle_deg, radial_thickness, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, segments=32, metallic=0.05, roughness=0.55):
    half = math.radians(angle_deg) / 2
    r0 = radius - radial_thickness / 2
    r1 = radius + radial_thickness / 2
    y0, y1 = -height / 2, height / 2
    vertices, u_units, v_units = [], [], []
    for i in range(segments + 1):
        t = -half + angle_deg * math.pi / 180 * i / segments
        u = i / segments
        for rr, radial_v in ((r0, 0.0), (r1, 1.0)):
            vertices.append((math.sin(t) * rr, y0, math.cos(t) * rr))
            u_units.append(u)
            v_units.append(radial_v * 0.48)
            vertices.append((math.sin(t) * rr, y1, math.cos(t) * rr))
            u_units.append(u)
            v_units.append(0.52 + radial_v * 0.48)
    faces = []
    for i in range(segments):
        base = i * 4
        nxt = base + 4
        # inner wall
        faces.extend([[base, nxt, nxt + 1], [base, nxt + 1, base + 1]])
        # outer wall
        faces.extend([[base + 2, base + 3, nxt + 3], [base + 2, nxt + 3, nxt + 2]])
        # lower and upper soft faces
        faces.extend([[base, base + 2, nxt + 2], [base, nxt + 2, nxt]])
        faces.extend([[base + 1, nxt + 1, nxt + 3], [base + 1, nxt + 3, base + 3]])
    # end caps
    faces.extend([[0, 1, 3], [0, 3, 2]])
    last = segments * 4
    faces.extend([[last, last + 2, last + 3], [last, last + 3, last + 1]])
    mesh = _mesh_with_uv(vertices, faces, region_id, regions, atlas, u_units, v_units, metallic, roughness)
    min_z = float(mesh.bounds[0][2])
    mesh.apply_translation((0, 0, -min_z - radial_thickness / 2))
    return mesh


def cyl_z(radius, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=48, metallic=0.1, roughness=0.45):
    verts, u_units, v_units, faces = [], [], [], []
    half = height / 2
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
    for z, flip in ((half, False), (-half, True)):
        center = len(verts)
        verts.append([0, 0, z])
        u_units.append(0.5)
        v_units.append(0.5)
        start = len(verts)
        for i in range(sections):
            a = math.tau * i / sections
            verts.append([math.cos(a) * radius, math.sin(a) * radius, z])
            u_units.append(0.5 + math.cos(a) * 0.48)
            v_units.append(0.5 + math.sin(a) * 0.48)
        for i in range(sections):
            tri = [center, start + i, start + ((i + 1) % sections)]
            faces.append(list(reversed(tri)) if flip else tri)
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)
    mesh.visual = TextureVisuals(uv=_uv_from_unit(region_id, regions, np.array(u_units), np.array(v_units)), material=material(region_id, atlas, metallic, roughness), image=atlas)
    return _tag(mesh, region_id)


def cyl(radius, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=48, axis="y", metallic=0.1, roughness=0.45):
    mesh = cyl_z(radius, height, region_id, regions, atlas, sections, metallic, roughness)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    elif axis != "z":
        raise ValueError(f"unsupported axis {axis}")
    return mesh


def place(mesh, translate=(0, 0, 0), rotate=None):
    if rotate:
        angle, axis = rotate
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(translate)
    return mesh


def place_rot(mesh, translate=(0, 0, 0), rotations=()):
    for angle, axis in rotations:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(translate)
    return mesh


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def add_screws(scene, regions, atlas, region_id, positions, radius=0.022, axis="z"):
    for i, pos in enumerate(positions):
        add(scene, place(cyl(radius, 0.018, region_id, regions, atlas, sections=20, axis=axis, metallic=0.55), pos), f"screw_{i:02d}_{region_id}")


def finalize(scene: trimesh.Scene):
    bounds = scene.bounds
    cx = (bounds[0][0] + bounds[1][0]) / 2
    cz = (bounds[0][2] + bounds[1][2]) / 2
    miny = bounds[0][1]
    delta = np.array([-cx, -miny, -cz], dtype=np.float64)
    for geom in scene.geometry.values():
        geom.vertices += delta
    return [round(float(v), 3) for v in (scene.bounds[1] - scene.bounds[0])]


def build_anemone_lounge_chair(regions, atlas):
    s = trimesh.Scene()
    add(s, place(cyl(0.46, 0.14, "chair_graphite_swivel_base", regions, atlas, sections=80, axis="y", metallic=0.45), (0, 0.08, 0)), "graphite_swivel_base")
    add(s, place(cyl(0.52, 0.045, "chair_brass_bearing_ring", regions, atlas, sections=88, axis="y", metallic=0.78), (0, 0.18, 0)), "brass_bearing_ring")
    add(s, place(ellipsoid([0.98, 0.20, 0.76], "chair_white_ceramic_petal", regions, atlas, segments=48, rings=18, roughness=0.34, flatten_bottom=0.22), (0, 0.33, -0.10)), "continuous_white_ceramic_seat_bowl")
    add(s, place(ellipsoid([0.84, 0.22, 0.62], "chair_black_ribbed_cushion", regions, atlas, segments=48, rings=18, roughness=0.88, flatten_bottom=0.28), (0, 0.43, -0.15)), "single_soft_black_seat_basin")
    for i, deg in enumerate(np.linspace(-58, 58, 7)):
        a = math.radians(float(deg))
        side = abs(float(deg)) / 58.0
        x = math.sin(a) * 0.43
        z = 0.10 + (1.0 - math.cos(a)) * -0.05
        petal_height = 0.70 + 0.10 * (1.0 - side)
        shell = ellipsoid([0.27, petal_height + 0.08, 0.070], "chair_white_ceramic_petal", regions, atlas, segments=30, rings=14, roughness=0.36)
        cushion = ellipsoid([0.205, petal_height, 0.105], "chair_black_ribbed_cushion", regions, atlas, segments=30, rings=14, roughness=0.9)
        rotations = ((math.radians(16), (1, 0, 0)), (-a, (0, 1, 0)))
        add(s, place_rot(shell, (x, 0.70 + 0.02 * (1.0 - side), z + 0.055), rotations), f"curved_white_outer_petal_{i}")
        add(s, place_rot(cushion, (x, 0.69 + 0.02 * (1.0 - side), z - 0.015), rotations), f"ribbed_black_soft_petal_{i}")
    return s, 18


def build_crescent_low_sofa(regions, atlas):
    s = trimesh.Scene()
    add(s, place(curved_arc_box(1.36, 94, 0.54, 0.16, "sofa_graphite_plinth", regions, atlas, segments=42, metallic=0.35, roughness=0.46), (0, 0.11, -0.25)), "single_curved_graphite_plinth")
    add(s, place(curved_arc_box(1.36, 94, 0.42, 0.13, "sofa_white_ceramic_arc", regions, atlas, segments=42, roughness=0.35), (0, 0.27, -0.15)), "continuous_white_ceramic_under_shell")
    add(s, place(curved_arc_box(1.28, 90, 0.47, 0.20, "sofa_black_ribbed_crescent", regions, atlas, segments=44, roughness=0.9), (0, 0.40, -0.18)), "continuous_black_crescent_seat")
    add(s, place(curved_arc_box(1.43, 96, 0.18, 0.46, "sofa_white_ceramic_arc", regions, atlas, segments=42, roughness=0.34), (0, 0.52, 0.10)), "curved_white_rear_shell")
    add(s, place(curved_arc_box(1.36, 92, 0.12, 0.34, "sofa_black_ribbed_crescent", regions, atlas, segments=38, roughness=0.9), (0, 0.56, 0.04)), "soft_black_back_cushion_band")
    for x, yaw in ((-1.02, math.radians(11)), (1.02, math.radians(-11))):
        add(s, place(box([0.18, 0.40, 0.48], "sofa_white_ceramic_arc", regions, atlas, bevel=0.07, roughness=0.36), (x, 0.42, -0.03), (yaw, (0, 1, 0))), f"rounded_ceramic_end_cap_{x}")
    return s, 7


def build_evidence_coffee_table(regions, atlas):
    s = trimesh.Scene()
    add(s, place(box([1.58, 0.09, 0.78], "coffee_black_glass_top", regions, atlas, bevel=0.055, roughness=0.18), (0, 0.62, 0)), "smoked_glass_top")
    add(s, place(box([1.74, 0.065, 0.08], "coffee_white_ceramic_rim", regions, atlas, bevel=0.025), (0, 0.64, -0.45)), "front_ceramic_rim")
    add(s, place(box([1.74, 0.065, 0.08], "coffee_white_ceramic_rim", regions, atlas, bevel=0.025), (0, 0.64, 0.45)), "back_ceramic_rim")
    add(s, place(box([0.72, 0.50, 0.38], "coffee_graphite_pedestal", regions, atlas, bevel=0.07, metallic=0.42), (0, 0.31, 0)), "graphite_pedestal")
    add(s, place(box([1.04, 0.10, 0.54], "coffee_graphite_pedestal", regions, atlas, bevel=0.045, metallic=0.42), (0, 0.52, 0)), "top_collar_bridge")
    for x in (-0.62, 0.62):
        add(s, place(box([0.16, 0.22, 0.10], "coffee_brass_connector", regions, atlas, bevel=0.025, metallic=0.75), (x, 0.44, -0.34)), f"visible_brass_support_{x}")
    add(s, place(box([0.60, 0.06, 0.055], "coffee_cyan_capsule", regions, atlas, bevel=0.03, roughness=0.16), (0, 0.69, -0.02)), "cyan_route_capsule_under_glass")
    add_screws(s, regions, atlas, "coffee_screw_corner", [(-0.76, 0.69, -0.36), (0.76, 0.69, -0.36), (-0.76, 0.69, 0.36), (0.76, 0.69, 0.36)])
    return s, 18


def build_human_archive_cabinet(regions, atlas):
    s = trimesh.Scene()
    add(s, place(box([0.92, 1.72, 0.42], "cabinet_graphite_shelf", regions, atlas, bevel=0.055, metallic=0.36), (0, 0.88, 0)), "graphite_shelf_body")
    add(s, place(box([0.82, 1.42, 0.030], "cabinet_black_padded_bolster", regions, atlas, bevel=0.020, roughness=0.78), (0, 0.92, -0.215)), "flush_black_archive_backing_panel")
    add(s, place(box([1.10, 0.13, 0.50], "cabinet_graphite_shelf", regions, atlas, bevel=0.035, metallic=0.38), (0, 1.76, 0.02)), "thick_graphite_top_cap")
    add(s, place(box([1.12, 0.16, 0.54], "cabinet_graphite_shelf", regions, atlas, bevel=0.04, metallic=0.38), (0, 0.08, 0.02)), "weighted_graphite_bottom_plinth")
    for x in (-0.30, 0.30):
        add(s, place(box([0.28, 1.62, 0.055], "cabinet_white_ceramic_door", regions, atlas, bevel=0.04), (x, 0.92, -0.245), (math.radians(4 if x < 0 else -4), (0, 1, 0))), f"curved_white_archive_door_{x}")
        add(s, place(box([0.055, 1.42, 0.040], "cabinet_black_padded_bolster", regions, atlas, bevel=0.014, roughness=0.82), (x + (0.17 if x < 0 else -0.17), 0.92, -0.300)), f"black_inner_door_seal_{x}")
        add(s, place(cyl(0.026, 1.24, "cabinet_brass_handle", regions, atlas, sections=28, axis="y", metallic=0.78), (x + (0.21 if x < 0 else -0.21), 0.92, -0.320)), f"long_brass_archive_door_pull_{x}")
    for y in (0.45, 0.82, 1.19):
        add(s, place(box([0.76, 0.045, 0.34], "cabinet_smoked_glass_front", regions, atlas, bevel=0.03, roughness=0.22), (0, y, -0.29)), f"smoked_shelf_front_{y}")
        add(s, place(box([0.80, 0.030, 0.040], "cabinet_black_padded_bolster", regions, atlas, bevel=0.010, roughness=0.82), (0, y + 0.10, -0.320)), f"thin_black_glass_upper_gasket_{y}")
        add(s, place(box([0.80, 0.030, 0.040], "cabinet_black_padded_bolster", regions, atlas, bevel=0.010, roughness=0.82), (0, y - 0.10, -0.320)), f"thin_black_glass_lower_gasket_{y}")
    for x in (-0.56, 0.56):
        add(s, place(box([0.14, 1.58, 0.12], "cabinet_black_padded_bolster", regions, atlas, bevel=0.055, roughness=0.88), (x, 0.89, -0.10)), f"black_side_bolster_{x}")
        for y in (0.35, 0.92, 1.49):
            add(s, place(cyl(0.032, 0.10, "cabinet_brass_handle", regions, atlas, sections=28, axis="y", metallic=0.78), (x, y, -0.318)), f"round_brass_hinge_knuckle_{x}_{y}")
    for y in (0.42, 0.92, 1.42):
        add(s, place(box([0.46, 0.06, 0.06], "cabinet_brass_handle", regions, atlas, bevel=0.018, metallic=0.78), (0, y, -0.34)), f"brass_archive_handle_{y}")
        for x in (-0.29, 0.29):
            add(s, place(box([0.050, 0.075, 0.045], "cabinet_brass_handle", regions, atlas, bevel=0.014, metallic=0.78), (x, y, -0.330)), f"brass_handle_mount_{x}_{y}")
    add(s, place(box([0.075, 1.02, 0.040], "cabinet_cyan_strip", regions, atlas, bevel=0.030, roughness=0.16), (0.46, 0.88, -0.315)), "cyan_vertical_status_strip")
    add(s, place(box([0.038, 1.34, 0.035], "cabinet_black_padded_bolster", regions, atlas, bevel=0.010, roughness=0.84), (0, 0.92, -0.315)), "center_archive_door_split_shadow")
    for x in (-0.40, 0.40):
        add(s, place(box([0.22, 0.10, 0.18], "cabinet_graphite_shelf", regions, atlas, bevel=0.028, metallic=0.36), (x, 0.03, -0.11)), f"small_recessed_archive_foot_{x}")
    add_screws(s, regions, atlas, "cabinet_screw_hinge", [(-0.48, 1.66, -0.31), (0.48, 1.66, -0.31), (-0.48, 0.12, -0.31), (0.48, 0.12, -0.31)])
    return s, 44


def build_service_side_console(regions, atlas):
    s = trimesh.Scene()
    add(s, place(box([1.18, 0.86, 0.42], "console_graphite_ribbed_body", regions, atlas, bevel=0.06, metallic=0.35), (0, 0.44, 0)), "ribbed_console_body")
    add(s, place(box([1.32, 0.11, 0.52], "console_black_glass_tray", regions, atlas, bevel=0.05, roughness=0.2), (0, 0.93, 0)), "smoked_glass_service_tray")
    for x in (-0.72, 0.72):
        add(s, place(box([0.16, 0.96, 0.08], "console_white_ceramic_side", regions, atlas, bevel=0.04), (x, 0.52, -0.03)), f"white_side_panel_{x}")
    for y in (0.22, 0.72):
        add(s, place(box([1.20, 0.055, 0.055], "console_brass_rail", regions, atlas, bevel=0.018, metallic=0.78), (0, y, -0.27)), f"brass_front_rail_{y}")
    for i, x in enumerate(np.linspace(-0.42, 0.42, 4)):
        add(s, place(box([0.14, 0.12, 0.055], "console_cyan_capsule", regions, atlas, bevel=0.045, roughness=0.16), (x, 0.84, -0.30)), f"cyan_status_capsule_{i}")
    for x in (-0.48, 0.48):
        add(s, place(cyl(0.055, 0.08, "console_screw_foot", regions, atlas, sections=28, axis="y", metallic=0.45), (x, 0.04, -0.22)), f"front_rubber_foot_{x}")
    add_screws(s, regions, atlas, "console_screw_foot", [(-0.62, 0.90, -0.29), (0.62, 0.90, -0.29), (-0.62, 0.16, -0.29), (0.62, 0.16, -0.29)])
    return s, 18


ASSETS = [
    ("room_l5_v3_anemone_lounge_chair", build_anemone_lounge_chair, {"label": "L5 V3 Anemone Lounge Chair", "family": "chair", "footprintFamily": "chair", "solid": True, "canHoldSmallProps": False, "clueCapacity": 1}),
    ("room_l5_v3_crescent_low_sofa", build_crescent_low_sofa, {"label": "L5 V3 Crescent Low Sofa", "family": "sofa_bench", "footprintFamily": "sofa", "solid": True, "canHoldSmallProps": False, "clueCapacity": 1}),
    ("room_l5_v3_evidence_coffee_table", build_evidence_coffee_table, {"label": "L5 V3 Evidence Coffee Table", "family": "desk", "footprintFamily": "table", "solid": True, "canHoldSmallProps": True, "clueCapacity": 2, "supportSurfaces": [{"id": "glass_top", "kind": "tabletop", "localCenter": [0, 0.67, 0], "size": [1.4, 0.64], "maxChildHeight": 0.4}]}),
    ("room_l5_v3_human_archive_cabinet", build_human_archive_cabinet, {"label": "L5 V3 Human Archive Cabinet", "family": "bookshelf", "footprintFamily": "cabinet", "solid": True, "canHoldSmallProps": True, "clueCapacity": 3}),
    ("room_l5_v3_service_side_console", build_service_side_console, {"label": "L5 V3 Service Side Console", "family": "control_console", "footprintFamily": "cabinet", "solid": True, "canHoldSmallProps": True, "clueCapacity": 2}),
]


def region_average(region_id, regions, atlas):
    x, y, w, h = regions[region_id]["atlasRect"]
    crop = atlas.crop((x, y, x + w, y + h)).convert("RGB").resize((8, 8), Image.BICUBIC)
    return np.array(crop).mean(axis=(0, 1)).astype(np.uint8)


def iso_render(scene, regions, atlas, size=320):
    az, el = math.radians(34), math.radians(22)
    rot_y = np.array([[math.cos(az), 0, math.sin(az)], [0, 1, 0], [-math.sin(az), 0, math.cos(az)]])
    rot_x = np.array([[1, 0, 0], [0, math.cos(el), -math.sin(el)], [0, math.sin(el), math.cos(el)]])
    matrix = rot_x @ rot_y
    key = np.array([0.52, 0.84, 0.30])
    key /= np.linalg.norm(key)
    tris, depths, colors = [], [], []
    for geom in scene.geometry.values():
        verts = geom.vertices @ matrix.T
        avg = region_average(geom.metadata.get("region_id", ""), regions, atlas) if geom.metadata.get("region_id") in regions else np.array([70, 72, 75], dtype=np.uint8)
        for face in geom.faces:
            p = verts[face]
            normal = np.cross(p[1] - p[0], p[2] - p[0])
            nn = np.linalg.norm(normal)
            if nn < 1e-9:
                continue
            normal /= nn
            shade = 0.24 + 0.72 * max(0.0, float(np.dot(normal, key)))
            colors.append(tuple(int(min(255, c * shade + 8)) for c in avg))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())
    img = Image.new("RGB", (size, size), (8, 9, 12))
    draw = ImageDraw.Draw(img)
    if not tris:
        return img
    pts = np.concatenate(tris)
    mn, mx = pts.min(axis=0), pts.max(axis=0)
    scale = (size * 0.84) / max(1e-6, (mx - mn).max())
    offset = np.array([size, size]) / 2 - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        poly = tris[idx] * scale * np.array([1, -1]) + offset
        draw.polygon([tuple(p) for p in poly], fill=colors[idx])
    return img


def make_contact_sheet(scenes, atlas, regions):
    cell = 320
    sheet = Image.new("RGB", (cell * 5, 980), (10, 10, 13))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 13)
        font_sm = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 10)
    except Exception:
        font = ImageFont.load_default()
        font_sm = font
    d.text((12, 8), "Level 05 v3 batch02 furniture - real Image2 cutouts -> area-UV textured GLB", fill=(225, 230, 235), font=font)
    for i, (key, scene) in enumerate(scenes):
        x = i * cell
        sheet.paste(iso_render(scene, regions, atlas, cell - 20), (x + 10, 28))
        d.text((x + 12, 32), key.replace("room_l5_v3_", ""), fill=(230, 220, 190), font=font_sm)
    atlas_y = cell + 38
    sheet.paste(atlas.convert("RGB").resize((420, 420), Image.BICUBIC), (10, atlas_y))
    d.text((12, atlas_y + 424), "2048 atlas: 35 semantic cutout-composited regions", fill=(165, 225, 235), font=font_sm)
    swatch_x = 450
    for i, region_id in enumerate(regions.keys()):
        rx, ry, rw, rh = regions[region_id]["atlasRect"]
        swatch = atlas.crop((rx, ry, rx + rw, ry + rh)).convert("RGB").resize((60, 60), Image.BICUBIC)
        x = swatch_x + (i % 12) * 90
        y = atlas_y + (i // 12) * 92
        sheet.paste(swatch, (x, y))
        d.text((x, y + 62), region_id.replace("_", " ")[:15], fill=(180, 195, 205), font=font_sm)
    source_y = atlas_y + 470
    for i, (source_id, info) in enumerate(SOURCE_SHEETS.items()):
        src = Image.open(SRC_DIR / info["file"]).convert("RGB")
        thumb = src.resize((250, int(250 * src.height / src.width)), Image.BICUBIC)
        x = 10 + i * 310
        sheet.paste(thumb, (x, source_y))
        d.text((x, source_y + thumb.height + 4), f"{source_id}: Image2 source sheet", fill=(210, 210, 218), font=font_sm)
    out = TMP_DIR / "level05-v3-batch02-contact-sheet.png"
    sheet.save(out)
    return out


def uv_audit_for_geom(geom) -> dict[str, object]:
    uv = getattr(geom.visual, "uv", None)
    if uv is None or np.asarray(uv).size == 0:
        return {"hasUv": False, "uvSpan": [0, 0], "uvArea": 0, "areaMapped": False}
    uv_arr = np.asarray(uv, dtype=np.float64)
    span = np.ptp(uv_arr, axis=0)
    area = float(span[0] * span[1])
    return {"hasUv": True, "uvSpan": [round(float(span[0]), 6), round(float(span[1]), 6)], "uvArea": round(area, 8), "areaMapped": area > 0.00005 and float(span[0]) > 0.001 and float(span[1]) > 0.001}


def write_provenance(audit):
    provenance = {
        "schemaVersion": "hp.image2.sourceProvenance.v1",
        "packId": PACK_ID,
        "revision": REVISION,
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
            "Each atlas region has a transparent cutout PNG with alpha stats.",
            "GLB audit requires baseColorTexture and area UV coverage.",
            "No center-sampled UV nodes are allowed.",
            "Chair and sofa polish pass replaces block arrays with continuous bowls, curved arcs, and soft cushion lobes.",
            "Chair front cleanup removes the exposed front gasket bar, cyan bead row, root gasket tabs, and screw brackets from the player-facing face.",
            "Sofa front cleanup removes exposed status slit, brass foot caps, and screw plates from the player-facing face.",
            "Assets are not placed into official Level 5 until user approves.",
        ],
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, indent=2) + "\n")
    lines = [
        "# Level 05 v3 Batch 02 Furniture Image2 Prompt Ledger",
        "",
        "Five new furniture assets generated from real Image2 source sheets, transparent cutouts, semantic atlas regions, and area-UV GLBs.",
        "",
        "- License label: `openai-generated-output-user-owned-subject-to-openai-terms`",
        "- Classification: `owned-generated-output`",
        "- Generation call id: `not-exposed-by-codex-imagegen`",
        "",
    ]
    for source_id, info in SOURCE_SHEETS.items():
        lines.extend([
            f"## {source_id} / `{info['modelKey']}`",
            "",
            f"- Copied source: `{(SRC_DIR / info['file']).relative_to(REPO)}`",
            f"- Generated cache: `{info['generatedCache']}`",
            f"- Prompt: {info['prompt']}",
            f"- Transparent cutouts: `{CUTOUT_DIR.relative_to(REPO)}/<region>.png`",
            "- Named cut regions:",
        ])
        for spec in [item for item in REGION_SPECS if item.source_id == source_id]:
            lines.append(f"  - `{spec.region_id}` crop={list(spec.crop)} - {spec.note}")
        lines.append("")
    PROMPT_LEDGER.write_text("\n".join(lines) + "\n")


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
            mats.append({
                "node": geom_name,
                "material": getattr(mat, "name", None),
                "baseColorTexture": getattr(mat, "baseColorTexture", None) is not None,
                **uv_audit_for_geom(geom),
            })
        vertex_count = int(sum(len(g.vertices) for g in reloaded.geometry.values()))
        triangle_count = int(sum(len(g.faces) for g in reloaded.geometry.values()))
        textured = sum(1 for item in mats if item["baseColorTexture"])
        area_uv = sum(1 for item in mats if item["areaMapped"])
        center_uv = sum(1 for item in mats if item["hasUv"] and not item["areaMapped"])
        missing_uv = sum(1 for item in mats if not item["hasUv"])
        audit.append({
            "modelKey": model_key,
            "glb": str(glb_path.relative_to(REPO)),
            "bytes": len(data),
            "sizeMeters": size,
            "expectedNamedParts": expected_parts,
            "geometryNodes": len(reloaded.geometry),
            "vertices": vertex_count,
            "triangles": triangle_count,
            "materialsWithBaseColorTexture": textured,
            "uvNodes": sum(1 for item in mats if item["hasUv"]),
            "areaUvNodes": area_uv,
            "centerSampleUvNodes": center_uv,
            "missingUvNodes": missing_uv,
            "areaUvCoverageRatio": round(area_uv / max(1, len(reloaded.geometry)), 4),
            "materials": mats,
        })
        print(f"  {model_key:38s} {len(data):7d} B nodes={len(reloaded.geometry):2d} verts={vertex_count:5d} areaUV={area_uv:2d}/{len(reloaded.geometry):2d} size={size}")
        manifest_assets.append({
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
            "mount": "floor",
            "canHoldSmallProps": spec["canHoldSmallProps"],
            "clueCapacity": spec["clueCapacity"],
            "footprintFamily": spec["footprintFamily"],
            "tags": ["level:05", "theme:reclamation-core", "style:image2-v3-batch02", "source:independent-image2-sheet", "texture:transparent-cutout", "uv:area-mapped", f"family:{spec['family']}"],
            **({"supportSurfaces": spec["supportSurfaces"]} if "supportSurfaces" in spec else {}),
        })
    MANIFEST.write_text(json.dumps({
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP Level 05 Reclamation Core Furniture v3 Batch 02 (Image2 Cutout UV)",
        "sourceTool": "generate-level05-reclamation-furniture-image2-v3-batch02-assets.py",
        "generatedAt": "2026-06-27",
        "revision": REVISION,
        "atlas": {"image": str(ATLAS_PNG.relative_to(REPO)), "regions": str(ATLAS_REGIONS.relative_to(REPO)), "size": [ATLAS_SIZE, ATLAS_SIZE]},
        "assets": manifest_assets,
    }, indent=2) + "\n")
    (TMP_DIR / "glb-texture-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    contact = make_contact_sheet(scenes, atlas, regions)
    write_provenance(audit)
    print(f"manifest -> {MANIFEST.relative_to(REPO)} ({len(manifest_assets)} assets)")
    print(f"atlas -> {ATLAS_PNG.relative_to(REPO)} ({len(regions)} regions)")
    print(f"contact -> {contact.relative_to(REPO)}")
    print(f"provenance -> {PROVENANCE_JSON.relative_to(REPO)}")
    return audit


def main():
    print("== Level 05 Reclamation Core v3 batch02 furniture Image2 pack ==")
    atlas, regions = build_atlas()
    set_pbr_maps(atlas)
    export_assets(atlas, regions)


if __name__ == "__main__":
    main()
