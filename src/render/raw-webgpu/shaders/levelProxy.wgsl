struct CameraUniform {
  view_projection: mat4x4<f32>,
  camera_position: vec4<f32>,
  fog_color: vec4<f32>,
  fog_params: vec4<f32>,
  visual_params: vec4<f32>,
  color_grade0: vec4<f32>,
  color_grade1: vec4<f32>,
  color_pipeline: vec4<f32>,
};

struct Instance {
  model: mat4x4<f32>,
  color: vec4<f32>,
  anim: vec4<f32>,
};

struct RawMaterial {
  base_color: vec4<f32>,
  emissive_color: vec4<f32>,
  pbr_params: vec4<f32>,
  flags: vec4<f32>,
  texture_stats: vec4<f32>,
  semantic_params: vec4<f32>,
  palette_color: vec4<f32>,
  texture_layers: vec4<f32>,
};

const MAX_SHADER_LIGHTS: u32 = 10u;

struct LightingUniform {
  ambient: vec4<f32>,
  directional_direction: vec4<f32>,
  directional_color: vec4<f32>,
  light_meta: vec4<f32>,
  light_positions: array<vec4<f32>, 10>,
  light_colors: array<vec4<f32>, 10>,
  light_params: array<vec4<f32>, 10>,
  artist_params: vec4<f32>,
  room_bounce: vec4<f32>,
  room_shape: vec4<f32>,
  room_height: vec4<f32>,
  algorithm_params: vec4<f32>,
  algorithm_extra: vec4<f32>,
  // Phase-1 IBL (append-only). sh_coeff[0..8].xyz = SH9 radiance coeffs
  // (L00,L1-1,L10,L11,L2-2,L2-1,L20,L21,L22). sh_meta.x=enabled(0/1) .y=intensity.
  sh_coeff: array<vec4<f32>, 9>,
  sh_meta: vec4<f32>,
};

struct ShadowUniform {
  view_projection: mat4x4<f32>,
  params: vec4<f32>,
};

struct BloomUniform {
  params: vec4<f32>,
  grade: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;
@group(0) @binding(2) var<uniform> lighting: LightingUniform;
@group(0) @binding(3) var<uniform> shadow: ShadowUniform;
@group(0) @binding(4) var shadow_depth: texture_depth_2d;
@group(0) @binding(5) var shadow_sampler: sampler_comparison;
@group(0) @binding(6) var<storage, read> raw_materials: array<RawMaterial>;
@group(0) @binding(7) var<storage, read> robot_joint_matrices: array<mat4x4<f32>>;
@group(1) @binding(0) var bloom_scene: texture_2d<f32>;
@group(1) @binding(1) var bloom_sampler: sampler;
@group(1) @binding(2) var<uniform> bloom: BloomUniform;
@group(2) @binding(0) var hero_floor_texture: texture_2d<f32>;
@group(2) @binding(1) var hero_floor_sampler: sampler;
@group(3) @binding(0) var raw_base_color_textures_0: texture_2d_array<f32>;
@group(3) @binding(1) var raw_base_color_textures_1: texture_2d_array<f32>;
@group(3) @binding(2) var raw_base_color_textures_2: texture_2d_array<f32>;
@group(3) @binding(3) var raw_base_color_textures_3: texture_2d_array<f32>;
@group(3) @binding(4) var raw_base_color_textures_4: texture_2d_array<f32>;
@group(3) @binding(5) var raw_base_color_sampler: sampler;
@group(3) @binding(6) var raw_material_textures_0: texture_2d_array<f32>;
@group(3) @binding(7) var raw_material_textures_1: texture_2d_array<f32>;
@group(3) @binding(8) var raw_material_textures_2: texture_2d_array<f32>;
@group(3) @binding(9) var raw_material_textures_3: texture_2d_array<f32>;
@group(3) @binding(10) var raw_material_textures_4: texture_2d_array<f32>;
@group(3) @binding(11) var raw_ibl_specular_cube: texture_cube<f32>;
@group(3) @binding(12) var raw_ibl_specular_sampler: sampler;
@group(3) @binding(13) var raw_ibl_brdf_lut: texture_2d<f32>;
@group(3) @binding(14) var raw_ibl_lut_sampler: sampler;

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  // location 2 (tangent) removed — unused; TBN is rebuilt from screen-space derivatives.
  @location(3) uv: vec2<f32>,
  @location(4) material_index: f32,
  @location(5) rigid_joint_index: f32,
  @builtin(instance_index) instance_index: u32,
};

struct VertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec4<f32>,
  @location(3) emissive: f32,
  @location(4) material_kind: f32,
  @location(5) fog_amount: f32,
  @location(6) local_position: vec3<f32>,
  @location(7) shadow_position: vec4<f32>,
  @location(8) material_params: vec4<f32>,
  @location(9) emissive_color: vec3<f32>,
  @location(10) uv: vec2<f32>,
  @location(11) material_flags: vec4<f32>,
  @location(12) texture_stats: vec4<f32>,
  @location(13) semantic_params: vec4<f32>,
  @location(14) palette_color: vec4<f32>,
  @location(15) material_alpha_flags: vec4<f32>,
};

