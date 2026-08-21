import {
  EYE_SHAPE_FIELDS,
  FACE_EXPRESSION_CHANNEL_DEFINITIONS,
  FACE_EXPRESSION_CHANNELS,
  FACE_EXPRESSION_MIRROR_PAIRS,
  FACE_SHAPE_FIELDS,
  MOUTH_SHAPE_FIELDS,
  NOSE_SHAPE_FIELDS,
} from '../../../packages/face-system/index.js';
import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldNumber,
  fieldValue,
  numberField,
  panelElement,
  panelShell,
  selectField,
} from '../components/panel-component.js';

const GROUPS = Object.freeze([
  ['face_shape', '脸型', FACE_SHAPE_FIELDS],
  ['eye_shape', '眼睛', EYE_SHAPE_FIELDS],
  ['nose_shape', '鼻子', NOSE_SHAPE_FIELDS],
  ['mouth_shape', '嘴部', MOUTH_SHAPE_FIELDS],
]);

const EXPRESSION_LABELS = new Map(FACE_EXPRESSION_CHANNEL_DEFINITIONS.map(({ channel, label }) => [channel, label]));
const EXPRESSION_PAIR_BY_CHANNEL = new Map(
  FACE_EXPRESSION_MIRROR_PAIRS.flatMap((pair) => pair.map((channel) => [channel, pair])),
);

export class FacePanel extends CharacterStudioPanel {
  constructor() { super('face', 'Face'); }

  render(snapshot) {
    const face = snapshot.face;
    const expression = snapshot.faceExpression;
    const controls = [numberField('age', '年龄', face.age, { min: 0, max: 120, step: 1 })];
    for (const [group, label, fields] of GROUPS) {
      controls.push(`<h4>${label}</h4>`);
      controls.push(...fields.map((field) => numberField(`${group}.${field}`, field, face[group][field], {
        min: 0, max: 1, step: 0.01,
      })));
    }
    controls.push(selectField('expression', '默认表情', face.expression_profile.default_expression, [
      { value: 'neutral', label: 'Neutral' }, { value: 'smile', label: 'Smile' },
      { value: 'frown', label: 'Frown' }, { value: 'surprise', label: 'Surprise' },
    ]));
    controls.push('<h4>Expression Channels</h4>');
    controls.push('<p class="character-studio-face-expression-note">Expression State → Face Runtime → Morph / Corrective Layer</p>');
    controls.push(`<div class="character-studio-face-expression-panel">
      ${FACE_EXPRESSION_CHANNELS.map((channel) => expressionControl(
        channel,
        EXPRESSION_LABELS.get(channel) || channel,
        expression?.channels?.[channel],
      )).join('')}
      <button class="character-studio-face-mirror" type="button" data-face-expression-mirror>镜像表情</button>
      <div class="character-studio-face-expression-status">Expression r${Number(expression?.expressionRevision || 1)}</div>
    </div>`);
    return panelShell({ id: this.id, title: this.title, current: `${face.face_id} · v${face.version}`, body: controls.join('') });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => {
        const patch = { age: Math.round(fieldNumber(section, 'age')) };
        for (const [group, , fields] of GROUPS) {
          patch[group] = Object.fromEntries(fields.map((field) => [field, fieldNumber(section, `${group}.${field}`)]));
        }
        patch.expression_profile = { default_expression: fieldValue(section, 'expression') };
        controller.applyFace(patch);
        const channels = Object.fromEntries(FACE_EXPRESSION_CHANNELS.map((channel) => [
          channel,
          Number(section.querySelector(`[data-expression-channel="${channel}"]`)?.value || 0),
        ]));
        return controller.applyFaceExpression(channels);
      },
      reset: () => controller.resetFace(),
    }, context);
    section?.querySelector?.('[data-face-expression-mirror]')?.addEventListener('click', () => (
      context.run(() => controller.mirrorFaceExpression())
    ));
    section?.querySelectorAll?.('[data-face-expression-mirror-pair]').forEach((button) => {
      button.addEventListener('click', () => context.run(() => controller.mirrorFaceExpressionPair(
        button.dataset.faceExpressionMirrorPair.split(','),
      )));
    });
  }
}

function expressionControl(channel, label, value) {
  const normalized = Math.min(1, Math.max(0, Number(value) || 0));
  const pair = EXPRESSION_PAIR_BY_CHANNEL.get(channel);
  const mirror = pair
    ? `<button class="character-studio-expression-mirror" type="button" data-face-expression-mirror-pair="${pair.join(',')}" aria-label="镜像 ${label}" title="镜像左右参数">↔</button>`
    : '<span class="character-studio-expression-mirror-placeholder" aria-hidden="true"></span>';
  return `<label class="character-studio-expression-control">
    <span>${label}</span>
    <input type="range" min="0" max="1" step="0.01" value="${normalized}" data-expression-channel="${channel}" aria-label="${label}">
    <output>${normalized.toFixed(2)}</output>${mirror}
  </label>`;
}
