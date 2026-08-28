(function (global) {
  'use strict';

  const MAGIC = 'HRLSURF1';
  const TYPE_INFO = {
    float32: [Float32Array, 4], float64: [Float64Array, 8], uint8: [Uint8Array, 1],
    uint16: [Uint16Array, 2], uint32: [Uint32Array, 4], int32: [Int32Array, 4],
  };
  const ERROR_CODES = Object.freeze({
    WEBGL_CONTEXT_UNAVAILABLE: 'WEBGL_CONTEXT_UNAVAILABLE',
    WEBGL_SHADER_COMPILE_FAILED: 'WEBGL_SHADER_COMPILE_FAILED',
    EMBEDDED_ASSET_DECODE_FAILED: 'EMBEDDED_ASSET_DECODE_FAILED',
    EMBEDDED_ASSET_HASH_MISMATCH: 'EMBEDDED_ASSET_HASH_MISMATCH',
    SURFACE_TOPOLOGY_INVALID: 'SURFACE_TOPOLOGY_INVALID',
    CANVAS_RENDER_FAILED: 'CANVAS_RENDER_FAILED',
    UNKNOWN_STARTUP_FAILURE: 'UNKNOWN_STARTUP_FAILURE',
  });

  async function start(config) {
    config = config || {};
    const root = document.querySelector(config.rootSelector || '#app');
    if (!root) throw new Error('HRLSurface review root element is missing.');
    root.innerHTML = shellMarkup();
    const viewport = root.querySelector('.viewport');
    const status = root.querySelector('[data-status]');
    const state = installEvidenceState(config);
    try {
      const THREE = global.THREE;
      if (!THREE) throw codedError(ERROR_CODES.UNKNOWN_STARTUP_FAILURE, '内嵌 Three.js 运行时代码缺失。');
      status.textContent = '正在解码内嵌可编辑人体表面…';
      const [surfaceBytes, referenceBytes] = await Promise.all([
        readAsset(config.productionUrl, 'production'),
        readAsset(config.referenceUrl, 'reference'),
      ]);
      state.assetDecoded = true;
      state.assetSha256Actual = sha256Hex(surfaceBytes);
      if (!state.assetSha256Expected) state.assetSha256Expected = state.assetSha256Actual;
      state.assetHashVerified = state.assetSha256Actual === state.assetSha256Expected;
      if (!state.assetHashVerified) throw codedError(ERROR_CODES.EMBEDDED_ASSET_HASH_MISMATCH, `HRLSurface SHA-256 不匹配：expected=${state.assetSha256Expected}, actual=${state.assetSha256Actual}`);
      let parsed; let reference;
      try { parsed = parseHrlSurface(surfaceBytes); validateSurfaceTopology(parsed); }
      catch (error) { throw codedError(ERROR_CODES.SURFACE_TOPOLOGY_INVALID, `HRLSurface 容器或拓扑无效：${error.message}`, error); }
      try { reference = parseReferenceGlb(referenceBytes); }
      catch (error) { throw codedError(ERROR_CODES.EMBEDDED_ASSET_DECODE_FAILED, `内嵌 Reference GLB 解码失败：${error.message}`, error); }
      state.surfaceCreated = true;
      state.schema = parsed.header.schema;
      state.vertexCount = parsed.header.topology.vertexCount;
      state.triangleCount = parsed.header.topology.triangleCount;
      state.positionHash = sha256Hex(typedArrayBytes(parsed.chunks.basePositions));
      state.indexHash = sha256Hex(typedArrayBytes(parsed.chunks.indices));
      state.topologyFingerprint = parsed.header.topology.topologyFingerprint;
      const staticAudit = global.__HRL_FULL_BILATERAL_AUDIT__ || {};
      state.fullBilateralGeometry = parsed.header.assetIdentity === 'HRLFullBilateralSurfaceV1';
      state.runtimeMirrorOperationCount = parsed.header.topology.runtimeMirrorOperationCount;
      state.negativeScaleNodeCount = parsed.header.topology.negativeScaleNodeCount;
      state.mirroredHalfMeshCount = parsed.header.topology.mirroredHalfMeshCount;
      state.leftVertexCount = parsed.chunks.leftVertexIndices.length;
      state.rightVertexCount = parsed.chunks.rightVertexIndices.length;
      state.centerVertexCount = parsed.chunks.centerVertexIndices.length;
      state.symmetryPartnerCount = parsed.chunks.symmetryPartner.length;
      state.centerlineMetrics = staticAudit.centerlineMetrics || parsed.header.bilateralAuthority;
      state.topologyMetrics = staticAudit.topologyMetrics || parsed.header.topology;
      state.symmetricEditMetrics = staticAudit.symmetricEditMetrics || null;
      state.asymmetricEditMetrics = staticAudit.asymmetricEditMetrics || null;
      const editor = createEditor(parsed);
      const scene = createScene(THREE, viewport, editor, reference, root, state);
      state.rendererCreated = true;
      bindControls(THREE, root, viewport, editor, scene, state);
      await scene.probeFirstFrame();
      status.textContent = 'HRLFullBilateralSurfaceV1 已就绪 — 完整双侧单网格，可对称编辑或独立塑形。';
      state.ready = true;
      state.parameterCount = parsed.header.parameters.length;
      state.deformationRegionCount = parsed.header.deformationRegions.length;
      state.editable = true;
      root.classList.add('ready');
    } catch (error) {
      state.ready = false;
      const startup = normalizeStartupError(error);
      state.startupErrors.push(startup);
      state.errorCode = startup.errorCode;
      state.errorMessage = startup.errorMessage;
      status.textContent = `加载失败：${startup.errorCode}`;
      showErrorPanel(root, state);
      state.originalConsoleError(error);
    }
  }

  function installEvidenceState(config) {
    const state = {
      ready: false,
      fileProtocol: global.location.protocol === 'file:',
      offlineStandalone: Boolean(global.__HRL_EMBEDDED_ASSETS__),
      assetEmbedded: Boolean(global.__HRL_EMBEDDED_ASSETS__?.production),
      assetDecoded: false,
      assetSha256Expected: String(config.productionSha256 || global.__HRL_EMBEDDED_ASSET_META__?.productionSha256 || '').toUpperCase(),
      assetSha256Actual: null,
      assetHashVerified: false,
      vertexCount: null, triangleCount: null, positionHash: null, indexHash: null, topologyFingerprint: null,
      visibleMeshCount: 0, humanSurfaceCount: 0, canvasWidth: 0, canvasHeight: 0,
      nonBackgroundPixelCount: 0, modelScreenBounds: null, firstFrameRendered: false,
      webglAvailable: false, webglVersion: null, renderer: null,
      consoleErrors: [], pageErrors: [], startupErrors: [], externalRequests: 0, failedRequests: 0,
      loadedHumanAssetPaths: [], editable: false, surfaceCreated: false, rendererCreated: false,
      model: null, view: null, mode: null, errorCode: null, errorMessage: null,
      fullBilateralGeometry: false, runtimeMirrorOperationCount: null, negativeScaleNodeCount: null, mirroredHalfMeshCount: null,
      leftVertexCount: null, rightVertexCount: null, centerVertexCount: null, symmetryPartnerCount: null,
      centerlineMetrics: null, topologyMetrics: null, symmetricEditMetrics: null, asymmetricEditMetrics: null,
      layoutMetrics: {
        viewportWidth: 0, viewportHeight: 0, devicePixelRatio: Math.min(global.devicePixelRatio || 1, 2),
        panelMode: computePanelMode(global.innerWidth || 1280), panelOpen: false, focusMode: false, fullscreen: false,
        cameraAspect: null, modelScreenBounds: null,
        headVisible: false, leftHandVisible: false, rightHandVisible: false, leftFootVisible: false, rightFootVisible: false,
        fullBodyFramed: false, safeMarginPassed: false,
      },
      cameraSafetyMetrics: {
        region: 'full-body', cameraDistance: null, minimumDistance: null, maximumDistance: null, cameraNear: null, cameraFar: null,
        cameraInsideBody: false, nearPlaneIntersectsBody: false, farPlaneExcludesBody: false, targetInsideAllowedBounds: true,
        visibleProjectedCornerCount: 0, modelScreenBounds: null, modelVisible: false, lastValidCameraStateAvailable: false, cameraRecoveryCount: 0,
      },
      cameraNavigationVisualGate: 'failed', fullBodyReviewReliable: false,
      browser: `${navigator.userAgent}`,
      visualAcceptance: false, productionReady: false, userVisualAcceptance: 'pending',
    };
    state.originalConsoleError = console.error.bind(console);
    console.error = (...values) => { state.consoleErrors.push(values.map(stringifyErrorValue).join(' ')); state.originalConsoleError(...values); };
    global.__HRL_SURFACE_V1_REVIEW__ = state;
    global.__HRL_PRODUCTION_SURFACE_V1__ = state;
    global.__HRL_FULL_BILATERAL_SURFACE_V1__ = state;
    global.addEventListener('error', (event) => state.pageErrors.push(event.error ? String(event.error.stack || event.error) : event.message));
    global.addEventListener('unhandledrejection', (event) => state.pageErrors.push(String(event.reason && event.reason.stack || event.reason)));
    for (const url of [config.productionUrl, config.referenceUrl]) {
      if (!url) continue;
      state.loadedHumanAssetPaths.push(url);
      state.externalRequests += 1;
    }
    if (global.__HRL_EMBEDDED_ASSETS__) state.loadedHumanAssetPaths = ['embedded:humanoid-rig-production-neutral-v1.hrlsurface', 'embedded:makehuman-reference-neutral-static-v1.glb'];
    return state;
  }

  async function readAsset(url, kind) {
    const embedded = global.__HRL_EMBEDDED_ASSETS__ && global.__HRL_EMBEDDED_ASSETS__[kind];
    if (embedded) {
      try { return base64ToBytes(embedded); }
      catch (error) { throw codedError(ERROR_CODES.EMBEDDED_ASSET_DECODE_FAILED, `内嵌 ${kind} Base64 解码失败：${error.message}`, error); }
    }
    if (!url) throw codedError(ERROR_CODES.EMBEDDED_ASSET_DECODE_FAILED, `${kind} 既未内嵌也未提供调试 URL。`);
    if (typeof global.__HRL_DEBUG_ASSET_READER__ !== 'function') throw codedError(ERROR_CODES.EMBEDDED_ASSET_DECODE_FAILED, `${kind} 未内嵌；仅独立 HTTP 调试入口可读取 URL。`);
    try { return await global.__HRL_DEBUG_ASSET_READER__(url, kind); }
    catch (error) { global.__HRL_SURFACE_V1_REVIEW__.failedRequests += 1; throw codedError(ERROR_CODES.EMBEDDED_ASSET_DECODE_FAILED, `${kind} 调试资源读取失败：${error.message}`, error); }
  }

  function parseHrlSurface(bytes) {
    if (bytes.byteLength < 16) throw new Error('Container is truncated.');
    const magic = new TextDecoder().decode(bytes.subarray(0, 8));
    if (magic !== MAGIC) throw new Error(`Invalid HRLSurface magic: ${magic}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonLength = view.getUint32(8, true);
    const dataOffset = view.getUint32(12, true);
    if (16 + jsonLength > dataOffset || dataOffset > bytes.byteLength) throw new Error('Container header bounds are invalid.');
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + jsonLength)));
    const chunks = {};
    Object.entries(header.chunks).forEach(([name, descriptor]) => {
      const info = TYPE_INFO[descriptor.type];
      if (!info) throw new Error(`Unsupported chunk ${name}:${descriptor.type}`);
      if (descriptor.byteLength !== descriptor.count * info[1]) throw new Error(`Chunk ${name} byte length is inconsistent.`);
      if (dataOffset + descriptor.byteOffset + descriptor.byteLength > bytes.byteLength) throw new Error(`Chunk ${name} exceeds the container.`);
      const copied = bytes.slice(dataOffset + descriptor.byteOffset, dataOffset + descriptor.byteOffset + descriptor.byteLength);
      chunks[name] = new info[0](copied.buffer, copied.byteOffset, descriptor.count);
    });
    return { header, chunks };
  }

  function validateSurfaceTopology(parsed) {
    const required = ['basePositions', 'baseNormals', 'baseTangents', 'indices', 'parameterBasis', 'vertexSide', 'symmetryPartner', 'leftVertexIndices', 'rightVertexIndices', 'centerVertexIndices', 'centerlineRole', 'failedCenterlinePositions', 'regionOffsets', 'regionVertexIndices'];
    required.forEach((name) => { if (!parsed.chunks[name]) throw new Error(`Required chunk ${name} is missing.`); });
    const vertexCount = parsed.header.topology?.vertexCount;
    const triangleCount = parsed.header.topology?.triangleCount;
    if (parsed.header.assetIdentity !== 'HRLFullBilateralSurfaceV1') throw new Error('Asset is not the HRLFullBilateralSurfaceV1 authority.');
    if (!Number.isInteger(vertexCount) || vertexCount <= 0 || parsed.chunks.basePositions.length !== vertexCount * 3) throw new Error('Vertex count or position chunk length is invalid.');
    if (!Number.isInteger(triangleCount) || triangleCount <= 0 || parsed.chunks.indices.length !== triangleCount * 3) throw new Error('Triangle count or index chunk length is invalid.');
    for (const value of parsed.chunks.basePositions) if (!Number.isFinite(value)) throw new Error('Position chunk contains NaN or Inf.');
    for (const index of parsed.chunks.indices) if (index >= vertexCount) throw new Error(`Index ${index} exceeds vertex count ${vertexCount}.`);
  }

  function parseReferenceGlb(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== 0x46546c67) throw new Error('Reference asset is not GLB.');
    let offset = 12; let json; let binary;
    while (offset < bytes.byteLength) {
      const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true);
      const data = bytes.subarray(offset + 8, offset + 8 + length);
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(data).replace(/[\u0000\u0020]+$/g, ''));
      if (type === 0x004e4942) binary = data;
      offset += 8 + length;
    }
    const node = json.nodes.find((item) => item.mesh != null);
    const primitive = json.meshes[node.mesh].primitives[0];
    return {
      positions: readAccessor(json, binary, primitive.attributes.POSITION),
      normals: readAccessor(json, binary, primitive.attributes.NORMAL),
      indices: readAccessor(json, binary, primitive.indices),
      matrix: node.matrix || null,
    };
  }

  function readAccessor(json, binary, index) {
    const accessor = json.accessors[index]; const bufferView = json.bufferViews[accessor.bufferView];
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const constructors = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const Constructor = constructors[accessor.componentType]; const componentBytes = Constructor.BYTES_PER_ELEMENT;
    const stride = bufferView.byteStride || componentBytes * components;
    const start = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    if (stride === componentBytes * components && (binary.byteOffset + start) % componentBytes === 0) return new Constructor(binary.buffer.slice(binary.byteOffset + start, binary.byteOffset + start + accessor.count * stride));
    const output = new Constructor(accessor.count * components); const data = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    for (let item = 0; item < accessor.count; item += 1) for (let component = 0; component < components; component += 1) output[item * components + component] = readComponent(data, start + item * stride + component * componentBytes, accessor.componentType);
    return output;
  }

  function readComponent(view, offset, type) {
    if (type === 5121) return view.getUint8(offset);
    if (type === 5123) return view.getUint16(offset, true);
    if (type === 5125) return view.getUint32(offset, true);
    return view.getFloat32(offset, true);
  }

  function createEditor(parsed) {
    const base = new Float32Array(parsed.chunks.basePositions);
    const positions = new Float32Array(base);
    const indices = new Uint32Array(parsed.chunks.indices);
    const basis = new Float32Array(parsed.chunks.parameterBasis);
    const vertexSide = new Uint8Array(parsed.chunks.vertexSide);
    const symmetryPartner = new Uint32Array(parsed.chunks.symmetryPartner);
    const sculpt = new Float32Array(base.length);
    const values = new Float32Array(parsed.header.parameters.length);
    const undo = []; const redo = []; const listeners = new Set();
    const editor = {
      header: parsed.header, base, positions, indices, basis, vertexSide, symmetryPartner, sculpt, values, undo, redo,
      leftVertexIndices: new Uint32Array(parsed.chunks.leftVertexIndices), rightVertexIndices: new Uint32Array(parsed.chunks.rightVertexIndices), centerVertexIndices: new Uint32Array(parsed.chunks.centerVertexIndices), failedCenterlinePositions: new Float32Array(parsed.chunks.failedCenterlinePositions),
      setParameter(index, value, record) {
        const previous = values[index]; if (previous === value) return;
        values[index] = value; if (record !== false) push({ type: 'parameter', index, previous, next: value }); rebuild();
      },
      brush(center, radius, strength, normals, symmetricEdit, allowCenterlineOffset) {
        const changes = new Map();
        for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
          const offset = vertex * 3; const distance = Math.hypot(positions[offset] - center.x, positions[offset + 1] - center.y, positions[offset + 2] - center.z);
          if (distance >= radius) continue;
          const t = 1 - distance / radius; const amount = strength * t * t * (3 - 2 * t);
          const dx = vertexSide[vertex] === 0 && !allowCenterlineOffset ? 0 : normals[offset] * amount;
          add(vertex, dx, normals[offset + 1] * amount, normals[offset + 2] * amount);
          if (symmetricEdit) { const counterpart = symmetryPartner[vertex]; if (counterpart !== vertex) add(counterpart, -dx, normals[offset + 1] * amount, normals[offset + 2] * amount); }
        }
        if (changes.size) { push({ type: 'brush', changes: Array.from(changes) }); rebuild(); }
        return changes.size;
        function add(vertex, x, y, z) { const offset = vertex * 3; sculpt[offset] += x; sculpt[offset + 1] += y; sculpt[offset + 2] += z; const delta = changes.get(vertex) || [0, 0, 0]; delta[0] += x; delta[1] += y; delta[2] += z; changes.set(vertex, delta); }
      },
      undoCommand() { const command = undo.pop(); if (!command) return; apply(command, true); redo.push(command); rebuild(); },
      redoCommand() { const command = redo.pop(); if (!command) return; apply(command, false); undo.push(command); rebuild(); },
      reset() { const snapshot = { type: 'reset', values: Array.from(values), sculpt: new Float32Array(sculpt) }; values.fill(0); sculpt.fill(0); push(snapshot); rebuild(); },
      onChange(listener) { listeners.add(listener); },
    };
    return editor;
    function push(command) { undo.push(command); redo.length = 0; }
    function rebuild() {
      positions.set(base);
      for (let parameter = 0; parameter < values.length; parameter += 1) if (values[parameter] !== 0) { const start = parameter * positions.length; for (let component = 0; component < positions.length; component += 1) positions[component] += basis[start + component] * values[parameter]; }
      for (let component = 0; component < positions.length; component += 1) positions[component] += sculpt[component];
      listeners.forEach((listener) => listener());
    }
    function apply(command, reverse) {
      if (command.type === 'parameter') values[command.index] = reverse ? command.previous : command.next;
      else if (command.type === 'brush') command.changes.forEach(([vertex, delta]) => { const sign = reverse ? -1 : 1; const offset = vertex * 3; sculpt[offset] += delta[0] * sign; sculpt[offset + 1] += delta[1] * sign; sculpt[offset + 2] += delta[2] * sign; });
      else if (command.type === 'reset') { if (reverse) { values.set(command.values); sculpt.set(command.sculpt); } else { values.fill(0); sculpt.fill(0); } }
    }
  }

  function createScene(THREE, viewport, editor, reference, root, evidence) {
    const canvas = document.createElement('canvas');
    let contextFailure = '';
    canvas.addEventListener('webglcontextcreationerror', (event) => { contextFailure = event.statusMessage || 'Unknown WebGL context creation error.'; }, { once: true });
    const contextOptions = { antialias: true, alpha: false, preserveDrawingBuffer: true };
    const context = canvas.getContext('webgl2', contextOptions) || canvas.getContext('webgl', contextOptions);
    if (!context) throw codedError(ERROR_CODES.WEBGL_CONTEXT_UNAVAILABLE, `无法创建 WebGL 上下文。${contextFailure}`);
    evidence.webglAvailable = true;
    evidence.webglVersion = typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext ? 'WebGL2' : 'WebGL1';
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, context, ...contextOptions }); }
    catch (error) { throw codedError(ERROR_CODES.WEBGL_CONTEXT_UNAVAILABLE, `Three.js 无法使用已创建的 WebGL 上下文：${error.message}`, error); }
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(1, viewport.clientWidth), Math.max(1, viewport.clientHeight), false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    viewport.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x10151d);
    const camera = new THREE.PerspectiveCamera(32, Math.max(1, viewport.clientWidth) / Math.max(1, viewport.clientHeight), 0.01, 20);
    scene.add(new THREE.HemisphereLight(0xf0f6ff, 0x263040, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 2.3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x82b9ff, 1.4); rim.position.set(-2, 1, -1.6); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x171d27, roughness: 0.95, metalness: 0, side: THREE.FrontSide }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.825; scene.add(ground);

    const productionGeometry = new THREE.BufferGeometry();
    productionGeometry.setAttribute('position', new THREE.BufferAttribute(editor.positions, 3).setUsage(THREE.DynamicDrawUsage));
    productionGeometry.setIndex(new THREE.BufferAttribute(editor.indices, 1)); productionGeometry.computeVertexNormals(); productionGeometry.computeBoundingBox(); productionGeometry.computeBoundingSphere();
    const referenceGeometry = new THREE.BufferGeometry();
    referenceGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(reference.positions), 3));
    referenceGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(reference.normals), 3)); referenceGeometry.setIndex(new THREE.BufferAttribute(reference.indices, 1));
    if (reference.matrix) referenceGeometry.applyMatrix4(new THREE.Matrix4().fromArray(reference.matrix));
    referenceGeometry.computeBoundingBox(); referenceGeometry.computeBoundingSphere();
    const failedGeometry = new THREE.BufferGeometry();
    failedGeometry.setAttribute('position', new THREE.BufferAttribute(editor.failedCenterlinePositions, 3));
    failedGeometry.setIndex(new THREE.BufferAttribute(editor.indices, 1)); failedGeometry.computeVertexNormals(); failedGeometry.computeBoundingBox(); failedGeometry.computeBoundingSphere();

    const production = createSurfaceGroup(THREE, productionGeometry, 0x8ebfd0, 0x173a4b);
    const referenceGroup = createSurfaceGroup(THREE, referenceGeometry, 0xd1a274, 0x59351f);
    const failedHistorical = createSurfaceGroup(THREE, failedGeometry, 0xb46d73, 0x5b2028);
    const diagnostics = createDiagnosticOverlays(THREE, editor);
    production.solid.name = 'HRLFullBilateralSurfaceV1'; referenceGroup.solid.name = 'MakeHumanCC0ReferenceOnly'; failedHistorical.solid.name = 'HistoricalCenterlineFailureDiagnosticOnly';
    production.diagnostics = diagnostics; production.failedHistorical = failedHistorical;
    scene.add(referenceGroup.group, failedHistorical.group, production.group, diagnostics.centerline, diagnostics.symmetry, diagnostics.symmetricEdit, diagnostics.asymmetricEdit);
    const safetyApi = global.HRLCameraSafetyControllerV1; if (!safetyApi?.CameraSafetyControllerV1) throw codedError(ERROR_CODES.UNKNOWN_STARTUP_FAILURE, 'CameraSafetyControllerV1 未加载。');
    const controls = { yaw: 0, pitch: 0.02, distance: 3.45, minDistance: 0, maxDistance: Infinity, target: new THREE.Vector3(0, 0.015, 0.08), view: 'front' };
    const initialRegion = safetyApi.normalizeRegion(query('region', query('closeup', 'full-body')));
    const presentation = { model: 'production', view: query('view', 'front'), mode: query('mode', 'production-full'), region: initialRegion, closeup: initialRegion === 'full-body' ? '' : initialRegion, surface: query('surface', 'solid') };
    applyView(presentation.view, controls); applyPresentation(presentation, referenceGroup, production, root, evidence);
    updateCamera(camera, controls);
    function getVisibleSurfaces() { return [referenceGroup, failedHistorical, production].filter((surface) => surface.group.visible); }
    let noticeTimer = 0;
    const cameraSafety = new safetyApi.CameraSafetyControllerV1({
      THREE, camera, renderer, viewport, controls, initialRegion,
      getVisibleSurfaces, getProductionPositions: () => editor.positions, getProductionMatrixWorld: () => production.solid.matrixWorld,
      updateWorldMatrices: () => scene.updateMatrixWorld(true), updateCamera: () => updateCamera(camera, controls), renderScene: () => renderer.render(scene, camera),
      measureNonBackgroundPixels: () => countHumanPixels(THREE, renderer, scene, camera, ground),
      onRegion: (region) => { presentation.region = region; presentation.closeup = region === 'full-body' ? '' : region; const selector = root.querySelector('[data-region]'); if (selector) selector.value = region; },
      onNotice: (message) => { const notice = root.querySelector('[data-camera-notice]'); if (!notice) return; notice.textContent = message; notice.classList.add('visible'); global.clearTimeout(noticeTimer); noticeTimer = global.setTimeout(() => notice.classList.remove('visible'), 1800); },
      onMetrics: (metrics, viewportMetrics) => {
        evidence.cameraSafetyMetrics = { ...metrics }; evidence.modelScreenBounds = metrics.modelScreenBounds;
        const landmarks = measureLandmarkVisibility(THREE, camera, production, editor.positions); const bounds = metrics.modelScreenBounds;
        const safeMarginPassed = presentation.region === 'full-body' && Boolean(bounds && bounds.minX >= 0.05 - 0.0001 && bounds.maxX <= 0.95 + 0.0001 && bounds.minY >= 0.07 - 0.0001 && bounds.maxY <= 0.93 + 0.0001);
        Object.assign(evidence.layoutMetrics, viewportMetrics || {}, landmarks, { cameraAspect: camera.aspect, modelScreenBounds: bounds, fullBodyFramed: safeMarginPassed && Object.values(landmarks).every(Boolean), safeMarginPassed, fullscreen: Boolean(document.fullscreenElement) });
        const numericStatus = root.querySelector('[data-layout-status]'); if (numericStatus) numericStatus.textContent = JSON.stringify(evidence.layoutMetrics, null, 2);
        const cameraStatus = root.querySelector('[data-camera-status]'); if (cameraStatus) cameraStatus.textContent = JSON.stringify({ ...metrics, firstFrameRendered: evidence.firstFrameRendered }, null, 2);
        root.querySelector('.layout')?.classList.toggle('is-fullscreen', Boolean(document.fullscreenElement));
      },
    });
    cameraSafety.connectResizeSignals();
    editor.onChange(() => {
      const attribute = productionGeometry.getAttribute('position'); attribute.needsUpdate = true; attribute.clearUpdateRanges(); attribute.addUpdateRange(0, editor.positions.length);
      productionGeometry.computeVertexNormals(); productionGeometry.computeBoundingBox(); productionGeometry.computeBoundingSphere(); cameraSafety.refreshBounds(); cameraSafety.handleInteractionEnd('shape-change');
    });
    function render() { renderer.render(scene, camera); global.requestAnimationFrame(render); }
    render();
    evidence.renderer = `THREE.WebGLRenderer r${THREE.REVISION}`;
    async function probeFirstFrame() {
      await new Promise((resolve) => global.requestAnimationFrame(resolve));
      cameraSafety.resizeNow('first-frame');
      await new Promise((resolve) => global.requestAnimationFrame(resolve));
      cameraSafety.validateAndRecover('first-frame:projected-next-frame', true); renderer.render(scene, camera);
      const failedProgram = (renderer.info.programs || []).find((program) => program.diagnostics && program.diagnostics.runnable === false);
      if (failedProgram) throw codedError(ERROR_CODES.WEBGL_SHADER_COMPILE_FAILED, failedProgram.diagnostics.programLog || 'WebGL shader program is not runnable.');
      const shaderConsoleError = evidence.consoleErrors.find((message) => /shader error|compile shader|program.*not valid/i.test(message));
      if (shaderConsoleError) throw codedError(ERROR_CODES.WEBGL_SHADER_COMPILE_FAILED, shaderConsoleError);
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      evidence.canvasWidth = size.x; evidence.canvasHeight = size.y;
      try { evidence.nonBackgroundPixelCount = countHumanPixels(THREE, renderer, scene, camera, ground); }
      catch (error) { throw codedError(ERROR_CODES.CANVAS_RENDER_FAILED, `无法读取首帧像素：${error.message}`, error); }
      evidence.firstFrameRendered = true; cameraSafety.validateAndRecover('first-frame:verified', true);
      renderer.render(scene, camera);
      const glError = context.getError();
      if (glError !== context.NO_ERROR) throw codedError(ERROR_CODES.CANVAS_RENDER_FAILED, `WebGL 首帧错误码：${glError}`);
      if (evidence.visibleMeshCount < 1 || evidence.humanSurfaceCount < 1 || evidence.nonBackgroundPixelCount <= 0) throw codedError(ERROR_CODES.CANVAS_RENDER_FAILED, '首帧没有检测到可见人体像素。');
    }
    return { renderer, scene, camera, controls, presentation, production, referenceGroup, productionGeometry, cameraSafety, probeFirstFrame, updateCamera: () => updateCamera(camera, controls), applyPresentation: () => applyPresentation(presentation, referenceGroup, production, root, evidence), fitFullBodyToViewport: (reason) => cameraSafety.fitFullBody(reason), scheduleViewportSync: (reason) => cameraSafety.scheduleResize(reason), updateLayoutEvidence: (reason) => cameraSafety.validateAndRecover(reason, true) };
  }

  function countHumanPixels(THREE, renderer, scene, camera, ground) {
    const previousBackground = scene.background;
    const previousOverride = scene.overrideMaterial;
    const previousGroundVisible = ground.visible;
    const maskMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide });
    try {
      scene.background = new THREE.Color(0x000000); scene.overrideMaterial = maskMaterial; ground.visible = false;
      renderer.render(scene, camera);
      const gl = renderer.getContext(); const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      const pixels = new Uint8Array(size.x * size.y * 4);
      gl.readPixels(0, 0, size.x, size.y, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let count = 0;
      for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset] > 8 || pixels[offset + 1] > 8 || pixels[offset + 2] > 8) count += 1;
      return count;
    } finally {
      scene.background = previousBackground; scene.overrideMaterial = previousOverride; ground.visible = previousGroundVisible; maskMaterial.dispose(); renderer.render(scene, camera);
    }
  }

  function collectVisibleWorldBox(THREE, surfaces) {
    const result = new THREE.Box3(); result.makeEmpty();
    surfaces.forEach((surface) => {
      if (!surface.group.visible) return;
      const geometry = surface.solid.geometry; if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        result.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(surface.solid.matrixWorld));
      }
    });
    return result;
  }

  function measureModelScreenBounds(THREE, camera, viewport, surfaces) {
    const width = Math.max(1, viewport.clientWidth); const height = Math.max(1, viewport.clientHeight);
    const box = collectVisibleWorldBox(THREE, surfaces); if (box.isEmpty()) return null;
    let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const point = new THREE.Vector3(x, y, z).project(camera);
      const normalizedX = point.x * 0.5 + 0.5; const normalizedY = -point.y * 0.5 + 0.5;
      minX = Math.min(minX, normalizedX); minY = Math.min(minY, normalizedY); maxX = Math.max(maxX, normalizedX); maxY = Math.max(maxY, normalizedY);
    }
    return {
      minX, maxX, minY, maxY,
      x: Math.round(minX * width), y: Math.round(minY * height),
      width: Math.round((maxX - minX) * width), height: Math.round((maxY - minY) * height),
    };
  }

  function measureLandmarkVisibility(THREE, camera, production, positions) {
    const candidates = { head: null, leftHand: null, rightHand: null, leftFoot: null, rightFoot: null };
    for (let offset = 0; offset < positions.length; offset += 3) {
      const point = [positions[offset], positions[offset + 1], positions[offset + 2]];
      if (!candidates.head || point[1] > candidates.head[1]) candidates.head = point;
      if (point[1] > -0.2 && (!candidates.leftHand || point[0] < candidates.leftHand[0])) candidates.leftHand = point;
      if (point[1] > -0.2 && (!candidates.rightHand || point[0] > candidates.rightHand[0])) candidates.rightHand = point;
      if (point[0] <= 0 && (!candidates.leftFoot || point[1] < candidates.leftFoot[1])) candidates.leftFoot = point;
      if (point[0] >= 0 && (!candidates.rightFoot || point[1] < candidates.rightFoot[1])) candidates.rightFoot = point;
    }
    const visible = (point) => {
      if (!point) return false;
      const projected = new THREE.Vector3(point[0], point[1], point[2]).applyMatrix4(production.solid.matrixWorld).project(camera);
      const x = projected.x * 0.5 + 0.5; const y = -projected.y * 0.5 + 0.5;
      return x >= 0 && x <= 1 && y >= 0 && y <= 1 && projected.z >= -1 && projected.z <= 1;
    };
    return {
      headVisible: visible(candidates.head), leftHandVisible: visible(candidates.leftHand), rightHandVisible: visible(candidates.rightHand),
      leftFootVisible: visible(candidates.leftFoot), rightFootVisible: visible(candidates.rightFoot),
    };
  }

  function computeFitDistanceForBounds(bounds, options) {
    return global.HRLCameraSafetyControllerV1.computeFitDistanceForBounds(bounds, options);
  }

  function projectBoundsForLayout(bounds, options) {
    return global.HRLCameraSafetyControllerV1.projectBoundsForLayout(bounds, options);
  }

  function computePanelMode(width) { return width >= 1280 ? 'docked-right' : width >= 800 ? 'overlay-right' : 'drawer-bottom'; }
  function computeResponsiveViewport(pageWidth, pageHeight, panelOpen) {
    const panelMode = computePanelMode(pageWidth); const headerHeight = pageWidth < 800 ? 44 : 40;
    const panelWidth = panelMode === 'docked-right' && panelOpen ? clamp(pageWidth * 0.21, 300, 340) : 0;
    return { viewportWidth: Math.max(1, pageWidth - panelWidth), viewportHeight: Math.max(1, pageHeight - headerHeight), headerHeight, panelMode, panelOpen: Boolean(panelOpen) };
  }

  function createSurfaceGroup(THREE, geometry, color, wireColor) {
    const group = new THREE.Group();
    const solidMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, side: THREE.FrontSide });
    const wireMaterial = new THREE.MeshBasicMaterial({ color: wireColor, wireframe: true, transparent: true, opacity: 0.68, side: THREE.FrontSide });
    const solid = new THREE.Mesh(geometry, solidMaterial); const wire = new THREE.Mesh(geometry, wireMaterial);
    wire.renderOrder = 2; group.add(solid, wire); return { group, solid, wire, solidMaterial, wireMaterial };
  }

  function createDiagnosticOverlays(THREE, editor) {
    const centerSet = new Set(editor.centerVertexIndices); const centerEdges = new Set(); const centerLinePositions = [];
    for (let offset = 0; offset < editor.indices.length; offset += 3) {
      const triangle = [editor.indices[offset], editor.indices[offset + 1], editor.indices[offset + 2]];
      for (let corner = 0; corner < 3; corner += 1) {
        const a = triangle[corner]; const b = triangle[(corner + 1) % 3];
        if (!centerSet.has(a) || !centerSet.has(b)) continue;
        const key = a < b ? `${a}/${b}` : `${b}/${a}`;
        if (centerEdges.has(key)) continue; centerEdges.add(key);
        appendVertex(centerLinePositions, editor.base, a); appendVertex(centerLinePositions, editor.base, b);
      }
    }
    const centerline = new THREE.Group();
    const centerLineGeometry = new THREE.BufferGeometry(); centerLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(centerLinePositions, 3));
    centerline.add(new THREE.LineSegments(centerLineGeometry, new THREE.LineBasicMaterial({ color: 0xff315a })));
    centerline.add(createPointCloud(THREE, editor.base, editor.centerVertexIndices, 0xffd166, 0.006));

    const symmetry = new THREE.Group(); const symmetryPositions = []; const stride = Math.max(1, Math.floor(editor.leftVertexIndices.length / 240));
    for (let index = 0; index < editor.leftVertexIndices.length; index += stride) {
      const vertex = editor.leftVertexIndices[index]; const counterpart = editor.symmetryPartner[vertex];
      appendVertex(symmetryPositions, editor.base, vertex); appendVertex(symmetryPositions, editor.base, counterpart);
    }
    const symmetryGeometry = new THREE.BufferGeometry(); symmetryGeometry.setAttribute('position', new THREE.Float32BufferAttribute(symmetryPositions, 3));
    symmetry.add(new THREE.LineSegments(symmetryGeometry, new THREE.LineBasicMaterial({ color: 0x5be7ff, transparent: true, opacity: 0.52 })));

    const symmetricSeeds = [
      nearestSideVertex(editor, 1, [-0.235, 0.430, 0.050]), nearestSideVertex(editor, 1, [-0.135, 0.170, 0.120]),
      nearestSideVertex(editor, 1, [-0.165, -0.030, 0.080]), nearestSideVertex(editor, 1, [-0.055, 0.700, 0.150]),
    ];
    const symmetricVertices = symmetricSeeds.flatMap((vertex) => [vertex, editor.symmetryPartner[vertex]]);
    const symmetricEdit = createPointCloud(THREE, editor.base, symmetricVertices, 0x44f6a1, 0.014);
    const asymmetricVertices = [
      nearestSideVertex(editor, 1, [-0.235, 0.430, 0.050]), nearestSideVertex(editor, 1, [-0.055, 0.700, 0.150]),
      nearestSideVertex(editor, 2, [0.120, 0.010, 0.100]), nearestSideVertex(editor, 2, [0.180, -0.480, 0.030]),
    ];
    const asymmetricEdit = createPointCloud(THREE, editor.base, asymmetricVertices, 0xffad45, 0.014);
    for (const object of [centerline, symmetry, symmetricEdit, asymmetricEdit]) object.visible = false;
    return { centerline, symmetry, symmetricEdit, asymmetricEdit };
  }

  function createPointCloud(THREE, positions, vertices, color, size) {
    const pointPositions = []; for (const vertex of vertices) appendVertex(pointPositions, positions, vertex);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
    return new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, depthTest: true }));
  }

  function appendVertex(output, positions, vertex) {
    const offset = vertex * 3; output.push(positions[offset], positions[offset + 1], positions[offset + 2]);
  }

  function nearestSideVertex(editor, side, target) {
    const vertices = side === 1 ? editor.leftVertexIndices : editor.rightVertexIndices;
    let best = vertices[0]; let bestDistance = Infinity;
    for (const vertex of vertices) {
      const offset = vertex * 3; const distance = Math.hypot(editor.base[offset] - target[0], editor.base[offset + 1] - target[1], editor.base[offset + 2] - target[2]);
      if (distance < bestDistance) { best = vertex; bestDistance = distance; }
    }
    return best;
  }

  function bindControls(THREE, root, viewport, editor, scene, evidence) {
    const shell = root.querySelector('.layout'); const view = root.querySelector('[data-view]'); const toolbarView = root.querySelector('[data-toolbar-view]');
    const region = root.querySelector('[data-region]'); const mode = root.querySelector('[data-mode]'); const surface = root.querySelector('[data-toolbar-surface]');
    const panelToggle = root.querySelector('[data-toggle-panel]'); const focusToggle = root.querySelector('[data-focus]');
    let panelMode = null; let panelOpen = false; let focusMode = false; let panelBeforeFocus = false;
    view.value = scene.presentation.view; toolbarView.value = scene.presentation.view; region.value = scene.presentation.region; mode.value = scene.presentation.mode; surface.value = scene.presentation.surface;
    const applySelectedView = (selectedView) => {
      scene.presentation.view = selectedView; view.value = selectedView; toolbarView.value = selectedView;
      applyView(selectedView, scene.controls); scene.applyPresentation(); scene.cameraSafety.fitCurrentRegion('view-change');
    };
    view.addEventListener('change', () => applySelectedView(view.value));
    toolbarView.addEventListener('change', () => applySelectedView(toolbarView.value));
    region.addEventListener('change', () => scene.cameraSafety.setRegion(region.value, { reason: 'region-change' }));
    mode.addEventListener('change', () => { scene.presentation.mode = mode.value; scene.applyPresentation(); scene.scheduleViewportSync('mode-change'); });
    surface.addEventListener('change', () => {
      scene.presentation.surface = surface.value;
      if (scene.presentation.mode === 'production-wireframe') { scene.presentation.mode = 'production-full'; mode.value = 'production-full'; }
      scene.applyPresentation(); scene.scheduleViewportSync('surface-mode-change');
    });
    function updateLayoutControls() {
      shell.classList.toggle('panel-open', panelOpen && !focusMode); shell.classList.toggle('focus-mode', focusMode);
      panelToggle.textContent = panelOpen && !focusMode ? '隐藏参数' : '显示参数'; panelToggle.setAttribute('aria-expanded', String(panelOpen && !focusMode));
      focusToggle.textContent = focusMode ? '退出专注' : '专注查看'; focusToggle.setAttribute('aria-pressed', String(focusMode));
      Object.assign(evidence.layoutMetrics, { panelMode, panelOpen: panelOpen && !focusMode, focusMode, fullscreen: Boolean(document.fullscreenElement) });
    }
    function setPanelOpen(next, reason) { panelOpen = Boolean(next); updateLayoutControls(); scene.scheduleViewportSync(reason || 'panel-toggle'); }
    function setFocusMode(next) {
      if (next === focusMode) return;
      if (next) { panelBeforeFocus = panelOpen; focusMode = true; }
      else { focusMode = false; panelOpen = panelBeforeFocus; }
      updateLayoutControls(); scene.scheduleViewportSync('focus-mode-change');
    }
    function syncResponsiveMode(forceDefault) {
      const nextMode = computePanelMode(global.innerWidth || shell.clientWidth || 1280); const changed = nextMode !== panelMode;
      panelMode = nextMode;
      if ((changed || forceDefault) && !focusMode) panelOpen = nextMode === 'docked-right';
      updateLayoutControls();
      if (changed && !forceDefault) scene.scheduleViewportSync('responsive-panel-mode-change');
    }
    panelToggle.addEventListener('click', () => setPanelOpen(!panelOpen, 'panel-toggle'));
    root.querySelector('[data-panel-backdrop]').addEventListener('click', () => setPanelOpen(false, 'panel-backdrop-close'));
    focusToggle.addEventListener('click', () => setFocusMode(!focusMode));
    root.querySelector('[data-fit-full]').addEventListener('click', () => scene.cameraSafety.fitFullBody('fit-full-body-button'));
    root.querySelector('[data-fit-region]').addEventListener('click', () => scene.cameraSafety.fitCurrentRegion('fit-current-region-button'));
    root.querySelector('[data-return-full]').addEventListener('click', () => scene.cameraSafety.fitFullBody('return-full-body-button'));
    root.querySelector('[data-lock-visible]').addEventListener('change', (event) => scene.cameraSafety.setLockVisible(event.target.checked));
    root.querySelector('[data-restore-camera]').addEventListener('click', () => { if (!scene.cameraSafety.restoreLastValidCameraState()) root.querySelector('[data-camera-notice]').textContent = '尚无最近合法相机状态'; });
    root.querySelectorAll('[data-region-jump]').forEach((button) => button.addEventListener('click', () => scene.cameraSafety.setRegion(button.dataset.regionJump, { reason: 'region-quick-button' })));
    const resetCamera = () => { scene.presentation.view = 'front'; view.value = 'front'; toolbarView.value = 'front'; applyView('front', scene.controls); scene.applyPresentation(); scene.cameraSafety.fitFullBody('reset-camera'); };
    root.querySelector('[data-reset-camera]').addEventListener('click', resetCamera);
    root.querySelector('[data-enter-fullscreen]').addEventListener('click', async () => {
      try { if (!document.fullscreenElement) await shell.requestFullscreen(); }
      catch (error) { evidence.pageErrors.push(`FULLSCREEN_REQUEST_FAILED: ${error.message}`); }
    });
    root.querySelector('[data-exit-fullscreen]').addEventListener('click', async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
    document.addEventListener('fullscreenchange', () => { updateLayoutControls(); scene.scheduleViewportSync('fullscreen-control-change'); });
    global.addEventListener('resize', () => syncResponsiveMode(false));
    document.addEventListener('keydown', (event) => {
      const tag = event.target && event.target.tagName; const editing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (event.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen();
        if (panelOpen && panelMode !== 'docked-right') setPanelOpen(false, 'escape-close-panel');
        return;
      }
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); scene.cameraSafety.fitFullBody('hotkey-fit-full-body'); }
      else if (event.key.toLowerCase() === 'h') { event.preventDefault(); setPanelOpen(!panelOpen, 'hotkey-panel-toggle'); }
      else if (event.key.toLowerCase() === 'r') { event.preventDefault(); resetCamera(); }
    });
    syncResponsiveMode(true);
    const parameterHost = root.querySelector('.parameters');
    editor.header.parameters.forEach((definition, index) => {
      const row = document.createElement('label'); row.className = 'slider-row';
      row.innerHTML = `<span>${escapeHtml(definition.label)}</span><output>0.00</output><input type="range" min="${definition.minimum}" max="${definition.maximum}" step="0.01" value="0">`;
      const input = row.querySelector('input'); const output = row.querySelector('output');
      input.addEventListener('input', () => { output.value = Number(input.value).toFixed(2); editor.setParameter(index, Number(input.value), true); });
      parameterHost.appendChild(row);
    });
    root.querySelector('[data-undo]').addEventListener('click', () => editor.undoCommand());
    root.querySelector('[data-redo]').addEventListener('click', () => editor.redoCommand());
    root.querySelector('[data-reset-shape]').addEventListener('click', () => { editor.reset(); parameterHost.querySelectorAll('input').forEach((input) => { input.value = 0; input.closest('label').querySelector('output').value = '0.00'; }); });
    const sculptToggle = root.querySelector('[data-sculpt]'); const symmetricEditToggle = root.querySelector('[data-symmetric-edit]'); const centerlineOffsetToggle = root.querySelector('[data-centerline-offset]'); const radius = root.querySelector('[data-radius]'); const strength = root.querySelector('[data-strength]');
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let dragging = false; let moved = false; let panning = false; let previous = [0, 0]; let wheelSafetyTimer = 0;
    scene.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    scene.renderer.domElement.addEventListener('pointerdown', (event) => { dragging = true; moved = false; panning = event.button === 2 || event.shiftKey || event.ctrlKey || event.metaKey; previous = [event.clientX, event.clientY]; scene.renderer.domElement.setPointerCapture(event.pointerId); });
    scene.renderer.domElement.addEventListener('pointermove', (event) => {
      if (!dragging) return; const dx = event.clientX - previous[0]; const dy = event.clientY - previous[1]; previous = [event.clientX, event.clientY];
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      if (!sculptToggle.checked) {
        if (panning) {
          scene.camera.updateMatrixWorld(true); const scale = 2 * scene.controls.distance * Math.tan(scene.camera.fov * Math.PI / 360) / Math.max(1, viewport.clientHeight);
          const right = new THREE.Vector3().setFromMatrixColumn(scene.camera.matrixWorld, 0); const up = new THREE.Vector3().setFromMatrixColumn(scene.camera.matrixWorld, 1);
          scene.controls.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale); scene.cameraSafety.clampTarget(); scene.updateCamera();
        } else { scene.controls.yaw -= dx * 0.008; scene.controls.pitch = clamp(scene.controls.pitch + dy * 0.006, -1.25, 1.25); scene.updateCamera(); }
      }
    });
    scene.renderer.domElement.addEventListener('pointerup', (event) => {
      if (sculptToggle.checked && !moved && scene.presentation.model !== 'reference') {
        const rect = scene.renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, scene.camera);
        const hit = raycaster.intersectObject(scene.production.solid, false)[0];
        if (hit) { const local = scene.production.solid.worldToLocal(hit.point.clone()); const normals = scene.productionGeometry.getAttribute('normal').array; const changed = editor.brush(local, Number(radius.value), Number(strength.value), normals, symmetricEditToggle.checked, centerlineOffsetToggle.checked); root.querySelector('[data-brush-result]').textContent = `${changed} vertices edited`; }
      }
      dragging = false; scene.cameraSafety.handleInteractionEnd(panning ? 'pan-end' : 'rotate-or-sculpt-end'); panning = false;
    });
    scene.renderer.domElement.addEventListener('pointercancel', () => { dragging = false; panning = false; scene.cameraSafety.handleInteractionEnd('pointer-cancel'); });
    scene.renderer.domElement.addEventListener('wheel', (event) => {
      event.preventDefault(); scene.controls.distance *= Math.exp(event.deltaY * 0.001); scene.cameraSafety.enforceDistance(); scene.cameraSafety.updateClipPlanes(); scene.renderer.render(scene.scene, scene.camera);
      global.clearTimeout(wheelSafetyTimer); wheelSafetyTimer = global.setTimeout(() => scene.cameraSafety.handleInteractionEnd('wheel-end'), 100);
    }, { passive: false });
    evidence.controls = { orbit: true, pan: true, zoom: true, minDistance: true, maxDistance: true, cameraSafetyController: 'CameraSafetyControllerV1', lockVisible: true, regionalInspection: true, resetCamera: true, fitFullBody: true, fitCurrentRegion: true, restoreLastValidCameraState: true, panelToggle: true, focusMode: true, fullscreen: true, hotkeys: ['F', 'H', 'R', 'Escape'], parameterSliders: editor.header.parameters.length, sculptBrush: true, symmetricEdit: true, asymmetricEdit: true, centerlineOffsetExperiment: true, undoRedo: true };
  }

  function applyPresentation(presentation, reference, production, root, evidence) {
    const mode = presentation.mode; const failed = production.failedHistorical; const diagnostics = production.diagnostics;
    const surfaceMode = mode === 'production-wireframe' ? 'wireframe' : presentation.surface || 'solid';
    reference.group.visible = mode === 'reference-compare'; failed.group.visible = mode === 'failed-mirror-compare'; production.group.visible = true;
    reference.group.position.x = 0; failed.group.position.x = 0; production.group.position.x = 0;
    if (mode === 'reference-compare') { reference.group.position.x = -0.52; production.group.position.x = 0.52; }
    if (mode === 'failed-mirror-compare') { failed.group.position.x = -0.52; production.group.position.x = 0.52; }
    for (const surface of [reference, failed, production]) {
      surface.solidMaterial.transparent = false; surface.solidMaterial.opacity = 1;
      surface.solid.visible = surface.group.visible && surfaceMode !== 'wireframe'; surface.wire.visible = surface.group.visible && surfaceMode !== 'solid'; surface.wireMaterial.opacity = 0.68;
    }
    for (const object of [diagnostics.centerline, diagnostics.symmetry, diagnostics.symmetricEdit, diagnostics.asymmetricEdit]) object.visible = false;
    diagnostics.centerline.visible = mode === 'centerline';
    diagnostics.symmetry.visible = mode === 'symmetry-map';
    diagnostics.symmetricEdit.visible = mode === 'symmetric-edit-test';
    diagnostics.asymmetricEdit.visible = mode === 'asymmetric-edit-test';
    if (mode === 'centerline' || mode === 'symmetry-map' || mode === 'symmetric-edit-test' || mode === 'asymmetric-edit-test') {
      production.solidMaterial.transparent = true; production.solidMaterial.opacity = 0.58;
    }
    const labels = {
      'production-full': 'HRL FULL BILATERAL SURFACE V1 · SINGLE COMPLETE PRODUCTION SURFACE · PENDING USER REVIEW',
      'production-wireframe': 'FULL BILATERAL WIREFRAME · ONE INDEXED BUFFERGEOMETRY',
      centerline: 'UNIQUE CENTERLINE · SHARED BY LEFT AND RIGHT TRIANGLES',
      'symmetry-map': 'SYMMETRY PARTNER MAP · INDEPENDENT LEFT/RIGHT VERTICES',
      'symmetric-edit-test': 'DETERMINISTIC SYMMETRIC EDIT TEST · GREEN PAIRED TARGETS',
      'asymmetric-edit-test': 'DETERMINISTIC ASYMMETRIC EDIT TEST · ORANGE INDEPENDENT TARGETS',
      'reference-compare': 'CC0 REFERENCE  ↔  HRL FULL BILATERAL SURFACE V1',
      'failed-mirror-compare': 'HISTORICAL CENTERLINE FAILURE  ↔  FULL BILATERAL RECONSTRUCTION',
    };
    root.querySelector('[data-identity]').textContent = labels[mode] || labels['production-full'];
    evidence.model = mode === 'reference-compare' ? 'reference-compare' : mode === 'failed-mirror-compare' ? 'failed-mirror-compare' : 'production';
    evidence.view = presentation.view; evidence.mode = mode; evidence.surfaceMode = surfaceMode; evidence.closeup = presentation.closeup || null;
    evidence.visibleMeshCount = 1 + (reference.group.visible ? 1 : 0) + (failed.group.visible ? 1 : 0);
    evidence.humanSurfaceCount = 1;
  }

  function applyView(view, controls) {
    controls.view = view; controls.pitch = 0.02;
    if (view === 'front') controls.yaw = 0;
    else if (view === 'side') controls.yaw = Math.PI / 2;
    else if (view === 'back') controls.yaw = Math.PI;
    else controls.yaw = Math.PI / 4;
  }

  function updateCamera(camera, controls) {
    const cp = Math.cos(controls.pitch); camera.position.set(controls.target.x + Math.sin(controls.yaw) * cp * controls.distance, controls.target.y + Math.sin(controls.pitch) * controls.distance, controls.target.z + Math.cos(controls.yaw) * cp * controls.distance); camera.lookAt(controls.target);
  }

  function shellMarkup() {
    return `<main class="layout" data-app-shell>
      <header class="topbar">
        <div class="topbar-title">HRLSurface V1 · 完整双侧人体离线验收</div>
        <nav class="toolbar" aria-label="视口工具栏">
          <button type="button" data-focus>专注查看</button>
          <button type="button" data-toggle-panel aria-controls="hrl-parameter-panel">显示参数</button>
          <button type="button" data-fit-full title="快捷键 F">适应全身</button>
          <button type="button" data-reset-camera title="快捷键 R">重置视角</button>
          <span class="toolbar-label">视角</span><select data-toolbar-view aria-label="视角"><option value="front">正面</option><option value="side">侧面</option><option value="back">背面</option><option value="three-quarter">四分之三</option></select>
          <span class="toolbar-label">表面</span><select data-toolbar-surface aria-label="表面显示"><option value="solid">实体</option><option value="wireframe">线框</option><option value="solid-wireframe">实体+线框</option></select>
          <button type="button" data-enter-fullscreen>全屏</button><button type="button" data-exit-fullscreen>退出全屏</button>
          <span class="shortcut">F 适应 · H 参数 · R 重置 · Esc 退出</span>
        </nav>
      </header>
      <section class="workspace">
        <section class="viewport" aria-label="人体三维视口"><div class="identity" data-identity></div><div class="camera-notice" data-camera-notice role="status" aria-live="polite"></div><div class="hint">拖动：旋转 · Shift/右键拖动：平移 · 滚轮：安全缩放 · Sculpt：点击表面</div></section>
        <button type="button" class="panel-backdrop" data-panel-backdrop aria-label="关闭参数面板"></button>
        <aside class="panel" id="hrl-parameter-panel" data-panel>
          <header class="panel-header"><p class="eyebrow">HRLFullBilateralSurfaceV1</p><h1>生产表面验收</h1><p class="subtitle"><strong>一个完整 BufferGeometry</strong> · <strong>无需网络</strong></p><div class="status" data-status>正在启动…</div><div class="error-panel" hidden></div></header>
          <div class="panel-scroll">
            <details open><summary>验收模式</summary><div class="detail-body">
              <label>模式<select data-mode><option value="production-full">production-full</option><option value="production-wireframe">production-wireframe</option><option value="centerline">centerline</option><option value="symmetry-map">symmetry-map</option><option value="symmetric-edit-test">symmetric-edit-test</option><option value="asymmetric-edit-test">asymmetric-edit-test</option><option value="reference-compare">reference-compare</option><option value="failed-mirror-compare">failed-mirror-compare</option></select></label>
              <label>视角<select data-view><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option><option value="three-quarter">Three-quarter</option></select></label>
              <label>局部检查<select data-region><option value="full-body">全身</option><option value="head-face">头脸</option><option value="neck-shoulder">颈肩</option><option value="left-axilla">左肩腋窝</option><option value="right-axilla">右肩腋窝</option><option value="left-elbow">左肘</option><option value="right-elbow">右肘</option><option value="left-hand">左手</option><option value="right-hand">右手</option><option value="pelvis-groin">骨盆与腹股沟</option><option value="left-knee">左膝</option><option value="right-knee">右膝</option><option value="left-ankle-foot">左踝足</option><option value="right-ankle-foot">右踝足</option><option value="back-centerline">背部中心线</option><option value="front-centerline">正面中心线</option></select></label>
              <label class="check"><input type="checkbox" data-lock-visible checked> 锁定人体可见</label>
              <div class="button-row"><button type="button" data-fit-region>适应当前区域</button><button type="button" data-return-full>返回全身</button><button type="button" data-restore-camera>最近相机状态</button></div>
              <div class="button-row region-quick-buttons"><button type="button" data-region-jump="head-face">查看头脸</button><button type="button" data-region-jump="left-axilla">查看肩腋窝</button><button type="button" data-region-jump="pelvis-groin">查看骨盆</button><button type="button" data-region-jump="left-hand">查看手部</button><button type="button" data-region-jump="left-ankle-foot">查看脚部</button></div>
            </div></details>
            <details><summary>直接雕刻</summary><div class="detail-body">
              <label class="check"><input type="checkbox" data-sculpt> Sculpt 模式</label><label class="check"><input type="checkbox" data-symmetric-edit checked> 对称编辑</label><label class="check"><input type="checkbox" data-centerline-offset> 中心线偏移实验</label>
              <label>半径<input type="range" min="0.01" max="0.12" step="0.005" value="0.045" data-radius></label><label>强度<input type="range" min="-0.01" max="0.01" step="0.0005" value="0.002" data-strength></label><small data-brush-result>尚未雕刻</small>
              <div class="button-row"><button type="button" data-undo>撤销</button><button type="button" data-redo>重做</button><button type="button" data-reset-shape>重置形态</button></div>
            </div></details>
            <details open><summary>连续形态参数</summary><div class="detail-body"><div class="parameters"></div></div></details>
            <details><summary>双侧和中心线诊断</summary><div class="detail-body"><dl class="diagnostic-list"><dt>左侧顶点</dt><dd>8098</dd><dt>右侧顶点</dt><dd>8098</dd><dt>中心线顶点</dt><dd>188</dd><dt>镜像运行操作</dt><dd>0</dd><dt>负缩放节点</dt><dd>0</dd></dl></div></details>
            <details><summary>数值状态</summary><div class="detail-body"><pre class="numeric-status" data-layout-status>等待首次取景…</pre></div></details>
            <details><summary>相机诊断</summary><div class="detail-body"><pre class="numeric-status camera-status" data-camera-status>等待 CameraSafetyControllerV1…</pre></div></details>
          </div>
          <footer class="panel-footer">visualAcceptance=false · productionReady=false · userVisualAcceptance=pending</footer>
        </aside>
      </section>
    </main>`;
  }

  function showErrorPanel(root, state) {
    const panel = root.querySelector('.error-panel'); panel.hidden = false;
    panel.textContent = [
      `errorCode: ${state.errorCode}`,
      `errorMessage: ${state.errorMessage}`,
      `browser: ${state.browser}`,
      `fileProtocol: ${state.fileProtocol}`,
      `webglAvailable: ${state.webglAvailable}`,
      `assetEmbedded: ${state.assetEmbedded}`,
      `assetDecoded: ${state.assetDecoded}`,
      `assetHashVerified: ${state.assetHashVerified}`,
      `surfaceCreated: ${state.surfaceCreated}`,
      `rendererCreated: ${state.rendererCreated}`,
      `firstFrameRendered: ${state.firstFrameRendered}`,
      '',
      '页面空白时，请将以上错误码和截图返回。资源读取失败不代表 WebGL 不可用。',
    ].join('\n');
  }

  function codedError(code, message, cause) { const error = new Error(message, cause ? { cause } : undefined); error.code = code; return error; }
  function normalizeStartupError(error) {
    const errorMessage = String(error?.message || error);
    let errorCode = error?.code;
    if (!Object.values(ERROR_CODES).includes(errorCode)) {
      if (/shader|program.*runnable/i.test(errorMessage)) errorCode = ERROR_CODES.WEBGL_SHADER_COMPILE_FAILED;
      else if (/webgl|context/i.test(errorMessage)) errorCode = ERROR_CODES.WEBGL_CONTEXT_UNAVAILABLE;
      else errorCode = ERROR_CODES.UNKNOWN_STARTUP_FAILURE;
    }
    return { errorCode, errorMessage, stack: String(error?.stack || '') };
  }

  function stringifyErrorValue(value) { return value instanceof Error ? String(value.stack || value.message) : typeof value === 'string' ? value : JSON.stringify(value); }
  function typedArrayBytes(array) { return new Uint8Array(array.buffer, array.byteOffset, array.byteLength); }
  function base64ToBytes(value) { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return bytes; }
  function sha256Hex(bytes) {
    const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const hash = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
    const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64; const padded = new Uint8Array(paddedLength); padded.set(bytes); padded[bytes.length] = 0x80;
    const bitLength = bytes.length * 8; const paddingView = new DataView(padded.buffer); paddingView.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false); paddingView.setUint32(paddedLength - 4, bitLength >>> 0, false);
    const words = new Uint32Array(64); const rotate = (value, bits) => (value >>> bits) | (value << (32 - bits));
    for (let block = 0; block < paddedLength; block += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = paddingView.getUint32(block + index * 4, false);
      for (let index = 16; index < 64; index += 1) { const s0 = rotate(words[index - 15], 7) ^ rotate(words[index - 15], 18) ^ (words[index - 15] >>> 3); const s1 = rotate(words[index - 2], 17) ^ rotate(words[index - 2], 19) ^ (words[index - 2] >>> 10); words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0; }
      let [a,b,c,d,e,f,g,h] = hash;
      for (let index = 0; index < 64; index += 1) { const s1 = rotate(e,6) ^ rotate(e,11) ^ rotate(e,25); const choice = (e & f) ^ (~e & g); const temp1 = (h + s1 + choice + constants[index] + words[index]) >>> 0; const s0 = rotate(a,2) ^ rotate(a,13) ^ rotate(a,22); const majority = (a & b) ^ (a & c) ^ (b & c); const temp2 = (s0 + majority) >>> 0; h=g; g=f; f=e; e=(d+temp1)>>>0; d=c; c=b; b=a; a=(temp1+temp2)>>>0; }
      hash[0]=(hash[0]+a)>>>0; hash[1]=(hash[1]+b)>>>0; hash[2]=(hash[2]+c)>>>0; hash[3]=(hash[3]+d)>>>0; hash[4]=(hash[4]+e)>>>0; hash[5]=(hash[5]+f)>>>0; hash[6]=(hash[6]+g)>>>0; hash[7]=(hash[7]+h)>>>0;
    }
    return Array.from(hash, (value) => value.toString(16).padStart(8, '0')).join('').toUpperCase();
  }
  function query(name, fallback) { return new URLSearchParams(global.location.search).get(name) || fallback; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }

  global.HRLProductionSurfaceApp = { start, ERROR_CODES, sha256Hex, computePanelMode, computeResponsiveViewport, computeFitDistanceForBounds, projectBoundsForLayout };
})(globalThis);
