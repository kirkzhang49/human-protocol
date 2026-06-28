#!/usr/bin/env python3
"""Compose gate-balance GUI v3 from transparent Image2 parts.

V2 used the complete Image2 picture as a poster-like background, then overlaid
live React state. That made numeric controls drift visually. V3 cuts the source
into transparent functional parts and records the exact local slots for live
labels, numbers, and buttons.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
GUI_DIR = ROOT / "src/assets/gui/gate-balance"
SRC_DIR = GUI_DIR / "image2-sources"
REPORT_DIR = ROOT / "src/assets/manifests/reports"

SOURCE = SRC_DIR / "gate_balance_overlay_image2_source_v2_original.png"
FRAME = GUI_DIR / "gate_balance_overlay_frame_image2_v3.png"
PARTS = GUI_DIR / "gate_balance_overlay_parts_image2_v3.png"
REGIONS = GUI_DIR / "gate_balance_overlay_parts_image2_v3.regions.json"
LAYOUT = GUI_DIR / "gate_balance_overlay_layout_v3.json"
CONTACT = REPORT_DIR / "gate_balance_gui_image2_contact_sheet_v3.png"
CLIPS_DIR = GUI_DIR / "clips-v3"

CANVAS = [1792, 1024]

RECTS = {
    "gateLeft": [225, 220, 340, 360],
    "gateMid": [655, 220, 350, 360],
    "gateRight": [1088, 220, 350, 360],
    "gaugeSeal": [192, 590, 390, 125],
    "gaugeTrack": [635, 590, 390, 125],
    "gaugeTemp": [1078, 590, 390, 125],
    "controlLeft": [158, 720, 410, 120],
    "controlMid": [638, 720, 410, 120],
    "controlRight": [1082, 720, 410, 120],
    "resetButton": [765, 850, 135, 72],
    "lockButton": [1090, 850, 430, 72],
    "closeButton": [1372, 80, 170, 86],
    "syncBar": [608, 138, 820, 42],
}

GATE_SLOTS = {
    "gateLeftLabel": [286, 242, 112, 28],
    "gateLeftFill": [304, 314, 152, 118],
    "gateLeftHint": [328, 448, 104, 30],
    "gateMidLabel": [724, 242, 112, 28],
    "gateMidFill": [742, 314, 152, 118],
    "gateMidHint": [766, 448, 104, 30],
    "gateRightLabel": [1157, 242, 112, 28],
    "gateRightFill": [1175, 314, 152, 118],
    "gateRightHint": [1199, 448, 104, 30],
}

GAUGE_SLOTS = {
    "gaugeSealLabel": [222, 592, 120, 28],
    "gaugeSealBadge": [480, 592, 112, 28],
    "gaugeSealBar": [330, 632, 238, 18],
    "gaugeSealValue": [330, 654, 238, 24],
    "gaugeTrackLabel": [706, 592, 120, 28],
    "gaugeTrackBadge": [964, 592, 112, 28],
    "gaugeTrackBar": [814, 632, 238, 18],
    "gaugeTrackValue": [814, 654, 238, 24],
    "gaugeTempLabel": [1188, 592, 120, 28],
    "gaugeTempBadge": [1446, 592, 112, 28],
    "gaugeTempBar": [1296, 632, 238, 18],
    "gaugeTempValue": [1296, 654, 238, 24],
}

CONTROL_SLOTS = {
    "controlLeftMinus": [190, 756, 60, 60],
    "controlLeftLabel": [282, 760, 184, 20],
    "controlLeftValue": [282, 782, 184, 34],
    "controlLeftPlus": [476, 756, 60, 60],
    "controlMidMinus": [670, 756, 60, 60],
    "controlMidLabel": [762, 760, 184, 20],
    "controlMidValue": [762, 782, 184, 34],
    "controlMidPlus": [956, 756, 60, 60],
    "controlRightMinus": [1114, 756, 60, 60],
    "controlRightLabel": [1206, 760, 184, 20],
    "controlRightValue": [1206, 782, 184, 34],
    "controlRightPlus": [1400, 756, 60, 60],
}


def crop(image: Image.Image, rect: list[int]) -> Image.Image:
    x, y, w, h = rect
    return image.crop((x, y, x + w, y + h))


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def chamfer_mask(size: tuple[int, int], chamfer: int) -> Image.Image:
    w, h = size
    c = min(chamfer, w // 3, h // 3)
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(
        [(c, 0), (w - c, 0), (w, c), (w, h - c), (w - c, h), (c, h), (0, h - c), (0, c)],
        fill=255,
    )
    return mask


def part_mask(size: tuple[int, int], kind: str, amount: int) -> Image.Image:
    if kind == "chamfer":
        return chamfer_mask(size, amount)
    return rounded_mask(size, amount)


PART_DEFS = [
    ("gate_left_idle", "gateLeft", (0, 0), "chamfer", 34),
    ("gate_mid_idle", "gateMid", (370, 0), "chamfer", 34),
    ("gate_right_idle", "gateRight", (750, 0), "chamfer", 34),
    ("gauge_seal", "gaugeSeal", (0, 390), "chamfer", 24),
    ("gauge_track", "gaugeTrack", (420, 390), "chamfer", 24),
    ("gauge_temp", "gaugeTemp", (840, 390), "chamfer", 24),
    ("control_left", "controlLeft", (0, 545), "chamfer", 22),
    ("control_mid", "controlMid", (440, 545), "chamfer", 22),
    ("control_right", "controlRight", (880, 545), "chamfer", 22),
    ("reset_plate", "resetButton", (0, 700), "chamfer", 18),
    ("lock_plate", "lockButton", (160, 700), "chamfer", 18),
    ("close_plate", "closeButton", (620, 700), "chamfer", 18),
    ("progress_track", "syncBar", (820, 700), "rounded", 22),
]


def transparent_part(image: Image.Image, rect: list[int], kind: str, amount: int) -> Image.Image:
    part = crop(image, rect).convert("RGBA")
    part.putalpha(part_mask(part.size, kind, amount))
    return part


def erase_frame_part(frame: Image.Image, rect: list[int], kind: str, amount: int) -> None:
    x, y, w, h = rect
    alpha = frame.getchannel("A")
    alpha.paste(0, (x, y, x + w, y + h), part_mask((w, h), kind, amount))
    frame.putalpha(alpha)


def make_frame(source: Image.Image) -> None:
    frame = source.copy().convert("RGBA")
    for _, rect_key, _, kind, amount in PART_DEFS:
        erase_frame_part(frame, RECTS[rect_key], kind, amount)
    FRAME.parent.mkdir(parents=True, exist_ok=True)
    frame.save(FRAME)


def make_parts(source: Image.Image) -> dict[str, list[int]]:
    atlas = Image.new("RGBA", (2048, 1024), (0, 0, 0, 0))
    regions: dict[str, list[int]] = {}
    clips: dict[str, str] = {}

    def put(name: str, xy: tuple[int, int], part: Image.Image) -> None:
        atlas.alpha_composite(part, xy)
        regions[name] = [xy[0], xy[1], part.width, part.height]
        clip_path = CLIPS_DIR / f"{name}.png"
        part.save(clip_path)
        clips[name] = str(clip_path.relative_to(ROOT))

    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    for name, rect_key, xy, kind, amount in PART_DEFS:
        put(name, xy, transparent_part(source, RECTS[rect_key], kind, amount))

    atlas.save(PARTS)
    (CLIPS_DIR / "clips.json").write_text(json.dumps(clips, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return regions


def write_layout() -> None:
    layout = {
        "schemaVersion": "hp.gateBalance.image2Layout.v3",
        "composition": "transparent-parts",
        "canvas": CANVAS,
        "sourceImage": str(SOURCE.relative_to(ROOT)),
        "background": str(FRAME.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "regionsFile": str(REGIONS.relative_to(ROOT)),
        "clipsDir": str(CLIPS_DIR.relative_to(ROOT)),
        "regions": {
            "titleBlock": [140, 78, 460, 92],
            "closeButton": RECTS["closeButton"],
            "guidance": [140, 180, 620, 30],
            "syncLabel": [650, 118, 105, 26],
            "syncBar": RECTS["syncBar"],
            "syncCount": [1438, 149, 92, 42],
            "stage": [118, 198, 1556, 500],
            "gateLeft": RECTS["gateLeft"],
            "gateMid": RECTS["gateMid"],
            "gateRight": RECTS["gateRight"],
            "stageCaption": [560, 548, 670, 24],
            "gaugeSeal": RECTS["gaugeSeal"],
            "gaugeTrack": RECTS["gaugeTrack"],
            "gaugeTemp": RECTS["gaugeTemp"],
            "controlLeft": RECTS["controlLeft"],
            "controlMid": RECTS["controlMid"],
            "controlRight": RECTS["controlRight"],
            **GATE_SLOTS,
            **GAUGE_SLOTS,
            **CONTROL_SLOTS,
            "statusText": [198, 872, 480, 34],
            "resetButton": RECTS["resetButton"],
            "lockButton": RECTS["lockButton"],
            "timer": [1542, 172, 90, 34],
            "error": [650, 196, 680, 30],
        },
        "runtimeMustNotBake": [
            "localized title and instructions",
            "gate labels",
            "gate numeric positions",
            "gauge values and target deltas",
            "timer",
            "success/failure state",
            "button text and accessibility labels",
        ],
    }
    LAYOUT.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_regions(regions: dict[str, list[int]]) -> None:
    payload = {
        "schemaVersion": "hp.image2.gui.regions.v3",
        "atlasSize": [2048, 1024],
        "backgroundSize": CANVAS,
        "source": str(SOURCE.relative_to(ROOT)),
        "background": str(FRAME.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "clipsDir": str(CLIPS_DIR.relative_to(ROOT)),
        "regions": regions,
        "notes": "Frame has alpha cutouts. Clips-v3 contains individual transparent Image2 GUI pieces; atlas packs those clips for runtime.",
    }
    REGIONS.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def checkerboard(size: tuple[int, int], cell: int = 24) -> Image.Image:
    image = Image.new("RGBA", size, (34, 39, 43, 255))
    draw = ImageDraw.Draw(image, "RGBA")
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2 == 0:
                draw.rectangle((x, y, x + cell, y + cell), fill=(78, 86, 92, 255))
    return image


def write_contact(source: Image.Image) -> None:
    sheet = Image.new("RGBA", (1792, 1900), (4, 8, 10, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    frame = Image.open(FRAME).convert("RGBA")
    parts = Image.open(PARTS).convert("RGBA")
    frame_check = checkerboard(tuple(CANVAS))
    frame_check.alpha_composite(frame)
    sheet.alpha_composite(source.resize((896, 512), Image.Resampling.LANCZOS), (24, 24))
    sheet.alpha_composite(frame_check.resize((896, 512), Image.Resampling.LANCZOS), (24, 570))
    sheet.alpha_composite(parts.resize((1024, 512), Image.Resampling.LANCZOS), (744, 570))
    preview = frame.copy()
    pdraw = ImageDraw.Draw(preview, "RGBA")
    for _, rect_key, _, kind, amount in PART_DEFS:
        rect = RECTS[rect_key]
        preview.alpha_composite(transparent_part(source, rect, kind, amount), (rect[0], rect[1]))
    for name, rect in {**RECTS, **GATE_SLOTS, **GAUGE_SLOTS, **CONTROL_SLOTS}.items():
        x, y, w, h = rect
        pdraw.rectangle((x, y, x + w, y + h), outline=(99, 255, 212, 190), width=3)
        if name in GATE_SLOTS or name in GAUGE_SLOTS or name in CONTROL_SLOTS:
            pdraw.text((x + 4, y + 4), name, fill=(255, 210, 90, 255))
    sheet.alpha_composite(preview.resize((1344, 768), Image.Resampling.LANCZOS), (24, 1120))
    draw.text((24, 542), "source Image2", fill=(202, 252, 255, 255))
    draw.text((24, 1088), "frame with functional modules removed", fill=(202, 252, 255, 255))
    draw.text((744, 1088), "transparent parts atlas", fill=(202, 252, 255, 255))
    sheet.crop((0, 0, 1792, 1900)).save(CONTACT)


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    if list(source.size) != CANVAS:
        source = source.resize(tuple(CANVAS), Image.Resampling.LANCZOS)
    make_frame(source)
    regions = make_parts(source)
    write_regions(regions)
    write_layout()
    write_contact(source)
    print(json.dumps({
        "background": str(FRAME.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "layout": str(LAYOUT.relative_to(ROOT)),
        "regions": len(regions),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
