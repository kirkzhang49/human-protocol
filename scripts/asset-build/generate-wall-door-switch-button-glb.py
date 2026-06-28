#!/usr/bin/env python3
"""Generate the generic wall-mounted door switch lever.

Project-owned deterministic geometry and Image2-style baked texture sources.
The modelKey intentionally stays hp_wall_door_switch_button_v1 so existing
builder/runtime configs keep working while the visual asset becomes a proper
wall lever.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/asset-build/generate-wall-door-switch-button-glb.py

Outputs:
  - src/assets/models-cooked/environment/builder-puzzle-machines/hp_wall_door_switch_button_v1.glb
  - src/assets/source_blend/builder-puzzle-machines/hp_wall_door_switch_button_v1.blend
  - src/assets/specs/builder-puzzle-machines/hp_wall_door_switch_button_v1.asset-spec.json
  - src/assets/textures/environment/builder-puzzle-machines/image2-sources/wall_switch_*.png
  - src/assets/textures/environment/builder-puzzle-machines/hp_wall_door_switch_lever_image2_atlas_v1.png
  - src/assets/manifests/reports/wall_door_switch_button_v1_blender_report.json
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from random import Random

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_KEY = "hp_wall_door_switch_button_v1"
OUT_GLB = ROOT / "src/assets/models-cooked/environment/builder-puzzle-machines" / f"{MODEL_KEY}.glb"
OUT_BLEND = ROOT / "src/assets/source_blend/builder-puzzle-machines" / f"{MODEL_KEY}.blend"
OUT_SPEC = ROOT / "src/assets/specs/builder-puzzle-machines" / f"{MODEL_KEY}.asset-spec.json"
OUT_REPORT = ROOT / "src/assets/manifests/reports/wall_door_switch_button_v1_blender_report.json"
OUT_TEXTURE_DIR = ROOT / "src/assets/textures/environment/builder-puzzle-machines"
OUT_SOURCE_DIR = OUT_TEXTURE_DIR / "image2-sources"
OUT_ATLAS = OUT_TEXTURE_DIR / "hp_wall_door_switch_lever_image2_atlas_v1.png"
OUT_ATLAS_REGIONS = OUT_TEXTURE_DIR / "hp_wall_door_switch_lever_image2_atlas_v1.regions.json"
OUT_CONTACT_SHEET = ROOT / "src/assets/manifests/reports/wall_door_switch_lever_image2_contact_sheet.png"

REFERENCE_IMAGE_PATH = (
    "/Users/zhengkaizhang/Library/Containers/com.tencent.xinWeChat/Data/Documents/"
    "xwechat_files/wxid_tohlw3b0n15h12_00ac/temp/RWTemp/2026-06/"
    "6023ed73a57207488d03c9e96bbdca95/ed5265907dad5612f86767826635f90b.png"
)

DESIGN_PROMPT = (
    "Generic Human Protocol wall-mounted mechanical door lever, premium sci-fi "
    "hospital / robot facility hardware, rounded warm white ceramic wall plate, "
    "smoked gunmetal titanium slide track, short upper-half dark metal pull handle, "
    "small precision bearing collar instead of an oversized ring, visible up/down "
    "motion notches with cyan and amber state light slots, clean Image2-baked "
    "material detail, readable first-person and mobile silhouette, no readable text, "
    "no logos, no gore. "
    "User reference image is used only as high-level aesthetic direction; final "
    "geometry and texture pixels are original deterministic project output."
)


def ensure_dirs() -> None:
    for path in [OUT_GLB.parent, OUT_BLEND.parent, OUT_SPEC.parent, OUT_REPORT.parent, OUT_SOURCE_DIR, OUT_CONTACT_SHEET.parent]:
        path.mkdir(parents=True, exist_ok=True)


def srgb(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    return (
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
        1.0,
    )


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def mix(a: tuple[float, float, float], b: tuple[float, float, float], t: float) -> tuple[float, float, float]:
    return tuple(a[index] * (1 - t) + b[index] * t for index in range(3))


def rgb(hex_color: str) -> tuple[float, float, float]:
    return srgb(hex_color)[:3]


def draw_disc(pixels: list[float], width: int, height: int, cx: float, cy: float, radius: float, color: tuple[float, float, float], alpha: float = 1.0) -> None:
    min_x = max(0, int(cx - radius - 2))
    max_x = min(width - 1, int(cx + radius + 2))
    min_y = max(0, int(cy - radius - 2))
    max_y = min(height - 1, int(cy + radius + 2))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            distance = math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
            if distance <= radius:
                softness = clamp01((radius - distance) / max(radius * 0.12, 1.0))
                index = (y * width + x) * 4
                source_alpha = alpha * softness
                for channel in range(3):
                    pixels[index + channel] = pixels[index + channel] * (1 - source_alpha) + color[channel] * source_alpha
                pixels[index + 3] = 1.0


def draw_rect(
    pixels: list[float],
    width: int,
    height: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[float, float, float],
    alpha: float = 1.0,
) -> None:
    for y in range(max(0, y0), min(height, y1)):
        for x in range(max(0, x0), min(width, x1)):
            index = (y * width + x) * 4
            for channel in range(3):
                pixels[index + channel] = pixels[index + channel] * (1 - alpha) + color[channel] * alpha
            pixels[index + 3] = 1.0


def save_pixels_png(path: Path, width: int, height: int, pixels: list[float]) -> None:
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def make_tile(kind: str, path: Path, width: int = 256, height: int = 256) -> dict[str, object]:
    rng = Random(f"hp-wall-door-switch-{kind}-v1")
    pixels = [0.0] * (width * height * 4)

    palettes = {
        "ceramic_shell": (rgb("#ded8cc"), rgb("#fffaf0"), rgb("#a3aaa4")),
        "smoked_titanium_spine": (rgb("#242522"), rgb("#9d9b8b"), rgb("#10110f")),
        "black_rubber_recess": (rgb("#050706"), rgb("#18201f"), rgb("#000000")),
        "dark_handle_metal": (rgb("#0d0e0c"), rgb("#6e6c60"), rgb("#050504")),
        "cyan_status_glass": (rgb("#03191c"), rgb("#72f6ff"), rgb("#0a4247")),
        "amber_status_glass": (rgb("#221305"), rgb("#ffbd4d"), rgb("#52300a")),
    }
    base, highlight, shadow = palettes[kind]

    for y in range(height):
        v = y / max(height - 1, 1)
        for x in range(width):
            u = x / max(width - 1, 1)
            edge = max(abs(u - 0.5) * 2, abs(v - 0.5) * 2)
            grain = (rng.random() - 0.5) * 0.055
            if kind in {"smoked_titanium_spine", "dark_handle_metal"}:
                stripe = 0.5 + 0.5 * math.sin((u * 34.0 + v * 4.0) * math.pi)
                color = mix(base, highlight, 0.16 + 0.22 * stripe + 0.2 * (1 - edge))
                color = mix(color, shadow, 0.1 * edge)
            elif kind == "ceramic_shell":
                bevel = clamp01((edge - 0.76) / 0.24)
                color = mix(base, highlight, 0.46 * (1 - edge) + 0.13 * math.sin(v * math.pi))
                color = mix(color, shadow, 0.28 * bevel)
            elif kind == "black_rubber_recess":
                weave = 0.5 + 0.5 * math.sin((u * 72.0 + v * 16.0) * math.pi)
                color = mix(base, highlight, 0.1 * weave + 0.08 * (1 - edge))
            else:
                glow_axis = math.exp(-((u - 0.5) ** 2) / 0.012) + math.exp(-((v - 0.5) ** 2) / 0.02) * 0.35
                color = mix(base, highlight, clamp01(0.12 + glow_axis * 0.58))
                color = mix(color, shadow, 0.15 * edge)
            index = (y * width + x) * 4
            pixels[index] = clamp01(color[0] + grain)
            pixels[index + 1] = clamp01(color[1] + grain)
            pixels[index + 2] = clamp01(color[2] + grain)
            pixels[index + 3] = 1.0

    # Add small authored details so the GLB reads baked instead of flat colored.
    if kind == "ceramic_shell":
        for x in [28, width - 30]:
            draw_rect(pixels, width, height, x, 20, x + 2, height - 20, rgb("#bfc7c1"), 0.42)
        for y in [46, height - 48]:
            draw_rect(pixels, width, height, 34, y, width - 34, y + 2, rgb("#ffffff"), 0.35)
        for x, y in [(42, 42), (width - 44, 42), (42, height - 44), (width - 44, height - 44)]:
            draw_disc(pixels, width, height, x, y, 8, rgb("#7c827e"), 0.75)
            draw_rect(pixels, width, height, int(x - 5), int(y), int(x + 5), int(y + 1), rgb("#303432"), 0.65)
    elif kind == "smoked_titanium_spine":
        draw_rect(pixels, width, height, 78, 0, 82, height, rgb("#cbc4a7"), 0.2)
        draw_rect(pixels, width, height, 172, 0, 176, height, rgb("#060706"), 0.46)
        draw_rect(pixels, width, height, 122, 16, 134, height - 16, rgb("#090b0a"), 0.28)
        for _ in range(95):
            y = rng.randrange(0, height)
            x0 = rng.randrange(8, width - 40)
            draw_rect(pixels, width, height, x0, y, x0 + rng.randrange(8, 42), y + 1, rgb("#c6c1aa"), 0.14)
    elif kind == "black_rubber_recess":
        for x in range(24, width, 32):
            draw_rect(pixels, width, height, x, 8, x + 1, height - 8, rgb("#22302d"), 0.32)
        for y in range(24, height, 32):
            draw_rect(pixels, width, height, 8, y, width - 8, y + 1, rgb("#233330"), 0.24)
    elif kind == "dark_handle_metal":
        draw_rect(pixels, width, height, 70, 0, 90, height, rgb("#858273"), 0.22)
        draw_rect(pixels, width, height, 174, 0, 188, height, rgb("#020202"), 0.4)
        for y in [28, 44, 70, height - 70, height - 44, height - 28]:
            draw_rect(pixels, width, height, 20, y, width - 20, y + 2, rgb("#b3ad92"), 0.2)
    elif kind == "cyan_status_glass":
        draw_rect(pixels, width, height, 119, 34, 137, height - 34, rgb("#7ffaff"), 0.82)
        draw_rect(pixels, width, height, 111, 55, 115, height - 55, rgb("#2ebdcc"), 0.38)
        draw_rect(pixels, width, height, 142, 55, 146, height - 55, rgb("#2ebdcc"), 0.38)
    elif kind == "amber_status_glass":
        draw_rect(pixels, width, height, 119, 44, 137, height - 44, rgb("#ffc24c"), 0.84)
        draw_rect(pixels, width, height, 109, 70, 114, height - 70, rgb("#8d5514"), 0.34)
        draw_rect(pixels, width, height, 142, 70, 147, height - 70, rgb("#8d5514"), 0.34)

    save_pixels_png(path, width, height, pixels)
    return {
        "key": kind,
        "file": str(path.relative_to(ROOT)),
        "width": width,
        "height": height,
        "promptRole": kind.replace("_", " "),
    }


def generate_image2_sources() -> dict[str, object]:
    tile_paths = {
        "ceramic_shell": OUT_SOURCE_DIR / "wall_switch_ceramic_shell_image2.png",
        "smoked_titanium_spine": OUT_SOURCE_DIR / "wall_switch_smoked_titanium_spine_image2.png",
        "black_rubber_recess": OUT_SOURCE_DIR / "wall_switch_black_rubber_recess_image2.png",
        "dark_handle_metal": OUT_SOURCE_DIR / "wall_switch_dark_handle_metal_image2.png",
        "cyan_status_glass": OUT_SOURCE_DIR / "wall_switch_cyan_status_glass_image2.png",
        "amber_status_glass": OUT_SOURCE_DIR / "wall_switch_amber_status_glass_image2.png",
    }
    tiles = [make_tile(key, path) for key, path in tile_paths.items()]

    atlas_width = 768
    atlas_height = 512
    atlas_pixels = [0.0] * (atlas_width * atlas_height * 4)
    regions: dict[str, dict[str, float | int | str]] = {}

    for tile_index, tile in enumerate(tiles):
        tile_path = ROOT / str(tile["file"])
        source = bpy.data.images.load(str(tile_path))
        source_pixels = list(source.pixels[:])
        col = tile_index % 3
        row = tile_index // 3
        offset_x = col * 256
        offset_y = row * 256
        for y in range(256):
            for x in range(256):
                src_index = (y * 256 + x) * 4
                dst_index = ((offset_y + y) * atlas_width + offset_x + x) * 4
                atlas_pixels[dst_index : dst_index + 4] = source_pixels[src_index : src_index + 4]
        bpy.data.images.remove(source)
        regions[str(tile["key"])] = {
            "file": tile["file"],
            "x": offset_x,
            "y": offset_y,
            "width": 256,
            "height": 256,
            "uv": [round(offset_x / atlas_width, 4), round(offset_y / atlas_height, 4), round(256 / atlas_width, 4), round(256 / atlas_height, 4)],
        }

    save_pixels_png(OUT_ATLAS, atlas_width, atlas_height, atlas_pixels)
    OUT_ATLAS_REGIONS.write_text(json.dumps({"atlas": str(OUT_ATLAS.relative_to(ROOT)), "regions": regions}, indent=2) + "\n")

    # Same packed sheet duplicated into reports so reviewers can inspect the bake quickly.
    save_pixels_png(OUT_CONTACT_SHEET, atlas_width, atlas_height, atlas_pixels)

    return {
        "prompt": DESIGN_PROMPT,
        "generator": "deterministic Blender Python Image2-style texture source generator",
        "license": "project-owned deterministic generated output",
        "sourceTiles": tiles,
        "atlas": str(OUT_ATLAS.relative_to(ROOT)),
        "regions": str(OUT_ATLAS_REGIONS.relative_to(ROOT)),
        "contactSheet": str(OUT_CONTACT_SHEET.relative_to(ROOT)),
    }


def make_textured_mat(
    name: str,
    texture_path: Path,
    fallback_color: str,
    *,
    metallic: float = 0.0,
    roughness: float = 0.55,
    emissive: str | None = None,
    emissive_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = (*srgb(fallback_color)[:3], alpha)
    if alpha < 1:
        material.blend_method = "BLEND"
        material.show_transparent_back = False
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*srgb(fallback_color)[:3], alpha)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        image_node = material.node_tree.nodes.new("ShaderNodeTexImage")
        image_node.name = f"{name}_basecolor_image2"
        image_node.image = bpy.data.images.load(str(texture_path))
        material.node_tree.links.new(image_node.outputs["Color"], bsdf.inputs["Base Color"])
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb(emissive)
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return material


def finish(obj: bpy.types.Object, bevel: float = 0.0, segments: int = 2, uv: bool = True) -> bpy.types.Object:
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.ops.object.mode_set.poll() else None
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        bevel_mod = obj.modifiers.new("soft_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = segments
        bevel_mod.limit_method = "ANGLE"
        bevel_mod.angle_limit = math.radians(35)
        bpy.ops.object.modifier_apply(modifier=bevel_mod.name)
    if uv:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
        bpy.ops.object.mode_set(mode="OBJECT")
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    normal = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    obj.select_set(False)
    return obj


def cube(
    name: str,
    loc: tuple[float, float, float],
    dims: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.006,
    segments: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return finish(obj, bevel, segments)


def cyl(
    name: str,
    loc: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 32,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.004,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return finish(obj, bevel, 2)


def torus(
    name: str,
    loc: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    *,
    rot: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 48,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=10,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return finish(obj, 0.0, 1)


def build_asset() -> tuple[list[bpy.types.Object], dict[str, object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"

    image2 = generate_image2_sources()
    tile_map = {Path(str(tile["file"])).stem: ROOT / str(tile["file"]) for tile in image2["sourceTiles"]}
    texture_lookup = {
        "ceramic": tile_map["wall_switch_ceramic_shell_image2"],
        "titanium": tile_map["wall_switch_smoked_titanium_spine_image2"],
        "recess": tile_map["wall_switch_black_rubber_recess_image2"],
        "handle": tile_map["wall_switch_dark_handle_metal_image2"],
        "cyan": tile_map["wall_switch_cyan_status_glass_image2"],
        "amber": tile_map["wall_switch_amber_status_glass_image2"],
    }

    mats = {
        "ceramic": make_textured_mat("wall_switch_ceramic_shell_image2", texture_lookup["ceramic"], "#e5dfd2", metallic=0.04, roughness=0.48),
        "titanium": make_textured_mat("wall_switch_smoked_titanium_spine_image2", texture_lookup["titanium"], "#5d625d", metallic=0.72, roughness=0.28),
        "recess": make_textured_mat("wall_switch_black_rubber_recess_image2", texture_lookup["recess"], "#070908", metallic=0.18, roughness=0.62),
        "handle": make_textured_mat("wall_switch_dark_handle_metal_image2", texture_lookup["handle"], "#171713", metallic=0.82, roughness=0.26),
        "cyan": make_textured_mat(
            "wall_switch_cyan_status_glass_image2",
            texture_lookup["cyan"],
            "#62efff",
            metallic=0.05,
            roughness=0.16,
            emissive="#62efff",
            emissive_strength=1.35,
        ),
        "amber": make_textured_mat(
            "wall_switch_amber_status_glass_image2",
            texture_lookup["amber"],
            "#ffc25a",
            metallic=0.05,
            roughness=0.18,
            emissive="#ffc25a",
            emissive_strength=0.95,
        ),
    }

    parts: list[bpy.types.Object] = []
    lever_down_offset_z = -0.34

    def add(obj: bpy.types.Object, *, movable: bool = False) -> bpy.types.Object:
        if movable:
            obj["hp_lever_motion_part"] = True
            obj["hp_lever_default"] = "up"
            obj["hp_lever_down_offset_z"] = lever_down_offset_z
        parts.append(obj)
        return obj

    # Coordinate contract: X width, Y depth, Z height, front/readable face is -Y.
    add(cube("wall_switch_shadow_gasket_backplate", (0, 0.034, 0), (0.49, 0.045, 0.79), mats["recess"], bevel=0.032, segments=4))
    add(cube("wall_switch_rounded_ceramic_wall_plate", (0, 0.004, 0), (0.43, 0.067, 0.735), mats["ceramic"], bevel=0.035, segments=5))
    add(cube("wall_switch_ceramic_upper_cap", (0, -0.043, 0.332), (0.3, 0.034, 0.045), mats["ceramic"], bevel=0.012, segments=2))
    add(cube("wall_switch_ceramic_lower_cap", (0, -0.043, -0.332), (0.3, 0.034, 0.045), mats["ceramic"], bevel=0.012, segments=2))
    add(cube("wall_switch_left_guard_rail", (-0.185, -0.055, 0.0), (0.035, 0.04, 0.58), mats["titanium"], bevel=0.01, segments=2))
    add(cube("wall_switch_right_ceramic_guard", (0.19, -0.048, 0.0), (0.04, 0.038, 0.54), mats["ceramic"], bevel=0.013, segments=2))

    add(cube("wall_switch_smoked_titanium_main_spine", (0.035, -0.065, 0), (0.18, 0.055, 0.62), mats["titanium"], bevel=0.018, segments=3))
    add(cube("wall_switch_black_vertical_motion_slot", (-0.095, -0.093, 0.02), (0.105, 0.04, 0.58), mats["recess"], bevel=0.018, segments=3))
    add(cube("wall_switch_up_motion_memory_notch_cyan", (-0.095, -0.119, 0.235), (0.088, 0.012, 0.032), mats["cyan"], bevel=0.004, segments=2))
    add(cube("wall_switch_down_motion_memory_notch_amber", (-0.095, -0.119, -0.135), (0.088, 0.012, 0.032), mats["amber"], bevel=0.004, segments=2))
    add(cube("wall_switch_motion_track_center_scrape", (-0.095, -0.121, 0.045), (0.012, 0.009, 0.3), mats["titanium"], bevel=0.002, segments=1))
    add(cube("wall_switch_top_status_smoked_window", (0.055, -0.101, 0.22), (0.095, 0.018, 0.18), mats["recess"], bevel=0.014, segments=3))
    add(cube("wall_switch_bottom_status_smoked_window", (0.055, -0.101, -0.22), (0.095, 0.018, 0.155), mats["recess"], bevel=0.014, segments=3))
    add(cube("wall_switch_cyan_up_status_light", (0.055, -0.114, 0.22), (0.017, 0.012, 0.12), mats["cyan"], bevel=0.005, segments=2))
    add(cube("wall_switch_amber_down_status_light", (0.055, -0.114, -0.22), (0.017, 0.012, 0.095), mats["amber"], bevel=0.005, segments=2))
    add(cube("wall_switch_right_side_cyan_glass_slit", (0.212, -0.065, 0.015), (0.016, 0.02, 0.275), mats["cyan"], bevel=0.004, segments=2))

    # Movable short lever assembly: default is the "up" position. Runtime can
    # move nodes with the wall_switch_lever_movable_ prefix by hp_lever_down_offset_z.
    lever_x = -0.095
    lever_y = -0.195
    add(cyl("wall_switch_lever_movable_short_upper_pull_rod", (lever_x, lever_y, 0.245), 0.03, 0.31, mats["handle"], vertices=34, bevel=0.006), movable=True)
    add(cyl("wall_switch_lever_movable_top_grip_cap", (lever_x, lever_y - 0.003, 0.425), 0.039, 0.055, mats["handle"], vertices=34, bevel=0.008), movable=True)
    add(cyl("wall_switch_lever_movable_lower_stop_cap", (lever_x, lever_y + 0.002, 0.07), 0.036, 0.035, mats["titanium"], vertices=34, bevel=0.006), movable=True)
    add(cyl("wall_switch_lever_movable_bearing_disc_back", (lever_x, -0.145, 0.075), 0.062, 0.034, mats["titanium"], vertices=42, rot=(math.pi / 2, 0, 0), bevel=0.005), movable=True)
    add(cyl("wall_switch_lever_movable_bearing_disc_front", (lever_x, -0.187, 0.075), 0.047, 0.026, mats["handle"], vertices=42, rot=(math.pi / 2, 0, 0), bevel=0.004), movable=True)
    add(torus("wall_switch_lever_movable_small_bearing_collar", (lever_x, -0.205, 0.075), 0.042, 0.005, mats["titanium"], rot=(math.pi / 2, 0, 0), major_segments=42), movable=True)
    add(cyl("wall_switch_lever_movable_center_pin", (lever_x, -0.219, 0.075), 0.014, 0.014, mats["titanium"], vertices=26, rot=(math.pi / 2, 0, 0), bevel=0.003), movable=True)
    add(cube("wall_switch_lever_movable_slider_yoke", (lever_x, -0.132, 0.075), (0.105, 0.045, 0.036), mats["titanium"], bevel=0.007, segments=2), movable=True)

    # Small readable fasteners and no-text glyph bars.
    for index, (x, z) in enumerate([(-0.155, 0.318), (0.155, 0.318), (-0.155, -0.318), (0.155, -0.318)]):
        add(cyl(f"wall_switch_recessed_hex_screw_{index}", (x, -0.086, z), 0.016, 0.012, mats["titanium"], vertices=6, rot=(math.pi / 2, 0, 0), bevel=0.002))
    for index, z in enumerate([0.122, 0.092, -0.103, -0.132]):
        add(cube(f"wall_switch_blank_micro_tick_{index}", (0.157, -0.107, z), (0.044, 0.009, 0.005), mats["cyan" if index < 2 else "amber"], bevel=0.002, segments=1))

    root = bpy.data.objects.new(MODEL_KEY, None)
    bpy.context.collection.objects.link(root)
    for obj in parts:
        obj.parent = root

    root["hp_model_key"] = MODEL_KEY
    root["hp_asset_role"] = "generic_wall_door_switch_lever"
    root["license"] = "Project-owned deterministic Blender geometry and Image2-style texture bake; no third-party mesh or texture."
    root["front_face"] = "-Y"
    root["interactionState"] = "repeatable toggle lever, visual default up; movable nodes can shift down by -0.34m on Z"
    return parts, image2


def bbox(parts: list[bpy.types.Object]) -> tuple[float, float, float, float, float, float]:
    points = [obj.matrix_world @ Vector(corner) for obj in parts for corner in obj.bound_box]
    return (
        min(point.x for point in points),
        max(point.x for point in points),
        min(point.y for point in points),
        max(point.y for point in points),
        min(point.z for point in points),
        max(point.z for point in points),
    )


def triangle_count(parts: list[bpy.types.Object]) -> int:
    total = 0
    for obj in parts:
        total += sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)
    return total


def write_reports(parts: list[bpy.types.Object], image2: dict[str, object]) -> None:
    min_x, max_x, min_y, max_y, min_z, max_z = bbox(parts)
    size = [round(max_x - min_x, 3), round(max_z - min_z, 3), round(max_y - min_y, 3)]
    common = {
        "assetId": MODEL_KEY,
        "modelKey": MODEL_KEY,
        "displayName": "Wall Door Switch Lever",
        "role": "generic wall-mounted repeatable door lever for wall-door-switch mechanisms",
        "license": {
            "status": "project-owned",
            "commercialUse": True,
            "modification": True,
            "attributionRequired": False,
            "notes": (
                "Original deterministic Blender geometry and deterministic Image2-style texture pixels. "
                "No third-party mesh or texture is bundled. User reference image was high-level aesthetic direction only."
            ),
        },
        "referenceInputs": [
            {
                "path": REFERENCE_IMAGE_PATH,
                "use": "high-level aesthetic direction only",
                "redistributed": False,
            }
        ],
        "outputs": {
            "glb": str(OUT_GLB.relative_to(ROOT)),
            "sourceBlend": str(OUT_BLEND.relative_to(ROOT)),
            "spec": str(OUT_SPEC.relative_to(ROOT)),
            "report": str(OUT_REPORT.relative_to(ROOT)),
            "image2Atlas": str(OUT_ATLAS.relative_to(ROOT)),
            "image2AtlasRegions": str(OUT_ATLAS_REGIONS.relative_to(ROOT)),
            "image2ContactSheet": str(OUT_CONTACT_SHEET.relative_to(ROOT)),
        },
        "image2": image2,
        "sizeMeters": size,
        "collisionProxyRecommendation": {
            "kind": "wall-mounted nonblocking interaction prop",
            "boxMeters": [0.5, 0.12, 0.85],
            "notes": "Use interaction radius for E prompt; keep lever protrusion visual-only so the player does not snag on the handle.",
        },
        "orientation": {
            "upAxisInBlender": "Z",
            "frontFaceInBlender": "-Y",
            "runtimePlacement": "LevelInteraction.position is the plate center; LevelInteraction.yaw rotates the front face toward the player/wall normal.",
        },
        "designPrompt": DESIGN_PROMPT,
        "materialSlots": sorted({slot.material.name for obj in parts for slot in obj.material_slots if slot.material}),
        "nodeNames": [obj.name for obj in parts],
        "mobileBudget": {
            "intendedCountPerLevel": "1-8",
            "opaqueMaterialsPreferred": True,
            "transparentMaterials": [],
            "emissiveMaterials": ["wall_switch_cyan_status_glass_image2", "wall_switch_amber_status_glass_image2"],
            "triangleCount": triangle_count(parts),
            "textureBudget": "Six embedded 256x256 base-color tiles plus one archived 768x512 atlas/contact sheet.",
            "readability": "Short upper-half pull rod, small bearing collar, and cyan/amber up-down memory notches are visible at mobile first-person distance.",
        },
        "builderCatalog": {
            "category": "interaction",
            "footprint": "wall-mounted; anchor to wall face; no floor footprint",
            "runtimeModelKeyCompatibility": "Existing configs keep hp_wall_door_switch_button_v1.",
        },
    }
    OUT_SPEC.write_text(json.dumps(common, indent=2, ensure_ascii=False) + "\n")
    OUT_REPORT.write_text(json.dumps({**common, "schemaVersion": "hp.asset.blender_report.v2"}, indent=2, ensure_ascii=False) + "\n")


def export(parts: list[bpy.types.Object]) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    root = bpy.data.objects.get(MODEL_KEY)
    if root:
        root.select_set(True)
        bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_texture_dir="",
    )


def main() -> None:
    ensure_dirs()
    parts, image2 = build_asset()
    export(parts)
    write_reports(parts, image2)
    print("WALL_DOOR_SWITCH_LEVER_DONE")
    print(f"GLB {OUT_GLB}")
    print(f"BLEND {OUT_BLEND}")
    print(f"SPEC {OUT_SPEC}")
    print(f"REPORT {OUT_REPORT}")
    print(f"IMAGE2_ATLAS {OUT_ATLAS}")


if __name__ == "__main__":
    main()
