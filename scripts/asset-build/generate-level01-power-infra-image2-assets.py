"""Generate Level 01 maintenance-bay power infrastructure Image2 assets.

Lane B scope: power, pipes, gantry, and robot charging infrastructure.

This script uses one real repo-local Image2 source board as visual evidence,
cuts deterministic fixed rectangles into a texture atlas, records crop
provenance, then builds deterministic Blender GLBs from named low-poly parts.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/asset-build/generate-level01-power-infra-image2-assets.py
"""

import json
import math
from datetime import date
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
FAMILY = "level01-power-infra-image2"
PACK_ID = "hp_level01_power_infra_image2_v1"
SOURCE_TOOL = "level01-power-infra-image2-built-in-image-gen"

TEX_DIR = ROOT / f"src/assets/textures/environment/{FAMILY}"
SOURCE_DIR = TEX_DIR / "image2-sources"
CUT_DIR = SOURCE_DIR / "fixed-rect-cuts"
MODEL_DIR = ROOT / f"src/assets/models-cooked/environment/{FAMILY}"
BLEND_DIR = ROOT / f"src/assets/source_blend/{FAMILY}"
REPORT_DIR = ROOT / "src/assets/manifests/reports"
MANIFEST_PATH = ROOT / f"src/assets/manifests/builder/{PACK_ID}.json"
SOURCE_IMAGE = SOURCE_DIR / "level01_power_infra_reference_board_image2_v1.png"
ATLAS_PNG = TEX_DIR / "hp_level01_power_infra_image2_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level01_power_infra_image2_atlas.regions.json"
PROVENANCE_JSON = REPORT_DIR / "level01_power_infra_image2_source_provenance.json"
PROVENANCE_MD = REPORT_DIR / "level01_power_infra_image2_source_provenance.md"
TEXTURE_REPORT = REPORT_DIR / "level01_power_infra_image2_texture_report.json"
PIPELINE_REPORT = REPORT_DIR / "level01_power_infra_image2_blender_pipeline_report.json"
SOURCE_BLEND = BLEND_DIR / "human_protocol_level01_power_infra_image2_v1.blend"

for directory in (TEX_DIR, SOURCE_DIR, CUT_DIR, MODEL_DIR, BLEND_DIR, REPORT_DIR, MANIFEST_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)

ATLAS_SIZE = 1024

# Source image dimensions are asserted at runtime. Rects are fixed, top-left
# origin, and intentionally partition the 1254px Image2 board into five columns.
SOURCE_RECTS = {
    "battery.column": [0, 0, 250, 1254],
    "breaker.column": [250, 0, 251, 1254],
    "valve.column": [501, 0, 251, 1254],
    "gantry.column": [752, 0, 251, 1254],
    "docking.column": [1003, 0, 251, 1254],
    "dark.steel": [64, 760, 170, 210],
    "white.panel": [292, 235, 170, 210],
    "hazard.stripe": [1008, 422, 205, 100],
    "cyan.diagnostic": [185, 350, 110, 135],
    "red.fault": [1130, 525, 90, 90],
    "rubber.cable": [642, 305, 220, 135],
    "pipe.metal": [540, 515, 260, 120],
    "edge.wear": [78, 1025, 395, 105],
    "panel.grime": [786, 750, 330, 130],
    "socket.plate": [1042, 720, 165, 150],
}

