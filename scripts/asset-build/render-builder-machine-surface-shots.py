#!/usr/bin/env python3
"""Render review screenshots of the surface-atlas puzzle machines.

Produces the .tmp shots used to verify the Image2 surface material pass:
  .tmp/puzzle-machine-surface-overview.png
  .tmp/puzzle-machine-surface-close-color.png
  .tmp/puzzle-machine-surface-close-archive.png
  .tmp/puzzle-machine-surface-close-circuit.png
  .tmp/puzzle-machine-surface-close-route.png

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/asset-build/render-builder-machine-surface-shots.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "src/assets/models-cooked/environment/builder-puzzle-machines"
TMP = ROOT / ".tmp"


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def import_glb(name, offset=(0, 0, 0)):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_DIR / f"{name}.glb"))
    new = [o for o in bpy.context.scene.objects if o not in before]
    for o in new:
        o.location.x += offset[0]
        o.location.y += offset[1]
        o.location.z += offset[2]
    return new


def setup_world():
    world = bpy.data.worlds.new("w")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.03, 0.035, 0.045, 1.0)
        bg.inputs[1].default_value = 0.6


def add_lights():
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 900
    key.size = 4
    ko = bpy.data.objects.new("key", key)
    ko.location = (-1.6, -3.2, 3.4)
    ko.rotation_euler = (math.radians(58), 0, math.radians(-28))
    bpy.context.collection.objects.link(ko)

    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 320
    fill.size = 6
    fo = bpy.data.objects.new("fill", fill)
    fo.location = (2.6, -2.6, 1.8)
    fo.rotation_euler = (math.radians(72), 0, math.radians(40))
    bpy.context.collection.objects.link(fo)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 260
    rim.size = 3
    ro = bpy.data.objects.new("rim", rim)
    ro.location = (0, 2.4, 2.6)
    ro.rotation_euler = (math.radians(-60), 0, 0)
    bpy.context.collection.objects.link(ro)


def add_camera(loc, target):
    cam = bpy.data.cameras.new("cam")
    cam.lens = 50
    co = bpy.data.objects.new("cam", cam)
    co.location = loc
    bpy.context.collection.objects.link(co)
    direction = (target[0] - loc[0], target[1] - loc[1], target[2] - loc[2])
    import mathutils
    rot = mathutils.Vector(direction).to_track_quat("-Z", "Y").to_euler()
    co.rotation_euler = rot
    bpy.context.scene.camera = co
    return co


def render(out, res=(1280, 960)):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    print(f"wrote {out}")


def shot(setup_fn, cam_loc, cam_target, out, res=(1280, 960)):
    clear()
    setup_world()
    add_lights()
    setup_fn()
    add_camera(cam_loc, cam_target)
    render(out, res)


def main():
    TMP.mkdir(parents=True, exist_ok=True)

    # Overview: the five rebuilt machines lined up.
    def overview():
        import_glb("hp_puzzle_console_color_sequence", (-4.0, 0, 0))
        import_glb("hp_puzzle_console_circuit_grid", (-2.0, 0, 0))
        import_glb("hp_puzzle_console_archive_merge", (0.0, 0, 0))
        import_glb("hp_builder_route_switch_console", (2.0, 0, 0))
        import_glb("hp_puzzle_console_gallery_reading", (4.0, 0, 0))

    shot(overview, (0.0, -13.8, 2.5), (0.0, 0.0, 0.95), TMP / "puzzle-machine-industrial-overview.png", (1920, 760))

    closeups = [
        ("hp_puzzle_console_color_sequence", "close-color", (0.0, -2.5, 1.2), (0, 0, 0.95)),
        ("hp_puzzle_console_archive_merge", "close-archive", (0.0, -2.3, 1.15), (0, 0, 0.95)),
        ("hp_puzzle_console_circuit_grid", "close-circuit", (0.0, -2.3, 1.2), (0, 0, 1.0)),
        ("hp_builder_route_switch_console", "close-route", (0.4, -1.95, 1.35), (0, 0, 0.6)),
        ("hp_puzzle_console_gallery_reading", "close-gallery", (0.35, -2.0, 1.45), (0, 0, 1.1)),
    ]
    for glb, tag, loc, tgt in closeups:
        shot(lambda g=glb: import_glb(g), loc, tgt, TMP / f"puzzle-machine-industrial-{tag}.png")


if __name__ == "__main__":
    main()
