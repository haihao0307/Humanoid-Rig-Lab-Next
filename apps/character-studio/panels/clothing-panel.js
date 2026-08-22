import { ACCESSORY_CATALOG, CLOTHING_CATALOG } from '../catalogs.js';
import {
  CharacterStudioPanel,
  escapeHtml,
  panelElement,
  panelShell,
} from '../components/panel-component.js';

const CLOTHING_LIBRARY_CATEGORIES = Object.freeze([
  Object.freeze({ id: 'upper-body', label: 'Upper Body', type: 'top', source: 'clothing' }),
  Object.freeze({ id: 'lower-body', label: 'Lower Body', type: 'pants', source: 'clothing' }),
  Object.freeze({ id: 'shoes', label: 'Shoes', type: 'shoes', source: 'clothing' }),
  Object.freeze({ id: 'accessory', label: 'Accessory', type: 'accessory', source: 'appearance' }),
]);

const TYPE_LABELS = Object.freeze({ top: 'Upper Body', pants: 'Lower Body', shoes: 'Shoes' });

export class ClothingPanel extends CharacterStudioPanel {
  constructor() { super('clothing', 'Clothing'); }

  render(snapshot) {
    return panelShell({
      id: this.id,
      title: this.title,
      current: snapshot.clothing.length ? `${snapshot.clothing.length} 件服装 · v${snapshot.clothingProfile.version}` : '未添加服装',
      body: `
        <div class="character-studio-clothing-workbench" data-clothing-workbench>
          <div class="character-studio-clothing-heading">
            <span><b>Clothing Library</b><small>选择服装后通过 simulationRig 立即更新中间预览。</small></span>
            <button type="button" data-clothing-remove-all>清空</button>
          </div>
          <div class="character-studio-clothing-library">
            ${CLOTHING_LIBRARY_CATEGORIES.map((category) => clothingCategoryMarkup(category, snapshot)).join('')}
          </div>
          <section class="character-studio-clothing-equipped" data-clothing-equipped>
            <h4>Current Clothing</h4>
            ${snapshot.clothing.length
              ? snapshot.clothing.map((asset) => equippedAssetMarkup(asset)).join('')
              : '<p class="character-studio-clothing-empty">当前没有 ClothingAsset；Body 预览保持可见。</p>'}
          </section>
        </div>`,
      actions: false,
      open: true,
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    section?.querySelectorAll('[data-clothing-add]').forEach((button) => {
      button.addEventListener('click', () => {
        const clothingId = button.dataset.clothingAdd;
        context.run(() => controller.addClothing(clothingId));
        dispatchClothingSelection(root, clothingId);
      });
    });
    section?.querySelectorAll('[data-clothing-delete]').forEach((button) => {
      button.addEventListener('click', () => context.run(() => controller.removeClothing(button.dataset.clothingDelete)));
    });
    section?.querySelectorAll('[data-clothing-select]').forEach((button) => {
      button.addEventListener('click', () => dispatchClothingSelection(root, button.dataset.clothingSelect));
    });
    section?.querySelectorAll('[data-clothing-replace]').forEach((button) => {
      button.addEventListener('click', () => {
        const clothingId = button.dataset.clothingReplace;
        const replacementId = section.querySelector(`[data-clothing-replacement-for="${clothingId}"]`)?.value;
        context.run(() => controller.replaceClothing(clothingId, replacementId));
        dispatchClothingSelection(root, replacementId);
      });
    });
    section?.querySelectorAll('[data-clothing-accessory-add]').forEach((button) => {
      button.addEventListener('click', () => context.run(() => controller.addClothingAccessory(button.dataset.clothingAccessoryAdd)));
    });
    section?.querySelectorAll('[data-clothing-accessory-remove]').forEach((button) => {
      button.addEventListener('click', () => context.run(() => controller.removeClothingAccessory(button.dataset.clothingAccessoryRemove)));
    });
    section?.querySelector('[data-clothing-remove-all]')?.addEventListener('click', () => context.run(() => controller.resetClothing()));
  }
}

function clothingCategoryMarkup(category, snapshot) {
  if (category.source === 'appearance') {
    const activeTypes = new Set(snapshot.accessories.map((item) => item.type));
    return libraryCategoryShell(category, ACCESSORY_CATALOG.map((item) => {
      const active = activeTypes.has(item.type);
      return libraryItemMarkup(item, {
        active,
        action: active ? 'remove-accessory' : 'add-accessory',
        actionValue: item.type,
      });
    }).join(''), 'Appearance System reference');
  }
  const activeIds = new Set(snapshot.clothing.map((asset) => asset.clothing_id));
  return libraryCategoryShell(category, (CLOTHING_CATALOG[category.type] || []).map((item) => libraryItemMarkup(item, {
    active: activeIds.has(item.id),
    action: activeIds.has(item.id) ? 'select' : 'add',
    actionValue: item.id,
  })).join(''), 'ClothingProfile asset');
}

function libraryCategoryShell(category, items, sourceLabel) {
  return `
    <section class="character-studio-clothing-category" data-clothing-library-category="${escapeHtml(category.id)}">
      <header><b>${escapeHtml(category.label)}</b><small>${escapeHtml(sourceLabel)}</small></header>
      <div>${items}</div>
    </section>`;
}

function libraryItemMarkup(item, { active, action, actionValue }) {
  const attributes = action === 'add'
    ? `data-clothing-add="${escapeHtml(actionValue)}"`
    : action === 'select'
      ? `data-clothing-select="${escapeHtml(actionValue)}"`
      : action === 'add-accessory'
        ? `data-clothing-accessory-add="${escapeHtml(actionValue)}"`
        : `data-clothing-accessory-remove="${escapeHtml(actionValue)}"`;
  return `
    <article class="character-studio-clothing-library-item" data-active="${active ? 'true' : 'false'}">
      <i style="--clothing-swatch:${escapeHtml(item.color || '#6f849d')}"></i>
      <span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.id)}</small></span>
      <button type="button" ${attributes}>${active ? (action === 'select' ? '参数' : '移除') : '添加'}</button>
    </article>`;
}

function equippedAssetMarkup(asset) {
  const replacements = (CLOTHING_CATALOG[asset.type] || []).map((item) => `
    <option value="${escapeHtml(item.id)}"${item.id === asset.clothing_id ? ' selected' : ''}>${escapeHtml(item.label)}</option>`).join('');
  return `
    <article class="character-studio-clothing-equipped-item" data-clothing-equipped-id="${escapeHtml(asset.clothing_id)}">
      <button class="character-studio-clothing-current" type="button" data-clothing-select="${escapeHtml(asset.clothing_id)}">
        <i style="--clothing-swatch:${escapeHtml(asset.material.base_color)}"></i>
        <span><b>${escapeHtml(asset.clothing_id)}</b><small>${escapeHtml(TYPE_LABELS[asset.type] || asset.type)} · r${Number(asset.revision)}</small></span>
      </button>
      <div class="character-studio-clothing-replace-row">
        <select data-clothing-replacement-for="${escapeHtml(asset.clothing_id)}" aria-label="替换 ${escapeHtml(asset.clothing_id)}">${replacements}</select>
        <button type="button" data-clothing-replace="${escapeHtml(asset.clothing_id)}">替换</button>
        <button type="button" data-clothing-delete="${escapeHtml(asset.clothing_id)}">删除</button>
      </div>
    </article>`;
}

function dispatchClothingSelection(root, clothingId) {
  root.dispatchEvent(new CustomEvent('character-studio:clothing-select', {
    bubbles: true,
    detail: { clothingId: String(clothingId || '') },
  }));
}

export { CLOTHING_LIBRARY_CATEGORIES };
