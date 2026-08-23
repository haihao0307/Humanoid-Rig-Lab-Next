import * as THREE from '/node_modules/three/build/three.module.js';
import { WholeBodyMotionSolver } from '/src/human-motion/solver/whole-body-motion-solver.js';
import { LocomotionController } from '/src/human-motion/controllers/locomotion-controller.js';
import { createMotionGoal } from '/src/human-motion/goals/motion-goal.js';

const canvas = document.querySelector('#viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 100);
camera.position.set(2.6, 1.65, 3.2);
camera.lookAt(0, 0.9, 0);
scene.add(new THREE.HemisphereLight(0xb9dbff, 0x16213a, 2.2));
const grid = new THREE.GridHelper(12, 48, 0x24517d, 0x112943);
scene.add(grid);

const solver = new WholeBodyMotionSolver();
const locomotion = new LocomotionController();
const jointGeometry = new THREE.SphereGeometry(0.022, 10, 8);
const joints = new Map();
const bones = new Map();
const targetMarkers = [];
const contactMarkers = [];
const comMarker = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x7c4c00 }));
scene.add(comMarker);
const supportLine = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x55f0b3 }));
scene.add(supportLine);

let action = 'idle';
let oneShotGoal = null;
let previousTime = performance.now();
let elapsed = 0;

document.querySelector('#actions').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  action = button.dataset.action;
  oneShotGoal = null;
  document.querySelectorAll('button[data-action]').forEach((item) => item.classList.toggle('active', item === button));
});

for (const id of ['speed', 'direction', 'target-x', 'target-y', 'target-z', 'stride', 'width', 'energy']) {
  const input = document.querySelector(`#${id}`);
  const output = document.querySelector(`#${id}-value`);
  const update = () => { output.value = id === 'direction' ? `${input.value}°` : Number(input.value).toFixed(2); };
  input.addEventListener('input', update);
  update();
}

function animate(now) {
  const dt = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
  previousTime = now;
  elapsed += dt;
  const frameGoal = buildGoal(dt);
  solver.setGoal(frameGoal);
  const frame = solver.solve({ deltaTime: dt, time: elapsed });
  updateScene(frame);
  resize();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

function buildGoal(dt) {
  const speed = Number(document.querySelector('#speed').value);
  const direction = Number(document.querySelector('#direction').value) * Math.PI / 180;
  const forward = [Math.sin(direction), 0, Math.cos(direction)];
  const walking = action === 'walk-forward' || action === 'walk-backward';
  const turnRate = action === 'turn-left' ? 0.8 : action === 'turn-right' ? -0.8 : 0;
  if (walking || turnRate || action === 'stop' || action === 'idle') {
    const sign = action === 'walk-backward' ? -1 : 1;
    const output = locomotion.update({
      desiredVelocity: walking ? forward.map((value) => value * speed * sign) : [0, 0, 0],
      desiredFacing: action === 'walk-backward' ? forward : forward,
      speed: walking ? speed : 0,
      turnRate,
      inPlace: Boolean(turnRate),
      strideScale: Number(document.querySelector('#stride').value),
      stepWidth: Number(document.querySelector('#width').value),
      style: { energy: Number(document.querySelector('#energy').value), amplitude: 0.65 },
    }, dt);
    document.querySelector('#mode').textContent = output.mode;
    return output.goal;
  }
  if (!oneShotGoal) oneShotGoal = buildOneShotGoal(action);
  document.querySelector('#mode').textContent = action;
  return oneShotGoal;
}

function buildOneShotGoal(name) {
  const target = [
    Number(document.querySelector('#target-x').value),
    Number(document.querySelector('#target-y').value),
    Number(document.querySelector('#target-z').value),
  ];
  if (name.startsWith('reach-')) {
    const side = name.endsWith('left') ? 'left' : 'right';
    target[0] = Math.abs(target[0]) * (side === 'left' ? -1 : 1);
    return createMotionGoal({
      goalId: name,
      endEffectors: [{ jointId: `${side}Hand`, targetPosition: target, poleTarget: [target[0], target[1] - 0.15, target[2] + 0.35], shoulderParticipation: 0.25 }],
      gaze: { targetPosition: target },
      balance: { enabled: false, mode: 'airborne' },
    });
  }
  target[0] = Math.abs(target[0]) * (name.endsWith('left') ? -1 : 1);
  return createMotionGoal({ goalId: name, gaze: { targetPosition: target }, balance: { enabled: false, mode: 'airborne' } });
}

function updateScene(frame) {
  const positions = frame.positions;
  for (const [jointId, position] of Object.entries(positions)) {
    let marker = joints.get(jointId);
    if (!marker) {
      marker = new THREE.Mesh(jointGeometry, new THREE.MeshStandardMaterial({ color: jointId.includes('left') ? 0x62b8ff : jointId.includes('right') ? 0xff8297 : 0xe6edf8 }));
      joints.set(jointId, marker);
      scene.add(marker);
    }
    marker.position.fromArray(position);
  }
  for (const joint of solver.kinematic.context.joints) {
    if (!joint.parentId || !positions[joint.parentId]) continue;
    let line = bones.get(joint.id);
    if (!line) {
      line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x91b4d8 }));
      bones.set(joint.id, line);
      scene.add(line);
    }
    line.geometry.setFromPoints([new THREE.Vector3().fromArray(positions[joint.parentId]), new THREE.Vector3().fromArray(positions[joint.id])]);
  }
  clearMarkers(targetMarkers);
  clearMarkers(contactMarkers);
  const goal = solver.goal;
  for (const target of goal?.endEffectors || []) addMarker(targetMarkers, target.targetPosition, 0x36c5ff, 0.032);
  for (const contact of frame.contacts) addMarker(contactMarkers, contact.targetPosition, 0xff8b5e, 0.042);
  comMarker.position.fromArray(frame.balance.estimatedCOM || [0, 0, 0]);
  supportLine.geometry.setFromPoints((frame.balance.supportPolygon || []).map((point) => new THREE.Vector3(...point)));
  document.querySelector('#goal-id').textContent = frame.goalId || 'none';
  document.querySelector('#diagnostics').textContent = JSON.stringify(frame.diagnostics, null, 2);
  document.querySelector('#goal').textContent = JSON.stringify({
    goalId: goal?.goalId,
    root: goal?.root,
    endEffectors: goal?.endEffectors,
    contacts: goal?.contacts,
    gaze: goal?.gaze,
  }, null, 2);
}

function addMarker(collection, position, color, radius) {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), new THREE.MeshBasicMaterial({ color }));
  marker.position.fromArray(position);
  collection.push(marker);
  scene.add(marker);
}

function clearMarkers(collection) {
  for (const marker of collection.splice(0)) { scene.remove(marker); marker.geometry.dispose(); marker.material.dispose(); }
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width === Math.floor(width * renderer.getPixelRatio()) && canvas.height === Math.floor(height * renderer.getPixelRatio())) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
