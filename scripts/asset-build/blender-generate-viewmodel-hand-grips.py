#!/usr/bin/env python3
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "src" / "assets" / "manifests" / "human_protocol_hand_grip_geometry_v1_report.json"
MORPH_REPORT_PATH = ROOT / "src" / "assets" / "manifests" / "human_protocol_viewmodel_hand_disguise_preflight_v2.json"
MODEL_ROOT = ROOT / "src" / "assets" / "models" / "viewmodel"
RENDER_ROOT = ROOT / "src" / "assets" / "renders" / "viewmodel"
BLEND_ROOT = ROOT / "src" / "assets" / "source_blend" / "viewmodel"
WEBGPU_SIDEARM_PATH = Path("/Users/zhengkaizhang/Documents/webgpu-robot-lab/public/assets/props/sidearm-pistol.glb")

CASE_SPECS = {
    "pistol_compact_narrow": {
        "kind": "pistol",
        "half": (0.205, 0.58, 0.155),
        "radius": 0.0,
        "round_radius": 0.035,
    },
    "baton_slim": {
        "kind": "baton",
        "half": (0.52, 0.0, 0.0),
        "radius": 0.145,
        "round_radius": 0.0,
    },
}


def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures, bpy.data.curves):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def bsdf_node(material):
    if not material.use_nodes or not material.node_tree:
        return None
    node = material.node_tree.nodes.get("Principled BSDF")
    if node:
        return node
    return next((item for item in material.node_tree.nodes if item.type == "BSDF_PRINCIPLED"), None)


def set_input(node, names, value):
    if not node:
        return
    for name in names:
        socket = node.inputs.get(name)
        if socket:
            socket.default_value = value
            return


def make_mat(name, color, metallic=0.0, roughness=0.45, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    node = bsdf_node(material)
    set_input(node, ["Base Color"], color)
    set_input(node, ["Metallic"], metallic)
    set_input(node, ["Roughness"], roughness)
    if emission:
        set_input(node, ["Emission Color"], emission)
        set_input(node, ["Emission Strength"], emission_strength)
    return material


def create_materials():
    return {
        "skin": make_mat("hp_sim_silicone_skin_warm", (0.96, 0.62, 0.46, 1), 0.04, 0.38),
        "skin_shadow": make_mat("hp_sim_silicone_subtle_shadow", (0.72, 0.36, 0.25, 1), 0.02, 0.5),
        "seam": make_mat("hp_sim_hand_soft_skin_seams", (0.47, 0.29, 0.23, 1), 0.04, 0.58),
        "wrist": make_mat("hp_sim_wrist_inner_machine", (0.06, 0.065, 0.062, 1), 0.72, 0.34),
        "metal": make_mat("hp_viewmodel_dark_brushed_metal", (0.02, 0.025, 0.027, 1), 0.88, 0.29),
        "metal_edge": make_mat("hp_viewmodel_worn_silver_edges", (0.58, 0.62, 0.6, 1), 0.84, 0.25),
        "rubber": make_mat("hp_viewmodel_black_rubber_grip", (0.005, 0.006, 0.006, 1), 0.12, 0.74),
        "cyan": make_mat("hp_viewmodel_cyan_energy_cell", (0.2, 0.88, 0.95, 1), 0.35, 0.18, (0.18, 0.9, 1, 1), 0.75),
        "amber": make_mat("hp_viewmodel_amber_charge_ticks", (0.95, 0.54, 0.18, 1), 0.45, 0.28, (1.0, 0.42, 0.12, 1), 0.42),
    }


def rounded_box(name, dimensions, location, material, bevel=0.02, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    item = bpy.context.object
    item.name = name
    item.data.name = f"{name}_mesh"
    item.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    item.data.materials.append(material)
    if bevel > 0:
        mod = item.modifiers.new(name="hp_viewmodel_round_bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = 5
        mod.harden_normals = True
        bpy.context.view_layer.objects.active = item
        item.select_set(True)
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            pass
    normal = item.modifiers.new(name="hp_viewmodel_weighted_normals", type="WEIGHTED_NORMAL")
    normal.keep_sharp = True
    try:
        bpy.context.view_layer.objects.active = item
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        pass
    return item


def signed_power(value, exponent):
    if abs(value) < 1e-9:
        return 0.0
    return math.copysign(abs(value) ** exponent, value)


def superquadric(name, dimensions, location, material, exponent_a=0.72, exponent_b=0.68, segments=36, rings=18):
    half = (dimensions[0] * 0.5, dimensions[1] * 0.5, dimensions[2] * 0.5)
    verts = []
    faces = []
    for ring in range(rings + 1):
        v = -math.pi / 2 + math.pi * ring / rings
        cv = math.cos(v)
        sv = math.sin(v)
        for seg in range(segments):
            u = -math.pi + 2 * math.pi * seg / segments
            cu = math.cos(u)
            su = math.sin(u)
            x = half[0] * signed_power(cv, exponent_a) * signed_power(cu, exponent_b)
            y = half[1] * signed_power(cv, exponent_a) * signed_power(su, exponent_b)
            z = half[2] * signed_power(sv, exponent_a)
            verts.append((location[0] + x, location[1] + y, location[2] + z))
    for ring in range(rings):
        for seg in range(segments):
            a = ring * segments + seg
            b = ring * segments + (seg + 1) % segments
            c = (ring + 1) * segments + (seg + 1) % segments
            d = (ring + 1) * segments + seg
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    item = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(material)
    for poly in item.data.polygons:
        poly.use_smooth = True
    normal = item.modifiers.new(name="hp_viewmodel_superquadric_normals", type="WEIGHTED_NORMAL")
    try:
        bpy.context.view_layer.objects.active = item
        item.select_set(True)
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        pass
    return item


def cylinder_between(name, a, b, radius, material, vertices=40):
    start = Vector(a)
    end = Vector(b)
    mid = (start + end) * 0.5
    length = (end - start).length
    if length <= 1e-5:
        length = 0.001
    rotation = (end - start).to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=mid, rotation=rotation)
    item = bpy.context.object
    item.name = name
    item.data.name = f"{name}_mesh"
    item.data.materials.append(material)
    for poly in item.data.polygons:
        poly.use_smooth = True
    normal = item.modifiers.new(name="hp_viewmodel_weighted_normals", type="WEIGHTED_NORMAL")
    try:
        bpy.context.view_layer.objects.active = item
        item.select_set(True)
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        pass
    return item


def tube_curve(name, points, radius, material, resolution=4):
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 8
    curve.fill_mode = "FULL"
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1)
    item = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(material)
    return item


def smooth_tube_curve(name, points, radius, material, resolution=8):
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 8
    curve.fill_mode = "FULL"
    spline = curve.splines.new("NURBS")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1)
    spline.order_u = min(4, len(points))
    spline.use_endpoint_u = True
    item = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(material)
    return item


