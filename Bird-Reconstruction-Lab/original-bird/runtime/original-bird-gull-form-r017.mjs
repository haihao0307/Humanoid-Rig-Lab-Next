export const GULL_R017_ID = 'original-bird-gull-form-r0171';

function densifyRings(THREE, controls, subdivisions = 5) {
  const shape = new THREE.CatmullRomCurve3(
    controls.map((r) => new THREE.Vector3(r.x, r.ry, r.rz)),
    false,
    'centripetal',
  );
  const center = new THREE.CatmullRomCurve3(
    controls.map((r) => new THREE.Vector3(r.cy ?? 0, r.cz ?? 0, r.keel ?? 0)),
    false,
    'centripetal',
  );
  const count = (controls.length - 1) * subdivisions;
  const rings = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const a = shape.getPoint(t);
    const b = center.getPoint(t);
    rings.push({
      x: a.x,
      ry: Math.max(0.008, a.y),
      rz: Math.max(0.008, a.z),
      cy: b.x,
      cz: b.y,
      keel: Math.max(0, b.z),
      material: a.x >= 1.42 ? 1 : 0,
    });
  }
  return rings;
}

function makeLoftGeometry(THREE, controlRings, radialSegments = 48, subdivisions = 5) {
  const rings = densifyRings(THREE, controlRings, subdivisions);
  const positions = [];
  const uvs = [];
  const indices = [];
  const groups = [];

  for (let r = 0; r < rings.length; r += 1) {
    const ring = rings[r];
    for (let i = 0; i < radialSegments; i += 1) {
      const angle = (i / radialSegments) * Math.PI * 2;
      const lateral = Math.cos(angle);
      const vertical = Math.sin(angle);
      const keel = 1 + ring.keel * Math.max(0, -vertical);
      positions.push(
        ring.x,
        ring.cy + ring.ry * lateral,
        ring.cz + ring.rz * vertical * keel,
      );
      uvs.push(i / radialSegments, r / (rings.length - 1));
    }
  }

  let activeMaterial = rings[0].material;
  let groupStart = 0;
  for (let r = 0; r < rings.length - 1; r += 1) {
    const stripMaterial = rings[r + 1].material;
    if (stripMaterial !== activeMaterial) {
      groups.push({ start: groupStart, count: indices.length - groupStart, material: activeMaterial });
      groupStart = indices.length;
      activeMaterial = stripMaterial;
    }
    for (let i = 0; i < radialSegments; i += 1) {
      const n = (i + 1) % radialSegments;
      const a = r * radialSegments + i;
      const b = r * radialSegments + n;
      const c = (r + 1) * radialSegments + n;
      const d = (r + 1) * radialSegments + i;
      indices.push(a, b, d, b, c, d);
    }
  }
  groups.push({ start: groupStart, count: indices.length - groupStart, material: activeMaterial });

  const startCenter = positions.length / 3;
  positions.push(rings[0].x, rings[0].cy, rings[0].cz);
  uvs.push(0.5, 0);
  const startCap = indices.length;
  for (let i = 0; i < radialSegments; i += 1) {
    const n = (i + 1) % radialSegments;
    indices.push(startCenter, n, i);
  }

  const last = rings.length - 1;
  const endCenter = positions.length / 3;
  positions.push(rings[last].x, rings[last].cy, rings[last].cz);
  uvs.push(0.5, 1);
  const endCap = indices.length;
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
  geometry.addGroup(startCap, radialSegments * 3, rings[0].material);
  for (const group of groups) geometry.addGroup(group.start, group.count, group.material);
  geometry.addGroup(endCap, radialSegments * 3, rings[last].material);
  geometry.computeBoundingSphere();
  return geometry;
}

function pushTriangle(indices, side, a, b, c) {
  if (side > 0) indices.push(a, b, c);
  else indices.push(a, c, b);
}

