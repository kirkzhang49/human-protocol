#!/usr/bin/env python3
"""Hard-reset Blender generator for Human Protocol Level 02 furniture.

The Level 02 furniture pack should read as a clean residential showroom first.
Control/surveillance is only hinted through proportions, narrow seams, hidden
rear plates, and slightly over-regular panels. This script intentionally avoids
front-facing sci-fi cameras, bright cyan bars, and small primitive piles.
"""

from __future__ import annotations

import json
import math
import os
from datetime import date
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level02-furniture-image2"
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level02-furniture-image2"
SOURCE_DIR = ROOT / "src/assets/source_blend/level02-furniture-image2"
MANIFEST_PATH = ROOT / "src/assets/manifests/builder/hp_level02_furniture_image2_v1.json"
REPORT_PATH = ROOT / "src/assets/manifests/reports/level02_furniture_image2_blender_pipeline_report.json"
SOURCE_BLEND = SOURCE_DIR / "human_protocol_level02_furniture_image2_blender_v1.blend"
ATLAS_PATH = TEXTURE_DIR / "hp_level02_furniture_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_level02_furniture_image2_atlas.regions.json"

for directory in (MODEL_DIR, TEXTURE_DIR, SOURCE_DIR, REPORT_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)


PIECES = [
    ("room_l2_img2_modular_sofa", "看护沙发", "sofa_bench", "sofa", "floor", "none", True, 0, ["lane:living", "role:anchor", "style:l2-residential-sim"]),
    ("room_l2_img2_observation_dining_table", "观察餐桌", "desk", "table", "floor", "none", True, 0, ["lane:living", "role:interactive", "style:l2-residential-sim"]),
    ("room_l2_img2_nursery_bed", "儿童看护床", "bed_or_exam_table", "bed", "floor", "none", True, 0, ["lane:care", "role:anchor", "style:l2-residential-sim"]),
    ("room_l2_img2_family_portrait_console", "全家福管制台", "wall_panel_or_picture_frame", "wall_panel", "wall", "back", False, 2, ["lane:surveillance", "role:clue", "style:l2-residential-sim"]),
    ("room_l2_img2_service_kitchen_counter", "服务厨房台", "control_console", "table", "floor", "none", True, 0, ["lane:service", "role:interactive", "style:l2-residential-sim"]),
    ("room_l2_img2_scanner_wardrobe", "衣柜扫描舱", "cabinet", "cabinet", "floor", "back", True, 2, ["lane:surveillance", "role:hero", "style:l2-residential-sim"]),
    ("room_l2_img2_camera_lamp", "看护落地灯", "wall_panel_or_picture_frame", "lamp", "floor", "none", False, 0, ["lane:surveillance", "role:filler", "style:l2-residential-sim"]),
    ("room_l2_img2_living_end_elevator_fixture", "尽头电梯饰柜", "cabinet", "cabinet", "floor", "back", True, 0, ["lane:exit", "role:hero", "style:l2-residential-sim"]),
    ("room_l2_img2_observation_bookshelf", "观察书柜", "bookshelf", "books", "floor", "back", True, 2, ["lane:surveillance", "role:clue", "style:l2-residential-sim"]),
    ("room_l2_img2_carekeeper_armchair", "看护单椅", "chair", "chair", "floor", "none", True, 1, ["lane:living", "role:filler", "style:l2-residential-sim"]),
]


BLUEPRINTS = {
    "room_l2_img2_modular_sofa": {
        "role": "large living-room anchor",
        "silhouette": "long low sofa, rolled arms, continuous back",
        "hiddenControlHint": "rear access seam only",
        "constraints": {"width": [2.2, 2.6], "height": [0.8, 1.05], "glowAreaMax": 0.0},
    },
    "room_l2_img2_observation_dining_table": {
        "role": "ordinary residential table",
        "silhouette": "rounded rectangular/oval tabletop on four legs",
        "hiddenControlHint": "thin underside seam",
        "constraints": {"width": [1.6, 1.95], "height": [0.7, 0.82], "glowAreaMax": 0.0},
    },
    "room_l2_img2_nursery_bed": {
        "role": "care bed without sci-fi base",
        "silhouette": "soft mattress, low drawer base, sparse guard rails",
        "hiddenControlHint": "small rear inspection plate",
        "constraints": {"width": [1.35, 1.7], "height": [0.75, 1.05], "glowAreaMax": 0.0},
    },
    "room_l2_img2_family_portrait_console": {
        "role": "wall portrait and shallow console",
        "silhouette": "framed domestic wall object",
        "hiddenControlHint": "over-thick back board and underside slot",
        "constraints": {"width": [1.1, 1.5], "height": [0.75, 1.1], "glowAreaMax": 0.0},
    },
    "room_l2_img2_service_kitchen_counter": {
        "role": "kitchen base cabinet",
        "silhouette": "countertop, sink, drawers, real handles",
        "hiddenControlHint": "rear access plate",
        "constraints": {"width": [1.7, 2.1], "height": [0.85, 1.12], "glowAreaMax": 0.0},
    },
    "room_l2_img2_scanner_wardrobe": {
        "role": "ordinary wardrobe with quiet scanning implication",
        "silhouette": "two tall doors, base plinth, cornice",
        "hiddenControlHint": "center reveal and back gap",
        "constraints": {"width": [1.05, 1.35], "height": [1.85, 2.2], "glowAreaMax": 0.0},
    },
    "room_l2_img2_camera_lamp": {
        "role": "floor lamp",
        "silhouette": "fabric shade, pole, weighted base",
        "hiddenControlHint": "tiny underside collar",
        "constraints": {"width": [0.36, 0.55], "height": [1.45, 1.75], "glowAreaMax": 0.08},
    },
    "room_l2_img2_living_end_elevator_fixture": {
        "role": "built-in end wall fixture",
        "silhouette": "residential panel doors in warm surround",
        "hiddenControlHint": "too-perfect central split",
        "constraints": {"width": [1.15, 1.5], "height": [1.9, 2.25], "glowAreaMax": 0.0},
    },
    "room_l2_img2_observation_bookshelf": {
        "role": "open bookcase",
        "silhouette": "open shelves, books, lower doors",
        "hiddenControlHint": "small rear plate hidden by shelves",
        "constraints": {"width": [1.05, 1.4], "height": [1.55, 1.9], "glowAreaMax": 0.0},
    },
    "room_l2_img2_carekeeper_armchair": {
        "role": "soft residential armchair",
        "silhouette": "single cushion, rolled arms, rounded back",
        "hiddenControlHint": "rear seam and small brass pins",
        "constraints": {"width": [0.9, 1.25], "height": [0.85, 1.15], "glowAreaMax": 0.0},
    },
}

PLATFORM_BUDGET = {
    "target": ["desktop_web", "mobile_web", "raw_webgpu_builder"],
    "format": "glb",
    "texturePolicy": "shared Image2 atlas is selectively UV-mapped onto large readable surfaces; small structural parts stay PBR-only",
    "standardMaterialRoles": "1-3 visible roles for simple furniture, 4-6 for larger hero furniture",
    "emissivePolicy": "warm lamp only, no visible cyan scanner strips",
    "lodIntent": "current builder pack uses cooked GLB; future LOD must be source-generated, not hand-patched",
    "collisionProxy": "builder footprints use simple footprint families and sizeMeters",
}

