import math
import os
import random
import sys

import bpy


REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEXTURE_DIR = os.path.join(REPO_ROOT, "src", "assets", "source_blend", "viewmodel")
BLEND_DIR = os.path.join(REPO_ROOT, "src", "assets", "source_blend", "viewmodel")

WEAPONS = {
    "iron_rod": {
        "input": os.path.join(REPO_ROOT, "src", "assets", "models", "viewmodel", "hp_viewmodel_iron_rod_wgpu_aged.glb"),
        "source_glb": "/tmp/hp-viewmodel-battleworn/iron_rod_battleworn_source.glb",
        "blend": os.path.join(BLEND_DIR, "hp_viewmodel_iron_rod_wgpu_battleworn.blend"),
        "texture": os.path.join(TEXTURE_DIR, "hp_viewmodel_iron_rod_battleworn_detail_1024.png"),
        "scratch_density": 1.1,
        "stripe_freq": 124.0,
        "grain": 1.18,
        "story_axis": 1.0,
    },
    "sidearm": {
        "input": os.path.join(REPO_ROOT, "src", "assets", "models", "viewmodel", "hp_viewmodel_sidearm_wgpu_aged.glb"),
        "source_glb": "/tmp/hp-viewmodel-battleworn/sidearm_battleworn_source.glb",
        "blend": os.path.join(BLEND_DIR, "hp_viewmodel_sidearm_wgpu_battleworn.blend"),
        "texture": os.path.join(TEXTURE_DIR, "hp_viewmodel_sidearm_battleworn_detail_1024.png"),
        "scratch_density": 1.42,
        "stripe_freq": 166.0,
        "grain": 1.28,
        "story_axis": 1.25,
    },
}


def main():
    os.makedirs("/tmp/hp-viewmodel-battleworn", exist_ok=True)
    os.makedirs(TEXTURE_DIR, exist_ok=True)

    weapon_ids = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else list(WEAPONS.keys())
    for weapon_id in weapon_ids:
        if weapon_id not in WEAPONS:
            raise ValueError(f"Unknown weapon id: {weapon_id}")
        bake_weapon(weapon_id, WEAPONS[weapon_id])


def bake_weapon(weapon_id, config):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.ops.import_scene.gltf(filepath=config["input"])

    detail_image = create_battleworn_detail_image(weapon_id, config)
    material_count = 0
    for material in bpy.data.materials:
        if material.name.startswith("__"):
            continue
        apply_battleworn_material(material, detail_image, material_profile(material.name))
        material_count += 1

    detail_count = add_modeled_metal_details(weapon_id)

    bpy.ops.wm.save_as_mainfile(filepath=config["blend"])
    bpy.ops.export_scene.gltf(
        filepath=config["source_glb"],
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )
    print(f"{weapon_id}: baked {material_count} materials + {detail_count} modeled details -> {config['source_glb']}")


