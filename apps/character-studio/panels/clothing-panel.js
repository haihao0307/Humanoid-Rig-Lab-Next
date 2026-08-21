import { CLOTHING_CATALOG } from '../catalogs.js';
import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldValue,
  panelElement,
  panelShell,
  selectField,
} from '../components/panel-component.js';

const LABELS = Object.freeze({ top: '上衣', pants: '裤子', shoes: '鞋' });

export class ClothingPanel extends CharacterStudioPanel {
  constructor() { super('clothing', 'Clothing'); }

  render(snapshot) {
    const activeByType = Object.fromEntries(snapshot.clothing.map((asset) => [asset.type, asset.clothing_id]));
    const controls = Object.entries(CLOTHING_CATALOG).map(([type, items]) => {
      const options = [{ value: '', label: '无' }, ...items.map((item) => ({ value: item.id, label: item.label }))];
      const currentId = activeByType[type] || '';
      if (currentId && !items.some((item) => item.id === currentId)) options.push({ value: currentId, label: currentId });
      return selectField(type, LABELS[type], currentId, options);
    }).join('');
    return panelShell({
      id: this.id,
      title: this.title,
      current: snapshot.clothing.length ? `${snapshot.clothing.length} 件静态服装` : '未添加服装',
      body: controls,
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyClothing(Object.fromEntries(Object.keys(CLOTHING_CATALOG).map((type) => [type, fieldValue(section, type)]))),
      reset: () => controller.resetClothing(),
    }, context);
  }
}
