"""Generate the Level 01 Maintenance Bay furniture Image2 pack.

Self-contained, merge-safe asset-pack candidate. This script:
  1. Procedurally bakes Image2 source PNGs (one per material part) that match the
     Level 01 board: white enamel metal, brushed steel, black rubber, cyan
     diagnostics, tiny amber hazard marks.
  2. Packs them into ONE atlas PNG + `.regions.json` ([x, y, w, h] + atlas size).
  3. Builds 10 furniture GLBs whose real geometry faces carry small atlas-region
     inlays (screws, vents, cyan lenses, hazard strips, diagnostic glass) through
     proper material texture slots — never a single front poster.
  4. Measures honest bounds per GLB and writes the asset-pack manifest.
  5. Re-imports the cooked GLBs and renders a contact sheet for evidence.

Run:
  /Applications/Blender.app/Contents/MacOS/Blender --background \
    --python scripts/asset-build/generate-level01-furniture-image2-assets.py

Scope: Level 01 isolated paths only. Does NOT touch shared catalog/registry files.
"""

import json
import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

# ---------------------------------------------------------------------------
# Paths (Level 01 isolated)
# ---------------------------------------------------------------------------
ROOT = Path(__file__).resolve().parents[2]  # scripts/asset-build/<file> -> repo root
TEX_DIR = ROOT / "src/assets/textures/environment/level01-furniture-image2"
SRC_DIR = TEX_DIR / "image2-sources"
MODEL_DIR = ROOT / "src/assets/models-cooked/environment/level01-furniture-image2"
MANIFEST_PATH = ROOT / "src/assets/manifests/builder/hp_level01_furniture_image2_v1.json"
EVIDENCE_DIR = ROOT / ".tmp/level01-furniture-image2"
ATLAS_PNG = TEX_DIR / "hp_level01_furniture_image2_atlas.png"
ATLAS_REGIONS = TEX_DIR / "hp_level01_furniture_image2_atlas.regions.json"

for directory in (TEX_DIR, SRC_DIR, MODEL_DIR, EVIDENCE_DIR, MANIFEST_PATH.parent):
    directory.mkdir(parents=True, exist_ok=True)

ATLAS_SIZE = 512

# Image-space rects [x, y, w, h], top-left origin. Non-overlapping inside 512².
# Kept small + inlay-only so the embedded atlas stays well under the 2MB
# "full-decal" hard-fail; detail regions are sampled as small proud inlays.
REGIONS = {
    "enamel.panel": [0, 0, 256, 256],
    "brushed.steel.strip": [256, 0, 256, 80],
    "diagnostic.screen.glass": [256, 80, 256, 112],
    "cyan.glass.lens": [256, 192, 128, 128],
    "hazard.edge.strip": [384, 192, 128, 64],
    "vent.grille": [384, 256, 128, 128],
    "rubber.gasket": [256, 320, 128, 128],
    "screw.cross": [0, 256, 64, 64],
    "edge.wear": [64, 256, 192, 64],
    "grime.corner": [0, 320, 256, 128],
}

# ---------------------------------------------------------------------------
# Procedural noise helpers (deterministic)
# ---------------------------------------------------------------------------


def _hash_noise(shape, seed):
    yy, xx = np.meshgrid(
        np.arange(shape[0], dtype=np.float64),
        np.arange(shape[1], dtype=np.float64),
        indexing="ij",
    )
    val = np.sin(xx * 12.9898 + yy * 78.233 + seed * 37.719) * 43758.5453
    return val - np.floor(val)


def _value_noise(shape, cells, seed):
    """Smooth value noise by bilinearly upsampling a small random grid."""
    h, w = shape
    gy, gx = cells, cells
    rng = _hash_noise((gy + 1, gx + 1), seed)
    fy = np.linspace(0, gy, h, endpoint=False)
    fx = np.linspace(0, gx, w, endpoint=False)
    y0 = np.floor(fy).astype(int)
    x0 = np.floor(fx).astype(int)
    ty = (fy - y0)[:, None]
    tx = (fx - x0)[None, :]
    ty = ty * ty * (3 - 2 * ty)
    tx = tx * tx * (3 - 2 * tx)
    c00 = rng[np.ix_(y0, x0)]
    c10 = rng[np.ix_(y0 + 1, x0)]
    c01 = rng[np.ix_(y0, x0 + 1)]
    c11 = rng[np.ix_(y0 + 1, x0 + 1)]
    top = c00 * (1 - tx) + c01 * tx
    bot = c10 * (1 - tx) + c11 * tx
    return top * (1 - ty) + bot * ty


def _uv(shape):
    h, w = shape
    v, u = np.meshgrid(np.linspace(0, 1, h), np.linspace(0, 1, w), indexing="ij")
    return u, v


def _solid(shape, rgb):
    h, w = shape
    img = np.empty((h, w, 4), dtype=np.float64)
    img[..., 0] = rgb[0]
    img[..., 1] = rgb[1]
    img[..., 2] = rgb[2]
    img[..., 3] = 1.0
    return img


# ---------------------------------------------------------------------------
# Per-region texture bakers (top-down orientation, RGBA float 0..1)
# ---------------------------------------------------------------------------


def bake_enamel_panel(shape):
    img = _solid(shape, (0.82, 0.83, 0.81))
    speck = (_value_noise(shape, 48, 11) - 0.5) * 0.05
    grime = _value_noise(shape, 6, 12) * 0.06
    for c in range(3):
        img[..., c] += speck - grime
    u, v = _uv(shape)
    # faint recessed panel seams
    seam = (np.abs((u * 3) % 1 - 0.5) < 0.01) | (np.abs((v * 3) % 1 - 0.5) < 0.01)
    for c in range(3):
        img[..., c] = np.where(seam, img[..., c] * 0.72, img[..., c])
    return np.clip(img, 0, 1)


def bake_brushed_steel(shape):
    img = _solid(shape, (0.55, 0.57, 0.6))
    h, w = shape
    brush = np.sin(np.linspace(0, 60, w))[None, :] * 0.04
    fine = (_hash_noise(shape, 21) - 0.5) * 0.05
    streak = (_value_noise(shape, (3, 64) if False else 64, 22) - 0.5) * 0.08
    for c in range(3):
        img[..., c] += brush + fine + streak
    return np.clip(img, 0, 1)


