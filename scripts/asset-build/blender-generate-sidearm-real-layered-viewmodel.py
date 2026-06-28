import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
INPUT_PATH = REPO_ROOT / "work" / "scripted-derived" / "viewmodel_sidearm_reference_raw_for_blender.glb"
MODEL_DIR = REPO_ROOT / "src" / "assets" / "models" / "viewmodel" / "prototypes"
BLEND_DIR = REPO_ROOT / "src" / "assets" / "source_blend" / "viewmodel"
REPORT_PATH = REPO_ROOT / "src" / "assets" / "manifests" / "reports" / "hp_viewmodel_sidearm_scripted_derived_v2_report.json"
UNOPTIMIZED_OUTPUT = REPO_ROOT / "work" / "scripted-derived" / "hp_viewmodel_sidearm_scripted_derived_v2_unoptimized.glb"

LAYER_ORDER = ["slide", "frame", "grip", "barrel", "trim", "emissive"]
MATERIAL_CONFIG = {
    "slide": {
        "name": "sidearm_layer_slide_opaque",
        "color": (0.86, 0.91, 0.88, 1.0),
        "metallic": 0.95,
        "roughness": 0.34,
        "emissive": None,
    },
    "frame": {
        "name": "sidearm_layer_frame_opaque",
        "color": (0.5, 0.56, 0.53, 1.0),
        "metallic": 0.9,
        "roughness": 0.48,
        "emissive": None,
    },
    "grip": {
        "name": "sidearm_layer_grip_opaque",
        "color": (0.34, 0.37, 0.35, 1.0),
        "metallic": 0.25,
        "roughness": 0.78,
        "emissive": None,
    },
    "barrel": {
        "name": "sidearm_layer_barrel_opaque",
        "color": (0.72, 0.78, 0.74, 1.0),
        "metallic": 0.98,
        "roughness": 0.28,
        "emissive": None,
    },
    "trim": {
        "name": "sidearm_layer_trim_opaque",
        "color": (0.86, 0.62, 0.31, 1.0),
        "metallic": 0.88,
        "roughness": 0.46,
        "emissive": None,
    },
    "emissive": {
        "name": "sidearm_layer_emissive_opaque",
        "color": (0.58, 0.92, 0.94, 1.0),
        "metallic": 0.12,
        "roughness": 0.38,
        "emissive": (0.05, 0.55, 0.62, 0.42),
    },
}


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


def empty(name, loc, parent=None, size=0.035):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = size
    obj.location = loc
    if parent:
        obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


def add_sidearm_sockets(minv, maxv, parent):
    cx = (minv.x + maxv.x) * 0.5
    cy = (minv.y + maxv.y) * 0.5
    grip_y = lerp(minv.y, maxv.y, 0.16)
    empty("sidearm_muzzle_socket", Vector((cx, cy, minv.z)), parent)
    empty("sidearm_right_hand_grip_socket", Vector((cx, grip_y, maxv.z)), parent)
    empty("sidearm_trigger_contact_socket", Vector((cx, lerp(minv.y, maxv.y, 0.36), lerp(minv.z, maxv.z, 0.46))), parent)
    empty("sidearm_grip_front_contact_socket", Vector((cx, lerp(minv.y, maxv.y, 0.25), lerp(minv.z, maxv.z, 0.56))), parent)
    empty("sidearm_grip_back_contact_socket", Vector((cx, lerp(minv.y, maxv.y, 0.08), lerp(minv.z, maxv.z, 0.74))), parent)
    empty("sidearm_heat_core_socket", Vector((minv.x, lerp(minv.y, maxv.y, 0.65), lerp(minv.z, maxv.z, 0.48))), parent)


def find_base_color_image(material):
    if not material or not material.use_nodes:
        return None
    for node in material.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            label = f"{node.name} {node.label}".lower()
            if "base" in label or "color" in label or "albedo" in label:
                return node.image
    for node in material.node_tree.nodes:
        if node.type == "TEX_IMAGE" and node.image:
            return node.image
    return None


def image_sampler(image):
    if image is None:
        return lambda _uv: (0.5, 0.5, 0.5)
    width, height = image.size
    pixels = list(image.pixels[:])

    def sample(uv):
        if width <= 0 or height <= 0 or not pixels:
            return (0.5, 0.5, 0.5)
        u = uv.x % 1.0
        v = uv.y % 1.0
        x = max(0, min(width - 1, int(u * (width - 1))))
        y = max(0, min(height - 1, int((1.0 - v) * (height - 1))))
        offset = (y * width + x) * 4
        return (pixels[offset], pixels[offset + 1], pixels[offset + 2])

    return sample