function makeWingGeometry(THREE, side) {
  const stations = [
    { s: 0.00, cx: 0.12, chord: 0.92, camber: 0.050, thick: 0.105 },
    { s: 0.52, cx: 0.08, chord: 1.10, camber: 0.072, thick: 0.100 },
    { s: 1.12, cx: -0.01, chord: 1.08, camber: 0.085, thick: 0.088 },
    { s: 1.78, cx: -0.18, chord: 0.96, camber: 0.090, thick: 0.074 },
    { s: 2.43, cx: -0.43, chord: 0.76, camber: 0.075, thick: 0.056 },
    { s: 3.02, cx: -0.70, chord: 0.54, camber: 0.050, thick: 0.038 },
    { s: 3.52, cx: -0.94, chord: 0.28, camber: 0.024, thick: 0.024 },
    { s: 3.88, cx: -1.08, chord: 0.055, camber: 0.000, thick: 0.012 },
  ];
  const chordSteps = 14;
  const positions = [];
  const uvs = [];
  const skinIndices = [];
  const skinWeights = [];
  const indices = [];
  const layerVertexCount = stations.length * (chordSteps + 1);
  const joints = [0, 1.12, 2.43, 3.48];

  function weightsForSpan(span) {
    if (span <= joints[1]) {
      const t = span / joints[1];
      return [0, 1, 1 - t, t];
    }
    if (span <= joints[2]) {
      const t = (span - joints[1]) / (joints[2] - joints[1]);
      return [1, 2, 1 - t, t];
    }
    const t = Math.min(1, (span - joints[2]) / (joints[3] - joints[2]));
    return [2, 3, 1 - t, t];
  }

  for (let layer = 0; layer < 2; layer += 1) {
    const layerSign = layer === 0 ? 1 : -1;
    for (let r = 0; r < stations.length; r += 1) {
      const station = stations[r];
      for (let c = 0; c <= chordSteps; c += 1) {
        const q = c / chordSteps;
        const rounded = Math.sin(Math.PI * q);
        const x = station.cx + station.chord * (0.52 - q);
        const y = side * station.s;
        const z = station.camber * rounded + layerSign * station.thick * 0.5 * Math.pow(rounded, 0.70);
        positions.push(x, y, z);
        uvs.push(q, station.s / stations.at(-1).s);
        const [a, b, wa, wb] = weightsForSpan(station.s);
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
        if (layer === 0) {
          pushTriangle(indices, side, a, d, b);
          pushTriangle(indices, side, b, d, e);
        } else {
          pushTriangle(indices, side, a, b, d);
          pushTriangle(indices, side, b, e, d);
        }
      }
    }
  }

  for (const chordIndex of [0, chordSteps]) {
    for (let r = 0; r < stations.length - 1; r += 1) {
      const a = r * row + chordIndex;
      const b = (r + 1) * row + chordIndex;
      const c = a + layerVertexCount;
      const d = b + layerVertexCount;
      if (chordIndex === 0) {
        pushTriangle(indices, side, a, c, b);
        pushTriangle(indices, side, b, c, d);
      } else {
        pushTriangle(indices, side, a, b, c);
        pushTriangle(indices, side, b, d, c);
      }
    }
  }

  for (const stationIndex of [0, stations.length - 1]) {
    for (let c = 0; c < chordSteps; c += 1) {
      const a = stationIndex * row + c;
      const b = a + 1;
      const d = a + layerVertexCount;
      const e = b + layerVertexCount;
      if (stationIndex === 0) {
        pushTriangle(indices, side, a, b, d);
        pushTriangle(indices, side, b, e, d);
      } else {
        pushTriangle(indices, side, a, d, b);
        pushTriangle(indices, side, b, d, e);
      }
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

function makeFeatherBladeGeometry(THREE, length = 1, width = 0.18, thickness = 0.018, segments = 14) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let layer = 0; layer < 2; layer += 1) {
    const z = (layer === 0 ? 1 : -1) * thickness * 0.5;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = length * t;
      const envelope = Math.pow(Math.sin(Math.PI * Math.min(0.999, t)), 0.62) * (1 - 0.18 * t);
      const w = width * envelope;
      positions.push(x, -w, z, x, w, z);
      uvs.push(t, 0, t, 1);
    }
  }
  const row = (segments + 1) * 2;
  for (let layer = 0; layer < 2; layer += 1) {
    const offset = layer * row;
    for (let i = 0; i < segments; i += 1) {
      const a = offset + i * 2;
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

function makeTailCarrierGeometry(THREE) {
  const stations = [
    { x: 0.00, half: 0.26, z: 0.030, thick: 0.10 },
    { x: -0.46, half: 0.38, z: 0.025, thick: 0.075 },
    { x: -0.92, half: 0.52, z: 0.015, thick: 0.040 },
  ];
  const positions = [];
  const indices = [];
  for (let layer = 0; layer < 2; layer += 1) {
    const sign = layer === 0 ? 1 : -1;
    for (const station of stations) {
      positions.push(station.x, -station.half, station.z + sign * station.thick * 0.5);
      positions.push(station.x, station.half, station.z + sign * station.thick * 0.5);
    }
  }
  const row = stations.length * 2;
  for (let layer = 0; layer < 2; layer += 1) {
    const offset = layer * row;
    for (let i = 0; i < stations.length - 1; i += 1) {
      const a = offset + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      if (layer === 0) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  for (const edge of [0, 1]) {
    for (let i = 0; i < stations.length - 1; i += 1) {
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeWebbingGeometry(THREE, root, tips) {
  const positions = [
    root.x, root.y, root.z,
    tips[1].x, tips[1].y, tips[1].z,
    tips[0].x, tips[0].y, tips[0].z,
    tips[2].x, tips[2].y, tips[2].z,
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBoneBetween(THREE, a, b, radius, material) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.84, length, 14, 1, false),
    material,
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createWing(THREE, materials, side) {
  const geometry = makeWingGeometry(THREE, side);
  const mesh = new THREE.SkinnedMesh(geometry, materials.wing);
  mesh.name = side > 0 ? 'continuous-wing.L' : 'continuous-wing.R';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(-0.08, side * 0.22, 0.27);

  const shoulder = new THREE.Bone();
  shoulder.name = side > 0 ? 'wing.L.shoulder' : 'wing.R.shoulder';
  const elbow = new THREE.Bone();
  elbow.name = side > 0 ? 'wing.L.elbow' : 'wing.R.elbow';
  const wrist = new THREE.Bone();
  wrist.name = side > 0 ? 'wing.L.wrist' : 'wing.R.wrist';
  const tip = new THREE.Bone();
  tip.name = side > 0 ? 'wing.L.tip' : 'wing.R.tip';
  elbow.position.set(-0.10, side * 1.12, 0.01);
  wrist.position.set(-0.28, side * 1.31, -0.01);
  tip.position.set(-0.30, side * 1.05, -0.01);
  shoulder.add(elbow);
  elbow.add(wrist);
  wrist.add(tip);
  mesh.add(shoulder);
  mesh.bind(new THREE.Skeleton([shoulder, elbow, wrist, tip]));

  const primaryGroup = new THREE.Group();
  primaryGroup.name = side > 0 ? 'primary-feathers.L' : 'primary-feathers.R';
  primaryGroup.position.set(-0.13, side * 0.18, -0.020);
  wrist.add(primaryGroup);
  for (let i = 0; i < 8; i += 1) {
    const feather = new THREE.Mesh(
      makeFeatherBladeGeometry(THREE, 1.02 + i * 0.055, 0.125 + i * 0.006, 0.014, 12),
      materials.primary,
    );
    feather.rotation.z = side * (Math.PI * 0.50 + (i - 3.5) * 0.038);
    feather.rotation.y = -0.035 + i * 0.007;
    feather.position.set(-0.20 - i * 0.025, side * (0.18 + i * 0.040), -0.018 - i * 0.0015);
    feather.castShadow = true;
    feather.receiveShadow = true;
    primaryGroup.add(feather);
  }

  return { side, mesh, bones: { shoulder, elbow, wrist, tip } };
}

function addTail(THREE, root, materials) {
  const tail = new THREE.Group();
  tail.name = 'tail-feather-array';
  tail.position.set(-1.36, 0, 0.065);
  const carrier = new THREE.Mesh(makeTailCarrierGeometry(THREE), materials.tail);
  carrier.name = 'tail-continuous-carrier';
  carrier.castShadow = true;
  carrier.receiveShadow = true;
  tail.add(carrier);
  for (let i = 0; i < 9; i += 1) {
    const t = (i - 4) / 4;
    const feather = new THREE.Mesh(
      makeFeatherBladeGeometry(THREE, 1.04 - Math.abs(t) * 0.10, 0.19, 0.020, 12),
      Math.abs(t) > 0.72 ? materials.primary : materials.tail,
    );
    feather.rotation.z = Math.PI - t * 0.16;
    feather.rotation.y = t * 0.055;
    feather.position.set(-0.22, t * 0.28, 0.015 + Math.abs(t) * 0.006);
    feather.castShadow = true;
    feather.receiveShadow = true;
    tail.add(feather);
  }
  root.add(tail);
  return tail;
}

function addEye(THREE, root, materials, side) {
  const eye = new THREE.Group();
  eye.name = side > 0 ? 'eye.L' : 'eye.R';
  eye.position.set(1.20, side * 0.252, 0.635);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.054, 28, 18), materials.iris);
  iris.scale.set(1.0, 0.46, 1.0);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.027, 24, 16), materials.pupil);
  pupil.position.y = side * 0.031;
  pupil.scale.set(1.0, 0.38, 1.0);
  const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.059, 28, 18), materials.cornea);
  cornea.scale.set(1.0, 0.43, 1.0);
  iris.castShadow = true;
  eye.add(iris, pupil, cornea);
  root.add(eye);
}

function addBeakDetails(THREE, root, materials) {
  for (const side of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.43, side * 0.155, 0.535),
      new THREE.Vector3(1.64, side * 0.112, 0.505),
      new THREE.Vector3(1.84, side * 0.064, 0.475),
    ]);
    const seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.007, 6, false), materials.mouth);
    seam.castShadow = true;
    root.add(seam);
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 10), materials.mouth);
    nostril.position.set(1.57, side * 0.122, 0.555);
    nostril.scale.y = 0.55;
    root.add(nostril);
  }
}

