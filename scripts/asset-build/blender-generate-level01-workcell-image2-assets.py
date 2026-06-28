#!/usr/bin/env python3
"""Deterministic Blender GLB generator for Level 01 workcell Image2 Lane A.

Run with Blender, not plain Python:

  /Applications/Blender.app/Contents/MacOS/Blender -b --python \
    scripts/asset-build/blender-generate-level01-workcell-image2-assets.py

The generated GLBs are script-built geometry. Image2 is used as the recorded
material/reference source via the atlas emitted by
generate-level01-workcell-image2-textures.py.
"""

from __future__ import annotations

import json
import math
from datetime import date
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level01-workcell-image2"
ATLAS_PATH = TEXTURE_DIR / "hp_level01_workcell_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_level01_workcell_image2_atlas.regions.json"
MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level01-workcell-image2"
SOURCE_DIR = ROOT / "src/assets/source_blend/level01-workcell-image2"
MANIFEST_PATH = ROOT / "src/assets/manifests/builder/hp_level01_workcell_image2_v1.json"
REPORT_PATH = ROOT / "src/assets/manifests/reports/level01_workcell_image2_blender_pipeline_report.json"
SOURCE_BLEND = SOURCE_DIR / "human_protocol_level01_workcell_image2_lane_a.blend"

for directory in (MODEL_DIR, SOURCE_DIR, REPORT_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)

REGION_DOC = json.loads(REGIONS_PATH.read_text(encoding="utf-8")) if REGIONS_PATH.exists() else {"regions": {}, "atlasSize": [1, 1]}


