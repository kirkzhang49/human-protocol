#!/usr/bin/env python3
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import bpy
from mathutils import Euler, Vector


REPO_ROOT = Path(__file__).resolve().parents[2]
INTAKE_DIR = REPO_ROOT / "work" / "asset-intake" / "level05-reclamation-mother-v1"

OUTPUT_DIR = INTAKE_DIR / "derived"
OUTPUT_GLB = OUTPUT_DIR / "hp_enemy_reclamation_mother_rig_v1.glb"
OUTPUT_BLEND = OUTPUT_DIR / "hp_enemy_reclamation_mother_rig_v1.blend"
REPORT_PATH = INTAKE_DIR / "reclamation_mother_rig_build_report.json"
CONTROL_POINTS_PATH = INTAKE_DIR / "reclamation_mother_kmeans_control_points.json"

CLIPS = [
    "idle",
    "move",
    "attack_windup",
    "attack_strike",
    "attack_combo_downslam",
    "attack_sweep",
    "attack_recover",
    "hit_light",
    "hit_heavy",
    "stagger",
    "death",
    "spawn_boot",
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures, bpy.data.actions):
        for item in list(datablocks):
            datablocks.remove(item)


def set_principled(material, socket_names, value):
    if not material.use_nodes:
        material.use_nodes = True
    node = material.node_tree.nodes.get("Principled BSDF")
    if not node:
        node = next((candidate for candidate in material.node_tree.nodes if candidate.type == "BSDF_PRINCIPLED"), None)
    if not node:
        return
    for name in socket_names:
        socket = node.inputs.get(name)
        if socket:
            socket.default_value = value
            return


