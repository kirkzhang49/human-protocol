import json
import math
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "src" / "assets" / "models" / "viewmodel"
BLEND_DIR = ROOT / "src" / "assets" / "source_blend" / "viewmodel"
MANIFEST_DIR = ROOT / "src" / "assets" / "manifests"

ROD_GLB = MODEL_DIR / "hp_viewmodel_iron_rod_refined.glb"
SIDEARM_GLB = MODEL_DIR / "hp_viewmodel_sidearm_refined.glb"
ROD_BLEND = BLEND_DIR / "hp_viewmodel_iron_rod_refined.blend"
SIDEARM_BLEND = BLEND_DIR / "hp_viewmodel_sidearm_refined.blend"
MANIFEST_PATH = MANIFEST_DIR / "hp_viewmodel_refined_weapons_manifest.json"

OLD_TO_BLENDER = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
BLENDER_TO_OLD = OLD_TO_BLENDER.inverted()


def old_loc(value):
    return OLD_TO_BLENDER @ Vector(value)


def old_rot(value):
    old_matrix = Euler(value, "XYZ").to_matrix()
    return (OLD_TO_BLENDER @ old_matrix @ BLENDER_TO_OLD).to_euler("XYZ")


def old_dims(value):
    return (value[0], value[2], value[1])


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablock in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(datablock):
            datablock.remove(item)


def set_principled_input(bsdf, names, value):
    for name in names:
        socket = bsdf.inputs.get(name)
        if socket:
            socket.default_value = value
            return