def orthonormal_frame(tangent):
    t = Vector(tangent)
    if t.length <= 1e-6:
        t = Vector((0, 0, 1))
    t.normalize()
    helper = Vector((0, 0, 1))
    if abs(t.dot(helper)) > 0.86:
        helper = Vector((0, 1, 0))
    n1 = t.cross(helper)
    if n1.length <= 1e-6:
        n1 = Vector((1, 0, 0))
    n1.normalize()
    n2 = t.cross(n1)
    if n2.length <= 1e-6:
        n2 = Vector((0, 1, 0))
    n2.normalize()
    return n1, n2


def tapered_finger_mesh(name, points, base_radius, material, tip_scale=0.78, oval_scale=1.18, rings=14):
    if len(points) < 2:
        return None
    pts = [Vector(point) for point in points]
    verts = []
    faces = []
    count = len(pts)
    for i, point in enumerate(pts):
        if i == 0:
            tangent = pts[1] - point
        elif i == count - 1:
            tangent = point - pts[i - 1]
        else:
            tangent = pts[i + 1] - pts[i - 1]
        n1, n2 = orthonormal_frame(tangent)
        t = i / max(1, count - 1)
        taper = 1.0 - (1.0 - tip_scale) * (t ** 0.72)
        root_swell = 1.08 if i < 3 else 1.0
        pad_swell = 1.12 if i >= count - 2 else 1.0
        radius = base_radius * taper * root_swell * pad_swell
        for j in range(rings):
            a = 2 * math.pi * j / rings
            # A slightly oval section reads less like a mechanical tube.
            offset = n1 * (math.cos(a) * radius * 0.92) + n2 * (math.sin(a) * radius * oval_scale)
            verts.append(tuple(point + offset))

    for i in range(count - 1):
        for j in range(rings):
            a = i * rings + j
            b = i * rings + (j + 1) % rings
            c = (i + 1) * rings + (j + 1) % rings
            d = (i + 1) * rings + j
            faces.append((a, b, c, d))
    faces.append(tuple(range(rings - 1, -1, -1)))
    end_offset = (count - 1) * rings
    faces.append(tuple(end_offset + j for j in range(rings)))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    item = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(material)
    for poly in item.data.polygons:
        poly.use_smooth = True
    normal = item.modifiers.new(name="hp_viewmodel_tapered_finger_normals", type="WEIGHTED_NORMAL")
    try:
        bpy.context.view_layer.objects.active = item
        item.select_set(True)
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        pass
    return item


def torus_ring(name, location, normal, major, minor, material):
    normal_vec = Vector(normal)
    if normal_vec.length <= 1e-5:
        normal_vec = Vector((0, 0, 1))
    rotation = normal_vec.to_track_quat("Z", "Y").to_euler()
    bpy.ops.mesh.primitive_torus_add(
        major_segments=40,
        minor_segments=8,
        major_radius=major,
        minor_radius=minor,
        location=location,
        rotation=rotation,
    )
    item = bpy.context.object
    item.name = name
    item.data.name = f"{name}_mesh"
    item.data.materials.append(material)
    for poly in item.data.polygons:
        poly.use_smooth = True
    return item


def add_empty(name, location):
    empty = bpy.data.objects.new(name, None)
    empty.empty_display_type = "PLAIN_AXES"
    empty.empty_display_size = 0.08
    empty.location = location
    bpy.context.collection.objects.link(empty)
    return empty


def length(v):
    return math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])


def normalize(v):
    l = length(v)
    if l <= 1e-9:
        return (0, 0, 0)
    return (v[0] / l, v[1] / l, v[2] / l)


def v_add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def v_sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def v_mul(a, s):
    return (a[0] * s, a[1] * s, a[2] * s)


def rounded_box_sdf(p, half, radius):
    q = (
        abs(p[0]) - (half[0] - radius),
        abs(p[1]) - (half[1] - radius),
        abs(p[2]) - (half[2] - radius),
    )
    outside = (max(q[0], 0), max(q[1], 0), max(q[2], 0))
    inside = min(max(q[0], max(q[1], q[2])), 0)
    return length(outside) + inside - radius


def capped_cylinder_sdf_x(p, radius, half_length):
    radial = math.sqrt(p[1] * p[1] + p[2] * p[2]) - radius
    axial = abs(p[0]) - half_length
    outside = math.sqrt(max(radial, 0) ** 2 + max(axial, 0) ** 2)
    return outside + min(max(radial, axial), 0)


