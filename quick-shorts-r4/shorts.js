import * as THREE from 'three';

export const BASE = {
  waistCircumference: 825.119,
  hipCircumference: 1023.701,
  crotchDepth: 240.402,
  waistY: 1022.175,
  hipY: 826.774
};

const ellipseRadii = (circumference, aspectRatio) => {
  const a = aspectRatio;
  const b = 1;
  const h = ((a - b) / (a + b)) ** 2;
  const unitCircumference = Math.PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
  const scale = circumference / unitCircumference;
  return { rx: a * scale, rz: b * scale };
};
const smoothMix = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));

function createLeg(side, parameters, material) {
  const waistY = BASE.waistY / 1000;
  const hipY = BASE.hipY / 1000;
  const crotchY = waistY - (BASE.crotchDepth + parameters.riseAdjustMm) / 1000;
  const hemY = Math.min(crotchY - 0.075, waistY - parameters.shortsLengthMm / 1000);
  const waist = ellipseRadii(((BASE.waistCircumference + parameters.waistEaseMm) / 2 + 44) / 1000, 1.28);
  const hip = ellipseRadii(((BASE.hipCircumference + parameters.hipEaseMm) / 2 + 32) / 1000, 1.26);
  const hem = ellipseRadii(parameters.legOpeningMm / 1000, 1.2);
  const hemCenter = Math.max(0.075, parameters.legGapMm / 2000 + hem.rx * 0.56);
  const sections = [
    { y: waistY - 0.018, rx: waist.rx, rz: waist.rz, cx: side * 0.055 },
    { y: hipY, rx: hip.rx, rz: hip.rz, cx: side * 0.072 },
    { y: crotchY + 0.012, rx: Math.max(hip.rx * 0.82, hem.rx * 0.98), rz: Math.max(hip.rz * 0.87, hem.rz), cx: side * 0.083 },
    { y: hemY, rx: hem.rx, rz: hem.rz, cx: side * hemCenter }
  ];

  const radialSegments = 72;
  const rows = 28;
  const positions = [];
  const indices = [];
  const sampleSection = (y) => {
    if (y >= sections[0].y) return sections[0];
    for (let index = 0; index < 3; index++) {
      if (y <= sections[index].y && y >= sections[index + 1].y) {
        const t = (sections[index].y - y) / (sections[index].y - sections[index + 1].y);
        return {
          y,
          rx: smoothMix(sections[index].rx, sections[index + 1].rx, t),
          rz: smoothMix(sections[index].rz, sections[index + 1].rz, t),
          cx: smoothMix(sections[index].cx, sections[index + 1].cx, t)
        };
      }
    }
    return sections[3];
  };

  for (let row = 0; row <= rows; row++) {
    const y = smoothMix(sections[0].y, hemY, row / rows);
    const section = sampleSection(y);
    const verticalT = row / rows;
    for (let radial = 0; radial < radialSegments; radial++) {
      const angle = radial / radialSegments * Math.PI * 2;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const medial = side < 0 ? cosine > 0 : cosine < 0;
      const radiusX = section.rx * (medial ? smoothMix(0.68, 0.82, verticalT) : 1);
      const radiusZ = sine >= 0 ? section.rz * 0.97 : section.rz * 1.08;
      const wrinkle = parameters.wrinkleMm / 1000 * Math.sin(Math.PI * verticalT) ** 2 * (
        Math.sin(angle * 4 + verticalT * 8) * 0.55 + Math.sin(angle * 7 - verticalT * 5) * 0.24
      );
      positions.push(
        section.cx + (radiusX + wrinkle) * cosine,
        y,
        (radiusZ + wrinkle * 0.6) * sine
      );
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let radial = 0; radial < radialSegments; radial++) {
      const a = row * radialSegments + radial;
      const b = row * radialSegments + (radial + 1) % radialSegments;
      const c = (row + 1) * radialSegments + (radial + 1) % radialSegments;
      const d = (row + 1) * radialSegments + radial;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return {
    mesh: new THREE.Mesh(geometry, material),
    waistY,
    crotchY,
    hemY
  };
}

function createWaistband(parameters, material, waistY) {
  const top = ellipseRadii((BASE.waistCircumference + parameters.waistEaseMm) / 1000, 1.52);
  const bottom = ellipseRadii((BASE.waistCircumference + parameters.waistEaseMm + 34) / 1000, 1.5);
  const height = parameters.waistbandHeightMm / 1000;
  const radialSegments = 96;
  const rows = 5;
  const positions = [];
  const indices = [];

  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    for (let radial = 0; radial < radialSegments; radial++) {
      const angle = radial / radialSegments * Math.PI * 2;
      const gather = parameters.wrinkleMm / 1000 * 0.45 * Math.sin(angle * 12 + row);
      const radiusX = smoothMix(top.rx, bottom.rx, t);
      const radiusZ = smoothMix(top.rz, bottom.rz, t);
      positions.push(
        (radiusX + gather) * Math.cos(angle),
        waistY - height * t,
        ((Math.sin(angle) >= 0 ? radiusZ * 0.96 : radiusZ * 1.08) + gather * 0.35) * Math.sin(angle)
      );
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let radial = 0; radial < radialSegments; radial++) {
      const a = row * radialSegments + radial;
      const b = row * radialSegments + (radial + 1) % radialSegments;
      const c = (row + 1) * radialSegments + (radial + 1) % radialSegments;
      const d = (row + 1) * radialSegments + radial;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return new THREE.Mesh(geometry, material);
}

export function buildShorts(group, parameters) {
  while (group.children.length) {
    const object = group.children.pop();
    object.geometry?.dispose();
    object.material?.dispose();
  }

  const material = new THREE.MeshStandardMaterial({
    color: parameters.color,
    roughness: parameters.roughness,
    side: THREE.DoubleSide
  });
  const left = createLeg(-1, parameters, material);
  const right = createLeg(1, parameters, material);
  const waistband = createWaistband(parameters, material, left.waistY);
  for (const mesh of [left.mesh, right.mesh, waistband]) {
    mesh.castShadow = true;
    group.add(mesh);
  }

  const seamPoints = [];
  for (let index = 0; index <= 30; index++) {
    const t = index / 30;
    seamPoints.push(new THREE.Vector3(
      0,
      smoothMix(left.waistY - 0.012, left.crotchY - 0.02, t),
      0.118 + Math.sin(t * Math.PI) * 0.035
    ));
  }
  group.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(seamPoints),
    new THREE.LineBasicMaterial({ color: 0x4a3d30 })
  ));

  return {
    waist: BASE.waistCircumference + parameters.waistEaseMm,
    hip: BASE.hipCircumference + parameters.hipEaseMm,
    length: parameters.shortsLengthMm
  };
}
