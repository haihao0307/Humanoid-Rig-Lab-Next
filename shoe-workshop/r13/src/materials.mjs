import * as T from 'three';
import {ShoeMaterials as Retained} from '../../r09/src/materials.mjs';

const TAU = Math.PI * 2;
const UV_MM = 100;
const ROLES = new Set([
  'leather', 'lining', 'cut', 'elastic', 'canvas', 'rubber', 'welt',
  'heel', 'thread', 'metal', 'edge', 'lace', 'insole', 'webbing'
]);
const DEFAULT_COLORS = {
  upper: '#684332', lining: '#bda079', sole: '#302820',
  thread: '#c2a782', metal: '#a69062'
};
const CLAY_COLORS = {
  leather: '#b8b3a8', lining: '#a49e92', cut: '#777064',
  elastic: '#62605a', canvas: '#b8b3a8', rubber: '#66635c',
  welt: '#888073', heel: '#777064', thread: '#d0c9bb',
  metal: '#918d83', edge: '#8f887a', lace: '#d0c9bb', insole: '#aaa294', webbing: '#77746a'
};
// Controlled appearance profiles, not laboratory material measurements. Grain
// scale is corrected by the rest-surface coordinates, not by these settings.
const FINISH = Object.freeze({
  liningScanCoverage: .055, liningNormalScale: .06,
  leatherThreadUpperBlend: .58, canvasThreadUpperBlend: .66,
  threadReliefMm: .006, rubberGrainReliefMm: .010, rubberMouldReliefMm: .016
});

/**
 * R13 surface adapter; all mesh positions are millimetres, uv = material mm/100.
 *
 * Leather: retained R09 -> R07 -> R05 -> R04 -> R06/R05 donor chain. Its grain,
 * mirror-normal parity, roughness, upper pigment transfer and cut-wall shader
 * stay intact. Lining has its own weaker scan transfer over the same channels.
 * New upper meshes must provide compression=0 and craftEdge attributes.
 * Only one heritage source is selected, not the whole 13-entry catalogue.
 *
 * Scan provenance: Poly Haven Brown Leather / Rob Tuytel / CC0-1.0, from the
 * existing pinned scan-data.json. No new images, scans or asset downloads.
 * https://polyhaven.com/a/brown_leather
 * https://polyhaven.com/license
 *
 * Canvas: original height-field implementation of alternating 1/1 crossings.
 * Structural reference (not copied pixels or measured material parameters):
 * https://cottonworks.com/learning-hub/weaving/basic-woven-fabric-designs/
 * Elastic: an appearance-only ribbed woven goring surface, not an elasticity
 * solver. Nominal yarn spacing/relief are controllable appearance assumptions.
 * Normal maps affect shading, not the actual material thickness or silhouette.
 * https://threejs.org/docs/pages/MeshStandardMaterial.html
 */
export class StyleMaterials {
  constructor(renderer, scanData) {
    this.renderer = renderer;
    this.retained = new Retained(renderer, scanData);
    this.cache = new Map();
    this.shells = new Map();
    this.textiles = new Map();
    this.ownedMaterials = new Set();
    this.ready = false;
    this.disposed = false;
    this.initializing = null;
  }

  async init() {
    if (this.disposed) throw new Error('StyleMaterials has been disposed');
    if (this.ready) return this;
    if (this.initializing) return this.initializing;
    this.initializing = (async () => {
      // Retained.init loads only the embedded scan channels and heritage source.
      // Do not call AtelierMaterials.init, which builds the whole catalogue.
      await this.retained.init();
      const maxAnisotropy = this.renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;
      this.anisotropy = Math.max(1, Math.min(8, maxAnisotropy));
      for (const texture of Object.values(this.retained.library.appearance.textures)) {
        // Original uv was mm/96. Keep its physical grain size with mm/100 UVs.
        // The mirrored full periods remain 300 x 150 mm, as in the donor.
        texture.repeat.set(UV_MM / 150, UV_MM / 75);
        texture.anisotropy = this.anisotropy;
      }
      this.ready = true;
      return this;
    })();
    return this.initializing;
  }

