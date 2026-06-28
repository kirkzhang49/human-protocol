struct ParticleUniform {
  view_projection: mat4x4<f32>,
  camera_position: vec4<f32>,
  camera_right: vec4<f32>,
  camera_up: vec4<f32>,
  params0: vec4<f32>,
  params1: vec4<f32>,
};

struct Particle {
  position_life: vec4<f32>,
  velocity_seed: vec4<f32>,
  color_size: vec4<f32>,
};

struct VfxEmitter {
  position_type: vec4<f32>,
  direction_age: vec4<f32>,
  color_power: vec4<f32>,
};

@group(0) @binding(0) var<uniform> particle_uniform: ParticleUniform;
@group(0) @binding(1) var<storage, read> particle_src: array<Particle>;
@group(0) @binding(2) var<storage, read_write> particle_dst: array<Particle>;
@group(0) @binding(3) var<storage, read> vfx_emitters: array<VfxEmitter>;

@group(1) @binding(0) var<uniform> render_uniform: ParticleUniform;
@group(1) @binding(1) var<storage, read> render_particles: array<Particle>;
@group(1) @binding(2) var<storage, read> render_emitters: array<VfxEmitter>;
// Only used by fs_particles_soft (rawSoftParticles); the default fs_particles
// pipeline omits binding 3 from its bind-group layout and never references this.
@group(1) @binding(3) var scene_depth_tex: texture_depth_2d;

fn hash11(value: f32) -> f32 {
  return fract(sin(value * 127.1 + 311.7) * 43758.5453123);
}

fn hash31(seed: f32) -> vec3<f32> {
  return vec3<f32>(
    hash11(seed + 1.17),
    hash11(seed + 8.43),
    hash11(seed + 19.91)
  );
}

fn spawn_particle(id: u32, time: f32, camera_position: vec3<f32>) -> Particle {
  let seed = f32(id) * 12.9898 + floor(time * 2.0) * 78.233;
  let r0 = hash31(seed);
  let r1 = hash31(seed + 41.0);
  let radius = particle_uniform.params1.x;
  let min_y = particle_uniform.params1.y;
  let max_y = particle_uniform.params1.z;
  var particle: Particle;
  let offset = vec3<f32>(
    (r0.x - 0.5) * radius * 2.0,
    mix(min_y, max_y, r0.y) - camera_position.y,
    (r0.z - 0.5) * radius * 2.0
  );
  particle.position_life = vec4<f32>(camera_position + offset, 3.2 + r1.x * 6.8);
  particle.velocity_seed = vec4<f32>(
    (r1.y - 0.5) * 0.035,
    0.010 + r1.z * 0.030,
    (r1.x - 0.5) * 0.035,
    seed
  );
  let role = floor(hash11(seed + 73.0) * 5.0);
  var color = vec3<f32>(0.30, 0.74, 0.82);
  var alpha = 0.095;
  if (role < 1.0) {
    color = vec3<f32>(0.95, 0.72, 0.30);
    alpha = 0.070;
  } else if (role > 3.0) {
    color = vec3<f32>(0.58, 0.94, 1.00);
    alpha = 0.060;
  }
  particle.color_size = vec4<f32>(color * (0.58 + r0.x * 0.50), 0.012 + hash11(seed + 11.0) * 0.040);
  particle.color_size.a = particle.color_size.a * particle_uniform.params1.w + alpha * 0.001;
  return particle;
}

fn safe_direction(direction: vec3<f32>) -> vec3<f32> {
  let len_sq = dot(direction, direction);
  if (len_sq < 0.0001) {
    return vec3<f32>(0.0, 0.12, 1.0);
  }
  return normalize(direction);
}

