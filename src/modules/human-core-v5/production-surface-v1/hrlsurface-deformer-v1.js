import { computeVertexNormalsV1 } from './hrlsurface-topology-v1.js';

export class HrlSurfaceDeformerV1 {
  constructor(parsed) {
    this.header = parsed.header;
    this.indices = new Uint32Array(parsed.chunks.indices);
    this.basePositions = new Float32Array(parsed.chunks.basePositions);
    this.positions = new Float32Array(this.basePositions);
    this.normals = parsed.chunks.baseNormals ? new Float32Array(parsed.chunks.baseNormals) : computeVertexNormalsV1(this.positions, this.indices);
    this.vertexSide = new Uint8Array(parsed.chunks.vertexSide);
    this.symmetryPartner = new Uint32Array(parsed.chunks.symmetryPartner);
    this.parameterBasis = new Float32Array(parsed.chunks.parameterBasis);
    this.parameters = new Map((this.header.parameters ?? []).map((definition, index) => [definition.id, { definition, index, value: definition.default ?? 0 }]));
    this.sculptDelta = new Float32Array(this.positions.length);
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }

  setParameter(id, value, { record = true } = {}) {
    const parameter = this.parameters.get(id);
    if (!parameter) throw new Error(`Unknown HRLSurface parameter ${id}.`);
    const next = clamp(value, parameter.definition.minimum, parameter.definition.maximum);
    const previous = parameter.value;
    if (next === previous) return false;
    parameter.value = next;
    if (record) this.#record({ type: 'parameter', id, previous, next });
    this.rebuildPositions();
    return true;
  }

  applyBrush({ center, radius, strength, direction = null, symmetricEdit = true, allowCenterlineOffset = false }) {
    if (!Array.isArray(center) || center.length !== 3 || radius <= 0 || !Number.isFinite(strength)) throw new Error('Invalid HRLSurface brush input.');
    const changed = new Map();
    const sourceNormals = this.normals;
    for (let vertex = 0; vertex < this.positions.length / 3; vertex += 1) {
      const offset = vertex * 3;
      const distance = Math.hypot(this.positions[offset] - center[0], this.positions[offset + 1] - center[1], this.positions[offset + 2] - center[2]);
      if (distance >= radius) continue;
      const t = 1 - distance / radius;
      const falloff = t * t * (3 - 2 * t);
      const requestedVector = direction ?? [sourceNormals[offset], sourceNormals[offset + 1], sourceNormals[offset + 2]];
      const vector = this.vertexSide[vertex] === 0 && !allowCenterlineOffset ? [0, requestedVector[1], requestedVector[2]] : requestedVector;
      addBrushDelta(changed, this.sculptDelta, vertex, vector, strength * falloff);
      if (symmetricEdit) {
        const partner = this.symmetryPartner[vertex];
        if (partner !== vertex) addBrushDelta(changed, this.sculptDelta, partner, [-vector[0], vector[1], vector[2]], strength * falloff);
      }
    }
    if (changed.size === 0) return 0;
    this.#record({ type: 'sculpt', changes: [...changed.entries()] });
    this.rebuildPositions();
    return changed.size;
  }

  applyVertexDelta({ vertex, delta, symmetricEdit = true, allowCenterlineOffset = false }) {
    if (!Number.isInteger(vertex) || vertex < 0 || vertex >= this.positions.length / 3 || !Array.isArray(delta) || delta.length !== 3 || delta.some((value) => !Number.isFinite(value))) throw new Error('Invalid HRLSurface vertex delta input.');
    const changed = new Map();
    const applied = this.vertexSide[vertex] === 0 && !allowCenterlineOffset ? [0, delta[1], delta[2]] : delta;
    addBrushDelta(changed, this.sculptDelta, vertex, applied, 1);
    if (symmetricEdit) {
      const partner = this.symmetryPartner[vertex];
      if (partner !== vertex) addBrushDelta(changed, this.sculptDelta, partner, [-applied[0], applied[1], applied[2]], 1);
    }
    this.#record({ type: 'sculpt', changes: [...changed.entries()] });
    this.rebuildPositions();
    return changed.size;
  }

