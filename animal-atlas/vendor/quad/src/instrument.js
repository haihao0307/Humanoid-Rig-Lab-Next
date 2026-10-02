import * as THREE from 'three';

export { THREE };
export const VERSION = 'K4.0.0';
export const CONTRACT = Object.freeze({
  domain: 'bilateral-quadruped',
  units: 'metre',
  upAxis: 'Y',
  forwardAxis: '+Z',
  requiredSections: ['M', 'V', 'F', 'H'],
  optionalSections: ['T', 'S', 'D', 'K', 'R'],
  identityPresets: 0,
});

const MAX_SCORE_LENGTH = 8192;
const MAX_MATERIALS = 8;
const MAX_VOLUMES = 32;
const MAX_CHAIN_POINTS = 12;
const MAX_DETAILS = 24;
const MAX_FIBRES = 40000;
const SURFACE_STEP = 0.04;
const SMOOTH_BLEND = 0.075;
const encoder = new TextEncoder();
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} 必须是有限数字`);
  return number;
}

function inRange(value, min, max, label) {
  if (value < min || value > max) throw new Error(`${label} 必须在 ${min} 到 ${max} 之间`);
  return value;
}

function positive(value, label, minimum = 0.001) {
  if (value < minimum) throw new Error(`${label} 必须大于 ${minimum}`);
  return value;
}

function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} 必须是 ${min} 到 ${max} 的整数`);
  }
  return value;
}

function parseRecordList(raw, width, label, limits) {
  if (!raw) throw new Error(`${label} 不能为空`);
  const records = raw.split('/').map((part, recordIndex) => {
    const values = part.split(',').map((value, valueIndex) => finite(value, `${label}[${recordIndex}][${valueIndex}]`));
    if (values.length !== width) throw new Error(`${label} 每条记录必须有 ${width} 个数字`);
    if (limits) limits(values, recordIndex);
    return values;
  });
  return records;
}

function parseDetails(raw, label) {
  if (!raw) return [];
  const records = raw.split('/').map((part, recordIndex) => {
    const values = part.split(',').map((value, valueIndex) => finite(value, `${label}[${recordIndex}][${valueIndex}]`));
    if (values.length !== 7 && values.length !== 10) {
      throw new Error(`${label} 每条记录必须有 7 或 10 个数字`);
    }
    const [x, y, z, sx, sy, sz] = values;
    positive(Math.abs(sx), `${label} X 半径`);
    positive(Math.abs(sy), `${label} Y 半径`);
    positive(Math.abs(sz), `${label} Z 半径`);
    const material = values.length === 7 ? values[6] : values[9];
    integer(material, 0, MAX_MATERIALS - 1, `${label} 材质索引`);
    return values.length === 7
      ? { center: [x, y, z], radius: [sx, sy, sz], rotation: [0, 0, 0], material }
      : { center: [x, y, z], radius: [sx, sy, sz], rotation: values.slice(6, 9), material };
  });
  if (records.length > MAX_DETAILS) throw new Error(`${label} 最多允许 ${MAX_DETAILS} 条记录`);
  return records;
}

function parseMaterials(raw) {
  if (!raw) throw new Error('M 材质段不能为空');
  const materials = raw.split('/').map((part, index) => {
    const values = part.split(',');
    if (values.length < 1 || values.length > 3) throw new Error(`M[${index}] 需要 1 到 3 个字段`);
    const color = values[0];
    if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) throw new Error(`M[${index}] 颜色格式错误`);
    const roughness = values[1] === undefined ? 0.9 : inRange(finite(values[1], `M[${index}] 粗糙度`), 0, 1, `M[${index}] 粗糙度`);
    const metalness = values[2] === undefined ? 0 : inRange(finite(values[2], `M[${index}] 金属度`), 0, 1, `M[${index}] 金属度`);
    return { color: `#${color}`, roughness, metalness };
  });
  if (materials.length < 1 || materials.length > MAX_MATERIALS) throw new Error(`材质数量必须在 1 到 ${MAX_MATERIALS} 之间`);
  return materials;
}