  get(role, style, {clay = false, wire = false} = {}) {
    if (!this.ready || this.disposed) throw new Error('Await StyleMaterials.init() before get()');
    if (!ROLES.has(role)) throw new Error(`Unknown R13 material role: ${role}`);
    const spec = styleSpec(style);
    const key = `${spec.key}|${role}|${clay ? 1 : 0}|${wire ? 1 : 0}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const material = clay
      ? new T.MeshStandardMaterial({color: CLAY_COLORS[role], roughness: .8})
      : this.createRole(role, spec, wire);
    material.name = `R13_${spec.id}_${role}${clay ? '_clay' : ''}${wire ? '_wire' : ''}`;
    material.side = T.DoubleSide;
    material.wireframe = !!wire;
    material.depthTest = true;
    material.depthWrite = true;
    material.transparent = false;
    material.userData = {
      ...material.userData,
      r13Role: role, r13Style: spec.id, appearanceOnly: true,
      physicalCalibration: false, uvMillimetresPerUnit: UV_MM,
      ownedByStyleMaterials: true
    };
    this.ownedMaterials.add(material);
    this.cache.set(key, material);
    return material;
  }

  createRole(role, spec, wire) {
    const colors = spec.colors;
    const clothShoe = spec.id === 'canvas';

    if (role === 'canvas') return this.cloth('canvas', colors.upper);
    if (role === 'elastic') {
      const color = new T.Color('#2d2c28').lerp(new T.Color(colors.upper), .08);
      return this.cloth('elastic', color);
    }
    if (role === 'webbing') {
      const color = new T.Color('#302e29').lerp(new T.Color(colors.upper), .12);
      const material = this.cloth('canvas', color);
      material.normalScale.set(.72, .72);
      material.sheen = .26;
      material.userData.surfaceRole = 'woven-pull-tab-webbing';
      material.userData.sharedTextureSource = 'canvas-plain-weave';
      return material;
    }
    if (clothShoe && ['lining', 'insole', 'cut', 'edge'].includes(role)) {
      const color = role === 'edge'
        ? new T.Color(colors.upper).lerp(new T.Color(colors.lining), .16)
        : new T.Color(colors.lining);
      const material = this.cloth('canvas', color);
      material.normalScale.set(role === 'cut' ? .26 : .38, role === 'cut' ? .26 : .38);
      material.sheen = .14;
      material.userData.surfaceRole = `cotton-${role}`;
      return material;
    }
    if (role === 'leather') return this.shell(spec, wire)[0];
    if (role === 'lining') return this.shell(spec, wire)[1];
    if (role === 'cut') return this.shell(spec, wire)[2];

    if (role === 'insole') {
      const material = copyMaterial(this.shell(spec, wire)[1]);
      material.color.multiplyScalar(.9);
      material.roughness = .95;
      material.userData.surfaceRole = 'matte-leather-sockliner';
      return material;
    }
    if (role === 'edge' || role === 'welt') {
      const material = copyMaterial(this.shell(spec, wire)[2]);
      if (role === 'welt') {
        material.color.copy(new T.Color(colors.upper).lerp(new T.Color(colors.sole), .24));
        material.color.multiplyScalar(.75);
        material.roughness = .6;
      }
      material.userData.surfaceRole = role === 'welt' ? 'leather-welt-edge' : 'wax-sealed-cut-wall';
      return material;
    }
    if (role === 'rubber' || (role === 'heel' && clothShoe)) {
      const material = this.retained.sole({material: 'leather', wire, cutaway: false}, null);
      material.color.set(colors.sole);
      material.roughness = .84;
      finishRubberRelief(material);
      material.userData.surfaceRole = 'matte-moulded-rubber';
      return material;
    }
    if (role === 'heel') {
      const material = copyMaterial(this.shell(spec, wire)[2]);
      material.color.set(colors.sole);
      material.roughness = .74;
      finishStackedHeel(material);
      material.userData.surfaceRole = 'stacked-leather-heel-edge';
      return material;
    }
    if (role === 'metal') {
      return new T.MeshStandardMaterial({
        color: colors.metal, metalness: .88, roughness: .29,
        userData: {surfaceRole: 'brushed-buckle-or-eyelet'}
      });
    }
    if (role === 'thread' || role === 'lace') {
      const material = this.retained.yarn({
        material: 'leather', wire, cutaway: false, threadDiameter: .38
      }, null, role === 'lace');
      const color = new T.Color(colors.thread);
      if (role === 'thread') color.lerp(new T.Color(colors.upper),
        clothShoe ? FINISH.canvasThreadUpperBlend : FINISH.leatherThreadUpperBlend);
      material.color.copy(color);
      material.roughness = .86;
      material.sheen = role === 'lace' ? .24 : .16;
      material.sheenRoughness = .92;
      material.sheenColor.copy(color).lerp(new T.Color('#ddd2bc'), .14);
      if (role === 'lace') {
        Object.assign(material, this.textile('canvas').maps);
        material.normalScale = new T.Vector2(.42, .42);
        material.userData.sharedTextureSource = 'canvas-plain-weave';
      }
      finishSpunThread(material, role === 'lace');
      return material;
    }
    throw new Error(`Unhandled R13 material role: ${role}`);
  }

  shell(spec, wire) {
    const key = `${spec.key}|${wire ? 1 : 0}`;
    if (this.shells.has(key)) return this.shells.get(key);
    const state = {
      leatherId: 'heritage', materialSet: 'uniform',
      partLeather: {27: 'heritage'}, material: 'leather', wire, cutaway: false
    };
    const materials = this.retained.shell({id: 27, kind: 'upper'}, state, null);
    const source = new T.Color(this.retained.current.params.color);
    tintRatio(materials[0].color, new T.Color(spec.colors.upper), source);

    // The inherited flesh shader uses the same source-mean normalization as
    // grain. Retint that normalized source; do not multiply a second dark scan.
    tintRatio(materials[1].color, new T.Color(spec.colors.lining), source);
    materials[1].color.multiplyScalar(1 / .68);
    materials[1].sheenColor.set(spec.colors.lining);
    materials[1].normalScale.set(FINISH.liningNormalScale, FINISH.liningNormalScale);
    finishMatteLining(materials[1]);
    materials[2].color.set(spec.colors.upper).multiplyScalar(.66);
    for (const material of materials) {
      material.userData = {
        ...material.userData,
        donorSource: 'retained-r09-r07-r05-r04-heritage',
        scanProvenance: 'Poly Haven Brown Leather / Rob Tuytel / CC0-1.0',
        requiredGeometryAttributes: ['uv', 'compression', 'craftEdge'],
        physicalCalibration: false
      };
      this.ownedMaterials.add(material);
    }
    this.shells.set(key, materials);
    return materials;
  }

  cloth(kind, color) {
    const textures = this.textile(kind);
    const elastic = kind === 'elastic';
    return new T.MeshPhysicalMaterial({
      color, ...textures.maps,
      normalScale: new T.Vector2(elastic ? .78 : .66, elastic ? .78 : .66),
      roughness: .98, metalness: 0, clearcoat: 0,
      sheen: elastic ? .25 : .24, sheenRoughness: .94,
      sheenColor: elastic ? '#827e70' : '#d9cfb9',
      userData: {
        surfaceRole: elastic ? 'ribbed-woven-elastic-goring' : 'cotton-canvas-1-over-1',
        weave: elastic ? 'ribbed-goring-appearance' : 'alternating-plain-1-1',
        nominalPitchMm: elastic ? {ribs: 1, ties: .25} : {warp: .5, weft: .5},
        heightFieldOnly: true, yarnScaleMeasured: false,
        textureTileMm: textures.tileMm, textureResolution: textures.resolution
      }
    });
  }

  textile(kind) {
    if (this.textiles.has(kind)) return this.textiles.get(kind);
    const resolution = 256;
    const tileMm = 8;
    const dx = tileMm / resolution;
    const mapPixels = new Uint8Array(resolution * resolution * 4);
    const normalPixels = new Uint8Array(mapPixels.length);
    const roughnessPixels = new Uint8Array(mapPixels.length);
    const sample = kind === 'elastic' ? sampleGoring : sampleCanvas;
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const u = (x + .5) * dx;
        const v = (y + .5) * dx;
        const s = sample(u, v);
        const nx = -(sample(u + dx, v).height - sample(u - dx, v).height) / (2 * dx);
        const ny = -(sample(u, v + dx).height - sample(u, v - dx).height) / (2 * dx);
        const length = Math.hypot(nx, ny, 1);
        const i = (y * resolution + x) * 4;
        const luminance = toByte(s.shade);
        mapPixels.set([luminance, luminance, luminance, 255], i);
        normalPixels.set([
          toByte(.5 + .5 * nx / length),
          toByte(.5 + .5 * ny / length),
          toByte(.5 + .5 / length), 255
        ], i);
        const roughness = toByte(s.roughness);
        roughnessPixels.set([roughness, roughness, roughness, 255], i);
      }
    }
    const makeTexture = (pixels, color = false) => {
      const texture = new T.DataTexture(pixels, resolution, resolution, T.RGBAFormat);
      texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.minFilter = T.LinearMipmapLinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = this.anisotropy;
      texture.repeat.set(UV_MM / tileMm, UV_MM / tileMm);
      texture.needsUpdate = true;
      return texture;
    };
    const maps = {
      map: makeTexture(mapPixels, true),
      normalMap: makeTexture(normalPixels),
      roughnessMap: makeTexture(roughnessPixels)
    };
    const result = {maps, tileMm, resolution};
    this.textiles.set(kind, result);
    return result;
  }

  report() {
    const channels = Object.values(this.retained.library.appearance.textures);
    return {
      donorSetCount: this.retained.cache.size,
      donorSource: 'heritage-only', donorChannels: channels.length,
      cachedMaterialCount: this.ownedMaterials.size,
      proceduralTextureCount: this.textiles.size * 3,
      proceduralTextureBaseBytes: this.textiles.size * 3 * 256 * 256 * 4,
      proceduralTextureKinds: [...this.textiles.keys()],
      sharedTextureRoles: {canvas: ['canvas', 'webbing', 'lace', 'cotton-lining'], elastic: ['elastic']},
      controlledAppearanceProfile: {...FINISH},
      appearanceOnly: true, physicalCalibration: false,
      textureOwnership: 'StyleMaterials.dispose; do not dispose per mesh',
      uvMillimetresPerUnit: UV_MM
    };
  }

  dispose() {
    if (this.disposed) return;
    for (const material of this.ownedMaterials) material.dispose();
    for (const textile of this.textiles.values()) {
      for (const texture of Object.values(textile.maps)) texture.dispose();
    }
    this.retained.dispose();
    this.ownedMaterials.clear();
    this.textiles.clear();
    this.shells.clear();
    this.cache.clear();
    this.ready = false;
    this.disposed = true;
  }
}

function styleSpec(style) {
  const id = style?.id ?? 'style';
  const colors = {...DEFAULT_COLORS, ...style?.colors};
  const key = `${id}|${Object.keys(DEFAULT_COLORS).map(k => new T.Color(colors[k]).getHexString()).join('|')}`;
  return {id, colors, key};
}

function tintRatio(color, target, source) {
  color.r *= target.r / Math.max(1e-6, source.r);
  color.g *= target.g / Math.max(1e-6, source.g);
  color.b *= target.b / Math.max(1e-6, source.b);
}

function copyMaterial(source) {
  const material = source.clone();
  material.onBeforeCompile = source.onBeforeCompile;
  material.customProgramCacheKey = source.customProgramCacheKey;
  material.userData = {...source.userData};
  return material;
}

function toByte(value) {
  return Math.round(Math.min(1, Math.max(0, value)) * 255);
}

// Sixteen yarns per 8 mm tile: the two-yarn over/under period tiles exactly.
// Adjacent yarns reverse their crimp phase. No punched-through alpha grid.
function sampleCanvas(x, y) {
  const pitch = .5;
  const px = x / pitch;
  const py = y / pitch;
  const ix = Math.round(px);
  const iy = Math.round(py);
  const ax = Math.max(0, 1 - ((px - ix) / .485) ** 2);
  const ay = Math.max(0, 1 - ((py - iy) / .485) ** 2);
  const warp = Math.sqrt(ax) * (.067 + .022 * Math.cos(Math.PI * (py + ix)));
  const weft = Math.sqrt(ay) * (.067 - .022 * Math.cos(Math.PI * (px + iy)));
  const height = Math.max(warp, weft);
  const warpOnTop = warp >= weft;
  const longCoordinate = warpOnTop ? y : x;
  const crossCoordinate = warpOnTop ? x : y;
  const fibre = Math.sin(TAU * crossCoordinate / .125 + .21 * Math.sin(TAU * longCoordinate / 4));
  const slow = Math.sin(TAU * x / 8) * Math.cos(TAU * y / 4);
  return {
    height: height + .0018 * fibre,
    shade: .865 + .095 * Math.min(1, height / .089) + .012 * fibre + .009 * slow,
    roughness: .87 + .065 * (1 - Math.min(1, height / .089)) + .012 * slow
  };
}

// U crosses the ribs; V follows the boot shaft. The tie-yarn period is 0.25 mm.
function sampleGoring(x, y) {
  const rib = (.5 + .5 * Math.cos(TAU * x)) ** 1.7;
  // A smooth alternating crimp phase keeps adjacent woven ribs from reading
  // as one extruded rubber comb. This remains exactly periodic on an 8 mm tile.
  const tie = .5 + .5 * Math.cos(TAU * y / .25 + Math.PI * (.5 - .5 * Math.cos(Math.PI * x)));
  const fine = Math.sin(TAU * x / .125 + .17 * Math.sin(TAU * y / 2));
  return {
    height: .057 * rib + .013 * tie * (.4 + .6 * rib) + .0018 * fine,
    shade: .85 + .092 * rib + .034 * tie + .009 * fine,
    roughness: .87 + .072 * (1 - rib) + .016 * (1 - tie)
  };
}

function finishMatteLining(material) {
  const original = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    original(shader);
    const retainedTransfer = 'leatherTexel.rgb,.22)';
    if (!shader.fragmentShader.includes(retainedTransfer)) {
      throw new Error('R13 lining adapter: retained mean transfer changed');
    }
    shader.fragmentShader = shader.fragmentShader.replace(retainedTransfer,
      `leatherTexel.rgb,${FINISH.liningScanCoverage})`);
  };
  material.customProgramCacheKey = () => `${baseKey}-r13-lining-${FINISH.liningScanCoverage}`;
  material.userData = {...material.userData, surfaceRole: 'matte-fine-leather-lining',
    scanMacroContrast: FINISH.liningScanCoverage, meanAlbedoNormalizationPreserved: true};
}

// Screen derivatives of actual view-space position convert a height in metres
// into a surface-normal perturbation. This is a surface-gradient bump, not a
// displacing mesh. The runtime renders design millimetres at object scale .001.
// Differential background / Three r170 bump implementation reference:
// https://mmikk.github.io/papers3d/mm_sfgrad_bump.pdf
const heightGradientGLSL = `
  vec3 r13HeightNormal(vec3 pointView,vec3 n,float heightMetres,float faceSign){
    vec3 dx=dFdx(pointView),dy=dFdy(pointView);
    vec3 r1=cross(dy,n),r2=cross(n,dx);
    float det=dot(dx,r1)*faceSign;
    float safeDet=max(abs(det),1e-20);
    vec3 grad=sign(det)*(dFdx(heightMetres)*r1+dFdy(heightMetres)*r2);
    return normalize(safeDet*n-grad);
  }`;

function finishRubberRelief(material) {
  const original = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    original(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${heightGradientGLSL}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float r13RubberGrain=sin(dot(vRubberP,vec3(8.3,12.1,10.9)))*sin(dot(vRubberP,vec3(-5.3,8.4,7.5)));
        float r13RubberFade=1.-smoothstep(.3,1.7,length(fwidth(vRubberP))*10.);
        roughnessFactor=clamp(roughnessFactor+.034*(1.-r13RubberGrain)*r13RubberFade,.65,.98);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float r13MouldPhase=6.28318530718*vRubberP.y/.72;
        float r13MouldFade=1.-smoothstep(.65,3.2,fwidth(r13MouldPhase));
        float r13MouldSide=1.-smoothstep(.25,.75,abs(normalize(vRubberN).y));
        float r13RubberHeight=(${FINISH.rubberGrainReliefMm}*r13RubberGrain*r13RubberFade
          +${FINISH.rubberMouldReliefMm}*sin(r13MouldPhase)*r13MouldFade*r13MouldSide)*.001;
        normal=r13HeightNormal(-vViewPosition,normal,r13RubberHeight,faceDirection);`);
  };
  material.customProgramCacheKey = () => `${baseKey}-r13-rubber-surface-gradient-v1`;
  material.userData = {...material.userData, microRelief: 'analytic surface-gradient bump',
    nominalGrainHeightMm: FINISH.rubberGrainReliefMm,
    nominalMouldHeightMm: FINISH.rubberMouldReliefMm, reliefCalibrated: false};
}

