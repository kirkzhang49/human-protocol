#!/usr/bin/env python3
"""Human Protocol Level 05 Reclamation Core - v3 Batch 04 furniture pack.

This pack is intentionally independent from the v3 hero pack and from official
Level 5 config. It consumes five real imagegen/Image2 source sheets copied into
project provenance, cuts semantic transparent regions, packs an atlas, builds
area-UV GLBs, and writes a pending builder manifest.

Run:
    python3 scripts/asset-build/generate-level05-reclamation-furniture-image2-v3-batch04-assets.py
"""

from __future__ import annotations

import json
import math
import shutil
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

from hp_image2_pbr_maps import derive_pbr_maps


REPO = Path(__file__).resolve().parents[2]
TEX_DIR = REPO / "src/assets/textures/environment/level05-reclamation-furniture-image2-v3-batch04"
SRC_DIR = TEX_DIR / "image2-sources"
CUTOUT_DIR = TEX_DIR / "image2-cutouts"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level05-reclamation-furniture-image2-v3-batch04"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level05_reclamation_furniture_image2_v3_batch04.json"
REPORT_DIR = REPO / "src/assets/manifests/reports"
TMP_DIR = REPO / ".tmp/level05-reclamation-furniture-image2-v3-batch04"

ATLAS_SIZE = 2048
CELL = 256
ATLAS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch04_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch04_atlas.regions.json"
PBR_NORMAL_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch04_normal.png"
PBR_METALLIC_ROUGHNESS_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch04_metallicroughness.png"
PBR_OCCLUSION_PNG = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch04_occlusion.png"
CONTACT_SHEET = TEX_DIR / "hp_level05_reclamation_furniture_image2_v3_batch04_contact_sheet.png"
PROMPT_LEDGER = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch04_prompt_ledger.md"
PROVENANCE_JSON = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch04_source_provenance.json"
PROVENANCE_MD = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch04_source_provenance.md"
AUDIT_JSON = REPORT_DIR / "level05_reclamation_furniture_image2_v3_batch04_glb_texture_audit.json"

PACK_ID = "hp_level05_reclamation_furniture_image2_v3_batch04"
SOURCE_ID = "level05-reclamation-furniture-image2-v3-batch04"
THEME_ID = "hp_reclamation_core_v3"
GROUP = "\u6838\u5fc3"
PBR_MAPS: dict[str, Image.Image] = {}


for directory in (TEX_DIR, SRC_DIR, CUTOUT_DIR, GLB_DIR, MANIFEST.parent, REPORT_DIR, TMP_DIR):
    directory.mkdir(parents=True, exist_ok=True)


SOURCE_SHEETS = {
    "shelf": {
        "file": "curved_archive_shelf_parts_image2.png",
        "modelKey": "room_l5_v3_curved_archive_shelf",
        "label": "L5 V3 Curved Archive Shelf",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f0a31-55ca-7093-99a0-fb6383b0c4c2/ig_0ba53dd428fe7763016a400cd0d0c48199ba48a40e7445dc40.png",
        "prompt": "Orthographic parts sheet for a curved archive/display shelf: white ceramic curved shell, black shelf liners, brass edge trims, graphite ribs, cyan status beads, screw caps, gaskets, bracket feet; 3x3 parts grid; no text.",
    },
    "cable": {
        "file": "hanging_cable_organizer_parts_image2.png",
        "modelKey": "room_l5_v3_hanging_cable_organizer",
        "label": "L5 V3 Hanging Cable Organizer",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f0a31-55ca-7093-99a0-fb6383b0c4c2/ig_0ba53dd428fe7763016a400d0c3d8881998261a95a3420bea8.png",
        "prompt": "Orthographic parts sheet for a wall-mounted cable organizer: graphite backplate, shallow cabinet body, cyan cable clips, bundled black cables, black gaskets, brass latches, white ceramic caps, screws, cable tray; 3x3 parts grid; no text.",
    },
    "light": {
        "file": "surgical_light_stand_parts_image2.png",
        "modelKey": "room_l5_v3_surgical_light_stand",
        "label": "L5 V3 Surgical Light Stand",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f0a31-55ca-7093-99a0-fb6383b0c4c2/ig_0ba53dd428fe7763016a400d49336c8199968f4f90cff9f4fb.png",
        "prompt": "Orthographic parts sheet for a floor standing surgical/exam light: circular ring lamp, cyan-white lens segments, brass hinge knuckles, white armature tubes, graphite telescoping pole, black collars, tripod base, screw caps; 3x3 parts grid; no text.",
    },
    "drawers": {
        "file": "specimen_drawer_stack_parts_image2.png",
        "modelKey": "room_l5_v3_specimen_drawer_stack",
        "label": "L5 V3 Specimen Drawer Stack",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f0a31-55ca-7093-99a0-fb6383b0c4c2/ig_0ba53dd428fe7763016a400d881ea88199aa3d0481621a3064.png",
        "prompt": "Orthographic parts sheet for a tall narrow specimen drawer cabinet: graphite shell, many white ceramic drawer faces, blank brass label slots, black gaskets, cyan status beads, brass pulls, side rails, base plinth, screws; 3x3 parts grid; no text.",
    },
    "screen": {
        "file": "corner_privacy_screen_parts_image2.png",
        "modelKey": "room_l5_v3_corner_privacy_screen",
        "label": "L5 V3 Corner Privacy Screen",
        "generatedCache": "/Users/zhengkaizhang/.codex/generated_images/019f0a31-55ca-7093-99a0-fb6383b0c4c2/ig_0ba53dd428fe7763016a400dc3ff7c8199adfef704d3c1f00c.png",
        "prompt": "Orthographic parts sheet for a corner folding privacy screen: black soft padded faces, white ceramic frames, graphite hinge spine, cyan status beads, brass hinge pins, black gasket strips, weighted feet; 3x3 parts grid; no text.",
    },
}