def make_material(name, color, metallic, roughness, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    set_principled(material, ["Base Color"], color)
    set_principled(material, ["Metallic"], metallic)
    set_principled(material, ["Roughness"], roughness)
    if emission is not None:
        set_principled(material, ["Emission Color"], emission)
        set_principled(material, ["Emission Strength"], emission_strength)
    return material


def build_materials():
    return {
        "body": make_material("mat_bone_white_curved_armor", (0.82, 0.84, 0.80, 1), 0.42, 0.46),
        "body_shadow": make_material("mat_worn_white_edge_shadow", (0.62, 0.65, 0.61, 1), 0.36, 0.56),
        "dark": make_material("mat_black_inner_frame", (0.035, 0.038, 0.04, 1), 0.74, 0.36),
        "trim": make_material("mat_warm_brushed_edge_trim", (0.52, 0.47, 0.38, 1), 0.78, 0.33),
        "gunmetal": make_material("mat_graphite_joint_housing", (0.09, 0.095, 0.10, 1), 0.88, 0.29),
        "rubber": make_material("mat_deep_rubber_joint_gaps", (0.007, 0.007, 0.007, 1), 0.10, 0.72),
        "cyan": make_material("mat_blue_scanner_emissive", (0.28, 0.48, 0.82, 1), 0.32, 0.22, (0.10, 0.32, 0.95, 1), 0.70),
        "amber": make_material("mat_faint_amber_status_emissive", (0.62, 0.50, 0.30, 1), 0.55, 0.38, (0.72, 0.42, 0.08, 1), 0.20),
        "red": make_material("mat_fault_red_hidden_emissive", (0.52, 0.035, 0.025, 1), 0.42, 0.32, (0.9, 0.03, 0.02, 1), 0.45),
        "glass": make_material("mat_core_blue_glass", (0.32, 0.62, 1.0, 0.70), 0.22, 0.10, (0.08, 0.30, 1.0, 1), 0.75),
    }


def empty(name, location, parent=None, display_size=0.06):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = display_size
    obj.location = location
    bpy.context.collection.objects.link(obj)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def parent_keep_world(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse = parent.matrix_world.inverted()
    obj.matrix_world = world


def apply_bevel_and_normals(obj, bevel=0.012, segments=1):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    if bevel > 0:
        mod = obj.modifiers.new(name="hp_reclamation_edge_bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.affect = "EDGES"
        mod.harden_normals = True
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception:
            obj.modifiers.remove(mod)
    normal = obj.modifiers.new(name="hp_reclamation_weighted_normals", type="WEIGHTED_NORMAL")
    normal.keep_sharp = True
    try:
        bpy.ops.object.modifier_apply(modifier=normal.name)
    except Exception:
        obj.modifiers.remove(normal)


def cube(name, location, scale, material, parent=None, rotation=(0, 0, 0), bevel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.scale = scale
    obj.data.materials.append(material)
    apply_bevel_and_normals(obj, bevel=bevel, segments=1)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def foot_wedge(name, location, scale, material, parent=None, rotation=(0, 0, 0)):
    sx, sy, sz = scale
    verts = [
        (-sx * 0.55, -sy, -sz),
        (sx * 0.55, -sy, -sz),
        (-sx, sy, -sz),
        (sx, sy, -sz),
        (-sx * 0.42, -sy, sz * 0.20),
        (sx * 0.42, -sy, sz * 0.20),
        (-sx * 0.88, sy, sz),
        (sx * 0.88, sy, sz),
    ]
    faces = [
        (0, 1, 3, 2),
        (4, 6, 7, 5),
        (0, 4, 5, 1),
        (2, 3, 7, 6),
        (0, 2, 6, 4),
        (1, 5, 7, 3),
    ]
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    obj.data.materials.append(material)
    apply_bevel_and_normals(obj, bevel=0.012, segments=1)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def cylinder(name, location, radius, depth, material, parent=None, rotation=(0, 0, 0), vertices=32, bevel=False):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if bevel:
        apply_bevel_and_normals(obj, bevel=0.006, segments=1)
    else:
        normal = obj.modifiers.new(name="hp_reclamation_weighted_normals", type="WEIGHTED_NORMAL")
        try:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=normal.name)
        except Exception:
            obj.modifiers.remove(normal)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def cylinder_between(name, start, end, radius, material, parent=None, vertices=18, bevel=False):
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    length = direction.length
    if length <= 0.0001:
        return sphere(name, start, (radius, radius, radius), material, parent, segments=vertices, rings=8)
    midpoint = start + direction * 0.5
    rotation = direction.to_track_quat("Z", "Y").to_euler()
    return cylinder(name, midpoint, radius, length, material, parent, rotation=rotation, vertices=vertices, bevel=bevel)


def sphere(name, location, scale, material, parent=None, segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.scale = scale
    obj.data.materials.append(material)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if parent:
        parent_keep_world(obj, parent)
    return obj


def armor_plate(name, location, scale, material, parent=None, rotation=(0, 0, 0), faceted=False):
    sx, sy, sz = scale
    profile = [
        (-0.42, 0.98),
        (-0.88, 0.58),
        (-1.00, 0.06),
        (-0.82, -0.46),
        (-0.34, -0.96),
        (0.28, -0.90),
        (0.80, -0.48),
        (1.00, 0.08),
        (0.76, 0.64),
        (0.24, 0.96),
    ]
    verts = []
    front_y = -sy * 0.92
    back_y = sy * 0.70
    for x, z in profile:
        verts.append((x * sx, front_y, z * sz))
    for x, z in profile:
        verts.append((x * sx * 0.92, back_y, z * sz * 0.92))
    faces = [tuple(range(len(profile))), tuple(reversed(range(len(profile), len(profile) * 2)))]
    count = len(profile)
    for i in range(count):
        faces.append((i, (i + 1) % count, ((i + 1) % count) + count, i + count))

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
    bevel_width = min(sx, sy, sz) * (0.10 if faceted else 0.07)
    apply_bevel_and_normals(obj, bevel=max(0.003, min(0.018, bevel_width)), segments=1)
    if parent:
        parent_keep_world(obj, parent)
    return obj


def torus(name, location, major, minor, material, parent=None, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=48,
        minor_segments=10,
        major_radius=major,
        minor_radius=minor,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_mesh"
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    if parent:
        parent_keep_world(obj, parent)
    return obj


def add_panel_stripes(parent, materials):
    for side, x in (("left", -0.34), ("right", 0.34)):
        cube(f"mother_{side}_vertical_armor_split", (x, -0.508, 1.82), (0.014, 0.014, 0.30), materials["dark"], parent, bevel=0.002)
        cube(f"mother_{side}_upper_worn_edge", (x * 0.92, -0.525, 2.04), (0.11, 0.010, 0.014), materials["body_shadow"], parent, bevel=0.002)
        cube(f"mother_{side}_lower_worn_edge", (x * 0.72, -0.525, 1.48), (0.08, 0.010, 0.012), materials["trim"], parent, bevel=0.002)


def add_arm(side, shoulder_x, shoulder_y, materials, root):
    sign = -1 if side == "left" else 1
    bulk = 1.16 if side == "left" else 0.94
    drop = 0.08 if side == "left" else -0.02
    shoulder = empty(f"{side}ShoulderPivot", Vector((shoulder_x, shoulder_y, 2.04 + drop)), root)
    upper = empty(f"{side}UpperArmPivot", Vector((shoulder_x + sign * 0.13, -0.04, 1.72 + drop)), shoulder)
    elbow = empty(f"{side}ElbowPivot", Vector((shoulder_x + sign * 0.26, -0.07, 1.34 + drop)), upper)
    wrist = empty(f"{side}WristPivot", Vector((shoulder_x + sign * 0.31, -0.16, 1.02 + drop)), elbow)

    armor_plate(
        f"part_shoulder_shell_{side}",
        (shoulder_x + sign * 0.02, -0.08, 2.06 + drop),
        (0.31 * bulk, 0.135 * bulk, 0.27 * bulk),
        materials["body"],
        shoulder,
        rotation=(0.10, sign * 0.18, sign * 0.20),
        faceted=True,
    )
    armor_plate(
        f"part_upper_arm_white_plate_{side}",
        (shoulder_x + sign * 0.13, -0.065, 1.70 + drop),
        (0.16 * bulk, 0.085 * bulk, 0.29),
        materials["body"],
        upper,
        rotation=(0.20, sign * 0.08, sign * 0.12),
        faceted=True,
    )
    cylinder_between(
        f"part_upper_arm_black_core_{side}",
        (shoulder_x + sign * 0.08, -0.02, 1.90 + drop),
        (shoulder_x + sign * 0.20, -0.06, 1.50 + drop),
        0.070 * bulk,
        materials["rubber"],
        upper,
        vertices=18,
    )
    sphere(f"part_elbow_black_socket_{side}", (shoulder_x + sign * 0.25, -0.07, 1.34 + drop), (0.11 * bulk, 0.10 * bulk, 0.10), materials["rubber"], elbow, segments=24, rings=12)
    armor_plate(
        f"part_forearm_white_cuff_{side}",
        (shoulder_x + sign * 0.28, -0.12, 1.16 + drop),
        (0.16 * bulk, 0.085 * bulk, 0.24),
        materials["body"],
        elbow,
        rotation=(-0.10, sign * 0.08, -sign * 0.08),
        faceted=True,
    )
    cylinder_between(
        f"part_forearm_black_tendon_{side}",
        (shoulder_x + sign * 0.24, -0.08, 1.31 + drop),
        (shoulder_x + sign * 0.32, -0.17, 0.99 + drop),
        0.052 * bulk,
        materials["gunmetal"],
        elbow,
        vertices=16,
    )
    sphere(f"part_wrist_black_knuckle_{side}", (shoulder_x + sign * 0.33, -0.17, 0.95 + drop), (0.074, 0.066, 0.066), materials["rubber"], wrist, segments=18, rings=9)
    for finger, offset in (("outer", sign * 0.030), ("inner", -sign * 0.026)):
        cube(
            f"part_grabber_{side}_{finger}",
            (shoulder_x + sign * (0.36 + abs(offset)), -0.24, 0.89 + drop),
            (0.025, 0.10, 0.060),
            materials["trim"],
            wrist,
            rotation=(0.35, 0.10 * sign, 0.18 * sign),
            bevel=0.005,
        )
    cube(f"part_grabber_palm_{side}", (shoulder_x + sign * 0.34, -0.20, 0.92 + drop), (0.060, 0.050, 0.075), materials["gunmetal"], wrist, bevel=0.008)
    return {"shoulder": shoulder, "upper": upper, "elbow": elbow, "wrist": wrist}


def add_leg(side, hip_x, materials, root):
    sign = -1 if side == "left" else 1
    hip = empty(f"{side}HipPivot", Vector((hip_x, 0.0, 0.98)), root)
    knee = empty(f"{side}KneePivot", Vector((hip_x + sign * 0.06, -0.03, 0.55)), hip)
    ankle = empty(f"{side}AnklePivot", Vector((hip_x + sign * 0.10, -0.08, 0.20)), knee)
    cylinder_between(f"part_thigh_black_core_{side}", (hip_x, 0.0, 0.98), (hip_x + sign * 0.07, -0.03, 0.57), 0.085, materials["rubber"], hip, vertices=18)
    armor_plate(
        f"part_thigh_white_armor_{side}",
        (hip_x + sign * 0.03, -0.055, 0.76),
        (0.15, 0.080, 0.24),
        materials["body"],
        hip,
        rotation=(0.16, sign * 0.08, sign * 0.06),
        faceted=True,
    )
    sphere(f"part_knee_black_socket_{side}", (hip_x + sign * 0.065, -0.04, 0.54), (0.105, 0.095, 0.090), materials["rubber"], knee, segments=18, rings=9)
    armor_plate(
        f"part_shin_white_armor_{side}",
        (hip_x + sign * 0.10, -0.08, 0.36),
        (0.13, 0.070, 0.23),
        materials["body_shadow"],
        knee,
        rotation=(-0.10, sign * 0.04, -sign * 0.06),
        faceted=True,
    )
    cylinder_between(f"part_shin_black_tendon_{side}", (hip_x + sign * 0.06, -0.03, 0.50), (hip_x + sign * 0.12, -0.08, 0.19), 0.055, materials["gunmetal"], knee, vertices=16)
    foot_wedge(f"part_foot_black_wedge_{side}", (hip_x + sign * 0.15, -0.20, 0.095), (0.17, 0.31, 0.075), materials["dark"], ankle, rotation=(0.00, 0, sign * 0.03))
    armor_plate(f"part_heel_white_cap_{side}", (hip_x + sign * 0.06, -0.02, 0.17), (0.10, 0.08, 0.08), materials["body_shadow"], ankle, rotation=(0, 0, sign * 0.08), faceted=True)
    return {"hip": hip, "knee": knee, "ankle": ankle}


def add_utility_arm(index, angle, materials, root):
    radius = 0.36
    x = math.cos(angle) * radius
    y = 0.25 + math.sin(angle) * 0.12
    z = 1.75 + (index % 2) * 0.20
    base = empty(f"utility_arm_{index:02d}_base", Vector((x, y, z)), root, display_size=0.04)
    elbow = empty(f"utility_arm_{index:02d}_elbow", Vector((x * 1.08, y + 0.06, z - 0.22)), base, display_size=0.035)
    wrist = empty(f"utility_arm_{index:02d}_wrist", Vector((x * 1.14, y + 0.10, z - 0.36)), elbow, display_size=0.03)
    cylinder_between(f"utility_arm_{index:02d}_rear_cable_a", (x, y, z), (x * 1.08, y + 0.06, z - 0.22), 0.020, materials["rubber"], base, vertices=12)
    cylinder_between(f"utility_arm_{index:02d}_rear_cable_b", (x * 1.08, y + 0.06, z - 0.22), (x * 1.14, y + 0.10, z - 0.36), 0.017, materials["gunmetal"], elbow, vertices=12)
    cube(f"utility_arm_{index:02d}_recessed_tool", (x * 1.16, y + 0.11, z - 0.40), (0.030, 0.026, 0.050), materials["amber"], wrist, bevel=0.004)
    return {"base": base, "elbow": elbow, "wrist": wrist}


def add_back_crescent(parent, materials):
    points = []
    for step in range(9):
        t = math.radians(38 + step * 13)
        points.append((math.cos(t) * 0.52, 0.24, 1.92 + math.sin(t) * 0.52))
    for index, (start, end) in enumerate(zip(points, points[1:])):
        cylinder_between(f"part_back_crescent_black_spine_{index:02d}", start, end, 0.030, materials["dark"], parent, vertices=14, bevel=True)
    for index, point in enumerate((points[0], points[4], points[-1])):
        armor_plate(
            f"part_back_crescent_white_mount_{index:02d}",
            (point[0], point[1] - 0.03, point[2]),
            (0.085, 0.055, 0.080),
            materials["body_shadow"],
            parent,
            rotation=(0.12, 0.0, 0.22 * (index - 1)),
            faceted=True,
        )


def load_core_controls():
    if not CONTROL_POINTS_PATH.exists():
        return []
    data = json.loads(CONTROL_POINTS_PATH.read_text(encoding="utf-8"))
    return data.get("controls", [])


def control_parent_for(center, nodes):
    x, y, z = center
    if z < 0.52:
        return nodes["leftAnkle"] if x < 0 else nodes["rightAnkle"]
    if z < 1.12:
        return nodes["leftHip"] if x < 0 else nodes["rightHip"]
    if abs(x) > 0.56 and z < 1.95:
        return nodes["leftShoulder"] if x < 0 else nodes["rightShoulder"]
    if z > 2.08:
        return nodes["head"]
    if y > 0.18 and z > 1.45:
        return nodes["halo"]
    return nodes["torso"]


def control_material_for(control, materials):
    x, y, z = control["center"]
    if z < 0.36:
        return materials["dark"]
    if abs(x) > 0.52 and z > 1.10:
        return materials["body"]
    if z > 2.05:
        return materials["body"] if y < 0.18 else materials["body_shadow"]
    if abs(x) < 0.30 and 1.05 < z < 1.95:
        return materials["dark"] if y > -0.08 else materials["body_shadow"]
    if z < 1.05:
        return materials["body_shadow"]
    return materials["body"]


def add_core_point_shells(materials, nodes):
    controls = load_core_controls()
    return {
        "controlPointsAvailable": len(controls),
        "controlShellsAdded": 0,
        "use": "fit proportions and major part placement only; control points are not rendered as visible geometry",
    }


def apply_core_landmark_scale(root):
    blueprint = INTAKE_DIR / "reclamation_mother_core_landmark_blueprint.json"
    if not blueprint.exists():
        return {"applied": False, "reason": "missing core landmark blueprint"}
    data = json.loads(blueprint.read_text(encoding="utf-8"))
    overall = data.get("landmarks", {}).get("overall", {})
    dims = overall.get("dims")
    if not dims or len(dims) != 3:
        return {"applied": False, "reason": "missing overall dims"}

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    for obj in mesh_objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            minv.x = min(minv.x, world.x)
            minv.y = min(minv.y, world.y)
            minv.z = min(minv.z, world.z)
            maxv.x = max(maxv.x, world.x)
            maxv.y = max(maxv.y, world.y)
            maxv.z = max(maxv.z, world.z)
    current = maxv - minv
    if current.x <= 0 or current.y <= 0 or current.z <= 0:
        return {"applied": False, "reason": "invalid current bounds"}

    target_width = dims[1]
    target_depth = dims[0] * 1.10
    target_height = data.get("targetHeightMeters", 2.75) * 0.985
    root.scale = Vector(
        (
            max(0.72, min(1.08, target_width / current.x)),
            max(0.72, min(1.08, target_depth / current.y)),
            max(0.92, min(1.12, target_height / current.z)),
        )
    )
    return {
        "applied": True,
        "targetDimensions": [round(target_width, 4), round(target_depth, 4), round(target_height, 4)],
        "preScaleDimensions": [round(current.x, 4), round(current.y, 4), round(current.z, 4)],
        "rootScale": [round(root.scale.x, 4), round(root.scale.y, 4), round(root.scale.z, 4)],
    }


def build_robot():
    materials = build_materials()
    root = empty("reclamation_mother_root", Vector((0, 0, 0)), None, display_size=0.12)
    pelvis = empty("pelvisPivot", Vector((0, 0, 0.92)), root)
    torso = empty("torsoPivot", Vector((0, -0.04, 1.56)), pelvis)
    head = empty("headSensorPivot", Vector((-0.10, -0.14, 2.21)), torso)
    halo = empty("shoulderHaloPivot", Vector((0, 0.19, 2.00)), torso)
    core = empty("coreWeakpointPivot", Vector((0.22, -0.50, 1.66)), torso)

    armor_plate("part_pelvis_black_inner_mass", (0, -0.02, 0.93), (0.34, 0.25, 0.22), materials["dark"], pelvis, rotation=(0.08, 0, 0), faceted=True)
    armor_plate("part_pelvis_white_keel", (0.02, -0.22, 1.02), (0.18, 0.12, 0.20), materials["body"], pelvis, rotation=(0.18, 0, 0), faceted=True)
    cube("part_pelvis_lower_black_gap", (0, -0.18, 0.80), (0.28, 0.08, 0.08), materials["rubber"], pelvis, bevel=0.010)

    armor_plate("part_torso_black_inner_mass", (0.01, -0.02, 1.66), (0.48, 0.40, 0.52), materials["dark"], torso, rotation=(-0.10, 0.02, -0.02), faceted=True)
    armor_plate("part_chest_left_white_carapace", (-0.18, -0.30, 1.91), (0.34, 0.20, 0.34), materials["body"], torso, rotation=(-0.12, -0.15, 0.16), faceted=True)
    armor_plate("part_chest_right_white_carapace", (0.24, -0.28, 1.82), (0.30, 0.18, 0.31), materials["body"], torso, rotation=(0.08, 0.10, -0.14), faceted=True)
    armor_plate("part_abdomen_white_keel_plate", (0.02, -0.33, 1.35), (0.24, 0.13, 0.30), materials["body_shadow"], torso, rotation=(0.20, 0, 0), faceted=True)
    cube("part_chest_recess_dark", (0.13, -0.455, 1.65), (0.24, 0.050, 0.25), materials["gunmetal"], torso, bevel=0.012)
    sphere("part_core_blue_glass", (0.22, -0.515, 1.67), (0.102, 0.034, 0.102), materials["glass"], core, segments=32, rings=16)
    torus("part_core_dark_socket_ring", (0.22, -0.522, 1.67), 0.120, 0.012, materials["dark"], core, rotation=(math.pi / 2, 0, 0))
    cylinder_between("part_spine_black_actuator", (0, 0.16, 1.00), (0, 0.22, 1.88), 0.070, materials["gunmetal"], pelvis, vertices=24)

    add_back_crescent(halo, materials)
    armor_plate("part_left_overhead_hood_shell", (-0.28, -0.20, 2.27), (0.31, 0.18, 0.23), materials["body"], head, rotation=(-0.16, -0.25, 0.12), faceted=True)
    armor_plate("part_right_head_cheek_shell", (0.13, -0.17, 2.17), (0.19, 0.13, 0.20), materials["body_shadow"], head, rotation=(0.08, 0.18, -0.12), faceted=True)
    armor_plate("part_head_black_visor", (-0.27, -0.392, 2.22), (0.18, 0.042, 0.10), materials["dark"], head, rotation=(-0.03, -0.10, 0.08), faceted=True)
    cylinder("part_head_small_blue_lens", (0.02, -0.365, 2.08), 0.035, 0.055, materials["cyan"], head, rotation=(math.pi / 2, 0, 0), vertices=18)
    armor_plate("part_back_right_white_shoulder_shield", (0.46, 0.05, 2.04), (0.28, 0.21, 0.36), materials["body"], torso, rotation=(0.24, 0.22, -0.16), faceted=True)
    armor_plate("part_back_left_white_shoulder_shield", (-0.55, 0.00, 2.10), (0.34, 0.23, 0.38), materials["body"], torso, rotation=(0.20, -0.20, 0.20), faceted=True)
    add_panel_stripes(torso, materials)

    arms = {
        "left": add_arm("left", -0.58, -0.02, materials, torso),
        "right": add_arm("right", 0.54, -0.02, materials, torso),
    }
    legs = {
        "left": add_leg("left", -0.23, materials, pelvis),
        "right": add_leg("right", 0.25, materials, pelvis),
    }
    utility = [add_utility_arm(i, math.radians(45 + i * 90), materials, torso) for i in range(4)]
    control_report = add_core_point_shells(
        materials,
        {
            "torso": torso,
            "head": head,
            "halo": halo,
            "leftShoulder": arms["left"]["shoulder"],
            "rightShoulder": arms["right"]["shoulder"],
            "leftHip": legs["left"]["hip"],
            "rightHip": legs["right"]["hip"],
            "leftAnkle": legs["left"]["ankle"],
            "rightAnkle": legs["right"]["ankle"],
        },
    )

    for name, location, parent in (
        ("core_glass_weakpoint", Vector((0.22, -0.56, 1.66)), core),
        ("missile_hit_socket", Vector((0.22, -0.64, 1.66)), core),
        ("skill3_lockon_socket", Vector((0.22, -0.74, 1.78)), core),
        ("boss_vfx_center_socket", Vector((0, -0.08, 1.55)), torso),
        ("floor_contact_socket", Vector((0, -0.03, 0.0)), root),
        ("warning_emissive_slots", Vector((0.03, -0.54, 2.02)), torso),
    ):
        empty(name, location, parent, display_size=0.045)

    objects = {
        "root": root,
        "pelvis": pelvis,
        "torso": torso,
        "head": head,
        "halo": halo,
        "core": core,
        "arms": arms,
        "legs": legs,
        "utility": utility,
        "controlReport": control_report,
    }
    return objects


def snapshot_rest():
    rest = {}
    for obj in bpy.context.scene.objects:
        rest[obj.name] = {
            "location": obj.location.copy(),
            "rotation_euler": obj.rotation_euler.copy(),
            "scale": obj.scale.copy(),
        }
    return rest


def apply_pose(obj, rest, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    base = rest[obj.name]
    obj.location = base["location"] + Vector(loc)
    obj.rotation_euler = Euler(
        (
            base["rotation_euler"].x + rot[0],
            base["rotation_euler"].y + rot[1],
            base["rotation_euler"].z + rot[2],
        ),
        "XYZ",
    )
    obj.scale = Vector(
        (
            base["scale"].x * scale[0],
            base["scale"].y * scale[1],
            base["scale"].z * scale[2],
        )
    )


def restore_rest(rest):
    for name, values in rest.items():
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        obj.location = values["location"]
        obj.rotation_euler = values["rotation_euler"]
        obj.scale = values["scale"]
    bpy.context.view_layer.update()


def key_object(obj, rest, frame, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    apply_pose(obj, rest, loc=loc, rot=rot, scale=scale)
    obj.keyframe_insert(data_path="location", frame=frame)
    obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    obj.keyframe_insert(data_path="scale", frame=frame)


def add_clip(clip_name, rest, object_keyframes):
    for name, keyframes in object_keyframes.items():
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        obj.animation_data_create()
        action = bpy.data.actions.new(f"{clip_name}:{name}")
        obj.animation_data.action = action
        for key in keyframes:
            key_object(
                obj,
                rest,
                key["frame"],
                loc=key.get("loc", (0, 0, 0)),
                rot=key.get("rot", (0, 0, 0)),
                scale=key.get("scale", (1, 1, 1)),
            )
        if clip_name in {"attack_strike", "attack_combo_downslam"}:
            for fcurve in getattr(action, "fcurves", []):
                for point in fcurve.keyframe_points:
                    point.interpolation = "LINEAR"
        track = obj.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, 1, action)
        strip.name = clip_name
        strip.extrapolation = "HOLD"
        strip.blend_type = "REPLACE"
        obj.animation_data.action = None
    restore_rest(rest)


def frames(*items):
    return [
        {"frame": frame, **values}
        for frame, values in items
    ]


def build_animations():
    rest = snapshot_rest()
    add_clip("idle", rest, {
        "torsoPivot": frames((1, {"loc": (0, 0, 0), "rot": (0, 0, 0)}), (24, {"loc": (0, -0.012, 0.018), "rot": (0.015, 0, 0)}), (48, {"loc": (0, 0, 0), "rot": (0, 0, 0)})),
        "headSensorPivot": frames((1, {"rot": (0, 0, -0.04)}), (24, {"rot": (0.01, 0, 0.04)}), (48, {"rot": (0, 0, -0.04)})),
        "shoulderHaloPivot": frames((1, {"rot": (0, 0, 0)}), (48, {"rot": (0, 0, 0.16)})),
        "coreWeakpointPivot": frames((1, {"scale": (0.96, 0.96, 0.96)}), (24, {"scale": (1.08, 1.08, 1.08)}), (48, {"scale": (0.96, 0.96, 0.96)})),
    })
    add_clip("move", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, 0, 0)}), (14, {"loc": (0, 0.015, 0.070)}), (28, {"loc": (0, 0, 0)})),
        "leftHipPivot": frames((1, {"rot": (0.42, 0.03, -0.12)}), (14, {"rot": (-0.44, -0.03, 0.10)}), (28, {"rot": (0.42, 0.03, -0.12)})),
        "rightHipPivot": frames((1, {"rot": (-0.44, -0.03, 0.10)}), (14, {"rot": (0.42, 0.03, -0.12)}), (28, {"rot": (-0.44, -0.03, 0.10)})),
        "leftKneePivot": frames((1, {"rot": (-0.30, 0.03, 0.03)}), (14, {"rot": (0.82, -0.03, -0.04)}), (28, {"rot": (-0.30, 0.03, 0.03)})),
        "rightKneePivot": frames((1, {"rot": (0.82, 0.03, 0.04)}), (14, {"rot": (-0.30, -0.03, -0.03)}), (28, {"rot": (0.82, 0.03, 0.04)})),
        "leftAnklePivot": frames((1, {"rot": (0.22, 0, -0.05)}), (14, {"rot": (-0.42, 0, 0.07)}), (28, {"rot": (0.22, 0, -0.05)})),
        "rightAnklePivot": frames((1, {"rot": (-0.42, 0, 0.07)}), (14, {"rot": (0.22, 0, -0.05)}), (28, {"rot": (-0.42, 0, 0.07)})),
        "leftShoulderPivot": frames((1, {"rot": (-0.24, 0.03, -0.10)}), (14, {"rot": (0.28, -0.03, 0.10)}), (28, {"rot": (-0.24, 0.03, -0.10)})),
        "rightShoulderPivot": frames((1, {"rot": (0.28, -0.03, 0.10)}), (14, {"rot": (-0.24, 0.03, -0.10)}), (28, {"rot": (0.28, -0.03, 0.10)})),
        "leftElbowPivot": frames((1, {"rot": (0.16, 0, -0.05)}), (14, {"rot": (-0.20, 0, 0.05)}), (28, {"rot": (0.16, 0, -0.05)})),
        "rightElbowPivot": frames((1, {"rot": (-0.20, 0, 0.05)}), (14, {"rot": (0.16, 0, -0.05)}), (28, {"rot": (-0.20, 0, 0.05)})),
        "leftWristPivot": frames((1, {"rot": (0.08, 0, -0.04)}), (14, {"rot": (-0.10, 0, 0.04)}), (28, {"rot": (0.08, 0, -0.04)})),
        "rightWristPivot": frames((1, {"rot": (-0.10, 0, 0.04)}), (14, {"rot": (0.08, 0, -0.04)}), (28, {"rot": (-0.10, 0, 0.04)})),
    })
    add_clip("attack_windup", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, 0, 0)}), (22, {"loc": (0, -0.004, -0.004)}), (44, {"loc": (0, -0.006, -0.006)})),
        "pelvisPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.025, 0, -0.018)}), (44, {"rot": (0.035, 0, -0.024)})),
        "torsoPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.05, -0.02, -0.05), "loc": (0, -0.004, -0.003)}), (44, {"rot": (0.07, -0.03, -0.075), "loc": (0, -0.006, -0.004)})),
        "leftShoulderPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.18, -0.05, -0.06)}), (44, {"rot": (0.26, -0.08, -0.08)})),
        "leftElbowPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.10, -0.02, -0.02)}), (44, {"rot": (0.14, -0.03, -0.03)})),
        "leftWristPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.05, -0.02, -0.02)}), (44, {"rot": (0.08, -0.03, -0.03)})),
        "rightShoulderPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.44, -0.30, -0.14)}), (44, {"rot": (0.78, -0.64, -0.28)})),
        "rightElbowPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.30, -0.12, -0.08)}), (44, {"rot": (0.48, -0.18, -0.14)})),
        "rightWristPivot": frames((1, {"rot": (0, 0, 0)}), (22, {"loc": (0.06, 0.060, 0.30), "rot": (0.02, -0.02, 0.00)}), (44, {"loc": (0.12, 0.095, 0.50), "rot": (0.04, -0.03, 0.00)})),
        "leftHipPivot": frames((1, {"rot": (0, 0, 0)}), (32, {"rot": (0.04, -0.01, -0.01)})),
        "rightHipPivot": frames((1, {"rot": (0, 0, 0)}), (32, {"rot": (-0.05, 0.01, 0.01)})),
        "leftKneePivot": frames((1, {"rot": (0, 0, 0)}), (32, {"rot": (0.08, 0.01, 0.01)})),
        "rightKneePivot": frames((1, {"rot": (0, 0, 0)}), (32, {"rot": (0.10, -0.01, -0.01)})),
        "leftAnklePivot": frames((1, {"rot": (0, 0, 0)}), (32, {"rot": (-0.03, 0, 0.01)})),
        "rightAnklePivot": frames((1, {"rot": (0, 0, 0)}), (32, {"rot": (0.03, 0, -0.01)})),
        "weaponAttackPlanePivot": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (-1.00, -0.45, -0.18)}), (44, {"rot": (-1.50, -0.80, -0.30)})),
        "weaponSocket": frames((1, {"rot": (0, 0, 0)}), (44, {"rot": (0, 0, 0)})),
        "boss_iron_rod_root": frames((1, {"rot": (0, 0, 0)}), (22, {"rot": (0.00, 0.00, 0.00)}), (44, {"rot": (0.00, 0.00, 0.00)})),
        "coreWeakpointPivot": frames((1, {"scale": (1, 1, 1)}), (32, {"scale": (1.06, 1.06, 1.06)})),
    })
    add_clip("attack_strike", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, -0.006, -0.006)}), (5, {"loc": (-0.010, -0.010, -0.010)}), (11, {"loc": (0.018, 0.018, 0.012)}), (15, {"loc": (0.012, 0.014, 0.010)}), (24, {"loc": (0, -0.001, -0.001)}), (30, {"loc": (0, -0.002, -0.002)})),
        "pelvisPivot": frames((1, {"rot": (0.035, 0, -0.024)}), (5, {"rot": (0.055, -0.01, -0.045)}), (11, {"rot": (-0.040, 0.02, 0.080)}), (15, {"rot": (-0.025, 0.01, 0.060)}), (24, {"rot": (0.018, 0, -0.006)}), (30, {"rot": (0.01, 0, 0)})),
        "torsoPivot": frames((1, {"rot": (0.07, -0.03, -0.075), "loc": (0, -0.006, -0.004)}), (5, {"rot": (0.105, -0.045, -0.115), "loc": (-0.006, -0.008, -0.006)}), (11, {"rot": (-0.185, 0.050, 0.145), "loc": (0.016, 0.012, 0.010)}), (15, {"rot": (-0.125, 0.035, 0.110), "loc": (0.010, 0.008, 0.007)}), (24, {"rot": (0.040, 0.000, -0.020), "loc": (0.002, 0.001, 0.000)}), (30, {"rot": (0.02, 0, -0.01), "loc": (0, 0, 0)})),
        "leftShoulderPivot": frames((1, {"rot": (0.26, -0.08, -0.08)}), (8, {"rot": (0.22, -0.06, -0.06)}), (18, {"rot": (0.10, 0.02, 0.04)}), (30, {"rot": (0.02, 0, 0)})),
        "leftElbowPivot": frames((1, {"rot": (0.14, -0.03, -0.03)}), (8, {"rot": (0.12, -0.02, -0.02)}), (18, {"rot": (0.06, 0.02, 0.02)}), (30, {"rot": (0.01, 0, 0)})),
        "leftWristPivot": frames((1, {"rot": (0.08, -0.03, -0.03)}), (8, {"rot": (0.06, -0.02, -0.02)}), (18, {"rot": (0.03, 0.01, 0.01)}), (30, {"rot": (0.0, 0, 0)})),
        "rightShoulderPivot": frames((1, {"rot": (0.78, -0.64, -0.28)}), (5, {"rot": (0.92, -0.76, -0.34)}), (11, {"rot": (-0.42, 0.24, 0.14)}), (15, {"rot": (-0.30, 0.18, 0.10)}), (24, {"rot": (0.18, -0.04, -0.02)}), (30, {"rot": (0.08, 0.01, 0.01)})),
        "rightElbowPivot": frames((1, {"rot": (0.48, -0.18, -0.14)}), (5, {"rot": (0.58, -0.24, -0.18)}), (11, {"rot": (-0.40, 0.16, 0.10)}), (15, {"rot": (-0.28, 0.12, 0.08)}), (24, {"rot": (0.08, -0.02, -0.02)}), (30, {"rot": (0.03, 0, 0)})),
        "rightWristPivot": frames((1, {"loc": (0.12, 0.095, 0.50), "rot": (0.04, -0.03, 0.00)}), (5, {"loc": (0.15, 0.105, 0.58), "rot": (0.05, -0.04, -0.02)}), (11, {"loc": (-0.02, 0.135, -0.55), "rot": (-0.03, 0.04, 0.02)}), (15, {"loc": (0.00, 0.120, -0.42), "rot": (-0.02, 0.03, 0.01)}), (24, {"loc": (0.02, 0.040, -0.05), "rot": (0.03, -0.01, 0.00)}), (30, {"loc": (0, 0, 0), "rot": (0.02, 0, 0)})),
        "leftHipPivot": frames((1, {"rot": (0.04, -0.01, -0.01)}), (8, {"rot": (-0.02, 0.01, 0.01)}), (18, {"rot": (0.01, 0, 0)})),
        "rightHipPivot": frames((1, {"rot": (-0.05, 0.01, 0.01)}), (8, {"rot": (0.04, -0.01, -0.01)}), (18, {"rot": (-0.01, 0, 0)})),
        "leftKneePivot": frames((1, {"rot": (0.08, 0.01, 0.01)}), (8, {"rot": (0.12, 0.01, 0.01)}), (18, {"rot": (0.01, 0, 0)})),
        "rightKneePivot": frames((1, {"rot": (0.10, -0.01, -0.01)}), (8, {"rot": (0.14, -0.01, -0.01)}), (18, {"rot": (0.05, 0, 0)})),
        "leftAnklePivot": frames((1, {"rot": (-0.03, 0, 0.01)}), (8, {"rot": (0.02, 0, -0.01)}), (18, {"rot": (0.02, 0, 0)})),
        "rightAnklePivot": frames((1, {"rot": (0.03, 0, -0.01)}), (8, {"rot": (-0.02, 0, 0.01)}), (18, {"rot": (0.02, 0, 0)})),
        "weaponAttackPlanePivot": frames((1, {"rot": (-1.50, -0.80, -0.30)}), (5, {"rot": (-1.70, -0.70, -0.10)}), (11, {"rot": (0.18, 0.08, 0.12)}), (15, {"rot": (0.06, 0.02, 0.06)}), (24, {"rot": (-0.10, -0.02, 0.02)}), (30, {"rot": (0.00, 0.00, 0.00)})),
        "weaponSocket": frames((1, {"rot": (0, 0, 0)}), (30, {"rot": (0, 0, 0)})),
        "boss_iron_rod_root": frames((1, {"rot": (0.00, 0.00, 0.00)}), (5, {"rot": (0.02, -0.02, -0.02)}), (11, {"rot": (-0.08, 0.04, 0.05)}), (15, {"rot": (-0.05, 0.03, 0.03)}), (24, {"rot": (0.03, -0.01, 0.00)}), (30, {"rot": (0.02, 0, 0)})),
    })
    add_clip("attack_combo_downslam", rest, {
        "reclamation_mother_root": frames(
            (1, {"loc": (0, -0.005, -0.005)}),
            (12, {"loc": (0, 0.005, 0.006)}),
            (24, {"loc": (0, -0.004, -0.004)}),
            (35, {"loc": (0, 0.006, 0.006)}),
            (47, {"loc": (0, -0.004, -0.004)}),
            (58, {"loc": (0, 0.006, 0.006)}),
            (72, {"loc": (0, -0.002, -0.002)}),
        ),
        "pelvisPivot": frames(
            (1, {"rot": (0.04, 0, -0.025)}),
            (12, {"rot": (0.00, 0, 0.03)}),
            (24, {"rot": (0.035, 0, -0.02)}),
            (35, {"rot": (0.00, 0, 0.035)}),
            (47, {"rot": (0.03, 0, -0.015)}),
            (58, {"rot": (0.00, 0, 0.03)}),
            (72, {"rot": (0.01, 0, 0)}),
        ),
        "torsoPivot": frames(
            (1, {"rot": (0.08, 0.02, -0.05), "loc": (0, -0.006, -0.004)}),
            (12, {"rot": (-0.04, 0.01, 0.04), "loc": (0, 0.004, 0.004)}),
            (24, {"rot": (0.07, 0.02, -0.045), "loc": (0, -0.005, -0.003)}),
            (35, {"rot": (-0.045, 0.01, 0.045), "loc": (0, 0.004, 0.004)}),
            (47, {"rot": (0.06, 0.02, -0.04), "loc": (0, -0.004, -0.003)}),
            (58, {"rot": (-0.04, 0.01, 0.04), "loc": (0, 0.004, 0.004)}),
            (72, {"rot": (0.02, 0, -0.01), "loc": (0, 0, 0)}),
        ),
        "leftShoulderPivot": frames(
            (1, {"rot": (0.24, -0.08, -0.08)}),
            (14, {"rot": (0.08, 0.02, 0.04)}),
            (28, {"rot": (0.22, -0.06, -0.06)}),
            (42, {"rot": (0.08, 0.02, 0.04)}),
            (55, {"rot": (0.20, -0.05, -0.05)}),
            (68, {"rot": (0.08, 0.02, 0.04)}),
            (72, {"rot": (0.02, 0, 0)}),
        ),
        "leftElbowPivot": frames(
            (1, {"rot": (0.12, -0.03, -0.03)}),
            (14, {"rot": (0.04, 0.01, 0.02)}),
            (28, {"rot": (0.10, -0.02, -0.02)}),
            (42, {"rot": (0.04, 0.01, 0.02)}),
            (55, {"rot": (0.09, -0.02, -0.02)}),
            (68, {"rot": (0.04, 0.01, 0.02)}),
            (72, {"rot": (0.01, 0, 0)}),
        ),
        "leftWristPivot": frames(
            (1, {"rot": (0.07, -0.03, -0.03)}),
            (14, {"rot": (0.02, 0.01, 0.01)}),
            (28, {"rot": (0.06, -0.02, -0.02)}),
            (42, {"rot": (0.02, 0.01, 0.01)}),
            (55, {"rot": (0.05, -0.02, -0.02)}),
            (68, {"rot": (0.02, 0.01, 0.01)}),
            (72, {"rot": (0.0, 0, 0)}),
        ),
        "rightShoulderPivot": frames(
            (1, {"rot": (0.78, -0.64, -0.28)}),
            (5, {"rot": (0.92, -0.76, -0.34)}),
            (10, {"rot": (-0.42, 0.24, 0.14)}),
            (15, {"rot": (-0.24, 0.16, 0.08)}),
            (24, {"rot": (0.52, -0.36, -0.18)}),
            (28, {"rot": (0.70, -0.54, -0.24)}),
            (34, {"rot": (-0.38, 0.22, 0.12)}),
            (39, {"rot": (-0.22, 0.14, 0.08)}),
            (50, {"rot": (0.46, -0.30, -0.15)}),
            (55, {"rot": (0.62, -0.46, -0.20)}),
            (61, {"rot": (-0.36, 0.20, 0.11)}),
            (66, {"rot": (-0.20, 0.13, 0.07)}),
            (72, {"rot": (0.08, 0.01, 0.01)}),
        ),
        "rightElbowPivot": frames(
            (1, {"rot": (0.48, -0.18, -0.14)}),
            (5, {"rot": (0.58, -0.24, -0.18)}),
            (10, {"rot": (-0.40, 0.16, 0.10)}),
            (15, {"rot": (-0.28, 0.12, 0.08)}),
            (24, {"rot": (0.36, -0.14, -0.10)}),
            (28, {"rot": (0.42, -0.16, -0.11)}),
            (34, {"rot": (-0.36, 0.14, 0.09)}),
            (39, {"rot": (-0.26, 0.10, 0.07)}),
            (50, {"rot": (0.30, -0.12, -0.08)}),
            (55, {"rot": (0.36, -0.13, -0.09)}),
            (61, {"rot": (-0.34, 0.13, 0.08)}),
            (66, {"rot": (-0.24, 0.09, 0.06)}),
            (72, {"rot": (0.03, 0, 0)}),
        ),
        "rightWristPivot": frames(
            (1, {"loc": (0.12, 0.095, 0.50), "rot": (0.04, -0.03, 0.00)}),
            (5, {"loc": (0.15, 0.105, 0.58), "rot": (0.05, -0.04, -0.02)}),
            (10, {"loc": (-0.02, 0.135, -0.55), "rot": (-0.03, 0.04, 0.02)}),
            (15, {"loc": (0.00, 0.120, -0.42), "rot": (-0.02, 0.03, 0.01)}),
            (24, {"loc": (0.08, 0.085, 0.28), "rot": (0.04, -0.03, 0.00)}),
            (28, {"loc": (0.11, 0.090, 0.46), "rot": (0.03, -0.02, 0.00)}),
            (34, {"loc": (-0.02, 0.132, -0.52), "rot": (-0.03, 0.04, 0.02)}),
            (39, {"loc": (0.00, 0.118, -0.38), "rot": (-0.02, 0.03, 0.01)}),
            (50, {"loc": (0.07, 0.080, 0.24), "rot": (0.03, -0.02, 0.00)}),
            (55, {"loc": (0.10, 0.085, 0.42), "rot": (0.03, -0.02, 0.00)}),
            (61, {"loc": (-0.02, 0.130, -0.50), "rot": (-0.03, 0.04, 0.02)}),
            (66, {"loc": (0.00, 0.116, -0.36), "rot": (-0.02, 0.03, 0.01)}),
            (72, {"loc": (0, 0, 0), "rot": (0.02, 0, 0)}),
        ),
        "leftHipPivot": frames((1, {"rot": (0.04, -0.01, -0.01)}), (58, {"rot": (-0.02, 0.01, 0.01)}), (72, {"rot": (0.01, 0, 0)})),
        "rightHipPivot": frames((1, {"rot": (-0.05, 0.01, 0.01)}), (58, {"rot": (0.04, -0.01, -0.01)}), (72, {"rot": (-0.01, 0, 0)})),
        "leftKneePivot": frames((1, {"rot": (0.08, 0.01, 0.01)}), (58, {"rot": (0.12, 0.01, 0.01)}), (72, {"rot": (0.01, 0, 0)})),
        "rightKneePivot": frames((1, {"rot": (0.10, -0.01, -0.01)}), (58, {"rot": (0.14, -0.01, -0.01)}), (72, {"rot": (0.05, 0, 0)})),
        "leftAnklePivot": frames((1, {"rot": (-0.03, 0, 0.01)}), (58, {"rot": (0.02, 0, -0.01)}), (72, {"rot": (0.02, 0, 0)})),
        "rightAnklePivot": frames((1, {"rot": (0.03, 0, -0.01)}), (58, {"rot": (-0.02, 0, 0.01)}), (72, {"rot": (0.02, 0, 0)})),
        "weaponAttackPlanePivot": frames(
            (1, {"rot": (-1.50, -0.80, -0.30)}),
            (5, {"rot": (-1.60, -0.90, 0.00)}),
            (10, {"rot": (0.18, 0.08, 0.12)}),
            (15, {"rot": (0.06, 0.02, 0.06)}),
            (24, {"rot": (-0.90, -0.48, -0.18)}),
            (28, {"rot": (-1.42, -0.76, -0.28)}),
            (34, {"rot": (0.16, 0.07, 0.10)}),
            (39, {"rot": (0.05, 0.02, 0.05)}),
            (50, {"rot": (-0.82, -0.42, -0.16)}),
            (55, {"rot": (-1.34, -0.70, -0.26)}),
            (61, {"rot": (0.14, 0.06, 0.09)}),
            (66, {"rot": (0.05, 0.02, 0.05)}),
            (72, {"rot": (0.00, 0.00, 0.00)}),
        ),
        "weaponSocket": frames(
            (1, {"rot": (0, 0, 0)}),
            (72, {"rot": (0, 0, 0)}),
        ),
        "boss_iron_rod_root": frames(
            (1, {"rot": (0.00, 0.00, 0.00)}),
            (5, {"rot": (0.02, -0.02, -0.02)}),
            (10, {"rot": (-0.08, 0.04, 0.05)}),
            (15, {"rot": (-0.05, 0.03, 0.03)}),
            (24, {"rot": (0.03, -0.01, 0.00)}),
            (28, {"rot": (0.00, 0.00, 0.00)}),
            (34, {"rot": (-0.08, 0.04, 0.05)}),
            (39, {"rot": (-0.05, 0.03, 0.03)}),
            (50, {"rot": (0.03, -0.01, 0.00)}),
            (55, {"rot": (0.00, 0.00, 0.00)}),
            (61, {"rot": (-0.08, 0.04, 0.05)}),
            (66, {"rot": (-0.05, 0.03, 0.03)}),
            (72, {"rot": (0.02, 0, 0)}),
        ),
    })
    add_clip("attack_sweep", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, 0.005, -0.004), "rot": (0, 0, -0.020)}), (12, {"loc": (0.006, 0.008, -0.006), "rot": (0, 0, -0.010)}), (20, {"loc": (0.010, 0.010, -0.006), "rot": (0, 0, 0.025)}), (34, {"loc": (0.004, 0.006, -0.003), "rot": (0, 0, 0.010)})),
        "pelvisPivot": frames((1, {"rot": (0.00, 0, -0.05)}), (12, {"rot": (0.01, 0, -0.065)}), (20, {"rot": (0.01, 0, 0.065)}), (34, {"rot": (0.01, 0, 0.02)})),
        "torsoPivot": frames((1, {"rot": (0.00, 0, -0.12), "loc": (0, 0.004, -0.002)}), (12, {"rot": (0.015, 0, -0.20), "loc": (0, 0.005, -0.004)}), (20, {"rot": (0.018, 0, 0.18), "loc": (0, 0.005, -0.004)}), (34, {"rot": (0.02, 0, 0.04), "loc": (0, 0.004, -0.003)})),
        "leftShoulderPivot": frames((1, {"rot": (0.08, -0.04, -0.10)}), (12, {"rot": (0.10, -0.05, -0.14)}), (20, {"rot": (0.12, 0.03, 0.08)}), (34, {"rot": (0.04, 0.02, 0.02)})),
        "leftElbowPivot": frames((1, {"rot": (0.06, -0.02, -0.04)}), (12, {"rot": (0.08, -0.03, -0.06)}), (20, {"rot": (0.08, 0.02, 0.03)}), (34, {"rot": (0.03, 0.00, 0.01)})),
        "leftWristPivot": frames((1, {"rot": (0.04, -0.02, -0.03)}), (12, {"rot": (0.05, -0.02, -0.04)}), (20, {"rot": (0.05, 0.02, 0.02)}), (34, {"rot": (0.02, 0.01, 0.01)})),
        "rightShoulderPivot": frames((1, {"rot": (0.20, 0.32, 0.70)}), (12, {"rot": (0.36, -0.30, -0.48)}), (20, {"rot": (0.30, 0.46, 1.26)}), (34, {"rot": (0.10, -0.04, -0.08)})),
        "rightElbowPivot": frames((1, {"rot": (0.18, 0.08, 0.28)}), (12, {"rot": (0.26, -0.12, -0.22)}), (20, {"rot": (0.24, 0.14, 0.46)}), (34, {"rot": (0.06, 0.00, 0.02)})),
        "rightWristPivot": frames((1, {"loc": (0.10, 0.040, 0.03), "rot": (0.08, 0.05, 0.14)}), (12, {"loc": (-0.03, 0.085, -0.02), "rot": (0.16, -0.08, -0.16)}), (20, {"loc": (0.22, 0.060, 0.08), "rot": (0.12, 0.08, 0.26)}), (34, {"loc": (0, 0, 0), "rot": (0.02, 0, 0)})),
        "leftHipPivot": frames((1, {"rot": (0.04, 0.00, 0.02)}), (10, {"rot": (0.08, 0.01, 0.07)}), (20, {"rot": (0.07, 0.01, 0.06)}), (34, {"rot": (0.05, 0.01, 0.05)})),
        "rightHipPivot": frames((1, {"rot": (-0.04, 0.00, -0.02)}), (10, {"rot": (-0.08, -0.01, -0.07)}), (20, {"rot": (-0.07, -0.01, -0.06)}), (34, {"rot": (-0.05, -0.01, -0.05)})),
        "leftKneePivot": frames((1, {"rot": (0.12, 0, 0.00)}), (10, {"rot": (0.20, 0, 0.02)}), (20, {"rot": (0.17, 0, 0.02)}), (34, {"rot": (0.14, 0, 0.01)})),
        "rightKneePivot": frames((1, {"rot": (0.10, 0, 0.00)}), (10, {"rot": (0.22, 0, -0.02)}), (20, {"rot": (0.18, 0, -0.02)}), (34, {"rot": (0.14, 0, -0.01)})),
        "weaponAttackPlanePivot": frames((1, {"rot": (0.00, 0.04, 0.22)}), (12, {"rot": (-1.60, -0.60, 0.60)}), (20, {"rot": (-0.60, 0.80, -2.00)}), (34, {"rot": (0.00, 0.00, 0.06)})),
        "weaponSocket": frames((1, {"rot": (0, 0, 0)}), (34, {"rot": (0, 0, 0)})),
        "boss_iron_rod_root": frames((1, {"rot": (0.02, 0.02, 0.04)}), (12, {"rot": (-0.02, -0.02, -0.14)}), (20, {"rot": (0.04, 0.04, 0.12)}), (34, {"rot": (0.02, 0, 0.02)})),
    })
    add_clip("attack_recover", rest, {
        "torsoPivot": frames((1, {"rot": (0.10, 0, -0.03)}), (24, {"rot": (0, 0, 0)})),
        "leftShoulderPivot": frames((1, {"rot": (0.24, 0.06, 0.12)}), (24, {"rot": (0, 0, 0)})),
        "leftElbowPivot": frames((1, {"rot": (0.08, 0, -0.05)}), (24, {"rot": (0, 0, 0)})),
        "leftWristPivot": frames((1, {"rot": (0.12, -0.08, -0.06)}), (24, {"rot": (0, 0, 0)})),
        "rightShoulderPivot": frames((1, {"rot": (-0.08, -0.04, -0.08)}), (24, {"rot": (0, 0, 0)})),
        "rightElbowPivot": frames((1, {"rot": (-0.08, -0.02, -0.02)}), (24, {"rot": (0, 0, 0)})),
        "rightWristPivot": frames((1, {"rot": (-0.04, 0, 0)}), (24, {"rot": (0, 0, 0)})),
        "leftHipPivot": frames((1, {"rot": (0.08, 0, -0.03)}), (24, {"rot": (0, 0, 0)})),
        "rightHipPivot": frames((1, {"rot": (-0.10, 0, 0.03)}), (24, {"rot": (0, 0, 0)})),
        "leftKneePivot": frames((1, {"rot": (0.06, 0, 0)}), (24, {"rot": (0, 0, 0)})),
        "rightKneePivot": frames((1, {"rot": (0.12, 0, 0)}), (24, {"rot": (0, 0, 0)})),
        "leftAnklePivot": frames((1, {"rot": (0.04, 0, 0)}), (24, {"rot": (0, 0, 0)})),
        "rightAnklePivot": frames((1, {"rot": (-0.04, 0, 0)}), (24, {"rot": (0, 0, 0)})),
        "boss_iron_rod_root": frames((1, {"rot": (0.12, 0.02, 0.04)}), (24, {"rot": (0, 0, 0)})),
        "coreWeakpointPivot": frames((1, {"scale": (1.15, 1.15, 1.15)}), (24, {"scale": (1, 1, 1)})),
    })
    add_clip("hit_light", rest, {
        "torsoPivot": frames((1, {"loc": (0, 0, 0)}), (5, {"loc": (0.035, 0.02, 0), "rot": (0, 0, 0.06)}), (10, {"loc": (0, 0, 0)})),
    })
    add_clip("hit_heavy", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, 0, 0)}), (8, {"loc": (-0.05, 0.05, -0.02)}), (18, {"loc": (0, 0, 0)})),
        "torsoPivot": frames((1, {"rot": (0, 0, 0)}), (8, {"rot": (-0.22, 0.04, -0.12)}), (18, {"rot": (0, 0, 0)})),
        "shoulderHaloPivot": frames((1, {"scale": (1, 1, 1)}), (8, {"scale": (1.10, 1.10, 1.10)}), (18, {"scale": (1, 1, 1)})),
    })
    add_clip("stagger", rest, {
        "torsoPivot": frames((1, {"rot": (0, 0, 0)}), (18, {"rot": (-0.34, 0.05, 0.10)}), (38, {"rot": (-0.12, 0.02, 0.02)})),
        "leftShoulderPivot": frames((1, {"rot": (0, 0, 0)}), (18, {"rot": (0.42, 0.10, -0.18)}), (38, {"rot": (0.10, 0, -0.04)})),
        "rightShoulderPivot": frames((1, {"rot": (0, 0, 0)}), (18, {"rot": (-0.50, -0.08, 0.16)}), (38, {"rot": (-0.10, 0, 0.04)})),
    })
    add_clip("death", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, 0, 0)}), (55, {"loc": (0.18, 0.18, -0.30), "rot": (0.0, 0.0, 0.36)})),
        "torsoPivot": frames((1, {"rot": (0, 0, 0)}), (55, {"rot": (-0.68, 0.16, 0.22)})),
        "headSensorPivot": frames((1, {"rot": (0, 0, 0)}), (55, {"rot": (0.50, -0.22, -0.20)})),
        "coreWeakpointPivot": frames((1, {"scale": (1.0, 1.0, 1.0)}), (20, {"scale": (1.34, 1.34, 1.34)}), (55, {"scale": (0.40, 0.40, 0.40)})),
    })
    add_clip("spawn_boot", rest, {
        "reclamation_mother_root": frames((1, {"loc": (0, 0, -0.18), "scale": (0.82, 0.82, 0.82)}), (40, {"loc": (0, 0, 0), "scale": (1, 1, 1)})),
        "shoulderHaloPivot": frames((1, {"scale": (0.40, 0.40, 0.40)}), (40, {"scale": (1, 1, 1)})),
        "coreWeakpointPivot": frames((1, {"scale": (0.25, 0.25, 0.25)}), (26, {"scale": (1.20, 1.20, 1.20)}), (40, {"scale": (1, 1, 1)})),
    })

    for index in range(4):
        name = f"utility_arm_{index:02d}_base"
        add_clip(f"utility_idle_{index:02d}", rest, {
            name: frames((1, {"rot": (0, 0, 0)}), (30, {"rot": (0.10 * (-1 if index % 2 else 1), 0.06, 0.08)}), (60, {"rot": (0, 0, 0)})),
        })
    rest_pose_nodes = [
        "reclamation_mother_root",
        "pelvisPivot",
        "torsoPivot",
        "headSensorPivot",
        "shoulderHaloPivot",
        "coreWeakpointPivot",
        "leftShoulderPivot",
        "leftElbowPivot",
        "leftWristPivot",
        "rightShoulderPivot",
        "rightElbowPivot",
        "rightWristPivot",
        "leftHipPivot",
        "leftKneePivot",
        "leftAnklePivot",
        "rightHipPivot",
        "rightKneePivot",
        "rightAnklePivot",
        "weaponAttackPlanePivot",
        "weaponSocket",
        "boss_iron_rod_root",
    ]
    rest_pose_nodes.extend(f"utility_arm_{index:02d}_base" for index in range(4))
    add_clip("rest_pose", rest, {
        name: frames((1, {}))
        for name in rest_pose_nodes
        if bpy.data.objects.get(name)
    })
    bpy.context.scene.frame_set(0)
    restore_rest(rest)