fn spawn_vfx_particle(id: u32, time: f32, emitter_count: u32) -> Particle {
  let safe_count = max(emitter_count, 1u);
  let emitter_index = (id + u32(floor(time * 120.0))) % safe_count;
  let emitter = vfx_emitters[emitter_index];
  let seed = f32(id) * 17.371 + emitter.direction_age.w * 31.17 + time * 5.0;
  let r0 = hash31(seed);
  let r1 = hash31(seed + 57.0);
  let kind = emitter.position_type.w;
  let base_position = emitter.position_type.xyz;
  let direction = safe_direction(emitter.direction_age.xyz);
  let color = emitter.color_power.rgb;
  let power = clamp(emitter.color_power.a, 0.08, 2.5);

  var particle: Particle;
  var spread = vec3<f32>(r0.x - 0.5, r0.y - 0.5, r0.z - 0.5);
  if (dot(spread, spread) < 0.0001) {
    spread = vec3<f32>(0.17, 0.31, -0.23);
  }
  spread = normalize(spread);

  if (kind < 1.5) {
    let trail = (0.06 + r0.x * 0.42) * power;
    particle.position_life = vec4<f32>(base_position - direction * trail + spread * 0.018, 0.10 + r1.x * 0.18);
    particle.velocity_seed = vec4<f32>(direction * (1.8 + r1.y * 2.2) + spread * 0.42, seed);
    particle.color_size = vec4<f32>(color * (1.2 + power * 0.55), (0.010 + r1.z * 0.020) * particle_uniform.params1.w);
    return particle;
  }

  if (kind < 2.5) {
    particle.position_life = vec4<f32>(base_position + spread * (0.035 + r0.x * 0.16), 0.14 + r1.x * 0.30);
    particle.velocity_seed = vec4<f32>(spread * (1.45 + r1.y * 3.35) + direction * (0.36 + power * 0.26), seed);
    particle.color_size = vec4<f32>(color * (1.55 + power * 1.05), (0.024 + r1.z * 0.066) * particle_uniform.params1.w);
    return particle;
  }

  if (kind < 3.5) {
    particle.position_life = vec4<f32>(base_position + spread * (0.10 + r0.x * 0.28), 0.22 + r1.x * 0.58);
    particle.velocity_seed = vec4<f32>(spread * (0.95 + r1.y * 2.45) + vec3<f32>(0.0, 0.26 + r1.z * 0.42, 0.0), seed);
    particle.color_size = vec4<f32>(color * (1.25 + power * 1.05), (0.044 + r0.z * 0.116) * particle_uniform.params1.w);
    return particle;
  }

  if (kind < 4.5) {
    particle.position_life = vec4<f32>(base_position + direction * (0.05 + r0.x * 0.13) + spread * 0.025, 0.06 + r1.x * 0.16);
    particle.velocity_seed = vec4<f32>(direction * (1.5 + r1.y * 2.6) + spread * 0.75, seed);
    particle.color_size = vec4<f32>(color * (1.6 + power * 0.85), (0.022 + r0.z * 0.050) * particle_uniform.params1.w);
    return particle;
  }

  particle.position_life = vec4<f32>(base_position + spread * vec3<f32>(0.18, 0.05, 0.18), 0.14 + r1.x * 0.26);
  particle.velocity_seed = vec4<f32>(direction * (0.8 + r1.y * 1.5) + spread * vec3<f32>(0.75, 0.2, 0.75), seed);
  particle.color_size = vec4<f32>(color * (1.05 + power * 0.6), (0.018 + r0.z * 0.042) * particle_uniform.params1.w);
  return particle;
}

@compute @workgroup_size(64)
fn cs_particles(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let id = global_id.x;
  let count = u32(max(particle_uniform.params0.z, 0.0));
  if (id >= count) {
    return;
  }

  let time = particle_uniform.params0.x;
  let delta = clamp(particle_uniform.params0.y, 0.0, 0.05);
  let camera_position = particle_uniform.camera_position.xyz;
  let emitter_count = u32(max(particle_uniform.camera_position.w, 0.0));
  let vfx_budget = min((count * 3u) / 5u, emitter_count * 18u);
  let ambient_count = count - vfx_budget;
  let is_vfx_particle = id >= ambient_count && emitter_count > 0u;
  var particle = particle_src[id];
  var position = particle.position_life.xyz;
  var life = particle.position_life.w - delta;
  let to_camera = position.xz - camera_position.xz;
  let too_far = dot(to_camera, to_camera) > particle_uniform.params1.x * particle_uniform.params1.x * 1.35;
  if (life <= 0.0 || too_far) {
    if (is_vfx_particle) {
      particle_dst[id] = spawn_vfx_particle(id, time, emitter_count);
    } else {
      particle_dst[id] = spawn_particle(id, time, camera_position);
    }
    return;
  }

  let seed = particle.velocity_seed.w;
  let drift = vec3<f32>(
    sin(time * 0.37 + seed) * select(0.010, 0.020, is_vfx_particle),
    sin(time * 0.23 + seed * 1.7) * select(0.006, 0.014, is_vfx_particle),
    cos(time * 0.31 + seed * 0.6) * select(0.010, 0.020, is_vfx_particle)
  );
  let drag = select(1.0, max(0.18, 1.0 - delta * 3.2), is_vfx_particle);
  particle.velocity_seed = vec4<f32>(particle.velocity_seed.xyz * drag, particle.velocity_seed.w);
  position = position + (particle.velocity_seed.xyz + drift) * delta;
  let floor_y = particle_uniform.params1.y + 0.05;
  let ceiling_y = particle_uniform.params1.z + 0.15;
  if (position.y > ceiling_y) {
    life = 0.0;
  }
  if (position.y < floor_y) {
    position.y = floor_y;
  }
  particle.position_life = vec4<f32>(position, life);
  particle_dst[id] = particle;
}

