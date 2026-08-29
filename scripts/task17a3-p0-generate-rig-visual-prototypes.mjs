import { deflateSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  P0_CANVAS,
  P0_VIEW_SPECS,
  createControlStudioPrototype,
  createHybridProductionPrototype,
  createOctaTechPrototype,
  projectPrimitivesForRaster,
  renderRigSvg,
} from '../src/modules/human-core-v5/production-rig-visual-prototypes-p0/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(root, 'artifacts', 'qa', 'task17a3-p0-rig-visual-direction');
const prototypes = [createOctaTechPrototype(), createHybridProductionPrototype(), createControlStudioPrototype()];
const viewEntries = Object.entries(P0_VIEW_SPECS);
const generated = [];

await mkdir(outputRoot, { recursive: true });
for (const prototype of prototypes) {
  const directory = path.join(outputRoot, prototype.candidate.directory);
  await mkdir(directory, { recursive: true });
  for (const [viewName, viewSpec] of viewEntries) {
    const svg = renderRigSvg({
      ...prototype,
      viewSpec,
      canvas: P0_CANVAS,
      title: `${prototype.candidate.name} — ${viewName}`,
    });
    await emit(path.join(directory, `${viewName}.svg`), svg);
  }
  await emit(path.join(directory, 'shoulder-closeup.svg'), renderRigSvg({
    ...prototype,
    viewSpec: P0_VIEW_SPECS['three-quarter'],
    canvas: P0_CANVAS,
    title: `${prototype.candidate.name} — shoulder close-up`,
    detailName: 'shoulder-closeup',
    viewport: { worldCenter: [0.23, 1.35, 0], orthographicWidthMeters: 0.64, orthographicHeightMeters: 0.64 },
  }));
  await emit(path.join(directory, 'pelvis-closeup.svg'), renderRigSvg({
    ...prototype,
    viewSpec: P0_VIEW_SPECS['three-quarter'],
    canvas: P0_CANVAS,
    title: `${prototype.candidate.name} — pelvis close-up`,
    detailName: 'pelvis-closeup',
    viewport: { worldCenter: [0, 0.91, 0], orthographicWidthMeters: 0.62, orthographicHeightMeters: 0.58 },
  }));
  const handSvg = renderRigSvg({
    ...prototype,
    viewSpec: P0_VIEW_SPECS['three-quarter'],
    canvas: P0_CANVAS,
    title: `${prototype.candidate.name} — hand detail`,
    detailName: 'hand-detail',
    viewport: { worldCenter: [0.73, 1.328, -0.005], orthographicWidthMeters: 0.38, orthographicHeightMeters: 0.34 },
  });
  const footSvg = renderRigSvg({
    ...prototype,
    viewSpec: P0_VIEW_SPECS['three-quarter'],
    canvas: P0_CANVAS,
    title: `${prototype.candidate.name} — foot detail`,
    detailName: 'foot-detail',
    viewport: { worldCenter: [0.16, 0.09, -0.08], orthographicWidthMeters: 0.42, orthographicHeightMeters: 0.36 },
  });
  await emit(path.join(directory, 'hand-foot-closeup.svg'), combineDetailsSvg(prototype, handSvg, footSvg));
}

