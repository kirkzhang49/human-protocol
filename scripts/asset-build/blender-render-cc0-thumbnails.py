# Headless Blender thumbnail renderer for the CC0 /build furniture GLBs.
# Renders each hp_room_cc0_*.glb to a transparent-background 3/4 studio PNG via
# Cycles (CPU) with scale-invariant sun lighting, so a clock and a bed both read
# well. Usage:
#   /Applications/Blender.app/Contents/MacOS/Blender --background --python \
#     scripts/asset-build/blender-render-cc0-thumbnails.py -- <glb_dir> <out_dir>
import bpy
import sys
import os
import glob
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
glb_dir, out_dir = argv[0], argv[1]
os.makedirs(out_dir, exist_ok=True)


def world_bbox(objs):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    found = False
    for o in objs:
        if o.type != "MESH":
            continue
        found = True
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector((min(mn.x, w.x), min(mn.y, w.y), min(mn.z, w.z)))
            mx = Vector((max(mx.x, w.x), max(mx.y, w.y), max(mx.z, w.z)))
    return mn, mx, found


def track_to(obj, target):
    c = obj.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"


def render_one(glb, out_png):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=glb)
    mn, mx, found = world_bbox(list(scene.objects))
    if not found:
        return False
    center = (mn + mx) / 2
    size = mx - mn
    maxdim = max(size.x, size.y, size.z) or 1.0

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.58, 0.64, 1)
    bg.inputs[1].default_value = 0.85

    target = bpy.data.objects.new("tgt", None)
    scene.collection.objects.link(target)
    target.location = center

    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 60
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = center + Vector((1.0, -1.25, 0.78)).normalized() * (maxdim * 2.35)
    track_to(cam, target)

    # Sun lights are irradiance-based → constant brightness regardless of object size.
    key_data = bpy.data.lights.new("key", "SUN")
    key_data.energy = 4.0
    key = bpy.data.objects.new("key", key_data)
    scene.collection.objects.link(key)
    key.location = center + Vector((2, -2, 3))
    track_to(key, target)

    fill_data = bpy.data.lights.new("fill", "SUN")
    fill_data.energy = 1.5
    fill = bpy.data.objects.new("fill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = center + Vector((-3, -1, 1.2))
    track_to(fill, target)

    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    return True


count = 0
for glb in sorted(glob.glob(os.path.join(glb_dir, "hp_room_cc0_*.glb"))):
    key = os.path.basename(glb)[3:-4]  # strip "hp_" prefix and ".glb"
    out_png = os.path.join(out_dir, key + ".png")
    try:
        if render_one(glb, out_png):
            count += 1
            print("RENDERED", key)
        else:
            print("NOMESH", key)
    except Exception as exc:  # noqa: BLE001
        print("FAIL", key, str(exc)[:140])
print("done rendered", count)
