#!/usr/bin/env python3
"""Bake route-output authorization orb pickup GLBs from Image2 API art.

This script does not draw the source artwork. It consumes the repo-local copy
of an Image2/API-generated four-panel wrap sheet, crops one wrap texture per
output, wraps that texture onto an inner sphere, and places it inside a clear
outer shell with a small protective frame.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/asset-build/generate-route-output-orb-keys-image2.py
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
SOURCE_API_ORIGINAL = Path("/Users/zhengkaizhang/.codex/generated_images/019f0b84-6b3f-7141-a1a1-21484d6226cf/ig_0c257fac35b406fa016a40a480d748819895b172f406002d27.png")
SOURCE_API_REPO = ROOT / "src/assets/textures/environment/route-output-orbs/image2-sources/hp_route_output_orb_keys_image2_api_wrap_sheet_v2.png"
OUT_GLB_DIR = ROOT / "src/assets/models-cooked/environment/props"
OUT_BLEND = ROOT / "src/assets/source_blend/pickups/hp_route_output_orb_keys_image2_v1.blend"
OUT_TEXTURE_DIR = ROOT / "src/assets/textures/environment/route-output-orbs/image2-sources"
OUT_CONTACT_SHEET = ROOT / "src/assets/manifests/reports/hp_route_output_orb_keys_image2_contact_sheet.png"
OUT_REPORT = ROOT / "src/assets/manifests/reports/hp_route_output_orb_keys_image2_report.json"

PANEL_WIDTH = 1024
PANEL_HEIGHT = 512

IMAGE2_API_PROMPT = (
    "Generate a flat texture atlas, not a 3D render. Wide horizontal PNG, exactly four equal panels side by side, each panel is a seamless "
    "equirectangular sphere-wrap texture for a small sci-fi orb. Do not show a sphere, dome, perspective, shadows, or mockup scene. It must "
    "look like flat material artwork designed to wrap around a UV sphere. No readable words, no logos. Use thin dark gutters between panels. "
    "Panel 1 cyan, panel 2 amber gold, panel 3 green, panel 4 violet. Each panel: dark smoked titanium base, brass-gold equator stripe across "
    "the middle, curved latitude/longitude circuit arcs, repeated glowing medallion icons around the equator, small luminous dots, fine micro "
    "circuit traces, subtle glass highlights. Output glyphs are geometric not text: panel 1 has simple vertical bar motifs, panel 2 has double "
    "routed S-path motifs, panel 3 has triple bracket path motifs, panel 4 has forked H-path motifs. Make the artwork premium, clean, tileable "
    "horizontally within each panel, suitable to bake as a texture on an inner sphere inside a transparent glass key orb."
)

SPECS = [
    {"index": 1, "modelKey": "pickup_route_output_orb_1", "file": "hp_pickup_route_output_orb_1.glb", "accent": "#72e8ff"},
    {"index": 2, "modelKey": "pickup_route_output_orb_2", "file": "hp_pickup_route_output_orb_2.glb", "accent": "#ffd76b"},
    {"index": 3, "modelKey": "pickup_route_output_orb_3", "file": "hp_pickup_route_output_orb_3.glb", "accent": "#71dc92"},
    {"index": 4, "modelKey": "pickup_route_output_orb_4", "file": "hp_pickup_route_output_orb_4.glb", "accent": "#b995ff"},
]


def ensure_dirs() -> None:
    for path in [OUT_GLB_DIR, OUT_BLEND.parent, OUT_TEXTURE_DIR, OUT_REPORT.parent]:
        path.mkdir(parents=True, exist_ok=True)


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for blocks in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.textures):
        for item in list(blocks):
            if item.users == 0:
                blocks.remove(item)


def hex_rgb(value: str) -> tuple[float, float, float]:
    raw = value.lstrip("#")
    return (int(raw[0:2], 16) / 255, int(raw[2:4], 16) / 255, int(raw[4:6], 16) / 255)


def mix(a: tuple[float, float, float], b: tuple[float, float, float], t: float) -> tuple[float, float, float]:
    return tuple(a[i] * (1 - t) + b[i] * t for i in range(3))


def set_input(node: bpy.types.Node, name: str, value) -> None:
    socket = node.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def pixel_at(pixels: list[float], width: int, height: int, x: int, y: int) -> tuple[float, float, float, float]:
    xx = max(0, min(width - 1, x))
    yy = max(0, min(height - 1, y))
    index = (yy * width + xx) * 4
    return pixels[index], pixels[index + 1], pixels[index + 2], pixels[index + 3]


def sample_bilinear(pixels: list[float], width: int, height: int, x: float, y: float) -> tuple[float, float, float, float]:
    x0 = math.floor(x)
    y0 = math.floor(y)
    tx = x - x0
    ty = y - y0
    c00 = pixel_at(pixels, width, height, x0, y0)
    c10 = pixel_at(pixels, width, height, x0 + 1, y0)
    c01 = pixel_at(pixels, width, height, x0, y0 + 1)
    c11 = pixel_at(pixels, width, height, x0 + 1, y0 + 1)
    out = []
    for i in range(4):
        a = c00[i] * (1 - tx) + c10[i] * tx
        b = c01[i] * (1 - tx) + c11[i] * tx
        out.append(a * (1 - ty) + b * ty)
    return tuple(out)  # type: ignore[return-value]


def save_image(path: Path, name: str, width: int, height: int, pixels: list[float]) -> Path:
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    image.pixels = pixels
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    return path


def crop_api_wrap_layers() -> list[tuple[Path, int, int, list[float]]]:
    if not SOURCE_API_REPO.exists():
        raise FileNotFoundError(f"Missing Image2 API wrap sheet: {SOURCE_API_REPO}")
    source = bpy.data.images.load(str(SOURCE_API_REPO))
    width, height = source.size
    pixels = list(source.pixels)
    panel_source_width = width / 4.0
    layers: list[tuple[Path, int, int, list[float]]] = []
    for spec in SPECS:
        index = spec["index"] - 1
        x0 = index * panel_source_width
        out_pixels: list[float] = [0.0] * (PANEL_WIDTH * PANEL_HEIGHT * 4)
        for y in range(PANEL_HEIGHT):
            sy = (y + 0.5) / PANEL_HEIGHT * height - 0.5
            for x in range(PANEL_WIDTH):
                sx = x0 + (x + 0.5) / PANEL_WIDTH * panel_source_width - 0.5
                color = sample_bilinear(pixels, width, height, sx, sy)
                dst = (y * PANEL_WIDTH + x) * 4
                out_pixels[dst:dst + 4] = color
        path = OUT_TEXTURE_DIR / f"hp_route_output_orb_{spec['index']}_image2_api_wrap_v2.png"
        save_image(path, f"hp_route_output_orb_{spec['index']}_image2_api_wrap_v2", PANEL_WIDTH, PANEL_HEIGHT, out_pixels)
        layers.append((path, PANEL_WIDTH, PANEL_HEIGHT, out_pixels))
    return layers


def write_contact_sheet(layers: list[tuple[Path, int, int, list[float]]]) -> None:
    width = PANEL_WIDTH * len(layers)
    height = PANEL_HEIGHT
    pixels = [0.0] * (width * height * 4)
    for layer_index, (_, layer_width, layer_height, layer_pixels) in enumerate(layers):
        x_offset = layer_index * PANEL_WIDTH
        for y in range(min(height, layer_height)):
            for x in range(min(PANEL_WIDTH, layer_width)):
                src = (y * layer_width + x) * 4
                dst = (y * width + x_offset + x) * 4
                pixels[dst:dst + 4] = layer_pixels[src:src + 4]
    save_image(OUT_CONTACT_SHEET, "hp_route_output_orb_keys_image2_contact_sheet", width, height, pixels)


def mat_principled(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.38,
    metallic: float = 0.0,
    alpha: float = 1.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        raise RuntimeError(f"Material {name} has no Principled BSDF")
    set_input(bsdf, "Base Color", color)
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "Metallic", metallic)
    set_input(bsdf, "Alpha", alpha)
    if emission:
        set_input(bsdf, "Emission Color", emission)
        set_input(bsdf, "Emission Strength", emission_strength)
    if alpha < 1:
        material.blend_method = "BLEND"
        material.show_transparent_back = False
    return material


def wrap_material(name: str, texture_path: Path, emission: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "OPAQUE"
    nodes = material.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        raise RuntimeError(f"Material {name} has no Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(str(texture_path))
    texture.extension = "REPEAT"
    material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    emission_socket = bsdf.inputs.get("Emission Color")
    if emission_socket is not None:
        material.node_tree.links.new(texture.outputs["Color"], emission_socket)
    set_input(bsdf, "Roughness", 0.23)
    set_input(bsdf, "Metallic", 0.0)
    set_input(bsdf, "Emission Color", emission)
    set_input(bsdf, "Emission Strength", 0.82)
    return material


def shade(obj: bpy.types.Object) -> bpy.types.Object:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth()
    finally:
        obj.select_set(False)
    return obj


def sphere(name: str, location: tuple[float, float, float], radius: float, material: bpy.types.Material, segments: int = 48, rings: int = 24) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return shade(obj)


def torus(name: str, location: tuple[float, float, float], major: float, minor: float, material: bpy.types.Material, rotation: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=64, minor_segments=10, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return shade(obj)


def cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float, material: bpy.types.Material, vertices: int = 48) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_bevel", "BEVEL").width = 0.01
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return shade(obj)


def point_light(name: str, location: tuple[float, float, float], color: tuple[float, float, float], energy: float, radius: float) -> bpy.types.Object:
    data = bpy.data.lights.new(name, "POINT")
    data.color = color
    data.energy = energy
    data.shadow_soft_size = radius
    if hasattr(data, "use_custom_distance"):
        data.use_custom_distance = True
    if hasattr(data, "cutoff_distance"):
        data.cutoff_distance = 0.9
    obj = bpy.data.objects.new(name, data)
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def build_orb(spec: dict, texture_path: Path) -> list[bpy.types.Object]:
    index = spec["index"]
    accent = hex_rgb(spec["accent"])
    accent4 = (*accent, 1)
    dark = mat_principled(f"route_orb_{index}_smoked_titanium_socket", (0.018, 0.034, 0.04, 1), roughness=0.32, metallic=0.62)
    brass = mat_principled(f"route_orb_{index}_aged_brass_frame", (0.76, 0.56, 0.22, 1), roughness=0.28, metallic=0.78, emission=(0.7, 0.42, 0.12, 1), emission_strength=0.06)
    glass = mat_principled(
        f"route_orb_{index}_clear_outer_shell",
        (*mix(accent, (0.86, 0.97, 1.0), 0.9), 0.07),
        roughness=0.012,
        metallic=0.0,
        alpha=0.07,
        emission=accent4,
        emission_strength=0.015,
    )
    wrap = wrap_material(f"route_orb_{index}_image2_api_wrapped_inner_sphere", texture_path, accent4)
    inner_light = mat_principled(
        f"route_orb_{index}_inner_ball_light",
        (*accent, 0.42),
        roughness=0.18,
        metallic=0.0,
        alpha=0.42,
        emission=accent4,
        emission_strength=1.35,
    )

    parts: list[bpy.types.Object] = []
    parts.append(cylinder(f"route_orb_{index}_floor_socket", (0, 0, 0.045), 0.18, 0.09, dark, 40))
    inner = sphere(f"route_orb_{index}_image2_api_wrap_inner_sphere", (0, 0, 0.282), 0.158, wrap, 72, 36)
    inner.rotation_euler[2] = math.radians(18 + index * 7)
    parts.append(inner)
    parts.append(torus(f"route_orb_{index}_inner_light_equator", (0, 0, 0.282), 0.165, 0.0045, inner_light, rotation=(math.pi / 2, 0, 0)))
    parts.append(sphere(f"route_orb_{index}_inner_light_core", (0, -0.146, 0.282), 0.024, inner_light, 32, 16))
    parts.append(point_light(f"route_orb_{index}_embedded_inner_point_light", (0, -0.02, 0.282), accent, 1.25, 0.22))
    parts.append(sphere(f"route_orb_{index}_transparent_outer_shell", (0, 0, 0.282), 0.226, glass, 72, 36))
    parts.append(torus(f"route_orb_{index}_front_protective_brass_frame", (0, 0, 0.282), 0.228, 0.014, brass, rotation=(math.pi / 2, 0, 0)))
    parts.append(torus(f"route_orb_{index}_base_locking_trim", (0, 0, 0.112), 0.18, 0.012, brass))
    return parts


def export_glb(spec: dict, parts: list[bpy.types.Object]) -> Path:
    out = OUT_GLB_DIR / spec["file"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    kwargs = {
        "filepath": str(out),
        "export_format": "GLB",
        "use_selection": True,
        "export_apply": True,
        "export_yup": True,
        "export_texcoords": True,
        "export_normals": True,
        "export_materials": "EXPORT",
        "export_image_format": "AUTO",
        "export_texture_dir": "",
    }
    exporter_properties = bpy.ops.export_scene.gltf.get_rna_type().properties
    if "export_lights" in exporter_properties:
        kwargs["export_lights"] = True
    bpy.ops.export_scene.gltf(**kwargs)
    return out


def move_parts(parts: list[bpy.types.Object], x_offset: float) -> None:
    for obj in parts:
        obj.location.x += x_offset


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def triangle_count(parts: list[bpy.types.Object]) -> int:
    total = 0
    for obj in parts:
        if obj.type == "MESH":
            total += sum(len(poly.vertices) - 2 for poly in obj.data.polygons)
    return total


def write_report(records: list[dict]) -> None:
    report = {
        "schemaVersion": "hp.routeOutputOrbKeys.image2Report.v2",
        "assetFamily": "route_output_orb_keys_image2_api_wrap_v2",
        "sourcePolicy": "Image2/API generated four-panel wrap sheet, copied repo-locally and used as source evidence. The script crops and bakes the API art; it does not draw the source texture.",
        "image2Api": {
            "originalGeneratedPath": str(SOURCE_API_ORIGINAL),
            "repoSourcePath": str(SOURCE_API_REPO.relative_to(ROOT)),
            "prompt": IMAGE2_API_PROMPT,
            "toolCallId": "not-exposed-by-codex-imagegen-tool",
            "generationDate": "2026-06-27",
            "commercialStatus": "openai-generated-output-user-owned-subject-to-openai-terms",
        },
        "derivativeScript": "scripts/asset-build/generate-route-output-orb-keys-image2.py",
        "sourceBlend": "src/assets/source_blend/pickups/hp_route_output_orb_keys_image2_v1.blend",
        "contactSheet": "src/assets/manifests/reports/hp_route_output_orb_keys_image2_contact_sheet.png",
        "styleReferences": [
            "src/assets/gui/route-switch/route_switch_output_rotary_buttons_image2_v1.png",
            "src/assets/gui/route-switch/route_switch_icon_language_image2_v1.png",
        ],
        "runtimeContract": "visualKey route_output_orb_N maps to modelKey pickup_route_output_orb_N and unlocks only output N.",
        "mobileBudget": {
            "intendedCountNearRouteConsole": "1-4",
            "sizeMeters": [0.46, 0.55, 0.46],
            "readability": "Image2/API wrapped inner sphere uses texture-driven emission, a small colored light core, a restrained inner emissive equator, and a short-range embedded point light inside a very low-opacity clear shell.",
        },
        "lightingContract": "Each GLB carries route_orb_N_inner_ball_light emissive geometry plus a low-energy route_orb_N_embedded_inner_point_light; runtime also adds a short-distance ball-center light for consistent Three/WebGPU readability without washing out previews.",
        "assets": records,
    }
    OUT_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    ensure_dirs()
    reset_scene()
    layers = crop_api_wrap_layers()
    records: list[dict] = []
    for spec, (texture_path, _, _, _) in zip(SPECS, layers, strict=True):
        parts = build_orb(spec, texture_path)
        glb_path = export_glb(spec, parts)
        records.append({
            "index": spec["index"],
            "visualKey": f"route_output_orb_{spec['index']}",
            "modelKey": spec["modelKey"],
            "glb": str(glb_path.relative_to(ROOT)),
            "image2ApiWrapLayer": str(texture_path.relative_to(ROOT)),
            "accent": spec["accent"],
            "triangleCount": triangle_count(parts),
            "sha256": {
                "glb": sha256(glb_path),
                "image2ApiWrapLayer": sha256(texture_path),
            },
        })
        move_parts(parts, (spec["index"] - 2.5) * 0.72)
    write_contact_sheet(layers)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    write_report(records)
    print("ROUTE_OUTPUT_ORB_KEYS_IMAGE2_API_WRAP_DONE")
    print(f"REPORT {OUT_REPORT}")
    for record in records:
        print(f"GLB {record['glb']} IMAGE2_API_WRAP {record['image2ApiWrapLayer']}")


if __name__ == "__main__":
    main()
