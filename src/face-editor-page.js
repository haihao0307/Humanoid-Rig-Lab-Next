import { ProjectHubClient } from './project-hub.js';
import {
  EYE_SHAPE_FIELDS,
  FACE_SHAPE_FIELDS,
  MOUTH_SHAPE_FIELDS,
  NOSE_SHAPE_FIELDS,
  createFaceRuntimeDescriptor,
} from '../packages/face-system/index.js';

const GROUPS = [
  { key: 'face_shape', element: 'faceShapeControls', fields: FACE_SHAPE_FIELDS },
  { key: 'eye_shape', element: 'eyeShapeControls', fields: EYE_SHAPE_FIELDS },
  { key: 'nose_shape', element: 'noseShapeControls', fields: NOSE_SHAPE_FIELDS },
  { key: 'mouth_shape', element: 'mouthShapeControls', fields: MOUTH_SHAPE_FIELDS },
];
const LABELS = {
  width: '宽度', height: '高度', jaw_width: '下颌宽度', cheekbone: '颧骨',
  size: '尺寸', spacing: '间距', tilt: '倾斜', length: '长度',
  bridge_height: '鼻梁高度', fullness: '饱满度', corner_curve: '嘴角弧度',
};

const elements = Object.fromEntries([
  'faceTitle', 'faceVersion', 'faceDirty', 'faceStateRevision', 'characterFaceRevision',
  'faceVersionSelect', 'previewFaceVersionButton', 'restoreFaceVersionButton', 'showCurrentFaceButton',
  'newFaceButton', 'saveFaceButton', 'faceParameterForm', 'faceAge', 'ageValue', 'faceExpression',
  'faceSilhouette', 'faceDescriptor', 'faceBackendList', 'faceStatusMessage', 'faceModeBadge', 'faceSyncPill',
].map((id) => [id, document.getElementById(id)]));

buildParameterControls();

const hub = new ProjectHubClient({ module: 'integration', title: 'Face Identity 参数编辑器' });
let projectState = hub.getState();
let previewedVersion = null;

hub.subscribe((state) => {
  projectState = state;
  updateConnectionState();
  if (previewedVersion == null) renderCurrent();
  else populateVersions();
});

elements.faceParameterForm.addEventListener('input', (event) => {
  updateControlOutput(event.target);
  renderPreview(readFormPreview());
});

elements.faceParameterForm.addEventListener('change', (event) => {
  if (previewedVersion != null) {
    setStatus('历史版本为只读，请先返回当前编辑版本。', true);
    renderCurrent();
    return;
  }
  const target = event.target;
  try {
    if (target.id === 'faceAge') {
      hub.updateFaceIdentity({ age: Number(target.value) });
    } else if (target.id === 'faceExpression') {
      const current = activeFace();
      hub.updateFaceIdentity({
        expression_profile: {
          ...current.expression_profile,
          default_expression: target.value,
          revision: current.expression_profile.revision + 1,
        },
      });
    } else if (target.dataset.group && target.dataset.key) {
      hub.updateFaceIdentity({ [target.dataset.group]: { [target.dataset.key]: Number(target.value) } });
    }
    setStatus('参数已写入 Face 草稿。');
  } catch (error) {
    setStatus(error.message, true);
    renderCurrent();
  }
});