def compute_scene_report():
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    empty_objects = [obj for obj in bpy.context.scene.objects if obj.type == "EMPTY"]
    minv = Vector((math.inf, math.inf, math.inf))
    maxv = Vector((-math.inf, -math.inf, -math.inf))
    triangles = 0
    for obj in mesh_objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            minv.x = min(minv.x, world.x)
            minv.y = min(minv.y, world.y)
            minv.z = min(minv.z, world.z)
            maxv.x = max(maxv.x, world.x)
            maxv.y = max(maxv.y, world.y)
            maxv.z = max(maxv.z, world.z)
        triangles += sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)
    materials = sorted({slot.material.name for obj in mesh_objects for slot in obj.material_slots if slot.material})
    return {
        "meshObjects": len(mesh_objects),
        "emptyObjects": len(empty_objects),
        "materials": materials,
        "trianglesApprox": triangles,
        "boundsMinBlender": [round(v, 4) for v in minv],
        "boundsMaxBlender": [round(v, 4) for v in maxv],
        "dimensionsBlender": [round(v, 4) for v in (maxv - minv)],
        "animatedClips": CLIPS + [f"utility_idle_{i:02d}" for i in range(4)],
        "requiredSockets": [
            "core_glass_weakpoint",
            "missile_hit_socket",
            "skill3_lockon_socket",
            "boss_vfx_center_socket",
            "floor_contact_socket",
            "warning_emissive_slots",
        ],
    }


