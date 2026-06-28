import json
import math
from array import array
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SHELL_DIR = ROOT / "src/assets/models/environment/shells"
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level03"
BLEND_DIR = ROOT / "src/assets/source_blend/level03"
MANIFEST_PATH = ROOT / "src/assets/manifests/runtime/human_protocol_level03_museum_shell_assets_v6.json"
MATERIAL_TARGETS_PATH = ROOT / "src/assets/manifests/generated/age/human_protocol_level03_museum_material_targets_v1.json"
MATERIAL_TARGETS = json.loads(MATERIAL_TARGETS_PATH.read_text())
SURFACE_TARGETS = MATERIAL_TARGETS["surfaces"]

SHELL_DIR.mkdir(parents=True, exist_ok=True)
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
BLEND_DIR.mkdir(parents=True, exist_ok=True)


def clamp01(value):
    return max(0.0, min(1.0, value))


def smoothstep(edge0, edge1, value):
    if edge0 == edge1:
        return 1.0 if value >= edge1 else 0.0
    t = clamp01((value - edge0) / (edge1 - edge0))
    return t * t * (3.0 - 2.0 * t)


def stripe_distance(value, step):
    return abs((value / step) - round(value / step)) * step


def noise(x, y):
    value = math.sin(x * 142.13 + y * 47.31) * 43758.5453
    return value - math.floor(value)


def save_texture(path, width, height, sampler):
    image = bpy.data.images.new(path.stem, width=width, height=height, alpha=True)
    pixels = array("f")
    inv_w = 1.0 / max(1, width - 1)
    inv_h = 1.0 / max(1, height - 1)
    for y in range(height):
        v = y * inv_h
        for x in range(width):
            u = x * inv_w
            r, g, b, a = sampler(u, v)
            pixels.extend((r / 255.0, g / 255.0, b / 255.0, a / 255.0))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    return path


def srgb255(surface_key, key, fallback):
    values = SURFACE_TARGETS.get(surface_key, {}).get(key, fallback)
    return tuple(float(value) * 255.0 for value in values)


def surface_material(surface_key, key, fallback):
    return SURFACE_TARGETS.get(surface_key, {}).get("material", {}).get(key, fallback)


def surface_scalar(surface_key, key, fallback):
    return SURFACE_TARGETS.get(surface_key, {}).get(key, fallback)


