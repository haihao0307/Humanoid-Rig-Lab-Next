export const GULL_R017_ID = 'original-bird-gull-form-r017';

function makeLoftGeometry(THREE, rings, radialSegments = 40) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const materialForStrip = [];

  for (let r = 0; r < rings.length; r += 1) {
    const ring = rings[r];
    for (let i = 0; i < radialSegments; i += 1) {
      const a = (i / radialSegments) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const squash = 1 + (ring.keel ?? 0) * Math.max(0, -sa);
      positions.push(
        ring.x,
        (ring.cy ?? 0) + ring.ry * ca,
        (ring.cz ?? 0) + ring.rz * sa * squash,
      );
      uvs.push(i / radialSegments, r / (rings.length - 1));
    }
  }

  for (let r = 0; r < rings.length - 1; r += 1) {
    const start = indices.length;
    for (let i = 0; i < radialSegments; i += 1) {
      const n = (i + 1) % radialSegments;
      const a = r * radialSegments + i;
      const b = r * radialSegments + n;
      const c = (r + 1) * radialSegments + n;
      const d = (r + 1) * radialSegments + i;
      indices.push(a, b, d, b, c, d);
    }
    materialForStrip.push({ start, count: indices.length - start, material: rings[r + 1].material ?? rings[r].material ?? 0 });
  }

  const startCenter = positions.length / 3;
  positions.push(rings[0].x, rings[0].cy ?? 0, rings[0].cz ?? 0);
  uvs.push(0.5, 0);
  const startCapIndex = indices.length;
  for (let i = 0; i < radialSegments; i += 1) {
    const n = (i + 1) % radialSegments;
    indices.push(startCenter, n, i);
  }

  const last = rings.length - 1;
  const endCenter = positions.length / 3;
  positions.push(rings[last].x, rings[last].cy ?? 0, rings[last].cz ?? 0);
  uvs.push(0.5, 1);
  const endCapIndex = indices.length;
  for (let i = 0; i < radialSegments; i += 1) {
    const n = (i + 1) % radialSegments;
    indices.push(endCenter, last * radialSegments + i, last * radialSegments + n);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.clearGroups();
  geometry.addGroup(startCapIndex, radialSegments * 3, rings[0].material ?? 0);
  for (const strip of materialForStrip) geometry.addGroup(strip.start, strip.count, strip.material);
  geometry.addGroup(endCapIndex, radialSegments * 3, rings[last].material ?? 0);
  geometry.computeBoundingSphere();
  return geometry;
}

