const CONNECTIONS = [
  ['headTop', 'head'], ['head', 'neck'], ['neck', 'chest'], ['chest', 'spine'], ['spine', 'pelvis'],
  ['chest', 'leftShoulder'], ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'], ['leftWrist', 'leftHand'],
  ['chest', 'rightShoulder'], ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'], ['rightWrist', 'rightHand'],
  ['pelvis', 'leftHip'], ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'], ['leftAnkle', 'leftToe'],
  ['pelvis', 'rightHip'], ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'], ['rightAnkle', 'rightToe']
];

const BODY_SEGMENTS = [
  { a: 'neck', b: 'pelvis', width: 44 },
  { a: 'leftShoulder', b: 'leftElbow', width: 23 },
  { a: 'leftElbow', b: 'leftWrist', width: 18 },
  { a: 'rightShoulder', b: 'rightElbow', width: 23 },
  { a: 'rightElbow', b: 'rightWrist', width: 18 },
  { a: 'leftHip', b: 'leftKnee', width: 31 },
  { a: 'leftKnee', b: 'leftAnkle', width: 23 },
  { a: 'rightHip', b: 'rightKnee', width: 31 },
  { a: 'rightKnee', b: 'rightAnkle', width: 23 }
];

function canvasPoint(canvas, point) {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const scale = Math.min(w * 0.74, h * 0.9);
  return {
    x: w / 2 + point.x * scale,
    y: h - 16 - point.y * scale
  };
}

function roundLine(context, a, b, width, color) {
  context.beginPath();
  context.moveTo(a.x, a.y);
  context.lineTo(b.x, b.y);
  context.lineWidth = width;
  context.lineCap = 'round';
  context.strokeStyle = color;
  context.stroke();
}

export class HumanoidPreview {
  constructor(canvas, { interactive = false, onPoseChange = null } = {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.state = null;
    this.interactive = interactive;
    this.onPoseChange = onPoseChange;
    this.dragJoint = null;
    this.pointer = null;
    this.resizeObserver = new ResizeObserver(() => this.draw());
    this.resizeObserver.observe(canvas);

    if (interactive) {
      canvas.addEventListener('pointerdown', (event) => this.#pointerDown(event));
      canvas.addEventListener('pointermove', (event) => this.#pointerMove(event));
      canvas.addEventListener('pointerup', () => this.#pointerUp());
      canvas.addEventListener('pointercancel', () => this.#pointerUp());
    }
  }

  setState(state) {
    this.state = state;
    this.draw();
  }

  #resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }

  draw() {
    this.#resize();
    const context = this.context;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    context.clearRect(0, 0, width, height);

    const gradient = context.createRadialGradient(width * 0.5, height * 0.38, 20, width * 0.5, height * 0.5, Math.max(width, height) * 0.7);
    gradient.addColorStop(0, '#12233e');
    gradient.addColorStop(0.62, '#07101e');
    gradient.addColorStop(1, '#030711');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(73, 132, 196, 0.16)';
    context.lineWidth = 1;
    for (let i = 0; i < 14; i += 1) {
      const y = height - 20 - i * 18;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    const joints = this.state?.character?.pose?.joints;
    if (!joints) return;
    const display = this.state.character.display;
    const points = Object.fromEntries(Object.entries(joints).map(([id, point]) => [id, canvasPoint(this.canvas, point)]));

    if (display.skinVisible) {
      context.globalAlpha = Math.max(0.15, Number(display.skinOpacity || 1));
      for (const segment of BODY_SEGMENTS) {
        roundLine(context, points[segment.a], points[segment.b], segment.width, '#c8a184');
      }
      roundLine(context, points.leftWrist, points.leftHand, 15, '#c8a184');
      roundLine(context, points.rightWrist, points.rightHand, 15, '#c8a184');
      roundLine(context, points.leftAnkle, points.leftToe, 19, '#c8a184');
      roundLine(context, points.rightAnkle, points.rightToe, 19, '#c8a184');

      const head = points.head;
      context.beginPath();
      context.ellipse(head.x, head.y, 27, 35, 0, 0, Math.PI * 2);
      context.fillStyle = '#c8a184';
      context.fill();

      const chest = points.chest;
      const pelvis = points.pelvis;
      context.beginPath();
      context.moveTo(chest.x - 30, chest.y - 10);
      context.quadraticCurveTo(chest.x - 47, (chest.y + pelvis.y) / 2, pelvis.x - 25, pelvis.y + 12);
      context.quadraticCurveTo(pelvis.x, pelvis.y + 25, pelvis.x + 25, pelvis.y + 12);
      context.quadraticCurveTo(chest.x + 47, (chest.y + pelvis.y) / 2, chest.x + 30, chest.y - 10);
      context.closePath();
      context.fillStyle = '#bd9478';
      context.fill();
      context.globalAlpha = 1;
    }

    if (display.skeletonVisible) {
      for (const [aId, bId] of CONNECTIONS) {
        roundLine(context, points[aId], points[bId], 6, '#d9e8fb');
        roundLine(context, points[aId], points[bId], 2, '#7399c6');
      }
      for (const [id, point] of Object.entries(points)) {
        context.beginPath();
        context.arc(point.x, point.y, id === this.dragJoint ? 8 : 5.5, 0, Math.PI * 2);
        context.fillStyle = id === this.dragJoint ? '#ffc75c' : '#f5f9ff';
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = id === this.dragJoint ? '#ff9c32' : '#7e9fc5';
        context.stroke();
      }
    }

    context.fillStyle = 'rgba(221,236,255,.72)';
    context.font = '12px system-ui, sans-serif';
    context.fillText(`${this.state.character.pose.name} · ${display.mode}`, 16, 24);
  }

  #eventPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  #pointerDown(event) {
    if (!this.state) return;
    const pointer = this.#eventPoint(event);
    const joints = this.state.character.pose.joints;
    let best = null;
    let bestDistance = 20;
    for (const [id, point] of Object.entries(joints)) {
      const screen = canvasPoint(this.canvas, point);
      const distance = Math.hypot(pointer.x - screen.x, pointer.y - screen.y);
      if (distance < bestDistance) {
        best = id;
        bestDistance = distance;
      }
    }
    if (!best) return;
    this.dragJoint = best;
    this.canvas.setPointerCapture(event.pointerId);
    this.#pointerMove(event);
  }

  #pointerMove(event) {
    if (!this.dragJoint || !this.state) return;
    const pointer = this.#eventPoint(event);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const scale = Math.min(w * 0.74, h * 0.9);
    const next = structuredClone(this.state.character.pose.joints);
    next[this.dragJoint] = {
      x: Math.max(-0.48, Math.min(0.48, (pointer.x - w / 2) / scale)),
      y: Math.max(0.015, Math.min(0.99, (h - 16 - pointer.y) / scale))
    };
    this.state.character.pose.joints = next;
    this.draw();
    this.onPoseChange?.(next, this.dragJoint, false);
  }

  #pointerUp() {
    if (!this.dragJoint) return;
    const joint = this.dragJoint;
    this.dragJoint = null;
    this.draw();
    this.onPoseChange?.(this.state.character.pose.joints, joint, true);
  }
}
