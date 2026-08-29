(function (global) {
  'use strict';

  const POSES = Object.freeze([
    ['reference_a_pose', 'A Pose'],
    ['reference_t_pose', 'T Pose'],
    ['shoulder_abduction_30', 'Shoulder 30'],
    ['elbow_flexion_90', 'Elbow 90'],
    ['hip_flexion_30', 'Hip 30'],
    ['knee_flexion_90', 'Knee 90'],
    ['spine_twist_30', 'Spine Twist 30'],
  ]);
  const MODES = Object.freeze([
    ['skeleton-only', 'Skeleton Only'],
    ['rig-axes', 'Rig Axes'],
    ['dominant-rigid', 'Dominant Rigid'],
    ['lbs4', 'LBS4'],
    ['lbs8', 'LBS8'],
    ['dqs8', 'DQS8'],
    ['hybrid', 'Hybrid'],
    ['true-flip-map', 'True Flip Map'],
    ['legacy-flip-map', 'Legacy Flip Map'],
    ['intersection-map', 'Intersection Map'],
    ['strain-map', 'Strain Map'],
    ['weight-map', 'Weight Map'],
    ['topology-wireframe', 'Topology Wireframe'],
  ]);
  const REGIONS = Object.freeze([
    ['full-body', 'Full Body'], ['neck-shoulder', 'Shoulder'], ['left-axilla', 'Left Axilla'],
    ['right-axilla', 'Right Axilla'], ['left-elbow', 'Left Elbow'], ['right-elbow', 'Right Elbow'],
    ['pelvis-groin', 'Hip / Groin'], ['left-knee', 'Left Knee'], ['right-knee', 'Right Knee'],
    ['left-ankle-foot', 'Left Ankle'], ['right-ankle-foot', 'Right Ankle'], ['back-centerline', 'Spine'],
  ]);
  const MAP_MODES = new Set(['true-flip-map', 'legacy-flip-map', 'intersection-map', 'strain-map', 'weight-map', 'topology-wireframe']);
  const PALETTE = Object.freeze(['#50c8ff', '#ffcc66', '#fe6e8c', '#8ef0a7', '#bca3ff', '#ff9f5c', '#4ce0cf', '#e2e8f0', '#f472b6', '#a3e635']);

  function start(options) {
    const root = document.querySelector(options?.rootSelector || '#app');
    if (!root) throw new Error('SKINNING_FORENSICS_ROOT_MISSING');
    const evidence = createEvidence();
    global.__HRL_SKINNING_FORENSICS_V1__ = evidence;
    installGlobalErrorCapture(evidence);
    try {
      const data = global.__HRL_FORENSICS_DATA__;
      if (!data?.cache?.poses || !global.THREE) throw new Error('FORENSICS_EMBEDDED_DATA_OR_THREE_MISSING');
      root.innerHTML = shellMarkup(data);
      const app = createApplication(root, data, evidence);
      global.__HRL_SKINNING_FORENSICS_APP_V1__ = app;
      evidence.ready = true;
      evidence.firstFrameRendered = true;
      evidence.currentPose = app.getPose();
      evidence.currentMode = app.getMode();
      evidence.browserEvidenceStatus = 'pending-user-file-protocol-review';
      updateEvidencePanel(root, evidence);
      return app;
    } catch (error) {
      recordError(evidence, error);
      root.innerHTML = errorMarkup(evidence);
      throw error;
    }
  }

  function createApplication(root, data, evidence) {
    const THREE = global.THREE;
    const viewport = root.querySelector('[data-viewport]');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x061019, 1);
    viewport.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061019);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.005, 20);
    scene.add(new THREE.HemisphereLight(0xbfe9ff, 0x14202d, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.7); key.position.set(1.4, 1.8, 2.2); scene.add(key);
    const rim = new THREE.DirectionalLight(0x53c5ff, 1.5); rim.position.set(-1.5, 0.7, -1.4); scene.add(rim);

    const indices = decodeTyped(data.cache.indexBase64, Uint32Array);
    const initialPositions = decodeTyped(data.cache.poses.reference_a_pose.modes.hybrid.positionsBase64, Float32Array);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(initialPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.cache.vertexCount * 3), 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.72, metalness: 0.02, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(geometry, material); mesh.name = 'HRLSurfaceForensicsDisplay'; scene.add(mesh);
    const skeletonGroup = new THREE.Group(); skeletonGroup.name = 'RigSkeleton'; scene.add(skeletonGroup);
    const axisGroup = new THREE.Group(); axisGroup.name = 'RigAxes'; scene.add(axisGroup);
    const highlightGroup = new THREE.Group(); highlightGroup.name = 'FailureSelection'; scene.add(highlightGroup);
    const topologyGroup = new THREE.Group(); topologyGroup.name = 'TopologyCrossSections'; scene.add(topologyGroup);
    const comparisonGroup = new THREE.Group(); comparisonGroup.name = 'SixModeComparisonBoard'; scene.add(comparisonGroup);
    let comparisonSurfaces = [];
    const mainBoundsProxy = { visible: true };
    const state = { poseId: 'reference_a_pose', mode: 'hybrid', region: 'full-body', topologyRegion: 'shoulder', triangleId: null, intersectionIndex: -1, comparisonActive: false };

    const controls = { yaw: 0, pitch: 0.03, distance: 2.7, target: new THREE.Vector3(0, 0.04, 0.05), minDistance: 0.1, maxDistance: 10 };
    const render = () => renderer.render(scene, camera);
    const updateCamera = () => {
      const cp = Math.cos(controls.pitch);
      camera.position.set(
        controls.target.x + controls.distance * Math.sin(controls.yaw) * cp,
        controls.target.y + controls.distance * Math.sin(controls.pitch),
        controls.target.z + controls.distance * Math.cos(controls.yaw) * cp,
      );
      camera.lookAt(controls.target); camera.updateMatrixWorld(true);
    };
    updateCamera(); render();

    let safety = null;
    const safetyApi = global.HRLCameraSafetyControllerV1;
    if (!safetyApi?.CameraSafetyControllerV1) throw new Error('CAMERA_SAFETY_CONTROLLER_MISSING');
    safety = new safetyApi.CameraSafetyControllerV1({
      THREE, camera, renderer, viewport, controls,
      getVisibleSurfaces: () => state.comparisonActive ? comparisonSurfaces : [{ group: mainBoundsProxy, solid: mesh }],
      getProductionPositions: () => geometry.getAttribute('position').array,
      getProductionMatrixWorld: () => mesh.matrixWorld,
      updateWorldMatrices: () => scene.updateMatrixWorld(true),
      updateCamera,
      renderScene: render,
      onMetrics: (metrics, viewportMetrics) => {
        evidence.cameraSafetyMetrics = { ...metrics, viewportMetrics };
        const node = root.querySelector('[data-camera-status]');
        if (node) node.textContent = compactCameraStatus(evidence.cameraSafetyMetrics);
      },
      onNotice: (message) => setNotice(root, message),
      onRegion: (region) => { evidence.currentRegion = region; },
      initialRegion: 'full-body', lockVisible: true,
    });
    safety.connectResizeSignals();

    const selectors = bindControls(root, state, data, {
      update: (reason) => update(reason),
      setRegion: (region) => { state.region = region; safety.setRegion(region, { reason: 'forensics-region-select' }); render(); },
      fit: () => safety.fitCurrentRegion('forensics-fit'),
      reset: () => { controls.yaw = 0; controls.pitch = 0.03; safety.fitFullBody('forensics-reset'); },
      toggleComparison: () => { state.comparisonActive = !state.comparisonActive; update('six-mode-comparison-toggle'); safety.fitFullBody('six-mode-comparison-fit'); },
    });
    installPointerControls(renderer.domElement, controls, updateCamera, render, () => safety.handleInteractionEnd('forensics-pointer-end'));

    function update(reason) {
      const pose = data.cache.poses[state.poseId];
      if (!pose) throw new Error(`UNKNOWN_FORENSICS_POSE:${state.poseId}`);
      const meshMode = baseMeshMode(state.mode);
      const poseMode = pose.modes[meshMode];
      const positions = decodeTyped(poseMode.positionsBase64, Float32Array);
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      material.wireframe = state.mode === 'topology-wireframe';
      mesh.visible = !state.comparisonActive && state.mode !== 'skeleton-only' && state.mode !== 'rig-axes';
      skeletonGroup.visible = state.comparisonActive || state.mode === 'skeleton-only' || state.mode === 'rig-axes';
      axisGroup.visible = !state.comparisonActive && state.mode === 'rig-axes';
      topologyGroup.visible = !state.comparisonActive && state.mode === 'topology-wireframe';
      highlightGroup.visible = !state.comparisonActive;
      buildSkeleton(THREE, skeletonGroup, axisGroup, data.rig.poses[state.poseId]);
      if (state.comparisonActive) {
        skeletonGroup.position.set(-1.1, 0.45, 0); skeletonGroup.scale.setScalar(0.48);
        comparisonGroup.visible = true; comparisonSurfaces = rebuildComparisonBoard(THREE, comparisonGroup, pose, indices);
      } else {
        skeletonGroup.position.set(0, 0, 0); skeletonGroup.scale.setScalar(1);
        comparisonGroup.visible = false; clearGroup(comparisonGroup); comparisonSurfaces = [];
      }
      paintVertices(THREE, geometry, poseMode, state.mode, data);
      rebuildTopology(THREE, topologyGroup, data.topology, state.topologyRegion);
      rebuildSelection(THREE, highlightGroup, geometry, state, data);
      populateSelections(selectors, state, data, poseMode);
      updateMetrics(root, state, data, poseMode, reason);
      updateComparisonPanel(root, state, data);
      evidence.currentPose = state.poseId; evidence.currentMode = state.mode; evidence.currentRegion = state.region;
      evidence.currentTriangleId = state.triangleId; evidence.currentIntersectionIndex = state.intersectionIndex;
      evidence.renderedVertexCount = data.cache.vertexCount; evidence.renderedTriangleCount = data.cache.triangleCount;
      evidence.frontSideMaterial = material.side === THREE.FrontSide; evidence.lastUpdateReason = reason;
      updateEvidencePanel(root, evidence);
      scene.updateMatrixWorld(true); updateCamera(); render();
      if (reason === 'initial') safety.resizeNow('forensics-initial');
      else { safety.refreshBounds(); safety.updateClipPlanes(); render(); }
    }

    update('initial');
    return { getPose: () => state.poseId, getMode: () => state.mode, getState: () => ({ ...state }), fitFullBody: () => safety.fitFullBody('public-fit-full-body'), render, evidence };
  }

  function bindControls(root, state, data, actions) {
    const pose = root.querySelector('[data-pose]'); const mode = root.querySelector('[data-mode]'); const region = root.querySelector('[data-region]');
    const topologyRegion = root.querySelector('[data-topology-region]'); const triangle = root.querySelector('[data-triangle]'); const intersection = root.querySelector('[data-intersection]');
    pose.addEventListener('change', () => { state.poseId = pose.value; state.triangleId = null; state.intersectionIndex = -1; actions.update('pose-change'); });
    mode.addEventListener('change', () => { state.mode = mode.value; if (state.mode === 'topology-wireframe') { state.poseId = 'reference_a_pose'; pose.value = state.poseId; } state.triangleId = null; actions.update('mode-change'); });
    region.addEventListener('change', () => actions.setRegion(region.value));
    topologyRegion.addEventListener('change', () => { state.topologyRegion = topologyRegion.value; actions.update('topology-region-change'); });
    triangle.addEventListener('change', () => { state.triangleId = triangle.value === '' ? null : Number(triangle.value); actions.update('triangle-select'); });
    intersection.addEventListener('change', () => { state.intersectionIndex = Number(intersection.value); actions.update('intersection-select'); });
    root.querySelector('[data-fit]').addEventListener('click', actions.fit); root.querySelector('[data-reset]').addEventListener('click', actions.reset);
    root.querySelector('[data-compare]').addEventListener('click', actions.toggleComparison);
    root.querySelector('[data-panel-toggle]').addEventListener('click', () => root.querySelector('.forensics-shell').classList.toggle('panel-collapsed'));
    document.addEventListener('keydown', (event) => { if (event.key.toLowerCase() === 'f') actions.fit(); if (event.key.toLowerCase() === 'r') actions.reset(); if (event.key.toLowerCase() === 'h') root.querySelector('.forensics-shell').classList.toggle('panel-collapsed'); });
    return { pose, mode, region, topologyRegion, triangle, intersection };
  }

  function populateSelections(selectors, state, data, poseMode) {
    const triangleIds = [...new Set([...(poseMode.trueTriangleIds || []), ...(poseMode.legacyTriangleIds || [])])].sort((a, b) => a - b);
    selectors.triangle.innerHTML = `<option value="">No triangle selected</option>${triangleIds.map((id) => `<option value="${id}">Triangle ${id}${poseMode.trueTriangleIds?.includes(id) ? ' · true' : ' · legacy'}</option>`).join('')}`;
    if (state.triangleId != null && triangleIds.includes(state.triangleId)) selectors.triangle.value = String(state.triangleId); else if (state.triangleId != null) state.triangleId = null;
    const intersections = intersectionsForPose(data, state.poseId);
    selectors.intersection.innerHTML = `<option value="-1">No pair selected</option>${intersections.map((item, index) => `<option value="${index}">${item.triangleA} × ${item.triangleB} · ${item.intersectionType}</option>`).join('')}`;
    if (state.intersectionIndex >= 0 && state.intersectionIndex < intersections.length) selectors.intersection.value = String(state.intersectionIndex); else state.intersectionIndex = -1;
  }

  function paintVertices(THREE, geometry, poseMode, mode, data) {
    const colors = geometry.getAttribute('color').array;
    const base = new THREE.Color(0x8ea5b2); const alert = new THREE.Color(0xff315b); const legacy = new THREE.Color(0xffa53d); const intersection = new THREE.Color(0xea54ff);
    for (let vertex = 0; vertex < data.cache.vertexCount; vertex += 1) writeColor(colors, vertex, base);
    if (mode === 'weight-map') {
      const dominant = decodeTyped(data.dominantBoneBase64, Uint8Array);
      for (let vertex = 0; vertex < dominant.length; vertex += 1) writeColor(colors, vertex, new THREE.Color(PALETTE[dominant[vertex] % PALETTE.length]));
    } else if (mode === 'strain-map') {
      const strain = decodeTyped(poseMode.vertexStrainBase64, Float32Array); let maximum = 0;
      for (const value of strain) maximum = Math.max(maximum, value);
      for (let vertex = 0; vertex < strain.length; vertex += 1) {
        const t = Math.min(1, Math.log1p(strain[vertex]) / Math.max(1e-8, Math.log1p(maximum)));
        writeColor(colors, vertex, new THREE.Color().setHSL(0.58 * (1 - t), 0.92, 0.52));
      }
    } else if (mode === 'true-flip-map') paintTriangles(colors, geometry.index.array, poseMode.trueTriangleIds || [], alert);
    else if (mode === 'legacy-flip-map') paintTriangles(colors, geometry.index.array, poseMode.legacyTriangleIds || [], legacy);
    else if (mode === 'intersection-map') paintTriangles(colors, geometry.index.array, poseMode.intersectionTriangleIds || [], intersection);
    geometry.getAttribute('color').needsUpdate = true;
  }

  function paintTriangles(colors, indices, triangleIds, color) {
    for (const triangleId of triangleIds) for (let corner = 0; corner < 3; corner += 1) writeColor(colors, indices[triangleId * 3 + corner], color);
  }

  function buildSkeleton(THREE, skeletonGroup, axisGroup, poseAudit) {
    clearGroup(skeletonGroup); clearGroup(axisGroup); if (!poseAudit) return;
    const lines = []; const points = [];
    for (const joint of poseAudit.joints) {
      points.push(...joint.worldJointPosition);
      if (joint.parentId) { const parent = poseAudit.byId[joint.parentId]; if (parent) lines.push(...parent.worldJointPosition, ...joint.worldJointPosition); }
    }
    if (lines.length) skeletonGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)), new THREE.LineBasicMaterial({ color: 0xd7f5ff, depthTest: true })));
    if (points.length) skeletonGroup.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3)), new THREE.PointsMaterial({ color: 0x4fd9ff, size: 0.009, sizeAttenuation: true })));
    const axisLength = 0.018;
    const axisArrays = [[], [], []];
    for (const joint of poseAudit.joints) {
      const m = joint.worldMatrix; const origin = joint.worldJointPosition;
      const axes = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]];
      for (let axis = 0; axis < 3; axis += 1) axisArrays[axis].push(...origin, origin[0] + axes[axis][0] * axisLength, origin[1] + axes[axis][1] * axisLength, origin[2] + axes[axis][2] * axisLength);
    }
    [0xff5268, 0x62ef8c, 0x53a7ff].forEach((color, axis) => axisGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(axisArrays[axis], 3)), new THREE.LineBasicMaterial({ color }))));
  }

  function rebuildTopology(THREE, group, topology, regionId) {
    clearGroup(group); const region = topology.regions.find((item) => item.regionId === regionId); if (!region) return;
    for (const section of region.sections) {
      if (!section.points3d?.length) continue;
      const flat = section.points3d.flat(); if (section.closed) flat.push(...section.points3d[0]);
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
      group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: section.closed ? 0x53ef92 : 0xff5f68, transparent: true, opacity: 0.88, depthTest: false })));
    }
  }

  function rebuildComparisonBoard(THREE, group, pose, indices) {
    clearGroup(group);
    const layout = {
      'dominant-rigid': [0, 0.45, 0], 'lbs4': [1.1, 0.45, 0], 'lbs8': [-1.1, -0.45, 0], 'dqs8': [0, -0.45, 0], hybrid: [1.1, -0.45, 0],
    };
    const colors = { 'dominant-rigid': 0xffad66, lbs4: 0x78c8ff, lbs8: 0x60e0be, dqs8: 0xb79cff, hybrid: 0xf1f6f8 };
    const surfaces = [];
    for (const [mode, position] of Object.entries(layout)) {
      const modeGeometry = new THREE.BufferGeometry();
      modeGeometry.setAttribute('position', new THREE.BufferAttribute(decodeTyped(pose.modes[mode].positionsBase64, Float32Array), 3));
      modeGeometry.setIndex(new THREE.BufferAttribute(indices, 1)); modeGeometry.computeVertexNormals(); modeGeometry.computeBoundingBox();
      const modeMesh = new THREE.Mesh(modeGeometry, new THREE.MeshStandardMaterial({ color: colors[mode], roughness: 0.76, metalness: 0, side: THREE.FrontSide }));
      modeMesh.name = `Comparison_${mode}`; modeMesh.position.set(...position); modeMesh.scale.setScalar(0.48); group.add(modeMesh); modeMesh.updateMatrixWorld(true);
      surfaces.push({ group: modeMesh, solid: modeMesh });
    }
    return surfaces;
  }

  function rebuildSelection(THREE, group, geometry, state, data) {
    clearGroup(group); const indices = geometry.index.array; const positions = geometry.getAttribute('position').array;
    if (state.triangleId != null) addTriangleOutline(THREE, group, indices, positions, state.triangleId, 0xffec78);
    const list = intersectionsForPose(data, state.poseId); const pair = list[state.intersectionIndex];
    if (pair) {
      addTriangleOutline(THREE, group, indices, positions, pair.triangleA, 0xff5268);
      addTriangleOutline(THREE, group, indices, positions, pair.triangleB, 0x55d9ff);
      if (pair.intersectionSegment?.length > 1) group.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pair.intersectionSegment.flat(), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })));
    }
  }

  function addTriangleOutline(THREE, group, indices, positions, triangleId, color) {
    if (!Number.isInteger(triangleId) || triangleId < 0 || triangleId * 3 + 2 >= indices.length) return;
    const flat = []; for (const corner of [0, 1, 2, 0]) { const vertex = indices[triangleId * 3 + corner]; flat.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(flat, 3)), new THREE.LineBasicMaterial({ color, depthTest: false })));
  }

  function updateMetrics(root, state, data, poseMode, reason) {
    const modeMetrics = data.modeMetrics[state.poseId]?.[baseMeshMode(state.mode)] || {};
    const topology = data.topology.regions.find((item) => item.regionId === state.topologyRegion);
    const values = {
      legacy: modeMetrics.legacyTriangleFlipCount ?? poseMode.legacyTriangleIds?.length ?? 0,
      trueFlip: modeMetrics.trueTriangleInversionCount ?? poseMode.trueTriangleIds?.length ?? 0,
      intersections: modeMetrics.criticalSelfIntersectionCount ?? 0,
      strain: formatNumber(modeMetrics.maximumSurfaceStrain),
      minArea: formatNumber(modeMetrics.minimumTriangleAreaRatio),
      maxArea: formatNumber(modeMetrics.maximumTriangleAreaRatio),
    };
    for (const [key, value] of Object.entries(values)) { const node = root.querySelector(`[data-metric="${key}"]`); if (node) node.textContent = value; }
    const jointNode = root.querySelector('[data-joint-audit]');
    if (jointNode && topology) jointNode.textContent = [
      `${topology.regionId}: ${topology.passed ? 'measured rings present' : 'FAILED — no verified closed ring'}`,
      `rings ${topology.ringCount} · vertices ${topology.ringVertexCount} · area ${formatNumber(topology.crossSectionArea)}`,
      `clearance ${formatNumber(topology.minimumGeodesicClearance)} · max valence ${topology.maximumValence} · poles ${topology.poleCount}`,
      `long edges ${topology.longEdgeCount} · needle triangles ${topology.needleTriangleCount}`,
    ].join('\n');
    const selectionNode = root.querySelector('[data-selection-status]');
    if (selectionNode) {
      const localization = data.localization.poses.find((item) => item.poseId === state.poseId);
      selectionNode.textContent = JSON.stringify({ reason, poseId: state.poseId, mode: state.mode, selectedTriangleId: state.triangleId, selectedIntersectionIndex: state.intersectionIndex, firstTrueInvertedTriangleId: localization?.firstTrueInvertedTriangleId ?? null, firstCriticalIntersection: localization?.firstCriticalIntersection ? [localization.firstCriticalIntersection.triangleA, localization.firstCriticalIntersection.triangleB] : null, maximumStrainVertex: localization?.maximumStrainVertex ?? null }, null, 2);
    }
  }

  function updateComparisonPanel(root, state, data) {
    const labels = root.querySelector('[data-compare-labels]'); const panel = root.querySelector('[data-comparison-table]'); const button = root.querySelector('[data-compare]');
    labels.hidden = !state.comparisonActive; panel.hidden = !state.comparisonActive; button.textContent = state.comparisonActive ? 'Exit six-mode board' : 'Six-mode board';
    if (!state.comparisonActive) return;
    const metrics = data.modeMetrics[state.poseId] || {};
    panel.innerHTML = ['dominant-rigid', 'lbs4', 'lbs8', 'dqs8', 'hybrid'].map((mode) => { const value = metrics[mode] || {}; return `<tr><th>${mode}</th><td>${value.legacyTriangleFlipCount ?? 0}</td><td>${value.trueTriangleInversionCount ?? 0}</td><td>${value.criticalSelfIntersectionCount ?? 0}</td><td>${formatNumber(value.maximumSurfaceStrain)}</td></tr>`; }).join('');
  }

  function installPointerControls(canvas, controls, updateCamera, render, onEnd) {
    let active = false; let x = 0; let y = 0;
    canvas.addEventListener('pointerdown', (event) => { active = true; x = event.clientX; y = event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', (event) => { if (!active) return; const dx = event.clientX - x; const dy = event.clientY - y; x = event.clientX; y = event.clientY; controls.yaw -= dx * 0.008; controls.pitch = clamp(controls.pitch + dy * 0.006, -1.25, 1.25); updateCamera(); render(); });
    canvas.addEventListener('pointerup', () => { active = false; onEnd(); });
    canvas.addEventListener('pointercancel', () => { active = false; onEnd(); });
    canvas.addEventListener('wheel', (event) => { event.preventDefault(); controls.distance *= Math.exp(event.deltaY * 0.001); updateCamera(); render(); onEnd(); }, { passive: false });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  function shellMarkup(data) {
    const summary = data.summary;
    return `<main class="forensics-shell">
      <header class="topbar"><div><p class="eyebrow">TASK 16B · R2A · OFFLINE FILE REVIEW</p><h1>Natural Skinning Failure Forensics V1</h1><p>冻结输入上的骨架轴、六模式、真翻面、自交与拓扑证据。页面不修改任何生产数据。</p></div><div class="gate"><span>结论</span><strong>${summary.conclusion}</strong><small>Visual acceptance: pending</small></div></header>
      <section class="workspace">
        <div class="viewport-wrap"><div class="viewport" data-viewport><div class="compare-labels" data-compare-labels hidden><span>Skeleton</span><span>Dominant</span><span>LBS4</span><span>LBS8</span><span>DQS8</span><span>Hybrid</span></div><div class="viewport-badge"><span data-notice>拖动旋转 · 滚轮缩放 · F 适应 · R 重置</span></div></div></div>
        <aside class="panel">
          <div class="panel-head"><div><span>Forensic controls</span><b>FrontSide · frozen input</b></div><button type="button" data-panel-toggle>隐藏 H</button></div>
          <div class="control-grid">
            ${selectMarkup('Pose', 'pose', POSES, 'reference_a_pose')}${selectMarkup('Mode', 'mode', MODES, 'hybrid')}
            ${selectMarkup('Camera region', 'region', REGIONS, 'full-body')}${selectMarkup('Topology region', 'topology-region', data.topology.regions.map((item) => [item.regionId, item.regionId]), 'shoulder')}
          </div>
          <div class="button-row"><button type="button" data-fit>Fit region</button><button type="button" data-reset>Reset full body</button><button class="wide" type="button" data-compare>Six-mode board</button></div>
          <label class="field"><span>Failure triangle</span><select data-triangle><option value="">No triangle selected</option></select></label>
          <label class="field"><span>Intersection pair</span><select data-intersection><option value="-1">No pair selected</option></select></label>
          <section class="metric-grid">
            ${metricCard('Legacy flips', 'legacy')}${metricCard('True inversions', 'trueFlip')}${metricCard('Critical intersections', 'intersections')}
            ${metricCard('Max strain', 'strain')}${metricCard('Min area ratio', 'minArea')}${metricCard('Max area ratio', 'maxArea')}
          </section>
          <details data-comparison-details><summary>Six-mode numeric comparison</summary><table class="comparison"><thead><tr><th>Mode</th><th>Old</th><th>True</th><th>Self-X</th><th>Strain</th></tr></thead><tbody data-comparison-table hidden></tbody></table></details>
          <details open><summary>Joint topology audit</summary><pre data-joint-audit></pre></details>
          <details><summary>Selection trace</summary><pre data-selection-status></pre></details>
          <details><summary>Camera safety</summary><pre data-camera-status>Waiting…</pre></details>
          <details><summary>Public review state</summary><pre data-evidence-status></pre></details>
          <section class="gate-note"><strong>视觉门保持关闭</strong><p>visualAcceptance=false · productionReady=false · userVisualAcceptance=pending。截图须由用户实际打开本页后生成。</p></section>
        </aside>
      </section>
    </main>`;
  }

  function selectMarkup(label, name, entries, selected) { return `<label class="field"><span>${label}</span><select data-${name}>${entries.map(([value, text]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${text}</option>`).join('')}</select></label>`; }
  function metricCard(label, key) { return `<article><span>${label}</span><strong data-metric="${key}">0</strong></article>`; }
  function errorMarkup(evidence) { return `<main class="fatal"><p>Task 16B R2A offline review failed to initialize.</p><pre>${escapeHtml(JSON.stringify(evidence, null, 2))}</pre></main>`; }

  function baseMeshMode(mode) { return MAP_MODES.has(mode) ? 'hybrid' : (mode === 'skeleton-only' || mode === 'rig-axes' ? 'hybrid' : mode); }
  function intersectionsForPose(data, poseId) { return data.intersections.poses.find((item) => item.poseId === poseId)?.intersections || []; }
  function decodeTyped(base64, Constructor) { const raw = atob(base64); const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i); return new Constructor(bytes.buffer); }
  function writeColor(array, vertex, color) { array[vertex * 3] = color.r; array[vertex * 3 + 1] = color.g; array[vertex * 3 + 2] = color.b; }
  function clearGroup(group) { while (group.children.length) { const child = group.children.pop(); child.geometry?.dispose(); child.material?.dispose(); } }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function formatNumber(value) { return Number.isFinite(value) ? (Math.abs(value) >= 100 ? value.toFixed(1) : value.toFixed(5)) : 'n/a'; }
  function setNotice(root, message) { const node = root.querySelector('[data-notice]'); if (node) node.textContent = message; }
  function compactCameraStatus(metrics) { return JSON.stringify({ region: metrics.region, distance: metrics.cameraDistance, near: metrics.cameraNear, far: metrics.cameraFar, modelVisible: metrics.modelVisible, insideBody: metrics.cameraInsideBody, recoveryCount: metrics.cameraRecoveryCount, viewport: metrics.viewportMetrics || null }, null, 2); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

  function createEvidence() {
    return { schema: 'humanoid_rig/task16b_skinning_failure_forensics_browser_state@1.0', ready: false, firstFrameRendered: false, currentPose: null, currentMode: null, currentRegion: 'full-body', currentTriangleId: null, currentIntersectionIndex: -1, renderedVertexCount: 0, renderedTriangleCount: 0, frontSideMaterial: false, externalRequestCount: 0, browserErrors: [], browserEvidenceStatus: 'pending-user-file-protocol-review', visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending' };
  }
  function installGlobalErrorCapture(evidence) {
    global.addEventListener('error', (event) => recordError(evidence, event.error || event.message));
    global.addEventListener('unhandledrejection', (event) => recordError(evidence, event.reason));
  }
  function recordError(evidence, error) { evidence.browserErrors.push({ name: error?.name || 'Error', message: String(error?.message || error), stack: String(error?.stack || '') }); evidence.ready = false; evidence.browserEvidenceStatus = 'runtime-error'; }
  function updateEvidencePanel(root, evidence) { const node = root.querySelector('[data-evidence-status]'); if (node) node.textContent = JSON.stringify(evidence, null, 2); }

  global.HRLSkinningFailureForensicsAppV1 = { start, POSES, MODES, REGIONS };
})(globalThis);
