import type { Tuple4 } from "./RawWebGpuTypes";

export const MAX_INSTANCES = 2048;
export const FLOATS_PER_INSTANCE = 24;
// Packed vertex format: position3, normal3, uv2, materialIndex1, rigidJointIndex1.
// (The legacy tangent4 was removed — it was loaded but never used; the fragment
//  rebuilds TBN from screen-space derivatives. See raw-webgpu-plan-geometry.mjs.)
export const FLOATS_PER_VERTEX = 10;
// Float component index of materialIndex within a vertex (after the tangent drop).
// Used by CPU-side material remapping/picking; keep in sync with the layout.
export const VERTEX_MATERIAL_INDEX_COMPONENT = 8;
// Encodes texture page + layer into the existing material float slots:
// encoded = page * RAW_TEXTURE_PAGE_STRIDE + layer. Layer 0 stays the fallback.
export const RAW_TEXTURE_PAGE_STRIDE = 1024;
export const RAW_TEXTURE_ARRAY_PAGE_COUNT = 5;
export const INSTANCE_BUFFER_BYTES = MAX_INSTANCES * FLOATS_PER_INSTANCE * Float32Array.BYTES_PER_ELEMENT;
export const ROBOT_JOINT_MATRIX_FLOATS = 16;
export const MAX_ROBOT_JOINT_MATRICES = 4096;
export const ROBOT_JOINT_MATRIX_BUFFER_BYTES = MAX_ROBOT_JOINT_MATRICES * ROBOT_JOINT_MATRIX_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const CAMERA_FLOATS = 44;
export const CAMERA_BUFFER_BYTES = CAMERA_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const MAX_SHADER_LIGHTS = 10;
export const LIGHT_PROFILE_FLOATS = 24;
// Phase-1 IBL (opt-in ?rawIbl=1): 9 SH9 irradiance coeffs (each vec4-padded for
// std140 alignment) + 1 sh_meta vec4 (.x=enabled, .y=intensity). Appended at the
// END of the lighting uniform so every existing offset stays byte-identical.
export const LIGHT_SH_FLOATS = 40;
export const LIGHT_FLOATS = 16 + MAX_SHADER_LIGHTS * 12 + LIGHT_PROFILE_FLOATS + LIGHT_SH_FLOATS;
export const LIGHT_BUFFER_BYTES = LIGHT_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const SHADOW_FLOATS = 20;
export const SHADOW_BUFFER_BYTES = SHADOW_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const BLOOM_FLOATS = 8;
export const BLOOM_BUFFER_BYTES = BLOOM_FLOATS * Float32Array.BYTES_PER_ELEMENT;
export const SHADOW_MAP_SIZE = 1024;
export const DEPTH_FORMAT = "depth24plus";
export const SHADOW_DEPTH_FORMAT = "depth32float";
export const OFFSCREEN_COLOR_FORMAT = "rgba16float";
export const GLASS_OIT_ACCUM_FORMAT = "rgba16float";
export const GLASS_OIT_REVEAL_FORMAT = "rgba8unorm";
export const CUBE_VERTEX_COUNT = 36;
export const HERO_FLOOR_VERTEX_FLOATS = 5;

export const roleColors: Record<string, Tuple4> = {
  floor: [0.12, 0.16, 0.14, 0.14],
  wall: [0.34, 0.48, 0.54, 0.18],
  pillar: [0.46, 0.62, 0.64, 0.18],
  ceiling: [0.10, 0.13, 0.15, 0.10],
  wall_wash_light_mesh: [0.34, 0.9, 0.96, 0.92],
  door_leaf: [0.16, 0.13, 0.09, 1.0],
  door_panel: [0.22, 0.78, 0.86, 0.8],
  key_item: [1, 0.82, 0.2, 0.8],
  interaction_terminal: [0.28, 0.9, 0.74, 0.85],
  interaction_exit: [1, 0.34, 0.24, 0.8],
  pickup_repairKit: [0.94, 0.96, 0.92, 0.72],
  pickup_coreCell: [1.0, 0.78, 0.34, 0.86],
  pickup_ironRod: [0.78, 0.84, 0.82, 0.18],
  pickup_pistol: [0.76, 0.88, 0.94, 0.18],
  pickup_breachMissile: [0.50, 0.98, 1.0, 0.22],
  decal_human_body_reference: [1, 1, 1, 0.92],
  decal_human_hand_reference: [1, 1, 1, 0.92],
  decal_human_spine_reference: [1, 1, 1, 0.92],
  decal_human_reference_triptych: [1, 1, 1, 0.96],
  prop: [0.9, 0.78, 0.58, 0.34],
  enemy: [0.96, 0.32, 0.22, 0.62],
};
