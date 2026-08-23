// Compatibility entry point. V3 owns the semantic registry under
// src/human-motion/skills while existing Text Motion imports remain stable.
export {
  DEFAULT_MOTION_SKILLS,
  MotionSkillRegistry,
  createDefaultMotionSkillRegistry,
  normalizeMotionSkill,
} from '../../../human-motion/skills/motion-skill-registry.js';