def create_battleworn_detail_image(weapon_id, config):
    size = 1024
    image = bpy.data.images.new(f"hp_{weapon_id}_battleworn_detail_1024", width=size, height=size, alpha=True)
    image.colorspace_settings.name = "sRGB"

    rng = random.Random(f"human-protocol-{weapon_id}-battleworn")
    scratches = []
    scratch_count = int(130 * config["scratch_density"])
    for _ in range(scratch_count):
        scratches.append(
            {
                "x": rng.random(),
                "y": rng.random(),
                "length": rng.uniform(0.08, 0.46),
                "angle": rng.uniform(-0.18, 0.18),
                "width": rng.uniform(0.0014, 0.0048),
                "bright": rng.choice([-1.0, 1.0]) * rng.uniform(0.035, 0.11),
            }
        )

    pixels = [0.0] * (size * size * 4)
    stripe_freq = config["stripe_freq"]
    grain_power = config["grain"]
    for y in range(size):
        v = y / (size - 1)
        row_hash = hash01(math.floor(v * 260), 19)
        for x in range(size):
            u = x / (size - 1)
            fine_hash = hash01(math.floor(u * 420), math.floor(v * 420))
            cell_hash = hash01(math.floor(u * 115), math.floor(v * 115) + 43)
            long_hash = hash01(math.floor(u * 38) + 17, math.floor(v * 38) + 71)
            stripe = math.sin((u * stripe_freq + 0.52 * math.sin(v * 21.0) + v * 9.5) * math.tau) * 0.052
            cross_stripe = math.sin((v * 78.0 + u * 14.0) * math.tau) * 0.024
            machining = math.sin((u * 11.0 + math.floor(v * 18.0) * 0.31) * math.tau) * 0.018
            grain = (fine_hash - 0.5) * 0.18 * grain_power + (cell_hash - 0.5) * 0.07
            pit = 0.0
            if cell_hash < 0.052:
                pit -= 0.16 + (0.052 - cell_hash) * 1.7
            if long_hash > 0.965 and row_hash > 0.58:
                pit -= 0.08

            luminance = clamp(0.57 + stripe + cross_stripe + machining + grain + pit, 0.12, 0.92)
            tarnish = 0.018 * (hash01(math.floor(u * 76) + 91, math.floor(v * 76) + 7) - 0.5)
            cool = 0.035 * math.sin((u * 8.0 + v * 5.0) * math.tau)
            index = (y * size + x) * 4
            edge_warmth = 0.012 * math.sin((u * 3.0 + v * 4.0) * math.tau)
            pixels[index + 0] = clamp(luminance + tarnish + edge_warmth - 0.014, 0.0, 1.0)
            pixels[index + 1] = clamp(luminance + cool * 0.32 + edge_warmth * 0.4 + 0.01, 0.0, 1.0)
            pixels[index + 2] = clamp(luminance + cool * 0.52 - 0.004, 0.0, 1.0)
            pixels[index + 3] = 1.0

    for scratch in scratches:
        draw_scratch(pixels, size, scratch)
    draw_story_direction_texture(pixels, size, weapon_id, config)

    image.pixels.foreach_set(pixels)
    image.update()
    image.filepath_raw = config["texture"]
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def draw_scratch(pixels, size, scratch):
    ca = math.cos(scratch["angle"])
    sa = math.sin(scratch["angle"])
    length_px = max(8, int(scratch["length"] * size))
    radius = max(1, int(scratch["width"] * size))
    center_x = scratch["x"] * (size - 1)
    center_y = scratch["y"] * (size - 1)
    delta = scratch["bright"]

    for step in range(length_px):
        along = (step / max(1, length_px - 1) - 0.5) * scratch["length"] * size
        fade = 1.0 - abs(step / max(1, length_px - 1) - 0.5) * 1.55
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
                dist = math.hypot(xx - px, yy - py)
                if dist > radius + 0.45:
                    continue
                edge = 1.0 - dist / (radius + 0.45)
                amount = delta * max(0.0, fade) * edge
                index = (yy * size + xx) * 4
                pixels[index + 0] = clamp(pixels[index + 0] + amount * 0.92, 0.0, 1.0)
                pixels[index + 1] = clamp(pixels[index + 1] + amount, 0.0, 1.0)
                pixels[index + 2] = clamp(pixels[index + 2] + amount * 1.05, 0.0, 1.0)


def draw_story_direction_texture(pixels, size, weapon_id, config):
    rng = random.Random(f"human-protocol-{weapon_id}-story-axis")
    axis = config.get("story_axis", 1.0)
    if weapon_id == "iron_rod":
        for lane in (0.25, 0.48, 0.73):
            for _ in range(int(16 * axis)):
                draw_scratch(
                    pixels,
                    size,
                    {
                        "x": clamp(lane + rng.uniform(-0.018, 0.018), 0.02, 0.98),
                        "y": rng.uniform(0.08, 0.92),
                        "length": rng.uniform(0.28, 0.72),
                        "angle": math.pi * 0.5 + rng.uniform(-0.055, 0.055),
                        "width": rng.uniform(0.0012, 0.0028),
                        "bright": rng.choice((1.0, -1.0)) * rng.uniform(0.045, 0.13),
                    },
                )
        for y in (0.18, 0.32, 0.52, 0.68, 0.84):
            draw_label_bar(pixels, size, 0.12, y, 0.19, 0.012, 0.11)
    else:
        for lane in (0.36, 0.52, 0.67):
            for _ in range(int(14 * axis)):
                draw_scratch(
                    pixels,
                    size,
                    {
                        "x": rng.uniform(0.12, 0.9),
                        "y": clamp(lane + rng.uniform(-0.02, 0.02), 0.02, 0.98),
                        "length": rng.uniform(0.2, 0.54),
                        "angle": rng.uniform(-0.05, 0.05),
                        "width": rng.uniform(0.0012, 0.003),
                        "bright": rng.choice((1.0, -1.0)) * rng.uniform(0.04, 0.12),
                    },
                )
        for x in (0.2, 0.36, 0.56, 0.76):
            draw_label_bar(pixels, size, x, 0.17, 0.015, 0.16, -0.1)


