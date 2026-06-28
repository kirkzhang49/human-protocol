#!/usr/bin/env python3
"""Generate low-noise Image2 texture atlas for Human Protocol Level 02 furniture.

The atlas is intentionally selective: it provides premium material identity for
large visible surfaces while avoiding noisy all-over decoration. Blender reads
the emitted region JSON and maps exact atlas rectangles onto key furniture
surfaces.
"""

from __future__ import annotations

import json
import math
import random
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level02-furniture-image2"
SOURCE_DIR = TEXTURE_DIR / "image2-sources"
REAL_SOURCE_DIR = TEXTURE_DIR / "image2-real-sources"
REPORT_DIR = ROOT / "src/assets/manifests/reports"
ATLAS_PATH = TEXTURE_DIR / "hp_level02_furniture_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_level02_furniture_image2_atlas.regions.json"
CONTACT_SHEET_PATH = TEXTURE_DIR / "hp_level02_furniture_image2_contact_sheet.png"
REPORT_PATH = REPORT_DIR / "level02_furniture_image2_texture_report.json"
PROVENANCE_JSON_PATH = REPORT_DIR / "level02_furniture_image2_source_provenance.json"
PROVENANCE_MD_PATH = REPORT_DIR / "level02_furniture_image2_source_provenance.md"
REAL_SOURCE_METADATA_PATH = REAL_SOURCE_DIR / "hp_level02_imagegen_texture_atlas_source.metadata.json"

ATLAS_SIZE = 2048
RANDOM_SEED = 20260619

REGIONS = {
    "walnut_large_grain": {"x": 16, "y": 16, "w": 752, "h": 496, "padding": 16, "role": "tabletop and warm walnut veneer"},
    "honed_stone_warm_vein": {"x": 800, "y": 16, "w": 496, "h": 368, "padding": 16, "role": "kitchen stone counter"},
    "ivory_boucle_fabric": {"x": 1328, "y": 16, "w": 496, "h": 496, "padding": 16, "role": "shared soft upholstery"},
    "warm_lacquer_panel": {"x": 16, "y": 560, "w": 496, "h": 496, "padding": 16, "role": "wardrobe and elevator inset panels"},
    "residential_art_panel": {"x": 544, "y": 560, "w": 624, "h": 432, "padding": 16, "role": "portrait console art surface"},
    "muted_book_spines": {"x": 1200, "y": 560, "w": 368, "h": 240, "padding": 16, "role": "book shelf accents"},
    "shadow_trim_gap": {"x": 1600, "y": 560, "w": 256, "h": 256, "padding": 16, "role": "hidden control seams and shadow trims"},
}


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def mix(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(lerp(a, b, t) for a, b in zip(c1, c2))


def add_noise(img: Image.Image, amount: int, seed: int) -> Image.Image:
    rng = random.Random(seed)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            n = rng.randint(-amount, amount)
            r, g, b, a = px[x, y]
            px[x, y] = (max(0, min(255, r + n)), max(0, min(255, g + n)), max(0, min(255, b + n)), a)
    return img


def draw_walnut(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (134, 82, 43, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(h):
        t = y / max(1, h - 1)
        base = mix((121, 72, 38), (176, 114, 64), 0.38 + 0.22 * math.sin(t * math.pi))
        draw.line([(0, y), (w, y)], fill=(*base, 255))
    for i in range(9):
        y0 = int((i + 0.6) * h / 9)
        amp = 7 + (i % 3) * 3
        color = (82, 48, 28, 52) if i % 3 else (213, 154, 92, 42)
        points = []
        for x in range(-20, w + 21, 18):
            t = x / max(1, w)
            y = y0 + math.sin(t * math.tau * (0.7 + i * 0.04) + i * 0.65) * amp
            y += math.sin(t * math.tau * 1.8 + i) * (amp * 0.22)
            points.append((x, y))
        draw.line(points, fill=color, width=3 if i % 3 else 2, joint="curve")
    for i in range(3):
        cx = int(w * (0.18 + i * 0.16))
        cy = int(h * (0.30 + 0.10 * math.sin(i)))
        draw.ellipse((cx - 46, cy - 13, cx + 46, cy + 13), outline=(74, 42, 24, 26), width=2)
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.65)), 2, RANDOM_SEED + 1)