@dataclass(frozen=True)
class RegionSpec:
    region_id: str
    source_id: str
    grid: tuple[int, int]
    note: str


REGION_SPECS = [
    RegionSpec("shelf_white_curved_shell", "shelf", (0, 0), "white ceramic curved shelf shell"),
    RegionSpec("shelf_black_inner_liner", "shelf", (1, 0), "black recessed shelf liner"),
    RegionSpec("shelf_graphite_side_rib", "shelf", (2, 0), "graphite side rib"),
    RegionSpec("shelf_white_lower_panel", "shelf", (0, 1), "curved lower ceramic panel"),
    RegionSpec("shelf_brass_edge_trim", "shelf", (1, 1), "brass edge trim"),
    RegionSpec("shelf_black_gasket_strip", "shelf", (2, 1), "black gasket strip"),
    RegionSpec("shelf_cyan_status_bead", "shelf", (1, 2), "cyan status bead"),
    RegionSpec("shelf_bracket_foot", "shelf", (2, 2), "small bracket feet"),
    RegionSpec("cable_graphite_backplate", "cable", (0, 0), "graphite wall backplate"),
    RegionSpec("cable_recessed_cabinet", "cable", (1, 0), "recessed organizer cabinet"),
    RegionSpec("cable_cyan_clips", "cable", (2, 0), "cyan cable clips"),
    RegionSpec("cable_black_bundle", "cable", (0, 1), "black cable bundle"),
    RegionSpec("cable_black_gasket", "cable", (1, 1), "rubber gasket frame"),
    RegionSpec("cable_brass_latches", "cable", (2, 1), "brass latch hinges"),
    RegionSpec("cable_white_caps", "cable", (0, 2), "white ceramic side caps"),
    RegionSpec("cable_perforated_tray", "cable", (1, 2), "perforated cable tray"),
    RegionSpec("light_cyan_ring_lens", "light", (0, 0), "ring light lens"),
    RegionSpec("light_white_armature", "light", (1, 0), "white armature tube"),
    RegionSpec("light_curved_arm", "light", (2, 0), "curved white lamp neck"),
    RegionSpec("light_graphite_pole", "light", (0, 1), "graphite telescoping pole"),
    RegionSpec("light_brass_hinge", "light", (1, 1), "brass hinge knuckle"),
    RegionSpec("light_black_gasket_collar", "light", (2, 1), "black rubber collar"),
    RegionSpec("light_weighted_base", "light", (0, 2), "weighted tripod base"),
    RegionSpec("light_lower_collar", "light", (1, 2), "lower black collar"),
    RegionSpec("drawers_graphite_shell", "drawers", (0, 0), "tall graphite cabinet shell"),
    RegionSpec("drawers_white_front", "drawers", (1, 0), "white ceramic drawer face"),
    RegionSpec("drawers_side_rail", "drawers", (2, 0), "side rail"),
    RegionSpec("drawers_brass_label_slot", "drawers", (0, 1), "blank brass label slot"),
    RegionSpec("drawers_brass_pull", "drawers", (1, 1), "brass drawer pull"),
    RegionSpec("drawers_cyan_status_bead", "drawers", (2, 1), "cyan status bead"),
    RegionSpec("drawers_black_gasket_frame", "drawers", (0, 2), "black gasket frame"),
    RegionSpec("drawers_base_plinth", "drawers", (1, 2), "dark base plinth"),
    RegionSpec("screen_black_padded_panel", "screen", (0, 0), "black padded folding panel"),
    RegionSpec("screen_center_pad", "screen", (1, 0), "center padded panel"),
    RegionSpec("screen_angled_pad", "screen", (2, 0), "angled padded panel"),
    RegionSpec("screen_graphite_hinge_spine", "screen", (0, 1), "graphite hinge spine"),
    RegionSpec("screen_white_frame_rail", "screen", (1, 1), "white ceramic frame rail"),
    RegionSpec("screen_black_pad_tile", "screen", (2, 1), "black padded inset"),
    RegionSpec("screen_brass_pin", "screen", (0, 2), "brass hinge pin"),
    RegionSpec("screen_weighted_foot", "screen", (1, 2), "weighted foot"),
]


def ensure_source_sheets() -> None:
    for info in SOURCE_SHEETS.values():
        target = SRC_DIR / info["file"]
        if target.exists():
            continue
        cache = Path(info["generatedCache"])
        if not cache.exists():
            raise FileNotFoundError(f"missing Image2 source sheet and generated cache: {target}")
        shutil.copy2(cache, target)


def load_source_sheets() -> dict[str, Image.Image]:
    ensure_source_sheets()
    return {
        source_id: Image.open(SRC_DIR / info["file"]).convert("RGBA")
        for source_id, info in SOURCE_SHEETS.items()
    }


def grid_crop_rect(image: Image.Image, grid: tuple[int, int]) -> tuple[int, int, int, int]:
    col, row = grid
    margin_x = int(image.width * 0.035)
    margin_y = int(image.height * 0.035)
    usable_w = image.width - margin_x * 2
    usable_h = image.height - margin_y * 2
    cell_w = usable_w // 3
    cell_h = usable_h // 3
    pad_x = int(cell_w * 0.035)
    pad_y = int(cell_h * 0.035)
    x = margin_x + col * cell_w + pad_x
    y = margin_y + row * cell_h + pad_y
    w = cell_w - pad_x * 2
    h = cell_h - pad_y * 2
    return x, y, w, h


