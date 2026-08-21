import { PROPORTION_FIELDS } from '../character-studio-controller.js';
import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldNumber,
  numberField,
  panelElement,
  panelShell,
} from '../components/panel-component.js';

const META = Object.freeze({
  height: ['身高', 1.4, 2.15], shoulderWidth: ['肩宽', 0.28, 0.58], hipWidth: ['髋宽', 0.14, 0.38],
  upperArmLength: ['上臂长度', 0.2, 0.4], forearmLength: ['前臂长度', 0.18, 0.36],
  handControlLength: ['手部控制长度', 0.04, 0.12], thighLength: ['大腿长度', 0.3, 0.56],
  lowerLegLength: ['小腿长度', 0.3, 0.54],
});

export class ProportionPanel extends CharacterStudioPanel {
  constructor() { super('proportion', 'Proportion'); }

  render(snapshot) {
    return panelShell({
      id: this.id,
      title: this.title,
      current: `${Number(snapshot.proportion.height).toFixed(3)} m`,
      body: PROPORTION_FIELDS.map((key) => numberField(key, META[key][0], snapshot.proportion[key], {
        min: META[key][1], max: META[key][2], step: 0.001, suffix: 'm',
      })).join(''),
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyProportion(Object.fromEntries(PROPORTION_FIELDS.map((key) => [key, fieldNumber(section, key)]))),
      reset: () => controller.resetProportion(),
    }, context);
  }
}
