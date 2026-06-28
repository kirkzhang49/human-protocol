#!/usr/bin/env python3
import importlib.util
import hashlib
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
INTAKE_DIR = REPO_ROOT / "work" / "asset-intake" / "level05-reclamation-mother-v1"
SOURCE_GLB = INTAKE_DIR / "reclamation_mother_source_decoded.glb"
IRON_ROD_GLB = REPO_ROOT / "src" / "assets" / "models" / "viewmodel" / "prototypes" / "hp_viewmodel_iron_rod_production.glb"
OUTPUT_DIR = INTAKE_DIR / "derived"
OUTPUT_GLB = OUTPUT_DIR / "hp_enemy_reclamation_mother_stitch_articulated_v4_front_fill.glb"
OUTPUT_BLEND = OUTPUT_DIR / "hp_enemy_reclamation_mother_stitch_articulated_v4_front_fill.blend"
OUTPUT_PREVIEW = OUTPUT_DIR / "hp_enemy_reclamation_mother_stitch_articulated_v4_front_fill_preview.png"
REPORT_PATH = INTAKE_DIR / "reclamation_mother_stitch_articulated_v4_front_fill_report.json"
IMAGE2_ATLAS_SOURCE_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1.png"
IMAGE2_ATLAS_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1_runtime_1024.png"
IMAGE2_ATLAS_REGIONS_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1.regions.json"
IMAGE2_ATLAS_CONTACT_SHEET = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1_regions_contact_sheet.png"
IMAGE2_ATLAS_ROUGHNESS_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1_roughness_v1_runtime_1024.png"
IMAGE2_ATLAS_METALLIC_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1_metallic_v1_runtime_1024.png"
IMAGE2_ATLAS_NORMAL_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1_normal_v1_runtime_1024.png"
IMAGE2_ATLAS_OCCLUSION_PATH = INTAKE_DIR / "image2-sources" / "reclamation_mother_black_metal_image2_atlas_v1_occlusion_v1_runtime_1024.png"
IMAGE2_SOURCE_CACHE = Path("/Users/zhengkaizhang/.codex/generated_images/019f080f-434b-7c01-a3d3-558760ca1679/ig_06bd023061efe8f2016a40b8cacdec819ab5e5cedc698cde13.png")
IMAGE2_TEXTURE_PROVENANCE_PATH = INTAKE_DIR / "reclamation_mother_black_metal_image2_source_provenance.json"
SCRIPTED_BAKE_DIR = INTAKE_DIR / "textures" / "reclamation_mother_polish_bake_v2"
SCRIPTED_ARMOR_ALBEDO_PATH = SCRIPTED_BAKE_DIR / "reclamation_mother_white_armor_micro_wear_bake_v2_color.png"
SCRIPTED_ARMOR_ROUGHNESS_PATH = SCRIPTED_BAKE_DIR / "reclamation_mother_white_armor_micro_wear_bake_v2_roughness.png"
SCRIPTED_ARMOR_NORMAL_PATH = SCRIPTED_BAKE_DIR / "reclamation_mother_white_armor_micro_wear_bake_v2_normal.png"
SCRIPTED_SHADOW_ALBEDO_PATH = SCRIPTED_BAKE_DIR / "reclamation_mother_shadow_armor_micro_wear_bake_v2_color.png"
SCRIPTED_TRIM_ALBEDO_PATH = SCRIPTED_BAKE_DIR / "reclamation_mother_warm_trim_edge_wear_bake_v2_color.png"

TARGET_HEIGHT_METERS = 2.75
DECIMATE_RATIO = 0.30
GAP_FILL_SHELL_SCALE = 0.986
SEAM_BACKING_DEPTH_METERS = 0.014
SCRIPTED_BAKE_SIZE = 512
IMAGE2_BLACK_METAL_PROMPT = (
    "Create a premium sci-fi black metal material atlas for a boss robot's black torso "
    "and inner frame panels: smoked graphite armor, black brushed titanium, dark rubber "
    "gasket strips, subtle gunmetal scratches, tiny edge wear, restrained cyan-blue micro "
    "emissive grooves, and small warm brass worn edges. No text, logos, watermark, UI, "
    "character, or scene; suitable as UV texture on black mesh panels."
)


