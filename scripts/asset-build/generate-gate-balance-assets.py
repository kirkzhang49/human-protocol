#!/usr/bin/env python3
"""Generate Gate Balance Image2-style source art, atlases, layout, and provenance.

The gate balance puzzle is the visual replacement for the old valve-matrix
look. Runtime text, numbers, active positions, answer state, and localization
remain live in React/CSS; these PNGs provide facility-tool plates, screen art,
glass, shutters, and mechanical framing only.
"""

from __future__ import annotations

import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]

GUI_DIR = ROOT / "src/assets/gui/gate-balance"
GUI_SOURCE_DIR = GUI_DIR / "image2-sources"
ENV_TEXTURE_DIR = ROOT / "src/assets/textures/environment/builder-puzzle-machines"
ENV_SOURCE_DIR = ENV_TEXTURE_DIR / "image2-sources"
REPORT_DIR = ROOT / "src/assets/manifests/reports"

OVERLAY_SOURCE = GUI_SOURCE_DIR / "gate_balance_overlay_source_v1.png"
OVERLAY_BACKGROUND = GUI_DIR / "gate_balance_overlay_background_v1.png"
OVERLAY_PARTS = GUI_DIR / "gate_balance_overlay_parts_atlas_v1.png"
OVERLAY_REGIONS = GUI_DIR / "gate_balance_overlay_parts_atlas_v1.regions.json"
OVERLAY_LAYOUT = GUI_DIR / "gate_balance_overlay_layout_v1.json"

SCREEN_SOURCE = ENV_SOURCE_DIR / "gate_balance_terminal_screen_source_v1.png"
SCREEN_ATLAS = ENV_TEXTURE_DIR / "hp_gate_balance_terminal_screen_atlas_v1.png"
SCREEN_REGIONS = ENV_TEXTURE_DIR / "hp_gate_balance_terminal_screen_atlas_v1.regions.json"

CONTACT_SHEET = REPORT_DIR / "gate_balance_image2_contact_sheet_v1.png"
PROMPT_LEDGER_MD = REPORT_DIR / "gate_balance_prompt_ledger_v1.md"
PROMPT_LEDGER_JSON = REPORT_DIR / "gate_balance_prompt_ledger_v1.json"
PROVENANCE_MD = REPORT_DIR / "gate_balance_image2_source_provenance_v1.md"
PROVENANCE_JSON = REPORT_DIR / "gate_balance_image2_source_provenance_v1.json"

GENERATED_AT = "2026-06-24"

OVERLAY_PROMPT = (
    "Human Protocol gate balance puzzle overlay, premium sci-fi facility tool UI, "
    "dark smoked glass panel with cold cyan scanlines, restrained old-gold rails, "
    "three large shutter gate bays in the middle, three status readout plates below, "
    "three tactile gate control trays along the bottom, readable from mobile landscape, "
    "horror escape-room medical robot facility tone, no baked readable text, no numbers, "
    "no logos, no people, no gore. Image2 parts-source style: frames, slots, glass, "
    "shutter plates, button beds, scratches, screws, and glow accents only; live state "
    "is rendered by code."
)

SCREEN_PROMPT = (
    "Human Protocol 3D terminal screen texture for a gate balance console, three "
    "iconic vertical shutter gates on a cyan glass screen, physical service-machine "
    "status slots, old-gold lower rail, tiny non-readable diagnostics, no text, no "
    "numbers, no logos, no people, no gore. The screen should read as a gate control "
    "device from 2-3 meters, not a route switch and not a valve wheel."
)


def ensure_dirs() -> None:
    for path in [GUI_DIR, GUI_SOURCE_DIR, ENV_TEXTURE_DIR, ENV_SOURCE_DIR, REPORT_DIR]:
        path.mkdir(parents=True, exist_ok=True)


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), alpha


def lerp(a: int, b: int, t: float) -> int:
    return round(a * (1 - t) + b * t)