def object_sdf(spec, p):
    if spec["kind"] == "baton":
        return capped_cylinder_sdf_x(p, spec["radius"], spec["half"][0])
    return rounded_box_sdf(p, spec["half"], spec["round_radius"])


def object_normal(spec, p):
    eps = 0.0007
    dx = object_sdf(spec, (p[0] + eps, p[1], p[2])) - object_sdf(spec, (p[0] - eps, p[1], p[2]))
    dy = object_sdf(spec, (p[0], p[1] + eps, p[2])) - object_sdf(spec, (p[0], p[1] - eps, p[2]))
    dz = object_sdf(spec, (p[0], p[1], p[2] + eps)) - object_sdf(spec, (p[0], p[1], p[2] - eps))
    return normalize((dx, dy, dz))


def collision_stop(spec, p, clearance):
    gap = object_sdf(spec, p) - clearance
    if gap >= 0:
        return p
    n = object_normal(spec, p)
    return v_add(p, v_mul(n, -gap + 0.0005))


def object_back_z(spec):
    return spec["radius"] if spec["kind"] == "baton" else spec["half"][2]


def object_grip_width(spec):
    return spec["half"][0] * 2


def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for item in objects:
        if item.type != "MESH":
            continue
        for corner in item.bound_box:
            world = item.matrix_world @ Vector(corner)
            mn.x = min(mn.x, world.x)
            mn.y = min(mn.y, world.y)
            mn.z = min(mn.z, world.z)
            mx.x = max(mx.x, world.x)
            mx.y = max(mx.y, world.y)
            mx.z = max(mx.z, world.z)
    return mn, mx


def finger_root_xs(candidate, spec):
    span = min(candidate["palmWidth"] * candidate["spreadScale"], object_grip_width(spec) * 1.55)
    return [-span * 0.45, -span * 0.15, span * 0.15, span * 0.45]


def trace_finger(candidate, spec, finger_index):
    back = object_back_z(spec)
    root_xs = finger_root_xs(candidate, spec)
    root = (
        root_xs[finger_index],
        candidate["rootY"] - finger_index * 0.035,
        back + candidate["fingerRadius"] + candidate["rootGap"],
    )
    points = [root]
    p = root
    lengths = [candidate["fingerLength"] * 0.45, candidate["fingerLength"] * 0.33, candidate["fingerLength"] * 0.22]
    curls = [
        candidate["mcp"] + (0.04 if finger_index == 1 else 0),
        candidate["pip"] + (0.05 if finger_index == 2 else 0),
        candidate["dip"],
    ]
    theta = 0.06 + candidate["curlCascade"] * (finger_index - 1.5)
    for segment, segment_length in enumerate(lengths):
        theta += curls[segment]
        direction = normalize((0, -math.cos(theta), -math.sin(theta)))
        start = p
        end = collision_stop(spec, v_add(start, v_mul(direction, segment_length)), candidate["fingerRadius"])
        for step in range(1, 5):
            t = step / 4
            sample = (
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                start[2] + (end[2] - start[2]) * t,
            )
            points.append(collision_stop(spec, sample, candidate["fingerRadius"]))
        p = end
    return points


def trace_thumb(candidate, spec):
    back = object_back_z(spec)
    side = min(candidate["palmWidth"] * 0.36, spec["half"][0] * 0.72) if spec["kind"] == "baton" else spec["half"][0] + candidate["thumbRadius"]
    root = (
        side + candidate["thumbRadius"] * 0.55,
        candidate["rootY"] * 0.2,
        back + candidate["thumbRadius"] + candidate["rootGap"] * 0.5,
    )
    points = [root]
    p = root
    lengths = [candidate["thumbLength"] * 0.42, candidate["thumbLength"] * 0.34, candidate["thumbLength"] * 0.24]
    yaw = candidate["thumbYaw"]
    for segment, segment_length in enumerate(lengths):
        yaw += candidate["thumbCurl"] * (0.45 if segment == 0 else 0.35 if segment == 1 else 0.22)
        direction = normalize((-math.cos(yaw), -candidate["thumbDrop"], -math.sin(yaw)))
        start = p
        end = collision_stop(spec, v_add(start, v_mul(direction, segment_length)), candidate["thumbRadius"])
        for step in range(1, 5):
            t = step / 4
            sample = (
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                start[2] + (end[2] - start[2]) * t,
            )
            points.append(collision_stop(spec, sample, candidate["thumbRadius"]))
        p = end
    return points


def clamp(value, low, high):
    return max(low, min(high, value))


def direction_candidate(report, direction_id):
    for direction in report.get("directionTopCandidates", []):
        if direction.get("id") != direction_id:
            continue
        for candidate in direction.get("top", []):
            if candidate.get("status") == "pass" and not candidate.get("issues"):
                return candidate
    raise KeyError(direction_id)


