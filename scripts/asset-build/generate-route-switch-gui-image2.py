#!/usr/bin/env python3
"""Generate the Builder route-switch Image2 GUI: a transparent parts sprite sheet
plus a separate dark background board. The runtime (RouteSwitchOverlay) composites
regions at draw time — there is deliberately NO single full-GUI image and NO baked
text. Palette: smoked titanium black, medical cyan, aged brass, amber authorization.

Outputs:
  src/assets/gui/route-switch/route_switch_parts_image2.png          (RGBA sprite sheet)
  src/assets/gui/route-switch/route_switch_parts_image2.regions.json ([x,y,w,h] per region)
  src/assets/gui/route-switch/route_switch_background_image2.png      (16:9 dark board)

Run:
  python3 scripts/asset-build/generate-route-switch-gui-image2.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/gui/route-switch"

# Palette ------------------------------------------------------------------
TITAN = (18, 20, 24, 255)
DARK = (30, 34, 40, 255)
MID = (58, 64, 72, 255)
STEEL = (96, 104, 114, 255)
BRASS = (150, 116, 52, 255)
BRASS_HI = (203, 166, 92, 255)
CYAN = (96, 212, 236, 255)
CYAN_HI = (168, 244, 255, 255)
AMBER = (236, 168, 64, 255)
AMBER_HI = (255, 206, 120, 255)
GREY = (88, 96, 106, 255)
GREY_DK = (52, 58, 66, 255)


def _img(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def _glow(layer: Image.Image, radius: float) -> Image.Image:
    return layer.filter(ImageFilter.GaussianBlur(radius))


def _octagon(w, h, inset, chamf):
    return [
        (inset + chamf, inset), (w - inset - chamf, inset),
        (w - inset, inset + chamf), (w - inset, h - inset - chamf),
        (w - inset - chamf, h - inset), (inset + chamf, h - inset),
        (inset, h - inset - chamf), (inset, inset + chamf),
    ]


def _bolts(d, points, r, col=(20, 22, 26, 255), hi=STEEL):
    for (x, y) in points:
        d.ellipse([x - r, y - r, x + r, y + r], fill=col)
        d.ellipse([x - r * 0.5, y - r * 0.5, x + r * 0.3, y + r * 0.3], fill=hi)


# --- Sprite draw functions (each returns an RGBA image) --------------------

def draw_frame_corner_tl(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    arm = int(h * 0.26)
    # L body: horizontal + vertical arms with an angled outer chamfer.
    poly = [(0, 0), (w, 0), (w, arm), (arm + 24, arm), (arm, arm + 24), (arm, h), (0, h)]
    d.polygon(poly, fill=DARK)
    # brass inner edge
    d.line([(w, arm), (arm + 24, arm), (arm, arm + 24), (arm, h)], fill=BRASS, width=5)
    d.line([(w, arm - 4), (arm + 20, arm - 4)], fill=BRASS_HI, width=2)
    # outer steel highlight
    d.line([(0, 1), (w, 1)], fill=STEEL, width=2)
    d.line([(1, 0), (1, h)], fill=STEEL, width=2)
    # cyan trace running inside the elbow
    d.line([(w, arm * 0.5), (arm * 0.5, arm * 0.5), (arm * 0.5, h)], fill=(CYAN[0], CYAN[1], CYAN[2], 150), width=3)
    _bolts(d, [(arm * 0.5, arm * 0.5), (w - 22, arm * 0.5), (arm * 0.5, h - 22)], 9)
    return im


def draw_dial_ring(w, h):
    im = _img(w, h)
    glow = _img(w, h)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([10, 10, w - 10, h - 10], outline=(CYAN[0], CYAN[1], CYAN[2], 180), width=14)
    im.alpha_composite(_glow(glow, 9))
    d = ImageDraw.Draw(im)
    d.ellipse([6, 6, w - 6, h - 6], outline=TITAN, width=int(w * 0.12))
    d.ellipse([6, 6, w - 6, h - 6], outline=MID, width=6)
    inner = int(w * 0.18)
    d.ellipse([inner, inner, w - inner, h - inner], outline=BRASS, width=6)
    d.ellipse([inner + 8, inner + 8, w - inner - 8, h - inner - 8], outline=(CYAN[0], CYAN[1], CYAN[2], 220), width=3)
    # 12 brass notches around the rim
    cx, cy, rr = w / 2, h / 2, w * 0.41
    for k in range(12):
        a = k / 12 * math.tau
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=BRASS_HI if k % 3 == 0 else BRASS)
    return im


def draw_dial_hub(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    d.ellipse([4, 4, w - 4, h - 4], fill=DARK, outline=STEEL, width=4)
    d.ellipse([int(w * 0.16), int(h * 0.16), int(w * 0.84), int(h * 0.84)], fill=TITAN, outline=BRASS, width=4)
    # amber slot marks (knurled grip read)
    cx, cy = w / 2, h / 2
    for k in range(3):
        ang = -math.pi / 2 + (k - 1) * 0.42
        x0 = cx + math.cos(ang) * w * 0.1
        y0 = cy + math.sin(ang) * h * 0.1
        x1 = cx + math.cos(ang) * w * 0.28
        y1 = cy + math.sin(ang) * h * 0.28
        d.line([(x0, y0), (x1, y1)], fill=AMBER_HI, width=6)
    d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=AMBER)
    return im


def draw_dial_pointer_cyan(w, h):
    im = _img(w, h)
    glow = _img(w, h)
    gd = ImageDraw.Draw(glow)
    gd.polygon([(w / 2, 4), (w - 8, h - 10), (8, h - 10)], fill=(CYAN[0], CYAN[1], CYAN[2], 220))
    im.alpha_composite(_glow(glow, 6))
    d = ImageDraw.Draw(im)
    d.polygon([(w / 2, 6), (w - 12, h - 14), (12, h - 14)], fill=CYAN_HI, outline=TITAN)
    d.polygon([(w / 2, 20), (w - 22, h - 20), (22, h - 20)], fill=CYAN)
    return im


def _plate(w, h, edge, fill, glow_col=None, alpha=255):
    im = _img(w, h)
    if glow_col is not None:
        glow = _img(w, h)
        gd = ImageDraw.Draw(glow)
        gd.polygon(_octagon(w, h, 14, 26), outline=(glow_col[0], glow_col[1], glow_col[2], 200), width=10)
        im.alpha_composite(_glow(glow, 8))
    d = ImageDraw.Draw(im)
    poly = _octagon(w, h, 10, 24)
    body = (fill[0], fill[1], fill[2], alpha)
    d.polygon(poly, fill=body)
    # bevel: lighter top, darker bottom
    d.line(poly[7:] + poly[:2], fill=(STEEL[0], STEEL[1], STEEL[2], alpha), width=3)
    d.polygon(poly, outline=(edge[0], edge[1], edge[2], alpha), width=4)
    inner = _octagon(w, h, 22, 20)
    d.polygon(inner, outline=(edge[0], edge[1], edge[2], max(60, alpha - 110)), width=2)
    return im


def draw_option_plate_enabled(w, h):
    return _plate(w, h, CYAN, (26, 32, 38), glow_col=None)


def draw_option_plate_disabled(w, h):
    return _plate(w, h, GREY, (34, 38, 43), glow_col=None, alpha=205)


def draw_option_plate_selected(w, h):
    return _plate(w, h, AMBER_HI, (40, 34, 22), glow_col=AMBER)


def _key_lens(w, h, ring, glow_col, lit):
    im = _img(w, h)
    if lit:
        glow = _img(w, h)
        gd = ImageDraw.Draw(glow)
        gd.rounded_rectangle([12, 10, w - 12, h - 10], radius=int(w * 0.34), outline=(glow_col[0], glow_col[1], glow_col[2], 210), width=10)
        im.alpha_composite(_glow(glow, 7))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([8, 6, w - 8, h - 6], radius=int(w * 0.36), fill=DARK, outline=ring, width=5)
    # keyhole: circle + tapered slot, punched dark
    cx = w / 2
    cy = h * 0.4
    r = w * 0.2
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TITAN, outline=ring, width=3)
    d.polygon([(cx - r * 0.5, cy), (cx + r * 0.5, cy), (cx + r * 0.28, h - 22), (cx - r * 0.28, h - 22)], fill=TITAN)
    inner = glow_col if lit else GREY
    d.ellipse([cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6], outline=inner, width=3)
    return im


def draw_key_lens_authorized(w, h):
    return _key_lens(w, h, BRASS, AMBER_HI, lit=True)


def draw_key_lens_locked(w, h):
    return _key_lens(w, h, GREY_DK, GREY, lit=False)


def _icon_base(w, h):
    im = _img(w, h)
    return im, ImageDraw.Draw(im)


def draw_icon_door(w, h):
    im, d = _icon_base(w, h)
    col = CYAN_HI
    d.rectangle([w * 0.3, h * 0.18, w * 0.7, h * 0.86], outline=col, width=6)
    d.rectangle([w * 0.3, h * 0.18, w * 0.7, h * 0.3], fill=col)
    d.ellipse([w * 0.6, h * 0.5, w * 0.66, h * 0.56], fill=col)
    return im


def draw_icon_puzzle(w, h):
    im, d = _icon_base(w, h)
    col = (190, 150, 255, 255)
    d.rounded_rectangle([w * 0.24, h * 0.24, w * 0.76, h * 0.76], radius=10, outline=col, width=6)
    d.ellipse([w * 0.44, h * 0.12, w * 0.56, h * 0.24], fill=col)  # top knob
    d.ellipse([w * 0.76, h * 0.44, w * 0.88, h * 0.56], fill=col)  # right knob
    return im


def draw_icon_robot(w, h):
    im, d = _icon_base(w, h)
    col = CYAN_HI
    d.rounded_rectangle([w * 0.26, h * 0.3, w * 0.74, h * 0.74], radius=12, outline=col, width=6)
    d.line([(w * 0.5, h * 0.16), (w * 0.5, h * 0.3)], fill=col, width=5)
    d.ellipse([w * 0.46, h * 0.1, w * 0.54, h * 0.18], fill=col)
    d.ellipse([w * 0.36, h * 0.44, w * 0.46, h * 0.54], fill=col)  # eyes
    d.ellipse([w * 0.54, h * 0.44, w * 0.64, h * 0.54], fill=col)
    return im


def draw_icon_standby(w, h):
    im, d = _icon_base(w, h)
    col = STEEL
    bb = [w * 0.26, h * 0.26, w * 0.74, h * 0.74]
    d.arc(bb, start=300, end=240, fill=col, width=6)
    d.line([(w * 0.5, h * 0.14), (w * 0.5, h * 0.46)], fill=col, width=6)
    return im


def _wire(w, h, col):
    im = _img(w, h)
    glow = _img(w, h)
    gd = ImageDraw.Draw(glow)
    midy = h / 2
    pts = [(6, midy), (w * 0.32, midy), (w * 0.46, midy - h * 0.26), (w * 0.6, midy), (w - 6, midy)]
    gd.line(pts, fill=(col[0], col[1], col[2], 200), width=8, joint="curve")
    im.alpha_composite(_glow(glow, 5))
    d = ImageDraw.Draw(im)
    d.line(pts, fill=col, width=4, joint="curve")
    for (x, y) in (pts[0], pts[-1]):
        d.ellipse([x - 8, y - 8, x + 8, y + 8], fill=col, outline=TITAN)
    return im


def draw_wire_cyan(w, h):
    return _wire(w, h, CYAN)


def draw_wire_amber(w, h):
    return _wire(w, h, AMBER)


def _led(w, h, col, lit):
    im = _img(w, h)
    if lit:
        glow = _img(w, h)
        gd = ImageDraw.Draw(glow)
        gd.ellipse([6, 6, w - 6, h - 6], fill=(col[0], col[1], col[2], 220))
        im.alpha_composite(_glow(glow, 5))
    d = ImageDraw.Draw(im)
    d.ellipse([4, 4, w - 4, h - 4], outline=STEEL, width=3)
    inner = col if lit else GREY_DK
    d.ellipse([w * 0.26, h * 0.26, w * 0.74, h * 0.74], fill=inner)
    return im


def draw_status_led_on(w, h):
    return _led(w, h, CYAN_HI, lit=True)


def draw_status_led_off(w, h):
    return _led(w, h, GREY, lit=False)


def draw_scanline_strip(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    for y in range(2, h - 2, 4):
        a = 70 if (y // 4) % 2 == 0 else 30
        d.line([(4, y), (w - 4, y)], fill=(CYAN[0], CYAN[1], CYAN[2], a), width=1)
    d.rectangle([2, 2, w - 2, h - 2], outline=(MID[0], MID[1], MID[2], 120), width=2)
    return im


def draw_brass_bracket(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([4, 4, w - 4, h - 4], radius=10, fill=BRASS, outline=TITAN, width=3)
    d.line([(8, 8), (w - 8, 8)], fill=BRASS_HI, width=3)
    d.line([(8, h - 9), (w - 8, h - 9)], fill=(90, 66, 24, 255), width=3)
    _bolts(d, [(26, h / 2), (w - 26, h / 2)], 9, col=(60, 44, 16, 255), hi=BRASS_HI)
    return im


def draw_output_bay(w, h):
    """Recessed physical output socket: dark cavity, brass rim, bolts — a tube sits in it."""
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    # outer brass-rimmed frame
    d.rounded_rectangle([4, 4, w - 4, h - 4], radius=18, fill=DARK, outline=BRASS, width=5)
    d.line([(10, 8), (w - 10, 8)], fill=BRASS_HI, width=2)
    # deep recessed cavity
    d.rounded_rectangle([int(w * 0.16), int(h * 0.10), int(w * 0.84), int(h * 0.88)], radius=14,
                        fill=(8, 9, 11, 255), outline=(48, 54, 62, 255), width=3)
    # inner cavity shadow gradient
    shade = _img(w, h)
    sd = ImageDraw.Draw(shade)
    sd.rounded_rectangle([int(w * 0.18), int(h * 0.12), int(w * 0.82), int(h * 0.5)], radius=12, fill=(0, 0, 0, 90))
    im.alpha_composite(_glow(shade, 8))
    # corner bolts
    _bolts(d, [(16, 16), (w - 16, 16), (16, h - 16), (w - 16, h - 16)], 7)
    return im


def _tube(w, h, core, hi, lit=True):
    """Vertical glass output tube in brass collars; lit = emissive core + glow."""
    im = _img(w, h)
    cx = w / 2
    top, bot = int(h * 0.12), int(h * 0.88)
    if lit:
        glow = _img(w, h)
        gd = ImageDraw.Draw(glow)
        gd.rounded_rectangle([int(w * 0.24), top, int(w * 0.76), bot], radius=int(w * 0.26),
                             fill=(core[0], core[1], core[2], 200))
        im.alpha_composite(_glow(glow, 9))
    d = ImageDraw.Draw(im)
    # glass body
    body = (core[0], core[1], core[2], 255) if lit else (44, 48, 54, 255)
    d.rounded_rectangle([int(w * 0.28), top, int(w * 0.72), bot], radius=int(w * 0.22), fill=body,
                        outline=(TITAN[0], TITAN[1], TITAN[2], 255), width=3)
    # bright vertical highlight streak
    hl = hi if lit else STEEL
    d.line([(cx - w * 0.08, top + 16), (cx - w * 0.08, bot - 16)], fill=(hl[0], hl[1], hl[2], 230), width=4)
    # brass collars top + bottom
    for cy in (top - 4, bot - 14):
        d.rounded_rectangle([int(w * 0.18), cy, int(w * 0.82), cy + 18], radius=6, fill=BRASS,
                            outline=(70, 52, 20, 255), width=2)
        d.line([(int(w * 0.2), cy + 3), (int(w * 0.8), cy + 3)], fill=BRASS_HI, width=2)
    return im


def draw_output_tube_cyan(w, h):
    return _tube(w, h, CYAN, CYAN_HI, lit=True)


def draw_output_tube_amber(w, h):
    return _tube(w, h, AMBER, AMBER_HI, lit=True)


def draw_output_tube_green(w, h):
    return _tube(w, h, (96, 214, 132, 255), (170, 245, 190, 255), lit=True)


def draw_output_tube_violet(w, h):
    return _tube(w, h, (176, 142, 240, 255), (214, 196, 255, 255), lit=True)


def draw_output_tube_off(w, h):
    return _tube(w, h, (60, 66, 74, 255), STEEL, lit=False)


def draw_hazard_skirt(w, h):
    """Amber/black diagonal hazard stripe skirt for the console base."""
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, h], fill=(22, 18, 8, 255))
    step = 34
    for x in range(-h, w, step):
        d.polygon([(x, h), (x + h, 0), (x + h + step // 2, 0), (x + step // 2, h)], fill=AMBER)
    d.rectangle([0, 0, w - 1, h - 1], outline=(70, 52, 20, 255), width=3)
    return im


def draw_route_output_module(w, h):
    """Wide output module with glass sockets and heavy black-gold hardware."""
    im = _img(w, h)
    glow = _img(w, h)
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([22, 18, w - 22, h - 18], radius=24, outline=(CYAN[0], CYAN[1], CYAN[2], 120), width=10)
    im.alpha_composite(_glow(glow, 10))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([8, 8, w - 8, h - 8], radius=28, fill=(12, 14, 17, 245), outline=BRASS, width=5)
    d.rounded_rectangle([26, 24, w - 26, h - 24], radius=20, fill=(6, 8, 10, 245), outline=(52, 58, 66, 255), width=3)
    for i, col in enumerate((CYAN, AMBER, (96, 214, 132, 255))):
        cx = 96 + i * 138
        d.rounded_rectangle([cx - 43, 46, cx + 43, h - 42], radius=20, fill=(16, 22, 26, 255), outline=BRASS_HI, width=4)
        d.rounded_rectangle([cx - 25, 62, cx + 25, h - 62], radius=18, fill=(col[0], col[1], col[2], 145),
                            outline=(8, 12, 14, 255), width=3)
        d.line([(cx - 10, 72), (cx - 10, h - 72)], fill=(245, 255, 255, 160), width=4)
    _bolts(d, [(26, 26), (w - 26, 26), (26, h - 26), (w - 26, h - 26)], 9)
    d.line([(44, h - 34), (w - 44, h - 34)], fill=(CYAN[0], CYAN[1], CYAN[2], 130), width=3)
    return im


def _mechanical_button(w, h, cap, glow_col, lit, pressed=False):
    im = _img(w, h)
    if lit:
        glow = _img(w, h)
        gd = ImageDraw.Draw(glow)
        gd.ellipse([18, 26, w - 18, h - 18], fill=(glow_col[0], glow_col[1], glow_col[2], 140))
        im.alpha_composite(_glow(glow, 10))
    d = ImageDraw.Draw(im)
    base_top = 62 if pressed else 70
    d.ellipse([18, h - 48, w - 18, h - 12], fill=(0, 0, 0, 120))
    d.rounded_rectangle([20, 52, w - 20, h - 24], radius=22, fill=(10, 12, 14, 255), outline=BRASS, width=5)
    d.ellipse([34, base_top, w - 34, h - 42], fill=(40, 44, 48, 255), outline=(12, 14, 16, 255), width=4)
    d.ellipse([42, base_top - 15, w - 42, h - 66], fill=cap, outline=(35, 24, 10, 255), width=3)
    d.arc([48, base_top - 10, w - 48, h - 76], start=205, end=335, fill=(255, 255, 255, 120), width=5)
    if lit:
        d.ellipse([w * 0.42, base_top - 2, w * 0.58, base_top + 14], fill=glow_col)
    return im


def draw_mech_button_cyan(w, h):
    return _mechanical_button(w, h, (70, 236, 248, 255), CYAN_HI, True)


def draw_mech_button_amber(w, h):
    return _mechanical_button(w, h, (226, 156, 52, 255), AMBER_HI, True)


def draw_mech_button_locked(w, h):
    return _mechanical_button(w, h, (68, 72, 78, 255), GREY, False, pressed=True)


def draw_cyan_core_capsule(w, h):
    im = _img(w, h)
    glow = _img(w, h)
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([28, 18, w - 28, h - 18], radius=34, fill=(CYAN[0], CYAN[1], CYAN[2], 150))
    im.alpha_composite(_glow(glow, 12))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([12, 12, w - 12, h - 12], radius=34, fill=(8, 10, 12, 250), outline=BRASS, width=5)
    d.rounded_rectangle([34, 26, w - 34, h - 26], radius=28, fill=(36, 218, 236, 130), outline=(4, 8, 10, 255), width=4)
    d.line([(w * 0.38, 42), (w * 0.38, h - 42)], fill=(238, 255, 255, 190), width=5)
    d.line([(w * 0.56, 48), (w * 0.56, h - 48)], fill=(10, 55, 62, 160), width=3)
    for cy in (30, h - 52):
        d.rounded_rectangle([24, cy, w - 24, cy + 22], radius=8, fill=BRASS, outline=(70, 52, 20, 255), width=2)
    return im


def draw_edge_light_bar_long(w, h):
    im = _img(w, h)
    glow = _img(w, h)
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([18, 20, w - 18, h - 20], radius=16, outline=(CYAN[0], CYAN[1], CYAN[2], 180), width=10)
    im.alpha_composite(_glow(glow, 8))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([8, 12, w - 8, h - 12], radius=18, fill=(6, 8, 10, 250), outline=BRASS, width=4)
    d.rounded_rectangle([34, 28, w - 34, h - 28], radius=10, fill=CYAN_HI, outline=(12, 28, 30, 255), width=3)
    d.line([(56, h * 0.44), (w - 56, h * 0.44)], fill=(255, 255, 255, 180), width=3)
    _bolts(d, [(22, h / 2), (w - 22, h / 2)], 7)
    return im


def draw_toggle_guard(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 10, w - 10, h - 10], radius=20, fill=(8, 10, 12, 250), outline=BRASS, width=5)
    for x in (42, w - 42):
        d.line([(x, 28), (x, h - 28)], fill=BRASS_HI, width=7)
        d.line([(x + 7, 34), (x + 7, h - 34)], fill=(70, 52, 20, 255), width=3)
    d.line([(w * 0.48, h * 0.68), (w * 0.62, h * 0.28)], fill=(22, 24, 28, 255), width=24)
    d.line([(w * 0.48, h * 0.68), (w * 0.62, h * 0.28)], fill=STEEL, width=12)
    d.ellipse([w * 0.54, h * 0.2, w * 0.72, h * 0.38], fill=(42, 48, 54, 255), outline=BRASS_HI, width=4)
    return im


def draw_cable_bundle(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    colors = [CYAN, AMBER, (96, 214, 132, 255), STEEL]
    for i, col in enumerate(colors):
        y = 32 + i * 22
        pts = [(8, y), (w * 0.26, y + 18), (w * 0.52, y - 10), (w * 0.78, y + 14), (w - 8, y)]
        g = _img(w, h)
        gd = ImageDraw.Draw(g)
        gd.line(pts, fill=(col[0], col[1], col[2], 90), width=13, joint="curve")
        im.alpha_composite(_glow(g, 5))
        d.line(pts, fill=col, width=6, joint="curve")
    d.rounded_rectangle([0, 18, 22, h - 18], radius=8, fill=(8, 10, 12, 255), outline=BRASS, width=3)
    d.rounded_rectangle([w - 22, 18, w, h - 18], radius=8, fill=(8, 10, 12, 255), outline=BRASS, width=3)
    return im


def draw_route_relay_block(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([8, 8, w - 8, h - 8], radius=18, fill=(9, 12, 14, 250), outline=BRASS, width=4)
    for i in range(3):
        x = 32 + i * 58
        d.rounded_rectangle([x, 30, x + 40, h - 34], radius=10, fill=(22, 27, 31, 255), outline=(58, 66, 74, 255), width=3)
        d.ellipse([x + 9, 45, x + 31, 67], fill=CYAN_HI if i != 1 else AMBER_HI)
        d.line([(x + 20, 77), (x + 20, h - 48)], fill=BRASS_HI, width=4)
    d.line([(20, h - 22), (w - 20, h - 22)], fill=(CYAN[0], CYAN[1], CYAN[2], 110), width=3)
    return im


def draw_glass_tube_cluster(w, h):
    im = _img(w, h)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 12, w - 10, h - 12], radius=20, fill=(7, 9, 11, 245), outline=BRASS, width=4)
    for i, col in enumerate((CYAN, CYAN_HI, (112, 238, 214, 255))):
        x = 45 + i * 52
        glow = _img(w, h)
        gd = ImageDraw.Draw(glow)
        gd.rounded_rectangle([x - 15, 32, x + 15, h - 36], radius=15, fill=(col[0], col[1], col[2], 140))
        im.alpha_composite(_glow(glow, 7))
        d.rounded_rectangle([x - 18, 28, x + 18, h - 32], radius=16, fill=(col[0], col[1], col[2], 120),
                            outline=(4, 8, 10, 255), width=3)
        d.line([(x - 6, 42), (x - 6, h - 46)], fill=(255, 255, 255, 160), width=3)
        for cy in (23, h - 43):
            d.rounded_rectangle([x - 25, cy, x + 25, cy + 16], radius=6, fill=BRASS, outline=(70, 52, 20, 255), width=2)
    return im


# Region table: name -> (w, h, draw_fn) -----------------------------------
SPRITES = [
    ("frame_corner_tl", 200, 200, draw_frame_corner_tl),
    ("frame_corner_tr", 200, 200, None),  # mirrored from tl
    ("frame_corner_br", 200, 200, None),
    ("frame_corner_bl", 200, 200, None),
    ("dial_ring", 360, 360, draw_dial_ring),
    ("dial_hub", 220, 220, draw_dial_hub),
    ("dial_pointer_cyan", 88, 128, draw_dial_pointer_cyan),
    ("option_plate_enabled", 248, 200, draw_option_plate_enabled),
    ("option_plate_disabled", 248, 200, draw_option_plate_disabled),
    ("option_plate_selected", 248, 200, draw_option_plate_selected),
    ("key_lens_authorized", 132, 188, draw_key_lens_authorized),
    ("key_lens_locked", 132, 188, draw_key_lens_locked),
    ("icon_door", 140, 140, draw_icon_door),
    ("icon_puzzle", 140, 140, draw_icon_puzzle),
    ("icon_robot", 140, 140, draw_icon_robot),
    ("icon_standby", 140, 140, draw_icon_standby),
    ("wire_cyan", 300, 72, draw_wire_cyan),
    ("wire_amber", 300, 72, draw_wire_amber),
    ("status_led_on", 64, 64, draw_status_led_on),
    ("status_led_off", 64, 64, draw_status_led_off),
    ("scanline_strip", 360, 64, draw_scanline_strip),
    ("brass_bracket", 360, 84, draw_brass_bracket),
    ("output_bay", 180, 300, draw_output_bay),
    ("output_tube_cyan", 96, 240, draw_output_tube_cyan),
    ("output_tube_amber", 96, 240, draw_output_tube_amber),
    ("output_tube_green", 96, 240, draw_output_tube_green),
    ("output_tube_violet", 96, 240, draw_output_tube_violet),
    ("output_tube_off", 96, 240, draw_output_tube_off),
    ("hazard_skirt", 520, 48, draw_hazard_skirt),
    ("route_output_module", 460, 220, draw_route_output_module),
    ("mech_button_cyan", 156, 172, draw_mech_button_cyan),
    ("mech_button_amber", 156, 172, draw_mech_button_amber),
    ("mech_button_locked", 156, 172, draw_mech_button_locked),
    ("cyan_core_capsule", 160, 300, draw_cyan_core_capsule),
    ("edge_light_bar_long", 360, 96, draw_edge_light_bar_long),
    ("toggle_guard", 180, 220, draw_toggle_guard),
    ("cable_bundle", 420, 130, draw_cable_bundle),
    ("route_relay_block", 220, 170, draw_route_relay_block),
    ("glass_tube_cluster", 220, 240, draw_glass_tube_cluster),
]

ATLAS_W = 1024
PAD = 10


def build_parts():
    rendered: dict[str, Image.Image] = {}
    tl = draw_frame_corner_tl(200, 200)
    rendered["frame_corner_tl"] = tl
    rendered["frame_corner_tr"] = tl.transpose(Image.FLIP_LEFT_RIGHT)
    rendered["frame_corner_bl"] = tl.transpose(Image.FLIP_TOP_BOTTOM)
    rendered["frame_corner_br"] = tl.transpose(Image.ROTATE_180)
    for name, w, h, fn in SPRITES:
        if name in rendered:
            continue
        rendered[name] = fn(w, h)

    # Shelf-pack into ATLAS_W.
    regions: dict[str, list[int]] = {}
    x = PAD
    y = PAD
    row_h = 0
    for name, w, h, _ in SPRITES:
        if x + w + PAD > ATLAS_W:
            x = PAD
            y += row_h + PAD
            row_h = 0
        regions[name] = [x, y, w, h]
        x += w + PAD
        row_h = max(row_h, h)
    atlas_h = y + row_h + PAD
    # round up to multiple of 4
    atlas_h = (atlas_h + 3) // 4 * 4

    atlas = Image.new("RGBA", (ATLAS_W, atlas_h), (0, 0, 0, 0))
    for name, (rx, ry, rw, rh) in regions.items():
        atlas.alpha_composite(rendered[name], (rx, ry))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    parts_path = OUT_DIR / "route_switch_parts_image2.png"
    atlas.save(parts_path, optimize=True)
    regions_path = OUT_DIR / "route_switch_parts_image2.regions.json"
    regions_path.write_text(json.dumps({"atlasSize": [ATLAS_W, atlas_h], "regions": regions}, indent=2) + "\n")
    print(f"wrote {parts_path} ({parts_path.stat().st_size} bytes, {ATLAS_W}x{atlas_h}, {len(regions)} regions)")
    print(f"wrote {regions_path}")


def build_background():
    W, H = 1280, 720
    im = Image.new("RGBA", (W, H), (10, 12, 15, 255))
    d = ImageDraw.Draw(im)
    # smoked glass vertical gradient
    for y in range(H):
        t = y / H
        c = (int(14 + 10 * (1 - t)), int(17 + 12 * (1 - t)), int(21 + 14 * (1 - t)))
        d.line([(0, y), (W, y)], fill=(*c, 255))
    # faint cyan route grid
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for gx in range(80, W, 96):
        gd.line([(gx, 60), (gx, H - 60)], fill=(CYAN[0], CYAN[1], CYAN[2], 26), width=1)
    for gy in range(80, H, 96):
        gd.line([(80, gy), (W - 80, gy)], fill=(CYAN[0], CYAN[1], CYAN[2], 22), width=1)
    im.alpha_composite(grid)
    # central recess
    cx, cy = W / 2, H / 2
    for r, a in ((250, 30), (210, 40), (170, 60)):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(CYAN[0], CYAN[1], CYAN[2], a), width=2)
    d.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], fill=(8, 10, 13, 180), outline=(MID[0], MID[1], MID[2], 160), width=4)
    # dark metal frame border
    d.rectangle([6, 6, W - 6, H - 6], outline=(MID[0], MID[1], MID[2], 255), width=8)
    d.rectangle([18, 18, W - 18, H - 18], outline=(40, 46, 54, 255), width=2)
    # amber corner accents
    for (ax, ay, dx, dy) in ((40, 40, 1, 1), (W - 40, 40, -1, 1), (40, H - 40, 1, -1), (W - 40, H - 40, -1, -1)):
        d.line([(ax, ay), (ax + dx * 70, ay)], fill=AMBER, width=4)
        d.line([(ax, ay), (ax, ay + dy * 70)], fill=AMBER, width=4)
    # vignette darkening at edges
    vig = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vig)
    vd.ellipse([-200, -120, W + 200, H + 120], fill=80)
    vig = vig.filter(ImageFilter.GaussianBlur(120))
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 120))
    im = Image.composite(im, Image.alpha_composite(im, dark), vig)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    bg_path = OUT_DIR / "route_switch_background_image2.png"
    # Flatten to RGB so the board is fully opaque (it is a backing plate, never a
    # transparent cutout) — semi-transparent draws above must not punch holes.
    im.convert("RGB").save(bg_path, optimize=True)
    print(f"wrote {bg_path} ({bg_path.stat().st_size} bytes, {W}x{H})")


if __name__ == "__main__":
    build_parts()
    build_background()
