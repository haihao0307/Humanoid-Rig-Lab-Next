/**
 * Isolated r7 fibre prototype for Three r170. No changes to r6 geometry.
 *
 * Required BufferGeometry attributes (two vertices per curve point): position,
 * tangent, scalpNormal (or rootNormal), strandSide (-1/+1), strandRadius,
 * along, strandRandom. strandRadius is the ACTUAL tapered radius in world units;
 * this material never invents another taper or changes the centreline.
 * The current GNM meshes have identity transforms. Positions may be transformed,
 * but radius remains in world units; scaled objects must update radiusScale.
 *
 * Lighting: a bounded cylinder/fibre approximation with longitudinal Gaussian
 * lobes, reflection/transmission azimuth and a small dielectric surface lobe.
 * It is not Marschner, Chiang, a Blender Principled Hair port, or multiple
 * scattering. The scene's actual directional lights supply power and colour.
 *
 * Visibility: native Three per-light shadow maps. The light pass expands the
 * SAME radii toward each light camera, then stochastically samples analytical
 * opacity/coverage into a single-depth map. PCF averages those samples. This
 * approximates fractional extinction, not deep opacity maps or coloured shadow
 * transmission. Use PCFShadowMap/PCFSoftShadowMap, not VSM or point-light shadows.
 *
 * Integration:
 *   const fiber = attachFiberMaterial(mesh, { renderer, color, roughness });
 *   // Configure the existing lamps/head, without changing their lamp powers:
 *   renderer.shadowMap.enabled = true;
 *   renderer.shadowMap.type = THREE.PCFSoftShadowMap;
 *   warmLight.castShadow = coolLight.castShadow = true;
 *   head.castShadow = head.receiveShadow = true;
 *   // Set tight lamp frusta/map sizes/bias for this small GNM head in the app.
 *   setFiberModes(fiber.material, { coverageAA: true, shadows: true });
 *
 * attachFiberMaterial installs viewport hooks. If using factories directly,
 * call setFiberViewport before drawing and update depthMaterial's viewportHeight
 * to the actual shadow viewport height inside mesh.onBeforeShadow.
 */
import * as THREE from 'three';

// R02.3 adaptation: per-strand linear pigment, exact triangle-root relief, density/length controls, linear HDR output.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const records = new WeakMap();
const COVERAGE_RESOLVES = ['auto', 'blend', 'a2c'];

function validateCoverageResolve(value) {
  if (!COVERAGE_RESOLVES.includes(value)) throw new Error('coverageResolve must be auto, blend or a2c');
  return value;
}

// Shared camera/light-camera expansion. Three supplies the active camera's
// modelViewMatrix, projectionMatrix and isOrthographic for ShaderMaterial.
const RIBBON_DECLARATIONS = /* glsl */`
attribute vec3 rootPosition;
attribute vec3 boundRelief;
attribute vec3 strandColor;
uniform float uLength,uRelief,uDensity;
varying vec3 vStrandColor;
attribute vec3 tangent;
attribute vec3 scalpNormal;
attribute float strandSide;
attribute float strandRadius;
attribute float along;
attribute float strandRandom;
uniform float viewportHeight;
uniform float radiusScale;
uniform float coverageAA;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
vec3 fiberSafeNormal(vec3 value, vec3 fallback) {
  float lengthSquared = dot(value, value);
  return lengthSquared > 1e-12 ? value * inversesqrt(lengthSquared) : fallback;
}
`;

