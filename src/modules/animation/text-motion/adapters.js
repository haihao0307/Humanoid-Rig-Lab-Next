export class MotionLanguageAdapter {
  parse() {
    throw new Error('MotionLanguageAdapter.parse() must be implemented by an adapter.');
  }
}

export class MotionWorldContextAdapter {
  resolveTarget() { return null; }
  getActorTransform() { return null; }
  getGroundInfo() { return null; }
  getReachablePoint() { return null; }
}

/**
 * V1 deliberately resolves only relative directions. Named world targets are
 * retained by the planner until a future scene adapter can resolve them.
 */
export class RelativeWorldContextAdapter extends MotionWorldContextAdapter {
  resolveTarget(target) {
    const value = String(target || '').trim();
    return value ? null : null;
  }

  getActorTransform() {
    return { position: [0, 0, 0], forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] };
  }

  getGroundInfo() {
    return { normal: [0, 1, 0], height: 0 };
  }

  getReachablePoint() {
    return null;
  }
}
