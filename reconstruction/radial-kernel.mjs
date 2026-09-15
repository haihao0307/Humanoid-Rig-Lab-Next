/** Pure scalar-spline surface evaluator. No Three.js, model loader, or mesh data.
 * Reference: BodyParts3D / DBCLS, CC BY 4.0. Full provenance is in the contract.
 * The caller supplies LEFT_CALF_SPLINE.json once; evaluation needs no reference.
 */
export function createLeftCalfSurface(contract) {
  if (contract.schema === 'human-calf-spline/v2') return createLayeredCalfSurface(contract);
  if (contract.schema !== 'human-calf-spline/v1') throw new Error('Unsupported calf contract');
  const h = contract.hierarchy;
  const [yMin, yMax] = contract.heightRangeMetres;
  const [axisX, axisZ] = contract.axisXZMetres;
  const fineY = contract.heightIntervals, fineT = contract.chartIntervals;
  const coarseY = h.coarseHeightIntervals, coarseT = h.coarseChartIntervals;
  if (!(yMax > yMin) || ![fineY, fineT, coarseY, coarseT].every(x => Number.isInteger(x) && x >= 4)) {
    throw new Error('Invalid spline domain');
  }
  const coarse = Float64Array.from(h.coarseRadiusControlsMetres.flat(2));
  if (coarse.length !== 4 * (coarseY + 5) * (coarseT + 5) || !coarse.every(Number.isFinite)) {
    throw new Error('Invalid coarse radius coefficients');
  }
  if (h.residualBasisIndices.length !== h.residualRadiusCoefficientsMetres.length) {
    throw new Error('Residual basis/value count mismatch');
  }
  const residual = new Map();
  for (let k = 0; k < h.residualBasisIndices.length; k++) {
    const index = h.residualBasisIndices[k], value = h.residualRadiusCoefficientsMetres[k];
    if (!Number.isInteger(index) || index < 0 || index >= 4*(fineY+5)*(fineT+5) ||
        !Number.isFinite(value) || residual.has(index)) throw new Error('Invalid residual coefficient');
    residual.set(index, value);
  }

  function weights(u) {
    const u2 = u*u, u3 = u2*u;
    return [(1-u)**3/6, (3*u3-6*u2+4)/6, (-3*u3+3*u2+3*u+1)/6, u3/6];
  }
  function derivative(u) {
    return [-((1-u)**2)/2, (9*u*u-12*u)/6, (-9*u*u+6*u+3)/6, u*u/2];
  }
  function layer(chart, y, t, ny, nt, get) {
    const sy = (y-yMin)/(yMax-yMin)*ny+1, st = (t+1)*nt/2+1;
    const iy = Math.floor(sy), it = Math.floor(st);
    const by = weights(sy-iy), bt = weights(st-it);
    const dy = derivative(sy-iy), dt = derivative(st-it);
    let radius = 0, heightDerivative = 0, tangentDerivative = 0;
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      const c = get((chart*(ny+5)+iy+a)*(nt+5)+it+b);
      radius += by[a]*bt[b]*c;
      heightDerivative += dy[a]*bt[b]*c*ny/(yMax-yMin);
      tangentDerivative += by[a]*dt[b]*c*nt/2;
    }
    return [radius, heightDerivative, tangentDerivative];
  }

  function evaluate(chart, y, t) {
    if (!Number.isInteger(chart) || chart < 0 || chart > 3 || !Number.isFinite(y) ||
        !Number.isFinite(t) || y < yMin || y > yMax || t < -1 || t > 1) {
      throw new RangeError('Expected chart 0..3 and coordinates inside the declared calf domain');
    }
    const a = layer(chart, y, t, coarseY, coarseT, k => coarse[k]);
    const b = layer(chart, y, t, fineY, fineT, k => residual.get(k) ?? 0);
    const q = a[0]+b[0], qy = a[1]+b[1], qt = a[2]+b[2];
    const [n, s] = contract.chartFramesXZ[chart];
    const dx = n[0]+t*s[0], dz = n[1]+t*s[1];
    const position = [axisX+q*dx, y, axisZ+q*dz];
    const heightTangent = [qy*dx, 1, qy*dz];
    const chartTangent = [qt*dx+q*s[0], 0, qt*dz+q*s[1]];
    const normal = [heightTangent[1]*chartTangent[2]-heightTangent[2]*chartTangent[1],
                    heightTangent[2]*chartTangent[0]-heightTangent[0]*chartTangent[2],
                    heightTangent[0]*chartTangent[1]-heightTangent[1]*chartTangent[0]];
    const length = Math.hypot(...normal);
    return {position, normal: normal.map(x => x/length), radius: q};
  }

  return Object.freeze({evaluate, heightRangeMetres: Object.freeze([yMin, yMax]),
    coefficientCount: coarse.length+residual.size,
    scope: 'Left calf shaft in original source metres; no runtime body morph or pose'});
}

/** R2: sparse detail levels and four shared boundary curves. All stored values
 * are scalar radius coefficients in an explicit length unit, not mesh data. */
