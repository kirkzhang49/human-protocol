#!/usr/bin/env python3
"""Bake the shared official exit elevator kit without texture atlases.

Run:
  blender --background --python scripts/asset-build/blender-generate-service-elevator-exit-kit.py

The model keys stay canonical:
  - service_elevator_exit_stage
  - service_elevator_interior_shell
  - service_elevator_call_buttons
  - service_elevator_ascent_shaft_fx

This version intentionally avoids embedded atlas/image textures. Raw WebGPU
and Three both receive the same geometry-rich elevator: physical metal panels,
beveled rails, a rigged plunger button, and a layered ascent shaft made from
real meshes plus emissive PBR material factors.
"""

from __future__ import annotations

import json
import math
import shutil
from datetime import date
from pathlib import Path

import bpy
from mathutils import Matrix


ROOT = Path(__file__).resolve().parents[2]
MODEL_COOKED_DIR = ROOT / "src/assets/models-cooked/environment/shells"
MODEL_SOURCE_DIR = ROOT / "src/assets/models/environment/shells"
SOURCE_BLEND_DIR = ROOT / "src/assets/source_blend/service-elevator-atlas-free"
REPORT_DIR = ROOT / "src/assets/manifests/reports"
PREVIEW_DIR = ROOT / ".tmp/service-elevator-atlas-free"

SOURCE_BLEND = SOURCE_BLEND_DIR / "human_protocol_service_elevator_atlas_free_exit_kit_v1.blend"
REPORT_PATH = REPORT_DIR / "service_elevator_atlas_free_blender_pipeline_report.json"
PREVIEW_PATH = PREVIEW_DIR / "service_elevator_atlas_free_cabin_preview.png"
ASCENT_PREVIEW_PATH = PREVIEW_DIR / "service_elevator_atlas_free_ascent_preview.png"

SHELL_GLB = MODEL_COOKED_DIR / "hp_service_elevator_interior_shell.glb"
BUTTON_GLB = MODEL_COOKED_DIR / "hp_service_elevator_call_buttons.glb"
SHAFT_GLB = MODEL_COOKED_DIR / "hp_service_elevator_ascent_shaft_fx.glb"
STAGE_GLB = MODEL_COOKED_DIR / "hp_service_elevator_exit_stage.glb"

MATERIAL_POLICY = "atlas-free procedural PBR materials; no embedded Image2/atlas texture images"

