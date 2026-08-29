(function (global) {
  'use strict';

  const POSES = Object.freeze([
    ['reference_a_pose', 'A Pose'], ['reference_t_pose', 'T Pose'], ['shoulder_abduction_90', 'Shoulder 90'], ['shoulder_abduction_150', 'Shoulder 150'],
    ['elbow_flex_45', 'Elbow 45'], ['elbow_flex_90', 'Elbow 90'], ['elbow_flex_135', 'Elbow 135'], ['forearm_pronation', 'Forearm Pronation'],
    ['forearm_supination', 'Forearm Supination'], ['spine_twist_left', 'Spine Twist'], ['hip_flexion_30', 'Hip Flexion 30'], ['hip_flexion_90', 'Hip Flexion 90'],
    ['hip_abduction', 'Hip Abduction'], ['shallow_squat', 'Shallow Squat'], ['deep_squat', 'Deep Squat'], ['large_step', 'Large Step'],
    ['seated_pose', 'Seated'], ['kneeling_pose', 'Kneeling'], ['knee_flex_135', 'Knee 135'], ['finger_curl', 'Finger Curl'], ['fist', 'Fist'],
  ]);
  const MODES = Object.freeze([
    ['surface', 'Surface'], ['surface-wireframe', 'Surface Wireframe'], ['skeleton-overlay', 'Skeleton Overlay'], ['base-skinning', 'Base Skinning'],
    ['regional-deformation', 'Regional Deformation'], ['before-after', 'Before / After'], ['true-inversion-map', 'True Inversion Map'],
    ['intersection-map', 'Intersection Map'], ['volume-map', 'Volume Map'], ['strain-map', 'Strain Map'], ['lattice-debug', 'Lattice Debug'],
  ]);
  const CAMERA_REGIONS = Object.freeze([
    ['full-body', 'Full Body'], ['neck-shoulder', 'Shoulder'], ['left-elbow', 'Left Elbow'], ['right-elbow', 'Right Elbow'],
    ['pelvis-groin', 'Pelvis / Groin'], ['left-knee', 'Left Knee'], ['right-knee', 'Right Knee'], ['back-centerline', 'Spine'],
  ]);

  function start(options) {
    const root = document.querySelector(options?.rootSelector || '#app');
    if (!root) throw new Error('REGIONAL_DEFORMATION_ROOT_MISSING');
    const evidence = createEvidence(); global.__HRL_REGIONAL_DEFORMATION_V1__ = evidence; installGlobalErrorCapture(evidence);
    try {
      const data = global.__HRL_REGIONAL_DATA__; if (!data?.cache?.poses || !global.THREE) throw new Error('REGIONAL_EMBEDDED_DATA_OR_THREE_MISSING');
      root.innerHTML = shellMarkup(data); const app = createApplication(root, data, evidence); global.__HRL_REGIONAL_DEFORMATION_APP_V1__ = app;
      evidence.ready = true; evidence.firstFrameRendered = true; evidence.browserEvidenceStatus = 'user-file-review-active'; updateEvidencePanel(root, evidence); return app;
    } catch (error) { recordError(evidence, error); root.innerHTML = errorMarkup(evidence); throw error; }
  }

  function createApplication(root, data, evidence) {
    const THREE = global.THREE; const viewport = root.querySelector('[data-viewport]');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x061018, 1); viewport.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x061018); const camera = new THREE.PerspectiveCamera(32, 1, 0.005, 20);
    scene.add(new THREE.HemisphereLight(0xc8f4ff, 0x14202a, 2.1)); const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(1.4, 1.8, 2.3); scene.add(key); const rim = new THREE.DirectionalLight(0x50dacc, 1.45); rim.position.set(-1.5, .8, -1.5); scene.add(rim);
    const indices = decodeTyped(data.cache.indexBase64, Uint32Array); const canonical = decodeTyped(data.cache.poses.reference_a_pose.regionalPositionsBase64, Float32Array);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(canonical), 3)); geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(canonical.length), 3)); geometry.setIndex(new THREE.BufferAttribute(indices, 1)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .72, metalness: .015, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'HRLFullBilateralSurfaceV1'; scene.add(mesh);
    const skeletonGroup = new THREE.Group(); skeletonGroup.name = 'RegionalSkeletonOverlay'; scene.add(skeletonGroup); const latticeGroup = new THREE.Group(); latticeGroup.name = 'HiddenRegionalLatticeDebug'; scene.add(latticeGroup);
    const state = { poseId: 'reference_a_pose', mode: 'surface', cameraRegion: 'full-body', playing: false, slow: false, frame: 60, lastTime: performance.now() };
    const controls = { yaw: 0, pitch: .03, distance: 2.7, target: new THREE.Vector3(0, .04, .05), minDistance: .1, maxDistance: 10 };
    const updateCamera = () => { const cp = Math.cos(controls.pitch); camera.position.set(controls.target.x + controls.distance * Math.sin(controls.yaw) * cp, controls.target.y + controls.distance * Math.sin(controls.pitch), controls.target.z + controls.distance * Math.cos(controls.yaw) * cp); camera.lookAt(controls.target); camera.updateMatrixWorld(true); };
    const render = () => renderer.render(scene, camera); updateCamera(); render();
    const safetyApi = global.HRLCameraSafetyControllerV1; if (!safetyApi?.CameraSafetyControllerV1) throw new Error('CAMERA_SAFETY_CONTROLLER_MISSING');
    const safety = new safetyApi.CameraSafetyControllerV1({ THREE, camera, renderer, viewport, controls, getVisibleSurfaces: () => [{ group: mesh, solid: mesh }], getProductionPositions: () => geometry.getAttribute('position').array, getProductionMatrixWorld: () => mesh.matrixWorld, updateWorldMatrices: () => scene.updateMatrixWorld(true), updateCamera, renderScene: render, onMetrics: (metrics, viewportMetrics) => { evidence.cameraSafetyMetrics = { ...metrics, viewportMetrics }; const node = root.querySelector('[data-camera-status]'); if (node) node.textContent = compactCameraStatus(evidence.cameraSafetyMetrics); }, onNotice: (message) => setNotice(root, message), onRegion: (region) => { evidence.currentRegion = region; }, initialRegion: 'full-body', lockVisible: true });
    safety.connectResizeSignals(); bindControls(root, state, { update, safety }); installPointerControls(renderer.domElement, controls, updateCamera, render, () => safety.handleInteractionEnd('regional-pointer-end'));

    function update(reason) {
      const pose = data.cache.poses[state.poseId]; if (!pose) throw new Error(`UNKNOWN_REGIONAL_POSE:${state.poseId}`);
      const base = decodeTyped(pose.basePositionsBase64, Float32Array); const regional = decodeTyped(pose.regionalPositionsBase64, Float32Array); const alpha = state.frame / 60;
      const target = selectTargetPositions(state.mode, base, regional, canonical); const positions = interpolatePositions(canonical, target, alpha);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      material.wireframe = state.mode === 'surface-wireframe'; material.transparent = state.mode === 'lattice-debug'; material.opacity = state.mode === 'lattice-debug' ? .28 : 1; material.depthWrite = state.mode !== 'lattice-debug';
      paintSurface(THREE, geometry, canonical, regional, pose.qa, state.mode, data); skeletonGroup.visible = state.mode === 'skeleton-overlay'; latticeGroup.visible = state.mode === 'lattice-debug';
      rebuildSkeleton(THREE, skeletonGroup, data.bones, data.cache.poses.reference_a_pose.skeleton, pose.skeleton, alpha); rebuildLattice(THREE, latticeGroup, pose.latticeDebug);
      const compare = root.querySelector('[data-compare-labels]'); compare.hidden = state.mode !== 'before-after'; updateMetrics(root, pose.qa, state, reason); root.querySelector('[data-frame]').value = String(state.frame);
      evidence.currentPose = state.poseId; evidence.currentMode = state.mode; evidence.timelineFrame = state.frame; evidence.renderedVertexCount = data.cache.vertexCount; evidence.renderedTriangleCount = data.cache.triangleCount; evidence.visibleMeshCount = 1; evidence.humanSurfaceCount = 1; evidence.frontSideMaterial = material.side === THREE.FrontSide; evidence.hiddenLatticeVisible = state.mode === 'lattice-debug'; evidence.lastUpdateReason = reason; updateEvidencePanel(root, evidence);
      scene.updateMatrixWorld(true); updateCamera(); render(); if (reason === 'initial') safety.resizeNow('regional-initial'); else { safety.refreshBounds(); safety.updateClipPlanes(); render(); }
    }

    function tick(now) { if (state.playing) { const rate = state.slow ? .012 : .04; state.frame = (state.frame + (now - state.lastTime) * rate) % 61; update('playback'); } state.lastTime = now; requestAnimationFrame(tick); }
    update('initial'); requestAnimationFrame(tick);
    return { getState: () => ({ ...state }), setPose: (poseId) => { state.poseId = poseId; update('public-pose'); }, setMode: (mode) => { state.mode = mode; update('public-mode'); }, fitFullBody: () => safety.fitFullBody('public-fit-full-body'), render, evidence };
  }

  function bindControls(root, state, context) {
    const pose = root.querySelector('[data-pose]'); const mode = root.querySelector('[data-mode]'); const region = root.querySelector('[data-region]'); const play = root.querySelector('[data-play]'); const slow = root.querySelector('[data-slow]');
    pose.addEventListener('change', () => { state.poseId = pose.value; state.frame = 60; context.update('pose-change'); }); mode.addEventListener('change', () => { state.mode = mode.value; context.update('mode-change'); });
    region.addEventListener('change', () => { state.cameraRegion = region.value; context.safety.setRegion(region.value, { reason: 'regional-region-select' }); });
    play.addEventListener('click', () => { state.playing = !state.playing; play.textContent = state.playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(state.playing)); });
    slow.addEventListener('click', () => { state.slow = !state.slow; slow.setAttribute('aria-pressed', String(state.slow)); });
    root.querySelector('[data-step-back]').addEventListener('click', () => { state.playing = false; state.frame = Math.max(0, Math.round(state.frame) - 1); play.textContent = 'Play'; context.update('frame-back'); });
    root.querySelector('[data-step-forward]').addEventListener('click', () => { state.playing = false; state.frame = Math.min(60, Math.round(state.frame) + 1); play.textContent = 'Play'; context.update('frame-forward'); });
    root.querySelector('[data-fit]').addEventListener('click', () => context.safety.fitCurrentRegion('regional-fit')); root.querySelector('[data-reset]').addEventListener('click', () => context.safety.fitFullBody('regional-reset'));
    root.querySelector('[data-panel-toggle]').addEventListener('click', () => root.querySelector('.regional-shell').classList.toggle('panel-collapsed'));
    document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'f') context.safety.fitCurrentRegion('regional-hotkey-fit'); if (event.key.toLowerCase() === 'r') context.safety.fitFullBody('regional-hotkey-reset'); if (event.key.toLowerCase() === 'h') root.querySelector('.regional-shell').classList.toggle('panel-collapsed'); });
  }

  function selectTargetPositions(mode, base, regional, canonical) {
    if (mode === 'base-skinning') return base;
    if (mode === 'before-after') { const output = new Float32Array(regional); for (let vertex = 0; vertex < output.length / 3; vertex += 1) if (canonical[vertex * 3] < 0) for (let axis = 0; axis < 3; axis += 1) output[vertex * 3 + axis] = base[vertex * 3 + axis]; return output; }
    return regional;
  }
  function interpolatePositions(rest, target, alpha) { const output = new Float32Array(target.length); for (let index = 0; index < output.length; index += 1) output[index] = rest[index] + (target[index] - rest[index]) * alpha; return output; }

  function paintSurface(THREE, geometry, rest, posed, qa, mode, data) {
    const colors = geometry.getAttribute('color').array; const neutral = new THREE.Color(0x9eb3ba); for (let vertex = 0; vertex < data.cache.vertexCount; vertex += 1) writeColor(colors, vertex, neutral);
    if (mode === 'regional-deformation') { const regions = decodeTyped(data.primaryRegionIdsBase64, Uint8Array); for (let vertex = 0; vertex < regions.length; vertex += 1) { const name = data.regionNames[regions[vertex]] || ''; if (/pelvis|groin|gluteal|hip_root|thigh_twist/.test(name)) writeColor(colors, vertex, new THREE.Color(0x60d6b4)); else if (/elbow|forearm|knee|patella|popliteal|calf/.test(name)) writeColor(colors, vertex, new THREE.Color(0x65aef5)); else if (/abdomen|spine|chest|waist|torso/.test(name)) writeColor(colors, vertex, new THREE.Color(0xa39cf5)); } }
    if (mode === 'true-inversion-map') paintTriangles(colors, geometry.index.array, qa.trueTriangleIds || [], new THREE.Color(0xff335c));
    if (mode === 'intersection-map') { const triangles = new Set(); for (const pair of qa.criticalIntersections || []) { triangles.add(pair.triangleA); triangles.add(pair.triangleB); } paintTriangles(colors, geometry.index.array, [...triangles], new THREE.Color(0xf052ff)); }
    if (mode === 'volume-map') { const regions = decodeTyped(data.primaryRegionIdsBase64, Uint8Array); for (let vertex = 0; vertex < regions.length; vertex += 1) { const name = data.regionNames[regions[vertex]] || ''; const ratio = /elbow|forearm/.test(name) ? qa.elbowVolumeRatio : /knee|patella|popliteal|calf/.test(name) ? qa.kneeVolumeRatio : /pelvis|groin|gluteal|hip_root|thigh_twist/.test(name) ? qa.hipVolumeRatio : 1; if (ratio !== 1) writeColor(colors, vertex, volumeColor(THREE, ratio)); } }
    if (mode === 'strain-map') { const strain = vertexStrain(rest, posed, geometry.index.array); let maximum = 0; for (const value of strain) maximum = Math.max(maximum, value); for (let vertex = 0; vertex < strain.length; vertex += 1) { const t = Math.min(1, Math.log1p(strain[vertex]) / Math.max(1e-9, Math.log1p(maximum))); writeColor(colors, vertex, new THREE.Color().setHSL(.58 * (1 - t), .92, .52)); } }
    geometry.getAttribute('color').needsUpdate = true;
  }
  function volumeColor(THREE, ratio) { const t = Math.min(1, Math.abs(ratio - 1) / .5); return new THREE.Color().setHSL((ratio < 1 ? .1 : .82) * (1 - .15 * t), .9, .52); }
  function vertexStrain(rest, posed, indices) { const output = new Float32Array(rest.length / 3); for (let offset = 0; offset < indices.length; offset += 3) for (const pair of [[0, 1], [1, 2], [2, 0]]) { const a = indices[offset + pair[0]], b = indices[offset + pair[1]]; const restLength = pointDistance(rest, a, b), posedLength = pointDistance(posed, a, b), value = restLength > 1e-12 ? Math.abs(posedLength / restLength - 1) : 0; output[a] = Math.max(output[a], value); output[b] = Math.max(output[b], value); } return output; }
  function pointDistance(values, a, b) { return Math.hypot(values[a * 3] - values[b * 3], values[a * 3 + 1] - values[b * 3 + 1], values[a * 3 + 2] - values[b * 3 + 2]); }
  function paintTriangles(colors, indices, triangleIds, color) { for (const id of triangleIds) for (let corner = 0; corner < 3; corner += 1) { const vertex = indices[id * 3 + corner]; if (Number.isInteger(vertex)) writeColor(colors, vertex, color); } }

  function rebuildSkeleton(THREE, group, bones, rest, posed, alpha) { clearGroup(group); const lines = [], points = []; const current = {}; for (const bone of bones) { const a = rest[bone.id], b = posed[bone.id]; if (!a || !b) continue; current[bone.id] = a.map((value, axis) => value + (b[axis] - value) * alpha); points.push(...current[bone.id]); } for (const bone of bones) if (bone.parentId && current[bone.id] && current[bone.parentId]) lines.push(...current[bone.parentId], ...current[bone.id]); if (lines.length) group.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)), new THREE.LineBasicMaterial({ color: 0xe4fbff, depthTest: true }))); if (points.length) group.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.PointsMaterial({ color: 0x56dfd6, size: .009, sizeAttenuation: true }))); }
  function rebuildLattice(THREE, group, debug) { clearGroup(group); if (!debug) return; const spine = debug.spine?.rings || []; for (const ring of spine) addClosedControls(THREE, group, ring.controls, 0x56dfd6); for (let ring = 1; ring < spine.length; ring += 1) for (let control = 0; control < Math.min(spine[ring - 1].controls.length, spine[ring].controls.length); control += 1) addLine(THREE, group, [spine[ring - 1].controls[control].posedPosition, spine[ring].controls[control].posedPosition], 0x3aa79f); for (const section of debug.pelvisHipGroin?.sections || []) addClosedControls(THREE, group, section.controls, 0xffb45e); }
  function addClosedControls(THREE, group, controls, color) { if (!controls?.length) return; const points = controls.map((item) => item.posedPosition); addLine(THREE, group, [...points, points[0]], color); const flat = points.flat(); group.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(flat, 3)), new THREE.PointsMaterial({ color, size: .006, depthTest: false }))); }
  function addLine(THREE, group, points, color) { group.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3)), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: .9 }))); }

  function updateMetrics(root, qa, state, reason) { const values = { trueFlip: qa.trueTriangleInversionCount, intersections: qa.criticalSelfIntersectionCount, elbow: formatNumber(qa.elbowVolumeRatio), knee: formatNumber(qa.kneeVolumeRatio), minArea: formatNumber(qa.minimumTriangleAreaRatio), strain: formatNumber(qa.maximumSurfaceStrain) }; for (const [key, value] of Object.entries(values)) { const node = root.querySelector(`[data-metric="${key}"]`); if (node) node.textContent = value; } const node = root.querySelector('[data-pose-status]'); if (node) node.textContent = JSON.stringify({ reason, poseId: qa.poseId, passed: qa.passed, intentionalContact: qa.intentionalContact, intentionalContactCount: qa.intentionalContactCount, unclassifiedContactCount: qa.unclassifiedContactCount, centerlineGap: qa.centerlineGap, returnToRestError: qa.returnToRestError, NaNCount: qa.NaNCount, InfCount: qa.InfCount, orientationBarrier: summarizeBarrier(qa.barrierMetrics?.orientationBarrier), collisionBarrier: summarizeBarrier(qa.barrierMetrics?.collisionBarrier) }, null, 2); }
  function summarizeBarrier(value) { return value ? { passed: value.passed, finalViolationCount: value.finalViolationCount, criticalSelfIntersectionCount: value.criticalSelfIntersectionCount, iterations: value.iterations?.length || 0 } : null; }
  function shellMarkup(data) { const summary = data.summary; return `<main class="regional-shell"><header class="topbar"><div><p class="eyebrow">TASK 16B · R3 · OFFLINE FILE REVIEW</p><h1>Regional Natural Deformation Repair V1</h1><p>同一 HRLSurface 的基础蒙皮、区域修复、格与校准 QA 证据；不写回姿势或生产表面。</p></div><div class="gate"><span>两轮停止结论</span><strong>${summary.conclusion}</strong><small>Visual acceptance: pending</small></div></header><section class="workspace"><div class="viewport-wrap"><div class="viewport" data-viewport><div class="compare-labels" data-compare-labels hidden><span>LEFT · BASE SKINNING</span><span>RIGHT · REGIONAL</span></div><div class="viewport-badge"><span data-notice>拖动旋转 · 滚轮缩放 · F 适应 · R 重置</span></div><div class="timeline"><button type="button" data-step-back>◀</button><button type="button" data-play aria-pressed="false">Play</button><button type="button" data-slow aria-pressed="false">Slow</button><button type="button" data-step-forward>▶</button><output data-frame>60</output></div></div></div><aside class="panel"><div class="panel-head"><div><span>Regional review</span><b>FrontSide · one HRLSurface</b></div><button type="button" data-panel-toggle>隐藏 H</button></div><div class="control-grid">${selectMarkup('Pose / action', 'pose', POSES, 'reference_a_pose')}${selectMarkup('Mode', 'mode', MODES, 'surface')}${selectMarkup('Camera region', 'region', CAMERA_REGIONS, 'full-body')}</div><div class="button-row"><button type="button" data-fit>Fit region</button><button type="button" data-reset>Reset full body</button></div><section class="metric-grid">${metricCard('True inversions', 'trueFlip')}${metricCard('Critical self-X', 'intersections')}${metricCard('Elbow volume', 'elbow')}${metricCard('Knee volume', 'knee')}${metricCard('Min area ratio', 'minArea')}${metricCard('Max strain', 'strain')}</section><details open><summary>Pose and barrier evidence</summary><pre data-pose-status></pre></details><details><summary>Camera safety</summary><pre data-camera-status>Waiting…</pre></details><details><summary>Public review state</summary><pre data-evidence-status></pre></details><section class="gate-note"><strong>数值门失败，视觉门保持关闭</strong><p>task16bVisualAcceptance=false · visualAcceptance=false · productionReady=false · userVisualAcceptance=pending。截图须由用户实际打开本页后采集。</p></section></aside></section></main>`; }
  function selectMarkup(label, name, entries, selected) { return `<label class="field"><span>${label}</span><select data-${name}>${entries.map(([value, text]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`; }
  function metricCard(label, key) { return `<article><span>${label}</span><strong data-metric="${key}">0</strong></article>`; }
  function errorMarkup(evidence) { return `<main class="fatal"><p>Task 16B R3 offline review failed to initialize.</p><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></main>`; }
  function installPointerControls(canvas, controls, updateCamera, render, onEnd) { let active = false, x = 0, y = 0; canvas.addEventListener('pointerdown', (event) => { active = true; x = event.clientX; y = event.clientY; canvas.setPointerCapture(event.pointerId); }); canvas.addEventListener('pointermove', (event) => { if (!active) return; const dx = event.clientX - x, dy = event.clientY - y; x = event.clientX; y = event.clientY; controls.yaw -= dx * .008; controls.pitch = clamp(controls.pitch + dy * .006, -1.25, 1.25); updateCamera(); render(); }); canvas.addEventListener('pointerup', () => { active = false; onEnd(); }); canvas.addEventListener('pointercancel', () => { active = false; onEnd(); }); canvas.addEventListener('wheel', (event) => { event.preventDefault(); controls.distance *= Math.exp(event.deltaY * .001); updateCamera(); render(); onEnd(); }, { passive: false }); canvas.addEventListener('contextmenu', (event) => event.preventDefault()); }
  function decodeTyped(base64, Constructor) { const raw = atob(base64), bytes = new Uint8Array(raw.length); for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index); return new Constructor(bytes.buffer); }
  function writeColor(array, vertex, color) { array[vertex * 3] = color.r; array[vertex * 3 + 1] = color.g; array[vertex * 3 + 2] = color.b; }
  function clearGroup(group) { while (group.children.length) { const child = group.children.pop(); child.geometry?.dispose(); child.material?.dispose(); } }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function formatNumber(value) { return Number.isFinite(value) ? (Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(5)) : 'n/a'; }
  function setNotice(root, message) { const node = root.querySelector('[data-notice]'); if (node) node.textContent = message; }
  function compactCameraStatus(metrics) { return JSON.stringify({ region: metrics.region, distance: metrics.cameraDistance, near: metrics.cameraNear, far: metrics.cameraFar, modelVisible: metrics.modelVisible, insideBody: metrics.cameraInsideBody, recoveryCount: metrics.cameraRecoveryCount, viewport: metrics.viewportMetrics || null }, null, 2); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
  function createEvidence() { return { schema: 'humanoid_rig/task16b_r3_regional_deformation_browser_state@1.0', ready: false, firstFrameRendered: false, currentPose: null, currentMode: null, currentRegion: 'full-body', timelineFrame: 60, renderedVertexCount: 0, renderedTriangleCount: 0, visibleMeshCount: null, humanSurfaceCount: null, frontSideMaterial: false, hiddenLatticeVisible: false, externalHumanAssetRequests: 0, externalRigAssetRequests: 0, browserErrors: [], browserEvidenceStatus: 'pending-user-file-protocol-review', task16bVisualAcceptance: false, visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' }; }
  function installGlobalErrorCapture(evidence) { global.addEventListener('error', (event) => recordError(evidence, event.error || event.message)); global.addEventListener('unhandledrejection', (event) => recordError(evidence, event.reason)); }
  function recordError(evidence, error) { evidence.browserErrors.push({ name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '') }); evidence.ready = false; evidence.browserEvidenceStatus = 'runtime-error'; }
  function updateEvidencePanel(root, evidence) { const node = root.querySelector('[data-evidence-status]'); if (node) node.textContent = JSON.stringify(evidence, null, 2); }
  global.HRLRegionalDeformationReviewAppV1 = { start, POSES, MODES, CAMERA_REGIONS };
})(globalThis);