def _border_connected_background_mask(rgb: np.ndarray) -> np.ndarray:
    rgb16 = rgb.astype(np.int16)
    brightness = rgb16.mean(axis=2)
    chroma = rgb16.max(axis=2) - rgb16.min(axis=2)
    candidate = ((brightness > 214) & (chroma < 54)) | (brightness > 242)
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
    alpha = Image.fromarray(alpha_hard).filter(ImageFilter.GaussianBlur(0.65))
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
        x, y, w, h = grid_crop_rect(source, spec.grid)
        raw_crop = source.crop((x, y, x + w, y + h))
        cutout, cutout_stats = make_transparent_cutout(raw_crop)
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
            "semanticGrid": [spec.grid[0], spec.grid[1]],
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
        + "\n",
    )
    return atlas, regions


def _uv_rect(region_id: str, regions: dict[str, dict]) -> tuple[float, float, float, float]:
    x, y, w, h = regions[region_id]["atlasRect"]
    return x / ATLAS_SIZE, 1.0 - ((y + h) / ATLAS_SIZE), (x + w) / ATLAS_SIZE, 1.0 - (y / ATLAS_SIZE)


def _uv_from_unit(region_id: str, regions: dict[str, dict], u_unit: np.ndarray, v_unit: np.ndarray) -> np.ndarray:
    u0, v0, u1, v1 = _uv_rect(region_id, regions)
    return np.column_stack((u0 + u_unit * (u1 - u0), v1 - v_unit * (v1 - v0)))


def _normalise(values: np.ndarray) -> np.ndarray:
    lo = float(values.min())
    hi = float(values.max())
    if hi - lo < 1e-8:
        return np.full(values.shape, 0.5, dtype=np.float64)
    return (values - lo) / (hi - lo)


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


def _cylinder_z_with_cap_uv(radius: float, height: float, region_id: str, regions: dict[str, dict], sections: int) -> trimesh.Trimesh:
    verts: list[list[float]] = []
    u_units: list[float] = []
    v_units: list[float] = []
    faces: list[list[int]] = []
    half = height / 2.0
    for i in range(sections + 1):
        a = math.tau * i / sections
        x, y = math.cos(a) * radius, math.sin(a) * radius
        base = len(verts)
        verts.extend([[x, y, -half], [x, y, half]])
        u_units.extend([i / sections, i / sections])
        v_units.extend([0.0, 1.0])
        if i < sections:
            faces.extend([[base, base + 2, base + 3], [base, base + 3, base + 1]])
    for cap_z, winding in ((half, 1), (-half, -1)):
        center = len(verts)
        verts.append([0.0, 0.0, cap_z])
        u_units.append(0.5)
        v_units.append(0.5)
        start = len(verts)
        for i in range(sections):
            a = math.tau * i / sections
            verts.append([math.cos(a) * radius, math.sin(a) * radius, cap_z])
            u_units.append(0.5 + math.cos(a) * 0.48)
            v_units.append(0.5 + math.sin(a) * 0.48)
        for i in range(sections):
            if winding > 0:
                faces.append([center, start + i, start + ((i + 1) % sections)])
            else:
                faces.append([center, start + ((i + 1) % sections), start + i])
    mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=False)
    mesh.visual = TextureVisuals(uv=_uv_from_unit(region_id, regions, np.array(u_units), np.array(v_units)))
    return mesh


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
    mesh.visual = TextureVisuals(
        uv=_box_project_uv(mesh, region_id, regions),
        material=material(region_id, atlas, metallic=metallic, roughness=roughness),
        image=atlas,
    )
    return tag(mesh, region_id)


def cyl(radius, height, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=48, axis="y", metallic=0.1, roughness=0.45):
    mesh = _cylinder_z_with_cap_uv(radius, height, region_id, regions, sections)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    elif axis != "z":
        raise ValueError(f"unsupported cylinder axis {axis}")
    mesh.visual = TextureVisuals(
        uv=np.asarray(mesh.visual.uv),
        material=material(region_id, atlas, metallic=metallic, roughness=roughness),
        image=atlas,
    )
    return tag(mesh, region_id)


def rod_between(start, end, radius, region_id: str, regions: dict[str, dict], atlas: Image.Image, sections=36, metallic=0.1, roughness=0.45):
    start_v = np.asarray(start, dtype=np.float64)
    end_v = np.asarray(end, dtype=np.float64)
    delta = end_v - start_v
    length = float(np.linalg.norm(delta))
    if length < 1e-6:
        raise ValueError("rod_between requires distinct endpoints")
    mesh = _cylinder_z_with_cap_uv(radius, length, region_id, regions, sections)
    mesh.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], delta / length))
    mesh.apply_translation((start_v + end_v) / 2.0)
    mesh.visual = TextureVisuals(
        uv=np.asarray(mesh.visual.uv),
        material=material(region_id, atlas, metallic=metallic, roughness=roughness),
        image=atlas,
    )
    return tag(mesh, region_id)


def sphere(radius, region_id: str, regions: dict[str, dict], atlas: Image.Image, scale=(1, 1, 1), subdivisions=2, metallic=0.05, roughness=0.35):
    mesh = trimesh.creation.icosphere(radius=radius, subdivisions=subdivisions)
    mesh.apply_scale(scale)
    mesh.visual = TextureVisuals(
        uv=_sphere_project_uv(mesh, region_id, regions),
        material=material(region_id, atlas, metallic=metallic, roughness=roughness),
        image=atlas,
    )
    return tag(mesh, region_id)


def place(mesh, translate=(0, 0, 0), rotate=None):
    if rotate:
        angle, axis = rotate
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(translate)
    return mesh


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str):
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def screws(scene, regions, atlas, region_id, positions, radius=0.018, depth=0.016, axis="z"):
    for index, pos in enumerate(positions):
        add(scene, place(cyl(radius, depth, region_id, regions, atlas, sections=20, axis=axis, metallic=0.55), pos), f"screw_{index:02d}_{region_id}")


