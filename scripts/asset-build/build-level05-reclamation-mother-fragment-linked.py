#!/usr/bin/env python3
import importlib.util
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
INTAKE_DIR = REPO_ROOT / "work" / "asset-intake" / "level05-reclamation-mother-v1"
SOURCE_GLB = INTAKE_DIR / "reclamation_mother_source_decoded.glb"
OUTPUT_DIR = INTAKE_DIR / "derived"
OUTPUT_GLB = OUTPUT_DIR / "hp_enemy_reclamation_mother_fragment_linked_v6_no_shards.glb"
OUTPUT_BLEND = OUTPUT_DIR / "hp_enemy_reclamation_mother_fragment_linked_v6_no_shards.blend"
OUTPUT_PREVIEW = OUTPUT_DIR / "hp_enemy_reclamation_mother_fragment_linked_v6_no_shards_preview.png"
REPORT_PATH = INTAKE_DIR / "reclamation_mother_fragment_linked_v6_no_shards_report.json"

TARGET_HEIGHT_METERS = 2.75
DECIMATE_RATIO = 0.10
VISIBLE_SOURCE_FRAGMENT_LAYER = False


BASE_SCRIPT = Path(__file__).with_name("build-level05-reclamation-mother-rig.py")
spec = importlib.util.spec_from_file_location("reclamation_rig_base", BASE_SCRIPT)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def bbox_mesh_data(obj):
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    for vertex in obj.data.vertices:
        co = vertex.co
        minv.x = min(minv.x, co.x)
        minv.y = min(minv.y, co.y)
        minv.z = min(minv.z, co.z)
        maxv.x = max(maxv.x, co.x)
        maxv.y = max(maxv.y, co.y)
        maxv.z = max(maxv.z, co.z)
    return minv, maxv


def normalize_source_object(obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    minv, maxv = bbox_mesh_data(obj)
    height = maxv.z - minv.z
    scale = TARGET_HEIGHT_METERS / height if height > 0 else 1.0
    center = (minv + maxv) * 0.5
    for vertex in obj.data.vertices:
        reference_x = (vertex.co.x - center.x) * scale
        reference_y = (vertex.co.y - center.y) * scale
        reference_z = (vertex.co.z - minv.z) * scale
        vertex.co = Vector((reference_y, reference_x, reference_z))
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)
    obj.data.update()


def import_continuous_fragment_shell(materials):
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(SOURCE_GLB)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"expected one mesh source, got {len(mesh_objects)}")

    obj = mesh_objects[0]
    obj.name = "mesh_fragment_continuous_outer_shell"
    obj.data.name = "mesh_fragment_continuous_outer_shell_data"
    normalize_source_object(obj)
    source_stats = {
        "sourceVertices": len(obj.data.vertices),
        "sourcePolygons": len(obj.data.polygons),
    }

    obj.data.materials.clear()
    for material in (materials["body"], materials["body_shadow"], materials["dark"], materials["trim"]):
        obj.data.materials.append(material)
    for uv_layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(uv_layer)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    decimate = obj.modifiers.new("fragment_keep_22_percent_shape", "DECIMATE")
    decimate.ratio = DECIMATE_RATIO
    if hasattr(decimate, "use_collapse_triangulate"):
        decimate.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=decimate.name)

    triangulate = obj.modifiers.new("fragment_triangular_outer_skin", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=triangulate.name)
    noise_stats = filter_fragment_noise(obj)
    weld_and_fill_small_holes(obj)
    assign_fragment_materials(obj)
    mark_faceted_normals(obj)
    source_stats.update(
        {
            "decimateRatio": DECIMATE_RATIO,
            **noise_stats,
            "proxyVerticesAfterDecimate": len(obj.data.vertices),
            "proxyPolygonsAfterDecimate": len(obj.data.polygons),
        }
    )
    return obj, source_stats