def morph_to_geometry_candidate(morph, direction_id):
    params = morph["params"]
    metrics = morph["summaryMetrics"]
    mean_finger = metrics["meanFingerBaseRadius"]
    return {
        "sourceCandidateId": morph["candidateId"],
        "sourceDirection": direction_id,
        "sourceVariant": morph["variantName"],
        "palmWidth": clamp(0.86 + (params["palmShellScale"] - 1.20) * 0.22 + (metrics["palmVisibleAreaFromCamera"] - 0.60) * 0.24, 0.80, 0.98),
        "palmHeight": clamp(0.98 + (params["palmRadiusScale"] - 1.05) * 0.18 + (params["palmLowerRadiusScale"] - 1.02) * 0.14, 0.92, 1.08),
        "palmDepth": clamp(0.36 + (params["palmGripPress"] - 0.30) * 0.12 + (metrics["palmHandleCoverIndex"] - 0.90) * 0.1, 0.32, 0.42),
        "palmOffset": clamp(-0.035 + (params["palmGripPress"] - 0.31) * 0.018, -0.046, -0.018),
        "rootGap": 0.001,
        "fingerRadius": clamp(mean_finger * 0.66, 0.108, 0.132),
        "thumbRadius": clamp(metrics["meanFingerBaseRadius"] * 0.76 + (params["thumbRadiusScale"] - 2.12) * 0.008, 0.118, 0.148),
        "fingerLength": clamp(0.68 + (params["fingerLengthScale"] - 0.56) * 0.72 + (metrics["fingerWrapArcScore"] - 0.82) * 0.08, 0.62, 0.78),
        "thumbLength": clamp(0.42 + (params["thumbOppositionScale"] - 1.26) * 0.14, 0.38, 0.52),
        "taper": clamp(params["fingerTipScale"], 0.74, 0.84),
        "thumbTaper": clamp(params["thumbTipScale"], 0.74, 0.84),
        "mcp": clamp(0.84 + (params["fingerCurlDepth"] - 1.24) * 0.52 + (params["contactTuck"] - 0.11) * 0.7, 0.76, 1.05),
        "pip": clamp(1.04 + (params["fingerCurlDepth"] - 1.24) * 0.72 + (metrics["fingerWrapArcScore"] - 0.82) * 0.28, 0.98, 1.28),
        "dip": clamp(0.50 + (params["fingerCurlDepth"] - 1.24) * 0.34, 0.46, 0.66),
        "curlCascade": clamp((params["fingerSpacingScale"] - 0.78) * 0.45, -0.035, 0.055),
        "thumbYaw": clamp(0.58 + (params["thumbOppositionScale"] - 1.28) * 0.35, 0.54, 0.78),
        "thumbCurl": clamp(0.58 + (params["thumbOppositionScale"] - 1.28) * 0.42, 0.52, 0.82),
        "thumbDrop": clamp(0.075 + (params["contactTuck"] - 0.11) * 0.35, 0.055, 0.12),
        "rootY": clamp(0.24 + (params["palmPlaneBias"] - 0.14) * 0.42, 0.18, 0.31),
        "spreadScale": clamp(0.56 + (params["fingerSpacingScale"] - 0.78) * 0.5, 0.50, 0.66),
        "morphMetrics": metrics,
    }


def build_hand_v2(candidate, spec, materials, prefix):
    back = object_back_z(spec)
    surface_z = back + candidate["palmOffset"]
    palm_width = candidate["palmWidth"] * 0.58
    palm_height = candidate["palmHeight"] * 0.60
    palm_depth = candidate["palmDepth"] * 0.68
    finger_radius = candidate["fingerRadius"] * 0.78
    thumb_radius = candidate["thumbRadius"] * 0.80
    palm_center = (0, 0.0, surface_z + palm_depth * 0.42)

    superquadric(
        f"{prefix}_right_palm_silicone_continuous_shell",
        (palm_width, palm_height, palm_depth),
        palm_center,
        materials["skin"],
        exponent_a=1.06,
        exponent_b=1.12,
        segments=44,
        rings=22,
    )
    superquadric(
        f"{prefix}_thenar_soft_thumb_pad",
        (palm_width * 0.36, palm_height * 0.32, palm_depth * 0.34),
        (palm_width * 0.26, candidate["rootY"] * 0.06, surface_z + palm_depth * 0.38),
        materials["skin"],
        exponent_a=0.9,
        exponent_b=1.05,
        segments=32,
        rings=16,
    )
    superquadric(
        f"{prefix}_hypothenar_outer_palm_pad",
        (palm_width * 0.28, palm_height * 0.34, palm_depth * 0.24),
        (-palm_width * 0.28, -palm_height * 0.05, surface_z + palm_depth * 0.35),
        materials["skin_shadow"],
        exponent_a=0.92,
        exponent_b=1.08,
        segments=28,
        rings=14,
    )
    superquadric(
        f"{prefix}_wrist_silicone_cuff",
        (palm_width * 0.58, palm_height * 0.23, palm_depth * 0.58),
        (0, -palm_height * 0.60, surface_z + palm_depth * 0.46),
        materials["skin"],
        exponent_a=1.05,
        exponent_b=1.05,
        segments=30,
        rings=14,
    )
    cylinder_between(
        f"{prefix}_wrist_subtle_inner_axis",
        (-palm_width * 0.22, -palm_height * 0.72, surface_z + palm_depth * 0.44),
        (palm_width * 0.22, -palm_height * 0.72, surface_z + palm_depth * 0.44),
        finger_radius * 0.18,
        materials["wrist"],
        vertices=24,
    )

    for index, name in enumerate(["index", "middle", "ring", "pinky"]):
        points = trace_finger(candidate, spec, index)
        radius = finger_radius * (1.02 - index * 0.045)
        tapered_finger_mesh(
            f"{prefix}_right_{name}_tapered_silicone_finger",
            points,
            radius,
            materials["skin"],
            tip_scale=clamp(candidate["taper"] - index * 0.015, 0.72, 0.84),
            oval_scale=1.16,
        )
        superquadric(
            f"{prefix}_right_{name}_root_continuity_blend",
            (radius * 1.95, radius * 1.35, radius * 1.28),
            points[0],
            materials["skin"],
            exponent_a=0.9,
            exponent_b=1.05,
            segments=20,
            rings=10,
        )
        superquadric(
            f"{prefix}_right_{name}_soft_fingertip_pad",
            (radius * 1.28, radius * 1.12, radius * 1.42),
            points[-1],
            materials["skin"],
            exponent_a=0.86,
            exponent_b=1.0,
            segments=18,
            rings=10,
        )

    thumb_points = trace_thumb(candidate, spec)
    tapered_finger_mesh(
        f"{prefix}_right_thumb_tapered_opposition_finger",
        thumb_points,
        thumb_radius,
        materials["skin"],
        tip_scale=candidate["thumbTaper"],
        oval_scale=1.18,
    )
    superquadric(
        f"{prefix}_right_thumb_thenar_root_blend",
        (thumb_radius * 2.2, thumb_radius * 1.35, thumb_radius * 1.55),
        thumb_points[0],
        materials["skin"],
        exponent_a=0.9,
        exponent_b=1.05,
        segments=22,
        rings=12,
    )
    superquadric(
        f"{prefix}_right_thumb_soft_tip_pad",
        (thumb_radius * 1.24, thumb_radius * 1.12, thumb_radius * 1.38),
        thumb_points[-1],
        materials["skin"],
        exponent_a=0.86,
        exponent_b=1.0,
        segments=18,
        rings=10,
    )

    add_empty(f"{prefix}_right_palm_contact_socket", (0, 0, surface_z))
    add_empty(f"{prefix}_right_thumb_clamp_socket", thumb_points[min(6, len(thumb_points) - 1)])
    add_empty(f"{prefix}_source_candidate_{candidate['sourceCandidateId']}", (0, 0, 0))