def clone_material(original, layer):
    config = MATERIAL_CONFIG[layer]
    material = original.copy() if original else bpy.data.materials.new(config["name"])
    material.name = config["name"]
    material.blend_method = "OPAQUE"
    if hasattr(material, "use_screen_refraction"):
        material.use_screen_refraction = False
    material.diffuse_color = config["color"]

    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type != "BSDF_PRINCIPLED":
                continue
            set_input(node, "Alpha", 1.0)
            set_input(node, "Metallic", config["metallic"])
            set_input(node, "Roughness", config["roughness"])
            if "Base Color" in node.inputs and not node.inputs["Base Color"].is_linked:
                set_input(node, "Base Color", config["color"])
            emissive = config["emissive"]
            if emissive:
                set_input(node, "Emission Color", (*emissive[:3], 1.0))
                set_input(node, "Emission Strength", emissive[3])
            else:
                set_input(node, "Emission Color", (0.0, 0.0, 0.0, 1.0))
                set_input(node, "Emission Strength", 0.0)
    return material


def set_input(node, name, value):
    if name in node.inputs:
        socket = node.inputs[name]
        current = getattr(socket, "default_value", None)
        if hasattr(current, "__len__") and not isinstance(current, str) and hasattr(value, "__len__"):
            socket.default_value = tuple(value[: len(current)])
        else:
            socket.default_value = value


def classify_polygon(center, color, minv, maxv):
    dimensions = maxv - minv
    x_abs = abs((center.x - (minv.x + maxv.x) * 0.5) / max(dimensions.x, 0.0001))
    y = (center.y - minv.y) / max(dimensions.y, 0.0001)
    z = (center.z - minv.z) / max(dimensions.z, 0.0001)
    r, g, b = color
    lum = (r + g + b) / 3.0
    chroma = max(r, g, b) - min(r, g, b)
    cyan_score = min(g, b) - r * 0.82
    warm_score = r * 1.05 + g * 0.55 - b * 1.35

    if cyan_score > 0.18 and b > 0.28 and g > 0.24 and chroma > 0.12:
        return "emissive"
    if warm_score > 0.46 and r > 0.36 and g > 0.2 and b < 0.32:
        return "trim"
    if z < 0.18 or (z < 0.3 and y > 0.48):
        return "barrel"
    if (z > 0.48 and y < 0.44) or (z > 0.62 and lum < 0.34):
        return "grip"
    if y > 0.56 or (z < 0.55 and y > 0.42 and x_abs < 0.35):
        return "slide"
    return "frame"


def assign_material_layers(obj, minv, maxv):
    mesh = obj.data
    original_material = obj.material_slots[0].material if obj.material_slots and obj.material_slots[0].material else None
    sampler = image_sampler(find_base_color_image(original_material))
    uv_layer = mesh.uv_layers.active.data if mesh.uv_layers.active else None

    obj.data.materials.clear()
    for layer in LAYER_ORDER:
        obj.data.materials.append(clone_material(original_material, layer))

    counts = {layer: 0 for layer in LAYER_ORDER}
    polygon_data = []
    for polygon in mesh.polygons:
        center = Vector((0.0, 0.0, 0.0))
        for vertex_index in polygon.vertices:
            center += mesh.vertices[vertex_index].co
        center /= len(polygon.vertices)

        if uv_layer:
            uv = Vector((0.0, 0.0))
            for loop_index in polygon.loop_indices:
                uv += uv_layer[loop_index].uv
            uv /= len(polygon.loop_indices)
            color = sampler(uv)
        else:
            color = (0.5, 0.5, 0.5)

        layer = classify_polygon(center, color, minv, maxv)
        polygon.material_index = LAYER_ORDER.index(layer)
        counts[layer] += 1
        polygon_data.append((polygon.index, center, color))

    enforce_minimum_layer_faces(mesh, polygon_data, counts, minv, maxv)
    return counts


