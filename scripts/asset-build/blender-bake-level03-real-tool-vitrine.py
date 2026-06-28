#!/usr/bin/env python3
"""Bake the Level 03 last-human tool vitrine with the real battleworn viewmodels.

The JS trial-asset generator owns the voice/skeleton display cases. This Blender
pass owns the tool case because it imports the actual GLB viewmodels, preserves
their battleworn materials, and poses them as museum objects.
"""

import math
import traceback
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/assets/models-cooked/environment/level03/hp_room_museum_last_human_tool_vitrine.glb"
IRON_ROD = ROOT / "src/assets/models/viewmodel/hp_viewmodel_iron_rod_wgpu_battleworn.glb"
SIDEARM = ROOT / "src/assets/models/viewmodel/hp_viewmodel_sidearm_wgpu_battleworn.glb"


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def mat_principled(name, color, roughness=0.55, metallic=0.0, alpha=1.0, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(f"Material {name} has no principled BSDF node")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if emission:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = True
    return material


MATS = {}


def init_materials():
    MATS.update(
        black=mat_principled("l3_exhibit_smoked_black_metal", (0.008, 0.013, 0.014, 1), 0.46, 0.72),
        body=mat_principled("l3_exhibit_powdercoat_body", (0.018, 0.03, 0.032, 1), 0.62, 0.38),
        brass=mat_principled("l3_exhibit_aged_brass", (0.45, 0.31, 0.13, 1), 0.34, 0.82),
        glass=mat_principled(
            "l3_exhibit_thick_cyan_glass",
            (0.46, 0.88, 0.92, 0.28),
            0.08,
            0.02,
            0.28,
            (0.03, 0.22, 0.25, 1),
            0.14,
        ),
        dark_glass=mat_principled(
            "l3_exhibit_smoked_glass",
            (0.01, 0.028, 0.032, 0.64),
            0.18,
            0.35,
            0.64,
            (0.01, 0.12, 0.15, 1),
            0.16,
        ),
        cyan=mat_principled("l3_exhibit_cyan_light", (0.36, 0.96, 1.0, 1), 0.22, 0.0, 1, (0.3, 1.0, 1.0, 1), 1.8),
        amber=mat_principled("l3_exhibit_amber_light", (1.0, 0.66, 0.22, 1), 0.26, 0.0, 1, (1.0, 0.55, 0.18, 1), 1.35),
        red=mat_principled("l3_exhibit_red_pin_light", (1.0, 0.2, 0.16, 1), 0.28, 0.0, 1, (1.0, 0.16, 0.12, 1), 1.2),
        rubber=mat_principled("l3_exhibit_dark_rubber_mount", (0.004, 0.005, 0.005, 1), 0.82, 0.02),
    )


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


def cyl(name, location, radius, depth, material, vertices=32, rotation=(0, 0, 0), bevel=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new(f"{name}_bevel", "BEVEL")
        mod.width = radius * 0.08
        mod.segments = 1
        obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def vitrine_shell():
    w, h, d = 1.92, 1.18, 0.70
    cube("tool_case_lower_plinth", (0, 0, 0.09), (w, d, 0.18), MATS["black"], 0.018)
    cube("tool_case_upper_cap", (0, 0, h - 0.08), (w, d, 0.16), MATS["black"], 0.018)
    cube("tool_case_inner_deck", (0, 0.02, 0.36), (w - 0.24, d - 0.20, 0.055), MATS["body"], 0.014)
    cube("tool_case_rear_smoked_back", (0, -d * 0.5 + 0.04, h * 0.5), (w - 0.14, 0.045, h - 0.32), MATS["dark_glass"], 0.004)
    cube("tool_case_front_glass", (0, d * 0.5 - 0.025, h * 0.5), (w - 0.2, 0.035, h - 0.36), MATS["glass"], 0.004)
    cube("tool_case_left_glass", (-w * 0.5 + 0.025, 0, h * 0.5), (0.035, d - 0.18, h - 0.36), MATS["glass"], 0.004)
    cube("tool_case_right_glass", (w * 0.5 - 0.025, 0, h * 0.5), (0.035, d - 0.18, h - 0.36), MATS["glass"], 0.004)
    for x in (-w * 0.5 + 0.045, w * 0.5 - 0.045):
        for y in (-d * 0.5 + 0.045, d * 0.5 - 0.045):
            cube(f"tool_case_brass_corner_{x:.2f}_{y:.2f}", (x, y, h * 0.5), (0.065, 0.065, h), MATS["brass"], 0.006)
    cube("tool_case_cyan_floor_line", (0, d * 0.5 - 0.08, 0.245), (w - 0.28, 0.025, 0.025), MATS["cyan"], 0.002)
    cube("tool_case_amber_label_slot", (0, d * 0.5 - 0.045, 0.335), (w * 0.36, 0.018, 0.04), MATS["amber"], 0.003)
    cube("rod_shadow_groove_left_bay", (-0.46, 0.245, 0.405), (0.68, 0.022, 0.028), MATS["amber"], 0.004)
    cube("sidearm_shadow_groove_right_bay", (0.50, 0.245, 0.405), (0.56, 0.022, 0.028), MATS["cyan"], 0.004)
    cube("tool_case_status_pin", (0.78, 0.34, 0.32), (0.05, 0.018, 0.05), MATS["red"], 0.003)
    # Low museum cradles: visible enough to ground the real tools, but not a fake tool silhouette.
    for x in (-0.68, -0.28):
        cyl(f"iron_rod_black_cradle_{x:.2f}", (x, 0.13, 0.48), 0.035, 0.16, MATS["rubber"], 16, (math.pi / 2, 0, 0), True)
    for x in (0.34, 0.66):
        cyl(f"sidearm_black_cradle_{x:.2f}", (x, 0.13, 0.49), 0.03, 0.14, MATS["rubber"], 16, (math.pi / 2, 0, 0), True)


def mesh_objects(objects):
    return [obj for obj in objects if obj.type == "MESH"]


def bounds_for(objects):
    bpy.context.view_layer.update()
    min_v = Vector((float("inf"), float("inf"), float("inf")))
    max_v = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in mesh_objects(objects):
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            min_v.x = min(min_v.x, world.x)
            min_v.y = min(min_v.y, world.y)
            min_v.z = min(min_v.z, world.z)
            max_v.x = max(max_v.x, world.x)
            max_v.y = max(max_v.y, world.y)
            max_v.z = max(max_v.z, world.z)
    return min_v, max_v, max_v - min_v


def fit_imported_to_box(empty, objects, box_min, box_max):
    bpy.context.view_layer.update()
    min_v, max_v, size = bounds_for(objects)
    allowed = box_max - box_min
    scale_factor = min(
        1.0,
        allowed.x / max(size.x, 0.001),
        allowed.y / max(size.y, 0.001),
        allowed.z / max(size.z, 0.001),
    )
    if scale_factor < 1.0:
        empty.scale *= scale_factor * 0.98
        bpy.context.view_layer.update()
        min_v, max_v, _ = bounds_for(objects)

    delta = Vector((0, 0, 0))
    if min_v.x < box_min.x:
        delta.x += box_min.x - min_v.x
    if max_v.x > box_max.x:
        delta.x += box_max.x - max_v.x
    if min_v.y < box_min.y:
        delta.y += box_min.y - min_v.y
    if max_v.y > box_max.y:
        delta.y += box_max.y - max_v.y
    if min_v.z < box_min.z:
        delta.z += box_min.z - min_v.z
    if max_v.z > box_max.z:
        delta.z += box_max.z - max_v.z
    empty.location += delta
    bpy.context.view_layer.update()


def imported_roots(new_objects):
    new_set = set(new_objects)
    return [obj for obj in new_objects if obj.parent not in new_set]


def import_viewmodel(path, root_name, target_long, location, rotation, fit_box=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new_objects = [obj for obj in bpy.data.objects if obj not in before]
    roots = imported_roots(new_objects)

    min_v, max_v, size = bounds_for(new_objects)
    center = (min_v + max_v) * 0.5
    for obj in roots:
        obj.location -= center

    _, _, centered_size = bounds_for(new_objects)
    longest = max(centered_size.x, centered_size.y, centered_size.z)
    scale = target_long / max(longest, 0.001)

    empty = bpy.data.objects.new(root_name, None)
    bpy.context.collection.objects.link(empty)
    empty.location = location
    empty.rotation_euler = rotation
    empty.scale = (scale, scale, scale)
    for obj in roots:
        obj.parent = empty

    for obj in mesh_objects(new_objects):
        obj.name = f"{root_name}_{obj.name}"
        obj.data.name = f"{root_name}_{obj.data.name}"
    if fit_box is not None:
        fit_imported_to_box(empty, new_objects, Vector(fit_box[0]), Vector(fit_box[1]))
    return empty, new_objects


def build():
    reset_scene()
    init_materials()
    vitrine_shell()

    # The real battleworn first-person models are normalized into museum poses.
    # Rod: long axis turned horizontal, slightly canted like a tagged artifact.
    import_viewmodel(
        IRON_ROD,
        "real_iron_rod_battleworn_exhibit",
        0.86,
        (-0.48, 0.07, 0.66),
        (0.04, -math.pi / 2 + 0.05, 0.18),
        fit_box=((-0.82, -0.18, 0.48), (-0.08, 0.23, 0.86)),
    )
    # Sidearm: side-on, low in the right bay, with the muzzle readable through glass.
    import_viewmodel(
        SIDEARM,
        "real_sidearm_battleworn_exhibit",
        0.62,
        (0.48, 0.07, 0.65),
        (0.12, -0.12, math.pi / 2 - 0.18),
        fit_box=((0.12, -0.18, 0.47), (0.82, 0.23, 0.88)),
    )

    # A tiny non-text label: only abstract accession bars, no player-facing prose.
    for i, x in enumerate((-0.18, -0.08, 0.02, 0.12)):
        cube(f"accession_tick_{i}", (x, 0.345, 0.335), (0.045, 0.012, 0.018), MATS["amber"], 0.0015)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUT),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
        export_image_format="AUTO",
    )
    print(f"baked real tool vitrine -> {OUT}")


if __name__ == "__main__":
    try:
        build()
    except Exception:
        traceback.print_exc()
        raise SystemExit(1)