def bake_diagnostic_screen(shape):
    img = _solid(shape, (0.04, 0.09, 0.11))
    u, v = _uv(shape)
    glow = np.exp(-(((u - 0.5) * 1.6) ** 2 + ((v - 0.5) * 1.6) ** 2)) * 0.35
    scan = (np.sin(v * shape[0] * 0.5) * 0.5 + 0.5) * 0.06
    grid = ((np.abs((u * 16) % 1 - 0.5) < 0.04) | (np.abs((v * 9) % 1 - 0.5) < 0.04)).astype(float) * 0.08
    img[..., 0] += glow * 0.15
    img[..., 1] += glow + scan + grid
    img[..., 2] += glow * 1.1 + scan + grid
    # a couple of brighter readout bars (no readable text)
    for cy in (0.32, 0.5, 0.68):
        bar = (np.abs(v - cy) < 0.018) & (u > 0.14) & (u < 0.5)
        img[..., 1][bar] += 0.4
        img[..., 2][bar] += 0.45
    return np.clip(img, 0, 1)


def bake_cyan_lens(shape):
    img = _solid(shape, (0.06, 0.5, 0.62))
    u, v = _uv(shape)
    r = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2)
    core = np.clip(1 - r * 2.1, 0, 1)
    img[..., 0] += core * 0.15
    img[..., 1] += core * 0.42
    img[..., 2] += core * 0.5
    ring = (np.abs(r - 0.42) < 0.03).astype(float) * 0.3
    img[..., 1] += ring
    img[..., 2] += ring
    glare = np.exp(-(((u - 0.38) * 6) ** 2 + ((v - 0.36) * 6) ** 2)) * 0.5
    for c in range(3):
        img[..., c] += glare
    return np.clip(img, 0, 1)


def bake_rubber_gasket(shape):
    img = _solid(shape, (0.05, 0.055, 0.06))
    speck = (_value_noise(shape, 40, 31) - 0.5) * 0.04
    for c in range(3):
        img[..., c] += speck
    u, v = _uv(shape)
    ribs = (np.sin(u * 36) * 0.5 + 0.5) ** 4 * 0.05
    for c in range(3):
        img[..., c] += ribs
    return np.clip(img, 0, 1)


def bake_hazard_strip(shape):
    img = _solid(shape, (0.08, 0.075, 0.07))
    u, v = _uv(shape)
    diag = ((u * 5 + v) % 1) < 0.5
    amber = np.array([0.85, 0.5, 0.07])
    dark = np.array([0.07, 0.065, 0.06])
    wear = _value_noise(shape, 20, 41) * 0.25
    for c in range(3):
        base = np.where(diag, amber[c], dark[c])
        img[..., c] = base - wear * (base > 0.3)
    return np.clip(img, 0, 1)


def bake_screw_cross(shape):
    img = bake_brushed_steel(shape)
    img *= 0.85
    img[..., 3] = 1.0
    u, v = _uv(shape)
    r = np.sqrt((u - 0.5) ** 2 + (v - 0.5) ** 2)
    head = r < 0.36
    rim = (np.abs(r - 0.36) < 0.03)
    for c in range(3):
        img[..., c] = np.where(head, img[..., c] * 1.15, img[..., c])
        img[..., c] = np.where(rim, img[..., c] * 0.5, img[..., c])
    cross = (((np.abs(u - 0.5) < 0.04) | (np.abs(v - 0.5) < 0.04)) & head)
    for c in range(3):
        img[..., c] = np.where(cross, img[..., c] * 0.35, img[..., c])
    return np.clip(img, 0, 1)


def bake_vent_grille(shape):
    img = _solid(shape, (0.3, 0.32, 0.34))
    u, v = _uv(shape)
    slats = (np.sin(v * 26) * 0.5 + 0.5)
    slot = (slats < 0.4)
    for c in range(3):
        img[..., c] = np.where(slot, img[..., c] * 0.18, img[..., c] * 1.05)
    edge = (u < 0.06) | (u > 0.94)
    for c in range(3):
        img[..., c] = np.where(edge, img[..., c] * 0.6, img[..., c])
    return np.clip(img, 0, 1)


def bake_grime_corner(shape):
    img = _solid(shape, (0.6, 0.61, 0.59))
    u, v = _uv(shape)
    grime = _value_noise(shape, 5, 52)
    corner = np.clip(1 - np.sqrt(((u) * 1.4) ** 2 + ((v) * 1.4) ** 2), 0, 1)
    corner += np.clip(1 - np.sqrt(((1 - u) * 1.6) ** 2 + ((1 - v) * 1.6) ** 2), 0, 1)
    dirt = np.clip(corner * 0.6 + grime * 0.3, 0, 1)
    for c in range(3):
        img[..., c] -= dirt * 0.4
    return np.clip(img, 0, 1)


def bake_edge_wear(shape):
    img = _solid(shape, (0.5, 0.51, 0.52))
    u, v = _uv(shape)
    scr = _hash_noise(shape, 61)
    scratch = ((scr > 0.985) & (np.abs(np.sin((u + v) * 80)) > 0.6)).astype(float)
    chip = (_value_noise(shape, 24, 62) > 0.78).astype(float)
    for c in range(3):
        img[..., c] += scratch * 0.4 - chip * 0.25
    return np.clip(img, 0, 1)


BAKERS = {
    "enamel.panel": bake_enamel_panel,
    "brushed.steel.strip": bake_brushed_steel,
    "diagnostic.screen.glass": bake_diagnostic_screen,
    "cyan.glass.lens": bake_cyan_lens,
    "rubber.gasket": bake_rubber_gasket,
    "hazard.edge.strip": bake_hazard_strip,
    "screw.cross": bake_screw_cross,
    "vent.grille": bake_vent_grille,
    "grime.corner": bake_grime_corner,
    "edge.wear": bake_edge_wear,
}