def finalize(scene: trimesh.Scene):
    bounds = scene.bounds
    cx = (bounds[0][0] + bounds[1][0]) / 2
    cz = (bounds[0][2] + bounds[1][2]) / 2
    miny = bounds[0][1]
    delta = np.array([-cx, -miny, -cz], dtype=np.float64)
    for geom in scene.geometry.values():
        geom.vertices += delta
    return [round(float(v), 3) for v in scene.bounds[1] - scene.bounds[0]]


def build_curved_archive_shelf(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([1.52, 2.06, 0.26], "shelf_white_curved_shell", regions, atlas, bevel=0.07), (0, 1.08, 0)), "curved_white_outer_shell")
    add(s, place(bevel_box([1.26, 1.74, 0.30], "shelf_black_inner_liner", regions, atlas, bevel=0.045, roughness=0.82), (0, 1.12, -0.08)), "recessed_black_shelf_cavity")
    for y in (0.52, 0.91, 1.30, 1.69):
        add(s, place(bevel_box([1.20, 0.055, 0.36], "shelf_black_inner_liner", regions, atlas, bevel=0.025, roughness=0.78), (0, y, -0.22)), f"black_display_shelf_{y:.2f}")
        add(s, place(bevel_box([1.31, 0.045, 0.075], "shelf_brass_edge_trim", regions, atlas, bevel=0.018, metallic=0.75), (0, y + 0.04, -0.39)), f"brass_shelf_lip_{y:.2f}")
    for x, angle in ((-0.84, math.radians(-6)), (0.84, math.radians(6))):
        add(s, place(bevel_box([0.12, 1.92, 0.22], "shelf_graphite_side_rib", regions, atlas, bevel=0.035, metallic=0.35), (x, 1.08, -0.05), (angle, (0, 1, 0))), f"graphite_side_rib_{x}")
        add(s, place(bevel_box([0.055, 2.00, 0.08], "shelf_brass_edge_trim", regions, atlas, bevel=0.016, metallic=0.78), (x * 0.95, 1.08, -0.23), (angle, (0, 1, 0))), f"brass_outer_edge_{x}")
    for x in (-0.58, 0.58):
        add(s, place(bevel_box([0.28, 0.10, 0.22], "shelf_bracket_foot", regions, atlas, bevel=0.025, metallic=0.45), (x, 0.08, 0.02)), f"grounded_bracket_foot_{x}")
    for y in (0.32, 1.88):
        for x in (-0.52, 0.52):
            add(s, place(sphere(0.035, "shelf_cyan_status_bead", regions, atlas, scale=(1, 0.55, 1), roughness=0.16), (x, y, -0.43)), f"cyan_status_bead_{x}_{y}")
    screws(s, regions, atlas, "shelf_brass_edge_trim", [(-0.68, 2.02, -0.42), (0.68, 2.02, -0.42), (-0.68, 0.22, -0.42), (0.68, 0.22, -0.42)])
    return s


def build_hanging_cable_organizer(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([1.36, 1.04, 0.16], "cable_graphite_backplate", regions, atlas, bevel=0.045, metallic=0.42), (0, 0.68, 0)), "graphite_wall_backplate")
    add(s, place(bevel_box([1.06, 0.10, 0.16], "cable_recessed_cabinet", regions, atlas, bevel=0.030, metallic=0.36), (0, 1.08, -0.15)), "open_frame_top_rail")
    add(s, place(bevel_box([1.06, 0.10, 0.16], "cable_recessed_cabinet", regions, atlas, bevel=0.030, metallic=0.36), (0, 0.32, -0.15)), "open_frame_bottom_rail")
    for x in (-0.53, 0.53):
        add(s, place(bevel_box([0.10, 0.72, 0.16], "cable_recessed_cabinet", regions, atlas, bevel=0.030, metallic=0.36), (x, 0.70, -0.15)), f"open_frame_side_rail_{x}")
    add(s, place(bevel_box([1.18, 0.09, 0.07], "cable_black_gasket", regions, atlas, bevel=0.02, roughness=0.82), (0, 1.16, -0.24)), "top_black_gasket")
    add(s, place(bevel_box([1.18, 0.09, 0.07], "cable_black_gasket", regions, atlas, bevel=0.02, roughness=0.82), (0, 0.25, -0.24)), "bottom_black_gasket")
    for x in (-0.56, 0.56):
        add(s, place(bevel_box([0.070, 0.78, 0.13], "cable_graphite_backplate", regions, atlas, bevel=0.020, metallic=0.42), (x, 0.70, -0.22)), f"deep_graphite_side_channel_{x}")
    for y in (0.46, 0.70, 0.94):
        add(s, place(bevel_box([0.90, 0.030, 0.042], "cable_perforated_tray", regions, atlas, bevel=0.008, metallic=0.34), (0, y, -0.372)), f"perforated_horizontal_cable_comb_{y}")
    for index, y in enumerate((0.50, 0.70, 0.90)):
        cable = cyl(0.022, 1.00, "cable_black_bundle", regions, atlas, sections=24, axis="x", roughness=0.88)
        add(s, place(cable, (0, y, -0.392)), f"straight_horizontal_cable_run_{index}")
    for x in (-0.32, 0.0, 0.32):
        add(s, place(cyl(0.018, 0.56, "cable_black_bundle", regions, atlas, sections=24, axis="y", roughness=0.88), (x, 0.70, -0.418)), f"straight_vertical_cable_run_{x}")
    for x in (-0.42, -0.14, 0.14, 0.42):
        add(s, place(bevel_box([0.090, 0.22, 0.052], "cable_cyan_clips", regions, atlas, bevel=0.026, roughness=0.18), (x, 0.70, -0.445)), f"cyan_cable_clip_{x}")
    for x in (-0.68, 0.68):
        add(s, place(bevel_box([0.14, 0.88, 0.11], "cable_white_caps", regions, atlas, bevel=0.035), (x, 0.70, -0.18)), f"white_ceramic_side_cap_{x}")
        add(s, place(bevel_box([0.20, 0.13, 0.20], "cable_graphite_backplate", regions, atlas, bevel=0.030, metallic=0.42), (x, 0.20, -0.05)), f"wall_standoff_lower_bracket_{x}")
        add(s, place(bevel_box([0.20, 0.13, 0.20], "cable_graphite_backplate", regions, atlas, bevel=0.030, metallic=0.42), (x, 1.20, -0.05)), f"wall_standoff_upper_bracket_{x}")
    for x in (-0.47, 0.47):
        add(s, place(cyl(0.035, 0.38, "cable_brass_latches", regions, atlas, sections=32, axis="y", metallic=0.75), (x, 1.04, -0.33)), f"brass_hinge_latch_{x}")
        add(s, place(cyl(0.024, 0.12, "cable_brass_latches", regions, atlas, sections=28, axis="x", metallic=0.76), (x, 0.32, -0.400)), f"lower_brass_cable_tie_pin_{x}")
    add(s, place(bevel_box([0.78, 0.18, 0.22], "cable_perforated_tray", regions, atlas, bevel=0.025, metallic=0.32), (0, 0.16, -0.24)), "lower_perforated_cable_tray")
    screws(s, regions, atlas, "cable_graphite_backplate", [(-0.58, 1.10, -0.18), (0.58, 1.10, -0.18), (-0.58, 0.28, -0.18), (0.58, 0.28, -0.18)])
    return s