def export():
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
    merge_node_action_clips(OUTPUT_GLB)


def merge_node_action_clips(glb_path):
    data = glb_path.read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError(f"not a GLB file: {glb_path}")

    chunks = []
    offset = 12
    json_doc = None
    while offset < len(data):
        chunk_length = int.from_bytes(data[offset : offset + 4], "little")
        chunk_type = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == b"JSON":
            json_doc = json.loads(chunk_data.rstrip(b" \t\r\n\0").decode("utf-8"))
        else:
            chunks.append((chunk_type, chunk_data))
        offset += 8 + chunk_length

    if not json_doc:
        raise RuntimeError(f"GLB JSON chunk missing: {glb_path}")

    grouped = {}
    passthrough = []
    for animation in json_doc.get("animations", []):
        name = animation.get("name") or "animation"
        if ":" not in name:
            if name == "rest_pose":
                continue
            passthrough.append(animation)
            continue
        clip_name = name.split(":", 1)[0]
        if clip_name == "rest_pose":
            continue
        grouped.setdefault(clip_name, []).append(animation)

    merged_animations = list(passthrough)
    for clip_name in CLIPS + [f"utility_idle_{i:02d}" for i in range(4)]:
        parts = grouped.pop(clip_name, [])
        if not parts:
            continue
        merged = {"name": clip_name, "samplers": [], "channels": []}
        for part in parts:
            sampler_offset = len(merged["samplers"])
            merged["samplers"].extend(part.get("samplers", []))
            for channel in part.get("channels", []):
                rewritten = dict(channel)
                rewritten["sampler"] = channel["sampler"] + sampler_offset
                merged["channels"].append(rewritten)
        merged_animations.append(merged)

    for clip_name, parts in grouped.items():
        merged = {"name": clip_name, "samplers": [], "channels": []}
        for part in parts:
            sampler_offset = len(merged["samplers"])
            merged["samplers"].extend(part.get("samplers", []))
            for channel in part.get("channels", []):
                rewritten = dict(channel)
                rewritten["sampler"] = channel["sampler"] + sampler_offset
                merged["channels"].append(rewritten)
        merged_animations.append(merged)

    json_doc["animations"] = merged_animations
    encoded_json = json.dumps(json_doc, separators=(",", ":")).encode("utf-8")
    encoded_json += b" " * ((4 - len(encoded_json) % 4) % 4)
    new_length = 12 + 8 + len(encoded_json) + sum(8 + len(chunk_data) for _, chunk_data in chunks)
    output = bytearray()
    output += b"glTF"
    output += (2).to_bytes(4, "little")
    output += new_length.to_bytes(4, "little")
    output += len(encoded_json).to_bytes(4, "little")
    output += b"JSON"
    output += encoded_json
    for chunk_type, chunk_data in chunks:
        output += len(chunk_data).to_bytes(4, "little")
        output += chunk_type
        output += chunk_data
    glb_path.write_bytes(output)


