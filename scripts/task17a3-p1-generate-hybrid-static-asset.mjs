import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HYBRID_STATIC_MATERIALS,
  P0_VIEW_SPECS,
  Raster,
  createHybridStaticAssetSource,
  drawText,
  encodeHybridStaticGlb,
  encodePng,
  inspectGlb,
  renderStaticAssetRaster,
  renderStaticAssetSvg,
} from '../src/modules/human-core-v5/production-skeleton-p1-hybrid-static/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(root, 'assets', 'human', 'production-skeleton-v2', 'hybrid-static-v1');
const artifactRoot = path.join(root, 'artifacts', 'qa', 'task17a3-p1-hybrid-static');
const reviewPath = path.join(root, 'production-skeleton-p1-static-review.html');
const generated = [];

await mkdir(assetRoot, { recursive: true });
await mkdir(artifactRoot, { recursive: true });

const source = createHybridStaticAssetSource();
const moduleProfile = createModuleProfile(source);
const materialProfile = createMaterialProfile();
const geometryGate = measureGeometryGate(source);
const visualReview = createVisualReviewStatus();
const encoded = encodeHybridStaticGlb(source, HYBRID_STATIC_MATERIALS);
const glbInspection = inspectGlb(encoded.glb);

const sourcePath = path.join(assetRoot, 'skeleton-source.json');
const moduleProfilePath = path.join(assetRoot, 'module-profile.json');
const materialProfilePath = path.join(assetRoot, 'material-profile.json');
const glbPath = path.join(assetRoot, 'hybrid-production-skeleton-static-v1.glb');

await emitJson(sourcePath, source);
await emitJson(moduleProfilePath, moduleProfile);
await emitJson(materialProfilePath, materialProfile);
await emit(glbPath, encoded.glb);

const receipt = {
  schema: 'humanoid_rig/hybrid_static_asset_receipt@1.1',
  assetId: source.assetId,
  sourceStartCommit: '28c12417b171f53de94dd2e41bd2febc411e6e60',
  refinementRevision: source.refinementRevision,
  userReviewBaseline: source.userReviewBaseline,
  refinedModules: ['head', 'neck', 'thorax', 'pelvis', 'leftClavicle', 'rightClavicle', 'leftScapula', 'rightScapula', 'leftHand', 'rightHand', 'leftFoot', 'rightFoot'],
  humanRigCoreReferenceCommit: source.sourceCommit,
  coreRigFingerprint: source.coreRigFingerprint,
  pose: source.pose,
  displayCacheOnly: true,
  authoritativeForPose: false,
  connectsDynamicFinalPose: false,
  externalGeometryUsed: false,
  externalAssetUsed: false,
  externalSourceCodeCopied: false,
  projectOwnedGeometry: true,
  glb: {
    path: relative(glbPath),
    sha256: sha256(encoded.glb),
    byteSize: encoded.glb.length,
    ...encoded.stats,
    glbVersion: glbInspection.json.asset.version,
    embeddedBufferCount: glbInspection.json.buffers.length,
    externalUriCount: countExternalUris(glbInspection.json),
  },
  sourceFiles: await Promise.all([sourcePath, moduleProfilePath, materialProfilePath].map(async (file) => ({ path: relative(file), sha256: sha256(await readFile(file)) }))),
  geometryGate,
  visualReviewStatus: visualReview.summary,
};
await emitJson(path.join(assetRoot, 'asset-receipt.json'), receipt);

const fullViews = new Map();
const fullRasters = new Map();
for (const [viewName, viewSpec] of Object.entries(P0_VIEW_SPECS)) {
  const svg = renderStaticAssetSvg({ source, materials: HYBRID_STATIC_MATERIALS, viewSpec, title: `HRL Hybrid Production Skeleton Static V1 — ${viewName}` });
  const raster = renderStaticAssetRaster({ source, materials: HYBRID_STATIC_MATERIALS, viewSpec });
  fullViews.set(viewName, svg);
  fullRasters.set(viewName, raster);
  await emit(path.join(artifactRoot, `${viewName}.svg`), svg);
  await emit(path.join(artifactRoot, `${viewName}.png`), encodePng(raster));
}

