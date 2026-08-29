const TAU = Math.PI * 2;

export const PALETTE = Object.freeze({
  background: '#071018',
  grid: '#17313d',
  edge: '#dce9e7',
  core: '#93d8ef',
  coreDark: '#245d73',
  warm: '#f0bb52',
  warmDark: '#6f4b19',
  control: '#de78d6',
  controlDark: '#65305f',
  accent: '#69d3ae',
  joint: '#eef8f5',
  muted: '#58717b',
});

export function vecAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
export function vecSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
export function vecScale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
export function vecDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function vecCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
export function vecLength(a) { return Math.hypot(a[0], a[1], a[2]); }
export function vecNormalize(a) { const length = vecLength(a) || 1; return vecScale(a, 1 / length); }
export function vecLerp(a, b, t) { return vecAdd(a, vecScale(vecSub(b, a), t)); }

export function createProjector(viewSpec, canvas, override = {}) {
  const forward = vecNormalize(viewSpec.cameraDirection);
  const right = vecNormalize(vecCross(viewSpec.worldUp, forward));
  const up = vecNormalize(vecCross(forward, right));
  const center = override.worldCenter || canvas.worldCenter;
  const widthMeters = override.orthographicWidthMeters || canvas.orthographicWidthMeters;
  const heightMeters = override.orthographicHeightMeters || canvas.orthographicHeightMeters;
  const scale = Math.min(canvas.width / widthMeters, canvas.height / heightMeters);
  return {
    project(point) {
      const relative = vecSub(point, center);
      return {
        x: canvas.width * 0.5 + vecDot(relative, right) * scale,
        y: canvas.height * 0.5 - vecDot(relative, up) * scale,
        depth: vecDot(relative, forward),
      };
    },
    forward,
    right,
    up,
    scale,
  };
}

export function line3(points, style = {}) {
  return { kind: 'line', points, closed: false, ...style };
}

export function loop3(points, style = {}) {
  return { kind: 'line', points, closed: true, ...style };
}

export function joint3(position, radius = 0.014, style = {}) {
  return { kind: 'joint', position, radius, ...style };
}

export function mesh3(vertices, faces, style = {}) {
  return { kind: 'mesh', vertices, faces, ...style };
}

export function createOctaBone(start, end, width, style = {}) {
  const { axis, side, binormal } = orientedBasis(start, end);
  const ringCenter = vecLerp(start, end, 0.30);
  const vertices = [
    start,
    vecAdd(ringCenter, vecScale(side, width)),
    vecAdd(ringCenter, vecScale(binormal, width * 0.74)),
    vecAdd(ringCenter, vecScale(side, -width)),
    vecAdd(ringCenter, vecScale(binormal, -width * 0.74)),
    end,
  ];
  const faces = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1], [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]];
  const rollMark = line3([vertices[1], vertices[3]], { stroke: style.rollStroke || PALETTE.warm, strokeWidth: 1.1, opacity: 0.78 });
  return [mesh3(vertices, faces, style), rollMark];
}

export function createWireOctaBone(start, end, width, style = {}) {
  const { side, binormal } = orientedBasis(start, end);
  const ringCenter = vecLerp(start, end, 0.30);
  const ring = [
    vecAdd(ringCenter, vecScale(side, width)),
    vecAdd(ringCenter, vecScale(binormal, width * 0.74)),
    vecAdd(ringCenter, vecScale(side, -width)),
    vecAdd(ringCenter, vecScale(binormal, -width * 0.74)),
  ];
  const stroke = style.stroke || PALETTE.core;
  const strokeWidth = style.strokeWidth || 1.5;
  return [
    loop3(ring, { stroke, strokeWidth, opacity: style.opacity ?? 0.82 }),
    ...ring.map((point) => line3([start, point, end], { stroke, strokeWidth, opacity: style.opacity ?? 0.82 })),
  ];
}

export function createWaistedBone(start, end, width, style = {}) {
  const { side, binormal } = orientedBasis(start, end);
  const sections = [
    [0, width * 0.30],
    [0.12, width],
    [0.50, width * 0.48],
    [0.88, width * 0.82],
    [1, width * 0.22],
  ];
  const vertices = [];
  for (const [t, radius] of sections) {
    const center = vecLerp(start, end, t);
    vertices.push(
      vecAdd(center, vecScale(side, radius)),
      vecAdd(center, vecScale(binormal, radius * 0.72)),
      vecAdd(center, vecScale(side, -radius)),
      vecAdd(center, vecScale(binormal, -radius * 0.72)),
    );
  }
  const faces = [];
  for (let section = 0; section < sections.length - 1; section += 1) {
    const a = section * 4;
    const b = (section + 1) * 4;
    for (let sideIndex = 0; sideIndex < 4; sideIndex += 1) {
      const next = (sideIndex + 1) % 4;
      faces.push([a + sideIndex, a + next, b + next, b + sideIndex]);
    }
  }
  return mesh3(vertices, faces, style);
}