function makeWingGeometry(THREE) {
  const stations = [
    { s: 0.00, cx: 0.10, chord: 0.92, camber: 0.06, thick: 0.11 },
    { s: 0.42, cx: 0.05, chord: 1.05, camber: 0.08, thick: 0.10 },
    { s: 0.92, cx: -0.04, chord: 1.02, camber: 0.10, thick: 0.09 },
    { s: 1.42, cx: -0.19, chord: 0.90, camber: 0.10, thick: 0.075 },
    { s: 1.93, cx: -0.40, chord: 0.72, camber: 0.08, thick: 0.055 },
    { s: 2.43, cx: -0.64, chord: 0.49, camber: 0.045, thick: 0.035 },
    { s: 2.83, cx: -0.87, chord: 0.25, camber: 0.02, thick: 0.022 },
    { s: 3.08, cx: -1.02, chord: 0.045, camber: 0.00, thick: 0.012 },
  ];
  const chordSteps = 12;
  const positions = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];
  const indices = [];
  const layerVertexCount = stations.length * (chordSteps + 1);
  const joints = [0, 0.96, 1.88, 2.72];

  function weightsForSpan(s) {
    if (s <= joints[1]) {
      const t = s / joints[1];
      return [0, 1, 1 - t, t];
    }
    if (s <= joints[2]) {
      const t = (s - joints[1]) / (joints[2] - joints[1]);
      return [1, 2, 1 - t, t];
    }
    const t = Math.min(1, (s - joints[2]) / (joints[3] - joints[2]));
    return [2, 3, 1 - t, t];
  }

  for (let layer = 0; layer < 2; layer += 1) {
    const sign = layer === 0 ? 1 : -1;
    for (let r = 0; r < stations.length; r += 1) {
      const st = stations[r];
      for (let c = 0; c <= chordSteps; c += 1) {
        const q = c / chordSteps;
        const edgeRound = Math.sin(Math.PI * q);
        const trailingNotch = q > 0.82 ? 0.018 * Math.sin((r + 1) * 1.7) : 0;
        const x = st.cx + st.chord * (0.50 - q) - trailingNotch;
        const y = st.s;
        const z = st.camber * edgeRound + sign * st.thick * 0.5 * Math.pow(edgeRound, 0.65);
        positions.push(x, y, z);
        uvs.push(q, st.s / stations.at(-1).s);
        const [a, b, wa, wb] = weightsForSpan(st.s);
        skinIndices.push(a, b, 0, 0);
        skinWeights.push(wa, wb, 0, 0);
      }
    }
  }

  const row = chordSteps + 1;
  for (let layer = 0; layer < 2; layer += 1) {
    const offset = layer * layerVertexCount;
    for (let r = 0; r < stations.length - 1; r += 1) {
      for (let c = 0; c < chordSteps; c += 1) {
        const a = offset + r * row + c;
        const b = a + 1;
        const d = offset + (r + 1) * row + c;
        const e = d + 1;
        if (layer === 0) indices.push(a, d, b, b, d, e);
        else indices.push(a, b, d, b, e, d);
      }
    }
  }

  function stitch(c) {
    for (let r = 0; r < stations.length - 1; r += 1) {
      const a = r * row + c;
      const b = (r + 1) * row + c;
      const d = a + layerVertexCount;
      const e = b + layerVertexCount;
      if (c === 0) indices.push(a, d, b, b, d, e);
      else indices.push(a, b, d, b, e, d);
    }
  }
  stitch(0);
  stitch(chordSteps);

  for (const r of [0, stations.length - 1]) {
    for (let c = 0; c < chordSteps; c += 1) {
      const a = r * row + c;
      const b = a + 1;
      const d = a + layerVertexCount;
      const e = b + layerVertexCount;
      if (r === 0) indices.push(a, b, d, b, e, d);
      else indices.push(a, d, b, b, d, e);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeFeatherBladeGeometry(THREE, length = 1, width = 0.18, thickness = 0.018, segments = 12) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let layer = 0; layer < 2; layer += 1) {
    const z = (layer === 0 ? 1 : -1) * thickness * 0.5;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = length * t;
      const envelope = Math.pow(Math.sin(Math.PI * Math.min(0.999, t)), 0.58) * (1 - 0.16 * t);
      const w = width * envelope;
      positions.push(x, -w, z, x, w, z);
      uvs.push(t, 0, t, 1);
    }
  }
  const row = (segments + 1) * 2;
  for (let layer = 0; layer < 2; layer += 1) {
    const off = layer * row;
    for (let i = 0; i < segments; i += 1) {
      const a = off + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (layer === 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (const edge of [0, 1]) {
      const a = i * 2 + edge;
      const b = a + 2;
      const c = a + row;
      const d = b + row;
      if (edge === 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBoneBetween(THREE, a, b, radius, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.88, length, 12, 1, false), material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWing(THREE, materials, side) {
  const geometry = makeWingGeometry(THREE);
  const mesh = new THREE.SkinnedMesh(geometry, materials.wing);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(-0.10, side * 0.42, 0.32);
  mesh.scale.y = side;

  const shoulder = new THREE.Bone();
  shoulder.name = side > 0 ? 'wing.L.shoulder' : 'wing.R.shoulder';
  const elbow = new THREE.Bone();
  elbow.name = side > 0 ? 'wing.L.elbow' : 'wing.R.elbow';
  const wrist = new THREE.Bone();
  wrist.name = side > 0 ? 'wing.L.wrist' : 'wing.R.wrist';
  const tip = new THREE.Bone();
  tip.name = side > 0 ? 'wing.L.tip' : 'wing.R.tip';
  elbow.position.set(-0.10, 0.96, 0.01);
  wrist.position.set(-0.23, 0.92, -0.01);
  tip.position.set(-0.31, 0.84, -0.01);
  shoulder.add(elbow);
  elbow.add(wrist);
  wrist.add(tip);
  mesh.add(shoulder);
  mesh.bind(new THREE.Skeleton([shoulder, elbow, wrist, tip]));

  const primaryGroup = new THREE.Group();
  primaryGroup.name = side > 0 ? 'primary-feathers.L' : 'primary-feathers.R';
  primaryGroup.position.set(-0.18, 0.30, -0.015);
  wrist.add(primaryGroup);
  for (let i = 0; i < 8; i += 1) {
    const feather = new THREE.Mesh(
      makeFeatherBladeGeometry(THREE, 0.92 + i * 0.055, 0.12 + i * 0.008, 0.014, 10),
      materials.primary,
    );
    feather.rotation.z = Math.PI * 0.50 + (i - 3.5) * 0.055;
    feather.rotation.y = -0.04 + i * 0.009;
    feather.position.set(-0.24 - i * 0.035, 0.22 + i * 0.035, -0.015 - i * 0.002);
    feather.castShadow = true;
    feather.receiveShadow = true;
    primaryGroup.add(feather);
  }

  return { mesh, bones: { shoulder, elbow, wrist, tip } };
}

function addTail(THREE, root, materials) {
  const tail = new THREE.Group();
  tail.name = 'tail-feather-array';
  tail.position.set(-1.06, 0, 0.10);
  root.add(tail);
  for (let i = 0; i < 9; i += 1) {
    const t = (i - 4) / 4;
    const feather = new THREE.Mesh(
      makeFeatherBladeGeometry(THREE, 1.18 - Math.abs(t) * 0.10, 0.18, 0.022, 12),
      i === 0 || i === 8 ? materials.primary : materials.tail,
    );
    feather.rotation.z = Math.PI + t * 0.16;
    feather.rotation.y = t * 0.06;
    feather.position.set(0, t * 0.22, -0.01 + Math.abs(t) * 0.012);
    feather.castShadow = true;
    feather.receiveShadow = true;
    tail.add(feather);
  }
  return tail;
}

function addEye(THREE, root, materials, side) {
  const eye = new THREE.Group();
  eye.position.set(0.98, side * 0.292, 0.60);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.073, 24, 16), materials.eye);
  iris.scale.set(1.0, 0.72, 1.0);
  iris.castShadow = true;
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.078, 24, 16), materials.cornea);
  cornea.scale.set(1.0, 0.70, 1.0);
  eye.add(iris, cornea);
  root.add(eye);
}

function addLegs(THREE, root, materials) {
  const feet = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Vector3(-0.24, side * 0.23, -0.34);
    const ankle = new THREE.Vector3(-0.32, side * 0.25, -0.88);
    root.add(makeBoneBetween(THREE, hip, ankle, 0.055, materials.leg));
    const footRoot = new THREE.Vector3(-0.25, side * 0.25, -0.90);
    const toeEnds = [
      new THREE.Vector3(0.16, side * 0.25, -0.93),
      new THREE.Vector3(0.09, side * 0.39, -0.93),
      new THREE.Vector3(0.06, side * 0.11, -0.93),
      new THREE.Vector3(-0.55, side * 0.25, -0.92),
    ];
    for (const end of toeEnds) root.add(makeBoneBetween(THREE, footRoot, end, 0.018, materials.leg));
    feet.push({ hip, ankle, toeEnds });
  }
  return feet;
}

