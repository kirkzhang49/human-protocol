#!/usr/bin/env python3
"""Generate a text-free image2-style shell for the gallery reading overlay.

Museum evidence desk: warm brass rails, a framed inspection light, cool cyan
archive accents. Run with:
  python3 scripts/asset-build/generate-gallery-reading-ui-image2.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src/assets/gui/hp-gui-gallery-reading-frame-image2.png"
SIZE = (1440, 820)


def add_noise(img: Image.Image, seed: int) -> None:
    rng = random.Random(seed)
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            if rng.random() > 0.07:
                continue
            r, g, b, a = pixels[x, y]
            delta = rng.randint(-9, 11)
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
            pulse = math.sin((x * 0.012) + (y * 0.017)) * 4
            r = int(13 + 22 * t + 11 * side + pulse)
            g = int(11 + 16 * t + 7 * side + pulse * 0.5)
            b = int(8 + 11 * t + 3 * side)
            img.putpixel((x, y), (r, g, b, mask.getpixel((x, y))))

    draw = ImageDraw.Draw(img, "RGBA")
    add_noise(img, 4096)
    draw.rounded_rectangle((2, 2, w - 3, h - 3), radius=34, outline=(231, 196, 120, 105), width=2)
    draw.rounded_rectangle((14, 14, w - 15, h - 15), radius=24, outline=(155, 232, 255, 40), width=1)
    draw.rounded_rectangle((34, 120, w - 35, h - 42), radius=18, outline=(231, 196, 120, 46), width=1)

    # Gallery rail hatching.
    for yy in range(34, h - 30, 7):
        alpha = 11 if yy % 28 == 0 else 5
        draw.line((34, yy, w - 34, yy), fill=(231, 196, 120, alpha), width=1)

    # Warm picture rails top + bottom.
    for y in (134, h - 70):
        draw.line((92, y, w - 92, y), fill=(231, 196, 120, 86), width=3)
        draw.line((92, y + 8, w - 92, y + 8), fill=(155, 232, 255, 20), width=1)

    # A framed "inspection light" plate on the left half (evidence card zone).
    fx0, fy0, fx1, fy1 = 70, 190, int(w * 0.5) - 24, h - 96
    draw.rounded_rectangle((fx0, fy0, fx1, fy1), radius=14, outline=(231, 196, 120, 92), width=3)
    draw.rounded_rectangle((fx0 + 10, fy0 + 10, fx1 - 10, fy1 - 10), radius=10, outline=(155, 232, 255, 34), width=1)

    # Reinforced corners.
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        x0 = 42 if sx > 0 else w - 42
        y0 = 42 if sy > 0 else h - 42
        draw.line((x0, y0, x0 + sx * 122, y0), fill=(231, 196, 120, 122), width=4)
        draw.line((x0, y0, x0, y0 + sy * 82), fill=(231, 196, 120, 122), width=4)
        draw.line((x0 + sx * 12, y0 + sy * 12, x0 + sx * 88, y0 + sy * 12), fill=(155, 232, 255, 70), width=2)
        draw.ellipse((x0 - 4, y0 - 4, x0 + 4, y0 + 4), fill=(231, 196, 120, 150))

    glow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow, "RGBA")
    gdraw.ellipse((w * 0.06, h * 0.16, w * 0.46, h * 0.86), fill=(231, 196, 120, 30))
    gdraw.ellipse((w * 0.5, h * 0.14, w * 0.96, h * 0.9), fill=(120, 200, 255, 18))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(radius=48)))
    return img


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    make_panel().save(OUT)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
