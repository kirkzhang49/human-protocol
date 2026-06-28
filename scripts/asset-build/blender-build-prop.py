# Generic spec -> GLB prop builder for Human Protocol (the reusable modeling skill).
# Reads a JSON spec (parts + materials), builds a clean hard-surface prop in
# Blender with PBR + optional CC0 textures (cube-projected), origin at the base
# on the floor, exports GLB + a 3/4 preview PNG. Designed so creative agents emit
# only JSON; this tested executor turns it into a premium asset.
#
#   Blender --background --python blender-build-prop.py -- <spec.json> <out.glb> <preview.png> <textures_dir>
import bpy
import sys
import json
import math
import os

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC_PATH, OUT_GLB, OUT_PNG, TEX_DIR = argv[0], argv[1], argv[2], argv[3]

with open(SPEC_PATH, "r") as f:
    spec = json.load(f)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

_mat_cache = {}


def build_material(name, m):
    if name in _mat_cache:
        return _mat_cache[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    color = m.get("color", [0.7, 0.7, 0.7])
    bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], 1.0)
    bsdf.inputs["Metallic"].default_value = float(m.get("metallic", 0.0))
    bsdf.inputs["Roughness"].default_value = float(m.get("roughness", 0.6))
    emit = m.get("emissive")
    if emit and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (emit[0], emit[1], emit[2], 1.0)
        bsdf.inputs["Emission Strength"].default_value = float(m.get("emissiveStrength", 1.0))
    # Texture slug resolution, in priority order:
    #   1) shared-pbr/<slug>_basecolor|normal|orm.png  (the Codex-painted shared library;
    #      ORM = R:AO, G:roughness, B:metallic -> glTF metallicRoughnessTexture + normalTexture)
    #   2) builder-surfaces/<slug>_color|rough.webp     (legacy CC0 set)
    #   3) none -> keep the material color/factor fallback
    slug = m.get("texture")
    if slug:
        shared_dir = os.path.join(os.path.dirname(TEX_DIR), "shared-pbr")
        shared_base = os.path.join(shared_dir, f"{slug}_basecolor.png")
        s = 1.0 / float(m.get("textureScale", 1.0))
        if os.path.exists(shared_base):
            tex_co = nt.nodes.new("ShaderNodeTexCoord")
            mapping = nt.nodes.new("ShaderNodeMapping")
            mapping.inputs["Scale"].default_value = (s, s, s)
            nt.links.new(tex_co.outputs["UV"], mapping.inputs["Vector"])
            base = nt.nodes.new("ShaderNodeTexImage")
            base.image = bpy.data.images.load(shared_base)
            nt.links.new(mapping.outputs["Vector"], base.inputs["Vector"])
            nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
            orm_path = os.path.join(shared_dir, f"{slug}_orm.png")
            if os.path.exists(orm_path):
                orm = nt.nodes.new("ShaderNodeTexImage")
                orm.image = bpy.data.images.load(orm_path)
                orm.image.colorspace_settings.name = "Non-Color"
                nt.links.new(mapping.outputs["Vector"], orm.inputs["Vector"])
                sep = nt.nodes.new("ShaderNodeSeparateColor")
                nt.links.new(orm.outputs["Color"], sep.inputs["Color"])
                nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
                nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
            nrm_path = os.path.join(shared_dir, f"{slug}_normal.png")
            if os.path.exists(nrm_path):
                nrm = nt.nodes.new("ShaderNodeTexImage")
                nrm.image = bpy.data.images.load(nrm_path)
                nrm.image.colorspace_settings.name = "Non-Color"
                nt.links.new(mapping.outputs["Vector"], nrm.inputs["Vector"])
                nmap = nt.nodes.new("ShaderNodeNormalMap")
                nt.links.new(nrm.outputs["Color"], nmap.inputs["Color"])
                nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
            mat["__texslug"] = slug
            mat["__texscale"] = float(m.get("textureScale", 1.0))
        else:
            color_path = os.path.join(TEX_DIR, f"{slug}_color.webp")
            if os.path.exists(color_path):
                tex_co = nt.nodes.new("ShaderNodeTexCoord")
                mapping = nt.nodes.new("ShaderNodeMapping")
                mapping.inputs["Scale"].default_value = (s, s, s)
                nt.links.new(tex_co.outputs["UV"], mapping.inputs["Vector"])
                img = nt.nodes.new("ShaderNodeTexImage")
                img.image = bpy.data.images.load(color_path)
                nt.links.new(mapping.outputs["Vector"], img.inputs["Vector"])
                nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
                rough_path = os.path.join(TEX_DIR, f"{slug}_rough.webp")
                if os.path.exists(rough_path):
                    rimg = nt.nodes.new("ShaderNodeTexImage")
                    rimg.image = bpy.data.images.load(rough_path)
                    rimg.image.colorspace_settings.name = "Non-Color"
                    nt.links.new(mapping.outputs["Vector"], rimg.inputs["Vector"])
                    nt.links.new(rimg.outputs["Color"], bsdf.inputs["Roughness"])
                mat["__texslug"] = slug
                mat["__texscale"] = float(m.get("textureScale", 1.0))
    _mat_cache[name] = mat
    return mat


