#!/usr/bin/env python3
"""Generate Level 01 workcell Image2 atlas, provenance, and builder manifest.

This is the math-cut stage for the Level 1 repair-bay workcell furniture lane.
It does not synthesize texture noise. Every atlas tile is a fixed rectangle
from the repo-local Image2 source board:

  src/assets/textures/environment/level01-workcell-image2/image2-sources/
    level01_workcell_image2_reference_board_v1.png
"""

from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level01-workcell-image2"
SOURCE_DIR = TEXTURE_DIR / "image2-sources"
FIXED_CUT_DIR = TEXTURE_DIR / "fixed-rect-cuts"
SOURCE_IMAGE = SOURCE_DIR / "level01_workcell_image2_reference_board_v1.png"
ATLAS_PATH = TEXTURE_DIR / "hp_level01_workcell_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_level01_workcell_image2_atlas.regions.json"
DEBUG_SHEET = TEXTURE_DIR / "hp_level01_workcell_image2_atlas.debug.png"
REPORT_JSON = ROOT / "src/assets/manifests/reports/level01_workcell_image2_texture_report.json"
PROVENANCE_JSON = ROOT / "src/assets/manifests/reports/level01_workcell_image2_source_provenance.json"
PROVENANCE_MD = ROOT / "src/assets/manifests/reports/level01_workcell_image2_source_provenance.md"
MANIFEST_PATH = ROOT / "src/assets/manifests/builder/hp_level01_workcell_image2_v1.json"

PACK_ID = "hp_level01_workcell_image2_v1"
SOURCE_TOOL = "level01-workcell-image2-lane-a"
THEME_ID = "hp_level01_maintenance_workcell_image2"
GENERATED_AT = "2026-06-20"
SOURCE_ORIGIN = (
    "/Users/zhengkaizhang/.codex/generated_images/019ee642-d712-7551-848b-3842ad6d9589/"
    "ig_0ae7f274bdaf1c33016a36d9e11358819a8c8986415a1d2c96.png"
)

IMAGE2_PROMPT = """Use case: stylized-concept
Asset type: Human Protocol Level 1 industrial workcell Image2 material/reference board for game asset atlas source
Primary request: Create a single high-resolution material/reference board for five reusable maintenance bay furniture props: mobile repair tool cart, hydraulic lift repair table, wall-mounted tool board, prosthetic spare parts cabinet, sterile parts wash basin.
Scene/backdrop: clean robot-facility maintenance bay workcell reference board, orthographic product/material sheet, no perspective room scene.
Subject: five distinct industrial furniture/material regions arranged in a tidy grid, with surfaces and detail patches suitable for cropping into an atlas: dark gray industrial metal, white enamel maintenance panels, yellow-black hazard striping, small cyan-blue diagnostic glass/acrylic indicators, rubber wheels, hydraulic pistons, pegboard holes, sterile basin metal.
Style/medium: realistic-to-stylized game texture reference board, sharp PBR-like material details, low-poly-friendly, production asset source.
Composition/framing: square image, evenly spaced rectangular panels/regions, clear boundaries between material zones, enough margin for deterministic rectangular crops; no text labels.
Lighting/mood: neutral studio lighting, clean but used, subtle scuffs and edge wear, no grime piles.
Color palette: deep neutral grays, off-white enamel, safety yellow/black accents, restrained cyan-blue diagnostics only.
Materials/textures: brushed metal, powder coated metal, enamel panels, rubber, glass/acrylic, warning tape, pegboard, stainless basin, minor scratches.
Constraints: no text, no logos, no watermark, no human characters, no large cyan areas, no clutter, no trash, no UI, no transparent background required.
Avoid: muddy dirty junkyard look, organic shapes, excessive neon, fantasy/sci-fi weapons, readable writing."""