const closeupSvgs = new Map();
const closeupRasters = new Map();
for (const spec of closeupSpecs()) {
  const viewSpec = P0_VIEW_SPECS[spec.view];
  const svg = renderStaticAssetSvg({ source, materials: HYBRID_STATIC_MATERIALS, viewSpec, title: `HRL Hybrid Production Skeleton Static V1 — ${spec.name}`, detailName: spec.name, viewport: spec.viewport });
  const raster = renderStaticAssetRaster({ source, materials: HYBRID_STATIC_MATERIALS, viewSpec, detailName: spec.name, viewport: spec.viewport });
  closeupSvgs.set(spec.name, svg);
  closeupRasters.set(spec.name, raster);
  await emit(path.join(artifactRoot, `${spec.name}.png`), encodePng(raster));
}

await emit(path.join(artifactRoot, 'contact-sheet.png'), encodePng(createContactSheet(fullRasters, closeupRasters, encoded.stats)));
await emitJson(path.join(artifactRoot, 'geometry-gate.json'), geometryGate);
await emitJson(path.join(artifactRoot, 'visual-review-status.json'), visualReview);
await emit(reviewPath, createReviewHtml(fullViews, closeupSvgs, receipt, visualReview));

const manifest = {
  schema: 'humanoid_rig/task17a3_p1_1_static_refinement_manifest@1',
  deterministic: true,
  generatedAt: 'deterministic-no-timestamp',
  sourceStartCommit: receipt.sourceStartCommit,
  generatedFileCount: generated.length + 1,
  generatedFiles: [...generated.map(relative), relative(path.join(artifactRoot, 'generation-manifest.json'))],
};
await emitJson(path.join(artifactRoot, 'generation-manifest.json'), manifest, false);

await validateOutputs(receipt, geometryGate, visualReview, manifest);
console.log(JSON.stringify({ assetRoot, artifactRoot, reviewPath, glb: receipt.glb, geometryGate: geometryGate.observed, visualReview: visualReview.summary, generatedFileCount: manifest.generatedFileCount }, null, 2));

async function emit(filePath, data, track = true) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  if (track) generated.push(filePath);
}

async function emitJson(filePath, value, track = true) { await emit(filePath, `${JSON.stringify(value, null, 2)}\n`, track); }

function createModuleProfile(assetSource) {
  const descriptions = {
    head: ['ellipsoid cranium', 'jaw wedge', 'neck-root connector', 'gaze direction frame'],
    neck: ['dual waisted neck links', 'neck-root interface'],
    thorax: ['upper thorax arch', 'lower thorax arch', 'side depth returns', 'sternum bridge', 'back beam', 'bilateral shoulder sockets'],
    pelvis: ['left iliac wing', 'right iliac wing', 'central sacrum bridge', 'bilateral hip sockets', 'forward marker'],
    leftClavicle: ['left clavicle arc', 'left shoulder joint ball'], rightClavicle: ['right clavicle arc', 'right shoulder joint ball'],
    leftScapula: ['left back-facing scapula plate', 'left proximal upper-arm interface'], rightScapula: ['right back-facing scapula plate', 'right proximal upper-arm interface'],
    leftUpperArm: ['proximal widening', 'waisted shaft', 'distal widening'], rightUpperArm: ['proximal widening', 'waisted shaft', 'distal widening'],
    leftForearmRadius: ['front/side-readable radius rail'], leftForearmUlna: ['front/side-readable ulna rail'], rightForearmRadius: ['front/side-readable radius rail'], rightForearmUlna: ['front/side-readable ulna rail'],
    leftHand: ['wrist interface', 'palm plate', 'thumb side', 'grasp center', 'palm normal'], rightHand: ['wrist interface', 'palm plate', 'thumb side', 'grasp center', 'palm normal'],
    leftThigh: ['proximal widening', 'waisted shaft', 'distal widening'], rightThigh: ['proximal widening', 'waisted shaft', 'distal widening'],
    leftTibia: ['front/side-readable tibia rail'], leftFibula: ['front/side-readable fibula rail'], rightTibia: ['front/side-readable tibia rail'], rightFibula: ['front/side-readable fibula rail'],
    leftFoot: ['heel', 'arch', 'forefoot', 'toe', 'sole plane', 'forward marker'], rightFoot: ['heel', 'arch', 'forefoot', 'toe', 'sole plane', 'forward marker'],
  };
  return {
    schema: 'humanoid_rig/hybrid_static_module_profile@1',
    assetId: assetSource.assetId,
    refinementRevision: assetSource.refinementRevision,
    moduleCount: assetSource.modules.length,
    fixedVertexAndIndexData: true,
    disconnectedModulesAllowed: true,
    modules: assetSource.modules.map((module) => ({ moduleId: module.moduleId, anchorJointIds: module.anchorJointIds, features: descriptions[module.moduleId], partCount: module.parts.length, vertexCount: module.parts.reduce((sum, item) => sum + item.positions.length, 0), triangleCount: module.parts.reduce((sum, item) => sum + item.indices.length, 0) })),
  };
}

