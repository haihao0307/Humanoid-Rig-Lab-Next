export class MotionLanguageAdapter {
  parse() {
    throw new Error('MotionLanguageAdapter.parse() must be implemented by an adapter.');
  }
}

export {
  MotionWorldContextAdapter,
  RelativeWorldContextAdapter,
  InMemoryWorldContextAdapter,
  WORLD_AFFORDANCE_SCHEMA,
  createWorldAffordance,
  normalizeWorldAffordance,
  validateWorldAffordance,
} from '../../../human-motion/world/world-context.js';
