#!/usr/bin/env python3
"""Ingest the real Image2 three-row gate-balance GUI kit.

The two source PNGs use a flat green chroma background:

- frame source: a complete three-row console frame with transparent row holes
- parts source: separated reusable buttons, row shells, progress rail, handle

The runtime puzzle stays live DOM. Localized text, numbers, target bands,
needles, fills, button glyphs, timer, and success/failure state are not baked.
"""

from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[2]
GUI_DIR = ROOT / "src/assets/gui/gate-balance-three-row"
SRC_DIR = GUI_DIR / "image2-sources"
REPORT_DIR = ROOT / "src/assets/manifests/reports"

PARTS_SOURCE = SRC_DIR / "gate_balance_three_row_parts_image2_source_v1_chromakey.png"
FRAME_SOURCE = SRC_DIR / "gate_balance_three_row_frame_image2_source_v1_chromakey.png"
SOURCE_PREVIEW = SRC_DIR / "gate_balance_three_row_image2_source_v1.png"
FRAME = GUI_DIR / "gate_balance_three_row_frame_image2_v1.png"
PARTS = GUI_DIR / "gate_balance_three_row_parts_image2_v1.png"
REGIONS = GUI_DIR / "gate_balance_three_row_parts_image2_v1.regions.json"
LAYOUT = GUI_DIR / "gate_balance_three_row_layout_v1.json"
CONTACT = REPORT_DIR / "gate_balance_three_row_image2_contact_sheet_v1.png"
PROMPTS_JSON = REPORT_DIR / "gate_balance_three_row_gui_image2_prompt_ledger_v1.json"
PROMPTS_MD = REPORT_DIR / "gate_balance_three_row_gui_image2_prompt_ledger_v1.md"
PROVENANCE_JSON = REPORT_DIR / "gate_balance_three_row_gui_image2_source_provenance_v1.json"
PROVENANCE_MD = REPORT_DIR / "gate_balance_three_row_gui_image2_source_provenance_v1.md"

SOURCE_CANVAS = [1200, 560]
# The Image2 frame source includes a transparent safety margin. The runtime
# canvas starts at the visible metal frame, so DOM coordinates do not drift
# against a hidden matte.
FRAME_CROP = (46, 25, 1174, 515)
CANVAS = [FRAME_CROP[2] - FRAME_CROP[0], FRAME_CROP[3] - FRAME_CROP[1]]
ATLAS = [1536, 1024]
PADDING = 10


def font(size: int) -> ImageFont.ImageFont:
    for candidate in [
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
    ]:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            pass
    return ImageFont.load_default()


def is_green(pixel: tuple[int, int, int]) -> bool:
    r, g, b = pixel
    return g > 145 and r < 95 and b < 95 and g > r * 1.65 and g > b * 1.65


