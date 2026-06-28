import json
import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "src/assets/manifests/reports/human_protocol_level03_museum_art_objective_v2_report.json"
MODEL_DIR = ROOT / "src/assets/models/environment/level03"
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level03"
SOURCE_DIR = ROOT / "src/assets/source_blend/level03"
MANIFEST_PATH = ROOT / "src/assets/manifests/runtime/human_protocol_level03_museum_assets_v2.json"
SOURCE_BLEND = SOURCE_DIR / "human_protocol_level03_museum_assets_v2.blend"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
SOURCE_DIR.mkdir(parents=True, exist_ok=True)

with REPORT_PATH.open("r", encoding="utf-8") as handle:
    SEARCH_REPORT = json.load(handle)

TARGETS = {entry["modelKey"]: entry for entry in SEARCH_REPORT["targets"]}


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


def blob(u, v, cx, cy, sx, sy):
    dx = (u - cx) / max(0.001, sx)
    dy = (v - cy) / max(0.001, sy)
    return math.exp(-(dx * dx + dy * dy))


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


TEXTURES = {}


def generate_textures():
    if TEXTURES:
        return TEXTURES

    def museum_stone(u, v, x, y):
        base = (0.025, 0.031, 0.032)
        cool = (0.105, 0.145, 0.145)
        dark = (0.008, 0.012, 0.014)
        brass = (0.54, 0.38, 0.18)
        grain = noise(x * 0.19, y * 0.14, 3)
        vein = 1 if abs(math.sin((u * 5.6 + v * 3.1) * math.pi)) > 0.992 else 0
        panel = abs((u * 4) % 1 - 0.5) < 0.01 or abs((v * 3) % 1 - 0.5) < 0.01
        brass_line = abs((u * 2.0 + v * 0.72) % 1 - 0.5) < 0.004
        screw = max(
            blob(u, v, 0.07, 0.08, 0.018, 0.018),
            blob(u, v, 0.93, 0.08, 0.018, 0.018),
            blob(u, v, 0.07, 0.92, 0.018, 0.018),
            blob(u, v, 0.93, 0.92, 0.018, 0.018),
        )
        polish = blob(u, v, 0.28, 0.72, 0.32, 0.14) + blob(u, v, 0.76, 0.32, 0.2, 0.2)
        color = mix_color(base, cool, 0.08 + grain * 0.22 + polish * 0.18)
        color = mix_color(color, dark, panel * 0.45)
        color = mix_color(color, (0.74, 0.79, 0.73), vein * 0.22)
        color = mix_color(color, brass, brass_line * 0.46)
        color = mix_color(color, (0.0, 0.004, 0.005), screw * 0.7)
        return color[0], color[1], color[2], 1

    def label_panel(u, v, x, y):
        base = (0.035, 0.044, 0.043)
        ink = (0.66, 0.69, 0.62)
        cyan = (0.15, 0.68, 0.72)
        warm = (0.76, 0.52, 0.25)
        border = abs(u - 0.5) > 0.47 or abs(v - 0.5) > 0.45
        inner_border = abs(u - 0.5) > 0.405 or abs(v - 0.5) > 0.38
        color = mix_color(base, (0.09, 0.1, 0.09), noise(x, y, 9) * 0.22)
        color = mix_color(color, warm, border * 0.55)
        color = mix_color(color, warm, inner_border * 0.2)
        title = 1 if 0.12 < u < 0.88 and abs(v - 0.78) < 0.018 else 0
        color = mix_color(color, cyan, title * 0.58)
        for row in range(5):
            y0 = 0.22 + row * 0.085
            if 0.16 < u < 0.78 - row * 0.035 and abs(v - y0) < 0.009:
                color = mix_color(color, ink, 0.66)
        if 0.1 < u < 0.24 and 0.1 < v < 0.2:
            color = mix_color(color, (0.38, 0.27, 0.13), 0.5)
        return color[0], color[1], color[2], 1

    def body_reference(u, v, x, y):
        base = (0.018, 0.028, 0.03)
        cyan = (0.28, 0.88, 0.92)
        white = (0.78, 0.86, 0.82)
        red = (0.58, 0.06, 0.045)
        color = mix_color(base, (0.065, 0.1, 0.1), noise(x, y, 17) * 0.22)
        head = blob(u, v, 0.5, 0.22, 0.085, 0.1)
        spine = 1 if abs(u - 0.5) < 0.014 and 0.3 < v < 0.78 else 0
        ribs = 0
        for row in range(5):
            yy = 0.38 + row * 0.065
            ribs = max(ribs, 1 if abs(v - yy) < 0.008 and abs(u - 0.5) < 0.18 - row * 0.015 else 0)
        limb_l = 1 if abs((u - 0.38) + (v - 0.52) * 0.32) < 0.012 and 0.42 < v < 0.8 else 0
        limb_r = 1 if abs((u - 0.62) - (v - 0.52) * 0.32) < 0.012 and 0.42 < v < 0.8 else 0
        body = clamp(head + spine + ribs + limb_l + limb_r)
        color = mix_color(color, white, body * 0.62)
        color = mix_color(color, cyan, body * 0.26)
        if abs(v - 0.86) < 0.011 and 0.22 < u < 0.78:
            color = mix_color(color, red, 0.34)
        if 0.16 < u < 0.84 and (abs(v - 0.12) < 0.006 or abs(v - 0.92) < 0.006):
            color = mix_color(color, (0.74, 0.52, 0.24), 0.34)
        return color[0], color[1], color[2], 0.92

    def voice_wave(u, v, x, y):
        base = (0.025, 0.055, 0.06)
        cyan = (0.12, 0.86, 0.92)
        color = mix_color(base, (0.08, 0.14, 0.14), noise(x, y, 25) * 0.22)
        for line in range(4):
            y0 = 0.24 + line * 0.13
            amp = 0.025 + line * 0.006
            wave = y0 + math.sin(u * math.pi * (5 + line * 1.5)) * amp
            if abs(v - wave) < 0.01:
                color = mix_color(color, cyan, 0.78)
        if 0.08 < u < 0.92 and (abs(v - 0.1) < 0.008 or abs(v - 0.9) < 0.008):
            color = mix_color(color, (0.72, 0.58, 0.35), 0.42)
        return color[0], color[1], color[2], 0.94

    def route_gradient(u, v, x, y):
        yellow = (0.74, 0.5, 0.14)
        white = (0.72, 0.86, 0.82)
        blue = (0.1, 0.58, 0.68)
        red = (0.5, 0.07, 0.045)
        dark = (0.018, 0.024, 0.026)
        if u < 0.25:
            color = mix_color(yellow, white, u / 0.25)
        elif u < 0.55:
            color = mix_color(white, blue, (u - 0.25) / 0.3)
        else:
            color = mix_color(blue, red, (u - 0.55) / 0.45)
        edge = max(abs(v - 0.5) * 2, abs(u - 0.5) * 2)
        color = mix_color(color, dark, clamp(edge - 0.72) * 0.5)
        if abs(v - 0.5) < 0.055:
            color = mix_color(color, (0.88, 0.92, 0.82), 0.12)
        color = mix_color(color, (0.0, 0.006, 0.008), noise(x, y, 31) * 0.12)
        return color[0], color[1], color[2], 1

    def glass_noise(u, v, x, y):
        color = (0.025, 0.075, 0.08)
        color = mix_color(color, (0.28, 0.58, 0.6), blob(u, v, 0.28, 0.22, 0.42, 0.18) * 0.28)
        color = mix_color(color, (0.0, 0.012, 0.015), noise(x, y, 41) * 0.1)
        return color[0], color[1], color[2], 0.48

    TEXTURES["stone"] = save_texture("level03_image2_museum_stone_panel", 1024, 1024, museum_stone)
    TEXTURES["label"] = save_texture("level03_image2_museum_label_panel", 1024, 1024, label_panel)
    TEXTURES["body"] = save_texture("level03_image2_museum_body_reference", 1024, 1024, body_reference)
    TEXTURES["voice"] = save_texture("level03_image2_museum_voice_waveform", 1024, 1024, voice_wave)
    TEXTURES["route"] = save_texture("level03_image2_museum_floor_route_gradient", 1024, 512, route_gradient)
    TEXTURES["glass"] = save_texture("level03_image2_museum_smoked_glass", 512, 512, glass_noise)
    return TEXTURES


