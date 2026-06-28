#!/usr/bin/env python3
import importlib.util
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
INTAKE_DIR = REPO_ROOT / "work" / "asset-intake" / "level05-reclamation-mother-v1"
SOURCE_GLB = INTAKE_DIR / "reclamation_mother_source_decoded.glb"
OUTPUT_DIR = INTAKE_DIR / "derived"
OUTPUT_GLB = OUTPUT_DIR / "hp_enemy_reclamation_mother_keypoint_proxy_v1.glb"
OUTPUT_BLEND = OUTPUT_DIR / "hp_enemy_reclamation_mother_keypoint_proxy_v1.blend"
REPORT_PATH = INTAKE_DIR / "reclamation_mother_keypoint_proxy_report.json"

TARGET_HEIGHT_METERS = 2.75
DECIMATE_RATIO = 0.18
MIN_FACE_AREA = 0.0009


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


def import_and_decimate_source():
    if not SOURCE_GLB.exists():
        raise FileNotFoundError(SOURCE_GLB)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_GLB))
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f"expected one mesh source, got {len(mesh_objects)}")
    obj = mesh_objects[0]
    obj.name = "reference_keypoint_work_mesh"
    obj.data.name = "reference_keypoint_work_mesh_data"
    normalize_source_object(obj)
    source_vertices = len(obj.data.vertices)
    source_polygons = len(obj.data.polygons)

    for material in list(obj.data.materials):
        obj.data.materials.pop(index=0)
    for image in list(bpy.data.images):
        bpy.data.images.remove(image)

    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new("keypoint_ratio_decimate", "DECIMATE")
    modifier.ratio = DECIMATE_RATIO
    if hasattr(modifier, "use_collapse_triangulate"):
        modifier.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.data.update()
    proxy_vertices = len(obj.data.vertices)
    proxy_polygons = len(obj.data.polygons)
    return obj, {
        "sourceVertices": source_vertices,
        "sourcePolygons": source_polygons,
        "decimateRatio": DECIMATE_RATIO,
        "proxyVerticesBeforeSemanticSplit": proxy_vertices,
        "proxyPolygonsBeforeSemanticSplit": proxy_polygons,
    }


def classify_point(point):
    x, y, z = point.x, point.y, point.z
    side = "left" if x < 0 else "right"
    absx = abs(x)
    if z < 0.32:
        return f"{side}_foot_dark"
    if z < 0.70 and absx > 0.10:
        return f"{side}_shin_body"
    if z < 1.12 and absx > 0.10:
        return f"{side}_thigh_body"
    if z > 2.18 and absx < 0.42:
        return "head_hood_body"
    if z > 2.00 and absx >= 0.42:
        return f"{side}_shoulder_body"
    if absx > 0.54 and z > 1.48:
        return f"{side}_upper_arm_body"
    if absx > 0.44 and 0.74 < z <= 1.48:
        return f"{side}_forearm_body"
    if y > 0.18 and z > 1.25:
        return "back_spine_dark"
    if absx < 0.48 and 1.55 < z <= 2.18:
        return "chest_body"
    if absx < 0.42 and 1.06 < z <= 1.55:
        return "abdomen_body"
    if absx < 0.44 and 0.72 < z <= 1.15:
        return "pelvis_body"
    if y > 0.04 and 0.92 < z < 1.95:
        return "torso_inner_dark"
    return "torso_body"


def material_for_group(group, materials):
    group = group.rsplit("_part", 1)[0]
    if group.endswith("_dark") or "inner_dark" in group or group == "back_dark":
        return materials["dark"]
    if "foot" in group:
        return materials["dark"]
    if "leg" in group or "thigh" in group or "shin" in group:
        return materials["body_shadow"]
    if "arm" in group or "shoulder" in group or "head" in group or "torso" in group or "chest" in group or "abdomen" in group:
        return materials["body"]
    return materials["body_shadow"]