def draw_stone(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (202, 195, 178, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(h):
        shade = int(4 * math.sin(y / h * math.pi * 1.2))
        draw.line([(0, y), (w, y)], fill=(202 + shade, 195 + shade, 179 + shade, 255))
    rng = random.Random(RANDOM_SEED + 2)
    for i in range(4):
        y0 = rng.randint(20, h - 20)
        color = (139, 124, 101, rng.randint(20, 34))
        points = []
        for x in range(-10, w + 11, 28):
            y = y0 + math.sin((x / w) * math.tau * rng.uniform(0.35, 0.8) + i) * rng.uniform(3, 9)
            points.append((x, y))
        draw.line(points, fill=color, width=1)
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.85)), 2, RANDOM_SEED + 3)


def draw_fabric(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (224, 219, 203, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(0, h, 13):
        c = (238, 233, 216, 16) if (y // 13) % 2 else (181, 176, 160, 10)
        draw.line([(0, y), (w, y)], fill=c, width=1)
    for x in range(0, w, 17):
        c = (246, 241, 224, 12) if (x // 17) % 2 else (178, 173, 157, 8)
        draw.line([(x, 0), (x, h)], fill=c, width=1)
    rng = random.Random(RANDOM_SEED + 4)
    for _ in range(900):
        x = rng.randrange(w)
        y = rng.randrange(h)
        a = rng.randrange(7, 18)
        draw.point((x, y), fill=(255, 250, 232, a))
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.9)), 1, RANDOM_SEED + 5)


def draw_lacquer(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (211, 196, 166, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(h):
        t = y / max(1, h - 1)
        color = mix((197, 174, 135), (229, 218, 190), 0.25 + 0.55 * (1 - abs(t - 0.42)))
        draw.line([(0, y), (w, y)], fill=(*color, 255))
    inset = 42
    draw.rounded_rectangle((inset, inset, w - inset, h - inset), radius=18, outline=(154, 128, 86, 80), width=6)
    draw.rounded_rectangle((inset + 24, inset + 24, w - inset - 24, h - inset - 24), radius=12, outline=(246, 238, 212, 55), width=3)
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.2)), 3, RANDOM_SEED + 6)


def draw_art_panel(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (211, 183, 134, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=20, fill=(205, 174, 126, 255))
    shapes = [
        ((44, 66, w - 88, 132), (226, 184, 104, 210)),
        ((92, 158, w - 58, 220), (119, 75, 42, 195)),
        ((54, 260, w - 128, 326), (230, 211, 167, 190)),
    ]
    for box, color in shapes:
        draw.rounded_rectangle(box, radius=22, fill=color)
    draw.line([(54, h - 64), (w - 74, h - 84)], fill=(92, 61, 38, 78), width=4)
    draw.line([(76, 48), (w - 96, 38)], fill=(245, 226, 184, 65), width=3)
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.3)), 4, RANDOM_SEED + 7)


def draw_book_spines(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (91, 88, 79, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    colors = [(117, 116, 103), (92, 112, 94), (84, 102, 112), (169, 148, 104), (201, 190, 164)]
    x = 0
    i = 0
    while x < w:
        bw = 22 + (i * 11) % 38
        color = colors[i % len(colors)]
        draw.rounded_rectangle((x + 2, 12, min(w - 2, x + bw), h - 12), radius=4, fill=(*color, 255))
        if bw > 35:
            draw.line([(x + 10, 32), (x + 10, h - 34)], fill=(240, 228, 190, 52), width=2)
        x += bw + 5
        i += 1
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.18)), 3, RANDOM_SEED + 8)