def make_mat(name, color, metalness, roughness, emissive=None, emissive_strength=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        set_principled_input(bsdf, ("Base Color",), color)
        set_principled_input(bsdf, ("Metallic",), metalness)
        set_principled_input(bsdf, ("Roughness",), roughness)
        if emissive:
            set_principled_input(bsdf, ("Emission Color", "Emission"), emissive)
            set_principled_input(bsdf, ("Emission Strength",), emissive_strength)
    return material


def materials():
    return {
        "dark": make_mat("hp_vm_dark_armor", (0.025, 0.038, 0.042, 1), 0.72, 0.34),
        "gunmetal": make_mat("hp_vm_brushed_gunmetal", (0.12, 0.17, 0.17, 1), 0.86, 0.26),
        "steel": make_mat("hp_vm_worn_cool_steel", (0.62, 0.68, 0.66, 1), 0.82, 0.24),
        "rubber": make_mat("hp_vm_black_rubber", (0.008, 0.009, 0.011, 1), 0.08, 0.76),
        "panel": make_mat("hp_vm_ceramic_panel", (0.72, 0.77, 0.72, 1), 0.32, 0.46),
        "red": make_mat("hp_vm_muted_red_warning", (0.82, 0.18, 0.12, 1), 0.26, 0.32, (0.42, 0.05, 0.03, 1), 0.22),
        "amber": make_mat("hp_vm_amber_micro_inlay", (0.72, 0.56, 0.28, 1), 0.5, 0.3, (0.52, 0.34, 0.1, 1), 0.28),
        "cyan": make_mat("hp_vm_cyan_energy_window", (0.44, 0.95, 1.0, 1), 0.18, 0.18, (0.25, 0.9, 1.0, 1), 0.9),
    }


def apply_modifier(obj, modifier):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def polish(obj, bevel=0.0, segments=1):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if bevel > 0:
        mod = obj.modifiers.new("hp_viewmodel_refined_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.affect = "EDGES"
        apply_modifier(obj, mod)
    normal = obj.modifiers.new("hp_viewmodel_weighted_normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    apply_modifier(obj, normal)
    return obj


def assign(obj, material):
    obj.data.materials.append(material)
    return obj


def rounded_box(name, dims, loc, mat, rot=(0, 0, 0), bevel=0.012, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=old_loc(loc), rotation=old_rot(rot))
    obj = bpy.context.object
    obj.name = name
    obj.scale = old_dims(dims)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return polish(obj, bevel, segments)


def cyl(name, radius, depth, loc, mat, rot=(0, 0, 0), vertices=28, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=old_loc(loc), rotation=old_rot(rot))
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return polish(obj, bevel, 1)


def cone(name, radius1, radius2, depth, loc, mat, rot=(0, 0, 0), vertices=24, bevel=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=old_loc(loc), rotation=old_rot(rot))
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return polish(obj, bevel, 1)


def empty(name, loc):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.06
    obj.location = old_loc(loc)
    bpy.context.collection.objects.link(obj)
    return obj


def build_rod():
    mat = materials()
    cyl("iron_rod_main_brushed_bar", 0.073, 1.74, (0, 0.57, 0), mat["steel"], vertices=32, bevel=0.003)
    cyl("iron_rod_inner_shadow_core", 0.052, 1.69, (0.012, 0.58, -0.01), mat["gunmetal"], vertices=24, bevel=0.002)
    cyl("iron_rod_black_rubber_grip", 0.111, 0.48, (0, -0.36, 0.01), mat["rubber"], vertices=28, bevel=0.004)
    cyl("iron_rod_red_locking_collar", 0.13, 0.07, (0, -0.11, 0.01), mat["red"], vertices=28, bevel=0.004)
    cyl("iron_rod_scraped_strike_cap", 0.112, 0.3, (0, 1.52, 0), mat["panel"], vertices=32, bevel=0.004)
    cyl("iron_rod_tip_cyan_sensor", 0.045, 0.036, (0, 1.72, 0.09), mat["cyan"], rot=(math.pi / 2, 0, 0), vertices=18, bevel=0.002)

    for index, y in enumerate([-0.56, -0.44, -0.32, 0.08, 0.42, 0.98]):
        cyl(f"iron_rod_grip_band_{index}", 0.096, 0.052, (0, y, 0.012), mat["red"] if index == 4 else mat["amber"], vertices=24, bevel=0.002)

    rounded_box("iron_rod_flat_strike_face", (0.3, 0.045, 0.22), (0, 1.66, 0.01), mat["dark"], bevel=0.012)
    rounded_box("iron_rod_left_strike_jaw", (0.055, 0.2, 0.2), (-0.13, 1.58, 0.01), mat["dark"], bevel=0.012)
    rounded_box("iron_rod_right_strike_jaw", (0.055, 0.2, 0.2), (0.13, 1.58, 0.01), mat["dark"], bevel=0.012)
    rounded_box("iron_rod_raised_edge_liner", (0.04, 1.34, 0.035), (0.085, 0.62, 0.08), mat["panel"], bevel=0.008)
    rounded_box("iron_rod_offset_worn_spine", (0.035, 1.66, 0.025), (-0.12, 0.72, 0.03), mat["gunmetal"], rot=(0, 0, 0.12), bevel=0.008)
    rounded_box("iron_rod_dented_dark_plate", (0.09, 0.04, 0.08), (-0.04, 1.1, 0.09), mat["dark"], rot=(0.02, 0, 0.2), bevel=0.006)

    for index, y in enumerate([-0.59, -0.47, -0.35]):
        rounded_box(f"iron_rod_amber_inlay_{index}", (0.18 - index * 0.025, 0.018, 0.075 - index * 0.006), (0, y, 0.096), mat["amber"], bevel=0.004)
    for index, y in enumerate([0.23, 0.93]):
        rounded_box(f"iron_rod_mute_warning_wrap_{index}", (0.18, 0.028, 0.022), (-0.002, y, 0.102), mat["red"], rot=(0, 0, 0.18), bevel=0.004)

    empty("iron_rod_right_hand_grip_socket", (0, -0.36, 0.12))
    empty("iron_rod_hit_tip_socket", (0, 1.74, 0.1))
    empty("iron_rod_hit_base_socket", (0, 1.38, 0.05))
    empty("iron_rod_trail_mid_socket", (0, 0.72, 0.08))


def build_sidearm():
    mat = materials()
    rounded_box("sidearm_receiver_frame", (0.35, 0.16, 0.62), (0, 0.06, -0.12), mat["dark"], bevel=0.024)
    rounded_box("sidearm_brushed_slide", (0.37, 0.11, 0.72), (0, 0.2, -0.24), mat["panel"], bevel=0.02)
    rounded_box("sidearm_slide_top_spine", (0.2, 0.04, 0.64), (0, 0.28, -0.25), mat["gunmetal"], bevel=0.01)
    rounded_box("sidearm_barrel_shroud", (0.14, 0.12, 0.42), (0, 0.18, -0.68), mat["rubber"], bevel=0.02)
    cyl("sidearm_cyan_muzzle_core", 0.047, 0.13, (0, 0.18, -0.92), mat["cyan"], rot=(math.pi / 2, 0, 0), vertices=18, bevel=0.002)
    cyl("sidearm_muzzle_ring", 0.085, 0.04, (0, 0.18, -0.82), mat["steel"], rot=(math.pi / 2, 0, 0), vertices=24, bevel=0.003)

    rounded_box("sidearm_canted_grip", (0.16, 0.36, 0.18), (0, -0.25, 0.12), mat["rubber"], rot=(-0.22, 0, 0), bevel=0.03)
    rounded_box("sidearm_magazine_base", (0.18, 0.08, 0.2), (0, -0.45, 0.23), mat["dark"], rot=(-0.22, 0, 0), bevel=0.016)
    rounded_box("sidearm_trigger_guard", (0.2, 0.02, 0.12), (0, -0.02, -0.1), mat["rubber"], rot=(0.2, 0, 0), bevel=0.008)
    rounded_box("sidearm_trigger", (0.035, 0.08, 0.028), (0, -0.08, -0.08), mat["amber"], rot=(0.32, 0, 0), bevel=0.006)

    rounded_box("sidearm_rear_cyan_sight", (0.1, 0.035, 0.14), (0, 0.29, -0.6), mat["cyan"], bevel=0.007)
    rounded_box("sidearm_red_status_strip", (0.16, 0.04, 0.035), (0, 0.3, 0.02), mat["red"], bevel=0.007)
    rounded_box("sidearm_side_charge_window", (0.04, 0.05, 0.34), (-0.16, 0.19, -0.28), mat["cyan"], bevel=0.007)
    rounded_box("sidearm_ejection_shadow_plate", (0.12, 0.045, 0.38), (0, 0.24, -0.34), mat["dark"], bevel=0.01)
    rounded_box("sidearm_front_rail", (0.07, 0.03, 0.2), (0, 0.13, -0.02), mat["amber"], bevel=0.008)
    rounded_box("sidearm_side_micro_inlay", (0.09, 0.035, 0.12), (-0.12, 0.28, -0.02), mat["amber"], rot=(0, 0, 0.28), bevel=0.006)

    for index, x in enumerate([-0.145, 0.145]):
        rounded_box(f"sidearm_slide_side_cut_{index}", (0.035, 0.075, 0.46), (x, 0.205, -0.26), mat["gunmetal"], bevel=0.006)
    for index, z in enumerate([-0.06, 0.04, 0.14]):
        rounded_box(f"sidearm_grip_rib_{index}", (0.17, 0.018, 0.018), (0, -0.26 + index * 0.06, z), mat["gunmetal"], rot=(-0.22, 0, 0), bevel=0.004)

    empty("sidearm_muzzle_socket", (0, 0.18, -0.98))
    empty("sidearm_right_hand_grip_socket", (0, -0.22, 0.16))
    empty("sidearm_trigger_contact_socket", (0, -0.08, -0.08))


def select_exportables():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "EMPTY"}:
            obj.select_set(True)


def stats_for(asset_name, output_path):
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    materials_used = {slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}
    triangles = sum(len(poly.vertices) - 2 for obj in meshes for poly in obj.data.polygons)
    return {
        "asset": asset_name,
        "file": str(output_path.relative_to(ROOT)),
        "bytes": output_path.stat().st_size,
        "meshObjects": len(meshes),
        "materials": len(materials_used),
        "trianglesApprox": triangles,
    }


def export_asset(asset_name, build_fn, glb_path, blend_path):
    clear_scene()
    build_fn()
    glb_path.parent.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)
    select_exportables()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
    )
    report = stats_for(asset_name, glb_path)
    print(f"{asset_name}: {report['bytes']} bytes, meshes={report['meshObjects']}, materials={report['materials']}")
    return report


def main():
    reports = [
        export_asset("hp_viewmodel_iron_rod_refined", build_rod, ROD_GLB, ROD_BLEND),
        export_asset("hp_viewmodel_sidearm_refined", build_sidearm, SIDEARM_GLB, SIDEARM_BLEND),
    ]
    manifest = {
        "schema": "human-protocol/refined-viewmodel-weapons@1",
        "budget": {
            "maxBytesPerWeapon": 180_000,
            "maxMeshObjectsPerWeapon": 40,
            "maxMaterialsPerWeapon": 8,
        },
        "assets": reports,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
