#!/usr/bin/env python3
"""Pack true image2-generated residential texture sources for furniture GLBs."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = ROOT / "src/assets/textures/environment/residential-reference-furniture-image2"
GENERATED_SOURCE_DIR = TEXTURE_DIR / "image2-generated-sources"
SOURCE_DIR = TEXTURE_DIR / "image2-sources"
REPORT_DIR = ROOT / "src/assets/manifests/reports"
ATLAS_PATH = TEXTURE_DIR / "hp_residential_reference_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_residential_reference_image2_atlas.regions.json"
CONTACT_SHEET_PATH = TEXTURE_DIR / "hp_residential_reference_image2_contact_sheet.png"
REPORT_PATH = REPORT_DIR / "residential_reference_furniture_image2_texture_report.json"

ATLAS_SIZE = 2048
REGIONS = {
    "warm_walnut_ribbed": {"x": 16, "y": 16, "w": 496, "h": 496, "role": "fluted walnut pedestal and sideboard ribs"},
    "pale_oak_slats": {"x": 544, "y": 16, "w": 496, "h": 496, "role": "entry bench wall slats and pale wood frames"},
    "warm_stone_oval": {"x": 1072, "y": 16, "w": 496, "h": 368, "role": "rounded coffee table and sideboard stone tops"},
    "ivory_boucle_clean": {"x": 1600, "y": 16, "w": 368, "h": 368, "role": "bench cushions and folded soft goods"},
    "warm_white_lacquer": {"x": 16, "y": 560, "w": 496, "h": 496, "role": "clean utility cabinet lacquer"},
    "muted_book_spines": {"x": 544, "y": 560, "w": 496, "h": 288, "role": "restrained room-divider books"},
    "shadow_gap_panel": {"x": 1072, "y": 560, "w": 384, "h": 384, "role": "hidden control shadow gaps and rear service plates"},
    "woven_basket_oak": {"x": 1488, "y": 560, "w": 384, "h": 384, "role": "entry/utility storage basket"},
}

SOURCE_IMAGE_MAP = {
    "warm_walnut_ribbed": "warm_walnut_ribbed.image2.png",
    "pale_oak_slats": "pale_oak_slats.image2.png",
    "warm_stone_oval": "warm_stone_oval.image2.png",
    "ivory_boucle_clean": "ivory_boucle_clean.image2.png",
    "warm_white_lacquer": "warm_white_lacquer.image2.png",
    "muted_book_spines": "muted_book_spines.image2.png",
    "shadow_gap_panel": "shadow_gap_panel.image2.png",
    "woven_basket_oak": "woven_basket_oak.image2.png",
}

IMAGE2_PROMPTS = {
    "warm_walnut_ribbed": "warm walnut ribbed wood material texture for high-end residential furniture",
    "pale_oak_slats": "pale oak vertical slat material texture for entry benches and built-ins",
    "warm_stone_oval": "warm honed stone material texture for rounded coffee table tops",
    "ivory_boucle_clean": "ivory boucle upholstery fabric material texture for sofas and cushions",
    "warm_white_lacquer": "warm white lacquered cabinet panel material texture",
    "muted_book_spines": "muted staged residential book-spine material texture with no readable text",
    "shadow_gap_panel": "dark hidden shadow gap and rear access panel material texture",
    "woven_basket_oak": "woven oak and rattan storage basket material texture",
}


def load_image2_tile(key: str, size: tuple[int, int]) -> Image.Image:
    source = GENERATED_SOURCE_DIR / SOURCE_IMAGE_MAP[key]
    if not source.exists():
        raise FileNotFoundError(f"Missing required image2-generated source: {source}")
    img = Image.open(source).convert("RGB")
    return ImageOps.fit(img, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).convert("RGBA")


def paste_region(atlas: Image.Image, key: str, tile: Image.Image) -> None:
    region = REGIONS[key]
    atlas.alpha_composite(tile, (region["x"], region["y"]))


def make_contact_sheet(tiles: dict[str, Image.Image]) -> None:
    cell_w, cell_h = 360, 300
    sheet = Image.new("RGB", (cell_w * 4, cell_h * 2), (28, 24, 18))
    draw = ImageDraw.Draw(sheet)
    for index, (key, tile) in enumerate(tiles.items()):
        ox = (index % 4) * cell_w
        oy = (index // 4) * cell_h
        preview = tile.convert("RGB").resize((220, 220), Image.Resampling.LANCZOS)
        sheet.paste(preview, (ox + 70, oy + 18))
        draw.text((ox + 18, oy + 248), key, fill=(238, 226, 203))
        draw.text((ox + 18, oy + 268), REGIONS[key]["role"][:46], fill=(174, 154, 122))
    sheet.save(CONTACT_SHEET_PATH)


def main() -> None:
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (188, 173, 142, 255))
    tiles: dict[str, Image.Image] = {}
    for key, region in REGIONS.items():
        tile = load_image2_tile(key, (region["w"], region["h"]))
        tile_path = SOURCE_DIR / f"{key}.png"
        tile.convert("RGB").save(tile_path)
        tiles[key] = tile
        paste_region(atlas, key, tile)

    atlas.convert("RGB").save(ATLAS_PATH)
    make_contact_sheet(tiles)
    REGIONS_PATH.write_text(
        json.dumps(
            {
                "schema": "human-protocol/residential-reference-image2-atlas-regions@1",
                "atlas": ATLAS_PATH.relative_to(ROOT).as_posix(),
                "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
                "regions": REGIONS,
                "sourceTiles": {key: (SOURCE_DIR / f"{key}.png").relative_to(ROOT).as_posix() for key in REGIONS},
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    REPORT_PATH.write_text(
        json.dumps(
            {
                "schema": "human-protocol/residential-reference-image2-texture-report@1",
                "generatedAt": "2026-06-19",
                "source": "true image2-generated residential material PNGs copied into image2-generated-sources and packed into runtime tiles",
                "atlas": ATLAS_PATH.relative_to(ROOT).as_posix(),
                "regions": REGIONS_PATH.relative_to(ROOT).as_posix(),
                "contactSheet": CONTACT_SHEET_PATH.relative_to(ROOT).as_posix(),
                "image2GeneratedSources": {key: (GENERATED_SOURCE_DIR / SOURCE_IMAGE_MAP[key]).relative_to(ROOT).as_posix() for key in REGIONS},
                "sourceTiles": {key: (SOURCE_DIR / f"{key}.png").relative_to(ROOT).as_posix() for key in REGIONS},
                "prompts": IMAGE2_PROMPTS,
                "rules": [
                    "bitmap texture is used for primary material identity",
                    "source image must be an image2-generated PNG, not a procedural PIL material",
                    "texture remains low-noise and residential",
                    "no cyan scanner strip, camera lens, or front service panel is drawn",
                ],
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"atlas": str(ATLAS_PATH), "tiles": len(tiles), "contactSheet": str(CONTACT_SHEET_PATH)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
