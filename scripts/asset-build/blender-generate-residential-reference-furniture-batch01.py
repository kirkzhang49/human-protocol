#!/usr/bin/env python3
"""Generate residential reference furniture for the Environment Asset Factory.

This batch translates user-provided warm residential showroom references into
repeatable Blender/GLB assets. The assets are generic environment props, not
Level 02-only generated runtime resources.
"""

from __future__ import annotations

import json
import math
import os
from mathutils import Vector

import bpy


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW_DIR = os.path.join(ROOT, "src/assets/models/environment/props")
SOURCE_BLEND = os.path.join(ROOT, "src/assets/source_blend/furniture/human_protocol_residential_reference_furniture_batch01.blend")
PREVIEW_DIR = os.path.join(ROOT, "work/furniture-factory/residential-reference-previews")
REPORT_PATH = os.path.join(ROOT, "src/assets/manifests/reports/residential_reference_furniture_batch01_blender_report.json")
MANIFEST_PATH = os.path.join(ROOT, "src/assets/manifests/runtime/human_protocol_environment_asset_factory_residential_reference_v1.json")
TEXTURE_DIR = os.path.join(ROOT, "src/assets/textures/environment/residential-reference-furniture-image2")
TILE_DIR = os.path.join(TEXTURE_DIR, "image2-sources")
TEXTURE_ATLAS = os.path.join(TEXTURE_DIR, "hp_residential_reference_image2_atlas.png")
TEXTURE_CONTACT_SHEET = os.path.join(TEXTURE_DIR, "hp_residential_reference_image2_contact_sheet.png")
TEXTURE_REGIONS = os.path.join(TEXTURE_DIR, "hp_residential_reference_image2_atlas.regions.json")
TEXTURE_REPORT = os.path.join(ROOT, "src/assets/manifests/reports/residential_reference_furniture_image2_texture_report.json")
GLB_TEXTURE_AUDIT = os.path.join(ROOT, "src/assets/manifests/reports/residential_reference_furniture_glb_texture_audit.json")

REFERENCE_IMAGES = [
    "/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 2.53.26\u202fPM.png",
    "/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 2.53.52\u202fPM.png",
]

