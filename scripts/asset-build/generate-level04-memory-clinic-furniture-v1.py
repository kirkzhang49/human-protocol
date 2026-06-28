#!/usr/bin/env python3
"""Human Protocol - fresh Level 04 Memory Clinic furniture pack.

This generator intentionally replaces the abandoned Level 04 furniture lines.
It writes only the new Level 04 furniture family:

  src/assets/textures/environment/level04-memory-clinic-furniture-v1/
  src/assets/models-cooked/environment/level04-memory-clinic-furniture-v1/
  src/assets/source_blend/level04-memory-clinic-furniture-v1/
  src/assets/manifests/builder/hp_level04_memory_clinic_furniture_v1.json
  src/assets/manifests/runtime/human_protocol_level04_memory_clinic_furniture_v1.json
  src/assets/manifests/reports/level04_memory_clinic_furniture_v1_*.{json,md}

Design language:
  A bright premium hospital waiting-room reference pushed into a quiet sci-fi
  memory clinic: cold ceramic white, smoked titanium, frosted glass, blue
  medical upholstery, restrained lime wayfinding upholstery, cyan status light,
  red only as a tiny fault / lockdown state. No puzzle text or answers are
  baked into geometry or textures.

Run:
  python3 scripts/asset-build/generate-level04-memory-clinic-furniture-v1.py
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO = Path(__file__).resolve().parents[2]
PACK_ID = "hp_level04_memory_clinic_furniture_v1"
SOURCE_ID = "level04-memory-clinic-furniture-v1"

TEX_DIR = REPO / "src/assets/textures/environment/level04-memory-clinic-furniture-v1"
SRC_DIR = TEX_DIR / "image2-sources"
GLB_DIR = REPO / "src/assets/models-cooked/environment/level04-memory-clinic-furniture-v1"
SOURCE_BLEND_DIR = REPO / "src/assets/source_blend/level04-memory-clinic-furniture-v1"
MANIFEST = REPO / "src/assets/manifests/builder/hp_level04_memory_clinic_furniture_v1.json"
RUNTIME_MANIFEST = REPO / "src/assets/manifests/runtime/human_protocol_level04_memory_clinic_furniture_v1.json"
REPORT_DIR = REPO / "src/assets/manifests/reports"
TMP_DIR = REPO / ".tmp/level04-memory-clinic-furniture-v1"
ATLAS_PNG = TEX_DIR / "hp_level04_memory_clinic_furniture_v1_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level04_memory_clinic_furniture_v1_atlas.regions.json"
MASTER_IMAGE2_ATLAS = SRC_DIR / "level04_memory_clinic_furniture_v2_imagegen_material_atlas_master.png"
PROMPT_LEDGER_JSON = REPORT_DIR / "level04_memory_clinic_furniture_v1_prompt_ledger.json"
PROMPT_LEDGER_MD = REPORT_DIR / "level04_memory_clinic_furniture_v1_prompt_ledger.md"
PROVENANCE_JSON = REPORT_DIR / "level04_memory_clinic_furniture_v1_source_provenance.json"
PROVENANCE_MD = REPORT_DIR / "level04_memory_clinic_furniture_v1_source_provenance.md"
MATH_REPORT = REPORT_DIR / "level04_memory_clinic_furniture_v1_math_report.json"
BLENDER_REPORT = REPORT_DIR / "level04_memory_clinic_furniture_v1_blender_report.json"

BLENDER = Path("/Applications/Blender.app/Contents/MacOS/Blender")
BUILTIN_IMAGEGEN_SOURCE_PATH = "/Users/zhengkaizhang/.codex/generated_images/019ef50c-9bcf-75b0-a424-f1de17a0088b/ig_0914481077cff558016a3ab5941380819abe59679032e68323.png"
MASTER_IMAGE2_ATLAS_PROMPT = """Use case: stylized-concept
Asset type: 4x4 seamless material atlas for low-poly 3D game furniture textures
Primary request: Create one square 4 by 4 grid material atlas for a premium sci-fi cinema hospital / memory clinic furniture set. Each cell must be a distinct tileable PBR-looking material swatch, top-down orthographic, no perspective, no text, no numbers, no logos, no labels. The tiles should include: cold white ceramic composite with subtle panel seams; ivory medical cushion upholstery with stitched seams; blue-gray medical cushion upholstery with fine grain; restrained lime green waiting-room upholstery; smoked titanium brushed metal; black rubber toe-kick material; frosted glass with soft cyan internal haze; dark black glass blank screen; cyan emissive light strip material; tiny red fault indicator material; pale warm medical wood laminate; translucent privacy curtain fiber; surgical lens glass; plant green sterile leaves; dark acoustic mesh; soft gray drawer front.
Scene/backdrop: none, pure material atlas only
Subject: 16 square material swatches arranged in an exact 4x4 grid with crisp boundaries, consistent lighting, high material contrast, visible seams, vents, stitching, brushed metal grain, glass haze, and subtle sci-fi hospital polish.
Style: commercial-safe original generated bitmap, premium medical science fiction, restrained colors, high readability under game lighting, no UI, no symbols, no readable content.
Avoid: text, numbers, logos, brand marks, people, room scene, furniture objects, perspective camera, shadows crossing tile boundaries, decorative icons, puzzle symbols."""

MASTER_IMAGE2_CELLS = {
    "ceramic_white": [0, 0],
    "ivory_cushion": [1, 0],
    "blue_cushion": [2, 0],
    "lime_cushion": [3, 0],
    "smoked_titanium": [0, 1],
    "rubber_black": [1, 1],
    "frosted_glass": [2, 1],
    "black_glass_screen": [3, 1],
    "cyan_emissive": [0, 2],
    "red_fault": [1, 2],
    "warm_wood": [2, 2],
    "translucent_curtain": [3, 2],
    "surgical_lens": [0, 3],
    "plant_green": [1, 3],
    "dark_acoustic_mesh": [2, 3],
    "soft_gray_cushion": [3, 3],
}

for folder in (TEX_DIR, SRC_DIR, GLB_DIR, SOURCE_BLEND_DIR, MANIFEST.parent, RUNTIME_MANIFEST.parent, REPORT_DIR, TMP_DIR):
    folder.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(2026062304)


def slug_label(model_key: str) -> str:
    return model_key.replace("hp_l4_cineclinic_", "").replace("_", " ")


def noise(w: int, h: int, scale: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(2026062304 + seed)
    gw = max(2, int(w * scale))
    gh = max(2, int(h * scale))
    small = rng.standard_normal((gh, gw))
    img = Image.fromarray(((small - small.min()) / (np.ptp(small) + 1e-6) * 255).astype("uint8"))
    img = img.resize((w, h), Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(1.1))
    return np.asarray(img, dtype=np.float32) / 255.0 * 2.0 - 1.0


def vgrad(w: int, h: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    top_arr = np.array(top, dtype=np.float32)
    bottom_arr = np.array(bottom, dtype=np.float32)
    t = np.linspace(0.0, 1.0, h)[:, None, None]
    arr = top_arr[None, None, :] * (1 - t) + bottom_arr[None, None, :] * t
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA")


def to_rgba(arr: np.ndarray, alpha: int = 255) -> Image.Image:
    arr = np.clip(arr, 0, 255).astype("uint8")
    rgba = np.dstack([arr, np.full(arr.shape[:2], alpha, dtype="uint8")])
    return Image.fromarray(rgba, "RGBA")


def tile_panel(name: str, top: tuple[int, int, int], bottom: tuple[int, int, int], seed: int, seam: bool = True) -> Image.Image:
    w = h = 320
    base = vgrad(w, h, top, bottom)
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += noise(w, h, 0.07, seed)[..., None] * 7
    arr += noise(w, h, 0.22, seed + 11)[..., None] * 2
    img = to_rgba(arr)
    d = ImageDraw.Draw(img)
    if seam:
        d.rounded_rectangle([8, 8, w - 8, h - 8], radius=18, outline=(*bottom, 150), width=2)
        d.line([(w // 3, 18), (w // 3, h - 18)], fill=(*bottom, 88), width=1)
        d.line([(2 * w // 3, 18), (2 * w // 3, h - 18)], fill=(*bottom, 88), width=1)
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    sd.ellipse([-w * 0.25, -h * 0.5, w * 1.15, h * 0.35], fill=(255, 255, 255, 36))
    img = Image.alpha_composite(img, sheen.filter(ImageFilter.GaussianBlur(18)))
    img.info["assetMaterialName"] = name
    return img


def tile_fabric(name: str, base_col: tuple[int, int, int], hi: tuple[int, int, int], seed: int) -> Image.Image:
    w = h = 320
    arr = np.zeros((h, w, 3), dtype=np.float32)
    arr[:] = np.array(base_col, dtype=np.float32)
    arr += noise(w, h, 0.09, seed)[..., None] * 9
    for x in range(0, w, 7):
        arr[:, x : x + 1, :] += np.array(hi, dtype=np.float32) * 0.06
    for y in range(0, h, 11):
        arr[y : y + 1, :, :] -= 9
    img = to_rgba(arr)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([10, 10, w - 10, h - 10], radius=22, outline=(*hi, 88), width=2)
    img.info["assetMaterialName"] = name
    return img


def tile_glass(name: str, tint: tuple[int, int, int], seed: int, alpha: int = 210) -> Image.Image:
    w = h = 320
    base = vgrad(w, h, tuple(min(255, c + 52) for c in tint), tuple(max(0, c - 42) for c in tint))
    arr = np.asarray(base.convert("RGB"), dtype=np.float32)
    arr += noise(w, h, 0.06, seed)[..., None] * 8
    img = to_rgba(arr, alpha=alpha)
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.polygon([(w * 0.08, 0), (w * 0.24, 0), (w * 0.05, h), (-w * 0.12, h)], fill=(255, 255, 255, 52))
    gd.polygon([(w * 0.58, 0), (w * 0.68, 0), (w * 0.45, h), (w * 0.35, h)], fill=(240, 252, 255, 34))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(7)))
    img.info["assetMaterialName"] = name
    return img


def tile_screen(name: str, cyan: tuple[int, int, int], seed: int) -> Image.Image:
    w, h = 360, 240
    img = Image.new("RGBA", (w, h), (4, 11, 16, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, h, 8):
        d.line([(0, y), (w, y)], fill=(*cyan, 35 if (y // 8) % 2 == 0 else 20), width=1)
    for x in range(18, w, 44):
        d.line([(x, 14), (x, h - 14)], fill=(28, 120, 150, 58), width=1)
    for y in (h // 3, h // 2, 2 * h // 3):
        d.rounded_rectangle([22, y - 4, w - 22, y + 4], radius=4, fill=(*cyan, 165))
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rectangle([8, h // 4, w - 8, 3 * h // 4], fill=(*cyan, 44))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(13)))
    img.info["assetMaterialName"] = name
    return img


def tile_lens(name: str, seed: int) -> Image.Image:
    w = h = 240
    img = Image.new("RGBA", (w, h), (6, 12, 16, 255))
    d = ImageDraw.Draw(img)
    for r, color in [
        (104, (40, 60, 66, 255)),
        (78, (28, 220, 255, 150)),
        (46, (8, 28, 36, 240)),
        (18, (230, 250, 255, 190)),
    ]:
        d.ellipse([w // 2 - r, h // 2 - r, w // 2 + r, h // 2 + r], fill=color)
    d.arc([34, 34, w - 34, h - 34], 208, 320, fill=(140, 248, 255, 220), width=4)
    img.info["assetMaterialName"] = name
    return img


MATERIAL_TILES = {
    "ceramic_white": {
        "file": "ceramic_white_panel.png",
        "image": tile_panel("ceramic_white", (250, 252, 252), (190, 200, 204), 1),
        "color": [0.88, 0.92, 0.92, 1],
        "roughness": 0.42,
        "metallic": 0.03,
    },
    "smoked_titanium": {
        "file": "smoked_titanium_panel.png",
        "image": tile_panel("smoked_titanium", (92, 102, 110), (22, 28, 34), 2),
        "color": [0.18, 0.21, 0.24, 1],
        "roughness": 0.5,
        "metallic": 0.7,
    },
    "frosted_glass": {
        "file": "frosted_medical_glass.png",
        "image": tile_glass("frosted_glass", (165, 205, 216), 3, 178),
        "color": [0.62, 0.86, 0.92, 0.48],
        "roughness": 0.14,
        "metallic": 0.0,
        "alpha": 0.48,
    },
    "cyan_screen": {
        "file": "cyan_runtime_screen_glass.png",
        "image": tile_screen("cyan_screen", (72, 230, 255), 4),
        "color": [0.05, 0.42, 0.48, 1],
        "roughness": 0.22,
        "metallic": 0.18,
        "emission": [0.15, 0.85, 1.0],
        "emissionStrength": 0.35,
    },
    "black_glass_screen": {
        "file": "black_glass_blank_screen.png",
        "image": tile_panel("black_glass_screen", (18, 24, 28), (1, 3, 5), 15, seam=True),
        "color": [0.015, 0.02, 0.025, 1],
        "roughness": 0.16,
        "metallic": 0.18,
    },
    "blue_cushion": {
        "file": "medical_blue_cushion.png",
        "image": tile_fabric("blue_cushion", (69, 124, 168), (160, 215, 242), 5),
        "color": [0.22, 0.43, 0.62, 1],
        "roughness": 0.82,
        "metallic": 0.0,
    },
    "lime_cushion": {
        "file": "sterile_lime_cushion.png",
        "image": tile_fabric("lime_cushion", (163, 202, 74), (228, 245, 150), 6),
        "color": [0.56, 0.78, 0.24, 1],
        "roughness": 0.84,
        "metallic": 0.0,
    },
    "soft_gray_cushion": {
        "file": "soft_gray_cushion.png",
        "image": tile_fabric("soft_gray_cushion", (180, 184, 180), (238, 238, 226), 7),
        "color": [0.58, 0.61, 0.6, 1],
        "roughness": 0.86,
        "metallic": 0.0,
    },
    "warm_wood": {
        "file": "pale_clinic_wood_veneer.png",
        "image": tile_panel("warm_wood", (218, 198, 160), (156, 126, 88), 8, seam=False),
        "color": [0.72, 0.58, 0.38, 1],
        "roughness": 0.62,
        "metallic": 0.0,
    },
    "rubber_black": {
        "file": "matte_black_rubber_cable.png",
        "image": tile_panel("rubber_black", (38, 38, 44), (10, 10, 14), 9),
        "color": [0.03, 0.03, 0.04, 1],
        "roughness": 0.9,
        "metallic": 0.0,
    },
    "dark_acoustic_mesh": {
        "file": "dark_acoustic_mesh.png",
        "image": tile_panel("dark_acoustic_mesh", (20, 22, 23), (3, 3, 4), 16, seam=False),
        "color": [0.018, 0.02, 0.02, 1],
        "roughness": 0.88,
        "metallic": 0.1,
    },
    "translucent_curtain": {
        "file": "translucent_privacy_curtain.png",
        "image": tile_glass("translucent_curtain", (210, 226, 230), 10, 150),
        "color": [0.78, 0.88, 0.92, 0.42],
        "roughness": 0.72,
        "metallic": 0.0,
        "alpha": 0.42,
    },
    "surgical_lens": {
        "file": "surgical_lens_cluster.png",
        "image": tile_lens("surgical_lens", 11),
        "color": [0.75, 0.92, 0.95, 1],
        "roughness": 0.2,
        "metallic": 0.05,
        "emission": [0.78, 0.96, 1.0],
        "emissionStrength": 0.28,
    },
    "red_fault": {
        "file": "tiny_red_fault_light.png",
        "image": tile_screen("red_fault", (255, 84, 68), 12),
        "color": [0.9, 0.12, 0.08, 1],
        "roughness": 0.35,
        "metallic": 0.0,
        "emission": [1.0, 0.1, 0.04],
        "emissionStrength": 0.65,
    },
    "cyan_emissive": {
        "file": "cyan_status_light_strip.png",
        "image": tile_screen("cyan_emissive", (92, 238, 255), 13),
        "color": [0.15, 0.85, 1.0, 1],
        "roughness": 0.32,
        "metallic": 0.0,
        "emission": [0.15, 0.9, 1.0],
        "emissionStrength": 0.75,
    },
    "plant_green": {
        "file": "sterile_planter_green.png",
        "image": tile_fabric("plant_green", (64, 120, 92), (140, 210, 160), 14),
        "color": [0.18, 0.45, 0.28, 1],
        "roughness": 0.78,
        "metallic": 0.0,
    },
}


def bpart(kind: str, name: str, mat: str, loc: list[float], **kwargs) -> dict:
    part = {"kind": kind, "name": name, "material": mat, "loc": loc}
    part.update(kwargs)
    return part


def box(name: str, mat: str, loc: list[float], dims: list[float], bevel: float = 0.025, rot: list[float] | None = None) -> dict:
    return bpart("box", name, mat, loc, dims=dims, bevel=bevel, rot=rot or [0, 0, 0])


def cyl(name: str, mat: str, loc: list[float], radius: float, depth: float, rot: list[float] | None = None, vertices: int = 32) -> dict:
    return bpart("cylinder", name, mat, loc, radius=radius, depth=depth, rot=rot or [0, 0, 0], vertices=vertices)


def sphere(name: str, mat: str, loc: list[float], radius: float, scale: list[float] | None = None) -> dict:
    return bpart("sphere", name, mat, loc, radius=radius, scale=scale or [1, 1, 1])


def asset(
    key: str,
    label: str,
    family: str,
    size: list[float],
    solid: bool,
    footprint: str,
    mount: str,
    role: str,
    room_hints: list[str],
    priority: str,
    parts: list[dict],
    prompt: str,
    can_hold: bool = False,
    clue_capacity: int = 0,
    wall_preferred: str | None = None,
) -> dict:
    return {
        "modelKey": key,
        "label": label,
        "assetKind": "furniture",
        "family": family,
        "group": "诊疗",
        "source": SOURCE_ID,
        "sourceAssetId": f"{key}_source_v1",
        "themeId": "hp_l4_memory_clinic_premium_sci_fi_hospital_v1",
        "glbFile": f"../../models-cooked/environment/level04-memory-clinic-furniture-v1/{key}.glb",
        "sizeMeters": size,
        "solid": solid,
        "mount": mount,
        "canHoldSmallProps": can_hold,
        "clueCapacity": clue_capacity,
        "footprintFamily": footprint,
        "tags": [
            "level:04",
            "theme:memory-clinic",
            "style:premium-sci-fi-hospital",
            f"priority:{priority.lower()}",
        ],
        **({"wallPreferred": wall_preferred} if wall_preferred else {}),
        "_role": role,
        "_roomHints": room_hints,
        "_priority": priority,
        "_parts": parts,
        "_prompt": prompt,
    }


ASSETS = [
    asset(
        "hp_l4_cineclinic_decon_gate",
        "入口消毒扫描门",
        "control_console",
        [2.65, 2.62, 0.72],
        False,
        "barrier",
        "floor",
        "入口路标 / 消毒扫描压迫感",
        ["level_04_entry_decon"],
        "P1",
        [
            box("left_white_column", "ceramic_white", [-1.14, 0, 1.25], [0.22, 0.42, 2.5], 0.045),
            box("right_white_column", "ceramic_white", [1.14, 0, 1.25], [0.22, 0.42, 2.5], 0.045),
            box("top_scanner_bridge", "ceramic_white", [0, 0, 2.48], [2.52, 0.48, 0.24], 0.04),
            box("rear_frosted_panel", "frosted_glass", [0, -0.16, 1.44], [2.0, 0.06, 1.65], 0.025),
            box("cyan_scan_slit", "cyan_emissive", [0, 0.24, 1.58], [1.82, 0.035, 0.045], 0.01),
            cyl("top_lens_left", "surgical_lens", [-0.45, 0.27, 2.34], 0.105, 0.04, [math.pi / 2, 0, 0]),
            cyl("top_lens_right", "surgical_lens", [0.45, 0.27, 2.34], 0.105, 0.04, [math.pi / 2, 0, 0]),
        ],
        "Premium sci-fi hospital decontamination scan gate, white ceramic frame, frosted glass back panel, subtle cyan scan slit, no text, no logo, clean cinematic medical facility.",
    ),
    asset(
        "hp_l4_cineclinic_reception_counter",
        "分诊接待台",
        "desk",
        [3.2, 1.28, 0.86],
        True,
        "table",
        "floor",
        "候诊厅主锚点 / 轻遮挡",
        ["level_04_waiting_room"],
        "P0",
        [
            box("smoked_recess_base", "smoked_titanium", [0, 0, 0.28], [2.95, 0.72, 0.56], 0.05),
            box("white_front_slab", "ceramic_white", [0, 0.38, 0.76], [3.18, 0.12, 0.52], 0.04),
            box("floating_top_counter", "ceramic_white", [0, -0.03, 1.04], [3.28, 0.92, 0.16], 0.055),
            box("frosted_privacy_screen", "frosted_glass", [0, -0.36, 1.38], [2.2, 0.05, 0.58], 0.02),
            box("cyan_triage_rule", "cyan_emissive", [0.3, 0.455, 0.99], [1.8, 0.026, 0.035], 0.005),
            box("red_fault_tick", "red_fault", [1.36, 0.457, 0.7], [0.13, 0.026, 0.05], 0.004),
        ],
        "Luxury sci-fi clinic reception counter, calm white ceramic, smoked titanium recessed base, frosted privacy glass, thin cyan status light, premium medical film set, no text.",
        can_hold=True,
        clue_capacity=1,
    ),
    asset(
        "hp_l4_cineclinic_waiting_sofa_row",
        "候诊软座排",
        "sofa_bench",
        [2.55, 0.88, 0.82],
        True,
        "sofa",
        "floor",
        "候诊厅软性遮挡 / 人味反差",
        ["level_04_waiting_room"],
        "P0",
        [
            box("rear_ceramic_spine", "ceramic_white", [0, -0.34, 0.62], [2.5, 0.14, 0.52], 0.07, [-0.08, 0, 0]),
            box("seat_pad_left", "soft_gray_cushion", [-0.62, 0.08, 0.42], [1.16, 0.66, 0.18], 0.08),
            box("seat_pad_right", "lime_cushion", [0.62, 0.08, 0.42], [1.16, 0.66, 0.18], 0.08),
            box("left_arm", "ceramic_white", [-1.36, 0.04, 0.58], [0.16, 0.72, 0.52], 0.06),
            box("right_arm", "ceramic_white", [1.36, 0.04, 0.58], [0.16, 0.72, 0.52], 0.06),
            cyl("front_bar", "smoked_titanium", [0, 0.39, 0.28], 0.035, 2.32, [0, math.pi / 2, 0], 18),
            cyl("leg_1", "smoked_titanium", [-1.05, 0.29, 0.18], 0.035, 0.36, [0, 0, 0], 16),
            cyl("leg_2", "smoked_titanium", [1.05, 0.29, 0.18], 0.035, 0.36, [0, 0, 0], 16),
        ],
        "Premium hospital waiting sofa row, white shell, soft grey and restrained lime cushions, thin metal legs, rounded high-end furniture, no people, no text.",
    ),
    asset(
        "hp_l4_cineclinic_lime_ottoman",
        "青柠模块脚凳",
        "sofa_bench",
        [0.86, 0.48, 0.86],
        True,
        "sofa",
        "floor",
        "候诊厅色彩锚点 / 低遮挡",
        ["level_04_waiting_room"],
        "P2",
        [
            box("lime_soft_cube", "lime_cushion", [0, 0, 0.34], [0.82, 0.82, 0.48], 0.11),
            box("metal_shadow_plinth", "smoked_titanium", [0, 0, 0.08], [0.72, 0.72, 0.08], 0.03),
            cyl("caster_1", "smoked_titanium", [-0.27, 0.27, 0.05], 0.04, 0.05, [math.pi / 2, 0, 0], 16),
            cyl("caster_2", "smoked_titanium", [0.27, 0.27, 0.05], 0.04, 0.05, [math.pi / 2, 0, 0], 16),
        ],
        "Single lime green modular hospital ottoman, soft rounded cube on tiny hidden casters, premium waiting-room furniture, clean sci-fi clinic palette, no text.",
    ),
    asset(
        "hp_l4_cineclinic_side_table_planter",
        "候诊小桌与无菌盆栽",
        "desk",
        [0.86, 0.82, 0.72],
        True,
        "table",
        "floor",
        "人味细节 / 候诊区比例参照",
        ["level_04_waiting_room"],
        "P2",
        [
            box("rounded_table_top", "warm_wood", [0, 0, 0.62], [0.82, 0.68, 0.08], 0.08),
            cyl("center_pedestal", "ceramic_white", [0, 0, 0.34], 0.055, 0.56, [0, 0, 0], 18),
            box("flat_foot", "smoked_titanium", [0, 0, 0.05], [0.52, 0.42, 0.06], 0.05),
            box("white_planter", "ceramic_white", [0, 0, 0.76], [0.38, 0.28, 0.16], 0.035),
            sphere("leaf_cluster_a", "plant_green", [-0.08, 0.02, 0.9], 0.11, [1.2, 0.75, 0.55]),
            sphere("leaf_cluster_b", "plant_green", [0.08, -0.02, 0.88], 0.1, [1.1, 0.85, 0.55]),
        ],
        "Small premium clinic side table with pale wood top, white ceramic pedestal, tiny sterile rectangular planter, cinematic modern hospital detail, no text.",
        can_hold=True,
    ),
    asset(
        "hp_l4_cineclinic_triage_kiosk",
        "分诊号码亭",
        "control_console",
        [0.78, 1.56, 0.58],
        True,
        "table",
        "floor",
        "未来 puzzle host / 候诊方向提示",
        ["level_04_waiting_room"],
        "P1",
        [
            box("tapered_base", "smoked_titanium", [0, 0, 0.22], [0.58, 0.46, 0.42], 0.055),
            box("white_upper_shell", "ceramic_white", [0, 0, 0.82], [0.64, 0.42, 0.76], 0.065),
            box("tilted_screen", "cyan_screen", [0, 0.24, 1.13], [0.52, 0.045, 0.34], 0.025, [math.radians(-10), 0, 0]),
            box("cyan_side_slit", "cyan_emissive", [0.36, 0.01, 0.86], [0.028, 0.28, 0.56], 0.006),
        ],
        "Free-standing triage kiosk for a memory clinic, white ceramic slanted screen body, dark smoked titanium base, cyan runtime display with no readable text or numbers.",
        can_hold=True,
        clue_capacity=2,
    ),
    asset(
        "hp_l4_cineclinic_med_cabinet",
        "无菌药品柜",
        "cabinet",
        [1.05, 1.94, 0.52],
        True,
        "cabinet",
        "floor",
        "叙事储物 / 补给或线索插槽",
        ["level_04_waiting_room", "level_04_body_chair"],
        "P0",
        [
            box("cabinet_body", "ceramic_white", [0, 0, 0.98], [1.0, 0.5, 1.86], 0.055),
            box("glass_door_left", "frosted_glass", [-0.25, 0.265, 1.06], [0.43, 0.035, 1.36], 0.018),
            box("glass_door_right", "frosted_glass", [0.25, 0.265, 1.06], [0.43, 0.035, 1.36], 0.018),
            box("titanium_plinth", "smoked_titanium", [0, 0, 0.08], [1.05, 0.55, 0.16], 0.03),
            box("cyan_lock_strip", "cyan_emissive", [0.0, 0.287, 1.66], [0.72, 0.024, 0.036], 0.004),
            box("red_fault_dot", "red_fault", [0.42, 0.292, 1.32], [0.05, 0.02, 0.05], 0.01),
        ],
        "Tall sterile medicine cabinet, white ceramic shell, frosted glass double doors, shadowed titanium base, tiny cyan lock strip, no labels, no readable text.",
        can_hold=True,
        clue_capacity=3,
        wall_preferred="back",
    ),
    asset(
        "hp_l4_cineclinic_record_wall_cabinet",
        "记忆档案壁柜",
        "drawer_chest",
        [1.34, 1.36, 0.42],
        True,
        "cabinet",
        "floor",
        "档案线索 / 低墙面节奏",
        ["level_04_waiting_room", "level_04_childhood_chair"],
        "P1",
        [
            box("drawer_body", "ceramic_white", [0, 0, 0.72], [1.3, 0.4, 1.2], 0.045),
            box("dark_recess", "smoked_titanium", [0, 0.225, 0.74], [1.12, 0.04, 0.92], 0.02),
            *[
                box(f"drawer_{r}_{c}", "soft_gray_cushion" if (r + c) % 2 else "ceramic_white", [-0.36 + c * 0.36, 0.255, 0.42 + r * 0.24], [0.28, 0.045, 0.16], 0.018)
                for r in range(4)
                for c in range(3)
            ],
            box("cyan_archive_rule", "cyan_emissive", [0, 0.278, 1.22], [0.98, 0.022, 0.035], 0.004),
        ],
        "Memory record cabinet with many small blank drawers, premium sci-fi hospital filing furniture, white ceramic and smoked titanium, no readable labels.",
        can_hold=True,
        clue_capacity=3,
        wall_preferred="back",
    ),
    asset(
        "hp_l4_cineclinic_exam_table",
        "高级检查床柜",
        "bed_or_exam_table",
        [2.28, 1.18, 0.92],
        True,
        "bed",
        "floor",
        "诊疗床参考 / 身体房支撑件",
        ["level_04_body_chair"],
        "P0",
        [
            box("cabinet_base", "ceramic_white", [0, 0, 0.38], [2.0, 0.82, 0.68], 0.055),
            box("dark_toe_kick", "smoked_titanium", [0, 0, 0.11], [2.08, 0.88, 0.14], 0.02),
            box("blue_reclined_pad", "blue_cushion", [-0.18, -0.04, 0.88], [1.95, 0.82, 0.16], 0.09, [math.radians(-8), 0, 0]),
            box("head_pad", "blue_cushion", [-0.78, -0.11, 1.04], [0.76, 0.82, 0.18], 0.09, [math.radians(-18), 0, 0]),
            box("drawer_bank", "soft_gray_cushion", [0.62, 0.43, 0.48], [0.62, 0.055, 0.48], 0.02),
            box("black_step", "rubber_black", [0.86, 0.68, 0.16], [0.62, 0.42, 0.1], 0.02),
        ],
        "High-end medical exam table with integrated cabinet base and blue reclining cushion, cleaner and more futuristic than retail medical furniture, no brand, no text.",
        can_hold=True,
        clue_capacity=1,
    ),
    asset(
        "hp_l4_cineclinic_memory_recliner",
        "记忆治疗躺椅",
        "bed_or_exam_table",
        [1.42, 1.48, 1.82],
        True,
        "bed",
        "floor",
        "三椅室核心交互锚点",
        ["level_04_childhood_chair", "level_04_rescue_chair", "level_04_body_chair"],
        "P0",
        [
            box("titanium_floor_anchor", "smoked_titanium", [0, 0.08, 0.12], [0.92, 0.72, 0.18], 0.045),
            cyl("lift_column", "smoked_titanium", [0, 0.04, 0.42], 0.11, 0.58, [0, 0, 0], 24),
            box("seat_pad", "blue_cushion", [0, 0.18, 0.7], [0.98, 0.92, 0.18], 0.09, [math.radians(-5), 0, 0]),
            box("back_pad", "blue_cushion", [0, -0.46, 1.08], [1.02, 0.74, 0.18], 0.09, [math.radians(-43), 0, 0]),
            box("head_ring_mount", "ceramic_white", [0, -0.76, 1.42], [0.62, 0.18, 0.22], 0.07, [math.radians(-43), 0, 0]),
            cyl("memory_head_ring", "frosted_glass", [0, -0.85, 1.55], 0.23, 0.045, [math.pi / 2, 0, 0], 36),
            box("left_arm_rest", "ceramic_white", [-0.66, 0.14, 0.82], [0.11, 0.82, 0.13], 0.045),
            box("right_arm_rest", "ceramic_white", [0.66, 0.14, 0.82], [0.11, 0.82, 0.13], 0.045),
            box("cyan_chest_reader", "cyan_emissive", [0, 0.67, 0.92], [0.58, 0.035, 0.05], 0.008),
        ],
        "Cinematic sci-fi memory therapy recliner, blue medical cushions, white ceramic arm restraints, smoked titanium lift column, frosted head memory ring, cyan status light, no text.",
        clue_capacity=2,
    ),
    asset(
        "hp_l4_cineclinic_scan_arch",
        "记忆扫描拱",
        "control_console",
        [1.96, 2.05, 0.82],
        False,
        "barrier",
        "floor",
        "治疗椅背后的机器框架",
        ["level_04_childhood_chair", "level_04_rescue_chair", "level_04_body_chair"],
        "P0",
        [
            box("left_arch_spine", "ceramic_white", [-0.84, 0, 0.98], [0.18, 0.5, 1.82], 0.05),
            box("right_arch_spine", "ceramic_white", [0.84, 0, 0.98], [0.18, 0.5, 1.82], 0.05),
            box("top_arch_bridge", "ceramic_white", [0, 0, 1.88], [1.84, 0.52, 0.2], 0.05),
            box("inner_frosted_curve_panel", "frosted_glass", [0, -0.08, 1.16], [1.34, 0.045, 1.28], 0.025),
            cyl("left_sensor", "surgical_lens", [-0.72, 0.28, 1.36], 0.09, 0.04, [math.pi / 2, 0, 0]),
            cyl("right_sensor", "surgical_lens", [0.72, 0.28, 1.36], 0.09, 0.04, [math.pi / 2, 0, 0]),
            box("cyan_top_rule", "cyan_emissive", [0, 0.28, 1.78], [1.2, 0.028, 0.035], 0.004),
        ],
        "U-shaped memory scan arch behind a treatment chair, white ceramic side spines, frosted glass inner panel, surgical sensors, restrained cyan light, no target symbols, no text.",
        clue_capacity=2,
    ),
    asset(
        "hp_l4_cineclinic_projection_pod",
        "记忆投影舱",
        "control_console",
        [0.98, 1.42, 1.26],
        True,
        "lamp",
        "floor",
        "假童年/假救援来源",
        ["level_04_childhood_chair", "level_04_rescue_chair"],
        "P0",
        [
            box("rolling_base", "smoked_titanium", [0, 0, 0.16], [0.68, 0.72, 0.18], 0.04),
            cyl("angled_support", "smoked_titanium", [0, -0.08, 0.67], 0.055, 0.96, [math.radians(15), 0, 0], 18),
            box("white_projector_shell", "ceramic_white", [0, -0.22, 1.14], [0.72, 0.48, 0.34], 0.065, [math.radians(-8), 0, 0]),
            cyl("main_lens", "surgical_lens", [0, 0.04, 1.14], 0.17, 0.07, [math.pi / 2, 0, 0], 36),
            box("cyan_side_gill", "cyan_emissive", [-0.39, -0.22, 1.18], [0.03, 0.24, 0.12], 0.005),
            box("red_micro_fault", "red_fault", [0.38, -0.03, 1.02], [0.045, 0.025, 0.045], 0.004),
        ],
        "Memory projection pod, compact wheeled sci-fi medical projector with ceramic shell, smoked titanium support, one glass lens, restrained cyan gill, no text or symbols.",
    ),
    asset(
        "hp_l4_cineclinic_rescue_speaker_panel",
        "墙内救援声栅",
        "wall_panel_or_picture_frame",
        [1.24, 0.72, 0.12],
        False,
        "wall_panel",
        "wall",
        "救援房误导声源",
        ["level_04_rescue_chair"],
        "P2",
        [
            box("white_wall_frame", "ceramic_white", [0, 0, 0.36], [1.24, 0.1, 0.72], 0.035),
            box("dark_acoustic_mesh", "smoked_titanium", [0, 0.065, 0.36], [1.02, 0.035, 0.48], 0.015),
            *[
                box(f"cyan_sound_slit_{i}", "cyan_emissive", [0, 0.089, 0.19 + i * 0.085], [0.82, 0.018, 0.018], 0.002)
                for i in range(5)
            ],
        ],
        "Wall-mounted hidden rescue speaker grille, white hospital panel with dark acoustic mesh and faint cyan slits, premium sci-fi clinic, no readable text.",
        wall_preferred="back",
    ),
    asset(
        "hp_l4_cineclinic_cable_trolley",
        "神经电缆推车",
        "storage_crate",
        [0.82, 1.36, 0.68],
        True,
        "crate",
        "floor",
        "移动医疗设备 / 低遮挡",
        ["level_04_rescue_chair", "level_04_body_chair", "level_04_therapy_theater"],
        "P1",
        [
            box("lower_cart_tray", "smoked_titanium", [0, 0, 0.34], [0.74, 0.58, 0.14], 0.035),
            box("upper_cart_tray", "ceramic_white", [0, 0, 0.88], [0.76, 0.56, 0.14], 0.04),
            cyl("left_post", "smoked_titanium", [-0.33, -0.22, 0.7], 0.026, 0.92, [0, 0, 0], 12),
            cyl("right_post", "smoked_titanium", [0.33, -0.22, 0.7], 0.026, 0.92, [0, 0, 0], 12),
            cyl("cable_spool", "rubber_black", [0, 0.18, 0.68], 0.23, 0.16, [math.pi / 2, 0, 0], 36),
            box("cyan_connector_row", "cyan_emissive", [0, 0.305, 0.92], [0.48, 0.024, 0.036], 0.004),
        ],
        "Neural cable trolley, compact sterile medical cart, white trays, smoked titanium posts, black cable spool, cyan connector row, no text.",
        can_hold=True,
        clue_capacity=1,
    ),
    asset(
        "hp_l4_cineclinic_observation_desk",
        "观察控制台",
        "desk",
        [1.72, 1.34, 1.16],
        True,
        "table",
        "floor",
        "监视感 / 未来 puzzle host",
        ["level_04_waiting_room", "level_04_body_chair"],
        "P1",
        [
            box("crescent_base_left", "smoked_titanium", [-0.38, 0, 0.42], [0.62, 0.94, 0.72], 0.06, [0, 0, math.radians(-3)]),
            box("crescent_base_right", "smoked_titanium", [0.38, 0, 0.42], [0.62, 0.94, 0.72], 0.06, [0, 0, math.radians(3)]),
            box("white_wrap_top", "ceramic_white", [0, 0, 0.9], [1.62, 1.04, 0.16], 0.07),
            box("main_runtime_screen", "cyan_screen", [0, 0.54, 1.08], [1.18, 0.04, 0.34], 0.025, [math.radians(-12), 0, 0]),
            box("frosted_side_wing_l", "frosted_glass", [-0.86, 0.02, 0.8], [0.05, 0.82, 0.52], 0.02),
            box("frosted_side_wing_r", "frosted_glass", [0.86, 0.02, 0.8], [0.05, 0.82, 0.52], 0.02),
        ],
        "Observation control desk for a sci-fi memory clinic, crescent-like premium workstation, white ceramic wrap top, cyan runtime screen, frosted glass side wings, no text.",
        can_hold=True,
        clue_capacity=2,
    ),
    asset(
        "hp_l4_cineclinic_surgical_light",
        "无影手术灯",
        "wall_panel_or_picture_frame",
        [1.06, 1.22, 0.92],
        False,
        "lamp",
        "ceiling",
        "身体揭示聚光 / 顶部视觉锚",
        ["level_04_body_chair", "level_04_therapy_theater"],
        "P0",
        [
            cyl("ceiling_mount", "smoked_titanium", [0, 0, 1.16], 0.12, 0.12, [0, 0, 0], 24),
            cyl("arm_a", "ceramic_white", [-0.22, 0, 0.92], 0.035, 0.66, [0, math.radians(68), 0], 16),
            cyl("arm_b", "ceramic_white", [0.24, 0, 0.78], 0.035, 0.58, [0, math.radians(-58), 0], 16),
            cyl("lamp_hub", "smoked_titanium", [0, 0, 0.58], 0.18, 0.08, [math.pi / 2, 0, 0], 32),
            *[
                cyl(f"petal_lens_{i}", "surgical_lens", [math.cos(i * math.tau / 6) * 0.24, math.sin(i * math.tau / 6) * 0.24, 0.55], 0.115, 0.045, [math.pi / 2, 0, 0], 24)
                for i in range(6)
            ],
        ],
        "Ceiling mounted surgical light for cinematic sci-fi clinic, articulated white ceramic arms, smoked titanium hub, six soft frosted lenses, restrained glow, no text.",
    ),
    asset(
        "hp_l4_cineclinic_monitor_arm",
        "身体监视机械臂",
        "control_console",
        [2.18, 1.78, 0.72],
        True,
        "table",
        "floor",
        "身体房大屏/公式载体，但内容 runtime",
        ["level_04_body_chair"],
        "P0",
        [
            cyl("floor_spine", "smoked_titanium", [0, -0.22, 0.78], 0.055, 1.38, [0, 0, 0], 18),
            cyl("left_joint_arm", "smoked_titanium", [-0.42, -0.08, 1.22], 0.035, 0.92, [0, math.radians(74), math.radians(8)], 16),
            cyl("right_joint_arm", "smoked_titanium", [0.42, -0.08, 1.22], 0.035, 0.92, [0, math.radians(-74), math.radians(-8)], 16),
            box("screen_frame", "smoked_titanium", [0, 0.24, 1.36], [1.78, 0.12, 0.72], 0.045),
            box("runtime_screen_surface", "cyan_screen", [0, 0.315, 1.36], [1.54, 0.035, 0.54], 0.02),
            box("white_side_module_l", "ceramic_white", [-1.02, 0.2, 1.22], [0.22, 0.18, 0.36], 0.035),
            box("white_side_module_r", "ceramic_white", [1.02, 0.2, 1.22], [0.22, 0.18, 0.36], 0.035),
        ],
        "Body monitoring articulated arm cluster, suspended wide runtime screen, smoked titanium joints, white side modules, cyan glass display with no baked text or numbers.",
        can_hold=True,
        clue_capacity=2,
    ),
    asset(
        "hp_l4_cineclinic_privacy_screen",
        "身体遮挡隐私屏",
        "wall_panel_or_picture_frame",
        [1.86, 1.92, 0.32],
        False,
        "barrier",
        "floor",
        "身体反转遮挡 / 半透明恐怖感",
        ["level_04_body_chair"],
        "P1",
        [
            cyl("left_rail", "smoked_titanium", [-0.86, 0, 0.98], 0.03, 1.82, [0, 0, 0], 16),
            cyl("right_rail", "smoked_titanium", [0.86, 0, 0.98], 0.03, 1.82, [0, 0, 0], 16),
            cyl("top_rail", "smoked_titanium", [0, 0, 1.88], 0.03, 1.74, [0, math.pi / 2, 0], 16),
            box("translucent_panel_a", "translucent_curtain", [-0.42, 0.02, 0.98], [0.78, 0.035, 1.55], 0.025),
            box("translucent_panel_b", "translucent_curtain", [0.42, -0.02, 0.98], [0.78, 0.035, 1.55], 0.025),
            box("tiny_red_edge", "red_fault", [0.9, 0.035, 1.5], [0.03, 0.022, 0.46], 0.004),
        ],
        "Semi-transparent medical privacy screen, smoked titanium rail frame, frosted white curtain panels, one tiny red fault edge, eerie premium sci-fi hospital prop, no text.",
    ),
    asset(
        "hp_l4_cineclinic_sedation_gate",
        "镇静闸门",
        "control_console",
        [1.92, 2.36, 0.72],
        False,
        "barrier",
        "floor",
        "治疗剧场前的安全/镇静门槛",
        ["level_04_therapy_theater"],
        "P0",
        [
            box("left_gate_tower", "smoked_titanium", [-0.78, 0, 1.12], [0.28, 0.52, 2.18], 0.055),
            box("right_gate_tower", "smoked_titanium", [0.78, 0, 1.12], [0.28, 0.52, 2.18], 0.055),
            box("white_crossbar", "ceramic_white", [0, 0, 1.86], [1.72, 0.46, 0.18], 0.04),
            box("low_frosted_gate_panel", "frosted_glass", [0, 0.02, 0.86], [1.18, 0.05, 0.86], 0.025),
            box("red_lock_line", "red_fault", [0, 0.305, 1.36], [1.24, 0.026, 0.04], 0.004),
            box("cyan_ready_line", "cyan_emissive", [0, 0.306, 1.5], [0.74, 0.026, 0.034], 0.004),
        ],
        "Sedation gate for a therapy theater, two dark titanium medical towers, white crossbar, low frosted glass safety panel, small red lockdown line, no text.",
        clue_capacity=2,
    ),
    asset(
        "hp_l4_cineclinic_theater_wall",
        "治疗剧场背墙",
        "wall_panel_or_picture_frame",
        [5.05, 2.32, 0.42],
        True,
        "wall_panel",
        "floor",
        "boss/剧场背景，不含怪和玩法",
        ["level_04_therapy_theater"],
        "P1",
        [
            box("dark_backer_wall", "smoked_titanium", [0, 0, 1.16], [5.0, 0.28, 2.22], 0.035),
            box("center_ceramic_treatment_bay", "ceramic_white", [0, 0.18, 1.16], [2.25, 0.22, 1.62], 0.055),
            box("left_frosted_baffle", "frosted_glass", [-1.78, 0.22, 1.14], [0.52, 0.08, 1.86], 0.025),
            box("right_frosted_baffle", "frosted_glass", [1.78, 0.22, 1.14], [0.52, 0.08, 1.86], 0.025),
            box("wide_cyan_horizon", "cyan_emissive", [0, 0.34, 1.68], [3.6, 0.024, 0.04], 0.004),
            box("red_therapy_warning", "red_fault", [0, 0.35, 0.62], [1.1, 0.024, 0.04], 0.004),
        ],
        "Wide therapy theater back wall, smoked titanium medical wall, white central treatment bay, frosted side baffles, restrained cyan horizon and tiny red warning, no text.",
        wall_preferred="back",
    ),
]


def asset_by_key(key: str) -> dict:
    for item in ASSETS:
        if item["modelKey"] == key:
            return item
    raise KeyError(key)


def append_parts(key: str, parts: list[dict]) -> None:
    asset_by_key(key)["_parts"].extend(parts)


def replace_part_material(key: str, names: set[str], material: str) -> None:
    for part in asset_by_key(key)["_parts"]:
        if part["name"] in names:
            part["material"] = material


def apply_v2_visual_polish() -> None:
    replace_part_material("hp_l4_cineclinic_observation_desk", {"main_runtime_screen"}, "black_glass_screen")
    replace_part_material("hp_l4_cineclinic_monitor_arm", {"runtime_screen_surface"}, "black_glass_screen")
    replace_part_material("hp_l4_cineclinic_rescue_speaker_panel", {"dark_acoustic_mesh"}, "dark_acoustic_mesh")

    append_parts(
        "hp_l4_cineclinic_decon_gate",
        [
            box("floor_threshold_black_rubber", "rubber_black", [0, 0.08, 0.055], [2.35, 0.56, 0.08], 0.025),
            box("left_floor_foot_plate", "smoked_titanium", [-1.14, 0.02, 0.16], [0.42, 0.64, 0.08], 0.03),
            box("right_floor_foot_plate", "smoked_titanium", [1.14, 0.02, 0.16], [0.42, 0.64, 0.08], 0.03),
            box("front_black_sensor_band", "black_glass_screen", [0, 0.255, 2.2], [1.42, 0.035, 0.16], 0.015),
            box("front_scan_veil", "translucent_curtain", [0, 0.18, 1.16], [1.76, 0.028, 1.36], 0.018),
            box("lower_cyan_floor_line", "cyan_emissive", [0, 0.37, 0.18], [1.72, 0.018, 0.026], 0.003),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_reception_counter",
        [
            box("front_black_glass_inset", "black_glass_screen", [-0.74, 0.457, 0.74], [0.86, 0.024, 0.28], 0.012),
            box("front_left_panel_seam", "smoked_titanium", [-1.48, 0.466, 0.78], [0.018, 0.014, 0.38], 0.002),
            box("front_right_panel_seam", "smoked_titanium", [1.48, 0.466, 0.78], [0.018, 0.014, 0.38], 0.002),
            box("under_counter_cyan_wash", "cyan_emissive", [-0.7, 0.335, 0.96], [0.72, 0.018, 0.026], 0.003),
            box("left_return_cheek", "ceramic_white", [-1.54, -0.03, 0.72], [0.1, 0.72, 0.42], 0.035),
            box("right_return_cheek", "ceramic_white", [1.54, -0.03, 0.72], [0.1, 0.72, 0.42], 0.035),
            box("rear_service_shelf_shadow", "smoked_titanium", [0, -0.42, 0.88], [2.3, 0.055, 0.12], 0.018),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_waiting_sofa_row",
        [
            box("center_cushion_split", "smoked_titanium", [0, 0.42, 0.49], [0.03, 0.05, 0.05], 0.002),
            box("left_back_cushion_shadow", "dark_acoustic_mesh", [-0.62, -0.255, 0.76], [1.02, 0.035, 0.18], 0.015),
            box("right_back_cushion_shadow", "dark_acoustic_mesh", [0.62, -0.255, 0.76], [1.02, 0.035, 0.18], 0.015),
            cyl("leg_3", "smoked_titanium", [-1.05, -0.22, 0.18], 0.035, 0.36, [0, 0, 0], 16),
            cyl("leg_4", "smoked_titanium", [1.05, -0.22, 0.18], 0.035, 0.36, [0, 0, 0], 16),
            cyl("rear_bar", "smoked_titanium", [0, -0.31, 0.3], 0.028, 2.22, [0, math.pi / 2, 0], 18),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_lime_ottoman",
        [
            box("stitched_top_cross_x", "soft_gray_cushion", [0, 0, 0.595], [0.72, 0.025, 0.018], 0.003),
            box("stitched_top_cross_y", "soft_gray_cushion", [0, 0, 0.598], [0.025, 0.72, 0.018], 0.003),
            cyl("caster_3", "smoked_titanium", [-0.27, -0.27, 0.05], 0.04, 0.05, [math.pi / 2, 0, 0], 16),
            cyl("caster_4", "smoked_titanium", [0.27, -0.27, 0.05], 0.04, 0.05, [math.pi / 2, 0, 0], 16),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_side_table_planter",
        [
            box("wood_inset_surface", "warm_wood", [0, 0, 0.675], [0.62, 0.48, 0.018], 0.035),
            box("black_shadow_under_top", "black_glass_screen", [0, 0, 0.57], [0.66, 0.52, 0.035], 0.025),
            sphere("leaf_cluster_c", "plant_green", [0, 0.05, 0.94], 0.095, [0.75, 1.2, 0.5]),
            box("planter_inner_shadow", "dark_acoustic_mesh", [0, 0, 0.85], [0.3, 0.2, 0.035], 0.018),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_triage_kiosk",
        [
            box("blank_black_screen_core", "black_glass_screen", [0, 0.266, 1.13], [0.4, 0.018, 0.22], 0.018, [math.radians(-10), 0, 0]),
            box("screen_lower_cyan_rule", "cyan_emissive", [0, 0.288, 0.96], [0.36, 0.016, 0.018], 0.002, [math.radians(-10), 0, 0]),
            box("base_rubber_foot", "rubber_black", [0, 0, 0.04], [0.66, 0.54, 0.06], 0.025),
            cyl("front_scan_lens", "surgical_lens", [0, 0.25, 0.68], 0.055, 0.024, [math.pi / 2, 0, 0], 24),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_med_cabinet",
        [
            box("left_vertical_handle", "smoked_titanium", [-0.06, 0.298, 1.07], [0.026, 0.024, 0.72], 0.008),
            box("right_vertical_handle", "smoked_titanium", [0.06, 0.298, 1.07], [0.026, 0.024, 0.72], 0.008),
            box("glass_inner_shelf_1", "frosted_glass", [0, 0.288, 0.82], [0.82, 0.018, 0.035], 0.004),
            box("glass_inner_shelf_2", "frosted_glass", [0, 0.288, 1.22], [0.82, 0.018, 0.035], 0.004),
            box("top_black_vent", "dark_acoustic_mesh", [0, 0.276, 1.76], [0.76, 0.024, 0.12], 0.008),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_record_wall_cabinet",
        [
            box("left_side_shadow_gap", "dark_acoustic_mesh", [-0.62, 0.268, 0.75], [0.035, 0.026, 0.9], 0.004),
            box("right_side_shadow_gap", "dark_acoustic_mesh", [0.62, 0.268, 0.75], [0.035, 0.026, 0.9], 0.004),
            *[
                box(f"drawer_pull_{r}_{c}", "smoked_titanium", [-0.36 + c * 0.36, 0.286, 0.42 + r * 0.24], [0.12, 0.014, 0.018], 0.003)
                for r in range(4)
                for c in range(3)
            ],
        ],
    )
    append_parts(
        "hp_l4_cineclinic_exam_table",
        [
            box("cushion_center_stitch", "dark_acoustic_mesh", [-0.18, 0.38, 0.975], [1.58, 0.025, 0.018], 0.003, [math.radians(-8), 0, 0]),
            box("head_pad_lower_stitch", "dark_acoustic_mesh", [-0.78, 0.285, 1.105], [0.52, 0.022, 0.016], 0.003, [math.radians(-18), 0, 0]),
            box("drawer_handle_1", "smoked_titanium", [0.62, 0.466, 0.58], [0.36, 0.018, 0.022], 0.004),
            box("drawer_handle_2", "smoked_titanium", [0.62, 0.466, 0.39], [0.36, 0.018, 0.022], 0.004),
            box("step_tread_inset", "dark_acoustic_mesh", [0.86, 0.89, 0.225], [0.5, 0.24, 0.025], 0.006),
            box("side_cyan_service_line", "cyan_emissive", [-0.84, 0.435, 0.52], [0.44, 0.018, 0.026], 0.003),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_memory_recliner",
        [
            box("seat_center_stitch", "dark_acoustic_mesh", [0, 0.58, 0.79], [0.62, 0.026, 0.018], 0.003, [math.radians(-5), 0, 0]),
            box("back_center_stitch", "dark_acoustic_mesh", [0, -0.19, 1.18], [0.58, 0.024, 0.018], 0.003, [math.radians(-43), 0, 0]),
            cyl("left_restraint_pivot", "smoked_titanium", [-0.66, 0.54, 0.82], 0.055, 0.038, [math.pi / 2, 0, 0], 24),
            cyl("right_restraint_pivot", "smoked_titanium", [0.66, 0.54, 0.82], 0.055, 0.038, [math.pi / 2, 0, 0], 24),
            cyl("head_inner_lens", "surgical_lens", [0, -0.875, 1.55], 0.13, 0.052, [math.pi / 2, 0, 0], 32),
            box("underseat_black_shell", "black_glass_screen", [0, 0.15, 0.52], [0.8, 0.72, 0.12], 0.04),
            box("left_cable_port", "red_fault", [-0.48, 0.61, 0.66], [0.04, 0.026, 0.04], 0.004),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_scan_arch",
        [
            box("left_arch_foot", "smoked_titanium", [-0.84, 0.02, 0.08], [0.42, 0.62, 0.08], 0.03),
            box("right_arch_foot", "smoked_titanium", [0.84, 0.02, 0.08], [0.42, 0.62, 0.08], 0.03),
            box("inner_scan_veil", "translucent_curtain", [0, 0.18, 1.06], [1.02, 0.026, 1.02], 0.016),
            box("top_black_sensor_strip", "black_glass_screen", [0, 0.29, 1.62], [0.92, 0.026, 0.12], 0.008),
            cyl("center_lens", "surgical_lens", [0, 0.31, 1.38], 0.07, 0.032, [math.pi / 2, 0, 0], 24),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_projection_pod",
        [
            box("front_black_glass_bezel", "black_glass_screen", [0, 0.032, 1.14], [0.52, 0.026, 0.25], 0.018, [math.radians(-8), 0, 0]),
            cyl("inner_lens_core", "surgical_lens", [0, 0.072, 1.14], 0.1, 0.078, [math.pi / 2, 0, 0], 32),
            box("rear_cable_socket", "rubber_black", [0, -0.475, 0.97], [0.24, 0.028, 0.1], 0.012),
            cyl("wheel_left", "rubber_black", [-0.28, 0.27, 0.08], 0.055, 0.044, [math.pi / 2, 0, 0], 16),
            cyl("wheel_right", "rubber_black", [0.28, 0.27, 0.08], 0.055, 0.044, [math.pi / 2, 0, 0], 16),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_rescue_speaker_panel",
        [
            box("inner_black_shadow_frame", "black_glass_screen", [0, 0.079, 0.36], [0.92, 0.018, 0.38], 0.006),
            box("left_screw_cap", "smoked_titanium", [-0.52, 0.094, 0.62], [0.055, 0.014, 0.055], 0.006),
            box("right_screw_cap", "smoked_titanium", [0.52, 0.094, 0.62], [0.055, 0.014, 0.055], 0.006),
            box("lower_red_tamper_led", "red_fault", [0.42, 0.097, 0.16], [0.042, 0.012, 0.03], 0.004),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_cable_trolley",
        [
            box("upper_tray_black_inset", "black_glass_screen", [0, 0.02, 0.965], [0.58, 0.38, 0.025], 0.012),
            cyl("spool_inner_hub", "smoked_titanium", [0, 0.19, 0.68], 0.11, 0.18, [math.pi / 2, 0, 0], 28),
            box("loose_cable_tail", "rubber_black", [-0.28, 0.34, 0.58], [0.34, 0.045, 0.04], 0.025, [0, 0, math.radians(-12)]),
            cyl("front_wheel_l", "rubber_black", [-0.27, 0.26, 0.075], 0.055, 0.048, [math.pi / 2, 0, 0], 16),
            cyl("front_wheel_r", "rubber_black", [0.27, 0.26, 0.075], 0.055, 0.048, [math.pi / 2, 0, 0], 16),
            box("lower_shelf_cyan_edge", "cyan_emissive", [0, 0.305, 0.4], [0.44, 0.018, 0.02], 0.003),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_observation_desk",
        [
            box("screen_cyan_lower_rule", "cyan_emissive", [0, 0.574, 0.93], [0.86, 0.018, 0.022], 0.003, [math.radians(-12), 0, 0]),
            box("screen_red_status_pin", "red_fault", [0.54, 0.579, 1.18], [0.045, 0.014, 0.045], 0.004, [math.radians(-12), 0, 0]),
            box("desk_keyboard_black_glass", "black_glass_screen", [0, 0.28, 0.995], [0.82, 0.28, 0.026], 0.018),
            box("under_desk_shadow_gap", "dark_acoustic_mesh", [0, 0.46, 0.56], [1.1, 0.026, 0.12], 0.006),
            cyl("left_floor_cable_port", "rubber_black", [-0.72, 0.28, 0.13], 0.045, 0.025, [math.pi / 2, 0, 0], 18),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_surgical_light",
        [
            cyl("joint_a_cap", "smoked_titanium", [-0.32, 0, 0.89], 0.07, 0.035, [0, math.pi / 2, 0], 20),
            cyl("joint_b_cap", "smoked_titanium", [0.28, 0, 0.74], 0.065, 0.035, [0, math.pi / 2, 0], 20),
            cyl("center_lens_glow", "cyan_emissive", [0, 0, 0.52], 0.08, 0.035, [math.pi / 2, 0, 0], 24),
            box("tiny_red_service_led", "red_fault", [0.18, 0.22, 0.61], [0.035, 0.018, 0.035], 0.004),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_monitor_arm",
        [
            cyl("floor_base_wide_plate", "smoked_titanium", [0, -0.22, 0.08], 0.22, 0.08, [0, 0, 0], 32),
            cyl("left_joint_disk", "smoked_titanium", [-0.72, -0.02, 1.22], 0.08, 0.035, [0, math.pi / 2, 0], 24),
            cyl("right_joint_disk", "smoked_titanium", [0.72, -0.02, 1.22], 0.08, 0.035, [0, math.pi / 2, 0], 24),
            box("screen_cyan_footer", "cyan_emissive", [0, 0.338, 1.1], [1.16, 0.018, 0.026], 0.003),
            box("screen_red_health_dot", "red_fault", [0.64, 0.34, 1.54], [0.045, 0.014, 0.045], 0.004),
            box("rear_cable_spine", "rubber_black", [0, 0.16, 0.92], [0.09, 0.05, 0.66], 0.018),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_privacy_screen",
        [
            box("bottom_rail", "smoked_titanium", [0, 0, 0.12], [1.74, 0.055, 0.055], 0.018),
            box("left_floor_foot", "rubber_black", [-0.86, 0.04, 0.055], [0.36, 0.32, 0.07], 0.025),
            box("right_floor_foot", "rubber_black", [0.86, 0.04, 0.055], [0.36, 0.32, 0.07], 0.025),
            box("curtain_overlap_shadow", "dark_acoustic_mesh", [0, 0.045, 0.98], [0.035, 0.018, 1.4], 0.003),
            box("top_cyan_privacy_thread", "cyan_emissive", [0, 0.04, 1.72], [1.24, 0.016, 0.022], 0.003),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_sedation_gate",
        [
            box("floor_black_threshold", "rubber_black", [0, 0.12, 0.06], [1.52, 0.52, 0.08], 0.025),
            box("left_floor_pad", "smoked_titanium", [-0.78, 0.02, 0.16], [0.46, 0.64, 0.08], 0.03),
            box("right_floor_pad", "smoked_titanium", [0.78, 0.02, 0.16], [0.46, 0.64, 0.08], 0.03),
            box("front_translucent_safety_veil", "translucent_curtain", [0, 0.2, 0.92], [1.04, 0.028, 0.74], 0.016),
            box("top_black_sensor_panel", "black_glass_screen", [0, 0.292, 1.74], [1.06, 0.024, 0.11], 0.008),
            cyl("left_red_lock_lens", "red_fault", [-0.42, 0.315, 1.58], 0.04, 0.024, [math.pi / 2, 0, 0], 18),
            cyl("right_red_lock_lens", "red_fault", [0.42, 0.315, 1.58], 0.04, 0.024, [math.pi / 2, 0, 0], 18),
        ],
    )
    append_parts(
        "hp_l4_cineclinic_theater_wall",
        [
            box("lower_black_plinth", "rubber_black", [0, 0.36, 0.22], [4.72, 0.12, 0.22], 0.025),
            box("left_dark_service_pillar", "dark_acoustic_mesh", [-2.32, 0.36, 1.18], [0.18, 0.12, 1.82], 0.018),
            box("right_dark_service_pillar", "dark_acoustic_mesh", [2.32, 0.36, 1.18], [0.18, 0.12, 1.82], 0.018),
            box("center_black_observation_window", "black_glass_screen", [0, 0.34, 1.22], [1.3, 0.035, 0.46], 0.018),
            box("center_lower_cyan_line", "cyan_emissive", [0, 0.376, 0.98], [1.46, 0.018, 0.026], 0.003),
            cyl("left_wall_lens", "surgical_lens", [-1.16, 0.38, 1.46], 0.08, 0.03, [math.pi / 2, 0, 0], 24),
            cyl("right_wall_lens", "surgical_lens", [1.16, 0.38, 1.46], 0.08, 0.03, [math.pi / 2, 0, 0], 24),
            box("therapy_bay_floor_shadow", "dark_acoustic_mesh", [0, 0.37, 0.49], [1.74, 0.04, 0.1], 0.006),
        ],
    )


apply_v2_visual_polish()


def write_material_sources() -> dict[str, dict]:
    material_manifest = {}
    master = Image.open(MASTER_IMAGE2_ATLAS).convert("RGBA") if MASTER_IMAGE2_ATLAS.exists() else None
    for key, spec in MATERIAL_TILES.items():
        out = SRC_DIR / spec["file"]
        if master is not None and key in MASTER_IMAGE2_CELLS:
            col, row = MASTER_IMAGE2_CELLS[key]
            cell_w = master.width // 4
            cell_h = master.height // 4
            crop = master.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
            crop.resize((512, 512), Image.Resampling.LANCZOS).save(out)
            material_manifest[key] = {
                "sourcePath": str(out.relative_to(REPO)),
                "prompt": material_prompt_for(key),
                "classification": "openai-generated-output-user-owned-subject-to-openai-terms",
                "sourceMaster": str(MASTER_IMAGE2_ATLAS.relative_to(REPO)),
                "sourceMasterOriginal": BUILTIN_IMAGEGEN_SOURCE_PATH,
                "sourceTool": "built-in image_gen",
                "sourceCell": {"col": col, "row": row, "grid": [4, 4]},
            }
            continue
        spec["image"].save(out)
        material_manifest[key] = {
            "sourcePath": str(out.relative_to(REPO)),
            "prompt": material_prompt_for(key),
            "classification": "self-authored-procedural-bitmap-with-preserved-image-prompt",
        }
    return material_manifest


def material_prompt_for(key: str) -> str:
    prompts = {
        "ceramic_white": "Seamless sci-fi hospital white ceramic enamel material tile, subtle molded panel seams, premium clean room finish, no text, no logo.",
        "smoked_titanium": "Seamless smoked titanium medical equipment material tile, dark graphite metal, subtle brushed grain, premium sci-fi hospital, no text.",
        "frosted_glass": "Frosted medical glass material tile, pale blue translucent reflections, soft diagonal glare, clean futuristic clinic, no text.",
        "cyan_screen": "Dark cyan runtime screen glass material tile, abstract scanlines and grid glow, no readable text, no numbers, no symbols.",
        "black_glass_screen": "Blank dark black glass screen material tile, glossy beveled medical display, no text, no numbers, no symbols.",
        "blue_cushion": "Premium medical blue upholstery material tile, soft stitched texture, high-end exam chair cushion, no text, no logo.",
        "lime_cushion": "Restrained lime green hospital waiting-room upholstery material tile, premium soft fabric, modern clinic accent, no text.",
        "soft_gray_cushion": "Soft warm gray clinic upholstery material tile, premium waiting-room sofa fabric, subtle weave, no text.",
        "warm_wood": "Pale clinic wood veneer material tile, high-end hospital side table surface, subtle grain, no brand, no text.",
        "rubber_black": "Matte black rubber cable material tile, subtle scuffed surface, medical equipment cable, no text.",
        "dark_acoustic_mesh": "Dark acoustic speaker mesh material tile, tiny black perforations, premium sci-fi clinic grille, no text.",
        "translucent_curtain": "Semi-transparent white medical privacy curtain material tile, frosted fabric, premium sci-fi hospital, no text.",
        "surgical_lens": "Surgical lamp lens material tile, frosted optical glass, cyan-white glow, no text, no logo.",
        "red_fault": "Tiny red fault light material tile, abstract emergency glow, no readable markings, no text.",
        "cyan_emissive": "Cyan medical status light strip material tile, abstract glow, no text, no numbers.",
        "plant_green": "Sterile small clinic planter leaf material tile, subtle green leaves, no text, no logo.",
    }
    return prompts[key]


def pack_atlas() -> dict:
    tiles = []
    for key, spec in MATERIAL_TILES.items():
        img = Image.open(SRC_DIR / spec["file"]).convert("RGBA").resize((256, 256), Image.Resampling.LANCZOS)
        tiles.append((key, img))
    atlas_size = 1024
    atlas = Image.new("RGBA", (atlas_size, atlas_size), (0, 0, 0, 0))
    regions = {}
    for index, (key, img) in enumerate(tiles):
        col = index % 4
        row = index // 4
        x = col * 256
        y = row * 256
        atlas.alpha_composite(img, (x, y))
        regions[key] = {"x": x, "y": y, "w": 256, "h": 256}
    atlas.save(ATLAS_PNG)
    ATLAS_REGIONS.write_text(json.dumps({"image": str(ATLAS_PNG.relative_to(REPO)), "size": [atlas_size, atlas_size], "regions": regions}, indent=2) + "\n", encoding="utf8")
    return regions


def write_contact_sheet() -> Path:
    card_w, card_h = 400, 220
    cols = 4
    rows = math.ceil(len(ASSETS) / cols)
    sheet = Image.new("RGB", (card_w * cols, card_h * rows), (12, 17, 19))
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(ASSETS):
        x = (index % cols) * card_w
        y = (index // cols) * card_h
        draw.rounded_rectangle([x + 12, y + 12, x + card_w - 12, y + card_h - 12], radius=12, fill=(22, 32, 36), outline=(74, 198, 220), width=1)
        draw.text((x + 24, y + 24), item["modelKey"], fill=(188, 245, 255))
        draw.text((x + 24, y + 52), item["label"], fill=(240, 248, 248))
        draw.text((x + 24, y + 82), f"{item['_priority']}  {item['family']}  {item['footprintFamily']}", fill=(146, 170, 174))
        w, h, d = item["sizeMeters"]
        sx = min(290, max(60, w * 72))
        sy = min(88, max(28, d * 72))
        cx = x + card_w // 2
        cy = y + 155
        draw.rounded_rectangle([cx - sx / 2, cy - sy / 2, cx + sx / 2, cy + sy / 2], radius=8, fill=(42, 64, 70), outline=(115, 230, 245), width=2)
        draw.text((x + 24, y + 184), f"{w:.2f}m x {h:.2f}m x {d:.2f}m", fill=(180, 200, 205))
    out = TMP_DIR / "level04-memory-clinic-furniture-v1-contact-sheet.png"
    sheet.save(out)
    return out


def score_assets() -> dict:
    rows = []
    for item in ASSETS:
        w, h, d = item["sizeMeters"]
        footprint_area = w * d
        if "ottoman" in item["modelKey"]:
            expected_height = 0.42
        elif item["footprintFamily"] in ("sofa", "table", "crate", "lamp"):
            expected_height = 0.72
        elif item["footprintFamily"] == "wall_panel":
            expected_height = 0.68
        elif item["footprintFamily"] == "cabinet":
            expected_height = 1.2
        else:
            expected_height = 1.45
        height_score = min(1.0, h / expected_height)
        nav_penalty = max(0.0, footprint_area - 2.6) * 0.08
        mobile_score = 0.74 + min(0.18, max(w, h, d) * 0.04)
        emissive_score = 0.94 if any(part["material"] in ("cyan_emissive", "cyan_screen", "red_fault") for part in item["_parts"]) else 0.82
        silhouette_score = 0.78 + min(0.16, len(item["_parts"]) * 0.006)
        score = round(max(0.0, min(1.0, (height_score + mobile_score + emissive_score + silhouette_score) / 4 - nav_penalty)), 3)
        rows.append(
            {
                "modelKey": item["modelKey"],
                "score": score,
                "sizeMeters": item["sizeMeters"],
                "footprintArea": round(footprint_area, 3),
                "partCount": len(item["_parts"]),
                "penalties": {
                    "navigation": round(nav_penalty, 3),
                    "oversized": footprint_area > 3.2,
                },
                "recommendation": "apply" if score >= 0.72 else "review-before-build",
            }
        )
    return {
        "schemaVersion": "hp.asset-math-report.v1",
        "packId": PACK_ID,
        "generatedBy": Path(__file__).name,
        "objective": "L4 memory clinic furniture readability, collision and mobile footprint sanity",
        "assets": rows,
    }


def write_ledgers(material_manifest: dict, contact_sheet: Path):
    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    prompt_rows = [
        {
            "id": f"{item['modelKey']}_concept_prompt",
            "modelKey": item["modelKey"],
            "prompt": item["_prompt"],
            "negativePrompt": "No brand logos, no readable text, no room numbers, no puzzle answers, no gore, no messy horror blood, no people.",
            "referenceInputs": [
                {
                    "path": "/var/folders/x0/10s92gy158bcp4qt1p9yvjhr0000gn/T/codex-clipboard-cbc9cbd3-cd9c-4011-bf2e-10bd75a82a98.png",
                    "role": "broad aesthetic reference only",
                    "redistributed": False,
                },
                {
                    "path": "/Users/zhengkaizhang/Desktop/Screenshot 2026-06-23 at 8.18.32\u202fAM.png",
                    "role": "medical chair/table proportion reference only",
                    "redistributed": False,
                },
            ],
        }
        for item in ASSETS
    ]
    prompt_rows.extend(
        {
            "id": f"{mat_key}_material_prompt",
            "materialKey": mat_key,
            "prompt": material_prompt_for(mat_key),
            "negativePrompt": "No logo, no readable text, no numbers, no brand identity.",
        }
        for mat_key in MATERIAL_TILES
    )
    if MASTER_IMAGE2_ATLAS.exists():
        prompt_rows.append(
            {
                "id": "level04_memory_clinic_furniture_v2_imagegen_master_atlas_prompt",
                "materialKey": "level04_memory_clinic_furniture_v2_imagegen_master_atlas",
                "prompt": MASTER_IMAGE2_ATLAS_PROMPT,
                "negativePrompt": "No text, no numbers, no logos, no labels, no people, no perspective scene, no puzzle symbols.",
            }
        )
    ledger = {
        "schemaVersion": "hp.image2-prompt-ledger.v1",
        "packId": PACK_ID,
        "generatedAt": now,
        "sourceTool": Path(__file__).name,
        "generationMode": "built-in-imagegen-master-material-atlas-cropped-to-texture-slots-plus-blender-geometry",
        "notes": [
            "The v2 material pass uses a built-in image_gen 4x4 master atlas cropped into named material texture slots.",
            "Prompts are preserved for future Image2 redraws or art direction review.",
            "This run does not redistribute the user-provided reference screenshots; paths are recorded only as local art-direction references.",
            "No puzzle answers, localized text, room numbers, or readable UI content are baked into texture or geometry.",
        ],
        "prompts": prompt_rows,
    }
    PROMPT_LEDGER_JSON.write_text(json.dumps(ledger, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    md_lines = [
        "# Level 04 Memory Clinic Furniture v1 Prompt Ledger",
        "",
        f"- packId: `{PACK_ID}`",
        f"- generatedAt: `{now}`",
        "- classification: `openai-generated-output-user-owned-subject-to-openai-terms` for the v2 master material atlas",
        "- reference screenshots: local art-direction only, not redistributed",
        "",
        "## Asset Prompts",
        "",
    ]
    for row in prompt_rows:
        key = row.get("modelKey") or row.get("materialKey")
        md_lines += [f"### {key}", "", row["prompt"], "", f"Negative: {row['negativePrompt']}", ""]
    PROMPT_LEDGER_MD.write_text("\n".join(md_lines).rstrip() + "\n", encoding="utf8")

    provenance = {
        "schemaVersion": "hp.asset-source-provenance.v1",
        "packId": PACK_ID,
        "generatedAt": now,
        "sourceTool": Path(__file__).name,
        "licenseClassification": "openai-generated-output-user-owned-subject-to-openai-terms",
        "masterImage2Atlas": {
            "projectPath": str(MASTER_IMAGE2_ATLAS.relative_to(REPO)) if MASTER_IMAGE2_ATLAS.exists() else None,
            "originalGeneratedPath": BUILTIN_IMAGEGEN_SOURCE_PATH,
            "sourceTool": "built-in image_gen",
            "promptId": "level04_memory_clinic_furniture_v2_imagegen_master_atlas_prompt",
            "grid": [4, 4],
        },
        "sourceImages": material_manifest,
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
        },
        "derivativeOutputs": {
            "builderManifest": str(MANIFEST.relative_to(REPO)),
            "runtimeManifest": str(RUNTIME_MANIFEST.relative_to(REPO)),
            "glbDirectory": str(GLB_DIR.relative_to(REPO)),
            "sourceBlendDirectory": str(SOURCE_BLEND_DIR.relative_to(REPO)),
            "contactSheet": str(contact_sheet.relative_to(REPO)),
        },
    }
    PROVENANCE_JSON.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    PROVENANCE_MD.write_text(
        "\n".join(
            [
                "# Level 04 Memory Clinic Furniture v1 Provenance",
                "",
                f"- packId: `{PACK_ID}`",
                f"- sourceTool: `{Path(__file__).name}`",
                "- classification: `openai-generated-output-user-owned-subject-to-openai-terms` for v2 material atlas crops",
                f"- master material atlas: `{MASTER_IMAGE2_ATLAS.relative_to(REPO)}`",
                "- reference screenshots are not redistributed; only broad style direction was used.",
                f"- prompt ledger: `{PROMPT_LEDGER_JSON.relative_to(REPO)}`",
                f"- atlas: `{ATLAS_PNG.relative_to(REPO)}`",
                f"- source tiles: `{SRC_DIR.relative_to(REPO)}`",
                f"- GLBs: `{GLB_DIR.relative_to(REPO)}`",
                "",
            ]
        ),
        encoding="utf8",
    )


def write_manifests():
    clean_assets = []
    runtime_assets = []
    for item in ASSETS:
        public_entry = {k: v for k, v in item.items() if not k.startswith("_")}
        public_entry["textureSources"] = [
            str(ATLAS_PNG.relative_to(REPO)),
            str(ATLAS_REGIONS.relative_to(REPO)),
            str(SRC_DIR.relative_to(REPO)),
        ]
        public_entry["materialSlots"] = sorted({part["material"] for part in item["_parts"]})
        clean_assets.append(public_entry)
        runtime_assets.append(
            {
                "assetFamily": "level04_memory_clinic_furniture_v1",
                "modelKey": item["modelKey"],
                "assetClass": "furniture",
                "readiness": "build-ready",
                "role": item["_role"],
                "scaleMeters": item["sizeMeters"],
                "silhouette": silhouette_for(item),
                "materialSlots": sorted({part["material"] for part in item["_parts"]}),
                "textureSources": [str(ATLAS_PNG.relative_to(REPO)), str(SRC_DIR.relative_to(REPO))],
                "states": states_for(item),
                "collisionProxy": collision_for(item),
                "runtimeContent": "No baked puzzle answers, localized text, digits, room numbers, or UI copy. Screens/lights are runtime/config driven.",
                "lodPolicy": {
                    "mobile": "single GLB, simple primitive silhouette, bevels only on visible edges",
                    "triangleBudget": triangle_budget_for(item),
                },
                "pathPlan": {
                    "glb": f"src/assets/models-cooked/environment/level04-memory-clinic-furniture-v1/{item['modelKey']}.glb",
                    "sourceBlend": f"src/assets/source_blend/level04-memory-clinic-furniture-v1/{item['modelKey']}.blend",
                },
                "integration": {
                    "builderPack": str(MANIFEST.relative_to(REPO)),
                    "group": "诊疗",
                    "footprintFamily": item["footprintFamily"],
                    "roomHints": item["_roomHints"],
                    "priority": item["_priority"],
                },
                "qaEvidence": {
                    "promptLedger": str(PROMPT_LEDGER_JSON.relative_to(REPO)),
                    "provenance": str(PROVENANCE_JSON.relative_to(REPO)),
                    "mathReport": str(MATH_REPORT.relative_to(REPO)),
                    "blenderReport": str(BLENDER_REPORT.relative_to(REPO)),
                },
            }
        )
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": PACK_ID,
        "label": "Level 04 Memory Clinic Furniture v1",
        "sourceTool": Path(__file__).name,
        "generatedAt": "2026-06-23",
        "atlas": {
            "image": str(ATLAS_PNG.relative_to(REPO)),
            "regions": str(ATLAS_REGIONS.relative_to(REPO)),
            "size": [1024, 1024],
        },
        "assets": clean_assets,
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    runtime_manifest = {
        "schemaVersion": "hp.level04-memory-clinic-furniture.v1",
        "packId": PACK_ID,
        "sourceTool": Path(__file__).name,
        "sourceType": "fresh-rebuild-abandoning-old-l4-furniture",
        "assets": runtime_assets,
    }
    RUNTIME_MANIFEST.write_text(json.dumps(runtime_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


def silhouette_for(item: dict) -> list[str]:
    key = item["modelKey"]
    if "chair" in key or "recliner" in key:
        return ["reclined medical chair", "head ring", "arm restraints", "lift base"]
    if "gate" in key:
        return ["two vertical towers", "crossbar", "low glass barrier"]
    if "wall" in key or item["mount"] == "wall":
        return ["flat wall module", "framed panel", "thin depth"]
    if "sofa" in key or "ottoman" in key:
        return ["soft rounded seating blocks", "thin metal legs", "low human scale"]
    if "light" in key:
        return ["ceiling armature", "round lens cluster", "thin medical arms"]
    return ["white ceramic shell", "dark titanium base", "cyan status detail"]


def states_for(item: dict) -> list[str]:
    materials = {part["material"] for part in item["_parts"]}
    states = ["idle"]
    if "cyan_emissive" in materials or "cyan_screen" in materials:
        states += ["powered", "active"]
    if "red_fault" in materials:
        states += ["fault", "locked"]
    if item["clueCapacity"] > 0:
        states += ["clue_available", "solved"]
    return states


def collision_for(item: dict) -> dict:
    w, h, d = item["sizeMeters"]
    if not item["solid"]:
        return {"type": "none-or-thin-trigger", "reason": "decorative/transparent/wall/ceiling furniture"}
    return {
        "type": "box",
        "halfSize": [round(w * 0.48, 3), round(h * 0.45, 3), round(d * 0.48, 3)],
        "blocks": "furniture footprint only; keep doors and critical route clear",
    }


def triangle_budget_for(item: dict) -> int:
    base = 900 + len(item["_parts"]) * 240
    if item["_priority"] == "P0":
        base += 1200
    if item["mount"] in ("wall", "ceiling"):
        base -= 400
    return max(900, base)


BLENDER_SCRIPT = r'''
import json
import math
import sys
from pathlib import Path

import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
SPEC_PATH = Path(argv[0])
GLB_DIR = Path(argv[1])
SOURCE_BLEND_DIR = Path(argv[2])

spec = json.loads(SPEC_PATH.read_text(encoding="utf8"))
materials_spec = spec["materials"]
assets = spec["assets"]

def reset_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

def bsdf_input(bsdf, name):
    socket = bsdf.inputs.get(name)
    if socket is None:
        raise KeyError(f"Missing Principled BSDF input {name}")
    return socket

def make_material(name, info):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = tuple(info.get("color", [0.8, 0.8, 0.8, 1]))
    mat["hp_palette_role"] = name
    mat["hp_roughness"] = round(float(info.get("roughness", 0.6)), 3)
    mat["hp_metallic"] = round(float(info.get("metallic", 0.0)), 3)
    alpha = float(info.get("alpha", info.get("color", [1, 1, 1, 1])[3] if len(info.get("color", [])) > 3 else 1.0))
    mat["hp_alpha"] = round(alpha, 3)
    if alpha < 0.99:
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
        mat.show_transparent_back = True
    nodes = mat.node_tree.nodes
    bsdf = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf_input(bsdf, "Base Color").default_value = tuple(info.get("color", [0.8, 0.8, 0.8, alpha]))
        bsdf_input(bsdf, "Alpha").default_value = alpha
        bsdf_input(bsdf, "Metallic").default_value = float(info.get("metallic", 0.0))
        bsdf_input(bsdf, "Roughness").default_value = float(info.get("roughness", 0.6))
        if "Emission Color" in bsdf.inputs and "emission" in info:
            color = info["emission"]
            bsdf.inputs["Emission Color"].default_value = (color[0], color[1], color[2], 1)
        if "Emission Strength" in bsdf.inputs and "emissionStrength" in info:
            bsdf.inputs["Emission Strength"].default_value = float(info["emissionStrength"])
        tex_path = info.get("texturePath")
        if tex_path:
            image = bpy.data.images.load(tex_path, check_existing=True)
            tex = nodes.new(type="ShaderNodeTexImage")
            tex.name = "hp_image2_" + name
            tex.image = image
            tex.extension = "REPEAT"
            tex.interpolation = "Smart"
            mat.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Base Color"))
            if "emission" in info and "Emission Color" in bsdf.inputs:
                mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            mat["hp_texture_source"] = tex_path
    return mat

MATS = {name: make_material(name, info) for name, info in materials_spec.items()}

def unwrap_object(obj):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=0.018)
        bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass
    obj.select_set(False)

def shade_and_modifiers(obj, bevel=0.02):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    try:
        bpy.ops.object.shade_smooth()
    except Exception:
        pass
    if bevel and bevel > 0:
        mod = obj.modifiers.new("hp_visible_edge_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3 if bevel >= 0.04 else 2
        mod.affect = "EDGES"
        obj.modifiers.new("hp_weighted_normals", "WEIGHTED_NORMAL")
    obj.select_set(False)

def assign(obj, part):
    obj.name = part["name"]
    obj.data.name = part["name"] + "_mesh"
    mat = MATS[part["material"]]
    obj.data.materials.append(mat)
    obj.location = part.get("loc", [0, 0, 0])
    obj.rotation_euler = part.get("rot", [0, 0, 0])

def add_box(part):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    assign(obj, part)
    obj.dimensions = part["dims"]
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    unwrap_object(obj)
    shade_and_modifiers(obj, float(part.get("bevel", 0.02)))
    return obj

def add_cylinder(part):
    bpy.ops.mesh.primitive_cylinder_add(vertices=int(part.get("vertices", 24)), radius=float(part["radius"]), depth=float(part["depth"]))
    obj = bpy.context.object
    assign(obj, part)
    unwrap_object(obj)
    shade_and_modifiers(obj, float(part.get("bevel", 0.02)))
    return obj

def add_sphere(part):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=float(part["radius"]))
    obj = bpy.context.object
    assign(obj, part)
    obj.scale = part.get("scale", [1, 1, 1])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    unwrap_object(obj)
    shade_and_modifiers(obj, float(part.get("bevel", 0.02)))
    return obj

def add_part(part):
    if part["kind"] == "box":
        return add_box(part)
    if part["kind"] == "cylinder":
        return add_cylinder(part)
    if part["kind"] == "sphere":
        return add_sphere(part)
    raise ValueError("unknown part kind " + part["kind"])

report = {"schemaVersion": "hp.blender-generation-report.v1", "assets": []}

for asset in assets:
    reset_scene()
    key = asset["modelKey"]
    root = bpy.data.objects.new(key, None)
    bpy.context.collection.objects.link(root)
    made = []
    for part in asset["parts"]:
        obj = add_part(part)
        obj.parent = root
        made.append(obj)
    bpy.ops.object.light_add(type="AREA", location=(0, -3.2, 4.5))
    light = bpy.context.object
    light.name = key + "_qa_area_light"
    light.data.energy = 280
    light.data.size = 5
    bpy.ops.object.camera_add(location=(2.8, -4.2, 2.3), rotation=(math.radians(64), 0, math.radians(36)))
    bpy.context.scene.camera = bpy.context.object
    for obj in made:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = made[0] if made else root
    glb_path = GLB_DIR / f"{key}.glb"
    blend_path = SOURCE_BLEND_DIR / f"{key}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_extras=True,
    )
    report["assets"].append({
        "modelKey": key,
        "glb": str(glb_path),
        "sourceBlend": str(blend_path),
        "partCount": len(made),
        "materials": sorted({part["material"] for part in asset["parts"]}),
    })

(SPEC_PATH.parent / "level04_memory_clinic_furniture_v1_blender_report.json").write_text(json.dumps(report, indent=2), encoding="utf8")
'''


def run_blender():
    if not BLENDER.exists():
        raise SystemExit(f"Blender not found at {BLENDER}")
    spec_path = TMP_DIR / "level04_memory_clinic_furniture_v1_blender_spec.json"
    blender_script_path = TMP_DIR / "build_level04_memory_clinic_furniture_v1.py"
    materials = {}
    for key, info in MATERIAL_TILES.items():
        clean = {k: v for k, v in info.items() if k not in ("image",)}
        clean["texturePath"] = str((SRC_DIR / info["file"]).resolve())
        materials[key] = clean
    spec = {
        "materials": materials,
        "assets": [
            {
                "modelKey": item["modelKey"],
                "parts": item["_parts"],
            }
            for item in ASSETS
        ],
    }
    spec_path.write_text(json.dumps(spec, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    blender_script_path.write_text(BLENDER_SCRIPT, encoding="utf8")
    subprocess.run(
        [
            str(BLENDER),
            "--background",
            "--python",
            str(blender_script_path),
            "--",
            str(spec_path),
            str(GLB_DIR),
            str(SOURCE_BLEND_DIR),
        ],
        cwd=REPO,
        check=True,
    )
    tmp_report = TMP_DIR / "level04_memory_clinic_furniture_v1_blender_report.json"
    if tmp_report.exists():
        BLENDER_REPORT.write_text(tmp_report.read_text(encoding="utf8"), encoding="utf8")


def main():
    material_manifest = write_material_sources()
    pack_atlas()
    contact = write_contact_sheet()
    MATH_REPORT.write_text(json.dumps(score_assets(), ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    write_ledgers(material_manifest, contact)
    run_blender()
    write_manifests()
    print(f"Generated {len(ASSETS)} Level 04 Memory Clinic furniture assets")
    print(f"  builder manifest: {MANIFEST.relative_to(REPO)}")
    print(f"  prompt ledger: {PROMPT_LEDGER_JSON.relative_to(REPO)}")
    print(f"  GLBs: {GLB_DIR.relative_to(REPO)}")


if __name__ == "__main__":
    main()
