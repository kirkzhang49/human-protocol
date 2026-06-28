#!/usr/bin/env python3
"""Generate project-owned museum ceiling texture triples for /build.

These are original procedural images, not downloaded third-party assets. They
stay small (384px WebP) so builder Raw WebGPU packs can include them without a
large texture footprint.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/textures/environment/builder-surfaces"
OUT_DIR.mkdir(parents=True, exist_ok=True)

SIZE = 384


def clamp(value: float, low: int = 0, high: int = 255) -> int:
    return max(low, min(high, int(round(value))))


def noise(x: float, y: float, seed: float) -> float:
    value = math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
    return value - math.floor(value)


def line_distance(value: float, step: float) -> float:
    return abs(value / step - round(value / step)) * step


def smooth(edge0: float, edge1: float, value: float) -> float:
    if edge0 == edge1:
        return 1.0 if value >= edge1 else 0.0
    t = max(0.0, min(1.0, (value - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def mix(a: tuple[float, float, float], b: tuple[float, float, float], t: float) -> tuple[float, float, float]:
    t = max(0.0, min(1.0, t))
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def save_rgb(path: Path, sampler) -> None:
    image = Image.new("RGB", (SIZE, SIZE))
    pixels = image.load()
    for y in range(SIZE):
        v = y / (SIZE - 1)
        for x in range(SIZE):
            u = x / (SIZE - 1)
            r, g, b = sampler(u, v, x, y)
            pixels[x, y] = (clamp(r), clamp(g), clamp(b))
    image.save(path, "WEBP", quality=82, method=6)


def save_normal_from_height(path: Path, height_sampler, strength: float = 3.0) -> None:
    image = Image.new("RGB", (SIZE, SIZE))
    pixels = image.load()
    step = 1.0 / (SIZE - 1)
    for y in range(SIZE):
        v = y / (SIZE - 1)
        for x in range(SIZE):
            u = x / (SIZE - 1)
            hl = height_sampler(max(0.0, u - step), v)
            hr = height_sampler(min(1.0, u + step), v)
            hd = height_sampler(u, max(0.0, v - step))
            hu = height_sampler(u, min(1.0, v + step))
            dx = (hr - hl) * strength
            dy = (hu - hd) * strength
            nz = 1.0
            length = math.sqrt(dx * dx + dy * dy + nz * nz)
            nx = -dx / length
            ny = -dy / length
            nz = nz / length
            pixels[x, y] = (clamp((nx * 0.5 + 0.5) * 255), clamp((ny * 0.5 + 0.5) * 255), clamp((nz * 0.5 + 0.5) * 255))
    image.save(path, "WEBP", quality=82, method=6)


def normal_sampler(_u: float, _v: float, x: int, y: int) -> tuple[int, int, int]:
    n = noise(x * 0.07, y * 0.07, 91)
    return (126 + n * 5, 126 + n * 5, 245)


def rough_sampler(base: int):
    def sampler(u: float, v: float, x: int, y: int) -> tuple[int, int, int]:
        grain = (noise(x * 0.11, y * 0.13, 123) - 0.5) * 20
        seam = max(1 - smooth(0.002, 0.016, line_distance(u, 0.25)), 1 - smooth(0.002, 0.016, line_distance(v, 0.25)))
        value = base + grain - seam * 22
        return (value, value, value)

    return sampler


def coffer_skylight(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    base = (118, 132, 130)
    stone = (178, 172, 154)
    cyan = (166, 238, 244)
    grain = noise(x * 0.05, y * 0.05, 1)
    color = mix(base, stone, 0.38 + grain * 0.16)
    grid = max(1 - smooth(0.004, 0.016, line_distance(u, 0.25)), 1 - smooth(0.004, 0.016, line_distance(v, 0.25)))
    color = mix(color, (58, 63, 63), grid * 0.54)
    for cx, cy in ((0.375, 0.375), (0.625, 0.375), (0.375, 0.625), (0.625, 0.625)):
        dx = abs(u - cx) / 0.085
        dy = abs(v - cy) / 0.085
        pane = max(0.0, 1.0 - max(dx, dy))
        color = mix(color, cyan, pane * 0.55)
    return color


def archival_wood(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    base = (63, 45, 27)
    warm = (155, 104, 49)
    grain = math.sin((u * 18 + noise(x * 0.05, y * 0.02, 2) * 1.8) * math.pi) * 0.5 + 0.5
    color = mix(base, warm, 0.22 + grain * 0.32)
    beam = max(1 - smooth(0.003, 0.02, line_distance(u, 0.2)), 1 - smooth(0.003, 0.018, line_distance(v, 0.5)))
    color = mix(color, (26, 22, 18), beam * 0.52)
    brass = max(1 - smooth(0.002, 0.008, abs(v - 0.5)), 0) * (1 - smooth(0.0, 0.1, abs(u - 0.5)))
    return mix(color, (204, 156, 78), brass * 0.35)


def black_star_grid(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    color = (18 + noise(x, y, 3) * 10, 19 + noise(x, y, 4) * 10, 22 + noise(x, y, 5) * 10)
    grid = max(1 - smooth(0.003, 0.012, line_distance(u, 0.2)), 1 - smooth(0.003, 0.012, line_distance(v, 0.2)))
    color = mix(color, (101, 76, 38), grid * 0.55)
    for sx in range(1, 5):
        for sy in range(1, 5):
            dx = u - sx / 5
            dy = v - sy / 5
            star = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy) / 0.018)
            color = mix(color, (171, 226, 230), star * 0.8)
    return color


def cove_plaster(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    color = mix((168, 163, 151), (202, 194, 174), noise(x * 0.04, y * 0.04, 6) * 0.28)
    border = max(
        1 - smooth(0.012, 0.055, abs(u - 0.08)),
        1 - smooth(0.012, 0.055, abs(u - 0.92)),
        1 - smooth(0.012, 0.055, abs(v - 0.08)),
        1 - smooth(0.012, 0.055, abs(v - 0.92)),
    )
    color = mix(color, (76, 85, 84), border * 0.35)
    cove = max(1 - smooth(0.006, 0.024, abs(u - 0.5)), 1 - smooth(0.006, 0.024, abs(v - 0.5)))
    return mix(color, (126, 232, 239), cove * 0.28)


def louvered_well(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    base = (74, 69, 58)
    color = mix(base, (134, 117, 85), noise(x * 0.04, y * 0.04, 7) * 0.22)
    slat = 1 - smooth(0.008, 0.035, line_distance(u + math.sin(v * math.pi) * 0.025, 0.125))
    color = mix(color, (32, 32, 30), slat * 0.45)
    well = max(0.0, 1.0 - max(abs(u - 0.5) / 0.22, abs(v - 0.5) / 0.34))
    color = mix(color, (218, 203, 157), well * 0.42)
    return color


def ring_distance(u: float, v: float, cx: float = 0.5, cy: float = 0.5) -> float:
    dx = u - cx
    dy = v - cy
    return math.sqrt(dx * dx + dy * dy)


def museum_limestone_coffer_v2_height(u: float, v: float) -> float:
    cell = 0.25
    grid = max(1 - smooth(0.006, 0.024, line_distance(u, cell)), 1 - smooth(0.006, 0.024, line_distance(v, cell)))
    inner_u = abs((u / cell) % 1 - 0.5) * 2
    inner_v = abs((v / cell) % 1 - 0.5) * 2
    recess = smooth(0.34, 0.72, max(inner_u, inner_v))
    border = max(
        1 - smooth(0.012, 0.06, u),
        1 - smooth(0.012, 0.06, 1 - u),
        1 - smooth(0.012, 0.06, v),
        1 - smooth(0.012, 0.06, 1 - v),
    )
    return 0.55 + grid * 0.42 - recess * 0.28 + border * 0.22


def museum_limestone_coffer_v2(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    h = museum_limestone_coffer_v2_height(u, v)
    grain = noise(x * 0.035, y * 0.04, 11)
    vein = max(0.0, 1.0 - abs(math.sin((u * 3.3 + v * 2.2 + grain * 0.32) * math.pi)) / 0.22)
    base = mix((132, 128, 116), (204, 196, 174), 0.58 + grain * 0.18)
    shadowed = mix((70, 72, 69), base, h)
    warm_trim = max(
        1 - smooth(0.002, 0.009, abs(u - 0.5)),
        1 - smooth(0.002, 0.009, abs(v - 0.5)),
    )
    color = mix(shadowed, (96, 82, 54), vein * 0.12)
    color = mix(color, (216, 180, 105), warm_trim * 0.18)
    return color


def museum_skylight_frosted_v2_height(u: float, v: float) -> float:
    bronze_grid = max(1 - smooth(0.004, 0.018, line_distance(u, 0.2)), 1 - smooth(0.004, 0.018, line_distance(v, 0.5)))
    glass_panel = 1.0 - bronze_grid
    center_light = max(0.0, 1.0 - max(abs(u - 0.5) / 0.38, abs(v - 0.5) / 0.22))
    return 0.44 + bronze_grid * 0.44 + glass_panel * center_light * 0.12


def museum_skylight_frosted_v2(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    bronze_grid = max(1 - smooth(0.004, 0.018, line_distance(u, 0.2)), 1 - smooth(0.004, 0.018, line_distance(v, 0.5)))
    glass_cloud = noise(x * 0.025, y * 0.025, 18)
    pane_light = max(0.0, 1.0 - max(abs(u - 0.5) / 0.46, abs(v - 0.5) / 0.28))
    glass = mix((118, 141, 142), (202, 230, 224), 0.44 + glass_cloud * 0.16 + pane_light * 0.36)
    bronze = mix((55, 42, 30), (146, 101, 43), noise(x * 0.07, y * 0.05, 19) * 0.45)
    cyan_edge = max(1 - smooth(0.002, 0.012, abs(v - 0.5)), 0) * (1 - bronze_grid)
    color = mix(glass, bronze, bronze_grid * 0.9)
    color = mix(color, (150, 238, 238), cyan_edge * 0.22)
    return color


def museum_rotunda_plaster_chandelier_v1_height(u: float, v: float) -> float:
    r = ring_distance(u, v)
    ring_a = 1 - smooth(0.006, 0.026, abs(r - 0.19))
    ring_b = 1 - smooth(0.006, 0.03, abs(r - 0.36))
    ribs = (math.cos(math.atan2(v - 0.5, u - 0.5) * 16) * 0.5 + 0.5) * smooth(0.1, 0.42, r) * (1 - smooth(0.46, 0.5, r))
    dome = max(0.0, 1.0 - r / 0.58)
    return 0.44 + dome * 0.18 + ring_a * 0.36 + ring_b * 0.3 + ribs * 0.16


def museum_rotunda_plaster_chandelier_v1(u: float, v: float, x: int, y: int) -> tuple[float, float, float]:
    h = museum_rotunda_plaster_chandelier_v1_height(u, v)
    r = ring_distance(u, v)
    grain = noise(x * 0.04, y * 0.04, 23)
    plaster = mix((142, 136, 124), (206, 196, 172), 0.48 + grain * 0.2)
    color = mix((75, 73, 69), plaster, h)
    medallion = 1 - smooth(0.01, 0.06, abs(r - 0.19))
    outer = 1 - smooth(0.01, 0.06, abs(r - 0.36))
    color = mix(color, (198, 158, 86), max(medallion, outer) * 0.22)
    warm_center = max(0.0, 1.0 - r / 0.12)
    return mix(color, (232, 198, 126), warm_center * 0.18)


PRESETS = {
    "hp_ceiling_museum_limestone_coffer_v2": (museum_limestone_coffer_v2, 174),
    "hp_ceiling_museum_frosted_skylight_v2": (museum_skylight_frosted_v2, 126),
    "hp_ceiling_museum_rotunda_chandelier_v1": (museum_rotunda_plaster_chandelier_v1, 164),
    "hp_ceiling_museum_skylight_coffer_v1": (coffer_skylight, 154),
    "hp_ceiling_museum_archival_wood_coffer_v1": (archival_wood, 178),
    "hp_ceiling_museum_black_star_grid_v1": (black_star_grid, 205),
    "hp_ceiling_museum_cove_light_plaster_v1": (cove_plaster, 168),
    "hp_ceiling_museum_louvered_light_well_v1": (louvered_well, 160),
}


def main() -> None:
    for stem, (sampler, rough_base) in PRESETS.items():
        save_rgb(OUT_DIR / f"{stem}_color.webp", sampler)
        if stem == "hp_ceiling_museum_limestone_coffer_v2":
            save_normal_from_height(OUT_DIR / f"{stem}_normal.webp", museum_limestone_coffer_v2_height, strength=3.2)
        elif stem == "hp_ceiling_museum_frosted_skylight_v2":
            save_normal_from_height(OUT_DIR / f"{stem}_normal.webp", museum_skylight_frosted_v2_height, strength=2.4)
        elif stem == "hp_ceiling_museum_rotunda_chandelier_v1":
            save_normal_from_height(OUT_DIR / f"{stem}_normal.webp", museum_rotunda_plaster_chandelier_v1_height, strength=2.8)
        else:
            save_rgb(OUT_DIR / f"{stem}_normal.webp", normal_sampler)
        save_rgb(OUT_DIR / f"{stem}_rough.webp", rough_sampler(rough_base))
        print(f"wrote {stem} texture triple")


if __name__ == "__main__":
    main()
