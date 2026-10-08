/**
 * Independent procedural eye study, authored for this workbench.
 * No Unity shader, mesh, texture, or demo asset is included or translated.
 * Visual controls are an illustrative eye surface model, not accommodation.
 */
export function createEyeLab(THREE, container) {
  if (!THREE || !container || typeof container.appendChild !== 'function') {
    throw new TypeError('createEyeLab needs THREE and an element container.');
  }
  const state = {
    pupil: 0.28, iris: 1, irisHue: 0.12, corneaIOR: 1.376,
    yaw: -12, pitch: 3, irisDepth: 0.003,
    ready: false, disposed: false, renderCount: 0,
    model: 'Independent procedural eye; no lens accommodation',
    error: null,
  };
  const ranges = {
    pupil: [0.12, 0.65], iris: [0.7, 1.3], irisHue: [0, 1],
    corneaIOR: [1, 1.6], yaw: [-70, 70], pitch: [-45, 45],
    irisDepth: [0.001, 0.008],
  };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (error) {
    throw new Error('The independent eye view could not start WebGL: ' + error.message);
  }
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', '独立程序眼球验证台。拖动转向；方向键微调。非晶状体调焦模拟。');
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  Object.assign(canvas.style, { width: '100%', height: '100%', display: 'block', touchAction: 'none', outlineOffset: '-3px' });
  container.appendChild(canvas);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x111119, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  if (renderer.debug) {
    renderer.debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
      state.ready = false;
      state.error = 'Eye shader failed to compile. ' +
        [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertexShader), gl.getShaderInfoLog(fragmentShader)]
          .filter(Boolean).join('\n');
      console.error(state.error);
    };
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 30);
  camera.position.set(0, 0.025, 4.4);
  camera.lookAt(0, 0, 0.15);
  const eye = new THREE.Group();
  scene.add(eye);
  const hemi = new THREE.HemisphereLight(0xeaf1ff, 0x433234, 0.6);
  scene.add(hemi);
  function light(color, intensity, x, y, z) {
    const item = new THREE.DirectionalLight(color, intensity);
    item.position.set(x, y, z);
    scene.add(item);
  }
  light(0xfff0d8, 2.9, -3, 4, 5);
  light(0xb1d5ff, 1.1, 4, 1, 3);
  light(0xe5b8ff, 0.45, -1, -3, -2);

  // Original geometric studio environment: two luminous cards and a dim room.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x252631);
  const studioItems = [];
  function card(width, height, x, y, z, rgb) {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...rgb), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    studioItems.push(mesh);
  }
  card(1.2, 2.4, -2.5, 3, 4, [6.2, 5.5, 4.7]);
  card(0.35, 1.8, 3, 0.8, 3, [2.6, 3.3, 4.5]);
  card(2.8, 0.3, 0, 3, -1, [1.4, 1.6, 2.1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, 0.025, 0.1, 20);
  scene.environment = environment.texture;
  pmrem.dispose();
  for (const item of studioItems) { item.geometry.dispose(); item.material.dispose(); }

  const uniforms = {
    uPupil: { value: state.pupil },
    uIrisHue: { value: state.irisHue },
  };
  const scleraMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe9dfd8, roughness: 0.27, metalness: 0,
    ior: 1.34, clearcoat: 0.26, clearcoatRoughness: 0.17,
    envMapIntensity: 0.7,
  });
  scleraMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vScleraStudyUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vScleraStudyUv = uv;');
    shader.fragmentShader = 'varying vec2 vScleraStudyUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float su = vScleraStudyUv.x * 6.2831853;
      float sv = vScleraStudyUv.y;
      float branch = sin(su * 21.0 + sin(sv * 39.0 + su * 2.0) * 0.7 + sin(sv * 83.0) * 0.16);
      float vein = pow(max(0.0, branch), 85.0) * (0.025 + 0.075 * pow(1.0 - sv, 2.0));
      float tint = (0.5 + 0.5 * sin(su * 6.0 + sv * 8.0)) * 0.035;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.16, 0.13), vein + tint);
    `);
  };
  scleraMaterial.customProgramCacheKey = () => 'independent-eye-sclera-v1';

  const irisMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.57, metalness: 0,
    ior: 1.33, envMapIntensity: 0.32,
    side: THREE.DoubleSide,
  });
  irisMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'varying vec2 vIrisStudyUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n vIrisStudyUv = uv;');
    shader.fragmentShader = `
      varying vec2 vIrisStudyUv;
      uniform float uPupil;
      uniform float uIrisHue;
      vec3 studyHue(float h, float saturation, float brightness) {
        vec3 k = abs(fract(vec3(h) + vec3(0.0, 0.6666667, 0.3333333)) * 6.0 - 3.0);
        return brightness * mix(vec3(1.0), clamp(k - 1.0, 0.0, 1.0), saturation);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 ip = (vIrisStudyUv - 0.5) * 2.0;
      float ir = length(ip);
      float ia = atan(ip.y, ip.x);
      // Polar fibers originate in a fixed procedural field. The exposed annulus
      // stretches as the aperture moves; this is an independent artistic model.
      float annulus = clamp((ir - uPupil) / max(0.05, 1.0 - uPupil), 0.0, 1.0);
      float bend = 0.017 * sin(annulus * 16.0 + sin(ia * 13.0));
      float angle = ia + bend;
      float fine = pow(0.5 + 0.5 * sin(angle * 231.0 + sin(ia * 31.0) * 2.5 + annulus * 4.0), 5.0);
      float medium = 0.5 + 0.5 * sin(angle * 83.0 + sin(ia * 7.0) * 4.0 + annulus * 8.0);
      float broad = 0.5 + 0.5 * sin(ia * 19.0 + sin(ia * 4.0) + annulus * 3.5);
      float radial = (0.23 + 0.5 * medium + 0.3 * broad) * (0.72 + 0.42 * fine);
      float furrow = pow(0.5 + 0.5 * sin(annulus * 42.0 + sin(ia * 17.0) * 0.65), 14.0);
      float collarette = exp(-pow((annulus - (0.27 + 0.035 * sin(ia * 21.0))) * 21.0, 2.0));
      vec3 pigment = studyHue(uIrisHue, 0.66, 0.43);
      vec3 threadColor = studyHue(fract(uIrisHue + 0.055), 0.50, 0.60);
      vec3 fiberColor = pigment * radial + threadColor * fine * 0.15;
      fiberColor *= 1.0 - 0.18 * furrow * smoothstep(0.45, 0.9, annulus);
      fiberColor = mix(fiberColor, vec3(0.27, 0.13, 0.035), collarette * 0.38);
      float limbus = smoothstep(0.83, 0.985, ir);
      fiberColor = mix(fiberColor, pigment * 0.15, limbus * 0.92);
      float apertureEdge = max(fwidth(ir) * 1.15, 0.002);
      float pupilMask = 1.0 - smoothstep(uPupil - apertureEdge, uPupil + apertureEdge, ir);
      diffuseColor.rgb = mix(fiberColor, vec3(0.0004, 0.0003, 0.00025), pupilMask);
    `);
  };
  irisMaterial.customProgramCacheKey = () => 'independent-eye-iris-v1';
  const corneaMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.032, metalness: 0,
    ior: state.corneaIOR, transmission: 0.985,
    thickness: 0.07, envMapIntensity: 0.95,
    attenuationDistance: Infinity,
    side: THREE.FrontSide,
  });
  let sclera, irisMesh, cornea;
  const geometryObjects = new Set();

  function diskSurface(radius, edgeZ, heightAtRadius, rings = 28, slices = 160) {
    const positions = [], uv = [], indices = [];
    for (let ring = 0; ring <= rings; ring++) {
      const q = ring / rings;
      for (let step = 0; step <= slices; step++) {
        const a = step / slices * Math.PI * 2;
        const x = q * Math.cos(a), y = q * Math.sin(a);
        positions.push(radius * x, radius * y, edgeZ + heightAtRadius(q));
        uv.push(0.5 + 0.5 * x, 0.5 + 0.5 * y);
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      for (let step = 0; step < slices; step++) {
        const a = ring * (slices + 1) + step, b = a + slices + 1;
        // Counterclockwise from the camera-facing +Z side.
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
  }
  function replaceGeometry(mesh, geometry) {
    if (mesh.geometry) { geometryObjects.delete(mesh.geometry); mesh.geometry.dispose(); }
    mesh.geometry = geometry;
    geometryObjects.add(geometry);
  }
  function rebuild() {
    const radius = 0.47 * state.iris;
    const boundaryZ = Math.sqrt(1 - radius * radius);
    // UI depth is a normalized visual study range, not anatomical calibration.
    const depression = 0.02 + (state.irisDepth - 0.001) / 0.007 * 0.12;
    const thetaStart = Math.asin(radius);
    const scleraGeometry = new THREE.SphereGeometry(1, 128, 72, 0, Math.PI * 2, thetaStart, Math.PI - thetaStart);
    scleraGeometry.rotateX(Math.PI / 2);
    const irisGeometry = diskSurface(radius * 1.003, boundaryZ + 0.001, q => -depression * (1 - q * q));
    const corneaGeometry = diskSurface(radius * 1.002, boundaryZ + 0.0025, q => 0.18 * (1 - q * q), 36, 160);
    if (!sclera) {
      sclera = new THREE.Mesh(scleraGeometry, scleraMaterial);
      irisMesh = new THREE.Mesh(irisGeometry, irisMaterial);
      cornea = new THREE.Mesh(corneaGeometry, corneaMaterial);
      sclera.name = 'Original procedural sclera';
      irisMesh.name = 'Original polar iris with adjustable pupil';
      cornea.name = 'Illustrative transmissive corneal shell';
      eye.add(sclera, irisMesh, cornea);
      geometryObjects.add(scleraGeometry); geometryObjects.add(irisGeometry); geometryObjects.add(corneaGeometry);
    } else {
      replaceGeometry(sclera, scleraGeometry);
      replaceGeometry(irisMesh, irisGeometry);
      replaceGeometry(cornea, corneaGeometry);
    }
  }
  rebuild();
  let width = 0, height = 0, scheduled = 0;
  const toRadians = Math.PI / 180;
  function orient() {
    eye.rotation.set(state.pitch * toRadians, state.yaw * toRadians, 0, 'YXZ');
  }
  orient();
  function resize() {
    const rect = container.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    if (nextWidth < 2 || nextHeight < 2) return false;
    if (nextWidth !== width || nextHeight !== height) {
      width = nextWidth; height = nextHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = camera.aspect < 1 ? 4.4 / Math.max(camera.aspect, 0.55) : 4.4;
      camera.updateProjectionMatrix();
    }
    return true;
  }
  function render() {
    if (state.disposed || !resize()) return false;
    renderer.render(scene, camera);
    state.renderCount++;
    return true;
  }
  function queueRender() {
    if (state.disposed || scheduled) return;
    scheduled = requestAnimationFrame(() => { scheduled = 0; render(); });
  }
  function set(values = {}) {
    if (state.disposed) return state;
    let geometryChanged = false;
    for (const key of Object.keys(ranges)) {
      if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
      const input = Number(values[key]);
      if (!Number.isFinite(input)) continue;
      const [low, high] = ranges[key];
      const value = Math.max(low, Math.min(high, input));
      if (state[key] !== value) {
        state[key] = value;
        if (key === 'iris' || key === 'irisDepth') geometryChanged = true;
      }
    }
    uniforms.uPupil.value = state.pupil;
    uniforms.uIrisHue.value = state.irisHue;
    corneaMaterial.ior = state.corneaIOR;
    orient();
    if (geometryChanged) rebuild();
    queueRender();
    return state;
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(queueRender) : null;
  observer?.observe(container);
  window.addEventListener('resize', queueRender);
  let drag = null;
  function emitChange() {
    container.dispatchEvent(new CustomEvent('eyelabchange', { detail: { ...state } }));
  }
  function pointerDown(event) {
    if (event.button !== 0 || state.disposed) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch };
    canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    set({ yaw: drag.yaw + (event.clientX - drag.x) * 0.22, pitch: drag.pitch + (event.clientY - drag.y) * 0.22 });
    emitChange();
  }
  function pointerEnd(event) {
    if (drag && event.pointerId === drag.id) drag = null;
  }
  function keyDown(event) {
    const change = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[event.key];
    if (!change) return;
    event.preventDefault();
    set({ yaw: state.yaw + change[0], pitch: state.pitch + change[1] });
    emitChange();
  }
  function contextLost(event) {
    event.preventDefault();
    state.ready = false;
    state.error = 'WebGL context lost. Reopen the eye view to recover.';
    emitChange();
  }
  function contextRestored() {
    state.ready = true; state.error = null; queueRender(); emitChange();
  }
  const listeners = [
    ['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerEnd],
    ['pointercancel', pointerEnd], ['lostpointercapture', pointerEnd], ['keydown', keyDown],
    ['webglcontextlost', contextLost], ['webglcontextrestored', contextRestored],
  ];
  for (const [type, handler] of listeners) canvas.addEventListener(type, handler);
  function dispose() {
    if (state.disposed) return;
    state.disposed = true; state.ready = false;
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = 0; drag = null;
    observer?.disconnect();
    window.removeEventListener('resize', queueRender);
    for (const [type, handler] of listeners) canvas.removeEventListener(type, handler);
    for (const geometry of geometryObjects) geometry.dispose();
    geometryObjects.clear();
    scleraMaterial.dispose(); irisMaterial.dispose(); corneaMaterial.dispose();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  state.ready = true;
  render();
  return { set, render, state, dispose };
}