export function parseScore(text) {
  if (typeof text !== 'string') throw new Error('谱子必须是文本');
  const score = text.trim();
  if (!score.startsWith('K4|')) throw new Error('当前四足乐器只接受 K4 谱');
  if (score.length > MAX_SCORE_LENGTH) throw new Error(`谱子不得超过 ${MAX_SCORE_LENGTH} 个字符`);
  const parts = score.split('|');
  if (parts[0] !== 'K4') throw new Error('谱头必须为 K4');

  const sections = new Map();
  for (let index = 1; index < parts.length; index += 1) {
    const segment = parts[index];
    if (!segment) throw new Error('谱子中不能出现空段');
    const tag = segment[0];
    if (!CONTRACT.requiredSections.includes(tag) && !CONTRACT.optionalSections.includes(tag)) {
      throw new Error(`未知谱段 ${tag}`);
    }
    if (sections.has(tag)) throw new Error(`谱段 ${tag} 不能重复`);
    sections.set(tag, segment.slice(1));
  }
  for (const tag of CONTRACT.requiredSections) {
    if (!sections.has(tag)) throw new Error(`缺少必需谱段 ${tag}`);
  }

  const materials = parseMaterials(sections.get('M'));
  const volumes = parseRecordList(sections.get('V'), 6, 'V', (values) => {
    positive(Math.abs(values[3]), 'V X 半径');
    positive(Math.abs(values[4]), 'V Y 半径');
    positive(Math.abs(values[5]), 'V Z 半径');
  }).map(([x, y, z, rx, ry, rz]) => ({ center: [x, y, z], radius: [rx, ry, rz] }));
  if (volumes.length < 2 || volumes.length > MAX_VOLUMES) throw new Error(`V 控制体数量必须在 2 到 ${MAX_VOLUMES} 之间`);

  const parseChain = (tag, required) => {
    const raw = sections.get(tag);
    if (!raw && !required) return [];
    const chain = parseRecordList(raw, 4, tag, (values) => {
      if ((tag === 'F' || tag === 'H') && values[0] < 0) throw new Error(`${tag} 的 X 必须为非负值，另一侧由乐器镜像`);
      positive(values[3], `${tag} 半径`);
    }).map(([x, y, z, radius]) => ({ point: [x, y, z], radius }));
    if (chain.length < 2 || chain.length > MAX_CHAIN_POINTS) throw new Error(`${tag} 链点数量必须在 2 到 ${MAX_CHAIN_POINTS} 之间`);
    return chain;
  };

  const fore = parseChain('F', true);
  const hind = parseChain('H', true);
  const tail = parseChain('T', false);
  const symmetricDetails = parseDetails(sections.get('S') ?? '', 'S');
  const centralDetails = parseDetails(sections.get('D') ?? '', 'D');

  let cap = null;
  if (sections.has('K')) {
    const values = sections.get('K').split(',').map((value, index) => finite(value, `K[${index}]`));
    if (values.length !== 11) throw new Error('K 需要 11 个数字');
    const [x, y, z, rx, ry, rz, dome, cells, relief, material, seed] = values;
    positive(rx, 'K X 半径'); positive(ry, 'K Y 半径'); positive(rz, 'K Z 半径');
    inRange(dome, 0.4, 2.5, 'K 隆起指数');
    integer(cells, 2, 40, 'K 分区数量');
    inRange(relief, 0, 0.12, 'K 起伏');
    integer(material, 0, materials.length - 1, 'K 材质索引');
    integer(seed, 0, 1000000, 'K 种子');
    cap = { center: [x, y, z], radius: [rx, ry, rz], dome, cells, relief, material, seed };
  }

  let fibres = null;
  if (sections.has('R')) {
    const values = sections.get('R').split(',').map((value, index) => finite(value, `R[${index}]`));
    if (values.length !== 7) throw new Error('R 需要 7 个数字');
    const [length, density, seed, material, gx, gy, gz] = values;
    inRange(length, 0, 0.12, 'R 纤维长度');
    integer(density, 0, MAX_FIBRES, 'R 纤维数量');
    integer(seed, 0, 1000000, 'R 种子');
    integer(material, 0, materials.length - 1, 'R 材质索引');
    fibres = { length, density, seed, material, groom: [gx, gy, gz] };
  }

  for (const detail of [...symmetricDetails, ...centralDetails]) {
    integer(detail.material, 0, materials.length - 1, '细节材质索引');
  }

  return {
    version: 'K4',
    text: score,
    materials,
    volumes,
    fore,
    hind,
    tail,
    symmetricDetails,
    centralDetails,
    cap,
    fibres,
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothMin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function ellipsoidDistance(point, control) {
  const [cx, cy, cz] = control.center;
  const [rx, ry, rz] = control.radius;
  const x = (point.x - cx) / rx;
  const y = (point.y - cy) / ry;
  const z = (point.z - cz) / rz;
  return (Math.hypot(x, y, z) - 1) * Math.min(rx, ry, rz);
}

function capsuleDistance(point, a, b) {
  const start = V3(...a.point);
  const end = V3(...b.point);
  const segment = end.clone().sub(start);
  const toPoint = point.clone().sub(start);
  const denominator = segment.lengthSq();
  const t = denominator > 1e-10 ? clamp(toPoint.dot(segment) / denominator, 0, 1) : 0;
  const closest = start.addScaledVector(segment, t);
  const radius = THREE.MathUtils.lerp(a.radius, b.radius, t);
  return point.distanceTo(closest) - radius;
}

function collectControls(spec) {
  const controls = [];
  for (const volume of spec.volumes) controls.push({ type: 'ellipsoid', value: volume });
  const addChain = (chain, mirror) => {
    const variants = mirror ? [-1, 1] : [1];
    for (const sign of variants) {
      const points = chain.map((item) => ({ point: [item.point[0] * sign, item.point[1], item.point[2]], radius: item.radius }));
      for (let index = 0; index < points.length - 1; index += 1) {
        controls.push({ type: 'capsule', value: [points[index], points[index + 1]] });
      }
      for (const point of points) {
        controls.push({ type: 'ellipsoid', value: { center: point.point, radius: [point.radius, point.radius, point.radius] } });
      }
    }
  };
  addChain(spec.fore, true);
  addChain(spec.hind, true);
  if (spec.tail.length) addChain(spec.tail, false);
  return controls;
}

function computeControlBounds(spec) {
  const box = new THREE.Box3();
  const include = (center, radius) => {
    box.expandByPoint(V3(center[0] - radius[0], center[1] - radius[1], center[2] - radius[2]));
    box.expandByPoint(V3(center[0] + radius[0], center[1] + radius[1], center[2] + radius[2]));
  };
  for (const volume of spec.volumes) include(volume.center, volume.radius);
  const addChain = (chain, mirrored) => {
    const signs = mirrored ? [-1, 1] : [1];
    for (const sign of signs) {
      for (const item of chain) include([item.point[0] * sign, item.point[1], item.point[2]], [item.radius, item.radius, item.radius]);
    }
  };
  addChain(spec.fore, true); addChain(spec.hind, true); if (spec.tail.length) addChain(spec.tail, false);
  box.expandByScalar(0.08);
  return box;
}

function makeGeometry(positions, indices = null, normals = null, colors = null) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (indices) geometry.setIndex(indices);
  if (normals) geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else geometry.computeVertexNormals();
  if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildContinuousBody(spec) {
  const controls = collectControls(spec);
  const bounds = computeControlBounds(spec);
  const size = bounds.getSize(new THREE.Vector3());
  const nx = Math.ceil(size.x / SURFACE_STEP) + 1;
  const ny = Math.ceil(size.y / SURFACE_STEP) + 1;
  const nz = Math.ceil(size.z / SURFACE_STEP) + 1;
  if (nx * ny * nz > 850000) throw new Error('谱子的包围范围过大，超过当前四足乐器的稳定网格预算');
  const sx = size.x / (nx - 1);
  const sy = size.y / (ny - 1);
  const sz = size.z / (nz - 1);
  const total = nx * ny * nz;
  const field = new Float32Array(total);
  const gradient = new Float32Array(total * 3);
  const min = bounds.min;
  const point = new THREE.Vector3();

  for (let z = 0; z < nz; z += 1) {
    for (let y = 0; y < ny; y += 1) {
      for (let x = 0; x < nx; x += 1) {
        point.set(min.x + x * sx, min.y + y * sy, min.z + z * sz);
        let distance = 1e6;
        for (const control of controls) {
          const next = control.type === 'ellipsoid'
            ? ellipsoidDistance(point, control.value)
            : capsuleDistance(point, control.value[0], control.value[1]);
          distance = smoothMin(distance, next, SMOOTH_BLEND);
        }
        field[x + nx * (y + ny * z)] = distance;
      }
    }
  }

  for (let z = 1; z < nz - 1; z += 1) {
    for (let y = 1; y < ny - 1; y += 1) {
      for (let x = 1; x < nx - 1; x += 1) {
        const index = x + nx * (y + ny * z);
        gradient[index * 3] = (field[index + 1] - field[index - 1]) / (2 * sx);
        gradient[index * 3 + 1] = (field[index + nx] - field[index - nx]) / (2 * sy);
        gradient[index * 3 + 2] = (field[index + nx * ny] - field[index - nx * ny]) / (2 * sz);
      }
    }
  }

  const offsets = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
  const tetrahedra = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];
  const positions = [];
  const normals = [];

  const interpolate = (a, b) => {
    const da = field[a[0]];
    const db = field[b[0]];
    const t = da / (da - db);
    const p = [
      a[1] + t * (b[1] - a[1]),
      a[2] + t * (b[2] - a[2]),
      a[3] + t * (b[3] - a[3]),
    ];
    const g = [
      gradient[a[0] * 3] + t * (gradient[b[0] * 3] - gradient[a[0] * 3]),
      gradient[a[0] * 3 + 1] + t * (gradient[b[0] * 3 + 1] - gradient[a[0] * 3 + 1]),
      gradient[a[0] * 3 + 2] + t * (gradient[b[0] * 3 + 2] - gradient[a[0] * 3 + 2]),
    ];
    const length = Math.hypot(g[0], g[1], g[2]) || 1;
    return [p, [g[0] / length, g[1] / length, g[2] / length]];
  };

  const emitTriangle = (a, b, c) => {
    const ab = [b[0][0] - a[0][0], b[0][1] - a[0][1], b[0][2] - a[0][2]];
    const ac = [c[0][0] - a[0][0], c[0][1] - a[0][1], c[0][2] - a[0][2]];
    const cross = [
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ];
    if (cross[0] * a[1][0] + cross[1] * a[1][1] + cross[2] * a[1][2] < 0) [b, c] = [c, b];
    for (const vertex of [a, b, c]) {
      positions.push(...vertex[0]);
      normals.push(...vertex[1]);
    }
  };

  for (let z = 0; z < nz - 1; z += 1) {
    for (let y = 0; y < ny - 1; y += 1) {
      for (let x = 0; x < nx - 1; x += 1) {
        const cube = offsets.map(([ox, oy, oz]) => [
          x + ox + nx * (y + oy + ny * (z + oz)),
          min.x + (x + ox) * sx,
          min.y + (y + oy) * sy,
          min.z + (z + oz) * sz,
        ]);
        let insideCount = 0;
        for (const corner of cube) if (field[corner[0]] < 0) insideCount += 1;
        if (insideCount === 0 || insideCount === 8) continue;

        for (const tetrahedron of tetrahedra) {
          const inside = [];
          const outside = [];
          for (const cornerIndex of tetrahedron) {
            (field[cube[cornerIndex][0]] < 0 ? inside : outside).push(cube[cornerIndex]);
          }
          if (!inside.length || !outside.length) continue;
          if (inside.length === 1) {
            emitTriangle(...outside.map((corner) => interpolate(inside[0], corner)));
          } else if (outside.length === 1) {
            emitTriangle(...inside.map((corner) => interpolate(corner, outside[0])));
          } else {
            const a = interpolate(inside[0], outside[0]);
            const b = interpolate(inside[0], outside[1]);
            const c = interpolate(inside[1], outside[0]);
            const d = interpolate(inside[1], outside[1]);
            emitTriangle(a, b, c);
            emitTriangle(b, d, c);
          }
        }
      }
    }
  }

  if (!positions.length) throw new Error('谱子没有生成可见的连续四足表面');
  return makeGeometry(positions, null, normals);
}

function createMaterials(spec) {
  return spec.materials.map((entry) => new THREE.MeshStandardMaterial({
    color: entry.color,
    roughness: entry.roughness,
    metalness: entry.metalness,
  }));
}

function addEllipsoid(root, detail, materials, mirrored, name) {
  const signs = mirrored && Math.abs(detail.center[0]) > 1e-8 ? [-1, 1] : [1];
  for (const sign of signs) {
    const geometry = new THREE.SphereGeometry(1, 30, 20);
    geometry.scale(detail.radius[0], detail.radius[1], detail.radius[2]);
    geometry.rotateX(THREE.MathUtils.degToRad(detail.rotation[0]));
    geometry.rotateY(THREE.MathUtils.degToRad(detail.rotation[1] * sign));
    geometry.rotateZ(THREE.MathUtils.degToRad(detail.rotation[2] * sign));
    geometry.translate(detail.center[0] * sign, detail.center[1], detail.center[2]);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, materials[detail.material]);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}

function hashNoise(x, y, seed) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 17.17) * 43758.5453123;
  return value - Math.floor(value);
}