elements.newFaceButton.addEventListener('click', () => {
  const suggested = `face_${Date.now()}`;
  const faceId = window.prompt('输入新的 face_id', suggested)?.trim();
  if (!faceId) return;
  try {
    hub.createFaceIdentity({ face_id: faceId, age: 30 });
    previewedVersion = null;
    setStatus(`已创建 ${faceId}，并更新 Character 引用。`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.saveFaceButton.addEventListener('click', () => {
  try {
    const result = hub.saveFaceVersion();
    previewedVersion = null;
    setStatus(`Face v${result.profile.version} 已保存，并更新 Character 引用。`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.previewFaceVersionButton.addEventListener('click', () => {
  const version = Number(elements.faceVersionSelect.value);
  try {
    const profile = hub.getFace({ version });
    previewedVersion = version;
    renderProfile(profile, { historical: true });
    setStatus(`正在只读查看 Face v${version}。`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.restoreFaceVersionButton.addEventListener('click', () => {
  const version = Number(elements.faceVersionSelect.value);
  try {
    const result = hub.restoreFaceVersion(version);
    previewedVersion = null;
    setStatus(`已从 v${version} 恢复为新版本 v${result.profile.version}。`);
  } catch (error) {
    setStatus(error.message, true);
  }
});

elements.showCurrentFaceButton.addEventListener('click', () => {
  previewedVersion = null;
  renderCurrent();
  setStatus('已返回当前编辑版本。');
});

window.addEventListener('beforeunload', () => hub.destroy());

function buildParameterControls() {
  for (const group of GROUPS) {
    const container = document.getElementById(group.element);
    for (const key of group.fields) {
      const label = document.createElement('label');
      label.className = 'parameter-control';
      const caption = document.createElement('span');
      caption.textContent = LABELS[key] || key;
      const output = document.createElement('output');
      output.textContent = '0.50';
      caption.append(output);
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.01';
      input.value = '0.5';
      input.dataset.group = group.key;
      input.dataset.key = key;
      input.dataset.output = `${group.key}-${key}`;
      label.append(caption, input);
      container.append(label);
    }
  }
}

function renderCurrent() {
  renderProfile(activeFace(), { historical: false });
}

function renderProfile(profile, { historical }) {
  const state = projectState.faceSystem;
  const character = activeCharacter();
  elements.faceTitle.textContent = profile.face_id;
  elements.faceVersion.textContent = profile.version;
  elements.faceDirty.textContent = historical ? '历史快照' : state.dirty ? '草稿' : '已保存';
  elements.faceStateRevision.textContent = state.revision;
  elements.characterFaceRevision.textContent = character?.face_identity?.face_id
    ? `${character.face_identity.face_id} · v${character.face_identity.revision}`
    : '未引用';
  elements.faceModeBadge.textContent = historical ? `HISTORY · V${profile.version}` : 'CURRENT';
  elements.faceParameterForm.toggleAttribute('data-readonly', historical);
  for (const control of elements.faceParameterForm.querySelectorAll('input, select')) control.disabled = historical;
  elements.faceAge.value = String(profile.age);
  elements.ageValue.textContent = String(profile.age);
  elements.faceExpression.value = profile.expression_profile.default_expression;
  for (const group of GROUPS) {
    for (const key of group.fields) {
      const input = elements.faceParameterForm.querySelector(`[data-group="${group.key}"][data-key="${key}"]`);
      input.value = String(profile[group.key][key]);
      updateControlOutput(input);
    }
  }
  populateVersions();
  renderPreview(profile);
}

function renderPreview(profile) {
  const face = elements.faceSilhouette;
  const percent = (value, min, max) => `${min + (max - min) * value}px`;
  face.style.setProperty('--face-width', percent(profile.face_shape.width, 210, 292));
  face.style.setProperty('--face-height', percent(profile.face_shape.height, 286, 368));
  face.style.setProperty('--eye-size', String(.72 + profile.eye_shape.size * .65));
  face.style.setProperty('--eye-gap', percent(profile.eye_shape.spacing, 38, 72));
  face.style.setProperty('--eye-tilt', `${(profile.eye_shape.tilt - .5) * 18}deg`);
  face.style.setProperty('--nose-width', percent(profile.nose_shape.width, 18, 39));
  face.style.setProperty('--nose-length', percent(profile.nose_shape.length, 55, 94));
  face.style.setProperty('--mouth-width', percent(profile.mouth_shape.width, 65, 126));
  face.style.setProperty('--mouth-fullness', percent(profile.mouth_shape.fullness, 4, 11));
  const expressionCurve = { neutral: 0, smile: -8, frown: 8, surprise: 0 }[profile.expression_profile.default_expression] || 0;
  face.style.setProperty('--mouth-curve', `${expressionCurve + (profile.mouth_shape.corner_curve - .5) * 12}deg`);
  face.dataset.expression = profile.expression_profile.default_expression;

  const descriptor = createFaceRuntimeDescriptor(profile);
  elements.faceDescriptor.textContent = JSON.stringify(descriptor, null, 2);
  elements.faceBackendList.replaceChildren(...descriptor.backend_interfaces.map((item) => {
    const card = document.createElement('div');
    card.className = 'face-backend';
    const name = document.createElement('strong');
    name.textContent = item.backend;
    const detail = document.createElement('span');
    detail.textContent = `${item.status} · ${item.expected_output}`;
    card.append(name, detail);
    return card;
  }));
}

function populateVersions() {
  const state = projectState.faceSystem;
  const versions = state.versions[state.active_face_id] || [];
  const selected = elements.faceVersionSelect.value;
  elements.faceVersionSelect.replaceChildren(...versions.map((profile) => {
    const option = document.createElement('option');
    option.value = String(profile.version);
    option.textContent = `v${profile.version}`;
    return option;
  }));
  if ([...elements.faceVersionSelect.options].some((option) => option.value === selected)) {
    elements.faceVersionSelect.value = selected;
  } else if (versions.length) {
    elements.faceVersionSelect.value = String(versions.at(-1).version);
  }
}

function activeFace() {
  const state = projectState.faceSystem;
  return structuredClone(state.profiles[state.active_face_id]);
}

function activeCharacter() {
  const state = projectState.characterCore;
  return state.profiles[state.active_character_id] || null;
}

function readFormPreview() {
  const profile = activeFace();
  profile.age = Number(elements.faceAge.value);
  profile.expression_profile.default_expression = elements.faceExpression.value;
  for (const group of GROUPS) {
    for (const key of group.fields) {
      const input = elements.faceParameterForm.querySelector(`[data-group="${group.key}"][data-key="${key}"]`);
      profile[group.key][key] = Number(input.value);
    }
  }
  return profile;
}

function updateControlOutput(target) {
  if (target === elements.faceAge) {
    elements.ageValue.textContent = target.value;
    return;
  }
  const output = target.closest?.('.parameter-control')?.querySelector('output');
  if (output) output.textContent = Number(target.value).toFixed(2);
}

function updateConnectionState() {
  const label = elements.faceSyncPill.querySelector('b');
  label.textContent = hub.transport;
  elements.faceSyncPill.classList.toggle('offline', !hub.connected);
}

function setStatus(message, error = false) {
  elements.faceStatusMessage.textContent = message;
  elements.faceStatusMessage.style.color = error ? 'var(--danger)' : 'var(--muted)';
}