REGIONS = [
    {
        "id": "cart_dark_powdercoat",
        "sourceRect": [15, 370, 106, 72],
        "intent": "dark gray powder-coated tool-cart body panels",
    },
    {
        "id": "worn_black_panel",
        "sourceRect": [126, 370, 100, 72],
        "intent": "slightly used black industrial metal face",
    },
    {
        "id": "brushed_steel",
        "sourceRect": [233, 370, 78, 72],
        "intent": "brushed steel trim and hydraulic metal",
    },
    {
        "id": "safety_yellow",
        "sourceRect": [393, 370, 83, 72],
        "intent": "yellow caution paint, edge-worn",
    },
    {
        "id": "hazard_stripe",
        "sourceRect": [482, 370, 78, 72],
        "intent": "yellow-black hazard striping for edges and lips",
    },
    {
        "id": "lift_white_enamel",
        "sourceRect": [777, 370, 104, 72],
        "intent": "off-white enamel maintenance panels",
    },
    {
        "id": "lift_scuffed_white",
        "sourceRect": [887, 370, 86, 72],
        "intent": "used white repair-table rim panels",
    },
    {
        "id": "tool_pegboard",
        "sourceRect": [126, 770, 94, 75],
        "intent": "white pegboard holes for wall-mounted tool panel",
    },
    {
        "id": "dark_tool_plate",
        "sourceRect": [225, 770, 110, 75],
        "intent": "dark tool tray / drawer insert",
    },
    {
        "id": "cyan_diagnostic_glass",
        "sourceRect": [452, 770, 115, 75],
        "intent": "small cyan diagnostic glass, restrained accent only",
    },
    {
        "id": "stainless_basin",
        "sourceRect": [404, 865, 158, 155],
        "intent": "stainless wash-basin bowl and rim",
    },
    {
        "id": "rubber_wheel_tread",
        "sourceRect": [586, 1044, 118, 196],
        "intent": "dark rubber wheel/tread material",
    },
]


