import {
  CharacterStudioPanel,
  bindPanelActions,
  escapeHtml,
  fieldNumber,
  fieldValue,
  numberField,
  panelElement,
  panelShell,
  selectField,
} from '../components/panel-component.js';
import {
  ANIMATION_LIBRARY_CATEGORIES,
  buildAnimationLibrary,
} from '../animation-library.js';

export class AnimationPanel extends CharacterStudioPanel {
  constructor() { super('animation', 'Animation'); }

  render(snapshot) {
    const transport = snapshot.animation.transport;
    const baseLayer = snapshot.animation.layers.find((layer) => layer.layerId === 'base');
    const stateLabel = transport.playing ? '播放中' : Number(transport.time) > 0 ? '已暂停' : '已停止';
    const library = buildAnimationLibrary(snapshot.animation.clips);
    return panelShell({
      id: this.id,
      title: this.title,
      current: `${snapshot.activeClip.name} · ${stateLabel}`,
      body: `<h4>Animation Library</h4><div class="character-studio-animation-library">${ANIMATION_LIBRARY_CATEGORIES.map((category) => `
        <section class="character-studio-animation-group" data-animation-category="${category.id}">
          <b>${category.label}</b>
          <div>${library[category.id].length ? library[category.id].map((clip) => `<button type="button" data-animation-library-clip="${escapeHtml(clip.clipId)}"${clip.clipId === snapshot.activeClip.clipId ? ' aria-current="true"' : ''}>${escapeHtml(clip.name)}</button>`).join('') : '<small>暂无动作</small>'}</div>
        </section>`).join('')}</div><h4>Preview Controls</h4>${selectField('clipId', '当前动作', snapshot.activeClip.clipId, snapshot.animation.clips.map((clip) => ({
        value: clip.clipId, label: clip.name,
      })))}${numberField('speed', '播放速度', transport.speed, { min: -4, max: 4, step: 0.05, suffix: '×' })}${numberField('trimStart', '裁剪起点', transport.loopStart, { min: 0, max: snapshot.activeClip.duration, step: 0.01, suffix: 's' })}${numberField('trimEnd', '裁剪终点', transport.loopEnd, { min: 0.01, max: snapshot.activeClip.duration, step: 0.01, suffix: 's' })}${numberField('blendWeight', '混合权重', baseLayer?.weight ?? 1, { min: 0, max: 1, step: 0.01 })}<div class="character-studio-transport"><button type="button" data-transport="play">播放</button><button type="button" data-transport="pause">暂停</button><button type="button" data-transport="stop">停止</button></div><button type="button" class="character-studio-animation-mirror" data-animation-mirror>镜像为新动作</button>`,
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.configureAnimationPreview({
        clipId: fieldValue(section, 'clipId'),
        speed: fieldNumber(section, 'speed'),
        trimStart: fieldNumber(section, 'trimStart'),
        trimEnd: fieldNumber(section, 'trimEnd'),
        blendWeight: fieldNumber(section, 'blendWeight'),
      }),
      reset: () => controller.resetAnimation(),
    }, context);
    section?.querySelectorAll?.('[data-animation-library-clip]')?.forEach((button) => {
      button.addEventListener('click', () => context.run(() => controller.selectAnimationClip(button.dataset.animationLibraryClip)));
    });
    section?.querySelector?.('[data-transport="play"]')?.addEventListener('click', () => context.run(() => controller.playAnimation()));
    section?.querySelector?.('[data-transport="pause"]')?.addEventListener('click', () => context.run(() => controller.pauseAnimation()));
    section?.querySelector?.('[data-transport="stop"]')?.addEventListener('click', () => context.run(() => controller.stopAnimation()));
    section?.querySelector?.('[data-animation-mirror]')?.addEventListener('click', () => context.run(() => controller.mirrorActiveAnimation()));
  }
}
