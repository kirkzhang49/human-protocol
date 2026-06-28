#!/usr/bin/env python3
"""Download and normalize selected Poly Haven CC0 museum ceiling assets.

The chandelier is authored as a ceiling-mounted prop: its pivot sits at the
ceiling contact plane and the visible fixture hangs downward from Y=0 after GLB
export. That matches BuilderAssetCatalog's ceiling mount elevation behavior.
"""

from __future__ import annotations

import json
import math
import urllib.request
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
EXTERNAL_ROOT = ROOT / "src/assets/external/polyhaven_museum_ceiling_2026_06_18"
RAW_GLB_DIR = EXTERNAL_ROOT / "raw-glb"
SOURCE_BLEND_DIR = ROOT / "src/assets/source_blend/polyhaven-museum-ceiling"
REPORT = ROOT / "src/assets/manifests/reports/human_protocol_polyhaven_museum_ceiling_v1.json"

ASSET = {
    "assetId": "Chandelier_02",
    "modelKey": "room_cc0_chandelier_02_ceiling",
    "label": "古典黄铜吊灯",
    "author": "Kirill Sannikov",
    "targetWidth": 1.25,
    "role": "ceiling-mounted brass chandelier for a classical museum rotunda ceiling option",
}


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "HumanProtocolAssetPipeline/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": "HumanProtocolAssetPipeline/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        dest.write_bytes(response.read())


def download_polyhaven_gltf(asset_id: str) -> Path:
    files = fetch_json(f"https://api.polyhaven.com/files/{asset_id}")
    gltf = files["gltf"]["1k"]["gltf"]
    asset_dir = EXTERNAL_ROOT / "polyhaven" / asset_id
    gltf_path = asset_dir / Path(gltf["url"]).name
    download(gltf["url"], gltf_path)
    for rel, meta in gltf["include"].items():
        download(meta["url"], asset_dir / rel)
    source_audit = {
        "source": "Poly Haven",
        "assetId": asset_id,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}",
        "downloadUrl": gltf["url"],
        "author": ASSET["author"],
        "license": "CC0",
        "licenseUrl": "https://polyhaven.com/license",
        "commercialUseAllowed": True,
        "modificationAllowed": True,
        "redistributionAllowedInBundledGame": True,
        "attributionRequired": False,
        "resolution": "1k glTF",
    }
    (asset_dir / "human_protocol_source_audit.json").write_text(json.dumps(source_audit, indent=2), encoding="utf-8")
    return gltf_path


def world_bbox(objs: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in objs:
        if obj.type != "MESH":
            continue
        found = True
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            mn.x = min(mn.x, world.x)
            mn.y = min(mn.y, world.y)
            mn.z = min(mn.z, world.z)
            mx.x = max(mx.x, world.x)
            mx.y = max(mx.y, world.y)
            mx.z = max(mx.z, world.z)
    if not found:
        raise RuntimeError("Imported asset has no mesh objects")
    return mn, mx


def make_emissive_mat(name: str, color: tuple[float, float, float, float], strength: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Emission Color"].default_value = color
        bsdf.inputs["Emission Strength"].default_value = strength
        bsdf.inputs["Roughness"].default_value = 0.42
    return mat


def make_surface_mat(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return mat


def normalize_ceiling_fixture(objs: list[bpy.types.Object], target_width: float) -> tuple[Vector, Vector]:
    mn, mx = world_bbox(objs)
    width = max(mx.x - mn.x, mx.y - mn.y, 0.001)
    scale = target_width / width
    center = (mn + mx) / 2
    for obj in objs:
        if obj.type == "MESH":
            obj.location = (obj.location - center) * scale
            obj.scale *= scale
    bpy.context.view_layer.update()
    mn, mx = world_bbox(objs)
    offset = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mx.z))
    for obj in objs:
        if obj.type == "MESH":
            obj.location += offset
    bpy.context.view_layer.update()
    return world_bbox(objs)


def add_project_ceiling_details(bounds: tuple[Vector, Vector]) -> None:
    mn, mx = bounds
    width = max(mx.x - mn.x, mx.y - mn.y)
    brass = make_surface_mat("hp_added_brass_ceiling_cap", (0.72, 0.47, 0.19, 1), 0.36, 0.75)
    warm = make_emissive_mat("hp_warm_low_emissive_bulb_glow", (1.0, 0.72, 0.38, 1), 0.7)

    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=width * 0.18, depth=0.035, location=(0, 0, -0.0175))
    cap = bpy.context.object
    cap.name = "hp_chandelier_ceiling_brass_cap"
    cap.data.materials.append(brass)
    bevel = cap.modifiers.new("soft_cap_bevel", "BEVEL")
    bevel.width = 0.006
    bevel.segments = 2
    cap.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")

    for idx in range(6):
        angle = idx * math.tau / 6
        radius = width * 0.32
        z = mn.z + (mx.z - mn.z) * 0.58
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=0.035, location=(math.cos(angle) * radius, math.sin(angle) * radius, z))
        bulb = bpy.context.object
        bulb.name = f"hp_chandelier_warm_bulb_{idx:02d}"
        bulb.data.materials.append(warm)