def enforce_minimum_layer_faces(mesh, polygon_data, counts, minv, maxv):
    minimum_faces = 48
    dimensions = maxv - minv
    if all(counts[layer] >= minimum_faces for layer in LAYER_ORDER):
        return

    def normalized(center):
        return (
            abs((center.x - (minv.x + maxv.x) * 0.5) / max(dimensions.x, 0.0001)),
            (center.y - minv.y) / max(dimensions.y, 0.0001),
            (center.z - minv.z) / max(dimensions.z, 0.0001),
        )

    scorers = {
        "emissive": lambda center, color: min(color[1], color[2]) - color[0] * 0.8,
        "trim": lambda center, color: color[0] * 1.05 + color[1] * 0.55 - color[2] * 1.35,
        "barrel": lambda center, color: 1.0 - normalized(center)[2] + normalized(center)[1] * 0.15,
        "grip": lambda center, color: normalized(center)[2] * 0.7 + (1.0 - normalized(center)[1]) * 0.45,
        "slide": lambda center, color: normalized(center)[1] * 0.75 + (1.0 - normalized(center)[2]) * 0.15,
        "frame": lambda center, color: 0.5 - abs(normalized(center)[1] - 0.48),
    }

    for layer in LAYER_ORDER:
        if counts[layer] >= minimum_faces:
            continue
        needed = minimum_faces - counts[layer]
        current_index = LAYER_ORDER.index(layer)
        candidates = sorted(polygon_data, key=lambda item: scorers[layer](item[1], item[2]), reverse=True)
        changed = 0
        for polygon_index, _center, _color in candidates:
            polygon = mesh.polygons[polygon_index]
            old_layer = LAYER_ORDER[polygon.material_index]
            if old_layer == layer:
                continue
            if counts[old_layer] <= minimum_faces:
                continue
            counts[old_layer] -= 1
            polygon.material_index = current_index
            counts[layer] += 1
            changed += 1
            if changed >= needed:
                break


def separate_by_material(obj, root):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")

    layer_objects = {}
    for candidate in [item for item in bpy.context.scene.objects if item.type == "MESH"]:
        material_names = [slot.material.name for slot in candidate.material_slots if slot.material]
        layer = layer_from_material_names(material_names)
        if not layer:
            continue
        candidate.name = f"sidearm_{layer}_node"
        candidate.data.name = f"sidearm_{layer}_mesh"
        candidate.parent = root
        layer_objects[layer] = candidate
    return layer_objects


def layer_from_material_names(material_names):
    for layer, config in MATERIAL_CONFIG.items():
        if config["name"] in material_names:
            return layer
    return None


def select_exportables():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "EMPTY"}:
            obj.select_set(True)


def main():
    clear_scene()
    if not INPUT_PATH.exists():
        raise FileNotFoundError(INPUT_PATH)

    bpy.ops.import_scene.gltf(filepath=str(INPUT_PATH))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"expected 1 imported sidearm mesh, got {len(mesh_objects)}")

    original = mesh_objects[0]
    original.name = "sidearm_layered_unseparated_source"
    original.data.name = "sidearm_layered_unseparated_source_mesh"
    minv, maxv = bounds([original])
    counts = assign_material_layers(original, minv, maxv)

    root = empty("sidearm_layered_visual_body", Vector((0.0, 0.0, 0.0)), None, size=0.05)
    layer_objects = separate_by_material(original, root)
    add_sidearm_sockets(minv, maxv, root)

    for obj in layer_objects.values():
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
        try:
            modifier = obj.modifiers.new("viewmodel_weighted_normals", "WEIGHTED_NORMAL")
            modifier.keep_sharp = True
        except Exception:
            pass

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    UNOPTIMIZED_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    blend_path = BLEND_DIR / "hp_viewmodel_sidearm_scripted_derived_v2.blend"
    select_exportables()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(UNOPTIMIZED_OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )

    triangles = sum(len(poly.vertices) - 2 for obj in layer_objects.values() for poly in obj.data.polygons)
    vertices = sum(len(obj.data.vertices) for obj in layer_objects.values())
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "human-protocol/viewmodel-sidearm-real-layered@1",
        "asset": "sidearm_scripted_derived_v2",
        "strategy": "Classify the existing scripted-derived sidearm mesh by texture samples and geometry, assign opaque material slots, then separate by material into mesh nodes. No decorative geometry is added.",
        "input": str(INPUT_PATH.relative_to(REPO_ROOT)),
        "unoptimizedFile": str(UNOPTIMIZED_OUTPUT.relative_to(REPO_ROOT)),
        "targetFile": str((MODEL_DIR / "hp_viewmodel_sidearm_scripted_derived_v2.glb").relative_to(REPO_ROOT)),
        "sourceBlend": str(blend_path.relative_to(REPO_ROOT)),
        "trianglesApprox": triangles,
        "verticesApprox": vertices,
        "materialFaceCounts": counts,
        "meshNodes": sorted(obj.name for obj in layer_objects.values()),
        "boundsMin": [round(value, 5) for value in minv],
        "boundsMax": [round(value, 5) for value in maxv],
        "dimensions": [round(value, 5) for value in (maxv - minv)],
        "sockets": [obj.name for obj in bpy.context.scene.objects if obj.type == "EMPTY" and obj.name.startswith("sidearm_")],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
