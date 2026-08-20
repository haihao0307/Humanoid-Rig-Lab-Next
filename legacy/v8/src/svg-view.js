import {
  calculateBounds,
  computePoseWorldPositions,
  topologyKey,
} from './skeleton-model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SvgSkeletonView {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.definition = null;
    this.selectedJointId = null;
    this.hoveredJointId = null;
    this.hoveredKind = null;
    this.viewType = 'front';
    this.showGrid = true;
    this.showAxes = true;
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.width = 1;
    this.height = 1;
    this.projectedCenter = { u: 0, v: 0.9 };
    this.baseScale = 300;
    this.lastTopologyKey = '';
    this.drag = null;
    this.hoverTargetKey = '';

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.classList.add('skeleton-svg');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', '可交互骨骼链二维视图');
    this.svg.setAttribute('tabindex', '0');
    this.container.replaceChildren(this.svg);

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.container);
    this.resize();
  }

  refresh(definition, selectedJointId, hoveredJointId = null, hoveredKind = null) {
    const nextTopologyKey = topologyKey(definition);
    const topologyChanged = nextTopologyKey !== this.lastTopologyKey;
    this.definition = definition;
    this.selectedJointId = selectedJointId;
    this.hoveredJointId = hoveredJointId;
    this.hoveredKind = hoveredKind;
    this.lastTopologyKey = nextTopologyKey;

    if (topologyChanged || this.baseScale <= 0) {
      this.fitToDefinition(true);
    } else {
      this.render();
    }
  }

  setView(viewType) {
    this.viewType = ['front', 'side', 'top', 'perspective'].includes(viewType)
      ? viewType
      : 'front';
    this.fitToDefinition(true);
  }

  setGridVisible(visible) {
    this.showGrid = Boolean(visible);
    this.render();
  }

  setAxesVisible(visible) {
    this.showAxes = Boolean(visible);
    this.render();
  }

  setSpace() {
    // This fallback stores translations only, so local and world axes share orientation.
  }

  fitToDefinition(resetNavigation = true) {
    if (!this.definition) {
      return;
    }

    const worldPositions = computePoseWorldPositions(this.definition);
    const projected = [...worldPositions.values()].map((point) => this.projectPoint(point));
    if (!projected.length) {
      return;
    }

    const minU = Math.min(...projected.map((point) => point.u));
    const maxU = Math.max(...projected.map((point) => point.u));
    const minV = Math.min(...projected.map((point) => point.v));
    const maxV = Math.max(...projected.map((point) => point.v));
    const spanU = Math.max(0.25, maxU - minU);
    const spanV = Math.max(0.25, maxV - minV);
    const padding = Math.max(54, Math.min(this.width, this.height) * 0.10);
    const availableWidth = Math.max(120, this.width - padding * 2);
    const availableHeight = Math.max(120, this.height - padding * 2);

    this.projectedCenter = {
      u: (minU + maxU) / 2,
      v: (minV + maxV) / 2,
    };
    this.baseScale = Math.max(28, Math.min(availableWidth / spanU, availableHeight / spanV));

    if (resetNavigation) {
      this.zoom = 1;
      this.pan = { x: 0, y: 0 };
    }
    this.render();
  }

  resize() {
    const bounds = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.round(bounds.width));
    this.height = Math.max(1, Math.round(bounds.height));
    this.svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
    if (this.definition) {
      this.fitToDefinition(false);
    }
  }

  render() {
    if (!this.definition || this.width < 2 || this.height < 2) {
      return;
    }

    const worldPositions = computePoseWorldPositions(this.definition);
    const scale = this.baseScale * this.zoom;
    const fragment = document.createDocumentFragment();
    const defs = createSvgElement('defs');
    defs.innerHTML = `
      <filter id="joint-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
        <feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>
      </filter>
      <pattern id="minor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(83,104,135,0.12)" stroke-width="1"></path>
      </pattern>
      <pattern id="major-grid" width="120" height="120" patternUnits="userSpaceOnUse">
        <rect width="120" height="120" fill="url(#minor-grid)"></rect>
        <path d="M 120 0 L 0 0 0 120" fill="none" stroke="rgba(100,126,162,0.17)" stroke-width="1"></path>
      </pattern>
    `;
    fragment.append(defs);

    const background = createSvgElement('rect', {
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      class: 'svg-background',
      fill: this.showGrid ? 'url(#major-grid)' : 'transparent',
    });
    fragment.append(background);

    const boneLayer = createSvgElement('g', { class: 'svg-bone-layer' });
    const jointLayer = createSvgElement('g', { class: 'svg-joint-layer' });
    const labelLayer = createSvgElement('g', { class: 'svg-label-layer' });

    for (const joint of this.definition.joints) {
      if (!joint.parentId || joint.visualBone === false) {
        continue;
      }
      const parentWorld = worldPositions.get(joint.parentId);
      const jointWorld = worldPositions.get(joint.id);
      const a = this.worldToScreen(parentWorld);
      const b = this.worldToScreen(jointWorld);
      const selected = joint.id === this.selectedJointId;
      const hovered = joint.id === this.hoveredJointId && this.hoveredKind === 'bone';
      const visibleWidth = clamp(joint.boneRadius * scale * 2.15, 3.5, 19)
        * (hovered ? 1.28 : 1)
        * (selected ? 1.08 : 1);

      const visibleLine = createSvgElement('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: `svg-bone${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}`,
        'stroke-width': visibleWidth,
        'data-joint-id': joint.id,
        'data-kind': 'bone',
      });
      boneLayer.append(visibleLine);

      const hitLine = createSvgElement('line', {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: 'svg-bone-hit',
        'stroke-width': Math.max(18, visibleWidth + 12),
        'data-joint-id': joint.id,
        'data-kind': 'bone',
      });
      boneLayer.append(hitLine);
    }

    for (const joint of this.definition.joints) {
      if (joint.visualJoint === false) {
        continue;
      }
      const world = worldPositions.get(joint.id);
      const point = this.worldToScreen(world);
      const selected = joint.id === this.selectedJointId;
      const hovered = joint.id === this.hoveredJointId && this.hoveredKind === 'joint';
      const radius = clamp(joint.jointRadius * scale, 5, 23)
        * (hovered ? 1.22 : 1)
        * (selected ? 1.10 : 1);

      if (selected || hovered) {
        const halo = createSvgElement('circle', {
          cx: point.x,
          cy: point.y,
          r: radius + (selected ? 8 : 6),
          class: `svg-joint-halo${selected ? ' is-selected' : ''}`,
        });
        jointLayer.append(halo);
      }

      const circle = createSvgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: radius,
        class: `svg-joint${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}`,
        'data-joint-id': joint.id,
        'data-kind': 'joint',
      });
      jointLayer.append(circle);

      if (selected) {
        const text = createSvgElement('text', {
          x: point.x + radius + 11,
          y: point.y - radius - 4,
          class: 'svg-selected-label',
        });
        text.textContent = `${joint.label} · ${joint.id}`;
        labelLayer.append(text);
      }
    }

    fragment.append(boneLayer, jointLayer, labelLayer);

    if (this.showAxes) {
      fragment.append(this.createAxesOverlay());
    }

    this.svg.replaceChildren(fragment);
  }

  createAxesOverlay() {
    const group = createSvgElement('g', {
      class: 'svg-axes-overlay',
      transform: `translate(42 ${this.height - 42})`,
    });
    const axes = this.axesForView();

    const horizontal = createSvgElement('line', {
      x1: 0,
      y1: 0,
      x2: 27,
      y2: 0,
      class: `svg-axis axis-${axes.horizontal.toLowerCase()}`,
    });
    const vertical = createSvgElement('line', {
      x1: 0,
      y1: 0,
      x2: 0,
      y2: -27,
      class: `svg-axis axis-${axes.vertical.toLowerCase()}`,
    });
    const horizontalText = createSvgElement('text', {
      x: 32,
      y: 4,
      class: `svg-axis-label axis-${axes.horizontal.toLowerCase()}`,
    });
    horizontalText.textContent = axes.horizontal;
    const verticalText = createSvgElement('text', {
      x: -4,
      y: -33,
      class: `svg-axis-label axis-${axes.vertical.toLowerCase()}`,
    });
    verticalText.textContent = axes.vertical;
    group.append(horizontal, vertical, horizontalText, verticalText);
    return group;
  }

  axesForView() {
    if (this.viewType === 'side') {
      return { horizontal: 'Z', vertical: 'Y' };
    }
    if (this.viewType === 'top') {
      return { horizontal: 'X', vertical: 'Z' };
    }
    return { horizontal: 'X', vertical: 'Y' };
  }

  projectPoint(point) {
    if (this.viewType === 'side') {
      return { u: point.z, v: point.y };
    }
    if (this.viewType === 'top') {
      return { u: point.x, v: point.z };
    }
    if (this.viewType === 'perspective') {
      return {
        u: point.x + point.z * 0.46,
        v: point.y - point.z * 0.20,
      };
    }
    return { u: point.x, v: point.y };
  }

  unprojectPoint(projected, originalWorld) {
    if (this.viewType === 'side') {
      return { x: originalWorld.x, y: projected.v, z: projected.u };
    }
    if (this.viewType === 'top') {
      return { x: projected.u, y: originalWorld.y, z: projected.v };
    }
    if (this.viewType === 'perspective') {
      return {
        x: projected.u - originalWorld.z * 0.46,
        y: projected.v + originalWorld.z * 0.20,
        z: originalWorld.z,
      };
    }
    return { x: projected.u, y: projected.v, z: originalWorld.z };
  }

  worldToScreen(world) {
    const projected = this.projectPoint(world);
    const scale = this.baseScale * this.zoom;
    return {
      x: this.width / 2 + this.pan.x + (projected.u - this.projectedCenter.u) * scale,
      y: this.height / 2 + this.pan.y - (projected.v - this.projectedCenter.v) * scale,
    };
  }

  screenToProjected(clientX, clientY) {
    const bounds = this.svg.getBoundingClientRect();
    const x = clientX - bounds.left;
    const y = clientY - bounds.top;
    const scale = this.baseScale * this.zoom;
    return {
      u: this.projectedCenter.u + (x - this.width / 2 - this.pan.x) / scale,
      v: this.projectedCenter.v - (y - this.height / 2 - this.pan.y) / scale,
    };
  }

  bindEvents() {
    this.svg.addEventListener('contextmenu', (event) => event.preventDefault());
    this.svg.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.svg.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.svg.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.svg.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    this.svg.addEventListener('pointerleave', (event) => {
      if (!this.drag) {
        this.updateHover(null, null, event.clientX, event.clientY);
      }
    });
    this.svg.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
  }

  onPointerDown(event) {
    if (!this.definition) {
      return;
    }

    const target = event.target.closest?.('[data-joint-id]');
    const jointId = target?.dataset?.jointId ?? null;
    const kind = target?.dataset?.kind ?? null;

    if (event.button === 0 && jointId && (kind === 'joint' || kind === 'bone')) {
      event.preventDefault();
      this.callbacks.onSelect?.(jointId);
      this.svg.setPointerCapture(event.pointerId);

      const worldPositions = computePoseWorldPositions(this.definition);
      const joint = this.definition.joints.find((item) => item.id === jointId);
      const jointWorld = worldPositions.get(jointId);
      const parentWorld = joint?.parentId ? worldPositions.get(joint.parentId) : null;
      const anchorWorld = kind === 'bone' && parentWorld
        ? {
            x: (parentWorld.x + jointWorld.x) / 2,
            y: (parentWorld.y + jointWorld.y) / 2,
            z: (parentWorld.z + jointWorld.z) / 2,
          }
        : { ...jointWorld };

      this.drag = {
        type: 'rig',
        kind,
        pointerId: event.pointerId,
        jointId,
        startWorld: anchorWorld,
        changed: false,
      };
      this.callbacks.onDragStart?.({ jointId, kind, anchorWorld });
      return;
    }

    if (event.button === 0 || event.button === 1 || event.button === 2) {
      event.preventDefault();
      this.svg.setPointerCapture(event.pointerId);
      this.drag = {
        type: 'pan',
        pointerId: event.pointerId,
        lastX: event.clientX,
        lastY: event.clientY,
      };
    }
  }

  onPointerMove(event) {
    if (this.drag?.pointerId === event.pointerId) {
      if (this.drag.type === 'rig') {
        const projected = this.screenToProjected(event.clientX, event.clientY);
        const nextWorld = this.unprojectPoint(projected, this.drag.startWorld);
        this.drag.changed = true;
        this.callbacks.onDrag?.({
          jointId: this.drag.jointId,
          kind: this.drag.kind,
          worldPosition: nextWorld,
        });
      } else if (this.drag.type === 'pan') {
        this.pan.x += event.clientX - this.drag.lastX;
        this.pan.y += event.clientY - this.drag.lastY;
        this.drag.lastX = event.clientX;
        this.drag.lastY = event.clientY;
        this.render();
      }
      return;
    }

    const target = event.target.closest?.('[data-joint-id]');
    this.updateHover(
      target?.dataset?.jointId ?? null,
      target?.dataset?.kind ?? null,
      event.clientX,
      event.clientY,
    );
  }

  onPointerUp(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) {
      return;
    }

    const drag = this.drag;
    this.drag = null;
    if (this.svg.hasPointerCapture(event.pointerId)) {
      this.svg.releasePointerCapture(event.pointerId);
    }

    if (drag.type === 'rig') {
      this.callbacks.onDragEnd?.({
        jointId: drag.jointId,
        kind: drag.kind,
        changed: drag.changed,
      });
    }
  }

  onWheel(event) {
    if (!this.definition) {
      return;
    }
    event.preventDefault();
    const projectedAtCursor = this.screenToProjected(event.clientX, event.clientY);
    const oldScale = this.baseScale * this.zoom;
    const factor = Math.exp(-event.deltaY * 0.0012);
    this.zoom = clamp(this.zoom * factor, 0.28, 7);
    const newScale = this.baseScale * this.zoom;
    const du = projectedAtCursor.u - this.projectedCenter.u;
    const dv = projectedAtCursor.v - this.projectedCenter.v;
    this.pan.x += du * (oldScale - newScale);
    this.pan.y += dv * (newScale - oldScale);
    this.render();
  }

  updateHover(jointId, kind, clientX, clientY) {
    const key = `${jointId ?? ''}:${kind ?? ''}`;
    if (key === this.hoverTargetKey) {
      if (jointId) {
        this.callbacks.onHover?.(jointId, kind, clientX, clientY);
      }
      return;
    }
    this.hoverTargetKey = key;
    this.callbacks.onHover?.(jointId, kind, clientX, clientY);
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.svg.remove();
  }
}

function createSvgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    if (value == null) {
      continue;
    }
    element.setAttribute(name, String(value));
  }
  return element;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
