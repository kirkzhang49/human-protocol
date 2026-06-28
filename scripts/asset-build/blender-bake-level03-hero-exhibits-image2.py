#!/usr/bin/env python3
"""Bake Level 03 hero exhibit cases with transparent cabinets and 3D contents.

The lightweight JS trial generator is useful for fast placement checks, but it
cannot make the exhibit contents feel real. This Blender pass owns the voice
and body exhibit GLBs used by official Level 3 and by builder imports. These
hero cabinets intentionally avoid Image2 backplates so the contents stay fully
visible in Raw WebGPU. The three hero exhibits share one case language: body,
voice, and the horizontal last-human tool vitrine with the pistol and iron rod
physically inside the glass footprint.
"""

import json
import math
import shutil
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/models-cooked/environment/level03"
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level03-hero-exhibits"
SOURCE_BLEND = ROOT / "src/assets/source_blend/level03/human_protocol_level03_hero_exhibits_image2_v1.blend"
VOICE_SOURCE_BLEND = ROOT / "src/assets/source_blend/level03/human_protocol_level03_voice_archive_case_v2.blend"
BODY_SOURCE_BLEND = ROOT / "src/assets/source_blend/level03/human_protocol_level03_body_memory_case_v2.blend"
TOOL_SOURCE_BLEND = ROOT / "src/assets/source_blend/level03/human_protocol_level03_last_human_tool_case_v2.blend"
MANIFEST = ROOT / "src/assets/manifests/runtime/human_protocol_level03_hero_exhibits_image2_v1.json"
REPORT = ROOT / "src/assets/manifests/reports/human_protocol_level03_body_voice_tool_glass_cases_v2.json"
PREVIEW = ROOT / "src/assets/manifests/reports/human_protocol_level03_body_voice_tool_glass_cases_preview.png"
INSIDE_BOUNDS_AUDITS = []

OUT_DIR.mkdir(parents=True, exist_ok=True)
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
SOURCE_BLEND.parent.mkdir(parents=True, exist_ok=True)
MANIFEST.parent.mkdir(parents=True, exist_ok=True)
REPORT.parent.mkdir(parents=True, exist_ok=True)


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(blocks):
            if item.users == 0:
                blocks.remove(item)


def make_texture_image(name, palette):
    size = 256
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    pixels = []
    for y in range(size):
        for x in range(size):
            u = x / (size - 1)
            v = y / (size - 1)
            base = palette["base"]
            line = palette["line"]
            accent = palette["accent"]
            seam = abs((u * 8) % 1 - 0.5) < 0.018 or abs((v * 8) % 1 - 0.5) < 0.018
            trim = abs(u - 0.5) < 0.015 or abs(v - 0.5) < 0.015
            brushed = 0.86 + 0.14 * math.sin((u * 37.0 + v * 11.0) * math.pi)
            if trim:
                color = accent
            elif seam:
                color = line
            else:
                color = tuple(min(1.0, c * brushed) for c in base[:3]) + (base[3],)
            pixels.extend(color)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(TEXTURE_DIR / f"{name}.png")
    image.file_format = "PNG"
    image.save()
    return image


def make_texture_sources():
    return {
        "black": make_texture_image(
            "l3_glass_case_smoked_black_panel_v2",
            {
                "base": (0.018, 0.026, 0.028, 1),
                "line": (0.004, 0.008, 0.009, 1),
                "accent": (0.18, 0.25, 0.24, 1),
            },
        ),
        "brass": make_texture_image(
            "l3_glass_case_aged_brass_trim_v2",
            {
                "base": (0.56, 0.39, 0.16, 1),
                "line": (0.24, 0.16, 0.07, 1),
                "accent": (0.92, 0.68, 0.32, 1),
            },
        ),
        "specimen": make_texture_image(
            "l3_glass_case_specimen_ivory_scan_v2",
            {
                "base": (0.74, 0.72, 0.64, 1),
                "line": (0.38, 0.52, 0.54, 1),
                "accent": (0.70, 0.95, 0.96, 1),
            },
        ),
        "dark_tool": make_texture_image(
            "l3_glass_case_dark_mechanism_v2",
            {
                "base": (0.036, 0.052, 0.054, 1),
                "line": (0.012, 0.018, 0.019, 1),
                "accent": (0.30, 0.50, 0.52, 1),
            },
        ),
        "foam": make_texture_image(
            "l3_glass_case_cut_foam_tray_v2",
            {
                "base": (0.012, 0.018, 0.019, 1),
                "line": (0.02, 0.045, 0.047, 1),
                "accent": (0.18, 0.34, 0.32, 1),
            },
        ),
    }