const RIBBON_EXPANSION = /* glsl */`
  vec3 attachedPosition = rootPosition + (position-rootPosition)*uLength + boundRelief*uRelief;
  vStrandColor=strandColor;
  vec4 centerView = modelViewMatrix * vec4(attachedPosition, 1.0);
  vec3 fiberTangent = fiberSafeNormal(mat3(modelViewMatrix) * tangent, vec3(0.0, 1.0, 0.0));
  // These GNM meshes use identity/uniform transforms. Computing this from the
  // active modelViewMatrix also avoids the stale object.normalMatrix in Three's
  // shadow pass, where only object.modelViewMatrix is refreshed.
  vec3 fiberNormal = fiberSafeNormal(mat3(modelViewMatrix) * scalpNormal, vec3(0.0, 0.0, 1.0));
  vec3 fiberView = isOrthographic ? vec3(0.0, 0.0, 1.0) : fiberSafeNormal(-centerView.xyz, vec3(0.0, 0.0, 1.0));
  vec3 fallbackAxis = abs(fiberTangent.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 fallbackSide = fiberSafeNormal(cross(fiberTangent, fiberNormal), normalize(cross(fiberTangent, fallbackAxis)));
  vec3 ribbonSide = fiberSafeNormal(cross(fiberTangent, fiberView), fallbackSide);
  vec4 centerClip = projectionMatrix * centerView;
  float worldPerPixel = 2.0 * abs(centerClip.w) / max(abs(projectionMatrix[1][1]) * viewportHeight, 1e-6);
  float physicalRadius = max(0.0, strandRadius * radiusScale);
  // A smooth filter support, not a minimum opaque width. The integral in the
  // fragment shader preserves subpixel area and tapers all the way to zero.
  float displayRadius = physicalRadius + coverageAA * worldPerPixel * 0.75;
  vec4 mvPosition = centerView + vec4(ribbonSide * strandSide * displayRadius, 0.0);
  gl_Position = projectionMatrix * mvPosition;
  vFiberAcross = strandSide * displayRadius;
  vFiberRadius = physicalRadius;
  vFiberRandom = strandRandom;
  vFiberAlong = along;
`;

const COVERAGE_FUNCTION = /* glsl */`
// Integral of a unit-opacity interval [-radius,+radius] over a pixel footprint.
// fwidth makes the filter track the actual projected transverse footprint.
float fiberCoverage() {
  if (vFiberRadius <= 0.0) return 0.0;
  if (coverageAA < 0.5) return 1.0;
  float footprint = max(fwidth(vFiberAcross), 1e-9);
  float low = max(vFiberAcross - 0.5 * footprint, -vFiberRadius);
  float high = min(vFiberAcross + 0.5 * footprint, vFiberRadius);
  return clamp((high - low) / footprint, 0.0, 1.0);
}
`;

export const FIBER_VERTEX = /* glsl */`
#include <common>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
${RIBBON_DECLARATIONS}
varying vec3 vFiberTangent;
varying vec3 vFiberNormal;
varying vec3 vFiberViewPosition;
void main() {
${RIBBON_EXPANSION}
  vFiberTangent = fiberTangent;
  vFiberNormal = fiberNormal;
  vFiberViewPosition = -centerView.xyz;
  // Sample shadow coordinates at the physical silhouette, not the extra
  // filter support; normal bias is controlled by each real scene light.
  vec3 worldSide = inverseTransformDirection(ribbonSide, viewMatrix);
  vec4 worldPosition = modelMatrix * vec4(attachedPosition, 1.0);
  worldPosition.xyz += worldSide * strandSide * physicalRadius;
  vec3 transformedNormal = fiberNormal;
  #include <shadowmap_vertex>
  #include <logdepthbuf_vertex>
}
`;