PALETTE_INTENT = {
    "goal": "clean residential showroom, warm but not one-note beige, slightly over-controlled",
    "referenceTranslation": [
        "organic gallery-furniture curves translated into restrained residential silhouettes",
        "warm sculptural wood is expressed through large material planes and bevels, not many tiny grain lines",
        "smoked chrome and muted brass kept to thin supports, handles, and rim highlights",
        "soft upholstery reads through volume, rolled edges, and piping instead of dirty texture",
    ],
    "dominantRoles": ["ivory fabric", "warm walnut", "light oak", "warm white cabinet", "muted brass"],
    "supportRoles": ["smoked chrome", "cool-gray seams", "porcelain sink", "low-saturation sage/blue-gray books"],
    "forbiddenFirstRead": ["large cyan strips", "visible cameras", "large service panels", "dirty black cracks"],
    "lowNoiseRules": [
        "no decorative scatter of small spheres or repeated micro-lines",
        "visible details must be structural: seams, handles, rails, plinths, cushions, or support members",
        "large surfaces carry the color work; small geometry only marks contact, function, or construction",
    ],
}


TEXTURE_INTENT = {
    "atlas": ATLAS_PATH.relative_to(ROOT).as_posix(),
    "regions": REGIONS_PATH.relative_to(ROOT).as_posix(),
    "strategy": "selective large-surface texture; no all-over poster wrapping",
    "primaryApplications": {
        "walnut_large_grain": ["observation_dining_table tabletop"],
        "honed_stone_warm_vein": ["generated material evidence only; final counter uses cleaner PBR stone"],
        "ivory_boucle_fabric": ["generated material evidence only; final upholstery uses cleaner PBR fabric"],
        "warm_lacquer_panel": ["wardrobe and elevator large inset panels"],
        "residential_art_panel": ["family_portrait_console framed panel"],
        "muted_book_spines": ["observation_bookshelf book fronts"],
        "shadow_trim_gap": ["hidden control/service plates only"],
    },
    "avoid": [
        "whole-object poster wrap",
        "dense decorative micro-lines in geometry",
        "texture on tiny knobs, poles, or handles",
        "cyan sci-fi strips or visible camera motifs",
    ],
}


def bsdf_input(bsdf, name: str):
    for socket in bsdf.inputs:
        if socket.name == name or socket.identifier == name:
            return socket
    raise KeyError(name)


def load_texture_region_data():
    if not REGIONS_PATH.exists():
        return {"atlasSize": [2048, 2048], "regions": {}}
    return json.loads(REGIONS_PATH.read_text(encoding="utf-8"))


TEXTURE_REGION_DATA = load_texture_region_data()


