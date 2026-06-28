"""Generate the project-owned Skill 3 protocol breach charge prop.

This is an original, procedural Blender asset for the Human Protocol ultimate
ability. It deliberately avoids third-party meshes so the commercial/license
story is simple: project-owned generated geometry + project-owned image2 decal.

Outputs:
  - src/assets/models-cooked/environment/props/hp_ability_protocol_breach_charge_v1.glb
  - src/assets/source_blend/abilities/hp_ability_protocol_breach_charge_v1.blend
  - src/assets/textures/abilities/skill3-protocol-breach-charge-image2/hp_ability_protocol_breach_charge_v1_atlas.png
  - src/assets/specs/abilities/hp_ability_protocol_breach_charge_v1.asset-spec.json
  - .tmp/skill3-protocol-breach-charge/hp_ability_protocol_breach_charge_v1_preview.png
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_KEY = "ability_protocol_breach_charge_v1"
FILE_STEM = "hp_ability_protocol_breach_charge_v1"

OUT_GLB = ROOT / "src/assets/models-cooked/environment/props" / f"{FILE_STEM}.glb"
OUT_BLEND = ROOT / "src/assets/source_blend/abilities" / f"{FILE_STEM}.blend"
OUT_SPEC = ROOT / "src/assets/specs/abilities" / f"{FILE_STEM}.asset-spec.json"
OUT_TEX_DIR = ROOT / "src/assets/textures/abilities/skill3-protocol-breach-charge-image2"
OUT_ATLAS = OUT_TEX_DIR / f"{FILE_STEM}_atlas.png"
OUT_PREVIEW = ROOT / ".tmp/skill3-protocol-breach-charge" / f"{FILE_STEM}_preview.png"


def ensure_dirs() -> None:
    for path in [OUT_GLB.parent, OUT_BLEND.parent, OUT_SPEC.parent, OUT_TEX_DIR, OUT_PREVIEW.parent]:
        path.mkdir(parents=True, exist_ok=True)


def srgb(hex_color: str) -> tuple[float, float, float, float]:
    color = hex_color.lstrip("#")
    return (
        int(color[0:2], 16) / 255,
        int(color[2:4], 16) / 255,
        int(color[4:6], 16) / 255,
        1,
    )


def make_mat(
    name: str,
    color: str,
    *,
    metallic: float = 0.0,
    roughness: float = 0.5,
    emissive: str | None = None,
    emissive_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*srgb(color)[:3], alpha)
    if alpha < 1:
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = False
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*srgb(color)[:3], alpha)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb(emissive)
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return mat


def apply_finish(obj: bpy.types.Object, bevel: float = 0.0, bevel_segments: int = 2) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("soft_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = bevel_segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(35)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    normal = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    obj.select_set(False)


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(mat)
    return obj


def cube(
    name: str,
    loc: tuple[float, float, float],
    dims: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.006,
    bevel_segments: int = 2,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    apply_finish(obj, bevel, bevel_segments)
    return obj


def cyl(
    name: str,
    loc: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 24,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    apply_finish(obj, bevel, 2)
    return obj


def torus(
    name: str,
    loc: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    *,
    major_segments: int = 36,
    minor_segments: int = 8,
    rot: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    apply_finish(obj, 0, 1)
    return obj


def write_image2_atlas() -> bpy.types.Image:
    size = 512
    pixels: list[float] = []
    for y in range(size):
        v = y / (size - 1)
        for x in range(size):
            u = x / (size - 1)
            base = 0.035 + 0.035 * (1 - v)
            cyan_line = 0.0
            amber_line = 0.0
            if abs(u - 0.5) < 0.035:
                cyan_line = 0.85
            if abs((u + v * 0.28) % 0.25 - 0.125) < 0.011 and 0.16 < v < 0.88:
                cyan_line = max(cyan_line, 0.5)
            if abs(v - 0.18) < 0.012 or abs(v - 0.82) < 0.012:
                amber_line = 0.72
            vignette = max(0.0, 1.0 - ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 1.4)
            r = base + amber_line * 0.82 + cyan_line * 0.18
            g = base + amber_line * 0.48 + cyan_line * 0.92
            b = base + amber_line * 0.15 + cyan_line * 1.0
            pixels.extend([min(r * vignette + 0.01, 1), min(g * vignette + 0.01, 1), min(b * vignette + 0.015, 1), 1.0])

    image = bpy.data.images.new(f"{FILE_STEM}_image2_atlas", width=size, height=size, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(OUT_ATLAS)
    image.file_format = "PNG"
    image.save()
    return image


def make_image_mat(name: str, image: bpy.types.Image) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    if bsdf:
        bsdf.inputs["Metallic"].default_value = 0.12
        bsdf.inputs["Roughness"].default_value = 0.22
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb("#5ff4ff")
            bsdf.inputs["Emission Strength"].default_value = 0.72
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return mat


def image2_panel(name: str, angle: float, z: float, width: float, height: float, mat: bpy.types.Material) -> bpy.types.Object:
    radial = Vector((math.cos(angle), math.sin(angle), 0))
    tangent = Vector((-math.sin(angle), math.cos(angle), 0))
    center = radial * 0.116 + Vector((0, 0, z))
    hw = width / 2
    hh = height / 2
    verts = [
        center - tangent * hw - Vector((0, 0, hh)),
        center + tangent * hw - Vector((0, 0, hh)),
        center + tangent * hw + Vector((0, 0, hh)),
        center - tangent * hw + Vector((0, 0, hh)),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], [(0, 1, 2, 3)])
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = coord
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def build_asset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"

    image = write_image2_atlas()
    mats = {
        "body": make_mat("skill3_body_graphite", "#111417", metallic=0.72, roughness=0.34),
        "body_edge": make_mat("skill3_body_edge_dark", "#06080a", metallic=0.62, roughness=0.38),
        "brass": make_mat("skill3_clamp_brass_warm", "#b98542", metallic=0.86, roughness=0.28),
        "pin": make_mat("skill3_safety_pin_blacksteel", "#1a1d1f", metallic=0.78, roughness=0.3),
        "cyan": make_mat("skill3_cyan_energy_glass", "#5ff4ff", metallic=0.08, roughness=0.16, emissive="#55eaff", emissive_strength=1.2),
        "glass": make_mat("skill3_smoked_energy_shell", "#263238", metallic=0.1, roughness=0.18, emissive="#1fbfd1", emissive_strength=0.28, alpha=0.56),
        "rubber": make_mat("skill3_black_rubber_grip", "#08090a", metallic=0.22, roughness=0.58),
        "image2": make_image_mat("skill3_image2_energy_window_atlas", image),
    }

    parts: list[bpy.types.Object] = []
    parts.append(cyl("protocol_charge_graphite_core", (0, 0, 0.255), 0.105, 0.38, mats["body"], vertices=20, bevel=0.008))
    parts.append(cyl("protocol_charge_top_cap", (0, 0, 0.475), 0.112, 0.055, mats["body_edge"], vertices=20, bevel=0.006))
    parts.append(cyl("protocol_charge_bottom_cap", (0, 0, 0.035), 0.112, 0.07, mats["body_edge"], vertices=20, bevel=0.006))
    # Keep cyan as readable window/status light detail only. A full glowing body
    # reads like an energy pickup, which is exactly what this Skill 3 prop must
    # avoid in first-person and deployed states.
    parts.append(torus("protocol_charge_top_cyan_status_ring", (0, 0, 0.505), 0.064, 0.0045, mats["cyan"], major_segments=32, minor_segments=8))
    parts.append(torus("protocol_charge_lower_cyan_status_ring", (0, 0, 0.082), 0.074, 0.004, mats["cyan"], major_segments=32, minor_segments=8))

    for index, z in enumerate([0.12, 0.255, 0.39]):
        parts.append(torus(f"protocol_charge_brass_lock_ring_{index}", (0, 0, z), 0.112, 0.0065, mats["brass"]))

    for index, angle in enumerate([0, math.pi / 2, math.pi, math.pi * 1.5]):
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        loc = tuple(radial * 0.125 + Vector((0, 0, 0.255)))
        rot = (0, 0, angle)
        parts.append(cube(f"protocol_charge_vertical_brass_clamp_{index}", loc, (0.018, 0.012, 0.31), mats["brass"], rot=rot, bevel=0.003))

    for index, angle in enumerate([math.radians(40), math.radians(160), math.radians(280)]):
        parts.append(image2_panel(f"protocol_charge_image2_energy_window_{index}", angle, 0.255, 0.064, 0.22, mats["image2"]))

    for index, angle in enumerate([math.radians(40), math.radians(160), math.radians(280)]):
        radial = Vector((math.cos(angle), math.sin(angle), 0))
        tangent = Vector((-math.sin(angle), math.cos(angle), 0))
        for side in [-1, 1]:
            loc = tuple(radial * 0.121 + tangent * side * 0.039 + Vector((0, 0, 0.255)))
            parts.append(cube(f"protocol_charge_window_brass_edge_{index}_{side}", loc, (0.006, 0.008, 0.245), mats["brass"], rot=(0, 0, angle), bevel=0.002))

    parts.append(cube("protocol_charge_top_arming_block", (0, -0.012, 0.535), (0.12, 0.055, 0.035), mats["brass"], bevel=0.005))
    parts.append(cyl("protocol_charge_pull_pin_crossbar", (0, -0.067, 0.54), 0.006, 0.13, mats["pin"], vertices=10, rot=(0, math.radians(90), 0), bevel=0.0))
    parts.append(torus("protocol_charge_pull_ring", (0, -0.126, 0.542), 0.045, 0.0055, mats["pin"], major_segments=28, minor_segments=8, rot=(math.radians(90), 0, 0)))
    parts.append(cube("protocol_charge_rubber_grip_band_front", (0, -0.119, 0.205), (0.072, 0.018, 0.205), mats["rubber"], bevel=0.004))
    parts.append(cube("protocol_charge_rubber_grip_band_back", (0, 0.119, 0.305), (0.072, 0.018, 0.205), mats["rubber"], bevel=0.004))
    parts.append(cube("protocol_charge_dark_side_plate_left", (-0.119, 0, 0.255), (0.018, 0.074, 0.275), mats["body_edge"], bevel=0.004))
    parts.append(cube("protocol_charge_dark_side_plate_right", (0.119, 0, 0.255), (0.018, 0.074, 0.275), mats["body_edge"], bevel=0.004))

    root = bpy.data.objects.new(MODEL_KEY, None)
    bpy.context.collection.objects.link(root)
    for obj in parts:
        obj.parent = root

    root["hp_model_key"] = MODEL_KEY
    root["hp_asset_role"] = "ultimate_skill3_bomb"
    root["license"] = "Project-owned original procedural Blender asset; no third-party mesh or texture."
    root["image2_atlas"] = str(OUT_ATLAS.relative_to(ROOT))

    # Keep authored origin at the floor center for world deployment.
    bpy.context.view_layer.update()
    all_meshes = [obj for obj in parts if getattr(obj, "data", None)]
    min_z = min((obj.matrix_world @ Vector(corner)).z for obj in all_meshes for corner in obj.bound_box)
    for obj in parts:
        obj.location.z -= min_z

    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))

    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )

    write_spec(parts)
    render_preview(root)


def write_spec(parts: list[bpy.types.Object]) -> None:
    bbox_points = [obj.matrix_world @ Vector(corner) for obj in parts if getattr(obj, "data", None) for corner in obj.bound_box]
    min_x, max_x = min(p.x for p in bbox_points), max(p.x for p in bbox_points)
    min_y, max_y = min(p.y for p in bbox_points), max(p.y for p in bbox_points)
    min_z, max_z = min(p.z for p in bbox_points), max(p.z for p in bbox_points)
    spec = {
        "assetId": FILE_STEM,
        "modelKey": MODEL_KEY,
        "displayName": "Protocol Breach Charge",
        "role": "skill3_ultimate_bomb",
        "license": {
            "status": "project-owned",
            "commercialUse": True,
            "modification": True,
            "attributionRequired": False,
            "notes": "Original procedural Blender geometry and generated image2 atlas. No third-party mesh/texture is bundled.",
        },
        "outputs": {
            "glb": str(OUT_GLB.relative_to(ROOT)),
            "sourceBlend": str(OUT_BLEND.relative_to(ROOT)),
            "image2Atlas": str(OUT_ATLAS.relative_to(ROOT)),
            "preview": str(OUT_PREVIEW.relative_to(ROOT)),
        },
        "sizeMeters": [round(max_x - min_x, 3), round(max_z - min_z, 3), round(max_y - min_y, 3)],
        "designContract": {
            "silhouette": "compact hand-held cylinder with pull ring and three cyan energy windows",
            "firstPersonRead": "black/brass/cyan, readable at 20-35cm hand-held scale",
            "worldRead": "upright deployed charge, not an energy pickup and not a white proxy",
            "runtimeSwap": "intended for ultimateAbilityConfig viewmodelModelKey and deployedWorldModelKey",
        },
        "materialSlots": sorted({slot.material.name for obj in parts for slot in getattr(obj, "material_slots", []) if slot.material}),
        "nodeNames": [obj.name for obj in parts],
    }
    OUT_SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")


def render_preview(root: bpy.types.Object) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.world = bpy.data.worlds.new("skill3_preview_world")
    scene.world.color = (0.04, 0.05, 0.055)

    bpy.ops.object.light_add(type="AREA", location=(1.4, -2.3, 2.4))
    key = bpy.context.object
    key.name = "preview_key_light"
    key.data.energy = 420
    key.data.size = 3.0

    bpy.ops.object.light_add(type="POINT", location=(-1.0, 1.0, 0.65))
    cyan = bpy.context.object
    cyan.name = "preview_cyan_kicker"
    cyan.data.color = srgb("#6ff6ff")[:3]
    cyan.data.energy = 90

    target = bpy.data.objects.new("preview_target", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, 0, 0.27)

    cam_data = bpy.data.cameras.new("preview_camera_data")
    cam_data.lens = 70
    cam = bpy.data.objects.new("preview_camera", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0.56, -1.38, 0.78)
    constraint = cam.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    scene.camera = cam

    scene.render.filepath = str(OUT_PREVIEW)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    ensure_dirs()
    build_asset()
    print("SKILL3_PROTOCOL_BREACH_CHARGE_DONE")
    print(f"GLB {OUT_GLB}")
    print(f"BLEND {OUT_BLEND}")
    print(f"SPEC {OUT_SPEC}")
    print(f"ATLAS {OUT_ATLAS}")
    print(f"PREVIEW {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