def build_surgical_light_stand(regions, atlas):
    s = trimesh.Scene()
    add(s, place(cyl(0.30, 0.055, "light_cyan_ring_lens", regions, atlas, sections=88, axis="z", roughness=0.15), (0.02, 2.36, -0.34)), "circular_exam_lamp_lens")
    add(s, place(cyl(0.36, 0.05, "light_brass_hinge", regions, atlas, sections=88, axis="z", metallic=0.7), (0.02, 2.36, -0.305)), "brass_lamp_outer_ring")
    for i in range(8):
        a = math.tau * i / 8
        add(s, place(sphere(0.028, "light_cyan_ring_lens", regions, atlas, scale=(1, 0.45, 1), roughness=0.12), (math.cos(a) * 0.23 + 0.02, 2.36 + math.sin(a) * 0.23, -0.38)), f"individual_lens_segment_{i}")
    lamp_yoke = (0.02, 2.30, -0.30)
    upper_elbow = (-0.42, 2.05, -0.18)
    lower_elbow = (-0.78, 1.66, -0.06)
    pole_socket = (-0.78, 1.50, -0.01)
    add(s, rod_between(lamp_yoke, upper_elbow, 0.048, "light_white_armature", regions, atlas, sections=36), "upper_white_armature_no_gap")
    add(s, rod_between(upper_elbow, lower_elbow, 0.046, "light_curved_arm", regions, atlas, sections=36), "lower_curved_white_armature_no_gap")
    add(s, rod_between(lamp_yoke, (0.02, 2.36, -0.325), 0.040, "light_black_gasket_collar", regions, atlas, sections=32, roughness=0.82), "short_lamp_yoke_socket")
    add(s, rod_between(lower_elbow, pole_socket, 0.043, "light_black_gasket_collar", regions, atlas, sections=32, roughness=0.82), "pole_yoke_socket")
    for name, pos, scale in (
        ("lamp_brass_integrated_knuckle", lamp_yoke, (1.15, 0.72, 0.86)),
        ("upper_elbow_brass_integrated_knuckle", upper_elbow, (1.05, 0.82, 0.90)),
        ("lower_elbow_brass_integrated_knuckle", lower_elbow, (1.06, 0.82, 0.90)),
    ):
        add(s, place(sphere(0.115, "light_brass_hinge", regions, atlas, scale=scale, subdivisions=2, metallic=0.78), pos), name)
        add(s, place(sphere(0.070, "light_black_gasket_collar", regions, atlas, scale=(1.05, 0.54, 0.85), subdivisions=2, roughness=0.84), (pos[0], pos[1], pos[2] - 0.018)), f"{name}_black_compression_gasket")
    add(s, place(cyl(0.055, 1.50, "light_graphite_pole", regions, atlas, sections=36, axis="y", metallic=0.42), (-0.78, 0.86, 0)), "graphite_telescoping_pole")
    for y in (0.33, 1.47):
        add(s, place(cyl(0.105, 0.10, "light_black_gasket_collar", regions, atlas, sections=36, axis="y", roughness=0.85), (-0.78, y, 0)), f"black_pole_collar_{y}")
    add(s, place(cyl(0.24, 0.085, "light_weighted_base", regions, atlas, sections=64, axis="y", metallic=0.35), (-0.78, 0.08, 0)), "weighted_round_base")
    for i in range(3):
        a = math.tau * i / 3
        foot = bevel_box([0.46, 0.055, 0.10], "light_weighted_base", regions, atlas, bevel=0.025, metallic=0.35)
        foot.apply_transform(trimesh.transformations.rotation_matrix(-a, (0, 1, 0)))
        add(s, place(foot, (-0.78 + math.cos(a) * 0.24, 0.055, math.sin(a) * 0.24)), f"tripod_weighted_foot_{i}")
    return s


