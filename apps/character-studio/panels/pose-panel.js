import {
  CharacterStudioPanel,
  bindPanelActions,
  fieldValue,
  panelElement,
  panelShell,
  selectField,
} from '../components/panel-component.js';

const POSES = Object.freeze([
  { value: 'a', label: 'A Pose' }, { value: 't', label: 'T Pose' },
  { value: 'reach', label: 'Reach Left' }, { value: 'step', label: 'Step Pose' },
]);
const NAME_TO_ID = Object.freeze({ 'A Pose': 'a', 'T Pose': 't', 'Reach Left': 'reach', 'Step Pose': 'step' });

export class PosePanel extends CharacterStudioPanel {
  constructor() { super('pose', 'Pose'); }

  render(snapshot) {
    return panelShell({
      id: this.id,
      title: this.title,
      current: snapshot.pose.name,
      body: selectField('preset', '姿势预设', NAME_TO_ID[snapshot.pose.name] || 'a', POSES),
    });
  }

  bind(root, controller, context) {
    const section = panelElement(root, this.id);
    bindPanelActions(section, {
      apply: () => controller.applyPose(fieldValue(section, 'preset')),
      reset: () => controller.resetPose(),
    }, context);
  }
}
