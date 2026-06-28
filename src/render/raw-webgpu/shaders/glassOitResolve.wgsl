@group(0) @binding(0) var glass_oit_accum: texture_2d<f32>;
@group(0) @binding(1) var glass_oit_reveal: texture_2d<f32>;
@group(0) @binding(2) var glass_oit_sampler: sampler;

struct OitFullscreenOutput {
  @builtin(position) clip_position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_oit_fullscreen(@builtin(vertex_index) vertex_index: u32) -> OitFullscreenOutput {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0),
    vec2<f32>(3.0, 1.0),
    vec2<f32>(-1.0, 1.0),
  );
  let position = positions[vertex_index];
  var output: OitFullscreenOutput;
  output.clip_position = vec4<f32>(position, 0.0, 1.0);
  output.uv = vec2<f32>(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return output;
}

@fragment
fn fs_oit_resolve(input: OitFullscreenOutput) -> @location(0) vec4<f32> {
  let accum = textureSampleLevel(glass_oit_accum, glass_oit_sampler, input.uv, 0.0);
  let reveal = clamp(textureSampleLevel(glass_oit_reveal, glass_oit_sampler, input.uv, 0.0).r, 0.0, 1.0);
  let alpha = clamp(1.0 - reveal, 0.0, 0.92);
  if (alpha < 0.004 || accum.a <= 0.0001) {
    discard;
  }
  let color = clamp(accum.rgb / max(accum.a, 0.0001), vec3<f32>(0.0), vec3<f32>(1.0));
  return vec4<f32>(color * alpha, alpha);
}
