#!/usr/bin/env python3
"""Render a 3D preview sheet for the route-output orb pickup GLBs.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/qa/render-route-output-orb-preview.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT_PREVIEW = ROOT / "src/assets/manifests/reports/hp_route_output_orb_keys_3d_preview.png"
GLBS = [
    ("1", ROOT / "src/assets/models-cooked/environment/props/hp_pickup_route_output_orb_1.glb"),
    ("2", ROOT / "src/assets/models-cooked/environment/props/hp_pickup_route_output_orb_2.glb"),
    ("3", ROOT / "src/assets/models-cooked/environment/props/hp_pickup_route_output_orb_3.glb"),
    ("4", ROOT / "src/assets/models-cooked/environment/props/hp_pickup_route_output_orb_4.glb"),
]


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.lights, bpy.data.cameras, bpy.data.curves):
        for item in list(blocks):
            if item.users == 0:
                blocks.remove(item)


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def imported_objects_before_after(before: set[str]) -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.name not in before]


def bounds_center(objects: list[bpy.types.Object]) -> Vector:
    points: list[Vector] = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return Vector((0, 0, 0))
    min_v = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    max_v = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return (min_v + max_v) * 0.5


def add_label(text: str, x: float) -> None:
    bpy.ops.object.text_add(location=(x, -0.54, -0.16), rotation=(math.radians(74), 0, 0))
    obj = bpy.context.object
    obj.name = f"route_orb_preview_label_{text.replace(' ', '_').lower()}"
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = 0.08
    obj.data.extrude = 0.006
    mat = bpy.data.materials.new(f"{obj.name}_mat")
    mat.diffuse_color = (0.75, 0.96, 1.0, 1)
    obj.data.materials.append(mat)


def add_floor_marker(x: float, accent: tuple[float, float, float]) -> None:
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.48, depth=0.018, location=(x, 0, -0.03))
    base = bpy.context.object
    base.name = "route_orb_preview_floor_glow"
    mat = bpy.data.materials.new(f"{base.name}_{x:.1f}")
    mat.diffuse_color = (*accent, 0.42)
    base.data.materials.append(mat)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.42, minor_radius=0.012, major_segments=80, minor_segments=8, location=(x, 0, -0.01))
    ring = bpy.context.object
    ring.name = "route_orb_preview_floor_ring"
    ring.data.materials.append(mat)


def import_orb(label: str, glb: Path, x: float, accent: tuple[float, float, float]) -> None:
    before = {obj.name for obj in bpy.context.scene.objects}
    bpy.ops.import_scene.gltf(filepath=str(glb))
    objects = imported_objects_before_after(before)
    bpy.context.view_layer.update()
    center = bounds_center(objects)
    roots = [obj for obj in objects if obj.parent not in objects]
    for obj in roots:
        obj.location.x += x - center.x
        obj.location.y += -center.y
        obj.location.z += -center.z + 0.28
    bpy.context.view_layer.update()
    add_floor_marker(x, accent)
    add_label(label, x)


def add_lighting() -> None:
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.012, 0.018, 0.024)

    bpy.ops.object.light_add(type="AREA", location=(0, -3.2, 2.5))
    key = bpy.context.object
    key.name = "route_orb_preview_key_light"
    key.data.energy = 600
    key.data.size = 4.2

    bpy.ops.object.light_add(type="POINT", location=(-2.8, -1.1, 0.75))
    cyan = bpy.context.object
    cyan.name = "route_orb_preview_cyan_fill"
    cyan.data.color = (0.35, 0.85, 1.0)
    cyan.data.energy = 85

    bpy.ops.object.light_add(type="POINT", location=(2.8, -1.2, 0.8))
    warm = bpy.context.object
    warm.name = "route_orb_preview_warm_fill"
    warm.data.color = (1.0, 0.62, 0.27)
    warm.data.energy = 70


def setup_camera() -> None:
    bpy.ops.object.camera_add(location=(0, -3.2, 0.95))
    camera = bpy.context.object
    camera.name = "route_orb_preview_camera"
    look_at(camera, (0, 0.02, 0.26))
    camera.data.lens = 58
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.4
    bpy.context.scene.camera = camera


def setup_render() -> None:
    scene = bpy.context.scene
    scene.render.resolution_x = 2200
    scene.render.resolution_y = 900
    scene.render.film_transparent = False
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    if hasattr(scene, "eevee"):
        scene.eevee.taa_render_samples = 64
    scene.view_settings.view_transform = "Filmic"
    scene.view_settings.look = "Medium High Contrast"
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1


def main() -> None:
    OUT_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    reset_scene()
    accents = [(0.45, 0.91, 1.0), (1.0, 0.84, 0.42), (0.44, 0.86, 0.57), (0.72, 0.58, 1.0)]
    for index, (label, glb) in enumerate(GLBS):
        import_orb(label, glb, (index - 1.5) * 0.62, accents[index])
    add_lighting()
    setup_camera()
    setup_render()
    bpy.context.scene.render.filepath = str(OUT_PREVIEW)
    bpy.ops.render.render(write_still=True)
    print(f"ROUTE_OUTPUT_ORB_3D_PREVIEW {OUT_PREVIEW}")


if __name__ == "__main__":
    main()