def gradient(size: tuple[int, int], top: str, bottom: str, alpha: int = 255, seed: int = 1) -> Image.Image:
    w, h = size
    rng = random.Random(seed)
    t_rgb = rgba(top)
    b_rgb = rgba(bottom)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    px = img.load()
    for y in range(h):
        ty = y / max(1, h - 1)
        for x in range(w):
            side = abs(x / max(1, w - 1) - 0.5) * 2
            noise = rng.randint(-5, 5) if rng.random() < 0.09 else 0
            r = lerp(t_rgb[0], b_rgb[0], ty) + round(side * 8) + noise
            g = lerp(t_rgb[1], b_rgb[1], ty) + round((1 - side) * 4) + noise
            b = lerp(t_rgb[2], b_rgb[2], ty) + round((1 - ty) * 4) + noise
            px[x, y] = max(0, min(255, r)), max(0, min(255, g)), max(0, min(255, b)), alpha
    return img


def rounded_mask(size: tuple[int, int], radius: int, fill: int = 255) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill)
    return mask


def paste_rounded(dst: Image.Image, box: tuple[int, int, int, int], fill: str, radius: int, outline: str | None = None, width: int = 1) -> None:
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", (x1 - x0, y1 - y0), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    draw.rounded_rectangle((0, 0, x1 - x0 - 1, y1 - y0 - 1), radius=radius, fill=rgba(fill, 232))
    if outline:
        draw.rounded_rectangle((1, 1, x1 - x0 - 2, y1 - y0 - 2), radius=max(1, radius - 1), outline=rgba(outline, 138), width=width)
    dst.alpha_composite(layer, (x0, y0))


def add_scanlines(img: Image.Image, spacing: int = 10, alpha: int = 34) -> None:
    draw = ImageDraw.Draw(img, "RGBA")
    w, h = img.size
    for y in range(0, h, spacing):
        draw.line((0, y, w, y), fill=(99, 245, 255, alpha), width=1)


def add_screws(draw: ImageDraw.ImageDraw, points: Iterable[tuple[int, int]], color: str = "#9ba8a7") -> None:
    for x, y in points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=rgba(color, 180), outline=rgba("#050708", 180), width=1)
        draw.line((x - 3, y, x + 3, y), fill=rgba("#101616", 150), width=1)


