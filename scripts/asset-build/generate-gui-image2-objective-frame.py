#!/usr/bin/env python3
"""Bake the text-safe objective HUD frame as a transparent bitmap asset.

The runtime HUD text is laid out in CSS. This script only bakes the no-text
Image2-style frame: transparent body, glass highlights, metal corners, and
bottom guidance rail. It deliberately avoids SVG/CSS-only decoration so the
combat HUD stays in the same bitmap asset language as the other GUI art.
"""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/assets/gui/hp-gui-objective-strip-image2-textsafe-v1.png"
MANIFEST = ROOT / "src/assets/manifests/runtime/gui_age_v3_asset_manifest.json"

W, H, SS = 880, 165, 4
BW, BH = W * SS, H * SS


def rgba(r: int, g: int, b: int, a: int) -> tuple[int, int, int, int]:
    return (r, g, b, a)


buf = bytearray(BW * BH * 4)


def blend_px(x: int, y: int, c: tuple[int, int, int, int]) -> None:
    if x < 0 or y < 0 or x >= BW or y >= BH:
        return
    i = (y * BW + x) * 4
    sr, sg, sb, sa = c
    if sa <= 0:
        return
    da = buf[i + 3]
    inv = 255 - sa
    out_a = sa + da * inv // 255
    if out_a <= 0:
      return
    buf[i] = min(255, (sr * sa + buf[i] * da * inv // 255) // out_a)
    buf[i + 1] = min(255, (sg * sa + buf[i + 1] * da * inv // 255) // out_a)
    buf[i + 2] = min(255, (sb * sa + buf[i + 2] * da * inv // 255) // out_a)
    buf[i + 3] = min(255, out_a)


def rect(x0: float, y0: float, x1: float, y1: float, c: tuple[int, int, int, int]) -> None:
    x0i, y0i, x1i, y1i = [round(v * SS) for v in (x0, y0, x1, y1)]
    for y in range(max(0, y0i), min(BH, y1i)):
        for x in range(max(0, x0i), min(BW, x1i)):
            blend_px(x, y, c)


def line(x0: float, y0: float, x1: float, y1: float, width: float, c: tuple[int, int, int, int]) -> None:
    x0 *= SS; y0 *= SS; x1 *= SS; y1 *= SS; width *= SS
    minx = int(max(0, math.floor(min(x0, x1) - width - 2)))
    maxx = int(min(BW - 1, math.ceil(max(x0, x1) + width + 2)))
    miny = int(max(0, math.floor(min(y0, y1) - width - 2)))
    maxy = int(min(BH - 1, math.ceil(max(y0, y1) + width + 2)))
    dx, dy = x1 - x0, y1 - y0
    length_sq = dx * dx + dy * dy
    radius = width * 0.5
    feather = max(1.0, SS * 0.75)
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            if length_sq <= 0:
                d = math.hypot(x - x0, y - y0)
            else:
                t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / length_sq))
                px, py = x0 + t * dx, y0 + t * dy
                d = math.hypot(x - px, y - py)
            a = max(0.0, min(1.0, (radius + feather - d) / feather))
            if a > 0:
                blend_px(x, y, (c[0], c[1], c[2], int(c[3] * a)))


def poly(points: list[tuple[float, float]], c: tuple[int, int, int, int]) -> None:
    pts = [(x * SS, y * SS) for x, y in points]
    minx = int(max(0, min(x for x, _ in pts)))
    maxx = int(min(BW - 1, max(x for x, _ in pts)))
    miny = int(max(0, min(y for _, y in pts)))
    maxy = int(min(BH - 1, max(y for _, y in pts)))
    for y in range(miny, maxy + 1):
        inside = False
        j = len(pts) - 1
        crossings: list[float] = []
        for i in range(len(pts)):
            xi, yi = pts[i]
            xj, yj = pts[j]
            if (yi > y) != (yj > y):
                crossings.append((xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi)
            j = i
        crossings.sort()
        for a, b in zip(crossings[0::2], crossings[1::2]):
            for x in range(max(minx, int(a)), min(maxx, int(b)) + 1):
                blend_px(x, y, c)


def glow(cx: float, cy: float, rx: float, ry: float, c: tuple[int, int, int, int]) -> None:
    cx *= SS; cy *= SS; rx *= SS; ry *= SS
    for y in range(max(0, int(cy - ry)), min(BH, int(cy + ry))):
        yy = (y - cy) / max(1, ry)
        for x in range(max(0, int(cx - rx)), min(BW, int(cx + rx))):
            xx = (x - cx) / max(1, rx)
            d = xx * xx + yy * yy
            if d <= 1:
                a = (1 - d) ** 1.7
                blend_px(x, y, (c[0], c[1], c[2], int(c[3] * a)))


# Transparent smoked glass body and Image2-style light washes.
poly([(50, 16), (830, 16), (861, 45), (861, 120), (831, 149), (49, 149), (19, 120), (19, 46)], rgba(20, 46, 55, 68))
glow(440, 32, 420, 38, rgba(196, 246, 255, 38))
glow(432, 86, 370, 62, rgba(70, 198, 230, 22))
glow(96, 38, 95, 38, rgba(255, 218, 140, 34))
glow(780, 54, 80, 48, rgba(120, 226, 255, 30))

# Main frame.
for off, alpha in [(0, 156), (3, 76)]:
    line(54 + off, 15 + off, 826 - off, 15 + off, 2.2, rgba(225, 248, 255, alpha))
    line(54 + off, 150 - off, 826 - off, 150 - off, 1.5, rgba(166, 232, 248, alpha // 2))
    line(20 + off, 46, 50, 16 + off, 1.8, rgba(208, 241, 250, alpha))
    line(830, 16 + off, 860 - off, 45, 1.8, rgba(208, 241, 250, alpha))
    line(20 + off, 120, 49, 149 - off, 1.6, rgba(112, 218, 244, alpha // 2))
    line(831, 149 - off, 860 - off, 120, 1.6, rgba(112, 218, 244, alpha // 2))
    line(19 + off, 46, 19 + off, 120, 1.6, rgba(130, 226, 248, alpha // 2))
    line(861 - off, 45, 861 - off, 120, 1.6, rgba(130, 226, 248, alpha // 2))

# Corner armor plates.
for left in [True, False]:
    sx = 1 if left else -1
    x = 40 if left else 840
    plate = [(x, 35), (x + sx * 22, 22), (x + sx * 95, 22), (x + sx * 82, 33), (x + sx * 28, 33), (x + sx * 12, 45), (x + sx * 12, 70), (x, 70)]
    poly(plate, rgba(210, 245, 255, 42))
    line(x + sx * 20, 26, x + sx * 88, 26, 1.4, rgba(225, 248, 255, 90))
    line(x + sx * 18, 124, x + sx * 88, 140, 1.2, rgba(130, 226, 248, 64))

# Text-safe inner rails.
line(170, 61, 710, 61, 1.0, rgba(221, 248, 255, 64))
line(178, 112, 702, 112, 1.0, rgba(115, 227, 255, 48))
line(162, 127, 704, 127, 1.0, rgba(221, 248, 255, 72))
line(162, 134, 704, 134, 1.0, rgba(115, 227, 255, 56))
line(354, 134, 526, 134, 2.0, rgba(255, 219, 140, 74))
for x in range(186, 695, 16):
    line(x, 140, x + 5, 140, 1.0, rgba(134, 220, 238, 34))

# Vertical separators.
line(157, 27, 157, 106, 4.0, rgba(115, 227, 255, 56))
line(723, 28, 723, 106, 4.0, rgba(115, 227, 255, 48))
line(169, 34, 169, 100, 1.0, rgba(221, 248, 255, 48))
line(711, 34, 711, 100, 1.0, rgba(221, 248, 255, 42))

# Amber/cyan micro accents.
line(61, 41, 146, 41, 2.0, rgba(255, 218, 140, 64))
line(734, 41, 819, 41, 2.0, rgba(115, 227, 255, 48))
line(43, 83, 92, 83, 1.0, rgba(255, 218, 140, 40))
line(788, 83, 837, 83, 1.0, rgba(115, 227, 255, 34))
rect(33, 47, 41, 120, rgba(115, 227, 255, 44))
rect(839, 47, 847, 120, rgba(115, 227, 255, 38))

# Downsample.
out = bytearray(W * H * 4)
for y in range(H):
    for x in range(W):
        acc = [0, 0, 0, 0]
        for sy in range(SS):
            for sx in range(SS):
                i = ((y * SS + sy) * BW + (x * SS + sx)) * 4
                for k in range(4):
                    acc[k] += buf[i + k]
        j = (y * W + x) * 4
        for k in range(4):
            out[j + k] = acc[k] // (SS * SS)
        if out[j + 3] > 0:
            out[j + 3] = min(230, int(out[j + 3] * 1.35 + 10))


def png_chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


scanlines = bytearray()
for y in range(H):
    scanlines.append(0)
    scanlines.extend(out[y * W * 4 : (y + 1) * W * 4])

OUT.parent.mkdir(parents=True, exist_ok=True)
png = b"\x89PNG\r\n\x1a\n"
png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
png += png_chunk(b"IDAT", zlib.compress(bytes(scanlines), 9))
png += png_chunk(b"IEND", b"")
OUT.write_bytes(png)
print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
