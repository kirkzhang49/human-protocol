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
};

struct ShadowUniform {
  view_projection: mat4x4<f32>,
  params: vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniform;
@group(0) @binding(1) var<storage, read> instances: array<Instance>;
@group(0) @binding(2) var<uniform> lighting: LightingUniform;
@group(0) @binding(3) var<uniform> shadow: ShadowUniform;
@group(0) @binding(4) var shadow_depth: texture_depth_2d;
@group(0) @binding(5) var shadow_sampler: sampler_comparison;
@group(0) @binding(6) var<storage, read> raw_materials: array<RawMaterial>;
@group(0) @binding(7) var<storage, read> robot_joint_matrices: array<mat4x4<f32>>;
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

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  // location 2 (tangent) removed — unused.
  @location(3) uv: vec2<f32>,
  @location(4) material_index: f32,
  @location(5) rigid_joint_index: f32,
  @builtin(instance_index) instance_index: u32,
};

struct TransparentVertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) world_position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) color: vec4<f32>,
  @location(3) uv: vec2<f32>,
  @location(4) material_kind: f32,
  @location(5) emissive: vec4<f32>,
  @location(6) flags: vec4<f32>,
  @location(7) texture_layers: vec4<f32>,
  @location(8) semantic_params: vec4<f32>,
  @location(9) palette_color: vec4<f32>,
  @location(10) texture_stats: vec4<f32>,
  @location(11) fog_amount: f32,
  @location(12) ndc_depth: f32,
};

fn luminance(color: vec3<f32>) -> f32 {
  return dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
}

fn pow5(value: f32) -> f32 {
  let v2 = value * value;
  return v2 * v2 * value;
}

fn linear_to_srgb(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(1.0 / 2.2));
}

fn srgb_to_linear(color: vec3<f32>) -> vec3<f32> {
  return pow(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), vec3<f32>(2.2));
}

