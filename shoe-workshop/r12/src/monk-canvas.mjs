import * as T from 'three';
import { V, clamp, mix, smooth, patch, upperPatches, panel, descriptor, pathGeometry, seam } from './kernel.mjs';

// Archetype construction, not a digitised commercial shoe or manufacturing pattern.
// C&J: open monk quarters, an integral vamp/tongue, two working strap paths.
// Superga: separate cotton panels, eyelet facings and a vulcanised sole interface.
// All positions are sampled from the same current last; dimensions are design mm.

const PI = Math.PI;
const HALF = PI / 2;
const sample = (fn, count = 36) => Array.from({ length: count + 1 }, (_, i) => fn(i / count));
const numericalNormal = (fn, u, v) => {
  const e = 1e-4;
  return fn(clamp(u + e), v).sub(fn(clamp(u - e), v))
    .cross(fn(u, clamp(v + e)).sub(fn(u, clamp(v - e)))).normalize();
};

/** Tile a continuous strip with exact aperture boundary loops. The outer edges of
 * neighbouring cells share samples. Hole circles are mapped through the local
 * surface Jacobian, so unlike rejected cells they have a smooth actual cut edge.
 * UVs stay tied to the parent surface. Four radial patches make each perforation. */
function perforatedStrip(point, normal, holes, { uv = null, around = 10, radial = 3, linearCorners = false } = {}) {
  const out = [], centres = holes.map(h => h.u);
  for (let h = 0; h < holes.length; h++) {
    const hole = holes[h], uc = hole.u, vc = hole.v ?? .5;
    const lo = h ? (centres[h - 1] + uc) / 2 : 0;
    const hi = h + 1 < holes.length ? (uc + centres[h + 1]) / 2 : 1;
    const e = 1e-4, p = point(uc, vc);
    const A = point(uc + e, vc).sub(point(uc - e, vc)).multiplyScalar(.5 / e);
    const B = point(uc, vc + e).sub(point(uc, vc - e)).multiplyScalar(.5 / e);
    const axisA = A.clone().normalize(), axisB = B.clone().addScaledVector(axisA, -B.dot(axisA)).normalize();
    const aa = A.length(), ba = B.dot(axisA), bb = B.dot(axisB);
    const circle = angle => {
      const x = hole.radius * Math.cos(angle), y = hole.radius * Math.sin(angle);
      const dv = y / bb, du = (x - ba * dv) / aa;
      return [uc + du, vc + dv];
    };
    const corners = [[lo, 0], [hi, 0], [hi, 1], [lo, 1]], angles = [];
    for (const c of corners) {
      const d = point(...c).sub(p);
      // A whole quarter bends around the heel. Its far corners can fold when
      // projected into one physical tangent plane, whereas its parameter domain
      // remains a rectangle. Use the local Jacobian for those corner directions.
      let a = linearCorners ? Math.atan2(bb * (c[1] - vc), aa * (c[0] - uc) + ba * (c[1] - vc))
        : Math.atan2(d.dot(axisB), d.dot(axisA));
      while (angles.length && a <= angles.at(-1)) a += PI * 2;
      angles.push(a);
    }
    angles.push(angles[0] + PI * 2);
    for (let side = 0; side < 4; side++) {
      const ca = corners[side], cb = corners[(side + 1) % 4];
      const domain = (u, v) => {
        const inner = circle(mix(angles[side], angles[side + 1], u));
        return [mix(inner[0], mix(ca[0], cb[0], u), v), mix(inner[1], mix(ca[1], cb[1], u), v)];
      };
      const radialSteps = typeof radial === 'function' ? radial(h, side) : radial;
      out.push(patch((u, v) => point(...domain(u, v)), around, radialSteps, {
        normal: (u, v) => normal(...domain(u, v)),
        uv: (u, v) => uv ? uv(...domain(u, v)) : [domain(u, v)[0], domain(u, v)[1]]
      }));
    }
  }
  return out;
}

function thinPath(id, fn, width, depth, role, extra = {}, count = 40) {
  return descriptor(id, pathGeometry(sample(fn, count), width, depth), role,
    { kind: 'binding', forceSolved: false, ...extra });
}

