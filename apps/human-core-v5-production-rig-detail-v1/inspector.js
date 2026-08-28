export function renderInspector(container, element) {
  if (!container) return;
  if (!element) {
    container.innerHTML = '<div class="empty-inspector">Select a Core Joint, Core Bone, Performance Node, Interaction Anchor, or Limit Geometry.</div>';
    return;
  }
  const summary = [
    ['ID', element.id],
    ['Layer', element.layer],
    ['Source', element.source],
    ['Parent', element.parent ?? '—'],
    ['World Position', formatVector(element.worldPosition)],
    ['World Quaternion', formatVector(element.worldQuaternion)],
    ['Bone Length', element.boneLength == null ? '—' : `${formatNumber(element.boneLength)} m`],
    ['Axes', summarizeAxes(element.axes)],
    ['Limits', summarizeLimits(element.limits)],
    ['Capabilities', (element.capabilities ?? []).join(', ') || '—'],
    ['Status', element.status ?? '—'],
  ];
  container.innerHTML = `<dl class="inspector-summary">${summary.map(([label, value]) => (
    `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`
  )).join('')}</dl>${rawDetails(element)}`;
}

function rawDetails(element) {
  const records = [
    ['Raw Matrix', element.rawMatrix],
    ['Raw Quaternion', element.worldQuaternion],
    ['Raw Joint Profile', element.rawJointProfile],
    ['Raw finalPose', element.rawFinalPose],
    ['Raw Anchor Definition', element.rawAnchorDefinition],
  ].filter(([, value]) => value != null);
  return records.map(([label, value]) => (
    `<details><summary>${escapeHTML(label)}</summary><pre>${escapeHTML(JSON.stringify(value, null, 2))}</pre></details>`
  )).join('');
}

function summarizeAxes(value) {
  if (!value) return '—';
  return `T ${formatVector(value.twistAxisLocal)} · B ${formatVector(value.bendAxisLocal)} · S ${formatVector(value.sideAxisLocal)}`;
}

function summarizeLimits(value) {
  if (!value?.ranges) return 'LIMIT UNDEFINED';
  return Object.entries(value.ranges).map(([key, range]) => `${key} ${range.join('…')}°`).join(' · ');
}

function formatVector(value) {
  return Array.isArray(value) ? `[${value.map(formatNumber).join(', ')}]` : '—';
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(6).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '') : String(value);
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