def build_specimen_drawer_stack(regions, atlas):
    s = trimesh.Scene()
    add(s, place(bevel_box([0.78, 2.02, 0.44], "drawers_graphite_shell", regions, atlas, bevel=0.055, metallic=0.4), (0, 1.04, 0)), "tall_graphite_drawer_shell")
    for i in range(8):
        y = 0.30 + i * 0.205
        add(s, place(bevel_box([0.62, 0.145, 0.055], "drawers_white_front", regions, atlas, bevel=0.025), (0, y, -0.255)), f"white_ceramic_drawer_front_{i}")
        add(s, place(bevel_box([0.25, 0.035, 0.030], "drawers_brass_label_slot", regions, atlas, bevel=0.01, metallic=0.76), (-0.16, y + 0.025, -0.295)), f"blank_brass_label_slot_{i}")
        add(s, place(cyl(0.025, 0.18, "drawers_brass_pull", regions, atlas, sections=24, axis="x", metallic=0.75), (0.20, y, -0.315)), f"brass_drawer_pull_{i}")
    for x in (-0.47, 0.47):
        add(s, place(bevel_box([0.075, 1.88, 0.11], "drawers_side_rail", regions, atlas, bevel=0.02, metallic=0.42), (x, 1.04, -0.15)), f"graphite_side_rail_{x}")
    add(s, place(bevel_box([0.88, 0.16, 0.52], "drawers_base_plinth", regions, atlas, bevel=0.035, metallic=0.38), (0, 0.08, 0)), "dark_grounded_base_plinth")
    for i, y in enumerate((0.44, 0.85, 1.26, 1.67)):
        add(s, place(sphere(0.026, "drawers_cyan_status_bead", regions, atlas, scale=(1, 0.5, 1), roughness=0.15), (0.42, y, -0.31)), f"cyan_drawer_status_bead_{i}")
    add(s, place(bevel_box([0.72, 1.74, 0.045], "drawers_black_gasket_frame", regions, atlas, bevel=0.022, roughness=0.84), (0, 1.04, -0.282)), "thin_black_front_gasket_frame")
    screws(s, regions, atlas, "drawers_brass_label_slot", [(-0.31, 1.90, -0.32), (0.31, 1.90, -0.32), (-0.31, 0.21, -0.32), (0.31, 0.21, -0.32)], radius=0.014)
    return s


def build_corner_privacy_screen(regions, atlas):
    s = trimesh.Scene()
    panel_positions = [(-0.70, 1.05, -0.12, math.radians(18)), (0.0, 1.05, -0.24, 0.0), (0.70, 1.05, -0.12, math.radians(-18))]
    for i, (x, y, z, rot) in enumerate(panel_positions):
        pad_region = ["screen_black_padded_panel", "screen_center_pad", "screen_angled_pad"][i]
        add(s, place(bevel_box([0.62, 1.82, 0.075], pad_region, regions, atlas, bevel=0.035, roughness=0.88), (x, y, z), (rot, (0, 1, 0))), f"black_padded_privacy_panel_{i}")
        add(s, place(bevel_box([0.70, 0.065, 0.105], "screen_white_frame_rail", regions, atlas, bevel=0.02), (x, y + 0.94, z - 0.012), (rot, (0, 1, 0))), f"top_white_ceramic_rail_{i}")
        add(s, place(bevel_box([0.70, 0.065, 0.105], "screen_white_frame_rail", regions, atlas, bevel=0.02), (x, y - 0.94, z - 0.012), (rot, (0, 1, 0))), f"bottom_white_ceramic_rail_{i}")
        for sx in (-0.35, 0.35):
            add(s, place(bevel_box([0.055, 1.88, 0.10], "screen_white_frame_rail", regions, atlas, bevel=0.018), (x + sx * math.cos(rot), y, z + sx * math.sin(rot) - 0.02), (rot, (0, 1, 0))), f"vertical_white_frame_{i}_{sx}")
        add(s, place(bevel_box([0.22, 0.075, 0.20], "screen_weighted_foot", regions, atlas, bevel=0.025, metallic=0.35), (x, 0.055, z + 0.08)), f"weighted_screen_foot_{i}")
    for x in (-0.36, 0.36):
        add(s, place(cyl(0.055, 1.92, "screen_graphite_hinge_spine", regions, atlas, sections=36, axis="y", metallic=0.42), (x, 1.05, -0.19)), f"graphite_hinge_spine_{x}")
        for y in (0.48, 1.05, 1.62):
            add(s, place(cyl(0.04, 0.20, "screen_brass_pin", regions, atlas, sections=32, axis="z", metallic=0.75), (x, y, -0.255)), f"brass_hinge_pin_{x}_{y}")
            add(s, place(sphere(0.025, "screen_black_pad_tile", regions, atlas, scale=(1, 0.5, 1), roughness=0.85), (x + 0.07, y, -0.29)), f"black_hinge_gasket_{x}_{y}")
    for x in (-0.96, 0.96):
        add(s, place(sphere(0.032, "screen_center_pad", regions, atlas, scale=(1, 0.5, 1), roughness=0.14), (x, 1.82, -0.23)), f"cyan_status_bead_on_outer_frame_{x}")
    return s


