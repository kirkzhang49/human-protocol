#!/usr/bin/env python3
"""Human Protocol Level 05 Reclamation Core - v3 Batch 03 furniture Image2 pack.

Batch 03 is intentionally isolated from the v3 hero pack and official Level 5
configuration. It consumes five real generated/Image2 orthographic parts sheets,
cuts semantic transparent regions, packs a shared atlas, and exports five cooked
GLBs with named geometry and area UVs.

Run:
    python3 scripts/asset-build/generate-level05-reclamation-furniture-image2-v3-batch03-assets.py
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
TEX_DIR = REPO / "src/assets/textures/environment/level05-reclamation-furniture-image2-v3-batch03"
SRC_DIR = TEX_DIR / "image2-sources"
CUTOUT_DIR = TEX_DIR / "image2-cutouts"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level05-reclamation-furniture-image2-v3-batch03"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch03.json"
REPORT_DIR = REPO / "src/assets/manifests/reports"

ATLAS_SIZE = 2048
CELL = 256
ATLAS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch03_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch03_atlas.regions.json"
PBR_NORMAL_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch03_normal.png"
PBR_METALLIC_ROUGHNESS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch03_metallicroughness.png"
PBR_OCCLUSION_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch03_occlusion.png"
PROMPT_LEDGER = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch03_prompt_ledger.md"
PROVENANCE_JSON = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch03_source_provenance.json"
AUDIT_JSON = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch03_glb-texture-audit.json"
CONTACT_SHEET = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch03_contact_sheet.png"

PACK_ID = "hp_level05_reclamation_furniture_image2_v3_batch03"
SOURCE_ID = "level05-reclamation-furniture-image2-v3-batch03"
THEME_ID = "hp_reclamation_core_v3"
GROUP = "诊疗"
PBR_MAPS: dict[str, Image.Image] = {}

for directory in (TEX_DIR, SRC_DIR, CUTOUT_DIR, GLB_DIR, MANIFEST.parent, REPORT_DIR):
    directory.mkdir(parents=True, exist_ok=True)


SOURCE_SHEETS = {
    "couch": {
        "file": "bio_recline_couch_parts_image2.png",
        "modelKey": "room_l5_v3_bio_recline_couch",
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f0a30-d34c-7c43-ba68-a708ca030fbe/"
            "ig_0de12353e253c363016a400cc178d8819b80054127f7a6c94e.png"
        ),
        "prompt": (
            "High-detail orthographic parts sheet for a sci-fi medical/reclamation reclining couch: "
            "low black ribbed soft recline pads, white ceramic curved shell panels, graphite underframe, "
            "brass hinge rails and clamps, cyan glass status slit, black rubber gasket strips, screws."
        ),
    },
    "terminal": {
        "file": "memory_diagnostic_terminal_parts_image2.png",
        "modelKey": "room_l5_v3_memory_diagnostic_terminal",
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f0a30-d34c-7c43-ba68-a708ca030fbe/"
            "ig_0de12353e253c363016a400cf43928819b8c3d4281f834ca8e.png"
        ),
        "prompt": (
            "High-detail orthographic parts sheet for a standing memory diagnostic terminal: smoked glass "
            "diagnostic screen panels, graphite pedestal base, white ceramic back shells, aged brass side rails, "
            "cyan data lens strips, black rubber gasket bars, vent grilles and screw hardware."
        ),
    },
    "freezer": {
        "file": "tissue_freezer_cabinet_parts_image2.png",
        "modelKey": "room_l5_v3_tissue_freezer_cabinet",
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f0a30-d34c-7c43-ba68-a708ca030fbe/"
            "ig_0de12353e253c363016a400d24d51c819b8685eac8a19776b9.png"
        ),
        "prompt": (
            "High-detail orthographic parts sheet for a sci-fi tissue freezer / medical cold cabinet: white "
            "ceramic cabinet doors, cyan frosted inspection windows, black rubber gaskets, graphite compressor "
            "base, aged brass hinge rods and handles, vent panels, latch hardware and cyan status strips."
        ),
    },
    "rack": {
        "file": "limb_calibration_rack_parts_image2.png",
        "modelKey": "room_l5_v3_limb_calibration_rack",
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f0a30-d34c-7c43-ba68-a708ca030fbe/"
            "ig_0de12353e253c363016a400d534624819b90811dc8136ee6fa.png"
        ),
        "prompt": (
            "High-detail orthographic parts sheet for a limb calibration rack / biomechanical equipment frame: "
            "tall narrow graphite frame rails, white ceramic upright shells, aged brass articulated clamps, black "
            "padded limb supports, cyan measurement lens strips, black cable/gasket runs, base feet and bolts."
        ),
    },
    "dock": {
        "file": "cleaning_robot_dock_parts_image2.png",
        "modelKey": "room_l5_v3_cleaning_robot_dock",
        "generatedCache": (
            "/Users/zhengkaizhang/.codex/generated_images/019f0a30-d34c-7c43-ba68-a708ca030fbe/"
            "ig_0de12353e253c363016a400d85d320819bbab1d67ce50127da.png"
        ),
        "prompt": (
            "High-detail orthographic parts sheet for a low cleaning robot dock: rounded graphite and white "
            "ceramic docking base panels, cyan glowing ring and charging lens, brass charging contacts and guide "
            "rails, black rubber bumpers, gasket strips, vents, contact pads and cable socket covers."
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
    RegionSpec("couch_black_ribbed_pad", "couch", (18, 28, 285, 805), "stacked black soft couch pads"),
    RegionSpec("couch_white_ceramic_shell", "couch", (330, 28, 600, 438), "curved white ceramic recline shells"),
    RegionSpec("couch_graphite_underframe", "couch", (315, 480, 610, 270), "graphite mechanical couch underframe"),
    RegionSpec("couch_brass_hinge_clamps", "couch", (885, 475, 462, 315), "brass hinge rails and clamps"),
    RegionSpec("couch_cyan_status_slit", "couch", (920, 122, 268, 326), "cyan glass status slit modules"),
    RegionSpec("couch_black_gasket_strips", "couch", (1188, 36, 325, 430), "black rubber gasket and bumper strips"),
    RegionSpec("couch_screws_fasteners", "couch", (1095, 782, 430, 220), "small screws and fasteners"),
    RegionSpec("terminal_smoked_screen", "terminal", (42, 58, 360, 705), "tall smoked glass screen panels"),
    RegionSpec("terminal_graphite_pedestal", "terminal", (410, 150, 205, 735), "graphite standing pedestal and base"),
    RegionSpec("terminal_white_ceramic_shell", "terminal", (610, 70, 242, 1010), "white ceramic rear shell sections"),
    RegionSpec("terminal_brass_side_rails", "terminal", (862, 22, 130, 760), "brass side rail rods and brackets"),
    RegionSpec("terminal_cyan_data_slits", "terminal", (28, 1110, 490, 248), "cyan data lens strips"),
    RegionSpec("terminal_black_gasket_bars", "terminal", (430, 1110, 220, 360), "black gasket and base bars"),
    RegionSpec("terminal_screws_ports", "terminal", (820, 865, 190, 620), "screws ports and small brackets"),
    RegionSpec("freezer_white_ceramic_door", "freezer", (40, 72, 420, 680), "white ceramic freezer door panel"),
    RegionSpec("freezer_cyan_frosted_window", "freezer", (130, 142, 740, 380), "cyan frosted freezer windows"),
    RegionSpec("freezer_black_gasket", "freezer", (880, 202, 280, 405), "black door gasket strips"),
    RegionSpec("freezer_graphite_compressor_base", "freezer", (32, 612, 715, 305), "graphite compressor drawer base"),
    RegionSpec("freezer_brass_hinges_handles", "freezer", (730, 548, 395, 420), "brass hinges handles and latch rods"),
    RegionSpec("freezer_vent_grilles", "freezer", (1188, 68, 310, 505), "vent grilles and perforated panels"),
    RegionSpec("freezer_screws_latches", "freezer", (1080, 580, 430, 380), "screws latch plates and tiny hardware"),
    RegionSpec("rack_graphite_rails", "rack", (22, 28, 170, 1265), "long graphite frame rails with cyan lines"),
    RegionSpec("rack_white_ceramic_uprights", "rack", (215, 90, 245, 840), "white ceramic upright shells"),
    RegionSpec("rack_brass_articulated_clamps", "rack", (455, 28, 315, 840), "brass articulated calibration clamps"),
    RegionSpec("rack_black_limb_pads", "rack", (782, 38, 220, 495), "black padded limb supports"),
    RegionSpec("rack_black_cable_gaskets", "rack", (760, 630, 245, 470), "black cables and gasket runs"),
    RegionSpec("rack_graphite_base_feet", "rack", (128, 960, 520, 430), "graphite base feet and collars"),
    RegionSpec("rack_screws_brackets", "rack", (620, 1035, 380, 445), "bolts bracket plates and small clamps"),
    RegionSpec("dock_rounded_ceramic_base", "dock", (24, 48, 390, 382), "rounded white ceramic dock top"),
    RegionSpec("dock_cyan_charging_ring", "dock", (118, 120, 210, 210), "cyan charging ring lens"),
    RegionSpec("dock_graphite_cradle", "dock", (505, 340, 410, 340), "low graphite robot cradle recess"),
    RegionSpec("dock_white_shell_parts", "dock", (765, 30, 522, 260), "white ceramic shell cover parts"),
    RegionSpec("dock_black_bumpers_gaskets", "dock", (1195, 38, 310, 605), "black rubber bumpers and gasket strips"),
    RegionSpec("dock_brass_contacts_rails", "dock", (28, 465, 622, 195), "brass charging contacts and guide rails"),
    RegionSpec("dock_screws_ports", "dock", (42, 672, 1015, 330), "screws cable ports and contact pads"),
]


def load_source_sheets() -> dict[str, Image.Image]:
    images = {}
    for source_id, info in SOURCE_SHEETS.items():
        path = SRC_DIR / info["file"]
        if not path.exists():
            raise FileNotFoundError(f"missing generated Image2 source sheet: {path}")
        images[source_id] = Image.open(path).convert("RGBA")
    return images


def _border_connected_background_mask(rgb: np.ndarray) -> np.ndarray:
    rgb16 = rgb.astype(np.int16)
    brightness = rgb16.mean(axis=2)
    chroma = rgb16.max(axis=2) - rgb16.min(axis=2)
    candidate = ((brightness > 226) & (chroma < 48)) | (brightness > 248)
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
        rgb = np.array([38, 40, 42], dtype=np.uint8)
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
        cutout, stats = make_transparent_cutout(raw_crop)
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
            "alphaCutStats": stats,
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
        + "\n",
    )
    return atlas, regions


def _uv_rect(region_id: str, regions: dict[str, dict]) -> tuple[float, float, float, float]:
    x, y, w, h = regions[region_id]["atlasRect"]
    return x / ATLAS_SIZE, 1.0 - ((y + h) / ATLAS_SIZE), (x + w) / ATLAS_SIZE, 1.0 - (y / ATLAS_SIZE)


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
    return _uv_from_unit(region_id, regions, _normalise(verts[:, int(axes[1])]), _normalise(verts[:, int(axes[0])]))


def _sphere_project_uv(mesh: trimesh.Trimesh, region_id: str, regions: dict[str, dict]) -> np.ndarray:
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    center = (verts.min(axis=0) + verts.max(axis=0)) / 2
    rel = verts - center
    angle = np.arctan2(rel[:, 2], rel[:, 0])
    return _uv_from_unit(region_id, regions, (angle + math.pi) / math.tau, _normalise(rel[:, 1]))


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


def tag(mesh: trimesh.Trimesh, region_id: str) -> trimesh.Trimesh:
    mesh.metadata["region_id"] = region_id
    return mesh


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
    mesh.visual = TextureVisuals(uv=_box_project_uv(mesh, region_id, regions), material=material(region_id, atlas, metallic, roughness), image=atlas)
    return tag(mesh, region_id)


def box(extents, region_id: str, regions: dict[str, dict], atlas: Image.Image, metallic=0.05, roughness=0.55):
    mesh = trimesh.creation.box(extents=extents)
    mesh.visual = TextureVisuals(uv=_box_project_uv(mesh, region_id, regions), material=material(region_id, atlas, metallic, roughness), image=atlas)
    return tag(mesh, region_id)


def cyl(radius, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=48, axis="y", metallic=0.1, roughness=0.45):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    verts = np.asarray(mesh.vertices, dtype=np.float64)
    angle = np.arctan2(verts[:, 1], verts[:, 0])
    uv = _uv_from_unit(region_id, regions, (angle + math.pi) / math.tau, _normalise(verts[:, 2]))
    mesh.visual = TextureVisuals(uv=uv, material=material(region_id, atlas, metallic, roughness), image=atlas)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    elif axis != "z":
        raise ValueError(f"unsupported cylinder axis {axis}")
    return tag(mesh, region_id)


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
    mesh.visual = TextureVisuals(uv=_uv_from_unit(region_id, regions, np.array(u_units), np.array(v_units)), material=material(region_id, atlas, metallic, roughness), image=atlas)
    return tag(mesh, region_id)


def sphere(radius, region_id: str, regions: dict[str, dict], atlas: Image.Image, scale=(1, 1, 1), subdivisions=2, metallic=0.05, roughness=0.35):
    mesh = trimesh.creation.icosphere(radius=radius, subdivisions=subdivisions)
    mesh.apply_scale(scale)
    mesh.visual = TextureVisuals(uv=_sphere_project_uv(mesh, region_id, regions), material=material(region_id, atlas, metallic, roughness), image=atlas)
    return tag(mesh, region_id)


def place(mesh, translate=(0, 0, 0), rotate=None):
    if rotate:
        angle, axis = rotate
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(translate)
    return mesh


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def add_screws(scene, regions, atlas, region_id, positions, radius=0.018, axis="z"):
    for i, pos in enumerate(positions):
        add(scene, place(cyl(radius, 0.018, region_id, regions, atlas, sections=20, axis=axis, metallic=0.45), pos), f"screw_{i:02d}_{region_id}")


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


def build_bio_recline_couch(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([2.35, 0.26, 0.86], "couch_graphite_underframe", regions, atlas, bevel=0.07, metallic=0.42), (0, 0.26, 0)), "graphite_low_recline_frame")
    add(s, place(bevel_box([2.55, 0.10, 1.02], "couch_white_ceramic_shell", regions, atlas, bevel=0.08), (0, 0.43, 0.02)), "white_ceramic_lower_shell")
    for x, rot, name in ((-0.62, math.radians(-7), "back_pad"), (0.44, math.radians(4), "seat_pad")):
        add(s, place(bevel_box([1.05, 0.16, 0.78], "couch_black_ribbed_pad", regions, atlas, bevel=0.075, roughness=0.86), (x, 0.58, -0.02), (rot, (0, 0, 1))), name)
    for z in (-0.54, 0.54):
        add(s, place(cyl(0.045, 2.42, "couch_brass_hinge_clamps", regions, atlas, axis="x", metallic=0.72), (0.0, 0.61, z)), f"long_brass_side_rail_{z}")
    for x in (-1.04, -0.35, 0.36, 1.04):
        add(s, place(bevel_box([0.12, 0.18, 1.00], "couch_brass_hinge_clamps", regions, atlas, bevel=0.025, metallic=0.75), (x, 0.49, 0)), f"brass_pad_clamp_{x}")
    add(s, place(bevel_box([0.72, 0.065, 0.12], "couch_cyan_status_slit", regions, atlas, bevel=0.035, roughness=0.16), (0.88, 0.75, -0.48)), "cyan_status_slit_front")
    for z in (-0.43, 0.43):
        add(s, place(bevel_box([2.38, 0.07, 0.08], "couch_black_gasket_strips", regions, atlas, bevel=0.022, roughness=0.75), (0, 0.69, z)), f"black_side_gasket_{z}")
    add_screws(s, regions, atlas, "couch_screws_fasteners", [(-1.16, 0.56, -0.45), (1.16, 0.56, -0.45), (-1.16, 0.56, 0.45), (1.16, 0.56, 0.45), (0, 0.78, -0.50)], radius=0.017)
    return s, 22


def build_memory_diagnostic_terminal(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([0.82, 0.20, 0.54], "terminal_graphite_pedestal", regions, atlas, bevel=0.065, metallic=0.45), (0, 0.12, 0)), "wide_graphite_floor_base")
    add(s, place(bevel_box([0.42, 1.45, 0.32], "terminal_graphite_pedestal", regions, atlas, bevel=0.045, metallic=0.45), (0, 0.86, 0.02)), "tall_graphite_spine")
    add(s, place(bevel_box([0.86, 1.18, 0.10], "terminal_smoked_screen", regions, atlas, bevel=0.06, roughness=0.18), (0, 1.45, -0.19)), "smoked_glass_diagnostic_screen")
    add(s, place(bevel_box([0.98, 1.36, 0.13], "terminal_white_ceramic_shell", regions, atlas, bevel=0.055), (0, 1.42, -0.12)), "white_ceramic_screen_shell")
    for x in (-0.58, 0.58):
        add(s, place(cyl(0.032, 1.52, "terminal_brass_side_rails", regions, atlas, axis="y", metallic=0.78), (x, 1.42, -0.23)), f"brass_vertical_side_rail_{x}")
        add(s, place(bevel_box([0.08, 0.23, 0.08], "terminal_brass_side_rails", regions, atlas, bevel=0.018, metallic=0.78), (x, 0.82, -0.23)), f"lower_brass_mount_{x}")
    for y in (1.02, 1.42, 1.82):
        add(s, place(bevel_box([0.58, 0.055, 0.045], "terminal_cyan_data_slits", regions, atlas, bevel=0.025, roughness=0.15), (0, y, -0.285)), f"cyan_horizontal_status_slit_{y}")
    for y in (0.62, 2.12):
        add(s, place(bevel_box([0.75, 0.055, 0.07], "terminal_black_gasket_bars", regions, atlas, bevel=0.018, roughness=0.72), (0, y, -0.27)), f"black_screen_gasket_{y}")
    add_screws(s, regions, atlas, "terminal_screws_ports", [(-0.47, 2.0, -0.30), (0.47, 2.0, -0.30), (-0.47, 0.84, -0.30), (0.47, 0.84, -0.30)], radius=0.016)
    return s, 20


def build_tissue_freezer_cabinet(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([1.28, 1.55, 0.48], "freezer_white_ceramic_door", regions, atlas, bevel=0.07), (0, 0.88, 0)), "white_ceramic_cold_cabinet_body")
    add(s, place(bevel_box([1.18, 0.26, 0.55], "freezer_graphite_compressor_base", regions, atlas, bevel=0.045, metallic=0.42), (0, 0.16, 0)), "graphite_compressor_plinth")
    add(s, place(bevel_box([1.06, 1.26, 0.035], "freezer_black_gasket", regions, atlas, bevel=0.020, roughness=0.78), (0, 1.00, -0.235)), "flush_dark_freezer_door_backing")
    add(s, place(bevel_box([1.36, 0.12, 0.56], "freezer_graphite_compressor_base", regions, atlas, bevel=0.035, metallic=0.40), (0, 1.70, 0.00)), "cold_storage_top_compressor_cap")
    for x in (-0.32, 0.32):
        add(s, place(bevel_box([0.46, 1.08, 0.065], "freezer_white_ceramic_door", regions, atlas, bevel=0.04), (x, 0.98, -0.28), (math.radians(3 if x < 0 else -3), (0, 1, 0))), f"separate_ceramic_door_{x}")
        add(s, place(bevel_box([0.30, 0.48, 0.045], "freezer_cyan_frosted_window", regions, atlas, bevel=0.05, roughness=0.2), (x, 1.12, -0.33)), f"cyan_frosted_window_{x}")
        add(s, place(bevel_box([0.35, 0.52, 0.030], "freezer_black_gasket", regions, atlas, bevel=0.018, roughness=0.74), (x, 1.12, -0.344)), f"front_black_window_recess_gasket_{x}")
        add(s, place(bevel_box([0.26, 0.42, 0.04], "freezer_cyan_frosted_window", regions, atlas, bevel=0.045, roughness=0.2), (x, 1.10, 0.31)), f"rear_visible_cyan_window_{x}")
        add(s, place(bevel_box([0.38, 0.57, 0.035], "freezer_black_gasket", regions, atlas, bevel=0.025, roughness=0.72), (x, 1.10, 0.285)), f"rear_black_window_gasket_{x}")
        add(s, place(cyl(0.026, 0.60, "freezer_brass_hinges_handles", regions, atlas, sections=28, axis="y", metallic=0.78), (x + (0.21 if x < 0 else -0.21), 1.02, -0.352)), f"vertical_brass_freezer_pull_{x}")
    for x in (-0.62, 0.62):
        add(s, place(cyl(0.034, 1.18, "freezer_brass_hinges_handles", regions, atlas, axis="y", metallic=0.76), (x, 0.96, -0.33)), f"brass_vertical_hinge_{x}")
        for y in (0.52, 0.96, 1.40):
            add(s, place(cyl(0.040, 0.10, "freezer_brass_hinges_handles", regions, atlas, sections=28, axis="y", metallic=0.78), (x, y, -0.350)), f"freezer_hinge_knuckle_{x}_{y}")
    for y in (0.48, 1.62):
        add(s, place(bevel_box([1.02, 0.052, 0.040], "freezer_black_gasket", regions, atlas, bevel=0.014, roughness=0.7), (0, y, -0.318)), f"black_horizontal_gasket_{y}")
        add(s, place(bevel_box([1.04, 0.055, 0.045], "freezer_black_gasket", regions, atlas, bevel=0.018, roughness=0.7), (0, y, 0.31)), f"rear_black_horizontal_gasket_{y}")
    add(s, place(bevel_box([0.035, 1.12, 0.035], "freezer_black_gasket", regions, atlas, bevel=0.010, roughness=0.82), (0, 1.02, -0.322)), "center_freezer_door_shadow_split")
    for y in (0.86, 1.26):
        add(s, place(bevel_box([0.045, 0.24, 0.34], "freezer_cyan_frosted_window", regions, atlas, bevel=0.035, roughness=0.2), (0.675, y, -0.02)), f"right_side_cyan_cold_status_{y}")
    add(s, place(bevel_box([0.88, 0.25, 0.04], "freezer_vent_grilles", regions, atlas, bevel=0.018, metallic=0.28), (0, 0.25, -0.32)), "front_vent_grille_panel")
    for i, x in enumerate(np.linspace(-0.38, 0.38, 5)):
        add(s, place(bevel_box([0.036, 0.20, 0.036], "freezer_vent_grilles", regions, atlas, bevel=0.008, metallic=0.30), (x, 0.25, -0.340)), f"individual_front_vent_louver_{i}")
    for x in (-0.18, 0.18):
        add(s, place(bevel_box([0.09, 0.22, 0.052], "freezer_screws_latches", regions, atlas, bevel=0.018, metallic=0.55), (x, 1.56, -0.335)), f"upper_latch_plate_{x}")
    for x in (-0.45, 0.45):
        add(s, place(bevel_box([0.28, 0.10, 0.22], "freezer_graphite_compressor_base", regions, atlas, bevel=0.028, metallic=0.40), (x, 0.055, -0.10)), f"heavy_freezer_leveling_foot_{x}")
    add_screws(s, regions, atlas, "freezer_screws_latches", [(-0.52, 1.62, -0.37), (0.52, 1.62, -0.37), (-0.52, 0.38, -0.37), (0.52, 0.38, -0.37)], radius=0.016)
    return s, 45


def build_limb_calibration_rack(regions, atlas):
    s = trimesh.Scene()
    for x in (-0.45, 0.45):
        add(s, place(cyl(0.035, 2.28, "rack_graphite_rails", regions, atlas, axis="y", metallic=0.42), (x, 1.14, 0)), f"tall_graphite_rail_{x}")
        add(s, place(bevel_box([0.16, 1.84, 0.10], "rack_white_ceramic_uprights", regions, atlas, bevel=0.035), (x, 1.14, -0.07)), f"white_ceramic_upright_skin_{x}")
    for y in (0.30, 1.18, 2.05):
        add(s, place(bevel_box([1.12, 0.08, 0.12], "rack_graphite_base_feet", regions, atlas, bevel=0.025, metallic=0.42), (0, y, 0)), f"graphite_crossbar_{y}")
    for i, y in enumerate((0.66, 1.18, 1.70)):
        add(s, place(cyl(0.035, 0.84, "rack_brass_articulated_clamps", regions, atlas, axis="x", metallic=0.78), (0, y, -0.12)), f"brass_calibration_arm_{i}")
        for x in (-0.28, 0.28):
            add(s, place(bevel_box([0.18, 0.12, 0.11], "rack_black_limb_pads", regions, atlas, bevel=0.05, roughness=0.86), (x, y, -0.22)), f"black_limb_pad_{i}_{x}")
            add(s, place(bevel_box([0.13, 0.14, 0.07], "rack_brass_articulated_clamps", regions, atlas, bevel=0.025, metallic=0.78), (x, y + 0.12, -0.14)), f"brass_pad_clamp_{i}_{x}")
    for x in (-0.58, 0.58):
        add(s, place(bevel_box([0.36, 0.11, 0.46], "rack_graphite_base_feet", regions, atlas, bevel=0.04, metallic=0.42), (x, 0.08, 0.04)), f"wide_graphite_floor_foot_{x}")
    for x in (-0.34, 0.34):
        add(s, place(cyl(0.025, 1.72, "rack_black_cable_gaskets", regions, atlas, axis="y", roughness=0.75), (x, 1.18, 0.17)), f"rear_black_cable_run_{x}")
    add_screws(s, regions, atlas, "rack_screws_brackets", [(-0.48, 2.12, -0.09), (0.48, 2.12, -0.09), (-0.48, 0.26, -0.09), (0.48, 0.26, -0.09), (0, 1.18, -0.24)], radius=0.015)
    return s, 29


def build_cleaning_robot_dock(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([1.55, 0.22, 1.08], "dock_rounded_ceramic_base", regions, atlas, bevel=0.12), (0, 0.16, 0)), "rounded_white_ceramic_dock_base")
    add(s, place(bevel_box([1.16, 0.12, 0.76], "dock_graphite_cradle", regions, atlas, bevel=0.08, metallic=0.42), (0, 0.31, 0)), "recessed_graphite_robot_cradle")
    add(s, place(bevel_box([1.02, 0.045, 0.50], "dock_graphite_cradle", regions, atlas, bevel=0.030, metallic=0.38), (0, 0.405, -0.03)), "dark_lower_cradle_floor_shadow")
    add(s, place(disc_y(0.31, "dock_cyan_charging_ring", regions, atlas, sections=96, roughness=0.14), (0, 0.385, -0.03)), "cyan_charging_ring_inlay")
    add(s, place(disc_y(0.15, "dock_graphite_cradle", regions, atlas, sections=72, metallic=0.35), (0, 0.392, -0.03)), "dark_center_contact_disc")
    for x in (-0.42, 0.42):
        add(s, place(bevel_box([0.18, 0.055, 0.54], "dock_brass_contacts_rails", regions, atlas, bevel=0.018, metallic=0.78), (x, 0.42, -0.06)), f"brass_charging_contact_rail_{x}")
        add(s, place(bevel_box([0.075, 0.075, 0.82], "dock_black_bumpers_gaskets", regions, atlas, bevel=0.026, roughness=0.82), (x * 1.18, 0.39, -0.04)), f"inner_black_robot_guide_rail_{x}")
    for z in (-0.54, 0.54):
        add(s, place(bevel_box([1.28, 0.08, 0.10], "dock_black_bumpers_gaskets", regions, atlas, bevel=0.04, roughness=0.82), (0, 0.35, z)), f"black_rubber_bumper_{z}")
    add(s, place(bevel_box([1.22, 0.10, 0.16], "dock_black_bumpers_gaskets", regions, atlas, bevel=0.050, roughness=0.84), (0, 0.31, -0.66)), "front_soft_entry_bumper_lip")
    add(s, place(bevel_box([0.98, 0.055, 0.34], "dock_rounded_ceramic_base", regions, atlas, bevel=0.055), (0, 0.255, -0.76)), "sloped_front_entry_ramp")
    for x in (-0.72, 0.72):
        add(s, place(bevel_box([0.16, 0.11, 0.64], "dock_white_shell_parts", regions, atlas, bevel=0.055), (x, 0.32, 0)), f"side_white_shell_cheek_{x}")
        add(s, place(bevel_box([0.18, 0.16, 0.20], "dock_black_bumpers_gaskets", regions, atlas, bevel=0.045, roughness=0.84), (x, 0.21, -0.54)), f"front_corner_rubber_crash_pad_{x}")
    add(s, place(bevel_box([0.42, 0.08, 0.16], "dock_screws_ports", regions, atlas, bevel=0.025, metallic=0.38), (0, 0.24, 0.56)), "rear_cable_socket_panel")
    add(s, place(cyl(0.035, 0.62, "dock_black_bumpers_gaskets", regions, atlas, sections=28, axis="x", roughness=0.82), (0, 0.25, 0.68)), "rear_black_power_cable_stub")
    for x in (-0.25, 0.25):
        add(s, place(bevel_box([0.16, 0.040, 0.18], "dock_brass_contacts_rails", regions, atlas, bevel=0.018, metallic=0.78), (x, 0.45, -0.36)), f"front_brass_alignment_contact_{x}")
    for x in (-0.48, 0.48):
        add(s, place(bevel_box([0.20, 0.08, 0.18], "dock_screws_ports", regions, atlas, bevel=0.026, metallic=0.38), (x, 0.065, 0.40)), f"rear_weighted_leveling_foot_{x}")
    add_screws(s, regions, atlas, "dock_screws_ports", [(-0.62, 0.38, -0.42), (0.62, 0.38, -0.42), (-0.62, 0.38, 0.42), (0.62, 0.38, 0.42)], radius=0.015)
    return s, 27


ASSETS = [
    ("room_l5_v3_bio_recline_couch", build_bio_recline_couch, {"label": "L5 V3 Bio Recline Couch", "family": "bed_or_exam_table", "footprintFamily": "bed", "solid": True, "mount": "floor", "canHoldSmallProps": False, "clueCapacity": 1}),
    ("room_l5_v3_memory_diagnostic_terminal", build_memory_diagnostic_terminal, {"label": "L5 V3 Memory Diagnostic Terminal", "family": "control_console", "footprintFamily": "pedestal", "solid": True, "mount": "floor", "canHoldSmallProps": False, "clueCapacity": 2}),
    ("room_l5_v3_tissue_freezer_cabinet", build_tissue_freezer_cabinet, {"label": "L5 V3 Tissue Freezer Cabinet", "family": "cabinet", "footprintFamily": "cabinet", "solid": True, "mount": "floor", "canHoldSmallProps": False, "clueCapacity": 2}),
    ("room_l5_v3_limb_calibration_rack", build_limb_calibration_rack, {"label": "L5 V3 Limb Calibration Rack", "family": "display_case", "footprintFamily": "display_case", "solid": True, "mount": "floor", "canHoldSmallProps": False, "clueCapacity": 2}),
    ("room_l5_v3_cleaning_robot_dock", build_cleaning_robot_dock, {"label": "L5 V3 Cleaning Robot Dock", "family": "storage_crate", "footprintFamily": "crate", "solid": True, "mount": "floor", "canHoldSmallProps": True, "clueCapacity": 1}),
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


def iso_render(scene, regions, atlas, size=340):
    az, el = math.radians(34), math.radians(23)
    matrix = np.array([[math.cos(az), 0, math.sin(az)], [0, 1, 0], [-math.sin(az), 0, math.cos(az)]])
    rot_x = np.array([[1, 0, 0], [0, math.cos(el), -math.sin(el)], [0, math.sin(el), math.cos(el)]])
    matrix = rot_x @ matrix
    key = np.array([0.52, 0.84, 0.30])
    key /= np.linalg.norm(key)
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
            shade = 0.25 + 0.72 * max(0.0, float(np.dot(normal / nn, key)))
            colors.append(tuple(int(min(255, c * shade + 8)) for c in avg))
            tris.append(p[:, :2])
            depths.append(p[:, 2].mean())
    img = Image.new("RGB", (size, size), (8, 9, 12))
    if not tris:
        return img
    d = ImageDraw.Draw(img)
    points = np.concatenate(tris)
    mn, mx = points.min(axis=0), points.max(axis=0)
    scale = (size * 0.82) / max(1e-6, float((mx - mn).max()))
    offset = (np.array([size, size]) / 2) - ((mn + mx) / 2) * scale * np.array([1, -1])
    for idx in np.argsort(depths):
        pts = tris[idx] * scale * np.array([1, -1]) + offset
        d.polygon([tuple(p) for p in pts], fill=colors[idx])
    return img


def make_contact_sheet(scenes, atlas, regions):
    cell = 340
    sheet_w = cell * 5
    sheet_h = 1280
    sheet = Image.new("RGB", (sheet_w, sheet_h), (10, 10, 13))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 14)
        font_sm = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 11)
    except Exception:
        font = ImageFont.load_default()
        font_sm = font
    d.text((12, 8), "Level 05 v3 Batch 03 industrial/medical furniture - Image2 cutouts -> area UV GLB", fill=(220, 225, 230), font=font)
    for i, (key, scene) in enumerate(scenes):
        x = i * cell
        sheet.paste(iso_render(scene, regions, atlas, cell - 18), (x + 9, 28))
        d.text((x + 12, 32), key.replace("room_l5_v3_", ""), fill=(230, 218, 190), font=font_sm)
    atlas_y = 370
    sheet.paste(atlas.convert("RGB").resize((512, 512), Image.BICUBIC), (10, atlas_y))
    d.text((12, atlas_y + 516), "2048 atlas: 35 semantic regions from 5 real generated source sheets", fill=(160, 220, 230), font=font_sm)
    swatch_x = 540
    for i, region_id in enumerate(regions.keys()):
        rx, ry, rw, rh = regions[region_id]["atlasRect"]
        swatch = atlas.crop((rx, ry, rx + rw, ry + rh)).convert("RGB").resize((68, 68), Image.BICUBIC)
        x = swatch_x + (i % 10) * 92
        y = atlas_y + (i // 10) * 106
        sheet.paste(swatch, (x, y))
        d.text((x, y + 70), region_id.replace("_", " ")[:15], fill=(180, 195, 205), font=font_sm)
    source_y = 940
    for i, (source_id, info) in enumerate(SOURCE_SHEETS.items()):
        img = Image.open(SRC_DIR / info["file"]).convert("RGB")
        img.thumbnail((300, 230))
        x = 10 + i * 335
        sheet.paste(img, (x, source_y))
        d.text((x, source_y + img.height + 4), f"{source_id}: generated source sheet", fill=(210, 210, 218), font=font_sm)
    sheet.save(CONTACT_SHEET)
    return CONTACT_SHEET


def uv_audit_for_geom(geom) -> dict[str, object]:
    uv = getattr(geom.visual, "uv", None)
    if uv is None:
        return {"hasUv": False, "uvSpan": [0.0, 0.0], "uvArea": 0.0, "areaMapped": False}
    uv_arr = np.asarray(uv, dtype=np.float64)
    if uv_arr.size == 0:
        return {"hasUv": False, "uvSpan": [0.0, 0.0], "uvArea": 0.0, "areaMapped": False}
    span = np.ptp(uv_arr, axis=0)
    area = float(span[0] * span[1])
    return {
        "hasUv": True,
        "uvSpan": [round(float(span[0]), 6), round(float(span[1]), 6)],
        "uvArea": round(area, 8),
        "areaMapped": area > 0.00005 and float(span[0]) > 0.001 and float(span[1]) > 0.001,
    }


def write_provenance(audit):
    provenance = {
        "schemaVersion": "hp.image2.sourceProvenance.v1",
        "packId": PACK_ID,
        "revision": "v1-batch03-industrial-medical-machines",
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
        "contactSheet": str(CONTACT_SHEET.relative_to(REPO)),
        "audit": audit,
        "qaGate": [
            "Each model owns one generated orthographic source sheet copied into image2-sources.",
            "Each source sheet contributes seven semantic transparent cutout PNG regions.",
            "Atlas region records include source sheet path and source crop coordinates.",
            "GLB audit requires baseColorTexture on every geometry material.",
            "GLB audit requires area UV nodes and reports center-sampled nodes.",
            "Assets remain builder-pack-only and are not placed in official Level 5 config.",
        ],
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, indent=2) + "\n")
    lines = [
        "# Level 05 Reclamation Furniture Image2 v3 Batch 03 Prompt Ledger",
        "",
        "Batch 03 contains five industrial/medical machine furniture assets. Sources were generated with Codex built-in imagegen, then copied into the repo-local image2-sources directory before cutting and atlas packing.",
        "",
        f"- License label: `openai-generated-output-user-owned-subject-to-openai-terms`",
        f"- Contact sheet: `{CONTACT_SHEET.relative_to(REPO)}`",
        f"- Atlas regions: `{ATLAS_REGIONS.relative_to(REPO)}`",
        "",
    ]
    for source_id, info in SOURCE_SHEETS.items():
        lines.extend([
            f"## {source_id} / `{info['modelKey']}`",
            "",
            f"- Copied source: `{(SRC_DIR / info['file']).relative_to(REPO)}`",
            f"- Generated cache: `{info['generatedCache']}`",
            f"- Prompt: {info['prompt']}",
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
            uv_audit = uv_audit_for_geom(geom)
            mats.append({
                "node": geom_name,
                "material": getattr(mat, "name", None),
                "baseColorTexture": getattr(mat, "baseColorTexture", None) is not None,
                **uv_audit,
            })
        vertex_count = int(sum(len(g.vertices) for g in reloaded.geometry.values()))
        triangle_count = int(sum(len(g.faces) for g in reloaded.geometry.values()))
        base_textured = sum(1 for item in mats if item["baseColorTexture"])
        uv_nodes = sum(1 for item in mats if item["hasUv"])
        area_uv_nodes = sum(1 for item in mats if item["areaMapped"])
        center_sample_nodes = sum(1 for item in mats if item["hasUv"] and not item["areaMapped"])
        missing_uv_nodes = sum(1 for item in mats if not item["hasUv"])
        audit.append({
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
        })
        print(
            f"  {model_key:42s} {len(data):7d} B nodes={len(reloaded.geometry):2d} "
            f"verts={vertex_count:5d} areaUV={area_uv_nodes:2d}/{len(reloaded.geometry):2d} size={size}"
        )
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
            "mount": spec["mount"],
            "canHoldSmallProps": spec["canHoldSmallProps"],
            "clueCapacity": spec["clueCapacity"],
            "footprintFamily": spec["footprintFamily"],
            "tags": [
                "level:05",
                "theme:reclamation-core",
                "style:image2-v3-batch03",
                "source:generated-image2-sheet",
                "texture:transparent-cutout",
                "uv:area-mapped",
                "role:industrial-medical-machine",
                f"family:{spec['family']}",
            ],
        })
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP Level 05 Reclamation Core Furniture v3 Batch 03 (Industrial Medical Machines)",
        "sourceTool": "generate-level05-reclamation-furniture-image2-v3-batch03-assets.py",
        "generatedAt": "2026-06-27",
        "revision": "v1-batch03-industrial-medical-machines",
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
            "size": [ATLAS_SIZE, ATLAS_SIZE],
        },
        "assets": manifest_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    AUDIT_JSON.write_text(json.dumps(audit, indent=2) + "\n")
    contact = make_contact_sheet(scenes, atlas, regions)
    write_provenance(audit)
    print(f"manifest -> {MANIFEST.relative_to(REPO)} ({len(manifest_assets)} assets)")
    print(f"atlas -> {ATLAS_PNG.relative_to(REPO)} ({len(regions)} regions)")
    print(f"audit -> {AUDIT_JSON.relative_to(REPO)}")
    print(f"contact -> {contact.relative_to(REPO)}")
    print(f"provenance -> {PROVENANCE_JSON.relative_to(REPO)}")
    return audit


def main():
    print("== Level 05 Reclamation Core v3 Batch 03 industrial/medical furniture Image2 pack ==")
    atlas, regions = build_atlas()
    set_pbr_maps(atlas)
    export_assets(atlas, regions)


if __name__ == "__main__":
    main()