fn rigid_joint_matrix(instance: Instance, rigid_joint_index: f32) -> mat4x4<f32> {
  if (instance.anim.x < 0.5 || rigid_joint_index < -0.5) {
    return mat4x4<f32>(
      vec4<f32>(1.0, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 1.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 1.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
  }
  let palette_count = arrayLength(&robot_joint_matrices);
  let joint = min(u32(max(rigid_joint_index, 0.0)), max(u32(instance.anim.z), 1u) - 1u);
  let palette_index = u32(max(instance.anim.y, 0.0)) + joint;
  if (palette_index >= palette_count) {
    return mat4x4<f32>(
      vec4<f32>(1.0, 0.0, 0.0, 0.0),
      vec4<f32>(0.0, 1.0, 0.0, 0.0),
      vec4<f32>(0.0, 0.0, 1.0, 0.0),
      vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
  }
  return robot_joint_matrices[palette_index];
}

fn skinned_world_position(instance: Instance, position: vec3<f32>, rigid_joint_index: f32) -> vec4<f32> {
  let joint_matrix = rigid_joint_matrix(instance, rigid_joint_index);
  return instance.model * (joint_matrix * vec4<f32>(position, 1.0));
}

fn skinned_world_normal(instance: Instance, normal: vec3<f32>, rigid_joint_index: f32) -> vec3<f32> {
  let joint_matrix = rigid_joint_matrix(instance, rigid_joint_index);
  return normalize((instance.model * (joint_matrix * vec4<f32>(normal, 0.0))).xyz);
}

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  let instance = instances[input.instance_index];
  let material_count = arrayLength(&raw_materials);
  let material_index = min(u32(max(input.material_index, 0.0)), material_count - 1u);
  let material = raw_materials[material_index];
  let world_position = skinned_world_position(instance, input.position, input.rigid_joint_index);
  let tint = max(instance.color.rgb, vec3<f32>(0.12, 0.12, 0.12));
  var output: VertexOutput;
  output.clip_position = camera.view_projection * world_position;
  output.shadow_position = shadow.view_projection * world_position;
  output.world_position = world_position.xyz;
  output.local_position = input.position;
  output.normal = skinned_world_normal(instance, input.normal, input.rigid_joint_index);
  let fog_delta = camera.camera_position.xyz - world_position.xyz;
  let fog_distance_sq = dot(fog_delta, fog_delta);
  output.fog_amount = smoothstep(camera.fog_params.x * camera.fog_params.x, camera.fog_params.y * camera.fog_params.y, fog_distance_sq);
  let tint_strength = clamp(instance.color.a, 0.0, 1.0);
  let material_has_base_texture = select(0.0, 1.0, material.flags.w >= 0.5);
  let tint_mix = tint_strength * mix(0.34, 0.0, material_has_base_texture);
  let tint_lift = tint_strength * mix(0.055, 0.0, material_has_base_texture);
  let material_color = mix(material.base_color.rgb, material.base_color.rgb * tint, tint_mix);
  output.color = vec4<f32>(material_color + tint * tint_lift, tint_strength * clamp(material.base_color.a, 0.0, 1.0));
  output.emissive = clamp(material.emissive_color.a, 0.0, 4.0);
  output.material_kind = material.pbr_params.w;
  output.material_params = vec4<f32>(
    material.texture_layers.w,
    clamp(material.pbr_params.x, 0.04, 1.0),
    clamp(material.pbr_params.y, 0.0, 1.0),
    clamp(material.pbr_params.z, 0.0, 1.0)
  );
  output.emissive_color = material.emissive_color.rgb;
  output.uv = input.uv;
  output.material_flags = vec4<f32>(material.texture_layers.x, material.texture_layers.y, material.texture_layers.z, material.flags.w);
  output.texture_stats = material.texture_stats;
  output.semantic_params = material.semantic_params;
  output.palette_color = material.palette_color;
  output.material_alpha_flags = material.flags;
  return output;
}

struct ShadowVertexOutput {
  @builtin(position) clip_position: vec4<f32>,
};

@vertex
fn vs_shadow(input: VertexInput) -> ShadowVertexOutput {
  let instance = instances[input.instance_index];
  let world_position = skinned_world_position(instance, input.position, input.rigid_joint_index);
  var output: ShadowVertexOutput;
  output.clip_position = shadow.view_projection * world_position;
  return output;
}

fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn pow5(value: f32) -> f32 {
  let v2 = value * value;
  return v2 * v2 * value;
}

fn aces_film(color: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

// AgX tonemap (Sobotka/bwrensch minimal fit). Scene-linear in -> sRGB-display out.
// Smooth filmic highlight roll-off + neutral desaturation, replacing the old hard
// clip / custom toe. Toggled by camera.fog_params.z (rawAgxEnabled; ?rawAgx=0 reverts).
fn agx_tonemap(color_in: vec3<f32>) -> vec3<f32> {
  let agx_mat = mat3x3<f32>(
    0.842479062253094, 0.0423282422610123, 0.0423756549057051,
    0.0784335999999992, 0.878468636469772, 0.0784336,
    0.0792237451477643, 0.0791661274605434, 0.879142973793104);
  let agx_mat_inv = mat3x3<f32>(
    1.19687900512017, -0.0528968517574562, -0.0529716355144438,
    -0.0980208811401368, 1.15190312990417, -0.0980434501171241,
    -0.0990297440797205, -0.0989611768448433, 1.15107367264116);
  let min_ev = -12.47393;
  let max_ev = 4.026069;
  var val = agx_mat * max(color_in, vec3<f32>(0.0));
  val = clamp(log2(max(val, vec3<f32>(1e-10))), vec3<f32>(min_ev), vec3<f32>(max_ev));
  val = (val - vec3<f32>(min_ev)) / vec3<f32>(max_ev - min_ev);
  let x = val;
  let x2 = x * x;
  let x4 = x2 * x2;
  val = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - vec3<f32>(0.00232);
  val = agx_mat_inv * val;
  return clamp(val, vec3<f32>(0.0), vec3<f32>(1.0));
}

// SH9 evaluation. w0/w1/w2 are per-band weights: diffuse irradiance uses the
// cosine-lobe convolution (1, 2/3, 1/4); raw environment radiance (for IBL
// reflections) uses (1, 1, 1). All scalar<->vec3 ops use explicit vec3() splat.
fn eval_sh9(n: vec3<f32>, w0: f32, w1: f32, w2: f32) -> vec3<f32> {
  let x = n.x;
  let y = n.y;
  let z = n.z;
  var r = lighting.sh_coeff[0].xyz * vec3<f32>(0.282095 * w0);
  r = r + lighting.sh_coeff[1].xyz * vec3<f32>(0.488603 * y * w1);
  r = r + lighting.sh_coeff[2].xyz * vec3<f32>(0.488603 * z * w1);
  r = r + lighting.sh_coeff[3].xyz * vec3<f32>(0.488603 * x * w1);
  r = r + lighting.sh_coeff[4].xyz * vec3<f32>(1.092548 * x * y * w2);
  r = r + lighting.sh_coeff[5].xyz * vec3<f32>(1.092548 * y * z * w2);
  r = r + lighting.sh_coeff[6].xyz * vec3<f32>(0.315392 * (3.0 * z * z - 1.0) * w2);
  r = r + lighting.sh_coeff[7].xyz * vec3<f32>(1.092548 * x * z * w2);
  r = r + lighting.sh_coeff[8].xyz * vec3<f32>(0.546274 * (x * x - y * y) * w2);
  return max(r, vec3<f32>(0.0));
}

// Karis 2014 analytic environment-BRDF (split-sum scale/bias, no LUT texture).
fn env_brdf_approx(f0: vec3<f32>, roughness: f32, n_dot_v: f32) -> vec3<f32> {
  let c0 = vec4<f32>(-1.0, -0.0275, -0.572, 0.022);
  let c1 = vec4<f32>(1.0, 0.0425, 1.04, -0.04);
  let r = roughness * c0 + c1;
  let a004 = min(r.x * r.x, exp2(-9.28 * n_dot_v)) * r.x + r.y;
  let ab = vec2<f32>(-1.04, 1.04) * a004 + vec2<f32>(r.z, r.w);
  return f0 * ab.x + vec3<f32>(ab.y);
}

fn raw_gamut_compress(color: vec3<f32>) -> vec3<f32> {
  let safe = max(color, vec3<f32>(0.0));
  let y = luminance(safe);
  let chroma = safe - vec3<f32>(y);
  let high = max(max(safe.r, safe.g), safe.b);
  let cyan_pressure = smoothstep(0.18, 0.82, safe.g + safe.b - safe.r * 1.08);
  let highlight_pressure = smoothstep(0.72, 1.18, high);
  let compression = clamp(highlight_pressure * 0.26 + cyan_pressure * camera.visual_params.x * 0.24, 0.0, 0.48);
  let compressed = vec3<f32>(y) + chroma * (1.0 - compression);
  return clamp(compressed / (1.0 + max(high - 1.0, 0.0) * 0.28), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn linear_to_srgb(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
}

fn srgb_to_linear(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

const RAW_TEXTURE_PAGE_STRIDE: f32 = 1024.0;

fn raw_texture_page(encoded_value: f32) -> i32 {
  if (encoded_value < 0.5) {
    return 0;
  }
  return clamp(i32(floor(encoded_value / RAW_TEXTURE_PAGE_STRIDE)), 0, 4);
}

fn raw_texture_layer(encoded_value: f32) -> i32 {
  if (encoded_value < 0.5) {
    return 0;
  }
  let encoded = max(0, i32(floor(encoded_value + 0.5)));
  return max(0, encoded - (encoded / 1024) * 1024);
}

fn sample_raw_base_color(uv: vec2<f32>, layer_value: f32) -> vec3<f32> {
  let page = raw_texture_page(layer_value);
  let layer = raw_texture_layer(layer_value);
  let sample_uv = fract(uv);
  if (page == 1) {
    return textureSampleLevel(raw_base_color_textures_1, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  if (page == 2) {
    return textureSampleLevel(raw_base_color_textures_2, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  if (page == 3) {
    return textureSampleLevel(raw_base_color_textures_3, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  if (page == 4) {
    return textureSampleLevel(raw_base_color_textures_4, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  return textureSampleLevel(raw_base_color_textures_0, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
}

fn raw_base_color_weight(layer_value: f32) -> f32 {
  return select(0.0, 1.0, layer_value >= 0.5);
}

fn raw_texture_layer_weight(layer_value: f32) -> f32 {
  return select(0.0, 1.0, layer_value >= 0.5);
}

fn sample_raw_material_texture(uv: vec2<f32>, layer_value: f32) -> vec3<f32> {
  let page = raw_texture_page(layer_value);
  let layer = raw_texture_layer(layer_value);
  let sample_uv = fract(uv);
  if (page == 1) {
    return textureSampleLevel(raw_material_textures_1, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  if (page == 2) {
    return textureSampleLevel(raw_material_textures_2, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  if (page == 3) {
    return textureSampleLevel(raw_material_textures_3, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  if (page == 4) {
    return textureSampleLevel(raw_material_textures_4, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
  }
  return textureSampleLevel(raw_material_textures_0, raw_base_color_sampler, sample_uv, layer, 0.0).rgb;
}

fn apply_normal_map(geometry_normal: vec3<f32>, world_position: vec3<f32>, uv: vec2<f32>, layer_value: f32) -> vec3<f32> {
  let weight = raw_texture_layer_weight(layer_value);
  let normal_texel = sample_raw_material_texture(uv, layer_value) * 2.0 - vec3<f32>(1.0);
  let dp1 = dpdx(world_position);
  let dp2 = dpdy(world_position);
  let duv1 = dpdx(uv);
  let duv2 = dpdy(uv);
  let dp2perp = cross(dp2, geometry_normal);
  let dp1perp = cross(geometry_normal, dp1);
  var tangent = dp2perp * duv1.x + dp1perp * duv2.x;
  var bitangent = dp2perp * duv1.y + dp1perp * duv2.y;
  let inv_max = inverseSqrt(max(max(dot(tangent, tangent), dot(bitangent, bitangent)), 0.000001));
  tangent *= inv_max;
  bitangent *= inv_max;
  let mapped = normalize(tangent * normal_texel.x + bitangent * normal_texel.y + geometry_normal * max(normal_texel.z, 0.08));
  return normalize(mix(geometry_normal, mapped, weight * 0.95));
}

fn role_mask(semantic: vec4<f32>, role: f32) -> f32 {
  return 1.0 - step(0.5, abs(semantic.x - role));
}

fn semantic_cyan_rebalance(color: vec3<f32>, amount: f32) -> vec3<f32> {
  let cyan_excess = max(0.0, color.g + color.b - color.r * 1.16);
  return vec3<f32>(
    color.r + cyan_excess * amount * 0.095,
    color.g * (1.0 - amount * 0.060),
    color.b * (1.0 - amount * 0.050)
  );
}

fn apply_role_palette(color: vec3<f32>, semantic: vec4<f32>, texture_weight: f32, palette: vec4<f32>) -> vec3<f32> {
  let palette_mix = clamp(palette.a, 0.0, 1.0);
  if (palette_mix <= 0.001) {
    return color;
  }
  let y = max(luminance(color), 0.012);
  let palette_y = max(luminance(palette.rgb), 0.012);
  let glass_role = role_mask(semantic, 5.0);
  let dark_role = role_mask(semantic, 4.0);
  let floor_role = role_mask(semantic, 2.0);
  let ceiling_role = role_mask(semantic, 3.0);
  let route_role = role_mask(semantic, 8.0);
  let danger_role = role_mask(semantic, 9.0);
  let screen_role = role_mask(semantic, 10.0);
  let gameplay_warm_role = clamp(role_mask(semantic, 12.0) + role_mask(semantic, 15.0) + role_mask(semantic, 17.0) + role_mask(semantic, 19.0), 0.0, 1.0);
  let gameplay_cyan_role = clamp(role_mask(semantic, 13.0) + role_mask(semantic, 18.0), 0.0, 1.0);
  let gameplay_pickup_role = clamp(role_mask(semantic, 14.0) + role_mask(semantic, 15.0) + role_mask(semantic, 16.0) + role_mask(semantic, 17.0), 0.0, 1.0);
  let texture_guard = mix(1.0, 0.28, clamp(texture_weight, 0.0, 1.0));
  let preserve_target = palette.rgb * (y / palette_y);
  let direct_target = palette.rgb * mix(0.74, 1.14, smoothstep(0.10, 0.72, y));
  let direct_weight = clamp(glass_role * 0.86 + dark_role * 0.58 + ceiling_role * 0.42 + floor_role * 0.22 + gameplay_warm_role * 0.24 + gameplay_cyan_role * 0.18, 0.0, 0.92);
  let accent_guard = clamp(route_role + danger_role + screen_role + gameplay_warm_role + gameplay_cyan_role + gameplay_pickup_role * 0.72, 0.0, 1.0);
  let palette_target = mix(preserve_target, direct_target, direct_weight);
  let accent_mix = mix(texture_guard, 1.0, accent_guard * 0.22);
  let authored_palette_mix = palette_mix * mix(1.0, 0.22, clamp(texture_weight, 0.0, 1.0));
  return mix(color, palette_target, authored_palette_mix * accent_mix * clamp(semantic.y + 0.16, 0.0, 1.0));
}

fn semantic_material_albedo(color: vec3<f32>, semantic: vec4<f32>, material_kind: f32, texture_weight: f32, palette: vec4<f32>) -> vec3<f32> {
  let strength = clamp(semantic.y, 0.0, 1.0);
  let y = max(luminance(color), 0.015);
  let neutral = role_mask(semantic, 1.0);
  let floor_role = role_mask(semantic, 2.0);
  let ceiling_role = role_mask(semantic, 3.0);
  let dark_role = role_mask(semantic, 4.0);
  let glass_role = role_mask(semantic, 5.0);
  let exhibit_role = role_mask(semantic, 6.0);
  let cyan_role = role_mask(semantic, 7.0);
  let route_role = role_mask(semantic, 8.0);
  let danger_role = role_mask(semantic, 9.0);
  let screen_role = role_mask(semantic, 10.0);
  let robot_role = role_mask(semantic, 11.0);
  let door_locked_role = role_mask(semantic, 12.0);
  let door_access_role = role_mask(semantic, 13.0);
  let pickup_health_role = role_mask(semantic, 14.0);
  let pickup_energy_role = role_mask(semantic, 15.0);
  let pickup_ammo_role = role_mask(semantic, 16.0);
  let pickup_key_role = role_mask(semantic, 17.0);
  let switch_active_role = role_mask(semantic, 18.0);
  let switch_inactive_role = role_mask(semantic, 19.0);
  let texture_guard = mix(1.0, 0.08, clamp(texture_weight, 0.0, 1.0));

  var result = color;
  let neutral_anchor = vec3<f32>(y * 0.82, y * 0.78, y * 0.68);
  let floor_anchor = vec3<f32>(y * 0.52, y * 0.42, y * 0.28);
  let ceiling_anchor = vec3<f32>(y * 0.70, y * 0.66, y * 0.56);
  let dark_anchor = vec3<f32>(y * 0.34, y * 0.35, y * 0.32);
  let glass_anchor = vec3<f32>(0.030 + y * 0.26, 0.048 + y * 0.30, 0.048 + y * 0.28);
  let exhibit_anchor = vec3<f32>(max(y, 0.16) * 1.02, max(y, 0.14) * 0.78, max(y, 0.08) * 0.42);
  let route_anchor = vec3<f32>(max(y, 0.20) * 1.08, max(y, 0.18) * 0.78, max(y, 0.08) * 0.30);
  let danger_anchor = vec3<f32>(max(y, 0.14) * 1.05, max(y, 0.05) * 0.26, max(y, 0.04) * 0.20);
  let screen_anchor = vec3<f32>(max(y, 0.12) * 0.62, max(y, 0.15) * 0.78, max(y, 0.14) * 0.76);
  let cyan_anchor = vec3<f32>(max(y, 0.10) * 0.52, max(y, 0.14) * 0.72, max(y, 0.13) * 0.70);
  let robot_anchor = vec3<f32>(max(y, 0.095) * 0.88, max(y, 0.092) * 0.92, max(y, 0.086) * 0.88);
  let door_locked_anchor = vec3<f32>(max(y, 0.15) * 1.08, max(y, 0.055) * 0.28, max(y, 0.045) * 0.20);
  let door_access_anchor = vec3<f32>(max(y, 0.11) * 0.64, max(y, 0.15) * 0.74, max(y, 0.15) * 0.72);
  let health_red_bias = smoothstep(0.05, 0.34, color.r - max(color.g, color.b) * 0.82);
  let pickup_health_anchor = mix(
    vec3<f32>(max(y, 0.28) * 1.02, max(y, 0.27) * 0.98, max(y, 0.22) * 0.84),
    vec3<f32>(max(y, 0.15) * 1.10, max(y, 0.055) * 0.23, max(y, 0.045) * 0.20),
    health_red_bias
  );
  let energy_cyan_bias = smoothstep(0.18, 0.78, color.g + color.b - color.r * 1.08);
  let pickup_energy_anchor = mix(
    vec3<f32>(max(y, 0.18) * 1.12, max(y, 0.16) * 0.64, max(y, 0.06) * 0.22),
    vec3<f32>(max(y, 0.12) * 0.58, max(y, 0.17) * 0.74, max(y, 0.16) * 0.72),
    energy_cyan_bias * 0.22
  );
  let pickup_ammo_anchor = vec3<f32>(max(y, 0.16) * 0.62, max(y, 0.18) * 0.70, max(y, 0.14) * 0.50);
  let pickup_key_anchor = vec3<f32>(max(y, 0.20) * 1.12, max(y, 0.18) * 0.78, max(y, 0.08) * 0.24);
  let switch_active_anchor = vec3<f32>(max(y, 0.11) * 0.58, max(y, 0.15) * 0.76, max(y, 0.15) * 0.72);
  let switch_inactive_anchor = vec3<f32>(max(y, 0.14) * 1.08, max(y, 0.052) * 0.24, max(y, 0.042) * 0.18);

  result = mix(result, neutral_anchor, neutral * strength * 0.18 * texture_guard);
  result = mix(result, floor_anchor, floor_role * strength * 0.16 * texture_guard);
  result = mix(result, ceiling_anchor, ceiling_role * strength * 0.12 * texture_guard);
  result = mix(result, dark_anchor, dark_role * strength * 0.38 * texture_guard);
  result = mix(result, glass_anchor, glass_role * strength * 0.62);
  result = mix(result, exhibit_anchor, exhibit_role * strength * 0.38 * texture_guard);
  result = mix(result, cyan_anchor, cyan_role * strength * 0.22);
  result = mix(result, route_anchor, route_role * strength * 0.44);
  result = mix(result, danger_anchor, danger_role * strength * 0.32);
  result = mix(result, screen_anchor, screen_role * strength * 0.28);
  result = mix(result, robot_anchor, robot_role * strength * 0.34 * texture_guard);
  result = mix(result, door_locked_anchor, door_locked_role * strength * 0.48);
  result = mix(result, door_access_anchor, door_access_role * strength * 0.42);
  result = mix(result, pickup_health_anchor, pickup_health_role * strength * 0.54 * mix(1.0, 0.82, texture_weight));
  result = mix(result, pickup_energy_anchor, pickup_energy_role * strength * 0.58);
  result = mix(result, pickup_ammo_anchor, pickup_ammo_role * strength * 0.34 * texture_guard);
  result = mix(result, pickup_key_anchor, pickup_key_role * strength * 0.58);
  result = mix(result, switch_active_anchor, switch_active_role * strength * 0.44);
  result = mix(result, switch_inactive_anchor, switch_inactive_role * strength * 0.46);

  let surface_cyan_guard = (neutral + dark_role + glass_role) * strength * 0.34 + (floor_role + ceiling_role) * strength * 0.42;
  result = semantic_cyan_rebalance(result, surface_cyan_guard);
  result *= 1.0 - dark_role * strength * 0.20 - glass_role * strength * 0.12;
  result += (route_role + exhibit_role + pickup_key_role + pickup_energy_role * 0.72) * vec3<f32>(0.025, 0.014, 0.003) * strength;
  result += screen_role * vec3<f32>(0.0, 0.018, 0.022) * strength;
  result += (cyan_role + door_access_role + switch_active_role) * vec3<f32>(0.0, 0.014, 0.018) * strength;
  result = apply_role_palette(result, semantic, texture_weight, palette);
  return max(result, vec3<f32>(0.0));
}

fn semantic_specular_scale(semantic: vec4<f32>) -> f32 {
  let identity = clamp(semantic.y, 0.0, 1.0);
  return 1.0 +
    role_mask(semantic, 5.0) * identity * 0.55 +
    role_mask(semantic, 6.0) * identity * 0.24 +
    role_mask(semantic, 8.0) * identity * 0.34 +
    role_mask(semantic, 10.0) * identity * 0.22 -
    role_mask(semantic, 1.0) * identity * 0.10 +
    role_mask(semantic, 12.0) * identity * 0.18 +
    role_mask(semantic, 13.0) * identity * 0.20 +
    role_mask(semantic, 15.0) * identity * 0.28 +
    role_mask(semantic, 17.0) * identity * 0.34 +
    role_mask(semantic, 18.0) * identity * 0.18 +
    role_mask(semantic, 19.0) * identity * 0.16;
}

fn semantic_grade_guard(semantic: vec4<f32>) -> f32 {
  let identity = clamp(semantic.y, 0.0, 1.0);
  return role_mask(semantic, 6.0) * identity * 0.38 +
    role_mask(semantic, 8.0) * identity * 0.58 +
    role_mask(semantic, 9.0) * identity * 0.62 +
    role_mask(semantic, 10.0) * identity * 0.30 +
    role_mask(semantic, 12.0) * identity * 0.58 +
    role_mask(semantic, 13.0) * identity * 0.34 +
    role_mask(semantic, 14.0) * identity * 0.42 +
    role_mask(semantic, 15.0) * identity * 0.56 +
    role_mask(semantic, 17.0) * identity * 0.58 +
    role_mask(semantic, 18.0) * identity * 0.34 +
    role_mask(semantic, 19.0) * identity * 0.54;
}

fn semantic_role_color(semantic: vec4<f32>) -> vec3<f32> {
  var color = vec3<f32>(0.42, 0.42, 0.46);
  color = mix(color, vec3<f32>(0.62, 0.68, 0.64), role_mask(semantic, 1.0));
  color = mix(color, vec3<f32>(0.25, 0.56, 0.54), role_mask(semantic, 2.0));
  color = mix(color, vec3<f32>(0.20, 0.34, 0.50), role_mask(semantic, 3.0));
  color = mix(color, vec3<f32>(0.08, 0.09, 0.10), role_mask(semantic, 4.0));
  color = mix(color, vec3<f32>(0.30, 0.86, 1.00), role_mask(semantic, 5.0));
  color = mix(color, vec3<f32>(1.00, 0.74, 0.36), role_mask(semantic, 6.0));
  color = mix(color, vec3<f32>(0.10, 0.90, 0.95), role_mask(semantic, 7.0));
  color = mix(color, vec3<f32>(1.00, 0.82, 0.14), role_mask(semantic, 8.0));
  color = mix(color, vec3<f32>(1.00, 0.18, 0.12), role_mask(semantic, 9.0));
  color = mix(color, vec3<f32>(0.42, 0.92, 1.00), role_mask(semantic, 10.0));
  color = mix(color, vec3<f32>(0.92, 0.84, 0.74), role_mask(semantic, 11.0));
  color = mix(color, vec3<f32>(0.95, 0.12, 0.08), role_mask(semantic, 12.0));
  color = mix(color, vec3<f32>(0.14, 0.78, 0.95), role_mask(semantic, 13.0));
  color = mix(color, vec3<f32>(0.96, 0.88, 0.78), role_mask(semantic, 14.0));
  color = mix(color, vec3<f32>(1.00, 0.62, 0.14), role_mask(semantic, 15.0));
  color = mix(color, vec3<f32>(0.54, 0.62, 0.48), role_mask(semantic, 16.0));
  color = mix(color, vec3<f32>(1.00, 0.78, 0.18), role_mask(semantic, 17.0));
  color = mix(color, vec3<f32>(0.12, 0.86, 0.96), role_mask(semantic, 18.0));
  color = mix(color, vec3<f32>(0.95, 0.18, 0.10), role_mask(semantic, 19.0));
  return color;
}

fn robot_material_mask(material_kind: f32) -> f32 {
  _ = material_kind;
  return 0.0;
}

fn material_specular_strength(material_kind: f32, roughness: f32) -> f32 {
  var strength = 0.10;
  if (material_kind > 1.5 && material_kind < 2.5) {
    strength = 0.46;
  } else if (material_kind > 2.5 && material_kind < 3.5) {
    strength = 0.035;
  } else if (material_kind > 3.5 && material_kind < 4.5) {
    strength = 0.34;
  } else if (material_kind > 4.5 && material_kind < 5.5) {
    strength = 0.28;
  } else if (material_kind > 5.5 && material_kind < 6.5) {
    strength = 0.22;
  }
  return strength * (1.0 - roughness * 0.55);
}

fn material_roughness(material_kind: f32, emissive: f32) -> f32 {
  if (material_kind > 1.5 && material_kind < 2.5) {
    return mix(0.42, 0.54, clamp(emissive * 0.35, 0.0, 1.0));
  } else if (material_kind > 2.5 && material_kind < 3.5) {
    return 0.88;
  } else if (material_kind > 3.5 && material_kind < 4.5) {
    return mix(0.28, 0.18, clamp(emissive, 0.0, 1.0));
  } else if (material_kind > 4.5 && material_kind < 5.5) {
    return 0.38;
  } else if (material_kind > 5.5 && material_kind < 6.5) {
    return 0.45;
  } else if (material_kind > 0.5 && material_kind < 1.5) {
    return 0.62;
  }
  return 0.74;
}

fn specular_layer(normal: vec3<f32>, view_direction: vec3<f32>, light_direction: vec3<f32>, roughness: f32) -> f32 {
  let half_vector = normalize(light_direction + view_direction);
  let ndh = max(dot(normal, half_vector), 0.0);
  let ndh2 = ndh * ndh;
  let ndh4 = ndh2 * ndh2;
  let ndh8 = ndh4 * ndh4;
  let ndh16 = ndh8 * ndh8;
  let ndh32 = ndh16 * ndh16;
  let gloss = 1.0 - clamp(roughness, 0.08, 0.96);
  return mix(ndh8, ndh32, gloss) * (0.18 + gloss * 0.62);
}

fn fast_ggx_specular(normal: vec3<f32>, view_direction: vec3<f32>, light_direction: vec3<f32>, roughness: f32, specular_strength: f32) -> f32 {
  let half_vector = normalize(light_direction + view_direction);
  let ndl = max(dot(normal, light_direction), 0.0);
  let ndv = max(dot(normal, view_direction), 0.045);
  let ndh = max(dot(normal, half_vector), 0.0);
  let vdh = max(dot(view_direction, half_vector), 0.0);
  let alpha = max(0.055, roughness * roughness);
  let alpha2 = alpha * alpha;
  let denom = ndh * ndh * (alpha2 - 1.0) + 1.0;
  let distribution = alpha2 / max(0.001, 3.14159 * denom * denom);
  let k = (roughness + 1.0) * (roughness + 1.0) * 0.125;
  let geometry_l = ndl / max(0.001, ndl * (1.0 - k) + k);
  let geometry_v = ndv / max(0.001, ndv * (1.0 - k) + k);
  let fresnel = 0.035 + (specular_strength - 0.035) * pow5(1.0 - vdh);
  return distribution * geometry_l * geometry_v * fresnel * ndl * lighting.algorithm_params.z * lighting.algorithm_extra.y;
}

fn room_edge_factor(world_position: vec3<f32>) -> vec4<f32> {
  let room_center = lighting.room_shape.xy;
  let room_half = max(lighting.room_shape.zw, vec2<f32>(0.5, 0.5));
  let local_xz = abs(world_position.xz - room_center);
  let wall_distance = max(vec2<f32>(0.0, 0.0), room_half - local_xz);
  let nearest_wall = min(wall_distance.x, wall_distance.y);
  let corner = (1.0 - smoothstep(0.12, 1.65, wall_distance.x)) * (1.0 - smoothstep(0.12, 1.65, wall_distance.y));
  let floor_distance = max(world_position.y - lighting.room_height.x, 0.0);
  let ceiling_distance = max(lighting.room_height.y - world_position.y, 0.0);
  return vec4<f32>(nearest_wall, corner, floor_distance, ceiling_distance);
}

fn room_sdf_ao(world_position: vec3<f32>, normal: vec3<f32>) -> f32 {
  let edge = room_edge_factor(world_position);
  let wall_guard = clamp(lighting.algorithm_extra.w, 0.0, 1.2);
  let vertical_mask = 1.0 - abs(normal.y);
  let wall_ao = (1.0 - smoothstep(0.10, 1.25, edge.x)) * (0.20 + vertical_mask * 0.30) * (1.0 - wall_guard * 0.34);
  let corner_ao = edge.y * 0.26 * (1.0 - wall_guard * 0.22);
  let floor_ao = (1.0 - smoothstep(0.035, 0.70, edge.z)) * (0.16 + (1.0 - max(normal.y, 0.0)) * 0.22);
  let ceiling_ao = (1.0 - smoothstep(0.05, 0.85, edge.w)) * (0.12 + max(normal.y, 0.0) * 0.18);
  return clamp((wall_ao + corner_ao + floor_ao + ceiling_ao) * lighting.algorithm_params.x, 0.0, 0.56);
}

fn semantic_grounding_shadow(world_position: vec3<f32>, normal: vec3<f32>, semantic: vec4<f32>) -> f32 {
  let edge = room_edge_factor(world_position);
  let identity = clamp(semantic.y, 0.0, 1.0);
  let occlusion = clamp(semantic.w, 0.0, 1.4);
  let floor_distance = edge.z;
  let ceiling_distance = edge.w;
  let vertical = 1.0 - abs(normal.y);
  let upward = max(normal.y, 0.0);
  let object_role = clamp(
    role_mask(semantic, 5.0) +
      role_mask(semantic, 6.0) +
      role_mask(semantic, 8.0) +
      role_mask(semantic, 10.0) +
      role_mask(semantic, 11.0) +
      role_mask(semantic, 12.0) +
      role_mask(semantic, 13.0) +
      role_mask(semantic, 14.0) +
      role_mask(semantic, 15.0) +
      role_mask(semantic, 16.0) +
      role_mask(semantic, 17.0) +
      role_mask(semantic, 18.0) +
      role_mask(semantic, 19.0),
    0.0,
    1.0,
  );
  let structure_role = clamp(role_mask(semantic, 1.0) + role_mask(semantic, 3.0) + role_mask(semantic, 4.0), 0.0, 1.0);
  let floor_contact = (1.0 - smoothstep(0.035, 0.52, floor_distance)) *
    (0.08 + vertical * 0.30 + object_role * 0.26) *
    (1.0 - upward * 0.64);
  let wall_contact = (1.0 - smoothstep(0.055, 0.82, edge.x)) * (vertical * 0.18 + structure_role * 0.10);
  let ceiling_contact = (1.0 - smoothstep(0.035, 0.64, ceiling_distance)) * (0.055 + upward * 0.09) * structure_role;
  let corner_contact = edge.y * (0.10 + structure_role * 0.12 + object_role * 0.05);
  return clamp((floor_contact + wall_contact + ceiling_contact + corner_contact) * identity * occlusion * lighting.algorithm_extra.z, 0.0, 0.28);
}

fn room_probe_radiance(world_position: vec3<f32>, normal: vec3<f32>) -> vec3<f32> {
  let edge = room_edge_factor(world_position);
  let wall_near = 1.0 - smoothstep(0.10, 2.10, edge.x);
  let floor_near = 1.0 - smoothstep(0.08, 2.40, edge.z);
  let ceiling_near = 1.0 - smoothstep(0.08, 1.55, edge.w);
  let wall_side = 1.0 - abs(normal.y);
  let up = max(normal.y, 0.0);
  let down = max(-normal.y, 0.0);
  let wall_color = vec3<f32>(0.032, 0.031, 0.028);
  let ceiling_color = vec3<f32>(0.052, 0.050, 0.045);
  let floor_color = vec3<f32>(0.041, 0.039, 0.034);
  let wall_probe = wall_color * wall_near * wall_side;
  let ceiling_probe = ceiling_color * ceiling_near * up * lighting.room_bounce.y;
  let floor_probe = floor_color * floor_near * (0.28 + down * 0.56) * lighting.room_bounce.x;
  return (wall_probe + ceiling_probe + floor_probe) * lighting.algorithm_params.y;
}

fn museum_soft_reflection(normal: vec3<f32>, view_direction: vec3<f32>, roughness: f32, metallic: f32, robot_mask: f32) -> vec3<f32> {
  let reflection = reflect(-view_direction, normal);
  let ceiling = smoothstep(-0.20, 0.82, reflection.y);
  let floor = smoothstep(0.35, -0.55, reflection.y);
  let wall_band = 1.0 - abs(reflection.y);
  let structure_cool_guard = 1.0 - clamp(1.0 - metallic, 0.0, 1.0) * 0.82;
  let soft_strip = pow(max(0.0, 1.0 - abs(reflection.z) * 1.7), 5.0) * wall_band;
  let warm_strip = pow(max(0.0, 1.0 - abs(reflection.x + 0.34) * 2.2), 6.0) * wall_band;
  let sharp_env =
    vec3<f32>(0.052, 0.050, 0.042) * ceiling +
    vec3<f32>(0.024, 0.022, 0.017) * floor +
    vec3<f32>(0.034, 0.032, 0.027) * wall_band +
    vec3<f32>(0.24, 0.22, 0.18) * soft_strip * 0.06 * structure_cool_guard +
    vec3<f32>(0.76, 0.52, 0.20) * warm_strip * 0.16;
  let satin_env =
    vec3<f32>(0.043, 0.042, 0.038) * (ceiling * 0.72 + wall_band * 0.38) +
    vec3<f32>(0.026, 0.025, 0.022) * floor * 0.68 +
    vec3<f32>(0.14, 0.13, 0.10) * soft_strip * 0.04 * structure_cool_guard +
    vec3<f32>(0.38, 0.26, 0.10) * warm_strip * 0.10;
  let diffuse_env =
    vec3<f32>(0.032, 0.031, 0.028) * (0.32 + ceiling * 0.26 + wall_band * 0.20) +
    vec3<f32>(0.018, 0.017, 0.015) * floor * 0.46;
  let lod0 = clamp(1.0 - roughness * 2.2, 0.0, 1.0);
  let lod1 = clamp(1.0 - abs(roughness - 0.42) * 2.6, 0.0, 1.0);
  let lod2 = clamp((roughness - 0.18) / 0.82, 0.0, 1.0);
  let env_color = (sharp_env * lod0 + satin_env * lod1 + diffuse_env * lod2) / max(lod0 + lod1 + lod2, 0.001);
  let reflection_gain =
    (metallic * (1.0 - roughness * 0.34) * 1.02 +
      (1.0 - roughness) * 0.028 +
      robot_mask * 0.060) * lighting.algorithm_params.z;
  return env_color * reflection_gain;
}

fn procedural_texture_relief(uv: vec2<f32>, texture_mask: f32, material_kind: f32, roughness: f32) -> f32 {
  let has_base_texture = select(0.0, 1.0, texture_mask >= 1.0);
  let grid_uv = fract(uv * vec2<f32>(18.0, 11.0));
  let edge = min(min(grid_uv.x, 1.0 - grid_uv.x), min(grid_uv.y, 1.0 - grid_uv.y));
  let fine_line = 1.0 - smoothstep(0.012, 0.038, edge);
  let diag = 1.0 - smoothstep(0.022, 0.065, abs(fract((uv.x + uv.y) * 9.0) - 0.5));
  let metal_mask = select(0.0, 1.0, material_kind > 1.5 && material_kind < 3.5);
  return has_base_texture * (fine_line * 0.055 + diag * 0.024 * metal_mask) * (1.0 - roughness * 0.32);
}

fn wrapped_diffuse(normal: vec3<f32>, light_direction: vec3<f32>, wrap: f32) -> f32 {
  return clamp((dot(normal, light_direction) + wrap) / (1.0 + wrap), 0.0, 1.0);
}

fn museum_luster_color(
  lit_color: vec3<f32>,
  base_color: vec3<f32>,
  specular_radiance: vec3<f32>,
  normal: vec3<f32>,
  view_direction: vec3<f32>,
  semantic: vec4<f32>,
  roughness: f32,
  metallic: f32,
  texture_chroma: f32,
  texture_detail: f32,
  texture_authority: f32
) -> vec3<f32> {
  let authored_texture_guard = 1.0 - clamp(texture_authority, 0.0, 1.0) * 0.92;
  let identity = clamp(semantic.y, 0.0, 1.0);
  let neutral_surface = clamp(role_mask(semantic, 1.0) + role_mask(semantic, 2.0) + role_mask(semantic, 3.0) + role_mask(semantic, 4.0), 0.0, 1.0);
  let glass_role = role_mask(semantic, 5.0);
  let exhibit_role = role_mask(semantic, 6.0);
  let route_role = role_mask(semantic, 8.0);
  let screen_role = role_mask(semantic, 10.0);
  let door_locked_role = role_mask(semantic, 12.0);
  let door_access_role = role_mask(semantic, 13.0);
  let pickup_health_role = role_mask(semantic, 14.0);
  let pickup_energy_role = role_mask(semantic, 15.0);
  let pickup_key_role = role_mask(semantic, 17.0);
  let switch_active_role = role_mask(semantic, 18.0);
  let switch_inactive_role = role_mask(semantic, 19.0);
  let warm_role = clamp(exhibit_role * 0.42 + route_role * 0.72 + pickup_energy_role * 0.68 + pickup_key_role * 0.78 + pickup_health_role * 0.32, 0.0, 1.0);
  let red_role = clamp(door_locked_role + switch_inactive_role, 0.0, 1.0);
  let cool_role = clamp(glass_role * 0.64 + screen_role * 0.42 + door_access_role * 0.48 + switch_active_role * 0.34, 0.0, 1.0);
  let y = luminance(lit_color);
  let midtone = smoothstep(0.055, 0.30, y) * (1.0 - smoothstep(0.82, 1.42, y));
  let base_y = luminance(base_color);
  let base_chroma = base_color - vec3<f32>(base_y);
  let grazing = pow(1.0 - max(dot(normal, view_direction), 0.0), 2.2);
  let polish = clamp((1.0 - roughness) * 0.62 + metallic * 0.28 + glass_role * 0.28 + route_role * 0.12, 0.0, 1.0);
  let texture_luster = clamp(texture_chroma * 0.36 + texture_detail * 0.28, 0.0, 0.55);
  let neutral_pearl = neutral_surface * identity * midtone * clamp(0.055 + texture_luster * 0.08, 0.04, 0.12) * authored_texture_guard;
  let material_memory = base_chroma * midtone * (0.045 + texture_luster * 0.055) * (1.0 - neutral_surface * 0.46) * authored_texture_guard;
  let warm_varnish = vec3<f32>(0.115, 0.060, 0.014) * warm_role * identity * midtone * (0.45 + polish * 0.65);
  let red_enamel = vec3<f32>(0.120, 0.024, 0.010) * red_role * identity * midtone * (0.28 + grazing * 0.44);
  let cool_glaze = vec3<f32>(0.006, 0.024, 0.028) * cool_role * identity * midtone * (0.30 + grazing * 0.52) * authored_texture_guard;
  let pearl_shift = vec3<f32>(0.020, 0.024, 0.022) * neutral_pearl * (0.42 + grazing * 0.95);
  let spec_y = luminance(specular_radiance);
  let spec_tint = mix(vec3<f32>(0.31, 0.33, 0.30), vec3<f32>(0.48, 0.32, 0.10), clamp(warm_role + red_role * 0.34, 0.0, 1.0));
  let dyed_specular = spec_tint * spec_y * (0.050 + polish * 0.16 + grazing * 0.10) * identity * authored_texture_guard;
  let cyan_wash = smoothstep(0.36, 1.05, lit_color.g + lit_color.b - lit_color.r * 1.08) * neutral_surface * midtone * authored_texture_guard;
  let cyan_to_steel = vec3<f32>(lit_color.r + cyan_wash * 0.018, lit_color.g * (1.0 - cyan_wash * 0.018), lit_color.b * (1.0 - cyan_wash * 0.022));
  let enriched = cyan_to_steel + material_memory + warm_varnish + red_enamel + cool_glaze + pearl_shift + dyed_specular;
  return mix(lit_color, enriched, clamp((0.64 + polish * 0.18) * (0.28 + authored_texture_guard * 0.72), 0.0, 0.86));
}

fn shadow_visibility(shadow_position: vec4<f32>, normal: vec3<f32>, light_direction: vec3<f32>) -> f32 {
  let projected = shadow_position.xyz / max(shadow_position.w, 0.0001);
  let uv = clamp(projected.xy * vec2<f32>(0.5, -0.5) + vec2<f32>(0.5, 0.5), vec2<f32>(0.001, 0.001), vec2<f32>(0.999, 0.999));
  let ndotl = max(dot(normal, light_direction), 0.0);
  let bias = shadow.params.z + (1.0 - ndotl) * shadow.params.w;
  let depth = clamp(projected.z - bias, 0.0001, 0.9999);
  let texel = shadow.params.y;
  var sum = 0.0;

  for (var y = -1; y <= 1; y = y + 1) {
    for (var x = -1; x <= 1; x = x + 1) {
      sum += textureSampleCompare(shadow_depth, shadow_sampler, uv + vec2<f32>(f32(x), f32(y)) * texel, depth);
    }
  }

  let inside_x = select(0.0, 1.0, projected.x >= -1.0 && projected.x <= 1.0);
  let inside_y = select(0.0, 1.0, projected.y >= -1.0 && projected.y <= 1.0);
  let inside_z = select(0.0, 1.0, projected.z >= 0.0 && projected.z <= 1.0);
  return mix(1.0, sum / 9.0, inside_x * inside_y * inside_z);
}

fn raw_display_transform(color: vec3<f32>) -> vec3<f32> {
  return raw_output_transform(color);
}

fn room_art_display(color: vec3<f32>, semantic: vec4<f32>) -> vec3<f32> {
  let quality = clamp(lighting.light_meta.w, 0.35, 1.0);
  let look = clamp(camera.fog_params.w, 0.0, 1.75);
  let look_unit = clamp(look / 1.35, 0.0, 1.0);
  let cyan_guard = clamp(camera.visual_params.x, 0.0, 1.0);
  let grade_guard = semantic_grade_guard(semantic);
  let neutral_role = role_mask(semantic, 1.0) + role_mask(semantic, 2.0) + role_mask(semantic, 3.0) + role_mask(semantic, 4.0);
  let local_warmth = role_mask(semantic, 6.0) * 0.10 + role_mask(semantic, 8.0) * 0.15 + role_mask(semantic, 9.0) * 0.05;
  let grade0 = camera.color_grade0;
  let grade1 = camera.color_grade1;
  let exposure = lighting.artist_params.x * mix(0.96, 0.62, look_unit) * clamp(grade0.x, 0.55, 1.70);
  let contrast = mix(mix(1.04, lighting.artist_params.y * 1.08, quality), lighting.artist_params.y * 1.72, look_unit) * clamp(grade0.y, 0.70, 1.42);
  let saturation = mix(mix(0.98, lighting.artist_params.z, quality), lighting.artist_params.z * 0.94, look_unit) * clamp(grade0.z, 0.62, 1.24);
  let gameplay_warmth = role_mask(semantic, 12.0) * 0.06 +
    role_mask(semantic, 14.0) * 0.05 +
    role_mask(semantic, 15.0) * 0.12 +
    role_mask(semantic, 17.0) * 0.14 +
    role_mask(semantic, 19.0) * 0.06;
  let warmth = clamp(lighting.artist_params.w + local_warmth + gameplay_warmth, 0.0, 1.0);
  let exposed = max(color * exposure, vec3<f32>(0.0));
  let soft_mapped = aces_film(exposed);
  let y = luminance(soft_mapped);
  let contrasted = max((soft_mapped - vec3<f32>(y)) * contrast + vec3<f32>(y), vec3<f32>(0.0));
  var saturated = mix(vec3<f32>(luminance(contrasted)), contrasted, saturation);
  let cyan_wash = smoothstep(0.42, 1.08, saturated.g + saturated.b - saturated.r * 1.10);
  let cyan_grade_mask = cyan_wash * look_unit * (0.50 + cyan_guard * 0.30 + clamp(neutral_role, 0.0, 1.0) * 0.11) * (1.0 - grade_guard);
  let cyan_balanced = vec3<f32>(
    saturated.r + (saturated.g + saturated.b) * clamp(grade1.x, 0.0, 0.36) * 0.42,
    saturated.g * clamp(grade1.y, 0.48, 1.12),
    saturated.b * clamp(grade1.z, 0.55, 1.18)
  );
  let neutral_grade = vec3<f32>(luminance(saturated)) * mix(vec3<f32>(0.96, 1.0, 1.04), vec3<f32>(1.06, 1.0, 0.94), warmth);
  saturated = mix(saturated, mix(cyan_balanced, neutral_grade, clamp(grade1.w, 0.0, 0.52) * cyan_wash), cyan_grade_mask);
  let warmth_tint = mix(vec3<f32>(0.94, 1.0, 1.06), vec3<f32>(1.06, 1.0, 0.92), warmth);
  let cinematic_tint = mix(vec3<f32>(1.0), vec3<f32>(0.94, 0.95, 0.98), look_unit);
  let graded = saturated * warmth_tint * cinematic_tint;
  let black_level = mix(0.012, 0.088, look_unit) * clamp(grade0.w, 0.20, 1.30) * (1.0 + role_mask(semantic, 4.0) * 0.16);
  return linear_to_srgb(max(graded - vec3<f32>(black_level), vec3<f32>(0.0))) * mix(1.0, 0.92, look_unit);
}

fn museum_toe_linear(color: vec3<f32>) -> vec3<f32> {
  let safe = max(color, vec3<f32>(0.0));
  let y = luminance(safe);
  let dark_weight = 1.0 - smoothstep(0.10, 0.34, y);
  let mid_weight = smoothstep(0.12, 0.42, y) * (1.0 - smoothstep(0.42, 0.78, y));
  let compressed = max(pow(safe, vec3<f32>(1.28)) * 1.08 - vec3<f32>(0.0035), vec3<f32>(0.0));
  let mid_contrast = max((safe - vec3<f32>(y)) * 1.055 + vec3<f32>(y * 0.985), vec3<f32>(0.0));
  return mix(safe, mix(compressed, mid_contrast, mid_weight * 0.32), clamp(dark_weight * 0.78 + mid_weight * 0.18, 0.0, 0.82));
}

fn raw_output_transform(color: vec3<f32>) -> vec3<f32> {
  let safe = clamp(color, vec3<f32>(0.0), vec3<f32>(1.35));
  let use_agx = camera.fog_params.z > 0.5;
  if (camera.color_pipeline.w > 0.5) {
    let exposure = clamp(lighting.artist_params.x, 0.82, 1.28);
    let contrast = clamp(lighting.artist_params.y, 0.90, 1.48);
    let saturation = clamp(lighting.artist_params.z, 0.86, 1.26);
    let warmth = clamp(lighting.artist_params.w, 0.0, 1.0);
    // AgX outputs sRGB-display; decode to linear so the downstream artist grade
    // (contrast/sat/warmth, all linear) and the final linear_to_srgb stay correct.
    var graded = select(museum_toe_linear(safe * exposure), srgb_to_linear(agx_tonemap(safe * exposure)), use_agx);
    let y = luminance(graded);
    graded = max((graded - vec3<f32>(y)) * contrast + vec3<f32>(y), vec3<f32>(0.0));
    graded = mix(vec3<f32>(luminance(graded)), graded, saturation);
    let warmth_tint = mix(vec3<f32>(0.98, 1.0, 1.025), vec3<f32>(1.035, 1.0, 0.945), warmth);
    return linear_to_srgb(clamp(graded * warmth_tint, vec3<f32>(0.0), vec3<f32>(1.0)));
  }
  // Non-museum: AgX replaces the old hard clip (real highlight roll-off).
  return select(linear_to_srgb(clamp(safe, vec3<f32>(0.0), vec3<f32>(1.0))), agx_tonemap(safe), use_agx);
}

fn raw_scene_output_color(color: vec3<f32>, semantic: vec4<f32>) -> vec3<f32> {
  let pipeline_enabled = camera.color_pipeline.x > 0.5;
  let post_enabled = camera.color_pipeline.y > 0.5;
  if (pipeline_enabled && post_enabled) {
    return max(color, vec3<f32>(0.0));
  }
  if (pipeline_enabled) {
    return raw_display_transform(color);
  }
  return raw_output_transform(color);
}

@fragment
fn fs_contact_shadow(input: VertexOutput) -> @location(0) vec4<f32> {
  let shadow_uv = input.local_position.xz * vec2<f32>(1.0, 1.34);
  let radial = dot(shadow_uv, shadow_uv);
  let outer = 1.0 - smoothstep(0.18, 0.92, radial * 3.15);
  let core = 1.0 - smoothstep(0.02, 0.24, radial * 3.15);
  let long_axis = 1.0 - smoothstep(0.58, 1.10, abs(shadow_uv.y));
  let contact = outer * (0.42 + core * 0.72) * (0.76 + long_axis * 0.24);
  let alpha = min(input.color.a * contact, 0.46);
  if (alpha < 0.008) {
    discard;
  }
  return vec4<f32>(0.0, 0.0, 0.0, alpha);
}

@fragment
fn fs_glass_overlay(input: VertexOutput) -> @location(0) vec4<f32> {
  let semantic = input.semantic_params;
  let glass = role_mask(semantic, 5.0) * clamp(semantic.y, 0.0, 1.0);
  if (glass < 0.012) {
    discard;
  }

  let normal = normalize(input.normal);
  let view_direction = normalize(camera.camera_position.xyz - input.world_position);
  let rim_base = 1.0 - max(dot(view_direction, normal), 0.0);
  let rim = smoothstep(0.12, 0.94, pow(rim_base, 2.2));
  let vertical_edge = smoothstep(0.18, 0.92, abs(normal.y - 0.34));
  let depth_fade = 1.0 - input.fog_amount * 0.45;
  let reflection = museum_soft_reflection(normal, view_direction, 0.11, 0.24, 0.0);
  let cyan_guard = vec3<f32>(0.030, 0.62, 0.68);
  let warm_edge = vec3<f32>(0.62, 0.50, 0.32) * role_mask(semantic, 6.0) * 0.06;
  let color = reflection * (1.15 + rim * 2.05) + cyan_guard * (0.055 + rim * 0.26) + warm_edge + input.color.rgb * 0.035;
  let alpha = clamp(glass * depth_fade * (0.035 + rim * 0.20 + vertical_edge * 0.045 + input.color.a * 0.045), 0.0, 0.25);
  if (alpha < 0.006) {
    discard;
  }
  return vec4<f32>(raw_scene_output_color(color, semantic), alpha);
}

struct HeroFloorInput {
  @location(0) position: vec3<f32>,
  @location(1) uv: vec2<f32>,
};

struct HeroFloorOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) shadow_position: vec4<f32>,
  @location(3) fog_amount: f32,
};

@vertex
fn vs_hero_floor(input: HeroFloorInput) -> HeroFloorOutput {
  let world_position = vec4<f32>(input.position, 1.0);
  var output: HeroFloorOutput;
  output.clip_position = camera.view_projection * world_position;
  output.shadow_position = shadow.view_projection * world_position;
  output.world_position = input.position;
  output.uv = input.uv;
  let fog_delta = camera.camera_position.xyz - input.position;
  let fog_distance_sq = dot(fog_delta, fog_delta);
  output.fog_amount = smoothstep(camera.fog_params.x * camera.fog_params.x, camera.fog_params.y * camera.fog_params.y, fog_distance_sq);
  return output;
}

@fragment
fn fs_hero_floor(input: HeroFloorOutput) -> @location(0) vec4<f32> {
  let normal = vec3<f32>(0.0, 1.0, 0.0);
  let view_direction = normalize(camera.camera_position.xyz - input.world_position);
  let directional_direction = lighting.directional_direction.xyz;
  let shadow_visibility_value = shadow_visibility(input.shadow_position, normal, directional_direction);
  let direct_shadow = mix(1.0, shadow_visibility_value, clamp(shadow.params.x, 0.0, 0.92));
  let directional_lambert = max(dot(normal, directional_direction), 0.0);
  let quality = clamp(lighting.light_meta.w, 0.35, 1.0);
  let texel = textureSample(hero_floor_texture, hero_floor_sampler, input.uv).rgb;
  var albedo = texel;
  let room_probe = room_probe_radiance(input.world_position, normal);
  let room_ao = room_sdf_ao(input.world_position, normal);
  let roughness = 0.44;
  let metallic = 0.36;
  let floor_bounce = lighting.room_bounce.x * (0.38 + quality * 0.34);
  var light_radiance =
    lighting.ambient.rgb * (lighting.ambient.a + lighting.light_meta.y * 0.11) +
    room_probe * 0.58 +
    vec3<f32>(0.030, 0.038, 0.036) * floor_bounce +
    lighting.directional_color.rgb * lighting.directional_direction.a * (0.030 + directional_lambert * 0.92 * direct_shadow);
  var specular_radiance =
    museum_soft_reflection(normal, view_direction, roughness, metallic, 0.0) * 0.74 +
    lighting.directional_color.rgb *
    lighting.directional_direction.a *
    fast_ggx_specular(normal, view_direction, directional_direction, roughness, 0.50) *
    0.72 *
    direct_shadow;

  let light_count = u32(min(lighting.light_meta.x, f32(MAX_SHADER_LIGHTS)));
  for (var light_index = 0u; light_index < light_count; light_index = light_index + 1u) {
    let light_position = lighting.light_positions[light_index];
    let light_color = lighting.light_colors[light_index];
    let light_params = lighting.light_params[light_index];
    let to_light = light_position.xyz - input.world_position;
    let distance_sq_to_light = max(dot(to_light, to_light), 0.000001);
    let inverse_distance_to_light = inverseSqrt(distance_sq_to_light);
    let distance_to_light = distance_sq_to_light * inverse_distance_to_light;
    let light_direction = to_light * inverse_distance_to_light;
    let radius = max(light_params.x, 0.2);
    let range_fade = clamp(1.0 - distance_to_light / radius, 0.0, 1.0);
    let attenuation = range_fade * range_fade / (1.0 + distance_sq_to_light * 0.024);
    let floor_glow = select(0.0, 1.0, light_position.w > 2.5);
    let diffuse = wrapped_diffuse(normal, light_direction, 0.28 + floor_glow * 0.24);
    let cyan_light_pressure = smoothstep(0.20, 0.88, light_color.g + light_color.b - light_color.r * 1.10);
    let hero_floor_cyan_guard = 1.0 - cyan_light_pressure * 0.58;
    light_radiance += light_color.rgb * light_color.a * attenuation * lighting.algorithm_params.w * hero_floor_cyan_guard * (0.08 + diffuse * 0.36 + floor_glow * 0.08);
    specular_radiance += light_color.rgb * light_color.a * attenuation * hero_floor_cyan_guard *
      fast_ggx_specular(normal, view_direction, light_direction, roughness, 0.48) *
      (0.12 + metallic * 0.16) * quality;
  }

  let projected_shadow = (1.0 - shadow_visibility_value) * clamp(shadow.params.x, 0.0, 0.92) * lighting.algorithm_extra.x;
  let vignette_uv = input.uv * 2.0 - vec2<f32>(1.0, 1.0);
  let baked_floor_vignette = 1.0 - smoothstep(0.62, 1.42, dot(vignette_uv, vignette_uv)) * 0.16;
  var lit_color = albedo * (0.24 + light_radiance * baked_floor_vignette) + specular_radiance;
  lit_color *= 1.0 - clamp(room_ao + projected_shadow * 0.36, 0.0, 0.58);
  lit_color += albedo * 0.045;
  let max_channel = max(max(lit_color.r, lit_color.g), lit_color.b);
  lit_color = lit_color / (1.0 + max_channel * 0.08);
  let floor_scene_color = mix(lit_color, camera.fog_color.rgb * 0.14, input.fog_amount * 0.14);
  let floor_luma = luminance(texel);
  let metal_line_hint = smoothstep(0.10, 0.34, max(max(texel.r, texel.g), texel.b) - min(min(texel.r, texel.g), texel.b));
  let detail_alpha = clamp(0.018 + metal_line_hint * 0.022 + (1.0 - floor_luma) * 0.010, 0.014, 0.048);
  let overlay_color = floor_scene_color * 0.58;
  return vec4<f32>(raw_scene_output_color(overlay_color, vec4<f32>(2.0, 0.68, 0.10, 0.24)), detail_alpha);
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let texture_layers = vec4<f32>(input.material_flags.x, input.material_flags.y, input.material_flags.z, input.material_params.x);
  let normal = apply_normal_map(normalize(input.normal), input.world_position, input.uv, texture_layers.x);
  let view_direction = normalize(camera.camera_position.xyz - input.world_position);
  let directional_direction = lighting.directional_direction.xyz;
  let directional_lambert = max(dot(normal, directional_direction), 0.0);
  let shadow_visibility_value = shadow_visibility(input.shadow_position, normal, directional_direction);
  if (shadow.params.x > 1.5) {
    return vec4<f32>(vec3<f32>(shadow_visibility_value), 1.0);
  }
  let normal_hemi = normal.y * 0.5 + 0.5;
  let shadow_strength = clamp(shadow.params.x, 0.0, 0.96);
  let shadow_receiver = smoothstep(-0.05, mix(0.46, 0.72, clamp(lighting.algorithm_extra.w, 0.0, 1.0)), normal.y) * lighting.algorithm_extra.x;
  let projected_shadow = (1.0 - shadow_visibility_value) * shadow_strength * shadow_receiver;
  let direct_shadow = mix(1.0, shadow_visibility_value, shadow_strength * shadow_receiver);
  let indirect_shadow = 1.0 - projected_shadow * (0.24 + (1.0 - normal_hemi) * 0.14);
  let hemisphere = normal_hemi * lighting.light_meta.y * 0.18;
  // Phase-1 IBL (opt-in ?rawIbl=1, default off via sh_meta.x=0): SH9 diffuse
  // irradiance (cosine-lobe weights). When disabled this is exactly vec3(0.0).
  let ibl_enabled = lighting.sh_meta.x;
  let ibl_intensity = lighting.sh_meta.y;
  let sh_probe_proxy = eval_sh9(normal, 1.0, 0.6667, 0.25) * (ibl_enabled * ibl_intensity);
  let room_probe = room_probe_radiance(input.world_position, normal);
  let room_ao = room_sdf_ao(input.world_position, normal);
  let material_kind = input.material_kind;
  let semantic = input.semantic_params;
  let semantic_color_enabled = select(0.0, 1.0, camera.color_pipeline.z > 0.5);
  let semantic_identity = clamp(semantic.y, 0.0, 1.0);
  let authored_color_authority = select(0.0, 1.0, input.palette_color.a <= 0.001);
  let semantic_local_light = clamp(semantic.z, 0.0, 1.4);
  let semantic_occlusion = clamp(semantic.w, 0.0, 1.4);
  let glass_role = role_mask(semantic, 5.0);
  let exhibit_role = role_mask(semantic, 6.0);
  let cyan_role = role_mask(semantic, 7.0);
  let route_role = role_mask(semantic, 8.0);
  let danger_role = role_mask(semantic, 9.0);
  let screen_role = role_mask(semantic, 10.0);
  let door_locked_role = role_mask(semantic, 12.0);
  let door_access_role = role_mask(semantic, 13.0);
  let pickup_health_role = role_mask(semantic, 14.0);
  let pickup_energy_role = role_mask(semantic, 15.0);
  let pickup_ammo_role = role_mask(semantic, 16.0);
  let pickup_key_role = role_mask(semantic, 17.0);
  let switch_active_role = role_mask(semantic, 18.0);
  let switch_inactive_role = role_mask(semantic, 19.0);
  let gameplay_pickup_role = clamp(pickup_health_role + pickup_energy_role + pickup_ammo_role + pickup_key_role, 0.0, 1.0);
  let gameplay_status_role = clamp(door_locked_role + door_access_role + switch_active_role + switch_inactive_role, 0.0, 1.0);
  let neutral_surface_role = clamp(role_mask(semantic, 1.0) + role_mask(semantic, 2.0) + role_mask(semantic, 3.0) + role_mask(semantic, 4.0), 0.0, 1.0);
  let service_elevator_look = clamp(lighting.sh_meta.w, 0.0, 1.0);
  let debug_mode = camera.visual_params.w;
  let alpha_mode = input.material_alpha_flags.x;
  let explicit_glass_material = max(glass_role, select(0.0, 1.0, material_kind > 5.5 && material_kind < 6.5));
  let alpha_blended_hud_material = select(0.0, 1.0, alpha_mode > 1.5) * clamp(screen_role + gameplay_pickup_role, 0.0, 1.0);
  let transparent_material = clamp(explicit_glass_material * semantic_identity + alpha_blended_hud_material, 0.0, 1.0);
  if (transparent_material > 0.012 && debug_mode < 0.5 && shadow.params.x <= 1.5) {
    discard;
  }
  if (debug_mode > 3.5) {
    return vec4<f32>(semantic_role_color(semantic), 1.0);
  }
  let quality = clamp(lighting.light_meta.w, 0.35, 1.0);
  let base_texture_weight = raw_base_color_weight(input.material_flags.w);
  let texture_luma = clamp(input.texture_stats.x, 0.0, 1.0);
  let texture_contrast = clamp(input.texture_stats.y, 0.0, 1.0);
  let texture_chroma = clamp(input.texture_stats.z, 0.0, 1.0);
  let texture_detail = clamp(input.texture_stats.w, 0.0, 1.0);
  let texture_flatness = base_texture_weight * clamp(1.0 - texture_contrast * 0.82 - texture_detail * 1.42, 0.0, 1.0);
  let low_luma_guard = texture_flatness * (1.0 - smoothstep(0.22, 0.62, texture_luma));
  var roughness = clamp(input.material_params.y, 0.045, 0.98);
  var metallic = clamp(input.material_params.z, 0.0, 1.0);
  roughness = clamp(roughness + texture_flatness * 0.15 + low_luma_guard * 0.06 - texture_detail * base_texture_weight * 0.05, 0.055, 0.985);
  metallic = clamp(metallic * (1.0 - texture_flatness * 0.18) + texture_detail * base_texture_weight * 0.035, 0.0, 1.0);
  roughness = clamp(
    roughness + (neutral_surface_role * semantic_identity * 0.055 - glass_role * semantic_identity * 0.20 -
      route_role * semantic_identity * 0.075 - screen_role * semantic_identity * 0.05 -
      (door_access_role + switch_active_role + pickup_energy_role + pickup_key_role) * semantic_identity * 0.045 +
      pickup_health_role * semantic_identity * 0.035) * semantic_color_enabled,
    0.045,
    0.985,
  );
  metallic = clamp(
    metallic + (route_role * semantic_identity * 0.12 + exhibit_role * semantic_identity * 0.08 - glass_role * semantic_identity * 0.10 +
      (door_access_role + pickup_energy_role + pickup_key_role + switch_active_role) * semantic_identity * 0.08 +
      pickup_ammo_role * semantic_identity * 0.10) * semantic_color_enabled,
    0.0,
    1.0,
  );
  let orm_sample = sample_raw_material_texture(input.uv, texture_layers.y);
  let orm_weight = raw_texture_layer_weight(texture_layers.y);
  roughness = clamp(mix(roughness, clamp(orm_sample.g, 0.045, 1.0), orm_weight * 0.86), 0.045, 0.985);
  metallic = clamp(mix(metallic, clamp(orm_sample.b, 0.0, 1.0), orm_weight * 0.92), 0.0, 1.0);
  let ao_sample = sample_raw_material_texture(input.uv, texture_layers.z).r;
  let ao_weight = raw_texture_layer_weight(texture_layers.z);
  let material_ao = clamp(input.material_params.w * mix(1.0, ao_sample, ao_weight), 0.0, 1.0);
  // AO modulates only INDIRECT light. Direct key light is left untouched so
  // shapes stay readable in the dark museum (PDF guidance).
  let ao_indirect_diffuse = material_ao;
  let ao_indirect_specular = mix(1.0, material_ao, 0.25 + 0.75 * (1.0 - roughness));
  let texture_mask = base_texture_weight;
  let robot_mask = max(robot_material_mask(material_kind), role_mask(semantic, 11.0));
  let red_affordance_role = clamp(danger_role + door_locked_role + pickup_health_role * 0.72 + switch_inactive_role, 0.0, 1.0);
  let warning_mask = max(select(0.0, 1.0, material_kind > 4.5 && material_kind < 5.5), red_affordance_role);
  let emissive_sample = srgb_to_linear(sample_raw_material_texture(input.uv, texture_layers.w));
  let emissive_sample_weight = raw_texture_layer_weight(texture_layers.w);
  let emissive_sample_peak = max(max(emissive_sample.r, emissive_sample.g), emissive_sample.b);
  var resolved_emissive_color = mix(input.emissive_color, emissive_sample, emissive_sample_weight * 0.92);
  var resolved_emissive_strength = clamp(input.emissive + emissive_sample_weight * emissive_sample_peak * 1.45, 0.0, 4.0);
  let service_elevator_cyan_emit = clamp(cyan_role + screen_role + door_access_role + switch_active_role, 0.0, 1.0) * service_elevator_look;
  resolved_emissive_color = mix(resolved_emissive_color, vec3<f32>(0.02, 0.72, 0.82), service_elevator_cyan_emit * 0.58);
  resolved_emissive_strength = clamp(resolved_emissive_strength + service_elevator_cyan_emit * 0.62, 0.0, 4.0);
  let rim_base = 1.0 - max(dot(view_direction, normal), 0.0);
  let rim = rim_base * rim_base;
  let silhouette_gain = rim * (0.10 + robot_mask * 0.16) * (0.58 + lighting.light_meta.y * 0.22);
  let texture_reflection_guard = clamp(1.0 - texture_flatness * 0.24 - low_luma_guard * 0.10, 0.62, 1.0);
  let material_specular = clamp((material_specular_strength(material_kind, roughness) + metallic * (0.32 + (1.0 - roughness) * 0.46)) * texture_reflection_guard * semantic_specular_scale(semantic), 0.02, 1.55);
  var base_color = input.color.rgb;
  let sampled_base_color = sample_raw_base_color(input.uv, input.material_flags.w);
  let texture_authority = base_texture_weight * select(0.0, 1.0, input.material_flags.w >= 0.5);
  let color_authority = max(texture_authority, authored_color_authority);
  let texture_tint_weight = clamp(0.10 + texture_flatness * 0.06 - texture_chroma * 0.04, 0.06, 0.18) * (1.0 - color_authority);
  let texture_albedo = sampled_base_color * mix(vec3<f32>(1.0), max(input.color.rgb, vec3<f32>(0.04)), texture_tint_weight);
  let base_texture_mix = base_texture_weight * mix(clamp(0.92 + texture_detail * 0.06 + texture_contrast * 0.03, 0.92, 0.995), 1.0, color_authority);
  base_color = mix(base_color, texture_albedo, base_texture_mix);
  let robot_instance_tint_weight = robot_mask * base_texture_weight * clamp(input.color.a * 1.95, 0.0, 0.22);
  let robot_instance_tint = max(input.color.rgb, vec3<f32>(0.08, 0.08, 0.08));
  base_color = mix(base_color, base_color * robot_instance_tint, robot_instance_tint_weight);
  base_color += robot_mask * base_texture_weight * robot_instance_tint * clamp(input.color.a * 0.055, 0.0, 0.025);
  let uv_relief = procedural_texture_relief(input.uv, texture_mask, material_kind, roughness) * (1.0 - base_texture_weight * 0.55);
  base_color *= 1.0 + uv_relief;
  let semantic_base_color = semantic_material_albedo(base_color, semantic, material_kind, base_texture_weight, input.palette_color);
  base_color = mix(base_color, mix(semantic_base_color, base_color, color_authority), semantic_color_enabled);
  let authored_style_guard = 1.0 - max(authored_color_authority, texture_authority * 0.96);
  let semantic_effect_identity = semantic_identity * authored_style_guard * semantic_color_enabled;
  let floor_role = role_mask(semantic, 2.0) * semantic_identity * authored_style_guard * semantic_color_enabled;
  let ceiling_role = role_mask(semantic, 3.0) * semantic_identity * authored_style_guard * semantic_color_enabled;
  let service_elevator_shell_role = clamp(neutral_surface_role + glass_role * 0.45, 0.0, 1.0) * service_elevator_look;
  let service_elevator_dark_anchor = vec3<f32>(0.006, 0.012, 0.013);
  let service_elevator_smoked_base = mix(service_elevator_dark_anchor, base_color * vec3<f32>(0.46, 0.54, 0.52), smoothstep(0.025, 0.18, luminance(base_color)));
  base_color = mix(base_color, service_elevator_smoked_base, service_elevator_shell_role * 0.48);
  let room_shell_dark_role = clamp(floor_role + ceiling_role, 0.0, 1.0);
  let shell_luma = luminance(base_color);
  let fallback_shell_guard = 1.0 - clamp(texture_authority + authored_color_authority, 0.0, 1.0);
  let warm_floor_anchor = vec3<f32>(shell_luma * 0.56, shell_luma * 0.44, shell_luma * 0.28);
  let warm_ceiling_anchor = vec3<f32>(shell_luma * 0.78, shell_luma * 0.72, shell_luma * 0.58);
  base_color = mix(base_color, warm_floor_anchor, floor_role * fallback_shell_guard * 0.18);
  base_color = mix(base_color, warm_ceiling_anchor, ceiling_role * fallback_shell_guard * 0.06);
  let glass_identity = glass_role * semantic_identity * authored_style_guard;
  let glass_edge_fresnel = smoothstep(0.10, 0.92, rim_base);
  let glass_absorption = vec3<f32>(0.030, 0.070, 0.074) + base_color * vec3<f32>(0.35, 0.56, 0.58);
  base_color = mix(base_color, glass_absorption, glass_identity * mix(0.34, 0.62, glass_edge_fresnel));
  let dark_material_lift = clamp(0.48 - luminance(base_color), 0.0, 0.16) * (0.32 + robot_mask * 0.48);
  base_color += vec3<f32>(dark_material_lift * 0.34, dark_material_lift * 0.34, dark_material_lift * 0.30);
  let red_excess = max(base_color.r - max(base_color.g, base_color.b) * 1.34, 0.0);
  let cheap_red_guard = clamp(red_excess * (1.0 - warning_mask * 0.68) * (1.0 - resolved_emissive_strength * 0.35), 0.0, 0.34);
  base_color = vec3<f32>(
    base_color.r * (1.0 - cheap_red_guard * 0.18),
    base_color.g + cheap_red_guard * 0.13,
    base_color.b + cheap_red_guard * 0.08
  );
  if (debug_mode > 0.5 && debug_mode < 1.5) {
    return vec4<f32>(linear_to_srgb(clamp(base_color, vec3<f32>(0.0), vec3<f32>(1.0))), 1.0);
  }
  let floor_proximity = clamp((2.75 - input.world_position.y) * 0.389, 0.0, 1.0);
  let floor_bounce = floor_proximity * (0.10 + (1.0 - normal_hemi) * 0.26) * lighting.room_bounce.x * quality * (1.0 - floor_role * 0.16);
  let ceiling_wash = vec3<f32>(0.044, 0.043, 0.039) * clamp((input.world_position.y - 1.55) * 0.5, 0.0, 1.0) * (0.08 + normal_hemi * 0.12) * lighting.room_bounce.y * quality;
  let side_fill = ((1.0 - abs(normal.x)) * 0.034 + (1.0 - abs(normal.z)) * 0.028) * lighting.room_bounce.z * quality;
  let low_ceiling_occlusion = clamp((2.95 - input.world_position.y) * 0.24, 0.0, 0.42) * (1.0 - normal_hemi * 0.54);
  let floor_receiver_shade = clamp((input.world_position.y - 0.08) * 0.36, 0.0, 0.28) * normal_hemi;
  // Indirect diffuse (ambient/SH/probe/bounce/fill) is gated by material_ao;
  // the directional KEY term is added AFTER so AO never cancels direct light.
  let indirect_diffuse =
    lighting.ambient.rgb * (lighting.ambient.a + hemisphere * 0.66) * indirect_shadow +
    (sh_probe_proxy + room_probe) * (1.0 - projected_shadow * 0.16) +
    vec3<f32>(0.034, 0.033, 0.030) * floor_bounce * (1.0 - projected_shadow * 0.18) +
    ceiling_wash * (1.0 - projected_shadow * 0.18) +
    vec3<f32>(0.030, 0.030, 0.027) * side_fill * (1.0 - projected_shadow * 0.22);
  var light_radiance =
    indirect_diffuse * ao_indirect_diffuse +
    lighting.directional_color.rgb * lighting.directional_direction.a * (0.026 + directional_lambert * 1.08 * direct_shadow + rim * 0.052);
  let look_unit = clamp(camera.fog_params.w / 1.35, 0.0, 1.0);
  light_radiance *= mix(1.0, 0.78, look_unit);
  light_radiance = semantic_cyan_rebalance(
    light_radiance,
    (neutral_surface_role * 0.12 + floor_role * 0.10 + ceiling_role * 0.08) * semantic_identity * semantic_color_enabled,
  );
  light_radiance += (
    exhibit_role * vec3<f32>(0.030, 0.018, 0.006) +
      route_role * vec3<f32>(0.040, 0.025, 0.006) +
      screen_role * vec3<f32>(0.0, 0.010, 0.014) +
      (door_locked_role + switch_inactive_role) * vec3<f32>(0.034, 0.006, 0.003) +
      (door_access_role + switch_active_role) * vec3<f32>(0.0, 0.012, 0.016) +
      (pickup_energy_role + pickup_key_role) * vec3<f32>(0.046, 0.024, 0.004) +
      pickup_health_role * vec3<f32>(0.024, 0.018, 0.010)
  ) * semantic_effect_identity;
  // Magnitude-safe coloured metal F0: tint ONLY direct specular by
  // mix(white, base_color, metallic). Dielectrics stay white; metals pick up
  // brass/copper/gold hue. IBL + museum_soft_reflection keep their own f0.
  let direct_specular_tint = mix(vec3<f32>(1.0), base_color, metallic);
  var specular_radiance =
    lighting.directional_color.rgb *
    lighting.directional_direction.a *
    (specular_layer(normal, view_direction, directional_direction, roughness) * 0.38 +
      fast_ggx_specular(normal, view_direction, directional_direction, roughness, material_specular) * 1.22) *
    (0.24 + directional_lambert * 0.72) *
    quality *
    direct_shadow *
    direct_specular_tint;
  specular_radiance *= mix(1.0, 0.90, look_unit);
  let metal_edge = pow(rim_base, 2.35) * metallic * (1.0 - roughness * 0.42) * quality * lighting.algorithm_params.z;
  let floor_reflection = 0.0;
  specular_radiance += museum_soft_reflection(normal, view_direction, roughness, metallic, robot_mask) * (0.74 + normal_hemi * 0.26) * texture_reflection_guard * ao_indirect_specular;
  // Phase-1 IBL specular: colored environment reflection from the SH9 radiance
  // (raw weights) modulated by the analytic env-BRDF. Metals (F0=albedo) now
  // reflect the room colour instead of a flat grey band. Opt-in (ibl_enabled).
  let ibl_reflect_dir = reflect(-view_direction, normal);
  let ibl_n_dot_v = max(dot(normal, view_direction), 0.0);
  let ibl_f0 = mix(vec3<f32>(0.04), base_color, metallic);
  // Real prefiltered specular cube + DFG LUT (split-sum) when ?rawCube=1
  // (lighting.sh_meta.z); otherwise the analytic SH-environment approximation.
  // textureSampleLevel (explicit LOD) — no derivatives, safe in any branch.
  let ibl_cube_lod = clamp(roughness, 0.0, 1.0) * 4.0;
  let ibl_cube_radiance = textureSampleLevel(raw_ibl_specular_cube, raw_ibl_specular_sampler, ibl_reflect_dir, ibl_cube_lod).rgb;
  let ibl_dfg = textureSampleLevel(raw_ibl_brdf_lut, raw_ibl_lut_sampler, vec2<f32>(ibl_n_dot_v, roughness), 0.0).rg;
  let ibl_cube_specular = ibl_cube_radiance * (ibl_f0 * ibl_dfg.x + vec3<f32>(ibl_dfg.y));
  let ibl_analytic_specular = eval_sh9(ibl_reflect_dir, 1.0, 1.0, 1.0) * env_brdf_approx(ibl_f0, roughness, ibl_n_dot_v);
  let ibl_specular_term = select(ibl_analytic_specular, ibl_cube_specular, lighting.sh_meta.z > 0.5);
  specular_radiance += ibl_specular_term * (ibl_enabled * ibl_intensity) * texture_reflection_guard * ao_indirect_specular;
  specular_radiance += (vec3<f32>(0.44, 0.42, 0.36) * 0.30 + base_color * 0.22) * metal_edge;
  specular_radiance += vec3<f32>(0.052, 0.050, 0.044) * floor_reflection * clamp(camera.fog_params.w, 0.0, 1.75) * 0.24;
  specular_radiance += vec3<f32>(0.72, 0.50, 0.20) * (route_role * 0.030 + exhibit_role * 0.020 + pickup_energy_role * 0.024 + pickup_key_role * 0.034) * semantic_effect_identity * (1.0 + rim);
  let shell_cyan_specular_guard = 1.0 - clamp(floor_role * 0.24 + ceiling_role * 0.18 + neutral_surface_role * 0.10, 0.0, 0.42);
  specular_radiance += vec3<f32>(0.42, 0.62, 0.62) *
    (glass_role * 0.018 + screen_role * 0.014 + cyan_role * 0.010 + door_access_role * 0.012 + switch_active_role * 0.012) *
    semantic_effect_identity * (1.0 + rim * 1.7) * shell_cyan_specular_guard;
  specular_radiance += vec3<f32>(0.78, 0.18, 0.10) * (door_locked_role * 0.018 + switch_inactive_role * 0.018) * semantic_effect_identity * (1.0 + rim);
  specular_radiance += museum_soft_reflection(normal, view_direction, max(roughness * 0.55, 0.08), metallic + 0.18, 0.0) *
    glass_identity *
    (0.30 + glass_edge_fresnel * 1.35) *
    texture_reflection_guard;

  let light_count = u32(min(lighting.light_meta.x, f32(MAX_SHADER_LIGHTS)));
  for (var light_index = 0u; light_index < light_count; light_index = light_index + 1u) {
    let light_position = lighting.light_positions[light_index];
    let light_color = lighting.light_colors[light_index];
    let light_params = lighting.light_params[light_index];
    let to_light = light_position.xyz - input.world_position;
    let distance_sq_to_light = max(dot(to_light, to_light), 0.000001);
    let inverse_distance_to_light = inverseSqrt(distance_sq_to_light);
    let distance_to_light = distance_sq_to_light * inverse_distance_to_light;
    let light_direction = to_light * inverse_distance_to_light;
    let radius = max(light_params.x, 0.2);
    let range_fade = clamp(1.0 - distance_to_light / radius, 0.0, 1.0);
    let range_fade2 = range_fade * range_fade;
    let range_fade4 = range_fade2 * range_fade2;
    let attenuation = mix(range_fade2, range_fade4, clamp(light_params.y * 0.42 - 0.35, 0.0, 1.0)) / (1.0 + distance_sq_to_light * 0.026);
    let diffuse = max(dot(normal, light_direction), 0.0);
    let area_light = select(0.0, 1.0, light_position.w > 1.5 && light_position.w < 2.5);
    let floor_glow = select(0.0, 1.0, light_position.w > 2.5);
    let cyan_light_pressure = smoothstep(0.20, 0.88, light_color.g + light_color.b - light_color.r * 1.10);
    let shell_surface_role = clamp(floor_role + ceiling_role + neutral_surface_role * 0.32, 0.0, 1.0);
    let shell_cyan_light_guard = 1.0 - shell_surface_role * cyan_light_pressure * 0.78;
    let shaped_diffuse = mix(diffuse, wrapped_diffuse(normal, light_direction, 0.36 + floor_glow * 0.28), clamp(area_light + floor_glow, 0.0, 1.0));
    let area_softness = 0.060 + area_light * 0.16 + floor_glow * 0.11;
    let floor_pool = floor_glow * (0.16 + normal_hemi * 0.12 + (1.0 - input.fog_amount) * 0.06);
    let material_light_gain = 1.0 + robot_mask * 0.14 + metallic * 0.16 + resolved_emissive_strength * 0.26 + semantic_local_light * 0.28 * authored_style_guard +
      (exhibit_role * 0.16 + route_role * 0.18 + glass_role * 0.08 + screen_role * 0.12 +
        gameplay_pickup_role * 0.12 + gameplay_status_role * 0.10 + pickup_energy_role * 0.10 + pickup_key_role * 0.08) * semantic_effect_identity;
    light_radiance += light_color.rgb * light_color.a * attenuation * material_light_gain * lighting.algorithm_params.w * shell_cyan_light_guard *
      (area_softness + floor_pool + shaped_diffuse * (0.88 - floor_glow * 0.24));
    specular_radiance += light_color.rgb * light_color.a * attenuation * shell_cyan_light_guard *
      fast_ggx_specular(normal, view_direction, light_direction, roughness, material_specular) *
      (0.42 + area_light * 0.30 + metallic * 0.18) * quality * lighting.algorithm_params.w * texture_reflection_guard *
      direct_specular_tint;
  }

  let contact_height = clamp((1.18 - input.world_position.y) * 0.877, 0.0, 1.0);
  let contact_orientation = 1.0 - max(normal.y, 0.0) * 0.72;
  let contact_shadow = clamp(contact_height * contact_orientation * (0.16 + robot_mask * 0.18) * lighting.room_bounce.w * lighting.algorithm_extra.z * (0.88 + quality * 0.34), 0.0, 0.54);
  let object_grounding_shadow = clamp(
    contact_height *
      contact_orientation *
      (robot_mask * 0.18 + exhibit_role * 0.12 + glass_role * 0.10 + screen_role * 0.08 + route_role * 0.05 + gameplay_pickup_role * 0.10 + gameplay_status_role * 0.06) *
      semantic_effect_identity *
      (0.70 + ao_weight * 0.35),
    0.0,
    0.22,
  );
  let unlit_side_shadow = clamp((0.60 - directional_lambert) * (0.090 + robot_mask * 0.085) * lighting.room_bounce.w * quality, 0.0, 0.24);
  let silhouette_color = mix(vec3<f32>(0.34, 0.36, 0.33), base_color, 0.58);
  // material_ao now lives on the indirect terms (ao_indirect_*); keep only a small
  // robot-only crease residual instead of multiplying the full lit_color.
  let material_ao_shadow = (1.0 - material_ao) * (robot_mask * 0.08);
  let emissive_tint = mix(base_color, resolved_emissive_color, smoothstep(0.04, 0.42, resolved_emissive_strength));
  let emissive_core = emissive_tint * resolved_emissive_strength * (0.95 + lighting.light_meta.z * 0.42);
  let emissive_halo = emissive_tint * smoothstep(0.05, 1.05, resolved_emissive_strength) * (0.18 + rim * 0.42 + (1.0 - roughness) * 0.12);
  let semantic_hint = base_color * (
    route_role * 0.050 +
      exhibit_role * 0.028 +
      robot_mask * 0.036 +
      screen_role * 0.052 +
      cyan_role * 0.028 +
      danger_role * 0.030 +
      door_locked_role * 0.052 +
      door_access_role * 0.048 +
      pickup_health_role * 0.026 +
      pickup_energy_role * 0.060 +
      pickup_key_role * 0.050 +
      switch_active_role * 0.050 +
      switch_inactive_role * 0.046
  ) * semantic_effect_identity;
  let emissive_hint = emissive_core + emissive_halo + base_color * input.color.a * 0.052 + semantic_hint;
  var lit_color = base_color * light_radiance + specular_radiance + silhouette_color * silhouette_gain + emissive_hint;
  let semantic_crease_shadow = semantic_occlusion * (room_ao * 0.30 + contact_shadow * 0.18 + projected_shadow * 0.06);
  let semantic_grounding = semantic_grounding_shadow(input.world_position, normal, semantic);
  let total_occlusion = clamp(
    contact_shadow +
      unlit_side_shadow +
      projected_shadow * (0.40 + (1.0 - normal_hemi) * 0.18) +
      room_ao +
      material_ao_shadow +
      object_grounding_shadow +
      semantic_crease_shadow +
      semantic_grounding +
      low_ceiling_occlusion * 0.42 +
      floor_receiver_shade * 0.16,
    0.0,
    0.82,
  );
  lit_color *= 1.0 - total_occlusion;
  lit_color += robot_mask * semantic_identity * semantic_color_enabled * (base_color * 0.030 + vec3<f32>(0.010, 0.011, 0.010));
  let luster_color = museum_luster_color(
    lit_color,
    base_color,
    specular_radiance,
    normal,
    view_direction,
    semantic,
    roughness,
    metallic,
    texture_chroma,
    texture_detail,
    color_authority
  );
  lit_color = mix(lit_color, luster_color, semantic_color_enabled);
  let max_channel = max(max(lit_color.r, lit_color.g), lit_color.b);
  lit_color = lit_color / (1.0 + max_channel * 0.11);
  if (debug_mode > 2.5 && debug_mode < 3.5) {
    let lighting_debug = clamp(light_radiance * 1.8 + specular_radiance * 0.55, vec3<f32>(0.0), vec3<f32>(1.0));
    return vec4<f32>(linear_to_srgb(lighting_debug), 1.0);
  }
  let shadow_ink = projected_shadow * (0.24 + (1.0 - normal_hemi) * 0.12) * lighting.room_bounce.w * lighting.algorithm_extra.x;
  let look = clamp(camera.fog_params.w, 0.0, 1.75);
  let texture_readability = base_texture_weight * clamp(texture_contrast * 0.85 + texture_detail * 1.55, 0.0, 1.0);
  let director_fog_guard = clamp(camera.visual_params.y, 0.0, 1.0);
  let guarded_fog = input.fog_amount * mix(0.88, 0.62, texture_readability) * (1.0 - director_fog_guard * (0.14 + texture_readability * 0.18)) * (1.0 - room_shell_dark_role * 0.32);
  if (debug_mode > 1.5 && debug_mode < 2.5) {
    return vec4<f32>(vec3<f32>(guarded_fog), 1.0);
  }
  let depth_shadow = smoothstep(0.12, 0.82, guarded_fog) * look * 0.24;
  var color = mix(lit_color, camera.fog_color.rgb, guarded_fog) * max(0.35, 1.0 - shadow_ink - depth_shadow);
  let shell_final_luma = luminance(color);
  let floor_final_anchor = vec3<f32>(0.006 + shell_final_luma * 0.46, 0.008 + shell_final_luma * 0.36, 0.007 + shell_final_luma * 0.22);
  let ceiling_final_anchor = vec3<f32>(shell_final_luma * 0.76, shell_final_luma * 0.70, shell_final_luma * 0.56);
  let shell_final_guard = 1.0 - clamp(texture_authority + authored_color_authority, 0.0, 1.0);
  color = mix(color, floor_final_anchor, floor_role * shell_final_guard * 0.20);
  color = mix(color, ceiling_final_anchor, ceiling_role * shell_final_guard * 0.16);
  return vec4<f32>(raw_scene_output_color(color, semantic), 1.0);
}

struct FullscreenOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_fullscreen(@builtin(vertex_index) vertex_index: u32) -> FullscreenOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(3.0, 1.0),
    vec2<f32>(-1.0, 1.0),
  );
  let position = positions[vertex_index];
  var output: FullscreenOutput;
  output.clip_position = vec4<f32>(position, 0.0, 1.0);
  output.uv = vec2<f32>(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return output;
}

fn saturated_bloom(color: vec3<f32>) -> vec3<f32> {
  let high = max(max(color.r, color.g), color.b);
  let low = min(min(color.r, color.g), color.b);
  let chroma = high - low;
  let saturation = chroma / max(high, 0.001);
  let bright_mask = smoothstep(bloom.params.w * 0.92, bloom.params.w + 0.24, high);
  let chroma_mask = smoothstep(0.16, 0.46, saturation) * smoothstep(0.070, 0.28, chroma);
  let cyan_bias = smoothstep(0.42, 0.92, color.g + color.b - color.r * 0.78);
  let amber_bias = smoothstep(0.42, 0.95, color.r + color.g * 0.70 - color.b * 0.85);
  let mask = bright_mask * chroma_mask * max(0.70, max(cyan_bias, amber_bias));
  return color * mask;
}

fn sample_bloom_scene(uv: vec2<f32>) -> vec3<f32> {
  return textureSampleLevel(bloom_scene, bloom_sampler, clamp(uv, vec2<f32>(0.0), vec2<f32>(1.0)), 0.0).rgb;
}

fn fxaa_scene_color(uv: vec2<f32>, pixel: vec2<i32>, texel: vec2<f32>, strength: f32) -> vec3<f32> {
  let base = textureLoad(bloom_scene, pixel, 0).rgb;
  let fxaa_strength = clamp(strength, 0.0, 1.25);

  let nw = sample_bloom_scene(uv + vec2<f32>(-texel.x, -texel.y));
  let ne = sample_bloom_scene(uv + vec2<f32>(texel.x, -texel.y));
  let sw = sample_bloom_scene(uv + vec2<f32>(-texel.x, texel.y));
  let se = sample_bloom_scene(uv + vec2<f32>(texel.x, texel.y));
  let luma_m = luminance(base);
  let luma_nw = luminance(nw);
  let luma_ne = luminance(ne);
  let luma_sw = luminance(sw);
  let luma_se = luminance(se);
  let luma_min = min(luma_m, min(min(luma_nw, luma_ne), min(luma_sw, luma_se)));
  let luma_max = max(luma_m, max(max(luma_nw, luma_ne), max(luma_sw, luma_se)));
  let range = luma_max - luma_min;
  let threshold = max(0.025, luma_max * mix(0.145, 0.095, clamp(fxaa_strength, 0.0, 1.0)));
  let edge_enable = select(0.0, 1.0, range >= threshold);

  var dir = vec2<f32>(
    -((luma_nw + luma_ne) - (luma_sw + luma_se)),
    (luma_nw + luma_sw) - (luma_ne + luma_se)
  );
  let dir_reduce = max((luma_nw + luma_ne + luma_sw + luma_se) * 0.03125, 0.0078125);
  let reciprocal_dir_min = 1.0 / (min(abs(dir.x), abs(dir.y)) + dir_reduce);
  dir = clamp(dir * reciprocal_dir_min, vec2<f32>(-8.0), vec2<f32>(8.0)) * texel * mix(0.62, 1.06, clamp(fxaa_strength, 0.0, 1.0));

  let rgb_a = 0.5 * (
    sample_bloom_scene(uv + dir * (1.0 / 3.0 - 0.5)) +
    sample_bloom_scene(uv + dir * (2.0 / 3.0 - 0.5))
  );
  let rgb_b = rgb_a * 0.5 + 0.25 * (
    sample_bloom_scene(uv + dir * -0.5) +
    sample_bloom_scene(uv + dir * 0.5)
  );
  let luma_b = luminance(rgb_b);
  let filtered = select(rgb_b, rgb_a, luma_b < luma_min || luma_b > luma_max);
  return mix(base, filtered, clamp(fxaa_strength, 0.0, 1.0) * edge_enable);
}

@fragment
fn fs_bloom_composite(input: FullscreenOutput) -> @location(0) vec4<f32> {
  let uv = input.uv;
  let look = clamp(camera.fog_params.w, 0.0, 1.75);
  let bloom_texel = bloom.params.xy * bloom.grade.x * mix(1.0, 1.7, look);
  let pixel = vec2<i32>(input.clip_position.xy);
  let base = fxaa_scene_color(uv, pixel, bloom.params.xy, bloom.grade.z);

  var glow = saturated_bloom(base) * 0.28;
  glow += saturated_bloom(sample_bloom_scene(uv + vec2<f32>(bloom_texel.x, 0.0))) * 0.14;
  glow += saturated_bloom(sample_bloom_scene(uv - vec2<f32>(bloom_texel.x, 0.0))) * 0.14;
  glow += saturated_bloom(sample_bloom_scene(uv + vec2<f32>(0.0, bloom_texel.y))) * 0.14;
  glow += saturated_bloom(sample_bloom_scene(uv - vec2<f32>(0.0, bloom_texel.y))) * 0.14;
  glow += saturated_bloom(sample_bloom_scene(uv + bloom_texel)) * 0.060;
  glow += saturated_bloom(sample_bloom_scene(uv - bloom_texel)) * 0.060;
  glow += saturated_bloom(sample_bloom_scene(uv + vec2<f32>(bloom_texel.x, -bloom_texel.y))) * 0.060;
  glow += saturated_bloom(sample_bloom_scene(uv + vec2<f32>(-bloom_texel.x, bloom_texel.y))) * 0.060;

  let bloom_strength = bloom.params.z * bloom.grade.y * mix(1.0, 1.12, look);
  var color = base + glow * bloom_strength;
  let screen = uv * 2.0 - vec2<f32>(1.0, 1.0);
  let vignette = 1.0 - smoothstep(0.18, 1.42, dot(screen, screen));
  color *= mix(1.0, mix(0.58, 1.08, vignette), look);
  let scan = 0.985 + sin(input.clip_position.y * 2.62) * 0.010 * look;
  color *= scan;
  let display_color = select(raw_output_transform(color), raw_display_transform(color), camera.color_pipeline.x > 0.5);
  return vec4<f32>(display_color, 1.0);
}
