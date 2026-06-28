import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = REPO_ROOT / "src" / "assets" / "models" / "viewmodel" / "prototypes"
BLEND_DIR = REPO_ROOT / "src" / "assets" / "source_blend" / "viewmodel"
REPORT_PATH = REPO_ROOT / "src" / "assets" / "manifests" / "reports" / "hp_viewmodel_production_prototypes_report.json"

OLD_TO_BLENDER = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
BLENDER_TO_OLD = OLD_TO_BLENDER.inverted()


def old_loc(value):
    return OLD_TO_BLENDER @ Vector(value)


def old_rot(value):
    old_matrix = Euler(value, "XYZ").to_matrix()
    return (OLD_TO_BLENDER @ old_matrix @ BLENDER_TO_OLD).to_euler("XYZ")


def old_dims(value):
    return (value[0], value[2], value[1])


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablock in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(datablock):
            datablock.remove(item)


def find_principled(nodes):
    return next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)


def bsdf_input(bsdf, names):
    for socket in bsdf.inputs:
        if socket.identifier in names or socket.name in names:
            return socket
    return None


def set_principled_input(bsdf, names, value):
    if isinstance(names, str):
        names = (names,)
    socket = bsdf_input(bsdf, names)
    if socket:
        try:
            socket.default_value = value
        except TypeError:
            socket.default_value = value[: len(socket.default_value)]


def make_detail_image(asset_id, size=512):
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    image = bpy.data.images.new(f"hp_{asset_id}_production_detail_512", width=size, height=size, alpha=True)
    image.colorspace_settings.name = "sRGB"
    rng = random.Random(f"human-protocol-{asset_id}-production-detail")
    pixels = [0.0] * (size * size * 4)

    scratches = []
    for _ in range(120 if asset_id == "sidearm" else 96):
        scratches.append(
            {
                "x": rng.random(),
                "y": rng.random(),
                "length": rng.uniform(0.07, 0.38),
                "angle": rng.uniform(-0.22, 0.22) + (math.pi * 0.5 if asset_id == "iron_rod" and rng.random() < 0.55 else 0),
                "width": rng.uniform(0.0015, 0.0045),
                "bright": rng.choice((-1.0, 1.0)) * rng.uniform(0.035, 0.13),
            }
        )

    for y in range(size):
        v = y / (size - 1)
        for x in range(size):
            u = x / (size - 1)
            grain = (hash01(int(u * 450), int(v * 450)) - 0.5) * 0.16
            cell = (hash01(int(u * 95) + 17, int(v * 95) + 31) - 0.5) * 0.08
            stripe = math.sin((u * (92 if asset_id == "iron_rod" else 132) + v * 10.5) * math.tau) * 0.035
            cross = math.sin((v * 38 + u * 5.0) * math.tau) * 0.02
            worn = clamp(0.58 + grain + cell + stripe + cross, 0.18, 0.92)
            index = (y * size + x) * 4
            pixels[index + 0] = worn * 0.96
            pixels[index + 1] = clamp(worn * 1.02, 0, 1)
            pixels[index + 2] = clamp(worn * 1.04, 0, 1)
            pixels[index + 3] = 1.0

    for scratch in scratches:
        draw_scratch(pixels, size, scratch)
    draw_registry_marks(pixels, size, asset_id)

    image.pixels.foreach_set(pixels)
    image.update()
    image_path = BLEND_DIR / f"hp_viewmodel_{asset_id}_production_detail_512.png"
    image.filepath_raw = str(image_path)
    image.file_format = "PNG"
    image.save()
    loaded = bpy.data.images.load(str(image_path), check_existing=False)
    loaded.name = f"hp_{asset_id}_production_detail_512"
    loaded.colorspace_settings.name = "sRGB"
    loaded.pack()
    bpy.data.images.remove(image)
    return loaded, image_path


