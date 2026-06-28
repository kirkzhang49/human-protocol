#!/usr/bin/env python3
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
ENEMY_ROOT = ROOT / "src" / "assets" / "models" / "enemies"

ENEMY_GLB_FILES = [
    "hp_enemy_repair_drone_horror.glb",
    "hp_enemy_clamp_repair_horror.glb",
    "hp_enemy_shield_technician_horror.glb",
    "hp_enemy_custodian_foreman_horror.glb",
    "hp_enemy_reclamation_mother_final_horror.glb",
]


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def set_principled_input(material, names, value):
    if not material.use_nodes or not material.node_tree:
        return
    node = material.node_tree.nodes.get("Principled BSDF")
    if not node:
        return
    for name in names:
        socket = node.inputs.get(name)
        if socket:
            socket.default_value = value


def polish_materials():
    for material in bpy.data.materials:
        name = material.name.lower()
        material.use_nodes = True
        material.diffuse_color = material.diffuse_color
        if "rubber" in name or "black" in name:
            set_principled_input(material, ["Metallic"], 0.18)
            set_principled_input(material, ["Roughness"], 0.56)
        elif "body" in name or "off_white" in name:
            set_principled_input(material, ["Metallic"], 0.64)
            set_principled_input(material, ["Roughness"], 0.34)
        elif "gunmetal" in name or "dark" in name:
            set_principled_input(material, ["Metallic"], 0.86)
            set_principled_input(material, ["Roughness"], 0.28)
        elif "warning" in name or "amber" in name:
            set_principled_input(material, ["Metallic"], 0.72)
            set_principled_input(material, ["Roughness"], 0.32)
            set_principled_input(material, ["Emission Color"], (0.9, 0.46, 0.14, 1.0))
            set_principled_input(material, ["Emission Strength"], 0.22)
        elif "cyan" in name or "scanner" in name or "core" in name:
            set_principled_input(material, ["Metallic"], 0.62)
            set_principled_input(material, ["Roughness"], 0.22)
            set_principled_input(material, ["Emission Color"], (0.32, 0.94, 1.0, 1.0))
            set_principled_input(material, ["Emission Strength"], 0.65)


def bevel_width_for(obj):
    name = obj.name.lower()
    if "drone" in name or "needle" in name or "probe" in name:
        return 0.004
    if "hand" in name or "wrench" in name or "cutter" in name:
        return 0.008
    return 0.006


def polish_meshes():
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for poly in obj.data.polygons:
            poly.use_smooth = True

        bevel = obj.modifiers.new(name="hp_asset_edge_bevel_v2", type="BEVEL")
        bevel.width = bevel_width_for(obj)
        bevel.segments = 1
        bevel.affect = "EDGES"
        bevel.harden_normals = True
        try:
            bevel.limit_method = "ANGLE"
            bevel.angle_limit = 0.42
        except Exception:
            pass
        try:
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        except Exception as exc:
            print(f"warning: bevel skipped for {obj.name}: {exc}")
            obj.modifiers.remove(bevel)

        weighted = obj.modifiers.new(name="hp_weighted_normals_v2", type="WEIGHTED_NORMAL")
        weighted.keep_sharp = True
        weighted.weight = 65
        try:
            bpy.ops.object.modifier_apply(modifier=weighted.name)
        except Exception as exc:
            print(f"warning: weighted normal skipped for {obj.name}: {exc}")
            obj.modifiers.remove(weighted)


def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_animations=True,
        export_yup=True,
    )


def polish_file(file_name):
    path = ENEMY_ROOT / file_name
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    polish_materials()
    polish_meshes()
    export_glb(path)
    print(f"blender polished {file_name}")


for file_name in ENEMY_GLB_FILES:
    polish_file(file_name)

