import json
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "src/assets/manifests/reports/human_protocol_level02_furniture_objective_v2_report.json"
STORY_ART_REPORT_PATH = ROOT / "src/assets/manifests/reports/human_protocol_level02_story_art_objective_v1_report.json"
MODEL_DIR = ROOT / "src/assets/models/environment/level02"
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level02"
WGPU_TEXTURE_DIR = ROOT / "src/assets/textures/environment/wgpu-room-props"
SOURCE_DIR = ROOT / "src/assets/source_blend/level02"
MANIFEST_PATH = ROOT / "src/assets/manifests/runtime/human_protocol_level02_furniture_assets_v2.json"
SOURCE_BLEND = SOURCE_DIR / "human_protocol_level02_furniture_v2.blend"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
SOURCE_DIR.mkdir(parents=True, exist_ok=True)

with REPORT_PATH.open("r", encoding="utf-8") as handle:
    SEARCH_REPORT = json.load(handle)

TARGETS = {entry["modelKey"]: entry for entry in SEARCH_REPORT["targets"]}

if STORY_ART_REPORT_PATH.exists():
    with STORY_ART_REPORT_PATH.open("r", encoding="utf-8") as handle:
        STORY_ART_REPORT = json.load(handle)
else:
    STORY_ART_REPORT = {"bestCandidate": {}}

STORY_ART = STORY_ART_REPORT.get("bestCandidate", {})
TEXTURE_IMAGES = {}


def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))


def fract(value):
    return value - math.floor(value)


def noise(x, y, seed=0.0):
    return fract(math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453)


def mix(a, b, t):
    return a + (b - a) * clamp(t)


def mix_color(a, b, t):
    return tuple(mix(a[index], b[index], t) for index in range(3))


def save_texture(name, width, height, pixel_fn):
    image = bpy.data.images.new(name, width=width, height=height, alpha=True, float_buffer=False)
    pixels = []
    for y in range(height):
        v = y / max(1, height - 1)
        for x in range(width):
            u = x / max(1, width - 1)
            r, g, b, a = pixel_fn(u, v, x, y)
            pixels.extend([clamp(r), clamp(g), clamp(b), clamp(a)])
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(TEXTURE_DIR / f"{name}.png")
    image.file_format = "PNG"
    image.save()
    filepath = image.filepath_raw
    bpy.data.images.remove(image)
    loaded = bpy.data.images.load(filepath)
    loaded.name = name
    return loaded


def load_source_texture(key, filename):
    path = WGPU_TEXTURE_DIR / filename
    loaded = bpy.data.images.load(str(path))
    loaded.name = key
    return loaded


