#!/usr/bin/env python3
"""Bake CC0 Level 02 false-home PBR surfaces for the /build material catalog."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "src/assets/external/hp_surface_candidates_2026_06_18/ambientcg"
OUT_DIR = ROOT / "src/assets/textures/environment/builder-surfaces"
REPORT_PATH = ROOT / "src/assets/manifests/reports/human_protocol_level02_false_home_cc0_surfaces_v1.json"
PREVIEW_PATH = ROOT / "src/assets/manifests/reports/human_protocol_level02_false_home_cc0_surfaces_preview.webp"

SIZE = 512


SURFACES = [
    {
        "asset_id": "Plaster001",
        "source_group": "walls",
        "preset_id": "wall_level02_false_home_plaster_v1",
        "label": "L2 假住宅细灰泥墙",
        "prefix": "cc0_wall_level02_plaster001_false_home_v1",
        "role": "warm fine plaster wall for Level 02 false-home residential rooms",
        "source_url": "https://ambientcg.com/view?id=Plaster001",
        "download_url": "https://ambientCG.com/get?file=Plaster001_1K-JPG.zip",
        "brightness": 0.62,
        "contrast": 1.08,
        "saturation": 0.55,
        "tint": (126, 112, 92),
        "tint_alpha": 0.18,
    },
    {
        "asset_id": "Plaster003",
        "source_group": "ceilings",
        "preset_id": "ceiling_level02_false_home_plaster_v1",
        "label": "L2 假住宅暖白石膏顶",
        "prefix": "cc0_ceiling_level02_plaster003_soft_panel_v1",
        "role": "warm muted plaster ceiling for Level 02 false-home residential rooms",
        "source_url": "https://ambientcg.com/view?id=Plaster003",
        "download_url": "https://ambientCG.com/get?file=Plaster003_1K-JPG.zip",
        "brightness": 0.7,
        "contrast": 1.06,
        "saturation": 0.58,
        "tint": (142, 132, 116),
        "tint_alpha": 0.14,
    },
]


def resize(image: Image.Image) -> Image.Image:
    return image.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def process_color(image: Image.Image, surface: dict[str, object]) -> Image.Image:
    image = resize(image)
    image = ImageEnhance.Color(image).enhance(float(surface["saturation"]))
    image = ImageEnhance.Contrast(image).enhance(float(surface["contrast"]))
    image = ImageEnhance.Brightness(image).enhance(float(surface["brightness"]))
    tint = Image.new("RGB", image.size, surface["tint"])
    return Image.blend(image, tint, float(surface["tint_alpha"]))


def process_roughness(image: Image.Image) -> Image.Image:
    image = image.convert("L").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(0.78)
    image = ImageEnhance.Brightness(image).enhance(1.14)
    return Image.merge("RGB", (image, image, image))


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", quality=82, method=6)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    preview_cells: list[Image.Image] = []
    report = {
        "assetPack": "human_protocol_level02_false_home_cc0_surfaces_v1",
        "generatedBy": "scripts/asset-build/ingest-level02-false-home-cc0-surfaces.py",
        "generatedAt": "2026-06-20",
        "license": {
            "source": "ambientCG",
            "license": "CC0 1.0 Universal",
            "commercialUse": True,
            "modificationAllowed": True,
            "redistributionInGameAllowed": True,
            "attributionRequired": False,
            "licenseUrl": "https://docs.ambientcg.com/license/",
        },
        "blueprint": {
            "level": "level_02_residential_simulation",
            "role": "false-home wall and ceiling presets for /build and official builder source",
            "textureSizePx": SIZE,
            "compression": "WEBP quality 82",
            "floorPreset": {
                "presetId": "floor_level02_false_home_walnut_v1",
                "source": "existing compressed builder surface wood_floor_*",
                "licenseProof": "docs/asset-license-ledger.md ambientCG Wood062 CC0 row",
            },
            "runtimePath": "BuilderEnvironment presets -> room surface overrides -> Raw WebGPU builder runtime pack",
        },
        "surfaces": [],
    }

    for surface in SURFACES:
        asset_id = str(surface["asset_id"])
        source_dir = SOURCE_ROOT / str(surface["source_group"]) / asset_id
        color_src = source_dir / f"{asset_id}_1K-JPG_Color.jpg"
        normal_src = source_dir / f"{asset_id}_1K-JPG_NormalGL.jpg"
        rough_src = source_dir / f"{asset_id}_1K-JPG_Roughness.jpg"
        missing = [str(path) for path in (color_src, normal_src, rough_src) if not path.exists()]
        if missing:
            raise FileNotFoundError(f"Missing source maps for {asset_id}: {missing}")

        prefix = str(surface["prefix"])
        color_out = OUT_DIR / f"{prefix}_color.webp"
        normal_out = OUT_DIR / f"{prefix}_normal.webp"
        rough_out = OUT_DIR / f"{prefix}_rough.webp"

        color = process_color(Image.open(color_src), surface)
        normal = resize(Image.open(normal_src))
        rough = process_roughness(Image.open(rough_src))
        save_webp(color, color_out)
        save_webp(normal, normal_out)
        save_webp(rough, rough_out)

        cell = Image.new("RGB", (360, 430), (18, 20, 22))
        thumb = color.copy()
        thumb.thumbnail((328, 328), Image.Resampling.LANCZOS)
        cell.paste(thumb, ((360 - thumb.width) // 2, 18))
        cell.paste(normal.resize((82, 82), Image.Resampling.LANCZOS), (16, 336))
        cell.paste(rough.resize((82, 82), Image.Resampling.LANCZOS), (106, 336))
        preview_cells.append(cell)

        report["surfaces"].append(
            {
                "presetId": surface["preset_id"],
                "label": surface["label"],
                "sourceAsset": asset_id,
                "sourceUrl": surface["source_url"],
                "downloadUrl": surface["download_url"],
                "sourceLocalPath": str(source_dir.relative_to(ROOT)),
                "role": surface["role"],
                "outputs": {
                    "color": str(color_out.relative_to(ROOT)),
                    "normal": str(normal_out.relative_to(ROOT)),
                    "roughness": str(rough_out.relative_to(ROOT)),
                },
                "qaEvidence": {
                    "sourceMapsPresent": True,
                    "compressedWebp": True,
                    "intendedBuilderCatalog": True,
                },
            }
        )

    preview = Image.new("RGB", (360 * len(preview_cells), 430), (18, 20, 22))
    for index, cell in enumerate(preview_cells):
        preview.paste(cell, (index * 360, 0))
    save_webp(preview, PREVIEW_PATH)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {len(SURFACES)} Level 02 false-home CC0 surfaces")
    print(PREVIEW_PATH)
    print(REPORT_PATH)


if __name__ == "__main__":
    main()