def build_asset() -> dict:
    gltf_path = download_polyhaven_gltf(ASSET["assetId"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(gltf_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    bounds = normalize_ceiling_fixture(imported, ASSET["targetWidth"])
    add_project_ceiling_details(bounds)

    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type == "MESH")
    bpy.context.view_layer.objects.active = next((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), None)

    RAW_GLB_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_BLEND_DIR.mkdir(parents=True, exist_ok=True)
    out_glb = RAW_GLB_DIR / f"hp_{ASSET['modelKey']}.glb"
    out_blend = SOURCE_BLEND_DIR / f"human_protocol_{ASSET['modelKey']}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))
    bpy.ops.export_scene.gltf(
        filepath=str(out_glb),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
    )

    mn, mx = world_bbox([obj for obj in bpy.context.scene.objects if obj.type == "MESH"])
    size = [round(mx.x - mn.x, 3), round(mx.z - mn.z, 3), round(mx.y - mn.y, 3)]
    return {
        "modelKey": ASSET["modelKey"],
        "label": ASSET["label"],
        "sourceAssetId": ASSET["assetId"],
        "sourceUrl": f"https://polyhaven.com/a/{ASSET['assetId']}",
        "author": ASSET["author"],
        "license": "CC0",
        "role": ASSET["role"],
        "rawGlb": str(out_glb.relative_to(ROOT)),
        "sourceBlend": str(out_blend.relative_to(ROOT)),
        "sizeMeters": size,
        "mount": "ceiling",
        "pivot": "top-center; fixture hangs downward from exported Y=0",
        "bytesRaw": out_glb.stat().st_size,
        "collisionProxy": {"type": "none", "reason": "ceiling light should not block player path"},
    }


def main() -> None:
    asset_report = build_asset()
    payload = {
        "schemaVersion": "human-protocol.asset-report.polyhaven-museum-ceiling.v1",
        "assetFamily": "polyhaven_museum_ceiling_2026_06_18",
        "blueprint": {
            "role": "Three selectable museum ceiling directions: limestone coffer, frosted skylight, and classical rotunda chandelier.",
            "scaleMeters": {
                "ceilingSurfaces": "room-sized repeating 384px PBR triples; authored for 3-6m museum rooms",
                "room_cc0_chandelier_02_ceiling": asset_report["sizeMeters"],
            },
            "silhouette": ["deep coffer grid", "frosted skylight with bronze mullions", "round plaster medallion plus hanging brass chandelier"],
            "materialSlots": ["plaster/limestone", "frosted glass", "dark bronze/brass", "warm low emissive bulbs"],
            "collisionProxy": "ceiling surface none; chandelier non-solid ceiling mount",
            "expectedPlacement": "Use the ceiling presets from /build; place chandelier near room center at default ceiling mount elevation.",
        },
        "licensePolicy": {
            "source": "Poly Haven",
            "license": "CC0",
            "commercialUseAllowed": True,
            "modificationAllowed": True,
            "redistributionAllowedInBundledGame": True,
            "attributionRequired": False,
            "licenseUrl": "https://polyhaven.com/license",
        },
        "assets": [asset_report],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