export const FIBER_FRAGMENT = /* glsl */`
#include <common>
#include <packing>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
uniform vec3 hairColor;
uniform float uDensity;
varying vec3 vStrandColor;
uniform float roughness;
uniform float surfaceSpecular;
uniform float fiberOpacity;
uniform float coverageAA;
uniform float fiberShadows;
uniform float guideMode;
uniform float ambientGain;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
varying vec3 vFiberTangent;
varying vec3 vFiberNormal;
varying vec3 vFiberViewPosition;
${COVERAGE_FUNCTION}
float fiberGaussian(float angle, float width) {
  float x = angle / max(width, 0.035);
  return exp(-0.5 * x * x);
}
vec3 fiberResponse(vec3 T, vec3 V, vec3 L, vec3 pigment) {
  float tL = clamp(dot(T, L), -0.9999, 0.9999);
  float tV = clamp(dot(T, V), -0.9999, 0.9999);
  float cosL = sqrt(max(0.0001, 1.0 - tL * tL));
  float cosV = sqrt(max(0.0001, 1.0 - tV * tV));
  // Reflection has opposite incident/outgoing longitudinal angles.
  float thetaHalf = 0.5 * (asin(tL) + asin(tV));
  float cosPhi = clamp((dot(L, V) - tL * tV) / max(cosL * cosV, 0.0001), -1.0, 1.0);
  float front = 0.5 + 0.5 * cosPhi;
  float back = 1.0 - front;
  float beta = mix(0.085, 0.38, clamp(roughness, 0.0, 1.0));
  float tilt = 0.045;
  float primary = fiberGaussian(thetaHalf + tilt, beta) * pow(front, 2.5);
  float broad = fiberGaussian(thetaHalf - 0.5 * tilt, beta * 1.9 + 0.06) * (0.30 + 0.70 * front);
  float transmission = fiberGaussian(thetaHalf, beta * 2.25 + 0.10) * back * back;
  // Dielectric Fresnel shape, capped to keep this unnormalized real-time lobe
  // bounded at grazing angles. This is an artistic BCSDF approximation.
  vec3 H = L + V;
  float hLength = max(length(H), 1e-5);
  float fresnel = min(0.35, 0.046 + 0.954 * pow(1.0 - clamp(dot(V, H / hLength), 0.0, 1.0), 5.0));
  float reflectedWeight = clamp(surfaceSpecular, 0.0, 0.25) * (0.25 + 0.75 * fresnel);
  vec3 reflected = vec3(primary * reflectedWeight);
  vec3 pigmented = pigment * (0.22 + 0.38 * broad);
  // A shorter absorption path gives a broader, coloured through-fibre lobe.
  vec3 transmitted = pow(max(pigment, vec3(0.00001)), vec3(0.80)) * (0.20 * transmission);
  // Every lobe is <=1; weighted reflectance remains bounded. Illumination and
  // each lamp's visibility multiply the response outside this function.
  return cosL * (reflected + pigmented + transmitted);
}
void main() {
  if(vFiberRandom>uDensity)discard;
  float alpha = fiberOpacity * fiberCoverage();
  if (alpha < 0.001) discard;
  vec3 T = normalize(vFiberTangent);
  vec3 V = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vFiberViewPosition);
  vec3 N = normalize(vFiberNormal);
  float rootVisibility = mix(0.48,1.0,smoothstep(0.0,0.28,vFiberAlong));
  vec3 pigment = rootVisibility * clamp(vStrandColor * hairColor * mix(0.90, 1.10, vFiberRandom), vec3(0.0), vec3(0.95));
  // No emission or unlit additive wash. With every light off, result is black.
  vec3 color = pigment * ambientLightColor * (0.20 * ambientGain);
  #if NUM_HEMI_LIGHTS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
      color += pigment * getHemisphereLightIrradiance(hemisphereLights[i], N) * (0.14 * ambientGain);
    }
    #pragma unroll_loop_end
  #endif
  #if NUM_DIR_LIGHTS > 0
    #pragma unroll_loop_start
    for (int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
      {
      float visibility = 1.0;
      #if defined(USE_SHADOWMAP) && (UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS)
        DirectionalLightShadow lampShadow = directionalLightShadows[i];
        if (receiveShadow && fiberShadows > 0.5) {
          visibility = getShadow(directionalShadowMap[i], lampShadow.shadowMapSize,
            lampShadow.shadowIntensity, lampShadow.shadowBias, lampShadow.shadowRadius,
            vDirectionalShadowCoord[i]);
        }
      #endif
      // Each light gets ONLY its own shadow visibility, including warm/cool.
      color += directionalLights[i].color * visibility *
        fiberResponse(T, V, normalize(directionalLights[i].direction), pigment);
      }
    }
    #pragma unroll_loop_end
  #endif
  if (guideMode > 0.5) color = mix(vec3(0.035, 0.36, 0.19), vec3(0.55, 0.23, 0.025), vFiberRandom);
  gl_FragColor = vec4(max(color, vec3(0.0)), alpha);
  #include <logdepthbuf_fragment>
  // This pass writes linear HDR to R02 fullRT. The existing compose pass
  // performs the single filmic + sRGB conversion for BOTH skin and fibres.
}
`;

