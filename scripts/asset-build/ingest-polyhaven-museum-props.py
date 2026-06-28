#!/usr/bin/env python3
"""Download and normalize selected Poly Haven CC0 museum props.

The script keeps raw external glTF assets under src/assets/external, creates a
small Human Protocol plinth where useful, saves Blender source files, and exports
raw GLBs. Run scripts/asset-build/optimize-glb.mjs afterwards to create the
runtime-cooked GLBs with compressed textures.
"""

from __future__ import annotations

import json
import math
import os
import sys
import urllib.request
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
EXTERNAL_ROOT = ROOT / "src/assets/external/polyhaven_museum_props_2026_06_18"
RAW_GLB_DIR = EXTERNAL_ROOT / "raw-glb"
SOURCE_BLEND_DIR = ROOT / "src/assets/source_blend/polyhaven-museum-props"
REPORT = ROOT / "src/assets/manifests/reports/human_protocol_polyhaven_museum_props_v1.json"

ASSETS = [
    {
        "assetId": "marble_bust_01",
        "modelKey": "room_cc0_bust",
        "label": "大理石胸像",
        "author": "Rico Cilliers",
        "targetMeshHeight": 1.35,
        "base": None,
        "role": "large marble bust scaled as a standalone museum floor sculpture",
    },
    {
        "assetId": "horse_statue_01",
        "modelKey": "room_cc0_horse_statue_plinth",
        "label": "瓷马雕塑展台",
        "author": "Rico Cilliers",
        "targetMeshHeight": 1.08,
        "base": {"kind": "cylinder", "height": 0.14, "radiusScale": 0.62},
        "role": "porcelain horse statue scaled as a standalone museum floor sculpture",
    },
    {
        "assetId": "bull_head",
        "modelKey": "room_cc0_bull_head_plinth",
        "label": "青铜牛头雕塑",
        "author": "Tina",
        "targetMeshHeight": 1.1,
        "base": {"kind": "cylinder", "height": 0.18, "radiusScale": 0.62},
        "role": "ornate bronze animal-head sculpture scaled for standalone museum display",
    },
    {
        "assetId": "brass_vase_02",
        "modelKey": "room_cc0_brass_vase_02",
        "label": "青铜纹饰花瓶",
        "author": "Rico Cilliers",
        "targetMeshHeight": 1.04,
        "base": {"kind": "cylinder", "height": 0.12, "radiusScale": 0.56},
        "role": "ornate brass vase artifact scaled for standalone museum display",
    },
    {
        "assetId": "antique_ceramic_vase_01",
        "modelKey": "room_cc0_antique_ceramic_vase_01",
        "label": "古陶彩绘花瓶",
        "author": "James Ray Cock",
        "targetMeshHeight": 1.0,
        "base": {"kind": "cylinder", "height": 0.12, "radiusScale": 0.54},
        "role": "painted antique ceramic vase artifact scaled for standalone museum display",
    },
]


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "HumanProtocolAssetPipeline/1.0"})
    with urllib.request.urlopen(request, timeout=40) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": "HumanProtocolAssetPipeline/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        dest.write_bytes(response.read())


def download_polyhaven_gltf(asset_id: str) -> Path:
    files = fetch_json(f"https://api.polyhaven.com/files/{asset_id}")
    gltf = files["gltf"]["1k"]["gltf"]
    asset_dir = EXTERNAL_ROOT / "polyhaven" / asset_id
    gltf_path = asset_dir / Path(gltf["url"]).name
    download(gltf["url"], gltf_path)
    for rel, meta in gltf["include"].items():
        download(meta["url"], asset_dir / rel)
    info = {
        "source": "Poly Haven",
        "assetId": asset_id,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}",
        "downloadUrl": gltf["url"],
        "license": "CC0",
        "licenseUrl": "https://polyhaven.com/license",
        "resolution": "1k glTF",
        "files": gltf,
    }
    (asset_dir / "human_protocol_source_audit.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
    return gltf_path


def make_mat(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


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


def normalize_imported(objs: list[bpy.types.Object], target_height: float, base_height: float) -> tuple[Vector, Vector]:
    mn, mx = world_bbox(objs)
    center = (mn + mx) / 2
    height = max(mx.z - mn.z, 0.001)
    scale = target_height / height
    for obj in objs:
        if obj.type == "MESH":
            obj.location = (obj.location - center) * scale
            obj.scale *= scale
    bpy.context.view_layer.update()
    mn, mx = world_bbox(objs)
    offset = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, base_height - mn.z))
    for obj in objs:
        if obj.type == "MESH":
            obj.location += offset
    bpy.context.view_layer.update()
    return world_bbox(objs)


