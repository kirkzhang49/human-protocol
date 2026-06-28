"""Generate the project-owned Skill 3 protocol breach missile prop.

This is a separate Skill 3 visual from the existing protocol breach charge.
It is fully authored in Blender Python: no external mesh, no external texture,
and no third-party source asset is used as input.

Outputs:
  - src/assets/models-cooked/environment/props/hp_ability_protocol_breach_missile_v1.glb
  - src/assets/source_blend/abilities/hp_ability_protocol_breach_missile_v1.blend
  - src/assets/textures/abilities/skill3-protocol-breach-missile-image2/hp_ability_protocol_breach_missile_v1_atlas.png
  - src/assets/specs/abilities/hp_ability_protocol_breach_missile_v1.asset-spec.json
  - .tmp/skill3-protocol-breach-missile/hp_ability_protocol_breach_missile_v1_preview.png
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_KEY = "ability_protocol_breach_missile_v1"
FILE_STEM = "hp_ability_protocol_breach_missile_v1"

OUT_GLB = ROOT / "src/assets/models-cooked/environment/props" / f"{FILE_STEM}.glb"
OUT_BLEND = ROOT / "src/assets/source_blend/abilities" / f"{FILE_STEM}.blend"
OUT_SPEC = ROOT / "src/assets/specs/abilities" / f"{FILE_STEM}.asset-spec.json"
OUT_TEX_DIR = ROOT / "src/assets/textures/abilities/skill3-protocol-breach-missile-image2"
OUT_ATLAS = OUT_TEX_DIR / f"{FILE_STEM}_atlas.png"
OUT_PREVIEW = ROOT / ".tmp/skill3-protocol-breach-missile" / f"{FILE_STEM}_preview.png"


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


def principled(mat: bpy.types.Material):
    if not mat.use_nodes or not mat.node_tree:
        return None
    return next((node for node in mat.node_tree.nodes if node.bl_idname == "ShaderNodeBsdfPrincipled"), None)


def make_mat(
    name: str,
    color: str,
    *,
    metallic: float = 0.0,
    roughness: float = 0.5,
    emissive: str | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = srgb(color)
    bsdf = principled(mat)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = srgb(color)
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb(emissive)
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return mat


def finish(obj: bpy.types.Object, bevel: float = 0.0, segments: int = 2) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("hp_soft_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(35)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    normal = obj.modifiers.new("hp_weighted_normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normal.name)
    obj.select_set(False)
    return obj


def assign(obj: bpy.types.Object, mat: bpy.types.Material) -> bpy.types.Object:
    obj.data.materials.append(mat)
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
    return finish(obj, bevel)


def cone(
    name: str,
    loc: tuple[float, float, float],
    radius1: float,
    radius2: float,
    depth: float,
    mat: bpy.types.Material,
    *,
    vertices: int = 24,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return finish(obj, bevel)


def cube(
    name: str,
    loc: tuple[float, float, float],
    dims: tuple[float, float, float],
    mat: bpy.types.Material,
    *,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.004,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign(obj, mat)
    return finish(obj, bevel)


def torus(
    name: str,
    loc: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    mat: bpy.types.Material,
    *,
    rot: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 36,
    minor_segments: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    assign(obj, mat)
    return finish(obj)


def empty(name: str, loc: tuple[float, float, float], *, size: float = 0.04) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = size
    obj.location = loc
    bpy.context.collection.objects.link(obj)
    return obj


def write_texture_atlas() -> bpy.types.Image:
    size = 1024
    rng = random.Random("human-protocol-protocol-breach-missile-v1-atlas")
    scratches = [(rng.random(), rng.random(), rng.uniform(0.015, 0.09), rng.uniform(0.12, 0.35)) for _ in range(120)]
    pixels: list[float] = []
    for y in range(size):
        v = y / (size - 1)
        for x in range(size):
            u = x / (size - 1)
            base = 0.038 + 0.04 * (1 - v)
            panel = 0.0
            if abs((u * 5.0) % 1.0 - 0.5) < 0.035:
                panel = 0.055
            cyan = 0.0
            if 0.22 < u < 0.78 and abs(v - 0.5) < 0.06:
                cyan = 0.72
            if abs((u + v * 0.38) % 0.22 - 0.11) < 0.008 and 0.18 < v < 0.84:
                cyan = max(cyan, 0.34)
            brass = 0.0
            if abs(v - 0.16) < 0.016 or abs(v - 0.84) < 0.016:
                brass = 0.7
            scratch = 0.0
            for sx, sy, length, strength in scratches:
                d = abs((u - sx) * 0.65 - (v - sy) * 0.22)
                along = abs((u - sx) * 0.22 + (v - sy) * 0.65)
                if d < 0.003 and along < length:
                    scratch = max(scratch, strength)
            r = base + panel + brass * 0.85 + cyan * 0.12 + scratch * 0.34
            g = base + panel + brass * 0.55 + cyan * 0.88 + scratch * 0.34
            b = base + panel + brass * 0.22 + cyan * 1.00 + scratch * 0.31
            pixels.extend([min(r, 1), min(g, 1), min(b, 1), 1.0])

    image = bpy.data.images.new(f"{FILE_STEM}_atlas", width=size, height=size, alpha=True)
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(OUT_ATLAS)
    image.file_format = "PNG"
    image.save()
    return image


def make_atlas_mat(name: str, image: bpy.types.Image) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    bsdf = principled(mat)
    if bsdf:
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Metallic"].default_value = 0.18
        bsdf.inputs["Roughness"].default_value = 0.28
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb("#5ff4ff")
            bsdf.inputs["Emission Strength"].default_value = 0.45
    return mat


def atlas_panel(name: str, angle: float, y: float, length: float, height: float, mat: bpy.types.Material) -> bpy.types.Object:
    radial = Vector((math.cos(angle), 0, math.sin(angle)))
    tangent = Vector((-math.sin(angle), 0, math.cos(angle)))
    center = radial * 0.092 + Vector((0, y, 0.25))
    hl = length / 2
    hh = height / 2
    verts = [
        center - Vector((0, hl, 0)) - tangent * hh,
        center + Vector((0, hl, 0)) - tangent * hh,
        center + Vector((0, hl, 0)) + tangent * hh,
        center - Vector((0, hl, 0)) + tangent * hh,
    ]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata([tuple(v) for v in verts], [], [(0, 1, 2, 3)])
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, [(0.18, 0.38), (0.82, 0.38), (0.82, 0.62), (0.18, 0.62)]):
        loop.uv = coord
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def missile_fin(name: str, angle: float, mat: bpy.types.Material) -> bpy.types.Object:
    radial = Vector((math.cos(angle), 0, math.sin(angle)))
    tangent = Vector((-math.sin(angle), 0, math.cos(angle)))
    y0 = 0.22
    y1 = 0.42
    radius = 0.084
    height = 0.11
    thickness = 0.014
    base_a = radial * radius + Vector((0, y0, 0.25))
    base_b = radial * radius + Vector((0, y1, 0.25))
    tip = radial * (radius + height) + Vector((0, y1 - 0.045, 0.25))
    verts = []
    for offset in (-thickness / 2, thickness / 2):
        side = tangent * offset
        verts.extend([tuple(base_a + side), tuple(base_b + side), tuple(tip + side)])
    faces = [(0, 1, 2), (3, 5, 4), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return finish(obj, 0.002, 1)


def build_asset() -> tuple[list[bpy.types.Object], list[bpy.types.Object]]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"

    image = write_texture_atlas()
    mats = {
        "body": make_mat("skill3_missile_body_smoked_titanium", "#111417", metallic=0.82, roughness=0.32),
        "dark": make_mat("skill3_missile_dark_cut_edges", "#05070a", metallic=0.72, roughness=0.4),
        "nose": make_mat("skill3_missile_scraped_nose_cap", "#d6ddd8", metallic=0.92, roughness=0.23),
        "brass": make_mat("skill3_missile_brass_locking_ribs", "#b98542", metallic=0.86, roughness=0.3),
        "pin": make_mat("skill3_missile_safety_pin_blacksteel", "#1a1d1f", metallic=0.78, roughness=0.3),
        "cyan": make_mat("skill3_missile_cyan_energy_glass", "#5ff4ff", metallic=0.08, roughness=0.16, emissive="#55eaff", emissive_strength=1.15),
        "rubber": make_mat("skill3_missile_black_rubber_grip", "#08090a", metallic=0.22, roughness=0.58),
        "atlas": make_atlas_mat("skill3_missile_generated_energy_window_atlas", image),
    }

    parts: list[bpy.types.Object] = []
    body_z = 0.25
    axis_rot = (math.radians(90), 0, 0)
    parts.append(cyl("breach_missile_graphite_main_body", (0, 0.0, body_z), 0.083, 0.58, mats["body"], vertices=28, rot=axis_rot, bevel=0.006))
    parts.append(cone("breach_missile_scraped_nose_cone", (0, -0.38, body_z), 0.083, 0.012, 0.2, mats["nose"], vertices=28, rot=axis_rot, bevel=0.002))
    parts.append(cyl("breach_missile_tail_nozzle_dark", (0, 0.36, body_z), 0.077, 0.12, mats["dark"], vertices=24, rot=axis_rot, bevel=0.005))
    parts.append(cyl("breach_missile_exhaust_core_cyan", (0, 0.426, body_z), 0.038, 0.018, mats["cyan"], vertices=20, rot=axis_rot))

    for index, y in enumerate([-0.24, -0.04, 0.18, 0.32]):
        parts.append(torus(f"breach_missile_brass_lock_ring_{index}", (0, y, body_z), 0.084, 0.0058, mats["brass"], rot=axis_rot))

    for index, angle in enumerate([math.radians(45), math.radians(135), math.radians(225), math.radians(315)]):
        radial = Vector((math.cos(angle), 0, math.sin(angle)))
        loc = tuple(radial * 0.096 + Vector((0, -0.02, body_z)))
        parts.append(cube(f"breach_missile_longitudinal_black_rail_{index}", loc, (0.018, 0.46, 0.018), mats["dark"], rot=(0, angle, 0), bevel=0.003))

    for index, angle in enumerate([math.radians(35), math.radians(145), math.radians(270)]):
        parts.append(atlas_panel(f"breach_missile_generated_cyan_window_{index}", angle, -0.05, 0.28, 0.052, mats["atlas"]))
        radial = Vector((math.cos(angle), 0, math.sin(angle)))
        tangent = Vector((-math.sin(angle), 0, math.cos(angle)))
        for side in [-1, 1]:
            loc = tuple(radial * 0.096 + tangent * side * 0.031 + Vector((0, -0.05, body_z)))
            parts.append(cube(f"breach_missile_window_brass_edge_{index}_{side}", loc, (0.006, 0.24, 0.008), mats["brass"], rot=(0, angle, 0), bevel=0.0018))

    for index, angle in enumerate([math.radians(90), math.radians(210), math.radians(330)]):
        parts.append(missile_fin(f"breach_missile_tail_fin_{index}", angle, mats["dark"]))

    parts.append(cube("breach_missile_top_arming_spine", (0, -0.1, body_z + 0.106), (0.058, 0.34, 0.034), mats["brass"], bevel=0.004))
    parts.append(cyl("breach_missile_safety_pin_crossbar", (0, -0.315, body_z + 0.128), 0.0055, 0.116, mats["pin"], vertices=10, rot=(0, math.radians(90), 0)))
    parts.append(cyl("breach_missile_pull_ring_left_link", (-0.018, -0.315, body_z + 0.156), 0.0032, 0.052, mats["pin"], vertices=8, bevel=0.001))
    parts.append(cyl("breach_missile_pull_ring_right_link", (0.018, -0.315, body_z + 0.156), 0.0032, 0.052, mats["pin"], vertices=8, bevel=0.001))
    parts.append(torus("breach_missile_pull_ring", (0, -0.315, body_z + 0.183), 0.034, 0.0048, mats["pin"], major_segments=28, minor_segments=8))
    parts.append(cube("breach_missile_lower_rubber_grip_pad", (0, -0.05, body_z - 0.09), (0.074, 0.34, 0.026), mats["rubber"], bevel=0.004))
    parts.append(cube("breach_missile_left_service_plate", (-0.102, 0.04, body_z), (0.014, 0.27, 0.088), mats["brass"], bevel=0.003))
    parts.append(cube("breach_missile_right_service_plate", (0.102, 0.04, body_z), (0.014, 0.27, 0.088), mats["brass"], bevel=0.003))

    root = bpy.data.objects.new(MODEL_KEY, None)
    bpy.context.collection.objects.link(root)
    for obj in parts:
        obj.parent = root

    sockets = [
        empty("breach_missile_center_socket", (0, 0.0, body_z)),
        empty("breach_missile_nose_socket", (0, -0.49, body_z)),
        empty("breach_missile_tail_socket", (0, 0.45, body_z)),
        empty("breach_missile_exhaust_vfx_socket", (0, 0.49, body_z)),
        empty("breach_missile_hand_grip_socket", (0, -0.02, body_z - 0.09)),
        empty("breach_missile_collision_proxy_half_extents", (0.18, 0.47, 0.22), size=0.03),
    ]
    for obj in sockets:
        obj.parent = root

    root["hp_model_key"] = MODEL_KEY
    root["hp_asset_role"] = "skill3_variant_protocol_breach_missile"
    root["license"] = "Project-owned original procedural Blender/Python asset; no third-party mesh or texture."
    root["source_strategy"] = "Authored from primitive hard-surface blueprint with no external mesh or texture input."
    root["generated_texture_atlas"] = str(OUT_ATLAS.relative_to(ROOT))

    bpy.context.view_layer.update()
    bbox_points = [obj.matrix_world @ Vector(corner) for obj in parts if getattr(obj, "data", None) for corner in obj.bound_box]
    min_z = min(point.z for point in bbox_points)
    for obj in parts + sockets:
        obj.location.z -= min_z

    return parts, sockets


def write_spec(parts: list[bpy.types.Object], sockets: list[bpy.types.Object]) -> None:
    bbox_points = [obj.matrix_world @ Vector(corner) for obj in parts if getattr(obj, "data", None) for corner in obj.bound_box]
    min_x, max_x = min(p.x for p in bbox_points), max(p.x for p in bbox_points)
    min_y, max_y = min(p.y for p in bbox_points), max(p.y for p in bbox_points)
    min_z, max_z = min(p.z for p in bbox_points), max(p.z for p in bbox_points)
    triangles = sum(len(poly.vertices) - 2 for obj in parts if getattr(obj, "data", None) for poly in obj.data.polygons)
    vertices = sum(len(obj.data.vertices) for obj in parts if getattr(obj, "data", None))
    spec = {
        "assetId": FILE_STEM,
        "modelKey": MODEL_KEY,
        "displayName": "Protocol Breach Missile",
        "role": "skill3_variant_breach_missile_pickup_and_deployed_visual",
        "license": {
            "status": "project-owned",
            "commercialUse": True,
            "modification": True,
            "attributionRequired": False,
            "notes": "Fully procedural Blender/Python geometry and generated atlas. No external mesh or texture is used.",
        },
        "sourceStrategy": {
            "externalMeshInput": False,
            "externalTextureInput": False,
            "directExternalAssetCopied": False,
            "script": str((ROOT / "scripts/asset-build/generate-skill3-protocol-breach-missile.py").relative_to(ROOT)),
        },
        "outputs": {
            "glb": str(OUT_GLB.relative_to(ROOT)),
            "sourceBlend": str(OUT_BLEND.relative_to(ROOT)),
            "generatedAtlas": str(OUT_ATLAS.relative_to(ROOT)),
            "preview": str(OUT_PREVIEW.relative_to(ROOT)),
        },
        "sizeMeters": [round(max_x - min_x, 3), round(max_z - min_z, 3), round(max_y - min_y, 3)],
        "meshStats": {"vertices": vertices, "triangles": triangles},
        "designContract": {
            "silhouette": "compact horizontal breach missile with scraped nose cone, dark cylindrical body, brass lock rings, pull ring, tail nozzle, and three fins",
            "firstPersonRead": "black/brass/cyan hand-held missile at Skill 3 scale",
            "worldRead": "thrown/deployed breach missile distinct from the current core bomb/charge",
            "gameplayIntent": "future separate Skill 3 variant selected by picking up its own item",
        },
        "materialSlots": sorted({slot.material.name for obj in parts for slot in getattr(obj, "material_slots", []) if slot.material}),
        "nodeNames": [obj.name for obj in parts],
        "sockets": [obj.name for obj in sockets],
    }
    OUT_SPEC.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")


def render_preview() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 720
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.world = bpy.data.worlds.new("breach_missile_preview_world")
    scene.world.color = (0.035, 0.04, 0.045)

    bpy.ops.object.light_add(type="AREA", location=(1.6, -2.1, 1.9))
    key = bpy.context.object
    key.name = "preview_key_light"
    key.data.energy = 420
    key.data.size = 3.2

    bpy.ops.object.light_add(type="POINT", location=(-1.0, 0.55, 0.75))
    cyan = bpy.context.object
    cyan.name = "preview_cyan_kicker"
    cyan.data.color = srgb("#6ff6ff")[:3]
    cyan.data.energy = 105

    target = bpy.data.objects.new("preview_target", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, -0.03, 0.24)

    cam_data = bpy.data.cameras.new("preview_camera_data")
    cam_data.lens = 82
    cam = bpy.data.objects.new("preview_camera", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0.58, -1.35, 0.58)
    constraint = cam.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    scene.camera = cam

    scene.render.filepath = str(OUT_PREVIEW)
    bpy.ops.render.render(write_still=True)


def export(parts: list[bpy.types.Object], sockets: list[bpy.types.Object]) -> None:
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts + sockets:
        obj.select_set(True)
    root = bpy.data.objects.get(MODEL_KEY)
    if root:
        root.select_set(True)
        bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )


def main() -> None:
    ensure_dirs()
    parts, sockets = build_asset()
    export(parts, sockets)
    write_spec(parts, sockets)
    render_preview()
    print("SKILL3_PROTOCOL_BREACH_MISSILE_DONE")
    print(f"GLB {OUT_GLB}")
    print(f"BLEND {OUT_BLEND}")
    print(f"SPEC {OUT_SPEC}")
    print(f"ATLAS {OUT_ATLAS}")
    print(f"PREVIEW {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