def build_hand_v3(candidate, spec, materials, prefix):
    """Stable glove-grip generator.

    The v2 morphology search is still used for candidate provenance, but this
    visual layer intentionally switches to a simpler contact-first construction:
    palm outside the handle, four short thick fingers wrapping the front, and a
    visible opposed thumb. This avoids the bead/tube failure mode from separate
    joint primitives.
    """
    if spec["kind"] == "baton":
        handle_radius = spec["radius"]
        palm_width = 0.64
        palm_height = 0.44
        palm_depth = 0.18
        palm_center = (0.0, 0.0, handle_radius + palm_depth * 0.58)
        finger_radius = 0.074
        thumb_radius = 0.086

        superquadric(
            f"{prefix}_right_palm_continuous_glove_shell",
            (palm_width, palm_height, palm_depth),
            palm_center,
            materials["skin"],
            exponent_a=0.82,
            exponent_b=0.9,
            segments=44,
            rings=20,
        )
        superquadric(
            f"{prefix}_thenar_thumb_mass",
            (0.22, 0.22, 0.11),
            (0.24, 0.06, handle_radius + 0.12),
            materials["skin_shadow"],
            exponent_a=0.82,
            exponent_b=0.9,
            segments=28,
            rings=12,
        )
        superquadric(
            f"{prefix}_wrist_soft_cuff",
            (0.36, 0.24, 0.16),
            (-0.42, 0.0, handle_radius + 0.08),
            materials["skin"],
            exponent_a=0.9,
            exponent_b=0.9,
            segments=28,
            rings=12,
        )
        cylinder_between(
            f"{prefix}_wrist_subtle_machine_axis",
            (-0.56, -0.08, handle_radius + 0.08),
            (-0.56, 0.08, handle_radius + 0.08),
            0.026,
            materials["wrist"],
            vertices=24,
        )

        finger_xs = [-0.23, -0.075, 0.075, 0.23]
        for index, x in enumerate(finger_xs):
            r = finger_radius * (1.04 - index * 0.035)
            points = [
                (x, -0.16, handle_radius + 0.13),
                (x, -0.11, handle_radius + 0.04),
                (x, -0.04, -handle_radius * 0.55),
                (x, 0.06, -handle_radius - 0.035),
            ]
            smooth_tube_curve(f"{prefix}_right_finger_{index + 1}_single_piece_wrap", points, r, materials["skin"])

        thumb_points = [
            (0.28, 0.17, handle_radius + 0.12),
            (0.17, 0.12, handle_radius + 0.02),
            (0.06, 0.08, -handle_radius * 0.48),
            (-0.05, 0.03, -handle_radius - 0.025),
        ]
        smooth_tube_curve(f"{prefix}_right_thumb_opposed_grip", thumb_points, thumb_radius, materials["skin"])
        add_empty(f"{prefix}_right_palm_contact_socket", (0, 0, handle_radius + 0.01))
        add_empty(f"{prefix}_right_thumb_clamp_socket", thumb_points[2])
        add_empty(f"{prefix}_source_candidate_{candidate['sourceCandidateId']}", (0, 0, 0))
        return

    half_x, half_y, half_z = spec["half"]
    side = 1.0
    palm_thickness = clamp(half_x * 0.95, 0.13, 0.17)
    palm_span_y = clamp(half_y * 1.02, 0.42, 0.54)
    palm_span_z = clamp(half_z * 2.18, 0.38, 0.48)
    palm_center = (side * (half_x + palm_thickness * 0.58), 0.0, -0.02)
    finger_radius = clamp(half_x * 0.45, 0.062, 0.076)
    thumb_radius = finger_radius * 1.12

    superquadric(
        f"{prefix}_right_palm_continuous_glove_shell",
        (palm_thickness, palm_span_y, palm_span_z),
        palm_center,
        materials["skin"],
        exponent_a=0.82,
        exponent_b=0.9,
        segments=48,
        rings=22,
    )
    superquadric(
        f"{prefix}_wrist_soft_cuff",
        (palm_thickness * 1.08, 0.25, palm_span_z * 0.58),
        (side * (half_x + palm_thickness * 0.60), -half_y - 0.14, -palm_span_z * 0.26),
        materials["skin"],
        exponent_a=0.9,
        exponent_b=0.9,
        segments=30,
        rings=12,
    )
    cylinder_between(
        f"{prefix}_wrist_subtle_machine_axis",
        (side * (half_x + palm_thickness * 0.60), -half_y - 0.24, -palm_span_z * 0.42),
        (side * (half_x + palm_thickness * 0.60), -half_y - 0.24, -palm_span_z * 0.08),
        finger_radius * 0.28,
        materials["wrist"],
        vertices=24,
    )

    # In Blender world space the hand must live on the side of the grip. Four
    # short thick fingers are stacked along the vertical grip read and wrap
    # around the front edge instead of sitting on top of the pistol.
    finger_zs = [palm_span_z * 0.27, palm_span_z * 0.08, -palm_span_z * 0.10, -palm_span_z * 0.28]
    finger_names = ["index", "middle", "ring", "pinky"]
    for index, (name, z) in enumerate(zip(finger_names, finger_zs)):
        r = finger_radius * (1.05 - index * 0.045)
        points = [
            (side * (half_x + palm_thickness * 0.62), palm_span_y * 0.22, z),
            (side * (half_x + palm_thickness * 0.54), -half_y * 0.20, z - 0.012),
            (side * (half_x * 0.18), -half_y - r * 0.30, z - 0.010),
            (-side * (half_x + r * 0.20), -half_y * 0.66, z + 0.004),
        ]
        smooth_tube_curve(f"{prefix}_right_{name}_short_fat_contact_finger", points, r, materials["skin"])

    thumb_points = [
        (side * (half_x + palm_thickness * 0.76), palm_span_y * 0.26, palm_span_z * 0.12),
        (side * (half_x + palm_thickness * 0.48), half_y * 0.30, palm_span_z * 0.02),
        (side * (half_x * 0.20), half_y * 0.48, -palm_span_z * 0.12),
        (-side * (half_x * 0.34), half_y * 0.26, -palm_span_z * 0.17),
    ]
    smooth_tube_curve(f"{prefix}_right_thumb_visible_side_clamp", thumb_points, thumb_radius, materials["skin"])
    add_empty(f"{prefix}_right_palm_contact_socket", (side * (half_x + 0.004), 0, 0))
    add_empty(f"{prefix}_right_thumb_clamp_socket", thumb_points[2])
    add_empty(f"{prefix}_source_candidate_{candidate['sourceCandidateId']}", (0, 0, 0))


