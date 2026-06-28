"""Blender EEVEE material-visible close-up renders for the 3 new door GLBs.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/qa/render-door-families-blender.py

EEVEE samples baseColorTexture so textured materials read (unlike the
painter's-algorithm previews which came out near-black/underexposed).
Neutral-grey world (~0.5) + 3 area lights, framed 3/4, 900x900.
"""
import bpy
import mathutils
import math
import os

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_DIR = os.path.join(REPO, ".tmp", "door-families")
os.makedirs(OUT_DIR, exist_ok=True)

DOORS = [
    ("residential_access", "src/assets/models-cooked/environment/doors/hp_door_residential_access.glb"),
    ("clinic_memory",      "src/assets/models-cooked/environment/doors/hp_door_clinic_memory.glb"),
    ("reclamation_archive","src/assets/models-cooked/environment/doors/hp_door_reclamation_archive.glb"),
    ("industrial_access",  "src/assets/models-cooked/environment/doors/hp_door_industrial_access.glb"),
]


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_world():
    w = bpy.data.worlds.new("w")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    # Neutral grey background ~0.5 so materials read against it.
    bg.inputs[0].default_value = (0.5, 0.5, 0.5, 1.0)
    bg.inputs[1].default_value = 1.0


def bounds(objs):
    mn = mathutils.Vector((1e9,) * 3)
    mx = mathutils.Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            wc = o.matrix_world @ mathutils.Vector(c)
            mn = mathutils.Vector(map(min, mn, wc))
            mx = mathutils.Vector(map(max, mx, wc))
    return mn, mx


def render_door(name, rel_path):
    reset_scene()
    setup_world()

    path = os.path.join(REPO, rel_path)
    bpy.ops.import_scene.gltf(filepath=path)

    objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not objs:
        print("NO MESH for", name)
        return

    mn, mx = bounds(objs)
    ctr = (mn + mx) / 2
    size = (mx - mn)
    r = max(size) * 1.5
    if r <= 0:
        r = 1.0

    # 3/4 view camera.
    cam_d = bpy.data.cameras.new("c")
    cam = bpy.data.objects.new("c", cam_d)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (ctr.x + r * 0.85, ctr.y - r * 1.05, ctr.z + r * 0.55)
    bpy.context.scene.camera = cam
    d = (ctr - cam.location).normalized()
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

    # 3 area lights: key, fill, rim.
    for p, energy in [((r, -r, 2 * r), 1600),
                      ((-r, -r, r), 900),
                      ((0, r, 1.2 * r), 700)]:
        l = bpy.data.lights.new("l", "AREA")
        l.energy = energy
        l.size = max(4.0, r * 2.0)
        lo = bpy.data.objects.new("l", l)
        lo.location = (ctr.x + p[0], ctr.y + p[1], ctr.z + p[2])
        ld = (ctr - lo.location).normalized()
        lo.rotation_euler = ld.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.collection.objects.link(lo)

    sc = bpy.context.scene
    ids = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in ids else "BLENDER_EEVEE"
    sc.render.resolution_x = 900
    sc.render.resolution_y = 900
    sc.render.film_transparent = False
    try:
        sc.view_settings.view_transform = "Standard"
    except Exception:
        pass
    out = os.path.join(OUT_DIR, "%s-blender.png" % name)
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)

    verts = sum(len(o.data.vertices) for o in objs)
    print("RENDERED", name, "->", out, "verts", verts, "objs", len(objs))


for nm, rp in DOORS:
    render_door(nm, rp)

print("DONE")