def split_points_for_clean_hulls(group, points):
    if len(points) < 48:
        return [(group, points)]
    xs = sorted(p.x for p in points)
    zs = sorted(p.z for p in points)
    mid_x = xs[len(xs) // 2]
    mid_z = zs[len(zs) // 2]

    if group == "head_hood_body":
        upper = [p for p in points if p.z >= mid_z]
        lower = [p for p in points if p.z < mid_z]
        return [
            (f"{group}_part00", upper),
            (f"{group}_part01", [p for p in lower if p.x < mid_x]),
            (f"{group}_part02", [p for p in lower if p.x >= mid_x]),
        ]
    if group == "chest_body":
        return [
            (f"{group}_part00", [p for p in points if p.x < mid_x]),
            (f"{group}_part01", [p for p in points if p.x >= mid_x]),
        ]
    if group in {"abdomen_body", "back_spine_dark"}:
        return [
            (f"{group}_part00", [p for p in points if p.z < mid_z]),
            (f"{group}_part01", [p for p in points if p.z >= mid_z]),
        ]
    if group.endswith("_shoulder_body") and len(points) > 90:
        return [
            (f"{group}_part00", [p for p in points if p.z < mid_z]),
            (f"{group}_part01", [p for p in points if p.z >= mid_z]),
        ]
    return [(group, points)]


def build_hull_from_points(group, points, materials):
    if len(points) < 4:
        return None
    part_mesh = bpy.data.meshes.new(f"mesh_{group}_data")
    part_mesh.from_pydata([(p.x, p.y, p.z) for p in points], [], [])
    part_mesh.update()
    part = bpy.data.objects.new(f"mesh_{group}", part_mesh)
    bpy.context.collection.objects.link(part)
    part.data.materials.append(material_for_group(group, materials))
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = part
    part.select_set(True)
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        try:
            bpy.ops.mesh.convex_hull(delete_unused=True, join_triangles=True)
        except TypeError:
            bpy.ops.mesh.convex_hull()
        bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

    bevel = part.modifiers.new(name="keypoint_proxy_hull_bevel", type="BEVEL")
    bevel.width = 0.0065
    bevel.segments = 1
    bevel.affect = "EDGES"
    bevel.harden_normals = True
    try:
        bpy.ops.object.modifier_apply(modifier=bevel.name)
    except Exception:
        part.modifiers.remove(bevel)
    normal = part.modifiers.new(name="keypoint_proxy_weighted_normals", type="WEIGHTED_NORMAL")
    normal.keep_sharp = True
    try:
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        part.modifiers.remove(normal)
    return part


def build_group_meshes(source_obj, materials):
    mesh = source_obj.data
    groups = {}
    for vertex in mesh.vertices:
        group = classify_point(vertex.co)
        groups.setdefault(group, []).append(vertex.co.copy())

    output = {}
    for group, points in groups.items():
        for part_group, part_points in split_points_for_clean_hulls(group, points):
            part = build_hull_from_points(part_group, part_points, materials)
            if part:
                output[part_group] = part
    bpy.data.objects.remove(source_obj, do_unlink=True)
    return output


def add_rig_nodes():
    root = base.empty("reclamation_mother_root", Vector((0, 0, 0)), None, display_size=0.12)
    pelvis = base.empty("pelvisPivot", Vector((0, 0, 0.95)), root)
    torso = base.empty("torsoPivot", Vector((0, -0.05, 1.55)), pelvis)
    head = base.empty("headSensorPivot", Vector((-0.08, -0.28, 2.24)), torso)
    halo = base.empty("shoulderHaloPivot", Vector((0, 0.24, 2.05)), torso)
    core = base.empty("coreWeakpointPivot", Vector((0.18, -0.50, 1.66)), torso)
    left_shoulder = base.empty("leftShoulderPivot", Vector((-0.58, -0.02, 1.88)), torso)
    right_shoulder = base.empty("rightShoulderPivot", Vector((0.58, -0.02, 1.88)), torso)
    left_elbow = base.empty("leftElbowPivot", Vector((-0.56, -0.10, 1.28)), left_shoulder)
    right_elbow = base.empty("rightElbowPivot", Vector((0.56, -0.10, 1.28)), right_shoulder)
    left_wrist = base.empty("leftWristPivot", Vector((-0.54, -0.20, 0.88)), left_elbow)
    right_wrist = base.empty("rightWristPivot", Vector((0.54, -0.20, 0.88)), right_elbow)
    left_hip = base.empty("leftHipPivot", Vector((-0.22, -0.02, 0.92)), pelvis)
    right_hip = base.empty("rightHipPivot", Vector((0.22, -0.02, 0.92)), pelvis)
    left_knee = base.empty("leftKneePivot", Vector((-0.24, -0.06, 0.48)), left_hip)
    right_knee = base.empty("rightKneePivot", Vector((0.24, -0.06, 0.48)), right_hip)
    left_ankle = base.empty("leftAnklePivot", Vector((-0.24, -0.18, 0.10)), left_knee)
    right_ankle = base.empty("rightAnklePivot", Vector((0.24, -0.18, 0.10)), right_knee)
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


def parent_group_meshes(group_meshes, nodes):
    parent_map = {
        "head_hood_body": nodes["head"],
        "back_spine_dark": nodes["halo"],
        "torso_body": nodes["torso"],
        "torso_inner_dark": nodes["torso"],
        "chest_body": nodes["torso"],
        "abdomen_body": nodes["torso"],
        "pelvis_body": nodes["pelvis"],
        "left_shoulder_body": nodes["leftShoulder"],
        "right_shoulder_body": nodes["rightShoulder"],
        "left_upper_arm_body": nodes["leftShoulder"],
        "right_upper_arm_body": nodes["rightShoulder"],
        "left_forearm_body": nodes["leftElbow"],
        "right_forearm_body": nodes["rightElbow"],
        "left_thigh_body": nodes["leftHip"],
        "right_thigh_body": nodes["rightHip"],
        "left_shin_body": nodes["leftKnee"],
        "right_shin_body": nodes["rightKnee"],
        "left_foot_dark": nodes["leftAnkle"],
        "right_foot_dark": nodes["rightAnkle"],
    }
    for group, obj in group_meshes.items():
        canonical = group.rsplit("_part", 1)[0]
        base.parent_keep_world(obj, parent_map.get(canonical, nodes["torso"]))


def add_runtime_sockets_and_core(nodes, materials):
    core = nodes["core"]
    torso = nodes["torso"]
    root = nodes["root"]
    base.sphere("part_core_blue_glass", (0.18, -0.535, 1.66), (0.105, 0.034, 0.105), materials["glass"], core, segments=32, rings=16)
    base.torus("part_core_dark_socket_ring", (0.18, -0.542, 1.66), 0.123, 0.012, materials["dark"], core, rotation=(math.pi / 2, 0, 0))
    for name, location, parent in (
        ("core_glass_weakpoint", Vector((0.18, -0.58, 1.66)), core),
        ("missile_hit_socket", Vector((0.18, -0.66, 1.66)), core),
        ("skill3_lockon_socket", Vector((0.18, -0.76, 1.78)), core),
        ("boss_vfx_center_socket", Vector((0, -0.08, 1.55)), torso),
        ("floor_contact_socket", Vector((0, -0.03, 0.0)), root),
        ("warning_emissive_slots", Vector((0.02, -0.56, 2.05)), torso),
    ):
        base.empty(name, location, parent, display_size=0.05)


def compute_report(group_meshes):
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
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
        "semanticGroups": sorted(group_meshes.keys()),
        "verticesApprox": vertices,
        "trianglesApprox": triangles,
        "dimensionsBlender": [round(v, 4) for v in (maxv - minv)],
        "boundsMinBlender": [round(v, 4) for v in minv],
        "boundsMaxBlender": [round(v, 4) for v in maxv],
    }


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
    source_obj, source_stats = import_and_decimate_source()
    group_meshes = build_group_meshes(source_obj, materials)
    nodes = add_rig_nodes()
    parent_group_meshes(group_meshes, nodes)
    add_runtime_sockets_and_core(nodes, materials)
    base.build_animations()
    scene_report = compute_report(group_meshes)
    export_scene()
    glb_scan = base.scan_exported_glb(OUTPUT_GLB)
    report = {
        "schema": "human-protocol/level05-reclamation-mother-keypoint-proxy@1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "purpose": "Use a keypoint-ratio low-poly proxy: keep roughly 10-30% geometric control vertices, reconnect and regroup them into Human Protocol runtime nodes, and replace source texture/materials with project-owned material slots.",
        "assetAuthorship": {
            "meshMethod": "keypoint proxy retopology from a user-provided generated source asset",
            "textures": "none; source UVs/images are removed before export",
            "externalTextureDependency": False,
            "runtimeFacingNamesSanitized": True,
        },
        "keypointProxy": {
            **source_stats,
            "proxyVerticesAfterSemanticSplit": scene_report["verticesApprox"],
            "proxyTriangleApprox": scene_report["trianglesApprox"],
        },
        "derivedAsset": {
            "modelKeyCandidate": "hp_enemy_reclamation_mother_keypoint_proxy_v1",
            "glb": str(OUTPUT_GLB.relative_to(REPO_ROOT)),
            "sourceBlend": str(OUTPUT_BLEND.relative_to(REPO_ROOT)),
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
            "glbScan": glb_scan,
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"glb": str(OUTPUT_GLB), "blend": str(OUTPUT_BLEND), "report": str(REPORT_PATH)}, indent=2))


if __name__ == "__main__":
    main()