function buildCap(spec, materials) {
  if (!spec.cap) return null;
  const { center, radius, dome, cells, relief, material, seed } = spec.cap;
  const nu = 96;
  const nv = 144;
  const positions = [];
  const indices = [];
  const colors = [];
  const base = new THREE.Color(spec.materials[material].color);
  for (let i = 0; i <= nu; i += 1) {
    const u = i / nu;
    const theta = u * Math.PI * 0.5;
    for (let j = 0; j <= nv; j += 1) {
      const v = j / nv;
      const phi = v * Math.PI * 2;
      const sx = Math.sin(theta) * Math.cos(phi);
      const sz = Math.sin(theta) * Math.sin(phi);
      const cellA = Math.sin(phi * cells + seed * 0.13);
      const cellB = Math.sin(theta * cells * 1.35 + seed * 0.07);
      const seam = Math.pow(Math.max(0, 1 - Math.min(Math.abs(cellA), Math.abs(cellB)) * 8), 3);
      const random = hashNoise(Math.floor(v * cells), Math.floor(u * cells), seed);
      const bump = relief * (0.38 + 0.62 * random) * (1 - seam) * Math.sin(theta);
      const x = center[0] + (radius[0] + bump) * sx;
      const y = center[1] + radius[1] * Math.pow(Math.cos(theta), dome) + bump * 0.72 - seam * relief * 0.45;
      const z = center[2] + (radius[2] + bump) * sz;
      positions.push(x, y, z);
      const shade = 0.78 + random * 0.28 - seam * 0.30;
      colors.push(base.r * shade, base.g * shade, base.b * shade);
    }
  }
  for (let i = 0; i < nu; i += 1) {
    for (let j = 0; j < nv; j += 1) {
      const a = i * (nv + 1) + j;
      const b = a + nv + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = makeGeometry(positions, indices, null, colors);
  const capMaterial = materials[material].clone();
  capMaterial.vertexColors = true;
  capMaterial.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, capMaterial);
  mesh.name = 'score-cap-surface';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildFibres(bodyGeometry, spec, materials) {
  if (!spec.fibres || spec.fibres.length <= 0 || spec.fibres.density <= 0) return null;
  const { length, density, seed, material, groom } = spec.fibres;
  const position = bodyGeometry.getAttribute('position');
  const normal = bodyGeometry.getAttribute('normal');
  const index = bodyGeometry.index;
  const triangleCount = (index ? index.count : position.count) / 3;
  const cumulative = new Float64Array(triangleCount);
  let totalArea = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const ids = [0, 1, 2].map((offset) => index ? index.getX(triangle * 3 + offset) : triangle * 3 + offset);
    a.fromBufferAttribute(position, ids[0]);
    b.fromBufferAttribute(position, ids[1]);
    c.fromBufferAttribute(position, ids[2]);
    totalArea += b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5;
    cumulative[triangle] = totalArea;
  }
  const random = seededRandom(seed);
  const positions = [];
  const normals = [];
  const colors = [];
  const base = new THREE.Color(spec.materials[material].color);
  const groomVector = V3(...groom);

  const findTriangle = (value) => {
    let low = 0;
    let high = triangleCount - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (cumulative[middle] < value) low = middle + 1;
      else high = middle;
    }
    return low;
  };

  for (let fibre = 0; fibre < density; fibre += 1) {
    const triangle = findTriangle(random() * totalArea);
    const ids = [0, 1, 2].map((offset) => index ? index.getX(triangle * 3 + offset) : triangle * 3 + offset);
    const root = new THREE.Vector3();
    const rootNormal = new THREE.Vector3();
    const squareRoot = Math.sqrt(random());
    const weights = [1 - squareRoot, squareRoot * (1 - random()), 0];
    weights[2] = 1 - weights[0] - weights[1];
    for (let corner = 0; corner < 3; corner += 1) {
      root.addScaledVector(a.fromBufferAttribute(position, ids[corner]), weights[corner]);
      rootNormal.addScaledVector(a.fromBufferAttribute(normal, ids[corner]), weights[corner]);
    }
    rootNormal.normalize();
    if (root.y < 0.025 || rootNormal.y < -0.45) continue;
    const strandLength = length * (0.65 + random() * 0.75);
    const direction = rootNormal.clone().multiplyScalar(0.72).add(groomVector).normalize();
    let side = rootNormal.clone().cross(direction);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize().multiplyScalar(strandLength * 0.055);
    const middle = root.clone().addScaledVector(direction, strandLength * 0.52).addScaledVector(rootNormal, strandLength * 0.18);
    const tip = root.clone().addScaledVector(direction, strandLength).addScaledVector(rootNormal, strandLength * 0.08);
    const leftRoot = root.clone().sub(side);
    const rightRoot = root.clone().add(side);
    const leftMiddle = middle.clone().sub(side.clone().multiplyScalar(0.46));
    const rightMiddle = middle.clone().add(side.clone().multiplyScalar(0.46));
    const brightness = 0.82 + random() * 0.26;
    for (const vertex of [leftRoot, rightRoot, leftMiddle, rightRoot, rightMiddle, leftMiddle, leftMiddle, rightMiddle, tip]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(rootNormal.x, rootNormal.y, rootNormal.z);
      colors.push(base.r * brightness, base.g * brightness, base.b * brightness);
    }
  }
  if (!positions.length) return null;
  const geometry = makeGeometry(positions, null, normals, colors);
  const fibreMaterial = materials[material].clone();
  fibreMaterial.vertexColors = true;
  fibreMaterial.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geometry, fibreMaterial);
  mesh.name = 'score-fibre-cover';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildScore(text) {
  const start = performance.now();
  const spec = parseScore(text);
  const root = new THREE.Group();
  root.name = 'K4_QUADRUPED_OUTPUT';
  const materials = createMaterials(spec);
  let bodyGeometry = null;
  try {
    bodyGeometry = buildContinuousBody(spec);
    const body = new THREE.Mesh(bodyGeometry, materials[0]);
    body.name = 'continuous-score-body';
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    for (const detail of spec.symmetricDetails) addEllipsoid(root, detail, materials, true, 'symmetric-score-detail');
    for (const detail of spec.centralDetails) addEllipsoid(root, detail, materials, false, 'central-score-detail');

    const cap = buildCap(spec, materials);
    if (cap) root.add(cap);
    const fibres = buildFibres(bodyGeometry, spec, materials);
    if (fibres) root.add(fibres);

    root.userData = {
      version: VERSION,
      domain: CONTRACT.domain,
      scoreOwnedShapeData: true,
      identityPreset: null,
      sections: [...CONTRACT.requiredSections, ...CONTRACT.optionalSections.filter((tag) => text.includes(`|${tag}`))],
    };
    root.updateMatrixWorld(true);
    return { root, spec, score: spec.text, buildMs: performance.now() - start };
  } catch (error) {
    for (const material of materials) material.dispose();
    if (bodyGeometry) bodyGeometry.dispose();
    dispose(root);
    throw error;
  }
}