fn aces_film(color: vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

fn role_mask(semantic: vec4<f32>, role: f32) -> f32 {
  return 1.0 - step(0.5, abs(semantic.x - role));
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

fn museum_toe_linear(color: vec3<f32>) -> vec3<f32> {
  let safe = max(color, vec3<f32>(0.0));
  let y = luminance(safe);
  let dark_weight = 1.0 - smoothstep(0.10, 0.34, y);
  let mid_weight = smoothstep(0.12, 0.42, y) * (1.0 - smoothstep(0.42, 0.78, y));
  let compressed = max(pow(safe, vec3<f32>(1.28)) * 1.08 - vec3<f32>(0.0035), vec3<f32>(0.0));
  let mid_contrast = max((safe - vec3<f32>(y)) * 1.055 + vec3<f32>(y * 0.985), vec3<f32>(0.0));
  return mix(safe, mix(compressed, mid_contrast, mid_weight * 0.32), clamp(dark_weight * 0.78 + mid_weight * 0.18, 0.0, 0.82));
}

fn display_transform(color: vec3<f32>, semantic: vec4<f32>) -> vec3<f32> {
  if (camera.color_pipeline.x > 0.5 && camera.color_pipeline.y > 0.5) {
    return max(color, vec3<f32>(0.0));
  }

  let look = clamp(camera.fog_params.w, 0.0, 1.75);
  let look_unit = clamp(look / 1.35, 0.0, 1.0);
  let grade0 = camera.color_grade0;
  let grade1 = camera.color_grade1;
  let warmth = clamp(lighting.artist_params.w, 0.0, 1.0);
  let exposure = lighting.artist_params.x * mix(0.98, 0.72, look_unit) * clamp(grade0.x, 0.55, 1.70);
  let mapped = aces_film(max(color * exposure, vec3<f32>(0.0)));
  let y = luminance(mapped);
  let contrast = lighting.artist_params.y * mix(1.04, 1.30, look_unit) * clamp(grade0.y, 0.70, 1.42);
  var graded = max((mapped - vec3<f32>(y)) * contrast + vec3<f32>(y), vec3<f32>(0.0));
  let saturation = lighting.artist_params.z * mix(1.0, 0.92, look_unit) * clamp(grade0.z, 0.62, 1.24);
  graded = mix(vec3<f32>(luminance(graded)), graded, saturation);
  let cyan_wash = smoothstep(0.42, 1.08, graded.g + graded.b - graded.r * 1.10);
  let cyan_balanced = vec3<f32>(
    graded.r + (graded.g + graded.b) * clamp(grade1.x, 0.0, 0.36) * 0.42,
    graded.g * clamp(grade1.y, 0.48, 1.12),
    graded.b * clamp(grade1.z, 0.55, 1.18)
  );
  let neutral = vec3<f32>(luminance(graded)) * mix(vec3<f32>(0.96, 1.0, 1.04), vec3<f32>(1.06, 1.0, 0.94), warmth);
  graded = mix(graded, mix(cyan_balanced, neutral, clamp(grade1.w, 0.0, 0.52) * cyan_wash), cyan_wash * clamp(camera.visual_params.x, 0.0, 1.0));
  let warmth_tint = mix(vec3<f32>(0.94, 1.0, 1.06), vec3<f32>(1.06, 1.0, 0.92), warmth);
  let black_level = mix(0.012, 0.080, look_unit) * clamp(grade0.w, 0.20, 1.30) * (1.0 + role_mask(semantic, 5.0) * 0.08);
  var output_color = max(graded * warmth_tint - vec3<f32>(black_level), vec3<f32>(0.0));
  if (camera.color_pipeline.w > 0.5) {
    output_color = museum_toe_linear(output_color);
  }
  return linear_to_srgb(clamp(output_color, vec3<f32>(0.0), vec3<f32>(1.0))) * mix(1.0, 0.92, look_unit);
}

fn room_reflection(normal: vec3<f32>, view_direction: vec3<f32>, roughness: f32, semantic: vec4<f32>) -> vec3<f32> {
  let profile = camera.camera_position.w;
  let dark_luxury = select(0.0, 1.0, profile > 0.5 && profile < 1.5);
  let white_box = select(0.0, 1.0, profile >= 1.5);
  let neutral_gallery = 1.0 - max(dark_luxury, white_box);
  let neutral_surface_role = clamp(
    role_mask(semantic, 1.0) + role_mask(semantic, 2.0) + role_mask(semantic, 3.0) + role_mask(semantic, 4.0),
    0.0,
    1.0,
  );
  let structure_cool_guard = 1.0 - neutral_surface_role * 0.88;
  let reflection = reflect(-view_direction, normal);
  let ceiling = smoothstep(-0.20, 0.82, reflection.y);
  let floor = smoothstep(0.35, -0.55, reflection.y);
  let wall_band = 1.0 - abs(reflection.y);
  let cool_strip = pow(max(0.0, 1.0 - abs(reflection.z) * 1.8), 5.0) * wall_band;
  let warm_strip = pow(max(0.0, 1.0 - abs(reflection.x + 0.28) * 2.4), 6.0) * wall_band;
  let danger_strip = role_mask(semantic, 12.0) + role_mask(semantic, 19.0);
  let sharp_env =
    (vec3<f32>(0.040, 0.048, 0.050) * neutral_gallery +
      vec3<f32>(0.034, 0.038, 0.040) * dark_luxury +
      vec3<f32>(0.050, 0.056, 0.060) * white_box) * ceiling +
    (vec3<f32>(0.018, 0.022, 0.022) * neutral_gallery +
      vec3<f32>(0.012, 0.014, 0.014) * dark_luxury +
      vec3<f32>(0.024, 0.026, 0.026) * white_box) * floor +
    (vec3<f32>(0.024, 0.034, 0.036) * neutral_gallery +
      vec3<f32>(0.018, 0.024, 0.026) * dark_luxury +
      vec3<f32>(0.030, 0.040, 0.042) * white_box) * wall_band +
    vec3<f32>(0.06, 0.16, 0.17) * cool_strip * (0.04 + white_box * 0.02) * structure_cool_guard +
    vec3<f32>(0.72, 0.52, 0.24) * warm_strip * (0.10 + dark_luxury * 0.05) +
    vec3<f32>(0.86, 0.14, 0.08) * danger_strip * 0.035;
  let satin_env =
    (vec3<f32>(0.034, 0.040, 0.042) * neutral_gallery +
      vec3<f32>(0.028, 0.032, 0.034) * dark_luxury +
      vec3<f32>(0.044, 0.048, 0.052) * white_box) * (ceiling * 0.70 + wall_band * 0.34) +
    (vec3<f32>(0.016, 0.020, 0.020) * neutral_gallery +
      vec3<f32>(0.011, 0.013, 0.013) * dark_luxury +
      vec3<f32>(0.020, 0.022, 0.022) * white_box) * floor * 0.60 +
    vec3<f32>(0.04, 0.09, 0.10) * cool_strip * 0.03 * structure_cool_guard;
  let diffuse_env =
    (vec3<f32>(0.022, 0.028, 0.030) * neutral_gallery +
      vec3<f32>(0.018, 0.022, 0.024) * dark_luxury +
      vec3<f32>(0.028, 0.034, 0.036) * white_box) * (0.34 + wall_band * 0.22 + ceiling * 0.18) +
    (vec3<f32>(0.010, 0.012, 0.012) * neutral_gallery +
      vec3<f32>(0.008, 0.009, 0.009) * dark_luxury +
      vec3<f32>(0.013, 0.015, 0.015) * white_box) * floor * 0.36;
  let lod0 = clamp(1.0 - roughness * 2.2, 0.0, 1.0);
  let lod1 = clamp(1.0 - abs(roughness - 0.40) * 2.7, 0.0, 1.0);
  let lod2 = clamp((roughness - 0.18) / 0.82, 0.0, 1.0);
  let env_color = (sharp_env * lod0 + satin_env * lod1 + diffuse_env * lod2) / max(lod0 + lod1 + lod2, 0.001);
  return env_color * (0.58 + (1.0 - roughness) * 0.88) * lighting.algorithm_params.z;
}

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
fn vs_transparent(input: VertexInput) -> TransparentVertexOutput {
  let instance = instances[input.instance_index];
  let material_count = arrayLength(&raw_materials);
  let material_index = min(u32(max(input.material_index, 0.0)), material_count - 1u);
  let material = raw_materials[material_index];
  let world_position = skinned_world_position(instance, input.position, input.rigid_joint_index);
  let tint = max(instance.color.rgb, vec3<f32>(0.10, 0.10, 0.10));
  let tint_strength = clamp(instance.color.a, 0.0, 1.0);
  let material_has_base_texture = select(0.0, 1.0, material.flags.w >= 0.5);
  let tint_mix = tint_strength * mix(0.34, 0.16, material_has_base_texture);
  let material_color = mix(material.base_color.rgb, material.base_color.rgb * tint, tint_mix);
  let fog_delta = camera.camera_position.xyz - world_position.xyz;
  let fog_distance_sq = dot(fog_delta, fog_delta);
  var output: TransparentVertexOutput;
  output.clip_position = camera.view_projection * world_position;
  output.world_position = world_position.xyz;
  output.normal = skinned_world_normal(instance, input.normal, input.rigid_joint_index);
  output.color = vec4<f32>(material_color, clamp(material.base_color.a, 0.0, 1.0));
  output.uv = input.uv;
  output.material_kind = material.pbr_params.w;
  output.emissive = material.emissive_color;
  output.flags = material.flags;
  output.texture_layers = material.texture_layers;
  output.semantic_params = material.semantic_params;
  output.palette_color = material.palette_color;
  output.texture_stats = material.texture_stats;
  output.fog_amount = smoothstep(camera.fog_params.x * camera.fog_params.x, camera.fog_params.y * camera.fog_params.y, fog_distance_sq);
  output.ndc_depth = output.clip_position.z / max(output.clip_position.w, 0.0001);
  return output;
}

@fragment
fn fs_transparent(input: TransparentVertexOutput) -> @location(0) vec4<f32> {
  let shaded = shade_transparent(input);
  if (shaded.alpha < 0.006) {
    discard;
  }
  return vec4<f32>(shaded.color * shaded.alpha, shaded.alpha);
}

struct TransparentShade {
  color: vec3<f32>,
  alpha: f32,
};

fn shade_transparent(input: TransparentVertexOutput) -> TransparentShade {
  let semantic = input.semantic_params;
  let glass_role = role_mask(semantic, 5.0);
  let screen_role = role_mask(semantic, 10.0);
  let pickup_role = clamp(
    role_mask(semantic, 14.0) +
      role_mask(semantic, 15.0) +
      role_mask(semantic, 16.0) +
      role_mask(semantic, 17.0),
    0.0,
    1.0,
  );
  let explicit_glass_material = max(glass_role, select(0.0, 1.0, input.material_kind > 5.5 && input.material_kind < 6.5));
  let blend_alpha_mode = select(0.0, 1.0, input.flags.x > 1.5) * clamp(screen_role + pickup_role, 0.0, 1.0);
  let material_alpha = clamp(input.color.a, 0.0, 1.0);
  let alpha_factor = select(0.0, 1.0, material_alpha < 0.98) * clamp(explicit_glass_material + screen_role + pickup_role, 0.0, 1.0);
  let transparent_weight = clamp(explicit_glass_material * clamp(semantic.y, 0.0, 1.0) + blend_alpha_mode + alpha_factor, 0.0, 1.0);
  if (transparent_weight < 0.012) {
    var empty: TransparentShade;
    empty.color = vec3<f32>(0.0);
    empty.alpha = 0.0;
    return empty;
  }

  let normal = normalize(input.normal);
  let view_direction = normalize(camera.camera_position.xyz - input.world_position);
  let ndv = clamp(dot(normal, view_direction), 0.0, 1.0);
  let rim = 1.0 - ndv;
  let fresnel = 0.035 + 0.965 * pow5(rim);
  let base_texture_weight = raw_texture_layer_weight(input.flags.w);
  let sampled_base = sample_raw_base_color(input.uv, input.flags.w);
  var base_color = mix(input.color.rgb, sampled_base * mix(vec3<f32>(1.0), max(input.color.rgb, vec3<f32>(0.04)), 0.18), base_texture_weight * 0.88);
  base_color = mix(base_color, input.palette_color.rgb * max(luminance(base_color), 0.08) / max(luminance(input.palette_color.rgb), 0.08), clamp(input.palette_color.a, 0.0, 1.0) * 0.42);

  let roughness = clamp(input.texture_stats.w * 0.18 + 0.18 + glass_role * 0.12, 0.08, 0.62);
  let absorption_color = mix(vec3<f32>(0.025, 0.070, 0.080), max(base_color, vec3<f32>(0.018)), 0.52);
  let thickness = clamp(0.34 + semantic.w * 0.18 + rim * 0.42, 0.18, 0.96);
  let transmittance = exp(-absorption_color * thickness * mix(1.5, 2.8, glass_role));
  let reflection = room_reflection(normal, view_direction, roughness, semantic);
  let emissive_sample = srgb_to_linear(sample_raw_material_texture(input.uv, input.texture_layers.w));
  let emissive_weight = raw_texture_layer_weight(input.texture_layers.w);
  let emissive_color = mix(input.emissive.rgb, emissive_sample, emissive_weight * 0.92);
  let emissive_strength = clamp(input.emissive.a + emissive_weight * max(max(emissive_sample.r, emissive_sample.g), emissive_sample.b) * 1.4, 0.0, 4.0);
  let transmitted = base_color * transmittance * (0.12 + lighting.ambient.a * 0.64);
  var color = transmitted + reflection * (0.36 + fresnel * 1.30) + emissive_color * emissive_strength * 0.24;
  color = mix(color, camera.fog_color.rgb, input.fog_amount * 0.54);
  let glass_alpha = clamp(0.14 + fresnel * 0.28 + (1.0 - luminance(transmittance)) * 0.42 + glass_role * 0.05, 0.12, 0.62);
  let authored_alpha = clamp((1.0 - material_alpha) * 0.72 + blend_alpha_mode * 0.16, 0.0, 0.62);
  let alpha = clamp(max(glass_alpha * glass_role, authored_alpha) * (1.0 - input.fog_amount * 0.20), 0.035, 0.58);
  let display_color = display_transform(color, semantic);
  var shaded: TransparentShade;
  shaded.color = display_color;
  shaded.alpha = alpha;
  return shaded;
}

struct TransparentOitOutput {
  @location(0) accum: vec4<f32>,
  @location(1) reveal: vec4<f32>,
};

@fragment
fn fs_transparent_oit(input: TransparentVertexOutput) -> TransparentOitOutput {
  let shaded = shade_transparent(input);
  if (shaded.alpha < 0.006) {
    discard;
  }

  let depth01 = clamp(input.ndc_depth, 0.0, 1.0);
  let near_weight = pow(1.0 - depth01 * 0.72, 3.0);
  let alpha_weight = clamp(shaded.alpha * 9.0 + 0.01, 0.01, 4.0);
  let weight = clamp(alpha_weight * alpha_weight * near_weight, 0.05, 8.0);

  var output: TransparentOitOutput;
  output.accum = vec4<f32>(shaded.color * shaded.alpha * weight, shaded.alpha * weight);
  output.reveal = vec4<f32>(0.0, 0.0, 0.0, shaded.alpha);
  return output;
}