def generate_story_textures():
    if TEXTURE_IMAGES:
        return TEXTURE_IMAGES

    TEXTURE_IMAGES["source_furniture_atlas"] = load_source_texture(
        "hp_image2_furniture_material_atlas_v1",
        "hp_image2_furniture_material_atlas_v1.png",
    )
    TEXTURE_IMAGES["source_terminal_atlas"] = load_source_texture(
        "hp_image2_terminal_screen_atlas_v1",
        "hp_image2_terminal_screen_atlas_v1.png",
    )
    TEXTURE_IMAGES["source_surface_atlas"] = load_source_texture(
        "hp_image2_environment_surfaces_atlas_v1",
        "hp_image2_environment_surfaces_atlas_v1.png",
    )
    TEXTURE_IMAGES["source_clean_atlas"] = load_source_texture(
        "hp_image2_clean_atlas_v1",
        "hp_image2_clean_atlas_v1.png",
    )

    fabric_weave = STORY_ART.get("fabricWeave", 0.64)
    panel_grime = STORY_ART.get("panelGrime", 0.24)
    edge_wear = STORY_ART.get("edgeWear", 0.44)
    scratches = STORY_ART.get("microScratches", 0.38)
    ghost = STORY_ART.get("photoGhost", 0.38)
    gold = STORY_ART.get("goldWarmth", 0.14)
    cyan = STORY_ART.get("cyanInk", 0.44)
    red = STORY_ART.get("redInk", 0.018)
    rough_var = STORY_ART.get("roughnessVariation", 0.36)
    contrast = STORY_ART.get("textureContrast", 0.44)

    def fabric_pixel(u, v, x, y):
        base = (0.29, 0.38, 0.365)
        cool = (0.48, 0.64, 0.62)
        warm_thread = (0.62 + gold * 0.2, 0.48 + gold * 0.2, 0.26)
        warp = 0.5 + 0.5 * math.sin((x + noise(x, y, 3) * 2) * 0.55)
        weft = 0.5 + 0.5 * math.sin((y + noise(x, y, 4) * 2) * 0.7)
        weave = (warp * weft) ** 0.55
        seam = (
            abs((u * 4) % 1 - 0.5) < 0.018
            or abs((v * 3) % 1 - 0.5) < 0.02
            or abs(u - 0.08) < 0.012
            or abs(u - 0.92) < 0.012
        )
        patch = 0.72 if (0.08 < u < 0.45 and 0.1 < v < 0.42) else 0.0
        stain = smooth_blob(u, v, 0.63, 0.35, 0.22, 0.14) * panel_grime * 0.55
        thread = 1 if (x + y) % 31 == 0 else 0
        color = mix_color(base, cool, 0.22 + fabric_weave * 0.24 + weave * 0.24)
        color = mix_color(color, (0.18, 0.25, 0.24), seam * 0.48)
        color = mix_color(color, (0.39, 0.55, 0.54), patch * 0.34)
        color = mix_color(color, warm_thread, thread * 0.34 * gold)
        color = mix_color(color, (0.07, 0.1, 0.095), stain)
        if abs(v - 0.72) < 0.012 and 0.16 < u < 0.84:
            color = mix_color(color, (0.18, 0.86, 0.92), 0.42 * cyan)
        n = (noise(x, y, 7) - 0.5) * contrast * 0.12
        return color[0] + n, color[1] + n, color[2] + n, 1

    def panel_pixel(u, v, x, y):
        base = (0.5, 0.56, 0.54)
        dark = (0.15, 0.2, 0.2)
        cyan_line = (0.16, 0.82 + cyan * 0.15, 0.9)
        border = max(abs(u - 0.5) * 2, abs(v - 0.5) * 2)
        groove = 1 if (abs((u * 5) % 1 - 0.5) < 0.028 or abs((v * 4) % 1 - 0.5) < 0.02) else 0
        inset = 1 if (0.12 < u < 0.88 and 0.16 < v < 0.84 and (abs(u - 0.12) < 0.012 or abs(u - 0.88) < 0.012 or abs(v - 0.16) < 0.012 or abs(v - 0.84) < 0.012)) else 0
        screw = max(
            smooth_blob(u, v, 0.09, 0.1, 0.018, 0.018),
            smooth_blob(u, v, 0.91, 0.1, 0.018, 0.018),
            smooth_blob(u, v, 0.09, 0.9, 0.018, 0.018),
            smooth_blob(u, v, 0.91, 0.9, 0.018, 0.018),
        )
        scratch = 1 if noise(y, x * 0.18, 19) > 1 - scratches * 0.045 and (x + y) % 5 == 0 else 0
        color = mix_color(base, dark, clamp((border - 0.76) * 2.2) * edge_wear)
        color = mix_color(color, dark, groove * 0.24)
        color = mix_color(color, (0.78, 0.82, 0.76), inset * 0.35)
        color = mix_color(color, (0.03, 0.045, 0.045), screw * 0.78)
        color = mix_color(color, cyan_line, (1 if abs(v - 0.18) < 0.012 and 0.2 < u < 0.8 else 0) * cyan * 0.55)
        color = mix_color(color, (0.8, 0.86, 0.82), scratch * 0.36)
        grime = panel_grime * (smooth_blob(u, v, 0.18, 0.78, 0.23, 0.16) + smooth_blob(u, v, 0.77, 0.62, 0.2, 0.13))
        color = mix_color(color, (0.08, 0.1, 0.095), grime * 0.5)
        return color[0], color[1], color[2], 1

    def dark_metal_pixel(u, v, x, y):
        base = (0.025, 0.04, 0.045)
        blue = (0.055, 0.105, 0.115)
        scratch = 1 if noise(x * 0.12, y, 29) > 1 - scratches * 0.055 and abs(math.sin((u + v) * 60)) > 0.72 else 0
        color = mix_color(base, blue, 0.28 + noise(x, y, 31) * 0.16)
        color = mix_color(color, (0.68, 0.78, 0.76), scratch * 0.28)
        return color[0], color[1], color[2], 1

    def photo_pixel(u, v, x, y):
        base = (0.035, 0.08, 0.09)
        glass = (0.18, 0.38, 0.38)
        color = mix_color(base, glass, 0.3 + noise(x, y, 41) * 0.22)
        frame_line = abs(u - 0.08) < 0.01 or abs(u - 0.92) < 0.01 or abs(v - 0.08) < 0.01 or abs(v - 0.92) < 0.01
        color = mix_color(color, (0.58, 0.47, 0.28), frame_line * (0.45 + gold * 0.35))
        figures = [(0.32, 0.42, 0.95), (0.5, 0.38, 1.08), (0.68, 0.44, 0.86)]
        absent = 0.0
        for cx, cy, weight in figures:
            head = smooth_blob(u, v, cx, cy - 0.1, 0.045, 0.055)
            torso = smooth_blob(u, v, cx, cy + 0.07, 0.08, 0.13)
            absent += (head + torso) * weight
        absent = clamp(absent * (0.54 + ghost * 0.42))
        color = mix_color(color, (0.74, 0.88, 0.82), absent * 0.62)
        color = mix_color(color, (0.02, 0.05, 0.055), absent * smooth_blob(u, v, 0.5, 0.48, 0.38, 0.28) * 0.26)
        if abs(v - 0.82) < 0.012 and 0.18 < u < 0.82:
            color = mix_color(color, (0.2, 0.86, 0.92), cyan * 0.58)
        if abs(u - 0.12) < 0.01 and abs(v - 0.18) < 0.08:
            color = mix_color(color, (0.75, 0.48, 0.18), gold * 0.58)
        return color[0], color[1], color[2], 0.95

    def floor_pixel(u, v, x, y):
        base = (0.23, 0.31, 0.32)
        dark = (0.055, 0.085, 0.09)
        trim = (0.52, 0.62, 0.6)
        color = mix_color(base, dark, noise(x, y, 53) * 0.22)
        line = abs((u * 4) % 1 - 0.5) < 0.022 or abs((v * 3) % 1 - 0.5) < 0.022
        diagonal = abs((u - v) - 0.06) < 0.012 or abs((u + v) - 1.08) < 0.012
        inset = abs(u - 0.5) < 0.012 or abs(v - 0.5) < 0.012
        color = mix_color(color, trim, (line or diagonal or inset) * (0.34 + edge_wear * 0.3))
        cyan_strip = abs(v - 0.22) < 0.012 and 0.16 < u < 0.84
        color = mix_color(color, (0.16, 0.86, 0.92), cyan_strip * cyan * 0.66)
        wear = edge_wear * (smooth_blob(u, v, 0.1, 0.1, 0.24, 0.14) + smooth_blob(u, v, 0.86, 0.82, 0.2, 0.18))
        color = mix_color(color, (0.58, 0.62, 0.56), wear * 0.22)
        return color[0], color[1], color[2], 1

    def lens_pixel(kind):
        def inner(u, v, x, y):
            if kind == "warm":
                a = (0.95, 0.62, 0.28)
                b = (1.0, 0.82, 0.46)
            elif kind == "white":
                a = (0.75, 0.92, 0.95)
                b = (0.95, 1.0, 0.98)
            else:
                a = (0.12, 0.82, 0.95)
                b = (0.62, 0.98, 1.0)
            radial = smooth_blob(u, v, 0.5, 0.48, 0.46, 0.34)
            scan = 0.08 * math.sin(y * 0.45)
            color = mix_color(a, b, radial * 0.62 + scan)
            color = mix_color(color, (0.04, 0.08, 0.09), clamp(max(abs(u - 0.5), abs(v - 0.5)) * 2 - 0.78) * 0.34)
            return color[0], color[1], color[2], 1

        return inner

    TEXTURE_IMAGES["fabric"] = save_texture("level02_image2_false_home_fabric_weave", 1024, 1024, fabric_pixel)
    TEXTURE_IMAGES["panel"] = save_texture("level02_image2_cool_gray_service_panel", 1024, 1024, panel_pixel)
    TEXTURE_IMAGES["dark"] = save_texture("level02_image2_smoked_titanium_scratched", 1024, 1024, dark_metal_pixel)
    TEXTURE_IMAGES["photo"] = save_texture("level02_image2_absent_family_photo_glass", 1024, 1024, photo_pixel)
    TEXTURE_IMAGES["floor"] = save_texture("level02_image2_residential_floor_reflection_panel", 1024, 1024, floor_pixel)
    TEXTURE_IMAGES["warm_lens"] = save_texture("level02_image2_lamp_lens_warm", 256, 256, lens_pixel("warm"))
    TEXTURE_IMAGES["white_lens"] = save_texture("level02_image2_lamp_lens_white", 256, 256, lens_pixel("white"))
    TEXTURE_IMAGES["blue_lens"] = save_texture("level02_image2_lamp_lens_blue", 256, 256, lens_pixel("blue"))
    return TEXTURE_IMAGES


