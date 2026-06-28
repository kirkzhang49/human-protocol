#!/usr/bin/env python3
"""Bake CC0 museum ceiling PBR surfaces for the /build material catalog."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[2]
SOURCE_ROOT = ROOT / "src/assets/external/hp_surface_candidates_2026_06_18/ambientcg/ceilings"
OUT_DIR = ROOT / "src/assets/textures/environment/builder-surfaces"
REPORT_PATH = ROOT / "src/assets/manifests/reports/human_protocol_cc0_museum_ceiling_surfaces_v1.json"
PREVIEW_PATH = ROOT / "src/assets/manifests/reports/human_protocol_cc0_museum_ceiling_surfaces_preview.webp"

SIZE = 512


SURFACES = [
    {
        "asset_id": "Plaster003",
        "preset_id": "ceiling_cc0_museum_plaster003_gallery_v1",
        "label": "CC0 博物馆细腻石膏顶",
        "prefix": "cc0_ceiling_museum_plaster003_gallery_v1",
        "role": "quiet plaster gallery ceiling for museum rooms",
        "source_url": "https://ambientcg.com/view?id=Plaster003",
        "brightness": 0.82,
        "contrast": 1.08,
        "saturation": 0.72,
    },
    {
        "asset_id": "Tiles078",
        "preset_id": "ceiling_cc0_museum_tiles078_stone_v1",
        "label": "CC0 博物馆暖石材板顶",
        "prefix": "cc0_ceiling_museum_tiles078_stone_v1",
        "role": "warm stone slab ceiling for premium exhibit halls",
        "source_url": "https://ambientcg.com/view?id=Tiles078",
        "brightness": 0.88,
        "contrast": 1.05,
        "saturation": 0.86,
    },
    {
        "asset_id": "Marble020",
        "preset_id": "ceiling_cc0_museum_marble020_rotunda_v1",
        "label": "CC0 博物馆暖白大理石顶",
        "prefix": "cc0_ceiling_museum_marble020_rotunda_v1",
        "role": "soft marble rotunda ceiling surface with visible stone veining",
        "source_url": "https://ambientcg.com/view?id=Marble020",
        "brightness": 0.74,
        "contrast": 1.12,
        "saturation": 0.78,
    },
]


def resize(image: Image.Image) -> Image.Image:
    return image.convert("RGB").resize((SIZE, SIZE), Image.Resampling.LANCZOS)


def process_color(image: Image.Image, *, brightness: float, contrast: float, saturation: float) -> Image.Image:
    image = resize(image)
    image = ImageEnhance.Color(image).enhance(saturation)
    image = ImageEnhance.Contrast(image).enhance(contrast)
    image = ImageEnhance.Brightness(image).enhance(brightness)
    return image


def process_roughness(image: Image.Image) -> Image.Image:
    image = image.convert("L").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    image = ImageEnhance.Contrast(image).enhance(0.82)
    image = ImageEnhance.Brightness(image).enhance(1.08)
    return Image.merge("RGB", (image, image, image))


def save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", quality=82, method=6)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    preview_cells: list[Image.Image] = []
    report = {
        "assetPack": "human_protocol_cc0_museum_ceiling_surfaces_v1",
        "generatedBy": "scripts/asset-build/ingest-cc0-museum-ceiling-surfaces.py",
        "license": {
            "source": "ambientCG",
            "license": "CC0 1.0 Universal",
            "commercialUse": True,
            "attributionRequired": False,
            "licenseUrl": "https://docs.ambientcg.com/license/",
        },
        "blueprint": {
            "role": "build-page museum ceiling material presets",
            "surfaceType": "ceiling",
            "textureSizePx": SIZE,
            "runtimePath": "BuilderEnvironment.builderCeilingPresets -> builder runtime surface overrides",
            "physicalGeometry": "no separate fixture mesh; practical ceiling lights remain runtime lighting only",
        },
        "surfaces": [],
    }

    for surface in SURFACES:
        asset_id = surface["asset_id"]
        source_dir = SOURCE_ROOT / asset_id
        color_src = source_dir / f"{asset_id}_1K-JPG_Color.jpg"
        normal_src = source_dir / f"{asset_id}_1K-JPG_NormalGL.jpg"
        rough_src = source_dir / f"{asset_id}_1K-JPG_Roughness.jpg"
        missing = [str(path) for path in (color_src, normal_src, rough_src) if not path.exists()]
        if missing:
            raise FileNotFoundError(f"Missing source maps for {asset_id}: {missing}")

        prefix = surface["prefix"]
        color_out = OUT_DIR / f"{prefix}_color.webp"
        normal_out = OUT_DIR / f"{prefix}_normal.webp"
        rough_out = OUT_DIR / f"{prefix}_rough.webp"

        color = process_color(
            Image.open(color_src),
            brightness=surface["brightness"],
            contrast=surface["contrast"],
            saturation=surface["saturation"],
        )
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

    print(f"Wrote {len(SURFACES)} CC0 museum ceiling surfaces")
    print(PREVIEW_PATH)
    print(REPORT_PATH)


if __name__ == "__main__":
    main()