export function createBox(center, size, style = {}) {
  const [x, y, z] = center;
  const [sx, sy, sz] = size.map((value) => value * 0.5);
  const vertices = [
    [x - sx, y - sy, z - sz], [x + sx, y - sy, z - sz], [x + sx, y + sy, z - sz], [x - sx, y + sy, z - sz],
    [x - sx, y - sy, z + sz], [x + sx, y - sy, z + sz], [x + sx, y + sy, z + sz], [x - sx, y + sy, z + sz],
  ];
  return mesh3(vertices, [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], style);
}

export function createPlate(center, width, height, depth, style = {}) {
  return createBox(center, [width, height, depth], style);
}

export function createRing(center, radiusX, radiusY, plane = 'xy', segments = 28, style = {}) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = index / segments * TAU;
    const a = Math.cos(angle) * radiusX;
    const b = Math.sin(angle) * radiusY;
    if (plane === 'xy') points.push([center[0] + a, center[1] + b, center[2]]);
    if (plane === 'xz') points.push([center[0] + a, center[1], center[2] + b]);
    if (plane === 'yz') points.push([center[0], center[1] + a, center[2] + b]);
  }
  return loop3(points, style);
}

export function createDiamond(center, size, plane = 'xy', style = {}) {
  const points = plane === 'xy'
    ? [[center[0], center[1] + size, center[2]], [center[0] + size, center[1], center[2]], [center[0], center[1] - size, center[2]], [center[0] - size, center[1], center[2]]]
    : [[center[0], center[1] + size, center[2]], [center[0], center[1], center[2] + size], [center[0], center[1] - size, center[2]], [center[0], center[1], center[2] - size]];
  return loop3(points, style);
}

export function createArc(center, radius, startAngle, endAngle, plane = 'xy', segments = 18, style = {}) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = startAngle + (endAngle - startAngle) * index / segments;
    const a = Math.cos(angle) * radius;
    const b = Math.sin(angle) * radius;
    if (plane === 'xy') points.push([center[0] + a, center[1] + b, center[2]]);
    if (plane === 'xz') points.push([center[0] + a, center[1], center[2] + b]);
    if (plane === 'yz') points.push([center[0], center[1] + a, center[2] + b]);
  }
  return line3(points, style);
}