def add_plinth(bounds: tuple[Vector, Vector], base: dict) -> None:
    mn, mx = bounds
    width = max(mx.x - mn.x, mx.y - mn.y, 0.08)
    height = float(base["height"])
    radius = max(width * float(base["radiusScale"]), 0.08)
    mat = make_mat("hp_black_stone_plinth", (0.015, 0.017, 0.018, 1), 0.55, 0.0)
    trim = make_mat("hp_worn_brass_trim", (0.72, 0.48, 0.22, 1), 0.34, 0.55)

    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=radius, depth=height, location=(0, 0, height / 2))
    plinth = bpy.context.object
    plinth.name = "hp_museum_low_black_plinth"
    plinth.data.name = "hp_museum_low_black_plinth_mesh"
    plinth.data.materials.append(mat)
    bevel = plinth.modifiers.new("small_soft_bevel", "BEVEL")
    bevel.width = 0.012
    bevel.segments = 2
    plinth.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")

    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius * 0.97,
        minor_radius=0.008,
        major_segments=48,
        minor_segments=8,
        location=(0, 0, height + 0.002),
    )
    ring = bpy.context.object
    ring.name = "hp_museum_plinth_brass_lip"
    ring.data.materials.append(trim)


def build_asset(spec: dict) -> dict:
    gltf_path = download_polyhaven_gltf(spec["assetId"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(gltf_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    base_height = float(spec["base"]["height"]) if spec.get("base") else 0.0
    bounds = normalize_imported(imported, float(spec["targetMeshHeight"]), base_height)
    if spec.get("base"):
        add_plinth(bounds, spec["base"])

    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type == "MESH")
    bpy.context.view_layer.objects.active = next((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), None)

    RAW_GLB_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_BLEND_DIR.mkdir(parents=True, exist_ok=True)
    out_glb = RAW_GLB_DIR / f"hp_{spec['modelKey']}.glb"
    out_blend = SOURCE_BLEND_DIR / f"human_protocol_{spec['modelKey']}.blend"
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
        "modelKey": spec["modelKey"],
        "label": spec["label"],
        "sourceAssetId": spec["assetId"],
        "sourceUrl": f"https://polyhaven.com/a/{spec['assetId']}",
        "author": spec["author"],
        "license": "CC0",
        "role": spec["role"],
        "rawGlb": str(out_glb.relative_to(ROOT)),
        "sourceBlend": str(out_blend.relative_to(ROOT)),
        "sizeMeters": size,
        "bytesRaw": out_glb.stat().st_size,
        "collisionProxy": {"type": "box", "sizeMeters": size},
    }


def main() -> None:
    reports = [build_asset(spec) for spec in ASSETS]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": "human-protocol.asset-report.polyhaven-museum-props.v1",
        "assetFamily": "polyhaven_museum_props_2026_06_18",
        "licensePolicy": {
            "source": "Poly Haven",
            "license": "CC0",
            "commercialUseAllowed": True,
            "modificationAllowed": True,
            "redistributionAllowedInBundledGame": True,
            "attributionRequired": False,
            "licenseUrl": "https://polyhaven.com/license",
        },
        "assets": reports,
    }
    REPORT.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(payload, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"[ingest-polyhaven-museum-props] fatal: {exc}", file=sys.stderr)
        raise