def draw_label_bar(pixels, size, u, v, width, height, delta):
    min_x = max(0, int((u - width * 0.5) * size))
    max_x = min(size - 1, int((u + width * 0.5) * size))
    min_y = max(0, int((v - height * 0.5) * size))
    max_y = min(size - 1, int((v + height * 0.5) * size))
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            tx = abs((x / size - u) / max(0.0001, width * 0.5))
            ty = abs((y / size - v) / max(0.0001, height * 0.5))
            edge = clamp(1.0 - max(tx, ty), 0.0, 1.0)
            index = (y * size + x) * 4
            pixels[index + 0] = clamp(pixels[index + 0] + delta * (0.8 + edge * 0.2), 0.0, 1.0)
            pixels[index + 1] = clamp(pixels[index + 1] + delta * (0.9 + edge * 0.2), 0.0, 1.0)
            pixels[index + 2] = clamp(pixels[index + 2] + delta, 0.0, 1.0)


def apply_battleworn_material(material, detail_image, profile):
    material.use_nodes = True
    material.diffuse_color = profile["color"]
    material.blend_method = "OPAQUE"
    material.use_screen_refraction = False

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = find_principled(nodes)
    if principled is None:
        principled = nodes.new(type="ShaderNodeBsdfPrincipled")

    texture = nodes.new(type="ShaderNodeTexImage")
    texture.name = "HP Battleworn Detail"
    texture.image = detail_image
    texture.extension = "REPEAT"

    base_color = principled.inputs.get("Base Color")
    if base_color is not None:
        base_color.default_value = profile["color"]
        clear_input_links(links, base_color)
        links.new(texture.outputs["Color"], base_color)

    set_input_value(principled, "Metallic", profile["metalness"])
    set_input_value(principled, "Roughness", profile["roughness"])
    set_input_value(principled, "Alpha", 1.0)

    emission_color = principled.inputs.get("Emission Color")
    if emission_color is not None:
        emission_color.default_value = profile.get("emissive", (0.0, 0.0, 0.0, 1.0))
    set_input_value(principled, "Emission Strength", profile.get("emissive_strength", 0.0))


def find_principled(nodes):
    for node in nodes:
        if node.bl_idname == "ShaderNodeBsdfPrincipled":
            return node
    return None


def clear_input_links(links, socket):
    for link in list(links):
        if link.to_socket == socket:
            links.remove(link)


def set_input_value(node, input_name, value):
    socket = node.inputs.get(input_name)
    if socket is not None:
        socket.default_value = value


def material_profile(name):
    key = name.lower()
    if any(word in key for word in ("cyan", "energy", "sight", "window", "muzzle", "glass", "lens")):
        return {
            "color": (0.38, 0.72, 0.72, 1.0),
            "emissive": (0.0, 0.028, 0.035, 1.0),
            "emissive_strength": 0.12,
            "metalness": 0.14,
            "roughness": 0.5,
        }
    if any(word in key for word in ("bronze", "copper", "amber", "inlay", "trigger", "rail")):
        return {"color": (0.82, 0.58, 0.31, 1.0), "metalness": 0.96, "roughness": 0.52}
    if any(word in key for word in ("black", "wrap", "grip", "rubber", "leather")):
        return {"color": (0.28, 0.32, 0.31, 1.0), "metalness": 0.48, "roughness": 0.88}
    if any(word in key for word in ("shadow", "dark", "shaft", "core", "cut")):
        return {"color": (0.2, 0.27, 0.26, 1.0), "metalness": 0.92, "roughness": 0.74}
    if any(word in key for word in ("battered", "edge", "steel", "titanium", "panel", "slide", "cap", "ring", "receiver", "plate")):
        return {"color": (0.78, 0.84, 0.78, 1.0), "metalness": 0.99, "roughness": 0.44}
    return {"color": (0.62, 0.68, 0.62, 1.0), "metalness": 0.86, "roughness": 0.58}


