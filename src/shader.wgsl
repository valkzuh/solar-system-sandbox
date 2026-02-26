struct Params {
  resolution: vec2<f32>,
  time: f32,
  mass: f32,
  spin: f32,
  accretion: f32,
  inclination: f32,
  disk_inner: f32,
  disk_outer: f32,
  grid_strength: f32,
  lensing: f32,
  cam_yaw: f32,
  cam_pitch: f32,
  zoom: f32,
  _pad0: f32,
  _pad1: f32,
};

@group(0) @binding(0)
var output_tex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1)
var<uniform> params: Params;

fn rotate_x(v: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3(v.x, v.y * c - v.z * s, v.y * s + v.z * c);
}

fn rotate_y(v: vec3<f32>, a: f32) -> vec3<f32> {
  let c = cos(a);
  let s = sin(a);
  return vec3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
}

fn hash21(p: vec2<f32>) -> f32 {
  let h = sin(dot(p, vec2(127.1, 311.7))) * 43758.5453;
  return fract(h);
}

fn palette(t: f32) -> vec3<f32> {
  let a = vec3(0.03, 0.03, 0.06);
  let b = vec3(0.9, 0.32, 0.06);
  let c = vec3(1.0, 0.86, 0.6);
  let t2 = t * t;
  let t6 = t2 * t2 * t2;
  return mix(a, b, t2) + c * t6 * 0.6;
}

fn disk_emission(pos: vec3<f32>, dir: vec3<f32>, rs: f32, accretion: f32, spin: f32) -> vec3<f32> {
  let r = length(pos.xz);
  let temp = pow(max(1.0 - sqrt(rs / max(r, rs + 0.001)), 0.0) / (r * r * r + 0.4), 0.25);
  let temp_norm = clamp(temp * (0.6 + accretion * 1.6), 0.0, 1.0);
  let v_dir = normalize(vec3(-pos.z, 0.0, pos.x));
  let v_mag = sqrt(1.0 / max(r, rs + 0.5)) * (0.45 + 0.25 * spin);
  let doppler = 1.0 / max(1.0 - dot(v_dir * v_mag, -dir) * 0.8, 0.2);
  let g = sqrt(max(1.0 - rs / max(r, rs + 0.001), 0.1));
  let color = palette(temp_norm) * doppler * g;
  return color;
}

fn background(dir: vec3<f32>, grid_strength: f32) -> vec3<f32> {
  let d = normalize(dir);
  let u = atan2(d.z, d.x) / (2.0 * 3.14159265) + 0.5;
  let v = asin(d.y) / 3.14159265 + 0.5;
  let neb = vec3(0.03, 0.05, 0.08) + vec3(0.06, 0.02, 0.1) * sin(6.0 * u + 1.3) * 0.5;

  let grid_u = abs(fract(u * 12.0) - 0.5);
  let grid_v = abs(fract(v * 8.0) - 0.5);
  let grid = smoothstep(0.49, 0.5, min(grid_u, grid_v));

  let star_seed = floor(vec2(u * 900.0, v * 600.0));
  let n = hash21(star_seed);
  let star = smoothstep(0.997, 1.0, n);
  let star_color = vec3(0.9, 0.95, 1.0) * star * (0.7 + 0.3 * hash21(star_seed + 12.3));

  let grid_color = vec3(0.25, 0.6, 0.9) * grid * grid_strength * 0.6;
  return neb + grid_color + star_color;
}

@compute @workgroup_size(8, 8)
fn cs_main(@builtin(global_invocation_id) id: vec3<u32>) {
  let width = u32(params.resolution.x);
  let height = u32(params.resolution.y);
  if (id.x >= width || id.y >= height) {
    return;
  }

  let uv = (vec2<f32>(f32(id.x), f32(id.y)) + 0.5) / params.resolution * 2.0 - 1.0;
  let aspect = params.resolution.x / params.resolution.y;
  var dir = normalize(vec3(uv.x * aspect * 0.9, -uv.y * 0.9, -1.2));

  dir = rotate_y(dir, params.cam_yaw);
  dir = rotate_x(dir, params.cam_pitch);

  let mass_scale = clamp(log2(max(params.mass, 1.0)) / 24.0, 0.35, 1.8);
  let rs = 2.0 * mass_scale;
  let cam_dist = (18.0 * mass_scale + 6.0) / max(params.zoom, 0.2);
  var pos = vec3(0.0, 0.0, cam_dist);
  pos = rotate_y(pos, params.cam_yaw);
  pos = rotate_x(pos, params.cam_pitch);

  let disk_inner = params.disk_inner * rs * 1.6;
  let disk_outer = params.disk_outer * rs * 1.6;

  var color = vec3(0.0, 0.0, 0.0);
  var hit = false;
  var min_r = 1e9;
  let step_len = 0.05 * mass_scale;

  for (var i = 0; i < 240; i = i + 1) {
    let r = length(pos);
    min_r = min(min_r, r);
    if (r < rs * 1.02) {
      color = vec3(0.0, 0.0, 0.0);
      hit = true;
      break;
    }

    let next_pos = pos + dir * step_len;
    if ((pos.y > 0.0 && next_pos.y < 0.0) || (pos.y < 0.0 && next_pos.y > 0.0)) {
      let t = -pos.y / dir.y;
      if (t > 0.0 && t < step_len) {
        let p = pos + dir * t;
        let rd = length(p.xz);
        if (rd > disk_inner && rd < disk_outer) {
          color = disk_emission(p, dir, rs, params.accretion, params.spin);
          hit = true;
          break;
        }
      }
    }

    let accel = -params.lensing * mass_scale * pos / (r * r * r + 0.0001);
    dir = normalize(dir + accel * step_len * 0.6);
    pos = next_pos;
  }

  if (!hit) {
    color = background(dir, params.grid_strength);
    if (min_r < rs * 1.7 && min_r > rs * 1.1) {
      color += vec3(1.0, 0.8, 0.5) * (params.lensing * 0.3);
    }
  }

  let gamma = 1.1 + 0.4 * params.accretion;
  color = pow(color, vec3(1.0 / gamma));
  textureStore(output_tex, vec2<i32>(i32(id.x), i32(id.y)), vec4(color, 1.0));
}

struct VsOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VsOut {
  var pos = array<vec2<f32>, 3>(
    vec2(-1.0, -3.0),
    vec2(3.0, 1.0),
    vec2(-1.0, 1.0)
  );
  var uv = array<vec2<f32>, 3>(
    vec2(0.0, 2.0),
    vec2(2.0, 0.0),
    vec2(0.0, 0.0)
  );

  var out: VsOut;
  out.position = vec4(pos[idx], 0.0, 1.0);
  out.uv = uv[idx];
  return out;
}

@group(0) @binding(0)
var color_tex: texture_2d<f32>;
@group(0) @binding(1)
var color_sampler: sampler;

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
  let color = textureSample(color_tex, color_sampler, in.uv);
  return color;
}
