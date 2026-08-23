const FORBIDDEN_GOAL_KEYS = /quaternion|matrix|vertex|bindoffset|bone(scale|length|rotation)|skin/i;

export function createMotionGoalAdapter({ goalFactory = null, solverFactory = null, legacyAdapter = null } = {}) {
  return {
    canCreateGoal: typeof goalFactory === 'function',
    canCreateSolver: typeof solverFactory === 'function',
    validate: validateMotionGoalRequest,
    createGoal(request, context = {}) {
      const validation = validateMotionGoalRequest(request);
      if (!validation.valid) throw new Error(validation.errors.join(', '));
      if (typeof goalFactory !== 'function') {
        return legacyAdapter?.prepareGoalRequest?.(validation.request, context) ?? {
          status: 'requires_solver', request: validation.request, warning: 'MOTION_GOAL_FACTORY_UNAVAILABLE',
        };
      }
      return goalFactory(structuredClone(validation.request), structuredClone(context));
    },
    createSolver(context = {}) {
      return typeof solverFactory === 'function' ? solverFactory(structuredClone(context)) : null;
    },
  };
}

export function validateMotionGoalRequest(input) {
  const request = input && typeof input === 'object' && !Array.isArray(input) ? structuredClone(input) : {};
  const errors = [];
  if (!String(request.requestId || '').trim()) errors.push('MOTION_GOAL_REQUEST_ID_MISSING');
  if (!String(request.goalType || '').trim()) errors.push('MOTION_GOAL_REQUEST_TYPE_MISSING');
  if (containsForbiddenGoalData(request)) errors.push('MOTION_GOAL_REQUEST_FORBIDDEN_KINEMATIC_DATA');
  return { valid: errors.length === 0, errors, request };
}

export function containsForbiddenGoalData(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenGoalData);
  return Object.entries(value).some(([key, child]) => FORBIDDEN_GOAL_KEYS.test(key) || containsForbiddenGoalData(child));
}