export const FIBER_DEPTH_VERTEX = /* glsl */`
${RIBBON_DECLARATIONS}
varying vec2 vFiberDepthZW;
void main() {
${RIBBON_EXPANSION}
  vFiberDepthZW = gl_Position.zw;
}
`;

export const FIBER_DEPTH_FRAGMENT = /* glsl */`
#include <packing>
uniform float fiberOpacity;
uniform float coverageAA;
uniform float shadowSeed;
varying float vFiberAcross;
varying float vFiberRadius;
varying float vFiberRandom;
varying float vFiberAlong;
varying vec2 vFiberDepthZW;
${COVERAGE_FUNCTION}
// Stable per-light/per-strand sample; no frame jitter and no camera-space split.
float fiberShadowThreshold(vec2 pixel, float seed) {
  vec3 p = fract(vec3(pixel.xyx) * 0.1031 + seed);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
void main() {
  float occupancy = clamp(fiberOpacity * fiberCoverage(), 0.0, 1.0);
  float threshold = fiberShadowThreshold(floor(gl_FragCoord.xy), vFiberRandom * 19.19 + shadowSeed);
  if (occupancy <= threshold) discard;
  float depth = 0.5 * vFiberDepthZW.x / vFiberDepthZW.y + 0.5;
  gl_FragColor = packDepthToRGBA(depth);
}
`;

function recordFor(material) {
  const record = records.get(material);
  if (!record) throw new Error('Expected a material created by createFiberMaterial');
  return record;
}

function applyCoverageMode(material) {
  const record = recordFor(material);
  const useMSAA = record.coverageAA && record.coverageResolve !== 'blend' && record.samples > 1;
  const useBlend = !useMSAA && (record.coverageAA || material.uniforms.fiberOpacity.value < 1);
  const changed = material.alphaToCoverage !== useMSAA || material.transparent !== useBlend;
  material.alphaToCoverage = useMSAA;
  material.transparent = useBlend;
  material.depthWrite = !useBlend;
  material.blending = THREE.NormalBlending;
  material.forceSinglePass = true;
  material.uniforms.coverageAA.value = record.coverageAA ? 1 : 0;
  record.coverageMode = !record.coverageAA ? (useBlend ? 'hard-raster-alpha-blend' : 'hard-raster') :
    useMSAA ? 'analytic-alpha-to-coverage' : 'analytic-alpha-blend';
  record.coverageResolveFallback = record.coverageAA && record.coverageResolve === 'a2c' && record.samples <= 1 ?
    'A2C requested but current framebuffer has no multisample coverage; using analytic alpha blend' : null;
  if (changed) material.needsUpdate = true;
}

export function createFiberMaterial({color = '#21170f', roughness = 0.42,
  specular = 0.095, radiusScale = 1, opacity = 1, coverageAA = true,
  shadows = true, guides = false, ambientGain = 1, coverageResolve = 'auto'} = {}) {
  validateCoverageResolve(coverageResolve);
  const material = new THREE.ShaderMaterial({
    name: 'R02.3 scan-bound Kaopu bounded fibre adaptation',
    vertexShader: FIBER_VERTEX,
    fragmentShader: FIBER_FRAGMENT,
    lights: true,
    toneMapped:false,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.lights, {
      uDensity:{value:1},uLength:{value:1},uRelief:{value:1},
      viewportHeight: {value: 1}, radiusScale: {value: Math.max(0, radiusScale)},
      coverageAA: {value: coverageAA ? 1 : 0}, hairColor: {value: new THREE.Color(color)},
      roughness: {value: clamp(roughness, 0, 1)}, surfaceSpecular: {value: clamp(specular, 0, 0.25)},
      fiberOpacity: {value: clamp(opacity, 0, 1)}, fiberShadows: {value: shadows ? 1 : 0},
      guideMode: {value: guides ? 1 : 0}, ambientGain: {value: Math.max(0, ambientGain)},
    }]),
    side: THREE.DoubleSide,
    depthTest: true,
  });
  records.set(material, {coverageAA: !!coverageAA, coverageResolve, coverageResolveFallback: null,
    shadows: !!shadows, samples: 0,
    drawingBuffer: [0, 0], viewportHeight: 1, coverageMode: '', meshes: new Set(),
    shadowViewports: {}, framebufferMeasured: false});
  applyCoverageMode(material);
  return material;
}

