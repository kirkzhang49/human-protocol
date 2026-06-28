#!/usr/bin/env python3
"""Generate text-free image2-style plates for the archive merge overlay."""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/assets/gui/hp-gui-archive-merge-frame-image2.png"
BOARD_OUT = ROOT / "src/assets/gui/hp-gui-archive-merge-board-image2.png"
TILE_OUT = ROOT / "src/assets/gui/hp-gui-archive-merge-tile-image2.png"
PAD_OUT = ROOT / "src/assets/gui/hp-gui-archive-merge-shift-pad-image2.png"
SIZE = (1440, 820)


def rgba(color: tuple[int, int, int], alpha: int) -> tuple[int, int, int, int]:
    return color[0], color[1], color[2], alpha


def add_noise(img: Image.Image, seed: int) -> None:
    rng = random.Random(seed)
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if rng.random() > 0.08:
                continue
            r, g, b, a = pixels[x, y]
            delta = rng.randint(-10, 12)
            pixels[x, y] = (
                max(0, min(255, r + delta)),
                max(0, min(255, g + delta)),
                max(0, min(255, b + delta)),
                a,
            )


def make_panel() -> Image.Image:
    w, h = SIZE
    img = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    mask = Image.new("L", SIZE, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=34, fill=245)
    for y in range(h):
        t = y / max(1, h - 1)
        for x in range(w):
            side = abs((x / max(1, w - 1)) - 0.5) * 2
            pulse = math.sin((x * 0.013) + (y * 0.019)) * 5
            r = int(5 + 16 * t + 10 * side + pulse)
            g = int(12 + 24 * t + 8 * side + pulse * 0.4)
            b = int(14 + 20 * t + 4 * side)
            img.putpixel((x, y), (r, g, b, mask.getpixel((x, y))))

    draw = ImageDraw.Draw(img, "RGBA")
    add_noise(img, 2048)
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=34, outline=(112, 238, 255, 95), width=2)
    draw.rounded_rectangle((14, 14, w - 15, h - 15), radius=24, outline=(224, 184, 105, 54), width=1)
    draw.rounded_rectangle((34, 116, w - 35, h - 42), radius=18, outline=(112, 238, 255, 42), width=1)

    for yy in range(34, h - 30, 7):
        alpha = 12 if yy % 28 == 0 else 6
        draw.line((34, yy, w - 34, yy), fill=(134, 240, 255, alpha), width=1)
    for xx in range(100, w - 100, 48):
        draw.line((xx, 136, xx, h - 72), fill=(112, 238, 255, 12), width=1)

    # Warm archive compression rails.
    for y in (132, h - 70):
        draw.line((92, y, w - 92, y), fill=(229, 190, 104, 72), width=3)
        draw.line((92, y + 8, w - 92, y + 8), fill=(112, 238, 255, 24), width=1)

    # Reinforced corners.
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        x0 = 42 if sx > 0 else w - 42
        y0 = 42 if sy > 0 else h - 42
        draw.line((x0, y0, x0 + sx * 126, y0), fill=(229, 190, 104, 120), width=4)
        draw.line((x0, y0, x0, y0 + sy * 84), fill=(229, 190, 104, 120), width=4)
        draw.line((x0 + sx * 12, y0 + sy * 12, x0 + sx * 92, y0 + sy * 12), fill=(112, 238, 255, 76), width=2)
        draw.line((x0 + sx * 12, y0 + sy * 12, x0 + sx * 12, y0 + sy * 68), fill=(112, 238, 255, 76), width=2)
        draw.ellipse((x0 - 4, y0 - 4, x0 + 4, y0 + 4), fill=(112, 238, 255, 150))

    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow, "RGBA")
    gdraw.ellipse((w * 0.28, h * 0.05, w * 0.72, h * 0.76), fill=(240, 196, 111, 34))
    gdraw.ellipse((w * 0.42, h * 0.18, w * 0.9, h * 0.92), fill=(112, 238, 255, 22))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius=46)))
    return img


