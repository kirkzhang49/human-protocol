#!/usr/bin/env python3
"""Generate Level 01 safety/storage/body-reference Image2 GLBs."""

from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level01-safety-storage-image2"
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level01-safety-storage-image2"
SOURCE_DIR = ROOT / "src/assets/source_blend/level01-safety-storage-image2"
MANIFEST_PATH = ROOT / "src/assets/manifests/builder/hp_level01_safety_storage_image2_v1.json"
REPORT_PATH = ROOT / "src/assets/manifests/reports/level01_safety_storage_image2_blender_report.json"
SOURCE_BLEND = SOURCE_DIR / "human_protocol_level01_safety_storage_image2_v1.blend"
ATLAS_PATH = TEXTURE_DIR / "hp_level01_safety_storage_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_level01_safety_storage_image2_atlas.regions.json"
PROVENANCE_PATH = ROOT / "src/assets/manifests/reports/level01_safety_storage_image2_source_provenance.json"

for directory in (MODEL_DIR, TEXTURE_DIR, SOURCE_DIR, MANIFEST_PATH.parent, REPORT_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)

GENERATED_AT = "2026-06-20"
PACK_ID = "hp_level01_safety_storage_image2_v1"
THEME_ID = "hp_level01_safety_storage_image2"
SOURCE_ID = "level01-safety-storage-image2"

