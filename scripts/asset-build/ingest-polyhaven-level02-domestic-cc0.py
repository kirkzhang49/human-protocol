#!/usr/bin/env python3
"""Download and adapt a small Poly Haven CC0 domestic furniture pack.

The pack deliberately avoids the existing Level 02 / residential-reference
shapes (coffee table, sideboard, entry bench, divider shelf, cleaner closet).
Run in Blender. After this script, run optimize-glb.mjs to emit the cooked GLBs.
"""

from __future__ import annotations

import json
import math
import shutil
import urllib.request
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
EXTERNAL_ROOT = ROOT / "src/assets/external/polyhaven_level02_domestic_cc0_2026_06_19"
RAW_GLB_DIR = EXTERNAL_ROOT / "raw-glb"
SOURCE_BLEND_DIR = ROOT / "src/assets/source_blend/polyhaven-level02-domestic-cc0"
MANIFEST = ROOT / "src/assets/manifests/builder/hp_l2_cc0_domestic_polyhaven_v1.json"
REPORT = ROOT / "src/assets/manifests/reports/human_protocol_polyhaven_l2_domestic_cc0_v1.json"
COOKED_REL_DIR = "../../models-cooked/environment/level02-cc0-domestic"
THUMB_REL_DIR = "../../thumbnails/builder/hp-l2-cc0-domestic-polyhaven-v1"

ASSETS = [
    {
        "assetId": "dining_chair_02",
        "modelKey": "hp_l2_cc0_dining_chair_polyhaven_v1",
        "label": "皮革餐椅",
        "author": "James Ray Cock",
        "role": "realistic dining chair that complements the observation table without repeating the existing armchair silhouette",
        "fitAxis": "height",
        "targetSize": 0.96,
        "mount": "floor",
        "wallPreferred": "none",
        "family": "chair",
        "footprintFamily": "chair",
        "solid": True,
        "canHoldSmallProps": False,
        "clueCapacity": 0,
        "accent": "seat_tag",
        "dissimilarTo": ["coffee table", "sideboard", "entry bench", "room divider shelf", "cleaner closet"],
    },
    {
        "assetId": "Ottoman_01",
        "modelKey": "hp_l2_cc0_ottoman_polyhaven_v1",
        "label": "皮革软凳",
        "author": "Caspian Fortune",
        "role": "low soft ottoman filler with a broad cushion silhouette, useful as cover and domestic clutter",
        "fitAxis": "height",
        "targetSize": 0.46,
        "mount": "floor",
        "wallPreferred": "none",
        "family": "sofa_bench",
        "footprintFamily": "sofa",
        "solid": True,
        "canHoldSmallProps": False,
        "clueCapacity": 0,
        "accent": "stitch_ticks",
        "dissimilarTo": ["coffee table", "sideboard", "entry bench storage", "room divider shelf", "cleaner closet"],
    },
    {
        "assetId": "modern_ceiling_lamp_01",
        "modelKey": "hp_l2_cc0_ceiling_lamp_polyhaven_v1",
        "label": "玻璃吊灯",
        "author": "James Ray Cock",
        "role": "ceiling-mounted domestic lamp that adds vertical room interest and does not compete with floor furniture",
        "fitAxis": "height",
        "targetSize": 0.86,
        "mount": "ceiling",
        "wallPreferred": "none",
        "family": "wall_panel_or_picture_frame",
        "footprintFamily": "lamp",
        "solid": False,
        "canHoldSmallProps": False,
        "clueCapacity": 0,
        "accent": "ceiling_cap",
        "dissimilarTo": ["floor lamp", "coffee table", "cabinet", "divider shelf"],
    },
    {
        "assetId": "ornate_mirror_01",
        "modelKey": "hp_l2_cc0_wall_mirror_polyhaven_v1",
        "label": "装饰墙镜",
        "author": "James Ray Cock",
        "role": "ornate wall mirror with reflective domestic identity, distinct from portrait consoles and wall clue boards",
        "fitAxis": "height",
        "targetSize": 1.22,
        "mount": "wall",
        "wallPreferred": "back",
        "family": "wall_panel_or_picture_frame",
        "footprintFamily": "wall_panel",
        "solid": False,
        "canHoldSmallProps": False,
        "clueCapacity": 1,
        "accent": "mirror_mount",
        "dissimilarTo": ["cabinet", "bookshelf", "portrait console", "floor furniture"],
    },
    {
        "assetId": "desk_lamp_arm_01",
        "modelKey": "hp_l2_cc0_desk_lamp_polyhaven_v1",
        "label": "折臂台灯",
        "author": "Kuutti Siitonen; Yann Kervran",
        "role": "articulated tabletop task lamp for desks, counters, and clue staging",
        "fitAxis": "height",
        "targetSize": 0.72,
        "mount": "tabletop",
        "wallPreferred": "none",
        "family": "wall_panel_or_picture_frame",
        "footprintFamily": "lamp",
        "solid": False,
        "canHoldSmallProps": False,
        "clueCapacity": 0,
        "accent": "none",
        "dissimilarTo": ["floor lamp", "ceiling lamp", "cabinet", "table"],
    },
]


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "HumanProtocolAssetPipeline/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        return
    request = urllib.request.Request(url, headers={"User-Agent": "HumanProtocolAssetPipeline/1.0"})
    with urllib.request.urlopen(request, timeout=180) as response:
        dest.write_bytes(response.read())