function createLayeredCalfSurface(contract) {
  const [yMin, yMax] = contract.heightRangeMetres;
  const [axisX, axisZ] = contract.axisXZMetres;
  const unit = contract.parameterUnitMetres;
  const frames = contract.chartFramesXZ.map(frame => frame.map(v => v.slice()));
  if (![yMin,yMax,axisX,axisZ,unit].every(Number.isFinite) || !(yMax > yMin) || !(unit > 0)) {
    throw new Error('Invalid layered spline domain or length unit');
  }
  let coefficientCount = 0;
  const layers = contract.layers.map(layer => {
    const ny = layer.heightIntervals, nt = layer.chartIntervals;
    if (![ny,nt].every(x => Number.isInteger(x) && x >= 4) ||
        layer.basisIndices.length !== layer.radiusCoefficients.length) throw new Error('Invalid spline layer');
    const values = new Map();
    for (let k = 0; k < layer.basisIndices.length; k++) {
      const index = layer.basisIndices[k], scalar = layer.radiusCoefficients[k];
      if (!Number.isSafeInteger(index) || index < 0 || index >= 4*(ny+5)*(nt+5) ||
          !Number.isSafeInteger(scalar) || values.has(index)) throw new Error('Invalid layered radius coefficient');
      values.set(index, scalar*unit);
    }
    coefficientCount += values.size;
    return {ny, nt, values};
  });
  const seamY = contract.sharedSeams.heightIntervals;
  const width = contract.sharedSeams.supportWidth;
  const edges = contract.sharedSeams.rightEdgeRadiusCoefficients.map(c => {
    if (c.length !== seamY+5 || !c.every(Number.isSafeInteger)) throw new Error('Invalid shared seam coefficients');
    coefficientCount += c.length;
    return Float64Array.from(c, x => x*unit);
  });
  if (edges.length !== 4 || !(width > 0 && width <= 1)) throw new Error('Invalid shared seam support');

  function basis(u) {
    return {b: [(1-u)**3/6, (3*u**3-6*u*u+4)/6, (-3*u**3+3*u*u+3*u+1)/6, u**3/6],
      d: [-((1-u)**2)/2, (9*u*u-12*u)/6, (-9*u*u+6*u+3)/6, u*u/2]};
  }
  function raw(chart, y, t) {
    const result = [0,0,0];
    for (const {ny,nt,values} of layers) {
      const sy = (y-yMin)/(yMax-yMin)*ny+1, st = (t+1)*nt/2+1;
      const iy = Math.floor(sy), it = Math.floor(st), by = basis(sy-iy), bt = basis(st-it);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const c = values.get((chart*(ny+5)+iy+a)*(nt+5)+it+b) ?? 0;
        result[0] += by.b[a]*bt.b[b]*c;
        result[1] += by.d[a]*bt.b[b]*c*ny/(yMax-yMin);
        result[2] += by.b[a]*bt.d[b]*c*nt/2;
      }
    }
    return result;
  }
  function edge(chart, y) {
    const sy = (y-yMin)/(yMax-yMin)*seamY+1, i = Math.floor(sy), w = basis(sy-i);
    const result = [0,0];
    for (let k = 0; k < 4; k++) {
      result[0] += w.b[k]*edges[chart][i+k];
      result[1] += w.d[k]*edges[chart][i+k]*seamY/(yMax-yMin);
    }
    return result;
  }
  function evaluate(chart, y, t) {
    if (!Number.isInteger(chart) || chart < 0 || chart > 3 || !Number.isFinite(y) || !Number.isFinite(t) ||
        y < yMin || y > yMax || t < -1 || t > 1) throw new RangeError('Coordinates outside the declared calf domain');
    const r = raw(chart,y,t);
    for (const sign of [-1,1]) {
      const distance = 1-sign*t;
      if (distance >= width) continue;
      const a = 1-distance/width, weight = a**3, slope = 3*sign*a*a/width;
      const wanted = edge(sign < 0 ? (chart+3)%4 : chart, y), current = raw(chart,y,sign);
      r[0] += weight*(wanted[0]-current[0]);
      r[1] += weight*(wanted[1]-current[1]);
      r[2] += slope*(wanted[0]-current[0]);
      if (t === sign) { r[0] = wanted[0]; r[1] = wanted[1]; }
    }
    const [n,s] = frames[chart], dx = n[0]+t*s[0], dz = n[1]+t*s[1];
    const q = r[0], qy = r[1], qt = r[2];
    const position = [axisX+q*dx,y,axisZ+q*dz];
    const py = [qy*dx,1,qy*dz], pt = [qt*dx+q*s[0],0,qt*dz+q*s[1]];
    const normal = [pt[2],py[2]*pt[0]-py[0]*pt[2],-pt[0]], length = Math.hypot(...normal);
    return {position, normal: normal.map(v => v/length), radius: q};
  }
  return Object.freeze({evaluate, heightRangeMetres: Object.freeze([yMin,yMax]), coefficientCount,
    scope: 'Left calf shaft in original source metres; no runtime body morph or pose'});
}