ASSETS = [
    ("room_l5_v3_curved_archive_shelf", build_curved_archive_shelf, {"label": "L5 V3 Curved Archive Shelf", "family": "bookshelf", "footprintFamily": "books", "mount": "floor", "solid": True, "canHoldSmallProps": True, "clueCapacity": 2}),
    ("room_l5_v3_hanging_cable_organizer", build_hanging_cable_organizer, {"label": "L5 V3 Hanging Cable Organizer", "family": "wall_panel_or_picture_frame", "footprintFamily": "wall_panel", "mount": "wall", "wallPreferred": "back", "solid": False, "canHoldSmallProps": False, "clueCapacity": 1}),
    ("room_l5_v3_surgical_light_stand", build_surgical_light_stand, {"label": "L5 V3 Surgical Light Stand", "family": "control_console", "footprintFamily": "lamp", "mount": "floor", "solid": True, "canHoldSmallProps": False, "clueCapacity": 0}),
    ("room_l5_v3_specimen_drawer_stack", build_specimen_drawer_stack, {"label": "L5 V3 Specimen Drawer Stack", "family": "drawer_chest", "footprintFamily": "cabinet", "mount": "floor", "solid": True, "canHoldSmallProps": True, "clueCapacity": 3}),
    ("room_l5_v3_corner_privacy_screen", build_corner_privacy_screen, {"label": "L5 V3 Corner Privacy Screen", "family": "sofa_bench", "footprintFamily": "barrier", "mount": "floor", "solid": True, "canHoldSmallProps": False, "clueCapacity": 1}),
]


def mesh_uv_stats(scene: trimesh.Scene) -> dict[str, int]:
    area_nodes = 0
    center_nodes = 0
    missing_uv_nodes = 0
    for geom in scene.geometry.values():
        uv = getattr(geom.visual, "uv", None)
        if uv is None or len(uv) == 0:
            missing_uv_nodes += 1
            continue
        uv = np.asarray(uv)
        span = np.ptp(uv, axis=0)
        if float(span[0]) > 0.002 and float(span[1]) > 0.002:
            area_nodes += 1
        else:
            center_nodes += 1
    return {"areaUvNodes": area_nodes, "centerSampleUvNodes": center_nodes, "missingUvNodes": missing_uv_nodes}


def read_glb_json(glb_path: Path) -> dict:
    data = glb_path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"not a binary glTF: {glb_path}")
    json_len = int.from_bytes(data[12:16], "little")
    json_type = data[16:20]
    if json_type != b"JSON":
        raise ValueError(f"first GLB chunk is not JSON: {glb_path}")
    return json.loads(data[20 : 20 + json_len].decode("utf-8"))