export function createOriginalGullR017(THREE, options = {}) {
  const root = new THREE.Group();
  root.name = GULL_R017_ID;

  const materials = {
    body: new THREE.MeshPhysicalMaterial({ color: 0xe8ecec, roughness: 0.78, metalness: 0, clearcoat: 0.02 }),
    beak: new THREE.MeshPhysicalMaterial({ color: 0xd4b56c, roughness: 0.62, metalness: 0 }),
    wing: new THREE.MeshPhysicalMaterial({ color: 0xb7bec1, roughness: 0.72, metalness: 0, side: THREE.DoubleSide }),
    primary: new THREE.MeshPhysicalMaterial({ color: 0x596066, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }),
    tail: new THREE.MeshPhysicalMaterial({ color: 0xd8ddde, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x101318, roughness: 0.23, metalness: 0 }),
    cornea: new THREE.MeshPhysicalMaterial({ color: 0x263746, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.33, transmission: 0.15 }),
    leg: new THREE.MeshPhysicalMaterial({ color: 0xb68d5b, roughness: 0.76, metalness: 0 }),
  };

  const rings = [
    { x: -1.34, ry: 0.07, rz: 0.055, cz: 0.08, material: 0 },
    { x: -1.18, ry: 0.28, rz: 0.23, cz: 0.07, material: 0 },
    { x: -0.90, ry: 0.49, rz: 0.39, cz: 0.05, keel: 0.08, material: 0 },
    { x: -0.54, ry: 0.61, rz: 0.54, cz: 0.10, keel: 0.11, material: 0 },
    { x: -0.13, ry: 0.64, rz: 0.61, cz: 0.17, keel: 0.13, material: 0 },
    { x: 0.22, ry: 0.55, rz: 0.56, cz: 0.27, keel: 0.09, material: 0 },
    { x: 0.50, ry: 0.41, rz: 0.44, cz: 0.39, material: 0 },
    { x: 0.72, ry: 0.34, rz: 0.36, cz: 0.50, material: 0 },
    { x: 0.94, ry: 0.32, rz: 0.31, cz: 0.55, material: 0 },
    { x: 1.11, ry: 0.25, rz: 0.22, cz: 0.53, material: 0 },
    { x: 1.20, ry: 0.20, rz: 0.16, cz: 0.50, material: 1 },
    { x: 1.46, ry: 0.125, rz: 0.085, cz: 0.49, material: 1 },
    { x: 1.68, ry: 0.012, rz: 0.010, cz: 0.48, material: 1 },
  ];
  const bodyGeometry = makeLoftGeometry(THREE, rings, options.bodyRadialSegments ?? 44);
  const body = new THREE.Mesh(bodyGeometry, [materials.body, materials.beak]);
  body.name = 'continuous-body-head-beak-carrier';
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  addEye(THREE, root, materials, -1);
  addEye(THREE, root, materials, 1);
  const left = createWing(THREE, materials, 1);
  const right = createWing(THREE, materials, -1);
  root.add(left.mesh, right.mesh);
  const tail = addTail(THREE, root, materials);
  addLegs(THREE, root, materials);

  const state = {
    animate: false,
    phase: 0,
    flapRate: 1.15,
    flapAmplitude: 0.58,
  };

  function poseAtPhase(phase) {
    const wave = Math.sin(phase * Math.PI * 2);
    const compression = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 0.75);
    const shoulder = 0.07 + wave * state.flapAmplitude;
    const elbow = -0.08 - compression * 0.21;
    const wrist = -0.05 - compression * 0.31;
    for (const wing of [left, right]) {
      wing.bones.shoulder.rotation.x = shoulder;
      wing.bones.elbow.rotation.z = elbow;
      wing.bones.wrist.rotation.z = wrist;
      wing.bones.tip.rotation.z = -0.03 - compression * 0.08;
    }
    root.rotation.y = -0.02 * wave;
    root.position.z = 0.018 * Math.sin(phase * Math.PI * 4);
    tail.rotation.z = 0.012 * wave;
  }

  poseAtPhase(0.02);

  return {
    root,
    materials,
    anatomy: {
      body,
      leftWing: left,
      rightWing: right,
      tail,
    },
    state,
    setAnimate(enabled) {
      state.animate = Boolean(enabled);
    },
    setPhase(phase) {
      state.phase = ((Number(phase) % 1) + 1) % 1;
      poseAtPhase(state.phase);
    },
    setWireframe(enabled) {
      for (const material of Object.values(materials)) material.wireframe = Boolean(enabled);
    },
    update(deltaSeconds) {
      if (!state.animate) return;
      state.phase = (state.phase + deltaSeconds * state.flapRate) % 1;
      poseAtPhase(state.phase);
    },
    getMetrics() {
      let vertices = 0;
      let triangles = 0;
      root.traverse((object) => {
        const position = object.geometry?.getAttribute?.('position');
        if (position) vertices += position.count;
        const index = object.geometry?.getIndex?.();
        if (index) triangles += index.count / 3;
        else if (position) triangles += position.count / 3;
      });
      return {
        id: GULL_R017_ID,
        vertices: Math.round(vertices),
        triangles: Math.round(triangles),
        bodyCarrierContinuous: true,
        leftWingContinuousSkinnedSurface: true,
        rightWingContinuousSkinnedSurface: true,
        basicFlapDeformationAvailable: true,
        advancedFlightAvailable: false,
      };
    },
  };
}