def draw_scratch(pixels, size, scratch):
    ca = math.cos(scratch["angle"])
    sa = math.sin(scratch["angle"])
    length_px = max(6, int(scratch["length"] * size))
    radius = max(1, int(scratch["width"] * size))
    center_x = scratch["x"] * (size - 1)
    center_y = scratch["y"] * (size - 1)
    for step in range(length_px):
        along = (step / max(1, length_px - 1) - 0.5) * scratch["length"] * size
        fade = max(0.0, 1.0 - abs(step / max(1, length_px - 1) - 0.5) * 1.65)
        px = int(center_x + along * ca)
        py = int(center_y + along * sa)
        if px < 0 or py < 0 or px >= size or py >= size:
            continue
        for yy in range(py - radius, py + radius + 1):
            if yy < 0 or yy >= size:
                continue
            for xx in range(px - radius, px + radius + 1):
                if xx < 0 or xx >= size:
                    continue
                edge = max(0.0, 1.0 - math.hypot(xx - px, yy - py) / (radius + 0.55))
                amount = scratch["bright"] * fade * edge
                index = (yy * size + xx) * 4
                pixels[index + 0] = clamp(pixels[index + 0] + amount * 0.9, 0, 1)
                pixels[index + 1] = clamp(pixels[index + 1] + amount, 0, 1)
                pixels[index + 2] = clamp(pixels[index + 2] + amount * 1.05, 0, 1)


def draw_registry_marks(pixels, size, asset_id):
    if asset_id == "iron_rod":
        bars = [(0.22, 0.18, 0.18, 0.014), (0.52, 0.48, 0.12, 0.012), (0.74, 0.82, 0.16, 0.014)]
    else:
        bars = [(0.2, 0.23, 0.13, 0.014), (0.42, 0.18, 0.16, 0.012), (0.7, 0.28, 0.11, 0.014)]
    for u, v, width, height in bars:
        fill_rect(pixels, size, u, v, width, height, 0.13)


def fill_rect(pixels, size, u, v, width, height, delta):
    min_x = max(0, int((u - width * 0.5) * size))
    max_x = min(size - 1, int((u + width * 0.5) * size))
    min_y = max(0, int((v - height * 0.5) * size))
    max_y = min(size - 1, int((v + height * 0.5) * size))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            index = (y * size + x) * 4
            pixels[index + 0] = clamp(pixels[index + 0] + delta, 0, 1)
            pixels[index + 1] = clamp(pixels[index + 1] + delta * 1.08, 0, 1)
            pixels[index + 2] = clamp(pixels[index + 2] + delta * 1.12, 0, 1)


