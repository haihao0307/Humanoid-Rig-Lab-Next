import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldValue,
  panelElement,
  panelShell,
  textField,
} from '../components/panel-component.js';

export class IdentityPanel extends CharacterStudioPanel {
  constructor() { super('identity', 'Identity'); }

  render(snapshot) {
    const profile = snapshot.profile;
    return panelShell({
      id: this.id,
      title: this.title,
      current: `${profile.name} · v${profile.version}`,
      open: true,
      body: [
        textField('name', '人物名称', profile.name),
        textField('identityId', 'Identity ID', profile.identity.identity_id || '', { placeholder: '可留空' }),
        textField('tags', '标签', profile.identity.tags.join(', '), { placeholder: '使用逗号分隔' }),
      ].join(''),
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyIdentity({
        name: fieldValue(section, 'name'),
        identityId: fieldValue(section, 'identityId'),
        tags: fieldValue(section, 'tags'),
      }),
      reset: () => controller.resetIdentity(),
    }, context);
  }
}