const referenceDistillation = {
  schema: 'humanoid_rig/task17a3_p0_reference_distillation@1',
  task: 'Task 17A.3 RESET P0 Production Rig Visual Direction Study',
  researchLanguage: 'English',
  researchPolicy: 'Official publisher documentation and internal project specifications only.',
  sources: [
    source('BLENDER_ARMATURE_DISPLAY', 'Blender Foundation', 'Armature viewport display and Octahedral bones', 'https://docs.blender.org/manual/en/latest/animation/armatures/properties/display.html', 'Root, tip, envelope size and roll should remain legible in a compact diagnostic bone.', 'Use a square-section octahedral body with explicit root and tip endpoints in Candidate A.', 'Do not copy Blender mesh data, icons, UI chrome, or viewport styling.'),
    source('BLENDER_CUSTOM_SHAPES', 'Blender Foundation', 'Custom bone shapes', 'https://docs.blender.org/manual/en/latest/animation/armatures/bones/properties/display.html', 'Animator controls benefit from shapes distinct from deform bones.', 'Use a separate magenta control vocabulary in Candidate C.', 'Do not reproduce Blender widgets or theme assets.'),
    source('BLENDER_RIGIFY_META_RIGS', 'Blender Foundation', 'Rigify meta-rigs', 'https://docs.blender.org/manual/en/latest/addons/rigging/rigify/metarigs.html', 'A light structural rig can describe intent before a generated production rig exists.', 'Keep Candidate C as a static direction study rather than a generated functional rig.', 'Do not reproduce Rigify algorithms, source code, naming, or assets.'),
    source('EPIC_CONTROLS_BONES_NULLS', 'Epic Games', 'Controls, bones and nulls in Control Rig', 'https://dev.epicgames.com/documentation/en-us/unreal-engine/controls-bones-and-nulls-in-control-rig-in-unreal-engine', 'Controls and hierarchy elements need visually distinct responsibilities.', 'Separate core bones, selection controls and aim/pole indicators in Candidate C.', 'Do not copy Control Rig node logic, gizmos, UI, or code.'),
    source('EPIC_MODULAR_CONTROL_RIG', 'Epic Games', 'Modular Control Rig connectors and sockets', 'https://dev.epicgames.com/documentation/en-us/unreal-engine/modular-control-rigs-in-unreal-engine', 'Modular intent becomes clearer when connection regions are explicit.', 'Express pelvis, chest, hands and feet as readable regions without adding functional connectors.', 'Do not copy modules, connector implementations, samples, or assets.'),
    source('EPIC_FULL_BODY_IK', 'Epic Games', 'Full Body IK controls and effectors', 'https://dev.epicgames.com/documentation/en-us/unreal-engine/control-rig-full-body-ik-in-unreal-engine', 'Effectors and pole intent should remain visually separate from skeletal links.', 'Use static hand/foot control outlines and elbow/knee pole diamonds only in Candidate C.', 'Do not implement FBIK, solvers, constraints, effectors, or Epic code.'),
    source('UNITY_AVATAR_CONFIGURATION', 'Unity Technologies', 'Humanoid Avatar configuration and bone mapping', 'https://docs.unity3d.com/Manual/ConfiguringtheAvatar.html', 'A humanoid overview benefits from an immediately recognizable body map and unambiguous required regions.', 'Keep the same 20-joint map in all three candidates and make Candidate B recognizably human.', 'Do not copy Unity avatar UI, silhouettes, bone mapping logic, or assets.'),
    source('VRM_1_HUMANOID', 'VRM Consortium', 'VRM 1.0 Humanoid', 'https://vrm.dev/en/vrm1/humanoid/', 'Interoperability starts from stable humanoid roles rather than display-specific geometry.', 'Preserve project joint IDs and parent relationships across every candidate.', 'Do not import VRM models, schemas, source code, or sample assets.'),
    source('OPENXR_HAND_JOINTS', 'Khronos Group', 'OpenXR hand-tracking joint semantics', 'https://registry.khronos.org/OpenXR/specs/1.1/man/html/XrHandJointEXT.html', 'Hand semantics distinguish wrist/palm and directional digit chains.', 'Candidate B uses a palm plate and parallel digit hints without claiming a full tracked-hand skeleton.', 'Do not reproduce OpenXR runtime code, conformance data, or external hand assets.'),
    source('INTERNAL_MASTER_CONTEXT', 'Humanoid Rig Lab Next', 'Humanoid architecture and pose authority', 'HUMANOID_RIG_LAB_NEXT_MASTER_CONTEXT.md', 'Shared rig data, fixed hierarchy, segment lengths and one pose authority prevent divergent windows.', 'Freeze a Reference T snapshot sourced from HumanRigCore while keeping the prototypes fully disconnected from finalPose.', 'Reject any runtime binding, bone scaling, alternate hierarchy, or modification of HumanRigCore.'),
    source('INTERNAL_PROJECT_SPEC', 'Humanoid Rig Lab Next', 'Character project and world-human system direction', 'docs/PROJECT_SPEC_FULL.md', 'One shared humanoid foundation should support character authoring, animation and multiple humans without visual drift.', 'Compare observation-first, crowd-first and editor-first display directions against the same body input.', 'Reject a new runtime page, NPC system, motion stack, mode switcher or behavior implementation.'),
    source('INTERNAL_PERFORMANCE_ARCHITECTURE', 'Humanoid Rig Lab Next', 'Performance rig architecture', 'docs/PERFORMANCE_RIG_ARCHITECTURE.md', 'Core, production and performance concerns should remain explicit layers.', 'Limit P0 to display geometry and record its future suitability without implementing a performance layer.', 'Reject performance deform, skin weights, anchors, limits, controllers and motion logic.'),
  ],
};

