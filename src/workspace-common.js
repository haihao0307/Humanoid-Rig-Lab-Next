export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function controlSection(title, body) {
  return `<section class="control-section"><h3>${title}</h3>${body}</section>`;
}

export function rangeControl(id, label, min, max, step, value, suffix = '') {
  return `<div class="control-row"><div class="control-row-header"><label for="${id}">${label}</label><output id="${id}Output">${value}${suffix}</output></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}

export function toggleControl(id, label, on, note = '') {
  return `<div class="toggle-row"><span>${label}${note ? `<small>${note}</small>` : ''}</span><button id="${id}" class="toggle ${on ? 'on' : ''}" type="button" aria-pressed="${on}"><i></i></button></div>`;
}

export function bindToggle(id, onToggle) {
  const button = document.querySelector(`#${id}`);
  if (!button) return;
  button.addEventListener('click', () => {
    const next = !button.classList.contains('on');
    button.classList.toggle('on', next);
    button.setAttribute('aria-pressed', String(next));
    onToggle(next);
  });
}

export function bindNumericRange({ id, hub, path, module, label, suffix = '', onMutate = null, onInput = null }) {
  const input = document.querySelector(`#${id}`);
  const output = document.querySelector(`#${id}Output`);
  if (!input) return;
  input.addEventListener('input', () => {
    if (output) output.value = `${input.value}${suffix}`;
    onInput?.(Number(input.value), input);
  });
  input.addEventListener('change', () => {
    hub.transaction((state) => {
      setPath(state, path, Number(input.value));
      onMutate?.(state, Number(input.value));
    }, { module, summary: `${label}调整为 ${input.value}${suffix}` });
  });
}

export function setPath(object, path, value) {
  const parts = String(path).split('.');
  let target = object;
  for (let index = 0; index < parts.length - 1; index += 1) target = target[parts[index]];
  target[parts.at(-1)] = value;
}

export function bumpPatch(version) {
  const match = String(version).match(/^(.*@)(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return version;
  return `${match[1]}${match[2]}.${match[3]}.${Number(match[4]) + 1}`;
}