def _save_png(array_top_down, path, name):
    """Save an HxWx4 top-down float array to PNG via a bpy image (bottom-up)."""
    h, w, _ = array_top_down.shape
    flipped = np.flipud(array_top_down).astype(np.float32)
    image = bpy.data.images.new(name, width=w, height=h, alpha=True, float_buffer=False)
    image.pixels.foreach_set(flipped.reshape(-1))
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def build_atlas():
    """Bake source PNGs + packed atlas + regions JSON. Returns the loaded atlas image."""
    atlas = np.zeros((ATLAS_SIZE, ATLAS_SIZE, 4), dtype=np.float64)
    atlas[..., 3] = 1.0
    region_meta = {}
    for region_id, (x, y, w, h) in REGIONS.items():
        tile = BAKERS[region_id]((h, w))
        slug = region_id.replace(".", "_")
        _save_png(tile, SRC_DIR / f"{slug}.png", f"l1src_{slug}")
        atlas[y : y + h, x : x + w, :] = tile
        region_meta[region_id] = [x, y, w, h]

    _save_png(atlas, ATLAS_PNG, "l1_atlas")
    ATLAS_REGIONS.write_text(
        json.dumps(
            {
                "atlas": ATLAS_PNG.name,
                "atlasSize": [ATLAS_SIZE, ATLAS_SIZE],
                "uvOrigin": "top-left",
                "regions": region_meta,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    img = bpy.data.images.load(str(ATLAS_PNG))
    img.name = "hp_level01_furniture_image2_atlas"
    return img


def uv_rect_from_region(region_id, padding_px=1.0):
    """Normalized (u0, v0, u1, v1) for a region, with Blender Y flip + padding."""
    x, y, w, h = REGIONS[region_id]
    u0 = (x + padding_px) / ATLAS_SIZE
    u1 = (x + w - padding_px) / ATLAS_SIZE
    # image-space y is top-down; Blender UV v=0 is bottom -> flip.
    v0 = 1.0 - (y + h - padding_px) / ATLAS_SIZE
    v1 = 1.0 - (y + padding_px) / ATLAS_SIZE
    return (u0, v0, u1, v1)


# ---------------------------------------------------------------------------
# Material + mesh helpers
# ---------------------------------------------------------------------------
ATLAS_IMG = None


def bsdf_input(bsdf, identifier):
    for socket in bsdf.inputs:
        if socket.identifier == identifier or socket.name == identifier:
            return socket
    raise KeyError(identifier)


def _mat(name, color, metallic=0.0, roughness=0.55, emission=None, strength=0.0, alpha=1.0, region=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    nodes = material.node_tree.nodes
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    bsdf_input(bsdf, "Base Color").default_value = color
    bsdf_input(bsdf, "Metallic").default_value = metallic
    bsdf_input(bsdf, "Roughness").default_value = roughness
    bsdf_input(bsdf, "Alpha").default_value = alpha
    if region is not None:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = ATLAS_IMG
        tex.extension = "CLIP"
        material.node_tree.links.new(tex.outputs["Color"], bsdf_input(bsdf, "Base Color"))
        material["hp_atlas_region"] = region
    if emission is not None:
        bsdf_input(bsdf, "Emission Color").default_value = emission
        bsdf_input(bsdf, "Emission Strength").default_value = strength
    if alpha < 1.0:
        try:
            material.blend_method = "BLEND"
        except (AttributeError, TypeError):
            pass
    return material


def make_materials():
    """Fresh per-asset material set. Atlas-backed parts carry hp_atlas_region."""
    return {
        # solid PBR bodies
        "enamel": _mat("l1_white_enamel_atlas", (0.82, 0.83, 0.81, 1), 0.18, 0.42, region="enamel.panel"),
        "steel": _mat("l1_brushed_steel_atlas", (0.55, 0.57, 0.6, 1), 0.85, 0.32, region="brushed.steel.strip"),
        "steel_solid": _mat("l1_brushed_steel_solid", (0.5, 0.52, 0.55, 1), 0.8, 0.34),
        "rubber": _mat("l1_black_rubber_atlas", (0.05, 0.055, 0.06, 1), 0.1, 0.78, region="rubber.gasket"),
        "rubber_solid": _mat("l1_black_rubber_solid", (0.045, 0.05, 0.055, 1), 0.05, 0.82),
        "dark": _mat("l1_dark_recess_solid", (0.07, 0.08, 0.09, 1), 0.35, 0.5),
        # atlas detail inlays
        "screw": _mat("l1_screw_cross_atlas", (0.6, 0.62, 0.65, 1), 0.85, 0.3, region="screw.cross"),
        "vent": _mat("l1_vent_grille_atlas", (0.3, 0.32, 0.34, 1), 0.6, 0.45, region="vent.grille"),
        "hazard": _mat("l1_hazard_edge_atlas", (0.6, 0.4, 0.1, 1), 0.3, 0.5, region="hazard.edge.strip"),
        "grime": _mat("l1_grime_corner_atlas", (0.55, 0.56, 0.55, 1), 0.2, 0.6, region="grime.corner"),
        "wear": _mat("l1_edge_wear_atlas", (0.5, 0.51, 0.52, 1), 0.6, 0.4, region="edge.wear"),
        # emissive atlas instruments
        "cyan": _mat(
            "l1_cyan_lens_atlas",
            (0.18, 0.85, 0.95, 1),
            0.0,
            0.18,
            emission=(0.2, 0.9, 1.0, 1),
            strength=2.4,
            region="cyan.glass.lens",
        ),
        "screen": _mat(
            "l1_diagnostic_screen_atlas",
            (0.1, 0.4, 0.46, 1),
            0.0,
            0.16,
            emission=(0.12, 0.7, 0.85, 1),
            strength=1.4,
            region="diagnostic.screen.glass",
        ),
        # tiny amber hazard emissive (no atlas)
        "amber": _mat("l1_amber_fault_glow", (0.95, 0.62, 0.18, 1), 0.0, 0.3, emission=(1.0, 0.55, 0.12, 1), strength=1.6),
    }


def _map_uvs(obj, region):
    """Map every face fully onto the region rect (full motif per face)."""
    rect = uv_rect_from_region(region)
    u0, v0, u1, v1 = rect
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name="atlas")
    uvl = me.uv_layers.active.data
    corners = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
    for poly in me.polygons:
        for index, loop_index in enumerate(poly.loop_indices):
            uvl[loop_index].uv = corners[index % 4]


def _finish(obj, material, bevel):
    if material is not None:
        obj.data.materials.append(material)
        region = material.get("hp_atlas_region")
        if region:
            _map_uvs(obj, region)
    if bevel > 0:
        mod = obj.modifiers.new(name="hp_bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.affect = "EDGES"
        obj.modifiers.new(name="hp_weighted_normals", type="WEIGHTED_NORMAL")


def cube(name, loc, scale, material, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _finish(obj, material, bevel)
    if parent:
        obj.parent = parent
    return obj


def cyl(name, loc, radius, depth, material, parent=None, verts=24, rotation=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    _finish(obj, material, bevel)
    if parent:
        obj.parent = parent
    return obj


def lens_socket(name, loc, radius, mats, parent, glow="cyan", rotation=(math.pi / 2, 0, 0)):
    """Bezel ring + emissive atlas glass core (not a flat colored disc)."""
    cyl(f"{name}_bezel", loc, radius, radius * 0.5, mats["steel"], parent, 20, rotation, bevel=radius * 0.08)
    inner = (loc[0], loc[1] - 0.012 if rotation == (math.pi / 2, 0, 0) else loc[1], loc[2])
    # push glass slightly proud on the facing normal (-Y default front)
    gloc = list(loc)
    gloc[1] -= 0.014
    cyl(f"{name}_glass", tuple(gloc), radius * 0.74, radius * 0.32, mats[glow], parent, 20, rotation)


def root_node(name):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    return root


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def measure_bounds(root):
    """World-space bounds across evaluated child meshes -> (width=x, height=z, depth=y)."""
    deps = bpy.context.evaluated_depsgraph_get()
    mins = [math.inf] * 3
    maxs = [-math.inf] * 3
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not (obj == root or obj.parent == root):
            continue
        ev = obj.evaluated_get(deps)
        mesh = ev.to_mesh()
        for vert in mesh.vertices:
            world = ev.matrix_world @ vert.co
            for axis in range(3):
                mins[axis] = min(mins[axis], world[axis])
                maxs[axis] = max(maxs[axis], world[axis])
        ev.to_mesh_clear()
    size = [round(maxs[axis] - mins[axis], 3) for axis in range(3)]
    return [size[0], size[2], size[1]], round(mins[2], 4)  # [w,h,d], floor z


def ground_root(root, mode="floor"):
    """Bake Z-grounding + full world transform into mesh vertex data.

    mode="floor"  : shift so minimum world Z across all children becomes 0.
    mode="ceiling": shift so maximum world Z becomes 0 (fixture hangs into -Z,
                    which is -Y in Y-up GLB — correct for a ceiling-mounted lamp).

    Strategy:
    1. Evaluate the world-space Z extent of all child meshes (using depsgraph,
       which respects object locations AND rotations).
    2. Compute the shift needed to bring min (floor) or max (ceiling) to 0.
    3. Apply ALL transforms (location, rotation, scale) to every child mesh so
       that the GLB POSITION accessor stores true world-space coordinates.
       This eliminates node rotations and translations from the GLB node entries,
       so the audit script can read accessor min/max directly as world bounds.

    After this call the child objects have location/rotation/scale = identity and
    the mesh vertex data is in world space. The root Empty stays at origin.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    zvals = []
    child_meshes = []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if obj == root or obj.parent == root:
            ev = obj.evaluated_get(deps)
            mesh = ev.to_mesh()
            for vert in mesh.vertices:
                world = ev.matrix_world @ vert.co
                zvals.append(world[2])
            ev.to_mesh_clear()
            child_meshes.append(obj)

    if not zvals:
        return

    if mode == "floor":
        shift = -min(zvals)
    else:  # ceiling
        shift = -max(zvals)

    # Apply shift to each object's Z location (world Z = Blender Z).
    for obj in child_meshes:
        obj.location.z += shift

    # Apply ALL transforms (loc + rot + scale) to bake world matrix into vertex data.
    # This ensures the GLB accessor min/max directly reflects world-space bounds.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in child_meshes:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def export_glb(root, model_key):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj == root or obj.parent == root:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    path = MODEL_DIR / f"{model_key}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    return path


# ---------------------------------------------------------------------------
# Furniture builders (named parts, bevels, atlas inlays, grounded pivot)
# ---------------------------------------------------------------------------


def build_repair_workbench(key, mats):
    root = root_node(key)
    w, d = 2.0, 0.9
    cube("contact_shadow_plinth", (0, 0, 0.04), (w * 0.98, d * 0.98, 0.08), mats["dark"], root, 0.02)
    # legs
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl("steel_leg", (sx * w * 0.42, sy * d * 0.36, 0.36), 0.04, 0.72, mats["steel"], root, 16, bevel=0.01)
    cube("enamel_under_cabinet", (w * 0.28, 0, 0.36), (w * 0.4, d * 0.9, 0.62), mats["enamel"], root, 0.02)
    cube("worktop_steel_slab", (0, 0, 0.74), (w, d, 0.06), mats["steel"], root, 0.012)
    cube("worktop_rubber_mat", (-w * 0.18, 0, 0.78), (w * 0.42, d * 0.66, 0.02), mats["rubber"], root, 0.006)
    cube("rear_diagnostic_riser", (0, d * 0.4, 1.0), (w * 0.96, 0.06, 0.5), mats["enamel"], root, 0.02)
    cube("rear_diagnostic_screen", (-w * 0.18, d * 0.36, 1.04), (w * 0.5, 0.02, 0.34), mats["screen"], root, 0.01)
    cube("vent_grille_panel", (w * 0.32, d * 0.36, 1.0), (w * 0.22, 0.02, 0.3), mats["vent"], root, 0.008)
    # articulated inspection arm
    cube("arm_pivot_base", (w * 0.3, -d * 0.1, 0.82), (0.12, 0.12, 0.1), mats["steel"], root, 0.01)
    cyl("arm_lower", (w * 0.3, -d * 0.02, 1.0), 0.025, 0.4, mats["steel_solid"], root, 12, bevel=0.006)
    cyl("arm_upper", (w * 0.16, -d * 0.05, 1.18), 0.022, 0.34, mats["steel_solid"], root, 12, rotation=(0, math.pi / 2.4, 0), bevel=0.006)
    lens_socket("arm_inspection_lamp", (w * 0.02, -d * 0.05, 1.22), 0.06, mats, root, glow="cyan", rotation=(0, 0, 0))
    cube("front_drawer", (w * 0.28, -d * 0.46, 0.42), (w * 0.34, 0.04, 0.18), mats["enamel"], root, 0.01)
    cyl("drawer_pull", (w * 0.28, -d * 0.49, 0.42), 0.02, 0.16, mats["steel"], root, 10, rotation=(0, math.pi / 2, 0), bevel=0.004)
    cube("hazard_toe_strip", (0, -d * 0.49, 0.1), (w * 0.7, 0.02, 0.05), mats["hazard"], root, 0.004)
    cube("amber_fault_tick", (w * 0.42, -d * 0.49, 0.5), (0.04, 0.03, 0.04), mats["amber"], root, 0.004)
    for index, sx in enumerate((-0.46, 0.46)):
        cube(f"corner_screw_{index}", (sx * w, d * 0.36, 1.18), (0.05, 0.03, 0.05), mats["screw"], root, 0.004)
    return root


def build_parts_cabinet(key, mats):
    root = root_node(key)
    w, d, h = 1.2, 0.55, 1.6
    cube("contact_shadow_plinth", (0, 0, 0.05), (w * 0.98, d * 0.98, 0.1), mats["dark"], root, 0.02)
    cube("enamel_carcass", (0, 0, h * 0.5 + 0.1), (w, d, h), mats["enamel"], root, 0.025)
    cube("steel_face_frame", (0, -d * 0.5, h * 0.5 + 0.1), (w * 0.98, 0.04, h * 0.98), mats["steel"], root, 0.01)
    # grid of parts bins (dark recesses + cyan label edge)
    cols, rows = 4, 5
    for r in range(rows):
        for c in range(cols):
            bx = -w * 0.36 + (w * 0.72) * (c / (cols - 1))
            bz = 0.32 + (h * 0.78) * (r / (rows - 1))
            cube(f"bin_recess_{r}_{c}", (bx, -d * 0.52, bz), (w * 0.16, 0.05, h * 0.13), mats["dark"], root, 0.006)
            cube(f"bin_label_edge_{r}_{c}", (bx, -d * 0.55, bz - h * 0.06), (w * 0.13, 0.02, 0.012), mats["cyan"], root, 0.002)
    cube("top_cap_steel", (0, 0, h + 0.06), (w * 1.02, d * 1.02, 0.06), mats["steel"], root, 0.01)
    cube("side_vent_left", (-w * 0.52, 0, h * 0.5), (0.02, d * 0.6, h * 0.5), mats["vent"], root, 0.006)
    cube("hazard_toe_strip", (0, -d * 0.52, 0.14), (w * 0.8, 0.02, 0.05), mats["hazard"], root, 0.004)
    for index, sx in enumerate((-0.46, 0.46)):
        cube(f"top_screw_{index}", (sx * w, -d * 0.52, h * 0.02 + 1.5), (0.05, 0.03, 0.05), mats["screw"], root, 0.004)
    return root


def build_battery_cart(key, mats):
    root = root_node(key)
    w, d = 0.9, 0.66
    # 4 caster posts + wheels
    for index, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cyl(f"caster_post_{index}", (sx * w * 0.4, sy * d * 0.36, 0.12), 0.02, 0.16, mats["steel"], root, 10, bevel=0.004)
        cyl(f"caster_wheel_{index}", (sx * w * 0.4, sy * d * 0.36, 0.04), 0.045, 0.03, mats["rubber_solid"], root, 16, rotation=(math.pi / 2, 0, 0), bevel=0.006)
    cube("lower_shelf", (0, 0, 0.24), (w, d, 0.04), mats["steel"], root, 0.008)
    cube("upper_shelf", (0, 0, 0.62), (w, d, 0.04), mats["steel"], root, 0.008)
    for index, sx in enumerate((-1, 1)):
        cyl(f"corner_rail_{index}", (sx * w * 0.44, d * 0.4, 0.45), 0.018, 0.42, mats["steel_solid"], root, 10, bevel=0.004)
    cube("battery_block", (0, 0, 0.74), (w * 0.8, d * 0.7, 0.2), mats["enamel"], root, 0.02)
    cube("battery_vent", (0, -d * 0.36, 0.74), (w * 0.6, 0.02, 0.12), mats["vent"], root, 0.006)
    cube("battery_charge_screen", (-w * 0.18, -d * 0.36, 0.82), (w * 0.3, 0.02, 0.06), mats["screen"], root, 0.006)
    lens_socket("battery_status_lamp", (w * 0.28, -d * 0.37, 0.78), 0.04, mats, root, glow="cyan")
    cube("hazard_band", (0, d * 0.36, 0.74), (w * 0.8, 0.02, 0.06), mats["hazard"], root, 0.004)
    cube("push_handle", (0, d * 0.42, 0.9), (w * 0.7, 0.04, 0.04), mats["steel"], root, 0.01)
    cube("amber_fault_tick", (w * 0.34, -d * 0.37, 0.82), (0.035, 0.03, 0.035), mats["amber"], root, 0.004)
    return root


def build_diagnostic_locker(key, mats):
    root = root_node(key)
    w, d, h = 0.7, 0.6, 1.9
    cube("contact_shadow_plinth", (0, 0, 0.05), (w * 0.98, d * 0.98, 0.1), mats["dark"], root, 0.02)
    cube("enamel_body", (0, 0, h * 0.5 + 0.1), (w, d, h), mats["enamel"], root, 0.025)
    cube("steel_door", (0, -d * 0.5, h * 0.52 + 0.1), (w * 0.86, 0.05, h * 0.86), mats["steel"], root, 0.012)
    cube("door_vent_top", (0, -d * 0.53, h * 0.86), (w * 0.6, 0.02, h * 0.16), mats["vent"], root, 0.006)
    cube("door_diagnostic_screen", (0, -d * 0.53, h * 0.58), (w * 0.5, 0.02, h * 0.26), mats["screen"], root, 0.01)
    lens_socket("door_ready_lamp", (w * 0.28, -d * 0.53, h * 0.82), 0.035, mats, root, glow="cyan")
    cube("rubber_door_gasket", (0, -d * 0.49, h * 0.52 + 0.1), (w * 0.9, 0.02, h * 0.9), mats["rubber"], root, 0.004)
    cyl("door_handle", (-w * 0.34, -d * 0.55, h * 0.52 + 0.1), 0.02, h * 0.3, mats["steel"], root, 10, bevel=0.004)
    cube("hazard_toe_strip", (0, -d * 0.52, 0.14), (w * 0.7, 0.02, 0.05), mats["hazard"], root, 0.004)
    cube("amber_fault_tick", (-w * 0.3, -d * 0.53, h * 0.9), (0.03, 0.03, 0.04), mats["amber"], root, 0.004)
    for index, sx in enumerate((-0.42, 0.42)):
        cube(f"hinge_screw_{index}", (sx * w, -d * 0.5, h * 0.9), (0.045, 0.04, 0.045), mats["screw"], root, 0.004)
    return root


def build_folded_gurney(key, mats):
    root = root_node(key)
    w, d = 2.0, 0.78
    for index, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cyl(f"gurney_leg_{index}", (sx * w * 0.42, sy * d * 0.34, 0.3), 0.025, 0.5, mats["steel"], root, 12, bevel=0.006)
        cyl(f"gurney_wheel_{index}", (sx * w * 0.42, sy * d * 0.34, 0.06), 0.06, 0.04, mats["rubber_solid"], root, 18, rotation=(math.pi / 2, 0, 0), bevel=0.008)
    cube("steel_under_frame", (0, 0, 0.58), (w, d * 0.9, 0.06), mats["steel"], root, 0.01)
    cube("folded_mattress_lower", (0, 0, 0.66), (w * 0.94, d * 0.86, 0.08), mats["rubber"], root, 0.01)
    cube("folded_mattress_upper", (w * 0.2, 0, 0.86), (w * 0.5, d * 0.86, 0.08), mats["rubber"], root, 0.01)
    cube("hinge_block", (-w * 0.06, 0, 0.74), (0.08, d * 0.86, 0.06), mats["steel_solid"], root, 0.006)
    for index, sx in enumerate((-1, 1)):
        cyl(f"side_rail_{index}", (-w * 0.34 + sx * 0.02, sx * d * 0.46, 0.84), 0.016, w * 0.5, mats["steel"], root, 10, rotation=(0, math.pi / 2, 0), bevel=0.003)
    cube("foot_diagnostic_panel", (-w * 0.42, 0, 0.72), (0.04, d * 0.5, 0.16), mats["screen"], root, 0.008)
    lens_socket("gurney_status_lamp", (-w * 0.44, -d * 0.2, 0.72), 0.035, mats, root, glow="cyan", rotation=(0, math.pi / 2, 0))
    cube("hazard_foot_strip", (w * 0.42, 0, 0.6), (0.03, d * 0.7, 0.04), mats["hazard"], root, 0.004)
    cube("amber_fault_tick", (-w * 0.44, d * 0.2, 0.74), (0.035, 0.035, 0.035), mats["amber"], root, 0.004)
    return root


def build_service_stool(key, mats):
    root = root_node(key)
    # 5-star caster base
    for index in range(5):
        angle = index / 5 * math.tau
        ex, ey = math.cos(angle), math.sin(angle)
        cube(f"base_spoke_{index}", (ex * 0.16, ey * 0.16, 0.08), (0.28, 0.05, 0.04), mats["steel"], root, 0.006)
        # orient spoke outward
        spoke = bpy.context.scene.objects.get(f"base_spoke_{index}")
        cyl(f"base_caster_{index}", (ex * 0.26, ey * 0.26, 0.04), 0.035, 0.03, mats["rubber_solid"], root, 14, rotation=(math.pi / 2, 0, 0), bevel=0.005)
    cyl("gas_column", (0, 0, 0.34), 0.035, 0.46, mats["steel"], root, 18, bevel=0.008)
    cyl("column_collar", (0, 0, 0.5), 0.05, 0.05, mats["rubber"], root, 16, bevel=0.006)
    cyl("seat_pad", (0, 0, 0.58), 0.2, 0.06, mats["rubber"], root, 28, bevel=0.02)
    cyl("seat_underplate", (0, 0, 0.54), 0.18, 0.03, mats["steel"], root, 24, bevel=0.006)
    cube("amber_height_tick", (0, -0.05, 0.5), (0.03, 0.03, 0.03), mats["amber"], root, 0.003)
    return root


def build_utility_crate(key, mats):
    root = root_node(key)
    w, d, h = 0.8, 0.72, 0.7
    cube("crate_body", (0, 0, h * 0.5), (w, d, h), mats["enamel"], root, 0.02)
    # corner steel braces
    for index, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cube(f"corner_brace_v_{index}", (sx * w * 0.48, sy * d * 0.48, h * 0.5), (0.05, 0.05, h), mats["steel"], root, 0.006)
    cube("lid_steel", (0, 0, h + 0.04), (w * 1.02, d * 1.02, 0.08), mats["steel"], root, 0.012)
    cube("lid_vent", (0, 0, h + 0.08), (w * 0.5, d * 0.5, 0.02), mats["vent"], root, 0.006)
    cube("front_diagnostic_screen", (0, -d * 0.51, h * 0.6), (w * 0.4, 0.02, h * 0.22), mats["screen"], root, 0.008)
    lens_socket("crate_lamp", (w * 0.3, -d * 0.52, h * 0.6), 0.035, mats, root, glow="cyan")
    cube("hazard_band_front", (0, -d * 0.51, h * 0.2), (w * 0.84, 0.02, 0.07), mats["hazard"], root, 0.004)
    cube("grime_corner_patch", (-w * 0.48, -d * 0.51, h * 0.85), (w * 0.2, 0.015, h * 0.2), mats["grime"], root, 0.004)
    for index, sx in enumerate((-1, 1)):
        cyl(f"side_handle_{index}", (sx * w * 0.51, 0, h * 0.62), 0.018, d * 0.4, mats["steel"], root, 10, rotation=(math.pi / 2, 0, 0), bevel=0.004)
    cube("amber_fault_tick", (w * 0.4, -d * 0.51, h * 0.82), (0.035, 0.02, 0.035), mats["amber"], root, 0.004)
    return root


def build_ceiling_service_light(key, mats):
    root = root_node(key)
    w, d = 0.9, 0.9
    cube("ceiling_mount_plate", (0, 0, 0.22), (w, d, 0.04), mats["steel"], root, 0.008)
    cube("enamel_housing", (0, 0, 0.14), (w * 0.98, d * 0.98, 0.16), mats["enamel"], root, 0.02)
    # inner bevelled reflector throat
    cube("steel_reflector", (0, 0, 0.1), (w * 0.84, d * 0.84, 0.1), mats["steel"], root, 0.02)
    cube("diffuser_glass_panel", (0, 0, 0.03), (w * 0.7, d * 0.7, 0.03), mats["cyan"], root, 0.012)
    # corner screws + hazard frame edges
    for index, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cube(f"mount_screw_{index}", (sx * w * 0.44, sy * d * 0.44, 0.2), (0.06, 0.06, 0.04), mats["screw"], root, 0.004)
    for index, sx in enumerate((-1, 1)):
        cube(f"hazard_edge_{index}", (sx * w * 0.48, 0, 0.12), (0.03, d * 0.84, 0.05), mats["hazard"], root, 0.003)
    cube("vent_slot", (0, d * 0.46, 0.16), (w * 0.5, 0.03, 0.05), mats["vent"], root, 0.004)
    cube("amber_power_tick", (w * 0.34, d * 0.46, 0.18), (0.04, 0.02, 0.03), mats["amber"], root, 0.003)
    return root


def build_sterile_tool_rack(key, mats):
    root = root_node(key)
    w, d, h = 1.06, 0.48, 1.72
    cube("tool_rack_shadow_plinth", (0, 0, 0.055), (w * 0.96, d * 0.94, 0.11), mats["dark"], root, 0.018)
    cube("tool_rack_rear_enamel_panel", (0, d * 0.2, h * 0.5 + 0.12), (w, 0.08, h), mats["enamel"], root, 0.024)
    cube("tool_rack_steel_face_frame", (0, -d * 0.28, h * 0.5 + 0.12), (w * 0.95, 0.06, h * 0.9), mats["steel"], root, 0.014)
    cube("tool_rack_rubber_inner_gasket", (0, -d * 0.315, h * 0.5 + 0.12), (w * 0.78, 0.025, h * 0.76), mats["rubber"], root, 0.008)
    # Four sterilized clamp rails: readable at first-person distance, not weapon-specific.
    for index, z in enumerate((0.52, 0.78, 1.04, 1.30)):
        cyl(f"tool_rack_horizontal_rail_{index}", (0, -d * 0.35, z), 0.022, w * 0.68, mats["steel_solid"], root, 14, rotation=(0, math.pi / 2, 0), bevel=0.005)
        for x in (-0.32, 0.32):
            cube(f"tool_rack_clamp_{index}_{'l' if x < 0 else 'r'}", (x, -d * 0.39, z), (0.08, 0.04, 0.11), mats["enamel"], root, 0.008)
    cube("tool_rack_scan_screen", (-w * 0.26, -d * 0.36, 1.54), (0.28, 0.02, 0.14), mats["screen"], root, 0.008)
    lens_socket("tool_rack_ready_lens", (w * 0.28, -d * 0.37, 1.53), 0.04, mats, root, glow="cyan")
    cube("tool_rack_bottom_hazard_strip", (0, -d * 0.36, 0.22), (w * 0.72, 0.02, 0.055), mats["hazard"], root, 0.004)
    cube("tool_rack_side_vent", (-w * 0.5, -0.02, 0.94), (0.02, 0.18, 0.54), mats["vent"], root, 0.006)
    for index, (sx, z) in enumerate(((-1, 1.62), (1, 1.62), (-1, 0.32), (1, 0.32))):
        cube(f"tool_rack_frame_screw_{index}", (sx * w * 0.42, -d * 0.37, z), (0.048, 0.03, 0.048), mats["screw"], root, 0.004)
    return root


def build_cable_reel_cart(key, mats):
    root = root_node(key)
    w, d = 1.08, 0.72
    cube("cable_cart_lower_tray", (0, 0, 0.18), (w, d, 0.08), mats["steel"], root, 0.012)
    cube("cable_cart_upper_guard", (0, 0, 0.78), (w * 0.92, d * 0.84, 0.05), mats["steel"], root, 0.01)
    for index, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cyl(f"cable_cart_post_{index}", (sx * w * 0.42, sy * d * 0.34, 0.48), 0.02, 0.62, mats["steel_solid"], root, 12, bevel=0.004)
        cyl(f"cable_cart_wheel_{index}", (sx * w * 0.42, sy * d * 0.34, 0.06), 0.055, 0.035, mats["rubber_solid"], root, 16, rotation=(math.pi / 2, 0, 0), bevel=0.006)
    # Reel core: layered cylinders create the visible coiled-cable stack.
    cyl("cable_reel_left_plate", (-0.36, 0, 0.52), 0.24, 0.055, mats["steel"], root, 28, rotation=(0, math.pi / 2, 0), bevel=0.005)
    cyl("cable_reel_right_plate", (0.36, 0, 0.52), 0.24, 0.055, mats["steel"], root, 28, rotation=(0, math.pi / 2, 0), bevel=0.005)
    for index, radius in enumerate((0.215, 0.18, 0.145, 0.11)):
        cyl(f"nested_black_cable_loop_{index}", (0, 0, 0.52), radius, 0.66 - index * 0.045, mats["rubber"], root, 32, rotation=(0, math.pi / 2, 0), bevel=0.003)
    cyl("reel_cyan_live_core", (0, 0, 0.52), 0.052, 0.76, mats["cyan"], root, 24, rotation=(0, math.pi / 2, 0), bevel=0.005)
    cube("cable_cart_front_screen", (-w * 0.24, -d * 0.39, 0.82), (0.34, 0.02, 0.1), mats["screen"], root, 0.006)
    cube("cable_cart_hazard_lip", (0, -d * 0.39, 0.24), (w * 0.74, 0.02, 0.045), mats["hazard"], root, 0.004)
    lens_socket("cable_cart_charge_lens", (w * 0.31, -d * 0.4, 0.82), 0.038, mats, root, glow="cyan")
    cyl("cable_cart_push_handle", (0, d * 0.45, 0.9), 0.022, w * 0.82, mats["steel"], root, 16, rotation=(0, math.pi / 2, 0), bevel=0.004)
    cube("cable_cart_amber_fault_tick", (w * 0.42, -d * 0.4, 0.71), (0.035, 0.025, 0.035), mats["amber"], root, 0.003)
    return root


BUILDERS = {
    "room_l1_img2_repair_workbench": build_repair_workbench,
    "room_l1_img2_parts_cabinet": build_parts_cabinet,
    "room_l1_img2_battery_cart": build_battery_cart,
    "room_l1_img2_diagnostic_locker": build_diagnostic_locker,
    "room_l1_img2_folded_gurney": build_folded_gurney,
    "room_l1_img2_service_stool": build_service_stool,
    "room_l1_img2_utility_crate": build_utility_crate,
    "room_l1_img2_ceiling_service_light": build_ceiling_service_light,
    "room_l1_img2_sterile_tool_rack": build_sterile_tool_rack,
    "room_l1_img2_cable_reel_cart": build_cable_reel_cart,
}

# Manifest metadata per model key.
META = {
    "room_l1_img2_repair_workbench": dict(label="维修台灯桌", family="desk", footprint="table", mount="floor", wall="none", solid=True, hold=True, clue=2, role="anchor"),
    "room_l1_img2_parts_cabinet": dict(label="零件档案柜", family="cabinet", footprint="cabinet", mount="floor", wall="back", solid=True, hold=False, clue=2, role="interactive"),
    "room_l1_img2_battery_cart": dict(label="供能推车", family="storage_crate", footprint="crate", mount="floor", wall="none", solid=True, hold=True, clue=0, role="filler"),
    "room_l1_img2_diagnostic_locker": dict(label="诊断储物柜", family="cabinet", footprint="cabinet", mount="floor", wall="back", solid=True, hold=False, clue=2, role="interactive"),
    "room_l1_img2_folded_gurney": dict(label="折叠维护床", family="bed_or_exam_table", footprint="bed", mount="floor", wall="none", solid=True, hold=False, clue=0, role="filler"),
    "room_l1_img2_service_stool": dict(label="值守矮凳", family="chair", footprint="chair", mount="floor", wall="none", solid=False, hold=False, clue=0, role="filler"),
    "room_l1_img2_utility_crate": dict(label="工具箱", family="storage_crate", footprint="crate", mount="floor", wall="none", solid=True, hold=True, clue=0, role="filler"),
    "room_l1_img2_ceiling_service_light": dict(label="顶部维修灯", family="wall_panel_or_picture_frame", footprint="lamp", mount="ceiling", wall="none", solid=False, hold=False, clue=0, role="filler"),
    "room_l1_img2_sterile_tool_rack": dict(label="工具消毒充电架", family="cabinet", footprint="cabinet", mount="floor", wall="back", solid=True, hold=False, clue=1, role="interactive"),
    "room_l1_img2_cable_reel_cart": dict(label="线缆卷盘推车", family="storage_crate", footprint="crate", mount="floor", wall="none", solid=True, hold=True, clue=0, role="filler"),
}


def build_manifest(rows):
    assets = []
    for model_key in BUILDERS:
        meta = META[model_key]
        size = rows[model_key]
        assets.append(
            {
                "modelKey": model_key,
                "label": meta["label"],
                "assetKind": "furniture",
                "family": meta["family"],
                "group": "维修",
                "source": "level01-image2-furniture",
                "sourceAssetId": f"hp_{model_key}_v1",
                "themeId": "hp_level01_maintenance_bay_image2",
                "glbFile": f"../../models-cooked/environment/level01-furniture-image2/{model_key}.glb",
                "sizeMeters": size,
                "solid": meta["solid"],
                "mount": meta["mount"],
                "wallPreferred": meta["wall"],
                "canHoldSmallProps": meta["hold"],
                "clueCapacity": meta["clue"],
                "footprintFamily": meta["footprint"],
                "tags": ["lane:maintenance_bay", f"role:{meta['role']}", "style:hp-level01-maintenance"],
            }
        )
    manifest = {
        "schemaVersion": "hp.builder.assetPack.v1",
        "packId": "hp_level01_furniture_image2_v1",
        "label": "HP 维护舱家具包 01 (Image2)",
        "sourceTool": "level01-image2-furniture",
        "generatedAt": "2026-06-13",
        "atlas": "src/assets/textures/environment/level01-furniture-image2/hp_level01_furniture_image2_atlas.png",
        "assets": assets,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def render_contact_sheet(model_keys):
    clear_scene()
    cols = 4
    rows = math.ceil(len(model_keys) / cols)
    spacing = 2.75
    for index, model_key in enumerate(model_keys):
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=str(MODEL_DIR / f"{model_key}.glb"))
        new = [obj for obj in bpy.context.scene.objects if obj not in before]
        col = index % cols
        row = index // cols
        x_offset = (col - (cols - 1) / 2) * spacing
        y_offset = ((rows - 1) / 2 - row) * spacing
        for obj in new:
            if obj.parent is None:
                obj.location.x += x_offset
                obj.location.y += y_offset

    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = engine
            break
        except (TypeError, ValueError):
            continue
    scene.render.resolution_x = 2400
    scene.render.resolution_y = 1700
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("l1_world")
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg is not None:
        bg.inputs[0].default_value = (0.055, 0.064, 0.07, 1)
        bg.inputs[1].default_value = 1.15
    scene.world = world

    cam_data = bpy.data.cameras.new("l1_cam")
    cam = bpy.data.objects.new("l1_cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (5.6, -8.8, 6.3)
    target = Vector((0, 0, 0.65))
    direction = target - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = 12.0
    scene.camera = cam

    sun_data = bpy.data.lights.new("l1_sun", type="SUN")
    sun_data.energy = 4.5
    sun = bpy.data.objects.new("l1_sun", sun_data)
    sun.rotation_euler = (math.radians(52), math.radians(12), math.radians(40))
    scene.collection.objects.link(sun)
    fill = bpy.data.lights.new("l1_fill", type="AREA")
    fill.energy = 620
    fill.size = 11
    fill_obj = bpy.data.objects.new("l1_fill", fill)
    fill_obj.location = (-3, 6, 4)
    scene.collection.objects.link(fill_obj)

    out = EVIDENCE_DIR / "level01-furniture-contact-sheet.png"
    scene.render.filepath = str(out)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    return out


def main():
    global ATLAS_IMG
    clear_scene()
    ATLAS_IMG = build_atlas()
    print(f"[atlas] wrote {ATLAS_PNG.relative_to(ROOT)} ({len(REGIONS)} regions)")

    # Ceiling fixtures need pivot at TOP so they hang down; all others are floor-grounded.
    CEILING_KEYS = {"room_l1_img2_ceiling_service_light"}

    rows = {}
    generated = []
    for model_key, builder in BUILDERS.items():
        clear_scene()
        mats = make_materials()
        root = builder(model_key, mats)
        # Ground the pivot before export
        if model_key in CEILING_KEYS:
            ground_root(root, mode="ceiling")
        else:
            ground_root(root, mode="floor")
        size, floor_z = measure_bounds(root)
        path = export_glb(root, model_key)
        rows[model_key] = size
        generated.append({"modelKey": model_key, "sizeMeters": size, "floorZ": floor_z, "bytes": path.stat().st_size})
        print(f"[glb] {model_key} size={size} floorZ={floor_z} bytes={path.stat().st_size}")

    manifest = build_manifest(rows)
    print(f"[manifest] wrote {MANIFEST_PATH.relative_to(ROOT)} ({len(manifest['assets'])} assets)")

    try:
        out = render_contact_sheet(list(BUILDERS))
        print(f"[render] wrote {out.relative_to(ROOT)}")
    except Exception as exc:  # render is evidence-only; never block GLB output
        print(f"[render] FAILED: {exc}")

    report = EVIDENCE_DIR / "build-summary.json"
    report.write_text(json.dumps({"atlasRegions": REGIONS, "assets": generated}, indent=2) + "\n", encoding="utf-8")
    print(f"[summary] wrote {report.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