def make_board() -> Image.Image:
    size = (900, 900)
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=32, fill=242)
    for y in range(h):
        for x in range(w):
            dx = abs(x / (w - 1) - 0.5) * 2
            dy = abs(y / (h - 1) - 0.5) * 2
            vignette = max(dx, dy)
            img.putpixel((x, y), (5 + int(18 * vignette), 12 + int(18 * (1 - dy)), 14 + int(22 * (1 - dx)), mask.getpixel((x, y))))
    add_noise(img, 4096)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=32, outline=(112, 238, 255, 96), width=2)
    draw.rounded_rectangle((18, 18, w - 19, h - 19), radius=22, outline=(235, 193, 106, 74), width=2)
    for i in range(1, 8):
        x = int(18 + i * (w - 36) / 8)
        y = int(18 + i * (h - 36) / 8)
        draw.line((x, 34, x, h - 34), fill=(112, 238, 255, 22), width=1)
        draw.line((34, y, w - 34, y), fill=(112, 238, 255, 22), width=1)
    for i in range(0, 4):
        inset = 42 + i * 18
        alpha = 44 - i * 8
        draw.rounded_rectangle((inset, inset, w - inset, h - inset), radius=18, outline=(235, 193, 106, alpha), width=1)
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow, "RGBA")
    gdraw.ellipse((120, 100, 780, 760), fill=(240, 196, 111, 22))
    gdraw.ellipse((220, 260, 880, 940), fill=(112, 238, 255, 24))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius=44)))
    return img


def make_tile() -> Image.Image:
    size = (260, 260)
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius=24, fill=238)
    for y in range(h):
        for x in range(w):
            top = 1 - y / max(1, h - 1)
            side = abs(x / max(1, w - 1) - 0.5) * 2
            img.putpixel((x, y), (9 + int(18 * top), 15 + int(20 * top), 17 + int(18 * side), mask.getpixel((x, y))))
    add_noise(img, 8192)
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((3, 3, w - 4, h - 4), radius=24, outline=(114, 240, 255, 70), width=2)
    draw.rounded_rectangle((13, 13, w - 14, h - 14), radius=17, outline=(234, 191, 104, 62), width=1)
    draw.line((34, 55, w - 34, 55), fill=(112, 238, 255, 28), width=2)
    draw.line((34, h - 48, w - 34, h - 48), fill=(235, 193, 106, 46), width=2)
    for x in range(42, w - 42, 22):
        draw.line((x, 70, x, h - 70), fill=(112, 238, 255, 12), width=1)
    return img


def make_shift_pad() -> Image.Image:
    size = (360, 360)
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=28, fill=(5, 13, 15, 218), outline=(112, 238, 255, 72), width=2)
    draw.rounded_rectangle((26, 26, w - 27, h - 27), radius=20, outline=(235, 193, 106, 52), width=1)
    draw.ellipse((110, 110, 250, 250), fill=(10, 24, 27, 230), outline=(112, 238, 255, 58), width=2)
    for angle in (0, 90, 180, 270):
        rad = math.radians(angle)
        cx = 180 + math.cos(rad) * 100
        cy = 180 + math.sin(rad) * 100
        draw.rounded_rectangle((cx - 38, cy - 38, cx + 38, cy + 38), radius=16, fill=(12, 27, 31, 226), outline=(112, 238, 255, 64), width=2)
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow, "RGBA")
    gdraw.ellipse((78, 64, 292, 298), fill=(112, 238, 255, 24))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius=26)))
    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    make_panel().save(OUT)
    make_board().save(BOARD_OUT)
    make_tile().save(TILE_OUT)
    make_shift_pad().save(PAD_OUT)
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"wrote {BOARD_OUT.relative_to(ROOT)}")
    print(f"wrote {TILE_OUT.relative_to(ROOT)}")
    print(f"wrote {PAD_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
