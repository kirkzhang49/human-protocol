#!/usr/bin/env python3
"""Generate the screen-gate replacement for puzzle_console_valve_matrix.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/asset-build/generate-gate-balance-console-glb.py

This intentionally keeps the runtime modelKey `puzzle_console_valve_matrix` so
Build Page puzzle placement and interaction wiring continue to use the existing
valve_matrix runtime puzzle, while the physical asset becomes a gate-balance
screen terminal instead of a valve-wheel manifold.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
import mathutils


ROOT = Path(__file__).resolve().parents[2]
MODEL_KEY = "puzzle_console_valve_matrix"
FAMILY = "gate_balance"

OUT_GLB = ROOT / "src/assets/models-cooked/environment/builder-puzzle-machines/hp_puzzle_console_valve_matrix.glb"
OUT_BLEND = ROOT / "src/assets/source_blend/builder-puzzle-machines/hp_puzzle_console_valve_matrix_gate_balance_v1.blend"
OUT_SPEC = ROOT / "src/assets/specs/builder-puzzle-machines/hp_puzzle_console_valve_matrix.asset-spec.json"
OUT_REPORT = ROOT / "src/assets/manifests/reports/gate_balance_console_blender_report_v1.json"
OUT_RENDER = ROOT / "src/assets/manifests/reports/gate_balance_console_render_v1.png"

SCREEN_ATLAS = ROOT / "src/assets/textures/environment/builder-puzzle-machines/hp_gate_balance_terminal_screen_atlas_v1.png"
SCREEN_REGIONS = ROOT / "src/assets/textures/environment/builder-puzzle-machines/hp_gate_balance_terminal_screen_atlas_v1.regions.json"
OVERLAY_LAYOUT = ROOT / "src/assets/gui/gate-balance/gate_balance_overlay_layout_v1.json"

DESIGN_PROMPT = (
    "Screen-gate puzzle terminal for Human Protocol valve_matrix: wide smoked "
    "titanium body, cyan glass display with three vertical shutter gate inlays, "
    "old-gold lower service rail, small side status module, grounded plinth and "
    "cable tails. It should read as a screen-based gate control device, not a "
    "route switch and not a valve-wheel manifold. No readable text, no numbers, "
    "no logos, no people, no gore."
)


def ensure_dirs() -> None:
    for path in [OUT_GLB.parent, OUT_BLEND.parent, OUT_SPEC.parent, OUT_REPORT.parent]:
        path.mkdir(parents=True, exist_ok=True)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras, bpy.data.objects):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    return (
        int(value[0:2], 16) / 255,
        int(value[2:4], 16) / 255,
        int(value[4:6], 16) / 255,
        alpha,
    )


def make_mat(
    name: str,
    base: str,
    roughness: float = 0.55,
    metallic: float = 0.0,
    emission: str | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next((node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = rgba(base)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = rgba(emission)
        if emission and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def make_image_mat(name: str, image_path: Path, emission_strength: float = 0.35) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.blend_method = "BLEND"
    mat.use_screen_refraction = False
    mat.show_transparent_back = False
    nodes = mat.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    image = bpy.data.images.load(str(image_path))
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.extension = "CLIP"
    if bsdf:
        mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if "Alpha" in bsdf.inputs:
            mat.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        if "Emission Color" in bsdf.inputs:
            mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.24
    return mat


def bevel_object(obj: bpy.types.Object, amount: float, segments: int = 3) -> None:
    if amount <= 0:
        return
    bevel = obj.modifiers.new("small_bevel", "BEVEL")
    bevel.width = amount
    bevel.segments = segments
    bevel.affect = "EDGES"
    normal = obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    try:
        normal.keep_sharp = True
    except Exception:
        pass


def cube(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material, bevel: float = 0.0) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel_object(obj, bevel)
    return obj


def cyl(
    name: str,
    loc: tuple[float, float, float],
    radius: float,
    depth: float,
    mat: bpy.types.Material,
    vertices: int = 24,
    rot: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel_object(obj, bevel)
    return obj


def load_regions() -> tuple[dict[str, list[int]], tuple[int, int]]:
    data = json.loads(SCREEN_REGIONS.read_text(encoding="utf-8"))
    return data["regions"], tuple(data["atlasSize"])


def uv_rect(region: list[int], atlas_size: tuple[int, int], pad_px: int = 2) -> tuple[float, float, float, float]:
    x, y, w, h = region
    aw, ah = atlas_size
    x0 = (x + pad_px) / aw
    x1 = (x + w - pad_px) / aw
    y0 = 1.0 - (y + h - pad_px) / ah
    y1 = 1.0 - (y + pad_px) / ah
    return x0, y0, x1, y1


def uv_panel(
    name: str,
    center: tuple[float, float, float],
    size: tuple[float, float],
    region_name: str,
    regions: dict[str, list[int]],
    atlas_size: tuple[int, int],
    mat: bpy.types.Material,
    proud: float = 0.003,
) -> bpy.types.Object:
    cx, cy, cz = center
    w, h = size
    y = cy - proud
    verts = [
        (cx - w / 2, y, cz - h / 2),
        (cx + w / 2, y, cz - h / 2),
        (cx + w / 2, y, cz + h / 2),
        (cx - w / 2, y, cz + h / 2),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    u0, v0, u1, v1 = uv_rect(regions[region_name], atlas_size)
    for loop, uv in zip(mesh.polygons[0].loop_indices, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
        uv_layer.data[loop].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def build_console() -> list[bpy.types.Object]:
    regions, atlas_size = load_regions()
    mats = {
        "body": make_mat("gb_smoked_titanium_body", "#11161a", roughness=0.42, metallic=0.12),
        "rear": make_mat("gb_black_recess", "#05080a", roughness=0.7),
        "trim": make_mat("gb_brushed_steel_trim", "#59676a", roughness=0.34, metallic=0.35),
        "gold": make_mat("gb_old_gold_bus", "#c79d4b", roughness=0.36, metallic=0.2),
        "rubber": make_mat("gb_black_rubber", "#020405", roughness=0.82),
        "cyan": make_mat("gb_cyan_glow", "#143b3d", roughness=0.22, emission="#63f4ff", emission_strength=0.85),
        "green": make_mat("gb_gate_safe_glow", "#153d36", roughness=0.22, emission="#63ffd4", emission_strength=0.9),
        "amber": make_mat("gb_gate_warning_glow", "#3a2508", roughness=0.26, emission="#ffbd61", emission_strength=0.75),
        "screen": make_image_mat("gb_terminal_screen_image2_atlas", SCREEN_ATLAS, emission_strength=0.42),
    }

    objects: list[bpy.types.Object] = []
    objects.append(cube("gate_balance_grounded_plinth", (0, 0.02, 0.09), (1.42, 0.42, 0.18), mats["rubber"], 0.025))
    objects.append(cube("gate_balance_body_back_slab", (0, 0.05, 0.82), (1.42, 0.34, 1.04), mats["body"], 0.045))
    objects.append(cube("gate_balance_screen_recess", (0, -0.145, 0.96), (1.18, 0.07, 0.66), mats["rear"], 0.022))
    objects.append(cube("gate_balance_screen_outer_frame", (0, -0.19, 0.96), (1.26, 0.07, 0.76), mats["trim"], 0.025))
    objects.append(cube("gate_balance_screen_dark_well", (0, -0.225, 0.96), (1.12, 0.035, 0.62), mats["rear"], 0.012))
    objects.append(uv_panel("gate_balance_screen_back_image2", (0, -0.246, 0.96), (1.04, 0.58), "screen_back", regions, atlas_size, mats["screen"], 0.002))

    for idx, (x, region, mat_name) in enumerate(
        [
            (-0.31, "screen_gate_focus", "amber"),
            (0.0, "screen_gate_balanced", "green"),
            (0.31, "screen_gate_idle", "amber"),
        ]
    ):
        objects.append(cube(f"gate_balance_gate_cell_frame_{idx}", (x, -0.268, 1.04), (0.22, 0.035, 0.29), mats["rear"], 0.012))
        objects.append(uv_panel(f"gate_balance_gate_cell_image2_{idx}", (x, -0.292, 1.04), (0.18, 0.21), region, regions, atlas_size, mats["screen"], 0.002))
        objects.append(cube(f"gate_balance_gate_status_light_{idx}", (x, -0.306, 0.78), (0.12, 0.02, 0.025), mats[mat_name], 0.006))

    # Lower service rail and tactile button row: visual only, runtime interaction
    # is still opened by the puzzle interaction anchor.
    objects.append(cube("gate_balance_old_gold_lower_bus", (0, -0.25, 0.46), (1.05, 0.06, 0.055), mats["gold"], 0.008))
    for idx in range(8):
        objects.append(cube(f"gate_balance_bus_tooth_{idx}", (-0.42 + idx * 0.12, -0.285, 0.39), (0.055, 0.045, 0.08), mats["gold"], 0.006))
    for idx, x in enumerate([-0.42, -0.2, 0.02, 0.24, 0.46]):
        mat = mats["green"] if idx in (1, 3) else mats["rear"]
        objects.append(cube(f"gate_balance_lower_status_key_{idx}", (x, -0.287, 0.58), (0.14, 0.03, 0.055), mat, 0.008))

    # Side module and asymmetrical fins give the silhouette a terminal identity
    # without becoming a wall-door lever.
    objects.append(cube("gate_balance_right_status_module", (0.82, -0.02, 0.82), (0.18, 0.24, 0.64), mats["body"], 0.025))
    objects.append(cyl("gate_balance_right_ready_lens", (0.82, -0.155, 1.08), 0.055, 0.026, mats["green"], 28, rot=(math.pi / 2, 0, 0), bevel=0.004))
    objects.append(cyl("gate_balance_right_warning_lens", (0.82, -0.155, 0.88), 0.032, 0.024, mats["amber"], 20, rot=(math.pi / 2, 0, 0), bevel=0.003))
    objects.append(cyl("gate_balance_right_cyan_lens", (0.82, -0.155, 0.74), 0.03, 0.024, mats["cyan"], 20, rot=(math.pi / 2, 0, 0), bevel=0.003))
    objects.append(cube("gate_balance_left_cyan_fin", (-0.78, -0.02, 0.92), (0.045, 0.16, 0.86), mats["cyan"], 0.008))
    objects.append(cube("gate_balance_right_gold_fin", (0.68, -0.02, 0.92), (0.045, 0.13, 0.86), mats["gold"], 0.008))

    for x in (-0.52, -0.26, 0.26, 0.52):
        objects.append(cyl(f"gate_balance_frame_screw_{x:.2f}", (x, -0.295, 1.34), 0.014, 0.012, mats["trim"], 14, rot=(math.pi / 2, 0, 0), bevel=0.002))
    for x in (-0.22, 0.0, 0.22):
        objects.append(cyl(f"gate_balance_cable_tail_{x:.2f}", (x, 0.12, 0.0), 0.025, 0.36, mats["rubber"], 14, rot=(0, 0, 0), bevel=0.003))

    # Invisible-ish collision proxy is named for config authors; it is not used
    # as a separate physics mesh today, but records the intended blocker size.
    proxy = cube("collision_proxy_gate_balance_console", (0, 0.03, 0.72), (1.46, 0.46, 1.44), mats["rear"], 0.0)
    proxy.hide_viewport = True
    proxy.hide_render = True
    objects.append(proxy)
    return objects


def world_bbox(objects: list[bpy.types.Object]) -> tuple[mathutils.Vector, mathutils.Vector]:
    deps = bpy.context.evaluated_depsgraph_get()
    mins = mathutils.Vector((1e9, 1e9, 1e9))
    maxs = mathutils.Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in objects:
        if obj.type != "MESH" or obj.name.startswith("collision_proxy"):
            continue
        found = True
        evaluated = obj.evaluated_get(deps)
        for corner in evaluated.bound_box:
            point = obj.matrix_world @ mathutils.Vector(corner)
            for axis in range(3):
                mins[axis] = min(mins[axis], point[axis])
                maxs[axis] = max(maxs[axis], point[axis])
    if not found:
        return mathutils.Vector((-0.5, -0.5, 0)), mathutils.Vector((0.5, 0.5, 1))
    return mins, maxs


def mesh_stats(objects: list[bpy.types.Object]) -> dict[str, int]:
    deps = bpy.context.evaluated_depsgraph_get()
    verts = 0
    tris = 0
    meshes = 0
    for obj in objects:
        if obj.type != "MESH" or obj.name.startswith("collision_proxy"):
            continue
        meshes += 1
        mesh = obj.evaluated_get(deps).to_mesh()
        verts += len(mesh.vertices)
        tris += sum(max(len(poly.vertices) - 2, 0) for poly in mesh.polygons)
        obj.evaluated_get(deps).to_mesh_clear()
    return {"meshCount": meshes, "vertexCount": verts, "triangleCount": tris}


def setup_render(objects: list[bpy.types.Object]) -> None:
    mins, maxs = world_bbox(objects)
    center = (mins + maxs) * 0.5
    dims = maxs - mins
    radius = max(dims.x, dims.y, dims.z, 0.7)
    world = bpy.data.worlds.new("gate_balance_world")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.02, 0.025, 0.03, 1)
        bg.inputs[1].default_value = 0.9

    floor_mat = make_mat("render_floor", "#20282c", roughness=0.9)
    bpy.ops.mesh.primitive_plane_add(size=radius * 5, location=(center.x, center.y, 0))
    floor = bpy.context.object
    floor.name = "render_floor"
    floor.data.materials.append(floor_mat)

    for name, loc, energy, size in [
        ("key", (center.x - 1.6 * radius, center.y - 2.5 * radius, center.z + 2.4 * radius), 520, 3.2),
        ("fill", (center.x + 2.2 * radius, center.y - 2.0 * radius, center.z + 1.6 * radius), 180, 4.8),
        ("rim", (center.x, center.y + 2.4 * radius, center.z + 2.2 * radius), 260, 2.2),
    ]:
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy * radius * radius
        light.size = size
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        bpy.context.collection.objects.link(obj)
        direction = center - mathutils.Vector(loc)
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    cam = bpy.data.cameras.new("camera")
    cam.lens = 60
    cam_obj = bpy.data.objects.new("camera", cam)
    cam_obj.location = (center.x - radius * 1.35, center.y - radius * 2.25, center.z + radius * 0.92)
    bpy.context.collection.objects.link(cam_obj)
    direction = center - mathutils.Vector(cam_obj.location)
    cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam_obj


def export_and_report(objects: list[bpy.types.Object]) -> None:
    mins, maxs = world_bbox(objects)
    dims = maxs - mins
    stats = mesh_stats(objects)
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for obj in objects:
        if obj.name.startswith("collision_proxy"):
            continue
        obj.select_set(True)
    bpy.context.view_layer.objects.active = next(obj for obj in objects if obj.type == "MESH" and not obj.name.startswith("collision_proxy"))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_yup=True,
    )

    report = {
        "schemaVersion": "hp.blenderReport.v1",
        "assetFamily": FAMILY,
        "modelKey": MODEL_KEY,
        "generatedAt": "2026-06-24",
        "generator": "scripts/asset-build/generate-gate-balance-console-glb.py",
        "designPrompt": DESIGN_PROMPT,
        "outputs": {
            "glb": str(OUT_GLB.relative_to(ROOT)),
            "blend": str(OUT_BLEND.relative_to(ROOT)),
            "spec": str(OUT_SPEC.relative_to(ROOT)),
            "render": str(OUT_RENDER.relative_to(ROOT)),
            "screenAtlas": str(SCREEN_ATLAS.relative_to(ROOT)),
            "screenRegions": str(SCREEN_REGIONS.relative_to(ROOT)),
            "overlayLayout": str(OVERLAY_LAYOUT.relative_to(ROOT)),
        },
        "boundsMeters": {
            "min": [round(v, 4) for v in mins],
            "max": [round(v, 4) for v in maxs],
            "size": [round(dims.x, 4), round(dims.y, 4), round(dims.z, 4)],
        },
        "stats": stats,
        "materialSlots": [
            "gb_smoked_titanium_body",
            "gb_black_recess",
            "gb_brushed_steel_trim",
            "gb_old_gold_bus",
            "gb_black_rubber",
            "gb_cyan_glow",
            "gb_gate_safe_glow",
            "gb_gate_warning_glow",
            "gb_terminal_screen_image2_atlas",
        ],
        "runtimeMustNotBake": [
            "localized puzzle title",
            "valve labels and numeric positions",
            "gauge values and target deltas",
            "timer",
            "success/failure state",
            "answer positions",
        ],
    }
    OUT_REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    spec = {
        "schemaVersion": "hp.assetSpec.v1",
        "assetFamily": FAMILY,
        "modelKey": MODEL_KEY,
        "role": "Build Page valve_matrix screen-gate puzzle console",
        "scaleMeters": [round(dims.x, 3), round(dims.z, 3), round(dims.y, 3)],
        "silhouette": [
            "wide cyan screen",
            "three vertical gate inlays",
            "old-gold lower bus rail",
            "right status module",
            "grounded plinth",
        ],
        "materialSlots": report["materialSlots"],
        "textureSources": [str(SCREEN_ATLAS.relative_to(ROOT)), str(SCREEN_REGIONS.relative_to(ROOT))],
        "states": ["idle", "focused", "balanced", "error"],
        "collisionProxy": {
            "type": "box",
            "sizeMeters": [1.46, 1.44, 0.46],
            "notes": "Should block like a compact floor terminal; interaction still uses the generated puzzle terminal interaction radius.",
        },
        "runtimeContent": report["runtimeMustNotBake"],
        "mobileBudget": {
            "targetTriangles": 9000,
            "actualTriangles": stats["triangleCount"],
            "textureAtlas": "1024x1024 PNG embedded in GLB",
        },
        "qaEvidence": [str(OUT_REPORT.relative_to(ROOT)), str(OUT_RENDER.relative_to(ROOT))],
    }
    OUT_SPEC.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def render_evidence() -> None:
    setup_render([obj for obj in bpy.context.scene.objects if obj.type == "MESH"])
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.eevee.taa_render_samples = 64
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
        try:
            scene.eevee.taa_render_samples = 64
        except Exception:
            pass
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = str(OUT_RENDER)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    ensure_dirs()
    clear_scene()
    objects = build_console()
    export_and_report(objects)
    render_evidence()
    print(OUT_GLB.relative_to(ROOT))
    print(OUT_BLEND.relative_to(ROOT))
    print(OUT_SPEC.relative_to(ROOT))
    print(OUT_REPORT.relative_to(ROOT))
    print(OUT_RENDER.relative_to(ROOT))


if __name__ == "__main__":
    main()
