#!/usr/bin/env python3
import json
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level01/reference-decals"
SOURCE_MODEL_DIR = ROOT / "src/assets/models/environment/level01"
COOKED_MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level01"

KINDS = {
    "human_body_reference": {
        "title": "HUMAN SCALE",
        "png": "hp_decal_human_body_reference.png",
        "glb": "hp_decal_human_body_reference.glb",
        "material": "hp_decal_human_body_reference_image2_poster",
    },
    "human_hand_reference": {
        "title": "HAND ASSET",
        "png": "hp_decal_human_hand_reference.png",
        "glb": "hp_decal_human_hand_reference.glb",
        "material": "hp_decal_human_hand_reference_image2_poster",
    },
    "human_spine_reference": {
        "title": "SPINE MAP",
        "png": "hp_decal_human_spine_reference.png",
        "glb": "hp_decal_human_spine_reference.glb",
        "material": "hp_decal_human_spine_reference_image2_poster",
    },
    "human_reference_triptych": {
        "title": "REFERENCE TRIPTYCH",
        "png": "hp_decal_human_reference_triptych.png",
        "glb": "hp_decal_human_reference_triptych.glb",
        "material": "hp_decal_human_reference_triptych_image2_poster",
        "components": ["human_body_reference", "human_hand_reference", "human_spine_reference"],
        "quadSize": (2.46, 1.22),
        "alphaMode": "OPAQUE",
        "baseAlpha": 1.0,
    },
}


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def draw_reference_decal(kind, title):
    if kind == "human_reference_triptych":
        component_kinds = KINDS[kind]["components"]
        panels = [draw_reference_decal(component_kind, KINDS[component_kind]["title"]) for component_kind in component_kinds]
        width = sum(panel.width for panel in panels)
        height = max(panel.height for panel in panels)
        image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        x = 0
        for panel in panels:
            image.alpha_composite(panel, (x, 0))
            x += panel.width
        return image

    width, height = 512, 768
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = image.load()
    for y in range(height):
        t = y / max(1, height - 1)
        r = round(18 * (1 - t) + 4 * t)
        g = round(48 * (1 - t) + 12 * t)
        b = round(58 * (1 - t) + 18 * t)
        for x in range(width):
            pixels[x, y] = (r, g, b, 245)

    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((24, 24, 488, 744), outline=(132, 239, 255, 219), width=10)
    draw.rectangle((48, 58, 464, 700), outline=(255, 221, 156, 140), width=3)
    draw.text((58, 84), title, fill=(216, 250, 255, 230), font=font(34, bold=True))
    draw.text((58, 133), "LEVEL 01 REFERENCE", fill=(118, 238, 255, 189), font=font(19, bold=True))

    cx, cy = 256, 398
    white = (238, 252, 255, 230)
    white_fill = (238, 252, 255, 214)
    cyan = (119, 240, 255, 219)
    amber = (255, 200, 112, 209)

    if kind == "human_body_reference":
        draw.ellipse((cx - 42, cy - 212, cx + 42, cy - 128), fill=white_fill)
        line(draw, [(cx, cy - 120), (cx, cy + 70)], white, 18)
        line(draw, [(cx - 92, cy - 76), (cx + 92, cy - 76)], white, 18)
        line(draw, [(cx - 42, cy + 68), (cx - 78, cy + 210)], white, 18)
        line(draw, [(cx + 42, cy + 68), (cx + 78, cy + 210)], white, 18)
        for offset_y in [-100, -40, 20, 82]:
            y = cy + offset_y
            line(draw, [(cx - 126, y), (cx - 42, y)], cyan, 5)
            line(draw, [(cx + 42, y), (cx + 126, y)], cyan, 5)
    elif kind == "human_hand_reference":
        line(draw, [(cx - 38, cy + 112), (cx - 34, cy - 30), (cx - 92, cy - 104)], white, 16)
        for x, h in [(-60, 180), (-20, 220), (22, 210), (62, 168)]:
            line(draw, [(cx + x, cy + 70), (cx + x + 8, cy + 70 - h)], white, 16)
        draw.ellipse((cx - 92, cy - 6, cx + 92, cy + 230), outline=white, width=16)
        for x in [-60, -20, 22, 62]:
            draw.ellipse((cx + x - 5, cy - 51, cx + x + 13, cy - 33), outline=amber, width=5)
    else:
        draw.ellipse((cx - 38, cy - 214, cx + 38, cy - 138), outline=white, width=12)
        points = [(cx, cy - 130)]
        for i in range(12):
            y = cy - 120 + i * 23
            points.append((cx + math.sin(i * 0.85) * 18, y))
        line(draw, points, white, 12)
        line(draw, [(cx - 82, cy - 58), (cx + 82, cy - 58)], cyan, 7)
        line(draw, [(cx - 58, cy + 84), (cx + 58, cy + 84)], cyan, 7)

    for i in range(5):
        draw.rectangle((58, 626 + i * 21, 58 + 240 - i * 28, 632 + i * 21), fill=(119, 240, 255, 128))
    return image