function roundedRectangle(shape, x, y, w, h, r) {
  shape.moveTo(x + r, y); shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r); shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h); shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r); shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function surfaceFrame(last, s, theta, offset) {
  const p = last.at(s, theta, offset), n = last.normal(s, theta);
  const across = last.point(s, theta + .001).sub(last.point(s, theta - .001)).normalize();
  const along = n.clone().cross(across).normalize();
  return { p, n, across, along, matrix: new T.Matrix4().makeBasis(across, along, n).setPosition(p) };
}

function buckle(last, s, theta, width, index) {
  const frame = surfaceFrame(last, s, theta, last.params.thickness * 2.05 + 2.1);
  const outerW = 13.8, outerH = width + 5.4, innerW = 10.1, innerH = width + 1.8;
  const shape = roundedRectangle(new T.Shape(), -outerW / 2, -outerH / 2, outerW, outerH, 2.4);
  shape.holes.push(roundedRectangle(new T.Path(), -innerW / 2, -innerH / 2, innerW, innerH, 1.5));
  const g = new T.ExtrudeGeometry(shape, { depth: .8, bevelEnabled: true, bevelThickness: .3, bevelSize: .3, bevelSegments: 2, curveSegments: 5, steps: 1 });
  // The workbench contract requires indexed geometry, including native extrusion.
  g.setIndex(Array.from({ length: g.attributes.position.count }, (_, i) => i));
  g.translate(0, 0, -.4); g.applyMatrix4(frame.matrix); g.computeBoundingBox();
  const items = [descriptor('monk-buckle-frame-' + index, g, 'metal', {
    kind: 'buckle', realOpening: true, strapWidthMm: width, clearWidthMm: innerH, explode: [15, 22, 0]
  })];
  const pin = sample(t => V(mix(-6, 3.8, t), 0, .6 - .85 * Math.sin(PI * t)).applyMatrix4(frame.matrix), 14);
  items.push(descriptor('monk-buckle-prong-' + index, pathGeometry(pin, .92, .85), 'metal', {
    kind: 'buckle-prong', articulated: false, explode: [15, 22, 0]
  }));
  return items;
}

/** Rolled metal eyelet: a flange, a through bore and a sleeve through both canvas
 * layers. The profile is revolved in the tangent frame, never over a solid panel. */