function addLegs(THREE, root, materials) {
  const feet = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Vector3(-0.18, side * 0.245, -0.30);
    const knee = new THREE.Vector3(-0.30, side * 0.255, -0.58);
    const ankle = new THREE.Vector3(-0.10, side * 0.255, -0.88);
    root.add(makeBoneBetween(THREE, hip, knee, 0.052, materials.leg));
    root.add(makeBoneBetween(THREE, knee, ankle, 0.042, materials.leg));
    const footRoot = new THREE.Vector3(-0.06, side * 0.255, -0.91);
    const toeEnds = [
      new THREE.Vector3(0.42, side * 0.255, -0.925),
      new THREE.Vector3(0.31, side * 0.405, -0.925),
      new THREE.Vector3(0.31, side * 0.105, -0.925),
      new THREE.Vector3(-0.38, side * 0.255, -0.915),
    ];
    for (let i = 0; i < toeEnds.length; i += 1) {
      root.add(makeBoneBetween(THREE, footRoot, toeEnds[i], i === 3 ? 0.013 : 0.017, materials.leg));
    }
    const webbing = new THREE.Mesh(makeWebbingGeometry(THREE, footRoot, toeEnds), materials.webbing);
    webbing.castShadow = true;
    webbing.receiveShadow = true;
    root.add(webbing);
    feet.push({ hip, knee, ankle, toeEnds });
  }
  return feet;
}

