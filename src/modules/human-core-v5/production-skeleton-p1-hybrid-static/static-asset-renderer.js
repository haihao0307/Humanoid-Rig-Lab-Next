import { deflateSync } from 'node:zlib';
import { P0_CANVAS, P0_VIEW_SPECS } from '../production-rig-visual-prototypes-p0/rig-prototype-data.js';
import { createProjector } from '../production-rig-visual-prototypes-p0/svg-projection-renderer.js';

export { P0_CANVAS, P0_VIEW_SPECS };

export function renderStaticAssetSvg({ source, materials, viewSpec, title, detailName = 'full', viewport }) {
  const projector = createProjector(viewSpec, P0_CANVAS, viewport);
  const materialMap = new Map(materials.map((item) => [item.materialId, item]));
  const drawables = collectTriangles(source, materialMap, projector);
  const ground = detailName === 'full' ? renderGroundSvg(projector) : '';
  const polygons = drawables.map((item) => `<polygon points="${item.points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" fill="${item.color}" stroke="#102731" stroke-width="0.55" opacity="0.97"/>`).join('');
  const metadata = escapeXml(JSON.stringify({ assetId: source.assetId, view: viewSpec.id, detailName, pose: source.pose, coreRigFingerprint: source.coreRigFingerprint, staticOnly: true }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${P0_CANVAS.width}" height="${P0_CANVAS.height}" viewBox="0 0 ${P0_CANVAS.width} ${P0_CANVAS.height}" role="img" aria-labelledby="title desc">\n<title id="title">${escapeXml(title)}</title>\n<desc id="desc">Project-owned deterministic static Reference T production skeleton geometry.</desc>\n<metadata>${metadata}</metadata>\n<rect width="100%" height="100%" fill="#071018"/>\n${ground}\n<g stroke-linejoin="round">${polygons}</g>\n<path d="M24 24h48M24 24v48" fill="none" stroke="#34515d" stroke-width="1" opacity=".5"/>\n</svg>\n`;
}

export function renderStaticAssetRaster({ source, materials, viewSpec, detailName = 'full', viewport }) {
  const raster = new Raster(P0_CANVAS.width, P0_CANVAS.height, '#071018');
  const projector = createProjector(viewSpec, P0_CANVAS, viewport);
  if (detailName === 'full') drawGroundRaster(raster, projector);
  const materialMap = new Map(materials.map((item) => [item.materialId, item]));
  for (const item of collectTriangles(source, materialMap, projector)) {
    raster.fillPolygon(item.points, item.color, 0.97);
    raster.strokePolyline(item.points, '#102731', 0.8, true, 0.72);
  }
  return raster;
}

export function encodePng(raster) {
  const raw = Buffer.alloc((raster.width * 4 + 1) * raster.height);
  for (let y = 0; y < raster.height; y += 1) {
    const rowStart = y * (raster.width * 4 + 1);
    raw[rowStart] = 0;
    raster.data.copy(raw, rowStart + 1, y * raster.width * 4, (y + 1) * raster.width * 4);
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(raster.width, 0); header.writeUInt32BE(raster.height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([signature, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

export class Raster {
  constructor(width, height, background = '#071018') {
    this.width = width;
    this.height = height;
    this.data = Buffer.alloc(width * height * 4);
    this.fillRect(0, 0, width, height, background);
  }
  blend(x, y, color, alpha = 1) {
    const px = Math.round(x); const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    const [r, g, b] = parseColor(color);
    const index = (py * this.width + px) * 4;
    const a = clamp(alpha, 0, 1);
    this.data[index] = Math.round(r * a + this.data[index] * (1 - a));
    this.data[index + 1] = Math.round(g * a + this.data[index + 1] * (1 - a));
    this.data[index + 2] = Math.round(b * a + this.data[index + 2] * (1 - a));
    this.data[index + 3] = 255;
  }
  fillRect(x, y, width, height, color, alpha = 1) {
    for (let py = Math.max(0, Math.floor(y)); py < Math.min(this.height, Math.ceil(y + height)); py += 1) {
      for (let px = Math.max(0, Math.floor(x)); px < Math.min(this.width, Math.ceil(x + width)); px += 1) this.blend(px, py, color, alpha);
    }
  }
  strokeRect(x, y, width, height, color, thickness = 1) {
    this.fillRect(x, y, width, thickness, color); this.fillRect(x, y + height - thickness, width, thickness, color);
    this.fillRect(x, y, thickness, height, color); this.fillRect(x + width - thickness, y, thickness, height, color);
  }
  fillCircle(cx, cy, radius, color, alpha = 1) {
    const r = Math.max(1, radius);
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) this.blend(x, y, color, alpha);
    }
  }
  line(a, b, color, width = 1, alpha = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      this.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, Math.max(0.55, width * 0.5), color, alpha);
    }
  }
  strokePolyline(points, color, width = 1, closed = false, alpha = 1) {
    for (let index = 0; index < points.length - 1; index += 1) this.line(points[index], points[index + 1], color, width, alpha);
    if (closed && points.length > 2) this.line(points.at(-1), points[0], color, width, alpha);
  }
  fillPolygon(points, color, alpha = 1) {
    if (points.length < 3) return;
    const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...points.map((point) => point.y))));
    for (let y = minY; y <= maxY; y += 1) {
      const intersections = [];
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index]; const b = points[(index + 1) % points.length];
        if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) intersections.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
      }
      intersections.sort((a, b) => a - b);
      for (let index = 0; index < intersections.length; index += 2) {
        for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1] ?? intersections[index]); x += 1) this.blend(x, y, color, alpha);
      }
    }
  }
  blitScaled(source, x, y, width, height) {
    for (let py = 0; py < height; py += 1) {
      const sourceY = Math.min(source.height - 1, Math.floor(py / height * source.height));
      for (let px = 0; px < width; px += 1) {
        const sourceX = Math.min(source.width - 1, Math.floor(px / width * source.width));
        const sourceIndex = (sourceY * source.width + sourceX) * 4;
        const targetX = x + px; const targetY = y + py;
        if (targetX < 0 || targetY < 0 || targetX >= this.width || targetY >= this.height) continue;
        const targetIndex = (targetY * this.width + targetX) * 4;
        source.data.copy(this.data, targetIndex, sourceIndex, sourceIndex + 4);
      }
    }
  }
}