def download_polyhaven_gltf(spec: dict) -> tuple[Path, dict, dict]:
    asset_id = spec["assetId"]
    files = fetch_json(f"https://api.polyhaven.com/files/{asset_id}")
    info = fetch_json(f"https://api.polyhaven.com/info/{asset_id}")
    gltf = files["gltf"]["1k"]["gltf"]
    asset_dir = EXTERNAL_ROOT / "polyhaven" / asset_id
    gltf_path = asset_dir / Path(gltf["url"]).name
    download(gltf["url"], gltf_path)
    for rel, meta in gltf["include"].items():
        download(meta["url"], asset_dir / rel)
    audit = {
        "source": "Poly Haven",
        "assetId": asset_id,
        "sourceUrl": f"https://polyhaven.com/a/{asset_id}",
        "downloadUrl": gltf["url"],
        "license": "CC0",
        "licenseUrl": "https://polyhaven.com/license",
        "resolution": "1k glTF",
        "apiInfo": info,
        "files": gltf,
    }
    (asset_dir / "human_protocol_source_audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return gltf_path, files, info


def make_mat(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float = 0.0, emission: tuple[float, float, float, float] | None = None, emission_strength: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        # Blender 4.x uses "Emission Color"; older 3.x uses "Emission".
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = emission
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def assign_common_names() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.name = "cc0_source_" + obj.name[:48]
            obj.data.name = obj.name + "_mesh"


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


def normalize_imported(objs: list[bpy.types.Object], spec: dict) -> tuple[Vector, Vector]:
    mn, mx = world_bbox(objs)
    center = (mn + mx) / 2
    dims = mx - mn
    if spec["fitAxis"] == "height":
        basis = max(dims.z, 0.001)
    elif spec["fitAxis"] == "width":
        basis = max(dims.x, 0.001)
    elif spec["fitAxis"] == "depth":
        basis = max(dims.y, 0.001)
    else:
        basis = max(dims.x, dims.y, dims.z, 0.001)
    scale = float(spec["targetSize"]) / basis
    for obj in objs:
        if obj.type == "MESH":
            obj.location = (obj.location - center) * scale
            obj.scale *= scale
    bpy.context.view_layer.update()
    mn, mx = world_bbox(objs)
    offset = Vector((-(mn.x + mx.x) / 2, -(mn.y + mx.y) / 2, -mn.z))
    for obj in objs:
        if obj.type == "MESH":
            obj.location += offset
    bpy.context.view_layer.update()
    return world_bbox(objs)


def add_box(name: str, size: tuple[float, float, float], loc: tuple[float, float, float], mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("soft_bevel", "BEVEL")
    bevel.width = min(size) * 0.18
    bevel.segments = 2
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def add_cylinder(name: str, radius: float, depth: float, loc: tuple[float, float, float], mat: bpy.types.Material, vertices: int = 32) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("soft_bevel", "BEVEL")
    bevel.width = min(radius * 0.08, depth * 0.18)
    bevel.segments = 2
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def add_sphere(name: str, radius: float, loc: tuple[float, float, float], mat: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_mesh"
    obj.data.materials.append(mat)
    return obj


def add_hp_accent(spec: dict, bounds: tuple[Vector, Vector]) -> None:
    mn, mx = bounds
    sx = max(mx.x - mn.x, 0.1)
    sy = max(mx.y - mn.y, 0.1)
    sz = max(mx.z - mn.z, 0.1)
    black = make_mat("hp_smoked_titanium_black", (0.012, 0.018, 0.022, 1), 0.62, 0.2)
    cyan = make_mat("hp_soft_cyan_status_light", (0.35, 0.9, 1.0, 1), 0.25, 0.0, (0.35, 0.9, 1.0, 1), 0.65)
    brass = make_mat("hp_muted_brass_pin", (0.88, 0.56, 0.18, 1), 0.38, 0.45)
    warm = make_mat("hp_warm_lamp_glow", (1.0, 0.78, 0.42, 1), 0.18, 0.0, (1.0, 0.58, 0.18, 1), 1.2)

    accent = spec["accent"]
    if accent == "seat_tag":
        add_box("hp_underseat_service_tag", (min(0.22, sx * 0.34), 0.026, 0.018), (0, -sy * 0.52, sz * 0.47), black)
        add_box("hp_underseat_cyan_tick", (min(0.07, sx * 0.12), 0.028, 0.02), (sx * 0.12, -sy * 0.54, sz * 0.475), cyan)
    elif accent == "stitch_ticks":
        z = sz * 0.82
        y = -sy * 0.51
        for idx, x in enumerate([-0.14, -0.06, 0.02, 0.10]):
            mat = brass if idx % 2 == 0 else cyan
            add_box(f"hp_ottoman_edge_tick_{idx}", (0.045, 0.018, 0.012), (x, y, z), mat)
    elif accent == "ceiling_cap":
        add_cylinder("hp_ceiling_mount_dark_cap", sx * 0.22, 0.055, (0, 0, sz + 0.028), black, 40)
        add_cylinder("hp_ceiling_mount_brass_lip", sx * 0.225, 0.012, (0, 0, sz + 0.062), brass, 40)
        add_sphere("hp_lamp_warm_inner_glow", min(sx, sy) * 0.16, (0, 0, sz * 0.23), warm)
    elif accent == "mirror_mount":
        # A thin back bracket gives the ornate source a Human Protocol facility mount
        # while leaving the front artwork clean.
        add_box("hp_wall_mirror_back_mount", (sx * 0.72, 0.045, sz * 0.055), (0, sy * 0.52, sz * 0.18), black)
        add_box("hp_wall_mirror_lower_cyan_index", (sx * 0.20, 0.05, sz * 0.018), (sx * 0.20, -sy * 0.53, sz * 0.105), cyan)
    elif accent == "bulb_glow":
        add_sphere("hp_desk_lamp_warm_bulb", min(sx, sy, sz) * 0.105, (0, -sy * 0.18, sz * 0.62), warm)
        add_box("hp_desk_lamp_cyan_switch", (sx * 0.18, sy * 0.06, sz * 0.035), (sx * 0.18, -sy * 0.40, sz * 0.09), cyan)


def select_meshes() -> list[bpy.types.Object]:
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type == "MESH")
    bpy.context.view_layer.objects.active = meshes[0] if meshes else None
    return meshes


def build_manifest_entry(spec: dict, size: list[float]) -> dict:
    model_key = spec["modelKey"]
    return {
        "modelKey": model_key,
        "label": spec["label"],
        "assetKind": "furniture",
        "family": spec["family"],
        "group": "居住",
        "source": "polyhaven-level02-domestic-cc0",
        "sourceAssetId": spec["assetId"],
        "themeId": "hp_level02_residential_sim_cc0_domestic",
        "glbFile": f"{COOKED_REL_DIR}/{model_key}.glb",
        "previewFile": f"{THUMB_REL_DIR}/{model_key}.png",
        "sizeMeters": size,
        "solid": spec["solid"],
        "mount": spec["mount"],
        "wallPreferred": spec["wallPreferred"],
        "canHoldSmallProps": spec["canHoldSmallProps"],
        "clueCapacity": spec["clueCapacity"],
        "footprintFamily": spec["footprintFamily"],
        "tags": [
            "style:l2-residential-sim",
            "style:cc0-polyhaven",
            "source:polyhaven",
            "license:cc0",
            f"mount:{spec['mount']}",
        ],
    }


def build_asset(spec: dict) -> dict:
    gltf_path, files, info = download_polyhaven_gltf(spec)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(gltf_path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    assign_common_names()
    bounds = normalize_imported(imported, spec)
    add_hp_accent(spec, bounds)
    meshes = select_meshes()
    bounds = world_bbox(meshes)

    RAW_GLB_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_BLEND_DIR.mkdir(parents=True, exist_ok=True)
    out_glb = RAW_GLB_DIR / f"{spec['modelKey']}.glb"
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
        "authors": info.get("authors") or spec["author"],
        "license": "CC0",
        "licenseUrl": "https://polyhaven.com/license",
        "role": spec["role"],
        "dissimilarToExisting": spec["dissimilarTo"],
        "rawGlb": str(out_glb.relative_to(ROOT)),
        "sourceBlend": str(out_blend.relative_to(ROOT)),
        "plannedCookedGlb": f"src/assets/models-cooked/environment/level02-cc0-domestic/{spec['modelKey']}.glb",
        "sizeMeters": size,
        "bytesRaw": out_glb.stat().st_size,
        "polyhavenCategories": info.get("categories"),
        "polyhavenPublishedUnix": info.get("date_published"),
        "manifestEntry": build_manifest_entry(spec, size),
        "downloadFiles": {
            "gltf": files["gltf"]["1k"]["gltf"]["url"],
            "includes": sorted(files["gltf"]["1k"]["gltf"]["include"].keys()),
        },
    }


def main() -> None:
    if not shutil.which("python3"):
        pass
    reports = [build_asset(spec) for spec in ASSETS]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": "human-protocol.asset-report.polyhaven-l2-domestic-cc0.v1",
        "assetFamily": "polyhaven_level02_domestic_cc0_2026_06_19",
        "selectionGoal": "add five high-quality free CC0 domestic props that are visually different from the current Level 02 and residential-reference furniture",
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
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_l2_cc0_domestic_polyhaven_v1",
        "label": "HP 居住模拟 CC0 新家具包 (Poly Haven)",
        "sourceTool": "polyhaven-level02-domestic-cc0-ingest",
        "generatedAt": "2026-06-19",
        "sourceReport": "src/assets/manifests/reports/human_protocol_polyhaven_l2_domestic_cc0_v1.json",
        "license": {
            "name": "CC0",
            "source": "Poly Haven",
            "licenseUrl": "https://polyhaven.com/license",
            "commercialUseAllowed": True,
            "modificationAllowed": True,
            "redistributionAllowedInBundledGame": True,
            "attributionRequired": False,
        },
        "assets": [item["manifestEntry"] for item in reports],
    }
    REPORT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print("WROTE", REPORT.relative_to(ROOT))
    print("WROTE", MANIFEST.relative_to(ROOT))


if __name__ == "__main__":
    main()
