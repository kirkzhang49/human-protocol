import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
WORK_DIR = REPO_ROOT / "work" / "scripted-derived"
MODEL_DIR = REPO_ROOT / "src" / "assets" / "models" / "viewmodel" / "prototypes"
BLEND_DIR = REPO_ROOT / "src" / "assets" / "source_blend" / "viewmodel"
REPORT_PATH = REPO_ROOT / "src" / "assets" / "manifests" / "reports" / "hp_viewmodel_scripted_derived_report.json"


ASSETS = [
    {
        "id": "iron_rod",
        "input": WORK_DIR / "viewmodel_iron_rod_reference_raw_for_blender.glb",
        "output": MODEL_DIR / "hp_viewmodel_iron_rod_scripted_derived.glb",
        "blend": BLEND_DIR / "hp_viewmodel_iron_rod_scripted_derived.blend",
        "meshName": "iron_rod_scripted_derived_visual_body",
        "socketPrefix": "iron_rod",
    },
    {
        "id": "sidearm",
        "input": WORK_DIR / "viewmodel_sidearm_reference_raw_for_blender.glb",
        "output": MODEL_DIR / "hp_viewmodel_sidearm_scripted_derived.glb",
        "blend": BLEND_DIR / "hp_viewmodel_sidearm_scripted_derived.blend",
        "meshName": "sidearm_scripted_derived_visual_body",
        "socketPrefix": "sidearm",
    },
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablock in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(datablock):
            datablock.remove(item)


def bounds(objects):
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            minv.x = min(minv.x, world.x)
            minv.y = min(minv.y, world.y)
            minv.z = min(minv.z, world.z)
            maxv.x = max(maxv.x, world.x)
            maxv.y = max(maxv.y, world.y)
            maxv.z = max(maxv.z, world.z)
    return minv, maxv


def lerp(low, high, amount):
    return low + (high - low) * amount


def empty(name, loc):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.035
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def add_rod_sockets(minv, maxv):
    cx = (minv.x + maxv.x) * 0.5
    cz = (minv.z + maxv.z) * 0.5
    front_z = maxv.z
    empty("iron_rod_right_hand_grip_socket", Vector((cx, lerp(minv.y, maxv.y, 0.18), front_z)))
    empty("iron_rod_hit_tip_socket", Vector((cx, maxv.y, front_z)))
    empty("iron_rod_hit_base_socket", Vector((cx, lerp(minv.y, maxv.y, 0.74), front_z)))
    empty("iron_rod_trail_start_socket", Vector((cx, lerp(minv.y, maxv.y, 0.28), front_z)))
    empty("iron_rod_trail_mid_socket", Vector((cx, lerp(minv.y, maxv.y, 0.58), front_z)))
    empty("iron_rod_trail_end_socket", Vector((cx, lerp(minv.y, maxv.y, 0.88), front_z)))
    empty("iron_rod_emissive_core_socket", Vector((cx, lerp(minv.y, maxv.y, 0.55), front_z)))


def add_sidearm_sockets(minv, maxv):
    cx = (minv.x + maxv.x) * 0.5
    cy = (minv.y + maxv.y) * 0.5
    grip_y = lerp(minv.y, maxv.y, 0.16)
    empty("sidearm_muzzle_socket", Vector((cx, cy, minv.z)))
    empty("sidearm_right_hand_grip_socket", Vector((cx, grip_y, maxv.z)))
    empty("sidearm_trigger_contact_socket", Vector((cx, lerp(minv.y, maxv.y, 0.36), lerp(minv.z, maxv.z, 0.46))))
    empty("sidearm_grip_front_contact_socket", Vector((cx, lerp(minv.y, maxv.y, 0.25), lerp(minv.z, maxv.z, 0.56))))
    empty("sidearm_grip_back_contact_socket", Vector((cx, lerp(minv.y, maxv.y, 0.08), lerp(minv.z, maxv.z, 0.74))))
    empty("sidearm_heat_core_socket", Vector((minv.x, lerp(minv.y, maxv.y, 0.65), lerp(minv.z, maxv.z, 0.48))))


def select_exportables():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "EMPTY"}:
            obj.select_set(True)


def derive_asset(config):
    clear_scene()
    if not config["input"].exists():
        raise FileNotFoundError(config["input"])

    bpy.ops.import_scene.gltf(filepath=str(config["input"]))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"{config['id']}: expected 1 imported mesh, got {len(mesh_objects)}")

    mesh = mesh_objects[0]
    mesh.name = config["meshName"]
    mesh.data.name = f"{config['meshName']}_mesh"
    for slot in mesh.material_slots:
        if slot.material:
            slot.material.name = f"{config['id']}_scripted_reference_texture_material"

    minv, maxv = bounds(mesh_objects)
    if config["id"] == "iron_rod":
        add_rod_sockets(minv, maxv)
    else:
        add_sidearm_sockets(minv, maxv)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    config["blend"].parent.mkdir(parents=True, exist_ok=True)
    select_exportables()
    bpy.ops.wm.save_as_mainfile(filepath=str(config["blend"]))
    bpy.ops.export_scene.gltf(
        filepath=str(config["output"]),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )

    triangles = sum(len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons)
    vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    materials = sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material})
    report = {
        "asset": config["id"],
        "strategy": "scripted-derived visual mesh: meshopt source decoded, simplified, imported into Blender only for sockets and handoff source.",
        "input": str(config["input"].relative_to(REPO_ROOT)),
        "file": str(config["output"].relative_to(REPO_ROOT)),
        "sourceBlend": str(config["blend"].relative_to(REPO_ROOT)),
        "bytes": config["output"].stat().st_size,
        "meshObjects": len(mesh_objects),
        "materials": materials,
        "verticesApprox": vertices,
        "trianglesApprox": triangles,
        "boundsMin": [round(value, 5) for value in minv],
        "boundsMax": [round(value, 5) for value in maxv],
        "dimensions": [round(value, 5) for value in (maxv - minv)],
        "sockets": [obj.name for obj in bpy.context.scene.objects if obj.type == "EMPTY"],
    }
    print(f"{config['id']}: {report['bytes']} bytes, triangles={triangles}, vertices={vertices}")
    return report


def main():
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    reports = [derive_asset(config) for config in ASSETS]
    REPORT_PATH.write_text(
        json.dumps(
            {
                "schema": "human-protocol/viewmodel-scripted-derived@1",
                "assets": reports,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
