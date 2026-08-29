struct Camera { eye: vec4f, right: vec4f, up: vec4f, forward: vec4f, boundsMin: vec4f, boundsMax: vec4f, resolutionMode: vec4f };
@group(0) @binding(0) var<uniform> camera: Camera;
@group(0) @binding(1) var fieldTexture: texture_3d<f32>;
@group(0) @binding(2) var fieldSampler: sampler;

fn fieldValue(p: vec3f) -> f32 {
  let uvw = (p - camera.boundsMin.xyz) / (camera.boundsMax.xyz - camera.boundsMin.xyz);
  return textureSampleLevel(fieldTexture, fieldSampler, uvw, 0.0).r;
}

fn fieldGradient(p: vec3f) -> vec3f {
  let h = 0.0018;
  return normalize(vec3f(
    fieldValue(p + vec3f(h,0,0)) - fieldValue(p - vec3f(h,0,0)),
    fieldValue(p + vec3f(0,h,0)) - fieldValue(p - vec3f(0,h,0)),
    fieldValue(p + vec3f(0,0,h)) - fieldValue(p - vec3f(0,0,h))
  ));
}

@vertex fn vs(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
  let p = array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));
  return vec4f(p[index],0,1);
}

@fragment fn fs(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
  let uv = (pixel.xy / camera.resolutionMode.xy) * 2.0 - 1.0;
  let aspect = camera.resolutionMode.x / camera.resolutionMode.y;
  let rd = normalize(camera.forward.xyz + camera.right.xyz * uv.x * aspect * 0.34 - camera.up.xyz * uv.y * 0.34);
  var t = 0.0;
  for (var i=0; i<128; i++) {
    let p = camera.eye.xyz + rd*t;
    let d = fieldValue(p);
    if (abs(d)<0.0008) { let n=fieldGradient(p); return vec4f(vec3f(0.46,0.68,0.73)*(0.35+0.65*max(dot(n,normalize(vec3f(0.4,0.8,0.5))),0.0)),1); }
    t += max(abs(d)*0.65,0.0012);
    if (t>4.0) { break; }
  }
  return vec4f(0.02,0.04,0.06,1);
}
