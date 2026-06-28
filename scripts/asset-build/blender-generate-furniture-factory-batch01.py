import bpy
import json
import math
import os
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW_DIR = os.path.join(ROOT, "src/assets/models/environment/props")
SOURCE_BLEND = os.path.join(ROOT, "src/assets/source_blend/furniture/human_protocol_furniture_factory_batch01.blend")
PREVIEW_DIR = os.path.join(ROOT, "work/furniture-factory/previews")
REPORT_PATH = os.path.join(ROOT, "src/assets/manifests/reports/furniture_factory_batch01_blender_report.json")

for path in [RAW_DIR, os.path.dirname(SOURCE_BLEND), PREVIEW_DIR, os.path.dirname(REPORT_PATH)]:
    os.makedirs(path, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def make_mat(name, color, metallic=0.0, roughness=0.65, alpha=1.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (color[0], color[1], color[2], alpha)
    mat.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    mat.use_screen_refraction = alpha < 1.0
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], alpha)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    if emission and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (emission[0], emission[1], emission[2], 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


M = {
    "dark_metal": make_mat("hp_dark_smoked_metal", (0.072, 0.079, 0.078), 0.82, 0.38),
    "black_stone": make_mat("hp_black_museum_stone", (0.082, 0.078, 0.068), 0.05, 0.72),
    "brass": make_mat("hp_aged_brass_trim", (0.72, 0.46, 0.18), 0.86, 0.32),
    "cyan": make_mat("hp_cyan_exhibit_emissive", (0.13, 0.85, 0.95), 0.0, 0.22, 1.0, (0.1, 0.95, 1.0), 1.8),
    "cyan_soft": make_mat("hp_cyan_soft_panel", (0.08, 0.45, 0.5), 0.25, 0.45, 1.0, (0.05, 0.7, 0.8), 0.55),
    "glass": make_mat("hp_near_clear_cyan_glass", (0.54, 0.88, 0.94), 0.0, 0.04, 0.18),
    "glass_edge": make_mat("hp_glass_edge_glint", (0.72, 0.98, 1.0), 0.0, 0.08, 0.42, (0.3, 0.85, 1.0), 0.35),
    "leather": make_mat("hp_dark_gallery_leather", (0.14, 0.095, 0.068), 0.0, 0.58),
    "rubber": make_mat("hp_black_rubber_wheel", (0.035, 0.036, 0.036), 0.0, 0.45),
    "stone": make_mat("hp_cool_pale_stone", (0.58, 0.61, 0.56), 0.0, 0.68),
    "white": make_mat("hp_sterile_off_white", (0.72, 0.76, 0.74), 0.05, 0.46),
    "amber": make_mat("hp_muted_amber_specimen", (0.85, 0.52, 0.18), 0.15, 0.38, 1.0, (0.85, 0.38, 0.1), 0.7),
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


def apply_mods(obj, bevel=0.0, segments=1):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("small_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as exc:
            print("BEVEL_SKIP", obj.name, str(exc)[:80])
    try:
        obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    except Exception:
        pass
    try:
        obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    except Exception:
        pass
    obj.select_set(False)
    return obj


def box(col, name, loc, size, mat, bevel=0.01, segments=1):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    link_to(col, obj)
    return apply_mods(obj, bevel, segments)


def cyl(col, name, loc, radius, depth, mat, axis="z", verts=32, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == "x":
        obj.rotation_euler[1] = math.radians(90)
    elif axis == "y":
        obj.rotation_euler[0] = math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    link_to(col, obj)
    return apply_mods(obj, bevel, 1)


def sphere(col, name, loc, radius, mat, subdivisions=2, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    link_to(col, obj)
    return apply_mods(obj, 0.0, 1)


def torus(col, name, loc, major, minor, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=40, minor_segments=10, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = tuple(math.radians(v) for v in rot)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    link_to(col, obj)
    return apply_mods(obj, 0.0, 1)


def add_corner_posts(col, width, depth, zmin, zmax, radius=0.025):
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            cyl(col, "corner_brass_post", (sx * width / 2, sy * depth / 2, (zmin + zmax) / 2), radius, zmax - zmin, M["brass"], "z", 20)


def add_glass_box(col, width, depth, zmin, zmax, thickness=0.018):
    height = zmax - zmin
    box(col, "glass_front_panel", (0, -depth / 2, zmin + height / 2), (width, thickness, height), M["glass"], 0.002)
    box(col, "glass_back_panel", (0, depth / 2, zmin + height / 2), (width, thickness, height), M["glass"], 0.002)
    box(col, "glass_left_panel", (-width / 2, 0, zmin + height / 2), (thickness, depth, height), M["glass"], 0.002)
    box(col, "glass_right_panel", (width / 2, 0, zmin + height / 2), (thickness, depth, height), M["glass"], 0.002)
    box(col, "glass_top_panel", (0, 0, zmax), (width, depth, thickness), M["glass"], 0.002)
    for sx in [-1, 1]:
        box(col, "glass_vertical_edge_glint", (sx * width / 2, -depth / 2 - 0.002, zmin + height / 2), (0.012, 0.012, height), M["glass_edge"], 0.001)
        box(col, "glass_vertical_edge_glint", (sx * width / 2, depth / 2 + 0.002, zmin + height / 2), (0.012, 0.012, height), M["glass_edge"], 0.001)


def glass_display_case():
    col = collection("hp_furniture_museum_glass_display_case_v1")
    box(col, "heavy_black_stone_base", (0, 0, 0.14), (1.38, 0.78, 0.28), M["black_stone"], 0.025, 2)
    box(col, "thin_brass_base_trim", (0, -0.405, 0.29), (1.42, 0.035, 0.05), M["brass"], 0.006)
    box(col, "thin_brass_base_trim", (0, 0.405, 0.29), (1.42, 0.035, 0.05), M["brass"], 0.006)
    add_glass_box(col, 1.22, 0.64, 0.3, 1.92, 0.016)
    add_corner_posts(col, 1.25, 0.67, 0.25, 1.96, 0.018)
    box(col, "internal_lit_floor", (0, 0, 0.36), (0.82, 0.42, 0.035), M["cyan_soft"], 0.006)
    cyl(col, "suspended_specimen_spine", (0, 0, 1.08), 0.035, 1.05, M["white"], "z", 28)
    torus(col, "specimen_memory_ring", (0, 0, 1.14), 0.23, 0.012, M["cyan"], (90, 0, 0))
    sphere(col, "small_amber_memory_core", (0, 0, 1.18), 0.115, M["amber"], 2, (1, 0.72, 1))
    box(col, "top_dark_cap", (0, 0, 1.99), (1.34, 0.76, 0.08), M["dark_metal"], 0.018, 2)
    return col


def horizontal_tool_case():
    col = collection("hp_furniture_museum_horizontal_tool_case_v1")
    box(col, "long_museum_plinth", (0, 0, 0.13), (2.36, 0.82, 0.26), M["black_stone"], 0.025, 2)
    add_glass_box(col, 2.1, 0.66, 0.28, 0.86, 0.014)
    for x in [-1.02, 1.02]:
        box(col, "brass_end_clamp", (x, 0, 0.62), (0.07, 0.72, 0.62), M["brass"], 0.012)
    cyl(col, "contained_archive_rod", (-0.34, 0, 0.54), 0.04, 1.05, M["dark_metal"], "x", 32)
    cyl(col, "contained_cyan_energy_tube", (-0.34, 0, 0.54), 0.026, 0.74, M["cyan"], "x", 28)
    cyl(col, "contained_short_sidearm_body", (0.54, -0.05, 0.54), 0.05, 0.62, M["dark_metal"], "x", 28)
    box(col, "contained_sidearm_grip", (0.38, 0.08, 0.43), (0.16, 0.07, 0.28), M["brass"], 0.012)
    box(col, "internal_case_light_strip", (0, -0.34, 0.33), (1.72, 0.025, 0.025), M["cyan"], 0.004)
    return col


def gallery_bench():
    col = collection("hp_furniture_museum_gallery_bench_v1")
    box(col, "long_dark_leather_seat", (0, 0, 0.45), (2.0, 0.48, 0.12), M["leather"], 0.045, 4)
    box(col, "underseat_brass_rail", (0, 0, 0.36), (1.76, 0.08, 0.06), M["brass"], 0.01)
    for x in [-0.72, 0.72]:
        box(col, "slim_metal_leg", (x, -0.16, 0.2), (0.08, 0.06, 0.36), M["dark_metal"], 0.012)
        box(col, "slim_metal_leg", (x, 0.16, 0.2), (0.08, 0.06, 0.36), M["dark_metal"], 0.012)
        box(col, "small_floor_foot", (x, 0, 0.035), (0.34, 0.36, 0.07), M["black_stone"], 0.012)
    return col


def archive_cabinet():
    col = collection("hp_furniture_archive_cabinet_v1")
    box(col, "archive_cabinet_body", (0, 0, 0.82), (0.92, 0.56, 1.64), M["dark_metal"], 0.024, 2)
    box(col, "stone_toe_base", (0, 0, 0.08), (0.98, 0.6, 0.16), M["black_stone"], 0.014)
    for row in range(5):
        z = 0.32 + row * 0.255
        box(col, "drawer_face", (0, -0.292, z), (0.8, 0.026, 0.19), M["white"] if row == 4 else M["dark_metal"], 0.006)
        cyl(col, "drawer_brass_pull", (0, -0.324, z), 0.018, 0.35, M["brass"], "x", 18)
        box(col, "drawer_label_strip", (0.28, -0.34, z + 0.04), (0.18, 0.012, 0.035), M["cyan_soft"], 0.003)
    return col


def maintenance_cart():
    col = collection("hp_furniture_maintenance_cart_v1")
    box(col, "lower_cart_shelf", (0, 0, 0.24), (1.08, 0.6, 0.08), M["dark_metal"], 0.018)
    box(col, "upper_cart_shelf", (0, 0, 0.78), (1.08, 0.6, 0.08), M["dark_metal"], 0.018)
    for x in [-0.46, 0.46]:
        for y in [-0.24, 0.24]:
            cyl(col, "cart_vertical_post", (x, y, 0.52), 0.018, 0.64, M["brass"], "z", 16)
            torus(col, "rubber_wheel", (x, y, 0.065), 0.07, 0.016, M["rubber"], (90, 0, 0))
    cyl(col, "push_handle_bar", (0, 0.36, 0.95), 0.025, 0.9, M["brass"], "x", 24)
    for x in [-0.22, 0.0, 0.22]:
        cyl(col, "cyan_repair_canister", (x, -0.02, 0.52), 0.06, 0.36, M["cyan_soft"], "z", 24, 0.004)
        cyl(col, "canister_brass_cap", (x, -0.02, 0.72), 0.065, 0.035, M["brass"], "z", 24)
    return col


def display_plinth():
    col = collection("hp_furniture_display_plinth_v1")
    box(col, "tapered_lower_block", (0, 0, 0.28), (0.86, 0.86, 0.56), M["black_stone"], 0.022, 2)
    box(col, "pale_stone_display_core", (0, 0, 0.72), (0.68, 0.68, 0.34), M["stone"], 0.018, 2)
    box(col, "top_brass_plate", (0, 0, 0.91), (0.78, 0.78, 0.035), M["brass"], 0.006)
    box(col, "front_cyan_status_slit", (0, -0.405, 0.74), (0.42, 0.012, 0.035), M["cyan"], 0.002)
    return col


def wall_archive_cabinet():
    col = collection("hp_furniture_wall_archive_cabinet_v1")
    box(col, "wall_mounted_backplate", (0, 0.06, 0.68), (1.28, 0.12, 1.12), M["black_stone"], 0.018, 2)
    box(col, "shallow_archive_case", (0, -0.03, 0.68), (1.14, 0.18, 0.96), M["dark_metal"], 0.014)
    for x in [-0.33, 0.0, 0.33]:
        for z in [0.46, 0.68, 0.9]:
            box(col, "thin_document_slot", (x, -0.13, z), (0.26, 0.025, 0.13), M["white"], 0.004)
            box(col, "document_slot_cyan_tick", (x + 0.08, -0.15, z + 0.035), (0.06, 0.012, 0.018), M["cyan_soft"], 0.002)
    cyl(col, "bottom_data_cable", (0, -0.14, 0.18), 0.018, 0.86, M["brass"], "x", 18)
    return col


def lab_table():
    col = collection("hp_furniture_lab_table_v1")
    box(col, "sterile_lab_tabletop", (0, 0, 0.82), (1.82, 0.76, 0.09), M["white"], 0.02, 2)
    box(col, "dark_underframe", (0, 0, 0.68), (1.62, 0.58, 0.1), M["dark_metal"], 0.012)
    for x in [-0.75, 0.75]:
        for y in [-0.27, 0.27]:
            box(col, "lab_table_leg", (x, y, 0.36), (0.07, 0.07, 0.64), M["dark_metal"], 0.012)
    box(col, "left_inset_glass_tray", (-0.48, 0, 0.89), (0.54, 0.42, 0.025), M["glass"], 0.003)
    cyl(col, "small_probe_bar", (0.36, 0, 0.91), 0.018, 0.56, M["brass"], "x", 18)
    sphere(col, "cyan_sample_core", (0.66, 0.0, 0.94), 0.08, M["cyan"], 2, (1, 1, 0.55))
    box(col, "front_control_strip", (0, -0.395, 0.75), (0.78, 0.018, 0.05), M["cyan_soft"], 0.003)
    return col


def ceiling_light_slot():
    col = collection("hp_furniture_cold_ceiling_light_slot_v1")
    box(col, "long_recessed_dark_housing", (0, 0, 0.06), (2.05, 0.34, 0.12), M["dark_metal"], 0.018, 2)
    box(col, "cyan_diffuser_bar", (0, 0, 0.095), (1.72, 0.12, 0.025), M["cyan"], 0.006)
    for x in [-0.92, 0.92]:
        box(col, "brass_ceiling_mount_cap", (x, 0, 0.12), (0.16, 0.38, 0.06), M["brass"], 0.006)
    return col


def specimen_plinth_combo():
    col = collection("hp_furniture_specimen_plinth_combo_v1")
    box(col, "black_square_plinth", (0, 0, 0.31), (0.92, 0.92, 0.62), M["black_stone"], 0.025, 2)
    box(col, "brass_top_lip", (0, 0, 0.64), (0.82, 0.82, 0.045), M["brass"], 0.007)
    add_glass_box(col, 0.54, 0.54, 0.68, 1.36, 0.012)
    sphere(col, "abstract_specimen_core", (0, 0, 1.02), 0.14, M["cyan"], 2, (1.0, 0.72, 1.25))
    torus(col, "brass_specimen_orbit", (0, 0, 1.02), 0.23, 0.01, M["brass"], (90, 0, 0))
    cyl(col, "thin_specimen_pin", (0, 0, 1.02), 0.012, 0.55, M["white"], "z", 16)
    return col


ASSETS = [
    ("hp_furniture_museum_glass_display_case_v1", "玻璃展示柜", "display_case", glass_display_case, [1.38, 2.05, 0.78]),
    ("hp_furniture_museum_horizontal_tool_case_v1", "横向武器/工具柜", "display_case", horizontal_tool_case, [2.36, 0.90, 0.82]),
    ("hp_furniture_museum_gallery_bench_v1", "博物馆长椅", "table", gallery_bench, [2.0, 0.51, 0.48]),
    ("hp_furniture_archive_cabinet_v1", "档案柜", "cabinet", archive_cabinet, [0.98, 1.64, 0.62]),
    ("hp_furniture_maintenance_cart_v1", "金属检修推车", "table", maintenance_cart, [1.08, 1.02, 0.72]),
    ("hp_furniture_display_plinth_v1", "展示底座", "pedestal", display_plinth, [0.86, 0.93, 0.86]),
    ("hp_furniture_wall_archive_cabinet_v1", "壁挂资料柜", "wall_panel", wall_archive_cabinet, [1.28, 1.24, 0.24]),
    ("hp_furniture_lab_table_v1", "实验桌", "table", lab_table, [1.82, 0.97, 0.80]),
    ("hp_furniture_cold_ceiling_light_slot_v1", "冷光天花灯槽", "lamp", ceiling_light_slot, [2.05, 0.16, 0.38]),
    ("hp_furniture_specimen_plinth_combo_v1", "小型雕塑/标本底座组合", "pedestal", specimen_plinth_combo, [0.92, 1.41, 0.92]),
]

collections = []
for model_key, label, footprint, builder, expected_size in ASSETS:
    col = builder()
    col["modelKey"] = model_key
    col["label"] = label
    col["footprint"] = footprint
    col["expectedSizeMeters"] = json.dumps(expected_size)
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
        "min": [min(xs), min(ys), min(zs)],
        "max": [max(xs), max(ys), max(zs)],
        "sizeMeters": [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)],
        "center": [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2],
    }


def hide_all():
    for obj in bpy.data.objects:
        obj.hide_render = True
        obj.hide_viewport = True


def show_objects(objects):
    for obj in objects:
        obj.hide_render = False
        obj.hide_viewport = False


world = bpy.data.worlds.new("furniture_thumb_world")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.028, 0.032, 0.036, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.68
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 72
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

cam_data = bpy.data.cameras.new("furniture_thumb_camera")
cam_data.lens = 54
cam = bpy.data.objects.new("furniture_thumb_camera", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
target = bpy.data.objects.new("furniture_thumb_target", None)
scene.collection.objects.link(target)


def track_to(obj, target_obj):
    constraint = obj.constraints.new("TRACK_TO")
    constraint.target = target_obj
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"


track_to(cam, target)
for i, (loc, energy) in enumerate([((3.0, -4.0, 5.0), 6.2), ((-4.0, 2.5, 3.0), 2.7), ((0.0, -3.0, 1.2), 1.2)]):
    light_data = bpy.data.lights.new(f"thumb_key_{i}", "AREA")
    light_data.energy = energy * 250
    light_data.size = 4.0 if i == 0 else 3.0
    light = bpy.data.objects.new(f"thumb_key_{i}", light_data)
    scene.collection.objects.link(light)
    light.location = loc
    track_to(light, target)

report_assets = []
for model_key, label, footprint, _builder, expected_size in ASSETS:
    col = bpy.data.collections[model_key]
    objects = collection_objects(col)
    hide_all()
    show_objects(objects)
    for obj in bpy.data.objects:
        obj.select_set(False)
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]

    out_glb = os.path.join(RAW_DIR, f"{model_key}.glb")
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)

    b = bounds_for(objects)
    target.location = (b["center"][0], b["center"][1], b["min"][2] + b["sizeMeters"][1] * 0.52)
    max_dim = max(b["sizeMeters"])
    dist = max_dim * 2.35 + 0.9
    cam.location = (b["center"][0] + dist * 0.62, b["center"][1] - dist * 0.92, b["min"][2] + b["sizeMeters"][1] * 0.55 + dist * 0.38)
    scene.render.filepath = os.path.join(PREVIEW_DIR, f"{model_key}.png")
    bpy.ops.render.render(write_still=True)

    report_assets.append({
        "modelKey": model_key,
        "label": label,
        "footprint": footprint,
        "rawGlb": os.path.relpath(out_glb, ROOT),
        "previewPng": os.path.relpath(scene.render.filepath, ROOT),
        "sourceBlend": os.path.relpath(SOURCE_BLEND, ROOT),
        "sizeMeters": b["sizeMeters"],
        "expectedSizeMeters": expected_size,
        "objectCount": len(objects),
        "materialSlots": sorted({slot.material.name for obj in objects for slot in obj.material_slots if slot.material}),
    })

with open(REPORT_PATH, "w") as f:
    json.dump({
        "schema": "human-protocol/furniture-factory-blender-report@1",
        "sourceBlend": os.path.relpath(SOURCE_BLEND, ROOT),
        "assets": report_assets,
    }, f, indent=2)
    f.write("\n")

print("FURNITURE_FACTORY_BATCH01", json.dumps(report_assets, ensure_ascii=False))