def floor_texture(u, v):
    fine = noise(u * 96.0 + 0.2, v * 88.0 + 0.7)
    broad = noise(u * 8.0, v * 9.0)
    center_axis = 1.0 - smoothstep(0.16, 0.36, abs(u - 0.5))
    vignette = smoothstep(0.0, 0.16, u) * (1.0 - smoothstep(0.84, 1.0, u))
    vignette *= smoothstep(0.0, 0.12, v) * (1.0 - smoothstep(0.88, 1.0, v))

    base = 16.0 + 8.0 * broad + 4.0 * fine + 8.0 * center_axis + 8.0 * vignette
    r = base * 0.82 + 5.0
    g = base * 0.88 + 7.0
    b = base * 0.9 + 8.0

    slab_x = min(stripe_distance(u, 0.5), stripe_distance(u + 0.25, 0.5))
    slab_y = min(stripe_distance(v, 0.5), stripe_distance(v + 0.25, 0.5))
    seam = max(1.0 - smoothstep(0.0025, 0.01, slab_x), 1.0 - smoothstep(0.0025, 0.01, slab_y))
    r -= 8.0 * seam
    g -= 8.0 * seam
    b -= 8.0 * seam

    brass = 0.0
    for axis in (0.12, 0.88):
        brass += 0.72 * (1.0 - smoothstep(0.0015, 0.006, abs(u - axis)))
    for band in (0.14, 0.86):
        brass += 0.72 * (1.0 - smoothstep(0.0015, 0.006, abs(v - band)))
    oct_ring = min(abs(abs(u - 0.5) + abs(v - 0.5) - 0.34), abs(max(abs(u - 0.5), abs(v - 0.5)) - 0.29))
    brass += 0.55 * (1.0 - smoothstep(0.0015, 0.0065, oct_ring))
    r += 58.0 * brass
    g += 39.0 * brass
    b += 10.0 * brass

    cyan_line = 0.0
    for axis in (0.035, 0.965):
        cyan_line += 0.26 * (1.0 - smoothstep(0.0015, 0.006, abs(u - axis)))
    cyan_line *= smoothstep(0.12, 0.24, v) * (1.0 - smoothstep(0.76, 0.88, v))
    r += 6.0 * cyan_line
    g += 35.0 * cyan_line
    b += 43.0 * cyan_line

    for cx, cy, sx, sy, strength in (
        (0.32, 0.62, 0.24, 0.12, 0.44),
        (0.68, 0.38, 0.24, 0.12, 0.34),
    ):
        dx = (u - cx) / sx
        dy = (v - cy) / sy
        pool = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy))
        warm_reflection = smoothstep(0.0, 1.0, pool) * strength
        r += 22.0 * warm_reflection
        g += 20.0 * warm_reflection
        b += 13.0 * warm_reflection

    vein = 1.0 - smoothstep(0.0, 0.028, abs(math.sin((u * 8.2 + v * 4.7 + fine * 0.22) * math.pi)))
    vein *= 0.1 + 0.08 * center_axis
    r += 8.0 * vein
    g += 8.0 * vein
    b += 7.0 * vein

    grain = (fine - 0.5) * 4.0
    return (
        int(clamp01((r + grain) / 255.0) * 255),
        int(clamp01((g + grain) / 255.0) * 255),
        int(clamp01((b + grain) / 255.0) * 255),
        255,
    )


def ceiling_texture(u, v):
    n = noise(u * 18.0 + 0.4, v * 16.0 + 0.8)
    base_r, base_g, base_b = srgb255("ceiling_warm_white_panel", "targetRgbSrgb", (0.62, 0.61, 0.56))
    r = base_r + 10.0 * n
    g = base_g + 9.0 * n
    b = base_b + 8.0 * n

    grid_x = 1.0 - smoothstep(0.006, 0.028, stripe_distance(u, 0.5))
    grid_y = 1.0 - smoothstep(0.006, 0.03, stripe_distance(v, 0.5))
    grid = max(grid_x, grid_y)
    r += 7.0 * grid
    g += 7.0 * grid
    b += 6.0 * grid

    recess = (
        smoothstep(0.08, 0.13, u)
        * (1.0 - smoothstep(0.87, 0.92, u))
        * smoothstep(0.12, 0.18, v)
        * (1.0 - smoothstep(0.82, 0.88, v))
    )
    r += 9.0 * recess
    g += 8.0 * recess
    b += 5.0 * recess

    for cx, cy in ((0.28, 0.5), (0.5, 0.5), (0.72, 0.5)):
        dx = (u - cx) / 0.16
        dy = (v - cy) / 0.028
        lamp = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy))
        lamp = smoothstep(0.05, 1.0, lamp)
        r += 42.0 * lamp
        g += 37.0 * lamp
        b += 24.0 * lamp

    brass_trace = (1.0 - smoothstep(0.0, 0.009, abs(v - 0.5))) * smoothstep(0.1, 0.2, u) * (1.0 - smoothstep(0.8, 0.9, u))
    lens_r, lens_g, lens_b = srgb255("gallery_light_lens", "targetRgbSrgb", (0.9, 0.86, 0.72))
    r += lens_r * 0.05 * brass_trace
    g += lens_g * 0.045 * brass_trace
    b += lens_b * 0.025 * brass_trace

    grain = (noise(u * 143.0, v * 109.0) - 0.5) * 3.5
    return (
        int(clamp01((r + grain) / 255.0) * 255),
        int(clamp01((g + grain) / 255.0) * 255),
        int(clamp01((b + grain) / 255.0) * 255),
        255,
    )


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def bsdf_input(bsdf, identifier):
    for socket in bsdf.inputs:
        if socket.identifier == identifier or socket.name == identifier:
            return socket
    raise KeyError(f"Principled BSDF input not found: {identifier}")