ATLAS_REGIONS_DEF = {
    "battery.column": {"atlas": [0, 0, 192, 512], "source": SOURCE_RECTS["battery.column"]},
    "breaker.column": {"atlas": [192, 0, 192, 512], "source": SOURCE_RECTS["breaker.column"]},
    "valve.column": {"atlas": [384, 0, 192, 512], "source": SOURCE_RECTS["valve.column"]},
    "gantry.column": {"atlas": [576, 0, 192, 512], "source": SOURCE_RECTS["gantry.column"]},
    "docking.column": {"atlas": [768, 0, 192, 512], "source": SOURCE_RECTS["docking.column"]},
    "dark.steel": {"atlas": [0, 512, 256, 256], "source": SOURCE_RECTS["dark.steel"]},
    "white.panel": {"atlas": [256, 512, 256, 256], "source": SOURCE_RECTS["white.panel"]},
    "hazard.stripe": {"atlas": [512, 512, 256, 128], "source": SOURCE_RECTS["hazard.stripe"]},
    "cyan.diagnostic": {"atlas": [768, 512, 128, 128], "source": SOURCE_RECTS["cyan.diagnostic"]},
    "red.fault": {"atlas": [896, 512, 128, 128], "source": SOURCE_RECTS["red.fault"]},
    "rubber.cable": {"atlas": [512, 640, 256, 128], "source": SOURCE_RECTS["rubber.cable"]},
    "pipe.metal": {"atlas": [768, 640, 256, 128], "source": SOURCE_RECTS["pipe.metal"]},
    "edge.wear": {"atlas": [0, 768, 512, 128], "source": SOURCE_RECTS["edge.wear"]},
    "panel.grime": {"atlas": [512, 768, 512, 128], "source": SOURCE_RECTS["panel.grime"]},
    "socket.plate": {"atlas": [0, 896, 256, 128], "source": SOURCE_RECTS["socket.plate"]},
}

MODEL_KEYS = [
    "room_l1_img2_battery_charging_rack",
    "room_l1_img2_breaker_pylon",
    "room_l1_img2_valve_manifold_wall",
    "room_l1_img2_overhead_rail_gantry",
    "room_l1_img2_robot_docking_post",
]

META = {
    "room_l1_img2_battery_charging_rack": dict(
        label="电池充电架", family="cabinet", footprint="cabinet", mount="floor", wall="back", solid=True, hold=False, clue=1, role="power"
    ),
    "room_l1_img2_breaker_pylon": dict(
        label="高压断路器柱", family="control_console", footprint="column", mount="floor", wall="none", solid=True, hold=False, clue=1, role="power"
    ),
    "room_l1_img2_valve_manifold_wall": dict(
        label="管线阀门歧管墙", family="wall_panel_or_picture_frame", footprint="wall_panel", mount="wall", wall="back", solid=False, hold=False, clue=2, role="pipes"
    ),
    "room_l1_img2_overhead_rail_gantry": dict(
        label="顶轨吊装小龙门", family="storage_crate", footprint="barrier", mount="floor", wall="none", solid=True, hold=False, clue=0, role="gantry"
    ),
    "room_l1_img2_robot_docking_post": dict(
        label="机器人停靠桩", family="control_console", footprint="column", mount="floor", wall="none", solid=True, hold=False, clue=1, role="robot"
    ),
}

ATLAS_IMG = None


def rel(path):
    return path.relative_to(ROOT).as_posix()


def load_source_top_down():
    if not SOURCE_IMAGE.exists():
        raise FileNotFoundError(f"Image2 source missing: {SOURCE_IMAGE}")
    image = bpy.data.images.load(str(SOURCE_IMAGE), check_existing=False)
    width, height = image.size
    if (width, height) != (1254, 1254):
        raise ValueError(f"expected 1254x1254 Image2 board, got {width}x{height}")
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape((height, width, 4))
    return np.flipud(pixels), (width, height)


def save_png(array_top_down, path, name):
    h, w, _ = array_top_down.shape
    image = bpy.data.images.new(name, width=w, height=h, alpha=True, float_buffer=False)
    image.pixels.foreach_set(np.flipud(np.clip(array_top_down, 0, 1)).astype(np.float32).reshape(-1))
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def resize_nearest(tile, out_h, out_w):
    h, w, _ = tile.shape
    ys = np.minimum((np.arange(out_h) * h / out_h).astype(np.int32), h - 1)
    xs = np.minimum((np.arange(out_w) * w / out_w).astype(np.int32), w - 1)
    return tile[ys[:, None], xs[None, :], :]