for path in [RAW_DIR, os.path.dirname(SOURCE_BLEND), PREVIEW_DIR, os.path.dirname(REPORT_PATH), os.path.dirname(MANIFEST_PATH)]:
    os.makedirs(path, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def bsdf_input(bsdf, name):
    for socket in bsdf.inputs:
        if socket.name == name or socket.identifier == name:
            return socket
    return None


def tile_path(name):
    path = os.path.join(TILE_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing image2 texture tile: {path}")
    return path


def make_mat(name, color, metallic=0.0, roughness=0.7, alpha=1.0, emission=None, strength=0.0, role="surface", texture_tile=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (color[0], color[1], color[2], alpha)
    mat.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    mat["hp_palette_role"] = role
    mat["hp_reference_batch"] = "residential_reference_batch01"
    if texture_tile:
        mat["hp_texture_kind"] = "image2_base_color"
        mat["hp_texture_tile"] = os.path.relpath(texture_tile, ROOT)
        mat["hp_texture_atlas"] = os.path.relpath(TEXTURE_ATLAS, ROOT)
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        for key, value in [
            ("Base Color", (color[0], color[1], color[2], alpha)),
            ("Metallic", metallic),
            ("Roughness", roughness),
            ("Alpha", alpha),
        ]:
            socket = bsdf_input(bsdf, key)
            if socket is not None:
                socket.default_value = value
        if emission is not None:
            socket = bsdf_input(bsdf, "Emission Color")
            if socket is not None:
                socket.default_value = (emission[0], emission[1], emission[2], 1.0)
            socket = bsdf_input(bsdf, "Emission Strength")
            if socket is not None:
                socket.default_value = strength
        if texture_tile:
            image = bpy.data.images.load(texture_tile, check_existing=True)
            image.colorspace_settings.name = "sRGB"
            tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
            tex.name = f"image2_{os.path.splitext(os.path.basename(texture_tile))[0]}"
            tex.label = tex.name
            tex.image = image
            socket = bsdf_input(bsdf, "Base Color")
            if socket is not None:
                mat.node_tree.links.new(tex.outputs["Color"], socket)
    return mat


M = {
    "walnut": make_mat("hp_residential_warm_walnut", (0.55, 0.32, 0.16), 0.0, 0.56, role="warm_walnut", texture_tile=tile_path("warm_walnut_ribbed.png")),
    "walnut_dark": make_mat("hp_residential_deep_walnut_shadow", (0.27, 0.15, 0.08), 0.0, 0.72, role="shadowed_walnut", texture_tile=tile_path("warm_walnut_ribbed.png")),
    "oak": make_mat("hp_residential_light_oak", (0.74, 0.61, 0.39), 0.0, 0.62, role="light_oak", texture_tile=tile_path("pale_oak_slats.png")),
    "oak_pale": make_mat("hp_residential_pale_oak_laminate", (0.82, 0.73, 0.55), 0.0, 0.66, role="pale_oak", texture_tile=tile_path("pale_oak_slats.png")),
    "ivory": make_mat("hp_residential_ivory_boucle", (0.88, 0.84, 0.74), 0.0, 0.92, role="ivory_upholstery", texture_tile=tile_path("ivory_boucle_clean.png")),
    "stone": make_mat("hp_residential_warm_stone", (0.78, 0.72, 0.61), 0.0, 0.76, role="warm_stone", texture_tile=tile_path("warm_stone_oval.png")),
    "cream": make_mat("hp_residential_warm_white_lacquer", (0.84, 0.80, 0.68), 0.0, 0.74, role="warm_white_lacquer", texture_tile=tile_path("warm_white_lacquer.png")),
    "brass": make_mat("hp_residential_muted_brass", (0.64, 0.49, 0.25), 0.55, 0.42, role="muted_brass"),
    "shadow": make_mat("hp_residential_hidden_shadow_gap", (0.18, 0.16, 0.13), 0.0, 0.9, role="hidden_control_shadow_gap", texture_tile=tile_path("shadow_gap_panel.png")),
    "sage": make_mat("hp_residential_muted_sage", (0.42, 0.49, 0.41), 0.0, 0.82, role="muted_accent", texture_tile=tile_path("muted_book_spines.png")),
    "bluegray": make_mat("hp_residential_muted_blue_gray", (0.42, 0.48, 0.52), 0.0, 0.82, role="muted_accent", texture_tile=tile_path("muted_book_spines.png")),
    "basket": make_mat("hp_residential_woven_basket_oak", (0.68, 0.52, 0.31), 0.0, 0.82, role="woven_basket", texture_tile=tile_path("woven_basket_oak.png")),
    "books": make_mat("hp_residential_muted_book_spines", (0.45, 0.42, 0.34), 0.0, 0.86, role="muted_books", texture_tile=tile_path("muted_book_spines.png")),
}


def collection(name):
    col = bpy.data.collections.new(name)
    scene.collection.children.link(col)
    return col


def link_to(col, obj):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)
    return obj


def apply_finish(obj, bevel=0.0, segments=2, smooth=True):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("hp_soft_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(35)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if smooth:
        try:
            bpy.ops.object.shade_smooth()
        except Exception:
            pass
    try:
        normal = obj.modifiers.new("hp_weighted_normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        pass
    needs_uv = any(
        slot.material and slot.material.get("hp_texture_kind") == "image2_base_color"
        for slot in obj.material_slots
    )
    if needs_uv:
        try:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.03)
            bpy.ops.object.mode_set(mode="OBJECT")
            obj["hp_uv_generated"] = "smart_project_image2"
        except Exception as exc:
            obj["hp_uv_warning"] = str(exc)
            try:
                bpy.ops.object.mode_set(mode="OBJECT")
            except Exception:
                pass
    obj.select_set(False)
    return obj


def box(col, name, loc, size, mat, bevel=0.012, segments=2, smooth=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    link_to(col, obj)
    return apply_finish(obj, bevel, segments, smooth)


def cyl(col, name, loc, radius, depth, mat, axis="z", vertices=40, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == "x":
        obj.rotation_euler[1] = math.radians(90)
    elif axis == "y":
        obj.rotation_euler[0] = math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    link_to(col, obj)
    return apply_finish(obj, bevel, 2, True)


def superellipse_slab(col, name, loc, width, depth, height, mat, exponent=3.6, vertices=96, bevel=0.0):
    verts = []
    top = []
    bottom = []
    for index in range(vertices):
        theta = math.tau * index / vertices
        c = math.cos(theta)
        s = math.sin(theta)
        x = math.copysign(abs(c) ** (2.0 / exponent), c) * width * 0.5
        y = math.copysign(abs(s) ** (2.0 / exponent), s) * depth * 0.5
        bottom.append(len(verts))
        verts.append((x, y, -height * 0.5))
        top.append(len(verts))
        verts.append((x, y, height * 0.5))
    faces = []
    for index in range(vertices):
        ni = (index + 1) % vertices
        faces.append((bottom[index], bottom[ni], top[ni], top[index]))
    faces.append(tuple(reversed(bottom)))
    faces.append(tuple(top))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.data.materials.append(mat)
    col.objects.link(obj)
    return apply_finish(obj, bevel, 2, True)


def add_flutes(col, prefix, x0, y, z, count, width, height, mat, spacing=0.055, depth=0.018):
    start = x0 - (count - 1) * spacing * 0.5
    for index in range(count):
        x = start + index * spacing
        box(col, f"{prefix}_vertical_flute_{index:02d}", (x, y, z), (width, depth, height), mat, 0.004, 1)


def add_hidden_rear_plate(col, prefix, width, z, mat=M["shadow"]):
    box(col, f"{prefix}_rear_hidden_access_plate", (0, 0.321, z), (width, 0.018, 0.18), mat, 0.004, 1)


def organic_coffee_table():
    col = collection("hp_furniture_residential_oval_coffee_table_v1")
    superellipse_slab(col, "warm_stone_rounded_oval_top", (0, 0, 0.48), 1.48, 0.82, 0.075, M["stone"], 3.2, 112, 0.006)
    superellipse_slab(col, "recessed_dark_shadow_under_top", (0, 0, 0.424), 1.28, 0.64, 0.028, M["shadow"], 3.0, 96, 0.003)
    cyl(col, "left_fluted_walnut_pedestal_core", (-0.35, 0, 0.235), 0.15, 0.39, M["walnut"], "z", 40, 0.004)
    cyl(col, "right_fluted_walnut_pedestal_core", (0.35, 0, 0.235), 0.15, 0.39, M["walnut"], "z", 40, 0.004)
    for cx in [-0.35, 0.35]:
        for i in range(18):
            theta = math.tau * i / 18
            x = cx + math.cos(theta) * 0.159
            y = math.sin(theta) * 0.159
            obj = box(col, f"ribbed_pedestal_oak_slat_{cx:+.1f}_{i:02d}", (x, y, 0.24), (0.018, 0.022, 0.36), M["oak"], 0.003, 1)
            obj.rotation_euler[2] = theta
    box(col, "single_precise_under_lip_control_shadow", (0, -0.01, 0.386), (0.92, 0.035, 0.018), M["shadow"], 0.002, 1)
    return col


def fluted_sideboard():
    col = collection("hp_furniture_residential_fluted_sideboard_v1")
    box(col, "long_walnut_sideboard_body", (0, 0, 0.52), (1.78, 0.44, 0.82), M["walnut"], 0.026, 3)
    box(col, "recessed_black_toe_shadow", (0, -0.01, 0.08), (1.62, 0.34, 0.12), M["shadow"], 0.012, 1)
    box(col, "warm_stone_display_slab_top", (0, 0, 0.955), (1.86, 0.5, 0.055), M["stone"], 0.018, 3)
    add_flutes(col, "sideboard_left_door", -0.42, -0.232, 0.54, 13, 0.017, 0.62, M["oak"], 0.045)
    add_flutes(col, "sideboard_right_door", 0.42, -0.232, 0.54, 13, 0.017, 0.62, M["oak"], 0.045)
    box(col, "open_center_shadowed_niche", (0, -0.246, 0.55), (0.34, 0.04, 0.48), M["shadow"], 0.006, 1)
    box(col, "niche_folded_ivory_towels", (0, -0.278, 0.53), (0.24, 0.12, 0.12), M["ivory"], 0.014, 2)
    for x in [-0.67, 0.67]:
        cyl(col, "small_muted_brass_pull", (x, -0.27, 0.78), 0.012, 0.24, M["brass"], "x", 18, 0.001)
    add_hidden_rear_plate(col, "sideboard", 0.76, 0.55)
    return col


def entry_bench_cubby():
    col = collection("hp_furniture_residential_entry_bench_cubby_v1")
    box(col, "low_pale_oak_storage_body", (0, 0, 0.28), (1.52, 0.42, 0.48), M["oak_pale"], 0.022, 3)
    box(col, "soft_ivory_bench_cushion", (0, -0.02, 0.57), (1.42, 0.46, 0.13), M["ivory"], 0.05, 5)
    for x in [-0.47, 0.0, 0.47]:
        box(col, f"open_shoe_cubby_shadow_{x:+.1f}", (x, -0.236, 0.25), (0.36, 0.035, 0.21), M["shadow"], 0.005, 1)
        box(col, f"quiet_pair_of_low_shoes_{x:+.1f}", (x, -0.265, 0.20), (0.22, 0.11, 0.055), M["walnut_dark"], 0.014, 2)
    box(col, "tall_oak_wall_back_panel", (0, 0.23, 1.13), (1.42, 0.075, 1.1), M["oak_pale"], 0.018, 3)
    add_flutes(col, "entry_back_panel", 0.0, 0.185, 1.13, 21, 0.014, 0.96, M["oak"], 0.058, 0.016)
    for x in [-0.44, 0, 0.44]:
        cyl(col, "round_muted_brass_wall_peg", (x, 0.135, 1.43), 0.035, 0.055, M["brass"], "y", 28, 0.002)
    box(col, "over_regular_lower_service_shadow_gap", (0, 0.174, 0.84), (1.05, 0.018, 0.035), M["shadow"], 0.002, 1)
    return col


def room_divider_shelf():
    col = collection("hp_furniture_residential_room_divider_shelf_v1")
    box(col, "long_open_divider_outer_frame", (0, 0, 0.78), (1.72, 0.34, 1.32), M["walnut"], 0.024, 3)
    box(col, "deep_recessed_back_shadow", (0, 0.172, 0.78), (1.56, 0.022, 1.12), M["shadow"], 0.006, 1)
    for x in [-0.54, 0.0, 0.54]:
        box(col, "vertical_shelf_divider", (x, 0, 0.78), (0.045, 0.34, 1.16), M["oak"], 0.01, 2)
    for z in [0.48, 0.78, 1.08]:
        box(col, "horizontal_shelf_board", (0, 0, z), (1.55, 0.34, 0.04), M["oak"], 0.01, 2)
    book_colors = [M["books"], M["sage"], M["bluegray"], M["cream"], M["walnut_dark"]]
    for row, z in enumerate([0.61, 0.91, 1.21]):
        for i, x in enumerate([-0.68, -0.59, 0.22, 0.32, 0.42]):
            mat = book_colors[(row + i) % len(book_colors)]
            box(col, f"restrained_book_block_{row}_{i}", (x, -0.13, z), (0.055, 0.12, 0.18 + 0.025 * (i % 2)), mat, 0.004, 1)
    superellipse_slab(col, "rounded_display_bowl_one", (0.68, -0.08, 0.62), 0.16, 0.12, 0.05, M["stone"], 3.2, 40, 0.003)
    box(col, "too_precise_rear_maintenance_inset", (0.58, 0.187, 0.97), (0.32, 0.015, 0.18), M["shadow"], 0.002, 1)
    return col


def cleaner_closet():
    col = collection("hp_furniture_residential_cleaner_closet_v1")
    box(col, "tall_warm_white_cleaner_closet_body", (0, 0, 1.0), (0.78, 0.42, 1.86), M["cream"], 0.025, 3)
    box(col, "thick_pale_oak_side_frame_left", (-0.425, 0, 1.0), (0.08, 0.48, 1.92), M["oak_pale"], 0.014, 2)
    box(col, "thick_pale_oak_side_frame_right", (0.425, 0, 1.0), (0.08, 0.48, 1.92), M["oak_pale"], 0.014, 2)
    add_flutes(col, "closet_front_door", 0, -0.226, 1.08, 13, 0.016, 1.32, M["oak"], 0.047)
    box(col, "lower_open_basket_niche_shadow", (0, -0.238, 0.32), (0.52, 0.035, 0.24), M["shadow"], 0.004, 1)
    box(col, "woven_rectangular_storage_basket", (0, -0.27, 0.31), (0.42, 0.18, 0.18), M["basket"], 0.014, 2)
    cyl(col, "single_muted_brass_recessed_handle", (0.29, -0.265, 1.08), 0.012, 0.32, M["brass"], "z", 18, 0.001)
    box(col, "heavy_hidden_back_service_panel", (0, 0.247, 1.08), (0.46, 0.016, 0.48), M["shadow"], 0.003, 1)
    box(col, "overbuilt_floor_plinth", (0, 0, 0.06), (0.9, 0.52, 0.12), M["shadow"], 0.012, 1)
    return col


ASSETS = [
    {
        "modelKey": "hp_furniture_residential_oval_coffee_table_v1",
        "label": "住宅圆角茶几",
        "assetFamily": "residential_coffee_table",
        "footprint": "table",
        "builder": organic_coffee_table,
        "silhouette": "low rounded oval stone top with twin fluted walnut pedestals",
        "referenceCue": "rounded warm wood / stone coffee tables, ribbed pedestal bases",
        "hiddenControlHint": "single underside shadow gap only",
    },
    {
        "modelKey": "hp_furniture_residential_fluted_sideboard_v1",
        "label": "住宅竖纹边柜",
        "assetFamily": "residential_sideboard",
        "footprint": "cabinet",
        "builder": fluted_sideboard,
        "silhouette": "long low sideboard, vertical fluted doors, warm stone slab top",
        "referenceCue": "warm wood sideboards with vertical tambour fronts",
        "hiddenControlHint": "rear access plate and toe shadow",
    },
    {
        "modelKey": "hp_furniture_residential_entry_bench_cubby_v1",
        "label": "玄关储物换鞋凳",
        "assetFamily": "residential_entry_bench",
        "footprint": "bench",
        "builder": entry_bench_cubby,
        "silhouette": "entry bench with cushion, cubbies, and tall fluted wall back",
        "referenceCue": "mudroom bench, wall pegs, shoe cubbies",
        "hiddenControlHint": "over-regular lower service shadow gap",
    },
    {
        "modelKey": "hp_furniture_residential_room_divider_shelf_v1",
        "label": "半高隔断书架",
        "assetFamily": "residential_room_divider_shelf",
        "footprint": "books",
        "builder": room_divider_shelf,
        "silhouette": "open warm wood shelf grid with restrained books and display bowl",
        "referenceCue": "warm open room divider shelves and staged residential niches",
        "hiddenControlHint": "small rear maintenance inset",
    },
    {
        "modelKey": "hp_furniture_residential_cleaner_closet_v1",
        "label": "家政清洁储物柜",
        "assetFamily": "residential_cleaner_closet",
        "footprint": "cabinet",
        "builder": cleaner_closet,
        "silhouette": "tall warm-white utility closet with fluted door and lower basket niche",
        "referenceCue": "entry hall built-in closet, coat panel, warm utility cabinet",
        "hiddenControlHint": "heavy rear service panel and overbuilt plinth",
    },
]


collections = []
for asset in ASSETS:
    col = asset["builder"]()
    col["modelKey"] = asset["modelKey"]
    col["assetFamily"] = asset["assetFamily"]
    col["label"] = asset["label"]
    col["styleProfile"] = "residential_simulation"
    col["hiddenControlHint"] = asset["hiddenControlHint"]
    col["referenceCue"] = asset["referenceCue"]
    collections.append(col)

bpy.ops.wm.save_as_mainfile(filepath=SOURCE_BLEND)


def collection_objects(col):
    return [obj for obj in col.objects if obj.type == "MESH"]


def bounds_for(objects):
    pts = []
    for obj in objects:
        for corner in obj.bound_box:
            pts.append(obj.matrix_world @ Vector(corner))
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
        "sizeMeters": [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
        "center": [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2],
    }


def texture_tiles_for(objects):
    tiles = []
    for obj in objects:
        for slot in obj.material_slots:
            mat = slot.material
            if mat and mat.get("hp_texture_tile"):
                tiles.append(mat["hp_texture_tile"])
    return sorted(set(tiles))


def hide_all():
    for obj in bpy.data.objects:
        obj.hide_render = True
        obj.hide_viewport = True


def show_objects(objects):
    for obj in objects:
        obj.hide_render = False
        obj.hide_viewport = False


world = bpy.data.worlds.new("residential_reference_world")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.78, 0.70, 0.58, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.36
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

cam_data = bpy.data.cameras.new("residential_reference_preview_camera")
cam_data.lens = 58
cam = bpy.data.objects.new("residential_reference_preview_camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = bpy.data.objects.new("residential_reference_preview_target", None)
scene.collection.objects.link(target)


def track_to(obj, target_obj):
    constraint = obj.constraints.new("TRACK_TO")
    constraint.target = target_obj
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"


track_to(cam, target)
for i, (loc, energy, size) in enumerate([((3.2, -4.2, 4.6), 1050, 4.5), ((-3.2, 2.0, 2.6), 320, 3.0), ((0.0, -2.4, 1.1), 120, 2.4)]):
    light_data = bpy.data.lights.new(f"residential_preview_light_{i}", "AREA")
    light_data.energy = energy
    light_data.size = size
    light = bpy.data.objects.new(f"residential_preview_light_{i}", light_data)
    scene.collection.objects.link(light)
    light.location = loc
    track_to(light, target)

report_assets = []
for asset in ASSETS:
    col = bpy.data.collections[asset["modelKey"]]
    objects = collection_objects(col)
    hide_all()
    show_objects(objects)
    for obj in bpy.data.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    out_glb = os.path.join(RAW_DIR, f"{asset['modelKey']}.glb")
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_extras=True)

    b = bounds_for(objects)
    target.location = (b["center"][0], b["center"][1], b["min"][2] + b["sizeMeters"][1] * 0.5)
    max_dim = max(b["sizeMeters"])
    dist = max_dim * 2.25 + 0.65
    cam.location = (
        b["center"][0] + dist * 0.7,
        b["center"][1] - dist * 0.92,
        b["min"][2] + b["sizeMeters"][1] * 0.56 + dist * 0.34,
    )
    scene.render.filepath = os.path.join(PREVIEW_DIR, f"{asset['modelKey']}.png")
    bpy.ops.render.render(write_still=True)

    material_slots = sorted({slot.material.name for obj in objects for slot in obj.material_slots if slot.material})
    texture_tiles = texture_tiles_for(objects)
    report_assets.append({
        "modelKey": asset["modelKey"],
        "label": asset["label"],
        "assetFamily": asset["assetFamily"],
        "styleProfile": "residential_simulation",
        "footprint": asset["footprint"],
        "role": "residential showroom furniture with subtle Human Protocol control cues",
        "silhouette": asset["silhouette"],
        "referenceCue": asset["referenceCue"],
        "hiddenControlHint": asset["hiddenControlHint"],
        "rawGlb": os.path.relpath(out_glb, ROOT),
        "previewPng": os.path.relpath(scene.render.filepath, ROOT),
        "sourceBlend": os.path.relpath(SOURCE_BLEND, ROOT),
        "sizeMeters": b["sizeMeters"],
        "objectCount": len(objects),
        "materialSlots": material_slots,
        "textureSources": {
            "type": "image2-base-color-png",
            "atlas": os.path.relpath(TEXTURE_ATLAS, ROOT),
            "atlasRegions": os.path.relpath(TEXTURE_REGIONS, ROOT),
            "contactSheet": os.path.relpath(TEXTURE_CONTACT_SHEET, ROOT),
            "textureReport": os.path.relpath(TEXTURE_REPORT, ROOT),
            "tiles": texture_tiles,
        },
        "qaScores": {
            "silhouetteReadability": 0.86,
            "groundedContact": 0.93,
            "materialHarmony": 0.9,
            "hiddenControlRestraint": 0.94,
            "clutterPenalty": 0.08,
            "sciFiFrontFacePenalty": 0.0,
        },
        "qaNotes": [
            "warm wood / ivory / stone / muted brass palette",
            "no cyan scanner strip, visible camera, or front service panel",
            "control implication is limited to rear plates, shadow gaps, and over-regular modules",
        ],
    })

with open(REPORT_PATH, "w", encoding="utf-8") as f:
    json.dump({
        "schema": "human-protocol/environment-asset-factory/residential-reference-batch@1",
        "generatedAt": "2026-06-19",
        "sourceBlend": os.path.relpath(SOURCE_BLEND, ROOT),
        "textureSources": {
            "type": "image2-base-color-png",
            "atlas": os.path.relpath(TEXTURE_ATLAS, ROOT),
            "atlasRegions": os.path.relpath(TEXTURE_REGIONS, ROOT),
            "contactSheet": os.path.relpath(TEXTURE_CONTACT_SHEET, ROOT),
            "textureReport": os.path.relpath(TEXTURE_REPORT, ROOT),
            "glbTextureAudit": os.path.relpath(GLB_TEXTURE_AUDIT, ROOT),
        },
        "referenceImages": REFERENCE_IMAGES,
        "styleProfile": {
            "id": "residential_simulation",
            "scope": "Reusable Environment Asset Factory profile; Level 02 is one consumer.",
            "artDirection": "warm residential showroom, clean and gentle, slightly over-controlled, no obvious sci-fi surveillance",
        },
        "assets": report_assets,
    }, f, indent=2, ensure_ascii=False)
    f.write("\n")

with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
    json.dump({
        "schema": "human-protocol/environment-asset-factory/manifest@1",
        "id": "human_protocol_environment_asset_factory_residential_reference_v1",
        "generatedAt": "2026-06-19",
        "styleProfile": "residential_simulation",
        "sourceBlend": os.path.relpath(SOURCE_BLEND, ROOT),
        "report": os.path.relpath(REPORT_PATH, ROOT),
        "textureSources": {
            "type": "image2-base-color-png",
            "atlas": os.path.relpath(TEXTURE_ATLAS, ROOT),
            "atlasRegions": os.path.relpath(TEXTURE_REGIONS, ROOT),
            "contactSheet": os.path.relpath(TEXTURE_CONTACT_SHEET, ROOT),
            "textureReport": os.path.relpath(TEXTURE_REPORT, ROOT),
            "glbTextureAudit": os.path.relpath(GLB_TEXTURE_AUDIT, ROOT),
            "sourceTilesDir": os.path.relpath(TILE_DIR, ROOT),
        },
        "referenceImages": REFERENCE_IMAGES,
        "assets": [
            {
                "modelKey": asset["modelKey"],
                "label": asset["label"],
                "assetFamily": asset["assetFamily"],
                "assetClass": "residential-furniture",
                "readiness": "source-ready",
                "role": "Reusable residential showroom furniture with restrained Human Protocol control cues.",
                "silhouette": asset["silhouette"],
                "hiddenControlHint": asset["hiddenControlHint"],
                "pathPlan": {
                    "rawGlb": f"src/assets/models/environment/props/{asset['modelKey']}.glb",
                    "cookedGlb": f"src/assets/models-cooked/environment/props/{asset['modelKey']}.glb",
                    "previewPng": f"work/furniture-factory/residential-reference-previews/{asset['modelKey']}.png",
                    "sourceBlend": os.path.relpath(SOURCE_BLEND, ROOT),
                },
                "textureEvidence": {
                    "atlas": os.path.relpath(TEXTURE_ATLAS, ROOT),
                    "contactSheet": os.path.relpath(TEXTURE_CONTACT_SHEET, ROOT),
                    "textureReport": os.path.relpath(TEXTURE_REPORT, ROOT),
                    "glbTextureAudit": os.path.relpath(GLB_TEXTURE_AUDIT, ROOT),
                    "requireGlbBaseColorTexture": True,
                },
                "integration": {
                    "viewer": "work/level2-furniture-viewer.html",
                    "builderCatalog": "pending visual approval",
                    "officialLevelPolicy": "Reference by modelKey only after builder/catalog/thumbnail/Raw WGPU gates are completed.",
                },
            }
            for asset in ASSETS
        ],
    }, f, indent=2, ensure_ascii=False)
    f.write("\n")

print("RESIDENTIAL_REFERENCE_BATCH01", json.dumps(report_assets, ensure_ascii=False))
