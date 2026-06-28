#!/usr/bin/env python3
"""Generate compact baked GLBs for builder puzzle consoles.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/asset-build/generate-builder-puzzle-machine-glbs.py
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "src/assets/models-cooked/environment/builder-puzzle-machines"
SOURCE_BLEND_DIR = ROOT / "src/assets/source_blend/builder-puzzle-machines"
TEX_DIR = ROOT / "src/assets/textures/environment/builder-puzzle-machines"
PARTS_ATLAS = TEX_DIR / "hp_builder_machine_parts_atlas_v2.png"
PARTS_REGIONS_JSON = TEX_DIR / "hp_builder_machine_parts_atlas_v2.regions.json"
SURFACE_ATLAS = TEX_DIR / "hp_builder_machine_surface_atlas_image2.png"
SURFACE_REGIONS_JSON = TEX_DIR / "hp_builder_machine_surface_atlas_image2.regions.json"
ROUTE_SWITCH_ATLAS = TEX_DIR / "hp_route_switch_console_image2_atlas_v1.png"
ROUTE_SWITCH_REGIONS_JSON = TEX_DIR / "hp_route_switch_console_image2_atlas_v1.regions.json"
_PARTS_IMAGE = None
_PARTS_REGIONS: dict | None = None
_SURFACE_IMAGE = None
_SURFACE_REGIONS: dict | None = None
_ROUTE_SWITCH_IMAGE = None
_ROUTE_SWITCH_REGIONS: dict | None = None


def principled_bsdf(material):
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def make_mat(
    name: str,
    color: tuple[float, float, float, float],
    emission: tuple[float, float, float] | None = None,
    strength: float = 0.0,
    roughness: float = 0.58,
    metallic: float = 0.0,
):
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = principled_bsdf(material)
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        if emission and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = strength
    return material


def cube(name: str, loc: tuple[float, float, float], size: tuple[float, float, float], material, bevel: float = 0.025, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rot != (0.0, 0.0, 0.0):
        obj.rotation_euler = rot
    if material:
      obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new(f"{name}_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def cyl(name: str, loc: tuple[float, float, float], radius: float, depth: float, material, vertices: int = 32, rot=(0.0, 0.0, 0.0), bevel: float = 0.01):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new(f"{name}_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def torus(name: str, loc: tuple[float, float, float], major_radius: float, minor_radius: float, material, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=32,
        minor_segments=8,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    if material:
        obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def seven_segment_digit(
    prefix: str,
    digit: int,
    center: tuple[float, float, float],
    size: tuple[float, float],
    material,
    thickness: float = 0.018,
):
    """Front-facing seven-segment digit built from emissive bars."""
    patterns = {
        0: "abcfed",
        1: "bc",
        2: "abged",
        3: "abgcd",
        4: "fgbc",
        5: "afgcd",
        6: "afgecd",
        7: "abc",
        8: "abcdefg",
        9: "abfgcd",
    }
    x, y, z = center
    width, height = size
    h_len = width * 0.66
    v_len = height * 0.34
    h_size = (h_len, thickness, thickness)
    v_size = (thickness, thickness, v_len)
    dx = width * 0.34
    z_top = z + height * 0.36
    z_mid = z
    z_bottom = z - height * 0.36
    segments = {
        "a": ((x, y, z_top), h_size),
        "b": ((x + dx, y, z + height * 0.18), v_size),
        "c": ((x + dx, y, z - height * 0.18), v_size),
        "d": ((x, y, z_bottom), h_size),
        "e": ((x - dx, y, z - height * 0.18), v_size),
        "f": ((x - dx, y, z + height * 0.18), v_size),
        "g": ((x, y, z_mid), h_size),
    }
    for segment_id in patterns.get(digit, ""):
        loc, seg_size = segments[segment_id]
        cube(f"{prefix}_digit_{digit}_{segment_id}", loc, seg_size, material, 0.004)


def small_status_lights(prefix: str, x_values: tuple[float, ...], z: float, material):
    for index, x in enumerate(x_values):
        cyl(f"{prefix}_status_lens_{index}", (x, -0.235, z), 0.028, 0.018, material, 18, rot=(math.pi / 2, 0, 0), bevel=0.004)


# ---------------------------------------------------------------------------
# Shared parts atlas (v2): SMALL material decals only — screen glass, brushed
# brass, hazard stripes, micro ticks, socket rims, screws, copper bus, cable
# lanes. Geometry owns the silhouette; these regions only dress small flush
# faces of real recessed geometry. Never used as a full-front UI poster.
# ---------------------------------------------------------------------------


def parts_image():
    global _PARTS_IMAGE
    if _PARTS_IMAGE is None:
        _PARTS_IMAGE = bpy.data.images.load(str(PARTS_ATLAS), check_existing=True)
        _PARTS_IMAGE.name = "hp_builder_machine_parts_atlas_v2"
    return _PARTS_IMAGE


def parts_regions() -> dict:
    global _PARTS_REGIONS
    if _PARTS_REGIONS is None:
        _PARTS_REGIONS = json.loads(PARTS_REGIONS_JSON.read_text())
    return _PARTS_REGIONS


def uv_rect_from_region(region_id: str, padding_px: float = 1.0):
    """Return normalized (u0, v0, u1, v1) with Y flipped for Blender UVs."""
    data = parts_regions()
    atlas_w, atlas_h = data["atlasSize"]
    x, y, w, h = data["regions"][region_id]
    u0 = (x + padding_px) / atlas_w
    u1 = (x + w - padding_px) / atlas_w
    v_top = 1.0 - (y + padding_px) / atlas_h
    v_bottom = 1.0 - (y + h - padding_px) / atlas_h
    return (u0, v_bottom, u1, v_top)


def make_parts_mat(
    name: str,
    emission_strength: float = 0.0,
    roughness: float = 0.5,
    base_color: tuple[float, float, float, float] = (1.0, 1.0, 1.0, 1.0),
    emission_color: tuple[float, float, float] | None = None,
):
    """A material sampling the shared parts atlas (UVs select the region)."""
    material = bpy.data.materials.new(name)
    material.diffuse_color = base_color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = principled_bsdf(material)
    if bsdf:
        tex = nodes.new("ShaderNodeTexImage")
        tex.name = f"{name}_parts_atlas"
        tex.image = parts_image()
        tex.extension = "CLIP"
        tex.interpolation = "Linear"
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if emission_strength > 0 and "Emission Color" in bsdf.inputs:
            if emission_color:
                bsdf.inputs["Emission Color"].default_value = (*emission_color, 1.0)
            else:
                links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
    return material


def region_inlay(name: str, loc, size, region_id: str, material):
    """A small flush quad on a front-facing (-Y normal) surface, UV-cropped to a
    single atlas region. Placed proud (~1.5mm) over real recessed geometry so it
    reads as glass/trim on a physical bezel, not a floating sticker."""
    x, y, z = loc
    width, height = size
    u0, v0, u1, v1 = uv_rect_from_region(region_id)
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    verts = [
        (x - width / 2, y, z - height / 2),
        (x + width / 2, y, z - height / 2),
        (x + width / 2, y, z + height / 2),
        (x - width / 2, y, z + height / 2),
    ]
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop_index, uv in zip(mesh.polygons[0].loop_indices, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
        uv_layer.data[loop_index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


# ---------------------------------------------------------------------------
# Surface atlas (Image2): real 3D machine material art. Opaque tiles UV onto the
# LARGE body faces so big flush panels stop reading as plastic; transparent
# cutouts overlay flush onto real edges/corners (wear, grime, scratches, screws,
# gaskets, lens highlights, blank nameplates, hazard tape, micro ticks, scuff).
# Geometry still owns the silhouette — these are materials, never a front poster.
# ---------------------------------------------------------------------------


def surface_image():
    global _SURFACE_IMAGE
    if _SURFACE_IMAGE is None:
        _SURFACE_IMAGE = bpy.data.images.load(str(SURFACE_ATLAS), check_existing=True)
        _SURFACE_IMAGE.name = "hp_builder_machine_surface_atlas_image2"
    return _SURFACE_IMAGE


def surface_regions() -> dict:
    global _SURFACE_REGIONS
    if _SURFACE_REGIONS is None:
        _SURFACE_REGIONS = json.loads(SURFACE_REGIONS_JSON.read_text())
    return _SURFACE_REGIONS


def surface_uv_rect(region_id: str, padding_px: float = 2.0):
    """Return normalized (u0, v_bottom, u1, v_top) for an atlas region (Y flipped)."""
    data = surface_regions()
    atlas_w, atlas_h = data["atlasSize"]
    x, y, w, h = data["regions"][region_id]
    u0 = (x + padding_px) / atlas_w
    u1 = (x + w - padding_px) / atlas_w
    v_top = 1.0 - (y + padding_px) / atlas_h
    v_bottom = 1.0 - (y + h - padding_px) / atlas_h
    return (u0, v_bottom, u1, v_top)


def make_surface_mat(name: str, kind: str = "matte", emission_strength: float = 0.0):
    """Opaque material sampling the surface atlas; per-quad UVs pick the tile
    region. `kind` tunes the PBR feel: matte (powdercoat/medical plastic/recess/
    rubber), metal (brushed brass/copper bus), glass (cyan/amber smoked glass)."""
    roughness, metallic = {
        "matte": (0.62, 0.12),
        "metal": (0.38, 0.72),
        "glass": (0.2, 0.1),
    }[kind]
    material = bpy.data.materials.new(name)
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = principled_bsdf(material)
    if bsdf:
        tex = nodes.new("ShaderNodeTexImage")
        tex.name = f"{name}_surface_atlas"
        tex.image = surface_image()
        tex.extension = "CLIP"
        tex.interpolation = "Linear"
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission_strength > 0 and "Emission Color" in bsdf.inputs:
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def make_surface_cutout_mat(name: str, roughness: float = 0.45, emission_strength: float = 0.0):
    """Alpha-blended overlay material sampling the surface-atlas cutouts. Used for
    flush wear/grime/scratch/screw/gasket/highlight/nameplate/hazard/tick decals
    that sit ~1mm proud of real geometry without changing the silhouette."""
    material = bpy.data.materials.new(name)
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    material.use_nodes = True
    # Alpha CLIP (-> glTF alphaMode MASK) is more robust than BLEND for the Raw
    # WebGPU static-mesh path. NOTE: the v11 rebuild deliberately lets geometry +
    # opaque atlas tiles carry the design, so this helper is kept available but no
    # longer used by the five machines — no alpha decals sit on the runtime path.
    material.blend_method = "CLIP"
    material.alpha_threshold = 0.4
    material.show_transparent_back = False
    material.use_backface_culling = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = principled_bsdf(material)
    if bsdf:
        tex = nodes.new("ShaderNodeTexImage")
        tex.name = f"{name}_surface_cutout"
        tex.image = surface_image()
        tex.extension = "CLIP"
        tex.interpolation = "Linear"
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if "Alpha" in bsdf.inputs:
            links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if emission_strength > 0 and "Emission Color" in bsdf.inputs:
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def _surface_quad(name: str, verts, region_id: str, material):
    u0, v0, u1, v1 = surface_uv_rect(region_id)
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop_index, uv in zip(mesh.polygons[0].loop_indices, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
        uv_layer.data[loop_index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def surface_uv_panel(name: str, loc, size, region_id: str, material, face: str = "-Y"):
    """A flush quad UV-cropped to one surface-atlas region, sized to dress a LARGE
    body face. `face` selects the surface normal: '-Y' front (default) or '+Z' top
    deck. Place ~1mm proud of the real face so it never floats."""
    x, y, z = loc
    width, height = size
    if face == "-Y":
        verts = [
            (x - width / 2, y, z - height / 2),
            (x + width / 2, y, z - height / 2),
            (x + width / 2, y, z + height / 2),
            (x - width / 2, y, z + height / 2),
        ]
    elif face == "+Z":
        verts = [
            (x - width / 2, y - height / 2, z),
            (x + width / 2, y - height / 2, z),
            (x + width / 2, y + height / 2, z),
            (x - width / 2, y + height / 2, z),
        ]
    elif face == "+X":
        verts = [
            (x, y - width / 2, z - height / 2),
            (x, y + width / 2, z - height / 2),
            (x, y + width / 2, z + height / 2),
            (x, y - width / 2, z + height / 2),
        ]
    elif face == "-X":
        verts = [
            (x, y + width / 2, z - height / 2),
            (x, y - width / 2, z - height / 2),
            (x, y - width / 2, z + height / 2),
            (x, y + width / 2, z + height / 2),
        ]
    else:
        raise ValueError(f"unsupported face {face}")
    return _surface_quad(name, verts, region_id, material)


def surface_region_inlay(name: str, loc, size, region_id: str, material, face: str = "-Y"):
    """Alias for a small surface-atlas cutout flush on a real detail face."""
    return surface_uv_panel(name, loc, size, region_id, material, face)


def route_switch_image():
    global _ROUTE_SWITCH_IMAGE
    if _ROUTE_SWITCH_IMAGE is None:
        _ROUTE_SWITCH_IMAGE = bpy.data.images.load(str(ROUTE_SWITCH_ATLAS), check_existing=True)
        _ROUTE_SWITCH_IMAGE.name = "hp_route_switch_console_image2_atlas_v1"
    return _ROUTE_SWITCH_IMAGE


def route_switch_regions() -> dict:
    global _ROUTE_SWITCH_REGIONS
    if _ROUTE_SWITCH_REGIONS is None:
        _ROUTE_SWITCH_REGIONS = json.loads(ROUTE_SWITCH_REGIONS_JSON.read_text())
    return _ROUTE_SWITCH_REGIONS


def route_switch_uv_rect(region_id: str, padding_px: float = 2.0):
    data = route_switch_regions()
    atlas_w, atlas_h = data["atlasSize"]
    x, y, w, h = data["regions"][region_id]
    u0 = (x + padding_px) / atlas_w
    u1 = (x + w - padding_px) / atlas_w
    v_top = 1.0 - (y + padding_px) / atlas_h
    v_bottom = 1.0 - (y + h - padding_px) / atlas_h
    return (u0, v_bottom, u1, v_top)


def make_route_switch_mat(name: str, roughness: float = 0.42, metallic: float = 0.42, emission_strength: float = 0.0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (1.0, 1.0, 1.0, 1.0)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = principled_bsdf(material)
    if bsdf:
        tex = nodes.new("ShaderNodeTexImage")
        tex.name = f"{name}_route_switch_atlas"
        tex.image = route_switch_image()
        tex.extension = "CLIP"
        tex.interpolation = "Linear"
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if emission_strength > 0 and "Emission Color" in bsdf.inputs:
            links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def _route_switch_quad(name: str, verts, region_id: str, material):
    u0, v0, u1, v1 = route_switch_uv_rect(region_id)
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop_index, uv in zip(mesh.polygons[0].loop_indices, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]):
        uv_layer.data[loop_index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def route_switch_uv_panel(name: str, loc, size, region_id: str, material, face: str = "-Y"):
    x, y, z = loc
    width, height = size
    if face == "-Y":
        verts = [
            (x - width / 2, y, z - height / 2),
            (x + width / 2, y, z - height / 2),
            (x + width / 2, y, z + height / 2),
            (x - width / 2, y, z + height / 2),
        ]
    elif face == "+Z":
        verts = [
            (x - width / 2, y - height / 2, z),
            (x + width / 2, y - height / 2, z),
            (x + width / 2, y + height / 2, z),
            (x - width / 2, y + height / 2, z),
        ]
    elif face == "+X":
        verts = [
            (x, y - width / 2, z - height / 2),
            (x, y + width / 2, z - height / 2),
            (x, y + width / 2, z + height / 2),
            (x, y - width / 2, z + height / 2),
        ]
    elif face == "-X":
        verts = [
            (x, y + width / 2, z - height / 2),
            (x, y - width / 2, z - height / 2),
            (x, y - width / 2, z + height / 2),
            (x, y + width / 2, z + height / 2),
        ]
    else:
        raise ValueError(f"unsupported face {face}")
    return _route_switch_quad(name, verts, region_id, material)


def lens_socket(prefix: str, loc, radius: float, lens_mat, housing_mat, depth: float = 0.05):
    """A physical recessed lens socket facing -Y. `loc` is the front-face plane.
    A metal backing cup holds an emissive lens disc, framed by a hollow torus rim
    at the surface — the rim ring never occludes the lit lens, and nothing floats."""
    x, yf, z = loc
    rot = (math.pi / 2, 0, 0)
    cyl(f"{prefix}_cup", (x, yf + depth * 0.72, z), radius * 0.96, depth * 0.56, housing_mat, 24, rot=rot, bevel=0.004)
    cyl(f"{prefix}_lens", (x, yf + depth * 0.02, z), radius * 0.78, depth * 0.3, lens_mat, 24, rot=rot, bevel=0.004)
    torus(f"{prefix}_rim", (x, yf + depth * 0.05, z), radius * 0.94, depth * 0.32, housing_mat, rot=rot)


def knob_module(prefix: str, loc, radius: float, body_mat, node_mat, lit: bool):
    """A rotatable line/calibration module: recessed barrel + raised cap + slot
    indicator + small emissive node. Reads as a physical rotary dial."""
    x, y, z = loc
    rot = (math.pi / 2, 0, 0)
    cyl(f"{prefix}_well", (x, y + 0.02, z), radius * 1.18, 0.04, body_mat, 20, rot=rot, bevel=0.004)
    cyl(f"{prefix}_cap", (x, y - 0.012, z), radius, 0.05, body_mat, 20, rot=rot, bevel=0.006)
    # slot indicator across the cap face
    cube(f"{prefix}_slot", (x, y - 0.04, z), (radius * 1.4, 0.012, radius * 0.34), body_mat, 0.004)
    cyl(f"{prefix}_node", (x, y - 0.05, z + radius * 0.62), radius * 0.22, 0.02, node_mat, 12, rot=rot, bevel=0.002)


def corner_screws(prefix: str, xs, zs, y: float, material):
    for ix, x in enumerate(xs):
        for iz, z in enumerate(zs):
            region = "screw.cross" if (ix + iz) % 2 == 0 else "screw.hex"
            region_inlay(f"{prefix}_screw_{ix}_{iz}", (x, y, z), (0.035, 0.035), region, material)


def rubber_feet(prefix: str, xs: tuple[float, ...], z: float, y: float, material):
    for index, x in enumerate(xs):
        cube(f"{prefix}_rubber_foot_{index}", (x, y, z), (0.16, 0.11, 0.045), material, 0.012)


def front_vent(prefix: str, center, width: float, rows: int, material):
    x, y, z = center
    for row in range(rows):
        offset = (row - (rows - 1) / 2) * 0.028
        cube(f"{prefix}_vent_slit_{row}", (x, y, z + offset), (width, 0.012, 0.008), material, 0.002)


def cable_arc(prefix: str, x: float, y: float, z0: float, z1: float, material, segments: int = 5):
    """Segmented low-poly service cable on a front/side plate."""
    for index in range(segments):
        t = index / max(1, segments - 1)
        z = z0 * (1 - t) + z1 * t
        dx = math.sin(t * math.pi) * 0.035
        cyl(
            f"{prefix}_cable_seg_{index}",
            (x + dx, y, z),
            0.014,
            0.105,
            material,
            10,
            rot=(math.pi / 2, 0.0, 0.0),
            bevel=0.002,
        )


# ---------------------------------------------------------------------------
# Industrial design primitives (v11): real volumetric parts so each machine's
# silhouette is carried by geometry, not by a front texture.
# ---------------------------------------------------------------------------


def lamp_tube(prefix, x, yf, z_center, height, radius, glass_mat, core_mat, socket_mat):
    """A vertical glass lamp tube standing proud of a -Y front face, capped by
    brass socket flanges. The tube body IS the emissive colour (an opaque glass
    shell would occlude an inner core on the Raw WebGPU path), so the lamp colour
    reads clearly in first person; a thin glass gloss strip keeps it glassy."""
    cyl(f"{prefix}_socket_bot", (x, yf, z_center - height / 2), radius * 1.55, 0.055, socket_mat, 20, bevel=0.006)
    cyl(f"{prefix}_socket_top", (x, yf, z_center + height / 2), radius * 1.55, 0.05, socket_mat, 20, bevel=0.006)
    cyl(f"{prefix}_tube", (x, yf, z_center), radius, height, core_mat, 22, bevel=0.004)
    cube(f"{prefix}_gloss", (x - radius * 0.34, yf - radius * 0.92, z_center), (radius * 0.2, 0.004, height * 0.86), glass_mat, 0.0)
    cyl(f"{prefix}_cap", (x, yf, z_center + height / 2 + 0.035), radius * 1.15, 0.045, socket_mat, 16, bevel=0.006)


def press_block(prefix, loc, size, cap_mat, frame_mat):
    """A chunky physical press button: a recessed frame socket with a beveled cap
    protruding toward -Y. Reads as a real key, not a flat UI tile."""
    x, yf, z = loc
    w, depth, h = size
    cube(f"{prefix}_frame", (x, yf + 0.02, z), (w + 0.028, 0.045, h + 0.028), frame_mat, 0.008)
    cube(f"{prefix}_cap", (x, yf - depth * 0.5, z), (w, depth, h), cap_mat, min(0.02, h * 0.22))


def dial(prefix, loc, radius, body_mat, ind_mat):
    """A physical rotary dial: recessed well, stepped base, knurled-look cap, a
    grip handle bar across the face, and a small emissive indicator near the rim."""
    x, y, z = loc
    rot = (math.pi / 2, 0, 0)
    cyl(f"{prefix}_well", (x, y + 0.026, z), radius * 1.28, 0.05, body_mat, 24, rot=rot, bevel=0.004)
    cyl(f"{prefix}_base", (x, y - 0.004, z), radius * 1.06, 0.04, body_mat, 24, rot=rot, bevel=0.006)
    cyl(f"{prefix}_cap", (x, y - 0.03, z), radius, 0.05, body_mat, 24, rot=rot, bevel=0.012)
    cube(f"{prefix}_handle", (x, y - 0.058, z), (radius * 1.7, 0.022, radius * 0.34), body_mat, 0.006)
    cyl(f"{prefix}_ind", (x, y - 0.062, z + radius * 0.6), radius * 0.2, 0.02, ind_mat, 12, rot=rot, bevel=0.002)


def export_glb(model_key: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for obj in bpy.context.scene.objects:
        obj.select_set(True)
    if model_key == "builder_route_switch_console":
        SOURCE_BLEND_DIR.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND_DIR / "hp_builder_route_switch_console_image2_v2.blend"))
    if model_key == "puzzle_console_archive_merge":
        SOURCE_BLEND_DIR.mkdir(parents=True, exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_BLEND_DIR / "hp_puzzle_console_archive_merge_v2.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_DIR / f"hp_{model_key}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )


def common_materials():
    return {
        "body": make_mat("powder_coated_dark_body", (0.055, 0.07, 0.08, 1.0), roughness=0.64, metallic=0.18),
        "trim": make_mat("soft_black_trim", (0.018, 0.024, 0.028, 1.0), roughness=0.48, metallic=0.32),
        "rubber": make_mat("matte_black_rubber_feet", (0.006, 0.008, 0.009, 1.0), roughness=0.82, metallic=0.02),
        "edge": make_mat("cool_worn_edge_highlight", (0.34, 0.39, 0.4, 1.0), roughness=0.42, metallic=0.48),
        "brass": make_mat("worn_brass_edges", (0.56, 0.38, 0.14, 1.0), roughness=0.36, metallic=0.72),
        "cyan": make_mat("muted_cyan_glass", (0.08, 0.72, 0.82, 1.0), (0.25, 0.92, 1.0), 0.95, roughness=0.24),
        "cyan_hot": make_mat("hot_cyan_core_glass", (0.18, 0.86, 0.92, 1.0), (0.5, 1.0, 1.0), 1.35, roughness=0.18),
        "amber": make_mat("amber_status_lens", (0.75, 0.43, 0.12, 1.0), (1.0, 0.52, 0.16), 0.8, roughness=0.22),
        "red": make_mat("red_fault_lens", (0.6, 0.08, 0.08, 1.0), (1.0, 0.12, 0.08), 0.55, roughness=0.2),
        "blue": make_mat("blue_memory_lens", (0.08, 0.24, 0.8, 1.0), (0.2, 0.44, 1.0), 0.55, roughness=0.2),
        "green": make_mat("green_ready_lens", (0.08, 0.58, 0.22, 1.0), (0.18, 0.9, 0.38), 0.55, roughness=0.2),
        "purple": make_mat("purple_sequence_lens", (0.38, 0.16, 0.68, 1.0), (0.7, 0.32, 1.0), 0.55, roughness=0.2),
        "white": make_mat("white_sequence_lens", (0.86, 0.88, 0.8, 1.0), (0.95, 0.95, 0.82), 0.48, roughness=0.18),
        "paper": make_mat("aged_archive_paper", (0.62, 0.54, 0.42, 1.0), roughness=0.72, metallic=0.0),
        "screen_dead": make_mat("dead_black_screen", (0.005, 0.008, 0.012, 1.0), roughness=0.3, metallic=0.05),
    }


def build_color_sequence():
    """灯序记忆墙: a standing seven-lamp replay wall. Seven vertical glass lamp
    tubes sit in brass socket flanges inside a recessed bay, under a heavy top
    guard rail; a lower brass replay rail, per-lamp status keys, side bolt rails
    and service boxes give it real depth. Geometry carries the silhouette; opaque
    atlas tiles only dress the flat faces. Lamp colours stay runtime-driven."""
    mats = common_materials()
    parts_flat = make_parts_mat("sequence_parts_flat", emission_strength=0.0, roughness=0.55)
    surf_matte = make_surface_mat("sequence_surf_matte", "matte")
    surf_metal = make_surface_mat("sequence_surf_metal", "metal")
    cores = [mats["red"], mats["blue"], mats["amber"], mats["green"], mats["purple"], mats["white"], mats["cyan"]]
    tube_glass = make_mat("sequence_tube_gloss", (0.82, 0.86, 0.92, 1.0), (0.9, 0.95, 1.0), 0.5, roughness=0.08)

    # Grounded plinth + tall powder-coat body.
    cube("sequence_plinth", (0, 0, 0.07), (1.22, 0.34, 0.14), mats["trim"])
    cube("sequence_body", (0, 0.02, 0.88), (1.3, 0.26, 1.46), mats["body"], 0.04)
    yf = -0.11  # body front plane

    # Heavy top guard rail / bracket + brass cap rail.
    cube("sequence_top_guard", (0, -0.05, 1.63), (1.34, 0.22, 0.12), mats["trim"], 0.02)
    cube("sequence_top_brass_rail", (0, -0.17, 1.6), (1.22, 0.06, 0.05), mats["brass"], 0.01)
    cube("sequence_left_clamp", (-0.62, -0.16, 1.6), (0.07, 0.09, 0.12), mats["rubber"], 0.008)
    cube("sequence_right_clamp", (0.62, -0.16, 1.6), (0.07, 0.09, 0.12), mats["rubber"], 0.008)

    # Recessed lamp bay (dark interior) holding the seven tubes.
    cube("sequence_bay_recess", (0, -0.05, 1.02), (1.12, 0.12, 0.94), mats["screen_dead"], 0.012)

    # Seven vertical glass lamp tubes with brass sockets + emissive cores.
    for i, core in enumerate(cores):
        x = -0.48 + i * 0.16
        lamp_tube(f"sequence_lamp_{i}", x, -0.18, 1.04, 0.66, 0.045, tube_glass, core, mats["brass"])
        press_block(f"sequence_key_{i}", (x, -0.14, 0.52), (0.07, 0.03, 0.05), core, mats["trim"])

    # Lower brass replay rail with cyan replay bar + amber standby.
    cube("sequence_replay_rail", (0, -0.12, 0.37), (1.16, 0.08, 0.1), mats["brass"], 0.012)
    cube("sequence_replay_bar_backer", (0, -0.17, 0.37), (0.8, 0.03, 0.045), mats["trim"], 0.006)
    cube("sequence_replay_bar_lit", (-0.18, -0.19, 0.37), (0.3, 0.022, 0.026), mats["cyan"], 0.006)
    cube("sequence_standby_core", (0.42, -0.19, 0.37), (0.1, 0.025, 0.03), mats["amber"], 0.006)

    # Side bolt rails + two lower service boxes with vents.
    for sx in (-0.64, 0.64):
        side = "l" if sx < 0 else "r"
        cube(f"sequence_side_rail_{side}", (sx, -0.04, 0.92), (0.05, 0.18, 1.32), mats["trim"], 0.01)
        for bz in (0.46, 0.92, 1.38):
            cyl(f"sequence_bolt_{side}_{int(bz*100)}", (sx, -0.14, bz), 0.022, 0.03, mats["brass"], 8, rot=(math.pi / 2, 0, 0), bevel=0.004)
        cube(f"sequence_service_box_{side}", (sx * 0.78, -0.12, 0.2), (0.26, 0.1, 0.15), mats["body"], 0.012)
        front_vent(f"sequence_service_vent_{side}", (sx * 0.78, -0.18, 0.2), 0.18, 3, mats["edge"])
    rubber_feet("sequence", (-0.5, 0.5), 0.14, 0.01, mats["rubber"])

    # Opaque surface tiles (robust, no alpha): smoked powdercoat body border, aged
    # medical plastic bay back wall behind the tubes, copper top rail face.
    surface_uv_panel("sequence_body_surface", (0, -0.111, 0.9), (1.22, 1.38), "smoked_powdercoat_panel", surf_matte)
    surface_uv_panel("sequence_bay_back_surface", (0, -0.108, 1.02), (1.06, 0.88), "aged_medical_plastic_panel", surf_matte)
    surface_uv_panel("sequence_top_rail_face", (0, -0.201, 1.6), (1.18, 0.05), "copper_bus_panel", surf_metal)

    # Opaque parts-atlas detail: corner screws + a micro-tick ruler under the bay.
    corner_screws("sequence", (-0.6, 0.6), (0.32, 1.5), -0.112, parts_flat)
    region_inlay("sequence_micro_ticks", (0, -0.116, 0.66), (0.9, 0.04), "microticks.horizontal", parts_flat)

    # Interact focus: cyan confirm strip + amber ready lights beneath the lamps.
    cube("sequence_confirm_strip", (0, -0.13, 0.64), (0.42, 0.03, 0.03), mats["cyan"], 0.006)
    for fx in (-0.26, 0.26):
        cyl(f"sequence_confirm_light_{'l' if fx < 0 else 'r'}", (fx, -0.14, 0.64), 0.02, 0.02, mats["amber"], 12, rot=(math.pi / 2, 0, 0), bevel=0.003)


def build_circuit_grid():
    """电力回路高柜: a tall maintenance cabinet. A copper bus bar with three
    rising conduits crowns the top; a deep recessed 3x3 rotary-dial bay carries
    energised cyan cable traces; vertical cyan glow tubes flank both sides; a
    hazard skirt and in/out power sockets sit on the lower apron. Dial/trace
    state stays runtime-driven; geometry carries the silhouette."""
    mats = common_materials()
    parts_lit = make_parts_mat("circuit_parts_lit", emission_strength=0.55, roughness=0.32)
    parts_flat = make_parts_mat("circuit_parts_flat", emission_strength=0.0, roughness=0.55)
    surf_matte = make_surface_mat("circuit_surf_matte", "matte")
    surf_metal = make_surface_mat("circuit_surf_metal", "metal")
    copper = make_mat("circuit_copper_bus", (0.6, 0.34, 0.18, 1.0), roughness=0.34, metallic=0.8)
    node_lit = make_mat("circuit_node_lit", (0.1, 0.7, 0.82, 1.0), (0.25, 0.95, 1.0), 0.85)
    trace = mats["cyan_hot"]
    tube_glass = make_mat("circuit_tube_gloss", (0.82, 0.86, 0.92, 1.0), (0.9, 0.95, 1.0), 0.5, roughness=0.08)

    # Grounded plinth + tall cabinet shell + side rails.
    cube("circuit_base_plinth", (0, 0, 0.09), (0.9, 0.34, 0.18), mats["trim"])
    cube("circuit_cabinet_body", (0, 0.02, 0.86), (0.84, 0.3, 1.5), mats["body"], 0.035)
    cube("circuit_side_rail_l", (-0.41, -0.05, 0.9), (0.06, 0.24, 1.32), mats["trim"], 0.012)
    cube("circuit_side_rail_r", (0.41, -0.05, 0.9), (0.06, 0.24, 1.32), mats["trim"], 0.012)
    yf = -0.13  # cabinet front plane

    # Recessed calibration bay (dark) for the rotary dials.
    cube("circuit_bay_recess", (0, -0.04, 1.0), (0.62, 0.14, 0.74), mats["screen_dead"], 0.01)

    # 3x3 physical rotary dials with grip handles; lit nodes carry state.
    lit = {0, 3, 4, 5, 8}
    for row in range(3):
        for col in range(3):
            index = row * 3 + col
            dial(
                f"circuit_dial_{row}_{col}",
                (-0.19 + col * 0.19, -0.16, 1.21 - row * 0.21),
                0.066,
                mats["trim"],
                node_lit if index in lit else mats["screen_dead"],
            )

    # Energised cable traces inside the bay, sitting proud of the back wall.
    cube("circuit_trace_mid_h", (0, -0.135, 1.0), (0.36, 0.016, 0.02), trace, 0.003)
    cube("circuit_trace_left_v", (-0.19, -0.135, 1.105), (0.02, 0.016, 0.22), trace, 0.003)
    cube("circuit_trace_right_v", (0.19, -0.135, 0.895), (0.02, 0.016, 0.22), trace, 0.003)
    cube("circuit_trace_out_h", (0.095, -0.135, 0.79), (0.2, 0.016, 0.02), trace, 0.003)

    # Copper bus bar across the top with brass terminals + three rising conduits.
    cube("circuit_power_bus", (0, -0.08, 1.55), (0.78, 0.11, 0.11), mats["brass"])
    surface_uv_panel("circuit_power_bus_face", (0, -0.141, 1.55), (0.72, 0.08), "copper_bus_panel", surf_metal)
    for tx in (-0.3, -0.1, 0.1, 0.3):
        cyl(f"circuit_bus_terminal_{int(tx*100)}", (tx, -0.14, 1.55), 0.024, 0.05, copper, 14, rot=(math.pi / 2, 0, 0), bevel=0.003)
    for cx in (-0.26, 0.0, 0.26):
        cyl(f"circuit_conduit_{int(cx*100)}", (cx, 0.0, 1.7), 0.05, 0.26, mats["trim"], 16, bevel=0.006)
        cyl(f"circuit_conduit_cap_{int(cx*100)}", (cx, 0.0, 1.84), 0.06, 0.04, mats["brass"], 16, bevel=0.006)

    # Vertical cyan glow tubes flanking the bay.
    for sx in (-0.34, 0.34):
        side = "l" if sx < 0 else "r"
        lamp_tube(f"circuit_tube_{side}", sx, -0.155, 1.0, 0.66, 0.032, tube_glass, mats["cyan"], mats["brass"])

    # Small diagnostic readout glass above the bay.
    cube("circuit_diag_bezel", (0, -0.1, 1.41), (0.4, 0.07, 0.1), mats["trim"], 0.01)
    region_inlay("circuit_diag_glass", (0, -0.142, 1.41), (0.34, 0.08), "screen.glass.cyan", parts_lit)

    # In/out power sockets on the lower apron.
    lens_socket("circuit_socket_in", (-0.2, -0.13, 0.54), 0.07, node_lit, mats["trim"], depth=0.06)
    lens_socket("circuit_socket_out", (0.2, -0.13, 0.54), 0.07, mats["amber"], mats["trim"], depth=0.06)

    # Service cables down the sides, conduit out the rear-bottom.
    cable_arc("circuit_left_service", -0.46, -0.04, 0.34, 1.3, mats["rubber"], segments=7)
    cable_arc("circuit_right_service", 0.46, -0.04, 0.4, 1.22, mats["rubber"], segments=7)
    cyl("circuit_conduit_rear", (0, 0.16, 0.22), 0.06, 0.4, mats["trim"], 16, rot=(0, math.pi / 2, 0))

    # Hazard skirt + ruler on the apron, vents, feet.
    cube("circuit_warning_skirt", (0, -0.12, 0.2), (0.66, 0.07, 0.1), mats["amber"], 0.012)
    region_inlay("circuit_warning_face", (0, -0.156, 0.2), (0.62, 0.07), "warning.stripe.amber", parts_flat)
    region_inlay("circuit_ticks", (0, -0.146, 0.36), (0.5, 0.05), "microticks.horizontal", parts_flat)
    front_vent("circuit_apron", (0, -0.156, 0.3), 0.42, 3, mats["edge"])
    rubber_feet("circuit", (-0.32, 0.32), 0.015, -0.01, mats["rubber"])

    # Opaque surface tiles: smoked-powdercoat side columns + upper band, black
    # recess back wall behind the bay.
    surface_uv_panel("circuit_col_l_surface", (-0.355, -0.131, 0.9), (0.1, 1.34), "smoked_powdercoat_panel", surf_matte)
    surface_uv_panel("circuit_col_r_surface", (0.355, -0.131, 0.9), (0.1, 1.34), "smoked_powdercoat_panel", surf_matte)
    surface_uv_panel("circuit_upper_surface", (0, -0.131, 1.44), (0.62, 0.12), "smoked_powdercoat_panel", surf_matte)
    surface_uv_panel("circuit_bay_back_surface", (0, -0.105, 1.0), (0.58, 0.68), "black_recess_panel", surf_matte)
    corner_screws("circuit", (-0.36, 0.36), (0.34, 1.44), -0.131, parts_flat)

    # Interact focus: cyan frame rails bracketing the 3x3 bay.
    for fx in (-0.33, 0.33):
        cube(f"circuit_bay_frame_{'l' if fx < 0 else 'r'}", (fx, -0.12, 1.0), (0.022, 0.03, 0.68), node_lit, 0.005)


def build_surveillance_match():
    mats = common_materials()
    cube("surveillance_desk_body", (0, 0, 0.32), (1.0, 0.42, 0.64), mats["body"])
    cube("surveillance_desk_lip", (0, -0.16, 0.72), (0.88, 0.08, 0.06), mats["trim"])
    cube("screen_riser", (0, -0.08, 1.02), (0.92, 0.12, 0.42), mats["trim"])
    for index, material in enumerate([mats["cyan"], mats["screen_dead"], mats["cyan"]]):
        cube(f"surveillance_screen_{index}", (-0.28 + index * 0.28, -0.155, 1.02), (0.22, 0.035, 0.3), material, 0.01)
    cube("camera_mast", (0.42, -0.08, 1.18), (0.045, 0.045, 0.92), mats["trim"], 0.01)
    cube("camera_head", (0.42, -0.04, 1.66), (0.22, 0.16, 0.12), mats["body"], 0.018)
    cube("camera_eye", (0.42, -0.135, 1.66), (0.07, 0.03, 0.055), mats["red"], 0.01)


def build_valve_matrix():
    mats = common_materials()
    cube("valve_base", (0, 0, 0.3), (1.08, 0.38, 0.6), mats["body"])
    cyl("main_pipe", (0, 0, 0.82), 0.06, 1.1, mats["trim"], 24, rot=(0, math.pi / 2, 0))
    for sx in (-0.34, 0.34):
        cyl(f"riser_{sx}", (sx, 0, 1.04), 0.045, 0.34, mats["trim"], 18)
        cyl(f"valve_disc_{sx}", (sx, -0.12, 1.28), 0.17, 0.035, mats["red"], 32, rot=(math.pi / 2, 0, 0), bevel=0.006)
        cube(f"valve_spoke_h_{sx}", (sx, -0.145, 1.28), (0.3, 0.025, 0.045), mats["red"], 0.006)
        cube(f"valve_spoke_v_{sx}", (sx, -0.145, 1.28), (0.045, 0.025, 0.3), mats["red"], 0.006)
    cube("gauge_panel", (0, -0.19, 0.58), (0.62, 0.055, 0.28), mats["body"], 0.018)
    cyl("left_gauge", (-0.16, -0.225, 0.6), 0.075, 0.025, mats["amber"], 24, rot=(math.pi / 2, 0, 0), bevel=0.006)
    cyl("right_gauge", (0.16, -0.225, 0.6), 0.075, 0.025, mats["amber"], 24, rot=(math.pi / 2, 0, 0), bevel=0.006)


def build_archive_merge():
    """身份压缩柜: a compact identity-compression cabinet with a dark facility
    shell, amber target window, 4x4 physical identity tiles, side clamp rails and
    a lower card slot. Large bright medical panels are deliberately avoided; the
    object should read as dark machinery in a clinic/core room, not a white block.
    Target value + lit blocks stay runtime-driven (seven-seg geometry, not baked
    text)."""
    mats = common_materials()
    parts_flat = make_parts_mat("archive_parts_flat", emission_strength=0.0, roughness=0.55)
    surf_dark = make_surface_mat("archive_shell_surface_dark", "matte")
    surf_glass = make_surface_mat("archive_glass_surface", "glass", emission_strength=0.45)
    shell = make_mat("archive_deep_graphite_shell", (0.032, 0.043, 0.048, 1.0), roughness=0.56, metallic=0.22)
    ceramic = make_mat("archive_worn_ceramic_edge", (0.18, 0.24, 0.245, 1.0), roughness=0.58, metallic=0.12)
    warm = make_mat("archive_status_warm", (0.75, 0.55, 0.2, 1.0), (1.0, 0.74, 0.28), 0.72, roughness=0.18)
    block_dim = make_mat("archive_block_dim_graphite", (0.05, 0.065, 0.07, 1.0), roughness=0.42, metallic=0.32)
    block_cyan = make_mat("archive_block_cyan", (0.08, 0.46, 0.5, 1.0), (0.2, 0.88, 0.95), 0.55, roughness=0.22)
    block_hot = make_mat("archive_block_hot", (0.72, 0.52, 0.16, 1.0), (1.0, 0.72, 0.2), 0.62, roughness=0.22)

    # Grounded base + dark upright shell. The shell stays visible from first
    # person as dark graphite, with only narrow pale edge pieces.
    cube("archive_floor_shadow_plinth", (0, 0, 0.06), (1.1, 0.52, 0.12), mats["rubber"], 0.018)
    cube("archive_lower_skid", (0, -0.02, 0.16), (1.02, 0.46, 0.18), mats["trim"], 0.018)
    cube("archive_graphite_body", (0, 0, 0.86), (0.98, 0.38, 1.36), shell, 0.035)
    cube("archive_front_recess_back", (0, -0.175, 0.98), (0.82, 0.08, 0.98), mats["screen_dead"], 0.016)
    cube("archive_left_ceramic_cheek", (-0.52, -0.02, 0.86), (0.075, 0.42, 1.28), ceramic, 0.018)
    cube("archive_right_ceramic_cheek", (0.52, -0.02, 0.86), (0.075, 0.42, 1.28), ceramic, 0.018)
    cube("archive_top_rail", (0, -0.04, 1.57), (0.94, 0.42, 0.11), mats["trim"], 0.018)
    cube("archive_top_brass_lip", (0, -0.255, 1.57), (0.86, 0.045, 0.05), mats["brass"], 0.008)
    yf = -0.22

    # Amber mechanical target display. The display is narrow and physically set
    # into the dark brow instead of floating above a white slab.
    cube("archive_target_socket", (0, -0.235, 1.42), (0.62, 0.07, 0.22), mats["screen_dead"], 0.012)
    surface_uv_panel("archive_target_glass", (0, -0.276, 1.42), (0.55, 0.16), "amber_archive_glass_panel", surf_glass)
    seven_segment_digit("archive_target_left", 3, (-0.11, -0.288, 1.42), (0.13, 0.16), warm, 0.015)
    seven_segment_digit("archive_target_right", 2, (0.11, -0.288, 1.42), (0.13, 0.16), warm, 0.015)
    lens_socket("archive_status_cyan", (-0.39, -0.278, 1.42), 0.033, mats["cyan"], mats["trim"], depth=0.035)
    lens_socket("archive_status_amber", (0.39, -0.278, 1.42), 0.033, mats["amber"], mats["trim"], depth=0.035)

    # Recessed compression bay with a 4x4 grid of physical identity tiles.
    cube("archive_tile_bay_frame", (0, -0.235, 1.03), (0.78, 0.08, 0.76), mats["trim"], 0.014)
    surface_uv_panel("archive_tile_bay_back_image2", (0, -0.282, 1.03), (0.7, 0.68), "black_recess_panel", surf_dark)
    lit = {0: block_cyan, 5: block_cyan, 6: warm, 9: block_hot, 10: warm, 15: block_hot}
    for row in range(4):
        for col in range(4):
            index = row * 4 + col
            x = -0.255 + col * 0.17
            z = 1.255 - row * 0.16
            cap_mat = lit.get(index, block_dim)
            press_block(f"archive_identity_tile_{row}_{col}", (x, -0.315, z), (0.122, 0.052, 0.118), cap_mat, mats["trim"])

    # Compression yoke and rails: strong silhouette, not decoration.
    cube("archive_compression_crossbar_top", (0, -0.318, 1.31), (0.72, 0.04, 0.045), mats["brass"], 0.006)
    cube("archive_compression_crossbar_bottom", (0, -0.318, 0.72), (0.72, 0.035, 0.038), mats["brass"], 0.006)
    for sx, side in ((-0.36, "left"), (0.36, "right")):
        cube(f"archive_{side}_compression_ram", (sx, -0.318, 1.02), (0.04, 0.04, 0.58), mats["brass"], 0.006)
        cable_arc(f"archive_{side}_service", sx * 0.92, -0.272, 0.66, 1.36, mats["edge"], segments=6)

    # Lower apron: identity card slot, drawer, cable ports and vents.
    cube("archive_card_slot_frame", (-0.22, -0.265, 0.52), (0.34, 0.06, 0.12), mats["trim"], 0.01)
    cube("archive_identity_card_slot", (-0.22, -0.307, 0.52), (0.25, 0.025, 0.04), mats["screen_dead"], 0.006)
    cube("archive_identity_card_edge", (-0.22, -0.324, 0.52), (0.2, 0.014, 0.018), mats["cyan"], 0.003)
    cube("archive_release_drawer", (0.22, -0.27, 0.52), (0.3, 0.065, 0.18), mats["trim"], 0.012)
    cube("archive_release_drawer_handle", (0.22, -0.315, 0.52), (0.14, 0.018, 0.026), mats["brass"], 0.005)
    front_vent("archive_lower_vent", (0.23, -0.318, 0.33), 0.28, 3, mats["edge"])
    for fx in (-0.42, 0.42):
        lens_socket(f"archive_cable_port_{'l' if fx < 0 else 'r'}", (fx, -0.292, 0.34), 0.034, mats["cyan"], mats["trim"], depth=0.035)

    # Opaque Image2 material evidence on dark faces: smoked powdercoat shell,
    # black recess, brass brow strip, screws and micro ticks. No giant white panel.
    surface_uv_panel("archive_shell_powdercoat_image2", (0, yf, 0.86), (0.9, 1.26), "smoked_powdercoat_panel", surf_dark)
    surface_uv_panel("archive_top_brow_image2", (0, -0.279, 1.57), (0.82, 0.055), "brushed_brass_panel", surf_dark)
    region_inlay("archive_brow_strip", (0, -0.318, 1.57), (0.76, 0.04), "trim.brass.long", parts_flat)
    region_inlay("archive_micro_ticks", (0, -0.319, 0.64), (0.68, 0.035), "microticks.horizontal", parts_flat)
    corner_screws("archive", (-0.44, 0.44), (0.28, 1.48), -0.318, parts_flat)
    rubber_feet("archive", (-0.38, 0.38), 0.02, 0.03, mats["rubber"])

    # Interact focus: cyan insert-ready lights flanking the identity card slot.
    for fx in (-0.34, -0.1):
        cyl(f"archive_insert_light_{'a' if fx < -0.2 else 'b'}", (fx, -0.328, 0.52), 0.014, 0.018, mats["cyan"], 12, rot=(math.pi / 2, 0, 0), bevel=0.002)


def build_gallery_reading():
    """展画审读台: a museum evidence reading desk. An angled amber glass reading
    plate sits in a brushed-brass picture frame with corner clamps; an overhead
    scan lamp arm reaches over it; an evidence card tray pulls out at the front and
    a small side terminal sits on the right, all on a pedestal base."""
    mats = common_materials()
    parts_flat = make_parts_mat("gallery_parts_flat", emission_strength=0.0, roughness=0.55)
    parts_lit = make_parts_mat("gallery_parts_lit", emission_strength=0.42, roughness=0.34)
    surf_matte = make_surface_mat("gallery_surf_matte", "matte")
    surf_metal = make_surface_mat("gallery_surf_metal", "metal")
    read_glass = make_mat("gallery_reading_glass", (0.34, 0.22, 0.07, 1.0), (0.9, 0.58, 0.2), 0.16, roughness=0.16)
    warm_lamp = make_mat("gallery_scan_lamp", (0.84, 0.62, 0.32, 1.0), (1.0, 0.78, 0.38), 0.95, roughness=0.25)
    tilt = math.radians(24)
    read_rot = (tilt, 0, 0)

    # Grounded pedestal base + foot.
    cube("gallery_base_foot", (0, 0.02, 0.05), (0.82, 0.52, 0.1), mats["trim"], 0.018)
    cube("gallery_pedestal", (0, 0, 0.46), (0.74, 0.46, 0.82), mats["body"], 0.03)
    cube("gallery_neck", (0, 0.04, 0.92), (0.6, 0.3, 0.18), mats["trim"], 0.018)

    # Angled reading head: brass frame slab + amber glass plate + corner clamps.
    fx_c, fy_c, fz_c = 0.0, -0.06, 1.26
    cube("gallery_frame_back", (fx_c, fy_c + 0.05, fz_c), (0.7, 0.07, 0.62), mats["trim"], 0.014, rot=read_rot)
    cube("gallery_frame_brass", (fx_c, fy_c, fz_c), (0.66, 0.035, 0.56), mats["brass"], 0.01, rot=read_rot)
    cube("gallery_reading_plate", (fx_c, fy_c - 0.028, fz_c + 0.012), (0.56, 0.02, 0.46), read_glass, 0.006, rot=read_rot)
    for cx in (-0.29, 0.29):
        cube(f"gallery_clamp_top_{'l' if cx < 0 else 'r'}", (cx, fy_c - 0.04, fz_c + 0.2), (0.06, 0.04, 0.05), mats["brass"], 0.006, rot=read_rot)
        cube(f"gallery_clamp_bot_{'l' if cx < 0 else 'r'}", (cx, fy_c - 0.02, fz_c - 0.22), (0.06, 0.04, 0.05), mats["brass"], 0.006, rot=read_rot)

    # Overhead scan lamp: back post + forward arm + downward warm head bar.
    cube("gallery_lamp_post", (0, 0.16, 1.7), (0.08, 0.08, 0.62), mats["brass"], 0.008)
    cube("gallery_lamp_arm", (0, -0.02, 1.98), (0.08, 0.46, 0.08), mats["brass"], 0.008)
    cube("gallery_lamp_head", (0, -0.2, 1.92), (0.5, 0.12, 0.09), mats["trim"], 0.01, rot=(math.radians(-32), 0, 0))
    cube("gallery_lamp_glow", (0, -0.24, 1.88), (0.44, 0.05, 0.05), warm_lamp, 0.006, rot=(math.radians(-32), 0, 0))

    # Evidence card tray pulling out at the front + cards.
    cube("gallery_tray", (0, -0.16, 0.66), (0.66, 0.22, 0.06), mats["trim"], 0.012)
    cube("gallery_tray_lip", (0, -0.27, 0.66), (0.66, 0.03, 0.05), mats["brass"], 0.006)
    for index, cx in enumerate((-0.2, 0.04, 0.24)):
        cube(f"gallery_card_{index}", (cx, -0.29, 0.66), (0.16, 0.02, 0.1), mats["paper"] if index == 1 else mats["body"], 0.004)

    # Small side terminal on the right (small screen, not a poster).
    cube("gallery_terminal_box", (0.42, -0.1, 0.96), (0.18, 0.12, 0.22), mats["body"], 0.012)
    cube("gallery_terminal_bezel", (0.42, -0.17, 0.99), (0.13, 0.03, 0.12), mats["trim"], 0.008)
    region_inlay("gallery_terminal_glass", (0.42, -0.188, 0.99), (0.1, 0.09), "screen.glass.cyan", parts_lit)

    # Cable port + feet + hazard ruler on the pedestal base.
    cyl("gallery_cable_port", (-0.3, -0.22, 0.2), 0.036, 0.022, mats["trim"], 16, rot=(math.pi / 2, 0, 0), bevel=0.004)
    region_inlay("gallery_lower_warning", (0, -0.232, 0.18), (0.6, 0.05), "warning.stripe.amber", parts_flat)
    rubber_feet("gallery", (-0.3, 0.3), 0.0, 0.03, mats["rubber"])

    # Opaque surface tiles: aged medical plastic pedestal face, brushed brass neck.
    surface_uv_panel("gallery_pedestal_surface", (0, -0.231, 0.5), (0.66, 0.66), "aged_medical_plastic_panel", surf_matte)
    surface_uv_panel("gallery_neck_surface", (0, -0.111, 0.92), (0.54, 0.14), "brushed_brass_panel", surf_metal)
    corner_screws("gallery", (-0.3, 0.3), (0.16, 0.78), -0.231, parts_flat)


def build_route_switch_console():
    """路由控制台: low wide router console matching the 2D Image2 overlay.
    A single four-slot output rack carries four mechanical selector modules;
    the top deck has a physical rotary dial and amber authorization key lens.
    Output target meaning and selected state stay runtime-driven, so the GLB
    bakes only empty sockets, knobs, neutral badge bezels, and machine material."""
    mats = common_materials()
    mats["body"] = make_mat("route_console_oiled_iron_body", (0.012, 0.017, 0.018, 1.0), roughness=0.74, metallic=0.36)
    mats["trim"] = make_mat("route_console_blackened_steel_trim", (0.006, 0.009, 0.01, 1.0), roughness=0.58, metallic=0.56)
    mats["brass"] = make_mat("route_console_aged_bronze_edges", (0.38, 0.23, 0.075, 1.0), roughness=0.43, metallic=0.78)
    mats["rubber"] = make_mat("route_console_dead_black_feet", (0.002, 0.003, 0.003, 1.0), roughness=0.88, metallic=0.02)
    route_img = make_route_switch_mat("route_switch_image2_metal", roughness=0.4, metallic=0.5)
    route_img_lit = make_route_switch_mat("route_switch_image2_lit", roughness=0.26, metallic=0.24, emission_strength=0.22)
    parts_flat = make_parts_mat("route_parts_flat", emission_strength=0.0, roughness=0.55, base_color=(0.18, 0.62, 0.5, 1.0))
    surf_matte = make_surface_mat("route_surf_matte", "matte")
    surf_metal = make_surface_mat("route_surf_metal", "metal")
    cyan_lens = make_mat("route_console_cyan_glass", (0.08, 0.68, 0.74, 1.0), (0.24, 0.95, 1.0), 0.82, roughness=0.2)
    amber_lens = make_mat("route_console_amber_key_lamp", (0.78, 0.45, 0.12, 1.0), (1.0, 0.58, 0.18), 0.78, roughness=0.22)
    smoky_glass = make_mat("route_console_smoked_glass", (0.015, 0.025, 0.03, 1.0), (0.05, 0.2, 0.22), 0.12, roughness=0.24, metallic=0.05)

    # Grounded one-piece chassis. Geometry owns the footprint and contact shadow.
    cube("route_img2_shadow_foot", (0, 0.04, 0.04), (1.32, 0.76, 0.08), mats["rubber"], 0.018)
    cube("route_img2_lower_plinth", (0, 0.02, 0.12), (1.26, 0.72, 0.16), mats["trim"], 0.026)
    cube("route_img2_body_core", (0, -0.005, 0.36), (1.22, 0.66, 0.48), mats["body"], 0.032)
    cube("route_img2_top_deck_block", (0, 0.02, 0.66), (1.16, 0.58, 0.16), mats["trim"], 0.024)
    cube("route_img2_back_cable_trunk", (0, 0.36, 0.17), (1.08, 0.12, 0.12), mats["brass"], 0.012)

    # Image2 surfaces: top deck plate and the shared four-slot rack face.
    route_switch_uv_panel("route_img2_top_deck_image2", (0, 0.01, 0.742), (1.08, 0.42), "top_deck_plate", route_img, face="+Z")
    route_switch_uv_panel("route_img2_four_slot_rack_image2", (0, -0.342, 0.39), (1.2, 0.5), "four_slot_rack_face", route_img)
    route_switch_uv_panel("route_img2_side_body_image2_l", (-0.612, 0.0, 0.38), (0.56, 0.38), "lower_deep_panel", route_img, face="-X")
    route_switch_uv_panel("route_img2_side_body_image2_r", (0.612, 0.0, 0.38), (0.56, 0.38), "lower_deep_panel", route_img, face="+X")
    route_switch_uv_panel("route_img2_side_trim_image2_l", (-0.637, -0.08, 0.16), (0.46, 0.08), "copper_pipe_mid", route_img, face="-X")
    route_switch_uv_panel("route_img2_side_trim_image2_r", (0.637, -0.08, 0.16), (0.46, 0.08), "copper_pipe_mid", route_img, face="+X")
    surface_uv_panel("route_img2_lower_shadow_surface", (0, -0.34, 0.13), (1.12, 0.12), "black_recess_panel", surf_matte)
    surface_uv_panel("route_img2_back_trunk_copper", (0, 0.298, 0.17), (1.0, 0.08), "copper_bus_panel", surf_metal)

    # Central rotary control: real ring/knob plus the Image2 face matching the 2D overlay.
    cyl("route_img2_rotary_socket", (0, -0.02, 0.78), 0.22, 0.045, mats["trim"], 40, bevel=0.006)
    torus("route_img2_rotary_brass_ring", (0, -0.02, 0.81), 0.17, 0.014, mats["brass"])
    cyl("route_img2_rotary_glass_core", (0, -0.02, 0.825), 0.105, 0.035, smoky_glass, 34, bevel=0.006)
    route_switch_uv_panel("route_img2_rotary_face_image2", (0, -0.02, 0.848), (0.36, 0.36), "rotary_dial_face", route_img_lit, face="+Z")
    cube("route_img2_rotary_pointer_bar", (0, -0.095, 0.864), (0.035, 0.13, 0.018), cyan_lens, 0.004)

    # Amber authorization lens/key socket on the right of the deck, visually shared
    # with the 2D overlay key language but still a neutral runtime state.
    cube("route_img2_key_block", (0.46, -0.18, 0.66), (0.17, 0.09, 0.16), mats["body"], 0.012)
    route_switch_uv_panel("route_img2_key_lens_image2", (0.46, -0.231, 0.67), (0.15, 0.19), "authorization_key_lens", route_img_lit)
    cyl("route_img2_key_core", (0.46, -0.244, 0.7), 0.035, 0.026, amber_lens, 18, rot=(math.pi / 2, 0, 0), bevel=0.004)

    # Four Image2-styled selector modules seated inside the shared rack. The lower
    # badge bezels stay empty; overlay/config chooses door/puzzle/robot/output.
    output_xs = (-0.42, -0.14, 0.14, 0.42)
    for index, x in enumerate(output_xs):
        n = index + 1
        cube(f"route_img2_module_back_{n}", (x, -0.372, 0.39), (0.19, 0.055, 0.39), mats["body"], 0.014)
        cube(f"route_img2_module_spine_{n}", (x, -0.405, 0.39), (0.045, 0.032, 0.36), mats["brass"], 0.006)
        cyl(f"route_img2_module_knob_well_{n}", (x, -0.425, 0.5), 0.074, 0.04, mats["trim"], 28, rot=(math.pi / 2, 0, 0), bevel=0.006)
        cyl(f"route_img2_module_knob_ring_{n}", (x, -0.45, 0.5), 0.063, 0.035, mats["brass"], 28, rot=(math.pi / 2, 0, 0), bevel=0.006)
        cyl(f"route_img2_module_knob_core_{n}", (x, -0.472, 0.5), 0.047, 0.028, smoky_glass, 24, rot=(math.pi / 2, 0, 0), bevel=0.006)
        cube(f"route_img2_module_knob_grip_{n}", (x, -0.49, 0.5), (0.075, 0.014, 0.014), mats["brass"], 0.003)
        cyl(f"route_img2_module_pointer_{n}", (x, -0.494, 0.56), 0.012, 0.014, cyan_lens, 12, rot=(math.pi / 2, 0, 0), bevel=0.002)
        route_switch_uv_panel(
            f"route_img2_module_empty_badge_{n}",
            (x, -0.492, 0.3),
            (0.13, 0.13),
            "empty_badge_bezel" if index % 2 == 0 else "empty_badge_bezel_alt",
            route_img_lit,
        )
        cyl(f"route_img2_module_badge_depth_{n}", (x, -0.47, 0.3), 0.054, 0.034, mats["screen_dead"], 22, rot=(math.pi / 2, 0, 0), bevel=0.004)
        cyl(f"route_img2_floor_cable_{n}", (x, 0.27, 0.15), 0.028, 0.34, mats["trim"], 12, rot=(math.pi / 2, 0, 0), bevel=0.004)
        cyl(f"route_img2_floor_port_{n}", (x, 0.42, 0.05), 0.045, 0.05, mats["trim"], 16, bevel=0.005)

    # Side rails and cyan service lights echo the 2D rack ends.
    for sx, side in ((-0.59, "l"), (0.59, "r")):
        cube(f"route_img2_side_rail_block_{side}", (sx, -0.39, 0.4), (0.075, 0.06, 0.44), mats["trim"], 0.012)
        route_switch_uv_panel(f"route_img2_side_rail_image2_{side}", (sx, -0.426, 0.4), (0.072, 0.38), "vertical_side_rail_cyan", route_img_lit)
        cyl(f"route_img2_side_bolt_top_{side}", (sx, -0.462, 0.59), 0.018, 0.02, mats["brass"], 10, rot=(math.pi / 2, 0, 0), bevel=0.002)
        cyl(f"route_img2_side_bolt_bottom_{side}", (sx, -0.462, 0.21), 0.018, 0.02, mats["brass"], 10, rot=(math.pi / 2, 0, 0), bevel=0.002)

    # Front/bottom real rails, trim, screws, and feet.
    route_switch_uv_panel("route_img2_lower_long_trim_image2", (0, -0.405, 0.155), (0.78, 0.07), "lower_long_trim", route_img)
    route_switch_uv_panel("route_img2_copper_bus_image2", (0, -0.424, 0.08), (0.86, 0.045), "copper_bus_long", route_img)
    region_inlay("route_img2_warning_tick_strip", (0, -0.456, 0.205), (0.7, 0.035), "microticks.horizontal", parts_flat)
    corner_screws("route_img2", (-0.52, 0.52), (0.17, 0.58), -0.455, parts_flat)
    rubber_feet("route_img2", (-0.48, 0.48), 0.0, 0.05, mats["rubber"])


def build_orb_pedestal():
    """Polished sealed color-lens orb on a brass pedestal (no block placeholders)."""
    mats = common_materials()
    lens = make_mat("orb_sealed_lens", (0.12, 0.5, 0.85, 1.0), (0.28, 0.7, 1.0), 0.9)
    cyl("orb_base", (0, 0, 0.06), 0.26, 0.12, mats["trim"], 32, bevel=0.012)
    cyl("orb_collar", (0, 0, 0.16), 0.12, 0.1, mats["brass"], 24, bevel=0.008)
    cyl("orb_stem", (0, 0, 0.42), 0.05, 0.46, mats["brass"], 18)
    cyl("orb_cradle", (0, 0, 0.7), 0.16, 0.06, mats["brass"], 24, bevel=0.01)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.2, location=(0, 0, 0.9), segments=32, ring_count=16)
    orb = bpy.context.object
    orb.name = "orb_lens"
    orb.data.materials.append(lens)
    bpy.ops.object.shade_smooth()


def main() -> None:
    builds = {
        "puzzle_console_color_sequence": build_color_sequence,
        "puzzle_console_circuit_grid": build_circuit_grid,
        "puzzle_console_surveillance_match": build_surveillance_match,
        "puzzle_console_valve_matrix": build_valve_matrix,
        "puzzle_console_archive_merge": build_archive_merge,
        "puzzle_console_gallery_reading": build_gallery_reading,
        "builder_route_switch_console": build_route_switch_console,
        "puzzle_orb_pedestal": build_orb_pedestal,
    }
    # Optional filter: model keys passed after `--` on the Blender CLI build only
    # those machines, so a focused asset pass does not rewrite siblings owned
    # elsewhere.
    import sys

    argv = sys.argv
    only = argv[argv.index("--") + 1 :] if "--" in argv else []
    for model_key, builder in builds.items():
        if only and model_key not in only:
            continue
        clear_scene()
        builder()
        export_glb(model_key)
        print(f"wrote {OUT_DIR / ('hp_' + model_key + '.glb')}")


if __name__ == "__main__":
    main()