export function dispose(root) {
  if (!root) return;
  const geometries = new Set();
  const materials = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.removeFromParent();
}

export function measure(root, score = '') {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  let geometryBytes = 0;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    const multiplier = object.isInstancedMesh ? object.count : 1;
    const position = object.geometry.getAttribute('position');
    vertices += (position?.count ?? 0) * multiplier;
    triangles += (object.geometry.index ? object.geometry.index.count : (position?.count ?? 0)) / 3 * multiplier;
    for (const attribute of Object.values(object.geometry.attributes)) geometryBytes += attribute.array.byteLength;
    if (object.geometry.index) geometryBytes += object.geometry.index.array.byteLength;
  });
  const box = new THREE.Box3().setFromObject(root);
  return {
    scoreBytes: encoder.encode(score).length,
    meshes,
    vertices: Math.round(vertices),
    triangles: Math.round(triangles),
    geometryBytes,
    bounds: { min: box.min.toArray(), max: box.max.toArray() },
  };
}

export function snapshot(root) {
  root.updateMatrixWorld(true);
  const chunks = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    chunks.push(encoder.encode(object.name));
    for (const key of Object.keys(object.geometry.attributes).sort()) {
      const array = object.geometry.attributes[key].array;
      chunks.push(encoder.encode(key));
      chunks.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
    if (object.geometry.index) {
      const array = object.geometry.index.array;
      chunks.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
    chunks.push(new Uint8Array(new Float64Array(object.matrixWorld.elements).buffer));
    const material = object.material;
    chunks.push(encoder.encode(JSON.stringify([
      material.color?.toArray(),
      material.roughness,
      material.metalness,
      material.side,
      material.vertexColors,
    ])));
  });
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export function fingerprint(root) {
  let hash = 0x811c9dc5;
  for (const byte of snapshot(root)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

export function verifyReplay(result) {
  const replay = buildScore(result.score);
  try {
    const first = snapshot(result.root);
    const second = snapshot(replay.root);
    if (first.length !== second.length) return false;
    for (let index = 0; index < first.length; index += 1) if (first[index] !== second[index]) return false;
    return true;
  } finally {
    dispose(replay.root);
  }
}