def chroma_to_alpha(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    out = Image.new("RGBA", rgb.size)
    src = rgb.load()
    dst = out.load()
    width, height = rgb.size
    for y in range(height):
        for x in range(width):
            r, g, b = src[x, y]
            if is_green((r, g, b)):
                dst[x, y] = (0, 0, 0, 0)
            else:
                dst[x, y] = (r, g, b, 255)
    return out


def component_boxes(image: Image.Image) -> list[tuple[int, int, int, int, int]]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pix = rgb.load()
    seen = bytearray(width * height)
    boxes: list[tuple[int, int, int, int, int]] = []

    def foreground(px: int, py: int) -> bool:
        return not is_green(pix[px, py])

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if seen[index]:
                continue
            seen[index] = 1
            if not foreground(x, y):
                continue
            q: deque[tuple[int, int]] = deque([(x, y)])
            min_x = max_x = x
            min_y = max_y = y
            count = 0
            while q:
                cx, cy = q.pop()
                count += 1
                min_x = min(min_x, cx)
                max_x = max(max_x, cx)
                min_y = min(min_y, cy)
                max_y = max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nindex = ny * width + nx
                    if seen[nindex]:
                        continue
                    seen[nindex] = 1
                    if foreground(nx, ny):
                        q.append((nx, ny))
            if count > 500:
                boxes.append((min_x, min_y, max_x + 1, max_y + 1, count))
    return sorted(boxes, key=lambda box: (box[1], box[0]))


def padded_crop(image: Image.Image, box: tuple[int, int, int, int, int], padding: int = PADDING) -> Image.Image:
    x0, y0, x1, y1, _ = box
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(image.width, x1 + padding)
    y1 = min(image.height, y1 + padding)
    return image.crop((x0, y0, x1, y1))


def fit_to_width(part: Image.Image, width: int) -> Image.Image:
    if part.width == width:
        return part
    height = max(1, round(part.height * width / part.width))
    return part.resize((width, height), Image.Resampling.LANCZOS)


def fit_to_size(part: Image.Image, size: tuple[int, int]) -> Image.Image:
    return part.resize(size, Image.Resampling.LANCZOS)


def build_parts() -> tuple[Image.Image, dict[str, list[int]], dict[str, tuple[int, int, int, int, int]]]:
    source_rgb = Image.open(PARTS_SOURCE).convert("RGB")
    transparent = chroma_to_alpha(source_rgb)
    boxes = component_boxes(source_rgb)
    if len(boxes) < 12:
        raise RuntimeError(f"Expected at least 12 isolated GUI parts in {PARTS_SOURCE}, got {len(boxes)}.")

    # Source order is authored in the prompt: long readout, control row, three
    # square states, four wide buttons, close, handle, progress rail.
    source_map = {
        "readout_shell": boxes[0],
        "control_shell": boxes[1],
        "button_idle": boxes[2],
        "button_pressed": boxes[3],
        "button_disabled": boxes[4],
        "lock_ready": boxes[5],
        "lock_success": boxes[6],
        "reset_idle": boxes[7],
        "lock_disabled": boxes[8],
        "close": boxes[9],
        "slider_handle": boxes[10],
        "progress_track": boxes[11],
    }

    crops = {name: padded_crop(transparent, box) for name, box in source_map.items()}
    parts: dict[str, Image.Image] = {
        "gauge_shell_idle": fit_to_width(crops["readout_shell"], 620),
        "gauge_shell_near": fit_to_width(crops["readout_shell"], 620),
        "gauge_shell_locked": fit_to_width(crops["readout_shell"], 620),
        "gauge_shell_danger": fit_to_width(crops["readout_shell"], 620),
        "control_shell_idle": fit_to_width(crops["control_shell"], 470),
        "control_shell_focused": fit_to_width(crops["control_shell"], 470),
        "control_shell_locked": fit_to_width(crops["control_shell"], 470),
        "button_idle": fit_to_size(crops["button_idle"], (50, 44)),
        "button_pressed": fit_to_size(crops["button_pressed"], (50, 44)),
        "button_disabled": fit_to_size(crops["button_disabled"], (50, 44)),
        "button_focused": fit_to_size(crops["button_pressed"], (50, 44)),
        "lock_button_disabled": fit_to_size(crops["lock_disabled"], (232, 52)),
        "lock_button_ready": fit_to_size(crops["lock_ready"], (232, 52)),
        "lock_button_pressed": fit_to_size(crops["lock_success"], (232, 52)),
        "lock_button_success": fit_to_size(crops["lock_success"], (232, 52)),
        "reset_button_idle": fit_to_size(crops["reset_idle"], (148, 52)),
        "reset_button_pressed": fit_to_size(crops["lock_success"], (148, 52)),
        "close_button_idle": fit_to_size(crops["close"], (44, 44)),
        "close_button_pressed": fit_to_size(crops["close"], (44, 44)),
        "progress_track": fit_to_size(crops["progress_track"], (820, 18)),
        "slider_handle_idle": fit_to_size(crops["slider_handle"], (30, 38)),
        "slider_handle_dragging": fit_to_size(crops["slider_handle"], (30, 38)),
        "slider_handle_locked": fit_to_size(crops["slider_handle"], (30, 38)),
    }

    atlas = Image.new("RGBA", tuple(ATLAS), (0, 0, 0, 0))
    regions: dict[str, list[int]] = {}
    x = 0
    y = 0
    row_h = 0
    for name, part in parts.items():
        if x + part.width > ATLAS[0]:
            x = 0
            y += row_h + 18
            row_h = 0
        if y + part.height > ATLAS[1]:
            raise RuntimeError(f"Parts atlas overflow while placing {name}.")
        atlas.alpha_composite(part, (x, y))
        regions[name] = [x, y, part.width, part.height]
        x += part.width + 18
        row_h = max(row_h, part.height)
    return atlas, regions, source_map


def build_frame() -> Image.Image:
    source = Image.open(FRAME_SOURCE).convert("RGB")
    full_frame = chroma_to_alpha(source).resize(tuple(SOURCE_CANVAS), Image.Resampling.LANCZOS)
    return full_frame.crop(FRAME_CROP)


def frame_rect(rect: list[int]) -> list[int]:
    x, y, w, h = rect
    return [x - FRAME_CROP[0], y - FRAME_CROP[1], w, h]


LAYOUT_REGIONS = {
    "titleBlock": frame_rect([204, 54, 678, 42]),
    "closeButton": frame_rect([1130, 34, 44, 44]),
    "guidance": frame_rect([94, 112, 1014, 24]),
    "syncLabel": frame_rect([84, 452, 82, 24]),
    "syncBar": frame_rect([170, 461, 420, 12]),
    "syncCount": frame_rect([724, 446, 82, 36]),
    "timer": frame_rect([820, 446, 76, 36]),
    "row0Gauge": frame_rect([96, 112, 620, 93]),
    "row0Control": frame_rect([684, 130, 470, 63]),
    "row1Gauge": frame_rect([96, 218, 620, 93]),
    "row1Control": frame_rect([684, 236, 470, 63]),
    "row2Gauge": frame_rect([96, 322, 620, 93]),
    "row2Control": frame_rect([684, 340, 470, 63]),
    "statusText": frame_rect([84, 492, 430, 24]),
    "error": frame_rect([522, 452, 180, 24]),
    "resetButton": frame_rect([632, 432, 148, 52]),
    "lockButton": frame_rect([813, 432, 251, 52]),
    "countdownText": frame_rect([620, 438, 148, 52]),
    "lockButtonText": frame_rect([801, 438, 251, 52]),
}


def local_rect(parent: str, name: str, rect: list[int]) -> None:
    px, py, _, _ = LAYOUT_REGIONS[parent]
    x, y, w, h = rect
    LAYOUT_REGIONS[name] = [px + x, py + y, w, h]


for row in range(3):
    gauge = f"row{row}Gauge"
    control = f"row{row}Control"
    local_rect(gauge, f"row{row}GaugeLabel", [56, 22, 172, 22])
    local_rect(gauge, f"row{row}GaugeBadge", [505, 17, 76, 24])
    local_rect(gauge, f"row{row}GaugeBar", [40, 54, 540, 10])
    local_rect(gauge, f"row{row}GaugeValue", [56, 68, 192, 18])
    local_rect(control, f"row{row}ControlLabel", [30, 2, 88, 16])
    local_rect(control, f"row{row}ControlMinus", [31, 10, 50, 44])
    local_rect(control, f"row{row}ControlValue", [126, 11, 230, 40])
    local_rect(control, f"row{row}ControlPlus", [389, 10, 50, 44])
    local_rect(control, f"row{row}ControlTrack", [128, 56, 228, 8])
    local_rect(control, f"row{row}ControlFill", [128, 56, 228, 8])
    local_rect(control, f"row{row}ControlHandle", [0, 0, 30, 38])


def write_layout() -> None:
    payload = {
        "schemaVersion": "hp.gateBalance.threeRow.image2Layout.v1",
        "canvas": CANVAS,
        "composition": "real-image2-frame-plus-transparent-parts",
        "background": str(FRAME.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "regionsFile": str(REGIONS.relative_to(ROOT)),
        "sourceImages": [
            str(FRAME_SOURCE.relative_to(ROOT)),
            str(PARTS_SOURCE.relative_to(ROOT)),
        ],
        "regions": LAYOUT_REGIONS,
        "rows": [
            {
                "gauge": f"row{row}Gauge",
                "control": f"row{row}Control",
                "slots": {
                    "gaugeLabel": f"row{row}GaugeLabel",
                    "gaugeBadge": f"row{row}GaugeBadge",
                    "gaugeBar": f"row{row}GaugeBar",
                    "gaugeValue": f"row{row}GaugeValue",
                    "controlLabel": f"row{row}ControlLabel",
                    "minus": f"row{row}ControlMinus",
                    "value": f"row{row}ControlValue",
                    "plus": f"row{row}ControlPlus",
                    "controlTrack": f"row{row}ControlTrack",
                    "controlFill": f"row{row}ControlFill",
                    "handle": f"row{row}ControlHandle",
                },
            }
            for row in range(3)
        ],
        "runtimeMustNotBake": [
            "localized title and guidance",
            "gauge labels, values, target deltas, and stable badges",
            "valve labels and valve numeric positions",
            "button glyphs, button text, timer, status, and failure copy",
            "dynamic gauge bands, needles, control fills, and drag handles",
        ],
    }
    LAYOUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_regions(regions: dict[str, list[int]]) -> None:
    payload = {
        "schemaVersion": "hp.image2.gui.regions.v1",
        "atlasSize": ATLAS,
        "backgroundSize": CANVAS,
        "source": str(PARTS_SOURCE.relative_to(ROOT)),
        "background": str(FRAME.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "regions": regions,
        "stateRegions": {
            "active": ["gauge_shell_idle", "control_shell_idle", "button_idle", "progress_track"],
            "choice": ["control_shell_focused", "button_focused", "slider_handle_dragging"],
            "solved": ["gauge_shell_locked", "control_shell_locked", "lock_button_success"],
            "disabled": ["button_disabled", "lock_button_disabled"],
            "danger": ["gauge_shell_danger"],
        },
        "notes": "Real Image2 transparent parts. Text and all values are live runtime layers.",
    }
    REGIONS.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def make_preview(frame: Image.Image, atlas: Image.Image, regions: dict[str, list[int]]) -> Image.Image:
    preview = frame.copy()
    for row in range(3):
        gauge_rect = LAYOUT_REGIONS[f"row{row}Gauge"]
        control_rect = LAYOUT_REGIONS[f"row{row}Control"]
        gauge_part = "gauge_shell_locked" if row == 1 else "gauge_shell_idle"
        control_part = "control_shell_focused" if row == 1 else "control_shell_idle"
        preview.alpha_composite(crop(atlas, regions[gauge_part]).resize((gauge_rect[2], gauge_rect[3]), Image.Resampling.LANCZOS), (gauge_rect[0], gauge_rect[1]))
        preview.alpha_composite(crop(atlas, regions[control_part]).resize((control_rect[2], control_rect[3]), Image.Resampling.LANCZOS), (control_rect[0], control_rect[1]))
        for key in [f"row{row}ControlMinus", f"row{row}ControlPlus"]:
            rect = LAYOUT_REGIONS[key]
            preview.alpha_composite(crop(atlas, regions["button_idle"]).resize((rect[2], rect[3]), Image.Resampling.LANCZOS), (rect[0], rect[1]))
    for region_name, rect_name in [
        ("close_button_idle", "closeButton"),
        ("progress_track", "syncBar"),
    ]:
        rect = LAYOUT_REGIONS[rect_name]
        preview.alpha_composite(crop(atlas, regions[region_name]).resize((rect[2], rect[3]), Image.Resampling.LANCZOS), (rect[0], rect[1]))
    return preview


def crop(image: Image.Image, rect: list[int]) -> Image.Image:
    x, y, w, h = rect
    return image.crop((x, y, x + w, y + h))


def write_contact(frame: Image.Image, atlas: Image.Image, preview: Image.Image, source_boxes: dict[str, tuple[int, int, int, int, int]]) -> None:
    sheet = Image.new("RGBA", (1600, 1320), (3, 8, 10, 255))
    d = ImageDraw.Draw(sheet, "RGBA")
    sheet.alpha_composite(preview, (40, 54))
    sheet.alpha_composite(frame, (40, 650))
    sheet.alpha_composite(atlas.crop((0, 0, 1536, 520)), (40, 985))
    audit = preview.copy()
    od = ImageDraw.Draw(audit, "RGBA")
    for name, rect in LAYOUT_REGIONS.items():
        x, y, w, h = rect
        if "row" in name or name in {"titleBlock", "syncBar", "lockButton", "lockButtonText", "resetButton", "countdownText", "closeButton"}:
            od.rectangle((x, y, x + w, y + h), outline=(255, 210, 90, 170), width=1)
    audit_h = round(600 * CANVAS[1] / CANVAS[0])
    sheet.alpha_composite(audit.resize((600, audit_h), Image.Resampling.LANCZOS), (960, 650))
    d.text((40, 24), "real Image2 source preview: frame + separated parts, no baked game text", font=font(22), fill=(226, 249, 250, 255))
    d.text((40, 624), "runtime transparent frame", font=font(18), fill=(226, 249, 250, 255))
    d.text((960, 624), "live layout slot audit", font=font(18), fill=(226, 249, 250, 255))
    d.text((40, 958), "transparent parts atlas from real Image2 source", font=font(18), fill=(226, 249, 250, 255))
    x = 1120
    y = 54
    d.text((x, y), "source components", font=font(16), fill=(255, 216, 154, 255))
    for index, (name, box) in enumerate(source_boxes.items()):
        _, _, _, _, count = box
        d.text((x, y + 24 + index * 18), f"{name}: {count}px", font=font(12), fill=(186, 239, 244, 220))
    CONTACT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(CONTACT)


def write_ledgers(source_boxes: dict[str, tuple[int, int, int, int, int]]) -> None:
    component_boxes_payload = {
        name: [box[0], box[1], box[2] - box[0], box[3] - box[1]]
        for name, box in source_boxes.items()
    }
    prompt_payload = {
        "schemaVersion": "hp.image2.promptLedger.v1",
        "family": "gate_balance_three_row_gui",
        "createdBy": "OpenAI/Codex Image2 source images ingested into repo-local runtime atlas",
        "modelPrompt": {
            "intent": "Human Protocol sci-fi three-row gate balance puzzle GUI skin pack",
            "negative": "no baked Chinese text, no numbers, no plus/minus glyphs, no full poster UI as runtime logic",
            "parts": [
                "main frame with empty title, three row holes, status strip, reset and lock plates",
                "separated reusable readout shell, valve-control shell, button states, lock/reset plates, close plate, slider handle, progress track",
            ],
        },
        "layoutPolicy": f"{CANVAS[0]}x{CANVAS[1]} px cropped visible-frame canvas; every live label/value/control uses named pixel slots in gate_balance_three_row_layout_v1.json.",
        "sourceComponentBoxes": component_boxes_payload,
    }
    provenance_payload = {
        "schemaVersion": "hp.image2.provenance.v1",
        "family": "gate_balance_three_row_gui",
        "license": "openai-generated-output-user-owned-subject-to-openai-terms",
        "classification": "owned-generated-output",
        "sourceKind": "OpenAI/Codex Image2 bitmap source",
        "sourceFiles": [
            str(FRAME_SOURCE.relative_to(ROOT)),
            str(PARTS_SOURCE.relative_to(ROOT)),
            str(SOURCE_PREVIEW.relative_to(ROOT)),
            str(FRAME.relative_to(ROOT)),
            str(PARTS.relative_to(ROOT)),
            str(REGIONS.relative_to(ROOT)),
            str(LAYOUT.relative_to(ROOT)),
        ],
        "script": str(Path(__file__).relative_to(ROOT)),
        "generatorCallId": "not-exposed-by-codex-imagegen-user-provided-clipboard-source",
        "runtimePolicy": "Do not bake localized strings, live values, button glyphs, or interaction state into image files.",
    }
    PROMPTS_JSON.write_text(json.dumps(prompt_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROVENANCE_JSON.write_text(json.dumps(provenance_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROMPTS_MD.write_text(
        "# Gate Balance Three-Row GUI Prompt Ledger v1\n\n"
        "- Intent: Human Protocol sci-fi three-row gate-balance puzzle GUI skin pack.\n"
        "- Source: two real Image2 chroma-key PNGs provided in this Codex thread.\n"
        "- Negative: no baked Chinese text, no numbers, no plus/minus glyphs, no full poster UI as runtime logic.\n"
        "- Parts: frame, readout shell, control shell, button states, lock/reset states, close plate, progress track, drag handle.\n"
        f"- Layout: all live UI uses cropped `{CANVAS[0]}x{CANVAS[1]}` named pixel slots from `gate_balance_three_row_layout_v1.json`.\n",
        encoding="utf-8",
    )
    PROVENANCE_MD.write_text(
        "# Gate Balance Three-Row GUI Provenance v1\n\n"
        "- Source kind: OpenAI/Codex Image2 bitmap sources supplied by user clipboard images.\n"
        f"- Frame source: `{FRAME_SOURCE.relative_to(ROOT)}`.\n"
        f"- Parts source: `{PARTS_SOURCE.relative_to(ROOT)}`.\n"
        f"- Script: `{Path(__file__).relative_to(ROOT)}`.\n"
        "- License label: `openai-generated-output-user-owned-subject-to-openai-terms`.\n"
        "- Runtime policy: text, numbers, gauge values, fills, handles, button glyphs, timer, and puzzle state stay live.\n",
        encoding="utf-8",
    )


def main() -> None:
    GUI_DIR.mkdir(parents=True, exist_ok=True)
    SRC_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if not PARTS_SOURCE.exists():
        raise FileNotFoundError(f"Missing parts source: {PARTS_SOURCE}")
    if not FRAME_SOURCE.exists():
        raise FileNotFoundError(f"Missing frame source: {FRAME_SOURCE}")

    frame = build_frame()
    atlas, regions, source_boxes = build_parts()
    preview = make_preview(frame, atlas, regions)

    frame.save(FRAME)
    atlas.save(PARTS)
    preview.save(SOURCE_PREVIEW)
    write_layout()
    write_regions(regions)
    write_ledgers(source_boxes)
    write_contact(frame, atlas, preview, source_boxes)

    print(json.dumps({
        "frame": str(FRAME.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "layout": str(LAYOUT.relative_to(ROOT)),
        "contact": str(CONTACT.relative_to(ROOT)),
        "sourceComponents": len(source_boxes),
        "regions": len(regions),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
