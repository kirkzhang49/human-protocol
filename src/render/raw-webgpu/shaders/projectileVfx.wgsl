struct VfxUniform {
  view_projection: mat4x4<f32>,
  camera_position: vec4<f32>,
  camera_right: vec4<f32>,
  camera_up: vec4<f32>,
  params: vec4<f32>,
};

struct VfxRecord {
  position_type: vec4<f32>,
  direction_age: vec4<f32>,
  color_power: vec4<f32>,
  params: vec4<f32>,
};

struct VfxVertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) layer: f32,
};

@group(0) @binding(0) var<uniform> vfx_uniform: VfxUniform;
@group(0) @binding(1) var<storage, read> projectiles: array<VfxRecord>;
@group(0) @binding(2) var<storage, read> effects: array<VfxRecord>;
// Only used by the *_soft fragments (rawSoftParticles); the default pipelines omit
// binding 3 from their layout and never reference this.
@group(0) @binding(3) var scene_depth_tex: texture_depth_2d;

// Raw depth-buffer gap over which a VFX fragment fades as it nears geometry.
const SOFT_VFX_DEPTH_FADE: f32 = 0.0016;

fn soft_vfx_depth_factor(clip_position: vec4<f32>) -> f32 {
  let scene_depth = textureLoad(scene_depth_tex, vec2<i32>(clip_position.xy), 0);
  let depth_gap = scene_depth - clip_position.z;
  return clamp(depth_gap / SOFT_VFX_DEPTH_FADE, 0.0, 1.0);
}

fn safe_direction(direction: vec3<f32>) -> vec3<f32> {
  let len_sq = dot(direction, direction);
  if (len_sq < 0.0001) {
    return vec3<f32>(0.0, 0.0, 1.0);
  }
  return normalize(direction);
}

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1) * 43758.5453123);
}

fn hash21(value: f32) -> vec2<f32> {
  return fract(sin(vec2<f32>(value * 127.1, value * 311.7)) * vec2<f32>(43758.5453, 22578.1459));
}

fn quad_corner(vertex_index: u32) -> vec2<f32> {
  if (vertex_index == 0u) { return vec2<f32>(0.0, -1.0); }
  if (vertex_index == 1u) { return vec2<f32>(1.0, -1.0); }
  if (vertex_index == 2u) { return vec2<f32>(1.0, 1.0); }
  if (vertex_index == 3u) { return vec2<f32>(0.0, -1.0); }
  if (vertex_index == 4u) { return vec2<f32>(1.0, 1.0); }
  return vec2<f32>(0.0, 1.0);
}

fn centered_quad_corner(vertex_index: u32) -> vec2<f32> {
  if (vertex_index == 0u) { return vec2<f32>(-1.0, -1.0); }
  if (vertex_index == 1u) { return vec2<f32>(1.0, -1.0); }
  if (vertex_index == 2u) { return vec2<f32>(1.0, 1.0); }
  if (vertex_index == 3u) { return vec2<f32>(-1.0, -1.0); }
  if (vertex_index == 4u) { return vec2<f32>(1.0, 1.0); }
  return vec2<f32>(-1.0, 1.0);
}