def build_hand(candidate, spec, materials, prefix):
    back = object_back_z(spec)
    surface_z = back + candidate["palmOffset"]
    palm_width = candidate["palmWidth"] * 0.66
    palm_height = candidate["palmHeight"] * 0.70
    palm_depth = candidate["palmDepth"] * 0.74
    finger_radius = candidate["fingerRadius"] * 0.78
    thumb_radius = candidate["thumbRadius"] * 0.82
    palm_center = (0, 0.015, surface_z + palm_depth * 0.5)
    palm = superquadric(
        f"{prefix}_right_palm_continuous_shell",
        (palm_width, palm_height, palm_depth),
        palm_center,
        materials["skin"],
        exponent_a=0.98,
        exponent_b=1.05,
    )
    rounded_box(
        f"{prefix}_thenar_thumb_mound",
        (palm_width * 0.34, palm_height * 0.34, palm_depth * 0.2),
        (palm_width * 0.29, candidate["rootY"] * 0.08, surface_z + palm_depth * 0.13),
        materials["skin_shadow"],
        bevel=0.075,
        rotation=(0, 0, -0.18),
    )
    rounded_box(
        f"{prefix}_wrist_silicone_cuff",
        (palm_width * 0.62, palm_height * 0.22, palm_depth * 0.66),
        (0, -palm_height * 0.61, surface_z + palm_depth * 0.43),
        materials["skin"],
        bevel=0.065,
    )
    cylinder_between(
        f"{prefix}_wrist_inner_machine_axis",
        (-palm_width * 0.24, -palm_height * 0.71, surface_z + palm_depth * 0.43),
        (palm_width * 0.24, -palm_height * 0.71, surface_z + palm_depth * 0.43),
        finger_radius * 0.24,
        materials["wrist"],
        vertices=28,
    )
    torus_ring(
        f"{prefix}_wrist_dark_seam_ring",
        (0, -palm_height * 0.49, surface_z + palm_depth * 0.42),
        (0, 1, 0),
        palm_width * 0.29,
        0.004,
        materials["seam"],
    )

    for index, name in enumerate(["index", "middle", "ring", "pinky"]):
        points = trace_finger(candidate, spec, index)
        radius = finger_radius * (1.0 - index * 0.035)
        tube_curve(f"{prefix}_right_{name}_continuous_pad_chain", points, radius, materials["skin"])
        for joint_index in (4, 8):
            if joint_index < len(points) - 1:
                tangent = v_sub(points[min(joint_index + 1, len(points) - 1)], points[max(joint_index - 1, 0)])
                torus_ring(
                    f"{prefix}_right_{name}_subtle_joint_seam_{joint_index}",
                    points[joint_index],
                    tangent,
                    radius * 1.02,
                    0.003,
                    materials["seam"],
                )
        rounded_box(
            f"{prefix}_right_{name}_root_blend_pad",
            (radius * 1.7, radius * 1.15, radius * 1.1),
            points[0],
            materials["skin"],
            bevel=radius * 0.42,
        )

    thumb_points = trace_thumb(candidate, spec)
    tube_curve(f"{prefix}_right_thumb_opposition_pad_chain", thumb_points, thumb_radius, materials["skin"])
    for joint_index in (4, 8):
        if joint_index < len(thumb_points) - 1:
            tangent = v_sub(thumb_points[min(joint_index + 1, len(thumb_points) - 1)], thumb_points[max(joint_index - 1, 0)])
            torus_ring(
                f"{prefix}_right_thumb_subtle_joint_seam_{joint_index}",
                thumb_points[joint_index],
                tangent,
                thumb_radius * 1.02,
                0.003,
                materials["seam"],
            )
    rounded_box(
        f"{prefix}_right_thumb_root_blend_mound",
        (thumb_radius * 2.0, thumb_radius * 1.28, thumb_radius * 1.32),
        thumb_points[0],
        materials["skin"],
        bevel=thumb_radius * 0.46,
        rotation=(0, 0, 0.18),
    )
    add_empty(f"{prefix}_right_palm_contact_socket", (0, 0, surface_z))
    add_empty(f"{prefix}_right_thumb_clamp_socket", thumb_points[min(6, len(thumb_points) - 1)])
    return palm