def principled(name, color, roughness=0.55, metallic=0.0, alpha=1.0, emission=None, emission_strength=0.0, texture=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        raise RuntimeError(f"Material {name} has no Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if texture is not None:
        tex = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex.name = f"{name}_base_color_texture"
        tex.image = texture
        material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha < 1:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
        material.show_transparent_back = True
    return material


def make_materials():
    textures = make_texture_sources()
    return {
        "black": principled("l3_exhibit_smoked_black_metal", (0.006, 0.01, 0.011, 1), 0.46, 0.72, texture=textures["black"]),
        "body": principled("l3_exhibit_powdercoat_body", (0.018, 0.03, 0.032, 1), 0.62, 0.38, texture=textures["black"]),
        "brass": principled("l3_exhibit_aged_brass", (0.45, 0.31, 0.13, 1), 0.34, 0.82, texture=textures["brass"]),
        "bone": principled("l3_exhibit_preserved_ivory_memory", (0.86, 0.8, 0.67, 1), 0.54, 0.03, texture=textures["specimen"]),
        "dark_tool": principled("l3_exhibit_dark_object_metal", (0.03, 0.045, 0.046, 1), 0.48, 0.68, texture=textures["dark_tool"]),
        "foam": principled("l3_exhibit_cut_foam_tray", (0.012, 0.018, 0.019, 1), 0.78, 0.04, texture=textures["foam"]),
        "glass": principled(
            "l3_exhibit_thick_cyan_glass",
            (0.82, 0.98, 1.0, 0.024),
            0.08,
            0.02,
            0.024,
            (0.03, 0.22, 0.25, 1),
            0.026,
        ),
        "dark_glass": principled(
            "l3_exhibit_smoked_glass",
            (0.04, 0.09, 0.10, 0.11),
            0.18,
            0.35,
            0.11,
            (0.01, 0.12, 0.15, 1),
            0.04,
        ),
        "cyan": principled("l3_exhibit_cyan_light", (0.36, 0.96, 1.0, 1), 0.22, 0.0, 1.0, (0.3, 1.0, 1.0, 1), 1.8),
        "amber": principled("l3_exhibit_amber_light", (1.0, 0.66, 0.22, 1), 0.26, 0.0, 1.0, (1.0, 0.55, 0.18, 1), 1.35),
        "red": principled("l3_exhibit_red_pin_light", (1.0, 0.2, 0.16, 1), 0.28, 0.0, 1.0, (1.0, 0.16, 0.12, 1), 1.2),
        "shadow": principled("l3_exhibit_contact_shadow", (0.002, 0.004, 0.004, 0.34), 0.8, 0, 0.34),
    }


def cube(name, location, scale, material, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new(name="hp_beveled_edges", type="BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def add_empty(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def cyl(name, location, radius, depth, material, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def sphere(name, location, radius, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=14, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def torus(name, location, major_radius, minor_radius, material, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=36, minor_segments=8, major_radius=major_radius, minor_radius=minor_radius, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def set_parent(parent, objects):
    for obj in objects:
        obj.parent = parent
    return parent


def object_world_bounds(obj):
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return {
        "min": [min(c[i] for c in corners) for i in range(3)],
        "max": [max(c[i] for c in corners) for i in range(3)],
    }


def assert_objects_inside_case(model_key, objects, w, h, d):
    inner = {
        "min": [-w * 0.5 + 0.055, -d * 0.5 + 0.055, 0.26],
        "max": [w * 0.5 - 0.055, d * 0.5 - 0.055, h - 0.22],
    }
    outside = []
    for obj in objects:
        bounds = object_world_bounds(obj)
        if any(bounds["min"][i] < inner["min"][i] - 0.002 or bounds["max"][i] > inner["max"][i] + 0.002 for i in range(3)):
            outside.append({"name": obj.name, "bounds": bounds})
    audit = {
        "modelKey": model_key,
        "innerBounds": inner,
        "checkedMeshCount": len(objects),
        "outsideMeshCount": len(outside),
        "outside": outside,
    }
    INSIDE_BOUNDS_AUDITS.append(audit)
    if outside:
        raise RuntimeError(f"{model_key} has {len(outside)} internal meshes outside the glass case inner bounds")


def contact_shadow(w, d, mats):
    cube("contact_shadow_grounded", (0, 0, 0.012), (w, d, 0.006), mats["shadow"])


def vitrine_shell(prefix, w, h, d, mats):
    shell_parts = []
    shell_root = add_empty(f"{prefix}_shared_transparent_glass_case_root")
    shell_parts.append(cube(f"{prefix}_lower_plinth_smoked_black_textured", (0, 0, 0.09), (w, d, 0.18), mats["black"], bevel=0.018))
    shell_parts.append(cube(f"{prefix}_upper_cap_smoked_black_textured", (0, 0, h - 0.08), (w, d, 0.16), mats["black"], bevel=0.018))
    deck_z = 0.36 if h < 1.5 else 0.28
    shell_parts.append(cube(f"{prefix}_inner_deck_smoked_display_floor", (0, 0.02, deck_z), (w - 0.24, d - 0.2, 0.055), mats["body"], bevel=0.014))
    for side_name, y in (("player_side", -d * 0.5 + 0.025), ("far_side", d * 0.5 - 0.025)):
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_top_edge", (0, y, h - 0.27), (w - 0.24, 0.028, 0.026), mats["glass"], bevel=0.003))
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_bottom_edge", (0, y, 0.45), (w - 0.24, 0.028, 0.022), mats["glass"], bevel=0.003))
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_left_edge", (-w * 0.5 + 0.11, y, h * 0.5), (0.026, 0.028, h - 0.48), mats["glass"], bevel=0.003))
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_right_edge", (w * 0.5 - 0.11, y, h * 0.5), (0.026, 0.028, h - 0.48), mats["glass"], bevel=0.003))
    for side_name, x in (("left_side", -w * 0.5 + 0.025), ("right_side", w * 0.5 - 0.025)):
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_top_edge", (x, 0, h - 0.27), (0.026, d - 0.22, 0.026), mats["glass"], bevel=0.003))
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_bottom_edge", (x, 0, 0.45), (0.022, d - 0.22, 0.022), mats["glass"], bevel=0.003))
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_front_edge", (x, -d * 0.5 + 0.11, h * 0.5), (0.026, 0.026, h - 0.48), mats["glass"], bevel=0.003))
        shell_parts.append(cube(f"{prefix}_{side_name}_clear_glass_back_edge", (x, d * 0.5 - 0.11, h * 0.5), (0.026, 0.026, h - 0.48), mats["glass"], bevel=0.003))
    shell_parts.append(cube(f"{prefix}_top_clear_cyan_glass_lid", (0, 0, h - 0.19), (w - 0.24, d - 0.2, 0.028), mats["glass"], bevel=0.003))
    for x in (-w * 0.5 + 0.045, w * 0.5 - 0.045):
        for y in (-d * 0.5 + 0.045, d * 0.5 - 0.045):
            shell_parts.append(cube(f"{prefix}_aged_brass_corner_post_{round(x, 3)}_{round(y, 3)}", (x, y, h * 0.5), (0.065, 0.065, h), mats["brass"], bevel=0.006))
    for x in (-w * 0.24, 0, w * 0.24):
        shell_parts.append(cube(f"{prefix}_soft_cyan_top_spot_{round(x, 2)}", (x, d * 0.5 - 0.09, h - 0.24), (0.12, 0.026, 0.026), mats["cyan"], bevel=0.003))
    shell_parts.append(cube(f"{prefix}_cyan_floor_light_line", (0, d * 0.5 - 0.08, 0.245), (w - 0.28, 0.025, 0.025), mats["cyan"], bevel=0.002))
    shell_parts.append(cube(f"{prefix}_amber_unlabeled_accession_slot", (0, d * 0.5 - 0.045, 0.335), (w * 0.36, 0.018, 0.04), mats["amber"], bevel=0.003))
    shell_parts.append(cube(f"{prefix}_thin_front_lip_beveled_brass", (0, d * 0.5 - 0.035, 0.64), (w - 0.18, 0.02, 0.018), mats["brass"], bevel=0.002))
    return set_parent(shell_root, shell_parts)


def voice_internal_parts(mats, offset_x=0.0, prefix="voice_asset"):
    parts = []
    parts.append(torus(f"{prefix}_brass_capture_horn_outer_ring", (offset_x - 0.35, 0.05, 1.15), 0.22, 0.026, mats["brass"], (math.pi / 2, 0, 0)))
    parts.append(torus(f"{prefix}_cyan_capture_horn_inner_glow", (offset_x - 0.35, 0.025, 1.15), 0.145, 0.012, mats["cyan"], (math.pi / 2, 0, 0)))
    parts.append(cyl(f"{prefix}_horn_throat_cone", (offset_x - 0.35, 0.19, 1.15), 0.056, 0.3, mats["brass"], (math.pi / 2, 0, 0), 18))
    parts.append(cube(f"{prefix}_horn_vertical_support_arm", (offset_x - 0.35, 0.19, 0.84), (0.04, 0.04, 0.58), mats["dark_tool"], bevel=0.004))
    for rail, z in enumerate((1.18,)):
        parts.append(cube(f"{prefix}_brushed_frequency_rail_{rail}", (offset_x - 0.18, 0.005, z), (0.88, 0.014, 0.012), mats["bone"], bevel=0.002))
    for i, x in enumerate((0.1, 0.44)):
        parts.append(cyl(f"{prefix}_visible_tape_reel_{i}", (offset_x + x, 0.05, 1.17), 0.118, 0.045, mats["dark_tool"], (math.pi / 2, 0, 0), 28))
        parts.append(torus(f"{prefix}_tape_reel_cyan_edge_{i}", (offset_x + x, 0.018, 1.17), 0.123, 0.007, mats["cyan"], (math.pi / 2, 0, 0)))
        parts.append(cyl(f"{prefix}_tape_reel_brass_hub_{i}", (offset_x + x, 0.012, 1.17), 0.034, 0.052, mats["brass"], (math.pi / 2, 0, 0), 18))
    parts.append(cube(f"{prefix}_warm_tape_bridge_upper", (offset_x + 0.27, 0.008, 1.17), (0.46, 0.018, 0.018), mats["amber"], bevel=0.002))
    parts.append(cyl(f"{prefix}_larynx_memory_capsule", (offset_x - 0.06, 0.05, 0.73), 0.085, 0.24, mats["dark_tool"], (math.pi / 2, 0, 0), 20))
    parts.append(torus(f"{prefix}_larynx_gold_suspension_ring", (offset_x - 0.06, 0.02, 0.73), 0.13, 0.01, mats["brass"], (math.pi / 2, 0, 0)))
    parts.append(cube(f"{prefix}_larynx_cyan_memory_slot", (offset_x - 0.06, 0.19, 0.73), (0.12, 0.014, 0.028), mats["cyan"], bevel=0.002))
    for i, dx in enumerate((0.0,)):
        parts.append(cube(f"{prefix}_vertical_microphone_comb_{i}", (offset_x + dx, 0.18, 0.69), (0.018, 0.014, 0.32 + i * 0.035), mats["bone"], bevel=0.002))
    for i in range(3):
        x = offset_x - 0.32 + i * 0.32
        z = 0.51 + math.sin(i * 1.18) * 0.09
        material = mats["cyan"] if i % 2 == 0 else mats["amber"]
        parts.append(cube(f"{prefix}_floating_waveform_bar_{i}", (x, 0.12, z), (0.032, 0.016, 0.13 + 0.04 * (i % 4)), material, bevel=0.002))
    parts.append(torus(f"{prefix}_outer_vibration_membrane_ring", (offset_x + 0.36, 0.1, 0.68), 0.16, 0.009, mats["brass"], (math.pi / 2, 0, 0)))
    parts.append(torus(f"{prefix}_inner_cyan_vibration_membrane", (offset_x + 0.36, 0.09, 0.68), 0.09, 0.006, mats["cyan"], (math.pi / 2, 0, 0)))
    parts.append(sphere(f"{prefix}_sealed_black_voice_core", (offset_x + 0.36, 0.08, 0.68), 0.048, mats["dark_tool"], (1, 1, 0.72)))
    return parts


def body_internal_parts(mats, offset_x=0.0, prefix="body_asset"):
    parts = []
    parts.append(torus(f"{prefix}_outer_oval_specimen_scan_frame", (offset_x, 0.03, 1.33), 0.46, 0.012, mats["cyan"], (math.pi / 2, 0, 0)))
    parts[-1].scale.x = 0.72
    parts.append(sphere(f"{prefix}_abstract_memory_head_marker", (offset_x, 0.05, 1.67), 0.105, mats["bone"], (0.72, 0.86, 0.62)))
    parts.append(cyl(f"{prefix}_dark_bionic_spine_column", (offset_x, 0.05, 1.25), 0.043, 0.84, mats["dark_tool"], (0, 0, 0), 14))
    for i in range(2):
        z = 1.47 - i * 0.2
        width = 0.5 - i * 0.08
        parts.append(cube(f"{prefix}_ivory_torso_memory_rib_left_{i}", (offset_x - 0.18, 0.05, z), (width, 0.024, 0.016), mats["bone"], (0, 0, 0.22), bevel=0.002))
        parts.append(cube(f"{prefix}_ivory_torso_memory_rib_right_{i}", (offset_x + 0.18, 0.05, z), (width, 0.024, 0.016), mats["bone"], (0, 0, -0.22), bevel=0.002))
    parts.append(sphere(f"{prefix}_clean_cyan_heart_memory_core", (offset_x, 0.085, 1.22), 0.105, mats["cyan"], (0.7, 0.48, 0.82)))
    parts.append(torus(f"{prefix}_upper_cyan_rib_scan_ring", (offset_x, 0.04, 1.38), 0.34, 0.009, mats["cyan"], (math.pi / 2, 0, 0)))
    parts.append(cube(f"{prefix}_ivory_pelvis_memory_anchor_plate", (offset_x, 0.05, 0.83), (0.46, 0.09, 0.055), mats["bone"], bevel=0.004))
    for side in (-1, 1):
        parts.append(cyl(f"{prefix}_dark_abstract_leg_memory_strut_{side}", (offset_x + side * 0.16, 0.05, 0.53), 0.026, 0.42, mats["dark_tool"], (-0.02, 0, side * -0.05), 10))
    for i, x in enumerate((0.38,)):
        parts.append(cyl(f"{prefix}_vertical_preservation_light_tube_{i}", (offset_x + x, 0.18, 1.08), 0.01, 1.14, mats["cyan"], (0, 0, 0), 12))
    for i, z in enumerate((1.34,)):
        parts.append(cube(f"{prefix}_front_cyan_vital_scan_line_{i}", (offset_x, 0.2, z), (0.8, 0.018, 0.016), mats["cyan"], bevel=0.002))
    parts.append(cube(f"{prefix}_front_amber_unlabeled_accession_plate", (offset_x, 0.2, 0.28), (0.42, 0.018, 0.04), mats["amber"], bevel=0.002))
    return parts


def tool_internal_parts(mats, offset_x=0.0, prefix="tool_asset"):
    parts = []
    parts.append(cube(f"{prefix}_single_cut_foam_tray", (offset_x, 0.02, 0.43), (1.74, 0.66, 0.08), mats["foam"], bevel=0.018))
    parts.append(cube(f"{prefix}_pistol_recess_shadow", (offset_x - 0.46, 0.09, 0.49), (0.72, 0.12, 0.025), mats["shadow"], bevel=0.006))
    parts.append(cube(f"{prefix}_rod_recess_shadow", (offset_x + 0.32, -0.16, 0.49), (1.18, 0.08, 0.025), mats["shadow"], bevel=0.006))
    parts.append(cube(f"{prefix}_sidearm_slide_battleworn_black", (offset_x - 0.47, 0.07, 0.66), (0.48, 0.11, 0.085), mats["dark_tool"], bevel=0.008))
    parts.append(cube(f"{prefix}_sidearm_frame_aged_brass_inset", (offset_x - 0.5, 0.07, 0.59), (0.36, 0.095, 0.06), mats["brass"], bevel=0.006))
    parts.append(cube(f"{prefix}_sidearm_grip_dark_rubber", (offset_x - 0.66, 0.09, 0.51), (0.12, 0.12, 0.2), mats["black"], (0, 0.0, -0.22), bevel=0.008))
    parts.append(cube(f"{prefix}_sidearm_barrel_cyan_bore_line", (offset_x - 0.13, 0.07, 0.66), (0.24, 0.045, 0.045), mats["dark_tool"], bevel=0.004))
    parts.append(cyl(f"{prefix}_sidearm_barrel_round_muzzle", (offset_x + 0.02, 0.07, 0.66), 0.03, 0.075, mats["dark_tool"], (0, math.pi / 2, 0), 20))
    parts.append(cube(f"{prefix}_sidearm_cyan_safety_memory_pin", (offset_x - 0.52, 0.005, 0.705), (0.16, 0.018, 0.016), mats["cyan"], bevel=0.002))
    parts.append(cube(f"{prefix}_sidearm_trigger_guard_brass", (offset_x - 0.52, 0.015, 0.535), (0.12, 0.022, 0.065), mats["brass"], bevel=0.004))
    parts.append(cyl(f"{prefix}_iron_rod_battleworn_main_shaft", (offset_x + 0.3, -0.14, 0.72), 0.026, 1.1, mats["dark_tool"], (0, math.pi / 2, 0), 20))
    for i, x in enumerate((-0.18, 0.07, 0.31, 0.55, 0.78)):
        parts.append(cyl(f"{prefix}_iron_rod_worn_brass_band_{i}", (offset_x + x, -0.14, 0.72), 0.032, 0.035, mats["brass"], (0, math.pi / 2, 0), 18))
    parts.append(cyl(f"{prefix}_iron_rod_black_grip_wrap", (offset_x - 0.31, -0.14, 0.72), 0.038, 0.22, mats["black"], (0, math.pi / 2, 0), 18))
    parts.append(cyl(f"{prefix}_iron_rod_flat_weighted_tip", (offset_x + 0.88, -0.14, 0.72), 0.044, 0.1, mats["dark_tool"], (0, math.pi / 2, 0), 18))
    for i, x in enumerate((-0.72, -0.22, 0.28, 0.78)):
        parts.append(cube(f"{prefix}_low_cyan_case_locator_{i}", (offset_x + x, 0.28, 0.52), (0.16, 0.018, 0.018), mats["cyan"], bevel=0.002))
    parts.append(cube(f"{prefix}_amber_chain_of_custody_slot", (offset_x + 0.1, 0.29, 0.58), (0.52, 0.016, 0.035), mats["amber"], bevel=0.002))
    return parts


def build_voice(model_key):
    reset_scene()
    mats = make_materials()
    w, h, d = 1.42, 1.72, 0.92
    contact_shadow(w, d, mats)
    vitrine_shell("voice_case", w, h, d, mats)
    prop_root = add_empty("voice_internal_3d_asset_root_horn_reels_larynx")
    prop_parts = voice_internal_parts(mats)
    assert_objects_inside_case(model_key, prop_parts, w, h, d)
    set_parent(prop_root, prop_parts)
    return export_asset(model_key)


def build_skeleton(model_key):
    reset_scene()
    mats = make_materials()
    w, h, d = 1.62, 2.12, 0.9
    contact_shadow(w, d, mats)
    vitrine_shell("skeleton_case", w, h, d, mats)
    prop_root = add_empty("body_internal_3d_asset_root_bionic_torso_memory")
    prop_parts = body_internal_parts(mats)
    assert_objects_inside_case(model_key, prop_parts, w, h, d)
    set_parent(prop_root, prop_parts)
    return export_asset(model_key)


def build_tool(model_key):
    reset_scene()
    mats = make_materials()
    w, h, d = 2.1, 1.18, 0.9
    contact_shadow(w, d, mats)
    vitrine_shell("tool_case", w, h, d, mats)
    prop_root = add_empty("tool_internal_3d_asset_root_sidearm_and_iron_rod")
    prop_parts = tool_internal_parts(mats)
    assert_objects_inside_case(model_key, prop_parts, w, h, d)
    set_parent(prop_root, prop_parts)
    return export_asset(model_key)


def export_asset(model_key):
    path = OUT_DIR / f"hp_{model_key}.glb"
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_image_format="AUTO",
    )
    return path


def audit_glb(path):
    data = path.read_bytes()
    json_len = int.from_bytes(data[12:16], "little")
    doc = json.loads(data[20 : 20 + json_len].decode("utf-8"))
    return {
        "file": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "images": [image.get("name") or image.get("uri") or "embedded" for image in doc.get("images", [])],
        "materialCount": len(doc.get("materials", [])),
        "nodeCount": len(doc.get("nodes", [])),
        "namedInternalRoots": [
            node.get("name", "")
            for node in doc.get("nodes", [])
            if "internal_3d_asset_root" in node.get("name", "")
        ],
        "texturedMaterials": [
            material.get("name", "")
            for material in doc.get("materials", [])
            if material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        ],
    }


def render_preview():
    reset_scene()
    mats = make_materials()
    contact_shadow(5.7, 1.5, mats)
    before = set(bpy.context.scene.objects)
    vitrine_shell("tool_preview_case", 2.1, 1.18, 0.9, mats)
    tool_internal_parts(mats, prefix="tool_preview_asset")
    move_meshes([obj for obj in bpy.context.scene.objects if obj not in before], -1.95)
    before = set(bpy.context.scene.objects)
    vitrine_shell("body_preview_case", 1.62, 2.12, 0.9, mats)
    body_internal_parts(mats, prefix="body_preview_asset")
    move_meshes([obj for obj in bpy.context.scene.objects if obj not in before], 0.0)
    before = set(bpy.context.scene.objects)
    vitrine_shell("voice_preview_case", 1.42, 1.72, 0.92, mats)
    voice_internal_parts(mats, prefix="voice_preview_asset")
    move_meshes([obj for obj in bpy.context.scene.objects if obj not in before], 1.85)
    bpy.ops.object.light_add(type="AREA", location=(0, -3.2, 3.3))
    bpy.context.object.name = "preview_large_softbox"
    bpy.context.object.data.energy = 560
    bpy.context.object.data.size = 4.8
    bpy.ops.object.camera_add(location=(2.8, -6.5, 1.55))
    camera = bpy.context.object
    bpy.context.scene.camera = camera
    camera.data.lens = 25
    look_at(camera, Vector((0.03, 0.0, 0.98)))
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 900
    bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.world.color = (0.005, 0.008, 0.009)
    bpy.context.scene.render.filepath = str(PREVIEW)
    bpy.ops.render.render(write_still=True)


def move_meshes(objects, dx):
    for obj in objects:
        if obj.type == "MESH":
            obj.location.x += dx


def look_at(obj, target):
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_body_inside_for_preview(mats, offset_x=0.0):
    sphere("body_asset_abstract_memory_head_marker", (offset_x, 0.05, 1.66), 0.105, mats["bone"], (0.72, 0.86, 0.62))
    cyl("body_asset_dark_bionic_spine_column", (offset_x, 0.05, 1.26), 0.045, 0.82, mats["dark_tool"], (0, 0, 0), 16)
    for i in range(6):
        z = 1.5 - i * 0.095
        width = 0.46 - i * 0.038
        cube(f"body_asset_preview_ivory_rib_left_{i}", (offset_x - 0.18, 0.05, z), (width, 0.026, 0.018), mats["bone"], (0, 0, 0.22), bevel=0.002)
        cube(f"body_asset_preview_ivory_rib_right_{i}", (offset_x + 0.18, 0.05, z), (width, 0.026, 0.018), mats["bone"], (0, 0, -0.22), bevel=0.002)
    sphere("body_asset_clean_cyan_heart_memory_core", (offset_x, 0.08, 1.22), 0.1, mats["cyan"], (0.7, 0.48, 0.82))
    torus("body_asset_upper_cyan_rib_scan_ring", (offset_x, 0.04, 1.35), 0.34, 0.009, mats["cyan"], (math.pi / 2, 0, 0))
    torus("body_asset_lower_amber_rib_scan_ring", (offset_x, 0.04, 1.05), 0.29, 0.008, mats["amber"], (math.pi / 2, 0, 0))
    for i, x in enumerate((-0.45, -0.27, 0.27, 0.45)):
        cyl(f"body_asset_preview_vertical_preservation_light_tube_{i}", (offset_x + x, 0.18, 1.08), 0.012, 1.12, mats["cyan"], (0, 0, 0), 12)


def build_voice_inside_for_preview(mats, offset_x=0.0):
    torus("voice_asset_brass_capture_horn_outer_ring", (offset_x - 0.38, 0.05, 1.14), 0.22, 0.026, mats["brass"], (math.pi / 2, 0, 0))
    torus("voice_asset_cyan_capture_horn_inner_glow", (offset_x - 0.38, 0.025, 1.14), 0.145, 0.012, mats["cyan"], (math.pi / 2, 0, 0))
    cyl("voice_asset_horn_throat_cone", (offset_x - 0.38, 0.19, 1.14), 0.056, 0.3, mats["brass"], (math.pi / 2, 0, 0), 24)
    for x in (0.12, 0.43):
        cyl(f"voice_asset_preview_visible_tape_reel_{x}", (offset_x + x, 0.05, 1.16), 0.13, 0.045, mats["dark_tool"], (math.pi / 2, 0, 0), 36)
        torus(f"voice_asset_preview_tape_reel_cyan_edge_{x}", (offset_x + x, 0.018, 1.16), 0.135, 0.007, mats["cyan"], (math.pi / 2, 0, 0))
    cyl("voice_asset_larynx_memory_capsule", (offset_x - 0.05, 0.05, 0.73), 0.085, 0.24, mats["dark_tool"], (math.pi / 2, 0, 0), 28)
    torus("voice_asset_outer_vibration_membrane_ring", (offset_x + 0.34, 0.1, 0.68), 0.16, 0.009, mats["brass"], (math.pi / 2, 0, 0))
    torus("voice_asset_inner_cyan_vibration_membrane", (offset_x + 0.34, 0.09, 0.68), 0.095, 0.006, mats["cyan"], (math.pi / 2, 0, 0))
    for i in range(7):
        x = offset_x - 0.5 + i * 0.16
        z = 0.52 + math.sin(i * 1.35) * 0.08
        material = mats["cyan"] if i % 2 == 0 else mats["amber"]
        cube(f"voice_asset_preview_floating_waveform_bar_{i}", (x, 0.12, z), (0.038, 0.016, 0.14 + 0.045 * (i % 3)), material, bevel=0.002)


def main():
    voice_path = build_voice("room_museum_voice_archive_case")
    bpy.ops.wm.save_as_mainfile(filepath=str(VOICE_SOURCE_BLEND))
    body_path = build_skeleton("room_museum_skeleton_vitrine")
    bpy.ops.wm.save_as_mainfile(filepath=str(BODY_SOURCE_BLEND))
    tool_path = build_tool("room_museum_last_human_tool_vitrine")
    bpy.ops.wm.save_as_mainfile(filepath=str(TOOL_SOURCE_BLEND))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))
    render_preview()

    compatibility = {
        "age_museum_voice_booth": voice_path,
        "age_museum_body_reference_case": body_path,
    }
    copied = []
    for alias, source in compatibility.items():
        target = OUT_DIR / f"{alias}.glb"
        shutil.copyfile(source, target)
        copied.append(audit_glb(target))

    audits = [audit_glb(voice_path), audit_glb(body_path), audit_glb(tool_path), *copied]
    texture_sources = sorted(str(path.relative_to(ROOT)) for path in TEXTURE_DIR.glob("l3_glass_case_*_v2.png"))
    blueprints = [
        {
            "assetFamily": "level03_hero_exhibit_glass_case",
            "modelKey": "room_museum_voice_archive_case",
            "role": "Level 3 voice exhibit key-room hero prop; communicates recorded voice memory through a refined acoustic machine, not flat posters.",
            "scaleMeters": {"width": 1.42, "height": 1.72, "depth": 0.92, "readabilityDistance": "2.0-5.0m"},
            "silhouette": ["rectangular smoked glass vitrine", "brass horn", "twin tape reels", "single frequency rail", "reduced waveform bars", "larynx memory capsule"],
            "materialSlots": ["smoked_black_metal", "aged_brass", "cyan_glass", "dark_mechanism", "cyan_light", "amber_light", "red_pin"],
            "collisionProxy": {"type": "box", "halfSize": [0.71, 0.86, 0.46], "blocks": "case footprint only"},
            "expectedPlacement": {"levelId": "level_03_human_museum", "roomId": "level_03_voice_exhibit", "position": [12.2, 0.045, 2.0], "rotationY": -0.08},
            "runtimeContent": "No puzzle answers or localized story text baked into mesh.",
        },
        {
            "assetFamily": "level03_hero_exhibit_glass_case",
            "modelKey": "room_museum_skeleton_vitrine",
            "role": "Level 3 body exhibit critical-path hero prop; clean bionic torso memory specimen with surgical preservation language, no gore.",
            "scaleMeters": {"width": 1.62, "height": 2.12, "depth": 0.9, "readabilityDistance": "2.0-6.0m"},
            "silhouette": ["tall smoked glass vitrine", "abstract torso memory core", "minimal ivory rib lattice", "bionic spine", "single oval scan frame", "one preservation light tube"],
            "materialSlots": ["smoked_black_metal", "aged_brass", "cyan_glass", "ivory_memory", "dark_mechanism", "cyan_light", "amber_light"],
            "collisionProxy": {"type": "box", "halfSize": [0.81, 1.06, 0.45], "blocks": "case footprint only"},
            "expectedPlacement": {"levelId": "level_03_human_museum", "roomId": "level_03_body_exhibit", "position": [-3.15, 0.045, -5.35], "rotationY": -0.08},
            "runtimeContent": "No puzzle answers or localized story text baked into mesh.",
        },
        {
            "assetFamily": "level03_hero_exhibit_glass_case",
            "modelKey": "room_museum_last_human_tool_vitrine",
            "role": "Level 3 horizontal tool exhibit; last-human sidearm and iron rod are physically inside one transparent case.",
            "scaleMeters": {"width": 2.1, "height": 1.18, "depth": 0.9, "readabilityDistance": "1.5-5.0m"},
            "silhouette": ["horizontal smoked glass vitrine", "cut foam tray", "black sidearm", "iron rod", "brass retention bands", "cyan locator lights"],
            "materialSlots": ["smoked_black_metal", "aged_brass", "cyan_glass", "cut_foam", "dark_weapon_metal", "cyan_light", "amber_light"],
            "collisionProxy": {"type": "box", "halfSize": [1.05, 0.59, 0.45], "blocks": "case footprint only"},
            "expectedPlacement": {"levelId": "level_03_human_museum", "roomId": "level_03_tool_exhibit", "position": [0.0, 0.045, -14.95], "rotationY": 0.04},
            "runtimeContent": "Story article remains in config; weapon contents are non-interactive museum specimens.",
        },
    ]
    MANIFEST.write_text(
        json.dumps(
            {
                "schemaVersion": "hp.level03.hero-exhibits-image2.v1",
                "generatedBy": "scripts/asset-build/blender-bake-level03-hero-exhibits-image2.py",
                "sourceBlend": str(SOURCE_BLEND.relative_to(ROOT)),
                "sourceBlends": [
                    str(VOICE_SOURCE_BLEND.relative_to(ROOT)),
                    str(BODY_SOURCE_BLEND.relative_to(ROOT)),
                    str(TOOL_SOURCE_BLEND.relative_to(ROOT)),
                    str(SOURCE_BLEND.relative_to(ROOT)),
                ],
                "preview": str(PREVIEW.relative_to(ROOT)),
                "textureSources": texture_sources,
                "blueprints": blueprints,
                "insideBoundsAudits": INSIDE_BOUNDS_AUDITS,
                "assets": audits,
                "notes": "Official Level 3 and builder-compatible body/voice/tool exhibit GLBs use one transparent glass cabinet language, textured metal/specimen materials, and 3D contents only; puzzle answers and story text stay in config/runtime.",
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    REPORT.write_text(
        json.dumps(
            {
                "schemaVersion": "hp.asset-blueprint-report.v1",
                "generatedBy": "scripts/asset-build/blender-bake-level03-hero-exhibits-image2.py",
                "qualityTargets": [
                    "first-person readable at 2-6m",
                    "no white proxy boxes",
                    "transparent cyan glass is visible but still leaves internal 3D objects readable",
                    "body exhibit avoids gore",
                    "voice exhibit has microphone/larynx/tuning-fork-like acoustic identity",
                    "tool exhibit contains the sidearm and iron rod inside the glass footprint",
                ],
                "textureEvidence": texture_sources,
                "preview": str(PREVIEW.relative_to(ROOT)),
                "blueprints": blueprints,
                "qaEvidence": {
                    "glbAudit": audits,
                    "insideBoundsAudits": INSIDE_BOUNDS_AUDITS,
                    "pending": ["browser first-person visual review"],
                },
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps(audits, indent=2, ensure_ascii=False))


main()
