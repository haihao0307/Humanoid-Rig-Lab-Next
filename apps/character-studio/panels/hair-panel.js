import { HAIR_CATALOG } from '../catalogs.js';
import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldValue,
  panelElement,
  panelShell,
  selectField,
} from '../components/panel-component.js';

export class HairPanel extends CharacterStudioPanel {
  constructor() { super('hair', 'Hair'); }

  render(snapshot) {
    const current = snapshot.hair?.style || '';
    return panelShell({
      id: this.id,
      title: this.title,
      current: snapshot.hair ? `${snapshot.hair.name} · ${snapshot.hair.style}` : '未添加发型',
      body: selectField('style', '静态发型', current, [
        { value: '', label: '无' },
        ...HAIR_CATALOG.map((item) => ({ value: item.style, label: item.label })),
      ]),
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyHair(fieldValue(section, 'style')),
      reset: () => controller.resetHair(),
    }, context);
  }
}
