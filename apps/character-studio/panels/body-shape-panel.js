import { BODY_SHAPE_PARAMETER_KEYS } from '../../../packages/body-shape/index.js';
import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldNumber,
  numberField,
  panelElement,
  panelShell,
} from '../components/panel-component.js';

const LABELS = Object.freeze({
  muscle: '肌肉', fat: '脂肪', shoulder_volume: '肩部体积', chest_volume: '胸部体积',
  waist_volume: '腰部体积', hip_volume: '髋部体积', arm_volume: '手臂体积', leg_volume: '腿部体积',
});

export class BodyShapePanel extends CharacterStudioPanel {
  constructor() { super('body-shape', 'BodyShape'); }

  render(snapshot) {
    return panelShell({
      id: this.id,
      title: this.title,
      current: `${snapshot.bodyShape.name} · v${snapshot.bodyShape.version}`,
      body: BODY_SHAPE_PARAMETER_KEYS.map((key) => numberField(key, LABELS[key], snapshot.bodyShape[key], {
        min: 0, max: 1, step: 0.01,
      })).join(''),
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyBodyShape(Object.fromEntries(BODY_SHAPE_PARAMETER_KEYS.map((key) => [key, fieldNumber(section, key)]))),
      reset: () => controller.resetBodyShape(),
    }, context);
  }
}
