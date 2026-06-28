#!/usr/bin/env python3
"""Ingest the real Image2 gate-balance GUI source into runtime-ready assets.

This script does not generate the source artwork. It records and cuts the
Image2/Codex-generated source PNG into the Human Protocol GUI contract:
source evidence, background, sprite atlas, pixel layout, contact sheet, and
provenance. React keeps live text, numbers, localization, and state.
"""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
THREAD_ID = "019efa53-6ca6-78d3-a5b2-2824ea0b1627"
DEFAULT_GENERATED_SOURCE = Path(
    "/Users/zhengkaizhang/.codex/generated_images/"
    f"{THREAD_ID}/ig_02e06c5886453cba016a3c1af25ca881998ebd8eca311b032b.png"
)

GUI_DIR = ROOT / "src/assets/gui/gate-balance"
GUI_SOURCE_DIR = GUI_DIR / "image2-sources"
REPORT_DIR = ROOT / "src/assets/manifests/reports"

SOURCE_ORIGINAL = GUI_SOURCE_DIR / "gate_balance_overlay_image2_source_v2_original.png"
SOURCE_RUNTIME = GUI_SOURCE_DIR / "gate_balance_overlay_image2_source_v2.png"
BACKGROUND = GUI_DIR / "gate_balance_overlay_background_image2_v2.png"
PARTS = GUI_DIR / "gate_balance_overlay_parts_image2_v2.png"
REGIONS = GUI_DIR / "gate_balance_overlay_parts_image2_v2.regions.json"
LAYOUT = GUI_DIR / "gate_balance_overlay_layout_v2.json"
CONTACT_SHEET = REPORT_DIR / "gate_balance_gui_image2_contact_sheet_v2.png"
PROMPT_LEDGER_MD = REPORT_DIR / "gate_balance_gui_image2_prompt_ledger_v2.md"
PROMPT_LEDGER_JSON = REPORT_DIR / "gate_balance_gui_image2_prompt_ledger_v2.json"
PROVENANCE_MD = REPORT_DIR / "gate_balance_gui_image2_source_provenance_v2.md"
PROVENANCE_JSON = REPORT_DIR / "gate_balance_gui_image2_source_provenance_v2.json"

GENERATED_AT = "2026-06-24"
SOURCE_SIZE = [1792, 1024]

IMAGE2_PROMPT = (
    "Human Protocol 2D puzzle overlay GUI art source, exact landscape game UI, "
    "premium sci-fi medical facility gate balancing console. IMPORTANT LAYOUT: "
    "three identical bottom control trays across the bottom, each tray must have "
    "a blank square button socket on the left, a blank center value window, and "
    "a blank square button socket on the right. Under those three trays there "
    "must be two separate blank action plates: a small reset plate near lower "
    "center and a wide lock/confirm plate near lower right. Do not merge the "
    "right gate control tray with the lock button. Center area has three large "
    "mechanical shutter gate windows, all same size. Below gates are three "
    "diagnostic readout panels, all same size. Top-left blank title plate, "
    "top-center blank progress rail, top-right small blank close plate. Dark "
    "smoked titanium, cyan glass, old-gold trim, scratches, screws, bevels, "
    "scanlines, high-quality real Image2 bitmap game UI art. No readable text, "
    "no letters, no numbers, no logos, no Chinese, no English. Avoid plus, "
    "minus, X, checkmark, arrows, or text; only blank physical button surfaces "
    "and mechanical shapes. React live text and symbols will be overlaid later. "
    "No people, no hands, no characters."
)


def ensure_dirs() -> None:
    for path in [GUI_DIR, GUI_SOURCE_DIR, REPORT_DIR]:
        path.mkdir(parents=True, exist_ok=True)


def load_source() -> Image.Image:
    source = Path(os.environ.get("GATE_BALANCE_IMAGE2_SOURCE", DEFAULT_GENERATED_SOURCE))
    if source.exists():
        shutil.copyfile(source, SOURCE_ORIGINAL)
    if not SOURCE_ORIGINAL.exists():
        raise FileNotFoundError(
            f"Missing Image2 source. Set GATE_BALANCE_IMAGE2_SOURCE or place {SOURCE_ORIGINAL.relative_to(ROOT)}"
        )
    image = Image.open(SOURCE_ORIGINAL).convert("RGBA")
    if list(image.size) != SOURCE_SIZE:
        image = image.resize(tuple(SOURCE_SIZE), Image.Resampling.LANCZOS)
    image.save(SOURCE_RUNTIME)
    image.save(BACKGROUND)
    return image