def filter_fragment_noise(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    delete_faces = []
    for face in bm.faces:
        area = face.calc_area()
        edge_lengths = [edge.calc_length() for edge in face.edges]
        if not edge_lengths:
            delete_faces.append(face)
            continue
        shortest = max(min(edge_lengths), 0.00001)
        longest = max(edge_lengths)
        sliver_ratio = longest / shortest
        center = face.calc_center_median()
        tiny_face = area < 0.0018
        thin_splinter = area < 0.010 and sliver_ratio > 10.0
        limb_splinter = area < 0.006 and sliver_ratio > 6.2 and (abs(center.x) > 0.48 or center.z < 0.70)
        if tiny_face or thin_splinter or limb_splinter:
            delete_faces.append(face)
    removed = len(delete_faces)
    if delete_faces:
        bmesh.ops.delete(bm, geom=delete_faces, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return {
        "noiseFacesRemoved": removed,
        "noiseFilter": "removed tiny and high-aspect splinter triangles before gap fill and panel overlay",
    }


def weld_and_fill_small_holes(obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            bpy.ops.mesh.remove_doubles(threshold=0.0025)
        except TypeError:
            bpy.ops.mesh.remove_doubles()
        try:
            bpy.ops.mesh.fill_holes(sides=14)
        except TypeError:
            bpy.ops.mesh.fill_holes()
        bpy.ops.mesh.normals_make_consistent(inside=False)
    finally:
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass
    obj.data.update()


def assign_fragment_materials(obj):
    mesh = obj.data
    for poly in mesh.polygons:
        center = Vector((0, 0, 0))
        for index in poly.vertices:
            center += mesh.vertices[index].co
        center /= max(1, len(poly.vertices))
        poly.material_index = material_index_for_center(center)


def material_index_for_center(point):
    x, y, z = point.x, point.y, point.z
    absx = abs(x)
    if z < 0.28:
        return 2
    if y > -0.18:
        return 2
    if absx < 0.36 and 0.84 < z < 1.82 and y > -0.10:
        return 2
    if absx > 0.54 and z > 1.10:
        return 0
    if z < 1.10:
        return 1
    if z > 2.05:
        return 0
    if y < -0.28 and 1.30 < z < 1.98:
        return 3
    return 0


def mark_faceted_normals(obj):
    for poly in obj.data.polygons:
        poly.use_smooth = False
    normal = obj.modifiers.new(name="fragment_weighted_hard_surface_normals", type="WEIGHTED_NORMAL")
    normal.keep_sharp = True
    try:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        obj.modifiers.remove(normal)


def add_rig_nodes():
    root = base.empty("reclamation_mother_root", Vector((0, 0, 0)), None, display_size=0.12)
    pelvis = base.empty("pelvisPivot", Vector((0, 0, 0.95)), root)
    torso = base.empty("torsoPivot", Vector((0, -0.05, 1.55)), pelvis)
    head = base.empty("headSensorPivot", Vector((-0.08, -0.28, 2.24)), torso)
    halo = base.empty("shoulderHaloPivot", Vector((0, 0.24, 2.05)), torso)
    core = base.empty("coreWeakpointPivot", Vector((0.18, -0.50, 1.66)), torso)
    left_shoulder = base.empty("leftShoulderPivot", Vector((-0.58, -0.02, 1.88)), torso)
    right_shoulder = base.empty("rightShoulderPivot", Vector((0.58, -0.02, 1.88)), torso)
    left_elbow = base.empty("leftElbowPivot", Vector((-0.58, -0.08, 1.30)), left_shoulder)
    right_elbow = base.empty("rightElbowPivot", Vector((0.58, -0.08, 1.30)), right_shoulder)
    left_wrist = base.empty("leftWristPivot", Vector((-0.54, -0.18, 0.88)), left_elbow)
    right_wrist = base.empty("rightWristPivot", Vector((0.54, -0.18, 0.88)), right_elbow)
    left_hip = base.empty("leftHipPivot", Vector((-0.24, -0.02, 0.92)), pelvis)
    right_hip = base.empty("rightHipPivot", Vector((0.24, -0.02, 0.92)), pelvis)
    left_knee = base.empty("leftKneePivot", Vector((-0.26, -0.06, 0.48)), left_hip)
    right_knee = base.empty("rightKneePivot", Vector((0.26, -0.06, 0.48)), right_hip)
    left_ankle = base.empty("leftAnklePivot", Vector((-0.27, -0.18, 0.12)), left_knee)
    right_ankle = base.empty("rightAnklePivot", Vector((0.27, -0.18, 0.12)), right_knee)
    return {
        "root": root,
        "pelvis": pelvis,
        "torso": torso,
        "head": head,
        "halo": halo,
        "core": core,
        "leftShoulder": left_shoulder,
        "rightShoulder": right_shoulder,
        "leftElbow": left_elbow,
        "rightElbow": right_elbow,
        "leftWrist": left_wrist,
        "rightWrist": right_wrist,
        "leftHip": left_hip,
        "rightHip": right_hip,
        "leftKnee": left_knee,
        "rightKnee": right_knee,
        "leftAnkle": left_ankle,
        "rightAnkle": right_ankle,
    }


def add_inner_shadow_shell(shell, materials):
    inner = shell.copy()
    inner.data = shell.data.copy()
    inner.name = "mesh_fragment_inner_shadow_gap_fill"
    inner.data.name = "mesh_fragment_inner_shadow_gap_fill_data"
    bpy.context.collection.objects.link(inner)
    inner.data.materials.clear()
    inner.data.materials.append(materials["dark"])
    for poly in inner.data.polygons:
        poly.material_index = 0
        poly.use_smooth = False
    inner.scale = (shell.scale.x * 0.92, shell.scale.y * 0.92, shell.scale.z * 0.95)
    inner.location = (shell.location.x, shell.location.y + 0.022, shell.location.z + 0.012)
    return inner


def angular_panel(name, location, scale, material, parent, rotation=(0, 0, 0), profile=None):
    sx, sy, sz = scale
    if profile is None:
        profile = [
            (-0.30, 1.00),
            (-0.90, 0.55),
            (-1.00, -0.18),
            (-0.58, -0.92),
            (0.18, -1.00),
            (0.92, -0.48),
            (0.82, 0.42),
            (0.28, 0.96),
        ]
    front_y = -sy
    back_y = sy * 0.42
    verts = []
    for x, z in profile:
        verts.append((x * sx, front_y, z * sz))
    for x, z in profile:
        verts.append((x * sx * 0.92, back_y, z * sz * 0.92))
    count = len(profile)
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        faces.append((index, (index + 1) % count, ((index + 1) % count) + count, index + count))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = False
    base.apply_bevel_and_normals(obj, bevel=max(0.004, min(0.014, min(sx, sy, sz) * 0.08)), segments=1)
    if parent:
        base.parent_keep_world(obj, parent)
    return obj


def add_clean_armor_panels(nodes, materials):
    panels = []

    def plate(name, location, scale, material, parent, rotation=(0, 0, 0), profile=None):
        obj = angular_panel(name, location, scale, material, parent, rotation=rotation, profile=profile)
        panels.append(obj.name)

    body = materials["body"]
    shadow = materials["body_shadow"]
    trim = materials["trim"]
    dark = materials["dark"]

    wide_crown = [(-0.75, 0.88), (-1.00, 0.18), (-0.62, -0.78), (0.18, -0.96), (1.0, -0.30), (0.72, 0.64), (-0.12, 1.0)]
    narrow_limb = [(-0.38, 1.00), (-0.88, 0.50), (-0.78, -0.62), (-0.18, -1.00), (0.76, -0.62), (0.94, 0.28), (0.32, 0.96)]
    chest_left = [(-0.74, 0.96), (-1.00, 0.26), (-0.76, -0.82), (-0.10, -1.00), (0.82, -0.44), (0.94, 0.44), (0.24, 1.00)]
    chest_right = [(-0.36, 0.94), (-0.94, 0.34), (-0.82, -0.54), (-0.16, -1.0), (0.86, -0.72), (1.0, 0.22), (0.50, 0.98)]

    plate("polish_head_left_brow_white_panel", (-0.20, -0.395, 2.25), (0.30, 0.070, 0.16), body, nodes["head"], rotation=(-0.15, -0.22, 0.10), profile=wide_crown)
    plate("polish_head_right_cheek_white_panel", (0.17, -0.365, 2.13), (0.18, 0.060, 0.14), shadow, nodes["head"], rotation=(0.08, 0.18, -0.08), profile=narrow_limb)
    base.cube("polish_head_black_visor_recess", (-0.16, -0.455, 2.17), (0.23, 0.018, 0.055), dark, nodes["head"], bevel=0.004)
    panels.append("polish_head_black_visor_recess")

    plate("polish_chest_left_white_panel", (-0.20, -0.445, 1.86), (0.27, 0.064, 0.29), body, nodes["torso"], rotation=(-0.12, -0.13, 0.14), profile=chest_left)
    plate("polish_chest_right_white_panel", (0.24, -0.435, 1.76), (0.25, 0.062, 0.26), body, nodes["torso"], rotation=(0.06, 0.10, -0.13), profile=chest_right)
    plate("polish_abdomen_center_white_panel", (0.02, -0.452, 1.34), (0.19, 0.052, 0.22), shadow, nodes["torso"], rotation=(0.18, 0.00, 0.00), profile=narrow_limb)
    base.cube("polish_core_square_recess_clean_frame", (0.18, -0.555, 1.66), (0.175, 0.018, 0.170), dark, nodes["torso"], bevel=0.006)
    panels.append("polish_core_square_recess_clean_frame")
    plate("polish_back_left_dark_mantle_clean", (-0.40, 0.065, 2.04), (0.31, 0.055, 0.30), dark, nodes["halo"], rotation=(0.14, -0.20, 0.18), profile=wide_crown)
    plate("polish_back_right_dark_mantle_clean", (0.42, 0.055, 1.98), (0.29, 0.052, 0.29), dark, nodes["halo"], rotation=(0.13, 0.20, -0.16), profile=wide_crown)
    plate("polish_back_top_dark_cowl_clean", (0.02, 0.080, 2.28), (0.32, 0.050, 0.15), dark, nodes["halo"], rotation=(0.04, 0.02, 0.00), profile=wide_crown)

    for side, sign in (("left", -1), ("right", 1)):
        plate(
            f"polish_{side}_shoulder_large_white_cap",
            (sign * 0.64, -0.252, 1.95),
            (0.24, 0.064, 0.23),
            body,
            nodes[f"{side}Shoulder"],
            rotation=(0.12, sign * 0.18, sign * 0.18),
            profile=wide_crown,
        )
        plate(
            f"polish_{side}_upper_arm_white_shield",
            (sign * 0.68, -0.272, 1.47),
            (0.125, 0.045, 0.215),
            shadow if side == "right" else body,
            nodes[f"{side}Shoulder"],
            rotation=(0.12, sign * 0.08, sign * 0.09),
            profile=narrow_limb,
        )
        plate(
            f"polish_{side}_forearm_white_shield",
            (sign * 0.58, -0.270, 1.02),
            (0.105, 0.040, 0.18),
            body,
            nodes[f"{side}Elbow"],
            rotation=(-0.10, sign * 0.06, -sign * 0.08),
            profile=narrow_limb,
        )
        plate(
            f"polish_{side}_thigh_white_front_plate",
            (sign * 0.34, -0.278, 0.72),
            (0.112, 0.042, 0.20),
            shadow,
            nodes[f"{side}Hip"],
            rotation=(0.13, sign * 0.04, sign * 0.06),
            profile=narrow_limb,
        )
        plate(
            f"polish_{side}_shin_white_front_plate",
            (sign * 0.33, -0.270, 0.34),
            (0.095, 0.038, 0.17),
            body,
            nodes[f"{side}Knee"],
            rotation=(-0.08, sign * 0.04, -sign * 0.05),
            profile=narrow_limb,
        )
        base.cube(
            f"polish_{side}_ankle_trim_band",
            (sign * 0.34, -0.250, 0.18),
            (0.080, 0.018, 0.020),
            trim,
            nodes[f"{side}Ankle"],
            rotation=(0, 0, sign * 0.06),
            bevel=0.004,
        )
        panels.append(f"polish_{side}_ankle_trim_band")

    return panels


def add_no_gap_connectors(nodes, materials):
    links = []

    def cyl(name, start, end, radius, material, parent, vertices=20):
        links.append(base.cylinder_between(name, start, end, radius, material, parent, vertices=vertices, bevel=True))

    def ball(name, location, radius, material, parent, squash=(1, 1, 1)):
        links.append(
            base.sphere(
                name,
                location,
                (radius * squash[0], radius * squash[1], radius * squash[2]),
                material,
                parent,
                segments=24,
                rings=12,
            )
        )

    rubber = materials["rubber"]
    gunmetal = materials["gunmetal"]
    dark = materials["dark"]

    cyl("link_hidden_spine_front_overlap", (0.02, 0.02, 0.78), (0.02, 0.02, 1.86), 0.062, gunmetal, nodes["pelvis"], vertices=22)
    cyl("link_hidden_spine_back_overlap", (0.00, 0.15, 0.70), (0.00, 0.24, 2.06), 0.066, dark, nodes["pelvis"], vertices=22)
    ball("link_pelvis_full_socket", (0, -0.06, 0.92), 0.175, dark, nodes["pelvis"], squash=(1.28, 0.70, 0.70))
    ball("link_chest_inner_plug", (0.02, -0.13, 1.56), 0.195, dark, nodes["torso"], squash=(1.24, 0.52, 1.02))

    for side, sign in (("left", -1), ("right", 1)):
        shoulder_a = (sign * 0.30, -0.07, 1.82)
        shoulder_b = (sign * 0.74, -0.08, 1.72)
        elbow_a = (sign * 0.68, -0.08, 1.58)
        elbow_b = (sign * 0.60, -0.13, 1.08)
        wrist_a = (sign * 0.58, -0.14, 1.08)
        wrist_b = (sign * 0.54, -0.23, 0.76)
        hip_a = (sign * 0.16, -0.05, 0.93)
        hip_b = (sign * 0.42, -0.08, 0.82)
        knee_a = (sign * 0.38, -0.08, 0.78)
        knee_b = (sign * 0.34, -0.11, 0.36)
        ankle_a = (sign * 0.32, -0.11, 0.36)
        ankle_b = (sign * 0.34, -0.24, 0.12)

        cyl(f"link_{side}_shoulder_bridge_no_gap", shoulder_a, shoulder_b, 0.068, rubber, nodes["torso"], vertices=22)
        ball(f"link_{side}_shoulder_chest_plug", shoulder_a, 0.105, dark, nodes["torso"], squash=(1.06, 0.72, 0.78))
        ball(f"link_{side}_shoulder_arm_plug", shoulder_b, 0.112, rubber, nodes[f"{side}Shoulder"], squash=(1.02, 0.82, 0.82))

        cyl(f"link_{side}_upper_forearm_bridge_no_gap", elbow_a, elbow_b, 0.054, gunmetal, nodes[f"{side}Shoulder"], vertices=18)
        ball(f"link_{side}_elbow_full_socket", (sign * 0.62, -0.11, 1.30), 0.103, rubber, nodes[f"{side}Elbow"], squash=(1.02, 0.82, 0.88))
        cyl(f"link_{side}_wrist_bridge_no_gap", wrist_a, wrist_b, 0.043, gunmetal, nodes[f"{side}Elbow"], vertices=16)
        ball(f"link_{side}_wrist_cap_no_gap", wrist_b, 0.082, dark, nodes[f"{side}Wrist"], squash=(1.08, 0.78, 0.78))

        cyl(f"link_{side}_hip_bridge_no_gap", hip_a, hip_b, 0.078, rubber, nodes["pelvis"], vertices=22)
        ball(f"link_{side}_hip_pelvis_plug", hip_a, 0.106, dark, nodes["pelvis"], squash=(1.00, 0.78, 0.78))
        ball(f"link_{side}_upper_leg_plug", hip_b, 0.112, rubber, nodes[f"{side}Hip"], squash=(0.96, 0.82, 0.82))
        cyl(f"link_{side}_knee_bridge_no_gap", knee_a, knee_b, 0.059, gunmetal, nodes[f"{side}Hip"], vertices=18)
        ball(f"link_{side}_knee_full_socket", (sign * 0.35, -0.10, 0.50), 0.094, rubber, nodes[f"{side}Knee"], squash=(1.00, 0.82, 0.86))
        cyl(f"link_{side}_ankle_bridge_no_gap", ankle_a, ankle_b, 0.049, gunmetal, nodes[f"{side}Knee"], vertices=16)
        ball(f"link_{side}_ankle_foot_plug", ankle_b, 0.090, dark, nodes[f"{side}Ankle"], squash=(1.16, 0.78, 0.68))

    base.cube("link_front_core_recess_plate_no_gap", (0.18, -0.522, 1.66), (0.23, 0.034, 0.205), dark, nodes["torso"], bevel=0.008)
    links.append(bpy.data.objects["link_front_core_recess_plate_no_gap"])
    base.sphere("part_core_blue_glass", (0.18, -0.565, 1.66), (0.105, 0.034, 0.105), materials["glass"], nodes["core"], segments=32, rings=16)
    links.append(bpy.data.objects["part_core_blue_glass"])
    base.torus("part_core_dark_socket_ring", (0.18, -0.572, 1.66), 0.126, 0.014, dark, nodes["core"], rotation=(math.pi / 2, 0, 0))
    links.append(bpy.data.objects["part_core_dark_socket_ring"])
    return [obj.name for obj in links if obj]


def add_runtime_sockets(nodes):
    for name, location, parent in (
        ("core_glass_weakpoint", Vector((0.18, -0.60, 1.66)), nodes["core"]),
        ("missile_hit_socket", Vector((0.18, -0.68, 1.66)), nodes["core"]),
        ("skill3_lockon_socket", Vector((0.18, -0.78, 1.78)), nodes["core"]),
        ("boss_vfx_center_socket", Vector((0, -0.08, 1.55)), nodes["torso"]),
        ("floor_contact_socket", Vector((0, -0.03, 0.0)), nodes["root"]),
        ("warning_emissive_slots", Vector((0.02, -0.56, 2.05)), nodes["torso"]),
    ):
        base.empty(name, location, parent, display_size=0.05)


def compute_scene_report(connector_names):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    empty_objects = [obj for obj in bpy.context.scene.objects if obj.type == "EMPTY"]
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    triangles = 0
    vertices = 0
    for obj in mesh_objects:
        vertices += len(obj.data.vertices)
        triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            minv.x = min(minv.x, world.x)
            minv.y = min(minv.y, world.y)
            minv.z = min(minv.z, world.z)
            maxv.x = max(maxv.x, world.x)
            maxv.y = max(maxv.y, world.y)
            maxv.z = max(maxv.z, world.z)
    return {
        "meshObjects": len(mesh_objects),
        "emptyObjects": len(empty_objects),
        "connectorObjects": len(connector_names),
        "verticesApprox": vertices,
        "trianglesApprox": triangles,
        "boundsMinBlender": [round(v, 4) for v in minv],
        "boundsMaxBlender": [round(v, 4) for v in maxv],
        "dimensionsBlender": [round(v, 4) for v in (maxv - minv)],
    }


def point_camera_at(camera, target):
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview():
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except Exception:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 960
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.world = scene.world or bpy.data.worlds.new("World")
    scene.world.color = (0.015, 0.017, 0.019)

    bpy.ops.object.light_add(type="AREA", location=(-3.0, -4.5, 4.6))
    key = bpy.context.object
    key.name = "preview_key_softbox"
    key.data.energy = 560
    key.data.size = 4.4
    bpy.ops.object.light_add(type="POINT", location=(2.8, -2.0, 2.3))
    fill = bpy.context.object
    fill.name = "preview_cyan_core_kicker"
    fill.data.energy = 90
    fill.data.color = (0.45, 0.72, 1.0)

    bpy.ops.object.camera_add(location=(3.20, -4.80, 2.35))
    camera = bpy.context.object
    camera.name = "preview_camera_three_quarter"
    camera.data.lens = 52
    camera.data.sensor_width = 32
    point_camera_at(camera, (0.02, -0.08, 1.35))
    scene.camera = camera
    scene.render.filepath = str(OUTPUT_PREVIEW)
    bpy.ops.render.render(write_still=True)


def export_scene():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT_GLB),
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
        export_texcoords=False,
        export_normals=True,
    )
    base.merge_node_action_clips(OUTPUT_GLB)


def main():
    base.clear_scene()
    materials = base.build_materials()
    shell, source_stats = import_continuous_fragment_shell(materials)
    nodes = add_rig_nodes()
    if VISIBLE_SOURCE_FRAGMENT_LAYER:
        base.parent_keep_world(shell, nodes["root"])
        shell.scale = Vector((0.56, 0.62, 0.82))
        shell.location = Vector((0, 0.070, 0.190))
        inner_shell = add_inner_shadow_shell(shell, materials)
        base.parent_keep_world(inner_shell, nodes["root"])
    else:
        bpy.data.objects.remove(shell, do_unlink=True)
    panel_names = add_clean_armor_panels(nodes, materials)
    connector_names = add_no_gap_connectors(nodes, materials)
    add_runtime_sockets(nodes)
    base.build_animations()
    scene_report = compute_scene_report(connector_names)
    render_preview()
    export_scene()
    glb_scan = base.scan_exported_glb(OUTPUT_GLB)
    report = {
        "schema": "human-protocol/level05-reclamation-mother-fragment-linked@1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "purpose": "Preserve the more reference-like fragmented triangular silhouette while removing visible joint gaps through a continuous low-poly outer shell plus overlapping project-owned connector geometry.",
        "assetAuthorship": {
            "meshMethod": "continuous fragment proxy from user-provided generated source geometry; source texture, UVs, and materials removed",
            "textures": "none; project-owned material slots only",
            "externalTextureDependency": False,
            "runtimeFacingNamesSanitized": True,
        },
        "gapPolicy": {
            "outerShell": "source fragment shell disabled in this clean comparison build; source geometry is used for scale audit only",
            "innerShadowShell": "not exported in this clean comparison build",
            "cleanArmorPanels": "large procedural front-facing armor panels cover noisy shards while keeping the approved black skeleton layout",
            "connectors": "small overlapping black sockets/cylinders are inserted into shoulders, spine, hips, knees, ankles, wrists, and core recess",
            "knownTradeoff": "this visual candidate favors no-gap silhouette over fully separated limb deformation; later node cuts should happen inside these overlap bands",
        },
        "fragmentLinkedProxy": {
            **source_stats,
            "proxyVerticesAfterLinking": scene_report["verticesApprox"],
            "proxyTriangleApprox": scene_report["trianglesApprox"],
        },
        "derivedAsset": {
            "modelKeyCandidate": "hp_enemy_reclamation_mother_fragment_linked_v6_no_shards",
            "glb": str(OUTPUT_GLB.relative_to(REPO_ROOT)),
            "sourceBlend": str(OUTPUT_BLEND.relative_to(REPO_ROOT)),
            "preview": str(OUTPUT_PREVIEW.relative_to(REPO_ROOT)),
            "status": "visual-candidate-not-yet-registered-in-level5",
            "animatedClips": base.CLIPS + [f"utility_idle_{i:02d}" for i in range(4)],
            "requiredSockets": [
                "core_glass_weakpoint",
                "missile_hit_socket",
                "skill3_lockon_socket",
                "boss_vfx_center_socket",
                "floor_contact_socket",
                "warning_emissive_slots",
            ],
            **scene_report,
            "cleanArmorPanelObjects": len(panel_names),
            "glbScan": glb_scan,
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"glb": str(OUTPUT_GLB), "blend": str(OUTPUT_BLEND), "preview": str(OUTPUT_PREVIEW), "report": str(REPORT_PATH)}, indent=2))


if __name__ == "__main__":
    main()
