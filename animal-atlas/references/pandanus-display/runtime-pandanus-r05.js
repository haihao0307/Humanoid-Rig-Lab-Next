import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};

const P = {
  age: 72,
  light: 0.18,
  water: -0.16,
  apical: 0.66,
  resource: 0.80,
  space: 0.82,
  rootSupport: 1,
  leafDensity: 0.90,
};

let showRoots = true;
let showLeaves = true;
let showDetail = true;
let playing = false;
let lastBuildAge = -1;
let last = performance.now();
const seed = 50721;

const stage = $('stage');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101817);
scene.fog = new THREE.FogExp2(0x101817, 0.028);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
camera.position.set(9.5, 5.4, 11.5);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 2.8, 0);
controls.minDistance = 4;
controls.maxDistance = 28;
controls.maxPolarAngle = Math.PI * 0.83;

scene.add(new THREE.HemisphereLight(0xbfd8cf, 0x332d27, 1.8));
const sun = new THREE.DirectionalLight(0xfff1d6, 3.2);
sun.position.set(7, 12, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -9;
sun.shadow.camera.right = 9;
sun.shadow.camera.top = 11;
sun.shadow.camera.bottom = -5;
scene.add(sun);
const rim = new THREE.DirectionalLight(0x8fc8c8, 1.15);
rim.position.set(-8, 5, -7);
scene.add(rim);

const world = new THREE.Group();
const shootGroup = new THREE.Group();
const rootGroup = new THREE.Group();
const leafGroup = new THREE.Group();
const detailGroup = new THREE.Group();
const groundGroup = new THREE.Group();
world.add(shootGroup, rootGroup, leafGroup, detailGroup, groundGroup);
scene.add(world);

const barkMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.94,
  metalness: 0,
});
const rootMat = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.98,
  metalness: 0,
});
const scarMat = new THREE.MeshStandardMaterial({
  color: 0x3b3027,
  roughness: 1,
});
const leafMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.48,
  metalness: 0,
  side: THREE.DoubleSide,
});
const fruitMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.7,
  metalness: 0,
});

const rosettes = [];

function rngFactory(initialSeed) {
  let s = initialSeed;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearGroup(group) {
  while (group.children.length) {
    const object = group.children[0];
    group.remove(object);
    object.traverse?.((child) => {
      if (child.geometry && !child.geometry.userData.shared) child.geometry.dispose();
      if (
        child.material &&
        !Array.isArray(child.material) &&
        child.material.userData?.owned
      ) child.material.dispose();
    });
  }
}

function getFrames(points) {
  const frames = [];
  const up = new THREE.Vector3(0, 1, 0);
  let normal = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i < points.length; i += 1) {
    const previous = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tangent = next.clone().sub(previous).normalize();
    if (i === 0) {
      normal = new THREE.Vector3()
        .crossVectors(
          Math.abs(tangent.dot(up)) > 0.92 ? new THREE.Vector3(0, 0, 1) : up,
          tangent,
        )
        .normalize();
    } else {
      normal.addScaledVector(tangent, -normal.dot(tangent));
      if (normal.lengthSq() < 1e-5) {
        normal = new THREE.Vector3().crossVectors(
          new THREE.Vector3(0, 0, 1),
          tangent,
        );
      }
      normal.normalize();
    }
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize();
    frames.push({ tangent, normal: normal.clone(), binormal });
  }
  return frames;
}