export function renderRigSvg({ candidate, primitives, snapshot, viewSpec, canvas, title, viewport, detailName = 'full' }) {
  const projector = createProjector(viewSpec, canvas, viewport);
  const content = renderPrimitives(primitives, projector);
  const ground = renderGround(projector, canvas);
  const metadata = escapeXml(JSON.stringify({
    candidateId: candidate.id,
    view: viewSpec.id,
    detailName,
    sourceCommit: snapshot.source.baselineCommit,
    coreRigFingerprint: snapshot.source.coreRigFingerprint,
    jointCount: snapshot.jointCount,
    segmentCount: snapshot.segmentCount,
    staticPrototype: true,
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" role="img" aria-labelledby="title desc">\n<title id="title">${escapeXml(title)}</title>\n<desc id="desc">Static orthographic visual-direction prototype. Candidate ${escapeXml(candidate.id)}, ${escapeXml(viewSpec.id)} view. Same frozen Reference T input as all candidates.</desc>\n<metadata>${metadata}</metadata>\n<rect width="100%" height="100%" fill="${canvas.background}"/>\n${ground}\n<g stroke-linecap="round" stroke-linejoin="round">${content}</g>\n<path d="M24 24h44M24 24v44" fill="none" stroke="${PALETTE.muted}" stroke-width="1" opacity=".5"/>\n</svg>\n`;
}

export function projectPrimitivesForRaster(primitives, viewSpec, canvas, viewport) {
  const projector = createProjector(viewSpec, canvas, viewport);
  const output = [];
  for (const primitive of primitives) {
    if (primitive.kind === 'line') {
      output.push({ ...primitive, points2d: primitive.points.map((point) => projector.project(point)) });
    } else if (primitive.kind === 'joint') {
      const point = projector.project(primitive.position);
      output.push({ ...primitive, point2d: point, radius2d: Math.max(1, primitive.radius * projector.scale) });
    } else if (primitive.kind === 'mesh') {
      const projected = primitive.vertices.map((point) => projector.project(point));
      for (const face of primitive.faces) {
        output.push({
          kind: 'polygon',
          points2d: face.map((index) => projected[index]),
          depth: average(face.map((index) => projected[index].depth)),
          fill: primitive.fill || PALETTE.coreDark,
          stroke: primitive.stroke || PALETTE.edge,
          strokeWidth: primitive.strokeWidth || 1,
          opacity: primitive.opacity ?? 0.9,
        });
      }
    }
  }
  return output.sort((a, b) => (b.depth || 0) - (a.depth || 0));
}

function renderPrimitives(primitives, projector) {
  const drawables = [];
  for (const primitive of primitives) {
    if (primitive.kind === 'mesh') {
      const projected = primitive.vertices.map((point) => projector.project(point));
      for (let faceIndex = 0; faceIndex < primitive.faces.length; faceIndex += 1) {
        const face = primitive.faces[faceIndex];
        const points = face.map((index) => projected[index]);
        drawables.push({
          depth: average(points.map((point) => point.depth)),
          svg: `<polygon points="${points.map(pointString).join(' ')}" fill="${shade(primitive.fill || PALETTE.coreDark, faceIndex)}" stroke="${primitive.stroke || PALETTE.edge}" stroke-width="${primitive.strokeWidth || 1}" opacity="${primitive.opacity ?? 0.9}"/>`,
        });
      }
    } else if (primitive.kind === 'line') {
      const points = primitive.points.map((point) => projector.project(point));
      drawables.push({
        depth: average(points.map((point) => point.depth)) - 0.0001,
        svg: `<polyline points="${points.map(pointString).join(' ')}${primitive.closed ? ` ${pointString(points[0])}` : ''}" fill="${primitive.fill || 'none'}" stroke="${primitive.stroke || PALETTE.edge}" stroke-width="${primitive.strokeWidth || 1.5}" opacity="${primitive.opacity ?? 1}"${primitive.dash ? ` stroke-dasharray="${primitive.dash}"` : ''}/>`
      });
    } else if (primitive.kind === 'joint') {
      const point = projector.project(primitive.position);
      drawables.push({
        depth: point.depth - 0.0002,
        svg: `<circle cx="${fmt(point.x)}" cy="${fmt(point.y)}" r="${fmt(Math.max(1.5, primitive.radius * projector.scale))}" fill="${primitive.fill || PALETTE.joint}" stroke="${primitive.stroke || PALETTE.background}" stroke-width="${primitive.strokeWidth || 1.3}" opacity="${primitive.opacity ?? 1}"/>`,
      });
    }
  }
  return drawables.sort((a, b) => b.depth - a.depth).map((item) => item.svg).join('');
}

function renderGround(projector, canvas) {
  const lines = [];
  for (let index = -8; index <= 8; index += 1) {
    lines.push(line3([[index * 0.2, 0, -1.6], [index * 0.2, 0, 1.6]], { stroke: canvas.ground, strokeWidth: index === 0 ? 1.5 : 0.7, opacity: index === 0 ? 0.65 : 0.38 }));
    lines.push(line3([[-1.6, 0, index * 0.2], [1.6, 0, index * 0.2]], { stroke: canvas.ground, strokeWidth: index === 0 ? 1.5 : 0.7, opacity: index === 0 ? 0.65 : 0.38 }));
  }
  return renderPrimitives(lines, projector);
}

function orientedBasis(start, end) {
  const axis = vecNormalize(vecSub(end, start));
  const helper = Math.abs(vecDot(axis, [0, 0, 1])) > 0.86 ? [0, 1, 0] : [0, 0, 1];
  const side = vecNormalize(vecCross(axis, helper));
  const binormal = vecNormalize(vecCross(axis, side));
  return { axis, side, binormal };
}

function average(values) { return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length); }
function fmt(value) { return Number(value.toFixed(2)); }
function pointString(point) { return `${fmt(point.x)},${fmt(point.y)}`; }

function shade(hex, faceIndex) {
  const amount = [-0.10, 0.03, 0.13, -0.02][faceIndex % 4];
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => parseInt(raw.slice(offset, offset + 2), 16));
  return `#${channels.map((channel) => Math.max(0, Math.min(255, Math.round(channel + amount * 255))).toString(16).padStart(2, '0')).join('')}`;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