def add_modeled_metal_details(weapon_id):
    materials = {
        "hero": make_detail_material(
            "hp_scraped_hero_steel_edge_detail",
            (0.88, 0.94, 0.88, 1.0),
            metalness=1.0,
            roughness=0.32,
        ),
        "steel": make_detail_material(
            "hp_battered_steel_raised_detail",
            (0.74, 0.8, 0.74, 1.0),
            metalness=0.98,
            roughness=0.48,
        ),
        "dark": make_detail_material(
            "hp_oxidized_dark_cut_detail",
            (0.18, 0.23, 0.23, 1.0),
            metalness=0.92,
            roughness=0.8,
        ),
        "bronze": make_detail_material(
            "hp_oiled_bronze_visible_rail_detail",
            (0.82, 0.56, 0.28, 1.0),
            metalness=0.95,
            roughness=0.52,
        ),
        "cyan": make_detail_material(
            "hp_protocol_cyan_identity_glass_detail",
            (0.32, 0.75, 0.78, 1.0),
            metalness=0.18,
            roughness=0.32,
            emissive=(0.0, 0.08, 0.09, 1.0),
            emissive_strength=0.35,
        ),
        "porcelain": make_detail_material(
            "hp_aged_porcelain_registry_label_detail",
            (0.82, 0.85, 0.78, 1.0),
            metalness=0.24,
            roughness=0.58,
        ),
    }

    if weapon_id == "iron_rod":
        return add_iron_rod_modeled_details(materials)
    if weapon_id == "sidearm":
        return add_sidearm_modeled_details(materials)
    return 0