for directory in (MODEL_COOKED_DIR, MODEL_SOURCE_DIR, SOURCE_BLEND_DIR, REPORT_DIR, PREVIEW_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def bsdf_input(bsdf, identifier: str):
    for socket in bsdf.inputs:
        if socket.identifier == identifier or socket.name == identifier:
            return socket
    raise KeyError(identifier)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.55,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.use_backface_culling = False
    material["hp_material_policy"] = MATERIAL_POLICY
    nodes = material.node_tree.nodes
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    bsdf_input(bsdf, "Base Color").default_value = color
    bsdf_input(bsdf, "Metallic").default_value = metallic
    bsdf_input(bsdf, "Roughness").default_value = roughness
    bsdf_input(bsdf, "Alpha").default_value = alpha
    if emission is not None:
        bsdf_input(bsdf, "Emission Color").default_value = emission
        bsdf_input(bsdf, "Emission Strength").default_value = emission_strength
    if alpha < 1:
        material.blend_method = "BLEND"
        material.show_transparent_back = True
    return material


def add_bevel(obj, amount: float = 0.012, segments: int = 2):
    bevel = obj.modifiers.new("hp_small_bevel", "BEVEL")
    bevel.width = amount
    bevel.segments = segments
    bevel.affect = "EDGES"
    normals = obj.modifiers.new("hp_weighted_normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    return obj


def box(name: str, center, size, material, objects: list, bevel: float = 0.012, *, rotation_z: float = 0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation_z:
        obj.rotation_euler[2] = rotation_z
    obj.data.materials.append(material)
    obj["hp_part_role"] = name
    if bevel > 0:
        add_bevel(obj, bevel, 2)
    objects.append(obj)
    return obj


def cylinder_y(name: str, center, radius: float, depth: float, material, objects: list, vertices: int = 48, bevel: float = 0.004):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center, rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    obj["hp_part_role"] = name
    if bevel > 0:
        add_bevel(obj, bevel, 2)
    objects.append(obj)
    return obj


def cylinder_x(name: str, center, radius: float, depth: float, material, objects: list, vertices: int = 40, bevel: float = 0.003):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center, rotation=(0, math.pi / 2, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    obj["hp_part_role"] = name
    if bevel > 0:
        add_bevel(obj, bevel, 2)
    objects.append(obj)
    return obj


def cylinder_z(name: str, center, radius: float, depth: float, material, objects: list, vertices: int = 40, bevel: float = 0.003):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    obj["hp_part_role"] = name
    if bevel > 0:
        add_bevel(obj, bevel, 2)
    objects.append(obj)
    return obj


def plane(name: str, axis: str, center, width: float, height: float, material, objects: list):
    cx, cy, cz = center
    hw = width / 2
    hh = height / 2
    if axis == "XZ":
        verts = [(cx - hw, cy, cz - hh), (cx + hw, cy, cz - hh), (cx + hw, cy, cz + hh), (cx - hw, cy, cz + hh)]
    elif axis == "YZ":
        verts = [(cx, cy - hw, cz - hh), (cx, cy + hw, cz - hh), (cx, cy + hw, cz + hh), (cx, cy - hw, cz + hh)]
    elif axis == "XY":
        verts = [(cx - hw, cy - hh, cz), (cx + hw, cy - hh, cz), (cx + hw, cy + hh, cz), (cx - hw, cy + hh, cz)]
    else:
        raise ValueError(axis)

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop, uv in zip(uv_layer.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["hp_part_role"] = name
    obj["hp_surface_role"] = name
    objects.append(obj)
    return obj


def disk_y(name: str, center, radius: float, material, objects: list, segments: int = 64):
    cx, cy, cz = center
    verts = [(cx, cy, cz)]
    faces = []
    for index in range(segments):
        angle = (index / segments) * math.tau
        verts.append((cx + math.cos(angle) * radius, cy, cz + math.sin(angle) * radius))
    for index in range(segments):
        faces.append((0, index + 1, 1 + ((index + 1) % segments)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            vx, _, vz = mesh.vertices[vertex_index].co
            uv_layer.data[loop_index].uv = (0.5 + (vx - cx) / max(radius * 2, 0.0001), 0.5 + (vz - cz) / max(radius * 2, 0.0001))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["hp_part_role"] = name
    objects.append(obj)
    return obj


def ring_y(name: str, center, inner_radius: float, outer_radius: float, material, objects: list, segments: int = 72):
    cx, cy, cz = center
    verts = []
    faces = []
    for index in range(segments):
        angle = (index / segments) * math.tau
        c = math.cos(angle)
        s = math.sin(angle)
        verts.append((cx + c * inner_radius, cy, cz + s * inner_radius))
        verts.append((cx + c * outer_radius, cy, cz + s * outer_radius))
    for index in range(segments):
        ni = (index + 1) % segments
        faces.append((index * 2, ni * 2, ni * 2 + 1, index * 2 + 1))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            vx, _, vz = mesh.vertices[vertex_index].co
            uv_layer.data[loop_index].uv = (0.5 + (vx - cx) / max(outer_radius * 2, 0.0001), 0.5 + (vz - cz) / max(outer_radius * 2, 0.0001))
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["hp_part_role"] = name
    objects.append(obj)
    return obj


def export_glb(objects: list, output_path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=True,
        export_yup=True,
    )


def stage_copy(objects: list, prefix: str, *, translate=(0, 0, 0), rotate_z: float = 0.0) -> list:
    copied = []
    matrix = Matrix.Translation(translate) @ Matrix.Rotation(rotate_z, 4, "Z")
    for obj in objects:
        duplicate = obj.copy()
        duplicate.data = obj.data.copy()
        duplicate.animation_data_clear()
        duplicate.name = f"stage_{prefix}_{obj.name}"
        duplicate.data.name = f"{duplicate.name}_mesh"
        duplicate.matrix_world = matrix @ obj.matrix_world
        duplicate["hp_part_role"] = duplicate.name
        duplicate["hp_model_key"] = "service_elevator_exit_stage"
        bpy.context.collection.objects.link(duplicate)
        copied.append(duplicate)
    return copied


def build_materials():
    return {
        "smoked_body": make_material("hp_elevator_smoked_titanium_pbr", (0.032, 0.04, 0.041, 1), metallic=0.94, roughness=0.3),
        "deep_black": make_material("hp_elevator_deep_black_anodized_pbr", (0.007, 0.01, 0.013, 1), metallic=0.72, roughness=0.52),
        "black_rubber": make_material("hp_elevator_black_rubber_gasket_pbr", (0.006, 0.008, 0.01, 1), metallic=0.02, roughness=0.86),
        "graphite_panel": make_material("hp_elevator_graphite_microbrushed_pbr", (0.066, 0.078, 0.075, 1), metallic=0.9, roughness=0.3),
        "floor_dark": make_material("hp_elevator_floor_blackened_steel_pbr", (0.026, 0.031, 0.03, 1), metallic=0.92, roughness=0.36),
        "floor_edge": make_material("hp_elevator_floor_polished_worn_edge_pbr", (0.115, 0.132, 0.122, 1), metallic=0.95, roughness=0.2),
        "bright_trim": make_material("hp_elevator_brushed_champagne_trim_pbr", (0.22, 0.218, 0.17, 1), metallic=0.95, roughness=0.2),
        "brushed_highlight": make_material("hp_elevator_dim_burnished_edge_pbr", (0.16, 0.175, 0.16, 1), metallic=0.96, roughness=0.18),
        "cool_panel_highlight": make_material("hp_elevator_cool_scuffed_panel_highlight_pbr", (0.115, 0.136, 0.13, 1), metallic=0.94, roughness=0.22),
        "cyan_emissive": make_material(
            "hp_elevator_cold_edge_light_pbr",
            (0.12, 0.31, 0.33, 1),
            metallic=0.02,
            roughness=0.12,
            emission=(0.035, 0.16, 0.19, 1),
            emission_strength=0.24,
        ),
        "amber_emissive": make_material(
            "hp_elevator_amber_status_emissive_pbr",
            (0.48, 0.33, 0.155, 1),
            metallic=0.02,
            roughness=0.18,
            emission=(0.36, 0.19, 0.055, 1),
            emission_strength=0.56,
        ),
        "glass": make_material(
            "hp_elevator_opaque_smoked_glass_pbr",
            (0.012, 0.032, 0.036, 1),
            metallic=0.0,
            roughness=0.18,
            emission=(0.002, 0.012, 0.014, 1),
            emission_strength=0.01,
            alpha=1.0,
        ),
        "button_top": make_material(
            "hp_elevator_button_convex_ceramic_glass_pbr",
            (0.135, 0.168, 0.162, 1),
            metallic=0.76,
            roughness=0.18,
            emission=(0.004, 0.026, 0.03, 1),
            emission_strength=0.014,
        ),
        "button_face_metal": make_material(
            "hp_elevator_button_smoked_brushed_metal_face_pbr",
            (0.09, 0.112, 0.108, 1),
            metallic=0.96,
            roughness=0.16,
            emission=(0.003, 0.018, 0.02, 1),
            emission_strength=0.012,
        ),
        "button_ring": make_material(
            "hp_elevator_button_cyan_glass_ring_pbr",
            (0.08, 0.5, 0.56, 1),
            metallic=0.0,
            roughness=0.16,
            emission=(0.016, 0.24, 0.3, 1),
            emission_strength=0.78,
        ),
        "button_recess": make_material("hp_elevator_button_deep_socket_pbr", (0.016, 0.023, 0.028, 1), metallic=0.82, roughness=0.38),
    }


def build_shaft_materials():
    return {
        "shaft_black": make_material("hp_elevator_shaft_blackened_steel_pbr", (0.012, 0.018, 0.022, 1), metallic=0.9, roughness=0.34),
        "shaft_graphite": make_material("hp_elevator_shaft_microbrushed_graphite_pbr", (0.055, 0.07, 0.074, 1), metallic=0.9, roughness=0.28),
        "shaft_glass": make_material(
            "hp_elevator_shaft_smoked_depth_glass_pbr",
            (0.08, 0.2, 0.23, 0.18),
            metallic=0.0,
            roughness=0.14,
            emission=(0.012, 0.075, 0.09, 1),
            emission_strength=0.06,
            alpha=0.18,
        ),
        "shaft_cyan": make_material(
            "hp_elevator_shaft_cyan_motion_tube_pbr",
            (0.035, 0.28, 0.32, 0.38),
            metallic=0.03,
            roughness=0.12,
            emission=(0.012, 0.16, 0.21, 1),
            emission_strength=0.42,
            alpha=0.38,
        ),
        "shaft_cyan_soft": make_material(
            "hp_elevator_shaft_soft_cyan_reflection_pbr",
            (0.026, 0.13, 0.17, 0.22),
            metallic=0.0,
            roughness=0.18,
            emission=(0.01, 0.075, 0.105, 1),
            emission_strength=0.16,
            alpha=0.22,
        ),
        "shaft_amber": make_material(
            "hp_elevator_shaft_amber_service_marker_pbr",
            (0.38, 0.25, 0.105, 0.42),
            metallic=0.04,
            roughness=0.18,
            emission=(0.34, 0.16, 0.04, 1),
            emission_strength=0.48,
            alpha=0.42,
        ),
    }


def build_shell(materials) -> list:
    objects: list = []
    box("service_elevator_shell_floor_mass", (0, 0.08, 0.035), (5.92, 4.72, 0.07), materials["deep_black"], objects, 0.018)
    box("service_elevator_shell_floor_grate_panel", (-1.35, 0.08, 0.086), (2.55, 3.65, 0.045), materials["floor_dark"], objects, 0.012)
    box("service_elevator_shell_floor_diamond_plate_panel", (1.35, 0.08, 0.089), (2.55, 3.65, 0.045), materials["graphite_panel"], objects, 0.012)
    for idx, y in enumerate([y * 0.28 - 1.55 for y in range(12)]):
        box(f"service_elevator_shell_floor_left_slotted_recess_{idx:02d}", (-1.35, y, 0.125), (2.0, 0.035, 0.02), materials["deep_black"], objects, 0.01)
    for idx, y in enumerate([y * 0.36 - 1.44 for y in range(9)]):
        box(f"service_elevator_shell_floor_right_herringbone_a_{idx:02d}", (1.35, y, 0.128), (2.05, 0.026, 0.018), materials["floor_edge"], objects, 0.004, rotation_z=math.radians(18))
        box(f"service_elevator_shell_floor_right_herringbone_b_{idx:02d}", (1.35, y + 0.15, 0.129), (2.05, 0.026, 0.018), materials["deep_black"], objects, 0.004, rotation_z=math.radians(-18))
    box("service_elevator_shell_floor_gasket_front", (0, -2.16, 0.116), (5.35, 0.18, 0.04), materials["black_rubber"], objects, 0.006)
    box("service_elevator_shell_floor_center_metal_spine", (0, 0.08, 0.132), (0.08, 3.72, 0.05), materials["deep_black"], objects, 0.006)
    box("service_elevator_shell_floor_left_pressure_rail", (-2.72, 0.08, 0.136), (0.08, 3.62, 0.05), materials["floor_edge"], objects, 0.006)
    box("service_elevator_shell_floor_right_pressure_rail", (2.72, 0.08, 0.136), (0.08, 3.62, 0.05), materials["floor_edge"], objects, 0.006)

    box("service_elevator_shell_back_wall_mass", (0, 2.46, 1.56), (5.9, 0.16, 3.08), materials["smoked_body"], objects, 0.018)
    box("service_elevator_shell_back_deep_recess", (0, 2.36, 1.58), (5.18, 0.08, 2.48), materials["deep_black"], objects, 0.012)
    box("service_elevator_shell_back_blank_brushed_metal_wall", (0, 2.305, 1.62), (4.86, 0.04, 2.32), materials["graphite_panel"], objects, 0.012)
    for idx, z in enumerate([0.72, 0.98, 1.24, 1.5, 1.76, 2.02, 2.28, 2.54]):
        material = materials["brushed_highlight"] if idx % 3 == 1 else materials["deep_black"]
        box(f"service_elevator_shell_back_subtle_brushed_metal_line_{idx:02d}", (0, 2.252, z), (4.72, 0.034, 0.014), material, objects, 0.001)
    for idx, x in enumerate((-2.28, 2.28)):
        box(f"service_elevator_shell_back_cool_brushed_side_glint_{idx:02d}", (x, 2.248, 1.68), (0.055, 0.05, 2.08), materials["cool_panel_highlight"], objects, 0.002)
    for x in (-1.72, 0, 1.72):
        box(f"service_elevator_shell_back_vertical_micro_seam_{x:+.2f}", (x, 2.252, 1.62), (0.035, 0.052, 2.32), materials["deep_black"], objects, 0.003)
    box("service_elevator_shell_back_lower_kick_rail", (0, 2.245, 0.46), (4.82, 0.055, 0.09), materials["bright_trim"], objects, 0.006)
    box("service_elevator_shell_back_upper_shadow_rail", (0, 2.245, 2.76), (4.82, 0.05, 0.08), materials["deep_black"], objects, 0.004)
    box("service_elevator_shell_back_floor_shadow_gasket", (0, 2.238, 0.24), (4.9, 0.05, 0.12), materials["black_rubber"], objects, 0.004)

    for side, x in (("left", -3.04), ("right", 3.04)):
        box(f"service_elevator_shell_{side}_wall_mass", (x, 0.08, 1.54), (0.16, 4.68, 3.05), materials["smoked_body"], objects, 0.018)
        box(f"service_elevator_shell_{side}_wall_dark_brushed_panel", (x * 0.995, 0.04, 1.58), (0.045, 3.72, 2.22), materials["graphite_panel"], objects, 0.01)
        box(f"service_elevator_shell_{side}_wall_smoked_glass_slit", (x * 0.994, 1.18, 1.62), (0.035, 1.45, 2.36), materials["glass"], objects, 0.008)
        box(f"service_elevator_shell_{side}_floor_cyan_line", (x * 0.993, 0.03, 0.23), (0.018, 2.7, 0.032), materials["cyan_emissive"], objects, 0.003)
        for idx, y in enumerate([-1.32, -0.82, -0.32, 0.18, 0.68, 1.18]):
            material = materials["brushed_highlight"] if idx % 2 == 0 else materials["deep_black"]
            box(f"service_elevator_shell_{side}_wall_micro_brush_line_{idx:02d}", (x * 0.986, y, 2.24), (0.034, 0.28, 0.018), material, objects, 0.001)
        for idx, z in enumerate((0.86, 1.42, 1.98, 2.54)):
            box(f"service_elevator_shell_{side}_wall_cool_worn_vertical_glint_{idx:02d}", (x * 0.984, -1.42, z), (0.032, 0.038, 0.18), materials["cool_panel_highlight"], objects, 0.001)
        box(f"service_elevator_shell_{side}_front_vertical_shadow_rib", (x * 0.988, -1.74, 1.58), (0.055, 0.05, 2.54), materials["deep_black"], objects, 0.004)
        box(f"service_elevator_shell_{side}_rear_vertical_shadow_rib", (x * 0.988, 1.78, 1.58), (0.055, 0.05, 2.54), materials["deep_black"], objects, 0.004)

    box("service_elevator_shell_right_button_backplate_dark_brushed", (3.012, 0.7, 1.42), (0.04, 1.78, 1.58), materials["graphite_panel"], objects, 0.01)
    box("service_elevator_shell_right_button_backplate_cyan_edge", (3.006, -0.22, 1.42), (0.018, 0.035, 1.2), materials["cyan_emissive"], objects, 0.003)
    box("service_elevator_shell_right_button_backplate_gold_edge", (3.005, 1.62, 1.02), (0.03, 0.52, 0.055), materials["amber_emissive"], objects, 0.003)
    box("service_elevator_shell_right_button_vertical_service_light", (3.004, 2.05, 1.72), (0.018, 0.045, 1.28), materials["cyan_emissive"], objects, 0.003)

    box("service_elevator_shell_ceiling_shadow_mass", (0, 0.08, 3.16), (5.92, 4.78, 0.14), materials["deep_black"], objects, 0.014)
    box("service_elevator_shell_ceiling_metal_panel", (0, 0.08, 3.082), (5.18, 3.66, 0.045), materials["graphite_panel"], objects, 0.01)
    box("service_elevator_shell_ceiling_center_vent", (0, 0.08, 3.048), (2.96, 0.36, 0.035), materials["deep_black"], objects, 0.004)
    for idx, x in enumerate([x * 0.34 - 1.36 for x in range(9)]):
        box(f"service_elevator_shell_ceiling_vent_fin_{idx:02d}", (x, 0.08, 3.025), (0.035, 0.33, 0.035), materials["black_rubber"], objects, 0.002)
    box("service_elevator_shell_ceiling_front_shadow_rib", (0, -1.62, 3.052), (5.1, 0.055, 0.045), materials["deep_black"], objects, 0.004)
    box("service_elevator_shell_ceiling_rear_shadow_rib", (0, 1.72, 3.052), (5.1, 0.055, 0.045), materials["deep_black"], objects, 0.004)
    box("service_elevator_shell_ceiling_cyan_light_left", (-1.86, -0.22, 3.072), (0.045, 2.2, 0.018), materials["cyan_emissive"], objects, 0.003)
    box("service_elevator_shell_ceiling_cyan_light_right", (1.86, -0.22, 3.072), (0.045, 2.2, 0.018), materials["cyan_emissive"], objects, 0.003)
    box("service_elevator_shell_front_lintel_mass", (0, -2.24, 2.94), (5.96, 0.24, 0.38), materials["deep_black"], objects, 0.014)
    box("service_elevator_shell_back_top_champagne_trim", (0, 2.24, 2.94), (5.28, 0.08, 0.08), materials["bright_trim"], objects, 0.008)
    box("service_elevator_shell_back_low_champagne_trim", (0, 2.24, 0.22), (5.28, 0.075, 0.075), materials["bright_trim"], objects, 0.008)
    return objects


def build_buttons(materials) -> list:
    objects: list = []
    box("service_elevator_call_panel_back_mount", (0, 0.0, 0.0), (0.9, 0.14, 1.08), materials["deep_black"], objects, 0.026)
    box("service_elevator_call_panel_champagne_bezel", (0, -0.025, 0.0), (0.78, 0.065, 0.96), materials["bright_trim"], objects, 0.016)
    box("service_elevator_call_panel_dark_recess", (0, -0.061, -0.02), (0.68, 0.028, 0.76), materials["button_recess"], objects, 0.012)
    box("service_elevator_call_panel_brushed_service_plate", (0, -0.084, 0.245), (0.42, 0.018, 0.09), materials["cool_panel_highlight"], objects, 0.003)
    for idx, x in enumerate((-0.13, 0, 0.13)):
        box(f"service_elevator_call_panel_plate_dark_calibration_notch_{idx:02d}", (x, -0.096, 0.245), (0.026, 0.014, 0.065), materials["deep_black"], objects, 0.001)
    box("service_elevator_call_panel_top_readout_cyan", (0, -0.082, 0.375), (0.46, 0.016, 0.052), materials["cyan_emissive"], objects, 0.004)
    ring_y("service_elevator_call_button_dark_socket", (0, -0.125, -0.06), 0.286, 0.34, materials["button_recess"], objects, 128)

    plunger_body = cylinder_y("service_elevator_call_button_plunger_body", (0, -0.105, -0.06), 0.282, 0.106, materials["button_top"], objects, 160, 0.014)
    plunger_face = disk_y("service_elevator_call_button_plunger_face", (0, -0.163, -0.06), 0.266, materials["button_face_metal"], objects, 160)
    plunger_inner_ring = ring_y("service_elevator_call_button_plunger_metal_concentric_ring", (0, -0.171, -0.06), 0.134, 0.149, materials["brushed_highlight"], objects, 160)
    plunger_outer_groove = ring_y("service_elevator_call_button_plunger_dark_cutline_ring", (0, -0.173, -0.06), 0.218, 0.23, materials["deep_black"], objects, 160)
    plunger_core = disk_y("service_elevator_call_button_plunger_dark_center_cap", (0, -0.174, -0.06), 0.09, materials["button_recess"], objects, 128)
    glass_ring = ring_y("service_elevator_call_button_glass_ring", (0, -0.168, -0.06), 0.294, 0.318, materials["button_ring"], objects, 160)
    ring_y("service_elevator_call_button_inner_shadow_ring", (0, -0.171, -0.06), 0.266, 0.278, materials["deep_black"], objects, 160)
    box("service_elevator_call_button_machined_tick_top", (0, -0.179, 0.268), (0.16, 0.012, 0.018), materials["brushed_highlight"], objects, 0.001)
    box("service_elevator_call_button_machined_tick_bottom", (0, -0.179, -0.388), (0.16, 0.012, 0.018), materials["brushed_highlight"], objects, 0.001)
    box("service_elevator_call_button_machined_tick_left", (-0.34, -0.179, -0.06), (0.018, 0.012, 0.15), materials["brushed_highlight"], objects, 0.001)
    box("service_elevator_call_button_machined_tick_right", (0.34, -0.179, -0.06), (0.018, 0.012, 0.15), materials["brushed_highlight"], objects, 0.001)
    for sx in (-0.315, 0.315):
        for sz in (-0.455, 0.455):
            cylinder_y(f"service_elevator_call_panel_corner_screw_{sx}_{sz}", (sx, -0.072, sz), 0.026, 0.02, materials["bright_trim"], objects, 32, 0.002)

    box("service_elevator_call_button_integrated_shadow_slot", (0, -0.092, -0.445), (0.46, 0.05, 0.07), materials["deep_black"], objects, 0.008)
    box("service_elevator_call_button_integrated_status_glass", (0, -0.121, -0.445), (0.38, 0.018, 0.034), materials["cyan_emissive"], objects, 0.004)

    for obj in (plunger_body, plunger_face, plunger_inner_ring, plunger_outer_groove, plunger_core, glass_ring):
        obj["hp_runtime_motion"] = "exit_button_press"
        obj["hp_motion_axis_after_yup"] = "local_z_negative"
        obj["hp_motion_depth_meters"] = 0.105
    for obj in objects:
        obj["hp_model_key"] = "service_elevator_call_buttons"
    return objects


def build_shaft_fx(materials) -> list:
    objects: list = []
    box("service_elevator_ascent_shaft_static_back_depth_wall", (0, 1.98, 1.72), (5.7, 0.08, 3.65), materials["shaft_black"], objects, 0.012)
    for x in (-2.72, 2.72, -1.72, 1.72):
        box(f"service_elevator_ascent_shaft_static_depth_frame_{x:+.2f}", (x, 1.88, 1.72), (0.16, 0.14, 3.76), materials["shaft_graphite"], objects, 0.008)
    for idx, z in enumerate((0.62, 1.06, 1.5, 1.94, 2.38, 2.82)):
        box(f"service_elevator_ascent_shaft_static_back_horizontal_shadow_rib_{idx:02d}", (0, 1.835, z), (5.28, 0.065, 0.03), materials["shaft_graphite"], objects, 0.003)
    for idx, x in enumerate((-2.28, -1.96, 1.96, 2.28)):
        box(f"service_elevator_ascent_shaft_static_side_panel_shadow_slot_{idx:02d}", (x, 1.81, 1.74), (0.04, 0.052, 2.88), materials["shaft_black"], objects, 0.002)
    for idx, z in enumerate((0.54, 0.92, 1.3, 1.68, 2.06, 2.44, 2.82)):
        box(f"service_elevator_ascent_shaft_static_close_metal_louver_{idx:02d}", (0, -1.98, z), (4.72, 0.055, 0.026), materials["shaft_graphite"], objects, 0.002)
    for x in (-2.22, 2.22):
        cylinder_z(f"service_elevator_ascent_shaft_static_cable_bundle_{x:+.2f}", (x, 1.78, 1.68), 0.025, 3.56, materials["shaft_black"], objects, 20, 0.002)
        cylinder_z(f"service_elevator_ascent_shaft_static_cable_glow_reflection_{x:+.2f}", (x + 0.08, 1.76, 1.68), 0.012, 3.34, materials["shaft_cyan_soft"], objects, 20, 0.001)
    box("service_elevator_ascent_shaft_static_smoked_depth_glass_left", (-1.05, 1.72, 1.72), (0.72, 0.045, 3.32), materials["shaft_glass"], objects, 0.006)
    box("service_elevator_ascent_shaft_static_smoked_depth_glass_right", (1.05, 1.72, 1.72), (0.72, 0.045, 3.32), materials["shaft_glass"], objects, 0.006)
    box("service_elevator_ascent_shaft_static_near_black_rib_left", (-3.02, -1.02, 1.68), (0.28, 0.18, 3.84), materials["shaft_black"], objects, 0.01)
    box("service_elevator_ascent_shaft_static_near_black_rib_right", (3.02, -1.02, 1.68), (0.28, 0.18, 3.84), materials["shaft_black"], objects, 0.01)
    box("service_elevator_ascent_shaft_static_lower_perforated_grille", (0, -1.86, 0.34), (3.5, 0.07, 0.42), materials["shaft_graphite"], objects, 0.006)
    for idx, x in enumerate([x * 0.28 - 1.4 for x in range(11)]):
        box(f"service_elevator_ascent_shaft_static_grille_slot_{idx:02d}", (x, -1.905, 0.34), (0.035, 0.03, 0.34), materials["shaft_black"], objects, 0.002)

    moving_specs = [
        ("service_elevator_ascent_shaft_moving_cyan_core_column", (-0.42, -1.18, 1.78), (0.024, 0.026, 3.08), materials["shaft_cyan"], 0.0015),
        ("service_elevator_ascent_shaft_moving_cyan_far_column", (0.76, -1.28, 1.72), (0.022, 0.024, 2.86), materials["shaft_cyan"], 0.0015),
        ("service_elevator_ascent_shaft_moving_amber_far_column", (1.72, -1.36, 1.62), (0.026, 0.03, 2.9), materials["shaft_amber"], 0.002),
        ("service_elevator_ascent_shaft_moving_cyan_column_left", (-2.58, -0.96, 1.68), (0.024, 0.026, 2.78), materials["shaft_cyan"], 0.0015),
        ("service_elevator_ascent_shaft_moving_cyan_column_right", (2.58, -0.82, 1.68), (0.024, 0.026, 2.78), materials["shaft_cyan"], 0.0015),
        ("service_elevator_ascent_shaft_moving_cyan_wall_blade_left", (-1.68, -1.92, 1.74), (0.018, 0.022, 2.9), materials["shaft_cyan"], 0.0015),
        ("service_elevator_ascent_shaft_moving_cyan_wall_blade_right", (1.68, -1.92, 1.74), (0.018, 0.022, 2.9), materials["shaft_cyan"], 0.0015),
        ("service_elevator_ascent_shaft_moving_crossbeam_high", (0, 1.68, 2.86), (3.55, 0.075, 0.06), materials["shaft_graphite"], 0.004),
        ("service_elevator_ascent_shaft_moving_crossbeam_mid", (0, 1.58, 1.62), (3.35, 0.065, 0.052), materials["shaft_graphite"], 0.004),
        ("service_elevator_ascent_shaft_moving_crossbeam_low", (0, 1.5, 0.52), (3.2, 0.06, 0.05), materials["shaft_graphite"], 0.003),
        ("service_elevator_ascent_shaft_moving_crossbeam_near_high", (0, -1.98, 2.54), (4.25, 0.048, 0.045), materials["shaft_black"], 0.003),
        ("service_elevator_ascent_shaft_moving_crossbeam_near_low", (0, -1.98, 0.82), (4.05, 0.045, 0.04), materials["shaft_black"], 0.003),
        ("service_elevator_ascent_shaft_moving_amber_marker_left", (-1.2, -1.82, 0.96), (1.1, 0.024, 0.045), materials["shaft_amber"], 0.002),
        ("service_elevator_ascent_shaft_moving_amber_marker_right", (1.2, -1.84, 1.18), (0.95, 0.024, 0.04), materials["shaft_amber"], 0.002),
        ("service_elevator_ascent_shaft_moving_shadow_louver_high", (0, -2.04, 2.26), (4.55, 0.038, 0.034), materials["shaft_graphite"], 0.002),
        ("service_elevator_ascent_shaft_moving_shadow_louver_low", (0, -2.04, 1.08), (4.35, 0.034, 0.03), materials["shaft_graphite"], 0.002),
        ("service_elevator_ascent_shaft_moving_scan_band", (0, -1.86, 2.22), (0.82, 0.014, 0.024), materials["shaft_cyan"], 0.001),
        ("service_elevator_ascent_shaft_moving_scan_band_low", (0, -1.86, 0.62), (0.68, 0.014, 0.022), materials["shaft_cyan"], 0.001),
    ]
    for name, center, size, material, bevel in moving_specs:
        obj = box(name, center, size, material, objects, bevel)
        obj["hp_model_key"] = "service_elevator_ascent_shaft_fx"
        obj["hp_runtime_motion"] = "exit_elevator_ascent"
    for obj in objects:
        obj["hp_model_key"] = "service_elevator_ascent_shaft_fx"
    return objects


def add_preview_camera(shell_objects, button_objects, shaft_objects, stage_objects) -> None:
    for obj in stage_objects:
        obj.hide_render = True
        obj.hide_viewport = True

    for obj in button_objects:
        obj.hide_render = True
        preview = obj.copy()
        preview.data = obj.data.copy()
        preview.animation_data_clear()
        preview.name = f"preview_wall_mounted_{obj.name}"
        preview.hide_render = False
        preview.hide_viewport = False
        preview.location.x += 0.82
        preview.location.y += -1.82
        preview.location.z += 1.38
        bpy.context.collection.objects.link(preview)

    bpy.ops.object.light_add(type="AREA", location=(0, -3.8, 3.2))
    key = bpy.context.object
    key.name = "service_elevator_preview_softbox"
    key.data.energy = 220
    key.data.size = 4.4
    bpy.ops.object.light_add(type="POINT", location=(-1.8, -1.4, 1.6))
    cyan = bpy.context.object
    cyan.name = "service_elevator_preview_cyan_bounce"
    cyan.data.color = (0.24, 0.58, 0.62)
    cyan.data.energy = 26
    bpy.ops.object.light_add(type="POINT", location=(2.1, 0.8, 1.1))
    amber = bpy.context.object
    amber.name = "service_elevator_preview_amber_low_glint"
    amber.data.color = (0.72, 0.46, 0.22)
    amber.data.energy = 26
    bpy.ops.object.camera_add(location=(0.62, -5.25, 1.62), rotation=(math.radians(76), 0, math.radians(7)))
    camera = bpy.context.object
    bpy.context.scene.camera = camera
    try:
        bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 860
    bpy.context.scene.render.film_transparent = False
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    for obj in shaft_objects:
        obj.hide_render = True
        obj.hide_viewport = True
    bpy.context.scene.render.filepath = str(PREVIEW_PATH)
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as exc:  # noqa: BLE001 - preview is evidence, not export-critical.
        print(f"[service-elevator] cabin preview render skipped: {exc}")

    for obj in shaft_objects:
        obj.hide_render = False
        obj.hide_viewport = False
    cyan.data.energy = 38
    key.data.energy = 130
    bpy.context.scene.render.filepath = str(ASCENT_PREVIEW_PATH)
    try:
        bpy.ops.render.render(write_still=True)
    except Exception as exc:  # noqa: BLE001 - preview is evidence, not export-critical.
        print(f"[service-elevator] ascent preview render skipped: {exc}")


def inspect_glb(path: Path) -> dict:
    blob = path.read_bytes()
    json_length = int.from_bytes(blob[12:16], "little")
    payload = json.loads(blob[20 : 20 + json_length].decode("utf-8"))
    materials = payload.get("materials", [])
    material_names = [material.get("name", f"material_{index}") for index, material in enumerate(materials)]
    textured = [
        material.get("name", f"material_{index}")
        for index, material in enumerate(materials)
        if material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
    ]
    images = [image.get("name") or image.get("uri") or "embedded" for image in payload.get("images", [])]
    nodes = [node.get("name", "") for node in payload.get("nodes", [])]
    forbidden = [name for name in [*images, *material_names, *nodes] if "atlas" in name.lower() or "image2" in name.lower()]
    return {
        "materials": len(materials),
        "meshes": len(payload.get("meshes", [])),
        "nodes": len(nodes),
        "images": images,
        "texturedMaterials": textured,
        "forbiddenAtlasOrImage2Names": forbidden,
    }


def main() -> None:
    clear_scene()
    materials = build_materials()
    shaft_materials = build_shaft_materials()
    shell_objects = build_shell(materials)
    button_objects = build_buttons(materials)
    shaft_objects = build_shaft_fx(shaft_materials)
    for obj in shell_objects:
        obj["hp_model_key"] = "service_elevator_interior_shell"

    export_glb(shell_objects, SHELL_GLB)
    export_glb(button_objects, BUTTON_GLB)
    export_glb(shaft_objects, SHAFT_GLB)
    stage_objects = [
        *stage_copy(shell_objects, "shell"),
        *stage_copy(button_objects, "button", translate=(2.82, 0.7, 1.42), rotate_z=-math.pi / 2),
        *stage_copy(shaft_objects, "shaft"),
    ]
    export_glb(stage_objects, STAGE_GLB)
    shutil.copyfile(SHELL_GLB, MODEL_SOURCE_DIR / SHELL_GLB.name)
    shutil.copyfile(BUTTON_GLB, MODEL_SOURCE_DIR / BUTTON_GLB.name)
    shutil.copyfile(SHAFT_GLB, MODEL_SOURCE_DIR / SHAFT_GLB.name)
    shutil.copyfile(STAGE_GLB, MODEL_SOURCE_DIR / STAGE_GLB.name)
    add_preview_camera(shell_objects, button_objects, shaft_objects, stage_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))

    report = {
        "schema": "human-protocol/service-elevator-atlas-free-blender-report@1",
        "generatedBy": "scripts/asset-build/blender-generate-service-elevator-exit-kit.py",
        "generationDate": date.today().isoformat(),
        "blenderVersion": bpy.app.version_string,
        "sourceBlend": str(SOURCE_BLEND.relative_to(ROOT)),
        "preview": str(PREVIEW_PATH.relative_to(ROOT)) if PREVIEW_PATH.exists() else None,
        "ascentPreview": str(ASCENT_PREVIEW_PATH.relative_to(ROOT)) if ASCENT_PREVIEW_PATH.exists() else None,
        "materialPolicy": MATERIAL_POLICY,
        "externalTextureSources": [],
        "modelKeys": {
            "exitStage": "service_elevator_exit_stage",
            "roomShell": "service_elevator_interior_shell",
            "buttonPanel": "service_elevator_call_buttons",
            "ascentShaftFx": "service_elevator_ascent_shaft_fx",
        },
        "outputs": {
            "cooked": [
                str(STAGE_GLB.relative_to(ROOT)),
                str(SHELL_GLB.relative_to(ROOT)),
                str(BUTTON_GLB.relative_to(ROOT)),
                str(SHAFT_GLB.relative_to(ROOT)),
            ],
            "sourceMirror": [
                str((MODEL_SOURCE_DIR / STAGE_GLB.name).relative_to(ROOT)),
                str((MODEL_SOURCE_DIR / SHELL_GLB.name).relative_to(ROOT)),
                str((MODEL_SOURCE_DIR / BUTTON_GLB.name).relative_to(ROOT)),
                str((MODEL_SOURCE_DIR / SHAFT_GLB.name).relative_to(ROOT)),
            ],
        },
        "glbInspection": {
            "service_elevator_exit_stage": inspect_glb(STAGE_GLB),
            "service_elevator_interior_shell": inspect_glb(SHELL_GLB),
            "service_elevator_call_buttons": inspect_glb(BUTTON_GLB),
            "service_elevator_ascent_shaft_fx": inspect_glb(SHAFT_GLB),
        },
        "compositionContract": {
            "entryFace": "open front: threshold, side ribs, and lintel only; no fourth wall blocks the door view",
            "defaultRoomView": "three dark metallic walls, modeled floor/ceiling grooves, and side-mounted physical button panel",
            "ascentLayer": "atlas-free shaft meshes are authored in the stage GLB and runtime-hidden until exit cinematic ascent",
            "forbidden": ["embedded Image2 atlases", "broad fog planes", "poster-like back wall decals"],
        },
        "runtimeStateBoundary": {
            "buttonPressAnimation": "runtime translates the named GLB plunger/ring nodes according to exitElevatorButtonVisualState; no separate overlay button should cover the physical panel",
            "ascentAnimation": "runtime moves only named shaft moving columns/beams/scan bands; static rib/cable/glass geometry provides depth",
            "exitUnlockAndTiming": "config/GameWorld owned; not baked into GLB",
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