def crop(image: Image.Image, rect: tuple[int, int, int, int]) -> Image.Image:
    x, y, w, h = rect
    return image.crop((x, y, x + w, y + h))


def tint(image: Image.Image, color: tuple[int, int, int], alpha: int) -> Image.Image:
    overlay = Image.new("RGBA", image.size, (*color, alpha))
    out = Image.alpha_composite(image, overlay)
    return ImageEnhance.Contrast(out).enhance(1.04)


def make_progress_track(image: Image.Image) -> Image.Image:
    base = crop(image, (650, 151, 782, 42))
    glow = Image.new("RGBA", base.size, (87, 242, 255, 28))
    return Image.alpha_composite(base, glow)


def make_atlas(image: Image.Image) -> dict[str, list[int]]:
    atlas = Image.new("RGBA", (1536, 1536), (0, 0, 0, 0))
    regions: dict[str, list[int]] = {}

    def put(name: str, xy: tuple[int, int], part: Image.Image) -> None:
        atlas.alpha_composite(part, xy)
        regions[name] = [xy[0], xy[1], part.width, part.height]

    stage = crop(image, (118, 198, 1556, 500))
    left_gate = crop(image, (240, 218, 390, 340))
    mid_gate = crop(image, (700, 218, 390, 340))
    right_gate = crop(image, (1160, 218, 390, 340))
    gauge_left = crop(image, (202, 578, 420, 132))
    gauge_mid = crop(image, (686, 578, 420, 132))
    gauge_right = crop(image, (1168, 578, 420, 132))
    control_left = crop(image, (158, 735, 480, 112))
    control_mid = crop(image, (646, 735, 480, 112))
    control_right = crop(image, (1134, 735, 480, 112))
    reset_plate = crop(image, (820, 856, 188, 70))
    lock_plate = crop(image, (1192, 856, 420, 70))
    close_plate = crop(image, (1470, 76, 168, 92))

    put("stage_plate", (0, 0), stage)
    put("gate_slot_idle", (0, 520), left_gate)
    put("gate_slot_focus", (400, 520), tint(mid_gate, (255, 194, 82), 38))
    put("gate_slot_balanced", (800, 520), tint(right_gate, (99, 255, 212), 48))
    put("gauge_plate_idle", (0, 930), gauge_left)
    put("gauge_plate_near", (424, 930), tint(gauge_mid, (255, 194, 82), 34))
    put("gauge_plate_locked", (848, 930), tint(gauge_right, (99, 255, 212), 42))
    put("control_plate", (0, 1090), control_left)
    put("control_plate_mid", (444, 1090), control_mid)
    put("control_plate_right", (904, 1090), control_right)
    put("button_primary", (0, 1228), lock_plate)
    put("button_secondary", (348, 1228), reset_plate)
    put("close_plate", (512, 1228), close_plate)
    put("progress_track", (688, 1228), make_progress_track(image))

    atlas.save(PARTS)
    return regions