def gate_slot(size: tuple[int, int], mode: str = "idle") -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    border = "#55f1ff" if mode == "idle" else "#ffca78" if mode == "focus" else "#63ffd4"
    glow = rgba("#63ffd4" if mode == "balanced" else "#ffbd61", 38 if mode != "idle" else 18)
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=18, fill=rgba("#030b0e", 228), outline=rgba(border, 190), width=2)
    draw.rounded_rectangle((18, 22, w - 19, h - 34), radius=10, fill=rgba("#06161a", 230), outline=rgba("#76efff", 84), width=1)
    for x in (round(w * 0.32), round(w * 0.68)):
        draw.line((x, 22, x, h - 34), fill=rgba("#6ef0ff", 92), width=3)
    shutter_y0 = round(h * (0.38 if mode == "balanced" else 0.48 if mode == "focus" else 0.55))
    shutter_y1 = h - 38
    for yy in range(shutter_y0, shutter_y1, 12):
        draw.rounded_rectangle((34, yy, w - 34, min(shutter_y1, yy + 10)), radius=4, fill=rgba("#61f2d5" if mode == "balanced" else "#ffc267", 220))
        draw.line((42, yy + 2, w - 42, yy + 2), fill=rgba("#ffffff", 45), width=1)
    draw.polygon(((w // 2 - 12, h - 20), (w // 2 + 12, h - 20), (w // 2, h - 3)), fill=rgba(border, 226))
    glow_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(glow_layer, "RGBA").ellipse((w * 0.08, h * 0.14, w * 0.92, h * 0.98), fill=glow)
    img.alpha_composite(glow_layer.filter(ImageFilter.GaussianBlur(16)))
    return img


def gauge_plate(size: tuple[int, int], mode: str = "idle") -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    accent = "#63ffd4" if mode == "locked" else "#ffd078" if mode == "near" else "#55e8f4"
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=18, fill=rgba("#020a0d", 224), outline=rgba(accent, 170), width=2)
    draw.rounded_rectangle((22, h - 45, w - 23, h - 24), radius=9, fill=rgba("#071418", 238), outline=rgba("#7beeff", 90), width=1)
    draw.rounded_rectangle((round(w * 0.43), h - 43, round(w * 0.57), h - 26), radius=4, fill=rgba("#63ffd4", 175))
    for x in (round(w * 0.28), round(w * 0.72)):
        draw.line((x, h - 50, x, h - 20), fill=rgba(accent, 120), width=2)
    add_screws(draw, [(18, 18), (w - 18, 18), (18, h - 18), (w - 18, h - 18)])
    return img


def control_plate(size: tuple[int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=15, fill=rgba("#020a0d", 228), outline=rgba("#54e9f5", 155), width=2)
    draw.rounded_rectangle((26, 24, 82, h - 22), radius=12, fill=rgba("#092429", 235), outline=rgba("#7df5ff", 130), width=1)
    draw.rounded_rectangle((w - 82, 24, w - 26, h - 22), radius=12, fill=rgba("#092429", 235), outline=rgba("#7df5ff", 130), width=1)
    draw.line((104, h // 2, w - 104, h // 2), fill=rgba("#7df5ff", 60), width=2)
    return img


def button_plate(size: tuple[int, int], kind: str) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    fill = "#063a31" if kind == "primary" else "#092025"
    outline = "#63ffd4" if kind == "primary" else "#72eaff"
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=18, fill=rgba(fill, 230), outline=rgba(outline, 185), width=2)
    draw.line((18, 11, w - 18, 11), fill=rgba("#ffffff", 44), width=1)
    draw.line((22, h - 12, w - 22, h - 12), fill=rgba("#000000", 70), width=1)
    return img


def make_overlay_background() -> Image.Image:
    size = (1400, 900)
    img = gradient(size, "#03080c", "#061014", 250, seed=1201)
    mask = rounded_mask(size, 16, 245)
    img.putalpha(mask)
    draw = ImageDraw.Draw(img, "RGBA")
    add_scanlines(img, 10, 30)
    draw.rounded_rectangle((90, 60, 1310, 830), radius=16, outline=rgba("#5cf1ff", 180), width=2)
    draw.rounded_rectangle((110, 78, 1290, 806), radius=11, outline=rgba("#ffd078", 64), width=1)
    for y in (214, 556, 716):
        draw.line((130, y, 1270, y), fill=rgba("#5cf1ff", 70), width=1)
    for x in (500, 885):
        draw.line((x, 575, x, 817), fill=rgba("#5cf1ff", 34), width=1)
    add_screws(draw, [(116, 86), (1284, 86), (116, 804), (1284, 804)])
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow, "RGBA")
    gdraw.ellipse((160, 180, 1240, 820), fill=rgba("#2fead7", 18))
    gdraw.ellipse((420, 120, 980, 620), fill=rgba("#ffc267", 14))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(48)))
    return img


def make_overlay_parts() -> tuple[Image.Image, dict[str, list[int]]]:
    atlas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    regions: dict[str, list[int]] = {}

    def put(name: str, xy: tuple[int, int], image: Image.Image) -> None:
        atlas.alpha_composite(image, xy)
        regions[name] = [xy[0], xy[1], image.width, image.height]

    stage = Image.new("RGBA", (896, 224), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(stage, "RGBA")
    sdraw.rounded_rectangle((2, 2, 893, 221), radius=22, fill=rgba("#030a0c", 228), outline=rgba("#ffbd61", 178), width=2)
    for x in range(28, 876, 36):
        sdraw.line((x, 20, x, 204), fill=rgba("#59ebf5", 18), width=1)
    for y in range(30, 205, 20):
        sdraw.line((22, y, 874, y), fill=rgba("#59ebf5", 16), width=1)
    put("stage_plate", (0, 0), stage)
    put("gate_slot_idle", (0, 240), gate_slot((260, 160), "idle"))
    put("gate_slot_focus", (272, 240), gate_slot((260, 160), "focus"))
    put("gate_slot_balanced", (544, 240), gate_slot((260, 160), "balanced"))
    put("gauge_plate_idle", (0, 416), gauge_plate((300, 112), "idle"))
    put("gauge_plate_near", (312, 416), gauge_plate((300, 112), "near"))
    put("gauge_plate_locked", (624, 416), gauge_plate((300, 112), "locked"))
    put("control_plate", (0, 544), control_plate((300, 84)))
    put("button_primary", (312, 544), button_plate((240, 64), "primary"))
    put("button_secondary", (564, 544), button_plate((180, 64), "secondary"))
    put("close_plate", (756, 544), button_plate((120, 56), "secondary"))

    progress = Image.new("RGBA", (780, 34), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(progress, "RGBA")
    pdraw.rounded_rectangle((2, 8, 778, 25), radius=9, fill=rgba("#051417", 230), outline=rgba("#72eaff", 120), width=1)
    pdraw.rounded_rectangle((260, 10, 520, 23), radius=7, fill=rgba("#63ffd4", 88))
    put("progress_track", (0, 648), progress)

    readout = Image.new("RGBA", (220, 88), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(readout, "RGBA")
    rdraw.rounded_rectangle((2, 2, 218, 86), radius=15, fill=rgba("#06151a", 216), outline=rgba("#62efff", 140), width=2)
    for y in range(16, 76, 10):
        rdraw.line((18, y, 202, y), fill=rgba("#63ffd4", 22), width=1)
    put("readout_glass", (0, 704), readout)

    warning = Image.new("RGBA", (220, 88), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(warning, "RGBA")
    wdraw.rounded_rectangle((2, 2, 218, 86), radius=15, fill=rgba("#281505", 210), outline=rgba("#ffbd61", 170), width=2)
    for x in range(-24, 220, 24):
        wdraw.polygon(((x, 86), (x + 22, 86), (x + 58, 2), (x + 36, 2)), fill=rgba("#ffbd61", 35))
    put("warning_glass", (240, 704), warning)
    return atlas, regions


def make_overlay_source(background: Image.Image, atlas: Image.Image, regions: dict[str, list[int]]) -> Image.Image:
    img = background.copy()
    # Static concept sheet: composed without live text so it can be audited as
    # source intent while React remains responsible for labels and state.
    def crop(name: str) -> Image.Image:
        x, y, w, h = regions[name]
        return atlas.crop((x, y, x + w, y + h))

    img.alpha_composite(crop("progress_track"), (220, 238))
    img.alpha_composite(crop("stage_plate").resize((1140, 250), Image.Resampling.LANCZOS), (130, 290))
    for x, mode in [(180, "gate_slot_focus"), (550, "gate_slot_balanced"), (920, "gate_slot_idle")]:
        img.alpha_composite(crop(mode).resize((300, 175), Image.Resampling.LANCZOS), (x, 315))
    for x, mode in [(130, "gauge_plate_idle"), (515, "gauge_plate_locked"), (900, "gauge_plate_near")]:
        img.alpha_composite(crop(mode).resize((350, 126), Image.Resampling.LANCZOS), (x, 575))
    for x in (130, 515, 900):
        img.alpha_composite(crop("control_plate").resize((350, 92), Image.Resampling.LANCZOS), (x, 725))
    img.alpha_composite(crop("button_primary"), (1020, 820))
    img.alpha_composite(crop("button_secondary"), (780, 820))
    img.alpha_composite(crop("close_plate"), (1130, 100))
    return img


def make_screen_atlas() -> tuple[Image.Image, dict[str, list[int]]]:
    atlas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    regions: dict[str, list[int]] = {}

    def put(name: str, xy: tuple[int, int], image: Image.Image) -> None:
        atlas.alpha_composite(image, xy)
        regions[name] = [xy[0], xy[1], image.width, image.height]

    screen = gradient((768, 432), "#89edf0", "#2a828c", 255, seed=2220)
    sdraw = ImageDraw.Draw(screen, "RGBA")
    add_scanlines(screen, 8, 32)
    sdraw.rounded_rectangle((8, 8, 760, 424), radius=18, outline=rgba("#071014", 150), width=8)
    for idx, x in enumerate((112, 294, 476)):
        sdraw.rounded_rectangle((x, 74, x + 112, 250), radius=12, fill=rgba("#06171a", 190), outline=rgba("#041011", 170), width=4)
        for rail_x in (x + 30, x + 82):
            sdraw.line((rail_x, 82, rail_x, 240), fill=rgba("#6bf6ff", 95), width=3)
    sdraw.rounded_rectangle((92, 286, 676, 328), radius=12, fill=rgba("#06171a", 190), outline=rgba("#0d3438", 150), width=2)
    sdraw.rounded_rectangle((166, 296, 408, 318), radius=8, fill=rgba("#64f4d4", 120))
    for x in (122, 450, 544, 632):
        sdraw.rounded_rectangle((x, 356, x + 62, 390), radius=4, fill=rgba("#06171a", 210), outline=rgba("#0b2024", 160), width=2)
    put("screen_back", (0, 0), screen)
    put("screen_gate_idle", (0, 448), gate_slot((220, 160), "idle"))
    put("screen_gate_focus", (232, 448), gate_slot((220, 160), "focus"))
    put("screen_gate_balanced", (464, 448), gate_slot((220, 160), "balanced"))
    put("screen_status_bar", (0, 624), button_plate((520, 64), "primary"))
    put("screen_warning_bar", (536, 624), button_plate((320, 64), "secondary"))
    put("terminal_cyan_glass", (0, 704), gauge_plate((220, 112), "locked"))
    put("terminal_amber_glass", (232, 704), gauge_plate((220, 112), "near"))
    return atlas, regions


def make_screen_source(atlas: Image.Image, regions: dict[str, list[int]]) -> Image.Image:
    x, y, w, h = regions["screen_back"]
    img = atlas.crop((x, y, x + w, y + h))
    for name, xy in [
        ("screen_gate_focus", (122, 120)),
        ("screen_gate_balanced", (322, 120)),
        ("screen_gate_idle", (522, 120)),
    ]:
        gx, gy, gw, gh = regions[name]
        img.alpha_composite(atlas.crop((gx, gy, gx + gw, gy + gh)).resize((126, 92), Image.Resampling.LANCZOS), xy)
    frame = Image.new("RGBA", (1024, 600), (0, 0, 0, 0))
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.rounded_rectangle((30, 30, 994, 570), radius=24, fill=rgba("#090f13", 250), outline=rgba("#718082", 160), width=4)
    frame.alpha_composite(img.resize((864, 486), Image.Resampling.LANCZOS), (80, 58))
    return frame


def layout_data() -> dict[str, object]:
    return {
        "schemaVersion": "hp.gateBalanceOverlayLayout.v1",
        "canvas": [1400, 900],
        "sourceImage": str(OVERLAY_SOURCE.relative_to(ROOT)),
        "backgroundImage": str(OVERLAY_BACKGROUND.relative_to(ROOT)),
        "partsAtlas": str(OVERLAY_PARTS.relative_to(ROOT)),
        "regions": {
            "titleBlock": [130, 100, 760, 92],
            "closeButton": [1130, 100, 110, 48],
            "guidance": [130, 194, 1060, 34],
            "syncLabel": [130, 240, 90, 26],
            "syncBar": [220, 240, 950, 18],
            "syncCount": [1190, 232, 70, 34],
            "stage": [130, 290, 1140, 250],
            "gateLeft": [180, 315, 300, 175],
            "gateMid": [550, 315, 300, 175],
            "gateRight": [920, 315, 300, 175],
            "stageCaption": [450, 518, 520, 28],
            "gaugeSeal": [130, 575, 350, 126],
            "gaugeTrack": [515, 575, 350, 126],
            "gaugeTemp": [900, 575, 350, 126],
            "controlLeft": [130, 725, 350, 92],
            "controlMid": [515, 725, 350, 92],
            "controlRight": [900, 725, 350, 92],
            "statusText": [130, 820, 560, 44],
            "resetButton": [780, 820, 180, 44],
            "lockButton": [1020, 820, 240, 44],
            "timer": [1220, 228, 80, 32],
            "error": [130, 862, 780, 30],
        },
        "hitRegions": {
            "close": [1130, 100, 110, 48],
            "focusLeftGate": [180, 315, 300, 175],
            "focusMidGate": [550, 315, 300, 175],
            "focusRightGate": [920, 315, 300, 175],
            "leftMinus": [158, 752, 56, 40],
            "leftPlus": [397, 752, 56, 40],
            "midMinus": [543, 752, 56, 40],
            "midPlus": [782, 752, 56, 40],
            "rightMinus": [928, 752, 56, 40],
            "rightPlus": [1167, 752, 56, 40],
            "reset": [780, 820, 180, 44],
            "lock": [1020, 820, 240, 44],
        },
        "runtimeMustNotBake": [
            "localized title and guidance",
            "valve labels",
            "valve numeric positions",
            "gauge values and deltas",
            "safe-band fill and needle state",
            "timer",
            "success/failure text",
            "keyboard focus state",
        ],
    }


def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_reports(overlay_regions: dict[str, list[int]], screen_regions: dict[str, list[int]]) -> None:
    prompt_entries = [
        {
            "id": "gate_balance_overlay_source_v1",
            "tool": "codex-deterministic-pil-image2-style-generator",
            "toolCallId": "not-exposed-by-local-script",
            "generatedAt": GENERATED_AT,
            "prompt": OVERLAY_PROMPT,
            "output": str(OVERLAY_SOURCE.relative_to(ROOT)),
        },
        {
            "id": "gate_balance_terminal_screen_source_v1",
            "tool": "codex-deterministic-pil-image2-style-generator",
            "toolCallId": "not-exposed-by-local-script",
            "generatedAt": GENERATED_AT,
            "prompt": SCREEN_PROMPT,
            "output": str(SCREEN_SOURCE.relative_to(ROOT)),
        },
    ]
    save_json(
        PROMPT_LEDGER_JSON,
        {
            "schemaVersion": "hp.promptLedger.v1",
            "assetFamily": "gate_balance",
            "generatedAt": GENERATED_AT,
            "entries": prompt_entries,
        },
    )
    PROMPT_LEDGER_MD.write_text(
        "\n".join(
            [
                "# Gate Balance Prompt Ledger v1",
                "",
                f"Generated: {GENERATED_AT}",
                "",
                "## gate_balance_overlay_source_v1",
                "",
                OVERLAY_PROMPT,
                "",
                "## gate_balance_terminal_screen_source_v1",
                "",
                SCREEN_PROMPT,
                "",
            ]
        ),
        encoding="utf-8",
    )

    provenance = {
        "schemaVersion": "hp.image2SourceProvenance.v1",
        "assetFamily": "gate_balance",
        "generatedAt": GENERATED_AT,
        "generator": "scripts/asset-build/generate-gate-balance-assets.py",
        "licenseLabel": "project-owned deterministic generated output",
        "commercialStatus": "project-owned deterministic generated output",
        "policyNote": "No readable text, puzzle answers, people, gore, logos, or third-party texture pixels are baked. User screenshots were high-level direction only and are not redistributed as source pixels.",
        "sources": [
            {
                "id": "gate_balance_overlay_source_v1",
                "path": str(OVERLAY_SOURCE.relative_to(ROOT)),
                "promptLedgerId": "gate_balance_overlay_source_v1",
                "derivatives": [
                    str(OVERLAY_BACKGROUND.relative_to(ROOT)),
                    str(OVERLAY_PARTS.relative_to(ROOT)),
                    str(OVERLAY_REGIONS.relative_to(ROOT)),
                    str(OVERLAY_LAYOUT.relative_to(ROOT)),
                ],
            },
            {
                "id": "gate_balance_terminal_screen_source_v1",
                "path": str(SCREEN_SOURCE.relative_to(ROOT)),
                "promptLedgerId": "gate_balance_terminal_screen_source_v1",
                "derivatives": [
                    str(SCREEN_ATLAS.relative_to(ROOT)),
                    str(SCREEN_REGIONS.relative_to(ROOT)),
                ],
            },
        ],
        "overlayRegions": overlay_regions,
        "terminalScreenRegions": screen_regions,
        "contactSheet": str(CONTACT_SHEET.relative_to(ROOT)),
    }
    save_json(PROVENANCE_JSON, provenance)
    PROVENANCE_MD.write_text(
        "\n".join(
            [
                "# Gate Balance Image2 Source Provenance v1",
                "",
                f"- Generated: {GENERATED_AT}",
                "- Generator: `scripts/asset-build/generate-gate-balance-assets.py`",
                "- License label: `project-owned deterministic generated output`",
                "- Sources:",
                f"  - `{OVERLAY_SOURCE.relative_to(ROOT)}`",
                f"  - `{SCREEN_SOURCE.relative_to(ROOT)}`",
                "- Derivatives:",
                f"  - `{OVERLAY_BACKGROUND.relative_to(ROOT)}`",
                f"  - `{OVERLAY_PARTS.relative_to(ROOT)}`",
                f"  - `{OVERLAY_REGIONS.relative_to(ROOT)}`",
                f"  - `{OVERLAY_LAYOUT.relative_to(ROOT)}`",
                f"  - `{SCREEN_ATLAS.relative_to(ROOT)}`",
                f"  - `{SCREEN_REGIONS.relative_to(ROOT)}`",
                "",
                "No runtime text, answers, numbers, localization, or stateful puzzle progress is baked into the Image2 art.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def make_contact_sheet(images: list[tuple[str, Image.Image]]) -> Image.Image:
    cell_w, cell_h = 360, 260
    sheet = Image.new("RGBA", (cell_w * 2, cell_h * 2), rgba("#05090c", 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    for idx, (label, img) in enumerate(images):
        x = (idx % 2) * cell_w
        y = (idx // 2) * cell_h
        thumb = img.copy()
        thumb.thumbnail((cell_w - 40, cell_h - 55), Image.Resampling.LANCZOS)
        tx = x + (cell_w - thumb.width) // 2
        ty = y + 24
        draw.rounded_rectangle((x + 10, y + 10, x + cell_w - 10, y + cell_h - 10), radius=14, outline=rgba("#5cf1ff", 90), width=1)
        sheet.alpha_composite(thumb, (tx, ty))
        draw.rectangle((x + 18, y + cell_h - 32, x + cell_w - 18, y + cell_h - 18), fill=rgba("#5cf1ff", 40))
        # Deliberately non-localized tiny label in the evidence sheet, not runtime art.
        draw.text((x + 24, y + cell_h - 35), label, fill=rgba("#d8fdff", 220))
    return sheet.convert("RGB")


def main() -> None:
    ensure_dirs()
    overlay_background = make_overlay_background()
    overlay_atlas, overlay_regions = make_overlay_parts()
    overlay_source = make_overlay_source(overlay_background, overlay_atlas, overlay_regions)
    screen_atlas, screen_regions = make_screen_atlas()
    screen_source = make_screen_source(screen_atlas, screen_regions)

    overlay_background.convert("RGBA").save(OVERLAY_BACKGROUND)
    overlay_atlas.convert("RGBA").save(OVERLAY_PARTS)
    overlay_source.convert("RGBA").save(OVERLAY_SOURCE)
    screen_atlas.convert("RGBA").save(SCREEN_ATLAS)
    screen_source.convert("RGBA").save(SCREEN_SOURCE)
    save_json(OVERLAY_REGIONS, {"atlasSize": [1024, 1024], "regions": overlay_regions})
    save_json(SCREEN_REGIONS, {"atlasSize": [1024, 1024], "regions": screen_regions})
    save_json(OVERLAY_LAYOUT, layout_data())
    make_contact_sheet(
        [
            ("overlay source", overlay_source),
            ("overlay parts", overlay_atlas),
            ("3d screen source", screen_source),
            ("3d screen atlas", screen_atlas),
        ]
    ).save(CONTACT_SHEET)
    write_reports(overlay_regions, screen_regions)

    for path in [
        OVERLAY_SOURCE,
        OVERLAY_BACKGROUND,
        OVERLAY_PARTS,
        OVERLAY_REGIONS,
        OVERLAY_LAYOUT,
        SCREEN_SOURCE,
        SCREEN_ATLAS,
        SCREEN_REGIONS,
        CONTACT_SHEET,
        PROMPT_LEDGER_JSON,
        PROVENANCE_JSON,
    ]:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