export function createOriginalGullR017(THREE, options = {}) {
  const root = new THREE.Group();
  root.name = GULL_R017_ID;

  const materials = {
    body: new THREE.MeshPhysicalMaterial({ color: 0xf1f2ef, roughness: 0.76, metalness: 0, clearcoat: 0.015 }),
    beak: new THREE.MeshPhysicalMaterial({ color: 0xd8ad48, roughness: 0.58, metalness: 0 }),
    mouth: new THREE.MeshPhysicalMaterial({ color: 0x5b362a, roughness: 0.70, metalness: 0 }),
    wing: new THREE.MeshPhysicalMaterial({ color: 0xaeb7bb, roughness: 0.74, metalness: 0, side: THREE.DoubleSide }),
    primary: new THREE.MeshPhysicalMaterial({ color: 0x687178, roughness: 0.76, metalness: 0, side: THREE.DoubleSide }),
    tail: new THREE.MeshPhysicalMaterial({ color: 0xdde1e1, roughness: 0.80, metalness: 0, side: THREE.DoubleSide }),
    iris: new THREE.MeshPhysicalMaterial({ color: 0xc9a349, roughness: 0.34, metalness: 0 }),
    pupil: new THREE.MeshPhysicalMaterial({ color: 0x090b0d, roughness: 0.18, metalness: 0 }),
    cornea: new THREE.MeshPhysicalMaterial({ color: 0x263746, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, transmission: 0.12 }),
    leg: new THREE.MeshPhysicalMaterial({ color: 0xb59659, roughness: 0.74, metalness: 0 }),
    webbing: new THREE.MeshPhysicalMaterial({ color: 0xc4a565, roughness: 0.78, metalness: 0, side: THREE.DoubleSide }),
  };

  const controlRings = [
    { x: -1.54, ry: 0.075, rz: 0.055, cz: 0.055 },
    { x: -1.34, ry: 0.30, rz: 0.24, cz: 0.050 },
    { x: -1.05, ry: 0.43, rz: 0.37, cz: 0.060, keel: 0.025 },
    { x: -0.69, ry: 0.50, rz: 0.47, cz: 0.095, keel: 0.050 },
    { x: -0.27, ry: 0.52, rz: 0.52, cz: 0.145, keel: 0.070 },
    { x: 0.10, ry: 0.48, rz: 0.49, cz: 0.205, keel: 0.045 },
    { x: 0.39, ry: 0.39, rz: 0.41, cz: 0.305 },
    { x: 0.64, ry: 0.29, rz: 0.32, cz: 0.420 },
    { x: 0.87, ry: 0.225, rz: 0.255, cz: 0.525 },
    { x: 1.08, ry: 0.245, rz: 0.275, cz: 0.585 },
    { x: 1.27, ry: 0.255, rz: 0.265, cz: 0.590 },
    { x: 1.43, ry: 0.195, rz: 0.180, cz: 0.555 },
    { x: 1.65, ry: 0.135, rz: 0.115, cz: 0.525 },
    { x: 1.85, ry: 0.075, rz: 0.060, cz: 0.485 },
    { x: 2.02, ry: 0.010, rz: 0.010, cz: 0.455 },
  ];
  const bodyGeometry = makeLoftGeometry(
    THREE,
    controlRings,
    options.bodyRadialSegments ?? 52,
    options.bodyLongitudinalSubdivisions ?? 5,
  );
  const body = new THREE.Mesh(bodyGeometry, [materials.body, materials.beak]);
  body.name = 'continuous-body-head-beak-carrier';
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  addEye(THREE, root, materials, -1);
  addEye(THREE, root, materials, 1);
  addBeakDetails(THREE, root, materials);
  const leftWing = createWing(THREE, materials, 1);
  const rightWing = createWing(THREE, materials, -1);
  root.add(leftWing.mesh, rightWing.mesh);
  const tail = addTail(THREE, root, materials);
  const feet = addLegs(THREE, root, materials);

  const state = {
    animate: false,
    phase: 0,
    flapRate: 1.05,
    flapAmplitude: 0.52,
  };

  function poseAtPhase(phase) {
    const wave = Math.sin(phase * Math.PI * 2);
    const compression = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2 + 0.72);
    const shoulderAngle = 0.065 + wave * state.flapAmplitude;
    const elbowAngle = -0.045 - compression * 0.19;
    const wristAngle = -0.035 - compression * 0.28;
    const tipAngle = -0.018 - compression * 0.055;
    for (const wing of [leftWing, rightWing]) {
      const mirror = wing.side;
      wing.bones.shoulder.rotation.x = mirror * shoulderAngle;
      wing.bones.elbow.rotation.z = mirror * elbowAngle;
      wing.bones.wrist.rotation.z = mirror * wristAngle;
      wing.bones.tip.rotation.z = mirror * tipAngle;
    }
    root.rotation.y = -0.014 * wave;
    root.position.z = 0.012 * Math.sin(phase * Math.PI * 4);
    tail.rotation.y = -0.010 * wave;
  }

  poseAtPhase(0.02);

  return {
    root,
    materials,
    anatomy: {
      body,
      leftWing,
      rightWing,
      tail,
      feet,
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
        revision: 'R0.17.1',
        vertices: Math.round(vertices),
        triangles: Math.round(triangles),
        bodyCarrierContinuous: true,
        leftWingContinuousSkinnedSurface: true,
        rightWingContinuousSkinnedSurface: true,
        mirroredWingNormalsCorrected: true,
        webbedFeetPresent: true,
        basicFlapDeformationAvailable: true,
        advancedFlightAvailable: false,
      };
    },
  };
}