materials = spec.get("materials", {})
parts = []


def primitive(part):
    shape = part.get("shape", "box")
    pos = part.get("pos", [0, 0, 0])
    if shape in ("box", "cube"):
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        o = bpy.context.active_object
        sz = part.get("size", [0.2, 0.2, 0.2])
        o.scale = (sz[0], sz[1], sz[2])
    elif shape == "cylinder":
        bpy.ops.mesh.primitive_cylinder_add(vertices=int(part.get("verts", 16)), radius=float(part.get("radius", 0.2)), depth=float(part.get("depth", 0.2)), location=pos)
        o = bpy.context.active_object
    elif shape == "cone":
        bpy.ops.mesh.primitive_cone_add(vertices=int(part.get("verts", 16)), radius1=float(part.get("r1", 0.2)), radius2=float(part.get("r2", 0.0)), depth=float(part.get("depth", 0.3)), location=pos)
        o = bpy.context.active_object
    elif shape in ("sphere", "ico"):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=int(part.get("subdivisions", 2)), radius=float(part.get("radius", 0.15)), location=pos)
        o = bpy.context.active_object
    elif shape == "torus":
        bpy.ops.mesh.primitive_torus_add(location=pos, major_radius=float(part.get("major", 0.3)), minor_radius=float(part.get("minor", 0.03)), major_segments=int(part.get("verts", 24)), minor_segments=12)
        o = bpy.context.active_object
    else:
        bpy.ops.mesh.primitive_cube_add(size=0.2, location=pos)
        o = bpy.context.active_object
    rot = part.get("rot")
    if rot:
        o.rotation_euler = (math.radians(rot[0]), math.radians(rot[1]), math.radians(rot[2]))
    return o