  rebuildPositions() {
    this.positions.set(this.basePositions);
    const vertexComponents = this.positions.length;
    for (const parameter of this.parameters.values()) {
      if (parameter.value === 0) continue;
      const basisStart = parameter.index * vertexComponents;
      for (let component = 0; component < vertexComponents; component += 1) this.positions[component] += this.parameterBasis[basisStart + component] * parameter.value;
    }
    for (let component = 0; component < vertexComponents; component += 1) this.positions[component] += this.sculptDelta[component];
    this.normals = computeVertexNormalsV1(this.positions, this.indices);
    for (const listener of this.listeners) listener(this);
  }

  reset({ record = true } = {}) {
    const parameterValues = [...this.parameters].map(([id, value]) => [id, value.value]);
    const sculptDelta = new Float32Array(this.sculptDelta);
    for (const parameter of this.parameters.values()) parameter.value = parameter.definition.default ?? 0;
    this.sculptDelta.fill(0);
    if (record) this.#record({ type: 'reset', parameterValues, sculptDelta });
    this.rebuildPositions();
  }

  undo() {
    const command = this.undoStack.pop();
    if (!command) return false;
    this.#applyCommand(command, true);
    this.redoStack.push(command);
    this.rebuildPositions();
    return true;
  }

  redo() {
    const command = this.redoStack.pop();
    if (!command) return false;
    this.#applyCommand(command, false);
    this.undoStack.push(command);
    this.rebuildPositions();
    return true;
  }

  onChange(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  exportSculptLayer(id = 'user-sculpt') {
    const indices = [];
    const deltas = [];
    for (let vertex = 0; vertex < this.sculptDelta.length / 3; vertex += 1) {
      const offset = vertex * 3;
      if (this.sculptDelta[offset] === 0 && this.sculptDelta[offset + 1] === 0 && this.sculptDelta[offset + 2] === 0) continue;
      indices.push(vertex);
      deltas.push(this.sculptDelta[offset], this.sculptDelta[offset + 1], this.sculptDelta[offset + 2]);
    }
    return { id, indices: new Uint32Array(indices), deltas: new Float32Array(deltas) };
  }

  #record(command) { this.undoStack.push(command); this.redoStack.length = 0; }

  #applyCommand(command, reverse) {
    if (command.type === 'parameter') this.parameters.get(command.id).value = reverse ? command.previous : command.next;
    else if (command.type === 'sculpt') {
      for (const [vertex, delta] of command.changes) {
        const offset = vertex * 3;
        const sign = reverse ? -1 : 1;
        this.sculptDelta[offset] += delta[0] * sign; this.sculptDelta[offset + 1] += delta[1] * sign; this.sculptDelta[offset + 2] += delta[2] * sign;
      }
    } else if (command.type === 'reset') {
      if (reverse) {
        for (const [id, value] of command.parameterValues) this.parameters.get(id).value = value;
        this.sculptDelta.set(command.sculptDelta);
      } else {
        for (const parameter of this.parameters.values()) parameter.value = parameter.definition.default ?? 0;
        this.sculptDelta.fill(0);
      }
    }
  }
}

function addBrushDelta(changes, sculptDelta, vertex, direction, amount) {
  const offset = vertex * 3;
  const delta = [direction[0] * amount, direction[1] * amount, direction[2] * amount];
  sculptDelta[offset] += delta[0]; sculptDelta[offset + 1] += delta[1]; sculptDelta[offset + 2] += delta[2];
  const previous = changes.get(vertex) ?? [0, 0, 0];
  previous[0] += delta[0]; previous[1] += delta[1]; previous[2] += delta[2];
  changes.set(vertex, previous);
}

function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
