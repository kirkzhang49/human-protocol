# Procedural "human specimen plinth" — a premium museum exhibit pedestal for
# Human Protocol. Built in Blender (bpy), exported as a clean GLB with PBR + a
# preview render. Hard-surface + bevels + brass/marble/emissive, origin at the
# base center on the floor (so it never floats). Usage:
#   Blender --background --python blender-make-specimen-plinth.py -- <out.glb> <preview.png>
import bpy
import sys
import math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def make_mat(name, color, metallic, roughness, emit=(0, 0, 0), emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if "Emission Color" in b.inputs:
        b.inputs["Emission Color"].default_value = (*emit, 1.0)
    if "Emission Strength" in b.inputs:
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


marble = make_mat("plinth_marble", (0.80, 0.78, 0.73), 0.0, 0.32)
brass = make_mat("plinth_brass", (0.83, 0.60, 0.22), 1.0, 0.26)
darkstone = make_mat("plinth_darkstone", (0.09, 0.10, 0.12), 0.25, 0.55)
glow_cyan = make_mat("plinth_glow_ring", (0.25, 0.9, 1.0), 0.0, 0.5, emit=(0.30, 0.95, 1.0), emit_strength=6.0)
glow_warm = make_mat("plinth_glow_core", (1.0, 0.82, 0.5), 0.0, 0.45, emit=(1.0, 0.74, 0.40), emit_strength=8.0)
plaque_dark = make_mat("plinth_plaque", (0.05, 0.06, 0.07), 0.1, 0.7)

parts = []


def add(obj):
    parts.append(obj)
    return obj


def octa(radius, depth, z, name, material, bevel=0.012, segments=2, verts=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=(0, 0, z))
    o = bpy.context.active_object
    o.name = name
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = segments
    o.data.materials.append(material)
    return add(o)


def cone(r1, r2, depth, z, name, material, bevel=0.01, verts=8):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=depth, location=(0, 0, z))
    o = bpy.context.active_object
    o.name = name
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    o.data.materials.append(material)
    return add(o)


def box(sx, sy, sz, loc, name, material, bevel=0.006):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, sz)
    if bevel > 0:
        mod = o.modifiers.new("bev", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    o.data.materials.append(material)
    return add(o)


# --- Tiered base (marble) + brass rim ---
octa(0.46, 0.10, 0.05, "base_lower", marble)
octa(0.41, 0.06, 0.13, "base_upper", marble)
octa(0.43, 0.025, 0.172, "base_rim", brass, bevel=0.006)
# Brass studs around the rim
for i in range(8):
    a = (i / 8) * math.tau + math.tau / 16
    box(0.018, 0.018, 0.02, (math.cos(a) * 0.40, math.sin(a) * 0.40, 0.176), f"stud_{i}", brass, bevel=0.004)

# --- Tapered column (dark stone) with brass collar ---
cone(0.19, 0.155, 0.74, 0.56, "column", darkstone, bevel=0.012)
octa(0.205, 0.03, 0.20, "collar_low", brass, bevel=0.006)
octa(0.175, 0.03, 0.92, "collar_high", brass, bevel=0.006)

# --- Recessed emissive light ring under the top platform ---
octa(0.31, 0.035, 0.955, "light_ring", glow_cyan, bevel=0.004)

# --- Top platform (marble) + brass inlay ---
octa(0.35, 0.07, 1.005, "platform", marble)
octa(0.30, 0.018, 1.05, "platform_inlay", brass, bevel=0.005)

# --- The "specimen": a faceted glowing core floating on the platform ---
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.115, location=(0, 0, 1.20))
core = bpy.context.active_object
core.name = "specimen_core"
core.data.materials.append(glow_warm)
add(core)
# small brass mount under the core
cone(0.07, 0.03, 0.06, 1.10, "core_mount", brass, bevel=0.004)

# --- Angled plaque on the front face (+Y) ---
box(0.17, 0.025, 0.085, (0, 0.45, 0.165), "plaque_back", brass, bevel=0.005)
box(0.15, 0.012, 0.07, (0, 0.465, 0.165), "plaque_face", plaque_dark, bevel=0.003)

# --- Join into one multi-material object, origin at base center on the floor ---
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
plinth = bpy.context.active_object
plinth.name = "specimen_plinth"

# Drop so the lowest point sits exactly on Z=0 (floor), centered on XY.
bpy.context.view_layer.update()
min_z = min((plinth.matrix_world @ v.co).z for v in plinth.data.vertices)
plinth.location.z -= min_z
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

# --- Export GLB (selection only, Y-up, apply modifiers) ---
bpy.ops.object.select_all(action="DESELECT")
plinth.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
)

# --- Preview render (Cycles, transparent bg, 3/4 studio) ---
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"

world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.05, 0.06, 0.08, 1)
bg.inputs[1].default_value = 0.5

target = bpy.data.objects.new("tgt", None)
scene.collection.objects.link(target)
target.location = (0, 0, 0.7)


def track(obj):
    c = obj.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"


cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 70
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = (2.0, -2.6, 1.7)
track(cam)

for loc, energy in [((3, -3, 5), 5.0), ((-4, -1, 2.5), 2.0)]:
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = energy
    lo = bpy.data.objects.new("sun", ld)
    scene.collection.objects.link(lo)
    lo.location = loc
    track(lo)

scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("DONE glb+png")