def write_layout() -> None:
    layout = {
        "schemaVersion": "hp.gateBalance.image2Layout.v2",
        "canvas": SOURCE_SIZE,
        "sourceImage": str(SOURCE_RUNTIME.relative_to(ROOT)),
        "background": str(BACKGROUND.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "regionsFile": str(REGIONS.relative_to(ROOT)),
        "runtimeMustNotBake": [
            "localized title and instructions",
            "gate labels",
            "gate numeric positions",
            "gauge values and target deltas",
            "timer",
            "success/failure state",
            "button text and accessibility labels",
        ],
        "regions": {
        "titleBlock": [140, 78, 460, 92],
        "closeButton": [1474, 82, 156, 78],
        "guidance": [140, 180, 620, 30],
        "syncLabel": [650, 118, 105, 26],
        "syncBar": [650, 151, 782, 42],
        "syncCount": [1438, 149, 92, 42],
            "stage": [118, 198, 1556, 500],
            "gateLeft": [240, 218, 390, 340],
            "gateMid": [700, 218, 390, 340],
            "gateRight": [1160, 218, 390, 340],
            "stageCaption": [500, 548, 790, 32],
            "gaugeSeal": [202, 578, 420, 132],
            "gaugeTrack": [686, 578, 420, 132],
            "gaugeTemp": [1168, 578, 420, 132],
            "controlLeft": [158, 735, 480, 112],
            "controlMid": [646, 735, 480, 112],
            "controlRight": [1134, 735, 480, 112],
            "controlLeftMinus": [182, 748, 74, 74],
            "controlLeftLabel": [284, 742, 190, 22],
            "controlLeftValue": [284, 762, 190, 58],
            "controlLeftPlus": [492, 748, 74, 74],
            "controlMidMinus": [670, 748, 74, 74],
            "controlMidLabel": [772, 742, 190, 22],
            "controlMidValue": [772, 762, 190, 58],
            "controlMidPlus": [980, 748, 74, 74],
            "controlRightMinus": [1158, 748, 74, 74],
            "controlRightLabel": [1260, 742, 190, 22],
            "controlRightValue": [1260, 762, 190, 58],
            "controlRightPlus": [1468, 748, 74, 74],
            "statusText": [190, 872, 520, 38],
            "resetButton": [820, 856, 188, 70],
            "lockButton": [1192, 856, 420, 70],
        "timer": [1542, 172, 90, 34],
        "error": [650, 196, 680, 30],
        },
    }
    LAYOUT.write_text(json.dumps(layout, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_regions(regions: dict[str, list[int]]) -> None:
    payload = {
        "schemaVersion": "hp.image2.gui.regions.v2",
        "atlasSize": [1536, 1536],
        "backgroundSize": SOURCE_SIZE,
        "source": str(SOURCE_RUNTIME.relative_to(ROOT)),
        "background": str(BACKGROUND.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "regions": regions,
        "stateRegions": {
            "active": ["stage_plate", "gate_slot_focus", "progress_track"],
            "solved": ["stage_plate", "gate_slot_balanced", "gauge_plate_locked", "button_primary"],
            "error": ["stage_plate", "gauge_plate_near"],
        },
        "notes": (
            "V2 is cut from a real Image2 source PNG generated in Codex image_gen. "
            "Runtime overlays live labels, numbers, gate positions, gauge needles, "
            "timer, and success state."
        ),
    }
    REGIONS.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_contact_sheet(image: Image.Image) -> None:
    sheet = Image.new("RGBA", (1792, 1480), (4, 8, 10, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    sheet.alpha_composite(image.resize((896, 512), Image.Resampling.LANCZOS), (24, 24))
    atlas = Image.open(PARTS).convert("RGBA")
    sheet.alpha_composite(atlas.resize((512, 512), Image.Resampling.LANCZOS), (960, 24))
    labels = [
        ("real Image2 source", 24, 552),
        ("parts atlas cut from source", 960, 552),
        ("layout target: live React text/state over Image2 art", 24, 620),
    ]
    for text, x, y in labels:
        draw.text((x, y), text, fill=(202, 252, 255, 255))
    preview = image.copy()
    pdraw = ImageDraw.Draw(preview, "RGBA")
    for name, rect in json.loads(LAYOUT.read_text(encoding="utf-8"))["regions"].items():
        x, y, w, h = rect
        pdraw.rectangle((x, y, x + w, y + h), outline=(99, 255, 212, 180), width=3)
        if name in {"gateLeft", "gateMid", "gateRight", "gaugeSeal", "gaugeTrack", "gaugeTemp", "controlLeft", "controlMid", "controlRight"}:
            pdraw.text((x + 8, y + 8), name, fill=(255, 208, 120, 255))
    sheet.alpha_composite(preview.resize((1344, 768), Image.Resampling.LANCZOS), (24, 690))
    sheet.save(CONTACT_SHEET)


def write_provenance() -> None:
    generated_source = Path(os.environ.get("GATE_BALANCE_IMAGE2_SOURCE", DEFAULT_GENERATED_SOURCE))
    prompt_payload = {
        "schemaVersion": "hp.image2.promptLedger.v2",
        "assetFamily": "gate_balance_gui",
        "generatedAt": GENERATED_AT,
        "tool": "Codex image_gen / Image2",
        "threadId": THREAD_ID,
        "callId": "not-exposed-by-codex-imagegen",
        "sourcePrompt": IMAGE2_PROMPT,
        "sourcePath": str(generated_source),
        "repoSourceCopy": str(SOURCE_ORIGINAL.relative_to(ROOT)),
        "runtimeOutputs": [
            str(SOURCE_RUNTIME.relative_to(ROOT)),
            str(BACKGROUND.relative_to(ROOT)),
            str(PARTS.relative_to(ROOT)),
            str(REGIONS.relative_to(ROOT)),
            str(LAYOUT.relative_to(ROOT)),
        ],
        "negativeRules": ["no baked text", "no answer numbers", "no people", "no logos"],
    }
    PROMPT_LEDGER_JSON.write_text(json.dumps(prompt_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROMPT_LEDGER_MD.write_text(
        "\n".join(
            [
                "# Gate Balance GUI Image2 Prompt Ledger V2",
                "",
                f"- Generated: {GENERATED_AT}",
                "- Tool: Codex image_gen / Image2",
                f"- Thread: `{THREAD_ID}`",
                "- Call id: `not-exposed-by-codex-imagegen`",
                f"- Generated source: `{generated_source}`",
                f"- Repo source copy: `{SOURCE_ORIGINAL.relative_to(ROOT)}`",
                "",
                "## Prompt",
                "",
                IMAGE2_PROMPT,
                "",
                "## Runtime Rule",
                "",
                "Image2 owns the metal/glass/gate GUI art. React owns localized text, numbers, button labels, state, timer, and puzzle answer.",
                "",
            ]
        ),
        encoding="utf-8",
    )
    provenance = {
        "schemaVersion": "hp.image2.sourceProvenance.v2",
        "assetFamily": "gate_balance_gui",
        "licenseLabel": "openai-generated-output-user-owned-subject-to-openai-terms",
        "classification": "owned-generated-output",
        "generatedAt": GENERATED_AT,
        "sourceTool": "Codex image_gen / Image2",
        "sourcePath": str(generated_source),
        "repoSourceCopy": str(SOURCE_ORIGINAL.relative_to(ROOT)),
        "derivatives": {
            "background": str(BACKGROUND.relative_to(ROOT)),
            "partsAtlas": str(PARTS.relative_to(ROOT)),
            "regions": str(REGIONS.relative_to(ROOT)),
            "layout": str(LAYOUT.relative_to(ROOT)),
            "contactSheet": str(CONTACT_SHEET.relative_to(ROOT)),
        },
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PROVENANCE_MD.write_text(
        "\n".join(
            [
                "# Gate Balance GUI Image2 Source Provenance V2",
                "",
                "- Asset family: `gate_balance_gui`",
                "- License: `openai-generated-output-user-owned-subject-to-openai-terms`",
                "- Classification: `owned-generated-output`",
                f"- Source tool: Codex image_gen / Image2 on {GENERATED_AT}",
                f"- Source copy: `{SOURCE_ORIGINAL.relative_to(ROOT)}`",
                f"- Runtime background: `{BACKGROUND.relative_to(ROOT)}`",
                f"- Parts atlas: `{PARTS.relative_to(ROOT)}`",
                f"- Regions: `{REGIONS.relative_to(ROOT)}`",
                f"- Layout: `{LAYOUT.relative_to(ROOT)}`",
                "",
                "Runtime text, numeric positions, gauge values, timer, answer, and success/failure state are not baked into the Image2 art.",
                "",
            ]
        ),
        encoding="utf-8",
    )


def main() -> None:
    ensure_dirs()
    image = load_source()
    regions = make_atlas(image)
    write_regions(regions)
    write_layout()
    write_contact_sheet(image)
    write_provenance()
    print(json.dumps({
        "source": str(SOURCE_ORIGINAL.relative_to(ROOT)),
        "background": str(BACKGROUND.relative_to(ROOT)),
        "parts": str(PARTS.relative_to(ROOT)),
        "regions": len(regions),
        "layout": str(LAYOUT.relative_to(ROOT)),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