def make_detail_material(name, color, metalness, roughness, emissive=None, emissive_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.blend_method = "OPAQUE"

    principled = find_principled(material.node_tree.nodes)
    if principled is None:
        principled = material.node_tree.nodes.new(type="ShaderNodeBsdfPrincipled")
    base_color = principled.inputs.get("Base Color")
    if base_color is not None:
        base_color.default_value = color
    set_input_value(principled, "Metallic", metalness)
    set_input_value(principled, "Roughness", roughness)
    set_input_value(principled, "Alpha", 1.0)
    emission_color = principled.inputs.get("Emission Color")
    if emission_color is not None:
        emission_color.default_value = emissive or (0.0, 0.0, 0.0, 1.0)
    set_input_value(principled, "Emission Strength", emissive_strength)
    return material


def add_iron_rod_modeled_details(materials):
    objects = []

    for index, z in enumerate((-1.12, -0.86, -0.23, 0.3, 0.74, 1.17)):
        material = materials["bronze"] if index in (1, 4) else materials["hero"]
        radius = 0.101 if z < 1.0 else 0.121
        depth = 0.03 if z < 1.0 else 0.034
        objects.append(
            add_cylinder(
                f"hp_iron_rod_raised_collar_{index:02d}",
                material,
                location=(0.0, 0.0, z),
                radius=radius,
                depth=depth,
                vertices=24,
                bevel=0.004,
            )
        )

    for index, (angle, material_name, width) in enumerate(
        (
            (0.0, "hero", 0.034),
            (math.pi * 0.5, "steel", 0.03),
            (math.pi, "hero", 0.034),
            (math.pi * 1.5, "bronze", 0.028),
        )
    ):
        x = math.cos(angle) * 0.088
        y = math.sin(angle) * 0.088
        rotation = (0.0, 0.0, angle)
        objects.append(
            add_box(
                f"hp_iron_rod_longitudinal_rib_{index:02d}",
                materials[material_name],
                location=(x, y, 0.28),
                dimensions=(0.018, width, 1.08),
                rotation=rotation,
                bevel=0.0045,
            )
        )

    for index, (z, angle) in enumerate(((-0.72, -0.36), (-0.5, 0.36), (0.18, -0.18), (1.05, 0.2), (1.34, -0.28))):
        objects.append(
            add_box(
                f"hp_iron_rod_oiled_bronze_slash_plate_{index:02d}",
                materials["bronze"],
                location=(0.0, -0.119, z),
                dimensions=(0.12, 0.014, 0.092),
                rotation=(0.0, 0.0, angle),
                bevel=0.004,
            )
        )

    for index, (angle, z, length) in enumerate(
        (
            (0.34, -0.12, 0.48),
            (-0.42, 0.48, 0.38),
            (0.18, 0.9, 0.28),
        )
    ):
        objects.append(
            add_box(
                f"hp_iron_rod_bright_worn_edge_cut_{index:02d}",
                materials["hero"],
                location=(0.0, -0.122, z),
                dimensions=(0.028, 0.012, length),
                rotation=(0.0, 0.0, angle),
                bevel=0.003,
            )
        )

    for index, z in enumerate((1.31, 1.43)):
        for side_index, x in enumerate((-0.148, 0.148)):
            objects.append(
                add_cylinder(
                    f"hp_iron_rod_impact_rivet_{index:02d}_{side_index:02d}",
                    materials["hero" if side_index == 0 else "bronze"],
                    location=(x, 0.052 if index == 0 else -0.052, z),
                    radius=0.024,
                    depth=0.016,
                    vertices=16,
                    rotation=(0.0, math.pi * 0.5, 0.0),
                    bevel=0.003,
                )
            )

    for index, z in enumerate((-0.62, -0.45)):
        objects.append(
            add_box(
                f"hp_iron_rod_grip_weathered_plate_{index:02d}",
                materials["dark"],
                location=(0.0, -0.108, z),
                dimensions=(0.102, 0.014, 0.092),
                bevel=0.003,
            )
        )

    for index, (z, material_name, width) in enumerate(
        (
            (-0.98, "porcelain", 0.092),
            (-0.18, "cyan", 0.074),
            (0.58, "porcelain", 0.082),
            (1.24, "cyan", 0.068),
        )
    ):
        objects.append(
            add_box(
                f"hp_iron_rod_protocol_registry_inset_{index:02d}",
                materials[material_name],
                location=(0.0, -0.126, z),
                dimensions=(width, 0.013, 0.052),
                bevel=0.0035,
            )
        )

    for index, z in enumerate((-0.04, 0.12, 0.28, 0.44)):
        objects.append(
            add_box(
                f"hp_iron_rod_human_protocol_tally_cut_{index:02d}",
                materials["dark"],
                location=(-0.072, -0.127, z),
                dimensions=(0.012, 0.014, 0.09),
                rotation=(0.0, 0.0, 0.12),
                bevel=0.002,
            )
        )

    for index, (x, z) in enumerate(((-0.036, 1.53), (0.036, 1.53), (0.0, 1.62))):
        objects.append(
            add_box(
                f"hp_iron_rod_execution_head_weight_line_{index:02d}",
                materials["hero" if index != 2 else "bronze"],
                location=(x, -0.118, z),
                dimensions=(0.014 if index != 2 else 0.12, 0.018, 0.18 if index != 2 else 0.014),
                bevel=0.003,
            )
        )

    return len(objects)


def add_sidearm_modeled_details(materials):
    objects = []

    for side, x in (("left", -0.242), ("right", 0.242)):
        objects.append(
            add_box(
                f"hp_sidearm_raised_slide_rail_{side}",
                materials["hero"],
                location=(x, 0.11, 0.49),
                dimensions=(0.015, 0.88, 0.058),
                bevel=0.005,
            )
        )
        objects.append(
            add_box(
                f"hp_sidearm_lower_oxidized_side_plate_{side}",
                materials["dark"],
                location=(x, -0.16, 0.25),
                dimensions=(0.011, 0.38, 0.052),
                bevel=0.0035,
            )
        )
        for index, (y, z, material_name) in enumerate(((-0.34, 0.4, "hero"), (0.14, 0.29, "bronze"), (0.49, 0.43, "hero"))):
            objects.append(
                add_cylinder(
                    f"hp_sidearm_side_rivet_{side}_{index:02d}",
                    materials[material_name],
                    location=(x + (-0.008 if x < 0 else 0.008), y, z),
                    radius=0.023,
                    depth=0.016,
                    vertices=16,
                    rotation=(0.0, math.pi * 0.5, 0.0),
                    bevel=0.0025,
                )
            )

    objects.append(
        add_box(
            "hp_sidearm_top_battered_spine",
            materials["hero"],
            location=(0.0, 0.12, 0.558),
            dimensions=(0.17, 0.74, 0.026),
            bevel=0.005,
        )
    )

    for index, y in enumerate((-0.42, -0.36, -0.23, -0.1, 0.22, 0.32, 0.47, 0.6, 0.68)):
        objects.append(
            add_box(
                f"hp_sidearm_top_machined_rib_{index:02d}",
                materials["hero" if index in (0, 3, 5) else "bronze"],
                location=(0.0, y, 0.578),
                dimensions=(0.19, 0.024, 0.032),
                bevel=0.0035,
            )
        )

    for index, (x, y, z, material_name) in enumerate(
        (
            (-0.176, -0.02, 0.522, "hero"),
            (0.176, 0.18, 0.522, "hero"),
            (-0.11, 0.58, 0.535, "bronze"),
            (0.11, -0.44, 0.51, "dark"),
        )
    ):
        objects.append(
            add_box(
                f"hp_sidearm_asymmetric_battle_scuff_{index:02d}",
                materials[material_name],
                location=(x, y, z),
                dimensions=(0.048, 0.19, 0.016),
                rotation=(0.0, 0.0, 0.22 if index % 2 == 0 else -0.18),
                bevel=0.0028,
            )
        )

    for index, (x, y, z) in enumerate(((-0.128, -0.28, 0.58), (0.128, -0.28, 0.58), (-0.128, 0.38, 0.58), (0.128, 0.38, 0.58))):
        objects.append(
            add_box(
                f"hp_sidearm_scraped_corner_edge_{index:02d}",
                materials["hero"],
                location=(x, y, z),
                dimensions=(0.035, 0.22, 0.02),
                bevel=0.003,
            )
        )

    for index, y in enumerate((0.93, 1.15)):
        objects.append(
            add_cylinder(
                f"hp_sidearm_muzzle_collar_{index:02d}",
                materials["hero" if index == 0 else "bronze"],
                location=(0.0, y, 0.16),
                radius=0.158 if index == 0 else 0.128,
                depth=0.042,
                vertices=24,
                rotation=(math.pi * 0.5, 0.0, 0.0),
                bevel=0.0045,
            )
        )

    for side, x in (("left", -0.148), ("right", 0.148)):
        for index, (y, z) in enumerate(((-0.48, -0.46), (-0.35, -0.29), (-0.22, -0.12))):
            objects.append(
                add_box(
                    f"hp_sidearm_grip_worn_band_{side}_{index:02d}",
                    materials["dark" if index != 1 else "bronze"],
                    location=(x, y, z),
                    dimensions=(0.012, 0.13, 0.026),
                    rotation=(0.0, 0.0, 0.28 if x > 0 else -0.28),
                    bevel=0.0025,
                )
            )

    for side, x in (("left", -0.253), ("right", 0.253)):
        for index, (y, z, material_name, height) in enumerate(
            (
                (-0.12, 0.18, "porcelain", 0.12),
                (0.08, 0.22, "cyan", 0.09),
                (0.36, 0.31, "bronze", 0.18),
            )
        ):
            objects.append(
                add_box(
                    f"hp_sidearm_protocol_audit_inset_{side}_{index:02d}",
                    materials[material_name],
                    location=(x + (-0.006 if x < 0 else 0.006), y, z),
                    dimensions=(0.012, height, 0.034),
                    rotation=(0.0, 0.0, -0.05 if x < 0 else 0.05),
                    bevel=0.0025,
                )
            )

    for index, (y, material_name) in enumerate(((-0.55, "dark"), (-0.02, "hero"), (0.72, "bronze"), (0.88, "hero"))):
        objects.append(
            add_box(
                f"hp_sidearm_last_human_sight_line_{index:02d}",
                materials[material_name],
                location=(0.0, y, 0.617),
                dimensions=(0.065 if index != 1 else 0.115, 0.018, 0.018),
                bevel=0.0025,
            )
        )

    for index, (x, y) in enumerate(((-0.064, 1.0), (0.064, 1.0), (-0.09, 1.22), (0.09, 1.22))):
        objects.append(
            add_box(
                f"hp_sidearm_muzzle_witness_scrape_{index:02d}",
                materials["hero" if index < 2 else "bronze"],
                location=(x, y, 0.285),
                dimensions=(0.036, 0.014, 0.08),
                rotation=(0.0, 0.0, 0.16 if x > 0 else -0.16),
                bevel=0.0025,
            )
        )

    return len(objects)


def add_box(name, material, location, dimensions, rotation=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.scale = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0.0:
        add_detail_bevel(obj, bevel)
    return obj


def add_cylinder(name, material, location, radius, depth, vertices=16, rotation=(0.0, 0.0, 0.0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    if bevel > 0.0:
        add_detail_bevel(obj, bevel)
    return obj


def add_detail_bevel(obj, width):
    bevel = obj.modifiers.new("hp_tiny_real_bevel", "BEVEL")
    bevel.width = width
    bevel.segments = 1
    bevel.affect = "EDGES"
    weighted_normals = obj.modifiers.new("hp_weighted_metal_normals", "WEIGHTED_NORMAL")
    weighted_normals.keep_sharp = True


def hash01(x, y):
    value = math.sin(x * 127.1 + y * 311.7) * 43758.5453123
    return value - math.floor(value)


def clamp(value, low, high):
    return max(low, min(high, value))


if __name__ == "__main__":
    main()