function makeTube(points, r0, r1, material, key, rough = 0.035, radial = 12) {
  const frames = getFrames(points);
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const random = rngFactory(seed + key * 97);
  const baseColor = new THREE.Color(material === rootMat ? 0x66584a : 0x715d48);

  for (let i = 0; i < points.length; i += 1) {
    const u = i / (points.length - 1);
    const radius = lerp(r0, r1, Math.pow(u, 0.78));
    const frame = frames[i];
    for (let j = 0; j < radial; j += 1) {
      const angle = (j / radial) * Math.PI * 2;
      const bark = 1 + rough * (
        0.58 * Math.sin(angle * 7 + key * 0.31) +
        0.32 * Math.sin(u * 29 + angle * 3 + key) +
        0.16 * (random() - 0.5)
      );
      const rr = radius * bark;
      const offset = frame.normal
        .clone()
        .multiplyScalar(Math.cos(angle) * rr)
        .addScaledVector(frame.binormal, Math.sin(angle) * rr);
      const vertex = points[i].clone().add(offset);
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(offset.x, offset.y, offset.z);
      const color = baseColor.clone().offsetHSL(
        0.018 * (random() - 0.5),
        0.03 * (random() - 0.5),
        0.085 * (random() - 0.5) - 0.035 * u,
      );
      colors.push(color.r, color.g, color.b);
      uvs.push(j / radial, u);
    }
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function branchPath(start, direction, length, segments, key, droop = 0.03, lightBias = P.light) {
  const random = rngFactory(seed + key * 131);
  const points = [start.clone()];
  let position = start.clone();
  const currentDirection = direction.clone().normalize();
  for (let i = 1; i <= segments; i += 1) {
    const u = i / segments;
    currentDirection.add(new THREE.Vector3(
      lightBias * 0.012 * (1 - u * 0.4),
      0.018 * (1 - P.apical * 0.35) - droop * u,
      (random() - 0.5) * 0.055,
    ));
    currentDirection.normalize();
    position = position.clone().addScaledVector(currentDirection, length / segments);
    points.push(position);
  }
  return points;
}

function trunkPath(height, key) {
  const random = rngFactory(seed + key);
  const points = [];
  for (let i = 0; i <= 34; i += 1) {
    const u = i / 34;
    points.push(new THREE.Vector3(
      0.08 * Math.sin(u * 4.2 + 1.1) * u + P.light * 0.16 * u * u,
      height * u,
      0.07 * Math.sin(u * 5.3 + 0.4) * u + 0.025 * (random() - 0.5) * u,
    ));
  }
  return points;
}

function pointOn(points, u) {
  const x = clamp(u) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(x));
  return points[i].clone().lerp(points[i + 1], x - i);
}

function tangentOn(points, u) {
  const epsilon = 0.018;
  return pointOn(points, clamp(u + epsilon))
    .sub(pointOn(points, clamp(u - epsilon)))
    .normalize();
}

function makeLeafGeometry() {
  const segments = 28;
  const columns = 5;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const u = i / segments;
    const profile = Math.pow(Math.sin(Math.PI * Math.min(0.999, u)), 0.62) * (1 - 0.18 * u);
    const baseWidth = 0.018 + 0.115 * profile;
    const tooth = i % 2 ? 1.055 : 0.965;
    const width = baseWidth * tooth;
    const centerY = 0.09 * Math.sin(Math.PI * u) - 0.38 * u * u;
    const cross = [0, 0.038, -0.018, 0.038, 0];
    const xs = [-1, -0.46, 0, 0.46, 1];
    for (let column = 0; column < columns; column += 1) {
      positions.push(
        xs[column] * width,
        centerY + cross[column] * (1 - u * 0.45),
        u,
      );
      uvs.push((xs[column] + 1) / 2, u);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = i * columns + column;
      const b = a + 1;
      const d = (i + 1) * columns + column;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.userData.shared = true;
  return geometry;
}

const leafGeometry = makeLeafGeometry();

function makeRosette(terminal, index, maturity) {
  const axis = terminal.direction.clone().add(new THREE.Vector3(0, 0.42, 0)).normalize();
  const group = new THREE.Group();
  group.position.copy(terminal.position);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
  const count = Math.max(
    8,
    Math.floor((12 + 28 * maturity) * P.leafDensity * terminal.scale),
  );
  const mesh = new THREE.InstancedMesh(leafGeometry, leafMat, count);
  const dummy = new THREE.Object3D();
  const random = rngFactory(seed + index * 997);
  const golden = Math.PI * (3 - Math.sqrt(5));
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  for (let i = 0; i < count; i += 1) {
    const f = count === 1 ? 0 : i / (count - 1);
    const azimuth = i * golden + random() * 0.34;
    const polar = lerp(0.30, 1.46, Math.pow(f, 0.72));
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * Math.sin(polar),
      Math.cos(polar),
      Math.sin(azimuth) * Math.sin(polar),
    ).normalize();
    dummy.position.set(
      (random() - 0.5) * 0.035,
      (random() - 0.5) * 0.03,
      (random() - 0.5) * 0.035,
    );
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    dummy.rotateZ((random() - 0.5) * 0.18);
    const length = lerp(0.55, 1.65, maturity) * terminal.scale *
      lerp(0.72, 1.12, f) * (1 + 0.10 * (random() - 0.5));
    const width = lerp(0.72, 1.10, f);
    dummy.scale.set(width, length, length);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    const color = new THREE.Color().setHSL(
      lerp(0.25, 0.31, f) + 0.012 * (random() - 0.5),
      lerp(0.38, 0.56, f),
      lerp(0.31, 0.20, f),
    );
    if (i < Math.max(3, count * 0.16)) color.offsetHSL(-0.035, -0.02, 0.16);
    mesh.setColorAt(i, color);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  group.userData.base = group.quaternion.clone();
  group.userData.phase = index * 0.73 + random() * 2;
  leafGroup.add(group);
  rosettes.push(group);
}

function addFruit(terminal, key) {
  const group = new THREE.Group();
  group.position.copy(terminal.position)
    .add(terminal.direction.clone().multiplyScalar(0.10))
    .add(new THREE.Vector3(0, -0.18, 0));
  const count = 58;
  const geometry = new THREE.DodecahedronGeometry(0.062, 0);
  const mesh = new THREE.InstancedMesh(geometry, fruitMat, count);
  const dummy = new THREE.Object3D();
  const golden = Math.PI * (3 - Math.sqrt(5));
  const random = rngFactory(seed + key);
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = i * golden;
    dummy.position.set(
      Math.cos(angle) * radius * 0.23,
      y * 0.30,
      Math.sin(angle) * radius * 0.23,
    );
    dummy.rotation.set(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    dummy.scale.set(1, 1.25, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, new THREE.Color().setHSL(
      lerp(0.24, 0.075, (1 - y) / 2),
      0.62,
      lerp(0.31, 0.49, (1 - y) / 2),
    ));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  group.add(mesh);
  detailGroup.add(group);
}

function addLeafScars(trunk, baseRadius, maturity) {
  const count = Math.floor(8 + 20 * maturity);
  const geometry = new THREE.TorusGeometry(1, 0.018, 5, 22);
  for (let i = 2; i < count; i += 1) {
    const u = lerp(0.08, 0.78, i / count);
    const point = pointOn(trunk, u);
    const tangent = tangentOn(trunk, u);
    const radius = lerp(baseRadius, baseRadius * 0.55, u);
    const ring = new THREE.Mesh(geometry, scarMat);
    ring.position.copy(point);
    ring.scale.set(radius, radius, radius);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    ring.castShadow = true;
    detailGroup.add(ring);
  }
  geometry.userData.shared = true;
}

function build() {
  clearGroup(shootGroup);
  clearGroup(rootGroup);
  clearGroup(leafGroup);
  clearGroup(detailGroup);
  rosettes.length = 0;

  const age = P.age;
  const maturity = smooth((age - 4) / 68);
  const height = lerp(1.15, 7.1, maturity) * lerp(0.78, 1.08, P.resource);
  const baseRadius = lerp(0.10, 0.25, maturity) * lerp(0.86, 1.10, P.resource);
  const trunk = trunkPath(height, 19);
  shootGroup.add(makeTube(trunk, baseRadius, baseRadius * 0.43, barkMat, 19, 0.055, 14));

  const terminals = [{
    position: trunk.at(-1).clone(),
    direction: tangentOn(trunk, 1),
    scale: 1.02,
  }];
  const whorls = maturity < 0.18 ? 0 : Math.floor(1 + maturity * 3.4);
  const random = rngFactory(seed + 77);

  for (let whorl = 0; whorl < whorls; whorl += 1) {
    const u = lerp(0.50, 0.84, whorls === 1 ? 0.5 : whorl / (whorls - 1));
    const start = pointOn(trunk, u);
    const around = 3 + (whorl % 2);
    const lower = 1 - whorl / Math.max(1, whorls + 1);
    for (let branch = 0; branch < around; branch += 1) {
      if (random() > 0.86 * P.space + 0.07) continue;
      const angle = (branch / around) * Math.PI * 2 + whorl * 1.07 + random() * 0.32;
      const horizontal = 0.88;
      const direction = new THREE.Vector3(
        Math.cos(angle) * horizontal,
        0.18 + 0.15 * (1 - lower),
        Math.sin(angle) * horizontal,
      );
      direction.x += P.light * 0.18;
      direction.normalize();
      const length = lerp(0.75, 2.15, maturity) *
        lerp(0.84, 1.14, P.space) *
        lerp(1.08, 0.80, whorl / Math.max(1, whorls - 1)) *
        (0.88 + 0.20 * random());
      const points = branchPath(
        start,
        direction,
        length,
        18,
        100 + whorl * 11 + branch,
        0.055 - 0.025 * whorl,
      );
      shootGroup.add(makeTube(
        points,
        baseRadius * lerp(0.50, 0.34, whorl / Math.max(1, whorls)),
        0.045,
        barkMat,
        100 + whorl * 11 + branch,
        0.045,
        12,
      ));
      const tip = points.at(-1);
      const terminalDirection = tip.clone().sub(points.at(-2)).normalize();
      terminals.push({
        position: tip.clone(),
        direction: terminalDirection,
        scale: lerp(1.08, 0.84, whorl / Math.max(1, whorls)),
      });

      if (maturity > 0.62 && random() > 0.46) {
        const secondaryU = 0.62 + 0.14 * random();
        const secondaryStart = pointOn(points, secondaryU);
        const secondaryAngle = angle +
          (random() > 0.5 ? 1 : -1) * lerp(0.65, 1.05, random());
        const secondaryDirection = new THREE.Vector3(
          Math.cos(secondaryAngle),
          0.20,
          Math.sin(secondaryAngle),
        ).normalize();
        const secondary = branchPath(
          secondaryStart,
          secondaryDirection,
          length * 0.48,
          12,
          400 + whorl * 17 + branch,
          0.07,
        );
        shootGroup.add(makeTube(
          secondary,
          baseRadius * 0.24,
          0.032,
          barkMat,
          400 + whorl * 17 + branch,
          0.04,
          10,
        ));
        terminals.push({
          position: secondary.at(-1).clone(),
          direction: secondary.at(-1).clone().sub(secondary.at(-2)).normalize(),
          scale: 0.72,
        });
      }
    }
  }

  const rootCount = Math.floor(lerp(4, 9, maturity) * P.rootSupport);
  const rootRandom = rngFactory(seed + 902);
  for (let i = 0; i < rootCount; i += 1) {
    const angle = (i / rootCount) * Math.PI * 2 + rootRandom() * 0.35;
    const sourceHeight = lerp(0.18, Math.min(1.35, height * 0.22), rootRandom());
    const trunkPoint = pointOn(trunk, sourceHeight / height);
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const start = trunkPoint.clone().addScaledVector(outward, baseRadius * 0.82);
    const landingRadius = lerp(0.58, 1.75, maturity) * P.rootSupport *
      (0.83 + 0.32 * rootRandom());
    const target = new THREE.Vector3(
      outward.x * landingRadius,
      -0.02,
      outward.z * landingRadius,
    );
    const middle = start.clone().lerp(target, 0.53).add(new THREE.Vector3(
      outward.x * 0.18,
      -0.18 - 0.18 * rootRandom(),
      outward.z * 0.18,
    ));
    const supportPoints = [];
    for (let segment = 0; segment <= 16; segment += 1) {
      const t = segment / 16;
      const point = start.clone().multiplyScalar((1 - t) * (1 - t))
        .add(middle.clone().multiplyScalar(2 * (1 - t) * t))
        .add(target.clone().multiplyScalar(t * t));
      point.z += 0.035 * Math.sin(t * Math.PI * 2 + i);
      supportPoints.push(point);
    }
    rootGroup.add(makeTube(
      supportPoints,
      baseRadius * 0.48 * (0.82 + 0.22 * rootRandom()),
      0.035,
      rootMat,
      700 + i,
      0.05,
      12,
    ));
    const extensionLength = lerp(0.45, 1.15, maturity) * (1 + 0.24 * rootRandom());
    const extensionDirection = new THREE.Vector3(
      outward.x + P.water * 0.20,
      -0.09,
      outward.z,
    ).normalize();
    const extension = branchPath(
      target,
      extensionDirection,
      extensionLength,
      11,
      800 + i,
      0.005,
      0,
    );
    rootGroup.add(makeTube(extension, 0.045, 0.015, rootMat, 800 + i, 0.03, 9));
  }

  terminals.forEach((terminal, index) => makeRosette(terminal, index, maturity));
  addLeafScars(trunk, baseRadius, maturity);
  if (maturity > 0.58 && terminals[1]) addFruit(terminals[1], 55);

  shootGroup.visible = true;
  rootGroup.visible = showRoots;
  leafGroup.visible = showLeaves;
  detailGroup.visible = showDetail;
  rootGroup.userData.count = rootCount;
  leafGroup.userData.count = terminals.length;
  $('status').textContent = `${rootCount} 组支柱根 / ${terminals.length} 个枝端叶丛 / 函数叶片与叶痕已生成。当前仍为老师阶段，不声称最终 3A。`;
  $('info').textContent = `T ${Math.round(age)} · 高约 ${height.toFixed(1)} m（工程演示） · Pandanus teacher score`;
}

function makeGround() {
  clearGroup(groundGroup);
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: 0x756d59,
    roughness: 1,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
  });
  sandMaterial.userData.owned = true;
  const sand = new THREE.Mesh(new THREE.CircleGeometry(9, 96), sandMaterial);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = -0.035;
  sand.receiveShadow = true;
  groundGroup.add(sand);

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x7b8f85,
    transparent: true,
    opacity: 0.055,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  ringMaterial.userData.owned = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.3, 8.6, 96), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.02;
  groundGroup.add(ring);
}