def line(draw, points, fill, width):
    draw.line(points, fill=fill, width=width, joint="curve")


def pad4(blob, pad_byte=b"\x00"):
    padding = (-len(blob)) % 4
    if padding:
        blob += pad_byte * padding
    return blob


def add_buffer_view(buffer, blob, target=None):
    offset = len(buffer)
    buffer.extend(blob)
    while len(buffer) % 4:
        buffer.append(0)
    view = {"buffer": 0, "byteOffset": offset, "byteLength": len(blob)}
    if target:
        view["target"] = target
    return view


def write_textured_quad_glb(output_path, texture_bytes, material_name, quad_size=(1.0, 1.0), alpha_mode="BLEND", base_alpha=0.92):
    half_width = quad_size[0] / 2
    half_height = quad_size[1] / 2
    positions = [
        -half_width, -half_height, 0.0,
        half_width, -half_height, 0.0,
        half_width, half_height, 0.0,
        -half_width, half_height, 0.0,
    ]
    normals = [0.0, 0.0, 1.0] * 4
    uvs = [
        0.0, 1.0,
        1.0, 1.0,
        1.0, 0.0,
        0.0, 0.0,
    ]
    indices = [0, 1, 2, 0, 2, 3]
    buffer = bytearray()
    buffer_views = []

    def view(blob, target=None):
        buffer_views.append(add_buffer_view(buffer, blob, target))
        return len(buffer_views) - 1

    position_view = view(struct.pack("<" + "f" * len(positions), *positions), 34962)
    normal_view = view(struct.pack("<" + "f" * len(normals), *normals), 34962)
    uv_view = view(struct.pack("<" + "f" * len(uvs), *uvs), 34962)
    index_view = view(struct.pack("<" + "H" * len(indices), *indices), 34963)
    image_view = view(texture_bytes)

    gltf = {
        "asset": {"version": "2.0", "generator": "HumanProtocol level01 reference decal baker"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": material_name + "_root", "mesh": 0}],
        "meshes": [
            {
                "name": material_name + "_quad",
                "primitives": [
                    {
                        "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2},
                        "indices": 3,
                        "material": 0,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": material_name,
                "doubleSided": True,
                "alphaMode": alpha_mode,
                "pbrMetallicRoughness": {
                    "baseColorFactor": [1.0, 1.0, 1.0, base_alpha],
                    "baseColorTexture": {"index": 0, "texCoord": 0},
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.58,
                },
                "emissiveFactor": [0.035, 0.12, 0.15],
            }
        ],
        "textures": [{"sampler": 0, "source": 0}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": image_view, "mimeType": "image/png", "name": material_name + "_texture"}],
        "accessors": [
            {
                "bufferView": position_view,
                "componentType": 5126,
                "count": 4,
                "type": "VEC3",
                "min": [-half_width, -half_height, 0.0],
                "max": [half_width, half_height, 0.0],
            },
            {"bufferView": normal_view, "componentType": 5126, "count": 4, "type": "VEC3"},
            {"bufferView": uv_view, "componentType": 5126, "count": 4, "type": "VEC2"},
            {"bufferView": index_view, "componentType": 5123, "count": 6, "type": "SCALAR", "min": [0], "max": [3]},
        ],
        "bufferViews": buffer_views,
        "buffers": [{"byteLength": len(buffer)}],
    }

    json_chunk = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf8"), b" ")
    bin_chunk = pad4(bytes(buffer), b"\x00")
    total_length = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    glb = bytearray()
    glb.extend(struct.pack("<III", 0x46546C67, 2, total_length))
    glb.extend(struct.pack("<I4s", len(json_chunk), b"JSON"))
    glb.extend(json_chunk)
    glb.extend(struct.pack("<I4s", len(bin_chunk), b"BIN\x00"))
    glb.extend(bin_chunk)
    output_path.write_bytes(glb)


def main():
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    COOKED_MODEL_DIR.mkdir(parents=True, exist_ok=True)
    for kind, config in KINDS.items():
        png_path = TEXTURE_DIR / config["png"]
        image = draw_reference_decal(kind, config["title"])
        image.save(png_path)
        texture_bytes = png_path.read_bytes()
        quad_size = config.get("quadSize", (1.0, 1.0))
        alpha_mode = config.get("alphaMode", "BLEND")
        base_alpha = config.get("baseAlpha", 0.92)
        for model_dir in [SOURCE_MODEL_DIR, COOKED_MODEL_DIR]:
            write_textured_quad_glb(model_dir / config["glb"], texture_bytes, config["material"], quad_size, alpha_mode, base_alpha)
        print(f"wrote {png_path.relative_to(ROOT)} and {config['glb']}")


if __name__ == "__main__":
    main()