function createMaterialProfile() {
  return {
    schema: 'humanoid_rig/hybrid_static_material_profile@1',
    colorSpace: 'linear-sRGB factors for glTF PBR base color',
    materialCount: HYBRID_STATIC_MATERIALS.length,
    lightingPolicy: 'Preview-only deterministic face shading; no textures, images, environment maps, or external assets.',
    materials: HYBRID_STATIC_MATERIALS,
  };
}

function measureGeometryGate(assetSource) {
  const baseline = createHybridStaticAssetSource();
  const baselineJoint = new Map(baseline.joints.map((item) => [item.id, item]));
  const baselineSegment = new Map(baseline.segments.map((item) => [item.id, item]));
  let maximumJointCenterError = 0;
  let maximumSegmentLengthError = 0;
  let nonFiniteVertexCount = 0;
  let nonFiniteNormalCount = 0;
  let degenerateTriangleCount = 0;
  let duplicateTriangleCount = 0;
  for (const item of assetSource.joints) maximumJointCenterError = Math.max(maximumJointCenterError, distance(item.worldPosition, baselineJoint.get(item.id).worldPosition));
  for (const item of assetSource.segments) maximumSegmentLengthError = Math.max(maximumSegmentLengthError, Math.abs(item.length - baselineSegment.get(item.id).length));
  for (const module of assetSource.modules) {
    for (const part of module.parts) {
      nonFiniteVertexCount += part.positions.flat().filter((value) => !Number.isFinite(value)).length;
      nonFiniteNormalCount += part.normals.flat().filter((value) => !Number.isFinite(value)).length;
      const seen = new Set();
      for (const triangle of part.indices) {
        const [a, b, c] = triangle.map((index) => part.positions[index]);
        if (triangleAreaTwice(a, b, c) <= 1e-12) degenerateTriangleCount += 1;
        const key = [...triangle].sort((left, right) => left - right).join(',');
        if (seen.has(key)) duplicateTriangleCount += 1;
        seen.add(key);
      }
    }
  }
  const moduleIdUnique = new Set(assetSource.modules.map((item) => item.moduleId)).size === assetSource.modules.length;
  const thresholds = { maximumJointCenterError: 1e-7, maximumSegmentLengthError: 1e-8, nonFiniteVertexCount: 0, nonFiniteNormalCount: 0, degenerateTriangleCount: 0, duplicateTriangleCount: 0, moduleIdUnique: true };
  const observed = { maximumJointCenterError, maximumSegmentLengthError, nonFiniteVertexCount, nonFiniteNormalCount, degenerateTriangleCount, duplicateTriangleCount, moduleIdUnique };
  const passed = maximumJointCenterError <= thresholds.maximumJointCenterError && maximumSegmentLengthError <= thresholds.maximumSegmentLengthError && nonFiniteVertexCount === 0 && nonFiniteNormalCount === 0 && degenerateTriangleCount === 0 && duplicateTriangleCount === 0 && moduleIdUnique;
  return { schema: 'humanoid_rig/hybrid_static_geometry_gate@1', thresholds, observed, passed, disconnectedModulesAllowed: true };
}