function finishStackedHeel(material) {
  const original = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = shader => {
    original(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vR13HeelHeight;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvR13HeelHeight=position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vR13HeelHeight;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r13LayerPhase=vR13HeelHeight*6.28318530718/1.2;
        float r13LayerFade=1.-smoothstep(.65,3.1,fwidth(r13LayerPhase));
        diffuseColor.rgb*=1.+.045*cos(r13LayerPhase)*r13LayerFade;`);
  };
  const baseKey = originalKey();
  material.customProgramCacheKey = () => `${baseKey}-r13-layered-heel`;
}

function finishSpunThread(material, lace) {
  const original = material.onBeforeCompile;
  const baseKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    original(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vR13ThreadMm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvR13ThreadMm=uv*100.;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec2 vR13ThreadMm;\n${heightGradientGLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float r13ThreadPhase=dot(vR13ThreadMm,vec2(2.3,6.1))*6.28318530718;
        float r13ThreadFade=1.-smoothstep(.7,3.,fwidth(r13ThreadPhase));
        diffuseColor.rgb*=1.+.045*sin(r13ThreadPhase)*r13ThreadFade;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float r13ThreadHeight=${lace ? .003 : FINISH.threadReliefMm}*sin(r13ThreadPhase)*r13ThreadFade*.001;
        normal=r13HeightNormal(-vViewPosition,normal,r13ThreadHeight,faceDirection);`);
  };
  material.customProgramCacheKey = () => `${baseKey}-r13-spun-${lace ? 'lace' : 'thread'}`;
  material.userData = {...material.userData, surfaceRole: lace ? 'woven-lace' : 'spun-sewing-thread'};
}