def material(name, color, metallic=0.0, roughness=0.5, texture=None, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.use_backface_culling = False
    nodes = mat.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")
        output = next((node for node in nodes if node.type == "OUTPUT_MATERIAL"), None)
        if output:
            mat.node_tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    bsdf_input(bsdf, "Base Color").default_value = color
    bsdf_input(bsdf, "Metallic").default_value = metallic
    bsdf_input(bsdf, "Roughness").default_value = roughness
    if texture:
        image = bpy.data.images.load(str(texture))
        tex_node = nodes.new(type="ShaderNodeTexImage")
        tex_node.image = image
        tex_node.extension = "REPEAT"
        mat.node_tree.links.new(tex_node.outputs["Color"], bsdf_input(bsdf, "Base Color"))
        mat["hp_uses_image2_texture"] = True
    if emission:
        bsdf_input(bsdf, "Emission Color").default_value = emission
        bsdf_input(bsdf, "Emission Strength").default_value = emission_strength
    return mat


def add_bevel(obj, width=0.025, segments=2):
    bevel = obj.modifiers.new(name="premium_bevel", type="BEVEL")
    bevel.width = width
    bevel.segments = segments
    bevel.affect = "EDGES"
    obj.modifiers.new(name="weighted_normals", type="WEIGHTED_NORMAL")


def cube(name, loc, scale, mat, parent=None, bevel=0.015, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel > 0:
        add_bevel(obj, bevel, segments)
    if parent:
        obj.parent = parent
    return obj


def plane(name, loc, width, depth, mat, parent=None, normal_down=False):
    verts = [(-width / 2, -depth / 2, 0), (width / 2, -depth / 2, 0), (width / 2, depth / 2, 0), (-width / 2, depth / 2, 0)]
    faces = [(0, 3, 2, 1)] if normal_down else [(0, 1, 2, 3)]
    mesh = bpy.data.meshes.new(name + "_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.data.materials.append(mat)
    uv_layer = mesh.uv_layers.new(name="museum_image2_uv")
    coords = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for loop, uv in zip(mesh.polygons[0].loop_indices, coords):
        uv_layer.data[loop].uv = uv
    if parent:
        obj.parent = parent
    return obj


def root_empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def export_selected(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_animations=False,
    )


def build_floor(floor_tex):
    root = root_empty("hp_room_floor_tile_museum_v6_dark_image2_gallery_floor")
    floor_mat = material(
        "image2_museum_dark_premium_stone_floor_skin_v6",
        (0.16, 0.15, 0.13, 1.0),
        metallic=0.34,
        roughness=0.36,
        texture=floor_tex,
    )
    base = material("museum_floor_dark_structural_underplate", (0.01, 0.018, 0.02, 1.0), metallic=0.72, roughness=0.46)
    trim = material("museum_floor_smoked_titanium_trim", (0.055, 0.07, 0.068, 1.0), metallic=0.86, roughness=0.34)
    brass = material("museum_floor_aged_brass_inlay", (0.72, 0.5, 0.18, 1.0), metallic=0.92, roughness=0.26)
    warm = material("museum_floor_warm_exhibit_reflection_bars", (0.86, 0.72, 0.42, 1.0), metallic=0.72, roughness=0.24)
    cyan = material(
        "museum_floor_cyan_reflection_inlay",
        (0.2, 0.86, 0.95, 1.0),
        metallic=0.28,
        roughness=0.22,
        emission=(0.17, 0.86, 1.0, 1.0),
        emission_strength=0.36,
    )
    shadow = material("museum_floor_contact_shadow_recesses", (0.0, 0.01, 0.014, 1.0), metallic=0.55, roughness=0.62)

    cube("museum_floor_black_underplate_for_single_image2", (0, 0, 0.016), (4.34, 3.09, 0.032), base, root, 0.01, 1)
    plane("museum_floor_image2_full_gallery_composition_visible_face", (0, 0, 0.124), 4.12, 2.72, floor_mat, root)
    cube("museum_floor_low_smoked_front_lip", (0, 1.4, 0.146), (4.18, 0.045, 0.026), trim, root, 0.01, 1)
    cube("museum_floor_low_smoked_back_lip", (0, -1.4, 0.146), (4.18, 0.045, 0.026), trim, root, 0.01, 1)
    cube("museum_floor_low_smoked_left_lip", (-2.1, 0, 0.146), (0.045, 2.72, 0.026), trim, root, 0.01, 1)
    cube("museum_floor_low_smoked_right_lip", (2.1, 0, 0.146), (0.045, 2.72, 0.026), trim, root, 0.01, 1)
    return root


def build_ceiling(ceiling_tex):
    root = root_empty("hp_room_ceiling_panel_museum_v8_image2_gallery_coffer")
    tex_mat = material(
        "image2_museum_ceiling_warm_panel_skin_v6",
        (*SURFACE_TARGETS["ceiling_warm_white_panel"]["targetRgbSrgb"], 1.0),
        metallic=surface_material("ceiling_warm_white_panel", "metallic", 0.08),
        roughness=surface_material("ceiling_warm_white_panel", "roughness", 0.68),
        texture=ceiling_tex,
    )
    back = material("museum_ceiling_charcoal_recess_backplate", (0.018, 0.02, 0.019, 1.0), metallic=0.58, roughness=0.62)
    beam = material("museum_ceiling_deep_graphite_coffer_beams", (0.038, 0.040, 0.038, 1.0), metallic=0.62, roughness=0.46)
    insert = material("museum_ceiling_warm_white_insert_panels", (0.48, 0.48, 0.44, 1.0), metallic=0.08, roughness=0.72)
    lens = SURFACE_TARGETS["gallery_light_lens"]
    warm = material(
        "museum_ceiling_warm_white_gallery_light_lens",
        (*lens["targetRgbSrgb"], 1.0),
        metallic=0.18,
        roughness=0.24,
        emission=(*lens["emissionRgbSrgb"], 1.0),
        emission_strength=surface_scalar("gallery_light_lens", "emissionStrength", 0.34),
    )

    cube("museum_ceiling_shadow_backplate", (0, 0, 0.0), (3.2, 2.2, 0.06), back, root, 0.006, 1)
    plane("museum_ceiling_image2_underside_visible_face", (0, 0, -0.042), 3.05, 2.05, tex_mat, root, normal_down=True)
    for index, x in enumerate((-1.42, 1.42)):
        cube(f"museum_ceiling_side_coffer_beam_{index}", (x, 0, -0.13), (0.11, 2.08, 0.15), beam, root, 0.014, 2)
    for index, y in enumerate((-0.92, 0.92)):
        cube(f"museum_ceiling_end_coffer_beam_{index}", (0, y, -0.13), (3.0, 0.09, 0.15), beam, root, 0.014, 2)
    cube("museum_ceiling_center_quiet_graphite_panel", (0, 0, -0.18), (1.42, 0.58, 0.035), insert, root, 0.012, 1)
    for index, (x, y, width) in enumerate(((-0.72, -0.52, 0.66), (0.72, -0.52, 0.66), (-0.72, 0.52, 0.66), (0.72, 0.52, 0.66))):
        cube(f"museum_ceiling_warm_linear_gallery_light_{index}", (x, y, -0.235), (width, 0.052, 0.026), warm, root, 0.006, 1)
    return root


def build_wall_panel(stone_tex):
    root = root_empty("hp_room_wall_panel_museum_v7_image2_black_gallery_wall")
    wall = SURFACE_TARGETS["wall_black_gallery"]
    edge = wall.get("edgeGlintRgbSrgb", [0.36, 0.34, 0.25])
    wall_material = wall.get("material", {})
    stone = material(
        "image2_museum_black_gallery_wall_skin_v6",
        (*wall["targetRgbSrgb"], 1.0),
        metallic=wall_material.get("metallic", 0.46),
        roughness=wall_material.get("roughness", 0.38),
        texture=stone_tex,
    )
    recess = material("museum_wall_graphite_recess", (0.012, 0.014, 0.013, 1.0), metallic=0.56, roughness=0.46)
    smoked = material("museum_wall_smoked_blackened_steel_frame", (0.026, 0.027, 0.024, 1.0), metallic=0.84, roughness=0.32)
    brass = material("museum_wall_subtle_champagne_edge", (*edge, 1.0), metallic=0.9, roughness=0.24)
    warm = material(
        "museum_wall_soft_gallery_light_slot",
        (0.78, 0.73, 0.58, 1.0),
        metallic=0.52,
        roughness=0.3,
        emission=(0.92, 0.86, 0.66, 1.0),
        emission_strength=0.14,
    )
    cyan = material(
        "museum_wall_tiny_cyan_service_tick",
        (0.22, 0.82, 0.9, 1.0),
        metallic=0.25,
        roughness=0.28,
        emission=(0.1, 0.72, 0.88, 1.0),
        emission_strength=0.28,
    )

    cube("museum_wall_black_recess_back", (0, 1.45, -0.035), (3.2, 2.9, 0.07), recess, root, 0.006, 1)
    cube("museum_wall_stone_main_slab", (0, 1.45, 0.0), (3.05, 2.72, 0.045), stone, root, 0.018, 2)
    cube("museum_wall_top_smoked_frame", (0, 2.78, 0.035), (3.15, 0.075, 0.055), smoked, root, 0.012, 1)
    cube("museum_wall_bottom_smoked_frame", (0, 0.12, 0.035), (3.15, 0.075, 0.055), smoked, root, 0.012, 1)
    cube("museum_wall_left_smoked_frame", (-1.56, 1.45, 0.035), (0.07, 2.54, 0.055), smoked, root, 0.012, 1)
    cube("museum_wall_right_smoked_frame", (1.56, 1.45, 0.035), (0.07, 2.54, 0.055), smoked, root, 0.012, 1)
    cube("museum_wall_upper_brass_datum", (0, 2.22, 0.072), (2.62, 0.026, 0.022), brass, root, 0.004, 1)
    cube("museum_wall_lower_brass_datum", (0, 0.72, 0.072), (2.28, 0.02, 0.02), brass, root, 0.004, 1)
    cube("museum_wall_center_shadow_groove", (0, 1.45, 0.076), (0.026, 2.1, 0.016), recess, root, 0.003, 1)
    cube("museum_wall_warm_label_slot_left", (-0.62, 1.95, 0.082), (0.48, 0.04, 0.018), warm, root, 0.004, 1)
    cube("museum_wall_warm_label_slot_right", (0.68, 0.96, 0.082), (0.38, 0.034, 0.018), warm, root, 0.004, 1)
    cube("museum_wall_cyan_service_tick_left", (-1.31, 1.44, 0.084), (0.026, 0.54, 0.018), cyan, root, 0.003, 1)
    return root


def build_corner_pillar():
    root = root_empty("hp_room_corner_pillar_museum_v6_black_brass_pylon")
    core = material("museum_pillar_deep_black_stone_core", (0.01, 0.012, 0.012, 1.0), metallic=0.46, roughness=0.48)
    smoked = material("museum_pillar_smoked_metal_edges", (0.028, 0.032, 0.03, 1.0), metallic=0.86, roughness=0.32)
    brass = material("museum_pillar_aged_brass_caps", (0.68, 0.46, 0.16, 1.0), metallic=0.92, roughness=0.26)
    cyan = material(
        "museum_pillar_tiny_cyan_status",
        (0.18, 0.78, 0.88, 1.0),
        metallic=0.22,
        roughness=0.26,
        emission=(0.08, 0.68, 0.86, 1.0),
        emission_strength=0.24,
    )

    cube("museum_pillar_black_square_core", (0, 1.38, 0), (0.34, 2.76, 0.34), core, root, 0.028, 2)
    cube("museum_pillar_front_smoked_edge", (0, 1.38, 0.18), (0.39, 2.7, 0.035), smoked, root, 0.008, 1)
    cube("museum_pillar_back_smoked_edge", (0, 1.38, -0.18), (0.39, 2.7, 0.035), smoked, root, 0.008, 1)
    cube("museum_pillar_left_smoked_edge", (-0.18, 1.38, 0), (0.035, 2.7, 0.39), smoked, root, 0.008, 1)
    cube("museum_pillar_right_smoked_edge", (0.18, 1.38, 0), (0.035, 2.7, 0.39), smoked, root, 0.008, 1)
    cube("museum_pillar_top_brass_cap", (0, 2.78, 0), (0.48, 0.07, 0.48), brass, root, 0.014, 1)
    cube("museum_pillar_bottom_brass_cap", (0, 0.02, 0), (0.48, 0.07, 0.48), brass, root, 0.014, 1)
    cube("museum_pillar_small_cyan_status_slit", (0, 1.78, 0.205), (0.13, 0.36, 0.018), cyan, root, 0.004, 1)
    return root


def build_wall_wash_light():
    root = root_empty("hp_room_wall_wash_light_museum_v6_warm_gallery_rail")
    base = material("museum_wall_wash_black_mount", (0.01, 0.012, 0.012, 1.0), metallic=0.78, roughness=0.38)
    brass = material("museum_wall_wash_aged_brass_trim", (0.68, 0.46, 0.16, 1.0), metallic=0.9, roughness=0.25)
    warm = material(
        "museum_wall_wash_warm_gallery_light",
        (0.98, 0.78, 0.48, 1.0),
        metallic=0.2,
        roughness=0.2,
        emission=(1.0, 0.72, 0.38, 1.0),
        emission_strength=0.8,
    )
    cyan = material(
        "museum_wall_wash_small_cyan_service_light",
        (0.2, 0.86, 0.95, 1.0),
        metallic=0.18,
        roughness=0.24,
        emission=(0.08, 0.72, 0.9, 1.0),
        emission_strength=0.3,
    )

    cube("museum_wall_wash_black_back_rail", (0, 1.42, 0), (1.28, 0.11, 0.07), base, root, 0.01, 1)
    cube("museum_wall_wash_warm_linear_lens", (0, 1.42, 0.047), (1.04, 0.034, 0.028), warm, root, 0.005, 1)
    cube("museum_wall_wash_left_brass_endcap", (-0.66, 1.42, 0.035), (0.08, 0.09, 0.045), brass, root, 0.006, 1)
    cube("museum_wall_wash_right_brass_endcap", (0.66, 1.42, 0.035), (0.08, 0.09, 0.045), brass, root, 0.006, 1)
    cube("museum_wall_wash_cyan_service_dot", (0.52, 1.49, 0.052), (0.08, 0.018, 0.014), cyan, root, 0.003, 1)
    return root


def main():
    clear_scene()
    floor_tex = TEXTURE_DIR / "level03_image2_museum_floor_premium_stone_skin_v6.png"
    ceiling_tex = TEXTURE_DIR / "level03_image2_museum_ceiling_warm_panel_skin_v6.png"
    wall_tex = TEXTURE_DIR / "level03_image2_museum_black_gallery_wall_skin_v6.png"

    floor_root = build_floor(floor_tex)
    ceiling_root = build_ceiling(ceiling_tex)
    wall_root = build_wall_panel(wall_tex)
    pillar_root = build_corner_pillar()
    wall_wash_root = build_wall_wash_light()

    floor_glb = SHELL_DIR / "hp_room_floor_tile_museum.glb"
    ceiling_glb = SHELL_DIR / "hp_room_ceiling_panel_museum.glb"
    wall_glb = SHELL_DIR / "hp_room_wall_panel_museum.glb"
    pillar_glb = SHELL_DIR / "hp_room_corner_pillar_museum.glb"
    wall_wash_glb = SHELL_DIR / "hp_room_wall_wash_light_museum.glb"
    export_selected(floor_root, floor_glb)
    export_selected(ceiling_root, ceiling_glb)
    export_selected(wall_root, wall_glb)
    export_selected(pillar_root, pillar_glb)
    export_selected(wall_wash_root, wall_wash_glb)

    blend_path = BLEND_DIR / "human_protocol_level03_museum_shell_assets_v6.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    manifest = {
        "schemaVersion": "hp.level03-museum-shell-assets.v6",
        "generatedBy": "scripts/asset-build/blender-generate-level03-museum-shell-assets.py",
        "purpose": "Reusable Level 3 museum interior shell with image2-derived textures and deterministic mathematical floor/ceiling/wall layout.",
        "sourceBlend": str(blend_path.relative_to(ROOT)),
        "textures": [
            str(floor_tex.relative_to(ROOT)),
            str(ceiling_tex.relative_to(ROOT)),
            str(wall_tex.relative_to(ROOT)),
        ],
        "models": [
            {
                "modelKey": "room_floor_tile_museum",
                "file": str(floor_glb.relative_to(ROOT)),
                "primaryTexture": str(floor_tex.relative_to(ROOT)),
                "qualityNotes": [
                    "top face uses v6 dark premium stone image2 source with deterministic slab and brass-line layout",
                    "AI image2 contributes material grain only; panel seams and composition are mathematically generated",
                    "raw WebGPU should let AGE lighting create highlights instead of relying on baked glare"
                ],
            },
            {
                "modelKey": "room_ceiling_panel_museum",
                "file": str(ceiling_glb.relative_to(ROOT)),
                "primaryTexture": str(ceiling_tex.relative_to(ROOT)),
                "qualityNotes": [
                    "v6 image2 underside uses deterministic coffer panels and warm linear light layout",
                    "deep coffer beams and dark inserts make the ceiling read as a real gallery structure",
                    "warm track spot housings create museum display light while small cyan service blades keep the raw WebGPU identity",
                    "the shell stays model-key compatible with hp:human_museum_gallery_shell_v1 for config-driven reuse"
                ],
            },
            {
                "modelKey": "room_wall_panel_museum",
                "file": str(wall_glb.relative_to(ROOT)),
                "primaryTexture": str(wall_tex.relative_to(ROOT)),
                "qualityNotes": [
                    "v6 black gallery wall image2 provides graphite panel depth with deterministic brass/cyan accents",
                    "black stone wall slab, smoked metal frame, and thin brass datum lines match the authored museum floor",
                    "warm label slots replace large cyan wall washes so the room reads as a gallery",
                    "a single small cyan service tick preserves Human Protocol identity without dominating the palette"
                ],
            },
            {
                "modelKey": "room_corner_pillar_museum",
                "file": str(pillar_glb.relative_to(ROOT)),
                "qualityNotes": [
                    "black pylon with smoked edges and brass caps replaces generic maintenance-style pillar color",
                    "small cyan status slit is intentionally low budget and non-dominant"
                ],
            },
            {
                "modelKey": "room_wall_wash_light_museum",
                "file": str(wall_wash_glb.relative_to(ROOT)),
                "qualityNotes": [
                    "warm gallery rail light supports museum readability",
                    "aged brass endcaps tie wall lighting to the floor inlay language"
                ],
            },
        ],
        "configReady": {
            "shellKit": "hp:human_museum_gallery_shell_v1",
            "lightingPreset": "hp:human_museum_gallery_lighting_v1",
            "level": "level_03_human_museum",
        },
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"floor": str(floor_glb), "ceiling": str(ceiling_glb), "manifest": str(MANIFEST_PATH)}, indent=2))


if __name__ == "__main__":
    main()