def make_mat(name, color, metalness, roughness, detail_image=None, emissive=None, emissive_strength=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = find_principled(material.node_tree.nodes)
    if bsdf is None:
        bsdf = material.node_tree.nodes.new(type="ShaderNodeBsdfPrincipled")
    if bsdf:
        set_principled_input(bsdf, ("Base Color",), color)
        set_principled_input(bsdf, ("Metallic",), metalness)
        set_principled_input(bsdf, ("Roughness",), roughness)
        if emissive:
            set_principled_input(bsdf, ("Emission Color", "Emission"), emissive)
            set_principled_input(bsdf, ("Emission Strength",), emissive_strength)
        if detail_image:
            texture = material.node_tree.nodes.new(type="ShaderNodeTexImage")
            texture.name = f"{name}_detail_map"
            texture.image = detail_image
            texture.extension = "REPEAT"
            base_color = bsdf_input(bsdf, ("Base Color",))
            if base_color:
                material.node_tree.links.new(texture.outputs["Color"], base_color)
                material["hp_uses_viewmodel_detail_texture"] = True
    return material


def material_set(asset_id):
    detail_image, image_path = make_detail_image(asset_id)
    return {
        "imagePath": image_path,
        "hero": make_mat("hp_scraped_hero_steel_edge_production", (0.84, 0.92, 0.86, 1), 0.98, 0.34, detail_image),
        "steel": make_mat("hp_battered_titanium_steel_panel_production", (0.68, 0.76, 0.72, 1), 0.96, 0.46, detail_image),
        "dark": make_mat("hp_oxidized_dark_core_shadow_production", (0.18, 0.26, 0.25, 1), 0.88, 0.7, detail_image),
        "grip": make_mat("hp_black_rubber_grip_wrap_production", (0.28, 0.34, 0.32, 1), 0.45, 0.84, detail_image),
        "bronze": make_mat("hp_oiled_bronze_amber_inlay_production", (0.78, 0.54, 0.28, 1), 0.92, 0.52, detail_image),
        "cyan": make_mat("hp_protocol_cyan_energy_glass_production", (0.34, 0.76, 0.78, 1), 0.16, 0.36, None, (0.0, 0.1, 0.12, 1), 0.55),
        "warning": make_mat("hp_muted_red_warning_status_production", (0.72, 0.16, 0.11, 1), 0.34, 0.42, None, (0.12, 0.01, 0.0, 1), 0.18),
    }


def apply_modifier(obj, modifier):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_uv(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if obj.data.uv_layers:
        return obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def polish(obj, bevel=0.0, segments=1):
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    if bevel > 0:
        mod = obj.modifiers.new("hp_viewmodel_production_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.affect = "EDGES"
        apply_modifier(obj, mod)
    normal = obj.modifiers.new("hp_viewmodel_weighted_normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    apply_modifier(obj, normal)
    add_uv(obj)
    return obj


def assign(obj, material):
    obj.data.materials.append(material)
    return obj


def rounded_box(name, dims, loc, mat, rot=(0, 0, 0), bevel=0.012, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=old_loc(loc), rotation=old_rot(rot))
    obj = bpy.context.object
    obj.name = name
    obj.scale = old_dims(dims)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return polish(obj, bevel, segments)


def cyl(name, radius, depth, loc, mat, rot=(0, 0, 0), vertices=28, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=old_loc(loc), rotation=old_rot(rot))
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return polish(obj, bevel, 1)


def cone(name, radius1, radius2, depth, loc, mat, rot=(0, 0, 0), vertices=24, bevel=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=old_loc(loc), rotation=old_rot(rot))
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return polish(obj, bevel, 1)


def empty(name, loc):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.055
    obj.location = old_loc(loc)
    bpy.context.collection.objects.link(obj)
    return obj


def build_iron_rod():
    mat = material_set("iron_rod")
    cyl("iron_rod_main_shaft_dark_core", 0.055, 1.64, (0, 0.54, 0), mat["dark"], vertices=28, bevel=0.003)
    cyl("iron_rod_scraped_outer_sleeve", 0.074, 1.22, (0.012, 0.68, -0.004), mat["steel"], vertices=32, bevel=0.003)
    cyl("iron_rod_black_rubber_grip_wrap", 0.112, 0.5, (0, -0.38, 0.01), mat["grip"], vertices=28, bevel=0.004)
    cyl("iron_rod_rear_bronze_counter_cap", 0.124, 0.09, (0, -0.67, 0.01), mat["bronze"], vertices=28, bevel=0.006)
    cyl("iron_rod_front_impact_head", 0.126, 0.28, (0, 1.5, 0), mat["hero"], vertices=32, bevel=0.005)
    cone("iron_rod_forward_strike_crown", 0.11, 0.08, 0.16, (0, 1.72, 0), mat["steel"], vertices=32, bevel=0.003)

    for index, y in enumerate([-0.6, -0.48, -0.35, -0.12, 0.22, 0.68, 1.1, 1.33]):
        material = mat["bronze"] if index in (1, 5) else mat["hero"]
        cyl(f"iron_rod_raised_edge_ring_{index:02d}", 0.093 if y < 1.2 else 0.135, 0.042, (0, y, 0.01), material, vertices=28, bevel=0.003)

    for index, angle in enumerate([0, math.pi * 0.5, math.pi, math.pi * 1.5]):
        x = math.cos(angle) * 0.088
        z = math.sin(angle) * 0.088
        material = mat["hero"] if index in (0, 2) else mat["bronze"]
        rounded_box(f"iron_rod_longitudinal_scraped_rib_{index:02d}", (0.026, 1.14, 0.028), (x, 0.62, z), material, rot=(0, 0, angle * 0.14), bevel=0.004)

    for index, (x, y, z, width) in enumerate(
        [(-0.09, -0.49, 0.09, 0.12), (0.08, -0.37, 0.09, 0.1), (0, 0.18, 0.094, 0.16), (0, 0.9, 0.094, 0.13)]
    ):
        rounded_box(f"iron_rod_protocol_registry_inlay_{index:02d}", (width, 0.018, 0.046), (x, y, z), mat["bronze" if index != 2 else "cyan"], bevel=0.004)

    for index, (x, z) in enumerate([(-0.12, 1.48), (0.12, 1.48), (-0.08, 1.63), (0.08, 1.63)]):
        cyl(f"iron_rod_impact_rivet_{index:02d}", 0.022, 0.018, (x, z, 0.09), mat["hero"], rot=(math.pi / 2, 0, 0), vertices=16, bevel=0.002)

    rounded_box("iron_rod_cyan_energy_spine_window", (0.044, 0.58, 0.026), (0.0, 0.62, 0.113), mat["cyan"], bevel=0.004)
    rounded_box("iron_rod_muted_red_lock_status_band", (0.16, 0.032, 0.032), (0.0, -0.12, 0.108), mat["warning"], bevel=0.004)
    rounded_box("iron_rod_flat_impact_face", (0.25, 0.035, 0.18), (0, 1.73, 0.02), mat["dark"], bevel=0.01)

    empty("iron_rod_right_hand_grip_socket", (0, -0.38, 0.12))
    empty("iron_rod_hit_tip_socket", (0, 1.78, 0.08))
    empty("iron_rod_hit_base_socket", (0, 1.34, 0.06))
    empty("iron_rod_trail_start_socket", (0, 0.28, 0.08))
    empty("iron_rod_trail_mid_socket", (0, 0.86, 0.1))
    empty("iron_rod_trail_end_socket", (0, 1.62, 0.08))
    empty("iron_rod_emissive_core_socket", (0, 0.62, 0.12))
    return mat["imagePath"]


def build_sidearm():
    mat = material_set("sidearm")
    rounded_box("sidearm_receiver_frame_dark_core", (0.38, 0.17, 0.62), (0, 0.04, -0.12), mat["dark"], bevel=0.026)
    rounded_box("sidearm_battered_slide_panel", (0.4, 0.12, 0.76), (0, 0.2, -0.26), mat["steel"], bevel=0.022)
    rounded_box("sidearm_slide_top_scraped_spine", (0.22, 0.044, 0.68), (0, 0.285, -0.27), mat["hero"], bevel=0.01)
    rounded_box("sidearm_front_barrel_shroud_dark", (0.16, 0.13, 0.44), (0, 0.17, -0.7), mat["dark"], bevel=0.02)
    cyl("sidearm_muzzle_ring_scraped_steel", 0.092, 0.048, (0, 0.17, -0.9), mat["hero"], rot=(math.pi / 2, 0, 0), vertices=26, bevel=0.004)
    cyl("sidearm_cyan_muzzle_energy_lens", 0.052, 0.052, (0, 0.17, -0.94), mat["cyan"], rot=(math.pi / 2, 0, 0), vertices=20, bevel=0.002)

    rounded_box("sidearm_grip_black_rubber", (0.18, 0.4, 0.2), (0, -0.28, 0.12), mat["grip"], rot=(-0.24, 0, 0), bevel=0.032)
    rounded_box("sidearm_grip_front_strap_hero_edge", (0.055, 0.34, 0.028), (0, -0.2, -0.006), mat["hero"], rot=(-0.24, 0, 0), bevel=0.008)
    rounded_box("sidearm_grip_backstrap_bronze", (0.062, 0.32, 0.026), (0, -0.35, 0.22), mat["bronze"], rot=(-0.24, 0, 0), bevel=0.008)
    rounded_box("sidearm_magazine_base_dark_plate", (0.2, 0.085, 0.22), (0, -0.52, 0.24), mat["dark"], rot=(-0.24, 0, 0), bevel=0.018)
    rounded_box("sidearm_trigger_guard_dark_loop", (0.22, 0.026, 0.14), (0, -0.035, -0.1), mat["dark"], rot=(0.2, 0, 0), bevel=0.009)
    rounded_box("sidearm_amber_trigger", (0.038, 0.088, 0.03), (0, -0.1, -0.075), mat["bronze"], rot=(0.34, 0, 0), bevel=0.006)

    rounded_box("sidearm_rear_cyan_sight_window", (0.12, 0.035, 0.14), (0, 0.31, -0.6), mat["cyan"], bevel=0.006)
    rounded_box("sidearm_front_cyan_sight_dot", (0.06, 0.03, 0.06), (0, 0.31, -0.88), mat["cyan"], bevel=0.005)
    rounded_box("sidearm_heat_core_cyan_window", (0.08, 0.05, 0.22), (-0.16, 0.17, -0.22), mat["cyan"], bevel=0.006)
    rounded_box("sidearm_muted_red_status_strip", (0.18, 0.032, 0.034), (0, 0.315, 0.02), mat["warning"], bevel=0.006)
    rounded_box("sidearm_oiled_bronze_front_rail", (0.08, 0.032, 0.22), (0, 0.12, -0.02), mat["bronze"], bevel=0.006)

    for index, x in enumerate([-0.18, 0.18]):
        rounded_box(f"sidearm_side_scraped_slide_rail_{index:02d}", (0.028, 0.07, 0.56), (x, 0.225, -0.26), mat["hero"], bevel=0.004)
        rounded_box(f"sidearm_side_dark_recess_cut_{index:02d}", (0.032, 0.055, 0.34), (x, 0.155, -0.22), mat["dark"], bevel=0.004)
    for index, z in enumerate([-0.01, 0.07, 0.15, 0.23]):
        rounded_box(f"sidearm_grip_rubber_rib_{index:02d}", (0.18, 0.018, 0.018), (0, -0.22 - index * 0.055, z), mat["dark"], rot=(-0.24, 0, 0), bevel=0.004)
    for index, y in enumerate([-0.14, 0.1, 0.34]):
        rounded_box(f"sidearm_top_machined_rib_{index:02d}", (0.22, 0.022, 0.03), (0, 0.32, y - 0.25), mat["bronze" if index == 1 else "hero"], bevel=0.004)

    empty("sidearm_muzzle_socket", (0, 0.17, -0.98))
    empty("sidearm_right_hand_grip_socket", (0, -0.28, 0.16))
    empty("sidearm_trigger_contact_socket", (0, -0.1, -0.06))
    empty("sidearm_grip_front_contact_socket", (0, -0.18, -0.02))
    empty("sidearm_grip_back_contact_socket", (0, -0.42, 0.22))
    empty("sidearm_heat_core_socket", (-0.17, 0.18, -0.22))
    return mat["imagePath"]


def select_exportables():
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "EMPTY"}:
            obj.select_set(True)


def asset_stats(asset_id, output_path, texture_path):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    material_names = sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material})
    triangles = sum(len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons)
    vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    nodes = [obj.name for obj in bpy.context.scene.objects if obj.type in {"MESH", "EMPTY"}]
    return {
        "asset": asset_id,
        "file": str(output_path.relative_to(REPO_ROOT)),
        "sourceBlend": str((BLEND_DIR / f"hp_viewmodel_{asset_id}_production.blend").relative_to(REPO_ROOT)),
        "detailTexture": str(texture_path.relative_to(REPO_ROOT)),
        "bytes": output_path.stat().st_size,
        "meshObjects": len(mesh_objects),
        "materials": len(material_names),
        "materialNames": material_names,
        "verticesApprox": vertices,
        "trianglesApprox": triangles,
        "nodes": nodes,
    }


def export_asset(asset_id, build_fn, output_name):
    clear_scene()
    texture_path = build_fn()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    output_path = MODEL_DIR / output_name
    blend_path = BLEND_DIR / f"hp_viewmodel_{asset_id}_production.blend"
    select_exportables()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    report = asset_stats(asset_id, output_path, texture_path)
    print(f"{asset_id}: {report['bytes']} bytes, triangles={report['trianglesApprox']}, meshes={report['meshObjects']}")
    return report


def clamp(value, low, high):
    return max(low, min(high, value))


def hash01(x, y):
    value = (x * 374761393 + y * 668265263) & 0xFFFFFFFF
    value = (value ^ (value >> 13)) * 1274126177
    value = (value ^ (value >> 16)) & 0xFFFFFFFF
    return value / 0xFFFFFFFF


def main():
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    reports = [
        export_asset("iron_rod", build_iron_rod, "hp_viewmodel_iron_rod_production.glb"),
        export_asset("sidearm", build_sidearm, "hp_viewmodel_sidearm_production.glb"),
    ]
    manifest = {
        "schema": "human-protocol/viewmodel-production-prototypes@1",
        "source": {
            "strategy": "deterministic low-poly Blender viewmodel assets inspired by reference silhouettes; reference GLBs remain reference/prototype inputs, not runtime mesh sources.",
            "referenceRawSources": [
                "src/assets/models/viewmodel/prototypes/hp_viewmodel_iron_rod_reference_raw_meshopt.glb",
                "src/assets/models/viewmodel/prototypes/hp_viewmodel_sidearm_reference_raw_meshopt.glb",
            ],
        },
        "budgets": {
            "ironRodMaxBytes": 2_000_000,
            "sidearmMaxBytes": 2_500_000,
            "maxTrianglesPerWeapon": 80_000,
        },
        "assets": reports,
    }
    REPORT_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