def smooth_blob(u, v, cx, cy, sx, sy):
    dx = (u - cx) / max(0.001, sx)
    dy = (v - cy) / max(0.001, sy)
    return math.exp(-(dx * dx + dy * dy))


def mat(name, color, metallic=0.0, roughness=0.55, emission=None, strength=0.0, alpha=1.0, texture=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    nodes = material.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf_input(bsdf, "Metallic").default_value = metallic
        bsdf_input(bsdf, "Roughness").default_value = roughness
        bsdf_input(bsdf, "Alpha").default_value = alpha
        bsdf_input(bsdf, "Base Color").default_value = color
        if texture:
            texture_node = nodes.new("ShaderNodeTexImage")
            texture_node.image = texture
            texture_node.extension = "REPEAT"
            material.node_tree.links.new(texture_node.outputs["Color"], bsdf_input(bsdf, "Base Color"))
            material["hp_uses_image2_texture"] = True
        if emission:
            bsdf_input(bsdf, "Emission Color").default_value = emission
            bsdf_input(bsdf, "Emission Strength").default_value = strength
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    return material


def bsdf_input(bsdf, identifier):
    for socket in bsdf.inputs:
        if socket.identifier == identifier or socket.name == identifier:
            return socket
    raise KeyError(f"Principled BSDF input not found: {identifier}")


def palette(candidate, variant="neutral"):
    textures = generate_story_textures()
    furniture_atlas = textures["source_furniture_atlas"]
    terminal_atlas = textures["source_terminal_atlas"]
    surface_atlas = textures["source_surface_atlas"]
    clean_atlas = textures["source_clean_atlas"]
    cyan = clamp(candidate["emissiveCyan"])
    warm = clamp(candidate["emissiveWarm"])
    gold = clamp(candidate["gold"])
    fabric = clamp(candidate["fabric"])
    metal = clamp(candidate["metal"])
    rough = clamp(candidate["rough"])
    glass = clamp(candidate["glass"])

    dark = mat("smoked_titanium_black_image2_atlas", (0.035, 0.055, 0.06, 1), metallic=metal, roughness=rough, texture=furniture_atlas)
    body = mat(
        "cool_gray_white_panel_image2_atlas",
        (0.46 + fabric * 0.16, 0.55 + fabric * 0.14, 0.55 + fabric * 0.12, 1),
        metallic=0.08 + metal * 0.22,
        roughness=0.52 + fabric * 0.22,
        texture=furniture_atlas,
    )
    soft = mat(
        "muted_residential_fabric",
        (0.34 + fabric * 0.18, 0.42 + fabric * 0.11, 0.41 + fabric * 0.1, 1),
        metallic=0.0,
        roughness=0.76,
        texture=textures["fabric"],
    )
    rail = mat("aged_service_rail", (0.16 + gold * 0.38, 0.13 + gold * 0.25, 0.08 + gold * 0.08, 1), metallic=0.65, roughness=0.38)
    cyan_glow = mat("medical_cyan_glow", (0.24, 0.9, 0.94, 1), metallic=0.0, roughness=0.22, emission=(0.3, 0.95, 1.0, 1), strength=0.6 + cyan * 1.6)
    warm_glow = mat("domestic_warm_glow", (0.95, 0.72, 0.38, 1), metallic=0.0, roughness=0.28, emission=(1.0, 0.62, 0.25, 1), strength=0.45 + warm * 1.55)
    white_glow = mat("quiet_white_glow", (0.78, 0.94, 0.96, 1), metallic=0.0, roughness=0.24, emission=(0.78, 0.94, 0.96, 1), strength=0.7 + (cyan + warm) * 0.8)
    red_small = mat("tiny_fault_red", (0.72, 0.08, 0.045, 1), metallic=0.0, roughness=0.35, emission=(0.9, 0.05, 0.02, 1), strength=0.16)
    glass_mat = mat(
        "thin_smoked_glass",
        (0.12, 0.26, 0.27, 0.48),
        metallic=0.0,
        roughness=0.12,
        emission=(0.07, 0.42, 0.46, 1),
        strength=0.08 + glass * 0.4,
        alpha=0.52,
        texture=clean_atlas,
    )
    photo_mat = mat(
        "false_family_photo_image2",
        (0.12, 0.26, 0.27, 0.72),
        metallic=0.0,
        roughness=0.18,
        emission=(0.08, 0.36, 0.38, 1),
        strength=0.12 + glass * 0.34,
        alpha=0.84,
        texture=textures["photo"],
    )
    screen = mat(
        "terminal_screen_image2_atlas",
        (0.1, 0.22, 0.24, 0.86),
        metallic=0.0,
        roughness=0.18,
        emission=(0.08, 0.44, 0.5, 1),
        strength=0.18 + cyan * 0.48,
        alpha=0.92,
        texture=terminal_atlas,
    )
    rug = mat("reflective_residential_floor_panel_image2_atlas", (0.24, 0.31, 0.31, 1), metallic=0.18, roughness=0.32, texture=surface_atlas)
    if variant == "warm":
        lamp = mat(
            "domestic_warm_lens_image2",
            (0.95, 0.72, 0.38, 1),
            metallic=0.0,
            roughness=0.22,
            emission=(1.0, 0.62, 0.25, 1),
            strength=0.55 + warm * 1.65,
            texture=textures["warm_lens"],
        )
    elif variant == "white":
        lamp = mat(
            "quiet_white_lens_image2",
            (0.78, 0.94, 0.96, 1),
            metallic=0.0,
            roughness=0.2,
            emission=(0.78, 0.94, 0.96, 1),
            strength=0.74 + (cyan + warm) * 0.9,
            texture=textures["white_lens"],
        )
    elif variant == "blue":
        lamp = mat(
            "medical_blue_lens_image2",
            (0.24, 0.9, 0.94, 1),
            metallic=0.0,
            roughness=0.2,
            emission=(0.3, 0.95, 1.0, 1),
            strength=0.68 + cyan * 1.7,
            texture=textures["blue_lens"],
        )
    else:
        lamp = cyan_glow
    return {
        "dark": dark,
        "body": body,
        "soft": soft,
        "rail": rail,
        "cyan": cyan_glow,
        "warm": warm_glow,
        "white": white_glow,
        "red": red_small,
        "glass": glass_mat,
        "photo": photo_mat,
        "screen": screen,
        "rug": rug,
        "lamp": lamp,
    }


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def root_node(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def ensure_image2_uv(obj, material):
    if not material or not material.get("hp_uses_image2_texture"):
        return
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.018)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


def cube(name, loc, scale, material, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        obj.data.materials.append(material)
        ensure_image2_uv(obj, material)
    if bevel > 0:
        modifier = obj.modifiers.new(name="hp_beveled_edges", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.affect = "EDGES"
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def cyl(name, loc, radius, depth, material, parent=None, vertices=32, rotation=(0, 0, 0), bevel=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
        ensure_image2_uv(obj, material)
    if bevel:
        modifier = obj.modifiers.new(name="hp_cylinder_bevel", type="BEVEL")
        modifier.width = radius * 0.08
        modifier.segments = 2
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def add_frame(root, mats, width, height, z, y, thickness=0.045, depth=0.04, prefix="frame"):
    cube(f"{prefix}_top", (0, y, z + height * 0.5), (width, depth, thickness), mats["rail"], root, 0.01)
    cube(f"{prefix}_bottom", (0, y, z - height * 0.5), (width, depth, thickness), mats["rail"], root, 0.01)
    cube(f"{prefix}_left", (-width * 0.5, y, z), (thickness, depth, height), mats["rail"], root, 0.01)
    cube(f"{prefix}_right", (width * 0.5, y, z), (thickness, depth, height), mats["rail"], root, 0.01)


def add_panel_lines(root, mats, width, depth, z, count, prefix, color_key="cyan"):
    if count <= 0:
        return
    for index in range(count):
        x = -width * 0.36 + (width * 0.72) * (index / max(1, count - 1))
        cube(f"{prefix}_line_{index}", (x, 0, z), (0.025, depth, 0.018), mats[color_key], root, 0.003)


def export_asset(root, model_key):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj == root or obj.parent == root)
    bpy.context.view_layer.objects.active = root
    path = MODEL_DIR / f"hp_{model_key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    return path


def dims(model_key):
    candidate = TARGETS[model_key]["bestCandidate"]
    return candidate["width"], candidate["height"], candidate["depth"], candidate


def build_sofa(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("contact_shadow_plinth", (0, 0, 0.08), (w * 0.96, d * 0.92, 0.16), mats["dark"], root, b * 0.75)
    cube("seat_cushion_single_mass", (0, 0.02, 0.36), (w * 0.9, d * 0.82, h * 0.26), mats["soft"], root, b)
    cube("back_rest_broad_low", (0, d * 0.37, h * 0.58), (w * 0.94, d * 0.18, h * 0.72), mats["soft"], root, b)
    cube("left_arm_block", (-w * 0.52, 0, h * 0.46), (w * 0.11, d * 0.84, h * 0.58), mats["body"], root, b)
    cube("right_arm_block", (w * 0.52, 0, h * 0.46), (w * 0.11, d * 0.84, h * 0.58), mats["body"], root, b)
    cube("under_cyan_service_strip", (0, -d * 0.43, 0.18), (w * 0.72, 0.035, 0.04), mats["cyan"], root, 0.006)
    cube("warm_residential_nameplate_blank", (-w * 0.31, -d * 0.44, 0.52), (w * 0.16, 0.028, 0.045), mats["rail"], root, 0.005)
    cube("small_fault_indicator_not_answer", (w * 0.34, -d * 0.44, 0.54), (w * 0.035, 0.026, 0.035), mats["red"], root, 0.004)
    for x in (-w * 0.36, w * 0.36):
        for y in (-d * 0.32, d * 0.32):
            cyl("short_recessed_leg", (x, y, 0.02), 0.035, 0.16, mats["dark"], root, 14, bevel=True)
    return export_asset(root, model_key)


def build_low_table(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("wide_grounded_shadow_base", (0, 0, 0.07), (w * 0.92, d * 0.86, 0.14), mats["dark"], root, b * 0.65)
    cube("floating_but_supported_table_slab", (0, 0, h * 0.68), (w, d, h * 0.22), mats["body"], root, b)
    cube("smoked_glass_inset", (0, 0, h * 0.81), (w * 0.62, d * 0.54, 0.018), mats["glass"], root, 0.01)
    cube("front_service_drawer", (0, -d * 0.52, h * 0.49), (w * 0.7, 0.045, h * 0.16), mats["dark"], root, 0.01)
    cube("front_cyan_drawer_readline", (w * 0.18, -d * 0.55, h * 0.5), (w * 0.25, 0.024, h * 0.035), mats["cyan"], root, 0.004)
    cube("blank_warm_tray_card", (-w * 0.25, 0.08, h * 0.85), (w * 0.26, d * 0.28, 0.024), mats["rail"], root, 0.006)
    for x in (-w * 0.38, w * 0.38):
        for y in (-d * 0.3, d * 0.3):
            cyl("black_table_leg", (x, y, h * 0.32), 0.026, h * 0.52, mats["dark"], root, 12, bevel=True)
    return export_asset(root, model_key)


def build_photo_wall(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("wall_mount_backplate", (0, 0, h * 0.55), (w, d, h), mats["dark"], root, b)
    cube("cool_gray_inner_wall_face", (0, -d * 0.54, h * 0.55), (w * 0.92, d * 0.18, h * 0.82), mats["body"], root, 0.012)
    add_frame(root, mats, w * 0.96, h * 0.88, h * 0.55, -d * 0.66, 0.045, d * 0.16, "outer_memory_frame")
    frame_w = w * 0.2
    for index, x in enumerate([-w * 0.3, 0, w * 0.3]):
        z = h * (0.54 + (0.04 if index == 1 else -0.02))
        cube(f"image2_false_family_photo_panel_{index}", (x, -d * 0.76, z), (frame_w, d * 0.1, h * 0.46), mats["photo"], root, 0.01)
        add_frame(root, mats, frame_w * 1.06, h * 0.5, z, -d * 0.82, 0.026, d * 0.08, f"photo_frame_{index}")
        cyl(f"abstract_head_marker_{index}", (x, -d * 0.88, z + h * 0.09), frame_w * 0.13, d * 0.035, mats["body"], root, 24, rotation=(math.pi / 2, 0, 0), bevel=True)
        cube(f"abstract_body_marker_{index}", (x, -d * 0.89, z - h * 0.09), (frame_w * 0.12, d * 0.032, h * 0.21), mats["body"], root, 0.006)
    cube("thin_cyan_top_scanline", (0, -d * 0.9, h * 0.94), (w * 0.72, d * 0.05, 0.025), mats["cyan"], root, 0.004)
    cube("small_warm_archive_tab", (-w * 0.42, -d * 0.9, h * 0.18), (w * 0.14, d * 0.05, 0.035), mats["rail"], root, 0.004)
    return export_asset(root, model_key)


def build_rug_panel(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = max(0.008, c["bevel"] * 0.45)
    cube("single_low_floor_panel", (0, 0, h * 0.5), (w, d, h), mats["rug"], root, b)
    cube("dark_recessed_outer_border", (0, 0, h * 1.28), (w * 0.94, d * 0.92, h * 0.36), mats["dark"], root, b)
    cube("inner_reflective_plate", (0, 0, h * 1.55), (w * 0.78, d * 0.62, h * 0.28), mats["body"], root, b * 0.75)
    cube("front_cyan_floor_line", (0, -d * 0.31, h * 1.78), (w * 0.72, 0.022, h * 0.22), mats["cyan"], root, 0.003)
    cube("rear_warm_floor_line", (0, d * 0.27, h * 1.8), (w * 0.52, 0.02, h * 0.2), mats["rail"], root, 0.003)
    for index, x in enumerate([-w * 0.32, -w * 0.12, w * 0.12, w * 0.32]):
        cube(f"subtle_panel_rib_{index}", (x, 0, h * 1.82), (0.018, d * 0.58, h * 0.18), mats["dark"], root, 0.002)
    return export_asset(root, model_key)


def build_lamp(model_key, variant):
    w, h, d, c = dims(model_key)
    mats = palette(c, variant)
    root = root_node(model_key)
    b = c["bevel"]
    cube("weighted_floor_base", (0, 0, 0.08), (w * 0.86, d * 0.74, 0.16), mats["dark"], root, b * 0.65)
    cyl("vertical_service_spine", (0, 0, h * 0.45), w * 0.07, h * 0.74, mats["rail"], root, 18, bevel=True)
    cube("lamp_back_housing", (0, d * 0.08, h * 0.72), (w * 0.58, d * 0.18, h * 0.64), mats["body"], root, b)
    cube("front_glowing_lens", (0, -d * 0.055, h * 0.72), (w * 0.42, d * 0.075, h * 0.5), mats["lamp"], root, b * 0.6)
    cube("top_cap_dark", (0, 0, h * 1.05), (w * 0.64, d * 0.34, h * 0.08), mats["dark"], root, b * 0.5)
    cube("bottom_cap_dark", (0, 0, h * 0.36), (w * 0.56, d * 0.3, h * 0.07), mats["dark"], root, b * 0.5)
    cube("small_side_handle", (w * 0.35, -d * 0.04, h * 0.68), (w * 0.06, d * 0.12, h * 0.22), mats["rail"], root, 0.006)
    return export_asset(root, model_key)


def build_control_pedestal(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("grounded_pedestal_base", (0, 0, 0.12), (w * 0.86, d * 0.84, 0.24), mats["dark"], root, b * 0.7)
    cube("sloped_control_body", (0, 0, h * 0.5), (w * 0.72, d * 0.58, h * 0.74), mats["body"], root, b)
    cube("image2_recessed_light_sequence_screen", (0, -d * 0.31, h * 0.72), (w * 0.58, d * 0.045, h * 0.26), mats["screen"], root, 0.012)
    cube("cyan_screen_baseline", (0, -d * 0.34, h * 0.77), (w * 0.46, d * 0.024, h * 0.028), mats["cyan"], root, 0.003)
    colors = [mats["warm"], mats["white"], mats["cyan"]]
    for index, x in enumerate([-w * 0.22, 0, w * 0.22]):
        cube(f"large_color_button_{index}", (x, -d * 0.34, h * 0.47), (w * 0.13, d * 0.04, h * 0.08), colors[index], root, 0.008)
    cube("blank_sequence_tray_no_answer", (0, 0.03, h * 0.95), (w * 0.52, d * 0.18, h * 0.04), mats["rail"], root, 0.006)
    for x in (-w * 0.36, w * 0.36):
        cyl("rear_cable_socket", (x, d * 0.34, h * 0.34), w * 0.035, d * 0.08, mats["dark"], root, 12, rotation=(math.pi / 2, 0, 0), bevel=True)
    return export_asset(root, model_key)


def build_service_closet(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("heavy_shadow_plinth", (0, 0, 0.1), (w * 0.96, d * 0.92, 0.2), mats["dark"], root, b * 0.7)
    cube("tall_service_case", (0, 0, h * 0.53), (w, d, h), mats["body"], root, b)
    cube("left_smoked_door", (-w * 0.24, -d * 0.51, h * 0.58), (w * 0.42, d * 0.055, h * 0.72), mats["dark"], root, 0.012)
    cube("right_exposed_service_bay_image2_screen", (w * 0.24, -d * 0.53, h * 0.58), (w * 0.42, d * 0.06, h * 0.72), mats["screen"], root, 0.012)
    for idx, z in enumerate([h * 0.42, h * 0.5, h * 0.58, h * 0.66]):
        cube(f"closet_vent_slit_{idx}", (-w * 0.24, -d * 0.57, z), (w * 0.28, d * 0.025, h * 0.018), mats["dark"], root, 0.002)
    add_panel_lines(root, mats, w * 0.34, d * 0.032, h * 0.63, 4, "service_bay_tool", "cyan")
    cube("bottom_hazard_but_muted_gold_bar", (0, -d * 0.58, h * 0.13), (w * 0.72, d * 0.04, h * 0.045), mats["rail"], root, 0.004)
    cube("small_fault_indicator", (-w * 0.44, -d * 0.58, h * 0.88), (w * 0.045, d * 0.03, h * 0.04), mats["red"], root, 0.004)
    return export_asset(root, model_key)


def build_robot_dock(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("charging_dock_floor_plinth", (0, 0, 0.1), (w, d, 0.2), mats["dark"], root, b * 0.7)
    cube("rear_power_column", (0, d * 0.35, h * 0.54), (w * 0.62, d * 0.18, h * 0.86), mats["body"], root, b)
    cube("central_empty_cradle_space", (0, 0.05, h * 0.34), (w * 0.58, d * 0.46, h * 0.24), mats["dark"], root, b * 0.6)
    for x in (-w * 0.32, w * 0.32):
        cube("dock_side_clamp_arm", (x, -d * 0.05, h * 0.45), (w * 0.09, d * 0.54, h * 0.12), mats["rail"], root, 0.008)
        cube("dock_cyan_charge_tip", (x, -d * 0.36, h * 0.45), (w * 0.1, d * 0.06, h * 0.08), mats["cyan"], root, 0.006)
    cube("rear_charge_status_screen_image2", (0, d * 0.245, h * 0.72), (w * 0.38, d * 0.045, h * 0.15), mats["screen"], root, 0.006)
    cube("small_gold_service_slot", (0, -d * 0.41, h * 0.2), (w * 0.46, d * 0.04, h * 0.055), mats["rail"], root, 0.004)
    return export_asset(root, model_key)


def build_tv_wall_director(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("deep_wall_shadow_backer", (0, 0, h * 0.52), (w, d, h), mats["dark"], root, b)
    cube("cool_gray_surround_panel", (0, -d * 0.48, h * 0.54), (w * 0.94, d * 0.18, h * 0.84), mats["body"], root, b * 0.55)
    cube("wide_false_home_observation_screen", (0, -d * 0.62, h * 0.58), (w * 0.72, d * 0.08, h * 0.5), mats["screen"], root, 0.014)
    add_frame(root, mats, w * 0.78, h * 0.56, h * 0.58, -d * 0.68, 0.038, d * 0.08, "tv_screen_frame")
    cube("cyan_horizon_scan_line", (0, -d * 0.74, h * 0.72), (w * 0.58, d * 0.026, h * 0.018), mats["cyan"], root, 0.003)
    cube("lower_cyan_audio_trace", (w * 0.08, -d * 0.745, h * 0.44), (w * 0.36, d * 0.024, h * 0.014), mats["cyan"], root, 0.002)
    cube("small_warm_domestic_status", (-w * 0.37, -d * 0.74, h * 0.24), (w * 0.12, d * 0.026, h * 0.035), mats["rail"], root, 0.004)
    cube("tiny_locked_fault_tick", (w * 0.42, -d * 0.74, h * 0.25), (w * 0.025, d * 0.024, h * 0.04), mats["red"], root, 0.003)
    for index, y in enumerate([h * 0.18, h * 0.32, h * 0.78, h * 0.92]):
        cube(f"side_service_vent_{index}", (w * 0.43, -d * 0.62, y), (w * 0.1, d * 0.05, h * 0.024), mats["dark"], root, 0.002)
    return export_asset(root, model_key)


def build_recovery_bed(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("clinical_bed_ground_shadow", (0, 0, 0.08), (w * 0.94, d * 0.9, 0.16), mats["dark"], root, b * 0.6)
    cube("low_service_base", (0, 0, h * 0.24), (w * 0.86, d * 0.72, h * 0.22), mats["body"], root, b)
    cube("muted_recovery_mattress", (0, -d * 0.02, h * 0.48), (w * 0.82, d * 0.78, h * 0.2), mats["soft"], root, b)
    cube("raised_head_panel", (0, d * 0.39, h * 0.66), (w * 0.88, d * 0.12, h * 0.48), mats["soft"], root, b)
    cube("left_clinical_rail", (-w * 0.46, -d * 0.02, h * 0.58), (w * 0.055, d * 0.72, h * 0.16), mats["rail"], root, 0.006)
    cube("right_clinical_rail", (w * 0.46, -d * 0.02, h * 0.58), (w * 0.055, d * 0.72, h * 0.16), mats["rail"], root, 0.006)
    cube("bed_cyan_life_strip", (0, -d * 0.44, h * 0.5), (w * 0.52, d * 0.028, h * 0.035), mats["cyan"], root, 0.004)
    cube("blank_family_card_tray", (-w * 0.24, -d * 0.18, h * 0.63), (w * 0.18, d * 0.22, h * 0.024), mats["rail"], root, 0.004)
    cyl("left_round_bed_wheel_front", (-w * 0.34, -d * 0.35, 0.055), 0.045, 0.045, mats["dark"], root, 16, rotation=(math.pi / 2, 0, 0), bevel=True)
    cyl("right_round_bed_wheel_front", (w * 0.34, -d * 0.35, 0.055), 0.045, 0.045, mats["dark"], root, 16, rotation=(math.pi / 2, 0, 0), bevel=True)
    return export_asset(root, model_key)


def build_observation_window(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("observation_wall_backplate", (0, 0, h * 0.54), (w, d, h), mats["dark"], root, b)
    cube("inset_cool_wall_surround", (0, -d * 0.48, h * 0.54), (w * 0.92, d * 0.16, h * 0.82), mats["body"], root, b * 0.55)
    cube("smoked_lab_window_glass", (0, -d * 0.64, h * 0.58), (w * 0.72, d * 0.075, h * 0.56), mats["glass"], root, 0.012)
    add_frame(root, mats, w * 0.78, h * 0.62, h * 0.58, -d * 0.7, 0.036, d * 0.07, "observation_frame")
    for index, x in enumerate([-w * 0.22, 0, w * 0.22]):
        cyl(f"absent_observer_head_{index}", (x, -d * 0.76, h * 0.67), w * 0.035, d * 0.03, mats["body"], root, 18, rotation=(math.pi / 2, 0, 0), bevel=True)
        cube(f"absent_observer_body_{index}", (x, -d * 0.765, h * 0.5), (w * 0.055, d * 0.028, h * 0.18), mats["body"], root, 0.004)
    cube("cyan_one_way_glass_scan", (0, -d * 0.78, h * 0.82), (w * 0.54, d * 0.022, h * 0.016), mats["cyan"], root, 0.002)
    cube("warm_false_home_label_strip", (-w * 0.28, -d * 0.78, h * 0.24), (w * 0.2, d * 0.022, h * 0.032), mats["rail"], root, 0.004)
    return export_asset(root, model_key)


def build_service_wall_rupture(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("rupture_dark_backing", (0, 0, h * 0.53), (w, d, h), mats["dark"], root, b)
    cube("left_residential_skin_plate", (-w * 0.23, -d * 0.45, h * 0.56), (w * 0.45, d * 0.16, h * 0.82), mats["body"], root, b * 0.55)
    cube("right_residential_skin_plate", (w * 0.27, -d * 0.46, h * 0.48), (w * 0.36, d * 0.15, h * 0.66), mats["body"], root, b * 0.55)
    cube("exposed_service_cavity", (w * 0.08, -d * 0.6, h * 0.58), (w * 0.34, d * 0.09, h * 0.72), mats["dark"], root, 0.012)
    for index, x in enumerate([-w * 0.04, w * 0.06, w * 0.16]):
        cyl(f"vertical_exposed_pipe_{index}", (x, -d * 0.68, h * 0.58), w * 0.018, h * 0.62, mats["rail"], root, 14, bevel=True)
    cube("cold_cyan_crack_light", (w * 0.07, -d * 0.72, h * 0.68), (w * 0.22, d * 0.026, h * 0.035), mats["cyan"], root, 0.003)
    cube("lower_warning_but_not_door_red", (-w * 0.36, -d * 0.7, h * 0.18), (w * 0.045, d * 0.024, h * 0.038), mats["red"], root, 0.003)
    cube("peeled_wall_diagonal_shadow", (-w * 0.03, -d * 0.735, h * 0.44), (w * 0.58, d * 0.02, h * 0.028), mats["dark"], root, 0.002)
    bpy.context.object.rotation_euler[2] = -0.38
    return export_asset(root, model_key)


def build_floor_path_inlay(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = max(0.006, c["bevel"] * 0.42)
    cube("long_dark_floor_inlay_backer", (0, 0, h * 0.55), (w, d, h), mats["dark"], root, b)
    cube("brushed_route_plate", (0, 0, h * 1.02), (w * 0.94, d * 0.64, h * 0.34), mats["rug"], root, b)
    cube("warm_first_route_segment", (-w * 0.28, 0, h * 1.28), (w * 0.24, d * 0.18, h * 0.18), mats["warm"], root, 0.002)
    cube("white_middle_route_segment", (0, 0, h * 1.29), (w * 0.24, d * 0.18, h * 0.18), mats["white"], root, 0.002)
    cube("cyan_last_route_segment", (w * 0.28, 0, h * 1.3), (w * 0.24, d * 0.18, h * 0.18), mats["cyan"], root, 0.002)
    for index, x in enumerate([-w * 0.42, -w * 0.14, w * 0.14, w * 0.42]):
        cube(f"floor_path_cross_rib_{index}", (x, 0, h * 1.33), (0.018, d * 0.54, h * 0.16), mats["rail"], root, 0.002)
    return export_asset(root, model_key)


def build_ceiling_softbox(model_key):
    w, h, d, c = dims(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("softbox_dark_upper_housing", (0, 0, h * 0.58), (w, d, h), mats["dark"], root, b)
    cube("frosted_light_diffuser", (0, -d * 0.02, h * 0.36), (w * 0.82, d * 0.68, h * 0.32), mats["white"], root, b * 0.5)
    cube("cyan_service_edge_left", (-w * 0.43, 0, h * 0.42), (w * 0.025, d * 0.72, h * 0.16), mats["cyan"], root, 0.002)
    cube("cyan_service_edge_right", (w * 0.43, 0, h * 0.42), (w * 0.025, d * 0.72, h * 0.16), mats["cyan"], root, 0.002)
    cube("warm_domestic_edge_center", (0, -d * 0.36, h * 0.43), (w * 0.38, d * 0.025, h * 0.14), mats["warm"], root, 0.002)
    for index, x in enumerate([-w * 0.25, 0, w * 0.25]):
        cube(f"softbox_internal_baffle_{index}", (x, 0, h * 0.24), (w * 0.02, d * 0.52, h * 0.12), mats["body"], root, 0.002)
    return export_asset(root, model_key)


BUILDERS = {
    "room_lounge_sofa_residential": build_sofa,
    "room_lounge_low_table_residential": build_low_table,
    "room_fake_family_photo_wall": build_photo_wall,
    "room_residential_rug_panel": build_rug_panel,
    "light_residential_lamp_warm": lambda model_key: build_lamp(model_key, "warm"),
    "light_residential_lamp_white": lambda model_key: build_lamp(model_key, "white"),
    "light_residential_lamp_blue": lambda model_key: build_lamp(model_key, "blue"),
    "terminal_family_light_control_pedestal": build_control_pedestal,
    "room_carekeeper_service_closet": build_service_closet,
    "room_service_robot_dock_residential": build_robot_dock,
    "room_residential_tv_wall_director": build_tv_wall_director,
    "room_residential_recovery_bed": build_recovery_bed,
    "room_residential_observation_window": build_observation_window,
    "room_residential_service_wall_rupture": build_service_wall_rupture,
    "room_residential_floor_path_inlay": build_floor_path_inlay,
    "room_residential_ceiling_softbox": build_ceiling_softbox,
}


def main():
    generated = []
    for model_key, builder in BUILDERS.items():
        clear_scene()
        output = builder(model_key)
        target = TARGETS[model_key]
        generated.append(
            {
                "modelKey": model_key,
                "file": str(output.relative_to(ROOT)),
                "score": target["bestScore"],
                "candidate": target["bestCandidate"],
                "roomRole": target["roomRole"],
                "layoutRole": target["layoutRole"],
            }
        )
        print(f"generated {output}")

    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "schema": "human-protocol/level02-furniture-assets@2",
                "sourceReport": str(REPORT_PATH.relative_to(ROOT)),
                "storyArtReport": str(STORY_ART_REPORT_PATH.relative_to(ROOT)),
                "sourceBlend": str(SOURCE_BLEND.relative_to(ROOT)),
                "textureDirectory": str(TEXTURE_DIR.relative_to(ROOT)),
                "image2Textures": [
                    str((WGPU_TEXTURE_DIR / "hp_image2_furniture_material_atlas_v1.png").relative_to(ROOT)),
                    str((WGPU_TEXTURE_DIR / "hp_image2_terminal_screen_atlas_v1.png").relative_to(ROOT)),
                    str((WGPU_TEXTURE_DIR / "hp_image2_environment_surfaces_atlas_v1.png").relative_to(ROOT)),
                    str((WGPU_TEXTURE_DIR / "hp_image2_clean_atlas_v1.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_false_home_fabric_weave.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_cool_gray_service_panel.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_smoked_titanium_scratched.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_absent_family_photo_glass.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_residential_floor_reflection_panel.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_lamp_lens_warm.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_lamp_lens_white.png").relative_to(ROOT)),
                    str((TEXTURE_DIR / "level02_image2_lamp_lens_blue.png").relative_to(ROOT)),
                ],
                "assets": generated,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
