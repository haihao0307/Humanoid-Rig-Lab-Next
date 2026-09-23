(()=>{
  'use strict';

  const canvas = document.getElementById('c');
  const status = document.getElementById('status');
  const fatalBox = document.getElementById('fatal');
  const bboxText = document.getElementById('bboxText');
  const scaleText = document.getElementById('scaleText');
  const pixelText = document.getElementById('pixelText');

  document.body.dataset.ready = 'false';
  document.body.dataset.error = '';

  function setStatus(text, mode='normal') {
    status.textContent = text;
    status.classList.toggle('ok', mode === 'ok');
    status.classList.toggle('bad', mode === 'bad');
  }

  function fail(error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(error);
    document.body.dataset.ready = 'false';
    document.body.dataset.error = message;
    setStatus(`打开失败：${message}`, 'bad');
    fatalBox.hidden = false;
    fatalBox.querySelector('b').textContent = '三维形态没有成功显示';
    fatalBox.querySelector('span').textContent = message;
    window.__BIRD_QA = {
      ready: false,
      error: message,
      ...(window.__BIRD_QA || {})
    };
  }

  window.addEventListener('error', event => {
    if (document.body.dataset.ready !== 'true') fail(event.error || event.message || '未知脚本错误');
  });
  window.addEventListener('unhandledrejection', event => {
    if (document.body.dataset.ready !== 'true') fail(event.reason || '未知异步错误');
  });

  function decodeBase64(text) {
    if (!text || typeof text !== 'string') throw new Error('形态载荷没有加载');
    const raw = atob(text);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  }

  function identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  }

  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const m = new Float32Array(16);
    m[0] = f / aspect;
    m[5] = f;
    m[10] = (far + near) / (near - far);
    m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
  }

  function orthographic(left, right, bottom, top, near, far) {
    const m = identity();
    m[0] = 2 / (right - left);
    m[5] = 2 / (top - bottom);
    m[10] = -2 / (far - near);
    m[12] = -(right + left) / (right - left);
    m[13] = -(top + bottom) / (top - bottom);
    m[14] = -(far + near) / (far - near);
    return m;
  }

  function normalize(v) {
    const length = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / length, v[1] / length, v[2] / length];
  }

  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function lookAt(eye, target, up) {
    const z = normalize([
      eye[0] - target[0],
      eye[1] - target[1],
      eye[2] - target[2]
    ]);
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    const m = identity();
    m[0] = x[0]; m[1] = y[0]; m[2] = z[0];
    m[4] = x[1]; m[5] = y[1]; m[6] = z[1];
    m[8] = x[2]; m[9] = y[2]; m[10] = z[2];
    m[12] = -(x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2]);
    m[13] = -(y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2]);
    m[14] = -(z[0] * eye[0] + z[1] * eye[1] + z[2] * eye[2]);
    return m;
  }

  async function inflatePayload() {
    if (!('DecompressionStream' in window)) {
      throw new Error('当前浏览器不支持 gzip 解压，请使用最新版 Chrome、Edge 或 Safari');
    }
    const compressed = decodeBase64(window.__BIRD_FORM);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }

  function readGeometry(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    let offset = 0;
    const requireBytes = count => {
      if (offset + count > view.byteLength) throw new Error('形态载荷提前结束');
    };
    const u32 = () => { requireBytes(4); const v = view.getUint32(offset, true); offset += 4; return v; };
    const f32 = () => { requireBytes(4); const v = view.getFloat32(offset, true); offset += 4; return v; };

    const vertexCount = u32();
    const indexCount = u32();
    if (vertexCount < 3 || vertexCount > 65535) throw new Error(`顶点数量异常：${vertexCount}`);
    if (indexCount < 3 || indexCount % 3 !== 0) throw new Error(`三角索引数量异常：${indexCount}`);

    const storedLow = [f32(), f32(), f32()];
    const storedHigh = [f32(), f32(), f32()];
    const positionPayloadLength = u32();
    const indexPayloadLength = u32();
    const positionEnd = 40 + positionPayloadLength;
    const indexEnd = positionEnd + indexPayloadLength;
    if (indexEnd !== view.byteLength) throw new Error('形态载荷总长度不匹配');

    function readVarints(count) {
      const out = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        let value = 0;
        let shift = 0;
        let byte = 0;
        do {
          requireBytes(1);
          byte = view.getUint8(offset++);
          value |= (byte & 127) << shift;
          shift += 7;
          if (shift > 35) throw new Error('形态载荷包含非法可变长度整数');
        } while (byte & 128);
        out[i] = value >>> 0;
      }
      return out;
    }

    const packedPositions = readVarints(vertexCount * 3);
    if (offset !== positionEnd) throw new Error('形态位置载荷长度不匹配');
    const packedIndices = readVarints(indexCount);
    if (offset !== indexEnd) throw new Error('三角索引载荷长度不匹配');

    const positions = new Float32Array(vertexCount * 3);
    const previous = [0, 0, 0];
    const low = [Infinity, Infinity, Infinity];
    const high = [-Infinity, -Infinity, -Infinity];

    for (let i = 0; i < packedPositions.length; i++) {
      const delta = (packedPositions[i] >>> 1) ^ -(packedPositions[i] & 1);
      const axis = i % 3;
      previous[axis] += delta;
      const span = storedHigh[axis] - storedLow[axis];
      const value = storedLow[axis] + (previous[axis] / 65535) * span;
      if (!Number.isFinite(value)) throw new Error('形态位置包含非有限数值');
      positions[i] = value;
      if (value < low[axis]) low[axis] = value;
      if (value > high[axis]) high[axis] = value;
    }

    const indices = new Uint16Array(indexCount);
    let previousIndex = 0;
    let maxIndex = 0;
    for (let i = 0; i < indexCount; i++) {
      const delta = (packedIndices[i] >>> 1) ^ -(packedIndices[i] & 1);
      previousIndex += delta;
      if (previousIndex < 0 || previousIndex >= vertexCount) {
        throw new Error(`三角索引越界：${previousIndex}`);
      }
      indices[i] = previousIndex;
      if (previousIndex > maxIndex) maxIndex = previousIndex;
    }

    const spans = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];
    const largestSpan = Math.max(spans[0], spans[1], spans[2]);
    if (!(largestSpan > 0)) throw new Error('形态包围盒尺寸为零');

    return {
      vertexCount,
      indexCount,
      positions,
      indices,
      low,
      high,
      spans,
      largestSpan,
      maxIndex,
      storedLow,
      storedHigh
    };
  }

  function makeNormals(positions, indices) {
    const normals = new Float32Array(positions.length);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i] * 3;
      const b = indices[i + 1] * 3;
      const c = indices[i + 2] * 3;
      const abx = positions[b] - positions[a];
      const aby = positions[b + 1] - positions[a + 1];
      const abz = positions[b + 2] - positions[a + 2];
      const acx = positions[c] - positions[a];
      const acy = positions[c + 1] - positions[a + 1];
      const acz = positions[c + 2] - positions[a + 2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      for (const k of [a, b, c]) {
        normals[k] += nx;
        normals[k + 1] += ny;
        normals[k + 2] += nz;
      }
    }
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
      normals[i] /= length;
      normals[i + 1] /= length;
      normals[i + 2] /= length;
    }
    return normals;
  }

  function makeLines(indices) {
    const lines = new Uint16Array(indices.length * 2);
    for (let i = 0, j = 0; i < indices.length; i += 3) {
      const a = indices[i];
      const b = indices[i + 1];
      const c = indices[i + 2];
      lines[j++] = a; lines[j++] = b;
      lines[j++] = b; lines[j++] = c;
      lines[j++] = c; lines[j++] = a;
    }
    return lines;
  }

  function createRenderer(geometry) {
    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('浏览器没有可用的 WebGL');

    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`着色器编译失败：${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };

    const link = (vertexSource, fragmentSource) => {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(`着色器链接失败：${gl.getProgramInfoLog(program)}`);
      }
      return program;
    };

    const solidProgram = link(
      `attribute vec3 aPosition;
       attribute vec3 aNormal;
       uniform mat4 uMVP;
       uniform mat4 uModel;
       varying vec3 vNormal;
       void main(){
         vNormal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
         gl_Position = uMVP * vec4(aPosition, 1.0);
       }`,
      `precision mediump float;
       varying vec3 vNormal;
       void main(){
         vec3 n = normalize(vNormal);
         vec3 lightA = normalize(vec3(0.45, 0.85, 0.55));
         vec3 lightB = normalize(vec3(-0.65, 0.20, -0.55));
         float diffuse = 0.58 * abs(dot(n, lightA)) + 0.22 * abs(dot(n, lightB));
         float shade = 0.30 + clamp(diffuse, 0.0, 0.70);
         vec3 base = vec3(0.86, 0.89, 0.90);
         gl_FragColor = vec4(base * shade, 1.0);
       }`
    );

    const lineProgram = link(
      `attribute vec3 aPosition;
       uniform mat4 uMVP;
       void main(){ gl_Position = uMVP * vec4(aPosition, 1.0); }`,
      `precision mediump float;
       void main(){ gl_FragColor = vec4(0.18, 0.72, 0.94, 0.34); }`
    );

    const createBuffer = (data, target = gl.ARRAY_BUFFER) => {
      const buffer = gl.createBuffer();
      gl.bindBuffer(target, buffer);
      gl.bufferData(target, data, gl.STATIC_DRAW);
      return buffer;
    };

    const normals = makeNormals(geometry.positions, geometry.indices);
    const lines = makeLines(geometry.indices);
    const positionBuffer = createBuffer(geometry.positions);
    const normalBuffer = createBuffer(normals);
    const indexBuffer = createBuffer(geometry.indices, gl.ELEMENT_ARRAY_BUFFER);
    const lineBuffer = createBuffer(lines, gl.ELEMENT_ARRAY_BUFFER);

    const center = [
      (geometry.low[0] + geometry.high[0]) * 0.5,
      (geometry.low[1] + geometry.high[1]) * 0.5,
      (geometry.low[2] + geometry.high[2]) * 0.5
    ];
    const normalizedLargestSpan = 2.25;
    const modelScale = normalizedLargestSpan / geometry.largestSpan;
    const model = identity();
    model[0] = model[5] = model[10] = modelScale;
    model[12] = -center[0] * modelScale;
    model[13] = -center[1] * modelScale;
    model[14] = -center[2] * modelScale;

    let yaw = 0.76;
    let pitch = 0.34;
    let distance = 4.1;
    let activeView = 'persp';
    let wireframe = false;
    let pointerDown = false;
    let lastX = 0;
    let lastY = 0;
    let frameCount = 0;
    let qaSampled = false;

    const fixedViews = {
      top: [[0, 4.0, 0], [0, 0, -1]],
      bottom: [[0, -4.0, 0], [0, 0, 1]],
      front: [[0, 0, 4.0], [0, 1, 0]],
      back: [[0, 0, -4.0], [0, 1, 0]],
      side: [[4.0, 0, 0], [0, 1, 0]]
    };

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    }

    function camera() {
      const aspect = Math.max(0.01, canvas.width / canvas.height);
      if (activeView === 'persp') {
        const cp = Math.cos(pitch);
        const d = distance * Math.max(1, 0.9 / aspect);
        const eye = [
          d * cp * Math.sin(yaw),
          d * Math.sin(pitch),
          d * cp * Math.cos(yaw)
        ];
        return {
          view: lookAt(eye, [0, 0, 0], [0, 1, 0]),
          projection: perspective(0.62, aspect, 0.05, 50)
        };
      }
      const [eye, up] = fixedViews[activeView];
      const half = 1.48;
      const horizontal = aspect >= 1 ? half * aspect : half;
      const vertical = aspect >= 1 ? half : half / aspect;
      return {
        view: lookAt(eye, [0, 0, 0], up),
        projection: orthographic(-horizontal, horizontal, -vertical, vertical, 0.05, 20)
      };
    }

    function bindAttribute(program, name, buffer) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) throw new Error(`找不到着色器属性：${name}`);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    }

    function renderFrame() {
      resize();
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.disable(gl.CULL_FACE);
      gl.clearColor(0.035, 0.060, 0.075, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const { view, projection } = camera();
      const mvp = multiply(projection, multiply(view, model));

      gl.useProgram(solidProgram);
      bindAttribute(solidProgram, 'aPosition', positionBuffer);
      bindAttribute(solidProgram, 'aNormal', normalBuffer);
      gl.uniformMatrix4fv(gl.getUniformLocation(solidProgram, 'uMVP'), false, mvp);
      gl.uniformMatrix4fv(gl.getUniformLocation(solidProgram, 'uModel'), false, model);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);

      if (wireframe) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(lineProgram);
        bindAttribute(lineProgram, 'aPosition', positionBuffer);
        gl.uniformMatrix4fv(gl.getUniformLocation(lineProgram, 'uMVP'), false, mvp);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuffer);
        gl.drawElements(gl.LINES, lines.length, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.BLEND);
      }

      frameCount++;
      if (!qaSampled && frameCount >= 2) sampleVisiblePixels();
      requestAnimationFrame(renderFrame);
    }

    function sampleVisiblePixels() {
      qaSampled = true;
      try {
        gl.finish();
        const width = canvas.width;
        const height = canvas.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let visiblePixels = 0;
        let minX = width, minY = height, maxX = -1, maxY = -1;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            if (pixels[i] > 34 || pixels[i + 1] > 38 || pixels[i + 2] > 42) {
              visiblePixels++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (visiblePixels < 250) throw new Error(`几何已解析，但镜头中仅检测到 ${visiblePixels} 个可见像素`);
        const coverage = visiblePixels / (width * height);
        const pixelBounds = { minX, minY, maxX, maxY };
        window.__BIRD_QA = {
          ready: true,
          vertexCount: geometry.vertexCount,
          triangleCount: geometry.indexCount / 3,
          indexCount: geometry.indexCount,
          maxIndex: geometry.maxIndex,
          sourceBounds: { low: geometry.low, high: geometry.high, spans: geometry.spans },
          modelCenter: center,
          modelScale,
          canvas: { width, height },
          visiblePixels,
          visibleCoverage: coverage,
          visiblePixelBounds: pixelBounds,
          webglVersion: gl.getParameter(gl.VERSION),
          renderer: gl.getParameter(gl.RENDERER)
        };
        pixelText.textContent = `${visiblePixels.toLocaleString()}（${(coverage * 100).toFixed(2)}%）`;
        document.body.dataset.ready = 'true';
        document.body.dataset.error = '';
        setStatus(`已显示｜${geometry.vertexCount.toLocaleString()} 顶点｜${(geometry.indexCount / 3).toLocaleString()} 三角面`, 'ok');
      } catch (error) {
        fail(error);
      }
    }

    canvas.addEventListener('pointerdown', event => {
      pointerDown = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointerup', () => { pointerDown = false; });
    canvas.addEventListener('pointercancel', () => { pointerDown = false; });
    canvas.addEventListener('pointermove', event => {
      if (!pointerDown) return;
      activeView = 'persp';
      yaw += (event.clientX - lastX) * 0.008;
      pitch = Math.max(-1.35, Math.min(1.35, pitch + (event.clientY - lastY) * 0.008));
      lastX = event.clientX;
      lastY = event.clientY;
      syncViewButtons();
    });
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      activeView = 'persp';
      distance = Math.max(2.2, Math.min(8.0, distance * Math.exp(event.deltaY * 0.001)));
      syncViewButtons();
    }, { passive: false });

    function syncViewButtons() {
      document.querySelectorAll('[data-v]').forEach(button => {
        button.classList.toggle('active', button.dataset.v === activeView);
      });
    }

    document.getElementById('views').addEventListener('click', event => {
      const button = event.target.closest('button[data-v]');
      if (!button) return;
      activeView = button.dataset.v;
      syncViewButtons();
    });

    document.getElementById('wire').addEventListener('click', event => {
      wireframe = !wireframe;
      event.currentTarget.textContent = `线框：${wireframe ? '开' : '关'}`;
    });

    document.getElementById('reset').addEventListener('click', () => {
      yaw = 0.76;
      pitch = 0.34;
      distance = 4.1;
      activeView = 'persp';
      syncViewButtons();
    });

    document.getElementById('menu').addEventListener('click', () => {
      document.getElementById('panel').classList.toggle('open');
    });

    bboxText.textContent = geometry.spans.map(value => value.toFixed(5)).join(' × ');
    scaleText.textContent = modelScale.toExponential(4);
    pixelText.textContent = '等待首帧检测';
    requestAnimationFrame(renderFrame);
  }

  (async () => {
    try {
      setStatus('正在解压并校验来源几何…');
      const payload = await inflatePayload();
      const geometry = readGeometry(payload);
      setStatus('几何校验完成，正在自动居中并渲染…');
      createRenderer(geometry);
    } catch (error) {
      fail(error);
    }
  })();
})();
