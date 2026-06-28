#!/usr/bin/env python3
"""Generate the Level 03 museum puzzle orb GLBs used by Raw WebGPU."""

import math
import traceback
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/models-cooked/environment/level03"


ORB_SPECS = {
    "red": {
        "file": "age_museum_puzzle_orb_red.glb",
        "glass": (1.0, 0.25, 0.16, 0.76),
        "core": (1.0, 0.12, 0.08, 1.0),
        "emission": (1.0, 0.14, 0.1, 1.0),
    },
    "blue": {
        "file": "age_museum_puzzle_orb_blue.glb",
        "glass": (0.18, 0.48, 1.0, 0.76),
        "core": (0.08, 0.34, 1.0, 1.0),
        "emission": (0.1, 0.38, 1.0, 1.0),
    },
    "green": {
        "file": "age_museum_puzzle_orb_green.glb",
        "glass": (0.22, 1.0, 0.58, 0.76),
        "core": (0.05, 1.0, 0.42, 1.0),
        "emission": (0.06, 1.0, 0.42, 1.0),
    },
    "purple": {
        "file": "age_museum_puzzle_orb_purple.glb",
        "glass": (0.66, 0.34, 1.0, 0.76),
        "core": (0.54, 0.18, 1.0, 1.0),
        "emission": (0.48, 0.16, 1.0, 1.0),
    },
    "yellow": {
        "file": "age_museum_puzzle_orb_yellow.glb",
        "glass": (1.0, 0.78, 0.2, 0.76),
        "core": (1.0, 0.68, 0.08, 1.0),
        "emission": (1.0, 0.66, 0.08, 1.0),
    },
    "white": {
        "file": "age_museum_puzzle_orb_white.glb",
        "glass": (0.88, 0.96, 1.0, 0.76),
        "core": (0.78, 0.92, 1.0, 1.0),
        "emission": (0.72, 0.9, 1.0, 1.0),
    },
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def set_input(node, name, value):
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def mat_principled(name, color, roughness=0.35, metallic=0.0, alpha=1.0, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(f"Material {name} has no principled BSDF node")
    set_input(bsdf, "Base Color", color)
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "Metallic", metallic)
    set_input(bsdf, "Alpha", alpha)
    if emission:
        set_input(bsdf, "Emission Color", emission)
        set_input(bsdf, "Emission Strength", emission_strength)
    if alpha < 1.0:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = True
    return material


def cube(name, location, scale, material, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new(f"{name}_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def sphere(name, location, radius, material, segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def torus(name, location, major_radius, minor_radius, material, rotation=(0, 0, 0), major_segments=48, minor_segments=8):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def build_orb(color_name, spec):
    reset_scene()
    glass = mat_principled(
        f"puzzle_orb_{color_name}_museum_glass",
        spec["glass"],
        roughness=0.1,
        metallic=0.0,
        alpha=0.68,
        emission=spec["emission"],
        emission_strength=0.42,
    )
    core = mat_principled(
        f"puzzle_orb_{color_name}_inner_core",
        spec["core"],
        roughness=0.22,
        emission=spec["emission"],
        emission_strength=1.8,
    )
    brass = mat_principled("puzzle_orb_old_gold_holder", (0.58, 0.42, 0.17, 1), roughness=0.34, metallic=0.82)
    dark = mat_principled("puzzle_orb_dark_stem", (0.012, 0.018, 0.018, 1), roughness=0.58, metallic=0.55)
    glint = mat_principled("puzzle_orb_soft_white_glint", (0.86, 1.0, 1.0, 0.82), roughness=0.06, alpha=0.82, emission=(0.55, 0.9, 1.0, 1), emission_strength=0.55)

    sphere(f"puzzle_orb_{color_name}_outer_glass", (0, 0, 0), 0.32, glass)
    sphere(f"puzzle_orb_{color_name}_core", (0, 0, 0), 0.19, core, 32, 16)
    torus(f"puzzle_orb_{color_name}_equator_brass", (0, 0, 0), 0.325, 0.018, brass, rotation=(math.pi / 2, 0, 0))
    torus(f"puzzle_orb_{color_name}_vertical_brass", (0, 0, 0), 0.325, 0.012, brass, rotation=(0, math.pi / 2, 0))
    cube(f"puzzle_orb_{color_name}_base_socket", (0, 0, -0.35), (0.42, 0.42, 0.07), dark, 0.012)
    cube(f"puzzle_orb_{color_name}_cyan_reflection_plate", (-0.09, -0.255, 0.17), (0.18, 0.012, 0.035), glint, 0.004)
    cube(f"puzzle_orb_{color_name}_small_accession_tag", (0.18, -0.255, -0.18), (0.12, 0.012, 0.03), brass, 0.003)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / spec["file"]
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
        export_image_format="AUTO",
    )
    print(f"generated {color_name} puzzle orb -> {out}")


def main():
    for color_name, spec in ORB_SPECS.items():
        build_orb(color_name, spec)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