def write_contact_sheet(regions: dict[str, dict]) -> None:
    images = load_source_sheets()
    thumbs: list[tuple[str, Image.Image]] = []
    for source_id, image in images.items():
        thumb = image.convert("RGB")
        thumb.thumbnail((260, 260))
        panel = Image.new("RGB", (280, 315), "white")
        panel.paste(thumb, ((280 - thumb.width) // 2, 10))
        draw = ImageDraw.Draw(panel)
        draw.text((12, 280), source_id, fill=(0, 0, 0))
        draw.text((12, 296), SOURCE_SHEETS[source_id]["modelKey"][:34], fill=(0, 0, 0))
        thumbs.append((source_id, panel))
    for region_id, info in regions.items():
        cutout = Image.open(REPO / info["transparentCutout"]).convert("RGBA")
        matte, _ = matte_from_cutout(cutout)
        matte = matte.convert("RGB")
        matte.thumbnail((112, 112))
        panel = Image.new("RGB", (140, 150), "white")
        panel.paste(matte, ((140 - matte.width) // 2, 8))
        ImageDraw.Draw(panel).text((6, 126), region_id[:20], fill=(0, 0, 0))
        thumbs.append((region_id, panel))
    width = 280 * 5
    rows = 1 + math.ceil((len(thumbs) - 5) / 10)
    sheet = Image.new("RGB", (width, 315 + rows * 150), (238, 238, 238))
    for i, (_, panel) in enumerate(thumbs[:5]):
        sheet.paste(panel, (i * 280, 0))
    for i, (_, panel) in enumerate(thumbs[5:]):
        sheet.paste(panel, ((i % 10) * 140, 315 + (i // 10) * 150))
    sheet.save(CONTACT_SHEET)


def write_reports(audit_entries: list[dict], regions: dict[str, dict]) -> None:
    provenance = {
        "schema": "human-protocol/image2-source-provenance@1",
        "packId": PACK_ID,
        "sourceId": SOURCE_ID,
        "generatedAt": "2026-06-27",
        "generationTool": "built-in image_gen / Image2-style generated bitmap source sheet",
        "licenseLabel": "openai-generated-output-user-owned-subject-to-openai-terms",
        "sourceSheets": [
            {
                "modelKey": info["modelKey"],
                "copiedTo": str((SRC_DIR / info["file"]).relative_to(REPO)),
                "generatedCache": info["generatedCache"],
                "prompt": info["prompt"],
                "toolCallId": "not-exposed-by-built-in-image-gen",
            }
            for info in SOURCE_SHEETS.values()
        ],
        "atlas": str(ATLAS_PNG.relative_to(REPO)),
        "regions": str(ATLAS_REGIONS.relative_to(REPO)),
        "cutoutDirectory": str(CUTOUT_DIR.relative_to(REPO)),
        "contactSheet": str(CONTACT_SHEET.relative_to(REPO)),
        "assets": audit_entries,
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, indent=2) + "\n")
    PROVENANCE_MD.write_text(
        "\n".join(
            [
                "# Level 05 Reclamation Furniture Image2 v3 Batch 04 Provenance",
                "",
                f"- Pack: `{PACK_ID}`",
                f"- Date: `2026-06-27`",
                "- Tool: built-in `image_gen` / Image2-style generated bitmap sheets",
                "- License label: `openai-generated-output-user-owned-subject-to-openai-terms`",
                f"- Atlas: `{ATLAS_PNG.relative_to(REPO)}`",
                f"- Regions: `{ATLAS_REGIONS.relative_to(REPO)}`",
                f"- Contact sheet: `{CONTACT_SHEET.relative_to(REPO)}`",
                "",
                "## Source Sheets",
                *[
                    f"- `{info['modelKey']}`: `{(SRC_DIR / info['file']).relative_to(REPO)}` from `{info['generatedCache']}`"
                    for info in SOURCE_SHEETS.values()
                ],
                "",
                "## Region Count",
                f"- Semantic regions: `{len(regions)}`",
                f"- Transparent cutouts: `{len(list(CUTOUT_DIR.glob('*.png')))}`",
            ]
        )
        + "\n"
    )
    PROMPT_LEDGER.write_text(
        "\n".join(
            ["# Level 05 Reclamation Furniture Image2 v3 Batch 04 Prompt Ledger", ""]
            + [
                f"## {info['modelKey']}\n\n{info['prompt']}\n\nGenerated cache: `{info['generatedCache']}`\n"
                for info in SOURCE_SHEETS.values()
            ]
        )
        + "\n"
    )
    AUDIT_JSON.write_text(
        json.dumps(
            {
                "schema": "human-protocol/environment-asset-factory/glb-texture-audit@1",
                "packId": PACK_ID,
                "sourceId": SOURCE_ID,
                "atlas": str(ATLAS_PNG.relative_to(REPO)),
                "assets": audit_entries,
                "totals": {
                    "assetCount": len(audit_entries),
                    "materialsWithBaseColorTexture": sum(item["materialsWithBaseColorTexture"] for item in audit_entries),
                    "areaUvNodes": sum(item["areaUvNodes"] for item in audit_entries),
                    "centerSampleUvNodes": sum(item["centerSampleUvNodes"] for item in audit_entries),
                    "missingUvNodes": sum(item["missingUvNodes"] for item in audit_entries),
                },
            },
            indent=2,
        )
        + "\n"
    )


def main() -> None:
    atlas, regions = build_atlas()
    set_pbr_maps(atlas)
    write_contact_sheet(regions)
    manifest_assets = []
    audit_entries = []
    for model_key, builder, meta in ASSETS:
        scene = builder(regions, atlas)
        uv_stats = mesh_uv_stats(scene)
        size = finalize(scene)
        glb_path = GLB_DIR / f"{model_key}.glb"
        glb_path.write_bytes(trimesh.exchange.gltf.export_glb(scene, include_normals=True))
        gltf = read_glb_json(glb_path)
        materials_with_texture = sum(1 for mat in gltf.get("materials", []) if mat.get("pbrMetallicRoughness", {}).get("baseColorTexture"))
        node_names = [node.get("name") for node in gltf.get("nodes", []) if node.get("mesh") is not None]
        audit_entry = {
            "modelKey": model_key,
            "glb": str(glb_path.relative_to(REPO)),
            "materialsWithBaseColorTexture": materials_with_texture,
            "areaUvNodes": uv_stats["areaUvNodes"],
            "centerSampleUvNodes": uv_stats["centerSampleUvNodes"],
            "missingUvNodes": uv_stats["missingUvNodes"],
            "namedMeshNodes": len([name for name in node_names if name]),
            "sizeMeters": size,
        }
        audit_entries.append(audit_entry)
        asset = {
            "modelKey": model_key,
            "label": meta["label"],
            "assetKind": "furniture",
            "family": meta["family"],
            "group": GROUP,
            "source": SOURCE_ID,
            "sourceAssetId": f"{model_key}_v1",
            "themeId": THEME_ID,
            "glbFile": f"../../models-cooked/environment/level05-reclamation-furniture-image2-v3-batch04/{model_key}.glb",
            "sizeMeters": size,
            "solid": meta["solid"],
            "mount": meta["mount"],
            "canHoldSmallProps": meta["canHoldSmallProps"],
            "clueCapacity": meta["clueCapacity"],
            "footprintFamily": meta["footprintFamily"],
            "tags": [
                "level:05",
                "theme:reclamation-core",
                "style:image2-v3-batch04",
                "source:independent-image2-sheet",
                "texture:transparent-cutout",
                "uv:area-mapped",
                f"family:{meta['family']}",
            ],
        }
        if "wallPreferred" in meta:
            asset["wallPreferred"] = meta["wallPreferred"]
        if meta["canHoldSmallProps"]:
            asset["supportSurfaces"] = [
                {
                    "id": f"{model_key.replace('room_l5_v3_', '')}_top",
                    "kind": "shelf" if "shelf" in model_key else "smallPropTop",
                    "localCenter": [0, round(size[1] * 0.82, 3), 0],
                    "size": [round(size[0] * 0.62, 3), round(size[2] * 0.52, 3)],
                    "maxChildHeight": 0.45,
                }
            ]
        manifest_assets.append(asset)
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP Level 05 Reclamation Core Furniture v3 Batch 04 (Storage Wall Light Dressing)",
        "sourceTool": Path(__file__).name,
        "generatedAt": "2026-06-27",
        "revision": "batch04-light-stand-no-gap-joint-polish-v2",
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
            "size": [ATLAS_SIZE, ATLAS_SIZE],
        },
        "assets": manifest_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    write_reports(audit_entries, regions)
    (TMP_DIR / "glb-texture-audit.json").write_text(AUDIT_JSON.read_text())
    print(f"wrote {MANIFEST.relative_to(REPO)}")
    print(f"wrote {ATLAS_PNG.relative_to(REPO)}")
    print(f"wrote {CONTACT_SHEET.relative_to(REPO)}")
    print(f"wrote {AUDIT_JSON.relative_to(REPO)}")
    for item in audit_entries:
        print(
            f"{item['modelKey']}: materialsWithBaseColorTexture={item['materialsWithBaseColorTexture']} "
            f"areaUvNodes={item['areaUvNodes']} centerSampleUvNodes={item['centerSampleUvNodes']}"
        )


if __name__ == "__main__":
    main()
