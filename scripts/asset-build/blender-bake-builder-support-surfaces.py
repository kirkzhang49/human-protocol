#!/usr/bin/env python3
"""Bake support-surface suggestions from builder-pack GLB meshes.

This is an offline authoring aid for /build tabletop placement. It imports each
manifest asset in Blender, derives a conservative top/shelf support proxy from
the actual mesh bounds, and writes a report that can be copied into a builder
asset-pack manifest as `supportSurfaces`.

Usage:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python \
    scripts/asset-build/blender-bake-builder-support-surfaces.py -- \
    <manifest.json> <out-report.json> [--glb-dir <override-dir>]
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SUPPORT_FAMILIES = {"desk", "control_console", "cabinet", "drawer_chest", "display_case", "safe", "storage_crate", "bookshelf"}


def parse_args() -> tuple[Path, Path, Path | None]:
    if "--" not in sys.argv:
        raise SystemExit("usage: blender --background --python blender-bake-builder-support-surfaces.py -- <manifest.json> <out-report.json> [--glb-dir <override-dir>]")
    argv = sys.argv[sys.argv.index("--") + 1 :]
    if len(argv) < 2:
        raise SystemExit("usage: <manifest.json> <out-report.json> [--glb-dir <override-dir>]")
    manifest = Path(argv[0])
    out = Path(argv[1])
    glb_dir = None
    if "--glb-dir" in argv:
        glb_dir = Path(argv[argv.index("--glb-dir") + 1])
    return manifest, out, glb_dir


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
        raise RuntimeError("no mesh objects")
    return mn, mx


def should_bake(entry: dict) -> bool:
    return bool(entry.get("canHoldSmallProps")) or entry.get("family") in SUPPORT_FAMILIES


def candidate_glb(manifest_dir: Path, entry: dict, override_dir: Path | None) -> Path:
    if override_dir:
        return override_dir / Path(entry["glbFile"]).name
    return manifest_dir / entry["glbFile"]


def bake_entry(manifest_dir: Path, entry: dict, override_dir: Path | None) -> dict:
    glb = candidate_glb(manifest_dir, entry, override_dir)
    row = {
        "modelKey": entry["modelKey"],
        "label": entry.get("label"),
        "sourceGlb": str(glb),
        "canBake": should_bake(entry),
        "supportSurfaces": [],
        "notes": [],
    }
    if not row["canBake"]:
        row["notes"].append("not a support-family asset")
        return row
    if not glb.exists():
        row["notes"].append("glb not found")
        return row
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(glb))
        mn, mx = world_bbox(list(bpy.context.scene.objects))
    except Exception as exc:  # noqa: BLE001
        row["notes"].append(f"import failed: {str(exc)[:160]}")
        return row

    width = max(mx.x - mn.x, 0.08)
    height = max(mx.z - mn.z, 0.08)
    depth = max(mx.y - mn.y, 0.08)
    shelf = entry.get("family") == "bookshelf"
    row["meshBounds"] = {
        "min": [round(mn.x, 4), round(mn.z, 4), round(mn.y, 4)],
        "max": [round(mx.x, 4), round(mx.z, 4), round(mx.y, 4)],
        "sizeMeters": [round(width, 4), round(height, 4), round(depth, 4)],
    }
    row["supportSurfaces"].append({
        "id": "mesh_top",
        "kind": "shelf" if shelf else "tabletop",
        "localCenter": [round((mn.x + mx.x) / 2, 4), round(mx.z, 4), round((mn.y + mx.y) / 2, 4)],
        "size": [round(max(0.08, width * (0.72 if shelf else 0.78)), 4), round(max(0.08, depth * (0.55 if shelf else 0.72)), 4)],
        "maxChildHeight": 0.45 if shelf else 1.1,
    })
    return row


def main() -> None:
    manifest_path, out_path, glb_dir = parse_args()
    manifest_abs = manifest_path if manifest_path.is_absolute() else ROOT / manifest_path
    out_abs = out_path if out_path.is_absolute() else ROOT / out_path
    glb_dir_abs = glb_dir if glb_dir is None or glb_dir.is_absolute() else ROOT / glb_dir
    manifest = json.loads(manifest_abs.read_text(encoding="utf-8"))
    rows = [bake_entry(manifest_abs.parent, entry, glb_dir_abs) for entry in manifest.get("assets", [])]
    payload = {
        "schemaVersion": "human-protocol.builder-support-surface-bake.v1",
        "sourceManifest": str(manifest_abs.relative_to(ROOT)),
        "glbOverrideDir": str(glb_dir_abs.relative_to(ROOT)) if glb_dir_abs else None,
        "bakeMode": "mesh-bounds-conservative-top-surface",
        "assets": rows,
    }
    out_abs.parent.mkdir(parents=True, exist_ok=True)
    out_abs.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"wrote": str(out_abs.relative_to(ROOT)), "assets": len(rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