ASSETS = [
    ("room_l1_img2_mobile_repair_cart", [1.12, 0.98, 0.72]),
    ("room_l1_img2_hydraulic_lift_table", [2.25, 0.86, 1.02]),
    ("room_l1_img2_wall_tool_board", [1.62, 1.02, 0.12]),
    ("room_l1_img2_prosthetic_parts_cabinet", [1.36, 1.62, 0.58]),
    ("room_l1_img2_sterile_wash_basin", [1.45, 1.02, 0.62]),
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def bsdf_input(bsdf, name: str):
    for socket in bsdf.inputs:
        if socket.name == name or socket.identifier == name:
            return socket
    raise KeyError(name)


def make_mat(name, color, roughness=0.72, metallic=0.0, alpha=1.0, emission=None, strength=0.0, region=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    material["hp_image2_atlas"] = rel(ATLAS_PATH)
    if region:
        material["hp_image2_region"] = region
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf_input(bsdf, "Base Color").default_value = color
        bsdf_input(bsdf, "Roughness").default_value = roughness
        bsdf_input(bsdf, "Metallic").default_value = metallic
        bsdf_input(bsdf, "Alpha").default_value = alpha
        if emission:
            bsdf_input(bsdf, "Emission Color").default_value = emission
            bsdf_input(bsdf, "Emission Strength").default_value = strength
        if region and ATLAS_PATH.exists() and region in REGION_DOC.get("regions", {}):
            atlas_image = bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
            atlas_w, atlas_h = REGION_DOC.get("atlasSize", [1, 1])
            x, y, w, h = REGION_DOC["regions"][region]["atlasRect"]
            texcoord = material.node_tree.nodes.new("ShaderNodeTexCoord")
            mapping = material.node_tree.nodes.new("ShaderNodeMapping")
            texture = material.node_tree.nodes.new("ShaderNodeTexImage")
            texture.name = f"hp_image2_{region}"
            texture.image = atlas_image
            texture.extension = "CLIP"
            texture.interpolation = "Smart"
            mapping.inputs["Location"].default_value[0] = x / atlas_w
            mapping.inputs["Location"].default_value[1] = 1.0 - ((y + h) / atlas_h)
            mapping.inputs["Scale"].default_value[0] = w / atlas_w
            mapping.inputs["Scale"].default_value[1] = h / atlas_h
            material.node_tree.links.new(texcoord.outputs["UV"], mapping.inputs["Vector"])
            material.node_tree.links.new(mapping.outputs["Vector"], texture.inputs["Vector"])
            material.node_tree.links.new(texture.outputs["Color"], bsdf_input(bsdf, "Base Color"))
            material["hp_image2_atlas_rect"] = REGION_DOC["regions"][region]["atlasRect"]
            material["hp_image2_source_rect"] = REGION_DOC["regions"][region]["sourceRect"]
    return material


def build_materials():
    if ATLAS_PATH.exists():
        bpy.data.images.load(str(ATLAS_PATH), check_existing=True)
    return {
        "dark": make_mat("l1_workcell_image2_dark_powdercoat", (0.09, 0.095, 0.10, 1), 0.78, 0.45, region="cart_dark_powdercoat"),
        "black": make_mat("l1_workcell_image2_worn_black_panel", (0.035, 0.038, 0.042, 1), 0.82, 0.35, region="worn_black_panel"),
        "steel": make_mat("l1_workcell_image2_brushed_steel", (0.55, 0.54, 0.50, 1), 0.42, 0.85, region="brushed_steel"),
        "white": make_mat("l1_workcell_image2_off_white_enamel", (0.78, 0.75, 0.68, 1), 0.66, 0.12, region="lift_white_enamel"),
        "scuffed_white": make_mat("l1_workcell_image2_scuffed_white_panel", (0.64, 0.61, 0.55, 1), 0.74, 0.18, region="lift_scuffed_white"),
        "yellow": make_mat("l1_workcell_image2_safety_yellow", (0.92, 0.62, 0.06, 1), 0.78, 0.12, region="safety_yellow"),
        "hazard": make_mat("l1_workcell_image2_hazard_stripe", (0.74, 0.52, 0.08, 1), 0.78, 0.12, region="hazard_stripe"),
        "peg": make_mat("l1_workcell_image2_pegboard", (0.72, 0.69, 0.62, 1), 0.8, 0.1, region="tool_pegboard"),
        "cyan": make_mat("l1_workcell_image2_cyan_diagnostic_glass", (0.05, 0.72, 0.86, 1), 0.32, 0.0, alpha=0.78, emission=(0.0, 0.55, 0.75, 1), strength=0.18, region="cyan_diagnostic_glass"),
        "basin": make_mat("l1_workcell_image2_stainless_basin", (0.58, 0.57, 0.53, 1), 0.36, 0.92, region="stainless_basin"),
        "rubber": make_mat("l1_workcell_image2_rubber_wheel_tread", (0.02, 0.02, 0.018, 1), 0.9, 0.0, region="rubber_wheel_tread"),
    }


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.collections):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def set_scene_units():
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    available = {item.identifier for item in bpy.context.scene.render.bl_rna.properties["engine"].enum_items}
    if "BLENDER_EEVEE_NEXT" in available:
        bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    elif "BLENDER_EEVEE" in available:
        bpy.context.scene.render.engine = "BLENDER_EEVEE"


def finish_object(obj, bevel=0.012, segments=2, weighted=True):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new("hp_bevel_meter_edges", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.affect = "EDGES"
    if weighted:
        obj.modifiers.new("hp_weighted_normals", "WEIGHTED_NORMAL")
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    obj.select_set(False)
    return obj


def root_for(model_key):
    root = bpy.data.objects.new(model_key, None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.25
    root["modelKey"] = model_key
    root["unitScale"] = "meters"
    bpy.context.collection.objects.link(root)
    return root


def cube(name, dims, loc, mat, parent=None, rot=(0, 0, 0), bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return finish_object(obj, bevel=bevel)


def cyl(name, radius, depth, loc, mat, parent=None, rot=(0, 0, 0), vertices=32, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return finish_object(obj, bevel=bevel, segments=1)


def sphere(name, radius, loc, mat, parent=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return finish_object(obj, bevel=0.0)


def add_hazard_tabs(root, mats, x_span, y, z, count=3):
    step = x_span / max(1, count)
    for index in range(count):
        x = -x_span / 2 + step * (index + 0.5)
        cube(f"{root.name}_hazard_tab_{index+1}", (step * 0.62, 0.018, 0.045), (x, y, z), mats["hazard"], root, bevel=0.004)


def build_mobile_repair_cart(root, mats):
    cube("cart_main_drawer_bank", (0.92, 0.52, 0.58), (0, 0, 0.46), mats["dark"], root, bevel=0.025)
    cube("cart_recessed_side_panel_left", (0.045, 0.46, 0.44), (-0.49, 0, 0.47), mats["black"], root, bevel=0.01)
    cube("cart_top_rubber_mat", (0.96, 0.56, 0.07), (0, 0, 0.79), mats["rubber"], root, bevel=0.018)
    cube("cart_top_lip_front", (1.04, 0.045, 0.12), (0, -0.31, 0.84), mats["steel"], root, bevel=0.014)
    cube("cart_top_lip_back", (1.04, 0.045, 0.12), (0, 0.31, 0.84), mats["steel"], root, bevel=0.014)
    for index, z in enumerate([0.65, 0.52, 0.39, 0.26]):
        cube(f"cart_drawer_front_{index+1}", (0.76, 0.035, 0.085), (0, -0.285, z), mats["black"], root, bevel=0.008)
        cube(f"cart_drawer_pull_{index+1}", (0.46, 0.022, 0.018), (0, -0.31, z + 0.015), mats["steel"], root, bevel=0.004)
    cube("cart_yellow_side_access_plate", (0.05, 0.22, 0.34), (0.505, -0.05, 0.48), mats["yellow"], root, bevel=0.01)
    cube("cart_cyan_status_window", (0.26, 0.018, 0.035), (0, -0.315, 0.74), mats["cyan"], root, bevel=0.004)
    for ix in [-0.38, 0.38]:
        for iy in [-0.24, 0.24]:
            cyl(f"cart_rubber_caster_{ix}_{iy}", 0.095, 0.065, (ix, iy, 0.105), mats["rubber"], root, rot=(math.pi / 2, 0, 0), vertices=28)
            cyl(f"cart_steel_caster_fork_{ix}_{iy}", 0.035, 0.09, (ix, iy, 0.18), mats["steel"], root, vertices=16)
    cyl("cart_push_handle_back", 0.025, 0.94, (0, 0.385, 0.74), mats["steel"], root, rot=(0, math.pi / 2, 0), vertices=24)
    add_hazard_tabs(root, mats, 0.42, 0.415, 0.74, count=2)


def build_hydraulic_lift_table(root, mats):
    cube("lift_floor_base", (2.05, 0.78, 0.16), (0, 0, 0.08), mats["dark"], root, bevel=0.02)
    cube("lift_inner_rail_left", (1.86, 0.055, 0.06), (0, -0.31, 0.19), mats["steel"], root, bevel=0.006)
    cube("lift_inner_rail_right", (1.86, 0.055, 0.06), (0, 0.31, 0.19), mats["steel"], root, bevel=0.006)
    cube("lift_white_rim", (2.12, 0.9, 0.11), (0, 0, 0.75), mats["white"], root, bevel=0.028)
    for index, x in enumerate([-0.72, -0.24, 0.24, 0.72]):
        cube(f"lift_black_pad_{index+1}", (0.45, 0.78, 0.085), (x, 0, 0.835), mats["black"], root, bevel=0.025)
    for side_y in [-0.24, 0.24]:
        cube(f"lift_scissor_front_{side_y}", (1.45, 0.045, 0.055), (0, side_y, 0.47), mats["steel"], root, rot=(0, math.radians(24), 0), bevel=0.006)
        cube(f"lift_scissor_back_{side_y}", (1.45, 0.045, 0.055), (0, side_y, 0.47), mats["steel"], root, rot=(0, math.radians(-24), 0), bevel=0.006)
    cyl("lift_hydraulic_piston_left", 0.045, 0.72, (-0.3, 0.0, 0.43), mats["steel"], root, rot=(0, math.radians(58), 0), vertices=24)
    cyl("lift_hydraulic_piston_right", 0.035, 0.58, (0.34, 0.06, 0.43), mats["black"], root, rot=(0, math.radians(-54), 0), vertices=24)
    cube("lift_cyan_status_slot", (0.28, 0.025, 0.035), (0.78, -0.465, 0.27), mats["cyan"], root, bevel=0.004)
    add_hazard_tabs(root, mats, 0.44, -0.468, 0.73, count=2)


def build_wall_tool_board(root, mats):
    cube("tool_board_back_panel", (1.58, 0.055, 0.96), (0, 0, 0.51), mats["peg"], root, bevel=0.012)
    cube("tool_board_dark_frame_top", (1.66, 0.065, 0.055), (0, -0.006, 1.01), mats["dark"], root, bevel=0.008)
    cube("tool_board_dark_frame_bottom", (1.66, 0.065, 0.055), (0, -0.006, 0.03), mats["dark"], root, bevel=0.008)
    cube("tool_board_dark_frame_left", (0.055, 0.065, 0.96), (-0.805, -0.006, 0.51), mats["dark"], root, bevel=0.008)
    cube("tool_board_dark_frame_right", (0.055, 0.065, 0.96), (0.805, -0.006, 0.51), mats["dark"], root, bevel=0.008)
    for row in range(6):
        for col in range(11):
            x = -0.58 + col * 0.116
            z = 0.23 + row * 0.105
            cyl(f"tool_board_peg_hole_{row}_{col}", 0.011, 0.012, (x, -0.036, z), mats["black"], root, rot=(math.pi / 2, 0, 0), vertices=12)
    for index, x in enumerate([-0.52, -0.32, -0.1, 0.13, 0.34, 0.52]):
        cyl(f"tool_board_hanging_tool_{index+1}", 0.015, 0.42, (x, -0.052, 0.58), mats["black"], root, vertices=16)
        cube(f"tool_board_tool_handle_{index+1}", (0.045, 0.035, 0.12), (x, -0.052, 0.32), mats["steel"], root, bevel=0.006)
    cube("tool_board_lower_parts_bin", (0.52, 0.14, 0.13), (0.32, -0.07, 0.19), mats["dark"], root, bevel=0.014)
    cube("tool_board_cyan_calibration_tag", (0.34, 0.014, 0.04), (-0.28, -0.05, 0.91), mats["cyan"], root, bevel=0.004)


def build_prosthetic_parts_cabinet(root, mats):
    cube("parts_cabinet_outer_shell", (1.28, 0.5, 1.5), (0, 0, 0.81), mats["white"], root, bevel=0.024)
    cube("parts_cabinet_inner_shadow", (1.08, 0.42, 1.18), (0, -0.035, 0.82), mats["black"], root, bevel=0.016)
    for x in [-0.285, 0.285]:
        cube(f"parts_cabinet_glass_door_{x}", (0.5, 0.035, 1.12), (x, -0.275, 0.83), mats["cyan"], root, bevel=0.012)
        cube(f"parts_cabinet_vertical_handle_{x}", (0.026, 0.035, 0.58), (x + (0.24 if x < 0 else -0.24), -0.305, 0.82), mats["steel"], root, bevel=0.004)
    for z in [0.45, 0.8, 1.14]:
        cube(f"parts_cabinet_shelf_{z}", (1.04, 0.36, 0.035), (0, -0.02, z), mats["steel"], root, bevel=0.005)
    for index, (x, z, tilt) in enumerate([(-0.28, 0.55, -10), (0.24, 0.64, 12), (-0.22, 1.03, 7), (0.25, 1.1, -8)]):
        cyl(f"parts_cabinet_prosthetic_limb_{index+1}", 0.045, 0.32, (x, -0.12, z), mats["steel"], root, rot=(math.radians(tilt), 0, 0), vertices=24)
        sphere(f"parts_cabinet_joint_cap_{index+1}", 0.07, (x, -0.12, z + 0.18), mats["dark"], root, scale=(1, 1, 0.7))
    cube("parts_cabinet_hazard_kick_plate", (0.52, 0.025, 0.055), (0.36, -0.286, 0.18), mats["hazard"], root, bevel=0.004)
    cube("parts_cabinet_cyan_status_slot", (0.34, 0.018, 0.035), (0, -0.286, 1.45), mats["cyan"], root, bevel=0.004)


def build_sterile_wash_basin(root, mats):
    cube("wash_basin_base_cabinet", (1.38, 0.56, 0.64), (0, 0, 0.32), mats["white"], root, bevel=0.022)
    cube("wash_basin_dark_side_service", (0.18, 0.5, 0.54), (0.58, 0, 0.38), mats["dark"], root, bevel=0.014)
    cube("wash_basin_counter_lip", (1.42, 0.6, 0.11), (0, 0, 0.69), mats["basin"], root, bevel=0.018)
    cube("wash_basin_recess_water_well", (0.88, 0.38, 0.12), (-0.16, -0.02, 0.735), mats["black"], root, bevel=0.018)
    cube("wash_basin_inner_steel_bowl", (0.78, 0.31, 0.08), (-0.16, -0.02, 0.77), mats["basin"], root, bevel=0.018)
    cube("wash_basin_back_enamel_panel", (1.36, 0.08, 0.34), (0, 0.31, 0.86), mats["scuffed_white"], root, bevel=0.018)
    for x in [-0.28, 0.08]:
        cyl(f"wash_basin_faucet_upright_{x}", 0.025, 0.23, (x, 0.245, 0.99), mats["steel"], root, vertices=24)
        cyl(f"wash_basin_faucet_spout_{x}", 0.018, 0.22, (x + 0.07, 0.16, 1.08), mats["steel"], root, rot=(math.pi / 2, 0, 0), vertices=20)
    cube("wash_basin_cyan_sterile_panel", (0.07, 0.018, 0.18), (0.5, -0.29, 0.58), mats["cyan"], root, bevel=0.004)
    cyl("wash_basin_side_hose", 0.028, 0.36, (0.69, 0.08, 0.42), mats["rubber"], root, vertices=18)
    add_hazard_tabs(root, mats, 0.34, -0.305, 0.67, count=2)


BUILDERS = {
    "room_l1_img2_mobile_repair_cart": build_mobile_repair_cart,
    "room_l1_img2_hydraulic_lift_table": build_hydraulic_lift_table,
    "room_l1_img2_wall_tool_board": build_wall_tool_board,
    "room_l1_img2_prosthetic_parts_cabinet": build_prosthetic_parts_cabinet,
    "room_l1_img2_sterile_wash_basin": build_sterile_wash_basin,
}


def select_tree(root):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in bpy.data.objects:
        if obj.parent == root:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = root


def build_one(model_key, offset=(0, 0, 0)):
    root = root_for(model_key)
    mats = build_materials()
    BUILDERS[model_key](root, mats)
    if offset != (0, 0, 0):
        root.location = offset
    return root


def export_glb(model_key):
    clear_scene()
    set_scene_units()
    root = build_one(model_key)
    select_tree(root)
    out = MODEL_DIR / f"{model_key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(out),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
    )
    return out


def save_source_blend():
    clear_scene()
    set_scene_units()
    for index, (model_key, _size) in enumerate(ASSETS):
        build_one(model_key, offset=(index * 2.8, 0, 0))
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND))


def write_report(outputs):
    report = {
        "schemaVersion": "hp.blender.pipelineReport.v1",
        "assetFamily": "hp_level01_workcell_image2_v1",
        "generatedAt": date.today().isoformat(),
        "sourceBlend": rel(SOURCE_BLEND),
        "atlas": rel(ATLAS_PATH),
        "regions": rel(REGIONS_PATH),
        "outputs": [
            {
                "modelKey": model_key,
                "glb": rel(outputs[model_key]),
                "sizeMeters": size,
                "determinism": "scripted Blender geometry with fixed primitive dimensions, bevel modifiers, and weighted normals",
                "pivot": "root empty at floor center; geometry grounded at z=0",
            }
            for model_key, size in ASSETS
        ],
        "qaNotes": [
            "No prompt-to-3D output is used as final model geometry.",
            "Large surfaces follow the Image2 board material roles: dark metal, off-white enamel, hazard striping, restrained cyan glass, steel/rubber.",
            "All child objects are named by asset function for GLB inspection and Raw WebGPU sidecar extraction.",
        ],
    }
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    if not ATLAS_PATH.exists() or not REGIONS_PATH.exists() or not MANIFEST_PATH.exists():
        raise FileNotFoundError("run generate-level01-workcell-image2-textures.py before Blender generation")
    outputs = {}
    for model_key, _size in ASSETS:
        outputs[model_key] = export_glb(model_key)
        print(f"wrote {rel(outputs[model_key])}")
    save_source_blend()
    print(f"wrote {rel(SOURCE_BLEND)}")
    write_report(outputs)
    print(f"wrote {rel(REPORT_PATH)}")


if __name__ == "__main__":
    main()
