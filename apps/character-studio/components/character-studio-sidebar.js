import { CharacterStudioController } from '../character-studio-controller.js';
import {
  AccessoryPanel,
  AnimationPanel,
  BodyShapePanel,
  ClothingPanel,
  FacePanel,
  HairPanel,
  IdentityPanel,
  PosePanel,
  ProportionPanel,
} from '../panels/index.js';
import { escapeHtml } from './panel-component.js';

export const CHARACTER_STUDIO_PANELS = Object.freeze([
  new IdentityPanel(),
  new BodyShapePanel(),
  new FacePanel(),
  new ClothingPanel(),
  new HairPanel(),
  new AccessoryPanel(),
  new ProportionPanel(),
  new PosePanel(),
  new AnimationPanel(),
]);

export class CharacterStudioSidebar {
  constructor({ root, hub, controller = new CharacterStudioController(hub), onError = console.error } = {}) {
    if (!root || typeof root.querySelector !== 'function') throw new TypeError('CharacterStudioSidebar requires a DOM root.');
    this.root = root;
    this.hub = hub;
    this.controller = controller;
    this.onError = onError;
    this.unsubscribe = null;
    this.running = false;
    this.pendingState = null;
  }

  mount() {
    if (typeof this.hub?.subscribe !== 'function') {
      this.render(this.controller.snapshot());
      return this;
    }
    this.unsubscribe = this.hub.subscribe((state) => {
      if (this.running) {
        this.pendingState = state;
        return;
      }
      this.render(this.controller.snapshot(state));
    });
    return this;
  }

  destroy() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.root.replaceChildren();
  }

  render(snapshot) {
    const openSections = new Set([...this.root.querySelectorAll?.('details[open][data-character-section]') || []]
      .map((element) => element.dataset.characterSection));
    this.root.innerHTML = renderCharacterStudioSidebar(snapshot);
    if (openSections.size) {
      this.root.querySelectorAll('details[data-character-section]').forEach((element) => {
        element.open = openSections.has(element.dataset.characterSection);
      });
    }
    const context = { run: (action) => this.run(action) };
    for (const panel of CHARACTER_STUDIO_PANELS) panel.bind(this.root, this.controller, context);
  }

  run(action) {
    this.running = true;
    this.pendingState = null;
    try {
      action();
      const state = this.pendingState || this.hub.getState();
      this.render(this.controller.snapshot(state));
      this.#setStatus('修改已写回 CharacterProfile 与统一项目状态。', false);
    } catch (error) {
      this.onError(error);
      this.#setStatus(error?.message || String(error), true);
    } finally {
      this.running = false;
      this.pendingState = null;
    }
  }

  #setStatus(message, isError) {
    const element = this.root.querySelector('[data-character-studio-status]');
    if (!element) return;
    element.textContent = message;
    element.dataset.error = isError ? 'true' : 'false';
  }
}

export function renderCharacterStudioSidebar(snapshot) {
  return `
    <div class="character-studio-sidebar__header">
      <small>CHARACTER STUDIO</small>
      <h2>${escapeHtml(snapshot.profile.name)}</h2>
      <p>CharacterProfile ${escapeHtml(snapshot.profile.character_id)} · v${snapshot.profile.version}</p>
    </div>
    <div class="character-studio-sidebar__sections">
      ${CHARACTER_STUDIO_PANELS.map((panel) => panel.render(snapshot)).join('')}
    </div>
    <p class="character-studio-status" data-character-studio-status aria-live="polite">Project revision ${Number(snapshot.stateRevision || 0)}</p>`;
}

export function mountCharacterStudioSidebar(options) {
  return new CharacterStudioSidebar(options).mount();
}