def bsdf_input(bsdf, identifier):
    for socket in bsdf.inputs:
        if socket.identifier == identifier or socket.name == identifier:
            return socket
    raise KeyError(f"Principled BSDF input not found: {identifier}")


def mat(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0, alpha=1.0, texture=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    nodes = material.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf_input(bsdf, "Base Color").default_value = color
        bsdf_input(bsdf, "Metallic").default_value = metallic
        bsdf_input(bsdf, "Roughness").default_value = roughness
        bsdf_input(bsdf, "Alpha").default_value = alpha
        if texture:
            tex = nodes.new("ShaderNodeTexImage")
            tex.image = texture
            tex.extension = "REPEAT"
            material.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Base Color"))
            material["hp_uses_image2_texture"] = True
        if emission:
            bsdf_input(bsdf, "Emission Color").default_value = emission
            bsdf_input(bsdf, "Emission Strength").default_value = strength
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    material.use_screen_refraction = alpha < 1
    return material


def palette(candidate, variant="neutral"):
    textures = generate_textures()
    stone = clamp(candidate["stone"])
    glass = clamp(candidate["glass"])
    brass = clamp(candidate["brass"])
    cyan = clamp(candidate["cyan"])
    warm = clamp(candidate["warmWhite"])
    red = clamp(candidate["red"])
    rough = clamp(candidate["roughness"])
    reflection = clamp(candidate["reflection"])
    return {
        "stone": mat("image2_black_museum_stone", (0.025 + stone * 0.045, 0.03 + stone * 0.055, 0.032 + stone * 0.052, 1), metallic=0.22, roughness=0.3 + rough * 0.28, texture=textures["stone"]),
        "dark": mat("smoked_black_titanium", (0.006, 0.012, 0.014, 1), metallic=0.78, roughness=0.28 + rough * 0.22, texture=textures["stone"]),
        "brass": mat("aged_brass_story_trim", (0.44 + brass * 0.36, 0.3 + brass * 0.24, 0.13 + brass * 0.14, 1), metallic=0.82, roughness=0.26 + rough * 0.22),
        "glass": mat("image2_smoked_archive_glass", (0.025, 0.09, 0.095, 0.42), metallic=0.0, roughness=0.06 + reflection * 0.13, emission=(0.02, 0.12, 0.13, 1), strength=0.03 + glass * 0.18, alpha=0.38 + glass * 0.18, texture=textures["glass"]),
        "cyan": mat("restrained_catalogue_cyan", (0.1, 0.66, 0.7, 1), roughness=0.24, emission=(0.1, 0.68, 0.72, 1), strength=0.18 + cyan * 0.75),
        "white": mat("warm_museum_exhibit_light", (0.86, 0.78, 0.62, 1), roughness=0.22, emission=(0.86, 0.74, 0.52, 1), strength=0.22 + warm * 0.82),
        "red": mat("tiny_archive_fault_red", (0.42, 0.045, 0.035, 1), roughness=0.26, emission=(0.62, 0.035, 0.025, 1), strength=0.04 + red * 0.62),
        "label": mat("image2_black_brass_museum_label", (0.06, 0.06, 0.052, 1), metallic=0.18, roughness=0.5 + rough * 0.22, texture=textures["label"]),
        "body": mat("image2_body_reference_archive_glass", (0.055, 0.12, 0.12, 0.82), roughness=0.14, emission=(0.08, 0.34, 0.36, 1), strength=0.15 + cyan * 0.42, alpha=0.78, texture=textures["body"]),
        "voice": mat("image2_voice_waveform_archive_screen", (0.04, 0.12, 0.12, 0.9), roughness=0.16, emission=(0.08, 0.38, 0.42, 1), strength=0.13 + cyan * 0.46, alpha=0.9, texture=textures["voice"]),
        "route": mat("image2_restrained_four_color_floor_route", (0.08, 0.1, 0.09, 1), metallic=0.32, roughness=0.24 + rough * 0.2, emission=(0.05, 0.18, 0.19, 1), strength=0.03 + reflection * 0.15, texture=textures["route"]),
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


def ensure_uv(obj, material):
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
        ensure_uv(obj, material)
    if bevel > 0:
        mod = obj.modifiers.new(name="hp_beveled_edges", type="BEVEL")
        mod.width = bevel
        mod.segments = 2
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def cyl(name, loc, radius, depth, material, parent=None, vertices=32, rotation=(0, 0, 0), bevel=True):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
        ensure_uv(obj, material)
    if bevel:
        mod = obj.modifiers.new(name="hp_cylinder_bevel", type="BEVEL")
        mod.width = radius * 0.08
        mod.segments = 2
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    if parent:
        obj.parent = parent
    return obj


def export_asset(root, model_key):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        obj.select_set(obj == root or obj.parent == root)
    bpy.context.view_layer.objects.active = root
    path = MODEL_DIR / f"hp_{model_key}.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT")
    return path


def best(model_key):
    candidate = TARGETS[model_key]["bestCandidate"]
    return candidate["width"], candidate["height"], candidate["depth"], candidate


def build_display_case(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("stone_plinth_grounded", (0, 0, h * 0.12), (w, d, h * 0.24), mats["stone"], root, b)
    cube("dark_shadow_recess", (0, 0, h * 0.27), (w * 0.92, d * 0.86, h * 0.08), mats["dark"], root, b * 0.5)
    cube("glass_vitrine_volume", (0, 0, h * 0.64), (w * 0.86, d * 0.72, h * 0.66), mats["glass"], root, b * 0.8)
    cube("tool_label_panel", (0, -d * 0.48, h * 0.31), (w * 0.58, d * 0.045, h * 0.16), mats["label"], root, 0.008)
    cyl("archived_iron_rod_like_player_weapon", (-w * 0.18, -d * 0.03, h * 0.55), 0.035, d * 0.62, mats["dark"], root, 18, rotation=(math.pi / 2, 0, 0))
    cyl("rod_old_brass_tip_front", (-w * 0.18, -d * 0.35, h * 0.55), 0.05, d * 0.08, mats["brass"], root, 18, rotation=(math.pi / 2, 0, 0))
    cyl("rod_old_brass_tip_back", (-w * 0.18, d * 0.29, h * 0.55), 0.05, d * 0.08, mats["brass"], root, 18, rotation=(math.pi / 2, 0, 0))
    cube("archived_sidearm_block", (w * 0.2, -d * 0.06, h * 0.5), (w * 0.26, d * 0.2, h * 0.13), mats["dark"], root, 0.012)
    cube("sidearm_brass_serial_plate", (w * 0.2, -d * 0.19, h * 0.59), (w * 0.18, d * 0.025, h * 0.035), mats["brass"], root, 0.004)
    cube("sidearm_short_barrel_archive", (w * 0.2, -d * 0.31, h * 0.53), (w * 0.12, d * 0.18, h * 0.055), mats["dark"], root, 0.006)
    for x in [-w * 0.38, w * 0.38]:
        cube("case_vertical_brass_archive_frame", (x, -d * 0.38, h * 0.64), (w * 0.028, d * 0.045, h * 0.56), mats["brass"], root, 0.004)
    cube("case_warm_underlight", (0, -d * 0.38, h * 0.38), (w * 0.74, d * 0.03, h * 0.035), mats["white"], root, 0.004)
    cube("tiny_cyan_catalogue_tick", (-w * 0.42, -d * 0.39, h * 0.36), (w * 0.045, d * 0.028, h * 0.035), mats["cyan"], root, 0.003)
    return export_asset(root, model_key)


def build_voice_booth(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("voice_booth_back_panel", (0, d * 0.12, h * 0.52), (w, d * 0.22, h), mats["stone"], root, b)
    cube("voice_glass_front", (0, -d * 0.38, h * 0.56), (w * 0.82, d * 0.08, h * 0.78), mats["glass"], root, b * 0.7)
    cube("voice_waveform_screen", (0, -d * 0.43, h * 0.6), (w * 0.64, d * 0.04, h * 0.38), mats["voice"], root, 0.01)
    cube("voice_label_panel", (0, -d * 0.45, h * 0.22), (w * 0.58, d * 0.04, h * 0.14), mats["label"], root, 0.008)
    for x in [-w * 0.43, w * 0.43]:
        cube("booth_vertical_brass_frame", (x, -d * 0.42, h * 0.55), (w * 0.035, d * 0.06, h * 0.78), mats["brass"], root, 0.006)
    cube("warm_audio_sample_toplight", (0, -d * 0.44, h * 0.94), (w * 0.62, d * 0.035, h * 0.035), mats["white"], root, 0.004)
    cyl("yellow_sequence_clue_lens_socket", (w * 0.34, -d * 0.45, h * 0.37), w * 0.04, d * 0.04, mats["brass"], root, 24, rotation=(math.pi / 2, 0, 0))
    cube("small_cyan_audio_status_tick", (-w * 0.36, -d * 0.45, h * 0.37), (w * 0.06, d * 0.03, h * 0.03), mats["cyan"], root, 0.003)
    return export_asset(root, model_key)


def build_body_reference_case(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("body_case_stone_base", (0, 0, h * 0.1), (w, d, h * 0.2), mats["stone"], root, b)
    cube("body_reference_glass", (0, -d * 0.2, h * 0.58), (w * 0.82, d * 0.1, h * 0.72), mats["body"], root, b * 0.6)
    cube("rear_black_exhibit_backing", (0, d * 0.18, h * 0.58), (w * 0.86, d * 0.08, h * 0.78), mats["dark"], root, b * 0.4)
    for x in [-w * 0.46, w * 0.46]:
        cube("body_case_tall_brass_frame", (x, -d * 0.24, h * 0.58), (w * 0.03, d * 0.06, h * 0.76), mats["brass"], root, 0.005)
    cube("body_case_top_warm_lamp", (0, -d * 0.25, h * 0.96), (w * 0.72, d * 0.04, h * 0.035), mats["white"], root, 0.004)
    cyl("abstract_head_marker", (0, -d * 0.31, h * 0.75), w * 0.08, d * 0.045, mats["cyan"], root, 28, rotation=(math.pi / 2, 0, 0))
    cube("abstract_spine_marker", (0, -d * 0.32, h * 0.48), (w * 0.025, d * 0.04, h * 0.38), mats["cyan"], root, 0.004)
    for idx, z in enumerate([h * 0.42, h * 0.49, h * 0.56]):
        cube(f"abstract_rib_{idx}", (0, -d * 0.325, z), (w * (0.28 - idx * 0.035), d * 0.035, h * 0.018), mats["white"], root, 0.003)
    cube("body_label_panel", (0, -d * 0.48, h * 0.25), (w * 0.46, d * 0.04, h * 0.13), mats["label"], root, 0.008)
    cube("tiny_wrong_category_red", (w * 0.37, -d * 0.46, h * 0.9), (w * 0.035, d * 0.036, h * 0.035), mats["red"], root, 0.004)
    for idx, x in enumerate([-w * 0.31, -w * 0.1, w * 0.1, w * 0.31]):
        cyl(f"body_color_sample_socket_{idx}", (x, -d * 0.48, h * 0.16), w * 0.034, d * 0.035, mats["brass"], root, 22, rotation=(math.pi / 2, 0, 0))
    return export_asset(root, model_key)


def build_archive_column(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cyl("archive_round_plinth", (0, 0, h * 0.08), min(w, d) * 0.44, h * 0.16, mats["stone"], root, 40)
    cube("archive_column_core", (0, 0, h * 0.5), (w * 0.62, d * 0.62, h * 0.82), mats["dark"], root, b)
    cube("front_archive_judgement_glass", (0, -d * 0.34, h * 0.55), (w * 0.5, d * 0.045, h * 0.56), mats["glass"], root, 0.006)
    for idx, z in enumerate([h * 0.26, h * 0.44, h * 0.62, h * 0.8]):
        cube(f"archive_label_band_{idx}", (0, -d * 0.34, z), (w * 0.54, d * 0.04, h * 0.07), mats["label" if idx % 2 == 0 else "voice"], root, 0.006)
    cube("archive_top_warm_cap", (0, 0, h * 0.94), (w * 0.74, d * 0.74, h * 0.04), mats["white"], root, 0.006)
    cube("archive_tiny_red_relabel_warning", (0, -d * 0.43, h * 0.84), (w * 0.28, d * 0.035, h * 0.035), mats["red"], root, 0.004)
    for x in [-w * 0.38, w * 0.38]:
        cube("archive_side_brass_rail", (x, 0, h * 0.52), (w * 0.035, d * 0.78, h * 0.72), mats["brass"], root, 0.005)
    return export_asset(root, model_key)


def build_low_barrier(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    for x in [-w * 0.44, 0, w * 0.44]:
        cyl("barrier_post", (x, 0, h * 0.36), d * 0.18, h * 0.72, mats["brass"], root, 18)
        cyl("barrier_foot", (x, 0, h * 0.04), d * 0.32, h * 0.08, mats["dark"], root, 18)
    cube("front_low_gallery_rail_aged_brass", (0, -d * 0.12, h * 0.68), (w, d * 0.22, h * 0.07), mats["brass"], root, b)
    cube("rear_shadow_rail", (0, d * 0.12, h * 0.42), (w * 0.92, d * 0.16, h * 0.045), mats["dark"], root, b * 0.5)
    cube("thin_black_gallery_shadow_plate", (0, 0, h * 0.21), (w * 0.78, d * 0.1, h * 0.038), mats["dark"], root, 0.004)
    return export_asset(root, model_key)


def build_wall_label_panel(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cube("wall_label_backplate", (0, 0, h * 0.5), (w, d, h), mats["stone"], root, b)
    cube("image2_label_readable_face", (0, -d * 0.58, h * 0.52), (w * 0.86, d * 0.18, h * 0.74), mats["label"], root, 0.006)
    cube("small_cyan_catalogue_line", (0, -d * 0.7, h * 0.82), (w * 0.58, d * 0.08, h * 0.028), mats["cyan"], root, 0.003)
    cube("tiny_archive_red_dot", (w * 0.34, -d * 0.7, h * 0.2), (w * 0.035, d * 0.08, h * 0.035), mats["red"], root, 0.003)
    return export_asset(root, model_key)


def build_color_orb_pedestal(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = c["bevel"]
    cyl("orb_pedestal_base", (0, 0, h * 0.1), min(w, d) * 0.42, h * 0.2, mats["stone"], root, 36)
    cube("orb_pedestal_body", (0, 0, h * 0.42), (w * 0.56, d * 0.56, h * 0.54), mats["dark"], root, b)
    cube("orb_pedestal_label", (0, -d * 0.32, h * 0.36), (w * 0.46, d * 0.04, h * 0.12), mats["label"], root, 0.006)
    cyl("empty_hit_orb_mount_ring", (0, 0, h * 0.76), min(w, d) * 0.26, h * 0.055, mats["brass"], root, 36)
    cyl("inner_shadow_socket_not_target", (0, 0, h * 0.77), min(w, d) * 0.18, h * 0.045, mats["dark"], root, 32)
    for idx, x in enumerate([-w * 0.18, 0, w * 0.18]):
        cube(f"pedestal_hit_registration_tick_{idx}", (x, -d * 0.32, h * 0.56), (w * 0.045, d * 0.032, h * 0.035), mats["cyan"], root, 0.003)
    cube("wrong_order_red_mini_indicator", (w * 0.25, -d * 0.31, h * 0.2), (w * 0.04, d * 0.035, h * 0.04), mats["red"], root, 0.003)
    return export_asset(root, model_key)


def build_floor_route_inlay(model_key):
    w, h, d, c = best(model_key)
    mats = palette(c)
    root = root_node(model_key)
    b = max(0.006, c["bevel"] * 0.4)
    cube("museum_floor_route_base", (0, 0, h * 0.5), (w, d, h), mats["stone"], root, b)
    cube("image2_four_color_route_visible_strip", (0, 0, h * 1.28), (w * 0.92, d * 0.42, h * 0.26), mats["route"], root, b * 0.6)
    for idx, x in enumerate([-w * 0.34, -w * 0.11, w * 0.12, w * 0.35]):
        cube(f"thin_route_divider_{idx}", (x, 0, h * 1.48), (w * 0.018, d * 0.46, h * 0.2), mats["dark"], root, 0.002)
    return export_asset(root, model_key)


BUILDERS = {
    "room_museum_display_case_tool": build_display_case,
    "room_museum_voice_booth": build_voice_booth,
    "room_museum_body_reference_case": build_body_reference_case,
    "room_museum_archive_column": build_archive_column,
    "room_museum_low_barrier": build_low_barrier,
    "room_museum_wall_label_panel": build_wall_label_panel,
    "room_museum_color_orb_pedestal": build_color_orb_pedestal,
    "room_museum_floor_route_inlay": build_floor_route_inlay,
}


def main():
    clear_scene()
    generated = []
    for model_key, builder in BUILDERS.items():
        path = builder(model_key)
        c = TARGETS[model_key]["bestCandidate"]
        generated.append({
            "modelKey": model_key,
            "file": f"src/assets/models/environment/level03/hp_{model_key}.glb",
            "sizeMeters": [round(c["width"], 3), round(c["height"], 3), round(c["depth"], 3)],
            "collision": {"type": "box", "sizeMeters": [round(c["width"], 3), round(c["height"], 3), round(c["depth"], 3)]},
            "usesImage2Textures": True,
            "sourceReport": str(REPORT_PATH.relative_to(ROOT)),
            "notes": "AGE v2-selected Human Museum exhibit asset: premium black stone, aged brass, restrained cyan, story-readable exhibit silhouette, image2 textures, bevels, weighted normals, and grounded collision-friendly proportions.",
        })
        print(f"{model_key} -> {path}")
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
    MANIFEST_PATH.write_text(json.dumps({
        "schemaVersion": "hp.level03-museum-assets.v2",
        "generatedBy": "scripts/asset-build/blender-generate-level03-museum-assets.py",
        "sourceBlend": str(SOURCE_BLEND.relative_to(ROOT)),
        "textures": [str(path.relative_to(ROOT)) for path in sorted(TEXTURE_DIR.glob("*.png"))],
        "assets": generated,
        "legacyBackup": {
            "wgpuLab": "/Users/zhengkaizhang/Documents/webgpu-robot-lab/asset-lab/original-glb/human-protocol-level03-museum/20260606_pre_museum_exhibit_v2",
        },
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(generated)} Level 3 museum assets.")


main()
