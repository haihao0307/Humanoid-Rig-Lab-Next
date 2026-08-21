import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldValue,
  panelElement,
  panelShell,
  selectField,
} from '../components/panel-component.js';

export class AnimationPanel extends CharacterStudioPanel {
  constructor() { super('animation', 'Animation'); }

  render(snapshot) {
    const transport = snapshot.animation.transport;
    const stateLabel = transport.playing ? '播放中' : Number(transport.time) > 0 ? '已暂停' : '已停止';
    return panelShell({
      id: this.id,
      title: this.title,
      current: `${snapshot.activeClip.name} · ${stateLabel}`,
      body: `${selectField('clipId', '当前动作', snapshot.activeClip.clipId, snapshot.animation.clips.map((clip) => ({
        value: clip.clipId, label: clip.name,
      })))}<div class="character-studio-transport"><button type="button" data-transport="play">播放</button><button type="button" data-transport="pause">暂停</button><button type="button" data-transport="stop">停止</button></div>`,
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.selectAnimationClip(fieldValue(section, 'clipId')),
      reset: () => controller.resetAnimation(),
    }, context);
    section?.querySelector?.('[data-transport="play"]')?.addEventListener('click', () => context.run(() => controller.playAnimation()));
    section?.querySelector?.('[data-transport="pause"]')?.addEventListener('click', () => context.run(() => controller.pauseAnimation()));
    section?.querySelector?.('[data-transport="stop"]')?.addEventListener('click', () => context.run(() => controller.stopAnimation()));
  }
}