function createVisualReviewStatus() {
  const items = [
    'complete_human_skeleton_immediately_recognizable', 'head_direction_clear', 'head_neck_connection_clear', 'thorax_front_clear', 'thorax_side_has_depth',
    'pelvis_bilateral_structure_clear', 'pelvis_avoids_double_ring_mechanical_look', 'clavicles_clear', 'scapulae_clear_from_back', 'shoulder_joint_balls_clear',
    'upper_arm_long_bone_structure_clear', 'forearm_dual_rails_clear', 'palm_plate_and_thumb_side_clear', 'thigh_structure_clear', 'lower_leg_dual_rails_clear',
    'heel_and_arch_clear', 'forefoot_and_toe_clear', 'front_lines_not_overcrowded', 'side_structure_not_collapsed_to_single_line', 'three_quarter_view_expresses_depth',
    'overall_proportions_coordinated', 'valuable_to_connect_dynamic_final_pose_in_future',
  ];
  const refinementFocus = [
    'palm_plate_and_thumb_side_clear', 'thorax_front_clear', 'pelvis_bilateral_structure_clear', 'scapulae_clear_from_back',
    'forefoot_and_toe_clear', 'front_lines_not_overcrowded', 'overall_proportions_coordinated', 'valuable_to_connect_dynamic_final_pose_in_future',
  ];
  return {
    schema: 'humanoid_rig/hybrid_static_visual_review@1.1',
    previousUserReviewResult: 'P1_VISUAL_PARTIAL_PASS',
    refinementRevision: 'P1.1',
    userReviewRequired: true,
    codexMayNotMarkPass: true,
    summary: { total: items.length, pending_user_review: items.length, passed: 0, failed: 0 },
    refinementFocus: refinementFocus.map((item, index) => ({ index: index + 1, item, status: 'pending_user_review' })),
    items: items.map((item, index) => ({ index: index + 1, item, status: 'pending_user_review' })),
  };
}

function createContactSheet(fullRasters, closeupRasters, stats) {
  const sheet = new Raster(2000, 2520, '#071018');
  drawText(sheet, 34, 24, 'HRL HYBRID PRODUCTION SKELETON STATIC V1  P1.1 REFINED', '#eef8f5', 3);
  drawText(sheet, 34, 62, `REFERENCE T  20 JOINTS  19 SEGMENTS  ${stats.vertexCount} VERTICES  ${stats.triangleCount} TRIANGLES`, '#e99c38', 2);
  const fullNames = ['front', 'side', 'back', 'three-quarter'];
  for (let index = 0; index < fullNames.length; index += 1) {
    const x = index * 500 + 10;
    sheet.fillRect(x, 100, 480, 560, '#0b1a23'); sheet.strokeRect(x, 100, 480, 560, '#284653', 2);
    drawText(sheet, x + 18, 116, fullNames[index], '#6ed5ca', 2);
    sheet.blitScaled(fullRasters.get(fullNames[index]), x + 90, 140, 300, 490);
  }
  const closeups = [...closeupRasters.entries()];
  for (let index = 0; index < closeups.length; index += 1) {
    const column = index % 3; const row = Math.floor(index / 3);
    const x = 18 + column * 660; const y = 690 + row * 570;
    sheet.fillRect(x, y, 634, 540, '#0b1a23'); sheet.strokeRect(x, y, 634, 540, '#284653', 2);
    drawText(sheet, x + 16, y + 16, closeups[index][0], '#e99c38', 2);
    sheet.blitScaled(closeups[index][1], x + 122, y + 48, 390, 470);
  }
  drawText(sheet, 34, 2440, 'STATIC DISPLAY CACHE ONLY  ALL 22 VISUAL GATES PENDING USER REVIEW', '#e99c38', 2);
  drawText(sheet, 34, 2470, 'NO DYNAMIC FINALPOSE  NO IK  NO CONTROL RIG  NO DEFORM  PROJECT OWNED GEOMETRY', '#eef8f5', 2);
  return sheet;
}