ASSETS = [
    {
        "modelKey": "room_l1_img2_mobile_repair_cart",
        "label": "移动维修工具车",
        "family": "storage_crate",
        "footprintFamily": "crate",
        "sizeMeters": [1.12, 0.98, 0.72],
        "solid": True,
        "canHoldSmallProps": True,
        "clueCapacity": 1,
        "roleTags": ["role:interactive", "workcell:tools"],
        "supportSurfaces": [
            {
                "id": "room_l1_img2_mobile_repair_cart_top",
                "kind": "tabletop",
                "localCenter": [0, 0.99, 0],
                "size": [0.92, 0.52],
                "maxChildHeight": 0.45,
            }
        ],
    },
    {
        "modelKey": "room_l1_img2_hydraulic_lift_table",
        "label": "液压升降维修台",
        "family": "bed_or_exam_table",
        "footprintFamily": "bed",
        "sizeMeters": [2.25, 0.86, 1.02],
        "solid": True,
        "canHoldSmallProps": True,
        "clueCapacity": 1,
        "roleTags": ["role:anchor", "workcell:repair"],
        "supportSurfaces": [
            {
                "id": "room_l1_img2_hydraulic_lift_table_top",
                "kind": "tabletop",
                "localCenter": [0, 0.87, 0],
                "size": [1.8, 0.72],
                "maxChildHeight": 0.55,
            }
        ],
    },
    {
        "modelKey": "room_l1_img2_wall_tool_board",
        "label": "墙挂工具板",
        "family": "wall_panel_or_picture_frame",
        "footprintFamily": "wall_panel",
        "sizeMeters": [1.62, 1.02, 0.12],
        "solid": False,
        "canHoldSmallProps": False,
        "clueCapacity": 2,
        "roleTags": ["role:clue", "workcell:tools"],
        "mount": "wall",
        "wallPreferred": "back",
    },
    {
        "modelKey": "room_l1_img2_prosthetic_parts_cabinet",
        "label": "备用义体零件柜",
        "family": "display_case",
        "footprintFamily": "display_case",
        "sizeMeters": [1.36, 1.62, 0.58],
        "solid": True,
        "canHoldSmallProps": False,
        "clueCapacity": 2,
        "roleTags": ["role:interactive", "workcell:prosthetics"],
        "wallPreferred": "back",
    },
    {
        "modelKey": "room_l1_img2_sterile_wash_basin",
        "label": "消毒零件清洗槽",
        "family": "control_console",
        "footprintFamily": "table",
        "sizeMeters": [1.45, 1.02, 0.62],
        "solid": True,
        "canHoldSmallProps": True,
        "clueCapacity": 1,
        "roleTags": ["role:interactive", "workcell:sterile"],
        "wallPreferred": "back",
        "supportSurfaces": [
            {
                "id": "room_l1_img2_sterile_wash_basin_lip",
                "kind": "tabletop",
                "localCenter": [0, 1.02, 0],
                "size": [1.15, 0.28],
                "maxChildHeight": 0.35,
            }
        ],
    },
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def assert_source_rects_fit(source: Image.Image) -> None:
    width, height = source.size
    for region in REGIONS:
        x, y, w, h = region["sourceRect"]
        if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > width or y + h > height:
            raise ValueError(f"{region['id']} sourceRect {region['sourceRect']} outside {source.size}")


def build_atlas() -> dict:
    if not SOURCE_IMAGE.exists():
        raise FileNotFoundError(f"missing Image2 source: {SOURCE_IMAGE}")
    source = Image.open(SOURCE_IMAGE).convert("RGBA")
    assert_source_rects_fit(source)

    tile = 256
    cols = 4
    atlas = Image.new("RGBA", (cols * tile, 3 * tile), (0, 0, 0, 0))
    debug = atlas.copy()
    debug_draw = ImageDraw.Draw(debug)
    region_map = {}

    for index, region in enumerate(REGIONS):
        sx, sy, sw, sh = region["sourceRect"]
        ax = (index % cols) * tile
        ay = (index // cols) * tile
        fixed_cut = source.crop((sx, sy, sx + sw, sy + sh))
        fixed_cut_path = FIXED_CUT_DIR / f"{region['id']}.png"
        fixed_cut.save(fixed_cut_path)
        atlas_tile = fixed_cut.resize((tile, tile), Image.Resampling.LANCZOS)
        atlas.paste(atlas_tile, (ax, ay))
        debug.paste(atlas_tile, (ax, ay))
        debug_draw.rectangle([ax, ay, ax + tile - 1, ay + tile - 1], outline=(255, 230, 80, 255), width=3)
        debug_draw.text((ax + 8, ay + 8), f"{index:02d} {region['id']}", fill=(255, 255, 255, 255))
        region_map[region["id"]] = {
            "atlasRect": [ax, ay, tile, tile],
            "sourceImage": rel(SOURCE_IMAGE),
            "sourceRect": region["sourceRect"],
            "fixedRectCut": rel(fixed_cut_path),
            "intent": region["intent"],
        }

    atlas.save(ATLAS_PATH)
    debug.save(DEBUG_SHEET)
    return {
        "schemaVersion": "hp.image2.atlasRegions.v1",
        "sourceImage": rel(SOURCE_IMAGE),
        "sourceImageSize": list(source.size),
        "atlas": rel(ATLAS_PATH),
        "atlasSize": list(atlas.size),
        "cutMethod": "fixed-rectangles-recorded-in-script",
        "tileSize": [tile, tile],
        "regions": region_map,
    }


def write_manifest() -> dict:
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "HP Level 01 维修湾工作单元 Lane A (Image2)",
        "sourceTool": SOURCE_TOOL,
        "generatedAt": GENERATED_AT,
        "atlas": rel(ATLAS_PATH),
        "assets": [],
    }
    for asset in ASSETS:
        entry = {
            "modelKey": asset["modelKey"],
            "label": asset["label"],
            "assetKind": "furniture",
            "family": asset["family"],
            "group": "维修",
            "source": SOURCE_TOOL,
            "sourceAssetId": f"{asset['modelKey']}_lane_a_image2_v1",
            "themeId": THEME_ID,
            "glbFile": f"../../models-cooked/environment/level01-workcell-image2/{asset['modelKey']}.glb",
            "sizeMeters": asset["sizeMeters"],
            "solid": asset["solid"],
            "mount": asset.get("mount", "floor"),
            "wallPreferred": asset.get("wallPreferred", "none"),
            "canHoldSmallProps": asset["canHoldSmallProps"],
            "clueCapacity": asset["clueCapacity"],
            "footprintFamily": asset["footprintFamily"],
            "tags": ["lane:level01-workcell-a", "style:hp-level01-maintenance", *asset["roleTags"]],
        }
        if "supportSurfaces" in asset:
            entry["supportSurfaces"] = asset["supportSurfaces"]
        manifest["assets"].append(entry)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def write_reports(regions_doc: dict, manifest: dict) -> None:
    source_hash = sha256(SOURCE_IMAGE)
    provenance = {
        "schemaVersion": "hp.image2.sourceProvenance.v1",
        "assetFamily": PACK_ID,
        "licenseLabel": "owned-generated-output",
        "termsLabel": "openai-generated-output-user-owned-subject-to-openai-terms",
        "generationDate": GENERATED_AT,
        "generatingAccount": "project user via Codex built-in image_gen",
        "tool": "built-in image_gen",
        "toolCallId": "not-exposed-by-built-in-image_gen",
        "sourceOrigin": SOURCE_ORIGIN,
        "repoSourceImage": rel(SOURCE_IMAGE),
        "repoSourceSha256": source_hash,
        "prompt": IMAGE2_PROMPT,
        "derivatives": {
            "atlas": rel(ATLAS_PATH),
            "regions": rel(REGIONS_PATH),
            "fixedRectCuts": rel(FIXED_CUT_DIR),
            "debugAtlas": rel(DEBUG_SHEET),
            "builderManifest": rel(MANIFEST_PATH),
        },
        "cropMapping": regions_doc["regions"],
        "notes": [
            "Source is a real generated bitmap saved repo-local before derivative crops.",
            "Atlas tiles are fixed rectangles from the Image2 board; no PIL noise or synthetic texture source is used.",
            "Final GLBs are deterministic Blender geometry; Image2 is material/reference evidence.",
        ],
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    md_lines = [
        "# Level 01 Workcell Image2 Source Provenance",
        "",
        f"- Asset family: `{PACK_ID}`",
        "- License label: `owned-generated-output`",
        "- Terms label: `openai-generated-output-user-owned-subject-to-openai-terms`",
        f"- Generation date: `{GENERATED_AT}`",
        "- Tool: built-in `image_gen`",
        "- Tool call id: `not-exposed-by-built-in-image_gen`",
        f"- Repo source: `{rel(SOURCE_IMAGE)}`",
        f"- SHA-256: `{source_hash}`",
        f"- Atlas: `{rel(ATLAS_PATH)}`",
        f"- Regions: `{rel(REGIONS_PATH)}`",
        f"- Fixed-rect cuts: `{rel(FIXED_CUT_DIR)}`",
        "",
        "## Fixed Crop Regions",
        "",
    ]
    for name, data in regions_doc["regions"].items():
        md_lines.append(
            f"- `{name}` sourceRect={data['sourceRect']} atlasRect={data['atlasRect']} "
            f"cut=`{data['fixedRectCut']}` intent={data['intent']}"
        )
    md_lines += ["", "## Prompt", "", "```text", IMAGE2_PROMPT, "```", ""]
    PROVENANCE_MD.write_text("\n".join(md_lines), encoding="utf-8")

    report = {
        "schemaVersion": "hp.image2.textureReport.v1",
        "assetFamily": PACK_ID,
        "generatedAt": date.today().isoformat(),
        "sourceImage": rel(SOURCE_IMAGE),
        "sourceSha256": source_hash,
        "atlas": rel(ATLAS_PATH),
        "regions": rel(REGIONS_PATH),
        "fixedRectCuts": rel(FIXED_CUT_DIR),
        "debugAtlas": rel(DEBUG_SHEET),
        "regionCount": len(REGIONS),
        "assetModelKeys": [asset["modelKey"] for asset in manifest["assets"]],
        "qaNotes": [
            "Image2 source contains all five requested workcell references.",
            "Cyan is isolated to small diagnostic glass crops and should stay an accent.",
            "Hazard strip crops are available for small edge marks; avoid large striped surfaces.",
        ],
    }
    REPORT_JSON.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for directory in (TEXTURE_DIR, SOURCE_DIR, FIXED_CUT_DIR, REPORT_JSON.parent, MANIFEST_PATH.parent):
        directory.mkdir(parents=True, exist_ok=True)
    regions_doc = build_atlas()
    REGIONS_PATH.write_text(json.dumps(regions_doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    manifest = write_manifest()
    write_reports(regions_doc, manifest)
    print(f"wrote {rel(ATLAS_PATH)}")
    print(f"wrote {rel(REGIONS_PATH)}")
    print(f"wrote {rel(MANIFEST_PATH)}")
    print(f"wrote {rel(PROVENANCE_JSON)}")


if __name__ == "__main__":
    main()