export function createFiberDepthMaterial(material) {
  recordFor(material);
  const depth = new THREE.ShaderMaterial({
    name: 'GNM r7 light-facing stochastic fibre depth',
    vertexShader: FIBER_DEPTH_VERTEX,
    fragmentShader: FIBER_DEPTH_FRAGMENT,
    uniforms: {
      viewportHeight: {value: 1}, radiusScale: material.uniforms.radiusScale,
      fiberOpacity: material.uniforms.fiberOpacity,
      // Shadow coverage must stay unchanged during visible AA-only comparison.
      coverageAA: {value: 1}, shadowSeed: {value: 0},
    },
    side: THREE.DoubleSide,
    blending: THREE.NoBlending,
    depthTest: true,
    depthWrite: true,
    transparent: false,
    toneMapped: false,
  });
  depth.depthPacking = THREE.RGBADepthPacking;
  return depth;
}

/** Uses actual GL physical pixels and current framebuffer samples, never CSS. */
export function setFiberViewport(material, renderer) {
  const record = recordFor(material);
  const gl = renderer.getContext();
  const target = renderer.getRenderTarget();
  const viewport = gl.getParameter(gl.VIEWPORT);
  record.drawingBuffer = [gl.drawingBufferWidth, gl.drawingBufferHeight];
  record.viewportHeight = Math.max(1, target ? viewport[3] : gl.drawingBufferHeight);
  record.samples = Math.max(0, Number(gl.getParameter(gl.SAMPLES)) || 0);
  record.framebufferMeasured = true;
  material.uniforms.viewportHeight.value = record.viewportHeight;
  applyCoverageMode(material);
  return fiberMaterialDiagnostics(material);
}

/** Resolve affects raster coverage only. 'blend' is the fine-strand reference;
 * its depthWrite=false alpha blend remains order dependent. 'a2c' requires real
 * multisample storage and otherwise reports an explicit blend fallback. */
export function setFiberModes(material, {coverageAA, shadows, guides, coverageResolve} = {}) {
  const record = recordFor(material);
  if (coverageResolve !== undefined) record.coverageResolve = validateCoverageResolve(coverageResolve);
  if (coverageAA !== undefined) record.coverageAA = !!coverageAA;
  if (shadows !== undefined) {
    record.shadows = !!shadows;
    material.uniforms.fiberShadows.value = record.shadows ? 1 : 0;
    for (const mesh of record.meshes) mesh.castShadow = mesh.receiveShadow = record.shadows;
  }
  if (guides !== undefined) material.uniforms.guideMode.value = guides ? 1 : 0;
  applyCoverageMode(material);
}

export function setFiberAppearance(material, {color, roughness, specular, radiusScale, opacity, ambientGain} = {}) {
  recordFor(material);
  if (color !== undefined) material.uniforms.hairColor.value.set(color);
  for (const [key, value, min, max] of [
    ['roughness', roughness, 0, 1], ['surfaceSpecular', specular, 0, 0.25],
    ['radiusScale', radiusScale, 0, 100], ['fiberOpacity', opacity, 0, 1],
    ['ambientGain', ambientGain, 0, 10],
  ]) if (Number.isFinite(value)) material.uniforms[key].value = clamp(value, min, max);
  if (Number.isFinite(opacity)) applyCoverageMode(material);
}

/** Lights already belong to the scene. Only a bounded ambient-response gain is
 * material-specific; lamp powers/directions/colours must be edited on the lamps. */
export function setFiberLighting(material, {ambientGain} = {}) {
  setFiberAppearance(material, {ambientGain});
}