BASE_SCRIPT = Path(__file__).with_name("build-level05-reclamation-mother-rig.py")
spec = importlib.util.spec_from_file_location("reclamation_rig_base", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def bbox_mesh_data(obj):
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    for vertex in obj.data.vertices:
        co = vertex.co
        minv.x = min(minv.x, co.x)
        minv.y = min(minv.y, co.y)
        minv.z = min(minv.z, co.z)
        maxv.x = max(maxv.x, co.x)
        maxv.y = max(maxv.y, co.y)
        maxv.z = max(maxv.z, co.z)
    return minv, maxv


def file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_or_absolute(path):
    path = Path(path)
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def load_image2_regions():
    if not IMAGE2_ATLAS_REGIONS_PATH.exists():
        return {}
    payload = json.loads(IMAGE2_ATLAS_REGIONS_PATH.read_text(encoding="utf-8"))
    return payload.get("regions", {})


def principled_node(material):
    if not material.use_nodes:
        material.use_nodes = True
    node = material.node_tree.nodes.get("Principled BSDF")
    if node:
        return node
    return next((candidate for candidate in material.node_tree.nodes if candidate.type == "BSDF_PRINCIPLED"), None)


def attach_image2_basecolor(material, image_path):
    if not image_path.exists():
        return None
    material.use_nodes = True
    node = principled_node(material)
    if not node:
        return None
    tree = material.node_tree
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.name = "reclamation_mother_black_metal_image2_atlas_v1"
    texture = tree.nodes.new(type="ShaderNodeTexImage")
    texture.name = "image2_black_metal_region_atlas"
    texture.label = "Image2 black metal region atlas"
    texture.image = image
    texture.extension = "CLIP"
    if "Base Color" in node.inputs:
        tree.links.new(texture.outputs["Color"], node.inputs["Base Color"])
    return image


def attach_image2_scalar_map(material, image_path, socket_name, node_name):
    if not image_path.exists():
        return None
    material.use_nodes = True
    node = principled_node(material)
    if not node or socket_name not in node.inputs:
        return None
    tree = material.node_tree
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.name = node_name
    try:
        image.colorspace_settings.name = "Non-Color"
    except TypeError:
        pass
    texture = tree.nodes.new(type="ShaderNodeTexImage")
    texture.name = f"{node_name}_texture"
    texture.label = f"Image2 {socket_name.lower()} atlas"
    texture.image = image
    texture.extension = "CLIP"
    tree.links.new(texture.outputs["Color"], node.inputs[socket_name])
    return image


def attach_image2_normal_map(material, image_path):
    if not image_path.exists():
        return None
    material.use_nodes = True
    node = principled_node(material)
    if not node or "Normal" not in node.inputs:
        return None
    tree = material.node_tree
    image = bpy.data.images.load(str(image_path), check_existing=True)
    image.name = "reclamation_mother_black_metal_image2_normal_v1"
    try:
        image.colorspace_settings.name = "Non-Color"
    except TypeError:
        pass
    texture = tree.nodes.new(type="ShaderNodeTexImage")
    texture.name = "image2_black_metal_normal_texture"
    texture.label = "Image2 normal atlas"
    texture.image = image
    texture.extension = "CLIP"
    normal_map = tree.nodes.new(type="ShaderNodeNormalMap")
    normal_map.name = "image2_black_metal_normal_map"
    normal_map.inputs["Strength"].default_value = 0.24
    tree.links.new(texture.outputs["Color"], normal_map.inputs["Color"])
    tree.links.new(normal_map.outputs["Normal"], node.inputs["Normal"])
    return image


def setup_image2_black_metal_materials(materials):
    image = attach_image2_basecolor(materials["dark"], IMAGE2_ATLAS_PATH)
    if not image:
        return {
            "enabled": False,
            "reason": f"missing atlas {IMAGE2_ATLAS_PATH}",
        }
    roughness = attach_image2_scalar_map(materials["dark"], IMAGE2_ATLAS_ROUGHNESS_PATH, "Roughness", "reclamation_mother_black_metal_image2_roughness_v1")
    metallic = attach_image2_scalar_map(materials["dark"], IMAGE2_ATLAS_METALLIC_PATH, "Metallic", "reclamation_mother_black_metal_image2_metallic_v1")
    normal = attach_image2_normal_map(materials["dark"], IMAGE2_ATLAS_NORMAL_PATH)
    occlusion = IMAGE2_ATLAS_OCCLUSION_PATH.exists()
    return {
        "enabled": True,
        "sourceAtlas": relative_or_absolute(IMAGE2_ATLAS_SOURCE_PATH),
        "sourceAtlasSha256": file_sha256(IMAGE2_ATLAS_SOURCE_PATH),
        "runtimeAtlas": relative_or_absolute(IMAGE2_ATLAS_PATH),
        "regions": relative_or_absolute(IMAGE2_ATLAS_REGIONS_PATH),
        "contactSheet": relative_or_absolute(IMAGE2_ATLAS_CONTACT_SHEET),
        "runtimeAtlasSha256": file_sha256(IMAGE2_ATLAS_PATH),
        "pbrMaps": {
            "roughness": relative_or_absolute(IMAGE2_ATLAS_ROUGHNESS_PATH) if roughness else None,
            "roughnessSha256": file_sha256(IMAGE2_ATLAS_ROUGHNESS_PATH) if roughness else None,
            "metallic": relative_or_absolute(IMAGE2_ATLAS_METALLIC_PATH) if metallic else None,
            "metallicSha256": file_sha256(IMAGE2_ATLAS_METALLIC_PATH) if metallic else None,
            "normal": relative_or_absolute(IMAGE2_ATLAS_NORMAL_PATH) if normal else None,
            "normalSha256": file_sha256(IMAGE2_ATLAS_NORMAL_PATH) if normal else None,
            "occlusion": relative_or_absolute(IMAGE2_ATLAS_OCCLUSION_PATH) if occlusion else None,
            "occlusionSha256": file_sha256(IMAGE2_ATLAS_OCCLUSION_PATH) if occlusion else None,
            "normalStrength": 0.24 if normal else None,
        },
        "materialSlots": ["mat_black_inner_frame"],
    }


def shader_hash(u, v, seed):
    return math.sin(u * 127.1 + v * 311.7 + seed * 74.7) * 43758.5453123 % 1.0


def scratch_line(u, v, seed, frequency, width, slope):
    phase = shader_hash(seed * 0.17, seed * 0.31, seed)
    value = (u * frequency + v * frequency * slope + phase) % 1.0
    distance = abs(value - 0.5)
    return max(0.0, 1.0 - distance / width)


def write_scripted_bake_image(path, name, kind, palette, size=SCRIPTED_BAKE_SIZE):
    SCRIPTED_BAKE_DIR.mkdir(parents=True, exist_ok=True)
    pixels = []
    for y in range(size):
        v = y / max(1, size - 1)
        for x in range(size):
            u = x / max(1, size - 1)
            grain = shader_hash(u * 9.0, v * 9.0, 3.0)
            fine = shader_hash(u * 48.0, v * 48.0, 11.0)
            diagonal = scratch_line(u, v, 7.0, 18.0, 0.036, -0.18)
            hairline = scratch_line(u, v, 13.0, 38.0, 0.020, 0.42)
            panel = 1.0 if min(u, v, 1.0 - u, 1.0 - v) < 0.032 else 0.0
            seam = max(
                0.0,
                1.0 - abs((u * 4.0) % 1.0 - 0.5) / 0.035,
                1.0 - abs((v * 3.0) % 1.0 - 0.5) / 0.035,
            )
            if kind == "normal":
                nx = 0.50 + (fine - 0.5) * 0.025 + (hairline - diagonal) * 0.035
                ny = 0.50 + (grain - 0.5) * 0.018 + (diagonal + seam * 0.35) * 0.030
                nz = 0.94 + max(diagonal, hairline) * 0.045
                pixels.extend((clamp(nx, 0.0, 1.0), clamp(ny, 0.0, 1.0), clamp(nz, 0.0, 1.0), 1.0))
                continue
            if kind == "roughness":
                rough = palette[0] + (grain - 0.5) * palette[1] + max(diagonal, hairline) * 0.08 + panel * 0.035
                pixels.extend((clamp(rough, 0.0, 1.0), clamp(rough, 0.0, 1.0), clamp(rough, 0.0, 1.0), 1.0))
                continue

            base_color, wear_color, grime_color = palette
            wear = max(diagonal * 0.75, hairline * 0.55, panel * 0.60)
            grime = max(0.0, seam * 0.28 + (0.42 - grain) * 0.16)
            rgb = []
            for channel in range(3):
                value = base_color[channel]
                value = lerp(value, wear_color[channel], clamp(wear, 0.0, 0.72))
                value = lerp(value, grime_color[channel], clamp(grime, 0.0, 0.42))
                value += (fine - 0.5) * 0.018
                rgb.append(clamp(value, 0.0, 1.0))
            pixels.extend((rgb[0], rgb[1], rgb[2], 1.0))

    image = bpy.data.images.new(name=name, width=size, height=size, alpha=True, float_buffer=False)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def attach_baked_texture(material, image, socket_name, node_name, colorspace="sRGB"):
    material.use_nodes = True
    node = principled_node(material)
    if not node or socket_name not in node.inputs:
        return False
    try:
        image.colorspace_settings.name = colorspace
    except TypeError:
        pass
    texture = material.node_tree.nodes.new(type="ShaderNodeTexImage")
    texture.name = node_name
    texture.label = node_name
    texture.image = image
    material.node_tree.links.new(texture.outputs["Color"], node.inputs[socket_name])
    return True


def attach_baked_normal(material, image, strength, node_name):
    material.use_nodes = True
    node = principled_node(material)
    if not node or "Normal" not in node.inputs:
        return False
    try:
        image.colorspace_settings.name = "Non-Color"
    except TypeError:
        pass
    texture = material.node_tree.nodes.new(type="ShaderNodeTexImage")
    texture.name = f"{node_name}_texture"
    texture.label = node_name
    texture.image = image
    normal_map = material.node_tree.nodes.new(type="ShaderNodeNormalMap")
    normal_map.name = node_name
    normal_map.inputs["Strength"].default_value = strength
    material.node_tree.links.new(texture.outputs["Color"], normal_map.inputs["Color"])
    material.node_tree.links.new(normal_map.outputs["Normal"], node.inputs["Normal"])
    return True


def setup_scripted_detail_bakes(materials):
    armor_color = write_scripted_bake_image(
        SCRIPTED_ARMOR_ALBEDO_PATH,
        "reclamation_mother_white_armor_micro_wear_bake_v2_color",
        "color",
        ((0.77, 0.80, 0.78), (0.92, 0.94, 0.90), (0.33, 0.38, 0.38)),
    )
    armor_roughness = write_scripted_bake_image(
        SCRIPTED_ARMOR_ROUGHNESS_PATH,
        "reclamation_mother_white_armor_micro_wear_bake_v2_roughness",
        "roughness",
        (0.47, 0.16),
    )
    armor_normal = write_scripted_bake_image(
        SCRIPTED_ARMOR_NORMAL_PATH,
        "reclamation_mother_white_armor_micro_wear_bake_v2_normal",
        "normal",
        (),
    )
    shadow_color = write_scripted_bake_image(
        SCRIPTED_SHADOW_ALBEDO_PATH,
        "reclamation_mother_shadow_armor_micro_wear_bake_v2_color",
        "color",
        ((0.48, 0.52, 0.50), (0.70, 0.74, 0.70), (0.15, 0.18, 0.18)),
    )
    trim_color = write_scripted_bake_image(
        SCRIPTED_TRIM_ALBEDO_PATH,
        "reclamation_mother_warm_trim_edge_wear_bake_v2_color",
        "color",
        ((0.50, 0.44, 0.34), (0.76, 0.68, 0.50), (0.22, 0.19, 0.15)),
    )

    material_links = {
        "mat_bone_white_curved_armor": [
            attach_baked_texture(materials["body"], armor_color, "Base Color", "scripted_white_armor_color_bake"),
            attach_baked_texture(materials["body"], armor_roughness, "Roughness", "scripted_white_armor_roughness_bake", colorspace="Non-Color"),
            attach_baked_normal(materials["body"], armor_normal, 0.18, "scripted_white_armor_micro_normal_bake"),
        ],
        "mat_worn_white_edge_shadow": [
            attach_baked_texture(materials["body_shadow"], shadow_color, "Base Color", "scripted_shadow_armor_color_bake"),
            attach_baked_texture(materials["body_shadow"], armor_roughness, "Roughness", "scripted_shadow_armor_roughness_bake", colorspace="Non-Color"),
            attach_baked_normal(materials["body_shadow"], armor_normal, 0.12, "scripted_shadow_armor_micro_normal_bake"),
        ],
        "mat_warm_brushed_edge_trim": [
            attach_baked_texture(materials["trim"], trim_color, "Base Color", "scripted_warm_trim_color_bake"),
            attach_baked_texture(materials["trim"], armor_roughness, "Roughness", "scripted_warm_trim_roughness_bake", colorspace="Non-Color"),
            attach_baked_normal(materials["trim"], armor_normal, 0.08, "scripted_warm_trim_micro_normal_bake"),
        ],
    }
    return {
        "enabled": True,
        "size": SCRIPTED_BAKE_SIZE,
        "intent": "one-pass scripted micro-wear bake for white armor/shadow/trim; no silhouette inflation and no new external reference dependency",
        "maps": {
            "armorAlbedo": relative_or_absolute(SCRIPTED_ARMOR_ALBEDO_PATH),
            "armorAlbedoSha256": file_sha256(SCRIPTED_ARMOR_ALBEDO_PATH),
            "armorRoughness": relative_or_absolute(SCRIPTED_ARMOR_ROUGHNESS_PATH),
            "armorRoughnessSha256": file_sha256(SCRIPTED_ARMOR_ROUGHNESS_PATH),
            "armorNormal": relative_or_absolute(SCRIPTED_ARMOR_NORMAL_PATH),
            "armorNormalSha256": file_sha256(SCRIPTED_ARMOR_NORMAL_PATH),
            "shadowAlbedo": relative_or_absolute(SCRIPTED_SHADOW_ALBEDO_PATH),
            "shadowAlbedoSha256": file_sha256(SCRIPTED_SHADOW_ALBEDO_PATH),
            "trimAlbedo": relative_or_absolute(SCRIPTED_TRIM_ALBEDO_PATH),
            "trimAlbedoSha256": file_sha256(SCRIPTED_TRIM_ALBEDO_PATH),
        },
        "materialLinks": {name: all(results) for name, results in material_links.items()},
    }


def choose_image2_region(obj_name, poly, center, material_name):
    if "dark_inner" in obj_name:
        return "rubber_gasket"
    if "torso" in obj_name or "core_front_recess" in obj_name:
        return "torso_panel"
    if "back" in obj_name:
        return "large_scratched_panel"
    if "head" in obj_name:
        return "scratch_fill"
    if "upper_arm" in obj_name or "forearm" in obj_name:
        return "narrow_vertical_black"
    if "thigh" in obj_name or "shin" in obj_name:
        return "top_long_rail"
    if "foot" in obj_name or "hand" in obj_name:
        return "scratch_fill"
    if "socket_ring" in obj_name:
        return "brass_edge_wear"
    if "warning" in obj_name or "cyan" in material_name:
        return "cyan_micro_groove"
    if center.z > 2.0:
        return "scratch_fill"
    if abs(center.x) > 0.45:
        return "narrow_vertical_black"
    return "large_scratched_panel"


def assign_region_uvs(obj, regions):
    if obj.type != "MESH" or not regions or not obj.data.polygons:
        return 0
    material_names = {material.name for material in obj.data.materials if material}
    if "mat_black_inner_frame" not in material_names:
        return 0

    uv_layer = obj.data.uv_layers.get("image2_region_uv") or obj.data.uv_layers.new(name="image2_region_uv")
    minv, maxv = bbox_mesh_data(obj)
    dims = maxv - minv
    dims.x = max(dims.x, 0.0001)
    dims.y = max(dims.y, 0.0001)
    dims.z = max(dims.z, 0.0001)
    assigned = 0
    margin = 0.035

    for poly in obj.data.polygons:
        material = obj.data.materials[poly.material_index] if poly.material_index < len(obj.data.materials) else None
        material_name = material.name if material else ""
        if material_name != "mat_black_inner_frame":
            continue
        center = Vector((0, 0, 0))
        for vertex_index in poly.vertices:
            center += obj.data.vertices[vertex_index].co
        center /= max(1, len(poly.vertices))
        region_name = choose_image2_region(obj.name, poly, center, material_name)
        region = regions.get(region_name) or regions.get("large_scratched_panel")
        if not region:
            continue
        u0, v0, uw, vh = region["uvRect"]
        normal = poly.normal
        dominant = max(("x", abs(normal.x)), ("y", abs(normal.y)), ("z", abs(normal.z)), key=lambda item: item[1])[0]
        for loop_index in poly.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
            if dominant == "x":
                s = (vertex.y - minv.y) / dims.y
                t = (vertex.z - minv.z) / dims.z
            elif dominant == "y":
                s = (vertex.x - minv.x) / dims.x
                t = (vertex.z - minv.z) / dims.z
            else:
                s = (vertex.x - minv.x) / dims.x
                t = (vertex.y - minv.y) / dims.y
            s = max(0.0, min(1.0, s))
            t = max(0.0, min(1.0, t))
            uv_layer.data[loop_index].uv = (
                u0 + (margin + s * (1.0 - margin * 2.0)) * uw,
                v0 + (margin + t * (1.0 - margin * 2.0)) * vh,
            )
        assigned += 1
    obj.data.update()
    return assigned


def apply_image2_region_uvs_to_scene(regions):
    object_count = 0
    polygon_count = 0
    object_reports = []
    for obj in bpy.context.scene.objects:
        assigned = assign_region_uvs(obj, regions)
        if assigned:
            object_count += 1
            polygon_count += assigned
            object_reports.append({"object": obj.name, "texturedPolygons": assigned})
    return {
        "uvObjectCount": object_count,
        "uvPolygonCount": polygon_count,
        "objects": object_reports[:48],
    }


def triangulate_scene_meshes():
    triangulated = []
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or not obj.data.polygons:
            continue
        if all(len(poly.vertices) == 3 for poly in obj.data.polygons):
            continue
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        mod = obj.modifiers.new("hp_export_tangent_triangulate", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=mod.name)
        triangulated.append(obj.name)
    return triangulated


def write_image2_texture_provenance(texture_report):
    payload = {
        "schemaVersion": "hp.image2.sourceProvenance.v1",
        "assetFamily": "hp_enemy_reclamation_mother_black_metal_image2_atlas_v1",
        "modelKeyCandidate": "hp_enemy_reclamation_mother_stitch_articulated_v4_front_fill",
        "generatedAt": "2026-06-27",
        "licenseLabel": "openai-generated-output-user-owned-subject-to-openai-terms",
        "classification": "owned-generated-output",
        "generatingAccount": "Codex built-in image_gen; account not exposed",
        "generationCallId": "not-exposed-by-codex-imagegen",
        "generatedCache": str(IMAGE2_SOURCE_CACHE),
        "repoSource": relative_or_absolute(IMAGE2_ATLAS_SOURCE_PATH),
        "runtimeAtlas": relative_or_absolute(IMAGE2_ATLAS_PATH),
        "regions": relative_or_absolute(IMAGE2_ATLAS_REGIONS_PATH),
        "contactSheet": relative_or_absolute(IMAGE2_ATLAS_CONTACT_SHEET),
        "prompt": IMAGE2_BLACK_METAL_PROMPT,
        "toolPolicy": "Image2 source is cut into named UV regions, embedded as GLB baseColorTexture, and not pasted as a full-object poster.",
        "textureReport": texture_report,
    }
    IMAGE2_TEXTURE_PROVENANCE_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return payload


def normalize_source_object(obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    minv, maxv = bbox_mesh_data(obj)
    height = maxv.z - minv.z
    scale = TARGET_HEIGHT_METERS / height if height > 0 else 1.0
    center = (minv + maxv) * 0.5
    for vertex in obj.data.vertices:
        reference_x = (vertex.co.x - center.x) * scale
        reference_y = (vertex.co.y - center.y) * scale
        reference_z = (vertex.co.z - minv.z) * scale
        vertex.co = Vector((reference_y, reference_x, reference_z))
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    obj.data.update()


def import_source_shell(materials):
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(SOURCE_GLB)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"expected one mesh source, got {len(mesh_objects)}")
    obj = mesh_objects[0]
    obj.name = "mesh_stitch_only_source_like_shell"
    obj.data.name = "mesh_stitch_only_source_like_shell_data"
    normalize_source_object(obj)
    stats = {
        "sourceVertices": len(obj.data.vertices),
        "sourcePolygons": len(obj.data.polygons),
        "decimateRatio": DECIMATE_RATIO,
    }

    obj.data.materials.clear()
    for material in (materials["body"], materials["body_shadow"], materials["dark"], materials["trim"], materials["glass"]):
        obj.data.materials.append(material)
    for uv_layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(uv_layer)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    decimate = obj.modifiers.new("stitch_only_keep_original_facets", "DECIMATE")
    decimate.ratio = DECIMATE_RATIO
    if hasattr(decimate, "use_collapse_triangulate"):
        decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    triangulate = obj.modifiers.new("stitch_only_triangles", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=triangulate.name)

    topology = stitch_mesh_topology(obj)
    assign_source_like_materials(obj)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    normal = obj.modifiers.new(name="stitch_only_weighted_normals", type="WEIGHTED_NORMAL")
    normal.keep_sharp = True
    try:
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        obj.modifiers.remove(normal)

    stats.update(
        {
            "verticesAfterStitch": len(obj.data.vertices),
            "polygonsAfterStitch": len(obj.data.polygons),
            **topology,
        }
    )
    return obj, stats


def stitch_mesh_topology(obj):
    before_vertices = len(obj.data.vertices)
    before_faces = len(obj.data.polygons)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            bpy.ops.mesh.remove_doubles(threshold=0.008)
        except TypeError:
            bpy.ops.mesh.remove_doubles()
        try:
            bpy.ops.mesh.fill_holes(sides=96)
        except TypeError:
            bpy.ops.mesh.fill_holes()
        bpy.ops.mesh.normals_make_consistent(inside=False)
    finally:
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass
    removed_components = remove_tiny_disconnected_components(obj)
    return {
        "verticesBeforeStitch": before_vertices,
        "facesBeforeStitch": before_faces,
        "verticesWeldedApprox": max(0, before_vertices - len(obj.data.vertices)),
        "tinyComponentsRemoved": removed_components,
        "stitchMethod": "vertex weld, medium-boundary hole fill, normal consistency, tiny detached component removal; no invented visible rods or armor plates",
    }


def remove_tiny_disconnected_components(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    visited = set()
    components = []
    for face in bm.faces:
        if face in visited:
            continue
        stack = [face]
        visited.add(face)
        faces = []
        area = 0.0
        while stack:
            current = stack.pop()
            faces.append(current)
            area += current.calc_area()
            for edge in current.edges:
                for linked in edge.link_faces:
                    if linked not in visited:
                        visited.add(linked)
                        stack.append(linked)
        components.append((faces, area))

    delete_faces = []
    for faces, area in components:
        if len(faces) <= 3 and area < 0.004:
            delete_faces.extend(faces)
    removed = len(delete_faces)
    if delete_faces:
        bmesh.ops.delete(bm, geom=delete_faces, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return removed


def assign_source_like_materials(obj):
    mesh = obj.data
    for poly in mesh.polygons:
        center = Vector((0, 0, 0))
        for index in poly.vertices:
            center += mesh.vertices[index].co
        center /= max(1, len(poly.vertices))
        poly.material_index = material_index_for_center(center)


def group_source_polygons(source_obj):
    groups = {}
    for poly in source_obj.data.polygons:
        center = Vector((0, 0, 0))
        for vertex_index in poly.vertices:
            center += source_obj.data.vertices[vertex_index].co
        center /= max(1, len(poly.vertices))
        groups.setdefault(classify_part_center(center), []).append(poly.index)
    return groups


def bounds_record(minv, maxv, polygon_count=0):
    center = (minv + maxv) * 0.5
    dims = maxv - minv
    return {
        "min": minv,
        "max": maxv,
        "center": center,
        "dims": dims,
        "polygons": polygon_count,
    }


def group_source_bounds(source_obj):
    groups = group_source_polygons(source_obj)
    bounds = {}
    for group, poly_indices in groups.items():
        minv = Vector((math.inf, math.inf, math.inf))
        maxv = Vector((-math.inf, -math.inf, -math.inf))
        seen = set()
        for poly_index in poly_indices:
            for vertex_index in source_obj.data.polygons[poly_index].vertices:
                if vertex_index in seen:
                    continue
                seen.add(vertex_index)
                co = source_obj.data.vertices[vertex_index].co
                minv.x = min(minv.x, co.x)
                minv.y = min(minv.y, co.y)
                minv.z = min(minv.z, co.z)
                maxv.x = max(maxv.x, co.x)
                maxv.y = max(maxv.y, co.y)
                maxv.z = max(maxv.z, co.z)
        if seen:
            bounds[group] = bounds_record(minv, maxv, len(poly_indices))
    overall_min, overall_max = bbox_mesh_data(source_obj)
    bounds["overall"] = bounds_record(overall_min, overall_max, len(source_obj.data.polygons))
    return bounds


def material_region_bounds(source_obj, material_index, predicate):
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    polygon_count = 0
    for poly in source_obj.data.polygons:
        if poly.material_index != material_index:
            continue
        center = Vector((0, 0, 0))
        for vertex_index in poly.vertices:
            center += source_obj.data.vertices[vertex_index].co
        center /= max(1, len(poly.vertices))
        if not predicate(center):
            continue
        polygon_count += 1
        for vertex_index in poly.vertices:
            co = source_obj.data.vertices[vertex_index].co
            minv.x = min(minv.x, co.x)
            minv.y = min(minv.y, co.y)
            minv.z = min(minv.z, co.z)
            maxv.x = max(maxv.x, co.x)
            maxv.y = max(maxv.y, co.y)
            maxv.z = max(maxv.z, co.z)
    if polygon_count == 0:
        return None
    return bounds_record(minv, maxv, polygon_count)


def percentile(sorted_values, ratio):
    if not sorted_values:
        return None
    index = int(clamp(ratio, 0.0, 1.0) * (len(sorted_values) - 1))
    return sorted_values[index]


def local_front_surface_y(source_obj, material_index, x, z, radius_x=0.34, radius_z=0.38):
    values = []
    mesh = source_obj.data
    for poly in mesh.polygons:
        if poly.material_index != material_index:
            continue
        center = Vector((0, 0, 0))
        for vertex_index in poly.vertices:
            center += mesh.vertices[vertex_index].co
        center /= max(1, len(poly.vertices))
        if abs(center.x - x) > radius_x or abs(center.z - z) > radius_z:
            continue
        values.extend(mesh.vertices[vertex_index].co.y for vertex_index in poly.vertices)
    values.sort()
    if not values:
        return None
    return {
        "count": len(values),
        "minY": values[0],
        "p80Y": percentile(values, 0.80),
        "p90Y": percentile(values, 0.90),
        "maxY": values[-1],
        "radiusX": radius_x,
        "radiusZ": radius_z,
    }


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(value, low, high):
    return max(low, min(high, value))


def compact_bounds_report(bounds):
    report = {}
    for name, item in bounds.items():
        report[name] = {
            "min": [round(v, 4) for v in item["min"]],
            "max": [round(v, 4) for v in item["max"]],
            "center": [round(v, 4) for v in item["center"]],
            "dims": [round(v, 4) for v in item["dims"]],
            "polygons": item["polygons"],
        }
    return report


def derive_physical_landmarks(source_obj):
    bounds = group_source_bounds(source_obj)
    overall = bounds["overall"]
    torso = bounds.get("torso", overall)
    head = bounds.get("head", torso)
    back = bounds.get("back", torso)
    black_front = material_region_bounds(
        source_obj,
        2,
        lambda point: abs(point.x) < 0.58 and 1.0 < point.z < 2.05,
    ) or torso

    torso_height = max(0.1, torso["dims"].z)
    # The canonical gameplay front is the black service-machine face.
    # It lives on the +Y side of the stitched source shell.
    front_sign_y = 1
    torso_center_x = torso["center"].x
    torso_center_y = lerp(torso["min"].y, torso["max"].y, 0.44)
    core_z = clamp(torso["min"].z + torso_height * 0.38, torso["min"].z + 0.46, torso["max"].z - 0.42)
    core_x = black_front["center"].x * 0.18
    core_front_fit = local_front_surface_y(source_obj, 2, core_x, core_z)
    torso_front_y = core_front_fit["p90Y"] if core_front_fit else black_front["max"].y
    pelvis_z = clamp(torso["min"].z + 0.01, 0.82, 1.02)
    torso_z = clamp(torso["min"].z + torso_height * 0.34, 1.42, 1.68)

    landmarks = {
        "root": Vector((0, 0, 0)),
        "pelvis": Vector((torso_center_x * 0.35, torso_center_y, pelvis_z)),
        "torso": Vector((torso_center_x * 0.25, torso_center_y - 0.03, torso_z)),
        "head": Vector((head["center"].x * 0.55, max(head["center"].y, torso_front_y - 0.10), clamp(head["center"].z - 0.06, 2.12, 2.38))),
        "halo": Vector((back["center"].x * 0.35, back["max"].y - 0.04, clamp(back["center"].z + 0.16, 1.82, 2.14))),
        "core": Vector((core_x, torso_front_y + 0.050, core_z)),
        "coreSurfaceY": torso_front_y - 0.012,
        "coreGlassY": torso_front_y + 0.076,
        "coreSocketY": torso_front_y + 0.112,
        "canonicalFront": {
            "axis": "+Y",
            "evidence": "local black material surface near weakpoint, not whole-body maxY",
            "blackFrontBounds": black_front,
            "coreLocalFrontFit": core_front_fit,
            "frontSignY": front_sign_y,
        },
        "bounds": bounds,
    }

    for side, sx in (("left", -1), ("right", 1)):
        upper = bounds.get(f"{side}_upper_arm", torso)
        forearm = bounds.get(f"{side}_forearm", upper)
        hand = bounds.get(f"{side}_hand", forearm)
        thigh = bounds.get(f"{side}_thigh", torso)
        shin = bounds.get(f"{side}_shin", thigh)
        foot = bounds.get(f"{side}_foot", shin)

        proximal_upper_x = upper["max"].x if sx < 0 else upper["min"].x
        shoulder_z = clamp(upper["min"].z + upper["dims"].z * 0.52, 1.82, 2.10)
        elbow_z = clamp(lerp(forearm["min"].z, forearm["max"].z, 0.42), 1.16, 1.46)
        wrist_z = clamp(lerp(hand["min"].z, hand["max"].z, 0.28), 0.96, 1.20)
        landmarks[f"{side}Shoulder"] = Vector((proximal_upper_x, lerp(upper["min"].y, upper["max"].y, 0.42), shoulder_z))
        landmarks[f"{side}Elbow"] = Vector((forearm["center"].x, lerp(forearm["min"].y, forearm["max"].y, 0.36), elbow_z))
        landmarks[f"{side}Wrist"] = Vector((hand["center"].x, lerp(hand["min"].y, hand["max"].y, 0.28), wrist_z))

        hip_z = clamp(lerp(thigh["min"].z, thigh["max"].z, 0.80), 0.86, 1.10)
        knee_z = clamp((thigh["min"].z + shin["max"].z) * 0.5, 0.48, 0.72)
        ankle_z = clamp(lerp(foot["min"].z, foot["max"].z, 0.30), 0.08, 0.22)
        landmarks[f"{side}Hip"] = Vector((lerp(thigh["center"].x, 0, 0.22), thigh["center"].y, hip_z))
        landmarks[f"{side}Knee"] = Vector((lerp(shin["center"].x, thigh["center"].x, 0.25), shin["center"].y, knee_z))
        landmarks[f"{side}Ankle"] = Vector((foot["center"].x, lerp(foot["min"].y, foot["max"].y, 0.42), ankle_z))
    return landmarks


def material_index_for_center(point):
    x, y, z = point.x, point.y, point.z
    absx = abs(x)
    if z < 0.30:
        return 2
    if y > 0.14 and z > 1.05:
        return 2
    if absx < 0.32 and 0.90 < z < 1.88 and y > -0.12:
        return 2
    if y < -0.30 and absx < 0.34 and 1.46 < z < 1.86:
        return 4
    if absx > 0.54 and z > 1.05:
        return 0
    if z < 1.08:
        return 1
    if z > 2.05:
        return 0
    if y < -0.24 and 1.20 < z < 2.00:
        return 3
    return 0


def classify_part_center(point):
    x, y, z = point.x, point.y, point.z
    absx = abs(x)
    side = "left" if x < 0 else "right"
    if z < 0.32:
        return f"{side}_foot"
    if absx > 0.62 and 0.82 < z < 1.30:
        return f"{side}_hand"
    if z < 0.72 and absx > 0.10:
        return f"{side}_shin"
    if z < 1.12 and absx > 0.10:
        return f"{side}_thigh"
    if z > 2.05 and absx < 0.54:
        return "head"
    if absx > 0.58 and z > 1.50:
        return f"{side}_upper_arm"
    if absx > 0.44 and 0.78 < z <= 1.50:
        return f"{side}_forearm"
    if y > 0.16 and z > 1.18:
        return "back"
    return "torso"


def parent_map_for_nodes(nodes):
    return {
        "torso": nodes["torso"],
        "back": nodes["halo"],
        "head": nodes["head"],
        "left_upper_arm": nodes["leftShoulder"],
        "right_upper_arm": nodes["rightShoulder"],
        "left_forearm": nodes["leftElbow"],
        "right_forearm": nodes["rightElbow"],
        "left_hand": nodes["leftWrist"],
        "right_hand": nodes["rightWrist"],
        "left_thigh": nodes["leftHip"],
        "right_thigh": nodes["rightHip"],
        "left_shin": nodes["leftKnee"],
        "right_shin": nodes["rightKnee"],
        "left_foot": nodes["leftAnkle"],
        "right_foot": nodes["rightAnkle"],
    }


def make_mesh_part(name, source_obj, polygon_indices):
    source_mesh = source_obj.data
    vertex_map = {}
    verts = []
    faces = []
    material_indices = []
    for poly_index in polygon_indices:
        poly = source_mesh.polygons[poly_index]
        face = []
        for vertex_index in poly.vertices:
            if vertex_index not in vertex_map:
                vertex_map[vertex_index] = len(verts)
                verts.append(tuple(source_mesh.vertices[vertex_index].co))
            face.append(vertex_map[vertex_index])
        if len(face) >= 3:
            faces.append(tuple(face))
            material_indices.append(poly.material_index)
    if not faces:
        return None
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for material in source_mesh.materials:
        obj.data.materials.append(material)
    for poly, material_index in zip(obj.data.polygons, material_indices, strict=False):
        poly.material_index = min(material_index, max(0, len(obj.data.materials) - 1))
        poly.use_smooth = False
    normal = obj.modifiers.new(name="stitch_part_weighted_normals", type="WEIGHTED_NORMAL")
    normal.keep_sharp = True
    try:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        obj.modifiers.remove(normal)
    return obj


def build_articulated_part_meshes(source_obj, nodes):
    groups = group_source_polygons(source_obj)
    parent_map = parent_map_for_nodes(nodes)

    parts = {}
    for group, poly_indices in groups.items():
        part = make_mesh_part(f"mesh_stitch_articulated_{group}", source_obj, poly_indices)
        if part:
            base.parent_keep_world(part, parent_map.get(group, nodes["torso"]))
            parts[group] = part
    return parts


def make_gap_fill_shell(source_obj, materials, nodes):
    groups = group_source_polygons(source_obj)
    parent_map = parent_map_for_nodes(nodes)
    gap_parts = {}
    for group, poly_indices in groups.items():
        part = make_mesh_part(f"mesh_stitch_articulated_{group}_dark_inner", source_obj, poly_indices)
        if not part:
            continue
        part.data.materials.clear()
        part.data.materials.append(materials["dark"])
        center = Vector((0, 0, 0))
        for vertex in part.data.vertices:
            center += vertex.co
        center /= max(1, len(part.data.vertices))
        for vertex in part.data.vertices:
            vertex.co = center + (vertex.co - center) * GAP_FILL_SHELL_SCALE
        for poly in part.data.polygons:
            poly.material_index = 0
            poly.use_smooth = False
        part.data.update()
        base.parent_keep_world(part, parent_map.get(group, nodes["torso"]))
        gap_parts[group] = part
    return gap_parts


def add_internal_cavity_shadow_masses(materials, nodes, landmarks):
    core = landmarks["core"]
    torso = landmarks["torso"]
    created = []

    def add_shadow_sphere(name, location, scale, parent, segments=18, rings=9):
        obj = base.sphere(name, location, scale, materials["dark"], parent, segments=segments, rings=rings)
        created.append(name)
        return obj

    add_shadow_sphere(
        "part_torso_internal_black_cavity_mass",
        (torso.x, torso.y + 0.15, torso.z + 0.19),
        (0.36, 0.10, 0.32),
        nodes["torso"],
    )
    add_shadow_sphere(
        "part_upper_chest_internal_black_cavity_mass",
        (torso.x, torso.y + 0.11, torso.z + 0.54),
        (0.40, 0.11, 0.20),
        nodes["torso"],
        segments=16,
        rings=8,
    )
    base.cylinder(
        "part_core_recess_internal_depth_shadow",
        (core.x, landmarks["coreSurfaceY"] - 0.055, core.z),
        0.205,
        0.075,
        materials["dark"],
        nodes["core"],
        rotation=(math.pi / 2, 0, 0),
        vertices=48,
        bevel=True,
    )
    created.append("part_core_recess_internal_depth_shadow")
    add_shadow_sphere(
        "part_back_internal_black_cavity_mass",
        (torso.x, torso.y + 0.30, torso.z + 0.10),
        (0.34, 0.10, 0.30),
        nodes["halo"],
        segments=16,
        rings=8,
    )
    return created


def object_world_bounds(obj):
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    for corner in obj.bound_box:
        world = obj.matrix_world @ Vector(corner)
        minv.x = min(minv.x, world.x)
        minv.y = min(minv.y, world.y)
        minv.z = min(minv.z, world.z)
        maxv.x = max(maxv.x, world.x)
        maxv.y = max(maxv.y, world.y)
        maxv.z = max(maxv.z, world.z)
    return minv, maxv


def inside_bound_location(record, x_bias=0.0, z_bias=0.0, y_ratio=0.56):
    dims = record["dims"]
    x = clamp(record["center"].x + dims.x * x_bias, record["min"].x + dims.x * 0.18, record["max"].x - dims.x * 0.18)
    y = lerp(record["min"].y, record["max"].y, y_ratio)
    z = clamp(record["center"].z + dims.z * z_bias, record["min"].z + dims.z * 0.18, record["max"].z - dims.z * 0.18)
    return Vector((x, y, z))


def add_noninflating_seam_backing(materials, nodes, landmarks):
    bounds = landmarks["bounds"]
    parent_map = parent_map_for_nodes(nodes)
    created = []

    def plate(name, group, parent_key, x_bias, z_bias, y_ratio, sx_ratio, sz_ratio, max_sx, max_sz, rotation=(0.0, 0.0, 0.0)):
        record = bounds.get(group)
        if not record:
            return None
        dims = record["dims"]
        if min(dims.x, dims.y, dims.z) <= 0.001:
            return None
        location = inside_bound_location(record, x_bias=x_bias, z_bias=z_bias, y_ratio=y_ratio)
        sx = min(max(dims.x * sx_ratio, 0.045), dims.x * 0.38, max_sx)
        sz = min(max(dims.z * sz_ratio, 0.050), dims.z * 0.38, max_sz)
        sy = min(SEAM_BACKING_DEPTH_METERS, max(0.006, dims.y * 0.12))
        obj = base.armor_plate(
            name,
            location,
            (sx, sy, sz),
            materials["dark"],
            parent_map.get(parent_key, nodes["torso"]),
            rotation=rotation,
            faceted=True,
        )
        minv, maxv = object_world_bounds(obj)
        created.append(
            {
                "object": obj.name,
                "sourceGroup": group,
                "parent": parent_map.get(parent_key, nodes["torso"]).name,
                "boundsMinBlender": [round(v, 4) for v in minv],
                "boundsMaxBlender": [round(v, 4) for v in maxv],
                "policy": "thin dark backing plate clamped inside source group bounds, not an outer armor inflation",
            }
        )
        return obj

    plate("part_torso_upper_fracture_shadow_backing", "torso", "torso", 0.00, 0.22, 0.68, 0.31, 0.18, 0.34, 0.24, rotation=(0.03, 0.00, 0.05))
    plate("part_torso_lower_fracture_shadow_backing", "torso", "torso", 0.02, -0.20, 0.63, 0.27, 0.16, 0.30, 0.22, rotation=(-0.02, 0.00, -0.06))
    plate("part_head_inner_fracture_shadow_backing", "head", "head", 0.00, -0.05, 0.54, 0.24, 0.18, 0.22, 0.16, rotation=(0.00, 0.02, 0.04))
    for side, sign in (("left", -1), ("right", 1)):
        plate(
            f"part_{side}_shoulder_socket_shadow_backing",
            f"{side}_upper_arm",
            f"{side}_upper_arm",
            -0.10 * sign,
            -0.04,
            0.50,
            0.20,
            0.20,
            0.18,
            0.20,
            rotation=(0.04, 0.03 * sign, 0.10 * sign),
        )
        plate(
            f"part_{side}_forearm_split_shadow_backing",
            f"{side}_forearm",
            f"{side}_forearm",
            0.02 * sign,
            -0.05,
            0.50,
            0.22,
            0.18,
            0.16,
            0.18,
            rotation=(0.02, -0.04 * sign, 0.08 * sign),
        )
        plate(
            f"part_{side}_thigh_split_shadow_backing",
            f"{side}_thigh",
            f"{side}_thigh",
            0.02 * sign,
            0.00,
            0.56,
            0.22,
            0.20,
            0.16,
            0.17,
            rotation=(0.02, 0.02 * sign, -0.06 * sign),
        )
        plate(
            f"part_{side}_shin_split_shadow_backing",
            f"{side}_shin",
            f"{side}_shin",
            0.00,
            0.00,
            0.53,
            0.24,
            0.20,
            0.15,
            0.17,
            rotation=(-0.02, 0.03 * sign, 0.05 * sign),
        )
    return created


def rig_empty_at_world(name, world_location, parent=None, display_size=0.06):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = display_size
    bpy.context.collection.objects.link(obj)
    if parent:
        bpy.context.view_layer.update()
        obj.parent = parent
        obj.matrix_parent_inverse.identity()
        obj.location = parent.matrix_world.inverted() @ Vector(world_location)
    else:
        obj.location = Vector(world_location)
    return obj


def rig_empty_at_local(name, local_location, parent, display_size=0.05):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = display_size
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.matrix_parent_inverse.identity()
    obj.location = Vector(local_location)
    return obj


def add_runtime_nodes_and_sockets(materials, landmarks):
    root = rig_empty_at_world("reclamation_mother_root", landmarks["root"], None, display_size=0.12)
    pelvis = rig_empty_at_world("pelvisPivot", landmarks["pelvis"], root)
    torso = rig_empty_at_world("torsoPivot", landmarks["torso"], pelvis)
    head = rig_empty_at_world("headSensorPivot", landmarks["head"], torso)
    halo = rig_empty_at_world("shoulderHaloPivot", landmarks["halo"], torso)
    core_world = landmarks["core"]
    core = rig_empty_at_world("coreWeakpointPivot", core_world, torso)
    nodes = {
        "root": root,
        "pelvis": pelvis,
        "torso": torso,
        "head": head,
        "halo": halo,
        "core": core,
    }
    for side, sx in (("left", -1), ("right", 1)):
        shoulder = rig_empty_at_world(f"{side}ShoulderPivot", landmarks[f"{side}Shoulder"], torso)
        elbow = rig_empty_at_world(f"{side}ElbowPivot", landmarks[f"{side}Elbow"], shoulder)
        wrist = rig_empty_at_world(f"{side}WristPivot", landmarks[f"{side}Wrist"], elbow)
        hip = rig_empty_at_world(f"{side}HipPivot", landmarks[f"{side}Hip"], pelvis)
        knee = rig_empty_at_world(f"{side}KneePivot", landmarks[f"{side}Knee"], hip)
        ankle = rig_empty_at_world(f"{side}AnklePivot", landmarks[f"{side}Ankle"], knee)
        nodes[f"{side}Shoulder"] = shoulder
        nodes[f"{side}Elbow"] = elbow
        nodes[f"{side}Wrist"] = wrist
        nodes[f"{side}Hip"] = hip
        nodes[f"{side}Knee"] = knee
        nodes[f"{side}Ankle"] = ankle
    core_surface_y = landmarks["coreSurfaceY"]
    core_glass_y = landmarks["coreGlassY"]
    core_socket_y = landmarks["coreSocketY"]
    core_z = core_world.z
    core_x = core_world.x
    base.cube(
        "part_core_body_mount_plate",
        (core_x, core_surface_y + 0.020, core_z),
        (0.315, 0.066, 0.300),
        materials["dark"],
        torso,
        bevel=0.008,
    )
    base.cylinder(
        "part_core_embedded_socket_housing",
        (core_x, core_surface_y + 0.048, core_z),
        0.220,
        0.110,
        materials["dark"],
        core,
        rotation=(math.pi / 2, 0, 0),
        vertices=56,
        bevel=True,
    )
    base.cylinder(
        "part_core_front_recess_backplate",
        (core_x, core_surface_y + 0.058, core_z),
        0.188,
        0.050,
        materials["dark"],
        core,
        rotation=(math.pi / 2, 0, 0),
        vertices=48,
        bevel=True,
    )
    base.sphere("part_core_blue_glass", (core_x, core_glass_y, core_z), (0.130, 0.018, 0.130), materials["glass"], core, segments=40, rings=20)
    base.cylinder(
        "part_core_blue_front_lens",
        (core_x, core_glass_y + 0.018, core_z),
        0.104,
        0.018,
        materials["cyan"],
        core,
        rotation=(math.pi / 2, 0, 0),
        vertices=48,
        bevel=True,
    )
    base.torus("part_core_dark_socket_ring", (core_x, core_glass_y - 0.006, core_z), 0.142, 0.010, materials["dark"], core, rotation=(math.pi / 2, 0, 0))
    for tab_name, tab_location, tab_scale in (
        ("part_core_socket_upper_contact_lip", (core_x, core_surface_y + 0.062, core_z + 0.188), (0.140, 0.016, 0.015)),
        ("part_core_socket_lower_contact_lip", (core_x, core_surface_y + 0.062, core_z - 0.188), (0.140, 0.016, 0.015)),
        ("part_core_socket_left_contact_lip", (core_x - 0.188, core_surface_y + 0.062, core_z), (0.015, 0.016, 0.140)),
        ("part_core_socket_right_contact_lip", (core_x + 0.188, core_surface_y + 0.062, core_z), (0.015, 0.016, 0.140)),
    ):
        base.cube(tab_name, tab_location, tab_scale, materials["dark"], core, bevel=0.003)
    for name, location, parent in (
        ("core_glass_weakpoint", Vector((core_x, core_socket_y, core_z)), core),
        ("missile_hit_socket", Vector((core_x, core_socket_y + 0.065, core_z)), core),
        ("skill3_lockon_socket", Vector((core_x, core_socket_y + 0.125, core_z + 0.14)), core),
        ("boss_vfx_center_socket", Vector((core_x, core_surface_y + 0.02, core_z - 0.05)), torso),
        ("floor_contact_socket", Vector((0, -0.03, 0.0)), root),
        ("warning_emissive_slots", Vector((core_x, core_socket_y + 0.23, core_z + 0.45)), torso),
    ):
        rig_empty_at_world(name, location, parent, display_size=0.05)
    return nodes


def add_boss_iron_rod(nodes):
    if not IRON_ROD_GLB.exists():
        raise FileNotFoundError(IRON_ROD_GLB)

    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(IRON_ROD_GLB))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    grip = bpy.data.objects.get("iron_rod_right_hand_grip_socket")
    if not grip:
        raise RuntimeError("imported iron rod is missing iron_rod_right_hand_grip_socket")

    bpy.context.view_layer.update()
    grip_world = grip.matrix_world.translation.copy()
    weapon_side = "right"
    shoulder_world = nodes[f"{weapon_side}Shoulder"].matrix_world.translation.copy()
    wrist = nodes[f"{weapon_side}Wrist"]
    wrist_world = wrist.matrix_world.translation.copy()
    grip_target = wrist_world.copy()
    attack_plane = rig_empty_at_world(
        "weaponAttackPlanePivot",
        grip_target,
        wrist,
        display_size=0.080,
    )
    weapon_socket = rig_empty_at_world("weaponSocket", grip_target, attack_plane, display_size=0.055)
    rod_root = rig_empty_at_world("boss_iron_rod_root", grip_target, weapon_socket, display_size=0.075)
    # In the exported GLB, the black chest/front side is negative Z. On this
    # asset that corresponds to authored negative Y, so keep the rod above the
    # right hand and in front of the black chest, not behind the white back.
    rest_long_axis = Vector((0.22, -0.70, 0.48)).normalized()
    rod_root.rotation_euler = rest_long_axis.to_track_quat("Y", "Z").to_euler()
    rod_root.scale = (0.68, 0.68, 0.68)
    bpy.context.view_layer.update()

    for obj in imported:
        old_world = obj.matrix_world.copy()
        local = old_world.translation - grip_world
        if obj.type == "MESH":
            obj.name = f"boss_{obj.name}" if not obj.name.startswith("boss_") else obj.name
            obj.data.name = f"{obj.name}_mesh"
        obj.parent = rod_root
        obj.matrix_parent_inverse.identity()
        obj.location = local
        obj.rotation_euler = old_world.to_euler("XYZ")
        obj.scale = old_world.to_scale()

    aliases = {}
    for source_name, alias_name in (
        ("iron_rod_hit_base_socket", "bladeBaseSocket"),
        ("iron_rod_hit_tip_socket", "bladeTipSocket"),
        ("iron_rod_trail_start_socket", "boss_iron_rod_trail_start_socket"),
        ("iron_rod_trail_mid_socket", "boss_iron_rod_trail_mid_socket"),
        ("iron_rod_trail_end_socket", "boss_iron_rod_trail_end_socket"),
    ):
        source = bpy.data.objects.get(source_name)
        if not source:
            continue
        aliases[alias_name] = rig_empty_at_local(alias_name, source.location.copy(), rod_root, display_size=0.045)

    return {
        "source": str(IRON_ROD_GLB.relative_to(REPO_ROOT)),
        "weaponSide": weapon_side,
        "attackPlanePivot": attack_plane.name,
        "root": rod_root.name,
        "socket": weapon_socket.name,
        "gripTargetOffsetFromWristBlender": [round(v, 4) for v in (grip_target - wrist_world)],
        "restLongAxisBlender": [round(v, 4) for v in rest_long_axis],
        "importedObjects": sorted(obj.name for obj in imported),
        "aliases": sorted(aliases.keys()),
    }


def compute_scene_report():
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    triangles = 0
    vertices = 0
    for obj in mesh_objects:
        vertices += len(obj.data.vertices)
        triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            minv.x = min(minv.x, world.x)
            minv.y = min(minv.y, world.y)
            minv.z = min(minv.z, world.z)
            maxv.x = max(maxv.x, world.x)
            maxv.y = max(maxv.y, world.y)
            maxv.z = max(maxv.z, world.z)
    return {
        "meshObjects": len(mesh_objects),
        "verticesApprox": vertices,
        "trianglesApprox": triangles,
        "boundsMinBlender": [round(v, 4) for v in minv],
        "boundsMaxBlender": [round(v, 4) for v in maxv],
        "dimensionsBlender": [round(v, 4) for v in (maxv - minv)],
    }


def point_camera_at(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview():
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.015, 0.017, 0.019)
    bpy.ops.object.light_add(type="AREA", location=(-3.0, -4.5, 4.6))
    key = bpy.context.object
    key.name = "preview_key_softbox"
    key.data.energy = 560
    key.data.size = 4.4
    bpy.ops.object.light_add(type="POINT", location=(2.8, -2.0, 2.3))
    fill = bpy.context.object
    fill.name = "preview_cyan_core_kicker"
    fill.data.energy = 90
    fill.data.color = (0.45, 0.72, 1.0)
    bpy.ops.object.camera_add(location=(0.00, 5.85, 1.95))
    camera = bpy.context.object
    camera.name = "preview_camera_three_quarter"
    camera.data.lens = 52
    camera.data.sensor_width = 32
    point_camera_at(camera, (0.00, 0.36, 1.50))
    scene.camera = camera
    scene.render.filepath = str(OUTPUT_PREVIEW)
    bpy.ops.render.render(write_still=True)


def export_scene():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
    )
    base.merge_node_action_clips(OUTPUT_GLB)


def main():
    base.clear_scene()
    materials = base.build_materials()
    shell, source_stats = import_source_shell(materials)
    image2_material_report = setup_image2_black_metal_materials(materials)
    scripted_bake_report = setup_scripted_detail_bakes(materials)
    image2_regions = load_image2_regions()
    landmarks = derive_physical_landmarks(shell)
    nodes = add_runtime_nodes_and_sockets(materials, landmarks)
    internal_cavity_fill = add_internal_cavity_shadow_masses(materials, nodes, landmarks)
    noninflating_seam_backing = add_noninflating_seam_backing(materials, nodes, landmarks)
    part_meshes = build_articulated_part_meshes(shell, nodes)
    gap_fill = make_gap_fill_shell(shell, materials, nodes)
    bpy.data.objects.remove(shell, do_unlink=True)
    weapon_report = add_boss_iron_rod(nodes)
    triangulated_meshes = triangulate_scene_meshes()
    image2_uv_report = apply_image2_region_uvs_to_scene(image2_regions)
    image2_texture_report = {
        **image2_material_report,
        "regionCount": len(image2_regions),
        "uv": image2_uv_report,
        "triangulatedBeforeUv": triangulated_meshes,
    }
    image2_provenance = write_image2_texture_provenance(image2_texture_report)
    base.build_animations()
    scene_report = compute_scene_report()
    render_preview()
    export_scene()
    glb_scan = base.scan_exported_glb(OUTPUT_GLB)
    report = {
        "schema": "human-protocol/level05-reclamation-mother-stitch-only@1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "purpose": "Keep the earlier source-like fragmented silhouette, drive pivots from source mesh bounds, and add the player iron rod as a boss weapon with hit sockets.",
        "assetAuthorship": {
            "meshMethod": "source-like decimated shell split into rigid joint chunks, with same-source dark inner shell filling cut gaps",
            "textures": "source body UVs/images removed; mat_black_inner_frame uses a project Image2 black-metal atlas cut into named UV regions; imported player iron rod keeps production material slots and texcoords",
            "externalTextureDependency": False,
            "visibleConnectorGeometry": "none for limb gap filling; added player iron rod weapon under weaponSocket for boss attack readability",
        },
        "stitchOnlyProxy": {
            **source_stats,
            "verticesAfterExport": scene_report["verticesApprox"],
            "trianglesAfterExport": scene_report["trianglesApprox"],
            "articulatedPartMeshes": sorted(part_meshes.keys()),
            "gapFillMeshes": sorted(gap_fill.keys()),
            "gapFillShellScale": GAP_FILL_SHELL_SCALE,
            "internalCavityFillMeshes": internal_cavity_fill,
            "nonInflatingSeamBacking": {
                "count": len(noninflating_seam_backing),
                "depthMeters": SEAM_BACKING_DEPTH_METERS,
                "method": "thin dark baffle plates placed inside original source-group bounds to reduce see-through cracks without scaling or thickening the outer robot",
                "objects": noninflating_seam_backing,
            },
            "meshPolish": {
                "removeDoublesThresholdMeters": 0.008,
                "fillHoleSides": 96,
                "tinyComponentRemoval": "remove <=3-face detached pieces below area 0.004",
                "intent": "reduce brittle holes and hollow reads while preserving the source-like fractured outer silhouette",
            },
            "image2Texture": image2_texture_report,
            "scriptedDetailBake": scripted_bake_report,
            "landmarkMethod": "mesh group bounding boxes drive root, pelvis, torso, shoulders, elbows, wrists, hips, knees, ankles, and front core sockets",
            "landmarksBlender": {
                key: [round(v, 4) for v in value]
                for key, value in landmarks.items()
                if isinstance(value, Vector)
            },
            "groupBoundsBlender": compact_bounds_report(landmarks["bounds"]),
            "canonicalFront": {
                "axis": landmarks["canonicalFront"]["axis"],
                "evidence": landmarks["canonicalFront"]["evidence"],
                "blackFrontBoundsBlender": compact_bounds_report({"black_front": landmarks["canonicalFront"]["blackFrontBounds"]})["black_front"],
                "coreLocalFrontFitBlender": {
                    key: round(value, 4) if isinstance(value, float) else value
                    for key, value in (landmarks["canonicalFront"].get("coreLocalFrontFit") or {}).items()
                },
            },
            "weapon": weapon_report,
        },
        "derivedAsset": {
            "modelKeyCandidate": "hp_enemy_reclamation_mother_stitch_articulated_v4_front_fill",
            "glb": str(OUTPUT_GLB.relative_to(REPO_ROOT)),
            "sourceBlend": str(OUTPUT_BLEND.relative_to(REPO_ROOT)),
            "preview": str(OUTPUT_PREVIEW.relative_to(REPO_ROOT)),
            "status": "visual-candidate-not-yet-registered-in-level5",
            "requiredTextureEvidence": {
                "image2SourceAtlas": str(IMAGE2_ATLAS_SOURCE_PATH.relative_to(REPO_ROOT)),
                "image2RuntimeAtlas": str(IMAGE2_ATLAS_PATH.relative_to(REPO_ROOT)),
                "image2Regions": str(IMAGE2_ATLAS_REGIONS_PATH.relative_to(REPO_ROOT)),
                "image2ContactSheet": str(IMAGE2_ATLAS_CONTACT_SHEET.relative_to(REPO_ROOT)),
                "image2Roughness": str(IMAGE2_ATLAS_ROUGHNESS_PATH.relative_to(REPO_ROOT)),
                "image2Metallic": str(IMAGE2_ATLAS_METALLIC_PATH.relative_to(REPO_ROOT)),
                "image2Normal": str(IMAGE2_ATLAS_NORMAL_PATH.relative_to(REPO_ROOT)),
                "image2Occlusion": str(IMAGE2_ATLAS_OCCLUSION_PATH.relative_to(REPO_ROOT)),
                "image2Provenance": relative_or_absolute(IMAGE2_TEXTURE_PROVENANCE_PATH),
                "image2ProvenanceClassification": image2_provenance["classification"],
                "scriptedArmorAlbedo": str(SCRIPTED_ARMOR_ALBEDO_PATH.relative_to(REPO_ROOT)),
                "scriptedArmorRoughness": str(SCRIPTED_ARMOR_ROUGHNESS_PATH.relative_to(REPO_ROOT)),
                "scriptedArmorNormal": str(SCRIPTED_ARMOR_NORMAL_PATH.relative_to(REPO_ROOT)),
                "scriptedShadowAlbedo": str(SCRIPTED_SHADOW_ALBEDO_PATH.relative_to(REPO_ROOT)),
                "scriptedTrimAlbedo": str(SCRIPTED_TRIM_ALBEDO_PATH.relative_to(REPO_ROOT)),
            },
            "requiredSockets": [
                "core_glass_weakpoint",
                "missile_hit_socket",
                "skill3_lockon_socket",
                "boss_vfx_center_socket",
                "floor_contact_socket",
                "warning_emissive_slots",
                "weaponSocket",
                "bladeBaseSocket",
                "bladeTipSocket",
                "iron_rod_right_hand_grip_socket",
                "iron_rod_hit_tip_socket",
                "iron_rod_hit_base_socket",
            ],
            **scene_report,
            "glbScan": glb_scan,
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"glb": str(OUTPUT_GLB), "blend": str(OUTPUT_BLEND), "preview": str(OUTPUT_PREVIEW), "report": str(REPORT_PATH)}, indent=2))


if __name__ == "__main__":
    main()