const visualComparison = {
  schema: 'humanoid_rig/task17a3_p0_visual_comparison@1',
  scope: 'Design observation only; no candidate is user-accepted by this file.',
  allowedValues: ['candidate-a', 'candidate-b', 'candidate-c', 'equal', 'all-weak', 'user-decision-required'],
  observations: [
    comparison('overall-human-readability', 'candidate-b', 'Open thorax, bilateral pelvis, limb rails, palm and foot regions form the strongest human silhouette.'),
    comparison('root-tip-hierarchy', 'candidate-a', 'Every Core segment has exact endpoints and a consistent octahedral direction.'),
    comparison('roll-readability', 'candidate-a', 'Square octahedral sections and warm roll marks expose orientation most directly.'),
    comparison('joint-center-readability', 'candidate-a', 'Small bright joint centers remain clean against the low primitive count.'),
    comparison('head-direction-readability', 'candidate-c', 'Head cube plus independent gaze target creates the clearest static facing intent.'),
    comparison('thorax-structure', 'candidate-b', 'Open rib bands communicate upper-body volume without a closed torso shell.'),
    comparison('pelvis-structure', 'candidate-b', 'Bilateral arcs, transverse ring and center bridge expose load transfer.'),
    comparison('shoulder-girdle', 'candidate-b', 'Clavicle arcs and scapula plates distinguish shoulder movement regions.'),
    comparison('upper-limb-anatomical-readability', 'candidate-b', 'Waisted upper arm and dual forearm rails provide human-readable segmentation.'),
    comparison('lower-limb-anatomical-readability', 'candidate-b', 'Waisted thigh, paired lower-leg rails and structured foot give the clearest leg chain.'),
    comparison('hand-region', 'candidate-b', 'Palm plate and digit direction hints communicate hand extent without labels.'),
    comparison('foot-contact-region', 'candidate-b', 'Heel, arch, forefoot and toe direction are visible as separate cues.'),
    comparison('control-intent', 'candidate-c', 'Magenta rings, boxes, squares and diamonds are distinct from cyan bones.'),
    comparison('future-ik-editor-affinity', 'candidate-c', 'Hand/foot outlines and pole diamonds provide a direct static vocabulary for a future editor.'),
    comparison('salute-observation', 'candidate-b', 'Shoulder, dual forearm and palm regions make the gesture path easiest to inspect.'),
    comparison('jump-observation', 'candidate-b', 'Pelvis bridge and detailed lower limbs make compression and extension regions easiest to inspect.'),
    comparison('carry-observation', 'candidate-b', 'Open thorax, shoulder girdle and palms make load-bearing posture easiest to reason about.'),
    comparison('large-npc-count-cost', 'candidate-a', 'The primitive count and overlay density are lowest.'),
    comparison('same-input-integrity', 'equal', 'All candidates use the identical frozen 20-joint, 19-segment Reference T snapshot and projector.'),
    comparison('final-visual-direction', 'user-decision-required', 'The contact sheet is evidence for selection; this study deliberately does not choose or accept a winner.'),
  ],
};

async function emit(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
  generated.push(filePath);
}

function source(sourceId, publisher, referenceTopic, url, usefulPrinciple, adoptedPrinciple, rejectedPrinciple) {
  return { sourceId, publisher, referenceTopic, url, usefulPrinciple, adoptedPrinciple, rejectedPrinciple, geometryCopied: false, sourceCodeCopied: false, externalAssetUsed: false };
}

function comparison(item, value, observation) { return { item, value, observation }; }

