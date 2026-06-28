#!/usr/bin/env python3
"""Generate Level 05 v4 procedural surfaces and dressing props.

The output is intentionally deterministic and self-authored:
- no downloaded meshes
- no generated-image references
- no logos or watermarks

It creates:
- three tileable builder-surface PBR map sets under builder-surfaces
- eight compact GLB dressing props under models-cooked/environment
- a hp.builder.assetPack.v1 manifest
- provenance/design reports
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFilter
from trimesh.visual import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[2]
SURFACE_DIR = ROOT / "src/assets/textures/environment/builder-surfaces"
MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level05-reclamation-dressing-v4"
MANIFEST_PATH = ROOT / "src/assets/manifests/builder/hp_level05_reclamation_dressing_v4.json"
REPORT_JSON_PATH = ROOT / "src/assets/manifests/reports/level05_reclamation_dressing_v4_procedural_report.json"
REPORT_MD_PATH = ROOT / "src/assets/manifests/reports/level05_reclamation_dressing_v4_procedural_report.md"

GENERATED_AT = "2026-06-28"
SURFACE_SIZE = 1024


def ensure_dirs() -> None:
    SURFACE_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def rgb01(value: str) -> list[float]:
    return [channel / 255 for channel in hex_rgb(value)] + [1.0]


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", quality=94, method=6)


def height_to_normal(height: np.ndarray, strength: float = 5.5) -> Image.Image:
    h = height.astype(np.float32) / 255.0
    gy, gx = np.gradient(h)
    nx = -gx * strength
    ny = -gy * strength
    nz = np.ones_like(h)
    length = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.stack(((nx / length) * 0.5 + 0.5, (ny / length) * 0.5 + 0.5, (nz / length) * 0.5 + 0.5), axis=-1)
    return Image.fromarray(np.clip(normal * 255, 0, 255).astype(np.uint8))


def deterministic_noise(size: int, seed: int) -> np.ndarray:
    y, x = np.mgrid[0:size, 0:size]
    values = (
        np.sin((x + seed * 17) * 0.071)
        + np.sin((y + seed * 23) * 0.049)
        + np.sin((x + y + seed * 11) * 0.023)
        + np.sin((x * 0.35 - y * 0.19 + seed) * 0.017)
    )
    values = (values - values.min()) / max(1e-6, values.max() - values.min())
    return values


def draw_panel_surface(kind: str, prefix: str, base: str, panel: str, accent: str, trim: str, seed: int) -> dict[str, str]:
    size = SURFACE_SIZE
    noise = deterministic_noise(size, seed)
    base_rgb = np.array(hex_rgb(base), dtype=np.float32)
    panel_rgb = np.array(hex_rgb(panel), dtype=np.float32)
    color = np.zeros((size, size, 3), dtype=np.float32)
    color[:] = base_rgb
    color = color * (0.92 + noise[..., None] * 0.14)
    image = Image.fromarray(np.clip(color, 0, 255).astype(np.uint8))
    draw = ImageDraw.Draw(image, "RGBA")
    height = np.full((size, size), 128, dtype=np.uint8)

    if kind == "floor":
        cell = size // 4
        inset = 22
        for yy in range(0, size, cell):
            for xx in range(0, size, cell):
                draw.rounded_rectangle(
                    [xx + inset, yy + inset, xx + cell - inset, yy + cell - inset],
                    radius=18,
                    fill=tuple(panel_rgb.astype(int)) + (210,),
                    outline=hex_rgb(trim) + (170,),
                    width=4,
                )
                height[yy + inset : yy + cell - inset, xx + inset : xx + cell - inset] = 148
                height[yy + inset : yy + inset + 4, xx + inset : xx + cell - inset] = 92
                height[yy + cell - inset - 4 : yy + cell - inset, xx + inset : xx + cell - inset] = 92
                height[yy + inset : yy + cell - inset, xx + inset : xx + inset + 4] = 92
                height[yy + inset : yy + cell - inset, xx + cell - inset - 4 : xx + cell - inset] = 92
        for offset in (cell // 2, cell * 2 + cell // 2):
            draw.line([(offset, 32), (offset, size - 32)], fill=hex_rgb(accent) + (165,), width=6)
            draw.line([(32, offset), (size - 32, offset)], fill=hex_rgb(accent) + (115,), width=4)
            height[:, max(0, offset - 2) : min(size, offset + 3)] = 180
            height[max(0, offset - 2) : min(size, offset + 3), :] = 175
    elif kind == "wall":
        columns = [0, 126, 318, 512, 704, 898, size]
        for i in range(len(columns) - 1):
            x0, x1 = columns[i], columns[i + 1]
            pad = 16
            tone = int(185 - (i % 3) * 18)
            fill = tuple(np.clip(panel_rgb * (tone / 180), 0, 255).astype(int)) + (220,)
            draw.rounded_rectangle([x0 + pad, 44, x1 - pad, size - 44], radius=20, fill=fill, outline=hex_rgb(trim) + (180,), width=5)
            height[44 : size - 44, x0 + pad : x1 - pad] = 144
            height[44 : size - 44, max(0, x0 + pad - 3) : min(size, x0 + pad + 3)] = 86
        for y in (168, 512, 856):
            draw.line([(32, y), (size - 32, y)], fill=hex_rgb(accent) + (145,), width=5)
            height[max(0, y - 2) : min(size, y + 3), :] = 178
        for x in (256, 768):
            draw.rounded_rectangle([x - 42, 410, x + 42, 614], radius=16, fill=hex_rgb("#111820") + (230,), outline=hex_rgb(accent) + (150,), width=3)
            height[410:614, x - 42 : x + 42] = 156
    else:
        cell = size // 5
        for yy in range(0, size, cell):
            draw.rectangle([0, yy, size, yy + 8], fill=hex_rgb(trim) + (210,))
            height[yy : min(size, yy + 8), :] = 180
        for xx in range(0, size, cell):
            draw.rectangle([xx, 0, xx + 10, size], fill=hex_rgb(trim) + (210,))
            height[:, xx : min(size, xx + 10)] = 178
        for yy in range(cell // 2, size, cell):
            draw.rounded_rectangle([96, yy - 20, size - 96, yy + 20], radius=18, fill=hex_rgb(accent) + (120,), outline=hex_rgb("#1b3035") + (160,), width=2)
            height[yy - 20 : yy + 20, 96 : size - 96] = 165

    vignette = Image.new("L", (size, size), 0)
    vdraw = ImageDraw.Draw(vignette)
    vdraw.rectangle([0, 0, size, size], fill=0)
    vignette = vignette.filter(ImageFilter.GaussianBlur(size // 9))
    image = Image.blend(image, Image.new("RGB", (size, size), base), 0.08)

    rough = Image.fromarray(np.clip(178 + noise * 40, 0, 255).astype(np.uint8))
    if kind == "ceiling":
        rough = Image.fromarray(np.clip(200 + noise * 28, 0, 255).astype(np.uint8))
    normal = height_to_normal(height)

    color_path = SURFACE_DIR / f"{prefix}_color.webp"
    normal_path = SURFACE_DIR / f"{prefix}_normal.webp"
    rough_path = SURFACE_DIR / f"{prefix}_rough.webp"
    save_webp(image, color_path)
    save_webp(normal, normal_path)
    save_webp(rough.convert("RGB"), rough_path)
    return {
        "color": str(color_path.relative_to(ROOT)),
        "normal": str(normal_path.relative_to(ROOT)),
        "rough": str(rough_path.relative_to(ROOT)),
    }


def generate_surfaces() -> dict[str, dict[str, str]]:
    return {
        "floor_level05_reclamation_cc0_metal_panel_v4": draw_panel_surface(
            "floor",
            "cc0_floor_level05_reclamation_metal_panel_v4",
            "#070a0d",
            "#172026",
            "#66e5ef",
            "#c18d48",
            51,
        ),
        "wall_level05_reclamation_cc0_graphite_panel_v4": draw_panel_surface(
            "wall",
            "cc0_wall_level05_reclamation_graphite_panel_v4",
            "#080b0e",
            "#161d23",
            "#70e7ef",
            "#6b5231",
            73,
        ),
        "ceiling_level05_reclamation_cc0_service_grid_v4": draw_panel_surface(
            "ceiling",
            "cc0_ceiling_level05_reclamation_service_grid_v4",
            "#05070a",
            "#12191e",
            "#7feeff",
            "#27363d",
            91,
        ),
    }


def pbr(name: str, color: str, metallic: float, roughness: float) -> PBRMaterial:
    return PBRMaterial(name=name, baseColorFactor=rgb01(color), metallicFactor=metallic, roughnessFactor=roughness)


MAT = {
    "graphite": pbr("mat_graphite_oiled_black", "#080b0d", 0.76, 0.32),
    "graphite_soft": pbr("mat_soft_graphite_rubber", "#11161a", 0.18, 0.74),
    "ceramic": pbr("mat_warm_white_ceramic", "#d7dfdc", 0.02, 0.36),
    "brass": pbr("mat_aged_brass_trim", "#b98742", 0.88, 0.34),
    "cyan": pbr("mat_cyan_glass_lens", "#36dce5", 0.05, 0.18),
    "glass": pbr("mat_frosted_cyan_glass", "#a9dfe3", 0.0, 0.22),
    "red": pbr("mat_warning_red_lens", "#e45b4f", 0.02, 0.2),
    "amber": pbr("mat_archive_amber_lens", "#f1b958", 0.03, 0.24),
    "rubber": pbr("mat_black_gasket_rubber", "#050607", 0.0, 0.86),
}


def bevel_box(extents: tuple[float, float, float], material: PBRMaterial, bevel: float = 0.025) -> trimesh.Trimesh:
    hx, hy, hz = (axis / 2.0 for axis in extents)
    b = min(bevel, hx * 0.48, hy * 0.48, hz * 0.48)
    points = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                points.append((sx * (hx - b), sy * hy, sz * hz))
                points.append((sx * hx, sy * (hy - b), sz * hz))
                points.append((sx * hx, sy * hy, sz * (hz - b)))
    mesh = trimesh.Trimesh(vertices=np.array(points)).convex_hull
    mesh.visual = TextureVisuals(material=material)
    return mesh


def cyl(radius: float, height: float, material: PBRMaterial, axis: str = "y", sections: int = 40) -> trimesh.Trimesh:
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    if axis == "y":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (1, 0, 0)))
    elif axis == "x":
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.radians(90), (0, 1, 0)))
    elif axis == "z":
        pass
    else:
        raise ValueError(axis)
    mesh.visual = TextureVisuals(material=material)
    return mesh


def sphere(radius: float, material: PBRMaterial, scale: tuple[float, float, float] = (1, 1, 1), subdivisions: int = 2) -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(radius=radius, subdivisions=subdivisions)
    mesh.apply_scale(scale)
    mesh.visual = TextureVisuals(material=material)
    return mesh


def place(mesh: trimesh.Trimesh, xyz: tuple[float, float, float], rotate: tuple[float, tuple[float, float, float]] | None = None) -> trimesh.Trimesh:
    if rotate:
        angle, axis = rotate
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    mesh.apply_translation(xyz)
    return mesh


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, name: str) -> None:
    scene.add_geometry(mesh, geom_name=name, node_name=name)


def add_box(scene: trimesh.Scene, name: str, extents: tuple[float, float, float], center: tuple[float, float, float], material: PBRMaterial, bevel: float = 0.025) -> None:
    add(scene, place(bevel_box(extents, material, bevel), center), name)


def add_cyl(scene: trimesh.Scene, name: str, radius: float, height: float, center: tuple[float, float, float], material: PBRMaterial, axis: str = "y", sections: int = 40, rotate: tuple[float, tuple[float, float, float]] | None = None) -> None:
    add(scene, place(cyl(radius, height, material, axis=axis, sections=sections), center, rotate), name)


def finalize(scene: trimesh.Scene) -> list[float]:
    bounds = scene.bounds
    cx = (bounds[0][0] + bounds[1][0]) / 2
    cz = (bounds[0][2] + bounds[1][2]) / 2
    min_y = bounds[0][1]
    delta = np.array([-cx, -min_y, -cz], dtype=np.float64)
    for geom in scene.geometry.values():
        geom.vertices += delta
    size = scene.bounds[1] - scene.bounds[0]
    return [round(float(v), 3) for v in size]


def build_ceiling_service_lamp() -> trimesh.Scene:
    s = trimesh.Scene()
    add_box(s, "black_ceiling_spine", (1.62, 0.12, 0.18), (0, 0.06, 0), MAT["graphite"], 0.035)
    add_box(s, "frosted_light_bar", (1.38, 0.085, 0.28), (0, 0.16, 0), MAT["glass"], 0.04)
    add_box(s, "lower_cyan_glow_strip", (1.28, 0.035, 0.05), (0, 0.22, -0.16), MAT["cyan"], 0.015)
    for x in (-0.82, 0.82):
        add_box(s, f"brass_end_cap_{x}", (0.12, 0.2, 0.36), (x, 0.11, 0), MAT["brass"], 0.035)
        add_cyl(s, f"black_socket_{x}", 0.055, 0.26, (x, 0.04, 0), MAT["rubber"], axis="z", sections=28)
    return s


def build_wall_pipe_manifold() -> trimesh.Scene:
    s = trimesh.Scene()
    add_box(s, "recessed_back_panel", (1.62, 1.08, 0.12), (0, 0.62, 0), MAT["graphite_soft"], 0.045)
    for x in (-0.54, 0, 0.54):
        add_cyl(s, f"vertical_brass_pipe_{x}", 0.035, 1.0, (x, 0.62, -0.09), MAT["brass"], axis="y", sections=28)
    for y in (0.28, 0.62, 0.96):
        add_cyl(s, f"horizontal_graphite_bus_{y}", 0.032, 1.34, (0, y, -0.13), MAT["graphite"], axis="x", sections=28)
    for i, (x, y, mat) in enumerate(((-0.54, 0.28, "cyan"), (0.0, 0.62, "amber"), (0.54, 0.96, "red"), (-0.54, 0.96, "glass"), (0.54, 0.28, "cyan"))):
        add_cyl(s, f"lit_valve_lens_{i}", 0.105, 0.055, (x, y, -0.18), MAT[mat], axis="z", sections=44)
        add_cyl(s, f"black_valve_collar_{i}", 0.14, 0.04, (x, y, -0.15), MAT["rubber"], axis="z", sections=44)
    add_box(s, "bottom_label_plate", (1.24, 0.09, 0.045), (0, 0.13, -0.18), MAT["ceramic"], 0.018)
    return s


def build_floor_cable_bridge() -> trimesh.Scene:
    s = trimesh.Scene()
    add_box(s, "low_graphite_cable_bridge_body", (1.84, 0.16, 0.48), (0, 0.08, 0), MAT["graphite"], 0.06)
    add_box(s, "inset_cyan_service_line", (1.56, 0.025, 0.045), (0, 0.17, -0.18), MAT["cyan"], 0.012)
    add_box(s, "left_brass_wear_edge", (1.74, 0.035, 0.035), (0, 0.18, 0.24), MAT["brass"], 0.01)
    add_box(s, "right_brass_wear_edge", (1.74, 0.035, 0.035), (0, 0.18, -0.24), MAT["brass"], 0.01)
    for x in (-0.74, -0.25, 0.25, 0.74):
        add_cyl(s, f"flush_socket_{x}", 0.045, 0.03, (x, 0.19, 0.0), MAT["rubber"], axis="y", sections=24)
    return s


def build_sample_canister_rack() -> trimesh.Scene:
    s = trimesh.Scene()
    add_box(s, "black_rear_frame", (1.16, 1.72, 0.12), (0, 0.88, 0.16), MAT["graphite"], 0.05)
    for x in (-0.55, 0.55):
        add_box(s, f"side_ceramic_upright_{x}", (0.11, 1.68, 0.22), (x, 0.88, 0.02), MAT["ceramic"], 0.035)
    for y in (0.32, 0.88, 1.44):
        add_box(s, f"brass_shelf_rail_{y}", (1.18, 0.055, 0.32), (0, y, -0.02), MAT["brass"], 0.018)
    for row_y in (0.58, 1.15):
        for x in (-0.34, 0.0, 0.34):
            add_cyl(s, f"cyan_sample_tube_{row_y}_{x}", 0.075, 0.42, (x, row_y, -0.12), MAT["glass"], axis="y", sections=36)
            add_cyl(s, f"black_tube_cap_{row_y}_{x}_top", 0.08, 0.04, (x, row_y + 0.23, -0.12), MAT["rubber"], axis="y", sections=28)
            add_cyl(s, f"black_tube_cap_{row_y}_{x}_bottom", 0.08, 0.04, (x, row_y - 0.23, -0.12), MAT["rubber"], axis="y", sections=28)
    add_box(s, "front_cyan_status_nameplate", (0.78, 0.095, 0.045), (0, 0.18, -0.22), MAT["cyan"], 0.02)
    return s


def build_clamp_relay_column() -> trimesh.Scene:
    s = trimesh.Scene()
    add_cyl(s, "graphite_round_base", 0.32, 0.18, (0, 0.09, 0), MAT["graphite"], axis="y", sections=56)
    add_cyl(s, "white_relay_spine", 0.16, 1.58, (0, 0.9, 0), MAT["ceramic"], axis="y", sections=48)
    for y in (0.42, 0.78, 1.14, 1.5):
        add_cyl(s, f"brass_relay_collar_{y}", 0.19, 0.06, (0, y, 0), MAT["brass"], axis="y", sections=48)
        add_box(s, f"black_relay_pad_{y}", (0.34, 0.08, 0.11), (0, y, -0.18), MAT["rubber"], 0.025)
    for angle in (-0.55, 0.55):
        x = math.sin(angle) * 0.38
        z = -math.cos(angle) * 0.38
        add_cyl(s, f"angled_clamp_arm_{angle}", 0.035, 0.68, (x * 0.55, 1.28, z * 0.55), MAT["graphite"], axis="x", sections=24, rotate=(angle, (0, 1, 0)))
        add_box(s, f"ceramic_clamp_pad_{angle}", (0.16, 0.22, 0.07), (x, 1.28, z), MAT["ceramic"], 0.025)
    add_cyl(s, "top_cyan_relay_lens", 0.12, 0.06, (0, 1.76, -0.02), MAT["cyan"], axis="y", sections=44)
    return s


def build_warning_beacon_pylon() -> trimesh.Scene:
    s = trimesh.Scene()
    add_cyl(s, "black_weighted_base", 0.28, 0.12, (0, 0.06, 0), MAT["graphite"], axis="y", sections=48)
    add_cyl(s, "brass_lower_collar", 0.19, 0.06, (0, 0.16, 0), MAT["brass"], axis="y", sections=44)
    add_cyl(s, "dark_signal_mast", 0.07, 0.78, (0, 0.58, 0), MAT["graphite"], axis="y", sections=32)
    add_cyl(s, "red_warning_lens", 0.18, 0.18, (0, 1.02, 0), MAT["red"], axis="y", sections=56)
    add_cyl(s, "black_lens_cage_ring_bottom", 0.205, 0.04, (0, 0.91, 0), MAT["rubber"], axis="y", sections=56)
    add_cyl(s, "black_lens_cage_ring_top", 0.205, 0.04, (0, 1.13, 0), MAT["rubber"], axis="y", sections=56)
    for x in (-0.16, 0.16):
        add_box(s, f"vertical_lens_guard_{x}", (0.035, 0.28, 0.035), (x, 1.02, 0), MAT["rubber"], 0.01)
    return s


def build_ceiling_cable_tray() -> trimesh.Scene:
    s = trimesh.Scene()
    add_box(s, "perforated_tray_backbone", (2.16, 0.12, 0.34), (0, 0.08, 0), MAT["graphite"], 0.035)
    for x in (-0.88, -0.44, 0.0, 0.44, 0.88):
        add_cyl(s, f"parallel_service_cable_{x}", 0.035, 0.42, (x, 0.17, 0), MAT["rubber"], axis="z", sections=24)
        add_box(s, f"brass_cable_clamp_{x}", (0.09, 0.055, 0.4), (x, 0.21, 0), MAT["brass"], 0.012)
    add_box(s, "cyan_locator_strip", (1.72, 0.035, 0.045), (0, 0.23, -0.2), MAT["cyan"], 0.012)
    for x in (-1.04, 1.04):
        add_box(s, f"ceiling_mount_tab_{x}", (0.16, 0.18, 0.42), (x, 0.04, 0), MAT["ceramic"], 0.025)
    return s


def build_maintenance_crate_stack() -> trimesh.Scene:
    s = trimesh.Scene()
    crates = [
        ((0.0, 0.22, 0.0), (1.04, 0.44, 0.72), "graphite"),
        ((-0.2, 0.63, -0.07), (0.66, 0.38, 0.55), "ceramic"),
        ((0.32, 0.61, 0.12), (0.48, 0.34, 0.44), "graphite_soft"),
    ]
    for i, (center, extents, mat) in enumerate(crates):
        add_box(s, f"stacked_crate_body_{i}", extents, center, MAT[mat], 0.045)
        cx, cy, cz = center
        sx, sy, sz = extents
        add_box(s, f"crate_brass_front_latch_{i}", (sx * 0.34, 0.04, 0.04), (cx, cy + sy * 0.18, cz - sz * 0.53), MAT["brass"], 0.012)
        add_box(s, f"crate_cyan_status_slot_{i}", (sx * 0.22, 0.035, 0.035), (cx - sx * 0.24, cy, cz - sz * 0.54), MAT["cyan"], 0.012)
    return s


BUILDERS = {
    "room_l5_v4_ceiling_service_lamp": build_ceiling_service_lamp,
    "room_l5_v4_wall_pipe_manifold": build_wall_pipe_manifold,
    "room_l5_v4_floor_cable_bridge": build_floor_cable_bridge,
    "room_l5_v4_sample_canister_rack": build_sample_canister_rack,
    "room_l5_v4_clamp_relay_column": build_clamp_relay_column,
    "room_l5_v4_warning_beacon_pylon": build_warning_beacon_pylon,
    "room_l5_v4_ceiling_cable_tray": build_ceiling_cable_tray,
    "room_l5_v4_maintenance_crate_stack": build_maintenance_crate_stack,
}

ASSET_META = {
    "room_l5_v4_ceiling_service_lamp": ("L5 V4 顶部服务灯", "control_console", "lamp", "ceiling", False),
    "room_l5_v4_wall_pipe_manifold": ("L5 V4 壁挂管汇", "wall_panel_or_picture_frame", "wall_panel", "wall", False),
    "room_l5_v4_floor_cable_bridge": ("L5 V4 地面电缆桥", "storage_crate", "barrier", "floor", False),
    "room_l5_v4_sample_canister_rack": ("L5 V4 样本罐架", "display_case", "display_case", "floor", True),
    "room_l5_v4_clamp_relay_column": ("L5 V4 夹钳继电柱", "control_console", "column", "floor", True),
    "room_l5_v4_warning_beacon_pylon": ("L5 V4 警示信标柱", "control_console", "pedestal", "floor", False),
    "room_l5_v4_ceiling_cable_tray": ("L5 V4 顶部线缆槽", "wall_panel_or_picture_frame", "barrier", "ceiling", False),
    "room_l5_v4_maintenance_crate_stack": ("L5 V4 维护箱堆", "storage_crate", "crate", "floor", True),
}


def export_props() -> list[dict]:
    assets: list[dict] = []
    for model_key, builder in BUILDERS.items():
        scene = builder()
        size = finalize(scene)
        out = MODEL_DIR / f"{model_key}.glb"
        data = trimesh.exchange.gltf.export_glb(scene, include_normals=True)
        out.write_bytes(data)
        reloaded = trimesh.load(trimesh.util.wrap_as_stream(data), file_type="glb")
        label, family, footprint, mount, solid = ASSET_META[model_key]
        entry = {
            "modelKey": model_key,
            "label": label,
            "assetKind": "furniture",
            "family": family,
            "group": "核心",
            "source": "level05-reclamation-dressing-v4-procedural",
            "sourceAssetId": f"{model_key}_v1",
            "themeId": "hp_reclamation_core_v4",
            "glbFile": f"../../models-cooked/environment/level05-reclamation-dressing-v4/{model_key}.glb",
            "sizeMeters": size,
            "solid": solid,
            "mount": mount,
            "canHoldSmallProps": model_key == "room_l5_v4_maintenance_crate_stack",
            "clueCapacity": 1 if model_key in {"room_l5_v4_wall_pipe_manifold", "room_l5_v4_sample_canister_rack"} else 0,
            "footprintFamily": footprint,
            "tags": [
                "level:05",
                "theme:reclamation-core",
                "style:v4-procedural",
                "source:deterministic-math-script",
                "license:project-owned-clean",
                f"mount:{mount}",
            ],
        }
        if mount == "wall":
            entry["wallPreferred"] = "back"
        if model_key == "room_l5_v4_maintenance_crate_stack":
            entry["supportSurfaces"] = [
                {
                    "id": "crate_stack_top_v4",
                    "kind": "smallPropTop",
                    "localCenter": [0, round(size[1], 3), 0],
                    "size": [0.78, 0.48],
                    "maxChildHeight": 0.35,
                }
            ]
        assets.append(entry)
        if not hasattr(reloaded, "geometry") and not getattr(reloaded, "geometry", None):
            raise RuntimeError(f"{model_key} did not reload as a GLB scene")
    return assets


def write_manifest(assets: list[dict]) -> None:
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_level05_reclamation_dressing_v4",
        "label": "HP Level 05 Reclamation Core Dressing v4 (Procedural Clean License)",
        "sourceTool": "generate-level05-reclamation-dressing-v4-assets.py",
        "generatedAt": GENERATED_AT,
        "revision": "v4-procedural-surface-and-dressing-pass-1",
        "provenance": {
            "license": "project-owned-clean",
            "source": "deterministic procedural script; no external mesh, image, logo, or watermark inputs",
            "redistribution": "safe for project use and can be relicensed by project owner",
        },
        "assets": assets,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def write_reports(surfaces: dict[str, dict[str, str]], assets: list[dict]) -> None:
    report = {
        "schema": "hp.level05.reclamation.dressingV4.proceduralReport.v1",
        "generatedAt": GENERATED_AT,
        "sourceTool": "scripts/asset-build/generate-level05-reclamation-dressing-v4-assets.py",
        "licensePolicy": {
            "classification": "project-owned-clean",
            "notes": [
                "All geometry is deterministic math geometry authored in this script.",
                "All surface maps are deterministic PIL/numpy procedural bitmaps.",
                "No third-party mesh, no external texture, no brand/logo/watermark input.",
            ],
        },
        "surfacePresetIds": list(surfaces.keys()),
        "surfaces": surfaces,
        "assetCount": len(assets),
        "assets": assets,
        "visualDirection": [
            "Graphite/ceramic/brass/cyan hierarchy to match the existing Level 5 recovery-core mood.",
            "Small dressing objects are mostly edge/wall/ceiling pieces so they enrich the view without blocking combat lanes.",
            "Solid objects are reserved for readable racks/columns/crates placed against walls.",
        ],
    }
    REPORT_JSON_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf8")

    rows = [
        "# Level 05 Reclamation Dressing v4 Procedural Report",
        "",
        f"- Generated: `{GENERATED_AT}`",
        "- License class: `project-owned-clean`",
        "- External mesh inputs: `0`",
        "- External texture/image inputs: `0`",
        "- Watermark/logo inputs: `0`",
        f"- Builder pack: `{MANIFEST_PATH.relative_to(ROOT)}`",
        "",
        "## Surface Presets",
    ]
    for preset_id, maps in surfaces.items():
        rows.append(f"- `{preset_id}` -> `{maps['color']}`, `{maps['normal']}`, `{maps['rough']}`")
    rows.extend(["", "## Furniture Assets"])
    for asset in assets:
        rows.append(f"- `{asset['modelKey']}` ({asset['label']}): size `{asset['sizeMeters']}`, mount `{asset['mount']}`, solid `{asset['solid']}`")
    rows.extend(
        [
            "",
            "## Placement Intent",
            "",
            "Use ceiling/wall/cable dressing to raise production value without shrinking combat lanes. Keep the solid rack/column/crate pieces against room edges.",
        ]
    )
    REPORT_MD_PATH.write_text("\n".join(rows) + "\n", encoding="utf8")


def main() -> None:
    ensure_dirs()
    surfaces = generate_surfaces()
    assets = export_props()
    write_manifest(assets)
    write_reports(surfaces, assets)
    print(f"generated {len(surfaces)} surface preset texture sets")
    print(f"generated {len(assets)} GLB dressing props")
    print(f"wrote {MANIFEST_PATH.relative_to(ROOT)}")
    print(f"wrote {REPORT_JSON_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
