#!/usr/bin/env python3
"""Generate the /build Image2 UI atlas and cropped slices.

The atlas is intentionally bitmap-first: quiet glass, worn metal edges, scan
lines and restrained facility lights. UI text stays in React; these slices are
only the physical shell around the controls.
"""

from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/gui/builder"
SLICE_DIR = OUT_DIR / "slices"
MANIFEST_PATH = ROOT / "src/build/BuilderUiImage2Slices.ts"
ATLAS_SIZE = (1024, 1024)

SLICES = {
    "project_cover_frame": {
        "rect": (0, 0, 512, 224),
        "file": "hp-builder-ui-project-cover-frame-v1.png",
        "accent": (122, 242, 255),
        "warm": (205, 160, 75),
    },
    "story_preview_panel": {
        "rect": (0, 240, 512, 224),
        "file": "hp-builder-ui-story-preview-panel-v1.png",
        "accent": (255, 205, 138),
        "warm": (205, 160, 75),
    },
    "playtest_cta_plate": {
        "rect": (0, 480, 380, 112),
        "file": "hp-builder-ui-playtest-cta-plate-v1.png",
        "accent": (112, 226, 154),
        "warm": (122, 242, 255),
    },
    "publish_badge_ready": {
        "rect": (540, 0, 184, 48),
        "file": "hp-builder-ui-publish-badge-ready-v1.png",
        "accent": (143, 230, 176),
        "warm": (122, 242, 255),
    },
    "publish_badge_warn": {
        "rect": (740, 0, 184, 48),
        "file": "hp-builder-ui-publish-badge-warn-v1.png",
        "accent": (255, 211, 109),
        "warm": (255, 157, 138),
    },
    "inspector_tab_lamp_story": {
        "rect": (540, 80, 192, 64),
        "file": "hp-builder-ui-tab-lamp-story-v1.png",
        "accent": (255, 206, 138),
        "warm": (201, 161, 79),
    },
    "inspector_tab_lamp_light": {
        "rect": (740, 80, 192, 64),
        "file": "hp-builder-ui-tab-lamp-light-v1.png",
        "accent": (159, 193, 232),
        "warm": (122, 242, 255),
    },
    "asset_card_glass": {
        "rect": (540, 176, 284, 336),
        "file": "hp-builder-ui-asset-card-glass-v1.png",
        "accent": (201, 161, 79),
        "warm": (122, 242, 255),
    },
    "lighting_mood_plate": {
        "rect": (0, 608, 380, 96),
        "file": "hp-builder-ui-lighting-mood-plate-v1.png",
        "accent": (159, 193, 232),
        "warm": (122, 242, 255),
    },
    "stage_chrome_frame": {
        "rect": (540, 528, 384, 384),
        "file": "hp-builder-ui-stage-chrome-frame-v1.png",
        "accent": (122, 242, 255),
        "warm": (201, 161, 79),
    },
    "blueprint_header_plate": {
        "rect": (0, 720, 320, 56),
        "file": "hp-builder-ui-blueprint-header-plate-v1.png",
        "accent": (201, 161, 79),
        "warm": (122, 242, 255),
    },
    "room_hud_plate": {
        "rect": (0, 792, 384, 72),
        "file": "hp-builder-ui-room-hud-plate-v1.png",
        "accent": (122, 242, 255),
        "warm": (201, 161, 79),
    },
}

CSS_VAR_BY_SLICE = {
    "project_cover_frame": "--builder-ui-project-cover-frame",
    "story_preview_panel": "--builder-ui-story-preview-panel",
    "playtest_cta_plate": "--builder-ui-playtest-cta-plate",
    "publish_badge_ready": "--builder-ui-publish-badge-ready",
    "publish_badge_warn": "--builder-ui-publish-badge-warn",
    "inspector_tab_lamp_story": "--builder-ui-tab-lamp-story",
    "inspector_tab_lamp_light": "--builder-ui-tab-lamp-light",
    "asset_card_glass": "--builder-ui-asset-card-glass",
    "lighting_mood_plate": "--builder-ui-lighting-mood-plate",
    "stage_chrome_frame": "--builder-ui-stage-chrome-frame",
    "blueprint_header_plate": "--builder-ui-blueprint-header-plate",
    "room_hud_plate": "--builder-ui-room-hud-plate",
}


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color[0], color[1], color[2], alpha


