export class CharacterStudioPanel {
  constructor(id, title) {
    this.id = id;
    this.title = title;
  }

  render() {
    throw new Error(`${this.constructor.name}.render() must be implemented.`);
  }

  bind() {}
}

export function panelShell({ id, title, current, body, actions = true, open = false }) {
  return `
    <details class="character-studio-section" data-character-section="${escapeHtml(id)}"${open ? ' open' : ''}>
      <summary>
        <span>${escapeHtml(title)}</span>
        <small>${escapeHtml(current || '未设置')}</small>
      </summary>
      <div class="character-studio-section__body">
        ${body}
        ${actions ? `<div class="character-studio-actions"><button type="button" data-panel-action="apply">应用修改</button><button type="button" data-panel-action="reset">恢复默认</button></div>` : ''}
      </div>
    </details>`;
}

export function textField(name, label, value, { placeholder = '' } = {}) {
  return fieldShell(label, `<input type="text" data-field="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}">`);
}

export function numberField(name, label, value, { min = 0, max = 1, step = 0.01, suffix = '' } = {}) {
  return fieldShell(label, `<span class="character-studio-number"><input type="number" data-field="${escapeHtml(name)}" min="${min}" max="${max}" step="${step}" value="${Number(value).toFixed(step < 0.01 ? 3 : 2)}"><small>${escapeHtml(suffix)}</small></span>`);
}

export function selectField(name, label, value, options) {
  const html = options.map((option) => `<option value="${escapeHtml(option.value)}"${String(option.value) === String(value ?? '') ? ' selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
  return fieldShell(label, `<select data-field="${escapeHtml(name)}">${html}</select>`);
}

export function checkboxField(name, label, checked, note = '') {
  return `<label class="character-studio-check"><span><b>${escapeHtml(label)}</b>${note ? `<small>${escapeHtml(note)}</small>` : ''}</span><input type="checkbox" data-field="${escapeHtml(name)}"${checked ? ' checked' : ''}></label>`;
}

export function fieldShell(label, control) {
  return `<label class="character-studio-field"><span>${escapeHtml(label)}</span>${control}</label>`;
}

export function panelElement(root, panelId) {
  return root?.querySelector?.(`[data-character-section="${panelId}"]`) || null;
}

export function fieldValue(section, name) {
  return section?.querySelector?.(`[data-field="${name}"]`)?.value ?? '';
}

export function fieldNumber(section, name) {
  return Number(fieldValue(section, name));
}

export function fieldChecked(section, name) {
  return Boolean(section?.querySelector?.(`[data-field="${name}"]`)?.checked);
}

export function bindPanelActions(section, { apply, reset }, context) {
  section?.querySelector?.('[data-panel-action="apply"]')?.addEventListener('click', () => context.run(apply));
  section?.querySelector?.('[data-panel-action="reset"]')?.addEventListener('click', () => context.run(reset));
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}
