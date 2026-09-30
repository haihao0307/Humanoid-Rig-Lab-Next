import * as THREE from 'three';
import * as pako from './vendor/pako.esm.mjs';

function base64Bytes(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function ungzip(text) {
  if (!text) throw new Error('人物表面压缩数据为空');
  return pako.ungzip(base64Bytes(text));
}

function partGeometry(part) {
  const raw = ungzip(part.data);
  const vertexCount = part.vertices;
  const positionByteLength = vertexCount * 3 * 2;
  const normalByteLength = vertexCount * 3;
  const quantizedPositions = new Uint16Array(raw.slice(0, positionByteLength).buffer);
  const quantizedNormals = new Int8Array(raw.slice(positionByteLength, positionByteLength + normalByteLength).buffer);
  const indices = new Uint16Array(raw.slice(positionByteLength + normalByteLength).buffer);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);

  for (let vertex = 0; vertex < vertexCount; vertex++) {
    for (let axis = 0; axis < 3; axis++) {
      const offset = vertex * 3 + axis;
      positions[offset] = part.min[axis] + quantizedPositions[offset] / 65535 * (part.max[axis] - part.min[axis]);
      normals[offset] = quantizedNormals[offset] / 127;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function loft(sections, segments = 64) {
  const positions = [];
  const indices = [];
  for (const section of sections) {
    for (let index = 0; index < segments; index++) {
      const angle = index / segments * Math.PI * 2;
      const sine = Math.sin(angle);
      const forwardRadius = sine >= 0 ? section.front : section.back;
      positions.push(
        section.cx + section.rx * Math.cos(angle),
        section.y,
        section.cz + forwardRadius * sine
      );
    }
  }
  for (let row = 0; row < sections.length - 1; row++) {
    for (let index = 0; index < segments; index++) {
      const a = row * segments + index;
      const b = row * segments + (index + 1) % segments;
      const c = (row + 1) * segments + (index + 1) % segments;
      const d = (row + 1) * segments + index;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function loadHuman(scene) {
  const packed = window.HUMAN_R001_PAYLOAD_B64 || '';
  const decoded = new TextDecoder().decode(ungzip(packed));
  const payload = JSON.parse(decoded);
  if (!Array.isArray(payload.parts) || payload.parts.length === 0) throw new Error('人物表面数据结构无效');

  const group = new THREE.Group();
  const scale = 1.8 / 0.978544116;
  let referenceTriangles = 0;

  for (const part of payload.parts.slice().sort((a, b) => a.id - b.id)) {
    if (part.shorts) continue;
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...part.color),
      roughness: part.roughness,
      metalness: 0
    });
    const mesh = new THREE.Mesh(partGeometry(part), material);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    group.add(mesh);
    referenceTriangles += part.triangles;
  }
  scene.add(group);

  const patchMaterial = new THREE.MeshStandardMaterial({ color: 0x9f735d, roughness: 0.72, metalness: 0 });
  const patch = new THREE.Group();
  patch.add(new THREE.Mesh(loft([
    { y: 0.572, cx: 0, cz: 0.008, rx: 0.078, front: 0.052, back: 0.046 },
    { y: 0.555, cx: 0, cz: 0.005, rx: 0.085, front: 0.060, back: 0.054 },
    { y: 0.525, cx: 0, cz: 0, rx: 0.090, front: 0.061, back: 0.063 },
    { y: 0.490, cx: 0, cz: -0.006, rx: 0.094, front: 0.057, back: 0.071 },
    { y: 0.455, cx: 0, cz: -0.010, rx: 0.090, front: 0.050, back: 0.073 },
    { y: 0.425, cx: 0, cz: -0.006, rx: 0.076, front: 0.043, back: 0.064 }
  ], 72), patchMaterial));

  for (const side of [-1, 1]) {
    patch.add(new THREE.Mesh(loft([
      { y: 0.475, cx: side * 0.054, cz: -0.005, rx: 0.048, front: 0.049, back: 0.057 },
      { y: 0.445, cx: side * 0.057, cz: -0.004, rx: 0.050, front: 0.050, back: 0.055 },
      { y: 0.405, cx: side * 0.059, cz: 0, rx: 0.047, front: 0.049, back: 0.050 },
      { y: 0.365, cx: side * 0.061, cz: 0.001, rx: 0.043, front: 0.046, back: 0.046 }
    ], 56), patchMaterial));
  }
  patch.scale.setScalar(scale);
  scene.add(patch);
  return referenceTriangles;
}