PIECES = [
    ("room_l1_img2_warning_barrier", "警示隔离栏组件", "storage_crate", "barrier", "floor", "none", True, 0, ["lane:safety_storage_body_reference", "role:safety", "style:hp-level01-safety-storage-image2"]),
    ("room_l1_img2_parts_tote_stack", "零件周转箱堆", "storage_crate", "crate", "floor", "none", True, 0, ["lane:safety_storage_body_reference", "role:storage", "style:hp-level01-safety-storage-image2"]),
    ("room_l1_img2_access_diagnostic_cabinet", "门禁诊断终端柜", "control_console", "cabinet", "floor", "back", True, 2, ["lane:safety_storage_body_reference", "role:interactive", "style:hp-level01-safety-storage-image2"]),
    ("room_l1_img2_maintenance_privacy_screen", "折叠维护遮挡屏", "wall_panel_or_picture_frame", "barrier", "floor", "none", False, 0, ["lane:safety_storage_body_reference", "role:privacy", "style:hp-level01-safety-storage-image2"]),
    ("room_l1_img2_body_reference_lightbox", "人体维护参考灯箱", "wall_panel_or_picture_frame", "wall_panel", "wall", "back", False, 1, ["lane:safety_storage_body_reference", "role:body-reference", "style:hp-level01-safety-storage-image2"]),
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def bsdf_input(bsdf, name: str):
    for socket in bsdf.inputs:
        if socket.name == name or socket.identifier == name:
            return socket
    raise KeyError(name)


TEXTURE_REGION_DATA = json.loads(REGIONS_PATH.read_text(encoding="utf-8"))


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.curves):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def make_mat(name, color, roughness=0.65, metallic=0.0, alpha=1.0, emission=None, strength=0.0, texture_image=None, texture_region=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material["hp_palette_role"] = name
    material["hp_roughness"] = round(float(roughness), 3)
    material["hp_metallic"] = round(float(metallic), 3)
    material["hp_alpha"] = round(float(alpha), 3)
    if texture_region:
        material["hp_texture_atlas"] = rel(ATLAS_PATH)
        material["hp_texture_region"] = texture_region
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf_input(bsdf, "Base Color").default_value = color
        bsdf_input(bsdf, "Roughness").default_value = roughness
        bsdf_input(bsdf, "Metallic").default_value = metallic
        bsdf_input(bsdf, "Alpha").default_value = alpha
        if emission is not None:
            bsdf_input(bsdf, "Emission Color").default_value = emission
            bsdf_input(bsdf, "Emission Strength").default_value = strength
        if texture_image is not None:
            tex = material.node_tree.nodes.new("ShaderNodeTexImage")
            tex.name = f"hp_image2_{texture_region}"
            tex.image = texture_image
            tex.extension = "CLIP"
            tex.interpolation = "Smart"
            material.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Base Color"))
            if emission is not None:
                material.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Emission Color"))
    return material


def materials():
    atlas = bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
    return {
        "dark": make_mat("l1_safety_graphite_powdercoat", (0.055, 0.060, 0.065, 1), 0.72),
        "black": make_mat("l1_safety_rubber_black", (0.025, 0.025, 0.027, 1), 0.86),
        "steel": make_mat("l1_safety_brushed_steel", (0.50, 0.54, 0.55, 1), 0.42, 0.45),
        "white": make_mat("l1_safety_medical_white_polymer", (0.86, 0.86, 0.82, 1), 0.68),
        "blue": make_mat("l1_safety_tote_blue_plastic", (0.28, 0.36, 0.43, 1), 0.74),
        "cyan": make_mat("l1_safety_cyan_indicator", (0.40, 0.95, 1.0, 1), 0.35, emission=(0.40, 0.95, 1.0, 1), strength=1.2),
        "dim_cyan": make_mat("l1_safety_dim_cyan_lens", (0.22, 0.62, 0.72, 1), 0.4, emission=(0.22, 0.72, 0.82, 1), strength=0.45),
        "warning_tex": make_mat("l1_image2_warning_barrier_tile", (1, 1, 1, 1), 0.58, texture_image=atlas, texture_region="warning_barrier"),
        "tote_tex": make_mat("l1_image2_parts_tote_stack_tile", (1, 1, 1, 1), 0.68, texture_image=atlas, texture_region="parts_tote_stack"),
        "terminal_tex": make_mat("l1_image2_access_diagnostic_cabinet_tile", (1, 1, 1, 1), 0.48, texture_image=atlas, texture_region="access_diagnostic_cabinet"),
        "screen_tex": make_mat("l1_image2_maintenance_privacy_screen_tile", (1, 1, 1, 1), 0.82, texture_image=atlas, texture_region="maintenance_privacy_screen"),
        "lightbox_tex": make_mat("l1_image2_body_reference_lightbox_tile", (1, 1, 1, 1), 0.34, emission=(0.68, 0.94, 1.0, 1), strength=0.55, texture_image=atlas, texture_region="body_reference_lightbox"),
    }


def root_node(name: str):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root["asset_id"] = name
    root["scale_unit"] = "meters"
    root["category"] = "furniture"
    root["source_pipeline"] = "real Image2 atlas + deterministic Blender geometry"
    root["texture_atlas"] = rel(ATLAS_PATH)
    root["provenance"] = rel(PROVENANCE_PATH)
    return root


def apply_finish(obj, bevel=0.0, segments=3, smooth=True):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("hp_real_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.affect = "EDGES"
        mod.profile = 0.5
        mod.harden_normals = True
        mod.use_clamp_overlap = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass
    normal = obj.modifiers.new("hp_weighted_normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    obj.select_set(False)
    return obj


def region_uv_bounds(region_key: str, inset_px=10):
    region = TEXTURE_REGION_DATA["regions"][region_key]
    atlas_w, atlas_h = TEXTURE_REGION_DATA["atlasSize"]
    x, y, w, h = float(region["x"]), float(region["y"]), float(region["w"]), float(region["h"])
    inset = float(inset_px)
    return ((x + inset) / atlas_w, 1.0 - (y + h - inset) / atlas_h, (x + w - inset) / atlas_w, 1.0 - (y + inset) / atlas_h)


def apply_region_uv(obj, region_key: str, plane="xz", inset_px=10):
    mesh = obj.data
    uv_layer = mesh.uv_layers.active or mesh.uv_layers.new(name="hp_image2_uv")
    axis_u, axis_v = {"xy": (0, 1), "xz": (0, 2), "yz": (1, 2)}.get(plane, (0, 2))
    coords = [vertex.co for vertex in mesh.vertices]
    min_u, max_u = min(co[axis_u] for co in coords), max(co[axis_u] for co in coords)
    min_v, max_v = min(co[axis_v] for co in coords), max(co[axis_v] for co in coords)
    span_u, span_v = max(max_u - min_u, 1e-6), max(max_v - min_v, 1e-6)
    u0, v0, u1, v1 = region_uv_bounds(region_key, inset_px)
    for poly in mesh.polygons:
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            tu = (co[axis_u] - min_u) / span_u
            tv = (co[axis_v] - min_v) / span_v
            uv_layer.data[loop_index].uv = (u0 + tu * (u1 - u0), v0 + tv * (v1 - v0))
    obj["hp_texture_region"] = region_key
    obj["hp_uv_plane"] = plane
    return obj


def box(name, loc, dims, material, parent, bevel=0.01, segments=3, smooth=True, region=None, plane="xz"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if region:
        apply_region_uv(obj, region, plane=plane)
    apply_finish(obj, bevel, segments, smooth)
    obj.parent = parent
    return obj


def cyl(name, loc, radius, depth, material, parent, vertices=24, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    apply_finish(obj, bevel, 3, True)
    obj.parent = parent
    return obj


def tube(name, points, material, parent, bevel_depth=0.014):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coord in zip(spline.points, points):
        point.co = (coord[0], coord[1], coord[2], 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    mesh_obj = bpy.context.object
    mesh_obj.name = name
    apply_finish(mesh_obj, 0.0, 1, True)
    mesh_obj.parent = parent
    return mesh_obj


def build_warning_barrier(root, m):
    for x in (-0.82, 0.82):
        box(f"weighted_base_foot_{x:+.1f}", (x, 0.02, 0.055), (0.48, 0.34, 0.11), m["black"], root, 0.025)
        cyl(f"round_guard_post_{x:+.1f}", (x, 0, 0.58), 0.045, 1.04, m["steel"], root, 20, bevel=0.006)
    cyl("front_yellow_cross_tube", (0, -0.08, 0.64), 0.045, 1.84, m["warning_tex"], root, 32, rotation=(0, math.pi / 2, 0), bevel=0.004)
    box("upper_hazard_plank", (0, -0.115, 0.95), (1.92, 0.07, 0.22), m["warning_tex"], root, 0.014, region="warning_barrier")
    box("lower_hazard_plank", (0, -0.115, 0.32), (1.92, 0.07, 0.22), m["warning_tex"], root, 0.014, region="warning_barrier")
    box("rear_dark_spacer_panel", (0, 0.06, 0.62), (1.82, 0.045, 0.18), m["dark"], root, 0.008)
    for x in (-0.7, 0.7):
        cyl(f"back_side_stabilizer_{x:+.1f}", (x, 0.12, 0.2), 0.022, 0.44, m["steel"], root, 16, rotation=(math.pi / 2, 0, 0), bevel=0.004)


def build_parts_tote_stack(root, m):
    box("stack_base_pallet", (0, 0, 0.06), (1.32, 0.64, 0.12), m["black"], root, 0.018)
    for row, z in enumerate((0.27, 0.62, 0.97)):
        for col, x in enumerate((-0.32, 0.32)):
            box(f"tote_{row + 1}_{col + 1}_blue_body", (x, 0, z), (0.58, 0.58, 0.30), m["tote_tex"], root, 0.026, region="parts_tote_stack")
            box(f"tote_{row + 1}_{col + 1}_upper_lip", (x, -0.015, z + 0.17), (0.64, 0.62, 0.055), m["blue"], root, 0.012)
            box(f"tote_{row + 1}_{col + 1}_lower_lip", (x, -0.015, z - 0.17), (0.64, 0.62, 0.045), m["blue"], root, 0.012)
            box(f"tote_{row + 1}_{col + 1}_blank_label_plate", (x, -0.305, z + 0.005), (0.24, 0.025, 0.11), m["white"], root, 0.006)
    for x in (-0.68, 0.68):
        box(f"side_vertical_guard_{x:+.1f}", (x, 0.0, 0.63), (0.035, 0.64, 1.05), m["steel"], root, 0.01)


def build_access_diagnostic_cabinet(root, m):
    box("cabinet_rear_shadow_plinth", (0, 0.04, 0.08), (0.86, 0.54, 0.16), m["black"], root, 0.02)
    box("cabinet_main_dark_shell", (0, 0, 0.86), (0.78, 0.46, 1.58), m["dark"], root, 0.028)
    box("cabinet_image2_front_face", (-0.14, -0.25, 0.94), (0.44, 0.035, 1.28), m["terminal_tex"], root, 0.012, region="access_diagnostic_cabinet")
    box("right_service_door_panel", (0.24, -0.255, 0.92), (0.28, 0.03, 1.34), m["dark"], root, 0.012)
    box("screen_lower_status_stack", (-0.16, -0.281, 0.84), (0.28, 0.024, 0.34), m["dim_cyan"], root, 0.006)
    for i, z in enumerate((0.52, 0.44, 0.36)):
        cyl(f"front_cable_socket_{i + 1}", (-0.28 + i * 0.11, -0.286, z), 0.035, 0.035, m["steel"], root, 20, rotation=(math.pi / 2, 0, 0), bevel=0.004)
        tube(f"hanging_black_cable_{i + 1}", [(-0.28 + i * 0.11, -0.31, z - 0.02), (-0.30 + i * 0.09, -0.42, z - 0.18), (-0.22 + i * 0.08, -0.40, 0.10)], m["black"], root, 0.012)
    for z in (1.23, 0.48):
        for i in range(5):
            box(f"right_vent_slit_{z:.1f}_{i}", (0.24, -0.282, z + i * 0.035), (0.22, 0.018, 0.012), m["steel"], root, 0.001)
    box("side_access_handle", (0.40, -0.255, 0.86), (0.035, 0.035, 0.36), m["steel"], root, 0.008)


def build_maintenance_privacy_screen(root, m):
    for i, x in enumerate((-0.72, -0.24, 0.24, 0.72)):
        panel = box(f"folding_white_panel_{i + 1}", (x, 0.02 * (-1) ** i, 0.86), (0.42, 0.045, 1.38), m["screen_tex"], root, 0.018, region="maintenance_privacy_screen")
        panel.rotation_euler[2] = (-0.10, 0.07, -0.07, 0.10)[i]
        cyl(f"panel_top_tube_{i + 1}", (x, -0.005, 1.58), 0.025, 0.43, m["white"], root, 20, rotation=(0, math.pi / 2, 0), bevel=0.004)
        cyl(f"panel_bottom_tube_{i + 1}", (x, -0.005, 0.14), 0.025, 0.43, m["white"], root, 20, rotation=(0, math.pi / 2, 0), bevel=0.004)
    for x in (-0.48, 0.0, 0.48):
        cyl(f"fold_hinge_pole_{x:+.2f}", (x, 0, 0.86), 0.026, 1.48, m["steel"], root, 20, bevel=0.005)
        for z in (0.33, 0.86, 1.39):
            box(f"hinge_plate_{x:+.2f}_{z:.2f}", (x, -0.035, z), (0.10, 0.024, 0.08), m["steel"], root, 0.003)
    for x in (-0.88, 0.88):
        cyl(f"outer_support_foot_{x:+.1f}", (x, 0.0, 0.055), 0.024, 0.48, m["steel"], root, 16, rotation=(math.pi / 2, 0, 0), bevel=0.004)


def build_body_reference_lightbox(root, m):
    box("wall_spacer_back_plate", (0, 0.035, 0.74), (1.04, 0.08, 1.44), m["white"], root, 0.035)
    box("lightbox_dark_inner_gasket", (0, -0.012, 0.74), (0.86, 0.055, 1.18), m["black"], root, 0.018)
    box("abstract_body_reference_image2_panel", (0, -0.052, 0.74), (0.74, 0.028, 1.06), m["lightbox_tex"], root, 0.014, region="body_reference_lightbox")
    for x in (-0.56, 0.56):
        for z in (0.44, 1.04):
            box(f"side_wall_clip_{x:+.1f}_{z:.1f}", (x, -0.005, z), (0.055, 0.09, 0.18), m["steel"], root, 0.006)
    box("top_cyan_structure_light", (0, -0.072, 1.34), (0.58, 0.022, 0.035), m["cyan"], root, 0.004)
    box("bottom_cyan_structure_light", (0, -0.072, 0.14), (0.58, 0.022, 0.035), m["cyan"], root, 0.004)


BUILDERS = {
    "room_l1_img2_warning_barrier": build_warning_barrier,
    "room_l1_img2_parts_tote_stack": build_parts_tote_stack,
    "room_l1_img2_access_diagnostic_cabinet": build_access_diagnostic_cabinet,
    "room_l1_img2_maintenance_privacy_screen": build_maintenance_privacy_screen,
    "room_l1_img2_body_reference_lightbox": build_body_reference_lightbox,
}


def child_meshes(root):
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and (obj == root or obj.parent == root)]


def bounds_for(root):
    bpy.context.view_layer.update()
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for obj in child_meshes(root):
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    return mins, maxs


def ground_center_and_apply(root):
    mins, maxs = bounds_for(root)
    offset = Vector((-(mins.x + maxs.x) / 2, -(mins.y + maxs.y) / 2, -mins.z))
    meshes = child_meshes(root)
    for obj in meshes:
        obj.location += offset
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mins, maxs = bounds_for(root)
    return [round(float(maxs.x - mins.x), 3), round(float(maxs.z - mins.z), 3), round(float(maxs.y - mins.y), 3)]


def export_asset(root, model_key):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj == root or obj.parent == root)
    bpy.context.view_layer.objects.active = root
    out = MODEL_DIR / f"{model_key}.glb"
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT", export_extras=True)
    return out


def texture_regions_for(root):
    regions: dict[str, list[str]] = {}
    for obj in child_meshes(root):
        region = obj.get("hp_texture_region")
        if region:
            regions.setdefault(region, []).append(obj.name)
    return {key: sorted(value) for key, value in sorted(regions.items())}


def material_names_for(root):
    names = set()
    for obj in child_meshes(root):
        for mat in obj.data.materials:
            if mat:
                names.add(mat.name)
    return sorted(names)


def main():
    clear_scene()
    mats = materials()
    generated = []
    reports = []
    for model_key, label, family, footprint, mount, wall_pref, solid, clue, tags in PIECES:
        root = root_node(model_key)
        BUILDERS[model_key](root, mats)
        size_m = ground_center_and_apply(root)
        used_regions = texture_regions_for(root)
        used_materials = material_names_for(root)
        root["family"] = family
        root["collision"] = f"builder_{footprint}_footprint_proxy"
        root["texture_regions"] = ",".join(used_regions.keys())
        root["material_slots"] = ",".join(used_materials)
        root["source_blend"] = rel(SOURCE_BLEND)
        glb_path = export_asset(root, model_key)
        row = {
            "modelKey": model_key,
            "label": label,
            "assetKind": "furniture",
            "family": family,
            "group": "维修",
            "source": SOURCE_ID,
            "sourceAssetId": f"hp_{model_key}_v1",
            "themeId": THEME_ID,
            "glbFile": os.path.relpath(glb_path, MANIFEST_PATH.parent).replace(os.sep, "/"),
            "sizeMeters": size_m,
            "solid": solid,
            "mount": mount,
            "wallPreferred": wall_pref,
            "canHoldSmallProps": False,
            "clueCapacity": clue,
            "footprintFamily": footprint,
            "tags": tags,
        }
        generated.append(row)
        reports.append({**row, "glb": rel(glb_path), "textureRegions": used_regions, "materialSlots": used_materials, "geometryRules": ["meter scale", "grounded pivot", "bevel modifiers applied", "weighted normals applied", "named mesh parts"]})

    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP 维护湾安全储物人体维护提示包 (Image2)",
        "sourceTool": "level01-safety-storage-image2-real-image2-blender",
        "generatedAt": GENERATED_AT,
        "atlas": rel(ATLAS_PATH),
        "textureSources": {
            "sourceImage": rel(TEXTURE_DIR / "image2-sources/hp_level01_safety_storage_material_board_image2_source.png"),
            "atlas": rel(ATLAS_PATH),
            "atlasRegions": rel(REGIONS_PATH),
            "provenance": rel(PROVENANCE_PATH),
            "blenderReport": rel(REPORT_PATH),
        },
        "assets": generated,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    REPORT_PATH.write_text(json.dumps({
        "schema": "human-protocol/level01-safety-storage-image2-blender-report@1",
        "generatedAt": GENERATED_AT,
        "packId": PACK_ID,
        "sourceBlend": rel(SOURCE_BLEND),
        "manifest": rel(MANIFEST_PATH),
        "atlas": rel(ATLAS_PATH),
        "regions": rel(REGIONS_PATH),
        "provenance": rel(PROVENANCE_PATH),
        "assets": reports,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for path in (SOURCE_BLEND, MANIFEST_PATH, REPORT_PATH):
        print(f"wrote {rel(path)}")
    for row in reports:
        print(f"wrote {row['glb']} size={row['sizeMeters']}")


if __name__ == "__main__":
    main()
