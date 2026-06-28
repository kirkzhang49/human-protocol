import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
INTAKE_DIR = REPO_ROOT / "work" / "reference-intake" / "missile-01b33faf-5883-4e91-9413-9fcb684c2a7a"
DERIVED_DIR = REPO_ROOT / "work" / "scripted-derived" / "missile-01b33faf-5883-4e91-9413-9fcb684c2a7a"

INPUT_GLB = INTAKE_DIR / "missile_01b33faf_decoded.glb"
SOURCE_TEXTURE = INTAKE_DIR / "missile_01b33faf_basecolor_4096.jpg"
OUTPUT_BLEND = DERIVED_DIR / "missile_01b33faf_reference_reverse.blend"
OUTPUT_GLB = DERIVED_DIR / "missile_01b33faf_reference_reverse.glb"
REPORT_PATH = DERIVED_DIR / "missile_01b33faf_reference_reverse_report.json"


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


def empty(name, loc, display_size=0.045):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = display_size
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def make_material(mesh):
    material = bpy.data.materials.new("missile_reference_basecolor_opaque")
    material.use_nodes = True
    material.diffuse_color = (0.72, 0.78, 0.76, 1.0)
    bsdf = next((node for node in material.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if bsdf and SOURCE_TEXTURE.exists():
        image = bpy.data.images.load(str(SOURCE_TEXTURE), check_existing=False)
        image.name = "missile_01b33faf_basecolor_4096"
        image.filepath = str(SOURCE_TEXTURE)
        tex = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = image
        material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.0
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.88
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = 1.0
    mesh.data.materials.clear()
    mesh.data.materials.append(material)


def add_reverse_sockets(minv, maxv):
    cx = (minv.x + maxv.x) * 0.5
    cy = (minv.y + maxv.y) * 0.5
    cz = (minv.z + maxv.z) * 0.5
    dims = maxv - minv
    radius = max(dims.x, dims.z) * 0.5
    major_axis = max(range(3), key=lambda index: dims[index])

    def along_major(value):
        loc = Vector((cx, cy, cz))
        loc[major_axis] = value
        return loc

    min_major = minv[major_axis]
    max_major = maxv[major_axis]

    empty("missile_center_socket", Vector((cx, cy, cz)))
    empty("missile_nose_socket", along_major(max_major))
    empty("missile_tail_socket", along_major(min_major))
    empty("missile_exhaust_vfx_socket", along_major(min_major - radius * 0.18))
    empty("missile_pickup_hover_socket", Vector((cx, cy, maxv.z + radius * 0.22)))
    empty("missile_collision_proxy_half_extents", Vector((dims.x * 0.5, dims.y * 0.5, dims.z * 0.5)), 0.03)
    return major_axis


def select_exportables():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "EMPTY"}:
            obj.select_set(True)


def main():
    if not INPUT_GLB.exists():
        raise FileNotFoundError(INPUT_GLB)
    DERIVED_DIR.mkdir(parents=True, exist_ok=True)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(INPUT_GLB))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"Expected 1 imported missile mesh, got {len(mesh_objects)}")

    mesh = mesh_objects[0]
    mesh.name = "missile_reference_body"
    mesh.data.name = "missile_reference_body_mesh"
    make_material(mesh)

    minv, maxv = bounds(mesh_objects)
    major_axis = add_reverse_sockets(minv, maxv)

    select_exportables()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
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
    report = {
        "schema": "human-protocol/missile-reference-reverse@1",
        "asset": "missile_01b33faf",
        "strategy": "Import decoded reference GLB into Blender, extract embedded baseColor texture, add named sockets and collision proxy metadata for later procedural rebuild.",
        "inputGlb": str(INPUT_GLB.relative_to(REPO_ROOT)),
        "sourceTexture": str(SOURCE_TEXTURE.relative_to(REPO_ROOT)),
        "sourceBlend": str(OUTPUT_BLEND.relative_to(REPO_ROOT)),
        "derivedGlb": str(OUTPUT_GLB.relative_to(REPO_ROOT)),
        "meshObjects": len(mesh_objects),
        "vertices": vertices,
        "triangles": triangles,
        "boundsMin": [round(value, 5) for value in minv],
        "boundsMax": [round(value, 5) for value in maxv],
        "dimensions": [round(value, 5) for value in (maxv - minv)],
        "majorAxisBlender": ["x", "y", "z"][major_axis],
        "materials": [slot.material.name for slot in mesh.material_slots if slot.material],
        "sockets": [obj.name for obj in bpy.context.scene.objects if obj.type == "EMPTY"],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