def build_sidearm(candidate, spec, materials):
    if not WEBGPU_SIDEARM_PATH.exists():
        raise FileNotFoundError(WEBGPU_SIDEARM_PATH)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(WEBGPU_SIDEARM_PATH))
    imported = [item for item in bpy.context.scene.objects if item not in before]
    for item in list(imported):
        lower_name = item.name.lower()
        is_fx = any(token in lower_name for token in ("muzzle_flash", "beam_core", "beam_shell", "beam_visible"))
        if (item.name == "Cube" and item.type == "MESH") or is_fx:
            bpy.data.objects.remove(item, do_unlink=True)
            imported.remove(item)

    grip_parts = [item for item in imported if item.type == "MESH" and "sidearm_grip" in item.name]
    if not grip_parts:
        grip_parts = [item for item in imported if item.type == "MESH"]
    mn, mx = mesh_bbox(grip_parts)
    grip_center = (mn + mx) * 0.5
    rotation = Matrix.Rotation(-math.pi / 2, 4, "X")
    rotated_center = rotation @ grip_center
    transform = Matrix.Translation(-rotated_center) @ rotation
    for item in imported:
        item.matrix_world = transform @ item.matrix_world
        item.name = f"hp_previous_{item.name}"
        if item.type == "MESH":
            item.data.name = f"{item.name}_mesh"
    measured_min, measured_max = mesh_bbox(grip_parts)
    measured_half = (measured_max - measured_min) * 0.5
    add_empty("hp_sidearm_muzzle_socket", (0, 0.95, -0.72))
    add_empty("hp_sidearm_grip_socket", (0, 0, 0))
    return {
        "kind": "pistol",
        "half": (measured_half.x, measured_half.y, measured_half.z),
        "radius": 0.0,
        "round_radius": min(measured_half.x, measured_half.z) * 0.18,
    }


def build_baton(candidate, spec, materials):
    radius = spec["radius"]
    cylinder_between("hp_baton_grip_collision_checked", (-0.62, 0, 0), (0.62, 0, 0), radius, materials["rubber"], vertices=48)
    cylinder_between("hp_baton_left_shaft_dark", (-1.25, 0, 0), (-0.62, 0, 0), radius * 0.72, materials["metal"], vertices=40)
    cylinder_between("hp_baton_right_shaft_dark", (0.62, 0, 0), (1.08, 0, 0), radius * 0.72, materials["metal"], vertices=40)
    cylinder_between("hp_baton_impact_head_textured", (1.08, 0, 0), (1.38, 0, 0), radius * 1.08, materials["metal_edge"], vertices=48)
    cylinder_between("hp_baton_impact_face", (1.38, 0, 0), (1.48, 0, 0), radius * 1.16, materials["metal_edge"], vertices=48)
    for i, x in enumerate([-0.48, -0.3, -0.12, 0.06, 0.24, 0.42]):
        torus_ring(f"hp_baton_grip_wrap_ring_{i}", (x, 0, 0), (1, 0, 0), radius * 1.02, 0.01, materials["seam"])
    for i, x in enumerate([1.12, 1.24, 1.36]):
        torus_ring(f"hp_baton_amber_impact_tick_{i}", (x, 0, 0), (1, 0, 0), radius * 1.16, 0.008, materials["amber"])
    add_empty("hp_baton_right_hand_grip_socket", (0, 0, 0))
    add_empty("hp_baton_hit_tip_socket", (1.5, 0, 0))
    add_empty("hp_baton_trail_mid_socket", (1.12, 0, 0))
    return spec


def convert_curves_to_meshes():
    bpy.ops.object.select_all(action="DESELECT")
    curves = [item for item in bpy.context.scene.objects if item.type == "CURVE"]
    for item in curves:
        item.select_set(True)
    if curves:
        bpy.context.view_layer.objects.active = curves[0]
        bpy.ops.object.convert(target="MESH")
    for item in bpy.context.scene.objects:
        if item.type == "MESH":
            for poly in item.data.polygons:
                poly.use_smooth = True


def setup_lighting():
    bpy.ops.object.light_add(type="AREA", location=(0.2, -2.7, 3.6))
    key = bpy.context.object
    key.name = "hp_preview_large_softbox"
    key.data.energy = 520
    key.data.size = 4.5
    bpy.ops.object.light_add(type="POINT", location=(-1.8, 1.4, 1.0))
    rim = bpy.context.object
    rim.name = "hp_preview_cyan_rim"
    rim.data.energy = 95
    rim.data.color = (0.35, 0.9, 1.0)
    bpy.context.scene.world.color = (0.035, 0.055, 0.06)


