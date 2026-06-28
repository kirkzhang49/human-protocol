"""Small deterministic PBR map derivation helpers for Image2 atlases.

These maps are not a replacement for hand-authored production materials. They
give Image2-derived furniture a first non-flat material layer: subtle normals,
roughness variation, and occlusion modulation from the atlas luminance/edges.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def derive_pbr_maps(
    atlas: Image.Image,
    normal_path: Path,
    metallic_roughness_path: Path,
    occlusion_path: Path,
    normal_strength: float = 1.8,
) -> dict[str, Image.Image]:
    base = atlas.convert("RGBA")
    rgb = np.asarray(base.convert("RGB"), dtype=np.float32)
    alpha = np.asarray(base.getchannel("A"), dtype=np.float32) / 255.0

    luminance = (rgb[:, :, 0] * 0.2126 + rgb[:, :, 1] * 0.7152 + rgb[:, :, 2] * 0.0722) / 255.0
    height = np.asarray(Image.fromarray(np.uint8(luminance * 255)).filter(ImageFilter.GaussianBlur(0.75)), dtype=np.float32) / 255.0
    gy, gx = np.gradient(height)
    nx = -gx * normal_strength
    ny = -gy * normal_strength
    nz = np.ones_like(height)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    normal = np.dstack(((nx / norm) * 0.5 + 0.5, (ny / norm) * 0.5 + 0.5, (nz / norm) * 0.5 + 0.5))
    normal_img = Image.fromarray(np.uint8(np.clip(normal * 255, 0, 255)), "RGB")

    local_shadow = np.asarray(Image.fromarray(np.uint8((1.0 - height) * 255)).filter(ImageFilter.GaussianBlur(2.4)), dtype=np.float32) / 255.0
    edge = np.clip(np.sqrt(gx * gx + gy * gy) * 9.0, 0.0, 1.0)
    occlusion = np.clip(1.0 - local_shadow * 0.18 - edge * 0.12, 0.50, 1.0)
    occlusion = occlusion * (0.82 + alpha * 0.18)
    occlusion_rgb = np.repeat(np.uint8(np.clip(occlusion * 255, 0, 255))[:, :, None], 3, axis=2)
    occlusion_img = Image.fromarray(occlusion_rgb, "RGB")

    saturation = (rgb.max(axis=2) - rgb.min(axis=2)) / 255.0
    warm = np.clip((rgb[:, :, 0] - rgb[:, :, 2]) / 255.0, 0.0, 1.0)
    dark = 1.0 - luminance
    metallic = np.clip(warm * 0.55 + dark * 0.20, 0.0, 0.82) * alpha
    roughness = np.clip(0.82 - saturation * 0.22 + dark * 0.10 - edge * 0.08, 0.22, 0.96)
    mr = np.zeros((*height.shape, 3), dtype=np.uint8)
    mr[:, :, 1] = np.uint8(np.clip(roughness * 255, 0, 255))
    mr[:, :, 2] = np.uint8(np.clip(metallic * 255, 0, 255))
    metallic_roughness_img = Image.fromarray(mr, "RGB")

    normal_path.parent.mkdir(parents=True, exist_ok=True)
    normal_img.save(normal_path)
    metallic_roughness_img.save(metallic_roughness_path)
    occlusion_img.save(occlusion_path)
    return {
        "normal": normal_img,
        "metallicRoughness": metallic_roughness_img,
        "occlusion": occlusion_img,
    }