def draw_shadow_trim(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (63, 58, 49, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((28, 28, w - 28, h - 28), radius=10, fill=(41, 39, 34, 255), outline=(102, 91, 70, 120), width=4)
    draw.line([(42, h // 2), (w - 42, h // 2)], fill=(17, 17, 15, 180), width=5)
    return add_noise(img.filter(ImageFilter.GaussianBlur(0.25)), 2, RANDOM_SEED + 9)


DRAWERS = {
    "walnut_large_grain": draw_walnut,
    "honed_stone_warm_vein": draw_stone,
    "ivory_boucle_fabric": draw_fabric,
    "warm_lacquer_panel": draw_lacquer,
    "residential_art_panel": draw_art_panel,
    "muted_book_spines": draw_book_spines,
    "shadow_trim_gap": draw_shadow_trim,
}

REAL_IMAGEGEN_SOURCE_KEYS = {
    "walnut_large_grain": "image_gen walnut/oak veneer quadrant",
    "warm_lacquer_panel": "image_gen warm lacquer cabinet panel quadrant",
    "residential_art_panel": "image_gen residential abstract art quadrant",
    "muted_book_spines": "image_gen muted bookshelf spines quadrant",
}


def load_real_imagegen_tile(region_key: str, size: tuple[int, int]) -> Image.Image | None:
    source_path = REAL_SOURCE_DIR / f"{region_key}.png"
    if region_key not in REAL_IMAGEGEN_SOURCE_KEYS or not source_path.exists():
        return None
    source = Image.open(source_path).convert("RGBA")
    if region_key == "warm_lacquer_panel":
        return polish_lacquer_from_imagegen(source, size)
    return ImageOps.fit(source, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))


def polish_lacquer_from_imagegen(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    """Use the real image_gen lacquer source without repeating its full picture-frame border."""
    sw, sh = source.size
    center = source.crop((int(sw * 0.22), int(sh * 0.22), int(sw * 0.78), int(sh * 0.78)))
    tile = ImageOps.fit(center, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5)).convert("RGBA")
    tile = tile.filter(ImageFilter.GaussianBlur(0.55))
    w, h = size
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for y in range(h):
        t = y / max(1, h - 1)
        warm = int(10 * (1.0 - abs(t - 0.42)))
        draw.line([(0, y), (w, y)], fill=(255, 246, 224, warm))
    inset = max(18, int(min(w, h) * 0.055))
    draw.rounded_rectangle(
        (inset, inset, w - inset, h - inset),
        radius=max(10, int(inset * 0.55)),
        outline=(126, 112, 85, 20),
        width=2,
    )
    draw.rounded_rectangle(
        (inset + 9, inset + 9, w - inset - 9, h - inset - 9),
        radius=max(7, int(inset * 0.40)),
        outline=(255, 252, 240, 18),
        width=1,
    )
    return Image.alpha_composite(tile, overlay)


def paste_with_bleed(atlas: Image.Image, region_key: str, tile: Image.Image) -> None:
    region = REGIONS[region_key]
    x, y, w, h, padding = region["x"], region["y"], region["w"], region["h"], region["padding"]
    padded = Image.new("RGBA", (w + padding * 2, h + padding * 2))
    padded.paste(tile.resize((w, h), Image.Resampling.BICUBIC), (padding, padding))
    padded.paste(padded.crop((padding, padding, padding + 1, padding + h)).resize((padding, h)), (0, padding))
    padded.paste(padded.crop((padding + w - 1, padding, padding + w, padding + h)).resize((padding, h)), (padding + w, padding))
    padded.paste(padded.crop((0, padding, w + padding * 2, padding + 1)).resize((w + padding * 2, padding)), (0, 0))
    padded.paste(padded.crop((0, padding + h - 1, w + padding * 2, padding + h)).resize((w + padding * 2, padding)), (0, padding + h))
    atlas.alpha_composite(padded, (x - padding, y - padding))
    tile.save(SOURCE_DIR / f"{region_key}.png")


def make_contact_sheet() -> None:
    cell_w, cell_h = 360, 270
    sheet = Image.new("RGB", (cell_w * 3, cell_h * 3), (24, 22, 19))
    draw = ImageDraw.Draw(sheet)
    for index, key in enumerate(REGIONS):
        tile = Image.open(SOURCE_DIR / f"{key}.png").convert("RGB")
        tile.thumbnail((cell_w - 28, cell_h - 58), Image.Resampling.LANCZOS)
        ox = (index % 3) * cell_w
        oy = (index // 3) * cell_h
        draw.rounded_rectangle((ox + 8, oy + 8, ox + cell_w - 8, oy + cell_h - 8), radius=8, fill=(31, 29, 25), outline=(97, 88, 70))
        sheet.paste(tile, (ox + (cell_w - tile.width) // 2, oy + 16))
        draw.text((ox + 16, oy + cell_h - 30), key, fill=(236, 225, 201))
    sheet.save(CONTACT_SHEET_PATH)


def main() -> None:
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    REAL_SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    atlas = Image.new("RGBA", (ATLAS_SIZE, ATLAS_SIZE), (190, 180, 158, 255))
    source_kinds: dict[str, str] = {}
    for key, drawer in DRAWERS.items():
        region = REGIONS[key]
        tile = load_real_imagegen_tile(key, (region["w"], region["h"]))
        if tile is None:
            tile = drawer((region["w"], region["h"]))
            source_kinds[key] = "deterministic low-noise procedural fallback"
        else:
            source_kinds[key] = "real built-in image_gen source crop"
        paste_with_bleed(atlas, key, tile)
    atlas.convert("RGB").save(ATLAS_PATH)
    make_contact_sheet()

    regions_payload = {
        "schema": "human-protocol/level02-furniture-image2-atlas-regions@1",
        "generatedAt": date.today().isoformat(),
        "atlas": ATLAS_PATH.relative_to(ROOT).as_posix(),
        "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
        "paddingPolicy": "16px bleed per region, UVs inset by 8px in Blender",
        "regions": REGIONS,
    }
    REGIONS_PATH.write_text(json.dumps(regions_payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    report = {
        "schema": "human-protocol/level02-furniture-image2-texture-report@1",
        "generatedAt": date.today().isoformat(),
        "source": "real built-in image_gen material atlas for selected hero surfaces, deterministic fallbacks for non-hero support materials",
        "reference": "/Users/zhengkaizhang/Desktop/Screenshot 2026-06-19 at 10.52.05 AM.png",
        "realImageGenSourceDirectory": REAL_SOURCE_DIR.relative_to(ROOT).as_posix(),
        "realImageGenSourceMetadata": REAL_SOURCE_METADATA_PATH.relative_to(ROOT).as_posix(),
        "sourceProvenance": PROVENANCE_JSON_PATH.relative_to(ROOT).as_posix(),
        "sourceProvenanceHuman": PROVENANCE_MD_PATH.relative_to(ROOT).as_posix(),
        "licenseLabel": "openai-generated-output-user-owned-subject-to-openai-terms",
        "realImageGenSourceKeys": REAL_IMAGEGEN_SOURCE_KEYS,
        "sourceKinds": source_kinds,
        "rules": [
            "texture only large, readable material surfaces",
            "avoid repeated micro-lines, pasted posters, text, and sci-fi symbols",
            "combine baseColorTexture with PBR roughness/metallic materials in Blender",
            "UV regions are mathematically fixed by hp_level02_furniture_image2_atlas.regions.json",
        ],
        "atlas": ATLAS_PATH.relative_to(ROOT).as_posix(),
        "regions": REGIONS,
        "contactSheet": CONTACT_SHEET_PATH.relative_to(ROOT).as_posix(),
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"wrote {ATLAS_PATH}")
    print(f"wrote {REGIONS_PATH}")
    print(f"wrote {CONTACT_SHEET_PATH}")
    print(f"wrote {REPORT_PATH}")


if __name__ == "__main__":
    main()