function combineDetailsSvg(prototype, handSvg, footSvg) {
  const handData = Buffer.from(handSvg).toString('base64');
  const footData = Buffer.from(footSvg).toString('base64');
  const metadata = escapeXml(JSON.stringify({ candidateId: prototype.candidate.id, detailName: 'hand-foot-closeup', staticPrototype: true }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100" role="img" aria-labelledby="title desc">\n<title id="title">${escapeXml(prototype.candidate.name)} — hand and foot close-up</title>\n<desc id="desc">Two static close-up projections using the same frozen candidate geometry.</desc>\n<metadata>${metadata}</metadata>\n<rect width="900" height="1100" fill="#071018"/>\n<image x="0" y="0" width="900" height="540" href="data:image/svg+xml;base64,${handData}"/>\n<image x="0" y="560" width="900" height="540" href="data:image/svg+xml;base64,${footData}"/>\n<path d="M70 550H830" stroke="#29404c" stroke-width="2"/>\n</svg>\n`;
}

async function createContactSheetSvg() {
  const width = 1800;
  const height = 2100;
  const top = 96;
  const rowHeight = 355;
  const colWidth = width / 3;
  const imageWidth = 290;
  const imageHeight = 330;
  const parts = [`<?xml version="1.0" encoding="UTF-8"?>`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`, '<title id="title">Task 17A.3 P0 Production Rig Visual Direction Contact Sheet</title>', '<desc id="desc">Three candidate columns and four identical-view rows. No candidate is selected by this artifact.</desc>', '<rect width="100%" height="100%" fill="#071018"/>'];
  parts.push('<text x="40" y="52" fill="#eef8f5" font-family="Arial,sans-serif" font-size="25" font-weight="700">TASK 17A.3 P0 · STATIC PRODUCTION RIG VISUAL DIRECTIONS</text>');
  parts.push('<text x="1760" y="52" text-anchor="end" fill="#f0bb52" font-family="Arial,sans-serif" font-size="15">SAME REFERENCE T · 20 JOINTS · 19 SEGMENTS · USER SELECTION REQUIRED</text>');
  for (let col = 0; col < prototypes.length; col += 1) {
    const prototype = prototypes[col];
    const x = col * colWidth;
    parts.push(`<rect x="${x + 10}" y="68" width="${colWidth - 20}" height="42" rx="8" fill="#102633" stroke="#294b58"/>`);
    parts.push(`<text x="${x + colWidth / 2}" y="96" text-anchor="middle" fill="${col === 2 ? '#de78d6' : col === 1 ? '#69d3ae' : '#93d8ef'}" font-family="Arial,sans-serif" font-size="18" font-weight="700">${escapeXml(prototype.candidate.id)} · ${escapeXml(prototype.candidate.name)}</text>`);
    for (let row = 0; row < viewEntries.length; row += 1) {
      const [viewName, viewSpec] = viewEntries[row];
      const svg = renderRigSvg({ ...prototype, viewSpec, canvas: P0_CANVAS, title: `${prototype.candidate.name} ${viewName}` });
      const data = Buffer.from(svg).toString('base64');
      const cellY = top + row * rowHeight;
      parts.push(`<rect x="${x + 10}" y="${cellY + 15}" width="${colWidth - 20}" height="${rowHeight - 12}" fill="#09141c" stroke="#1e3945"/>`);
      parts.push(`<image x="${x + (colWidth - imageWidth) / 2}" y="${cellY + 18}" width="${imageWidth}" height="${imageHeight}" href="data:image/svg+xml;base64,${data}"/>`);
      if (col === 0) parts.push(`<text x="24" y="${cellY + 42}" fill="#f0bb52" font-family="Arial,sans-serif" font-size="14" font-weight="700">${viewName.toUpperCase()}</text>`);
    }
  }
  const infoY = top + viewEntries.length * rowHeight + 32;
  for (let col = 0; col < prototypes.length; col += 1) {
    const { candidate } = prototypes[col];
    const x = col * colWidth + 30;
    const boxWidth = colWidth - 60;
    parts.push(`<rect x="${x}" y="${infoY}" width="${boxWidth}" height="520" rx="12" fill="#0c1c26" stroke="#294b58"/>`);
    const rows = [
      ['GOAL', candidate.goal],
      ['PROS', candidate.strengths.join(' · ')],
      ['CONS', candidate.weaknesses.join(' · ')],
      ['COST', candidate.estimatedCost],
      ['SUITABLE', candidate.suitable],
      ['UNSUITABLE', candidate.unsuitable],
    ];
    let y = infoY + 38;
    for (const [label, text] of rows) {
      parts.push(`<text x="${x + 20}" y="${y}" fill="#f0bb52" font-family="Arial,sans-serif" font-size="13" font-weight="700">${label}</text>`);
      const lines = wrapWords(text, 54);
      for (let index = 0; index < lines.length; index += 1) {
        parts.push(`<text x="${x + 20}" y="${y + 23 + index * 18}" fill="#dce9e7" font-family="Arial,sans-serif" font-size="13">${escapeXml(lines[index])}</text>`);
      }
      y += 39 + lines.length * 18;
    }
  }
  parts.push(`<text x="900" y="2070" text-anchor="middle" fill="#f0bb52" font-family="Arial,sans-serif" font-size="16" font-weight="700">DESIGN STUDY ONLY · NO RUNTIME · NO EXTERNAL ASSETS · FINAL DIRECTION REQUIRES USER ACCEPTANCE</text>`);
  parts.push('</svg>');
  return `${parts.join('\n')}\n`;
}

function createContactSheetPng() {
  const width = 1500;
  const height = 1840;
  const raster = new Raster(width, height, '#071018');
  drawText(raster, 30, 22, 'TASK 17A.3 P0  STATIC PRODUCTION RIG VISUAL DIRECTIONS', '#eef8f5', 3);
  drawText(raster, 30, 52, 'SAME REFERENCE T  20 JOINTS  19 SEGMENTS  USER SELECTION REQUIRED', '#f0bb52', 2);
  const colWidth = 500;
  const top = 92;
  const rowHeight = 275;
  const sceneScale = 0.235;
  for (let col = 0; col < prototypes.length; col += 1) {
    const prototype = prototypes[col];
    const x = col * colWidth;
    raster.fillRect(x + 8, 76, colWidth - 16, 34, '#102633');
    drawText(raster, x + 20, 87, `${prototype.candidate.id} ${prototype.candidate.name}`, col === 2 ? '#de78d6' : col === 1 ? '#69d3ae' : '#93d8ef', 2);
    for (let row = 0; row < viewEntries.length; row += 1) {
      const [viewName, viewSpec] = viewEntries[row];
      const cellY = top + row * rowHeight;
      raster.fillRect(x + 8, cellY + 22, colWidth - 16, rowHeight - 8, '#09141c');
      raster.strokeRect(x + 8, cellY + 22, colWidth - 16, rowHeight - 8, '#1e3945', 1);
      drawText(raster, x + 18, cellY + 30, viewName, '#f0bb52', 2);
      drawRasterScene(raster, prototype, viewSpec, x + (colWidth - P0_CANVAS.width * sceneScale) / 2, cellY + 25, sceneScale);
    }
  }
  const infoY = top + viewEntries.length * rowHeight + 30;
  for (let col = 0; col < prototypes.length; col += 1) {
    const candidate = prototypes[col].candidate;
    const x = col * colWidth + 18;
    raster.fillRect(x, infoY, colWidth - 36, 560, '#0c1c26');
    raster.strokeRect(x, infoY, colWidth - 36, 560, '#294b58', 2);
    const rows = [
      ['GOAL', candidate.goal], ['PROS', candidate.strengths.join(' / ')], ['CONS', candidate.weaknesses.join(' / ')],
      ['COST', candidate.estimatedCost], ['SUITABLE', candidate.suitable], ['UNSUITABLE', candidate.unsuitable],
    ];
    let y = infoY + 20;
    for (const [label, value] of rows) {
      drawText(raster, x + 14, y, label, '#f0bb52', 2);
      y += 20;
      for (const line of wrapWords(value.toUpperCase(), 43)) {
        drawText(raster, x + 14, y, line, '#dce9e7', 1);
        y += 11;
      }
      y += 14;
    }
  }
  drawText(raster, 30, 1815, 'DESIGN STUDY ONLY  NO RUNTIME  NO EXTERNAL ASSETS  USER ACCEPTANCE REQUIRED', '#f0bb52', 2);
  return encodePng(raster);
}

function drawRasterScene(raster, prototype, viewSpec, originX, originY, scale) {
  const drawables = projectPrimitivesForRaster(prototype.primitives, viewSpec, P0_CANVAS);
  const mapPoint = (point) => ({ x: originX + point.x * scale, y: originY + point.y * scale });
  for (const drawable of drawables) {
    if (drawable.kind === 'polygon') {
      raster.fillPolygon(drawable.points2d.map(mapPoint), drawable.fill, drawable.opacity);
      raster.strokePolyline(drawable.points2d.map(mapPoint), drawable.stroke, Math.max(1, drawable.strokeWidth * scale), true, drawable.opacity);
    } else if (drawable.kind === 'line') {
      raster.strokePolyline(drawable.points2d.map(mapPoint), drawable.stroke || '#dce9e7', Math.max(1, (drawable.strokeWidth || 1.5) * scale), drawable.closed, drawable.opacity ?? 1);
    } else if (drawable.kind === 'joint') {
      const point = mapPoint(drawable.point2d);
      raster.fillCircle(point.x, point.y, Math.max(1, drawable.radius2d * scale), drawable.fill || '#eef8f5', drawable.opacity ?? 1);
    }
  }
}

class Raster {
  constructor(width, height, background) {
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
    const a = Math.max(0, Math.min(1, alpha));
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
  strokePolyline(points, color, width = 1, closed = false, alpha = 1) {
    for (let index = 0; index < points.length - 1; index += 1) this.line(points[index], points[index + 1], color, width, alpha);
    if (closed && points.length > 2) this.line(points.at(-1), points[0], color, width, alpha);
  }
  line(a, b, color, width, alpha) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      this.fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, Math.max(0.55, width * 0.5), color, alpha);
    }
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
}

const FONT = Object.freeze({
  A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],C:['01111','10000','10000','10000','10000','10000','01111'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],F:['11111','10000','10000','11110','10000','10000','10000'],G:['01111','10000','10000','10111','10001','10001','01111'],H:['10001','10001','10001','11111','10001','10001','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],J:['00111','00010','00010','00010','10010','10010','01100'],K:['10001','10010','10100','11000','10100','10010','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],P:['11110','10001','10001','11110','10000','10000','10000'],Q:['01110','10001','10001','10001','10101','10010','01101'],R:['11110','10001','10001','11110','10100','10010','10001'],S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],W:['10001','10001','10001','10101','10101','10101','01010'],X:['10001','10001','01010','00100','01010','10001','10001'],Y:['10001','10001','01010','00100','00100','00100','00100'],Z:['11111','00001','00010','00100','01000','10000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],'1':['00100','01100','00100','00100','00100','00100','01110'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],'4':['00010','00110','01010','10010','11111','00010','00010'],'5':['11111','10000','10000','11110','00001','00001','11110'],'6':['01110','10000','10000','11110','10001','10001','01110'],'7':['11111','00001','00010','00100','01000','01000','01000'],'8':['01110','10001','10001','01110','10001','10001','01110'],'9':['01110','10001','10001','01111','00001','00001','01110'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],'-':['00000','00000','00000','11111','00000','00000','00000'],'/':['00001','00010','00010','00100','01000','01000','10000'],':':['00000','00110','00110','00000','00110','00110','00000'],' ':['00000','00000','00000','00000','00000','00000','00000'],
});

function drawText(raster, x, y, text, color, scale = 1) {
  let cursor = x;
  for (const character of text.toUpperCase()) {
    const glyph = FONT[character] || FONT[' '];
    for (let row = 0; row < 7; row += 1) for (let col = 0; col < 5; col += 1) if (glyph[row][col] === '1') raster.fillRect(cursor + col * scale, y + row * scale, scale, scale, color);
    cursor += 6 * scale;
  }
}

function encodePng(raster) {
  const raw = Buffer.alloc((raster.width * 4 + 1) * raster.height);
  for (let y = 0; y < raster.height; y += 1) {
    const rowStart = y * (raster.width * 4 + 1);
    raw[rowStart] = 0;
    raster.data.copy(raw, rowStart + 1, y * raster.width * 4, (y + 1) * raster.width * 4);
  }
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(raster.width, 0); header.writeUInt32BE(raster.height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([signature, pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0); typeBuffer.copy(chunk, 4); data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseColor(value) {
  const hex = (value || '#ffffff').replace('#', '');
  if (hex.length !== 6) return [255, 255, 255];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

function wrapWords(text, maxLength) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxLength) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

await emit(path.join(outputRoot, 'reference-distillation.json'), `${JSON.stringify(referenceDistillation, null, 2)}\n`);
await emit(path.join(outputRoot, 'visual-comparison.json'), `${JSON.stringify(visualComparison, null, 2)}\n`);
await emit(path.join(outputRoot, 'contact-sheet.svg'), await createContactSheetSvg());
await emit(path.join(outputRoot, 'contact-sheet.png'), createContactSheetPng());

const manifest = {
  schema: 'humanoid_rig/task17a3_p0_generation_manifest@1',
  generatedAt: 'deterministic-no-timestamp',
  sourceCommit: prototypes[0].snapshot.source.baselineCommit,
  coreRigFingerprint: prototypes[0].snapshot.source.coreRigFingerprint,
  staticOnly: true,
  generatedFileCount: generated.length + 1,
  generatedFiles: [...generated.map((item) => path.relative(root, item).replaceAll('\\', '/')), 'artifacts/qa/task17a3-p0-rig-visual-direction/generation-manifest.json'],
};
await writeFile(path.join(outputRoot, 'generation-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

await validateGeneratedEvidence(manifest);
console.log(JSON.stringify({ outputRoot, generatedFiles: manifest.generatedFileCount, candidates: prototypes.map((item) => item.candidate.id), views: viewEntries.map(([name]) => name) }, null, 2));

async function validateGeneratedEvidence(manifestValue) {
  if (manifestValue.generatedFileCount !== 26 || generated.length !== 25) throw new Error('Unexpected generated evidence count.');
  const svgFiles = generated.filter((file) => file.endsWith('.svg'));
  if (svgFiles.length !== 22) throw new Error(`Expected 22 SVG files, found ${svgFiles.length}.`);
  for (const file of svgFiles) {
    const contents = await readFile(file, 'utf8');
    if (!contents.startsWith('<?xml') || !contents.includes('<svg ') || !contents.trimEnd().endsWith('</svg>')) throw new Error(`Malformed SVG wrapper: ${file}`);
    if (/<script\b|<foreignObject\b|\b(?:src|href)="https?:/i.test(contents)) throw new Error(`Non-static SVG dependency found: ${file}`);
    if (/\b(?:fetch|node_modules|loading)\b/i.test(contents)) throw new Error(`Forbidden loading dependency text found: ${file}`);
  }
  if (referenceDistillation.sources.some((item) => item.geometryCopied || item.sourceCodeCopied || item.externalAssetUsed)) throw new Error('Reference distillation must reject all copied geometry, code, and external assets.');
  if (visualComparison.observations.length !== 20) throw new Error('Visual comparison must contain exactly 20 observations.');
  if (visualComparison.observations.some((item) => !visualComparison.allowedValues.includes(item.value))) throw new Error('Visual comparison contains an invalid value.');
  for (const prototype of prototypes) {
    if (prototype.snapshot.jointCount !== 20 || prototype.snapshot.segmentCount !== 19) throw new Error(`Common input count mismatch: ${prototype.candidate.id}`);
    if (JSON.stringify(prototype.snapshot) !== JSON.stringify(prototypes[0].snapshot)) throw new Error(`Common input drift: ${prototype.candidate.id}`);
  }
  const png = await readFile(path.join(outputRoot, 'contact-sheet.png'));
  if (!png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('Contact sheet PNG signature is invalid.');
  if (png.readUInt32BE(16) !== 1500 || png.readUInt32BE(20) !== 1840) throw new Error('Contact sheet PNG dimensions are invalid.');
}