def set_preview_camera(location=(2.25, -2.25, 1.35), target=(0.25, 0.1, 0.2), lens=50):
    camera = bpy.context.scene.camera
    if camera is None:
        bpy.ops.object.camera_add(location=location)
        camera = bpy.context.object
        camera.name = "hp_viewmodel_preview_camera"
        bpy.context.scene.camera = camera
    camera.location = location
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = lens
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1000
    bpy.context.scene.eevee.taa_render_samples = 64
    return camera


def setup_lighting_and_camera(target=(0.25, 0.1, 0.2)):
    setup_lighting()
    set_preview_camera(target=target)


QA_VIEWS = {
    "first_person": ((2.25, -2.25, 1.35), (0.25, 0.1, 0.2), 50),
    "palm_front": ((0.0, -2.8, 0.72), (0.0, -0.03, 0.28), 62),
    "back_hand": ((0.0, 2.8, 0.72), (0.0, -0.02, 0.30), 62),
    "left_side": ((-2.8, -0.25, 0.68), (0.0, -0.03, 0.28), 62),
    "right_side": ((2.8, -0.25, 0.68), (0.0, -0.03, 0.28), 62),
    "top": ((0.0, -0.15, 3.25), (0.0, -0.03, 0.16), 58),
    "grip_close": ((1.28, -1.35, 0.82), (0.06, -0.02, 0.18), 78),
    "reload_diag": ((-1.65, -2.0, 1.08), (0.0, -0.06, 0.2), 60),
}


def export_scene(glb_path, png_path, blend_path, qa_prefix=None):
    convert_curves_to_meshes()
    setup_lighting_and_camera()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.context.scene.render.filepath = str(png_path)
    bpy.ops.render.render(write_still=True)
    qa_paths = []
    if qa_prefix:
        for view_name, (location, target, lens) in QA_VIEWS.items():
            set_preview_camera(location=location, target=target, lens=lens)
            view_path = RENDER_ROOT / f"{qa_prefix}_{view_name}.png"
            bpy.context.scene.render.filepath = str(view_path)
            bpy.ops.render.render(write_still=True)
            qa_paths.append(str(view_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
    )
    print(f"generated {glb_path}")
    print(f"rendered {png_path}")
    for qa_path in qa_paths:
        print(f"qa_rendered {qa_path}")


def case_best(report, case_id):
    for entry in report["cases"]:
        if entry["id"] == case_id:
            return entry["best"]["candidate"]
    raise KeyError(case_id)


def build_asset(asset_id, case_id, builder):
    with REPORT_PATH.open() as file:
        report = json.load(file)
    candidate = case_best(report, case_id)
    spec = CASE_SPECS[case_id]
    reset_scene()
    materials = create_materials()
    builder(candidate, spec, materials)
    build_hand(candidate, spec, materials, asset_id)
    export_scene(
        MODEL_ROOT / f"{asset_id}.glb",
        RENDER_ROOT / f"{asset_id}.png",
        BLEND_ROOT / f"{asset_id}.blend",
    )


def write_v2_manifest(asset_id, direction_id, morph, candidate, glb_path, blend_path, grip_spec=None):
    manifest_path = ROOT / "src" / "assets" / "manifests" / f"{asset_id}_qa.json"
    qa_renders = {view: str(RENDER_ROOT / f"{asset_id}_{view}.png") for view in QA_VIEWS}
    manifest = {
        "schema": "human-protocol/viewmodel-hand-blender-qa@2",
        "assetId": asset_id,
        "direction": direction_id,
        "sourceCandidateId": morph["candidateId"],
        "sourceVariant": morph["variantName"],
        "sourceScore": morph["score"],
        "directionScore": morph["directionScores"].get(direction_id),
        "issues": morph["issues"],
        "sourceMetrics": morph["summaryMetrics"],
        "geometryCandidate": candidate,
        "measuredGripSpec": grip_spec,
        "glb": str(glb_path),
        "blend": str(blend_path),
        "preview": str(RENDER_ROOT / f"{asset_id}.png"),
        "qaRenders": qa_renders,
        "acceptanceNotes": [
            "Generated from a 20M hard-pass direction winner.",
            "Visual layer uses a contact-first continuous glove shell built from the measured grip proxy.",
            "Reject in render QA if palm is hidden, fingers float, or the hand reads as bead fingers.",
            "Use palm_grip_cover alternate if the pistol grip is still not visibly wrapped.",
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"qa_manifest {manifest_path}")


def build_v2_asset(asset_id, direction_id, case_id, builder):
    with MORPH_REPORT_PATH.open() as file:
        report = json.load(file)
    morph = direction_candidate(report, direction_id)
    candidate = morph_to_geometry_candidate(morph, direction_id)
    spec = CASE_SPECS[case_id]
    reset_scene()
    materials = create_materials()
    measured_spec = builder(candidate, spec, materials) or spec
    build_hand_v3(candidate, measured_spec, materials, asset_id)
    glb_path = MODEL_ROOT / f"{asset_id}.glb"
    blend_path = BLEND_ROOT / f"{asset_id}.blend"
    export_scene(
        glb_path,
        RENDER_ROOT / f"{asset_id}.png",
        blend_path,
        qa_prefix=asset_id,
    )
    write_v2_manifest(asset_id, direction_id, morph, candidate, glb_path, blend_path, measured_spec)


def main():
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    RENDER_ROOT.mkdir(parents=True, exist_ok=True)
    BLEND_ROOT.mkdir(parents=True, exist_ok=True)
    build_v2_asset("hp_sim_hand_sidearm_low_risk_v2", "low_risk_balanced", "pistol_compact_narrow", build_sidearm)
    build_v2_asset("hp_sim_hand_baton_low_risk_v2", "low_risk_balanced", "baton_slim", build_baton)


if __name__ == "__main__":
    main()