function createReviewHtml(fullViews, closeupSvgs, receipt, visualReview) {
  const viewCards = [...fullViews.entries()].map(([name, svg]) => `<figure><figcaption>${escapeHtml(name)}</figcaption>${inlineSvg(svg)}</figure>`).join('\n');
  const closeupCards = [...closeupSvgs.entries()].map(([name, svg]) => `<figure><figcaption>${escapeHtml(name)}</figcaption>${inlineSvg(svg)}</figure>`).join('\n');
  const gateItems = visualReview.items.map((item) => `<li><span>${item.index}. ${escapeHtml(item.item)}</span><strong>${item.status}</strong></li>`).join('\n');
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>HRL Hybrid Production Skeleton Static V1 P1.1 Refined Review</title>\n<style>\n:root{color-scheme:dark;background:#071018;color:#e8f1ef;font-family:Inter,Segoe UI,Arial,sans-serif}*{box-sizing:border-box}body{margin:0;padding:28px;background:#071018}header{max-width:1500px;margin:auto}h1{margin:0 0 8px;font-size:28px}.notice{color:#efb04b}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:18px 0}.stats span{padding:8px 12px;border:1px solid #31505c;border-radius:8px;background:#0c1d26}section{max-width:1500px;margin:26px auto}h2{font-size:18px;color:#79d9cf}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px}figure{margin:0;border:1px solid #294754;border-radius:10px;background:#0a1821;overflow:hidden}figcaption{padding:10px 14px;color:#efb04b;font-weight:700;text-transform:uppercase}figure svg{display:block;width:100%;height:auto}ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(460px,1fr));gap:8px}li{display:flex;justify-content:space-between;gap:14px;padding:9px 12px;background:#0c1d26;border:1px solid #243f4b;border-radius:7px}li strong{color:#efb04b;white-space:nowrap}footer{max-width:1500px;margin:28px auto;color:#92a8af}\n</style>\n</head>\n<body>\n<header><h1>HRL Hybrid Production Skeleton Static V1 · P1.1 Refinement</h1><p class="notice">Previous result: P1_VISUAL_PARTIAL_PASS. Static proportions and structures were refined; all visual gates still require user review.</p><div class="stats"><span>Reference T</span><span>20 Core joints</span><span>19 Core segments</span><span>${receipt.glb.vertexCount} vertices</span><span>${receipt.glb.triangleCount} triangles</span><span>${receipt.glb.meshCount} meshes</span><span>${receipt.glb.materialCount} materials</span></div></header>\n<section><h2>Full-body orthographic views</h2><div class="grid">${viewCards}</div></section>\n<section><h2>Structural close-ups</h2><div class="grid">${closeupCards}</div></section>\n<section><h2>Visual gates — pending user review</h2><ul>${gateItems}</ul></section>\n<footer>Single-file static review · embedded SVG only · no scripts · no network dependency · GLB is a display cache, not pose authority.</footer>\n</body>\n</html>\n`;
}

async function validateOutputs(receiptValue, gate, review, manifestValue) {
  if (!gate.passed) throw new Error('Geometry gate failed.');
  if (review.items.length !== 22 || review.refinementFocus.length !== 8 || review.items.some((item) => item.status !== 'pending_user_review') || review.refinementFocus.some((item) => item.status !== 'pending_user_review')) throw new Error('Visual review status contract failed.');
  if (source.joints.length !== 20 || source.segments.length !== 19 || source.modules.length !== 24) throw new Error('Core or module count mismatch.');
  if (receiptValue.glb.externalUriCount !== 0 || receiptValue.glb.meshCount !== 24 || receiptValue.glb.materialCount !== 6) throw new Error('GLB cache contract failed.');
  if (generated.length !== 26 || manifestValue.generatedFileCount !== 27) throw new Error(`Generated file count mismatch: tracked=${generated.length}, manifest=${manifestValue.generatedFileCount}`);
  const html = await readFile(reviewPath, 'utf8');
  if (/<script\b|\bfetch\s*\(|node_modules|\bLoading\b|(?:src|href)\s*=\s*["']https?:\/\//i.test(html)) throw new Error('Review HTML is not self-contained static content.');
  if ((html.match(/<svg\b/g) || []).length !== 13) throw new Error('Review HTML must embed four full views and nine close-ups.');
  for (const viewName of Object.keys(P0_VIEW_SPECS)) {
    const svg = await readFile(path.join(artifactRoot, `${viewName}.svg`), 'utf8');
    if (!svg.startsWith('<?xml') || !svg.trimEnd().endsWith('</svg>') || /<script\b|(?:src|href)\s*=\s*["']https?:\/\//i.test(svg)) throw new Error(`Invalid static SVG: ${viewName}`);
    assertPng(await readFile(path.join(artifactRoot, `${viewName}.png`)), 900, 1100, `${viewName}.png`);
  }
  for (const spec of closeupSpecs()) assertPng(await readFile(path.join(artifactRoot, `${spec.name}.png`)), 900, 1100, `${spec.name}.png`);
  assertPng(await readFile(path.join(artifactRoot, 'contact-sheet.png')), 2000, 2520, 'contact-sheet.png');
  const glb = await readFile(glbPath);
  if (sha256(glb) !== receiptValue.glb.sha256 || glb.length !== receiptValue.glb.byteSize) throw new Error('GLB receipt hash or size mismatch.');
}

function assertPng(buffer, width, height, label) {
  if (!buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.readUInt32BE(16) !== width || buffer.readUInt32BE(20) !== height) throw new Error(`Invalid PNG: ${label}`);
}

function countExternalUris(gltf) {
  let count = 0;
  for (const buffer of gltf.buffers || []) if (buffer.uri) count += 1;
  for (const image of gltf.images || []) if (image.uri) count += 1;
  return count;
}

function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function relative(filePath) { return path.relative(root, filePath).replaceAll('\\', '/'); }
function distance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function triangleAreaTwice(a, b, c) { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return Math.hypot(ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]); }
function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function inlineSvg(svg) { return svg.replace(/^<\?xml[^>]+>\s*/, '').replace(/<title[^>]*>.*?<\/title>/s, '').replace(/<desc[^>]*>.*?<\/desc>/s, ''); }

function closeupSpecs() {
  return [
    { name: 'head-neck-closeup', view: 'three-quarter', viewport: { worldCenter: [0, 1.61, 0], orthographicWidthMeters: 0.55, orthographicHeightMeters: 0.55 } },
    { name: 'thorax-closeup', view: 'three-quarter', viewport: { worldCenter: [0, 1.285, 0], orthographicWidthMeters: 0.72, orthographicHeightMeters: 0.58 } },
    { name: 'pelvis-closeup', view: 'three-quarter', viewport: { worldCenter: [0, 0.935, 0], orthographicWidthMeters: 0.68, orthographicHeightMeters: 0.56 } },
    { name: 'shoulder-front-closeup', view: 'front', viewport: { worldCenter: [0.14, 1.355, 0], orthographicWidthMeters: 0.64, orthographicHeightMeters: 0.55 } },
    { name: 'scapula-back-closeup', view: 'back', viewport: { worldCenter: [0.14, 1.34, 0.07], orthographicWidthMeters: 0.64, orthographicHeightMeters: 0.55 } },
    { name: 'forearm-closeup', view: 'three-quarter', viewport: { worldCenter: [0.60, 1.329, 0], orthographicWidthMeters: 0.60, orthographicHeightMeters: 0.42 } },
    { name: 'hand-closeup', view: 'three-quarter', viewport: { worldCenter: [0.79, 1.30, -0.03], orthographicWidthMeters: 0.46, orthographicHeightMeters: 0.42 } },
    { name: 'lower-leg-closeup', view: 'three-quarter', viewport: { worldCenter: [0.135, 0.31, 0], orthographicWidthMeters: 0.48, orthographicHeightMeters: 0.68 } },
    { name: 'foot-side-closeup', view: 'side', viewport: { worldCenter: [0.16, 0.09, -0.10], orthographicWidthMeters: 0.48, orthographicHeightMeters: 0.40 } },
  ];
}
