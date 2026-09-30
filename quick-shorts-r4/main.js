import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { loadHuman } from './human.js';
import { buildShorts, BASE } from './shorts.js';

const $ = (selector) => document.querySelector(selector);
const DEFAULTS = {
  waistEaseMm: 48,
  hipEaseMm: 96,
  shortsLengthMm: 360,
  riseAdjustMm: 12,
  legOpeningMm: 630,
  legGapMm: 36,
  waistbandHeightMm: 42,
  wrinkleMm: 4.5,
  color: '#b9a88f',
  roughness: 0.9
};
const STORAGE_KEY = 'kaopu.quick-shorts-r4.card';
const VERSION = '2026-09-30-r4.1-local-modules';
let parameters = { ...DEFAULTS };
try {
  parameters = { ...parameters, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
} catch {
  localStorage.removeItem(STORAGE_KEY);
}

const sliderDefinitions = [
  ['waistEaseMm', '腰围松量', 0, 140, 2],
  ['hipEaseMm', '臀围松量', 20, 220, 2],
  ['shortsLengthMm', '裤长', 260, 470, 2],
  ['riseAdjustMm', '裆深调整', -45, 80, 1],
  ['legOpeningMm', '单腿裤口围', 470, 780, 2],
  ['legGapMm', '左右裤腿间距', 8, 90, 1],
  ['waistbandHeightMm', '腰头高度', 24, 72, 1],
  ['wrinkleMm', '表面褶量', 0, 12, 0.5]
];

function showFatal(error) {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  const state = $('#state');
  const loading = $('#loading');
  if (state) state.textContent = 'LOAD ERROR';
  if (loading) {
    loading.classList.remove('hide');
    loading.textContent = `加载错误：${message}`;
  }
}

async function bootstrap() {
  try {
    const canvas = $('#canvas');
    if (!canvas) throw new Error('找不到三维画布');
    if (!window.HUMAN_R001_PAYLOAD_B64) throw new Error('人物表面数据没有载入');

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10161a);
    const camera = new THREE.PerspectiveCamera(31, 1, 0.01, 20);
    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 0.9, 0);
    controls.enableDamping = true;
    controls.minDistance = 1.3;
    controls.maxDistance = 5.5;

    scene.add(new THREE.HemisphereLight(0xe3edf2, 0x1d1714, 1.5));
    const key = new THREE.DirectionalLight(0xffe3cf, 3.2);
    key.position.set(2.5, 4, 3.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb8d1e2, 1.35);
    fill.position.set(-3, 2, 2);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 96),
      new THREE.MeshStandardMaterial({ color: 0x11171b, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const shortsGroup = new THREE.Group();
    scene.add(shortsGroup);

    function redraw() {
      const result = buildShorts(shortsGroup, parameters);
      $('#meshInfo').textContent = `腰 ${result.waist.toFixed(0)} · 臀 ${result.hip.toFixed(0)} · 裤长 ${result.length} mm`;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parameters));
      document.querySelectorAll('#colors button').forEach((button) => {
        button.classList.toggle('active', button.dataset.color === parameters.color);
      });
    }

    function setView(viewName) {
      document.querySelectorAll('[data-view]').forEach((button) => {
        button.classList.toggle('active', button.dataset.view === viewName);
      });
      const distance = 3.05;
      const target = new THREE.Vector3(0, 0.88, 0);
      controls.target.copy(target);
      camera.position.set(
        viewName === 'left' ? -distance : viewName === 'right' ? distance : viewName === 'three' ? 2.15 : 0,
        viewName === 'three' ? 1.25 : 0.92,
        viewName === 'back' ? -distance : viewName === 'three' ? 2.3 : viewName === 'front' ? distance : 0
      );
      camera.lookAt(target);
      controls.update();
    }

    function buildUi() {
      const sliderRoot = $('#sliders');
      sliderRoot.replaceChildren();
      for (const [keyName, label, min, max, step] of sliderDefinitions) {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<label>${label}</label><output>${parameters[keyName]} mm</output><input type="range" min="${min}" max="${max}" step="${step}" value="${parameters[keyName]}">`;
        const input = row.querySelector('input');
        const output = row.querySelector('output');
        input.addEventListener('input', () => {
          parameters[keyName] = Number(input.value);
          output.textContent = `${parameters[keyName]} mm`;
          redraw();
        });
        sliderRoot.append(row);
      }

      document.querySelectorAll('#colors button').forEach((button) => {
        button.style.background = button.dataset.color;
        button.addEventListener('click', () => {
          parameters.color = button.dataset.color;
          redraw();
        });
      });
      $('#reset').addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      });
      $('#export').addEventListener('click', () => {
        const card = {
          schema: 'kaopu/quick-shorts-card@1',
          version: '2026-09-30-r4-user-adjusted',
          targetHumanId: 'human-r001-normalized-1800mm',
          baseMeasurementsMm: BASE,
          parameters,
          sourcePreviewVersion: VERSION,
          acceptance: {
            approximatelyWearableShape: true,
            physicalClothSolved: false,
            productionReady: false
          }
        };
        const anchor = document.createElement('a');
        anchor.href = URL.createObjectURL(new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' }));
        anchor.download = 'QUICK_SHORTS_R4_CARD.json';
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
      });
      document.querySelectorAll('[data-view]').forEach((button) => {
        button.addEventListener('click', () => setView(button.dataset.view));
      });
    }

    let lastWidth = 0;
    let lastHeight = 0;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    buildUi();
    redraw();
    setView('front');
    $('#state').textContent = '正在解压人物表面…';
    await new Promise(requestAnimationFrame);
    const humanTriangles = loadHuman(scene);

    window.__QUICK_SHORTS_READY__ = true;
    window.__QUICK_SHORTS_VERSION__ = VERSION;
    $('#state').textContent = 'READY · 粗略短裤已穿到人物上';
    $('#meshInfo').textContent += ` · 人物参考 ${humanTriangles.toLocaleString()} tris`;
    $('#loading').classList.add('hide');

    function loop() {
      resize();
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop();
  } catch (error) {
    showFatal(error);
  }
}

bootstrap();