def scan_exported_glb(glb_path):
    data = glb_path.read_bytes()
    if data[:4] != b"glTF":
        return {"isGlb": False}
    json_doc = None
    offset = 12
    while offset < len(data):
        chunk_length = int.from_bytes(data[offset : offset + 4], "little")
        chunk_type = data[offset + 4 : offset + 8]
        chunk_data = data[offset + 8 : offset + 8 + chunk_length]
        if chunk_type == b"JSON":
            json_doc = json.loads(chunk_data.rstrip(b" \t\r\n\0").decode("utf-8"))
            break
        offset += 8 + chunk_length
    if not json_doc:
        return {"isGlb": True, "jsonFound": False}
    json_text = json.dumps(json_doc, ensure_ascii=False)
    forbidden = [
        token
        for token in ("meshopt", "watermark")
        if token.lower() in json_text.lower()
    ]
    return {
        "isGlb": True,
        "jsonFound": True,
        "nodes": len(json_doc.get("nodes", [])),
        "meshes": len(json_doc.get("meshes", [])),
        "materials": len(json_doc.get("materials", [])),
        "textures": len(json_doc.get("textures", [])),
        "images": len(json_doc.get("images", [])),
        "animations": [animation.get("name") for animation in json_doc.get("animations", [])],
        "extensionsUsed": json_doc.get("extensionsUsed", []),
        "extensionsRequired": json_doc.get("extensionsRequired", []),
        "forbiddenMarkerMatches": forbidden,
    }