function eyelet(last, s, theta, index, side, outerOffset, sleeveDepth) {
  const frame = surfaceFrame(last, s, theta, outerOffset);
  const profile = [[2.15, .30], [2.5, .48], [3.4, .25], [3.4, .04], [2.52, 0], [2.50, -sleeveDepth], [2.15, -sleeveDepth]];
  const pos = [], uv = [], idx = [], n = 24;
  for (let j = 0; j < profile.length; j++) for (let i = 0; i <= n; i++) {
    const a = i / n * PI * 2, [r, z] = profile[j];
    const p = V(r * Math.cos(a), r * Math.sin(a), z).applyMatrix4(frame.matrix);
    pos.push(...p.toArray()); uv.push(i / n, j / profile.length);
  }
  for (let j = 0; j < profile.length; j++) for (let i = 0; i < n; i++) {
    const a = j * (n + 1) + i, b = a + 1, c = (j + 1) % profile.length * (n + 1) + i, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingBox();
  g.userData.apertureDiameterMm = 4.3;
  return descriptor(`canvas-eyelet-${side}-${index}`, g, 'metal', {
    kind: 'eyelet', realOpening: true, apertureDiameterMm: 4.3,
    apertureCenter: frame.p.toArray(), apertureAxis: frame.n.toArray(), explode: [side * 14, 20, 0]
  });
}

export function buildMonk(last) {
  const out = [], t = last.params.thickness;
  // The rounded rear end is the integral tongue. Its shoulders reach underneath
  // the open quarters; the same continuous panel extends to the toe.
  const frontAt = a => a <= 1 ? .305 + .02 * (a ** 4) : mix(.325, .585, smooth(1, HALF, a));
  const vampDomain = (u, v) => { const a = mix(-HALF, HALF, v); return [mix(frontAt(Math.abs(a)), 1, u), a]; };
  out.push(panel('monk-integral-vamp-tongue', [patch((u, v) => last.at(...vampDomain(u, v)), 56, 22, {
    normal: (u, v) => last.normal(...vampDomain(u, v)), uv: (u, v) => { const [s, a] = vampDomain(u, v); return [s * last.L / 100, a * 52 / 100]; }
  })], t, 'leather', { construction: 'one continuous vamp and tongue', explode: [0, 18, 20] }));
  const angleAt = s => {
    if (s <= .305) return 0; if (s >= .585) return HALF;
    let lo = 0, hi = HALF; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (frontAt(m) < s) lo = m; else hi = m; }
    return (lo + hi) / 2;
  };
  out.push(panel('monk-open-quarters', upperPatches(last, 0, .588, {
    inner: s => Math.max(0, angleAt(s) - .065), offset: t + .08, nu: 54, nv: 14
  }), t, 'leather', { construction: 'open quarters overlap vamp shoulders', explode: [0, 18, -18] }));

  // The closure is a broad inside-quarter extension, followed by two free straps.
  const flapDomain = (u, v) => {
    const a = mix(-1.28, .52, u), back = mix(.306, .326, smooth(-1.28, .52, a));
    const front = mix(.490, .482, smooth(-1.28, .52, a));
    return [mix(back, front, v), a];
  };
  const flapOffset = t * 2 + .14;
  out.push(panel('monk-overlap-flap', [patch((u, v) => last.at(...flapDomain(u, v), flapOffset), 26, 12, {
    normal: (u, v) => last.normal(...flapDomain(u, v)), uv: (u, v) => { const [s, a] = flapDomain(u, v); return [s * last.L / 100, a * 52 / 100]; }
  })], t, 'leather', { kind: 'closure-panel', closure: 'medial quarter extension', explode: [-9, 35, 0] }));
  for (const edge of [0, 1]) out.push(seam('monk-flap-edge-' + edge,
    u => last.at(...flapDomain(u, edge ? .95 : .05), flapOffset), {
      normalFn: u => last.normal(...flapDomain(u, edge ? .95 : .05)), pitch: 3.1, width: .36
    }));

  const width = 15.0, buckleTheta = 1.00;
  for (const [i, s0] of [.351, .447].entries()) {
    const strapDomain = (u, v) => {
      const tipRound = .037 * smooth(.85, 1, u) * ((v * 2 - 1) ** 2);
      const a = mix(.27, 1.43, u) - tipRound;
      return [s0 + .009 * (a - buckleTheta) + (v - .5) * width / last.L, a];
    };
    const strapOffset = u => t * 2 + 1.12 + .16 * Math.sin(PI * u);
    const point = (u, v) => last.at(...strapDomain(u, v), strapOffset(u));
    const normal = (u, v) => last.normal(...strapDomain(u, v));
    const holes = [.6293, .78, .87, .952].map(u => ({ u, radius: 1.08 }));
    const gpanel = panel('monk-perforated-strap-' + i, perforatedStrip(point, normal, holes, {
      around: 8, radial: 3, uv: (u, v) => [u * .68, v * width / 100]
    }), t, 'leather', { kind: 'strap', realHoleCount: holes.length, widthMm: width, explode: [10, 38, 0] });
    gpanel.geometry.userData.realHoleCount = holes.length;
    gpanel.geometry.userData.apertures = holes.map(h => ({ centre: point(h.u, .5).toArray(), axis: normal(h.u, .5).toArray(), radiusMm: h.radius }));
    out.push(gpanel);
    out.push(...buckle(last, s0, buckleTheta, width, i));
    // A short, thick anchor is attached to the outside quarter beneath the buckle.
    const anchorDomain = (u, v) => [s0 + (v - .5) * 11 / last.L, mix(1.01, 1.48, u)];
    out.push(panel('monk-buckle-anchor-' + i, [patch((u, v) => last.at(...anchorDomain(u, v), t * 1.8), 16, 6, {
      normal: (u, v) => last.normal(...anchorDomain(u, v)), uv: (u, v) => [u * .25, v * .11]
    })], t, 'leather', { kind: 'buckle-anchor', explode: [14, 25, 0] }));
    for (const edge of [.10, .90]) out.push(seam(`monk-strap-stitch-${i}-${edge}`,
      u => point(u * .97, edge), { normalFn: u => normal(u * .97, edge), pitch: 2.9, width: .34, depth: .15 }));
  }
  // A restrained cap is a real overlapping leather panel, not a painted stripe.
  out.push(panel('monk-toe-cap', upperPatches(last, .778, 1, { offset: t + .06, nu: 20, nv: 12 }), t, 'leather', {
    construction: 'separate toe cap', explode: [0, 17, 29]
  }));
  out.push(seam('monk-toe-cap-stitch', u => last.at(.786, mix(-HALF + .025, HALF - .025, u), t + .06), {
    normalFn: u => last.normal(.786, mix(-HALF + .025, HALF - .025, u)), pitch: 3.1, width: .36
  }));
  for (const side of [-1, 1]) {
    out.push(seam('monk-quarter-front-' + side, u => {
      const s = mix(.327, .575, u); return last.at(s, side * Math.max(last.collarAngle(s), angleAt(s) - .027), t + .08);
    }, { normalFn: u => { const s = mix(.327, .575, u); return last.normal(s, side * Math.max(last.collarAngle(s), angleAt(s) - .027)); }, width: .36 }));
    out.push(thinPath('monk-collar-binding-' + side, u => {
      const s = mix(.008, .325, u); return last.at(s, side * last.collarAngle(s), t + .04);
    }, 1.35, .72, 'edge', { explode: [0, 20, -10] }, 58));
  }
  return out;
}