struct ParticleVertexOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) uv: vec2<f32>,
  @location(2) layer: f32,
};

fn quad_corner(vertex_index: u32) -> vec2<f32> {
  if (vertex_index == 0u) { return vec2<f32>(-1.0, -1.0); }
  if (vertex_index == 1u) { return vec2<f32>(1.0, -1.0); }
  if (vertex_index == 2u) { return vec2<f32>(1.0, 1.0); }
  if (vertex_index == 3u) { return vec2<f32>(-1.0, -1.0); }
  if (vertex_index == 4u) { return vec2<f32>(1.0, 1.0); }
  return vec2<f32>(-1.0, 1.0);
}

@vertex
fn vs_particles(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> ParticleVertexOutput {
  let count = u32(max(render_uniform.params0.z, 0.0));
  let safe_index = min(instance_index, max(count, 1u) - 1u);
  let particle = render_particles[safe_index];
  let corner = quad_corner(vertex_index);
  let life_alpha = clamp(particle.position_life.w * 0.55, 0.0, 1.0);
  let pulse = 0.72 + 0.28 * sin(render_uniform.params0.x * 1.7 + particle.velocity_seed.w);
  let size = max(0.002, particle.color_size.a) * (0.62 + life_alpha * 0.42) * (0.82 + pulse * 0.18);
  let world_position =
    particle.position_life.xyz +
    render_uniform.camera_right.xyz * corner.x * size +
    render_uniform.camera_up.xyz * corner.y * size;
  var output: ParticleVertexOutput;
  output.clip_position = render_uniform.view_projection * vec4<f32>(world_position, 1.0);
  output.uv = corner * 0.5 + vec2<f32>(0.5);
  // Dimmed to ~0.6 so dust/spark particles read as faint atmosphere and stay
  // below the bloom threshold (no more "screen full of light dots" once full
  // effects + bloom are on). Tune this factor to taste.
  output.color = vec4<f32>(particle.color_size.rgb * 0.6, life_alpha * render_uniform.params0.w * 0.075);
  output.layer = 0.0;
  return output;
}

@fragment
fn fs_particles(input: ParticleVertexOutput) -> @location(0) vec4<f32> {
  let delta = input.uv - vec2<f32>(0.5);
  let dist_sq = dot(delta, delta) * 4.0;
  let soft = exp(-dist_sq * 2.8);
  let alpha = input.color.a * soft;
  return vec4<f32>(input.color.rgb * alpha, alpha);
}

// Raw depth-buffer gap (depth24plus, less-equal, 1=far) over which a particle
// fades to nothing as it approaches opaque geometry. Tuned small because depth
// is non-linear; expressed in raw [0,1] depth units (convention-agnostic).
const SOFT_PARTICLE_DEPTH_FADE: f32 = 0.0016;

@fragment
fn fs_particles_soft(input: ParticleVertexOutput) -> @location(0) vec4<f32> {
  let delta = input.uv - vec2<f32>(0.5);
  let dist_sq = dot(delta, delta) * 4.0;
  let radial = exp(-dist_sq * 2.8);
  // Sample the stored scene depth at this pixel and compare to the particle's
  // own depth. Both are raw depth-buffer values in the same space, so the gap is
  // meaningful without reconstructing linear view-Z (no near/far needed).
  let scene_depth = textureLoad(scene_depth_tex, vec2<i32>(input.clip_position.xy), 0);
  let depth_gap = scene_depth - input.clip_position.z;
  let soft_depth = clamp(depth_gap / SOFT_PARTICLE_DEPTH_FADE, 0.0, 1.0);
  let alpha = input.color.a * radial * soft_depth;
  return vec4<f32>(input.color.rgb * alpha, alpha);
}

fn beam_corner(vertex_index: u32) -> vec2<f32> {
  if (vertex_index == 0u) { return vec2<f32>(0.0, -1.0); }
  if (vertex_index == 1u) { return vec2<f32>(1.0, -1.0); }
  if (vertex_index == 2u) { return vec2<f32>(1.0, 1.0); }
  if (vertex_index == 3u) { return vec2<f32>(0.0, -1.0); }
  if (vertex_index == 4u) { return vec2<f32>(1.0, 1.0); }
  return vec2<f32>(0.0, 1.0);
}

@vertex
fn vs_projectile_beams(
  @builtin(vertex_index) vertex_index: u32,
  @builtin(instance_index) instance_index: u32
) -> ParticleVertexOutput {
  let projectile_count = u32(max(render_uniform.camera_up.w, 0.0));
  let safe_index = min(instance_index, max(projectile_count, 1u) - 1u);
  let emitter = render_emitters[safe_index];
  let kind = emitter.position_type.w;
  let direction = safe_direction(emitter.direction_age.xyz);
  let power = clamp(emitter.color_power.a, 0.08, 2.5);
  let local_vertex = vertex_index % 6u;
  let layer = vertex_index / 6u;
  let corner = beam_corner(local_vertex);
  let age = emitter.direction_age.w;
  let is_heavy = kind > 1.05;
  let is_flak = kind > 1.15;
  let age_fade = clamp(1.0 - age * select(0.82, 1.18, is_flak), 0.16, 1.0);
  let base_length = select(0.86, 1.08, is_heavy) * select(1.0, 0.74, is_flak) * (0.82 + power * 0.20);
  var beam_length = base_length * 1.00;
  var beam_width = select(0.092, 0.142, is_heavy) * select(1.0, 1.18, is_flak) * (0.82 + power * 0.20);
  var start = emitter.position_type.xyz - direction * beam_length;
  var end = emitter.position_type.xyz + direction * 0.18;
  var layer_color = emitter.color_power.rgb;
  var layer_alpha = age_fade * select(0.26, 0.36, is_heavy);

  if (layer == 1u) {
    beam_length = base_length * 0.78;
    beam_width = select(0.042, 0.064, is_heavy) * select(1.0, 1.12, is_flak) * (0.84 + power * 0.16);
    start = emitter.position_type.xyz - direction * beam_length;
    end = emitter.position_type.xyz + direction * 0.24;
    layer_color = mix(emitter.color_power.rgb, vec3<f32>(1.0, 0.97, 0.84), select(0.48, 0.66, is_heavy));
    layer_alpha = age_fade * select(0.86, 1.05, is_heavy);
  }

  if (layer == 2u) {
    beam_length = base_length * 0.34;
    beam_width = select(0.150, 0.230, is_heavy) * select(1.0, 1.24, is_flak) * (0.86 + power * 0.20);
    start = emitter.position_type.xyz - direction * beam_length;
    end = emitter.position_type.xyz + direction * 0.30;
    layer_color = mix(emitter.color_power.rgb, vec3<f32>(1.0, 0.93, 0.62), select(0.36, 0.56, is_heavy));
    layer_alpha = age_fade * select(0.54, 0.76, is_heavy);
  }

  let tangent = safe_direction(end - start);
  let to_camera = safe_direction(render_uniform.camera_position.xyz - emitter.position_type.xyz);
  var side = cross(tangent, to_camera);
  if (dot(side, side) < 0.0001) {
    side = render_uniform.camera_right.xyz;
  }
  side = normalize(side);
  let along = corner.x;
  let across = corner.y;
  var taper = mix(0.32, 1.0, along) * mix(1.0, 0.18, along * along);
  if (layer == 2u) {
    taper = mix(0.18, 1.0, along) * (1.0 - smoothstep(0.82, 1.0, along) * 0.38);
  }
  let world_position = mix(start, end, along) + side * across * beam_width * max(0.22, taper);
  var output: ParticleVertexOutput;
  output.clip_position = render_uniform.view_projection * vec4<f32>(world_position, 1.0);
  output.uv = vec2<f32>(along, across * 0.5 + 0.5);
  output.color = vec4<f32>(layer_color * (1.95 + power * select(0.82, 1.18, is_heavy)), layer_alpha);
  output.layer = f32(layer);
  return output;
}

@fragment
fn fs_projectile_beams(input: ParticleVertexOutput) -> @location(0) vec4<f32> {
  let center = abs(input.uv.y - 0.5) * 2.0;
  var cross_sharpness = 3.4;
  if (input.layer > 0.5) {
    cross_sharpness = 12.5;
  }
  if (input.layer > 1.5) {
    cross_sharpness = 5.2;
  }
  let core = exp(-center * center * cross_sharpness);
  let head = smoothstep(0.18, 0.92, input.uv.x);
  let tail = 1.0 - smoothstep(0.0, 0.25, input.uv.x) * 0.28;
  var along_mask = mix(0.44, 1.0, head) * tail;
  if (input.layer > 1.5) {
    let hot_head = exp(-(1.0 - input.uv.x) * (1.0 - input.uv.x) * 10.0);
    along_mask = mix(0.18, 1.0, hot_head);
  }
  let alpha = input.color.a * core * along_mask;
  return vec4<f32>(input.color.rgb * alpha, alpha);
}
