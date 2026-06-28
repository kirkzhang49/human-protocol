import math
import random
import json
import struct
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "src" / "assets" / "models" / "viewmodel"
JOBS = [
    (ASSET_DIR / "hand-rod-onehand-v1.glb", ASSET_DIR / "hand-rod-onehand-v1-hp-baked.glb"),
    (ASSET_DIR / "hand-sidearm-onehand-v1.glb", ASSET_DIR / "hand-sidearm-onehand-v1-hp-baked.glb"),
]

HP = {
    "body": (0.62, 0.72, 0.68, 1.0),
    "armor": (0.095, 0.145, 0.15, 1.0),
    "dark": (0.027, 0.063, 0.082, 1.0),
    "hand": (0.32, 0.405, 0.385, 0.72),
    "hand_shadow": (0.052, 0.085, 0.085, 1.0),
    "cyan": (0.55, 0.98, 1.0, 1.0),
    "amber": (0.725, 0.604, 0.329, 1.0),
    "steel": (0.72, 0.79, 0.75, 1.0),
}


def classify_material(name: str):
    key = name.lower()
    if any(part in key for part in ("cyan", "energy", "charge", "emissive", "glow")):
        return "cyan", 0.18, 0.28, HP["cyan"], 0.7
    if any(part in key for part in ("amber", "bronze", "copper", "brass", "indicator")):
        return "amber", 0.48, 0.56, HP["amber"], 0.1
    if any(part in key for part in ("skin", "hand", "palm", "finger", "thumb", "nail")):
        if any(part in key for part in ("shadow", "recess", "sleeve", "matte_black")):
            return "hand_shadow", 0.04, 0.82, HP["hand_shadow"], 0.0
        return "hand", 0.02, 0.78, HP["hand"], 0.0
    if any(part in key for part in ("rubber", "black", "dark", "shadow", "sleeve", "grip", "polymer", "wrap")):
        return "dark", 0.18, 0.78, HP["dark"], 0.0
    if any(part in key for part in ("steel", "titanium", "tempered", "edge", "shaft", "rod", "slide", "receiver", "panel", "gunmetal")):
        return "steel", 0.72, 0.38, HP["steel"], 0.0
    return "armor", 0.42, 0.52, HP["armor"], 0.0


def color_pixel(base, x, y, variant):
    stripe = 0.035 * math.sin((x * 0.13) + (y * 0.047))
    grain = 0.018 * math.sin((x * 0.37) - (y * 0.21))
    edge = 0.04 if (x % 53 in (0, 1) or y % 47 == 0) and variant in {"steel", "armor"} else 0
    if variant in {"cyan", "amber"}:
        stripe *= 0.35
        grain *= 0.35
    return (
        max(0, min(1, base[0] + stripe + grain + edge)),
        max(0, min(1, base[1] + stripe + grain + edge)),
        max(0, min(1, base[2] + stripe + grain + edge)),
        base[3],
    )


def make_baked_image(name, base, variant, size=256):
    image = bpy.data.images.new(name=name, width=size, height=size, alpha=True)
    rng = random.Random(name)
    pixels = [0.0] * (size * size * 4)
    for y in range(size):
        for x in range(size):
            r, g, b, a = color_pixel(base, x + rng.randint(0, 13), y + rng.randint(0, 13), variant)
            offset = (y * size + x) * 4
            pixels[offset : offset + 4] = [r, g, b, a]
    image.pixels.foreach_set(pixels)
    image.pack()
    return image


def set_principled_input(bsdf, names, value):
    for name in names:
        socket = bsdf.inputs.get(name)
        if socket:
            socket.default_value = value
            return


def style_material(material):
    variant, metalness, roughness, color, emissive = classify_material(material.name)
    material.use_nodes = True
    material.diffuse_color = color
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        return

    for node in list(nodes):
        if node.type == "TEX_IMAGE":
            nodes.remove(node)

    image = make_baked_image(f"hp_baked_{material.name[:42]}", color, variant)
    tex = nodes.new(type="ShaderNodeTexImage")
    tex.name = f"HP_Baked_{variant}"
    tex.image = image
    tex.extension = "REPEAT"
    material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])

    set_principled_input(bsdf, ("Metallic",), metalness)
    set_principled_input(bsdf, ("Roughness",), roughness)
    if emissive > 0:
        set_principled_input(bsdf, ("Emission Color", "Emission"), color)
        set_principled_input(bsdf, ("Emission Strength",), emissive)
    material.name = f"hp_{variant}_{material.name}"


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for datablock in (bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(datablock):
            datablock.remove(item)


def rebake(input_path: Path, output_path: Path):
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    for material in list(bpy.data.materials):
        style_material(material)

    for obj in bpy.context.scene.objects:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )
    patch_glb_material_json(output_path)
    print(f"HP baked viewmodel: {input_path.name} -> {output_path.name}")


def patch_glb_material_json(path: Path):
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise ValueError(f"Not a GLB: {path}")
    chunks = []
    offset = 12
    while offset < len(data):
        chunk_length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk_data = data[offset : offset + chunk_length]
        offset += chunk_length
        chunks.append([chunk_type, chunk_data])

    json_index = next(index for index, chunk in enumerate(chunks) if chunk[0] == 0x4E4F534A)
    document = json.loads(chunks[json_index][1].rstrip(b" \t\r\n\0").decode("utf-8"))
    for material in document.get("materials", []):
        variant, metalness, roughness, color, emissive = classify_material(material.get("name", ""))
        pbr = material.setdefault("pbrMetallicRoughness", {})
        pbr["baseColorFactor"] = [round(channel, 4) for channel in color]
        pbr["metallicFactor"] = round(metalness, 4)
        pbr["roughnessFactor"] = round(roughness, 4)
        pbr.pop("baseColorTexture", None)
        pbr.pop("metallicRoughnessTexture", None)
        material.pop("normalTexture", None)
        material.pop("occlusionTexture", None)
        if color[3] < 0.999:
            material["alphaMode"] = "BLEND"
        else:
            material.pop("alphaMode", None)
        if emissive > 0:
            material["emissiveFactor"] = [round(color[0] * emissive, 4), round(color[1] * emissive, 4), round(color[2] * emissive, 4)]
        else:
            material.pop("emissiveFactor", None)
        material.setdefault("extras", {})["hpStyleBake"] = variant

    json_bytes = json.dumps(document, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    chunks[json_index][1] = json_bytes

    total_length = 12 + sum(8 + len(chunk_data) for _, chunk_data in chunks)
    rebuilt = bytearray()
    rebuilt += struct.pack("<III", 0x46546C67, 2, total_length)
    for chunk_type, chunk_data in chunks:
        rebuilt += struct.pack("<II", len(chunk_data), chunk_type)
        rebuilt += chunk_data
    path.write_bytes(rebuilt)


def main():
    for input_path, output_path in JOBS:
        if not input_path.exists():
            raise FileNotFoundError(input_path)
        rebake(input_path, output_path)


if __name__ == "__main__":
    main()
