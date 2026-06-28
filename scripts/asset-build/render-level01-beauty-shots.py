"""Render close-up beauty shots for Level 01 hero assets.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/asset-build/render-level01-beauty-shots.py
"""
import math
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level01-furniture-image2"
OUT_DIR = ROOT / ".tmp/level01-03-furniture-polish/level01"
OUT_DIR.mkdir(parents=True, exist_ok=True)

HERO_SHOTS = [
    {
        "model": "room_l1_img2_repair_workbench",
        "out": "level01-close-repair-workbench.png",
        "cam_loc": (1.6, -1.8, 1.35),
        "cam_rot": (math.radians(68), 0, math.radians(148)),
        "lens": 42,
    },
    {
        "model": "room_l1_img2_parts_cabinet",
        "out": "level01-close-parts-cabinet.png",
        "cam_loc": (0.9, -1.4, 1.2),
        "cam_rot": (math.radians(72), 0, math.radians(148)),
        "lens": 42,
    },
]


def setup_scene():
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except (TypeError, ValueError):
            continue
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.new("hero_world")
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[0].default_value = (0.035, 0.04, 0.05, 1)
        bg.inputs[1].default_value = 0.5
    scene.world = world

    # Key light
    key = bpy.data.lights.new("key", type="AREA")
    key.energy = 400
    key.size = 3
    key_obj = bpy.data.objects.new("key", key)
    key_obj.location = (-2.5, -2.0, 3.5)
    key_obj.rotation_euler = (math.radians(48), math.radians(-18), math.radians(-36))
    scene.collection.objects.link(key_obj)

    # Fill light (cyan tint for HP facility identity)
    fill = bpy.data.lights.new("fill", type="AREA")
    fill.energy = 120
    fill.color = (0.6, 0.9, 1.0)
    fill.size = 6
    fill_obj = bpy.data.objects.new("fill", fill)
    fill_obj.location = (3, 3, 2.5)
    scene.collection.objects.link(fill_obj)

    # Rim light
    rim = bpy.data.lights.new("rim", type="SPOT")
    rim.energy = 800
    rim.spot_size = math.radians(40)
    rim_obj = bpy.data.objects.new("rim", rim)
    rim_obj.location = (-0.5, 2.5, 2.5)
    rim_obj.rotation_euler = (math.radians(60), 0, math.radians(190))
    scene.collection.objects.link(rim_obj)

    return scene


def render_shot(shot):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    scene = bpy.context.scene
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)

    # Import GLB
    glb = MODEL_DIR / f"{shot['model']}.glb"
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    new = [o for o in bpy.context.scene.objects if o not in before]
    # Model is already grounded at Y=0 in GLB Y-up space

    # Camera
    cam_data = bpy.data.cameras.new("hero_cam")
    cam = bpy.data.objects.new("hero_cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = shot["cam_loc"]
    cam.rotation_euler = shot["cam_rot"]
    cam_data.lens = shot["lens"]
    scene.camera = cam

    scene.render.filepath = str(OUT_DIR / shot["out"])
    bpy.ops.render.render(write_still=True)
    print(f"[render] {shot['out']}")


def main():
    setup_scene()
    for shot in HERO_SHOTS:
        render_shot(shot)


if __name__ == "__main__":
    main()