export function attachFiberMaterial(mesh, {renderer, material, ...options} = {}) {
  const ownsMaterial = !material;
  const geometry = mesh.geometry;
  if (!geometry.getAttribute('scalpNormal') && geometry.getAttribute('rootNormal'))
    geometry.setAttribute('scalpNormal', geometry.getAttribute('rootNormal'));
  for (const name of ['position', 'tangent', 'scalpNormal', 'strandSide', 'strandRadius', 'along', 'strandRandom']) {
    if (!geometry.getAttribute(name)) throw new Error(`Fibre geometry requires ${name}`);
  }
  material = material || createFiberMaterial(options);
  const record = recordFor(material);
  const depthMaterial = createFiberDepthMaterial(material);
  const oldBeforeRender = mesh.onBeforeRender;
  const oldBeforeShadow = mesh.onBeforeShadow;
  mesh.material = material;
  mesh.customDepthMaterial = depthMaterial;
  mesh.castShadow = mesh.receiveShadow = record.shadows;
  // Expanded shader geometry extends beyond the centreline bounding volume.
  mesh.frustumCulled = false;
  record.meshes.add(mesh);
  mesh.onBeforeRender = function (activeRenderer, ...args) {
    if (oldBeforeRender) oldBeforeRender.call(this, activeRenderer, ...args);
    setFiberViewport(material, activeRenderer);
  };
  mesh.onBeforeShadow = function (activeRenderer, object, camera, shadowCamera, activeGeometry, activeDepth, group) {
    if (oldBeforeShadow) oldBeforeShadow.call(this, activeRenderer, object, camera, shadowCamera, activeGeometry, activeDepth, group);
    if (activeDepth !== depthMaterial) return;
    // WebGLShadowMap sets the GL viewport directly, so getCurrentViewport can
    // be stale here. Read the active shadow framebuffer's actual GL viewport.
    const gl = activeRenderer.getContext();
    const viewport = gl.getParameter(gl.VIEWPORT);
    depthMaterial.uniforms.viewportHeight.value = Math.max(1, viewport[3]);
    depthMaterial.uniforms.shadowSeed.value = (shadowCamera.id % 97) / 97;
    depthMaterial.uniformsNeedUpdate = true;
    record.shadowViewports[shadowCamera.id] = [viewport[2], viewport[3]];
  };
  if (renderer) setFiberViewport(material, renderer);
  return {material, depthMaterial, dispose() {
    record.meshes.delete(mesh);
    mesh.onBeforeRender = oldBeforeRender;
    mesh.onBeforeShadow = oldBeforeShadow;
    if (mesh.customDepthMaterial === depthMaterial) delete mesh.customDepthMaterial;
    depthMaterial.dispose();
    if (ownsMaterial) material.dispose();
  }};
}

export function fiberMaterialDiagnostics(material) {
  const record = recordFor(material);
  const u = material.uniforms;
  return {
    model: 'bounded longitudinal/azimuthal fibre approximation',
    radiusAttribute: 'strandRadius', radiusUnits: 'world', radiusScale: u.radiusScale.value,
    coverageAA: record.coverageAA, coverageMode: record.coverageMode,
    coverageResolve: record.coverageResolve, coverageResolveFallback: record.coverageResolveFallback,
    alphaToCoverage: material.alphaToCoverage, actualSamples: record.samples,
    framebufferMeasured: record.framebufferMeasured, drawingBuffer: [...record.drawingBuffer],
    viewportHeight: record.viewportHeight, transparent: material.transparent, depthWrite: material.depthWrite,
    shadows: record.shadows, shadowMethod: 'receives existing R02 VSM skin visibility; fibre shadow casting disabled',
    shadowViewports: {...record.shadowViewports},
    lightingSource: 'scene directional lights; independent per-light visibility',
    roughness: u.roughness.value, surfaceSpecular: u.surfaceSpecular.value,
    colorLinear: u.hairColor.value.toArray(), opacity: u.fiberOpacity.value,
    ambientGain: u.ambientGain.value, guides: u.guideMode.value > 0.5,
    limitations: ['no multiple scattering or deep opacity maps', 'no coloured shadow transmission',
      'directional lights with PCF only', 'non-MSAA fallback uses order-dependent alpha blending'],
  };
}