@vertex
fn vs_projectile_vfx(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VfxVertexOutput {
  let projectile_count = u32(max(vfx_uniform.camera_position.w, 0.0));
  let safe_index = min(instance_index, max(projectile_count, 1u) - 1u);
  let projectile = projectiles[safe_index];
  let kind = projectile.position_type.w;
  let direction = safe_direction(projectile.direction_age.xyz);
  let age = projectile.direction_age.w;
  let power = clamp(projectile.color_power.a, 0.1, 2.5);
  let radius = max(0.025, projectile.params.x);
  let lifetime = max(0.05, projectile.params.y);
  let life = clamp(1.0 - age / lifetime, 0.0, 1.0);
  let layer = vertex_index / 6u;
  let local_vertex = vertex_index % 6u;
  let corner = quad_corner(local_vertex);
  let is_rail = kind > 1.5 && kind < 2.5;
  let is_flak = kind > 2.5;

  var length = radius * select(3.7, 4.25, is_rail) * select(1.0, 0.64, is_flak) * (0.82 + power * 0.08);
  var width = radius * select(1.34, 1.62, is_rail) * select(1.0, 1.20, is_flak) * (0.88 + power * 0.10);
  var front = projectile.position_type.xyz + direction * radius * 1.45;
  var back = projectile.position_type.xyz - direction * length;
  var color = projectile.color_power.rgb;
  var alpha = life * select(0.34, 0.42, is_rail);

  if (layer == 1u) {
    length = length * 0.70;
    width = width * 0.42;
    front = projectile.position_type.xyz + direction * radius * 1.88;
    back = projectile.position_type.xyz - direction * length;
    color = mix(projectile.color_power.rgb, vec3<f32>(1.0, 0.95, 0.78), select(0.46, 0.58, is_rail));
    alpha = life * select(0.48, 0.60, is_rail);
  }

  if (layer == 2u) {
    length = radius * select(1.16, 1.34, is_rail) * select(1.0, 0.74, is_flak);
    width = radius * select(1.48, 1.74, is_rail) * select(1.0, 1.18, is_flak);
    front = projectile.position_type.xyz + direction * radius * 1.78;
    back = projectile.position_type.xyz - direction * length * 0.16;
    color = mix(projectile.color_power.rgb, vec3<f32>(1.0, 0.90, 0.58), select(0.30, 0.40, is_rail));
    alpha = life * select(0.22, 0.30, is_rail);
  }

  let tangent = safe_direction(front - back);
  let to_camera = safe_direction(vfx_uniform.camera_position.xyz - projectile.position_type.xyz);
  var side = cross(tangent, to_camera);
  if (dot(side, side) < 0.0001) {
    side = vfx_uniform.camera_right.xyz;
  }
  side = normalize(side);
  let along = corner.x;
  let across = corner.y;
  var taper = mix(0.30, 1.0, along) * mix(1.0, 0.22, along * along);
  if (layer >= 2u) {
    taper = 1.0 - smoothstep(0.42, 0.86, abs(along - 0.74) * 2.0) * 0.82;
  }
  let world_position = mix(back, front, along) + side * across * width * max(0.18, taper);

  var output: VfxVertexOutput;
  output.clip_position = vfx_uniform.view_projection * vec4<f32>(world_position, 1.0);
  output.color = vec4<f32>(color * (0.82 + power * 0.24), alpha * vfx_uniform.params.y);
  output.uv = vec2<f32>(along, across * 0.5 + 0.5);
  output.layer = f32(layer);
  return output;
}

@fragment
fn fs_projectile_vfx(input: VfxVertexOutput) -> @location(0) vec4<f32> {
  let center = abs(input.uv.y - 0.5) * 2.0;
  let halo = exp(-center * center * 2.15);
  let core = exp(-center * center * 15.0);
  let head = exp(-(1.0 - input.uv.x) * (1.0 - input.uv.x) * 8.8);
  let tail_gate = smoothstep(0.02, 0.24, input.uv.x);
  let tail_fade = 1.0 - smoothstep(0.0, 0.18, input.uv.x) * 0.42;
  let along = mix(0.18, 0.84, max(head, tail_gate * smoothstep(0.12, 0.94, input.uv.x))) * tail_fade;
  let body = halo * 0.28 + core * 0.92;
  let alpha = input.color.a * body * along;
  let hot_core = 0.58 + core * 0.58 + head * 0.24;
  return vec4<f32>(input.color.rgb * alpha * hot_core, alpha);
}

@fragment
fn fs_projectile_vfx_soft(input: VfxVertexOutput) -> @location(0) vec4<f32> {
  let center = abs(input.uv.y - 0.5) * 2.0;
  let halo = exp(-center * center * 2.15);
  let core = exp(-center * center * 15.0);
  let head = exp(-(1.0 - input.uv.x) * (1.0 - input.uv.x) * 8.8);
  let tail_gate = smoothstep(0.02, 0.24, input.uv.x);
  let tail_fade = 1.0 - smoothstep(0.0, 0.18, input.uv.x) * 0.42;
  let along = mix(0.18, 0.84, max(head, tail_gate * smoothstep(0.12, 0.94, input.uv.x))) * tail_fade;
  let body = halo * 0.28 + core * 0.92;
  let soft = soft_vfx_depth_factor(input.clip_position);
  let alpha = input.color.a * body * along * soft;
  let hot_core = 0.58 + core * 0.58 + head * 0.24;
  return vec4<f32>(input.color.rgb * alpha * hot_core, alpha);
}

@vertex
fn vs_effect_vfx(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> VfxVertexOutput {
  let effect_count = u32(max(vfx_uniform.camera_right.w, 0.0));
  let safe_index = min(instance_index, max(effect_count, 1u) - 1u);
  let effect = effects[safe_index];
  let effect_type = effect.position_type.w;
  let direction = safe_direction(effect.direction_age.xyz);
  let age = effect.direction_age.w;
  let lifetime = max(0.04, effect.params.y);
  let life = clamp(1.0 - age / lifetime, 0.0, 1.0);
  let spark_index = vertex_index / 6u;
  let local_vertex = vertex_index % 6u;
  let corner = centered_quad_corner(local_vertex);
  let seed = f32(safe_index * 17u + spark_index * 53u) + effect.params.z * 11.7;
  let h = hash21(seed);
  let spin = h.x * 6.2831853 + age * (6.0 + h.y * 4.0);
  let radial = safe_direction(
    normalize(vfx_uniform.camera_right.xyz) * cos(spin) +
    normalize(vfx_uniform.camera_up.xyz) * sin(spin) +
    direction * (0.18 + h.y * 0.62)
  );
  var side = safe_direction(cross(radial, safe_direction(vfx_uniform.camera_position.xyz - effect.position_type.xyz)));
  let is_muzzle = effect_type < 1.5;
  let is_hit = effect_type > 1.5 && effect_type < 2.5;
  let is_burst = effect_type > 2.5 && effect_type < 3.5;
  let is_telegraph = effect_type > 5.5;
  let is_shockwave = effect_type > 4.5 && !is_telegraph;
  let is_slash = effect_type > 3.5 && !is_shockwave && !is_telegraph;
  let power = clamp(effect.color_power.a, 0.08, 2.5);

  var length = select(0.12, 0.30 + h.x * 0.36, is_hit) * select(1.0, 1.18, is_burst) * (0.72 + power * 0.20);
  var width = select(0.036, 0.020 + h.y * 0.020, is_hit) * (0.82 + power * 0.14);
  var origin = effect.position_type.xyz + radial * select(0.018, 0.07 + h.y * 0.10, is_hit);
  var axis = radial;
  var color = effect.color_power.rgb;
  var alpha = life * select(0.36, 0.74, is_hit) * select(1.0, 0.75, is_slash);

  if (is_muzzle) {
    axis = safe_direction(direction * 1.55 + radial * 0.16);
    origin = effect.position_type.xyz + direction * (0.045 + h.x * 0.075);
    length = 0.085 + h.x * 0.125;
    width = 0.030 + h.y * 0.026;
    color = mix(effect.color_power.rgb, vec3<f32>(1.0, 0.84, 0.48), 0.34);
    alpha = life * 0.34;
  }

  if (is_slash) {
    axis = safe_direction(direction + radial * 0.12);
    origin = effect.position_type.xyz + radial * vec3<f32>(0.10, 0.03, 0.10);
    length = 0.34 + h.x * 0.24;
    width = 0.024 + h.y * 0.026;
    alpha = life * 0.34;
  }

  if (is_shockwave) {
    let progress = clamp(age / lifetime, 0.0, 1.0);
    let angle = (f32(spark_index) / 10.0) * 6.2831853 + h.x * 0.12;
    let ring_radius = (0.28 + progress * (1.75 + power * 0.72)) * (0.92 + h.y * 0.12);
    let ring_radial = safe_direction(vec3<f32>(cos(angle), 0.0, sin(angle)));
    let ring_tangent = safe_direction(vec3<f32>(-sin(angle), 0.0, cos(angle)));
    axis = ring_tangent;
    side = ring_radial;
    origin = effect.position_type.xyz + ring_radial * ring_radius + vec3<f32>(0.0, 0.04 + progress * 0.08, 0.0);
    length = ring_radius * 0.34;
    width = 0.045 + power * 0.028 + progress * 0.035;
    color = mix(effect.color_power.rgb, vec3<f32>(0.92, 1.0, 1.0), 0.38);
    alpha = smoothstep(0.0, 0.18, progress) * life * (0.7 + power * 0.18);
  }

  if (is_telegraph) {
    let progress = clamp(age / lifetime, 0.0, 1.0);
    let lane = (f32(spark_index) - 4.5) / 4.5;
    let abs_lane = abs(lane);
    let edge_lane = abs_lane > 0.68;
    let center_lane = abs_lane < 0.16;
    let horizontal_side = safe_direction(vec3<f32>(-direction.z, 0.0, direction.x));
    let pulse = 0.82 + sin(progress * 15.707963 + f32(spark_index) * 0.24) * 0.18;
    let fan_length = 0.64 + power * 0.96;
    let fan_width = 0.30 + power * 0.44;
    axis = direction;
    side = horizontal_side;
    origin = effect.position_type.xyz + direction * (fan_length * 0.52 + 0.24) + horizontal_side * lane * fan_width;
    origin.y = effect.position_type.y + 0.052;
    length = fan_length * select(0.38, 0.52, center_lane || edge_lane);
    width = fan_width * select(0.13, 0.085, edge_lane);
    color = mix(effect.color_power.rgb, vec3<f32>(1.0, 0.78, 0.28), select(0.24, 0.58, edge_lane));
    alpha = life * pulse * select(0.24, 0.72, edge_lane) * (1.0 - progress * 0.1);
  }

  let world_position =
    origin +
    axis * corner.x * length * mix(0.35, 1.0, life) +
    side * corner.y * width;

  var output: VfxVertexOutput;
  output.clip_position = vfx_uniform.view_projection * vec4<f32>(world_position, 1.0);
  output.color = vec4<f32>(color * (0.88 + power * 0.34), alpha * vfx_uniform.params.y);
  output.uv = corner * 0.5 + vec2<f32>(0.5);
  output.layer = effect_type;
  return output;
}

@fragment
fn fs_effect_vfx(input: VfxVertexOutput) -> @location(0) vec4<f32> {
  let delta = input.uv - vec2<f32>(0.5);
  let along = abs(delta.x) * 2.0;
  let across = abs(delta.y) * 2.0;
  let is_telegraph = input.layer > 5.5;
  let is_shockwave = input.layer > 4.5 && !is_telegraph;
  let streak_mask = exp(-across * across * 4.0) * (1.0 - smoothstep(0.72, 1.0, along));
  let ring_mask = exp(-across * across * 11.0) * (0.48 + 0.52 * (1.0 - smoothstep(0.84, 1.0, along)));
  let telegraph_mask = exp(-across * across * 2.8) * (0.38 + 0.62 * (1.0 - smoothstep(0.84, 1.0, along)));
  let mask = select(select(streak_mask, ring_mask, is_shockwave), telegraph_mask, is_telegraph);
  let alpha = input.color.a * mask;
  return vec4<f32>(input.color.rgb * alpha, alpha);
}

@fragment
fn fs_effect_vfx_soft(input: VfxVertexOutput) -> @location(0) vec4<f32> {
  let delta = input.uv - vec2<f32>(0.5);
  let along = abs(delta.x) * 2.0;
  let across = abs(delta.y) * 2.0;
  let is_telegraph = input.layer > 5.5;
  let is_shockwave = input.layer > 4.5 && !is_telegraph;
  let streak_mask = exp(-across * across * 4.0) * (1.0 - smoothstep(0.72, 1.0, along));
  let ring_mask = exp(-across * across * 11.0) * (0.48 + 0.52 * (1.0 - smoothstep(0.84, 1.0, along)));
  let telegraph_mask = exp(-across * across * 2.8) * (0.38 + 0.62 * (1.0 - smoothstep(0.84, 1.0, along)));
  let mask = select(select(streak_mask, ring_mask, is_shockwave), telegraph_mask, is_telegraph);
  let alpha = input.color.a * mask * soft_vfx_depth_factor(input.clip_position);
  return vec4<f32>(input.color.rgb * alpha, alpha);
}