def build_atlas():
    source, source_size = load_source_top_down()
    atlas = np.zeros((ATLAS_SIZE, ATLAS_SIZE, 4), dtype=np.float32)
    atlas[..., :3] = 0.06
    atlas[..., 3] = 1.0
    regions = {}
    mappings = {}

    for region_id, spec in ATLAS_REGIONS_DEF.items():
        sx, sy, sw, sh = spec["source"]
        ax, ay, aw, ah = spec["atlas"]
        crop = source[sy : sy + sh, sx : sx + sw, :]
        fitted = resize_nearest(crop, ah, aw)
        atlas[ay : ay + ah, ax : ax + aw, :] = fitted
        regions[region_id] = [ax, ay, aw, ah]
        mappings[region_id] = {
            "sourceImage": rel(SOURCE_IMAGE),
            "sourceRect": [sx, sy, sw, sh],
            "atlasRect": [ax, ay, aw, ah],
            "resample": "nearest",
        }
        save_png(fitted, CUT_DIR / f"{region_id.replace('.', '_')}.png", f"hp_l1_power_cut_{region_id}")

    save_png(atlas, ATLAS_PNG, "hp_level01_power_infra_image2_atlas")
    ATLAS_REGIONS.write_text(
        json.dumps(
            {
                "atlas": rel(ATLAS_PNG),
                "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
                "uvOrigin": "top-left",
                "sourceImageSize": list(source_size),
                "regions": regions,
                "sourceMappings": mappings,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    img = bpy.data.images.load(str(ATLAS_PNG), check_existing=False)
    img.name = "hp_level01_power_infra_image2_atlas"
    return img, mappings


def uv_rect(region_id, padding=1.0):
    x, y, w, h = ATLAS_REGIONS_DEF[region_id]["atlas"]
    u0 = (x + padding) / ATLAS_SIZE
    u1 = (x + w - padding) / ATLAS_SIZE
    v0 = 1.0 - (y + h - padding) / ATLAS_SIZE
    v1 = 1.0 - (y + padding) / ATLAS_SIZE
    return u0, v0, u1, v1


def bsdf_input(bsdf, name):
    for socket in bsdf.inputs:
        if socket.name == name or socket.identifier == name:
            return socket
    raise KeyError(name)


def mat(name, color, metallic=0.0, roughness=0.55, emission=None, strength=0.0, region=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    bsdf = next(node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf_input(bsdf, "Base Color").default_value = color
    bsdf_input(bsdf, "Metallic").default_value = metallic
    bsdf_input(bsdf, "Roughness").default_value = roughness
    if region:
        tex = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = ATLAS_IMG
        tex.extension = "CLIP"
        material.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Base Color"))
        material["hp_atlas_region"] = region
    if emission is not None:
        bsdf_input(bsdf, "Emission Color").default_value = emission
        bsdf_input(bsdf, "Emission Strength").default_value = strength
    return material


def make_materials():
    return {
        "dark": mat("l1_power_dark_steel_atlas", (0.08, 0.09, 0.1, 1), 0.8, 0.42, region="dark.steel"),
        "white": mat("l1_power_white_panel_atlas", (0.78, 0.8, 0.78, 1), 0.25, 0.48, region="white.panel"),
        "hazard": mat("l1_power_hazard_atlas", (0.9, 0.55, 0.08, 1), 0.25, 0.5, region="hazard.stripe"),
        "cyan": mat("l1_power_cyan_diag_atlas", (0.12, 0.75, 0.88, 1), 0.0, 0.18, emission=(0.1, 0.9, 1.0, 1), strength=1.9, region="cyan.diagnostic"),
        "red": mat("l1_power_red_fault_atlas", (0.9, 0.08, 0.04, 1), 0.0, 0.25, emission=(1.0, 0.06, 0.02, 1), strength=1.7, region="red.fault"),
        "rubber": mat("l1_power_rubber_cable_atlas", (0.035, 0.04, 0.045, 1), 0.05, 0.82, region="rubber.cable"),
        "pipe": mat("l1_power_pipe_metal_atlas", (0.42, 0.45, 0.46, 1), 0.85, 0.36, region="pipe.metal"),
        "wear": mat("l1_power_edge_wear_atlas", (0.48, 0.49, 0.48, 1), 0.65, 0.42, region="edge.wear"),
        "grime": mat("l1_power_panel_grime_atlas", (0.42, 0.43, 0.42, 1), 0.35, 0.72, region="panel.grime"),
        "socket": mat("l1_power_socket_plate_atlas", (0.16, 0.17, 0.18, 1), 0.5, 0.5, region="socket.plate"),
        "battery": mat("l1_power_battery_reference_atlas", (0.38, 0.42, 0.42, 1), 0.5, 0.46, region="battery.column"),
        "breaker": mat("l1_power_breaker_reference_atlas", (0.34, 0.36, 0.38, 1), 0.55, 0.44, region="breaker.column"),
        "valve": mat("l1_power_valve_reference_atlas", (0.35, 0.38, 0.38, 1), 0.65, 0.38, region="valve.column"),
        "gantry": mat("l1_power_gantry_reference_atlas", (0.34, 0.35, 0.35, 1), 0.75, 0.36, region="gantry.column"),
        "dock": mat("l1_power_docking_reference_atlas", (0.28, 0.3, 0.31, 1), 0.6, 0.42, region="docking.column"),
        "solid_dark": mat("l1_power_solid_dark", (0.05, 0.06, 0.07, 1), 0.55, 0.5),
        "solid_pipe": mat("l1_power_solid_pipe", (0.36, 0.38, 0.39, 1), 0.85, 0.34),
    }


def map_uvs(obj, region_id):
    u0, v0, u1, v1 = uv_rect(region_id)
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name="atlas")
    uvl = obj.data.uv_layers.active.data
    corners = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    for poly in obj.data.polygons:
        for index, loop_index in enumerate(poly.loop_indices):
            uvl[loop_index].uv = corners[index % 4]


def finish(obj, material, bevel=0.0):
    if material:
        obj.data.materials.append(material)
        region = material.get("hp_atlas_region")
        if region:
            map_uvs(obj, region)
    if bevel > 0:
        bevel_mod = obj.modifiers.new(name="hp_bevel", type="BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 2
        bevel_mod.affect = "EDGES"
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")


def root_node(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def cube(name, loc, scale, material, parent, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, material, bevel)
    obj.parent = parent
    return obj


def cyl(name, loc, radius, depth, material, parent, verts=24, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    finish(obj, material, bevel)
    obj.parent = parent
    return obj


def torus(name, loc, major, minor, material, parent, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=8, major_radius=major, minor_radius=minor, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    finish(obj, material, 0.0)
    obj.parent = parent
    return obj


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def ground_root(root):
    deps = bpy.context.evaluated_depsgraph_get()
    children = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and (obj == root or obj.parent == root)]
    z_values = []
    for obj in children:
        ev = obj.evaluated_get(deps)
        mesh = ev.to_mesh()
        z_values.extend([(ev.matrix_world @ v.co).z for v in mesh.vertices])
        ev.to_mesh_clear()
    if not z_values:
        return
    shift = -min(z_values)
    for obj in children:
        obj.location.z += shift
    bpy.ops.object.select_all(action="DESELECT")
    for obj in children:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def measure_bounds(root):
    deps = bpy.context.evaluated_depsgraph_get()
    mins = [math.inf, math.inf, math.inf]
    maxs = [-math.inf, -math.inf, -math.inf]
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not (obj == root or obj.parent == root):
            continue
        ev = obj.evaluated_get(deps)
        mesh = ev.to_mesh()
        for vert in mesh.vertices:
            world = ev.matrix_world @ vert.co
            for axis in range(3):
                mins[axis] = min(mins[axis], world[axis])
                maxs[axis] = max(maxs[axis], world[axis])
        ev.to_mesh_clear()
    return [round(maxs[0] - mins[0], 3), round(maxs[2] - mins[2], 3), round(maxs[1] - mins[1], 3)]


def export_glb(root, model_key):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj == root or obj.parent == root:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = MODEL_DIR / f"{model_key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    return path


def add_status_lamps(root, mats, positions, radius=0.035):
    for index, loc in enumerate(positions):
        cyl(f"cyan_status_lamp_{index}", loc, radius, 0.025, mats["cyan"], root, 20, rot=(math.pi / 2, 0, 0), bevel=radius * 0.08)


def build_battery_charging_rack(key, mats):
    root = root_node(key)
    w, d, h = 1.45, 0.62, 1.65
    cube("grounded_shadow_base", (0, 0, 0.06), (w * 0.95, d * 0.96, 0.12), mats["solid_dark"], root, 0.02)
    for sx in (-0.62, 0.62):
        for sy in (-0.24, 0.24):
            cyl("upright_dark_steel_post", (sx, sy, h * 0.48), 0.035, h * 0.9, mats["dark"], root, 16, bevel=0.006)
    for z in (0.34, 0.82, 1.30):
        cube(f"shelf_white_power_bus_{z:.1f}", (0, 0, z), (w, d, 0.07), mats["white"], root, 0.014)
        cube(f"rear_cable_tray_{z:.1f}", (0, d * 0.43, z + 0.1), (w * 0.92, 0.06, 0.16), mats["rubber"], root, 0.008)
        for x in (-0.42, 0, 0.42):
            cube(f"battery_pack_{z:.1f}_{x:.1f}", (x, -0.07, z + 0.16), (0.28, 0.34, 0.28), mats["battery"], root, 0.018)
            cube(f"battery_socket_{z:.1f}_{x:.1f}", (x, -0.285, z + 0.16), (0.2, 0.028, 0.14), mats["socket"], root, 0.006)
    cube("top_charger_header_screen", (-0.34, -0.32, 1.58), (0.54, 0.026, 0.18), mats["cyan"], root, 0.006)
    cube("front_hazard_toe_strip", (0, -0.33, 0.15), (w * 0.84, 0.024, 0.06), mats["hazard"], root, 0.003)
    cube("tiny_red_fault_point", (0.56, -0.335, 1.55), (0.045, 0.03, 0.045), mats["red"], root, 0.004)
    add_status_lamps(root, mats, [(-0.58, -0.34, 0.78), (0.58, -0.34, 1.26)])
    return root


def build_breaker_pylon(key, mats):
    root = root_node(key)
    cube("octagonal_floor_plinth", (0, 0, 0.08), (0.8, 0.72, 0.16), mats["dark"], root, 0.025)
    cube("tall_breaker_spine", (0, 0, 0.92), (0.58, 0.48, 1.65), mats["breaker"], root, 0.026)
    cube("white_service_face", (0, -0.255, 1.0), (0.45, 0.035, 1.22), mats["white"], root, 0.012)
    for index, z in enumerate((0.48, 0.76, 1.04, 1.32)):
        cube(f"breaker_slot_{index}", (0, -0.285, z), (0.34, 0.035, 0.12), mats["socket"], root, 0.006)
        cyl(f"breaker_pull_handle_{index}", (-0.12 + index * 0.08, -0.33, z), 0.018, 0.28, mats["pipe"], root, 12, rot=(0, math.pi / 2, 0), bevel=0.003)
    cube("high_voltage_warning_band", (0, -0.295, 1.63), (0.5, 0.03, 0.08), mats["hazard"], root, 0.004)
    cube("base_hazard_band", (0, -0.295, 0.24), (0.55, 0.03, 0.07), mats["hazard"], root, 0.004)
    add_status_lamps(root, mats, [(0.2, -0.315, 1.51), (0.2, -0.315, 0.36)], radius=0.032)
    cube("red_fault_window", (-0.21, -0.318, 1.51), (0.05, 0.03, 0.05), mats["red"], root, 0.004)
    for sx in (-0.34, 0.34):
        cyl("side_bus_pipe", (sx, 0.0, 0.92), 0.026, 1.42, mats["pipe"], root, 16, bevel=0.004)
    return root


def build_valve_manifold_wall(key, mats):
    root = root_node(key)
    w, h = 1.75, 1.22
    cube("wall_backing_grimy_panel", (0, 0.02, h * 0.5), (w, 0.08, h), mats["grime"], root, 0.016)
    cube("upper_white_access_plate", (-0.42, -0.035, 0.98), (0.58, 0.035, 0.28), mats["white"], root, 0.008)
    for index, z in enumerate((0.36, 0.62, 0.86)):
        cyl(f"horizontal_pipe_run_{index}", (0, -0.06, z), 0.035, w * 0.86, mats["pipe"], root, 24, rot=(0, math.pi / 2, 0), bevel=0.004)
    for index, x in enumerate((-0.56, 0.0, 0.56)):
        cyl(f"vertical_manifold_drop_{index}", (x, -0.06, 0.62), 0.03, 0.82, mats["pipe"], root, 24, bevel=0.004)
        torus(f"valve_handwheel_{index}", (x, -0.115, 0.62), 0.105, 0.011, mats["hazard"], root, rot=(math.pi / 2, 0, 0))
        cyl(f"valve_hub_{index}", (x, -0.13, 0.62), 0.035, 0.025, mats["dark"], root, 18, rot=(math.pi / 2, 0, 0), bevel=0.002)
    cube("cyan_pressure_readout", (0.56, -0.06, 1.03), (0.34, 0.024, 0.16), mats["cyan"], root, 0.006)
    cube("red_pressure_fault_led", (0.78, -0.065, 0.91), (0.04, 0.026, 0.04), mats["red"], root, 0.003)
    cube("lower_hazard_pipe_label", (0, -0.066, 0.16), (w * 0.74, 0.022, 0.052), mats["hazard"], root, 0.003)
    return root


def build_overhead_rail_gantry(key, mats):
    root = root_node(key)
    w, d, h = 2.25, 0.82, 2.05
    for sx in (-0.92, 0.92):
        cube("gantry_foot_plate", (sx, 0, 0.05), (0.36, d, 0.1), mats["dark"], root, 0.018)
        for sy in (-0.28, 0.28):
            cyl("gantry_upright_post", (sx, sy, h * 0.45), 0.035, h * 0.9, mats["gantry"], root, 18, bevel=0.006)
    cube("overhead_i_beam_top", (0, 0, h), (w, 0.16, 0.16), mats["gantry"], root, 0.012)
    cube("underslung_rail_track", (0, 0, h - 0.15), (w * 0.82, 0.08, 0.07), mats["pipe"], root, 0.006)
    cube("sliding_hoist_carriage", (-0.2, 0, h - 0.29), (0.28, 0.26, 0.16), mats["white"], root, 0.01)
    cyl("short_lift_chain", (-0.2, 0, h - 0.58), 0.012, 0.46, mats["rubber"], root, 10, bevel=0.002)
    torus("load_hook_loop", (-0.2, 0, h - 0.82), 0.08, 0.012, mats["hazard"], root, rot=(0, math.pi / 2, 0))
    cube("operator_status_screen", (0.92, -0.44, 1.28), (0.24, 0.028, 0.14), mats["cyan"], root, 0.005)
    cube("left_hazard_leg_band", (-0.92, -0.44, 0.32), (0.28, 0.026, 0.06), mats["hazard"], root, 0.004)
    cube("right_hazard_leg_band", (0.92, -0.44, 0.32), (0.28, 0.026, 0.06), mats["hazard"], root, 0.004)
    cube("tiny_red_limit_led", (0.69, -0.44, 1.28), (0.035, 0.028, 0.035), mats["red"], root, 0.003)
    return root


def build_robot_docking_post(key, mats):
    root = root_node(key)
    cube("round_docking_base_proxy", (0, 0, 0.08), (0.82, 0.82, 0.16), mats["dark"], root, 0.025)
    cyl("central_robot_dock_column", (0, 0, 0.82), 0.22, 1.42, mats["dock"], root, 32, bevel=0.01)
    cube("front_socket_plate", (0, -0.23, 0.82), (0.34, 0.04, 0.66), mats["socket"], root, 0.01)
    for z in (0.55, 0.82, 1.09):
        cyl(f"charging_contact_socket_{z:.2f}", (0, -0.275, z), 0.052, 0.03, mats["cyan"], root, 20, rot=(math.pi / 2, 0, 0), bevel=0.004)
    for sx in (-0.38, 0.38):
        cube("robot_alignment_arm", (sx, -0.02, 0.82), (0.18, 0.1, 0.62), mats["white"], root, 0.012)
        cyl("rubber_bumper_cap", (sx, -0.31, 0.82), 0.055, 0.12, mats["rubber"], root, 18, rot=(math.pi / 2, 0, 0), bevel=0.004)
    cube("docking_status_screen", (0, -0.245, 1.43), (0.28, 0.03, 0.12), mats["cyan"], root, 0.006)
    cube("base_hazard_ring_front", (0, -0.43, 0.2), (0.58, 0.024, 0.055), mats["hazard"], root, 0.003)
    cube("red_failed_dock_led", (0.23, -0.26, 1.42), (0.035, 0.026, 0.035), mats["red"], root, 0.003)
    return root


BUILDERS = {
    "room_l1_img2_battery_charging_rack": build_battery_charging_rack,
    "room_l1_img2_breaker_pylon": build_breaker_pylon,
    "room_l1_img2_valve_manifold_wall": build_valve_manifold_wall,
    "room_l1_img2_overhead_rail_gantry": build_overhead_rail_gantry,
    "room_l1_img2_robot_docking_post": build_robot_docking_post,
}


def build_manifest(size_rows):
    assets = []
    for model_key in MODEL_KEYS:
        meta = META[model_key]
        assets.append(
            {
                "modelKey": model_key,
                "label": meta["label"],
                "assetKind": "furniture",
                "family": meta["family"],
                "group": "维修",
                "source": SOURCE_TOOL,
                "sourceAssetId": f"hp_{model_key}_v1",
                "themeId": "hp_level01_power_infra_image2",
                "glbFile": f"../../models-cooked/environment/{FAMILY}/{model_key}.glb",
                "sizeMeters": size_rows[model_key],
                "solid": meta["solid"],
                "mount": meta["mount"],
                "wallPreferred": meta["wall"],
                "canHoldSmallProps": meta["hold"],
                "clueCapacity": meta["clue"],
                "footprintFamily": meta["footprint"],
                "tags": [
                    "lane:level01-power-infra-image2-b",
                    f"role:{meta['role']}",
                    "style:hp-level01-maintenance",
                    "source:image2",
                ],
            }
        )
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP 维护舱电力管线基础设施 (Image2)",
        "sourceTool": SOURCE_TOOL,
        "generatedAt": "2026-06-20",
        "atlas": rel(ATLAS_PNG),
        "assets": assets,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_reports(crop_mappings, generated_rows):
    prompt = (
        "A no-text orthographic contact-sheet style Image2 board for Human Protocol Level 1 maintenance bay "
        "industrial power, pipe, gantry, and robot docking infrastructure: dark gunmetal steel, white maintenance "
        "panels, yellow-black hazard striping, cyan diagnostic lights, red fault LEDs, rubber cable bundles, "
        "valves, conduit clamps, bolted plates, and worn industrial surfaces."
    )
    provenance = {
        "assetPack": PACK_ID,
        "licenseLabel": "owned-generated-output",
        "sourceTool": "built-in image_gen",
        "sourceToolCallId": "not-exposed-by-built-in-image-gen",
        "generatingAccount": "current Codex desktop user",
        "generationDate": "2026-06-20",
        "sourceImages": [rel(SOURCE_IMAGE)],
        "prompt": prompt,
        "atlas": rel(ATLAS_PNG),
        "regions": rel(ATLAS_REGIONS),
        "cropMappings": crop_mappings,
        "derivativeOutputs": [rel(MANIFEST_PATH), rel(ATLAS_PNG), rel(ATLAS_REGIONS)]
        + [rel(MODEL_DIR / f"{key}.glb") for key in MODEL_KEYS],
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROVENANCE_MD.write_text(
        "\n".join(
            [
                "# Level01 Power Infra Image2 Source Provenance",
                "",
                f"- Asset pack: `{PACK_ID}`",
                "- License label: `owned-generated-output`",
                "- Source tool: built-in `image_gen`",
                "- Tool call id: `not-exposed-by-built-in-image-gen`",
                "- Generation date: `2026-06-20`",
                f"- Source image: `{rel(SOURCE_IMAGE)}`",
                f"- Atlas: `{rel(ATLAS_PNG)}`",
                f"- Regions JSON: `{rel(ATLAS_REGIONS)}`",
                "",
                "## Prompt",
                "",
                prompt,
                "",
                "## Fixed Crop Rectangles",
                "",
                "All rectangles use top-left pixel origin `[x, y, w, h]` from the 1254x1254 Image2 board.",
                "",
                json.dumps({k: v["sourceRect"] for k, v in crop_mappings.items()}, indent=2),
                "",
            ]
        ),
        encoding="utf-8",
    )
    TEXTURE_REPORT.write_text(
        json.dumps(
            {
                "assetPack": PACK_ID,
                "sourceImage": rel(SOURCE_IMAGE),
                "atlas": rel(ATLAS_PNG),
                "regions": rel(ATLAS_REGIONS),
                "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
                "regionCount": len(ATLAS_REGIONS_DEF),
                "sourceMappingCount": len(crop_mappings),
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    PIPELINE_REPORT.write_text(
        json.dumps(
            {
                "assetPack": PACK_ID,
                "script": rel(Path(__file__)),
                "sourceBlend": rel(SOURCE_BLEND),
                "generatedAssets": generated_rows,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def save_source_blend():
    clear_scene()
    spacing = 2.65
    for index, model_key in enumerate(MODEL_KEYS):
        mats = make_materials()
        root = BUILDERS[model_key](model_key, mats)
        ground_root(root)
        for obj in bpy.context.scene.objects:
            if obj == root or obj.parent == root:
                obj.location.x += (index - 2) * spacing
    camera_data = bpy.data.cameras.new("source_blend_camera")
    camera = bpy.data.objects.new("source_blend_camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (4.8, -7.2, 4.6)
    direction = Vector((0, 0, 0.9)) - Vector(camera.location)
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 7.0
    bpy.context.scene.camera = camera
    light_data = bpy.data.lights.new("source_blend_area_light", type="AREA")
    light_data.energy = 500
    light_data.size = 7
    light = bpy.data.objects.new("source_blend_area_light", light_data)
    light.location = (-2.5, -3.5, 5.0)
    bpy.context.collection.objects.link(light)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))


def main():
    global ATLAS_IMG
    clear_scene()
    ATLAS_IMG, crop_mappings = build_atlas()
    print(f"[image2] source={rel(SOURCE_IMAGE)}")
    print(f"[atlas] wrote {rel(ATLAS_PNG)} regions={len(ATLAS_REGIONS_DEF)}")

    sizes = {}
    generated_rows = []
    for model_key in MODEL_KEYS:
        clear_scene()
        mats = make_materials()
        root = BUILDERS[model_key](model_key, mats)
        ground_root(root)
        size = measure_bounds(root)
        glb_path = export_glb(root, model_key)
        sizes[model_key] = size
        generated_rows.append({"modelKey": model_key, "glb": rel(glb_path), "sizeMeters": size, "bytes": glb_path.stat().st_size})
        print(f"[glb] {model_key} size={size} bytes={glb_path.stat().st_size}")

    manifest = build_manifest(sizes)
    save_source_blend()
    write_reports(crop_mappings, generated_rows)
    print(f"[manifest] wrote {rel(MANIFEST_PATH)} assets={len(manifest['assets'])}")
    print(f"[blend] wrote {rel(SOURCE_BLEND)}")
    print(f"[provenance] wrote {rel(PROVENANCE_JSON)}")


if __name__ == "__main__":
    main()