for i, part in enumerate(spec.get("parts", [])):
    try:
        o = primitive(part)
        o.name = f"part_{i}"
        bevel = float(part.get("bevel", 0.008))
        if bevel > 0:
            mod = o.modifiers.new("bev", "BEVEL")
            mod.width = bevel
            mod.segments = int(part.get("bevelSegments", 2))
            mod.limit_method = "ANGLE"
            mod.angle_limit = math.radians(40)
            # Apply now: object.join() DROPS modifiers of non-active objects, so an
            # unapplied bevel would survive on only the first part. Bake it per-part.
            bpy.context.view_layer.objects.active = o
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except Exception as exc:  # noqa: BLE001
                print("BEVEL_FAIL", i, str(exc)[:60])
        mname = part.get("material", "default")
        mdef = materials.get(mname, {"color": [0.7, 0.7, 0.7], "metallic": 0, "roughness": 0.6})
        mat = build_material(mname, mdef)
        # Cube-project UVs so textured materials look right on hard surfaces.
        # Must ALWAYS restore OBJECT mode, else a failed projection leaves the
        # mesh in EDIT mode and later primitive_add calls corrupt this object.
        if mat.get("__texslug"):
            bpy.context.view_layer.objects.active = o
            try:
                bpy.ops.object.mode_set(mode="EDIT")
                bpy.ops.mesh.select_all(action="SELECT")
                bpy.ops.uv.cube_project(cube_size=mat.get("__texscale", 1.0))
            except Exception as exc:  # noqa: BLE001
                print("UV_FAIL", i, str(exc)[:80])
            finally:
                if o.mode != "OBJECT":
                    bpy.ops.object.mode_set(mode="OBJECT")
        o.data.materials.append(mat)
        parts.append(o)
    except Exception as exc:  # noqa: BLE001
        print("PART_FAIL", i, str(exc)[:120])

if not parts:
    print("ERROR no parts built")
    sys.exit(1)

for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
obj = bpy.context.active_object
obj.name = spec.get("modelKey", "prop")

# Advanced bake: smooth + angle-based auto-smooth so curved primitives (cylinders,
# cones, spheres) shade round while flats and beveled edges stay crisp. This writes
# better split normals into the exported NORMAL attribute (which the raw-webgpu cook
# reads), lifting shading quality without any extra texture/vertex cost.
bpy.context.view_layer.objects.active = obj
bpy.ops.object.shade_smooth()
try:
    bpy.ops.object.shade_auto_smooth(angle=math.radians(40))
except Exception as exc:  # noqa: BLE001
    print("AUTOSMOOTH_SKIP", str(exc)[:60])

# Drop to floor (min Z = 0), origin at base center.
bpy.context.view_layer.update()
min_z = min((obj.matrix_world @ v.co).z for v in obj.data.vertices)
obj.location.z -= min_z
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
scene.cursor.location = (0, 0, 0)
bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
# export_image_format="NONE": do NOT embed textures in the GLB. Embedding the
# shared 1024² PBR maps per-prop bloated each GLB to ~17MB (deep-pack load hung at
# 48%). Geometry-only GLBs stay tiny; textures live in the cook's deduped atlas
# (resolved from shared-pbr/ by material name). Materials keep baseColorFactor so
# they still read with the right tone even before atlas textures apply.
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_image_format="NONE")

# Report bounds for the catalog sizeMeters (Y-up after export = Blender Z height).
bb = [obj.matrix_world @ __import__("mathutils").Vector(c) for c in obj.bound_box]
xs = [p.x for p in bb]
ys = [p.y for p in bb]
zs = [p.z for p in bb]
size = [round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3)]
print("SIZEMETERS", json.dumps(size))

# Preview render (Cycles CPU, transparent, 3/4).
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 80
scene.cycles.use_denoising = True
scene.render.resolution_x = 600
scene.render.resolution_y = 600
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
bgn = world.node_tree.nodes["Background"]
bgn.inputs[0].default_value = (0.05, 0.06, 0.08, 1)
bgn.inputs[1].default_value = 0.55
# Camera frames by the TRUE height (Blender Z), not depth (Y) — tall props
# were getting their tops cropped because this used the Y extent before.
height = max(zs) - min(zs)
maxdim = max(max(xs) - min(xs), max(ys) - min(ys), height)
target = bpy.data.objects.new("tgt", None)
scene.collection.objects.link(target)
target.location = (0, 0, height * 0.5)


def track(o2):
    c = o2.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"


cam_data = bpy.data.cameras.new("cam")
cam_data.lens = 50
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
dist = maxdim * 2.4 + 0.8
cam.location = (dist * 0.5, -dist * 0.82, height * 0.5 + dist * 0.45)
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
print("DONE")
