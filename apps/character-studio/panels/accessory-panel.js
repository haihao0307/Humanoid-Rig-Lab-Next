import { ACCESSORY_CATALOG } from '../catalogs.js';
import {
  CharacterStudioPanel,
  bindPanelActions,
  checkboxField,
  fieldChecked,
  panelElement,
  panelShell,
} from '../components/panel-component.js';

export class AccessoryPanel extends CharacterStudioPanel {
  constructor() { super('accessory', 'Accessory'); }

  render(snapshot) {
    const enabled = new Set(snapshot.accessories.map((item) => item.type));
    return panelShell({
      id: this.id,
      title: this.title,
      current: snapshot.accessories.length ? snapshot.accessories.map((item) => item.type).join(', ') : '未添加附件',
      body: ACCESSORY_CATALOG.map((item) => checkboxField(item.type, item.label, enabled.has(item.type), 'static-follow')).join(''),
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyAccessories(ACCESSORY_CATALOG.filter((item) => fieldChecked(section, item.type)).map((item) => item.type)),
      reset: () => controller.resetAccessories(),
    }, context);
  }
}
