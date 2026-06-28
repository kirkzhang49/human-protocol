#!/usr/bin/env python3
"""Cut the real Level 01 safety/storage Image2 source board into atlas tiles."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
TEXTURE_DIR = ROOT / "src/assets/textures/environment/level01-safety-storage-image2"
SOURCE_DIR = TEXTURE_DIR / "image2-sources"
SOURCE_IMAGE = SOURCE_DIR / "hp_level01_safety_storage_material_board_image2_source.png"
ATLAS_PATH = TEXTURE_DIR / "hp_level01_safety_storage_image2_atlas.png"
REGIONS_PATH = TEXTURE_DIR / "hp_level01_safety_storage_image2_atlas.regions.json"
PROVENANCE_PATH = ROOT / "src/assets/manifests/reports/level01_safety_storage_image2_source_provenance.json"
REPORT_PATH = ROOT / "src/assets/manifests/reports/level01_safety_storage_image2_texture_report.md"

EXPECTED_SOURCE_SIZE = (1254, 1254)
TILE_SIZE = 512
ATLAS_SIZE = (1536, 1024)

PROMPT = """Use case: stylized-concept
Asset type: Human Protocol Level 1 industrial safety/storage/body-reference material board for 3D prop texture sourcing
Primary request: Create one square material board image for a game asset pipeline, showing five clearly separated panels that can be cropped into texture regions: (1) yellow-black warning barrier stripes and scratched metal rail material, (2) stacked gray-blue industrial plastic parts totes with small blank label plates, (3) dark access diagnostic terminal cabinet surface with abstract cyan indicator lights and cable sockets, (4) white folding maintenance privacy screen fabric/plastic panels with pale gray hinges, (5) white medical maintenance reference lightbox with abstract human silhouette diagram made only of non-readable geometric lines and soft structure light.
Scene/backdrop: orthographic flat lay material board on a neutral dark workshop table, five clean rectangular zones separated by thin gutters.
Subject: industrial safety, storage, and body-maintenance surfaces suitable for Level 1 maintenance bay props.
Style/medium: high-quality stylized 3D game texture concept, clean industrial sci-fi, crisp edges, physically plausible materials, low-noise albedo-friendly lighting.
Composition/framing: square image, straight-on orthographic view, each panel distinct, generous margins, no perspective distortion, no object overlap between panels.
Lighting/mood: soft studio light, readable material details, controlled reflections.
Color palette: hazard yellow/black, cool gray metal, muted blue storage plastic, white medical panels, cyan diagnostic glow accents.
Materials/textures: scratched painted metal, ribbed plastic, brushed dark cabinet metal, clean white folding polymer, translucent glowing acrylic.
Text (verbatim): none.
Constraints: no readable words, no numbers, no puzzle answers, no logos, no watermark, no UI text. Human reference must be abstract diagram only, not anatomical detail.
Avoid: blurred crops, tiny illegible signs, random labels, blood, gore, horror anatomy, brand marks, handwritten text."""

REGION_SPECS = [
    ("warning_barrier", "room_l1_img2_warning_barrier", [16, 16, 604, 584], [0, 0, TILE_SIZE, TILE_SIZE], "scratched black/yellow warning rail and barrier plank"),
    ("parts_tote_stack", "room_l1_img2_parts_tote_stack", [634, 16, 604, 584], [512, 0, TILE_SIZE, TILE_SIZE], "stacked gray-blue industrial plastic tote faces"),
    ("access_diagnostic_cabinet", "room_l1_img2_access_diagnostic_cabinet", [16, 614, 396, 610], [1024, 0, TILE_SIZE, TILE_SIZE], "dark terminal cabinet face with abstract cyan indicators"),
    ("maintenance_privacy_screen", "room_l1_img2_maintenance_privacy_screen", [424, 614, 408, 610], [0, 512, TILE_SIZE, TILE_SIZE], "white folding maintenance privacy panels and hinges"),
    ("body_reference_lightbox", "room_l1_img2_body_reference_lightbox", [844, 614, 396, 610], [512, 512, TILE_SIZE, TILE_SIZE], "white medical lightbox with abstract non-readable body reference"),
]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def main() -> None:
    TEXTURE_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    PROVENANCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(SOURCE_IMAGE) as opened:
        source = opened.convert("RGBA")
    if source.size != EXPECTED_SOURCE_SIZE:
        raise SystemExit(f"source image must be {EXPECTED_SOURCE_SIZE}, got {source.size}: {SOURCE_IMAGE}")

    atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    regions: dict[str, dict[str, object]] = {}
    for key, model_key, source_rect, atlas_rect, intent in REGION_SPECS:
        sx, sy, sw, sh = source_rect
        ax, ay, aw, ah = atlas_rect
        crop = source.crop((sx, sy, sx + sw, sy + sh)).resize((aw, ah), Image.Resampling.LANCZOS)
        atlas.alpha_composite(crop, (ax, ay))
        tile_path = SOURCE_DIR / f"{key}_fixed_crop.png"
        crop.save(tile_path, optimize=True, compress_level=9)
        regions[key] = {
            "x": ax,
            "y": ay,
            "w": aw,
            "h": ah,
            "sourceRect": {"x": sx, "y": sy, "w": sw, "h": sh},
            "sourceImage": rel(SOURCE_IMAGE),
            "fixedCrop": rel(tile_path),
            "modelKey": model_key,
            "materialIntent": intent,
        }

    atlas.save(ATLAS_PATH, optimize=True, compress_level=9)
    REGIONS_PATH.write_text(json.dumps({
        "schema": "human-protocol/level01-safety-storage-image2-atlas-regions@1",
        "atlas": rel(ATLAS_PATH),
        "atlasSize": list(ATLAS_SIZE),
        "sourceImage": rel(SOURCE_IMAGE),
        "sourceImageSize": list(EXPECTED_SOURCE_SIZE),
        "rectCoordinateSpace": "pixels, top-left origin",
        "tilePolicy": "fixed source rectangles resized to 512x512 atlas tiles",
        "regions": regions,
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    PROVENANCE_PATH.write_text(json.dumps({
        "schema": "human-protocol/image2-source-provenance@1",
        "assetFamily": "Level 01 safety, storage, and human-maintenance reference furniture Lane C",
        "packId": "hp_level01_safety_storage_image2_v1",
        "sourceTool": "built-in image_gen",
        "sourceCallId": "not-exposed-by-built-in-image-gen",
        "generationDate": "2026-06-20",
        "generatingAccount": "local Codex desktop session for project owner",
        "licenseLabel": "owned-generated-output",
        "licenseNote": "openai-generated-output-user-owned-subject-to-openai-terms",
        "originalGeneratedImage": "/Users/zhengkaizhang/.codex/generated_images/019ee642-d82c-7711-99bb-f499abe4f514/ig_0343bbfede74d376016a36d9eee444819aab5dbc5917e6b2c2.png",
        "repoSourceImage": rel(SOURCE_IMAGE),
        "prompt": PROMPT,
        "cropMapping": regions,
        "derivativeOutputs": [rel(ATLAS_PATH), rel(REGIONS_PATH), *[row["fixedCrop"] for row in regions.values()]],
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    lines = [
        "# Level 01 Safety Storage Image2 Texture Report",
        "",
        f"- Source image: `{rel(SOURCE_IMAGE)}`",
        f"- Atlas: `{rel(ATLAS_PATH)}`",
        f"- Regions: `{rel(REGIONS_PATH)}`",
        f"- Provenance: `{rel(PROVENANCE_PATH)}`",
        "- Crop method: fixed pixel rectangles, resized to 512x512 atlas tiles.",
        "",
        "| Region | modelKey | Source rect | Atlas rect |",
        "| --- | --- | --- | --- |",
    ]
    for key, model_key, source_rect, atlas_rect, _intent in REGION_SPECS:
        lines.append(f"| `{key}` | `{model_key}` | `{source_rect}` | `{atlas_rect}` |")
    REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    for path in (ATLAS_PATH, REGIONS_PATH, PROVENANCE_PATH, REPORT_PATH):
        print(f"wrote {rel(path)}")


if __name__ == "__main__":
    main()
