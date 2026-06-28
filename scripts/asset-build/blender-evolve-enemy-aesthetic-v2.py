#!/usr/bin/env python3
import json
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
ENEMY_ROOT = ROOT / "src" / "assets" / "models" / "enemies"
REPORT_PATH = ROOT / "src" / "assets" / "manifests" / "human_protocol_enemy_aesthetic_objective_v2_report.json"
OUTPUT_REPORT_PATH = ROOT / "src" / "assets" / "manifests" / "human_protocol_enemy_blender_evolution_v2_report.json"

TARGET_FILES = {
    "hp_enemy_repair_drone_horror": "hp_enemy_repair_drone_horror.glb",
    "hp_enemy_clamp_repair_horror": "hp_enemy_clamp_repair_horror.glb",
    "hp_enemy_shield_technician_horror": "hp_enemy_shield_technician_horror.glb",
    "hp_enemy_custodian_foreman_horror": "hp_enemy_custodian_foreman_horror.glb",
    "hp_enemy_reclamation_mother_final_horror": "hp_enemy_reclamation_mother_final_horror.glb",
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def obj(name):
    return bpy.data.objects.get(name)


def set_transform(name, location=None, rotation=None, scale=None):
    item = obj(name)
    if not item:
        return False
    if location is not None:
        item.location = location
    if rotation is not None:
        item.rotation_euler = rotation
    if scale is not None:
        item.scale = scale
    return True


def scale_matching(fragment, scale):
    count = 0
    for item in bpy.data.objects:
        if fragment not in item.name:
            continue
        item.scale = scale
        count += 1
    return count


def create_material(name, color, metallic=0.7, roughness=0.34, emission=None, emission_strength=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    node = material.node_tree.nodes.get("Principled BSDF")
    if node:
        set_input(node, ["Base Color"], color)
        set_input(node, ["Metallic"], metallic)
        set_input(node, ["Roughness"], roughness)
        if emission is not None:
            set_input(node, ["Emission Color"], emission)
            set_input(node, ["Emission Strength"], emission_strength)
    return material


def set_input(node, names, value):
    for name in names:
        socket = node.inputs.get(name)
        if socket:
            socket.default_value = value
            return True
    return False


def polish_materials(params):
    core_emit = float(params.get("coreEmit", 0.74))
    metal = float(params.get("metal", 0.76))
    rough = float(params.get("rough", 0.38))
    for material in bpy.data.materials:
        name = material.name.lower()
        material.use_nodes = True
        node = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
        if not node:
            continue
        if "body" in name or "off_white" in name:
            set_input(node, ["Base Color"], (0.61, 0.69, 0.67, 1))
            set_input(node, ["Metallic"], min(0.86, metal))
            set_input(node, ["Roughness"], min(0.5, rough + 0.04))
            set_input(node, ["Emission Strength"], 0.035)
            set_input(node, ["Emission Color"], (0.02, 0.055, 0.05, 1))
        elif "dark" in name or "gunmetal" in name:
            set_input(node, ["Base Color"], (0.075, 0.105, 0.115, 1))
            set_input(node, ["Metallic"], min(0.92, metal + 0.08))
            set_input(node, ["Roughness"], max(0.25, rough - 0.04))
            set_input(node, ["Emission Strength"], 0.025)
            set_input(node, ["Emission Color"], (0.005, 0.025, 0.025, 1))
        elif "core" in name or "scanner" in name or "cyan" in name:
            set_input(node, ["Base Color"], (0.42, 1.0, 0.86, 1))
            set_input(node, ["Metallic"], min(0.82, metal))
            set_input(node, ["Roughness"], max(0.22, rough - 0.08))
            set_input(node, ["Emission Color"], (0.18, 0.92, 0.72, 1))
            set_input(node, ["Emission Strength"], min(0.92, max(0.48, core_emit)))
        elif "warning" in name or "amber" in name:
            set_input(node, ["Base Color"], (0.78, 0.58, 0.28, 1))
            set_input(node, ["Metallic"], min(0.82, metal))
            set_input(node, ["Roughness"], rough)
            set_input(node, ["Emission Color"], (0.5, 0.26, 0.08, 1))
            set_input(node, ["Emission Strength"], 0.2 + 0.16 * float(params.get("amberAccent", 0.28)))
        elif "rubber" in name:
            set_input(node, ["Base Color"], (0.01, 0.014, 0.015, 1))
            set_input(node, ["Metallic"], 0.12)
            set_input(node, ["Roughness"], 0.68)


def add_cube(name, location, scale, material, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    item = bpy.context.object
    item.name = name
    item.scale = scale
    item.data.materials.append(material)
    item.data.name = f"{name}_mesh"
    if bevel > 0:
        mod = item.modifiers.new(name="hp_v2_soft_bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = 1
        mod.harden_normals = True
        bpy.ops.object.select_all(action="DESELECT")
        item.select_set(True)
        bpy.context.view_layer.objects.active = item
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
        normal = item.modifiers.new(name="hp_v2_weighted_normals", type="WEIGHTED_NORMAL")
        normal.keep_sharp = True
        try:
            bpy.ops.object.modifier_apply(modifier=normal.name)
        except Exception:
            pass
    return item


def add_cylinder(name, location, radius, depth, material, rotation=(0, 0, 0), vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    item = bpy.context.object
    item.name = name
    item.data.name = f"{name}_mesh"
    item.data.materials.append(material)
    for poly in item.data.polygons:
        poly.use_smooth = True
    normal = item.modifiers.new(name="hp_v2_weighted_normals", type="WEIGHTED_NORMAL")
    try:
        bpy.ops.object.select_all(action="DESELECT")
        item.select_set(True)
        bpy.context.view_layer.objects.active = item
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        pass
    return item


def add_torus(name, location, major, minor, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=36,
        minor_segments=8,
        major_radius=major,
        minor_radius=minor,
        location=location,
        rotation=rotation,
    )
    item = bpy.context.object
    item.name = name
    item.data.name = f"{name}_mesh"
    item.data.materials.append(material)
    for poly in item.data.polygons:
        poly.use_smooth = True
    return item


def evolve_repair_drone(params, materials):
    arm = params["armThickness"]
    hand = params["handScale"]
    set_transform("torso_control", location=(0, 1.36, 0), scale=(params["torsoX"], params["torsoY"], params["torsoZ"]))
    set_transform("part_head", location=(0, 1.7, -0.02), scale=(params["headScale"], params["headScale"] * 0.88, params["headScale"]))
    set_transform("part_backpack", location=(0, 1.28, -0.5), scale=(params["torsoX"] * 0.88, 0.42, params["backpackZ"]))
    set_transform("leftShoulderPivot", location=(-params["shoulderSpread"], params["shoulderHeight"], 0.08), rotation=(0, 0, -params["shoulderRoll"]))
    set_transform("rightShoulderPivot", location=(params["shoulderSpread"], params["shoulderHeight"], 0.08), rotation=(0, 0, params["shoulderRoll"]))
    for suffix in ("l", "r"):
        set_transform(f"part_arm_{suffix}", scale=(arm, 0.24, arm * 1.04))
        set_transform(f"part_forearm_{suffix}", location=(0, -params["forearmLength"], 0.08), scale=(arm, params["forearmLength"], arm * 1.08))
        set_transform(f"part_hand_{suffix}", scale=(hand, hand, hand))
    set_transform("pelvisPivot", location=(0, 1.04, -0.22), scale=(params["pelvisScale"], params["pelvisScale"], params["pelvisScale"]))
    set_transform("drone_red_core_ring", scale=(params["coreScale"], params["coreScale"], params["coreScale"]))
    set_transform("stun-probe", location=(0, 0.94, 0.52), rotation=(math.pi / 2, 0, 0), scale=(params["probeScale"], params["probeScale"] * 0.82, params["probeScale"]))
    for side, x in (("left", -params["shoulderSpread"] * 1.06), ("right", params["shoulderSpread"] * 1.06)):
        add_torus(f"hp_v2_{side}_side_turbine_ring", (x, 1.47, 0.08), 0.115, 0.012, materials["dark"], rotation=(0, math.pi / 2, 0))
        add_cylinder(f"hp_v2_{side}_side_turbine_core", (x, 1.47, 0.08), 0.055, 0.04, materials["core"], rotation=(0, math.pi / 2, 0), vertices=24)
        add_cube(f"hp_v2_{side}_turbine_blade_a", (x, 1.47, 0.08), (0.006, 0.105, 0.012), materials["core"], bevel=0.002)
        add_cube(f"hp_v2_{side}_turbine_blade_b", (x, 1.47, 0.08), (0.006, 0.012, 0.105), materials["core"], bevel=0.002)
        add_cube(f"hp_v2_{side}_thin_spar", (x * 0.52, 1.47, 0.08), (abs(x) * 0.42, 0.018, 0.018), materials["dark"], bevel=0.003)


def evolve_clamp_robot(params):
    set_transform("torso_control", location=(0, 1.7, 0), scale=(params["torsoX"], params["torsoY"], params["torsoZ"]))
    set_transform("leftShoulderPivot", location=(-params["shoulderSpread"], 1.72, 0.05))
    set_transform("rightShoulderPivot", location=(params["shoulderSpread"], 1.72, 0.05))
    for suffix in ("l", "r"):
        set_transform(f"part_arm_{suffix}", scale=(params["armScale"], 0.82, params["armScale"] * 0.84))
        set_transform(f"part_forearm_{suffix}", scale=(params["forearmScale"], 0.92, params["forearmScale"] * 0.84))
        set_transform(f"part_leg_{suffix}", scale=(params["legScale"], 0.7, params["legScale"] * 0.84))
        set_transform(f"part_foot_{suffix}", scale=(params["footScale"], params["footScale"] * 0.78, params["footScale"] * 0.86))
    hand_scale = params["handScale"] * 0.42
    set_transform("left-utility-hand", scale=(hand_scale, hand_scale * 0.72, hand_scale * 0.88))
    set_transform("right-utility-hand", scale=(hand_scale, hand_scale * 0.72, hand_scale * 0.88))
    set_transform("service-cutter", scale=(params["toolScale"], 0.84, params["toolScale"] * 0.86))


def evolve_shield_technician(params, materials):
    set_transform("torso_control", scale=(params["torsoX"], params["torsoY"], params["torsoZ"]))
    set_transform("leftShoulderPivot", location=(-params["shoulderSpread"], 1.68, 0.05))
    set_transform("rightShoulderPivot", location=(params["shoulderSpread"], 1.68, 0.05))
    for suffix in ("l", "r"):
        set_transform(f"part_arm_{suffix}", scale=(params["armScale"], 0.82, params["armScale"] * 0.88))
        set_transform(f"part_forearm_{suffix}", scale=(params["forearmScale"], 0.88, params["forearmScale"] * 0.86))
        set_transform(f"part_foot_{suffix}", scale=(params["footScale"], params["footScale"] * 0.8, params["footScale"] * 0.84))
    set_transform("left-utility-hand", scale=(params["handScale"], params["handScale"] * 0.9, params["handScale"]))
    set_transform("right-utility-hand", scale=(params["handScale"], params["handScale"] * 0.9, params["handScale"]))
    scale_matching("shield_left_black_panel", (params["shieldScale"], params["shieldScale"], params["shieldScale"]))
    scale_matching("shield_right_black_panel", (params["shieldScale"], params["shieldScale"], params["shieldScale"]))
    scale_matching("rescue-baton", (params["batonScale"], params["batonScale"], params["batonScale"]))
    for side, x in (("left", -0.55), ("right", 0.55)):
        add_cube(f"hp_v2_{side}_shield_upper_rim_light", (x, 1.45, 0.46), (0.26, 0.018, 0.012), materials["core"], bevel=0.002)
        add_cube(f"hp_v2_{side}_shield_outer_rim_light", (x * 1.05, 1.23, 0.46), (0.014, 0.22, 0.012), materials["core"], bevel=0.002)


def evolve_hammer_boss(params, materials, final_boss=False):
    set_transform("torso_control", scale=(params["torsoX"], params["torsoY"], params["torsoZ"]))
    for suffix in ("l", "r"):
        set_transform(f"part_leg_{suffix}", scale=(params["legScale"], 1.0, params["legScale"] * 0.86))
        set_transform(f"part_foot_{suffix}", scale=(params["footX"], params["footY"], params["footZ"]))
    set_transform("left-utility-hand", scale=(params["handScale"], params["handScale"] * 0.9, params["handScale"]))
    set_transform("right-utility-hand", scale=(params["handScale"], params["handScale"] * 0.9, params["handScale"]))
    set_transform("utility-wrench", location=(0.9, 0.8, -0.48), rotation=(0.15, -0.12, -0.72), scale=(params["hammerLength"], params["hammerLength"] * 0.8, params["hammerLength"]))
    set_transform("utility-wrench-handle", scale=(0.72, params["hammerLength"] * 1.35, 0.72))
    shoulder = params.get("shoulderArmor", 0.75)
    for side, x in (("left", -0.72), ("right", 0.72)):
        add_cube(f"hp_v2_{side}_hammer_boss_shoulder_armor", (x, 2.05, 0.0), (0.34 * shoulder, 0.12, 0.28 * shoulder), materials["dark"], bevel=0.018)
    add_cube(
        "hp_v2_service_hammer_handle",
        (0.9, 0.82, -0.48),
        (0.035, params["hammerLength"] * 0.54, 0.035),
        materials["dark"],
        rotation=(0.14, -0.08, -0.72),
        bevel=0.008,
    )
    add_cube(
        "hp_v2_service_hammer_head",
        (1.08, 1.18, -0.6),
        (params["hammerHead"] * 0.24, params["hammerHead"] * 0.12, params["hammerHead"] * 0.16),
        materials["warning"],
        rotation=(0.14, -0.08, -0.72),
        bevel=0.014,
    )
    add_cube(
        "hp_v2_service_hammer_cyan_load_cell",
        (1.08, 1.18, -0.46),
        (params["hammerHead"] * 0.16, 0.012, 0.014),
        materials["core"],
        rotation=(0.14, -0.08, -0.72),
        bevel=0.002,
    )
    if final_boss:
        scale_matching("mother_identity_panel_", (params["identityScale"], params["identityScale"], params["identityScale"]))
        scale_matching("mother_archive_spine", (params["spineScale"], params["spineScale"], params["spineScale"]))


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_animations=True,
        export_yup=True,
        export_apply=False,
    )


def evolve_one(target_id, params):
    file_path = ENEMY_ROOT / TARGET_FILES[target_id]
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(file_path))
    materials = {
        "core": create_material("hp_v2_restrained_cyan_green_emissive", (0.3, 1.0, 0.78, 1), 0.5, 0.22, (0.18, 0.9, 0.68, 1), max(0.42, min(0.82, params.get("coreEmit", 0.74)))),
        "dark": create_material("hp_v2_smoked_gunmetal", (0.035, 0.055, 0.06, 1), 0.86, 0.32),
        "warning": create_material("hp_v2_muted_service_hammer_amber", (0.68, 0.48, 0.22, 1), 0.78, 0.34, (0.42, 0.2, 0.06, 1), 0.22),
    }
    polish_materials(params)
    if target_id == "hp_enemy_repair_drone_horror":
        evolve_repair_drone(params, materials)
    elif target_id == "hp_enemy_clamp_repair_horror":
        evolve_clamp_robot(params)
    elif target_id == "hp_enemy_shield_technician_horror":
        evolve_shield_technician(params, materials)
    elif target_id == "hp_enemy_custodian_foreman_horror":
        evolve_hammer_boss(params, materials, False)
    elif target_id == "hp_enemy_reclamation_mother_final_horror":
        evolve_hammer_boss(params, materials, True)
    export_glb(file_path)
    return {
        "targetId": target_id,
        "file": str(file_path.relative_to(ROOT)),
        "objectCount": len(bpy.data.objects),
        "materialCount": len(bpy.data.materials),
        "appliedCandidate": {key: round(value, 4) if isinstance(value, float) else value for key, value in params.items()},
    }


def main():
    source = json.loads(REPORT_PATH.read_text())
    outputs = []
    for target in source["targets"]:
        target_id = target["id"]
        if target_id not in TARGET_FILES:
            continue
        outputs.append(evolve_one(target_id, target["bestBalanced"]["candidate"]))
        print(f"blender evolved {target_id}")
    OUTPUT_REPORT_PATH.write_text(
        json.dumps(
            {
                "schema": "human-protocol/enemy-blender-evolution-v2-report@1",
                "generatedAt": source["generatedAt"],
                "sourceReport": "src/assets/manifests/reports/human_protocol_enemy_aesthetic_objective_v2_report.json",
                "applied": True,
                "targets": outputs,
                "notes": [
                    "Flying drone receives thin arm parameters and side turbine/spar geometry.",
                    "Core/scanner glow is reduced toward user-appeal candidates.",
                    "Shield technician receives small rim-light strips rather than a full glowing shield.",
                    "Foreman and final boss receive service hammer geometry and smaller blocky feet targets.",
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )


if __name__ == "__main__":
    main()
