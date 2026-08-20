import { controlSection, escapeHtml } from '../../workspace-common.js';

const TYPE_LABELS = Object.freeze({ top: '上衣', pants: '裤子', shoes: '鞋' });

export function renderControls(context, state) {
  const clothingState = state.clothingSystem;
  const profile = clothingState.profiles[clothingState.active_profile_id];
  const versions = clothingState.versions[clothingState.active_profile_id] || [];
  const assetRows = profile.assets.length
    ? profile.assets.map((asset) => `
      <div class="clothing-asset-row">
        <i style="background:${escapeHtml(asset.material.base_color)}"></i>
        <span><b>${escapeHtml(asset.clothing_id)}</b><small>${TYPE_LABELS[asset.type]} · ${escapeHtml(asset.size_profile.size)} · simulationRig</small></span>
        <button class="text-button" type="button" data-remove-clothing="${escapeHtml(asset.clothing_id)}">删除</button>
      </div>`).join('')
    : '<p class="control-note">当前 Character 没有服装附件。身体表皮仍由 Skin 独立管理。</p>';

  context.elements.moduleControls.innerHTML =
    controlSection('Character 服装附件', `
      <div class="toggle-row"><span>服装配置版本</span><b style="font-size:9px;color:#d9a56f">v${profile.version}${clothingState.dirty ? ' · 草稿' : ''}</b></div>
      <div class="toggle-row"><span>附件数量</span><b style="font-size:9px">${profile.assets.length}</b></div>
      <div class="clothing-asset-list">${assetRows}</div>`) +
    controlSection('添加静态服装', `
      <div class="control-button-grid clothing-add-grid">
        <button class="control-button" type="button" data-add-clothing="top">添加上衣</button>
        <button class="control-button" type="button" data-add-clothing="pants">添加裤子</button>
        <button class="control-button" type="button" data-add-clothing="shoes">添加鞋</button>
      </div>
      <p class="control-note">第一阶段服装使用 static-follow，通过 simulationRig 关节变换跟随动作，不启用布料动力学。</p>`) +
    controlSection('版本', `
      <div class="control-row"><label for="clothingVersionSelect">历史版本</label><select id="clothingVersionSelect">${versions.map((item) => `<option value="${item.version}">v${item.version} · ${item.assets.length} 件</option>`).join('')}</select></div>
      <div class="control-button-grid"><button class="control-button" id="saveClothingVersion" type="button">保存服装版本</button><button class="control-button" id="restoreClothingVersion" type="button">恢复所选版本</button></div>`) +
    controlSection('模块边界', `
      <div class="toggle-row"><span>渲染层级</span><b style="font-size:9px">Character → Body Skin → Clothing Mesh</b></div>
      <div class="toggle-row"><span>身体写入</span><b style="font-size:9px;color:#63dda5">禁止</b></div>
      <div class="toggle-row"><span>动作来源</span><b style="font-size:9px;color:#63dda5">simulationRig</b></div>
      <p class="control-note">服装只写 Clothing Mesh 变换和材质；Body Skin、Rig、Pose 与 Animation 均保持只读。</p>`);

  document.querySelectorAll('[data-add-clothing]').forEach((button) => {
    button.addEventListener('click', () => {
      const type = button.dataset.addClothing;
      const count = profile.assets.filter((item) => item.type === type).length + 1;
      context.hub.addClothingAsset({
        clothing_id: `${type}_${String(count).padStart(3, '0')}`,
        type,
        rig_profile: { rig_revision: state.activeVersions.rig },
        size_profile: {
          size: 'M',
          scale: 1,
          body_shape_revision: state.characterCore.profiles[state.characterCore.active_character_id].body_shape_revision,
        },
      });
    });
  });
  document.querySelectorAll('[data-remove-clothing]').forEach((button) => {
    button.addEventListener('click', () => context.hub.removeClothingAsset(button.dataset.removeClothing));
  });
  document.querySelector('#saveClothingVersion')?.addEventListener('click', () => context.hub.saveClothingVersion());
  document.querySelector('#restoreClothingVersion')?.addEventListener('click', () => {
    const version = Number(document.querySelector('#clothingVersionSelect')?.value);
    if (version) context.hub.restoreClothingVersion(version);
  });
}

export function exportData(state) {
  return {
    clothingSystem: structuredClone(state.clothingSystem),
    characterAttachments: structuredClone(
      state.characterCore.profiles[state.characterCore.active_character_id].clothing_attachments,
    ),
  };
}

export function resetData(state, defaults) {
  state.clothingSystem = structuredClone(defaults.clothingSystem);
  const character = state.characterCore.profiles[state.characterCore.active_character_id];
  character.clothing_attachments = [];
  character.clothing_revision = defaults.clothingSystem.profiles.clothing_profile_001.version;
}

export function publishData(state, version) {
  state.modules.clothing.version = version;
  state.modules.clothing.status = 'published';
  state.modules.clothing.statusLabel = '静态服装已发布';
  state.modules.clothing.progress = Math.max(state.modules.clothing.progress, 40);
  state.modules.clothing.currentTask = '继续验证更多动作下的静态服装跟随，并准备后续布料动力学接口';
  state.modules.clothing.compatibleRig = state.activeVersions.rig;
  state.activeVersions.clothing = version;
}
