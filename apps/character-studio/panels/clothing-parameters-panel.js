import { escapeHtml } from '../components/panel-component.js';

const CLOTHING_SIZE_OPTIONS = Object.freeze(['XS', 'S', 'M', 'L', 'XL', 'custom']);

export class ClothingParametersPanel {
  constructor(controller, { onError = console.error } = {}) {
    if (!controller || typeof controller.applyClothingParameters !== 'function') {
      throw new TypeError('ClothingParametersPanel requires a CharacterStudioController.');
    }
    this.controller = controller;
    this.onError = onError;
    this.selectedId = null;
    this.snapshot = null;
    this.runtime = null;
    this.statusMessage = '';
    this.element = document.createElement('div');
    this.element.className = 'character-studio-clothing-parameters';
    this.element.dataset.clothingParameterPanel = 'true';
    this.element.addEventListener('change', (event) => this.handleChange(event));
    this.element.addEventListener('click', (event) => this.handleClick(event));
  }

  select(clothingId) {
    this.selectedId = String(clothingId || '') || null;
    if (this.snapshot) this.render(this.snapshot, this.runtime);
  }

  render(snapshot, runtime = null) {
    this.snapshot = snapshot;
    this.runtime = runtime;
    const assets = Array.isArray(snapshot?.clothing) ? snapshot.clothing : [];
    if (!assets.some((asset) => asset.clothing_id === this.selectedId)) {
      this.selectedId = assets[0]?.clothing_id || null;
    }
    const asset = assets.find((item) => item.clothing_id === this.selectedId) || null;
    this.element.dataset.selectedClothingId = asset?.clothing_id || '';
    this.element.innerHTML = asset
      ? parameterMarkup(asset, assets, runtime, this.statusMessage)
      : emptyMarkup();
  }

  handleChange(event) {
    const select = event.target.closest?.('[data-clothing-parameter-select]');
    if (!select) return;
    this.selectedId = select.value || null;
    this.statusMessage = '';
    this.render(this.snapshot, this.runtime);
  }

  handleClick(event) {
    const button = event.target.closest?.('[data-clothing-parameters-apply]');
    if (!button || !this.selectedId) return;
    try {
      this.controller.applyClothingParameters(this.selectedId, readParameters(this.element));
      this.statusMessage = '已应用并写回 ClothingProfile / CharacterProfile。';
      this.render(this.controller.snapshot(), this.runtime);
    } catch (error) {
      this.statusMessage = error?.message || String(error);
      this.onError(error);
      this.render(this.snapshot, this.runtime);
      const status = this.element.querySelector('[data-clothing-parameter-status]');
      if (status) status.dataset.error = 'true';
    }
  }
}