def make_mat(
    name,
    color,
    roughness=0.65,
    metallic=0.0,
    alpha=1.0,
    emission=None,
    strength=0.0,
    role="surface",
    texture_image=None,
    texture_region=None,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    material["hp_palette_role"] = role
    material["hp_roughness"] = round(float(roughness), 3)
    material["hp_metallic"] = round(float(metallic), 3)
    material["hp_alpha"] = round(float(alpha), 3)
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf_input(bsdf, "Base Color").default_value = color
        bsdf_input(bsdf, "Roughness").default_value = roughness
        bsdf_input(bsdf, "Metallic").default_value = metallic
        bsdf_input(bsdf, "Alpha").default_value = alpha
        if emission is not None:
            bsdf_input(bsdf, "Emission Color").default_value = emission
            bsdf_input(bsdf, "Emission Strength").default_value = strength
        if texture_image is not None and texture_region is not None:
            tex = material.node_tree.nodes.new("ShaderNodeTexImage")
            tex.name = f"hp_image2_{texture_region}"
            tex.image = texture_image
            tex.extension = "CLIP"
            tex.interpolation = "Smart"
            material.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Base Color"))
            material["hp_texture_atlas"] = ATLAS_PATH.relative_to(ROOT).as_posix()
            material["hp_texture_region"] = texture_region
    return material


def materials():
    atlas_image = None
    if ATLAS_PATH.exists():
        atlas_image = bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
    return {
        "oak": make_mat("l2_residential_clean_oak", (0.70, 0.59, 0.40, 1), 0.58, role="light_oak"),
        "oak_dark": make_mat("l2_residential_recessed_oak_shadow", (0.38, 0.30, 0.21, 1), 0.68, role="contact_shadow_oak"),
        "walnut": make_mat("l2_gallery_warm_walnut", (0.56, 0.34, 0.18, 1), 0.52, role="sculptural_warm_walnut"),
        "walnut_dark": make_mat("l2_gallery_dark_woodgrain", (0.25, 0.15, 0.09, 1), 0.66, role="dark_recessed_woodgrain"),
        "wood_rust": make_mat("l2_gallery_rust_wood_inlay", (0.72, 0.30, 0.10, 1), 0.60, role="warm_wood_inlay"),
        "fabric": make_mat("l2_residential_ivory_fabric", (0.90, 0.87, 0.78, 1), 0.92, role="clean_ivory_upholstery"),
        "fabric_shadow": make_mat("l2_residential_cool_fabric_recess", (0.62, 0.60, 0.54, 1), 0.94, role="soft_cool_recess"),
        "fabric_welt": make_mat("l2_residential_upholstery_welt", (0.76, 0.72, 0.62, 1), 0.90, role="soft_upholstery_edge_piping"),
        "cabinet": make_mat("l2_residential_warm_white_cabinet", (0.84, 0.82, 0.72, 1), 0.74, role="warm_white_laminate"),
        "cabinet_shadow": make_mat("l2_residential_cool_gray_reveal", (0.50, 0.50, 0.46, 1), 0.84, role="door_reveal_shadow"),
        "porcelain": make_mat("l2_clean_porcelain_sink", (0.78, 0.79, 0.74, 1), 0.64, role="porcelain_household_surface"),
        "brass": make_mat("l2_muted_champagne_hardware", (0.64, 0.52, 0.30, 1), 0.42, 0.50, role="muted_metal_hardware"),
        "chrome": make_mat("l2_smoked_chrome_gallery_accent", (0.66, 0.65, 0.60, 1), 0.24, 0.90, role="smoked_chrome_thin_accent"),
        "stone": make_mat("l2_warm_honed_stone", (0.78, 0.74, 0.64, 1), 0.72, role="clean_honed_stone"),
        "wallpaper": make_mat("l2_plain_warm_wallpaper", (0.76, 0.73, 0.65, 1), 0.84, role="quiet_wall_surface"),
        "glass": make_mat("l2_warm_fabric_lamp_glow", (0.92, 0.78, 0.50, 0.58), 0.34, alpha=0.58, emission=(0.78, 0.50, 0.24, 1), strength=0.045, role="tiny_warm_emissive"),
        "book_a": make_mat("l2_muted_book_warm_gray", (0.56, 0.55, 0.50, 1), 0.78, role="muted_book_spine"),
        "book_b": make_mat("l2_muted_book_sage", (0.50, 0.56, 0.48, 1), 0.80, role="muted_book_spine"),
        "book_c": make_mat("l2_muted_book_blue_gray", (0.48, 0.54, 0.58, 1), 0.80, role="muted_book_spine"),
        "book_d": make_mat("l2_muted_book_ivory", (0.78, 0.75, 0.66, 1), 0.80, role="muted_book_spine"),
        "shadow": make_mat("l2_hidden_control_shadow", (0.28, 0.28, 0.25, 1), 0.88, role="hidden_control_hint"),
        "tex_walnut": make_mat("l2_image2_walnut_large_grain", (0.58, 0.35, 0.18, 1), 0.54, role="image2_walnut_large_grain", texture_image=atlas_image, texture_region="walnut_large_grain"),
        "tex_stone": make_mat("l2_image2_honed_stone_warm_vein", (0.78, 0.74, 0.64, 1), 0.70, role="image2_honed_stone", texture_image=atlas_image, texture_region="honed_stone_warm_vein"),
        "tex_fabric": make_mat("l2_image2_ivory_boucle_fabric", (0.90, 0.87, 0.78, 1), 0.94, role="image2_ivory_boucle_fabric", texture_image=atlas_image, texture_region="ivory_boucle_fabric"),
        "tex_lacquer": make_mat("l2_image2_warm_lacquer_panel", (0.84, 0.79, 0.66, 1), 0.76, role="image2_warm_lacquer_panel", texture_image=atlas_image, texture_region="warm_lacquer_panel"),
        "tex_art": make_mat("l2_image2_residential_art_panel", (0.82, 0.68, 0.46, 1), 0.72, role="image2_residential_art_panel", texture_image=atlas_image, texture_region="residential_art_panel"),
        "tex_books": make_mat("l2_image2_muted_book_spines", (0.54, 0.55, 0.50, 1), 0.82, role="image2_muted_book_spines", texture_image=atlas_image, texture_region="muted_book_spines"),
        "tex_shadow": make_mat("l2_image2_shadow_trim_gap", (0.25, 0.24, 0.21, 1), 0.88, role="image2_shadow_trim_gap", texture_image=atlas_image, texture_region="shadow_trim_gap"),
    }


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def root_node(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def apply_finish(obj, bevel=0.0, segments=4, smooth=True):
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


def region_uv_bounds(region_key, inset_px=8):
    regions = TEXTURE_REGION_DATA.get("regions", {})
    region = regions.get(region_key)
    if not region:
        return (0.0, 0.0, 1.0, 1.0)
    atlas_w, atlas_h = TEXTURE_REGION_DATA.get("atlasSize", [2048, 2048])
    x = float(region["x"])
    y = float(region["y"])
    w = float(region["w"])
    h = float(region["h"])
    inset = float(inset_px)
    u0 = (x + inset) / atlas_w
    u1 = (x + w - inset) / atlas_w
    v0 = 1.0 - (y + h - inset) / atlas_h
    v1 = 1.0 - (y + inset) / atlas_h
    return (u0, v0, u1, v1)


def apply_region_uv(obj, region_key, plane="xy", inset_px=8):
    if obj.type != "MESH" or not obj.data.polygons:
        return obj
    mesh = obj.data
    uv_layer = mesh.uv_layers.active or mesh.uv_layers.new(name="hp_image2_uv")
    axis_map = {
        "xy": (0, 1),
        "xz": (0, 2),
        "yz": (1, 2),
    }
    axis_u, axis_v = axis_map.get(plane, (0, 1))
    coords = [vertex.co for vertex in mesh.vertices]
    min_u = min(co[axis_u] for co in coords)
    max_u = max(co[axis_u] for co in coords)
    min_v = min(co[axis_v] for co in coords)
    max_v = max(co[axis_v] for co in coords)
    span_u = max(max_u - min_u, 1e-6)
    span_v = max(max_v - min_v, 1e-6)
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


def box(name, loc, dims, material, parent, bevel=0.01, segments=4, smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    apply_finish(obj, bevel, segments, smooth)
    obj.parent = parent
    return obj


def textured_box(name, loc, dims, material, parent, region_key, plane="xy", bevel=0.008, segments=3, smooth=True):
    obj = box(name, loc, dims, material, parent, bevel=bevel, segments=segments, smooth=smooth)
    apply_region_uv(obj, region_key, plane=plane)
    return obj


def soft_box(name, loc, dims, material, parent):
    return box(name, loc, dims, material, parent, bevel=min(dims) * 0.42, segments=18, smooth=True)


def textured_soft_box(name, loc, dims, material, parent, region_key, plane="xy"):
    obj = soft_box(name, loc, dims, material, parent)
    apply_region_uv(obj, region_key, plane=plane)
    return obj


def cyl(name, loc, radius, depth, material, parent, vertices=40, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    apply_finish(obj, bevel, 3, True)
    obj.parent = parent
    return obj


def oval_cylinder(name, loc, dims, material, parent, vertices=72, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=1, depth=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (dims[0] / 2, dims[1] / 2, dims[2])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    apply_finish(obj, bevel, 4, True)
    obj.parent = parent
    return obj


def ellipsoid(name, loc, dims, material, parent, segments=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=24, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (dims[0] / 2, dims[1] / 2, dims[2] / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    apply_finish(obj, 0.0, 1, True)
    obj.parent = parent
    return obj


def seam(name, loc, dims, material, parent):
    return box(name, loc, dims, material, parent, bevel=0.001, segments=1, smooth=False)


def tube_polyline(name, points, material, parent, bevel_depth=0.006, cyclic=False, resolution=3):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, coord in zip(spline.points, points):
        point.co = (coord[0], coord[1], coord[2], 1)
    spline.use_cyclic_u = cyclic
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


def organic_slab(name, loc, width, depth, thickness, material, parent, wobble=0.035, vertices=96, exponent=3.6):
    verts = []
    for z in (thickness / 2, -thickness / 2):
        for i in range(vertices):
            theta = (math.tau * i) / vertices
            c = math.cos(theta)
            s = math.sin(theta)
            x = (width / 2) * math.copysign(abs(c) ** (2 / exponent), c)
            y = (depth / 2) * math.copysign(abs(s) ** (2 / exponent), s)
            edge = 1 + wobble * (math.sin(theta * 3.0 + 0.6) + 0.45 * math.sin(theta * 7.0 - 0.4))
            verts.append((loc[0] + x * edge, loc[1] + y * edge, loc[2] + z))
    faces = []
    top = list(range(vertices))
    bottom = list(range(vertices, vertices * 2))
    faces.append(top)
    faces.append(list(reversed(bottom)))
    for i in range(vertices):
        faces.append((i, (i + 1) % vertices, vertices + (i + 1) % vertices, vertices + i))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    apply_finish(obj, min(thickness, width, depth) * 0.10, 5, True)
    obj.parent = parent
    return obj


def textured_organic_slab(name, loc, width, depth, thickness, material, parent, region_key, wobble=0.035, vertices=96, exponent=3.6):
    obj = organic_slab(name, loc, width, depth, thickness, material, parent, wobble=wobble, vertices=vertices, exponent=exponent)
    apply_region_uv(obj, region_key, plane="xy")
    return obj


def organic_column(name, loc, height, radius_x, radius_y, material, parent, rings=18, vertices=36, twist=1.1, lean=0.08):
    verts = []
    for r in range(rings):
        t = r / (rings - 1)
        z = loc[2] - height / 2 + height * t
        wobble = 1 + 0.16 * math.sin(t * math.pi * 2.0 + 0.5)
        cx = loc[0] + lean * math.sin(t * math.pi * 1.2)
        cy = loc[1] + lean * 0.65 * math.sin(t * math.pi * 1.6 + 1.2)
        for i in range(vertices):
            theta = (math.tau * i) / vertices + twist * t
            verts.append((cx + math.cos(theta) * radius_x * wobble, cy + math.sin(theta) * radius_y * wobble, z))
    faces = []
    for r in range(rings - 1):
        for i in range(vertices):
            a = r * vertices + i
            b = r * vertices + (i + 1) % vertices
            c = (r + 1) * vertices + (i + 1) % vertices
            d = (r + 1) * vertices + i
            faces.append((a, b, c, d))
    faces.append(tuple(reversed(range(vertices))))
    faces.append(tuple((rings - 1) * vertices + i for i in range(vertices)))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    apply_finish(obj, 0.0, 1, True)
    obj.parent = parent
    return obj


def add_wood_grain_top(root, m, prefix, width, depth, z, y_center=0, count=7):
    # Low-noise pass: wood identity is handled by whole-surface material roles,
    # not repeated micro-line geometry that reads as clutter from build thumbnails.
    return None


def add_vertical_wood_grain(root, m, prefix, width, height, y, z_center, count=7):
    return None


def add_side_wood_grain(root, m, prefix, depth, height, x, z_center, count=6):
    return None


def add_soft_piping_loop(root, material, prefix, width, depth, z, y_center=0, bevel_depth=0.006):
    x = width / 2
    y = depth / 2
    points = [
        (-x, y_center - y, z),
        (-x * 0.45, y_center - y * 1.03, z),
        (x * 0.45, y_center - y * 1.03, z),
        (x, y_center - y, z),
        (x * 1.03, y_center, z),
        (x, y_center + y, z),
        (x * 0.45, y_center + y * 1.03, z),
        (-x * 0.45, y_center + y * 1.03, z),
        (-x, y_center + y, z),
        (-x * 1.03, y_center, z),
    ]
    return tube_polyline(f"{prefix}_soft_piped_edge", points, material, root, bevel_depth, cyclic=True)


def add_picture_frame(root, m, width, height, y, z, depth, prefix):
    box(f"{prefix}_top_rail", (0, y, z + height / 2), (width, depth, 0.055), m["brass"], root, 0.010, 3)
    box(f"{prefix}_bottom_rail", (0, y, z - height / 2), (width, depth, 0.055), m["brass"], root, 0.010, 3)
    box(f"{prefix}_left_stile", (-width / 2, y, z), (0.055, depth, height), m["brass"], root, 0.010, 3)
    box(f"{prefix}_right_stile", (width / 2, y, z), (0.055, depth, height), m["brass"], root, 0.010, 3)


def build_sofa(root, m):
    box("sofa_recessed_walnut_shadow_plinth", (0, 0, 0.08), (2.22, 0.74, 0.12), m["walnut_dark"], root, 0.020, 5)
    box("sofa_thin_smoked_chrome_front_shadow_line", (0, 0.382, 0.19), (2.02, 0.020, 0.030), m["chrome"], root, 0.006, 3)
    soft_box("sofa_one_piece_seat_cushion", (0, 0.08, 0.36), (2.18, 0.70, 0.25), m["fabric"], root)
    soft_box("sofa_continuous_back_cushion", (0, -0.30, 0.68), (2.12, 0.22, 0.60), m["fabric"], root)
    cyl("sofa_left_rolled_arm", (-1.12, 0.06, 0.51), 0.145, 0.72, m["fabric"], root, 48, rotation=(math.pi / 2, 0, 0), bevel=0.004)
    cyl("sofa_right_rolled_arm", (1.12, 0.06, 0.51), 0.145, 0.72, m["fabric"], root, 48, rotation=(math.pi / 2, 0, 0), bevel=0.004)
    add_soft_piping_loop(root, m["fabric_welt"], "sofa_seat_cushion", 2.04, 0.62, 0.506, y_center=0.08, bevel_depth=0.006)
    tube_polyline(
        "sofa_back_top_soft_welt",
        [(-0.96, -0.425, 0.98), (-0.30, -0.438, 1.00), (0.30, -0.438, 1.00), (0.96, -0.425, 0.98)],
        m["fabric_welt"],
        root,
        0.007,
    )
    soft_box("sofa_single_integrated_lumbar_cushion", (0.18, 0.31, 0.58), (0.86, 0.13, 0.20), m["fabric"], root)
    for x in (-0.36, 0.36):
        seam(f"sofa_subtle_seat_channel_{x:+.2f}", (x, 0.42, 0.50), (0.012, 0.018, 0.10), m["fabric_shadow"], root)
        seam(f"sofa_subtle_back_channel_{x:+.2f}", (x, -0.425, 0.73), (0.012, 0.018, 0.34), m["fabric_shadow"], root)
    for x in (-0.82, 0.82):
        for y in (-0.28, 0.34):
            box(f"sofa_tapered_oak_foot_{x:+.1f}_{y:+.1f}", (x, y, 0.045), (0.11, 0.11, 0.09), m["oak_dark"], root, 0.012, 3)
    seam("sofa_rear_hidden_access_line", (0.64, -0.432, 0.36), (0.28, 0.010, 0.09), m["shadow"], root)


def build_table(root, m):
    textured_organic_slab("table_gallery_live_edge_walnut_top", (0, 0, 0.74), 1.86, 0.94, 0.075, m["tex_walnut"], root, "walnut_large_grain", wobble=0.024)
    organic_slab("table_soft_shadow_underlip", (0, 0, 0.685), 1.66, 0.76, 0.030, m["walnut_dark"], root, wobble=0.014)
    add_wood_grain_top(root, m, "table_top", 1.68, 0.78, 0.783, 0, 9)
    organic_column("table_flowing_walnut_pedestal_a", (-0.32, -0.06, 0.37), 0.64, 0.070, 0.115, m["walnut_dark"], root, twist=1.5, lean=0.07)
    organic_column("table_flowing_walnut_pedestal_b", (0.32, 0.06, 0.37), 0.64, 0.070, 0.115, m["walnut_dark"], root, twist=-1.35, lean=0.07)
    tube_polyline(
        "table_smoked_chrome_sculptural_arc_a",
        [(-0.66, -0.30, 0.11), (-0.32, -0.08, 0.45), (0.24, 0.12, 0.65), (0.66, 0.30, 0.11)],
        m["chrome"],
        root,
        0.021,
    )
    tube_polyline(
        "table_smoked_chrome_sculptural_arc_b",
        [(0.66, -0.30, 0.11), (0.28, -0.08, 0.42), (-0.25, 0.12, 0.66), (-0.66, 0.30, 0.11)],
        m["chrome"],
        root,
        0.018,
    )
    seam("table_underside_hidden_service_seam", (0.42, -0.46, 0.66), (0.34, 0.010, 0.030), m["shadow"], root)


def build_bed(root, m):
    box("bed_recessed_walnut_shadow_base", (0, 0, 0.08), (1.48, 0.76, 0.12), m["walnut_dark"], root, 0.020, 5)
    box("bed_low_clean_walnut_drawer_base", (0, 0, 0.26), (1.42, 0.72, 0.28), m["walnut"], root, 0.022, 6)
    soft_box("bed_soft_single_mattress", (0, 0, 0.50), (1.32, 0.66, 0.17), m["fabric"], root)
    add_soft_piping_loop(root, m["fabric_welt"], "bed_mattress", 1.22, 0.58, 0.596, 0, 0.005)
    ellipsoid("bed_plain_small_pillow", (-0.38, -0.04, 0.63), (0.43, 0.25, 0.10), m["fabric"], root, 40)
    for x in (-0.62, 0.62):
        for y in (-0.34, 0.34):
            cyl(f"bed_rounded_oak_corner_post_{x:+.1f}_{y:+.1f}", (x, y, 0.56), 0.030, 0.62, m["oak"], root, 28, bevel=0.004)
    for y in (-0.34, 0.34):
        cyl(f"bed_single_soft_guard_rail_{y:+.1f}", (0, y, 0.82), 0.016, 1.20, m["cabinet"], root, 24, rotation=(0, math.pi / 2, 0), bevel=0.002)
        for x in (-0.36, 0.0, 0.36):
            cyl(f"bed_sparse_vertical_guard_{x:+.1f}_{y:+.1f}", (x, y, 0.70), 0.010, 0.25, m["cabinet"], root, 16, bevel=0.001)
    for x in (-0.42, 0.42):
        seam(f"bed_front_drawer_gap_{x:+.1f}", (x, 0.368, 0.26), (0.30, 0.010, 0.10), m["cabinet_shadow"], root)
    add_vertical_wood_grain(root, m, "bed_front_drawer", 1.16, 0.24, 0.381, 0.27, 5)
    seam("bed_rear_inspection_plate", (0.24, -0.375, 0.29), (0.24, 0.010, 0.09), m["shadow"], root)


def build_portrait(root, m):
    box("portrait_overthick_wall_backer", (0, 0, 0.54), (1.34, 0.10, 0.92), m["wallpaper"], root, 0.018, 4)
    add_picture_frame(root, m, 1.08, 0.70, -0.075, 0.60, 0.055, "portrait_domestic_frame")
    textured_box("portrait_sculptural_image2_art_panel", (0, -0.108, 0.60), (0.84, 0.026, 0.50), m["tex_art"], root, "residential_art_panel", "xz", 0.012, 4)
    box("portrait_shallow_walnut_console_shelf", (0, -0.03, 0.14), (1.20, 0.20, 0.08), m["walnut"], root, 0.014, 4)
    add_wood_grain_top(root, m, "portrait_console_shelf", 1.02, 0.15, 0.184, -0.03, 5)
    cyl("portrait_small_round_family_knob_left", (-0.30, -0.145, 0.14), 0.014, 0.018, m["brass"], root, 20, rotation=(math.pi / 2, 0, 0), bevel=0.001)
    cyl("portrait_small_round_family_knob_right", (0.30, -0.145, 0.14), 0.014, 0.018, m["brass"], root, 20, rotation=(math.pi / 2, 0, 0), bevel=0.001)
    seam("portrait_under_shelf_hidden_join", (0.28, -0.150, 0.10), (0.30, 0.010, 0.030), m["shadow"], root)


def build_kitchen(root, m):
    box("counter_single_warm_white_cabinet_body", (0, 0, 0.42), (1.82, 0.64, 0.74), m["cabinet"], root, 0.020, 5)
    box("counter_clean_honed_stone_countertop", (0, 0, 0.83), (1.94, 0.74, 0.075), m["stone"], root, 0.016, 5)
    box("counter_left_warm_walnut_waterfall_side", (-0.92, 0, 0.45), (0.055, 0.66, 0.72), m["walnut"], root, 0.014, 4)
    box("counter_right_warm_walnut_waterfall_side", (0.92, 0, 0.45), (0.055, 0.66, 0.72), m["walnut"], root, 0.014, 4)
    seam("counter_recessed_toe_kick_shadow", (0, 0.352, 0.095), (1.58, 0.014, 0.10), m["shadow"], root)
    seam("counter_under_counter_shadow_line", (0, 0.356, 0.755), (1.64, 0.014, 0.035), m["cabinet_shadow"], root)
    for x in (-0.29, 0.29):
        seam(f"counter_full_height_cabinet_stile_{x:+.2f}", (x, 0.356, 0.43), (0.012, 0.014, 0.56), m["cabinet_shadow"], root)
    add_wood_grain_top(root, m, "counter_stone_subtle_inlay", 1.68, 0.58, 0.872, 0, 5)
    oval_cylinder("counter_inset_porcelain_sink_basin", (0.48, 0.01, 0.875), (0.40, 0.28, 0.022), m["porcelain"], root, 48, 0.001)
    cyl("counter_tiny_sink_drain_shadow", (0.48, 0.01, 0.893), 0.026, 0.004, m["shadow"], root, 24, bevel=0.0)
    cyl("counter_brass_faucet_vertical", (0.48, -0.10, 1.00), 0.012, 0.20, m["brass"], root, 20, bevel=0.002)
    cyl("counter_brass_faucet_spout", (0.48, 0.02, 1.10), 0.010, 0.22, m["brass"], root, 20, rotation=(math.pi / 2, 0, 0), bevel=0.002)
    for i, x in enumerate((-0.58, 0.0, 0.58)):
        textured_box(f"counter_inset_door_panel_{i}", (x, 0.337, 0.38), (0.46, 0.026, 0.42), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.010, 3)
        seam(f"counter_door_inner_shadow_{i}", (x, 0.352, 0.38), (0.36, 0.010, 0.30), m["cabinet_shadow"], root)
        box(f"counter_slim_brass_pull_{i}", (x + 0.15, 0.371, 0.40), (0.018, 0.018, 0.15), m["brass"], root, 0.006, 3)
        textured_box(f"counter_top_drawer_face_{i}", (x, 0.342, 0.69), (0.46, 0.026, 0.09), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.008, 3)
    add_vertical_wood_grain(root, m, "counter_walnut_side_front", 1.74, 0.54, 0.374, 0.42, 8)
    seam("counter_rear_service_plate", (-0.54, -0.335, 0.30), (0.22, 0.010, 0.12), m["shadow"], root)


def build_wardrobe(root, m):
    box("wardrobe_outer_light_oak_case", (0, 0, 1.00), (1.18, 0.58, 1.88), m["oak"], root, 0.024, 6)
    for x in (-0.29, 0.29):
        textured_box(f"wardrobe_recessed_tall_door_{x:+.1f}", (x, 0.308, 1.00), (0.50, 0.044, 1.62), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.014, 4)
        seam(f"wardrobe_inner_panel_reveal_{x:+.1f}", (x, 0.333, 1.00), (0.38, 0.010, 1.32), m["cabinet_shadow"], root)
    box("wardrobe_thin_soft_top_cornice", (0, 0, 1.965), (1.22, 0.64, 0.08), m["walnut"], root, 0.014, 4)
    box("wardrobe_recessed_floor_plinth", (0, 0, 0.055), (1.16, 0.60, 0.11), m["walnut_dark"], root, 0.012, 3)
    textured_box("wardrobe_rear_left_large_cabinet_inset", (-0.28, -0.311, 1.04), (0.38, 0.016, 1.22), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.010, 3)
    textured_box("wardrobe_rear_right_large_cabinet_inset", (0.28, -0.311, 1.04), (0.38, 0.016, 1.22), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.010, 3)
    box("wardrobe_left_side_broad_oak_panel", (-0.612, 0, 1.04), (0.016, 0.36, 1.32), m["oak"], root, 0.010, 3)
    box("wardrobe_right_side_broad_oak_panel", (0.612, 0, 1.04), (0.016, 0.36, 1.32), m["oak"], root, 0.010, 3)
    tube_polyline(
        "wardrobe_arched_gallery_front_trim",
        [(-0.52, 0.366, 0.27), (-0.52, 0.366, 1.72), (-0.22, 0.366, 1.90), (0.22, 0.366, 1.90), (0.52, 0.366, 1.72), (0.52, 0.366, 0.27)],
        m["brass"],
        root,
        0.006,
    )
    add_vertical_wood_grain(root, m, "wardrobe_door_clean", 0.96, 1.46, 0.366, 1.04, 9)
    add_vertical_wood_grain(root, m, "wardrobe_back_showroom", 0.94, 1.42, -0.308, 1.04, 7)
    add_side_wood_grain(root, m, "wardrobe_left_visible", 0.48, 1.52, -0.612, 1.02, 6)
    add_side_wood_grain(root, m, "wardrobe_right_visible", 0.48, 1.52, 0.612, 1.02, 6)
    for x in (-0.12, 0.12):
        box(f"wardrobe_small_vertical_handle_{x:+.1f}", (x, 0.356, 1.00), (0.018, 0.018, 0.34), m["brass"], root, 0.006, 3)
    seam("wardrobe_over_regular_center_shadow_gap", (0, 0.362, 1.02), (0.010, 0.012, 1.54), m["shadow"], root)
    seam("wardrobe_low_rear_hidden_service_slit", (0.30, -0.296, 0.42), (0.18, 0.010, 0.035), m["shadow"], root)


def build_lamp(root, m):
    oval_cylinder("lamp_rounded_weighted_base", (0, 0, 0.055), (0.38, 0.38, 0.045), m["brass"], root, 56, 0.002)
    cyl("lamp_slim_champagne_pole", (0, 0, 0.72), 0.014, 1.22, m["brass"], root, 32, bevel=0.001)
    tube_polyline(
        "lamp_gallery_soft_arc_support",
        [(0.00, 0.00, 0.14), (0.10, -0.04, 0.55), (0.16, -0.03, 1.08), (0.04, 0.00, 1.44)],
        m["chrome"],
        root,
        0.013,
    )
    cyl("lamp_plain_fabric_shade", (0, 0, 1.45), 0.22, 0.34, m["glass"], root, 56, bevel=0.002)
    tube_polyline(
        "lamp_shade_warm_woven_lower_rim",
        [(-0.18, 0.11, 1.28), (-0.06, 0.20, 1.28), (0.12, 0.16, 1.28), (0.19, 0.02, 1.28), (0.10, -0.18, 1.28), (-0.11, -0.18, 1.28), (-0.20, -0.02, 1.28)],
        m["fabric_welt"],
        root,
        0.004,
        cyclic=True,
    )
    cyl("lamp_top_small_finial", (0, 0, 1.64), 0.028, 0.045, m["brass"], root, 28, bevel=0.002)
    seam("lamp_rear_tiny_collar_hint", (0, -0.222, 1.31), (0.12, 0.010, 0.026), m["shadow"], root)


def build_elevator(root, m):
    box("elevator_residential_light_oak_wall_surround", (0, -0.08, 1.07), (1.36, 0.18, 2.12), m["oak"], root, 0.022, 6)
    textured_box("elevator_left_plain_panel_door", (-0.25, 0.028, 0.98), (0.48, 0.065, 1.78), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.012, 4)
    textured_box("elevator_right_plain_panel_door", (0.25, 0.028, 0.98), (0.48, 0.065, 1.78), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.012, 4)
    seam("elevator_too_perfect_center_split", (0, 0.066, 0.98), (0.010, 0.010, 1.50), m["shadow"], root)
    box("elevator_left_walnut_jamb", (-0.59, 0.00, 1.05), (0.10, 0.16, 2.04), m["walnut_dark"], root, 0.012, 3)
    box("elevator_right_walnut_jamb", (0.59, 0.00, 1.05), (0.10, 0.16, 2.04), m["walnut_dark"], root, 0.012, 3)
    box("elevator_top_walnut_lintel", (0, 0.00, 2.04), (1.24, 0.16, 0.12), m["walnut_dark"], root, 0.010, 3)
    textured_box("elevator_rear_large_residential_inset", (0, -0.184, 1.06), (0.86, 0.014, 1.38), m["tex_lacquer"], root, "warm_lacquer_panel", "xz", 0.010, 3)
    box("elevator_rear_lower_shadow_kick", (0, -0.193, 0.24), (0.78, 0.012, 0.12), m["walnut_dark"], root, 0.008, 2)
    box("elevator_left_side_broad_panel", (-0.682, -0.04, 1.05), (0.014, 0.16, 1.52), m["walnut"], root, 0.008, 3)
    box("elevator_right_side_broad_panel", (0.682, -0.04, 1.05), (0.014, 0.16, 1.52), m["walnut"], root, 0.008, 3)
    add_vertical_wood_grain(root, m, "elevator_surround_clean", 1.18, 1.82, 0.083, 1.06, 8)
    add_vertical_wood_grain(root, m, "elevator_rear_showroom", 1.12, 1.82, -0.182, 1.06, 8)
    add_side_wood_grain(root, m, "elevator_left_side", 0.20, 1.86, -0.682, 1.06, 5)
    add_side_wood_grain(root, m, "elevator_right_side", 0.20, 1.86, 0.682, 1.06, 5)
    box("elevator_single_small_call_button_plate", (0.49, 0.075, 1.08), (0.07, 0.018, 0.16), m["brass"], root, 0.006, 2)


def build_bookshelf(root, m):
    box("bookshelf_open_left_side", (-0.58, 0, 0.90), (0.08, 0.46, 1.68), m["walnut"], root, 0.014, 5)
    box("bookshelf_open_right_side", (0.58, 0, 0.90), (0.08, 0.46, 1.68), m["walnut"], root, 0.014, 5)
    box("bookshelf_quiet_warm_back_panel", (0, -0.228, 0.96), (1.02, 0.030, 1.34), m["cabinet"], root, 0.006, 2)
    for i, z in enumerate((0.24, 0.60, 0.96, 1.32, 1.68)):
        box(f"bookshelf_open_real_shelf_{i}", (0, 0, z), (1.14, 0.44, 0.044), m["walnut"], root, 0.008, 3)
    tube_polyline(
        "bookshelf_gallery_oval_front_outline",
        [(-0.58, 0.244, 0.22), (-0.62, 0.244, 0.78), (-0.50, 0.244, 1.48), (0, 0.244, 1.86), (0.50, 0.244, 1.48), (0.62, 0.244, 0.78), (0.58, 0.244, 0.22)],
        m["brass"],
        root,
        0.007,
    )
    for row, z in enumerate((0.28, 0.64, 1.00, 1.36)):
        for col in range(4):
            x = -0.36 + col * 0.23 + (0.025 if row % 2 else 0)
            h = 0.20 + ((row + col) % 3) * 0.035
            mat = (m["book_a"], m["book_b"], m["book_c"], m["book_d"])[(row + col) % 4]
            book_mat = m["tex_books"] if (row + col) % 2 == 0 else mat
            book = box(f"bookshelf_front_book_{row}_{col}", (x, 0.18, z + h / 2), (0.075, 0.070, h), book_mat, root, 0.004, 1)
            if book_mat == m["tex_books"]:
                apply_region_uv(book, "muted_book_spines", "xz")
    box("bookshelf_lower_left_door", (-0.28, 0.205, 0.13), (0.44, 0.040, 0.20), m["cabinet"], root, 0.008, 3)
    box("bookshelf_lower_right_door", (0.28, 0.205, 0.13), (0.44, 0.040, 0.20), m["cabinet"], root, 0.008, 3)
    box("bookshelf_rear_low_hidden_backer", (0, -0.235, 0.22), (0.80, 0.040, 0.32), m["walnut"], root, 0.006, 2)
    add_vertical_wood_grain(root, m, "bookshelf_side_clean", 1.02, 1.38, 0.246, 0.94, 6)
    seam("bookshelf_tiny_rear_access_plate", (0.32, -0.260, 1.48), (0.18, 0.010, 0.09), m["shadow"], root)


def build_armchair(root, m):
    box("armchair_recessed_walnut_shadow_plinth", (0, 0, 0.07), (0.78, 0.68, 0.10), m["walnut_dark"], root, 0.016, 5)
    box("armchair_thin_smoked_chrome_front_shadow_line", (0, 0.348, 0.18), (0.62, 0.018, 0.026), m["chrome"], root, 0.005, 3)
    soft_box("armchair_single_deep_seat_cushion", (0, 0.08, 0.37), (0.76, 0.62, 0.26), m["fabric"], root)
    soft_box("armchair_one_piece_tall_back", (0, -0.26, 0.76), (0.78, 0.22, 0.68), m["fabric"], root)
    cyl("armchair_left_rolled_arm", (-0.49, 0.04, 0.50), 0.130, 0.68, m["fabric"], root, 48, rotation=(math.pi / 2, 0, 0), bevel=0.004)
    cyl("armchair_right_rolled_arm", (0.49, 0.04, 0.50), 0.130, 0.68, m["fabric"], root, 48, rotation=(math.pi / 2, 0, 0), bevel=0.004)
    add_soft_piping_loop(root, m["fabric_welt"], "armchair_seat", 0.66, 0.52, 0.508, 0.08, 0.0055)
    tube_polyline(
        "armchair_back_top_soft_welt",
        [(-0.32, -0.395, 1.08), (0, -0.418, 1.105), (0.32, -0.395, 1.08)],
        m["fabric_welt"],
        root,
        0.006,
    )
    soft_box("armchair_integrated_low_lumbar_pad", (0, 0.24, 0.62), (0.36, 0.10, 0.18), m["fabric"], root)
    for x in (-0.31, 0.31):
        for y in (-0.26, 0.28):
            box(f"armchair_short_oak_foot_{x:+.1f}_{y:+.1f}", (x, y, 0.045), (0.09, 0.09, 0.09), m["oak_dark"], root, 0.010, 3)
    seam("armchair_rear_hidden_access_line", (0.20, -0.432, 0.44), (0.20, 0.010, 0.10), m["shadow"], root)
    for x in (-0.44, 0.44):
        box(f"armchair_small_rear_brass_pin_{x:+.1f}", (x, -0.392, 0.76), (0.06, 0.014, 0.09), m["brass"], root, 0.004, 2)


BUILDERS = {
    "room_l2_img2_modular_sofa": build_sofa,
    "room_l2_img2_observation_dining_table": build_table,
    "room_l2_img2_nursery_bed": build_bed,
    "room_l2_img2_family_portrait_console": build_portrait,
    "room_l2_img2_service_kitchen_counter": build_kitchen,
    "room_l2_img2_scanner_wardrobe": build_wardrobe,
    "room_l2_img2_camera_lamp": build_lamp,
    "room_l2_img2_living_end_elevator_fixture": build_elevator,
    "room_l2_img2_observation_bookshelf": build_bookshelf,
    "room_l2_img2_carekeeper_armchair": build_armchair,
}


def finalize(root):
    bpy.context.view_layer.update()
    children = [obj for obj in bpy.context.scene.objects if obj == root or obj.parent == root]
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for obj in children:
        if obj.type != "MESH":
            continue
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mins.x = min(mins.x, world.x)
            mins.y = min(mins.y, world.y)
            mins.z = min(mins.z, world.z)
            maxs.x = max(maxs.x, world.x)
            maxs.y = max(maxs.y, world.y)
            maxs.z = max(maxs.z, world.z)
    offset = Vector((-(mins.x + maxs.x) / 2, -(mins.y + maxs.y) / 2, -mins.z))
    for obj in children:
        if obj != root:
            obj.location += offset
    bpy.context.view_layer.update()
    size = (maxs.x - mins.x, maxs.z - mins.z, maxs.y - mins.y)
    return [round(float(size[0]), 3), round(float(size[1]), 3), round(float(size[2]), 3)]


def export_asset(root, model_key):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj == root or obj.parent == root)
    bpy.context.view_layer.objects.active = root
    path = MODEL_DIR / f"{model_key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_extras=True,
    )
    return path


def collect_material_names(root):
    names = set()
    for obj in bpy.context.scene.objects:
        if obj != root and obj.parent != root:
            continue
        if obj.type != "MESH":
            continue
        for material in obj.data.materials:
            if material:
                names.add(material.name)
    return sorted(names)


def collect_texture_regions(root):
    regions = {}
    for obj in bpy.context.scene.objects:
        if obj != root and obj.parent != root:
            continue
        region = obj.get("hp_texture_region")
        if not region:
            continue
        regions.setdefault(region, []).append(obj.name)
    return {key: sorted(value) for key, value in sorted(regions.items())}


def material_palette_report(mats):
    rows = []
    for key, material in sorted(mats.items()):
        color = [round(float(v), 3) for v in material.diffuse_color]
        rows.append({
            "key": key,
            "name": material.name,
            "role": material.get("hp_palette_role", "surface"),
            "baseColor": color,
            "roughness": material.get("hp_roughness"),
            "metallic": material.get("hp_metallic"),
            "alpha": material.get("hp_alpha"),
            "textureAtlas": material.get("hp_texture_atlas"),
            "textureRegion": material.get("hp_texture_region"),
        })
    return rows


def apply_root_metadata(root, model_key, family, footprint, used_materials, texture_regions):
    root["asset_id"] = model_key
    root["category"] = "furniture"
    root["style"] = "l2_clean_residential_image2_material_showroom"
    root["platform_hint"] = "desktop_web,mobile_web,raw_webgpu_builder"
    root["scale_unit"] = "meters"
    root["lod_count"] = 1
    root["lod_note"] = PLATFORM_BUDGET["lodIntent"]
    root["collision"] = f"builder_{footprint}_footprint_proxy"
    root["source_file"] = SOURCE_BLEND.relative_to(ROOT).as_posix()
    root["license_note"] = "human-authored Blender script; PDF and user-provided visual reference used as high-level art-direction guidance only"
    root["material_slots"] = ",".join(used_materials)
    root["texture_atlas"] = ATLAS_PATH.relative_to(ROOT).as_posix()
    root["texture_regions"] = ",".join(texture_regions.keys())
    root["family"] = family


def main():
    clear_scene()
    mats = materials()
    generated = []
    for model_key, label, family, footprint, mount, wall_pref, solid, clue, tags in PIECES:
        root = root_node(model_key)
        BUILDERS[model_key](root, mats)
        size_m = finalize(root)
        used_materials = collect_material_names(root)
        texture_regions = collect_texture_regions(root)
        apply_root_metadata(root, model_key, family, footprint, used_materials, texture_regions)
        glb_path = export_asset(root, model_key)
        generated.append({
            "modelKey": model_key,
            "label": label,
            "assetKind": "furniture",
            "family": family,
            "group": "居住",
            "source": "level02-image2-furniture-blender-image2-material-polish",
            "sourceAssetId": f"{model_key}_blender_image2_material_polish_v5",
            "themeId": "hp_level02_residential_sim",
            "glbFile": os.path.relpath(glb_path, MANIFEST_PATH.parent).replace(os.sep, "/"),
            "sizeMeters": size_m,
            "solid": solid,
            "mount": mount,
            "wallPreferred": wall_pref,
            "canHoldSmallProps": solid and footprint in ("table", "cabinet"),
            "clueCapacity": clue,
            "footprintFamily": footprint,
            "tags": tags,
            "_reportMaterialSlots": used_materials,
            "_reportTextureRegions": texture_regions,
        })

    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))

    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_level02_furniture_image2_v1",
        "label": "HP 居住模拟家具包 (Image2 / Blender material polish)",
        "sourceTool": "level02-image2-furniture-blender-image2-material-polish",
        "generatedAt": date.today().isoformat(),
        "atlas": "src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_atlas.png",
        "assets": [
            {key: value for key, value in row.items() if not key.startswith("_report")}
            for row in generated
        ],
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    report = {
        "schema": "human-protocol/level02-furniture-image2-blender-report@2",
        "generatedAt": date.today().isoformat(),
        "sourceBlend": SOURCE_BLEND.relative_to(ROOT).as_posix(),
        "manifest": MANIFEST_PATH.relative_to(ROOT).as_posix(),
        "researchReportIncorporation": {
            "source": "/Users/zhengkaizhang/Downloads/GPT 驱动的 3D 家具资产与游戏道具生产方案研究报告 (1).pdf",
            "appliedRules": [
                "GPT is used for specification, automation, metadata, and QA rather than direct final mesh generation",
                "Blender source and deterministic scripts remain the production source of truth",
                "GLB is the Web/runtime delivery format",
                "palette roles, material budgets, platform hints, and AI/reference notes are recorded in the report",
            ],
        },
        "artReferenceIncorporation": {
            "source": "/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 10.29.30 AM.png",
            "usage": "high-level style study only; no exact furniture design was copied",
            "translatedRules": PALETTE_INTENT["referenceTranslation"],
            "appliedControls": [
                "organic slabs and flowing support columns are used on table/console/bookcase where believable",
                "warm walnut is carried by broad material fields and large insets rather than repeated decorative micro-lines",
                "smoked chrome is limited to thin structural accents and shadow lines",
                "upholstery quality comes from rounded volume, rolled arms, piping, and integrated pads",
                "decorative scatter is explicitly capped; small parts must explain construction or function",
            ],
        },
        "platformBudget": PLATFORM_BUDGET,
        "paletteIntent": PALETTE_INTENT,
        "textureIntent": TEXTURE_INTENT,
        "materialPalette": material_palette_report(mats),
        "image2Evidence": {
            "atlas": "src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_atlas.png",
            "regions": "src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_atlas.regions.json",
            "contactSheet": "src/assets/textures/environment/level02-furniture-image2/hp_level02_furniture_image2_contact_sheet.png",
            "sourceDirectory": "src/assets/textures/environment/level02-furniture-image2/image2-sources",
            "application": "selective baseColorTexture regions mapped onto large readable surfaces; small construction details remain material-only",
        },
        "assets": [
            {
                "modelKey": row["modelKey"],
                "sizeMeters": row["sizeMeters"],
                "glbFile": row["glbFile"],
                "blueprint": BLUEPRINTS[row["modelKey"]],
                "materialSlots": row["_reportMaterialSlots"],
                "textureRegions": row["_reportTextureRegions"],
                "metadata": {
                    "asset_id": row["modelKey"],
                    "style": "l2_clean_residential_image2_material_showroom",
                    "platform_hint": PLATFORM_BUDGET["target"],
                    "collision": f"builder_{row['footprintFamily']}_footprint_proxy",
                    "lod_count": 1,
                    "source_file": SOURCE_BLEND.relative_to(ROOT).as_posix(),
                    "texture_atlas": ATLAS_PATH.relative_to(ROOT).as_posix(),
                },
                "pipelineGates": [
                    "hard_reset_old_outputs",
                    "blender",
                    "large_silhouette_first",
                    "bevels",
                    "weighted_normals",
                    "grounded_pivot",
                    "named_parts",
                    "material_slots",
                    "selective_image2_texture_regions",
                    "math_inset_uv_mapping",
                    "hidden_control_hints_only",
                    "gallery_reference_translated_not_copied",
                ],
            }
            for row in generated
        ],
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST_PATH}")
    print(f"wrote {SOURCE_BLEND}")
    print(f"wrote {REPORT_PATH}")
    for row in generated:
        print(row["modelKey"], row["sizeMeters"])


if __name__ == "__main__":
    main()