def main():
    clear_scene()
    robot = build_robot()
    build_animations()
    scene_report = compute_scene_report()
    export()
    glb_scan = scan_exported_glb(OUTPUT_GLB)
    report = {
        "schema": "human-protocol/level05-reclamation-mother-rig@1",
        "generatedAt": datetime.now(UTC).isoformat(),
        "purpose": "Create a project-owned procedural hard-surface boss prototype with generated mesh primitives, material slots, sockets, and named animation nodes.",
        "assetAuthorship": {
            "mesh": "generated by this Blender script",
            "textures": "none; material colors only in this prototype",
            "externalGlbDependency": False,
            "externalTextureDependency": False,
            "controlPointBlueprint": str(CONTROL_POINTS_PATH.relative_to(REPO_ROOT)) if CONTROL_POINTS_PATH.exists() else None,
            "controlPointMethod": "low-dimensional k-means centers and scales only; no raw vertex list, mesh, or texture is embedded in the GLB",
        },
        "derivedAsset": {
            "modelKeyCandidate": "hp_enemy_reclamation_mother_rig_v1",
            "glb": str(OUTPUT_GLB.relative_to(REPO_ROOT)),
            "sourceBlend": str(OUTPUT_BLEND.relative_to(REPO_ROOT)),
            "status": "prototype-not-yet-registered-in-level5",
            **scene_report,
            "controlPointFit": robot.get("controlReport", {}),
            "glbScan": glb_scan,
        },
        "handoff": {
            "collisionProxy": {"type": "sphere", "radius": 1.28},
            "scaleMetersIntent": [2.45, 3.05, 2.35],
            "runtimeContent": ["boss weakpoint state", "skill3 missile lock-on socket", "warning emissive pulses"],
            "nextSteps": [
                "Generate or paint a project-owned Image2/PBR atlas after shape approval.",
                "Run enemy runtime QA after registering the model key.",
                "Wire boss node behavior and skill3 double-tap missile in config/runtime only after visual approval.",
            ],
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"glb": str(OUTPUT_GLB), "blend": str(OUTPUT_BLEND), "report": str(REPORT_PATH)}, indent=2))


if __name__ == "__main__":
    main()
