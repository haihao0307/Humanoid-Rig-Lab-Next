import {
  EYE_SHAPE_FIELDS,
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

export class FacePanel extends CharacterStudioPanel {
  constructor() { super('face', 'Face'); }

  render(snapshot) {
    const face = snapshot.face;
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
        return controller.applyFace(patch);
      },
      reset: () => controller.resetFace(),
    }, context);
  }
}