def ts_identifier(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.capitalize() for part in tail) + "Url"


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=255)
    return mask


def add_noise(img: Image.Image, opacity: int, seed: int) -> None:
    rng = random.Random(seed)
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if rng.random() > 0.12:
                continue
            r, g, b, a = pixels[x, y]
            delta = rng.randint(-18, 18)
            na = min(255, max(0, a + rng.randint(-opacity, opacity)))
            pixels[x, y] = max(0, min(255, r + delta)), max(0, min(255, g + delta)), max(0, min(255, b + delta)), na


def gradient_panel(size: tuple[int, int], base_a=(9, 13, 18), base_b=(29, 22, 12), radius=18, seed=1) -> Image.Image:
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    mask = rounded_mask(size, radius)
    for y in range(h):
        t = y / max(1, h - 1)
        for x in range(w):
            side = abs((x / max(1, w - 1)) - 0.5) * 2
            pulse = 0.08 * math.sin((x + y) * 0.018)
            r = int(lerp(base_a[0], base_b[0], t * 0.72 + side * 0.12 + pulse))
            g = int(lerp(base_a[1], base_b[1], t * 0.72 + side * 0.12 + pulse))
            b = int(lerp(base_a[2], base_b[2], t * 0.72 + side * 0.12 + pulse))
            img.putpixel((x, y), (r, g, b, 232))
    img.putalpha(mask.point(lambda v: int(v * 0.92)))
    add_noise(img, 14, seed)
    draw.rounded_rectangle((1, 1, w - 2, h - 2), radius=radius, outline=(230, 202, 138, 54), width=1)
    draw.rounded_rectangle((6, 6, w - 7, h - 7), radius=max(4, radius - 6), outline=(105, 198, 220, 32), width=1)
    for yy in range(10, h - 8, 7):
        draw.line((8, yy, w - 8, yy), fill=(255, 255, 255, 5))
    return img