export function buildCanvas(last) {
  const out = [], t = .8 * last.params.thickness / 1.35;
  const gap = .235;
  const throat = s => Math.max(last.collarAngle(s), gap * smooth(.24, .37, s));
  const edgeFront = v => mix(.599, .741, v ** .78);
  const rows = [.360, .414, .468, .522, .576];
  const faceStart = .327, faceEnd = .608, facingLow = .015, facingHigh = .345;
  const baseOffset = .85, facingOffset = baseOffset + t;
  const eyeTheta = s => throat(s) + (facingLow + facingHigh) / 2;

  // Quarters stop along a slanting front edge. Both layers are genuinely open at
  // each eyelet. The hidden underlay also has explicit circular cut loops: deleting
  // regular grid cells could produce corner-touching holes at small last sizes.
  for (const side of [-1, 1]) {
    const domain = (u, v) => { const s = mix(0, edgeFront(v), u); return [s, side * mix(throat(s), HALF, v)]; };
    const point = (u, v) => last.at(...domain(u, v), baseOffset);
    const quarterNormal = (u, v) => last.normal(...domain(u, v));
    // Exact inverse of the quarter map puts its holes on the same last locations
    // as the facing and metal eyelets, including width/instep extremes.
    const quarterHoles = rows.map(s => {
      const v = (eyeTheta(s) - throat(s)) / (HALF - throat(s));
      return { u: s / edgeFront(v), v, radius: 2.95 };
    });
    const quarter = panel('canvas-quarter-' + side, perforatedStrip(point, quarterNormal, quarterHoles, {
      around: 12, radial: hole => hole === 0 ? 18 : 6, linearCorners: true,
      uv: (u, v) => { const [s, a] = domain(u, v); return [s * last.L / 100, a * 52 / 100]; }
    }), t, 'canvas', { realHoleCount: 5, construction: 'canvas quarter with explicit eyelet underlay cut loops', explode: [side * 17, 18, -8] });
    quarter.geometry.userData.realHoleCount = 5;
    quarter.geometry.userData.apertures = quarterHoles.map(h => ({ centre: point(h.u, h.v).toArray(), axis: quarterNormal(h.u, h.v).toArray(), radiusMm: h.radius }));
    out.push(quarter);
    const faceDomain = (u, v) => { const s = mix(faceStart, faceEnd, u); return [s, side * (throat(s) + mix(facingLow, facingHigh, v))]; };
    const facePoint = (u, v) => last.at(...faceDomain(u, v), facingOffset);
    const faceNormal = (u, v) => last.normal(...faceDomain(u, v));
    const holes = rows.map(s => ({ u: (s - faceStart) / (faceEnd - faceStart), radius: 2.48 }));
    const face = panel('canvas-perforated-facing-' + side, perforatedStrip(facePoint, faceNormal, holes, {
      around: 8, radial: 3, uv: (u, v) => [mix(faceStart, faceEnd, u) * last.L / 100, v * .16]
    }), t, 'canvas', { kind: 'eyelet-facing', realHoleCount: 5, explode: [side * 20, 25, 0] });
    face.geometry.userData.realHoleCount = 5;
    face.geometry.userData.apertures = holes.map(h => ({ centre: facePoint(h.u, .5).toArray(), axis: faceNormal(h.u, .5).toArray(), radiusMm: h.radius }));
    out.push(face);
    for (const [i, s] of rows.entries()) out.push(eyelet(last, s, side * eyeTheta(s), i, side, facingOffset, t * 2 + .05));
    out.push(seam('canvas-facing-stitch-' + side, u => facePoint(u, .925), {
      normalFn: u => faceNormal(u, .925), pitch: 2.7, width: .34, depth: .15
    }));
    out.push(seam('canvas-quarter-front-stitch-' + side, u => {
      const s = edgeFront(u) - .008, a = side * mix(throat(s), HALF - .03, u); return last.at(s, a, baseOffset);
    }, { normalFn: u => { const s = edgeFront(u) - .008; return last.normal(s, side * mix(throat(s), HALF - .03, u)); }, pitch: 2.8, width: .35 }));
    out.push(thinPath('canvas-collar-binding-' + side, u => {
      const s = mix(.004, .328, u); return last.at(s, side * throat(s), baseOffset + .10);
    }, 1.65, .70, 'canvas', { explode: [side * 10, 19, -10] }, 58));
  }

  const vampStart = a => a <= gap ? .587 : edgeFront(clamp((a - gap) / (HALF - gap))) - .012;
  const vampDomain = (u, v) => { const a = mix(-HALF, HALF, v); return [mix(vampStart(Math.abs(a)), 1, u), a]; };
  out.push(panel('canvas-rounded-vamp', [patch((u, v) => last.at(...vampDomain(u, v), .02), 54, 20, {
    normal: (u, v) => last.normal(...vampDomain(u, v)), uv: (u, v) => { const [s, a] = vampDomain(u, v); return [s * last.L / 100, a * 52 / 100]; }
  })], t, 'canvas', { construction: 'separate curved vamp under quarter overlap', explode: [0, 16, 28] }));

  const tongueDomain = (u, v) => {
    const w = v * 2 - 1, s = mix(.308 + .020 * w * w, .622, u);
    return [s, w * Math.min(1.20, throat(s) + .21)];
  };
  out.push(panel('canvas-independent-tongue', [patch((u, v) => last.at(...tongueDomain(u, v), .10), 30, 12, {
    normal: (u, v) => last.normal(...tongueDomain(u, v)), uv: (u, v) => [u * .90, v * .65]
  })], t, 'canvas', { construction: 'separate tongue extends underneath eyelet quarters', explode: [0, 37, 3] }));
  out.push(seam('canvas-tongue-tip-stitch', u => last.at(...tongueDomain(.028, u), .10), {
    normalFn: u => last.normal(...tongueDomain(.028, u)), pitch: 2.7, width: .32, depth: .14
  }));

  // Flat static cotton lacing. Ends descend into the true eyelet bores. Alternate
  // crossovers have different heights, so the two flat laces do not interpenetrate.
  const lace = (id, sA, sideA, sB, sideB, level) => {
    const aA = sideA * eyeTheta(sA), aB = sideB * eyeTheta(sB);
    const fn = u => {
      const s = mix(sA, sB, u), a = mix(aA, aB, u);
      const emerge = smooth(0, .15, u) * (1 - smooth(.85, 1, u));
      return last.at(s, a, mix(facingOffset - .70, level, emerge));
    };
    return thinPath(id, fn, 3.55, .62, 'lace', { kind: 'lace', staticClosure: true, crossSection: 'flattened cotton', explode: [0, 40, 0] }, 34);
  };
  out.push(lace('canvas-lace-front-bar', rows.at(-1), -1, rows.at(-1), 1, 3.55));
  for (let i = 0; i < rows.length - 1; i++) {
    out.push(lace('canvas-lace-cross-a-' + i, rows[i], -1, rows[i + 1], 1, 4.55));
    out.push(lace('canvas-lace-cross-b-' + i, rows[i], 1, rows[i + 1], -1, 3.35));
  }
  // The two short ends tuck inward; this archetype does not add an oversized bow.
  for (const side of [-1, 1]) out.push(thinPath('canvas-lace-tucked-end-' + side, u => {
    const s = rows[0] - .022 * u, a = side * mix(eyeTheta(rows[0]), .29, u);
    return last.at(s, a, mix(facingOffset - .7, 3.7, smooth(0, .2, u)));
  }, 3.55, .62, 'lace', { kind: 'lace', staticClosure: true, explode: [0, 40, 0] }, 20));
  return out;
}
