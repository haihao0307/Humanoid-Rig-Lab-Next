(function (global) {
  'use strict';

  const MAGIC = 'HRLSURF1';
  const TYPE_INFO = {
    float32: [Float32Array, 4], float64: [Float64Array, 8], uint8: [Uint8Array, 1],
    uint16: [Uint16Array, 2], uint32: [Uint32Array, 4], int32: [Int32Array, 4],
  };

  async function start(config) {
    const THREE = global.THREE;
    if (!THREE) throw new Error('The project-local Three.js IIFE bundle is missing.');
    const root = document.querySelector(config.rootSelector || '#app');
    root.innerHTML = shellMarkup();
    const viewport = root.querySelector('.viewport');
    const status = root.querySelector('[data-status]');
    const state = installEvidenceState(config);
    try {
      status.textContent = 'Loading embedded editable surface…';
      const [surfaceBytes, referenceBytes] = await Promise.all([
        readAsset(config.productionUrl, 'production'),
        readAsset(config.referenceUrl, 'reference'),
      ]);
      const parsed = parseHrlSurface(surfaceBytes);
      const reference = parseReferenceGlb(referenceBytes);
      const editor = createEditor(parsed);
      const scene = createScene(THREE, viewport, editor, reference, root, state);
      bindControls(THREE, root, viewport, editor, scene, state);
      status.textContent = 'HRLSurface ready — drag to orbit, wheel to zoom, enable Sculpt to reshape.';
      state.ready = true;
      state.schema = parsed.header.schema;
      state.vertexCount = parsed.header.topology.vertexCount;
      state.triangleCount = parsed.header.topology.triangleCount;
      state.topologyFingerprint = parsed.header.topology.topologyFingerprint;
      state.parameterCount = parsed.header.parameters.length;
      state.deformationRegionCount = parsed.header.deformationRegions.length;
      state.editable = true;
      state.visualAcceptance = false;
      state.productionReady = false;
      state.userVisualAcceptance = 'pending';
      root.classList.add('ready');
    } catch (error) {
      state.pageErrors.push(String(error && error.stack || error));
      state.ready = false;
      state.loadError = String(error && error.message || error);
      status.textContent = `Load failed: ${state.loadError}`;
      root.querySelector('.error-panel').hidden = false;
      root.querySelector('.error-panel').textContent = `${state.loadError}\n\nUse a current Chrome, Edge, or Firefox browser with WebGL enabled.`;
      console.error(error);
    }
  }

  function installEvidenceState(config) {
    const state = {
      schema: null, ready: false, pageErrors: [], consoleErrors: [], failedRequests: 0,
      externalHumanAssetRequests: 0, loadedHumanAssetPaths: [], editable: false,
      model: null, view: null, mode: null,
    };
    global.__HRL_PRODUCTION_SURFACE_V1__ = state;
    global.addEventListener('error', (event) => state.pageErrors.push(event.error ? String(event.error.stack || event.error) : event.message));
    global.addEventListener('unhandledrejection', (event) => state.pageErrors.push(String(event.reason && event.reason.stack || event.reason)));
    for (const url of [config.productionUrl, config.referenceUrl]) {
      if (!url) continue;
      state.loadedHumanAssetPaths.push(url);
      if (/^(https?:)?\/\//i.test(url)) state.externalHumanAssetRequests += 1;
    }
    if (global.__HRL_EMBEDDED_ASSETS__) state.loadedHumanAssetPaths = ['embedded:humanoid-rig-production-neutral-v1.hrlsurface', 'embedded:makehuman-reference-neutral-static-v1.glb'];
    return state;
  }

  async function readAsset(url, kind) {
    const embedded = global.__HRL_EMBEDDED_ASSETS__ && global.__HRL_EMBEDDED_ASSETS__[kind];
    if (embedded) return base64ToBytes(embedded);
    const response = await fetch(url);
    if (!response.ok) {
      global.__HRL_PRODUCTION_SURFACE_V1__.failedRequests += 1;
      throw new Error(`Asset request failed: ${response.status} ${url}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  function parseHrlSurface(bytes) {
    const magic = new TextDecoder().decode(bytes.subarray(0, 8));
    if (magic !== MAGIC) throw new Error(`Invalid HRLSurface magic: ${magic}`);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const jsonLength = view.getUint32(8, true);
    const dataOffset = view.getUint32(12, true);
    const header = JSON.parse(new TextDecoder().decode(bytes.subarray(16, 16 + jsonLength)));
    const chunks = {};
    Object.entries(header.chunks).forEach(([name, descriptor]) => {
      const info = TYPE_INFO[descriptor.type];
      if (!info) throw new Error(`Unsupported chunk ${name}:${descriptor.type}`);
      const copied = bytes.slice(dataOffset + descriptor.byteOffset, dataOffset + descriptor.byteOffset + descriptor.byteLength);
      chunks[name] = new info[0](copied.buffer, copied.byteOffset, descriptor.count);
    });
    return { header, chunks };
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
    const symmetry = new Uint32Array(parsed.chunks.symmetryMap);
    const sculpt = new Float32Array(base.length);
    const values = new Float32Array(parsed.header.parameters.length);
    const undo = []; const redo = []; const listeners = new Set();
    const editor = {
      header: parsed.header, base, positions, indices, basis, symmetry, sculpt, values, undo, redo,
      setParameter(index, value, record) {
        const previous = values[index]; if (previous === value) return;
        values[index] = value; if (record !== false) push({ type: 'parameter', index, previous, next: value }); rebuild();
      },
      brush(center, radius, strength, normals, mirror) {
        const changes = new Map();
        for (let vertex = 0; vertex < positions.length / 3; vertex += 1) {
          const offset = vertex * 3; const distance = Math.hypot(positions[offset] - center.x, positions[offset + 1] - center.y, positions[offset + 2] - center.z);
          if (distance >= radius) continue;
          const t = 1 - distance / radius; const amount = strength * t * t * (3 - 2 * t);
          add(vertex, normals[offset] * amount, normals[offset + 1] * amount, normals[offset + 2] * amount);
          if (mirror) { const counterpart = symmetry[vertex]; if (counterpart !== vertex) add(counterpart, -normals[offset] * amount, normals[offset + 1] * amount, normals[offset + 2] * amount); }
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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    viewport.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x10151d);
    const camera = new THREE.PerspectiveCamera(32, viewport.clientWidth / viewport.clientHeight, 0.01, 20);
    scene.add(new THREE.HemisphereLight(0xf0f6ff, 0x263040, 2.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 2.3, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x82b9ff, 1.4); rim.position.set(-2, 1, -1.6); scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ color: 0x171d27, roughness: 0.95, metalness: 0, side: THREE.FrontSide }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.825; scene.add(ground);

    const productionGeometry = new THREE.BufferGeometry();
    productionGeometry.setAttribute('position', new THREE.BufferAttribute(editor.positions, 3).setUsage(THREE.DynamicDrawUsage));
    productionGeometry.setIndex(new THREE.BufferAttribute(editor.indices, 1)); productionGeometry.computeVertexNormals(); productionGeometry.computeBoundingSphere();
    const referenceGeometry = new THREE.BufferGeometry();
    referenceGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(reference.positions), 3));
    referenceGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(reference.normals), 3)); referenceGeometry.setIndex(new THREE.BufferAttribute(reference.indices, 1));
    if (reference.matrix) referenceGeometry.applyMatrix4(new THREE.Matrix4().fromArray(reference.matrix));

    const production = createSurfaceGroup(THREE, productionGeometry, 0x8ebfd0, 0x173a4b);
    const referenceGroup = createSurfaceGroup(THREE, referenceGeometry, 0xd1a274, 0x59351f);
    production.solid.name = 'HumanoidRigProductionSurfaceV1'; referenceGroup.solid.name = 'MakeHumanCC0ReferenceOnly';
    scene.add(referenceGroup.group, production.group);
    const controls = { yaw: 0, pitch: 0.02, distance: 2.45, target: new THREE.Vector3(0, 0.015, 0.08), view: 'front' };
    const presentation = { model: query('model', 'production'), view: query('view', 'front'), mode: query('mode', 'solid'), closeup: query('closeup', '') };
    applyView(presentation.view, controls); applyCloseup(presentation.closeup, controls); applyPresentation(presentation, referenceGroup, production, root, evidence);
    updateCamera(camera, controls);

    editor.onChange(() => {
      const attribute = productionGeometry.getAttribute('position'); attribute.needsUpdate = true; attribute.clearUpdateRanges(); attribute.addUpdateRange(0, editor.positions.length);
      productionGeometry.computeVertexNormals(); productionGeometry.computeBoundingBox(); productionGeometry.computeBoundingSphere();
    });
    const resize = () => { const width = viewport.clientWidth; const height = viewport.clientHeight; renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); };
    new ResizeObserver(resize).observe(viewport);
    function render() { renderer.render(scene, camera); global.requestAnimationFrame(render); }
    render();
    evidence.renderer = renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1';
    evidence.visibleMeshCount = presentation.model === 'compare' ? 4 : presentation.model === 'overlay' ? 4 : 2;
    return { renderer, scene, camera, controls, presentation, production, referenceGroup, productionGeometry, updateCamera: () => updateCamera(camera, controls), applyPresentation: () => applyPresentation(presentation, referenceGroup, production, root, evidence) };
  }

  function createSurfaceGroup(THREE, geometry, color, wireColor) {
    const group = new THREE.Group();
    const solidMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0, side: THREE.FrontSide });
    const wireMaterial = new THREE.MeshBasicMaterial({ color: wireColor, wireframe: true, transparent: true, opacity: 0.68, side: THREE.FrontSide });
    const solid = new THREE.Mesh(geometry, solidMaterial); const wire = new THREE.Mesh(geometry, wireMaterial);
    wire.renderOrder = 2; group.add(solid, wire); return { group, solid, wire, solidMaterial, wireMaterial };
  }

  function bindControls(THREE, root, viewport, editor, scene, evidence) {
    const model = root.querySelector('[data-model]'); const view = root.querySelector('[data-view]'); const mode = root.querySelector('[data-mode]');
    model.value = scene.presentation.model; view.value = scene.presentation.view; mode.value = scene.presentation.mode;
    model.addEventListener('change', () => { scene.presentation.model = model.value; scene.applyPresentation(); });
    view.addEventListener('change', () => { scene.presentation.view = view.value; scene.presentation.closeup = ''; applyView(view.value, scene.controls); scene.updateCamera(); scene.applyPresentation(); });
    mode.addEventListener('change', () => { scene.presentation.mode = mode.value; scene.applyPresentation(); });
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
    root.querySelector('[data-reset-camera]').addEventListener('click', () => { applyView(scene.presentation.view, scene.controls); applyCloseup(scene.presentation.closeup, scene.controls); scene.updateCamera(); });
    const sculptToggle = root.querySelector('[data-sculpt]'); const mirrorToggle = root.querySelector('[data-mirror]'); const radius = root.querySelector('[data-radius]'); const strength = root.querySelector('[data-strength]');
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let dragging = false; let moved = false; let previous = [0, 0];
    scene.renderer.domElement.addEventListener('pointerdown', (event) => { dragging = true; moved = false; previous = [event.clientX, event.clientY]; scene.renderer.domElement.setPointerCapture(event.pointerId); });
    scene.renderer.domElement.addEventListener('pointermove', (event) => {
      if (!dragging) return; const dx = event.clientX - previous[0]; const dy = event.clientY - previous[1]; previous = [event.clientX, event.clientY];
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      if (!sculptToggle.checked) { scene.controls.yaw -= dx * 0.008; scene.controls.pitch = clamp(scene.controls.pitch + dy * 0.006, -1.25, 1.25); scene.updateCamera(); }
    });
    scene.renderer.domElement.addEventListener('pointerup', (event) => {
      if (sculptToggle.checked && !moved && scene.presentation.model !== 'reference') {
        const rect = scene.renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, scene.camera);
        const hit = raycaster.intersectObject(scene.production.solid, false)[0];
        if (hit) { const local = scene.production.solid.worldToLocal(hit.point.clone()); const normals = scene.productionGeometry.getAttribute('normal').array; const changed = editor.brush(local, Number(radius.value), Number(strength.value), normals, mirrorToggle.checked); root.querySelector('[data-brush-result]').textContent = `${changed} vertices edited`; }
      }
      dragging = false;
    });
    scene.renderer.domElement.addEventListener('wheel', (event) => { event.preventDefault(); scene.controls.distance = clamp(scene.controls.distance * Math.exp(event.deltaY * 0.001), 1.25, 5); scene.updateCamera(); }, { passive: false });
    evidence.controls = { orbit: true, zoom: true, resetCamera: true, parameterSliders: editor.header.parameters.length, sculptBrush: true, mirrorBrush: true, undoRedo: true };
  }

  function applyPresentation(presentation, reference, production, root, evidence) {
    reference.group.visible = presentation.model !== 'production'; production.group.visible = presentation.model !== 'reference';
    reference.group.position.x = 0; production.group.position.x = 0;
    reference.solidMaterial.transparent = false; reference.solidMaterial.opacity = 1; production.solidMaterial.transparent = false; production.solidMaterial.opacity = 1;
    if (presentation.model === 'compare') { reference.group.position.x = -0.58; production.group.position.x = 0.58; }
    if (presentation.model === 'overlay') { reference.solidMaterial.transparent = true; reference.solidMaterial.opacity = 0.42; production.solidMaterial.transparent = true; production.solidMaterial.opacity = 0.62; }
    for (const surface of [reference, production]) {
      surface.solid.visible = presentation.mode === 'solid' || presentation.mode === 'solid-wireframe' || presentation.mode === 'topology';
      surface.wire.visible = presentation.mode === 'wireframe' || presentation.mode === 'solid-wireframe' || presentation.mode === 'topology';
      surface.solidMaterial.opacity = presentation.mode === 'topology' ? 0.22 : surface.solidMaterial.opacity;
      surface.solidMaterial.transparent = presentation.mode === 'topology' || surface.solidMaterial.opacity < 1;
      surface.wireMaterial.opacity = presentation.mode === 'topology' ? 0.92 : 0.68;
    }
    root.querySelector('[data-identity]').textContent = presentation.model === 'reference' ? 'REFERENCE ONLY · CC0 SOURCE · NOT FINAL RUNTIME' : presentation.model === 'compare' ? 'REFERENCE ONLY  ↔  PROJECT WEB-NATIVE EDITABLE SURFACE' : presentation.model === 'overlay' ? 'REFERENCE / PROJECT SURFACE OVERLAY' : 'PROJECT WEB-NATIVE EDITABLE SURFACE · PENDING USER REVIEW';
    evidence.model = presentation.model; evidence.view = presentation.view; evidence.mode = presentation.mode; evidence.closeup = presentation.closeup || null;
  }

  function applyView(view, controls) {
    controls.target.set(0, 0.015, 0.08);
    controls.view = view; controls.pitch = 0.02;
    if (view === 'front') controls.yaw = 0;
    else if (view === 'side') controls.yaw = Math.PI / 2;
    else if (view === 'back') controls.yaw = Math.PI;
    else controls.yaw = Math.PI / 4;
    controls.distance = view === 'side' ? 2.35 : 2.45;
  }

  function applyCloseup(name, controls) {
    const presets = {
      'head-face': [[0, 0.64, 0.08], 0.54],
      'neck-shoulder': [[0, 0.43, 0.07], 0.72],
      axilla: [[0.22, 0.35, 0.07], 0.35],
      elbow: [[0.36, 0.23, 0.07], 0.28],
      hand: [[0.48, 0.15, 0.08], 0.30],
      'chest-waist': [[0, 0.20, 0.07], 0.68],
      'pelvis-groin': [[0, -0.08, 0.07], 0.50],
      knee: [[0.17, -0.39, 0.07], 0.31],
      'ankle-foot': [[0.20, -0.73, 0.10], 0.38],
    };
    const preset = presets[name];
    if (!preset) return;
    controls.target.set(preset[0][0], preset[0][1], preset[0][2]);
    controls.distance = preset[1];
  }

  function updateCamera(camera, controls) {
    const cp = Math.cos(controls.pitch); camera.position.set(controls.target.x + Math.sin(controls.yaw) * cp * controls.distance, controls.target.y + Math.sin(controls.pitch) * controls.distance, controls.target.z + Math.cos(controls.yaw) * cp * controls.distance); camera.lookAt(controls.target);
  }

  function shellMarkup() {
    return `<main class="layout"><section class="viewport"><div class="identity" data-identity></div><div class="hint">Drag: orbit · Wheel: zoom · Sculpt mode: click surface</div></section><aside class="panel"><header><p class="eyebrow">Humanoid Rig Lab</p><h1>HRLSurface V1</h1><p class="subtitle">Web-native editable production surface</p></header><div class="status" data-status>Starting…</div><div class="error-panel" hidden></div><fieldset><legend>Presentation</legend><label>Model<select data-model><option value="production">Production</option><option value="reference">Reference</option><option value="compare">Compare</option><option value="overlay">Overlay</option></select></label><label>View<select data-view><option value="front">Front</option><option value="side">Side</option><option value="back">Back</option><option value="three-quarter">Three-quarter</option></select></label><label>Surface<select data-mode><option value="solid">Solid</option><option value="wireframe">Wireframe</option><option value="solid-wireframe">Solid + wire</option><option value="topology">Topology</option></select></label><div class="button-row"><button data-reset-camera>Reset camera</button></div></fieldset><fieldset><legend>Direct sculpt</legend><label class="check"><input type="checkbox" data-sculpt> Sculpt mode</label><label class="check"><input type="checkbox" data-mirror checked> Bilateral counterpart</label><label>Radius<input type="range" min="0.01" max="0.12" step="0.005" value="0.045" data-radius></label><label>Strength<input type="range" min="-0.01" max="0.01" step="0.0005" value="0.002" data-strength></label><small data-brush-result>No sculpt edits</small><div class="button-row"><button data-undo>Undo</button><button data-redo>Redo</button><button data-reset-shape>Reset shape</button></div></fieldset><fieldset><legend>Continuous shape parameters</legend><div class="parameters"></div></fieldset><footer>visualAcceptance=false · productionReady=false · userVisualAcceptance=pending</footer></aside></main>`;
  }

  function base64ToBytes(value) { const binary = atob(value); const bytes = new Uint8Array(binary.length); for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index); return bytes; }
  function query(name, fallback) { return new URLSearchParams(global.location.search).get(name) || fallback; }
  function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }

  global.HRLProductionSurfaceApp = { start };
})(globalThis);