function parameterMarkup(asset, assets, runtime, statusMessage) {
  const size = asset.size_profile || {};
  const offset = size.offset || {};
  const material = asset.material || {};
  const render = asset.render_profile || {};
  const physics = asset.physics_profile || {};
  const runtimeFrame = runtime?.clothingFrame?.asset_frames?.find((item) => item.clothing_id === asset.clothing_id);
  const runtimeStatus = runtimeFrame?.status || 'profile-ready';
  return `
    <div class="character-studio-clothing-parameter-heading">
      <span class="eyebrow">CLOTHING PARAMETERS</span>
      <b>${escapeHtml(asset.clothing_id)}</b>
      <small>${escapeHtml(asset.type)} · asset r${Number(asset.revision)} · ${escapeHtml(runtimeStatus)}</small>
    </div>
    <label class="character-studio-clothing-parameter-select">
      <span>Editing Asset</span>
      <select data-clothing-parameter-select>
        ${assets.map((item) => `<option value="${escapeHtml(item.clothing_id)}"${item.clothing_id === asset.clothing_id ? ' selected' : ''}>${escapeHtml(item.clothing_id)}</option>`).join('')}
      </select>
    </label>
    <section class="character-studio-clothing-parameter-group">
      <h4>Fit</h4>
      ${selectControl('size', 'Size', size.size || 'M', CLOTHING_SIZE_OPTIONS)}
      ${numberControl('scale', 'Scale', size.scale ?? 1, 0.5, 2, 0.01)}
      ${numberControl('length', 'Length', size.length ?? 1, 0.5, 2, 0.01)}
      <div class="character-studio-clothing-offset">
        <span>Offset</span>
        <div>
          ${axisControl('offsetX', 'X', offset.x ?? 0)}
          ${axisControl('offsetY', 'Y', offset.y ?? 0)}
          ${axisControl('offsetZ', 'Z', offset.z ?? 0)}
        </div>
      </div>
      ${numberControl('layer', 'Layer', render.layer ?? 1, 0, 31, 1)}
    </section>
    <section class="character-studio-clothing-parameter-group">
      <h4>Material</h4>
      <label class="character-studio-clothing-color"><span>Base Color</span><input type="color" data-clothing-parameter="baseColor" value="${escapeHtml(material.base_color || '#526d9e')}"></label>
      ${numberControl('roughness', 'Roughness', material.roughness ?? 0.78, 0, 1, 0.01)}
      ${numberControl('metalness', 'Metalness', material.metalness ?? 0.02, 0, 1, 0.01)}
      ${numberControl('opacity', 'Opacity', material.opacity ?? 1, 0, 1, 0.01)}
    </section>
    <section class="character-studio-clothing-parameter-group character-studio-clothing-simulation-interface">
      <h4>Cloth Simulation · Interface</h4>
      <dl>
        <div><dt>physicsMode</dt><dd>${escapeHtml(physics.physicsMode || 'static-follow')}</dd></div>
        <div><dt>collisionGroup</dt><dd>${escapeHtml(physics.collisionGroup || 'not assigned')}</dd></div>
        <div><dt>materialProperties</dt><dd>density / friction / damping</dd></div>
      </dl>
      <small>接口已预留；V001 不启用复杂布料模拟。</small>
    </section>
    <button class="character-studio-clothing-apply" type="button" data-clothing-parameters-apply>应用修改</button>
    <p class="character-studio-clothing-parameter-status" data-clothing-parameter-status aria-live="polite">${escapeHtml(statusMessage || '修改将在应用后立即同步到中间人物预览。')}</p>`;
}

function emptyMarkup() {
  return `
    <div class="character-studio-clothing-parameter-empty">
      <span class="eyebrow">CLOTHING PARAMETERS</span>
      <b>未选择服装</b>
      <p>先从左侧 Clothing Library 添加 Upper Body、Lower Body 或 Shoes。</p>
    </div>`;
}

function selectControl(name, label, value, options) {
  return `<label class="character-studio-clothing-control"><span>${escapeHtml(label)}</span><select data-clothing-parameter="${escapeHtml(name)}">${options.map((option) => `<option value="${escapeHtml(option)}"${option === value ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></label>`;
}

function numberControl(name, label, value, min, max, step) {
  return `<label class="character-studio-clothing-control"><span>${escapeHtml(label)}</span><input type="number" data-clothing-parameter="${escapeHtml(name)}" min="${min}" max="${max}" step="${step}" value="${Number(value)}"></label>`;
}

function axisControl(name, axis, value) {
  return `<label><span>${axis}</span><input type="number" data-clothing-parameter="${name}" min="-1" max="1" step="0.01" value="${Number(value)}"></label>`;
}

function readParameters(root) {
  const value = (name) => root.querySelector(`[data-clothing-parameter="${name}"]`)?.value;
  return {
    size: value('size'),
    scale: Number(value('scale')),
    length: Number(value('length')),
    offsetX: Number(value('offsetX')),
    offsetY: Number(value('offsetY')),
    offsetZ: Number(value('offsetZ')),
    layer: Number(value('layer')),
    baseColor: value('baseColor'),
    roughness: Number(value('roughness')),
    metalness: Number(value('metalness')),
    opacity: Number(value('opacity')),
  };
}

export { CLOTHING_SIZE_OPTIONS, readParameters };
