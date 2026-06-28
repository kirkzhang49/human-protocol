#!/usr/bin/env python3
"""Render transparent thumbnails for a directory of builder-pack GLBs.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    scripts/asset-build/blender-render-builder-pack-thumbnails.py -- <glb_dir> <out_dir>
"""

from __future__ import annotations

import glob
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


argv = sys.argv[sys.argv.index("--") + 1 :]
glb_dir, out_dir = argv[0], argv[1]
os.makedirs(out_dir, exist_ok=True)


def world_bbox(objs):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in objs:
        if obj.type != "MESH":
            continue
        found = True
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mn = Vector((min(mn.x, world.x), min(mn.y, world.y), min(mn.z, world.z)))
            mx = Vector((max(mx.x, world.x), max(mx.y, world.y), max(mx.z, world.z)))
    return mn, mx, found


def track_to(obj, target):
    constraint = obj.constraints.new("TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"


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
    scene.cycles.samples = 80
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    world = bpy.data.worlds.new("thumbnail_world")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.58, 0.62, 0.66, 1)
    bg.inputs[1].default_value = 0.78

    target = bpy.data.objects.new("thumbnail_target", None)
    scene.collection.objects.link(target)
    target.location = center + Vector((0, 0, size.z * 0.06))

    cam_data = bpy.data.cameras.new("thumbnail_camera")
    cam_data.lens = 62
    cam = bpy.data.objects.new("thumbnail_camera", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.location = center + Vector((1.1, -1.35, 0.82)).normalized() * (maxdim * 2.45)
    track_to(cam, target)

    key_data = bpy.data.lights.new("thumbnail_key", "SUN")
    key_data.energy = 4.2
    key = bpy.data.objects.new("thumbnail_key", key_data)
    scene.collection.objects.link(key)
    key.location = center + Vector((2.1, -2.3, 3.0))
    track_to(key, target)

    fill_data = bpy.data.lights.new("thumbnail_fill", "SUN")
    fill_data.energy = 1.45
    fill = bpy.data.objects.new("thumbnail_fill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = center + Vector((-2.8, -1.0, 1.6))
    track_to(fill, target)

    rim_data = bpy.data.lights.new("thumbnail_cyan_rim", "POINT")
    rim_data.energy = 55
    rim_data.color = (0.48, 0.88, 1.0)
    rim = bpy.data.objects.new("thumbnail_cyan_rim", rim_data)
    scene.collection.objects.link(rim)
    rim.location = center + Vector((-maxdim * 0.7, maxdim * 0.8, maxdim * 0.7))

    scene.render.filepath = out_png
    bpy.ops.render.render(write_still=True)
    return True


count = 0
for glb in sorted(glob.glob(os.path.join(glb_dir, "*.glb"))):
    key = Path(glb).stem
    out_png = os.path.join(out_dir, key + ".png")
    try:
        if render_one(glb, out_png):
            count += 1
            print("RENDERED", key)
        else:
            print("NOMESH", key)
    except Exception as exc:  # noqa: BLE001
        print("FAIL", key, str(exc)[:180])
print("done rendered", count)
