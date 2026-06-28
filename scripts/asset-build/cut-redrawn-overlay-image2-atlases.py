#!/usr/bin/env python3
"""Cut redrawn Image2 overlay source sheets into runtime atlases.

Inputs are purpose-built Image2 contact sheets:
- route switch: four colored output bays plus one rear backplate
- tool calibration: one tool hero, twelve tile modules, one grid backplate

The crop boxes are ratios so the source can be regenerated at nearby sizes
without changing this script. The script only crops, pads, packs, and writes
regions JSON; it does not draw the primary art.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]

ROUTE_SOURCE = ROOT / "src/assets/gui/route-switch/image2-sources/route_switch_console_redraw_source_v3.png"
ROUTE_ATLAS = ROOT / "src/assets/gui/route-switch/route_switch_console_redraw_atlas_v3.png"
ROUTE_REGIONS = ROOT / "src/assets/gui/route-switch/route_switch_console_redraw_atlas_v3.regions.json"
ROUTE_BACKGROUND_SOURCE = ROOT / "src/assets/gui/route-switch/image2-sources/route_switch_background_image2_source_v6.png"
ROUTE_BACKGROUND = ROOT / "src/assets/gui/route-switch/route_switch_background_image2_v6.png"

TOOL_SOURCE = ROOT / "src/assets/gui/tool-calibration/image2-sources/tool_calibration_redraw_source_v4.png"
TOOL_FRAME_SOURCE = ROOT / "src/assets/gui/tool-calibration/image2-sources/tool_calibration_tile_frame_image2_source_v8.png"
TOOL_INSERT_SOURCE = ROOT / "src/assets/gui/tool-calibration/image2-sources/tool_calibration_tile_inserts_image2_source_v8.png"
TOOL_ATLAS = ROOT / "src/assets/gui/tool-calibration/tool_calibration_redraw_atlas_v4.png"
TOOL_REGIONS = ROOT / "src/assets/gui/tool-calibration/tool_calibration_redraw_atlas_v4.regions.json"


@dataclass(frozen=True)
class RatioRegion:
    name: str
    x: float
    y: float
    w: float
    h: float
    expand_px: int = 0
    keep_rect: bool = False


@dataclass(frozen=True)
class PixelRegion:
    name: str
    image: Image.Image


ROUTE_BLUEPRINT: tuple[RatioRegion, ...] = (
    RatioRegion("output_bay_cyan", 0.055, 0.065, 0.205, 0.515, 2, True),
    RatioRegion("output_bay_amber", 0.285, 0.065, 0.205, 0.515, 2, True),
    RatioRegion("output_bay_green", 0.515, 0.065, 0.205, 0.515, 2, True),
    RatioRegion("output_bay_violet", 0.745, 0.065, 0.205, 0.515, 2, True),
    RatioRegion("route_backplate", 0.055, 0.635, 0.890, 0.275, 2, True),
)

TOOL_BLUEPRINT: tuple[RatioRegion, ...] = (
    # Pixel-measured from the accepted 1672x941 Image2 source sheet, then
    # normalized. Keep these exact ratios: tile readability depends on full,
    # uncropped square modules.
    RatioRegion("tool_hero", 0.020933, 0.224230, 0.436603, 0.272051, 2, True),
    # Uniform 200x200 source-space square crops: the measured 192px tile
    # boxes are expanded 4px left/top/right/bottom to preserve dark beveled
    # borders exactly. Do not trim these.
    RatioRegion("tile_straight_off", 0.474282, 0.017003, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_straight_on", 0.599880, 0.017003, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_corner_off", 0.723086, 0.017003, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_corner_on", 0.846292, 0.017003, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_tee_off", 0.474282, 0.236982, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_tee_on", 0.599880, 0.236982, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_cross_off", 0.723086, 0.236982, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_cross_on", 0.846292, 0.236982, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_blocked", 0.474282, 0.451647, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_core", 0.599880, 0.451647, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_entry", 0.723086, 0.451647, 0.119617, 0.212540, 0, True),
    RatioRegion("tile_output", 0.846292, 0.451647, 0.119617, 0.212540, 0, True),
    RatioRegion("tool_grid_backplate", 0.147727, 0.685441, 0.694378, 0.280553, 2, True),
)

TOOL_INSERT_NAMES: tuple[str, ...] = (
    "tile_inner_straight_off",
    "tile_inner_straight_on",
    "tile_inner_corner_off",
    "tile_inner_corner_on",
    "tile_inner_tee_off",
    "tile_inner_tee_on",
    "tile_inner_cross_off",
    "tile_inner_cross_on",
    "tile_inner_core_off",
    "tile_inner_core_on",
    "tile_inner_entry",
    "tile_inner_output",
    "tile_inner_blocked",
    "tile_inner_empty",
    "tile_inner_status_cyan",
    "tile_inner_status_amber",
)


def require_file(path: Path) -> None:
    if not path.exists():
        raise SystemExit(
            f"Missing Image2 source: {path}\n"
            "Save the generated Image2 source sheet to this exact path, then rerun this script."
        )


def crop_ratio(source: Image.Image, spec: RatioRegion) -> PixelRegion:
    width, height = source.size
    expand = spec.expand_px
    box = (
        max(0, round(spec.x * width) - expand),
        max(0, round(spec.y * height) - expand),
        min(width, round((spec.x + spec.w) * width) + expand),
        min(height, round((spec.y + spec.h) * height) + expand),
    )
    return PixelRegion(spec.name, source.crop(box))


def crop_grid(source: Image.Image, name: str, col: int, row: int, cols: int, rows: int, margin_ratio: float = 0.035) -> PixelRegion:
    width, height = source.size
    cell_w = width / cols
    cell_h = height / rows
    gutter_x = cell_w * margin_ratio
    gutter_y = cell_h * margin_ratio
    box = (
        round(col * cell_w + gutter_x),
        round(row * cell_h + gutter_y),
        round((col + 1) * cell_w - gutter_x),
        round((row + 1) * cell_h - gutter_y),
    )
    return PixelRegion(name, source.crop(box))


def black_to_alpha(image: Image.Image, threshold: int = 3, trim: bool = False) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                pixels[x, y] = (r, g, b, 0)
            elif r <= threshold + 12 and g <= threshold + 12 and b <= threshold + 12:
                pixels[x, y] = (r, g, b, min(a, 80))
    return trim_alpha(rgba) if trim else rgba


def remove_black_to_alpha(image: Image.Image, threshold: int = 18) -> Image.Image:
    return black_to_alpha(image, threshold=threshold, trim=True)


def alpha_outside_rounded_rect(size: tuple[int, int], inset: int, radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((inset, inset, size[0] - inset, size[1] - inset), radius=radius, fill=255)
    return mask


def make_tool_tile_frame(tile: Image.Image) -> Image.Image:
    frame = tile.convert("RGBA")
    inner_mask = alpha_outside_rounded_rect(frame.size, inset=32, radius=18)
    pixels = frame.load()
    width, height = frame.size
    for y in range(height):
        for x in range(width):
            if inner_mask.getpixel((x, y)) > 0:
                r, g, b, _a = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
    return frame


def make_tool_tile_inner(tile: Image.Image) -> Image.Image:
    inner = tile.convert("RGBA")
    keep_mask = alpha_outside_rounded_rect(inner.size, inset=26, radius=20)
    pixels = inner.load()
    width, height = inner.size
    for y in range(height):
        for x in range(width):
            if keep_mask.getpixel((x, y)) == 0:
                r, g, b, _a = pixels[x, y]
                pixels[x, y] = (r, g, b, 0)
    return inner


def trim_alpha(image: Image.Image, padding: int = 8) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = ImageChops.difference(alpha, Image.new("L", alpha.size, 0)).getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def rotate_quarter_turn(image: Image.Image, rotation: int) -> Image.Image:
    turn = rotation % 4
    if turn == 0:
        return image.copy()
    if turn == 1:
        return image.transpose(Image.Transpose.ROTATE_270)
    if turn == 2:
        return image.transpose(Image.Transpose.ROTATE_180)
    return image.transpose(Image.Transpose.ROTATE_90)


def build_route_background_v4() -> None:
    """Build a clearly visible route-console background from the accepted Image2 metal source."""

    require_file(ROUTE_BACKGROUND_SOURCE)
    with Image.open(ROUTE_BACKGROUND_SOURCE) as source:
        background = source.convert("RGB").resize((1280, 720), Image.Resampling.LANCZOS)
    background.save(ROUTE_BACKGROUND, optimize=True, compress_level=9)
    print(f"wrote {ROUTE_BACKGROUND.relative_to(ROOT)}")
    return

    require_file(ROUTE_SOURCE)
    with Image.open(ROUTE_SOURCE) as source:
        source = source.convert("RGBA")
        width, height = source.size
        rail_spec = next(spec for spec in ROUTE_BLUEPRINT if spec.name == "route_backplate")
        rail = crop_ratio(source, rail_spec).image.convert("RGBA")

    out_w, out_h = 1600, 900
    bg = Image.new("RGBA", (out_w, out_h), (4, 8, 10, 255))
    draw = ImageDraw.Draw(bg)

    for y in range(out_h):
        shade = int(26 + 28 * (1 - abs((y / out_h) - 0.44)))
        draw.line((0, y, out_w, y), fill=(5, max(11, shade // 2), max(16, shade), 255))

    # Dark brushed-panel grid that remains quiet behind live UI text.
    for x in range(90, out_w - 80, 122):
        draw.line((x, 160, x, out_h - 210), fill=(25, 54, 58, 76), width=1)
    for y in range(150, out_h - 180, 96):
        draw.line((82, y, out_w - 82, y), fill=(25, 54, 58, 68), width=1)

    # A large Image2 metal motherboard sits behind the live output sockets.
    # Keep it lower than the title safe area, but visible around the dial.
    rail_large = rail.resize((1300, 226), Image.Resampling.LANCZOS)
    rail_large = ImageEnhance.Contrast(rail_large).enhance(1.16)
    rail_large = ImageEnhance.Brightness(rail_large).enhance(0.94)
    bg.alpha_composite(rail_large, ((out_w - rail_large.width) // 2, 535))

    rail_shadow = rail.resize((1020, 176), Image.Resampling.LANCZOS)
    rail_shadow = ImageEnhance.Contrast(rail_shadow).enhance(1.25)
    rail_shadow = ImageEnhance.Brightness(rail_shadow).enhance(0.42)
    bg.alpha_composite(rail_shadow, ((out_w - rail_shadow.width) // 2, 405))

    cx, cy = out_w // 2, 360
    halo = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for r, alpha, line_w in [(268, 92, 2), (220, 122, 2), (166, 150, 3), (116, 190, 4)]:
        hd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(68, 220, 235, alpha), width=line_w)
    for r, alpha, line_w in [(98, 190, 6), (70, 210, 4), (42, 230, 3)]:
        hd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(196, 150, 78, alpha), width=line_w)
    for k in range(36):
        a = k * 10
        if k % 3 == 1:
            continue
        rad = math.radians(a)
        x0 = cx + math.cos(rad) * 74
        y0 = cy + math.sin(rad) * 74
        x1 = cx + math.cos(rad) * 170
        y1 = cy + math.sin(rad) * 170
        hd.line((x0, y0, x1, y1), fill=(202, 155, 82, 170), width=5)
    # Cross rails and cyan conduits make the image read as an Image2 machine,
    # while React still owns the live selector and output buttons.
    hd.rounded_rectangle((cx - 330, cy + 92, cx + 330, cy + 132), radius=10, fill=(8, 15, 18, 190), outline=(188, 140, 70, 120), width=2)
    for offset in (-240, -120, 120, 240):
        hd.arc((cx + offset - 90, cy + 38, cx + offset + 90, cy + 218), 202, 338, fill=(63, 224, 238, 150), width=3)
    hd.ellipse((cx - 62, cy - 62, cx + 62, cy + 62), fill=(4, 9, 11, 190), outline=(74, 226, 238, 150), width=3)
    hd.ellipse((cx - 20, cy - 20, cx + 20, cy + 20), fill=(72, 230, 242, 235))
    bg.alpha_composite(halo.filter(ImageFilter.GaussianBlur(0.25)))

    # Side service plates give the wide background visible Image2 mass even when
    # the foreground output module covers the lower rail.
    side = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(side)
    for x0, flip in [(120, 1), (out_w - 420, -1)]:
        sd.rounded_rectangle((x0, 230, x0 + 300, 632), radius=18, fill=(7, 13, 16, 138), outline=(58, 140, 152, 82), width=2)
        sd.line((x0 + 34, 272, x0 + 266, 272), fill=(192, 145, 72, 92), width=3)
        sd.line((x0 + 34, 590, x0 + 266, 590), fill=(192, 145, 72, 82), width=3)
        for y in (330, 410, 490):
            sd.rounded_rectangle((x0 + 64, y, x0 + 236, y + 22), radius=8, fill=(20, 36, 40, 150), outline=(62, 226, 238, 80), width=1)
    bg.alpha_composite(side)

    # Vignette and inner bevel.
    vignette = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(vignette)
    vd.rectangle((0, 0, out_w, out_h), outline=(76, 180, 194, 62), width=2)
    vd.rectangle((22, 22, out_w - 22, out_h - 22), outline=(190, 145, 74, 58), width=2)
    for inset, alpha in [(0, 140), (24, 90), (58, 54)]:
        vd.rectangle((inset, inset, out_w - inset, out_h - inset), outline=(0, 0, 0, alpha), width=24)
    bg.alpha_composite(vignette)

    ROUTE_BACKGROUND_SOURCE.parent.mkdir(parents=True, exist_ok=True)
    bg.save(ROUTE_BACKGROUND_SOURCE, optimize=True, compress_level=9)
    bg.resize((1280, 720), Image.Resampling.LANCZOS).save(ROUTE_BACKGROUND, optimize=True, compress_level=9)
    print(f"wrote {ROUTE_BACKGROUND_SOURCE.relative_to(ROOT)}")
    print(f"wrote {ROUTE_BACKGROUND.relative_to(ROOT)}")


def append_rotations(regions: list[PixelRegion], names: Iterable[str]) -> None:
    by_name = {region.name: region.image for region in regions}
    for name in names:
        image = by_name.get(name)
        if image is None:
            continue
        for rotation in range(4):
            regions.append(PixelRegion(f"{name}_r{rotation}", rotate_quarter_turn(image, rotation)))


def pack(regions: Iterable[PixelRegion], atlas_path: Path, json_path: Path, source_path: Path) -> None:
    parts = list(regions)
    padding = 20
    max_row_width = 1600
    rows: list[list[PixelRegion]] = []
    current: list[PixelRegion] = []
    current_width = 0
    for part in parts:
        next_width = current_width + part.image.width + (padding if current else 0)
        if current and next_width > max_row_width:
            rows.append(current)
            current = [part]
            current_width = part.image.width
        else:
            current.append(part)
            current_width = next_width
    if current:
        rows.append(current)

    atlas_width = max(sum(p.image.width for p in row) + padding * (len(row) + 1) for row in rows)
    atlas_height = sum(max(p.image.height for p in row) for row in rows) + padding * (len(rows) + 1)
    atlas = Image.new("RGBA", (atlas_width, atlas_height), (0, 0, 0, 0))
    region_map: dict[str, list[int]] = {}

    y = padding
    for row in rows:
        x = padding
        row_height = max(p.image.height for p in row)
        for part in row:
            atlas.alpha_composite(part.image, (x, y))
            region_map[part.name] = [x, y, part.image.width, part.image.height]
            x += part.image.width + padding
        y += row_height + padding

    atlas_path.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(atlas_path, optimize=True, compress_level=9)
    json_path.write_text(
        json.dumps(
            {
                "atlasSize": [atlas_width, atlas_height],
                "source": str(source_path.relative_to(ROOT)),
                "regions": region_map,
                "notes": "Cropped and packed from a purpose-built Image2 redraw source sheet. Script removes flat black background only; it does not draw primary art.",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def cut(source_path: Path, specs: tuple[RatioRegion, ...], atlas_path: Path, regions_path: Path) -> None:
    require_file(source_path)
    with Image.open(source_path) as source:
        cropped = []
        for spec in specs:
            part = crop_ratio(source, spec)
            image = black_to_alpha(part.image, threshold=3, trim=False) if spec.keep_rect else remove_black_to_alpha(part.image)
            cropped.append(PixelRegion(part.name, image))
    pack(cropped, atlas_path, regions_path, source_path)
    print(f"wrote {atlas_path.relative_to(ROOT)}")
    print(f"wrote {regions_path.relative_to(ROOT)}")


def cut_tool(source_path: Path, atlas_path: Path, regions_path: Path) -> None:
    require_file(source_path)
    with Image.open(source_path) as source:
        cropped: list[PixelRegion] = []
        for spec in TOOL_BLUEPRINT:
            part = crop_ratio(source, spec)
            image = black_to_alpha(part.image, threshold=3, trim=False) if spec.keep_rect else remove_black_to_alpha(part.image)
            cropped.append(PixelRegion(part.name, image))
        append_rotations(cropped, [spec.name for spec in TOOL_BLUEPRINT if spec.name.startswith("tile_")])

    pack(cropped, atlas_path, regions_path, source_path)
    print(f"wrote {atlas_path.relative_to(ROOT)}")
    print(f"wrote {regions_path.relative_to(ROOT)}")


def cut_tool_layered(frame_source_path: Path, insert_source_path: Path, atlas_path: Path, regions_path: Path) -> None:
    require_file(frame_source_path)
    require_file(insert_source_path)
    cropped: list[PixelRegion] = []
    with Image.open(frame_source_path) as frame_source:
        frame = crop_grid(frame_source, "tile_frame", 0, 0, 4, 3, margin_ratio=0.055)
        cropped.append(PixelRegion(frame.name, black_to_alpha(frame.image, threshold=4, trim=False)))

    with Image.open(insert_source_path) as insert_source:
        for index, name in enumerate(TOOL_INSERT_NAMES):
            part = crop_grid(insert_source, name, index % 4, index // 4, 4, 4, margin_ratio=0.09)
            cropped.append(PixelRegion(part.name, black_to_alpha(part.image, threshold=4, trim=False)))
        append_rotations(cropped, TOOL_INSERT_NAMES)

    # Keep stable non-tile support art from the accepted v4 sheet until a
    # dedicated Image2 hero/backplate source is redrawn.
    with Image.open(TOOL_SOURCE) as source:
        for spec in TOOL_BLUEPRINT:
            if spec.name not in {"tool_hero", "tool_grid_backplate"}:
                continue
            part = crop_ratio(source, spec)
            cropped.append(PixelRegion(part.name, black_to_alpha(part.image, threshold=3, trim=False)))

    pack(cropped, atlas_path, regions_path, insert_source_path)
    print(f"wrote {atlas_path.relative_to(ROOT)}")
    print(f"wrote {regions_path.relative_to(ROOT)}")


def main() -> None:
    build_route_background_v4()
    cut(ROUTE_SOURCE, ROUTE_BLUEPRINT, ROUTE_ATLAS, ROUTE_REGIONS)
    if TOOL_FRAME_SOURCE.exists() and TOOL_INSERT_SOURCE.exists():
        cut_tool_layered(TOOL_FRAME_SOURCE, TOOL_INSERT_SOURCE, TOOL_ATLAS, TOOL_REGIONS)
    else:
        cut_tool(TOOL_SOURCE, TOOL_ATLAS, TOOL_REGIONS)


if __name__ == "__main__":
    main()
