#!/usr/bin/env python3
"""Generate text-free Image2 GUI kits for Human Protocol Level 06-10.

Each kit follows the route-switch contract already used by the runtime:
  - one dark background board
  - one transparent parts atlas
  - one regions json with [x, y, w, h] atlas cuts

The output intentionally contains no baked UI text. React/CSS/runtime state
should provide language, labels, counters, and puzzle answers.

Outputs:
  src/assets/gui/level06/frozen_archive_background_image2.png
  src/assets/gui/level06/frozen_archive_parts_image2.png
  src/assets/gui/level06/frozen_archive_parts_image2.regions.json
  ... same pattern for level07/08/09/10 ...
  src/assets/gui/level06-10-gui-image2-manifest.json
  src/assets/gui/level06-10-gui-image2-contact-sheet.png

Run:
  python3 scripts/asset-build/generate-level06-10-gui-image2.py
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT_ROOT = ROOT / "src/assets/gui"
ATLAS_SIZE = (2048, 2048)
BACKGROUND_SIZE = (1280, 720)
PADDING = 18


Color = tuple[int, int, int]
RGBA = tuple[int, int, int, int]


@dataclass(frozen=True)
class Palette:
    base_a: Color
    base_b: Color
    accent: Color
    accent_hi: Color
    warm: Color
    danger: Color
    muted: Color


@dataclass(frozen=True)
class Kit:
    level: str
    slug: str
    label: str
    role: str
    special: str
    palette: Palette
    state_names: tuple[str, ...]

    @property
    def out_dir(self) -> Path:
        return OUT_ROOT / self.level

    @property
    def background_file(self) -> str:
        return f"{self.slug}_background_image2.png"

    @property
    def parts_file(self) -> str:
        return f"{self.slug}_parts_image2.png"

    @property
    def regions_file(self) -> str:
        return f"{self.slug}_parts_image2.regions.json"


KITS: tuple[Kit, ...] = (
    Kit(
        level="level06",
        slug="frozen_archive",
        label="Frozen Archive Terminal",
        role="cryo-record puzzle terminal",
        special="waveform",
        state_names=("locked", "active", "solved", "error"),
        palette=Palette(
            base_a=(9, 17, 22),
            base_b=(30, 43, 48),
            accent=(102, 225, 244),
            accent_hi=(198, 250, 255),
            warm=(212, 229, 224),
            danger=(244, 105, 95),
            muted=(82, 107, 112),
        ),
    ),
    Kit(
        level="level07",
        slug="transit_route_switch",
        label="Transit Route Switch",
        role="route-switch rail console",
        special="route_map",
        state_names=("locked", "active", "solved", "disabled"),
        palette=Palette(
            base_a=(16, 15, 12),
            base_b=(44, 34, 18),
            accent=(104, 221, 235),
            accent_hi=(180, 248, 255),
            warm=(244, 173, 66),
            danger=(238, 88, 72),
            muted=(112, 100, 80),
        ),
    ),
    Kit(
        level="level08",
        slug="identity_playback",
        label="Identity Playback Terminal",
        role="memory-theater choice terminal",
        special="portrait",
        state_names=("locked", "active", "choice", "solved"),
        palette=Palette(
            base_a=(9, 9, 12),
            base_b=(34, 26, 15),
            accent=(120, 207, 235),
            accent_hi=(184, 238, 255),
            warm=(224, 169, 82),
            danger=(226, 92, 72),
            muted=(96, 86, 76),
        ),
    ),
    Kit(
        level="level09",
        slug="lockdown_override",
        label="Lockdown Override",
        role="containment pressure console",
        special="pressure",
        state_names=("locked", "active", "danger", "solved"),
        palette=Palette(
            base_a=(17, 10, 10),
            base_b=(46, 18, 16),
            accent=(116, 222, 238),
            accent_hi=(190, 250, 255),
            warm=(229, 143, 65),
            danger=(245, 71, 60),
            muted=(114, 76, 72),
        ),
    ),
    Kit(
        level="level10",
        slug="final_protocol",
        label="Final Protocol Console",
        role="core terminal final sync",
        special="protocol_ring",
        state_names=("locked", "active", "choice", "solved"),
        palette=Palette(
            base_a=(5, 8, 12),
            base_b=(16, 25, 34),
            accent=(72, 229, 255),
            accent_hi=(180, 252, 255),
            warm=(174, 154, 101),
            danger=(232, 76, 84),
            muted=(74, 92, 106),
        ),
    ),
)


def rgba(color: Color, alpha: int) -> RGBA:
    return color[0], color[1], color[2], max(0, min(255, alpha))


def mix(a: Color, b: Color, t: float) -> Color:
    return (
        int(a[0] + (b[0] - a[0]) * t),
        int(a[1] + (b[1] - a[1]) * t),
        int(a[2] + (b[2] - a[2]) * t),
    )


def new_rgba(size: tuple[int, int]) -> Image.Image:
    return Image.new("RGBA", size, (0, 0, 0, 0))


def rounded_mask(size: tuple[int, int], radius: int, fill: int = 245) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius=radius, fill=fill)
    return mask


def add_noise(img: Image.Image, seed: int, density: float = 0.08, strength: int = 12) -> None:
    rng = random.Random(seed)
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if rng.random() > density:
                continue
            r, g, b, a = pixels[x, y]
            delta = rng.randint(-strength, strength)
            pixels[x, y] = (
                max(0, min(255, r + delta)),
                max(0, min(255, g + delta)),
                max(0, min(255, b + delta)),
                a,
            )


def chamfer_points(w: int, h: int, inset: int, chamfer: int) -> list[tuple[int, int]]:
    return [
        (inset + chamfer, inset),
        (w - inset - chamfer, inset),
        (w - inset, inset + chamfer),
        (w - inset, h - inset - chamfer),
        (w - inset - chamfer, h - inset),
        (inset + chamfer, h - inset),
        (inset, h - inset - chamfer),
        (inset, inset + chamfer),
    ]


def soft_glow(size: tuple[int, int], draw_fn, radius: float) -> Image.Image:
    layer = new_rgba(size)
    draw_fn(ImageDraw.Draw(layer, "RGBA"))
    return layer.filter(ImageFilter.GaussianBlur(radius=radius))


def draw_corner_brackets(draw: ImageDraw.ImageDraw, w: int, h: int, kit: Kit) -> None:
    p = kit.palette
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        x0 = 42 if sx > 0 else w - 42
        y0 = 42 if sy > 0 else h - 42
        draw.line((x0, y0, x0 + sx * 128, y0), fill=rgba(p.warm, 130), width=4)
        draw.line((x0, y0, x0, y0 + sy * 86), fill=rgba(p.warm, 130), width=4)
        draw.line((x0 + sx * 12, y0 + sy * 12, x0 + sx * 94, y0 + sy * 12), fill=rgba(p.accent, 88), width=2)
        draw.line((x0 + sx * 12, y0 + sy * 12, x0 + sx * 12, y0 + sy * 68), fill=rgba(p.accent, 88), width=2)
        draw.ellipse((x0 - 4, y0 - 4, x0 + 4, y0 + 4), fill=rgba(p.accent_hi, 160))


def draw_background(kit: Kit) -> Image.Image:
    w, h = BACKGROUND_SIZE
    p = kit.palette
    img = new_rgba(BACKGROUND_SIZE)
    mask = rounded_mask(BACKGROUND_SIZE, 34, 248)
    for y in range(h):
        yy = y / max(1, h - 1)
        for x in range(w):
            xx = x / max(1, w - 1)
            edge = abs(xx - 0.5) * 1.5
            pulse = math.sin(x * 0.012 + y * 0.017) * 0.045
            color = mix(p.base_a, p.base_b, min(1.0, yy * 0.65 + edge * 0.25 + pulse))
            img.putpixel((x, y), rgba(color, mask.getpixel((x, y))))

    add_noise(img, seed=101 + len(kit.slug), density=0.065, strength=11)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=34, outline=rgba(p.accent, 88), width=2)
    draw.rounded_rectangle((16, 16, w - 17, h - 17), radius=24, outline=rgba(p.warm, 54), width=1)
    draw.rounded_rectangle((36, 118, w - 37, h - 42), radius=18, outline=rgba(p.accent, 36), width=1)

    for yy in range(38, h - 32, 8):
        alpha = 13 if yy % 32 == 0 else 5
        draw.line((38, yy, w - 38, yy), fill=rgba(p.accent, alpha), width=1)

    draw_corner_brackets(draw, w, h, kit)

    if kit.special == "waveform":
        draw_frost_background_motif(draw, kit, w, h)
    elif kit.special == "route_map":
        draw_route_background_motif(draw, kit, w, h)
    elif kit.special == "portrait":
        draw_gallery_background_motif(draw, kit, w, h)
    elif kit.special == "pressure":
        draw_lockdown_background_motif(draw, kit, w, h)
    elif kit.special == "protocol_ring":
        draw_protocol_background_motif(draw, kit, w, h)

    glow = new_rgba(BACKGROUND_SIZE)
    gdraw = ImageDraw.Draw(glow, "RGBA")
    gdraw.ellipse((w * 0.06, h * 0.12, w * 0.5, h * 0.88), fill=rgba(p.warm, 22))
    gdraw.ellipse((w * 0.46, h * 0.1, w * 0.96, h * 0.92), fill=rgba(p.accent, 24))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius=52)))
    return img


def draw_frost_background_motif(draw: ImageDraw.ImageDraw, kit: Kit, w: int, h: int) -> None:
    p = kit.palette
    for i in range(8):
        x = 120 + i * 130
        draw.line((x, 152, x + 42, 204), fill=rgba(p.accent_hi, 24), width=2)
        draw.line((x + 42, 152, x, 204), fill=rgba(p.accent_hi, 18), width=2)
    for y in (132, h - 82):
        draw.line((100, y, w - 100, y), fill=rgba(p.warm, 64), width=3)
        draw.line((100, y + 8, w - 100, y + 8), fill=rgba(p.accent, 28), width=1)


def draw_route_background_motif(draw: ImageDraw.ImageDraw, kit: Kit, w: int, h: int) -> None:
    p = kit.palette
    for i in range(9):
        y = 180 + i * 44
        draw.line((88, y, w - 88, y + (i % 3 - 1) * 18), fill=rgba(p.warm, 28), width=3)
    for i in range(7):
        x = 150 + i * 150
        draw.ellipse((x - 8, 340 - 8, x + 8, 340 + 8), fill=rgba(p.accent, 80))
    for x in range(72, w - 72, 96):
        draw.polygon(((x, h - 88), (x + 36, h - 88), (x + 14, h - 52), (x - 22, h - 52)), fill=rgba(p.warm, 34))


def draw_gallery_background_motif(draw: ImageDraw.ImageDraw, kit: Kit, w: int, h: int) -> None:
    p = kit.palette
    for x in range(130, w - 130, 190):
        draw.rounded_rectangle((x, 186, x + 116, 482), radius=10, outline=rgba(p.warm, 42), width=2)
        draw.line((x + 18, 214, x + 98, 214), fill=rgba(p.accent, 24), width=1)
    draw.line((96, 140, w - 96, 140), fill=rgba(p.warm, 78), width=3)
    draw.line((96, h - 78, w - 96, h - 78), fill=rgba(p.warm, 62), width=2)


def draw_lockdown_background_motif(draw: ImageDraw.ImageDraw, kit: Kit, w: int, h: int) -> None:
    p = kit.palette
    for x in range(80, w - 60, 78):
        draw.polygon(((x, 134), (x + 38, 134), (x + 14, 164), (x - 24, 164)), fill=rgba(p.danger, 52))
        draw.polygon(((x, h - 96), (x + 38, h - 96), (x + 14, h - 60), (x - 24, h - 60)), fill=rgba(p.danger, 42))
    for i in range(5):
        x = 180 + i * 210
        draw.rounded_rectangle((x, 208, x + 76, 492), radius=26, outline=rgba(p.muted, 50), width=3)
        draw.ellipse((x + 16, 230, x + 60, 274), outline=rgba(p.danger, 70), width=3)


def draw_protocol_background_motif(draw: ImageDraw.ImageDraw, kit: Kit, w: int, h: int) -> None:
    p = kit.palette
    cx, cy = w // 2, h // 2 + 24
    for r, alpha in ((250, 34), (190, 48), (126, 72)):
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba(p.accent, alpha), width=2)
    for i in range(12):
        a = i / 12 * math.tau
        x0 = cx + math.cos(a) * 142
        y0 = cy + math.sin(a) * 142
        x1 = cx + math.cos(a) * 236
        y1 = cy + math.sin(a) * 236
        draw.line((x0, y0, x1, y1), fill=rgba(p.accent_hi, 38), width=2)


def draw_frame_corner(kit: Kit, quadrant: str) -> Image.Image:
    size = (176, 176)
    p = kit.palette
    img = new_rgba(size)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.polygon(((0, 0), (176, 0), (176, 44), (62, 44), (44, 62), (44, 176), (0, 176)), fill=rgba(p.base_b, 224))
    draw.line((176, 44, 62, 44, 44, 62, 44, 176), fill=rgba(p.warm, 170), width=5)
    draw.line((2, 0, 2, 176), fill=rgba(p.accent, 90), width=2)
    draw.line((0, 2, 176, 2), fill=rgba(p.accent, 90), width=2)
    draw.line((132, 26, 74, 26, 26, 74, 26, 132), fill=rgba(p.accent_hi, 110), width=2)
    draw.ellipse((70, 70, 86, 86), fill=rgba(p.accent_hi, 190))
    if quadrant == "tr":
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    elif quadrant == "bl":
        img = img.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    elif quadrant == "br":
        img = img.transpose(Image.Transpose.FLIP_LEFT_RIGHT).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    return img


def draw_plate(kit: Kit, size: tuple[int, int], edge: Color | None = None, fill_t: float = 0.55, glow: Color | None = None) -> Image.Image:
    w, h = size
    p = kit.palette
    edge = edge or p.accent
    fill = mix(p.base_a, p.base_b, fill_t)
    img = new_rgba(size)
    if glow:
        img.alpha_composite(
            soft_glow(
                size,
                lambda d: d.polygon(chamfer_points(w, h, 12, 24), outline=rgba(glow, 190), width=8),
                8,
            )
        )
    draw = ImageDraw.Draw(img, "RGBA")
    poly = chamfer_points(w, h, 10, 24)
    draw.polygon(poly, fill=rgba(fill, 230))
    draw.line(poly[7:] + poly[:2], fill=rgba(p.accent_hi, 92), width=2)
    draw.polygon(poly, outline=rgba(edge, 145), width=4)
    draw.polygon(chamfer_points(w, h, 24, 18), outline=rgba(p.warm, 58), width=1)
    for yy in range(26, h - 20, 7):
        draw.line((30, yy, w - 30, yy), fill=rgba(p.accent, 6), width=1)
    add_noise(img, seed=w * 13 + h, density=0.045, strength=8)
    return img


def draw_text_band(kit: Kit) -> Image.Image:
    w, h = 520, 72
    p = kit.palette
    img = new_rgba((w, h))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=12, fill=rgba((4, 7, 10), 176), outline=rgba(p.accent, 58), width=1)
    draw.line((18, h - 14, w - 18, h - 14), fill=rgba(p.warm, 54), width=2)
    draw.rectangle((20, 16, 128, 24), fill=rgba(p.accent, 52))
    draw.rectangle((148, 16, 256, 24), fill=rgba(p.muted, 42))
    return img


def draw_button(kit: Kit, state: str) -> Image.Image:
    edge = {
        "enabled": kit.palette.accent,
        "disabled": kit.palette.muted,
        "selected": kit.palette.warm,
    }[state]
    fill_t = 0.5 if state != "selected" else 0.72
    glow = kit.palette.warm if state == "selected" else None
    alpha_img = draw_plate(kit, (256, 76), edge=edge, fill_t=fill_t, glow=glow)
    if state == "disabled":
        overlay = new_rgba(alpha_img.size)
        ImageDraw.Draw(overlay, "RGBA").rounded_rectangle((8, 8, 248, 68), radius=10, fill=(50, 54, 58, 70))
        alpha_img.alpha_composite(overlay)
    return alpha_img


def draw_status_icon(kit: Kit, state: str) -> Image.Image:
    size = (104, 104)
    p = kit.palette
    color = {
        "locked": p.muted,
        "active": p.accent,
        "solved": p.accent_hi,
        "error": p.danger,
        "disabled": p.muted,
        "choice": p.warm,
        "danger": p.danger,
    }.get(state, p.accent)
    img = new_rgba(size)
    img.alpha_composite(
        soft_glow(
            size,
            lambda d: d.ellipse((18, 18, 86, 86), outline=rgba(color, 210), width=8),
            7,
        )
    )
    draw = ImageDraw.Draw(img, "RGBA")
    draw.ellipse((14, 14, 90, 90), fill=rgba(p.base_b, 218), outline=rgba(color, 190), width=4)
    cx, cy = 52, 52
    if state == "locked" or state == "disabled":
        draw.rounded_rectangle((34, 48, 70, 74), radius=6, outline=rgba(color, 220), width=5)
        draw.arc((36, 28, 68, 60), 180, 360, fill=rgba(color, 220), width=5)
    elif state == "solved":
        draw.line((28, 54, 45, 70, 76, 34), fill=rgba(color, 238), width=8)
    elif state == "error" or state == "danger":
        draw.polygon(((52, 24), (80, 76), (24, 76)), outline=rgba(color, 238), fill=rgba(color, 42))
        draw.line((52, 42, 52, 60), fill=rgba(color, 238), width=6)
        draw.ellipse((49, 66, 55, 72), fill=rgba(color, 238))
    elif state == "choice":
        for i, x in enumerate((32, 52, 72)):
            draw.rounded_rectangle((x - 9, 34 + i * 4, x + 9, 72 - i * 3), radius=5, outline=rgba(color, 220), width=4)
    else:
        # active pulse
        for i in range(3):
            r = 12 + i * 11
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba(color, 95 - i * 20), width=3)
        draw.ellipse((44, 44, 60, 60), fill=rgba(color, 230))
    return img


def draw_progress_track(kit: Kit, fill: bool = False) -> Image.Image:
    w, h = 460, 44
    p = kit.palette
    img = new_rgba((w, h))
    draw = ImageDraw.Draw(img, "RGBA")
    edge = p.accent if not fill else p.accent_hi
    body = (8, 12, 16) if not fill else p.accent
    alpha = 208 if not fill else 180
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=15, fill=rgba(body, alpha), outline=rgba(edge, 114), width=2)
    for x in range(20, w - 20, 28):
        draw.line((x, 8, x - 12, h - 8), fill=rgba(p.warm if fill else p.muted, 40), width=3)
    return img


def draw_key_slot(kit: Kit, full: bool) -> Image.Image:
    p = kit.palette
    img = draw_plate(kit, (76, 64), edge=p.accent_hi if full else p.muted, fill_t=0.35, glow=p.accent if full else None)
    draw = ImageDraw.Draw(img, "RGBA")
    if full:
        draw.rectangle((22, 18, 54, 46), fill=rgba(p.accent_hi, 190))
        draw.rectangle((29, 25, 47, 39), fill=rgba(p.base_a, 130))
    else:
        draw.rectangle((22, 18, 54, 46), outline=rgba(p.muted, 120), width=3)
    return img


def draw_lock_overlay(kit: Kit) -> Image.Image:
    w, h = 520, 300
    p = kit.palette
    img = new_rgba((w, h))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=22, fill=(18, 20, 23, 134), outline=rgba(p.muted, 82), width=2)
    for x in range(-60, w + 80, 48):
        draw.line((x, 0, x + 180, h), fill=rgba(p.muted, 36), width=12)
    return img


def draw_scanline_strip(kit: Kit) -> Image.Image:
    w, h = 420, 90
    p = kit.palette
    img = new_rgba((w, h))
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(8, h, 8):
        alpha = 28 if y % 24 == 0 else 12
        draw.line((10, y, w - 10, y), fill=rgba(p.accent, alpha), width=1)
    draw.rectangle((20, 38, w - 20, 44), fill=rgba(p.accent_hi, 86))
    return img.filter(ImageFilter.GaussianBlur(radius=0.45))


def draw_hero_display(kit: Kit) -> Image.Image:
    if kit.special == "waveform":
        return draw_waveform_display(kit)
    if kit.special == "route_map":
        return draw_route_map_display(kit)
    if kit.special == "portrait":
        return draw_portrait_display(kit)
    if kit.special == "pressure":
        return draw_pressure_display(kit)
    return draw_protocol_ring_display(kit)


def draw_waveform_display(kit: Kit) -> Image.Image:
    w, h = 420, 220
    p = kit.palette
    img = draw_plate(kit, (w, h), edge=p.accent, fill_t=0.35, glow=p.accent)
    draw = ImageDraw.Draw(img, "RGBA")
    baseline = h // 2
    points = []
    for x in range(36, w - 36, 8):
        t = x / 28
        amp = math.sin(t) * 34 + math.sin(t * 2.7) * 12
        points.append((x, baseline + amp))
    draw.line(points, fill=rgba(p.accent_hi, 220), width=4)
    for x in range(64, w - 56, 70):
        draw.line((x, 44, x, h - 42), fill=rgba(p.warm, 34), width=2)
    for i in range(6):
        cx = 70 + i * 54
        cy = 56 + (i % 2) * 108
        draw.line((cx - 14, cy, cx + 14, cy), fill=rgba(p.accent_hi, 90), width=2)
        draw.line((cx, cy - 14, cx, cy + 14), fill=rgba(p.accent_hi, 90), width=2)
    return img


def draw_route_map_display(kit: Kit) -> Image.Image:
    w, h = 420, 220
    p = kit.palette
    img = draw_plate(kit, (w, h), edge=p.warm, fill_t=0.42, glow=p.warm)
    draw = ImageDraw.Draw(img, "RGBA")
    nodes = [(60, 156), (134, 84), (212, 130), (286, 70), (354, 150)]
    for a, b in zip(nodes, nodes[1:]):
        draw.line((a[0], a[1], b[0], b[1]), fill=rgba(p.warm, 156), width=6)
        draw.line((a[0], a[1], b[0], b[1]), fill=rgba(p.accent, 80), width=2)
    draw.line((134, 84, 118, 156), fill=rgba(p.muted, 90), width=4)
    draw.line((212, 130, 208, 52), fill=rgba(p.muted, 90), width=4)
    for i, (x, y) in enumerate(nodes):
        col = p.accent_hi if i in (0, 2, 4) else p.warm
        draw.ellipse((x - 14, y - 14, x + 14, y + 14), fill=rgba(col, 210), outline=rgba(p.base_a, 180), width=3)
    return img


def draw_portrait_display(kit: Kit) -> Image.Image:
    w, h = 420, 220
    p = kit.palette
    img = draw_plate(kit, (w, h), edge=p.warm, fill_t=0.36, glow=p.warm)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((34, 30, 166, 190), radius=18, outline=rgba(p.warm, 120), width=3)
    draw.ellipse((78, 58, 122, 102), outline=rgba(p.accent_hi, 130), width=3)
    draw.arc((58, 96, 142, 168), 200, 340, fill=rgba(p.accent_hi, 110), width=4)
    for i in range(3):
        x0 = 204 + i * 58
        draw.rounded_rectangle((x0, 54, x0 + 44, 150), radius=8, outline=rgba(p.warm if i == 1 else p.muted, 116), width=3)
        draw.line((x0 + 8, 170, x0 + 36, 170), fill=rgba(p.accent, 70), width=3)
    return img


def draw_pressure_display(kit: Kit) -> Image.Image:
    w, h = 420, 220
    p = kit.palette
    img = draw_plate(kit, (w, h), edge=p.danger, fill_t=0.4, glow=p.danger)
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy, r = 126, 116, 72
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba(p.danger, 174), width=6)
    for i in range(11):
        a = math.radians(210 + i * 12)
        x0 = cx + math.cos(a) * (r - 12)
        y0 = cy + math.sin(a) * (r - 12)
        x1 = cx + math.cos(a) * r
        y1 = cy + math.sin(a) * r
        draw.line((x0, y0, x1, y1), fill=rgba(p.warm, 100), width=2)
    a = math.radians(322)
    draw.line((cx, cy, cx + math.cos(a) * 54, cy + math.sin(a) * 54), fill=rgba(p.danger, 230), width=5)
    for i in range(5):
        y = 58 + i * 28
        draw.rounded_rectangle((228, y, 368, y + 14), radius=6, fill=rgba(p.danger if i > 2 else p.warm, 70 + i * 18))
    return img


def draw_protocol_ring_display(kit: Kit) -> Image.Image:
    w, h = 420, 220
    p = kit.palette
    img = draw_plate(kit, (w, h), edge=p.accent, fill_t=0.32, glow=p.accent)
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy = 130, 110
    for r, alpha in ((82, 120), (58, 180), (32, 220)):
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba(p.accent_hi, alpha), width=4)
    for i in range(10):
        a = i / 10 * math.tau
        x = cx + math.cos(a) * 74
        y = cy + math.sin(a) * 74
        draw.rectangle((x - 5, y - 5, x + 5, y + 5), fill=rgba(p.accent_hi if i % 3 == 0 else p.accent, 190))
    for i in range(6):
        x = 236 + (i % 3) * 48
        y = 74 + (i // 3) * 58
        draw.rounded_rectangle((x, y, x + 34, y + 34), radius=6, outline=rgba(p.accent if i < 4 else p.muted, 128), width=3)
    return img


def draw_detail_strip(kit: Kit) -> Image.Image:
    w, h = 420, 86
    p = kit.palette
    img = new_rgba((w, h))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=12, fill=rgba(p.base_b, 176), outline=rgba(p.warm, 70), width=1)
    if kit.special == "route_map":
        for i in range(5):
            x = 44 + i * 78
            draw.line((x, 20, x + 44, 66), fill=rgba(p.warm, 90), width=3)
            draw.ellipse((x - 6, 37, x + 6, 49), fill=rgba(p.accent, 156))
    elif kit.special == "pressure":
        for x in range(20, w - 20, 42):
            draw.polygon(((x, 14), (x + 22, 14), (x + 8, 72), (x - 14, 72)), fill=rgba(p.danger, 72))
    elif kit.special == "protocol_ring":
        for i in range(8):
            draw.rounded_rectangle((28 + i * 46, 26, 58 + i * 46, 58), radius=5, outline=rgba(p.accent_hi if i < 5 else p.muted, 118), width=2)
    elif kit.special == "portrait":
        for i in range(3):
            x = 42 + i * 118
            draw.rounded_rectangle((x, 18, x + 84, 66), radius=8, outline=rgba(p.warm, 100), width=2)
            draw.line((x + 14, 34, x + 70, 34), fill=rgba(p.accent, 44), width=2)
    else:
        baseline = 44
        points = [(x, baseline + math.sin(x / 16) * 18) for x in range(28, w - 28, 8)]
        draw.line(points, fill=rgba(p.accent_hi, 144), width=3)
    return img


def pack_slices(slices: dict[str, Image.Image]) -> tuple[Image.Image, dict[str, list[int]]]:
    atlas = new_rgba(ATLAS_SIZE)
    regions: dict[str, list[int]] = {}
    x = PADDING
    y = PADDING
    row_h = 0
    for name, image in slices.items():
        w, h = image.size
        if x + w + PADDING > ATLAS_SIZE[0]:
            x = PADDING
            y += row_h + PADDING
            row_h = 0
        if y + h + PADDING > ATLAS_SIZE[1]:
            raise RuntimeError(f"Atlas overflow while packing {name} ({w}x{h})")
        atlas.alpha_composite(image, (x, y))
        regions[name] = [x, y, w, h]
        x += w + PADDING
        row_h = max(row_h, h)
    return atlas, regions


def make_slices(kit: Kit) -> dict[str, Image.Image]:
    slices: dict[str, Image.Image] = {
        "frame_corner_tl": draw_frame_corner(kit, "tl"),
        "frame_corner_tr": draw_frame_corner(kit, "tr"),
        "frame_corner_bl": draw_frame_corner(kit, "bl"),
        "frame_corner_br": draw_frame_corner(kit, "br"),
        "panel_plate": draw_plate(kit, (520, 300), edge=kit.palette.accent, fill_t=0.38, glow=kit.palette.accent),
        "text_safe_band": draw_text_band(kit),
        "button_enabled": draw_button(kit, "enabled"),
        "button_disabled": draw_button(kit, "disabled"),
        "button_selected": draw_button(kit, "selected"),
        "progress_track": draw_progress_track(kit, fill=False),
        "progress_fill": draw_progress_track(kit, fill=True),
        "key_slot_empty": draw_key_slot(kit, full=False),
        "key_slot_full": draw_key_slot(kit, full=True),
        "lock_overlay": draw_lock_overlay(kit),
        "scanline_strip": draw_scanline_strip(kit),
        "hero_display": draw_hero_display(kit),
        "detail_strip": draw_detail_strip(kit),
    }
    for state in kit.state_names:
        icon_state = "error" if state == "error" else state
        slices[f"status_{state}"] = draw_status_icon(kit, icon_state)
    # Ensure common status names exist even when a kit does not expose that state.
    for state in ("locked", "active", "solved", "disabled", "danger", "choice", "error"):
        slices.setdefault(f"status_{state}", draw_status_icon(kit, state))
    return slices


def write_kit(kit: Kit) -> dict[str, object]:
    kit.out_dir.mkdir(parents=True, exist_ok=True)
    background = draw_background(kit)
    slices = make_slices(kit)
    atlas, regions = pack_slices(slices)

    background_path = kit.out_dir / kit.background_file
    atlas_path = kit.out_dir / kit.parts_file
    regions_path = kit.out_dir / kit.regions_file

    background.save(background_path)
    atlas.save(atlas_path)
    payload = {
        "schemaVersion": "hp.image2.gui.regions.v1",
        "kitId": f"{kit.level}_{kit.slug}",
        "label": kit.label,
        "role": kit.role,
        "special": kit.special,
        "textPolicy": "No baked gameplay text; React/CSS/runtime owns all language and puzzle answers.",
        "atlasSize": list(ATLAS_SIZE),
        "backgroundSize": list(BACKGROUND_SIZE),
        "background": str(background_path.relative_to(ROOT)),
        "parts": str(atlas_path.relative_to(ROOT)),
        "regions": regions,
        "stateRegions": {
            state: [f"status_{state}", "text_safe_band", "hero_display", "progress_track"]
            for state in kit.state_names
        },
        "recommendedRuntimeLayers": [
            "background",
            "panel_plate",
            "hero_display",
            "detail_strip",
            "status_*",
            "text_safe_band",
            "button_*",
            "progress_*",
            "lock_overlay when unauthorized",
        ],
    }
    regions_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {background_path.relative_to(ROOT)}")
    print(f"wrote {atlas_path.relative_to(ROOT)}")
    print(f"wrote {regions_path.relative_to(ROOT)}")
    return {
        "kitId": payload["kitId"],
        "label": kit.label,
        "role": kit.role,
        "level": kit.level,
        "special": kit.special,
        "states": list(kit.state_names),
        "background": payload["background"],
        "parts": payload["parts"],
        "regions": str(regions_path.relative_to(ROOT)),
    }


def make_contact_sheet(entries: list[dict[str, object]]) -> None:
    thumb_w, thumb_h = 360, 202
    atlas_w, atlas_h = 242, 242
    row_h = 300
    width = 1320
    height = 90 + row_h * len(entries)
    sheet = Image.new("RGBA", (width, height), (8, 10, 13, 255))
    draw = ImageDraw.Draw(sheet, "RGBA")
    draw.text((28, 24), "Human Protocol Level 06-10 Image2 GUI Kits", fill=(220, 235, 238, 255))
    draw.text((28, 48), "Text-free backgrounds + transparent parts atlases + regions JSON", fill=(138, 160, 168, 255))
    for idx, entry in enumerate(entries):
        y = 84 + idx * row_h
        background = Image.open(ROOT / str(entry["background"])).convert("RGBA")
        parts = Image.open(ROOT / str(entry["parts"])).convert("RGBA")
        bg_thumb = background.resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
        parts_thumb = parts.resize((atlas_w, atlas_h), Image.Resampling.LANCZOS)
        draw.rounded_rectangle((24, y - 8, width - 24, y + row_h - 18), radius=16, fill=(13, 18, 23, 255), outline=(82, 106, 116, 140), width=1)
        sheet.alpha_composite(bg_thumb, (44, y + 36))
        sheet.alpha_composite(parts_thumb, (444, y + 16))
        draw.text((720, y + 24), str(entry["kitId"]), fill=(198, 238, 246, 255))
        draw.text((720, y + 52), str(entry["label"]), fill=(232, 204, 138, 255))
        draw.text((720, y + 80), f"role: {entry['role']}", fill=(150, 170, 176, 255))
        draw.text((720, y + 108), f"states: {', '.join(entry['states'])}", fill=(150, 170, 176, 255))
        draw.text((720, y + 136), f"regions: {entry['regions']}", fill=(118, 142, 150, 255))
    out = OUT_ROOT / "level06-10-gui-image2-contact-sheet.png"
    sheet.save(out)
    print(f"wrote {out.relative_to(ROOT)}")


def main() -> None:
    entries = [write_kit(kit) for kit in KITS]
    manifest = {
        "schemaVersion": "hp.level06-10.gui-image2.v1",
        "generator": "scripts/asset-build/generate-level06-10-gui-image2.py",
        "textPolicy": "No baked gameplay text; runtime owns copy and puzzle answers.",
        "atlasContract": {
            "atlasSize": list(ATLAS_SIZE),
            "regionFormat": "[x, y, w, h]",
            "backgroundSize": list(BACKGROUND_SIZE),
        },
        "kits": entries,
    }
    manifest_path = OUT_ROOT / "level06-10-gui-image2-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {manifest_path.relative_to(ROOT)}")
    make_contact_sheet(entries)


if __name__ == "__main__":
    main()