export function drawText(raster, x, y, text, color = '#dce9e7', scale = 1) {
  let cursor = x;
  for (const character of String(text).toUpperCase()) {
    const glyph = FONT[character] || FONT[' '];
    for (let row = 0; row < 7; row += 1) for (let col = 0; col < 5; col += 1) if (glyph[row][col] === '1') raster.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
    cursor += 6 * scale;
  }
}

function collectTriangles(source, materialMap, projector) {
  const light = normalize([-0.35, 0.70, -0.62]);
  const drawables = [];
  for (const module of source.modules) {
    for (const part of module.parts) {
      const material = materialMap.get(part.materialId);
      const baseColor = material.baseColorFactor.slice(0, 3).map((value) => Math.round(value * 255));
      const projected = part.positions.map((position) => projector.project(position));
      for (const triangle of part.indices) {
        const points = triangle.map((index) => projected[index]);
        const a = part.positions[triangle[0]]; const b = part.positions[triangle[1]]; const c = part.positions[triangle[2]];
        const normal = normalize(cross(sub(b, a), sub(c, a)));
        const intensity = 0.66 + Math.abs(dot(normal, light)) * 0.34;
        drawables.push({
          depth: points.reduce((sum, point) => sum + point.depth, 0) / 3,
          points,
          color: rgbToHex(baseColor.map((channel) => Math.round(channel * intensity))),
          moduleId: module.moduleId,
        });
      }
    }
  }
  return drawables.sort((a, b) => b.depth - a.depth || a.moduleId.localeCompare(b.moduleId));
}

function renderGroundSvg(projector) {
  const lines = [];
  for (let index = -8; index <= 8; index += 1) {
    lines.push(projectLine(projector, [[index * 0.2, 0, -1.6], [index * 0.2, 0, 1.6]], index === 0 ? 1.3 : 0.65));
    lines.push(projectLine(projector, [[-1.6, 0, index * 0.2], [1.6, 0, index * 0.2]], index === 0 ? 1.3 : 0.65));
  }
  return `<g fill="none" stroke="#29404c" opacity=".45">${lines.join('')}</g>`;
}

function projectLine(projector, points, width) {
  const projected = points.map((point) => projector.project(point));
  return `<path d="M${round(projected[0].x)} ${round(projected[0].y)}L${round(projected[1].x)} ${round(projected[1].y)}" stroke-width="${width}"/>`;
}

function drawGroundRaster(raster, projector) {
  for (let index = -8; index <= 8; index += 1) {
    const a = projector.project([index * 0.2, 0, -1.6]); const b = projector.project([index * 0.2, 0, 1.6]);
    const c = projector.project([-1.6, 0, index * 0.2]); const d = projector.project([1.6, 0, index * 0.2]);
    raster.line(a, b, '#29404c', index === 0 ? 1.3 : 0.7, 0.45);
    raster.line(c, d, '#29404c', index === 0 ? 1.3 : 0.7, 0.45);
  }
}

const FONT = Object.freeze({
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],'-':['00000','00000','00000','11111','00000','00000','00000'],'/':['00001','00010','00010','00100','01000','01000','10000'],':':['00000','00110','00110','00000','00110','00110','00000'],' ':['00000','00000','00000','00000','00000','00000','00000'],
});

function pngChunk(type, data) { const typeBuffer = Buffer.from(type); const chunk = Buffer.alloc(12 + data.length); chunk.writeUInt32BE(data.length, 0); typeBuffer.copy(chunk, 4); data.copy(chunk, 8); chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length); return chunk; }
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function parseColor(value) { const hex = String(value).replace('#', ''); return hex.length === 6 ? [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)] : [255, 255, 255]; }
function rgbToHex(rgb) { return `#${rgb.map((value) => clamp(value, 0, 255).toString(16).padStart(2, '0')).join('')}`; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function normalize(a) { const length = Math.hypot(...a) || 1; return a.map((value) => value / length); }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function round(value) { return Number(value.toFixed(2)); }
function escapeXml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