function sync(rebuild = true) {
  for (const key of Object.keys(P)) {
    P[key] = +$(key).value;
    $(key + 'O').textContent = key === 'age' ? Math.round(P[key]) : P[key].toFixed(2);
  }
  if (rebuild) build();
}

for (const key of Object.keys(P)) {
  $(key).addEventListener('input', () => {
    playing = false;
    clearTimeout(window.__treeRebuild);
    window.__treeRebuild = setTimeout(() => sync(true), 80);
  });
}

$('roots').onclick = () => {
  showRoots = !showRoots;
  $('roots').classList.toggle('on', showRoots);
  rootGroup.visible = showRoots;
};
$('leaves').onclick = () => {
  showLeaves = !showLeaves;
  $('leaves').classList.toggle('on', showLeaves);
  leafGroup.visible = showLeaves;
};
$('detail').onclick = () => {
  showDetail = !showDetail;
  $('detail').classList.toggle('on', showDetail);
  detailGroup.visible = showDetail;
};
$('orbit').onclick = () => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 0.55;
  $('orbit').classList.toggle('on', controls.autoRotate);
};
$('front').onclick = () => {
  camera.position.set(9.5, 5.4, 11.5);
  controls.target.set(0, 2.8, 0);
  controls.update();
};
$('play').onclick = () => {
  P.age = 3;
  $('age').value = 3;
  lastBuildAge = -1;
  playing = true;
  sync(true);
};

function resize() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize);
resize();

window.TreeLifeR05 = {
  getState: () => ({
    params: { ...P },
    roots: rootGroup.userData.count || 0,
    rosettes: leafGroup.userData.count || 0,
    showRoots,
    showLeaves,
    showDetail,
  }),
  rebuild: build,
};

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (playing) {
    P.age = Math.min(120, P.age + dt * 6.3);
    $('age').value = P.age;
    $('ageO').textContent = Math.round(P.age);
    if (Math.floor(P.age / 2) !== lastBuildAge) {
      lastBuildAge = Math.floor(P.age / 2);
      build();
    }
    if (P.age >= 120) playing = false;
  }
  for (const group of rosettes) {
    const breeze = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      0.008 * Math.sin(now * 0.0011 + group.userData.phase),
      0,
      0.013 * Math.sin(now * 0.00135 + group.userData.phase * 1.7),
    ));
    group.quaternion.copy(group.userData.base).multiply(breeze);
  }
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('error', (event) => {
  const box = $('error');
  box.hidden = false;
  box.textContent = `运行错误：${event.message || '未知错误'}`;
});

makeGround();
sync(true);
window.__treeReady = true;
animate(performance.now());