def draw_corner_brackets(draw: ImageDraw.ImageDraw, w: int, h: int, color: tuple[int, int, int], alpha: int) -> None:
    c = rgba(color, alpha)
    length = min(64, max(28, w // 7))
    for sx, sy in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
        x0 = 14 if sx > 0 else w - 14
        y0 = 14 if sy > 0 else h - 14
        draw.line((x0, y0, x0 + sx * length, y0), fill=c, width=2)
        draw.line((x0, y0, x0, y0 + sy * min(length, h // 5)), fill=c, width=2)


def glow_band(size: tuple[int, int], color: tuple[int, int, int], horizontal=True, alpha=110) -> Image.Image:
    w, h = size
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer, "RGBA")
    if horizontal:
        cy = int(h * 0.35)
        draw.rectangle((w * 0.1, cy - 2, w * 0.9, cy + 2), fill=rgba(color, alpha))
    else:
        cx = int(w * 0.5)
        draw.rectangle((cx - 2, h * 0.1, cx + 2, h * 0.9), fill=rgba(color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(radius=8))


def build_stage_chrome(w: int, h: int, accent, warm) -> Image.Image:
    """Hollow chrome frame for the 2D/3D stage; applied via border-image so the
    corners stay crisp at any viewport size."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    edge = 10
    # soft edge plates
    for box in [
        (edge, edge, w - edge, edge + 5),
        (edge, h - edge - 5, w - edge, h - edge),
        (edge, edge, edge + 5, h - edge),
        (w - edge - 5, edge, w - edge, h - edge),
    ]:
        draw.rectangle(box, fill=(10, 12, 16, 150))
    draw.rectangle((edge, edge, w - edge, h - edge), outline=rgba(warm, 60), width=1)
    # corner brackets with cyan caps + rivets
    length = 88
    for sx, sy in [(1, 1), (-1, 1), (1, -1), (-1, -1)]:
        x0 = edge + 4 if sx > 0 else w - edge - 4
        y0 = edge + 4 if sy > 0 else h - edge - 4
        draw.line((x0, y0, x0 + sx * length, y0), fill=rgba(warm, 170), width=4)
        draw.line((x0, y0, x0, y0 + sy * length, ), fill=rgba(warm, 170), width=4)
        draw.line((x0 + sx * 4, y0 + sy * 8, x0 + sx * (length - 22), y0 + sy * 8), fill=rgba(accent, 90), width=2)
        draw.line((x0 + sx * 8, y0 + sy * 4, x0 + sx * 8, y0 + sy * (length - 22)), fill=rgba(accent, 90), width=2)
        draw.ellipse((x0 + sx * length - sx * 6 - 3, y0 - 3, x0 + sx * length - sx * 6 + 3, y0 + 3), fill=rgba(accent, 200))
    add_noise(img, 8, 77)
    return img


def build_slice(name: str, meta: dict) -> Image.Image:
    _, _, w, h = meta["rect"]
    accent = meta["accent"]
    warm = meta["warm"]
    seed = sum(ord(ch) for ch in name)
    if name == "stage_chrome_frame":
        return build_stage_chrome(w, h, accent, warm)
    if name == "playtest_cta_plate":
        img = gradient_panel((w, h), (8, 28, 20), (13, 54, 34), radius=18, seed=seed)
        img.alpha_composite(glow_band((w, h), accent, horizontal=True, alpha=160))
    elif name.startswith("publish_badge"):
        img = gradient_panel((w, h), (8, 13, 12), (25, 22, 11), radius=20, seed=seed)
        img.alpha_composite(glow_band((w, h), accent, horizontal=True, alpha=120))
    elif name.startswith("inspector_tab"):
        img = gradient_panel((w, h), (10, 10, 12), (42, 31, 12), radius=14, seed=seed)
        img.alpha_composite(glow_band((w, h), accent, horizontal=True, alpha=125))
    elif name == "asset_card_glass":
        img = gradient_panel((w, h), (11, 10, 7), (25, 19, 10), radius=18, seed=seed)
        img.alpha_composite(glow_band((w, h), warm, horizontal=True, alpha=60))
    elif name == "lighting_mood_plate":
        img = gradient_panel((w, h), (9, 12, 18), (16, 22, 32), radius=12, seed=seed)
        img.alpha_composite(glow_band((w, h), accent, horizontal=True, alpha=70))
    elif name == "blueprint_header_plate":
        img = gradient_panel((w, h), (12, 10, 7), (26, 20, 11), radius=10, seed=seed)
        img.alpha_composite(glow_band((w, h), warm, horizontal=True, alpha=66))
    elif name == "room_hud_plate":
        img = gradient_panel((w, h), (8, 10, 13), (20, 17, 10), radius=14, seed=seed)
        img.alpha_composite(glow_band((w, h), accent, horizontal=True, alpha=80))
    else:
        img = gradient_panel((w, h), seed=seed)
        img.alpha_composite(glow_band((w, h), accent, horizontal=True, alpha=80))
    draw = ImageDraw.Draw(img, "RGBA")
    draw_corner_brackets(draw, w, h, accent, 92)
    inset = 11
    draw.rounded_rectangle((inset, inset, w - inset, h - inset), radius=9, outline=rgba(warm, 48), width=1)
    if name == "project_cover_frame":
        draw.polygon([(0, 0), (w * 0.22, 0), (0, h * 0.42)], fill=(122, 242, 255, 18))
        draw.polygon([(w, h), (w * 0.78, h), (w, h * 0.55)], fill=(205, 160, 75, 14))
    if name == "story_preview_panel":
        for idx in range(4):
            yy = 54 + idx * 34
            draw.line((36, yy, w - 36, yy), fill=rgba(warm, 40), width=1)
    if name == "asset_card_glass":
        draw.ellipse((w * 0.2, h * 0.05, w * 0.8, h * 0.36), outline=rgba(accent, 24), width=2)
        draw.rectangle((18, int(h * 0.64), w - 18, int(h * 0.65)), fill=rgba(warm, 38))
    if name == "lighting_mood_plate":
        # dimmer-desk feel: slider track grooves + tiny tick marks
        for idx in range(3):
            yy = 26 + idx * 22
            draw.line((28, yy, w - 28, yy), fill=rgba(accent, 30), width=2)
            draw.line((28 + idx * 40, yy - 4, 28 + idx * 40, yy + 4), fill=rgba(warm, 60), width=2)
    if name == "blueprint_header_plate":
        for xx in range(24, w - 24, 14):
            draw.line((xx, h - 12, xx + 7, h - 12), fill=rgba(warm, 44), width=1)
    if name == "room_hud_plate":
        draw.line((20, h - 14, w - 20, h - 14), fill=rgba(accent, 64), width=1)
        draw.line((20, 13, 96, 13), fill=rgba(warm, 56), width=2)
    return img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SLICE_DIR.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    manifest = {
        "atlas": "hp-builder-ui-image2-atlas-v1.png",
        "atlasSize": ATLAS_SIZE,
        "slices": {},
    }
    for name, meta in SLICES.items():
        x, y, w, h = meta["rect"]
        image = build_slice(name, meta)
        atlas.alpha_composite(image, dest=(x, y))
        image.save(SLICE_DIR / meta["file"])
        manifest["slices"][name] = {
            "x": x,
            "y": y,
            "w": w,
            "h": h,
            "file": f"slices/{meta['file']}",
        }
    atlas.save(OUT_DIR / manifest["atlas"])
    (OUT_DIR / "builder-ui-image2-atlas-v1.manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    ts_lines = [
        "// Generated by scripts/asset-build/generate-builder-ui-image2-atlas.py.",
    ]
    for name, data in manifest["slices"].items():
        ts_lines.append(f'import {ts_identifier(name)} from "../assets/gui/builder/{data["file"]}";')
    ts_lines.extend([
        "",
        "export const builderUiImage2Atlas = {",
        f'  file: "{manifest["atlas"]}",',
        f"  width: {ATLAS_SIZE[0]},",
        f"  height: {ATLAS_SIZE[1]},",
        "  slices: {",
    ])
    for name, data in manifest["slices"].items():
        ts_lines.append(
            f'    {name}: {{ x: {data["x"]}, y: {data["y"]}, w: {data["w"]}, h: {data["h"]}, file: "{data["file"]}" }},'
        )
    ts_lines.extend([
        "  },",
        "} as const;",
        "",
        "export type BuilderUiImage2SliceName = keyof typeof builderUiImage2Atlas.slices;",
        "",
        "export const builderUiImage2SliceUrls = {",
    ])
    for name in manifest["slices"]:
        ts_lines.append(f"  {name}: {ts_identifier(name)},")
    ts_lines.extend([
        "} as const;",
        "",
        "export const builderUiImage2CssVars = {",
    ])
    for name in manifest["slices"]:
        css_var = CSS_VAR_BY_SLICE[name]
        ts_lines.append(f'  "{css_var}": `url("${{{ts_identifier(name)}}}")`,')
    ts_lines.extend([
        "} as const;",
        "",
    ])
    MANIFEST_PATH.write_text("\n".join(ts_lines) + "\n")
    print(f"wrote {OUT_DIR / manifest['atlas']}")
    print(f"wrote {len(SLICES)} slices to {SLICE_DIR}")
    print(f"wrote {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
