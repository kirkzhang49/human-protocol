#!/usr/bin/env python3
"""Render evidence screenshots of the cooked puzzle-machine GLBs.

Renders the EXISTING cooked GLBs (does NOT regenerate them) so a human can
confirm they are real industrial silhouettes rather than flat boards.

Outputs to .tmp/renders/machines/:
  overview-all-machines.png      (all 5 lined up, 3/4 studio angle)
  close-color_sequence.png
  close-archive_merge.png
  close-circuit_grid.png
  close-route_switch.png
  close-gallery_reading.png

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/asset-build/render-puzzle-machine-evidence.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
import mathutils

ROOT = Path(__file__).resolve().parents[2]
GLB_DIR = ROOT / "src/assets/models-cooked/environment/builder-puzzle-machines"
OUT_DIR = ROOT / ".tmp/renders/machines"

MACHINES = {
    "color_sequence": "hp_puzzle_console_color_sequence",
    "circuit_grid": "hp_puzzle_console_circuit_grid",
    "archive_merge": "hp_puzzle_console_archive_merge",
    "route_switch": "hp_builder_route_switch_console",
    "gallery_reading": "hp_puzzle_console_gallery_reading",
}


def clear():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images,
                  bpy.data.cameras, bpy.data.lights, bpy.data.objects):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def import_glb(stem, offset=(0.0, 0.0, 0.0)):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(GLB_DIR / f"{stem}.glb"))
    new = [o for o in bpy.context.scene.objects if o not in before]
    for o in new:
        o.location.x += offset[0]
        o.location.y += offset[1]
        o.location.z += offset[2]
    return new


def world_bbox(objects):
    """Return (min_v, max_v) world-space bounding box over the mesh objects."""
    deps = bpy.context.evaluated_depsgraph_get()
    mins = mathutils.Vector((1e9, 1e9, 1e9))
    maxs = mathutils.Vector((-1e9, -1e9, -1e9))
    found = False
    for o in objects:
        if o.type != "MESH":
            continue
        found = True
        ob = o.evaluated_get(deps)
        mw = o.matrix_world
        for corner in ob.bound_box:
            wc = mw @ mathutils.Vector(corner)
            for i in range(3):
                mins[i] = min(mins[i], wc[i])
                maxs[i] = max(maxs[i], wc[i])
    if not found:
        return mathutils.Vector((-1, -1, 0)), mathutils.Vector((1, 1, 2))
    return mins, maxs


def setup_world(strength=1.0, color=(0.45, 0.46, 0.5)):
    world = bpy.data.worlds.new("w")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (color[0], color[1], color[2], 1.0)
        bg.inputs[1].default_value = strength


def add_backdrop(center, size):
    """A neutral grey ground+wall plane so silhouettes read clearly."""
    mat = bpy.data.materials.new("backdrop")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.52, 0.53, 0.55, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.95

    # Floor
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(center[0], center[1] + size * 1.5, 0))
    floor = bpy.context.active_object
    floor.data.materials.append(mat)

    # Back wall
    bpy.ops.mesh.primitive_plane_add(size=size * 6, location=(center[0], center[1] + size * 2.0, size))
    wall = bpy.context.active_object
    wall.rotation_euler = (math.radians(90), 0, 0)
    wall.data.materials.append(mat)


def add_lights(center, scale):
    key = bpy.data.lights.new("key", "AREA")
    key.energy = 700 * scale * scale
    key.size = 3 * scale
    ko = bpy.data.objects.new("key", key)
    ko.location = (center[0] - 1.6 * scale, center[1] - 3.2 * scale, center[2] + 3.0 * scale)
    ko.rotation_euler = (math.radians(58), 0, math.radians(-28))
    bpy.context.collection.objects.link(ko)

    fill = bpy.data.lights.new("fill", "AREA")
    fill.energy = 280 * scale * scale
    fill.size = 5 * scale
    fo = bpy.data.objects.new("fill", fill)
    fo.location = (center[0] + 2.6 * scale, center[1] - 2.6 * scale, center[2] + 1.6 * scale)
    fo.rotation_euler = (math.radians(72), 0, math.radians(40))
    bpy.context.collection.objects.link(fo)

    rim = bpy.data.lights.new("rim", "AREA")
    rim.energy = 240 * scale * scale
    rim.size = 2.5 * scale
    ro = bpy.data.objects.new("rim", rim)
    ro.location = (center[0], center[1] + 2.4 * scale, center[2] + 2.6 * scale)
    ro.rotation_euler = (math.radians(-60), 0, 0)
    bpy.context.collection.objects.link(ro)


def frame_camera(mins, maxs, lens=50):
    """Place a 3/4-angle camera that frames the bbox."""
    center = (mins + maxs) * 0.5
    dims = maxs - mins
    radius = max(dims.x, dims.y, dims.z, 0.5)

    # 3/4 angle: in front (-Y), to the left, raised up.
    dist = radius * 2.4 + 1.0
    cam_loc = mathutils.Vector((
        center.x - dist * 0.55,
        center.y - dist * 0.95,
        center.z + dist * 0.45,
    ))

    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    co = bpy.data.objects.new("cam", cam)
    co.location = cam_loc
    bpy.context.collection.objects.link(co)
    direction = center - cam_loc
    co.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = co
    return co, center, radius


def render(out, res=(900, 900), samples=48):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        try:
            scene.eevee.taa_render_samples = samples
        except Exception:
            pass
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
        try:
            scene.eevee.taa_render_samples = samples
        except Exception:
            pass
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "Standard"
    scene.render.filepath = str(out)
    bpy.ops.render.render(write_still=True)
    print(f"wrote {out}")


def report_stats(stem, objects):
    verts = 0
    tris = 0
    deps = bpy.context.evaluated_depsgraph_get()
    for o in objects:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(deps).to_mesh()
        verts += len(me.vertices)
        tris += sum(max(len(p.vertices) - 2, 0) for p in me.polygons)
        o.evaluated_get(deps).to_mesh_clear()
    print(f"STATS {stem}: verts={verts} tris={tris}")
    return verts, tris


def close_shot(tag, stem, res=(900, 900)):
    clear()
    setup_world()
    objs = import_glb(stem)
    verts, tris = report_stats(stem, objs)
    mins, maxs = world_bbox(objs)
    center = (mins + maxs) * 0.5
    radius = max((maxs - mins).x, (maxs - mins).y, (maxs - mins).z, 0.5)
    add_backdrop((center.x, center.y, center.z), radius)
    add_lights((center.x, center.y, center.z), radius)
    frame_camera(mins, maxs)
    render(OUT_DIR / f"close-{tag}.png", res)
    return verts, tris


def overview_shot(res=(1600, 900)):
    clear()
    setup_world()
    # Line up all 5 along X with generous spacing.
    all_objs = []
    spacing = 4.5
    start = -2 * spacing
    for i, stem in enumerate(MACHINES.values()):
        objs = import_glb(stem, (start + i * spacing, 0, 0))
        all_objs.extend(objs)
    mins, maxs = world_bbox(all_objs)
    center = (mins + maxs) * 0.5
    radius = max((maxs - mins).x, (maxs - mins).y, (maxs - mins).z, 0.5)
    add_backdrop((center.x, center.y, center.z), radius * 0.5)
    add_lights((center.x, center.y, center.z), radius * 0.45)
    frame_camera(mins, maxs, lens=42)
    render(OUT_DIR / "overview-all-machines.png", res)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    overview_shot()
    for tag, stem in MACHINES.items():
        close_shot(tag, stem)


if __name__ == "__main__":
    main()
