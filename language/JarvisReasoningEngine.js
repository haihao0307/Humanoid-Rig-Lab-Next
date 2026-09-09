/* Jarvis state-space reasoner v1.12.0.
 * Converts language-grounded goals into candidate behavior plans, predicts effects,
 * asks the embodiment for geometric and physical simulation, and selects an auditable plan.
 * It never emits joint angles, trajectories, torque, or actuator commands.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./JarvisSemanticPlanner.js'));
  } else {
    root.JarvisReasoning = factory(root.JarvisLanguage);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Lang) {
  'use strict';

  if (!Lang) throw new Error('JarvisReasoning requires JarvisLanguage.');

  // A muscle-capable embodiment evaluates candidates using live state.
  // Legacy mass cutoffs must not discard candidates before that evaluation.
  const muscleCapacityProfile = profile => profile.strengthModel === 'jarvis/strength_profile@1';
  const candidateMassAllowed = (object, profile, type) => muscleCapacityProfile(profile) ||
    (Number(object.mass) || 0) <= (type === 'carry' ? (profile.maxCarryMassKg ?? 12) : (profile.maxPushMassKg ?? 45));
  const VERSION = '1.12.0';
  const TRACE_SCHEMA = 'jarvis/reasoning_trace@1.0';
  const GOAL_SCHEMA = 'jarvis/goal_graph@1.0';
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const norm = value => String(value || '').normalize('NFKC').trim();
  const worldData = world => Lang.worldData(world);
  const distance = (a, b) => Math.hypot((a?.[0] || 0) - (b?.[0] || 0), (a?.[2] || 0) - (b?.[2] || 0));
  const radius = object => Number(object?.r) || Math.hypot(Number(object?.w) || 0, Number(object?.d) || 0) / 2 || 0.1;
  const span = object => Math.max(Number(object?.w) || radius(object) * 2, Number(object?.d) || radius(object) * 2, Number(object?.h) || 0);
  const volume = object => {
    if (object?.shape === 'sphere') return 4 / 3 * Math.PI * radius(object) ** 3;
    if (object?.shape === 'cylinder' || object?.shape === 'cone') {
      return Math.PI * radius(object) ** 2 * (Number(object.h) || 0.1) * (object.shape === 'cone' ? 1 / 3 : 1);
    }
    return (Number(object?.w) || radius(object) * 2) * (Number(object?.h) || 0.1) * (Number(object?.d) || radius(object) * 2);
  };
  const entityName = (world, id) => {
    const w = worldData(world);
    const entity = [...w.objects, ...w.zones].find(item => item.id === id);
    return entity ? `${entity.name}（${entity.id}）` : id;
  };

  function zoneArea(zone) {
    if (zone.shape === 'square') return (2 * zone.r) ** 2;
    if (zone.shape === 'hexagon') return 3 * Math.sqrt(3) / 2 * zone.r * zone.r;
    return Math.PI * zone.r * zone.r;
  }

  function entityInside(object, zone) {
    const dx = Math.abs(object.p[0] - zone.p[0]);
    const dz = Math.abs(object.p[2] - zone.p[2]);
    const r = radius(object);
    if (zone.shape === 'square') return dx + r <= zone.r && dz + r <= zone.r;
    return Math.hypot(dx, dz) + r <= zone.r * (zone.shape === 'hexagon' ? Math.cos(Math.PI / 6) : 1);
  }

  function zoneFreeScore(zone, world, ignore = []) {
    const occupied = world.objects
      .filter(object => !ignore.includes(object.id) && entityInside(object, zone))
      .reduce((sum, object) => sum + Math.PI * radius(object) ** 2, 0);
    return Math.max(0, zoneArea(zone) - occupied);
  }

  function fitsZone(object, zone) {
    const usable = zone.r * (zone.shape === 'hexagon' ? Math.cos(Math.PI / 6) : 1);
    return radius(object) + 0.04 <= usable;
  }

  function objectiveFromText(text) {
    const source = norm(text);
    if (/最快|尽快|速度优先|时间最短/.test(source)) return 'fast';
    if (/省力|轻松|最少体力|能耗最小|少走路/.test(source)) return 'effort';
    if (/最安全|稳妥|安全优先|净空最大|不要碰撞|避开障碍/.test(source)) return 'safe';
    return 'balanced';
  }

  function methodPreference(text) {
    const source = norm(text);
    if (/(?:推|推动|推过去|推到)/.test(source) && !/(?:搬不动.*推|不能搬.*推)/.test(source)) return 'push';
    if (/(?:搬|抱|拿起|抓起|捡起|抬起)/.test(source)) return 'carry';
    return 'auto';
  }

  function fallbackPreference(text) {
    const source = norm(text);
    return /(?:搬不动|拿不动|抱不动|不能搬|如果不能搬|实在搬不了).*(?:推|推动)|(?:能搬就搬).*(?:否则|不行就).*推/.test(source)
      ? 'push'
      : null;
  }

  function stripFallbackClause(text) {
    return norm(text)
      .replace(/[，,]?(?:如果|要是|若|万一)(?:它)?(?:搬不动|拿不动|抱不动|不能搬|太重)(?:就|那就)?(?:改为|换成)?(?:推|推动)(?:过去|到那里|到目标)?[。.]?$/g, '')
      .trim();
  }

  function contextPosition(context) {
    return context?.position || [0, 0, 1.75];
  }

  function candidateView(entity) {
    return {
      id: entity.id,
      name: entity.name,
      shape: entity.shape,
      mass: entity.mass,
      position: entity.p,
      radius: radius(entity),
      movable: entity.movable !== false,
    };
  }

  function resolveDirect(raw, world, context, kind = 'any', multiple = false) {
    try {
      return Lang.resolveReference(raw, world, context, { kind, multiple });
    } catch {
      return [];
    }
  }

  function selectObjects(raw, world, context, profile = {}) {
    const w = worldData(world);
    let text = norm(raw)
      .replace(/^(?:把|将|让|所有|全部|每个|各个)+/, '')
      .replace(/(?:的)?(?:物体|东西|物品)$/, '')
      .trim();

    const multiple = /所有|全部|每个|各个/.test(raw);
    const direct = resolveDirect(text, w, context, 'object', multiple);
    if (direct.length) return direct;

    let pool = w.objects.filter(object => object.movable !== false);
    if (/固定|障碍/.test(text)) pool = w.objects.filter(object => object.movable === false || object.category === 'obstacle');
    if (/能搬|可搬|搬得动|可以搬/.test(text)) {
      pool = pool.filter(object =>
        candidateMassAllowed(object, profile, 'carry') &&
        span(object) <= (profile.maxGripSpanM ?? 0.66) &&
        radius(object) <= (profile.maxCarryRadiusM ?? 0.42));
    }
    if (/能推|可推|推得动|可以推/.test(text)) {
      pool = pool.filter(object => candidateMassAllowed(object, profile, 'push'));
    }

    const colors = { 红: /红/, 蓝: /蓝/, 黄: /黄/, 绿: /绿/, 紫: /紫/, 橙: /橙/, 白: /白/, 黑: /黑/ };
    for (const [key, pattern] of Object.entries(colors)) {
      if (!pattern.test(text)) continue;
      pool = pool.filter(object => String(object.name).includes(key) || (object.aliases || []).some(alias => String(alias).includes(key)));
      break;
    }

    const shapes = [
      ['sphere', /球/],
      ['box', /箱|方块|长方体|盒/],
      ['cylinder', /圆柱|柱体/],
      ['cone', /圆锥|锥体/],
      ['prism', /棱柱/],
    ];
    for (const [shape, pattern] of shapes) {
      if (!pattern.test(text)) continue;
      pool = pool.filter(object => object.shape === shape);
      break;
    }

    const anchorMatch = text.match(/离(.+?)(?:最近|最远)/);
    const anchor = anchorMatch ? resolveDirect(anchorMatch[1], w, context, 'any', false)[0] : null;
    const origin = anchor?.p || contextPosition(context);
    const score = object => {
      if (/最轻|重量最小/.test(text)) return Number(object.mass) || 0;
      if (/最重|重量最大/.test(text)) return -(Number(object.mass) || 0);
      if (/最大|体积最大/.test(text)) return -volume(object);
      if (/最小|体积最小/.test(text)) return volume(object);
      if (/最远/.test(text)) return -distance(object.p, origin);
      return distance(object.p, origin);
    };

    if (/最轻|最重|最大|最小|最近|最远/.test(text) && pool.length) {
      pool.sort((a, b) => score(a) - score(b));
      return [pool[0]];
    }
    if (/挡路|堵路|通道里/.test(text)) return pool;
    return pool.length === 1 ? pool : [];
  }

  function selectTargets(raw, world, context, object = null) {
    const w = worldData(world);
    const text = norm(raw);
    const direct = resolveDirect(text, w, context, 'any', false);
    if (direct.length) return direct;

    let zones = w.zones.filter(zone => !object || fitsZone(object, zone));
    const anchorMatch = text.match(/离(.+?)(?:最近|最远)/);
    const anchor = anchorMatch ? resolveDirect(anchorMatch[1], w, context, 'any', false)[0] : null;
    const origin = anchor?.p || object?.p || contextPosition(context);

    if (/区域|地方|位置|空地/.test(text) || /空余|容纳|放得下|宽敞|安全/.test(text)) {
      if (/空余最大|最空|空间最大|最宽敞/.test(text)) {
        zones.sort((a, b) => zoneFreeScore(b, w, object ? [object.id] : []) - zoneFreeScore(a, w, object ? [object.id] : []));
      } else if (/最远/.test(text)) {
        zones.sort((a, b) => distance(b.p, origin) - distance(a.p, origin));
      } else {
        zones.sort((a, b) => distance(a.p, origin) - distance(b.p, origin));
      }
      return zones.slice(0, Math.min(4, zones.length));
    }
    return [];
  }

  function interpretAbstract(text, world, context, profile = {}) {
    const source = norm(text);
    const w = worldData(world);
    const goals = [];
    let serial = 0;
    const add = goal => goals.push({ kind: 'goal', id: `goal_${++serial}`, goal });
    const clauses = source
      .split(/然后|接着|最后|随后|再(?=去|走|站|把|将|让|清|腾|移|搬|推|放|整理|收拾)|[；;。]/)
      .map(clause => clause.trim())
      .filter(Boolean);

    for (const raw of clauses) {
      let clause = raw
        .replace(/^(?:贾维斯[,，:：]?|请|麻烦你|帮我|帮忙|你能不能|能不能|可以帮我|先|再)+/g, '')
        .replace(/[吗呢吧啊？?]+$/g, '')
        .trim();
      if (!clause) continue;

      const fallback = fallbackPreference(clause);
      const core = stripFallbackClause(clause);
      let match = core.match(/(?:清理|腾出|让出|打通|疏通).*(?:通往|去往|到|去)(.+?)(?:的)?(?:道路|路线|路|通道)/);
      if (!match) match = core.match(/(?:把)?(?:去|通往|到)(.+?)(?:的)?(?:道路|路线|路|通道)(?:清理|腾出|让开|打通)/);
      if (match) {
        const target = selectTargets(match[1], w, context)[0] || resolveDirect(match[1], w, context, 'any', false)[0];
        if (!target) return null;
        add({ type: 'clear_path', targetId: target.id, objective: objectiveFromText(clause), source: clause });
        continue;
      }

      if (/(?:整理|收拾|归置|清场)/.test(core) && /(?:所有|全部|场景|物体|东西|物品)/.test(core)) {
        const objects = w.objects.filter(object => object.movable !== false);
        if (!objects.length || !w.zones.length) return null;
        add({
          type: 'organize',
          objectIds: objects.map(object => object.id),
          strategy: /分类/.test(core) ? 'distribute' : /省力|最近/.test(core) ? 'nearest' : 'balanced',
          objective: objectiveFromText(clause),
          source: clause,
        });
        continue;
      }

      match = core.match(/^(?:让|把|将)(.+?)(?:靠近|挪到|移到|移动到|放到)(.+?)(?:旁边|附近|近一些|更近|边上)$/);
      if (match) {
        const objects = selectObjects(match[1], w, context, profile);
        const targets = selectTargets(match[2], w, context, objects[0]);
        if (objects.length !== 1 || !targets.length) return null;
        add({
          type: 'relocate',
          objectIds: [objects[0].id],
          targetIds: [targets[0].id],
          relation: 'near',
          method: methodPreference(clause),
          fallback,
          objective: objectiveFromText(clause),
          source: clause,
        });
        continue;
      }

      match = core.match(/^(?:把|将)?(?:能放进|可以放进)(.+?)的(最大|最小|最轻|最重)?(?:可移动)?(?:物体|东西)(?:搬|放|移动)(?:过去|进去|到那里)$/);
      if (match) {
        const target = selectTargets(match[1], w, context)[0];
        if (!target) return null;
        let pool = w.objects.filter(object => object.movable !== false && fitsZone(object, target));
        if (match[2]) {
          pool.sort((a, b) => {
            if (match[2] === '最大') return volume(b) - volume(a);
            if (match[2] === '最小') return volume(a) - volume(b);
            if (match[2] === '最轻') return (a.mass || 0) - (b.mass || 0);
            return (b.mass || 0) - (a.mass || 0);
          });
        }
        if (!pool.length) return null;
        add({
          type: 'relocate',
          objectIds: [pool[0].id],
          targetIds: [target.id],
          relation: 'inside',
          method: methodPreference(clause),
          fallback,
          objective: objectiveFromText(clause),
          source: clause,
        });
        continue;
      }

      match = core.match(/^(?:把|将)?(.+?)(?:移动|挪|移开|放|搬|送|推)(?:到|至|进|入|在)(.+)$/);
      if (match) {
        const objects = selectObjects(match[1], w, context, profile);
        const multiple = /所有|全部|每个|各个/.test(match[1]);
        if ((multiple && objects.length) || objects.length === 1) {
          const targets = selectTargets(match[2], w, context, objects[0]);
          if (targets.length) {
            add({
              type: 'relocate',
              objectIds: multiple ? objects.map(object => object.id) : [objects[0].id],
              targetIds: targets.map(target => target.id),
              targetRaw: match[2],
              relation: targets[0].id.startsWith('Z') ? 'inside' : 'near',
              method: methodPreference(clause),
              fallback,
              objective: objectiveFromText(clause),
              source: clause,
            });
            continue;
          }
        }
        return null;
      }

      match = core.match(/^(?:走到|去|前往|站到|站在)(.+)$/);
      if (match) {
        const target = selectTargets(match[1], w, context)[0] || resolveDirect(match[1], w, context, 'any', false)[0];
        if (!target) return null;
        add({
          type: 'reach',
          targetId: target.id,
          relation: /左/.test(match[1]) ? 'left' : /右/.test(match[1]) ? 'right' : /前/.test(match[1]) ? 'front' : /后/.test(match[1]) ? 'behind' : /旁|附近/.test(match[1]) ? 'near' : target.id.startsWith('Z') ? 'inside' : 'near',
          objective: objectiveFromText(clause),
          source: clause,
        });
        continue;
      }

      return null;
    }

    if (!goals.length) return null;
    return {
      schema: GOAL_SCHEMA,
      id: uid('goal_graph'),
      sourceText: source,
      worldRevision: w.revision,
      sceneId: w.sceneId,
      status: 'goals',
      mode: /做完|追加|接下来/.test(source) ? 'append' : 'replace',
      goals,
      objective: objectiveFromText(source),
      constraints: { protectedIds: [], collisionAvoidance: true, forbiddenActions: [] },
    };
  }

  function inferredAffordances(world, profile = {}) {
    const w = worldData(world);
    return w.objects.map(object => {
      const mass = Number(object.mass) || 0;
      const objectSpan = span(object);
      const movable = object.movable !== false;
      return {
        id: object.id,
        name: object.name,
        movable,
        massKg: mass,
        strengthCheckPending: muscleCapacityProfile(profile),
        spanM: objectSpan,
        carryable: movable && candidateMassAllowed(object, profile, 'carry') && objectSpan <= (profile.maxGripSpanM ?? 0.66) && radius(object) <= (profile.maxCarryRadiusM ?? 0.42),
        pushable: movable && candidateMassAllowed(object, profile, 'push'),
        volumeM3: volume(object),
        zoneMembership: w.zones.filter(zone => entityInside(object, zone)).map(zone => zone.id),
      };
    });
  }

  function currentBranch(nodes, world, context) {
    const result = [];
    for (const node of nodes || []) {
      if (node.kind === 'condition') {
        let value = false;
        try {
          value = Lang.predicateValue(node.predicate, world, context);
          if (node.predicate.negate) value = !value;
        } catch {}
        result.push(...currentBranch(value ? node.then : node.else, world, context));
      } else if (node.kind === 'action') {
        result.push(node);
      }
    }
    return result;
  }

  function planFromSteps(source, steps, base, engine = 'reasoned') {
    let index = 0;
    const nodes = steps.map(step => ({ kind: 'action', id: `reason_step_${++index}`, step: clone(step) }));
    return {
      schema: Lang.SCHEMA || 'jarvis/semantic_plan@1.0',
      id: uid('plan'),
      sourceText: source,
      worldRevision: base.worldRevision,
      sceneId: base.sceneId,
      engine,
      status: 'ready',
      mode: base.mode || 'replace',
      nodes,
      constraints: clone(base.constraints || { protectedIds: [], collisionAvoidance: true, forbiddenActions: [] }),
      grounding: clone(base.grounding || []),
      assumptions: clone(base.assumptions || []),
      questions: [],
      control: null,
      response: '',
      contextAfter: clone(base.contextAfter || null),
      summary: [],
    };
  }

  function chooseTargetAssignments(goal, world) {
    const objects = goal.objectIds.map(id => world.objects.find(object => object.id === id)).filter(Boolean);
    const targets = goal.targetIds.map(id => [...world.objects, ...world.zones].find(entity => entity.id === id)).filter(Boolean);
    if (!objects.length || !targets.length) return [];
    if (objects.length === 1) return targets.map(target => [{ object: objects[0], target }]);
    if (targets.length === 1) return [objects.map(object => ({ object, target: targets[0] }))];

    const used = new Set();
    const pairs = [];
    for (const object of objects) {
      const available = targets.filter(target => !used.has(target.id));
      const best = (available.length ? available : targets).sort((a, b) => distance(object.p, a.p) - distance(object.p, b.p))[0];
      used.add(best.id);
      pairs.push({ object, target: best });
    }
    return [pairs];
  }

  function methodsFor(goal, object, profile) {
    if (goal.method === 'carry') return goal.fallback === 'push' ? ['carry', 'push'] : ['carry'];
    if (goal.method === 'push') return ['push'];
    const carryable = candidateMassAllowed(object, profile, 'carry') && span(object) <= (profile.maxGripSpanM ?? 0.66) && radius(object) <= (profile.maxCarryRadiusM ?? 0.42);
    return carryable ? ['carry', 'push'] : ['push', 'carry'];
  }

  function pointSegmentDistance(point, start, end) {
    const ax = start[0];
    const az = start[2];
    const bx = end[0];
    const bz = end[2];
    const px = point[0];
    const pz = point[2];
    const dx = bx - ax;
    const dz = bz - az;
    const denom = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / denom));
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }

  function directMovableBlockers(world, context, targetId, profile) {
    const target = [...world.objects, ...world.zones].find(entity => entity.id === targetId);
    if (!target) return [];
    const start = contextPosition(context);
    const corridor = (profile.bodyRadiusM ?? 0.26) + 0.12;
    return world.objects
      .filter(object => object.id !== targetId && object.movable !== false && object.collidable !== false)
      .filter(object => pointSegmentDistance(object.p, start, target.p) <= radius(object) + corridor)
      .sort((a, b) => distance(a.p, start) - distance(b.p, start));
  }

  function safeZoneForObject(object, world, avoidTargetId = null) {
    return world.zones
      .filter(zone => zone.id !== avoidTargetId && fitsZone(object, zone))
      .sort((a, b) => zoneFreeScore(b, world, [object.id]) - zoneFreeScore(a, world, [object.id]))[0] || null;
  }

  function organizeAssignments(objects, world, strategy) {
    const zones = world.zones;
    const assignments = [];
    const virtualFree = new Map(zones.map(zone => [zone.id, zoneFreeScore(zone, world, objects.map(object => object.id))]));
    for (const object of objects) {
      const candidates = zones.filter(zone => fitsZone(object, zone));
      if (!candidates.length) continue;
      candidates.sort((a, b) => {
        if (strategy === 'nearest') return distance(object.p, a.p) - distance(object.p, b.p);
        if (strategy === 'largest') return (virtualFree.get(b.id) || 0) - (virtualFree.get(a.id) || 0);
        const scoreA = distance(object.p, a.p) * 0.6 - (virtualFree.get(a.id) || 0) * 0.4;
        const scoreB = distance(object.p, b.p) * 0.6 - (virtualFree.get(b.id) || 0) * 0.4;
        return scoreA - scoreB;
      });
      const target = candidates[0];
      virtualFree.set(target.id, Math.max(0, (virtualFree.get(target.id) || 0) - Math.PI * radius(object) ** 2));
      assignments.push({ object, target });
    }
    return assignments;
  }

  function expandGoalGraph(graph, world, context, profile = {}) {
    const w = worldData(world);
    let partials = [[]];
    let rationales = [[]];
    const extend = (options, why) => {
      const next = [];
      const nextWhy = [];
      for (let index = 0; index < partials.length; index += 1) {
        for (const option of options) {
          next.push([...partials[index], ...option]);
          nextWhy.push([...rationales[index], ...(why ? why(option) : [])]);
          if (next.length >= 12) break;
        }
      }
      partials = next.slice(0, 12);
      rationales = nextWhy.slice(0, 12);
    };

    for (const node of graph.goals) {
      const goal = node.goal;
      if (goal.type === 'reach') {
        extend([[{ type: 'walk', targetId: goal.targetId, relation: goal.relation || 'near', referenceFrame: 'world' }]], () => ['由到达目标推导导航行为']);
        continue;
      }

      if (goal.type === 'relocate') {
        const assignments = chooseTargetAssignments(goal, w);
        const variants = [];
        for (const pairs of assignments) {
          let sets = [[]];
          for (const pair of pairs) {
            const methods = methodsFor(goal, pair.object, profile);
            const next = [];
            for (const base of sets) {
              for (const method of methods) {
                next.push([...base, {
                  type: method,
                  objectId: pair.object.id,
                  targetId: pair.target.id,
                  relation: goal.relation || (pair.target.id.startsWith('Z') ? 'inside' : 'near'),
                  referenceFrame: 'world',
                }]);
              }
            }
            sets = next.slice(0, 8);
          }
          variants.push(...sets);
        }
        extend(variants.slice(0, 10), steps => steps.map(step => `${entityName(w, step.objectId)}采用${step.type === 'carry' ? '双手搬运' : '地面推动'}`));
        continue;
      }

      if (goal.type === 'clear_path') {
        const blockers = directMovableBlockers(w, context, goal.targetId, profile);
        const options = [];
        const moved = [];
        for (const blocker of blockers.slice(0, 3)) {
          const zone = safeZoneForObject(blocker, w, goal.targetId);
          if (!zone) continue;
          const method = methodsFor({ method: 'auto' }, blocker, profile)[0];
          moved.push({ type: method, objectId: blocker.id, targetId: zone.id, relation: 'inside', referenceFrame: 'world' });
        }
        if (moved.length) options.push(moved);
        else options.push([{ type: 'observe' }]);
        extend(options, option => moved.length ? [`识别出 ${option.length} 个直接通道阻挡物，并规划移出通道`] : ['直接通道没有检测到可移动阻挡物，读取当前场景确认']);
        continue;
      }

      if (goal.type === 'organize') {
        const objects = goal.objectIds.map(id => w.objects.find(object => object.id === id)).filter(Boolean);
        const strategies = goal.strategy === 'nearest' ? ['nearest', 'balanced'] : goal.strategy === 'distribute' ? ['balanced', 'largest', 'nearest'] : ['balanced', 'nearest', 'largest'];
        const options = [];
        for (const strategy of strategies) {
          const pairs = organizeAssignments(objects, w, strategy);
          const steps = pairs.map(({ object, target }) => ({
            type: methodsFor({ method: 'auto' }, object, profile)[0],
            objectId: object.id,
            targetId: target.id,
            relation: 'inside',
            referenceFrame: 'world',
          }));
          if (steps.length) options.push(steps);
        }
        extend(options, steps => [`根据距离、可容纳空间与身体能力形成 ${steps.length} 步整理方案`]);
      }
    }

    return partials.map((steps, index) => ({
      id: `candidate_${index + 1}`,
      plan: planFromSteps(graph.sourceText, steps, graph, 'reasoned-goal-search'),
      rationale: rationales[index],
      origin: 'goal_graph',
    }));
  }

  function varyExecutablePlan(plan, world, context, profile = {}) {
    const branch = currentBranch(plan.nodes, world, context);
    const source = norm(plan.sourceText);
    const generic = /移动|挪|移开|弄到|放到|放进|放在|送到/.test(source) && !/(?:明确用|只用)?推/.test(source);
    const fallback = fallbackPreference(source);
    let variants = [[]];
    let rationales = [[]];

    for (const node of branch) {
      const step = node.step;
      if (['carry', 'push'].includes(step.type) && (generic || fallback)) {
        const object = worldData(world).objects.find(item => item.id === step.objectId);
        const methods = step.type === 'push'
          ? ['push']
          : fallback
            ? ['carry', 'push']
            : methodsFor({ method: generic ? 'auto' : 'carry' }, object || {}, profile);
        const next = [];
        const nextWhy = [];
        for (let index = 0; index < variants.length; index += 1) {
          for (const method of methods) {
            next.push([...variants[index], { ...step, type: method }]);
            nextWhy.push([...rationales[index], method === step.type ? '保留语言中的首选操作' : `根据物理可行性评估${method === 'carry' ? '搬运' : '推动'}替代方案`]);
            if (next.length >= 12) break;
          }
        }
        variants = next.slice(0, 12);
        rationales = nextWhy.slice(0, 12);
      } else {
        for (const variant of variants) variant.push(clone(step));
        for (const why of rationales) why.push('保留已经明确的语义步骤');
      }
    }

    return variants.map((steps, index) => ({
      id: `candidate_${index + 1}`,
      plan: planFromSteps(plan.sourceText, steps, plan, 'reasoned-state-space'),
      rationale: rationales[index],
      origin: 'semantic_plan',
    }));
  }

  function scoreSimulation(simulation, objective = 'balanced') {
    if (!simulation?.feasible) return Infinity;
    const duration = Number(simulation.totalDurationS) || 0;
    const base = Number(simulation.score) || 0;
    const clearance = simulation.minClearanceM == null ? 0.25 : simulation.minClearanceM;
    const risk = clearance < 0.08 ? (0.08 - clearance) * 80 : clearance < 0.16 ? (0.16 - clearance) * 20 : 0;
    if (objective === 'fast') return duration * 0.35 + base * 0.3 + risk;
    if (objective === 'effort') return base * 0.95 + duration * 0.04 + risk;
    if (objective === 'safe') return base * 0.2 + duration * 0.05 + risk * 2 + 1 / Math.max(0.04, clearance) * 0.08;
    return base * 0.55 + duration * 0.11 + risk;
  }

  function summarizeSimulation(simulation) {
    if (!simulation) return '未模拟';
    if (!simulation.feasible) return `不可行：${(simulation.reasons || []).join('；')}`;
    const clearance = simulation.minClearanceM != null ? `，最小净空 ${Number(simulation.minClearanceM).toFixed(2)} 米` : '';
    return `可行，预计 ${Number(simulation.totalDurationS || 0).toFixed(1)} 秒，路径成本 ${Number(simulation.score || 0).toFixed(2)}${clearance}`;
  }

  function repairCandidates(candidates, simulations, world, context, profile = {}) {
    const w = worldData(world);
    const result = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const simulation = simulations[index];
      if (simulation?.feasible) continue;
      for (const analysis of simulation?.analyses || []) {
        const analysisIndex = (simulation.analyses || []).indexOf(analysis);
        for (const alternative of analysis.alternatives || []) {
          if ((alternative.type === 'push' || alternative.type === 'carry') && alternative.step) {
            const steps = clone(candidate.plan.nodes.map(node => node.step));
            steps[analysisIndex] = { ...steps[analysisIndex], ...alternative.step, type: alternative.type };
            result.push({
              id: `repair_${result.length + 1}`,
              plan: planFromSteps(candidate.plan.sourceText, steps, candidate.plan, 'reasoned-repair'),
              rationale: [...candidate.rationale, alternative.reason],
              origin: 'repair',
            });
          }

          if (['clear_path', 'inspect_blockers'].includes(alternative.type) && alternative.blockerIds?.length) {
            const blocker = alternative.blockerIds
              .map(id => w.objects.find(object => object.id === id))
              .find(object => object?.movable !== false);
            if (!blocker) continue;
            const zone = safeZoneForObject(blocker, w, analysis.step?.targetId);
            if (!zone) continue;
            const method = methodsFor({ method: 'auto' }, blocker, profile)[0];
            const steps = clone(candidate.plan.nodes.map(node => node.step));
            steps.splice(analysisIndex, 0, { type: method, objectId: blocker.id, targetId: zone.id, relation: 'inside', referenceFrame: 'world' });
            result.push({
              id: `repair_${result.length + 1}`,
              plan: planFromSteps(candidate.plan.sourceText, steps, candidate.plan, 'reasoned-repair'),
              rationale: [...candidate.rationale, `发现 ${blocker.name} 影响路径，先将其移入 ${zone.name}`],
              origin: 'repair',
            });
          }
        }
      }
      if (result.length >= 8) break;
    }
    return result.slice(0, 8);
  }

  class Reasoner {
    constructor() {
      this.lastTrace = null;
      this.profile = {
        maxCarryMassKg: 12,
        maxPushMassKg: 45,
        maxGripSpanM: 0.66,
        maxCarryRadiusM: 0.42,
        bodyRadiusM: 0.26,
      };
    }

    setProfile(profile) {
      this.profile = { ...this.profile, ...(profile || {}) };
    }

    draft(text, basePlan, world, context = {}) {
      if(basePlan?.groundedIntent||basePlan?.engine==='scene-grounded-compositional')return{kind:basePlan.status==='ready'?'semantic_plan':'unresolved',value:basePlan};
      if(basePlan?.requiresConfirmation)return{kind:basePlan.status==='ready'?'semantic_plan':'unresolved',value:basePlan};
      if(basePlan?.status==='ready')return{kind:'semantic_plan',value:basePlan};
      if(basePlan?.questions?.some(q=>['AMBIGUOUS','NEGATION_SCOPE','FIXED_OBJECT','VALIDATION','UNSUPPORTED_COMPOSITION','COUNT_MISMATCH','DEPENDENT_SCENE_QUERY','CAPABILITY_GAP'].includes(q.code)))return{kind:'unresolved',value:basePlan};
      const abstract = interpretAbstract(text, world, context, this.profile);
      if (abstract) return { kind: 'goal_graph', value: abstract };
      if (basePlan?.status === 'ready') return { kind: 'semantic_plan', value: basePlan };
      return { kind: 'unresolved', value: basePlan };
    }

    candidates(draft, world, context = {}) {
      if(draft.kind==='semantic_plan'&&(draft.value.groundedIntent||draft.value.requiresConfirmation)){
        const base=draft.value,orders=[base.nodes],w=worldData(world),goals=base.groundedIntent?.goals||[];
        // Reorder only one independent set. Never reorder explicit multi-goal instructions,
        // change selected IDs, add blockers, change relations, or replace carry with push.
        if(goals.length===1&&base.nodes.length>1&&base.nodes.every(n=>n.kind==='action'&&['carry','push'].includes(n.step.type))){
          const n=base.nodes,groups=[n,[...n].reverse()];
          for(const axis of [0,2]){const s=[...n].sort((a,b)=>(w.objects.find(o=>o.id===a.step.objectId)?.p[axis]||0)-(w.objects.find(o=>o.id===b.step.objectId)?.p[axis]||0));groups.push(s,[...s].reverse());}
          for(const group of groups)for(let shift=0;shift<Math.min(group.length,3);shift++)orders.push([...group.slice(shift),...group.slice(0,shift)]);
        }
        const seen=new Set(),unique=[];for(const nodes of orders){const key=JSON.stringify(nodes.map(n=>n.step));if(seen.has(key))continue;seen.add(key);const plan={...clone(base),nodes:clone(nodes)};plan.summary=Lang.renderSummary(plan.nodes,w);unique.push({id:'candidate_'+(unique.length+1),plan,origin:'scene_query',rationale:['保持对象集合、排除条件与目标关系','仅比较独立对象的搬运先后顺序','所有候选均交给原身体检查净空和路径']});if(unique.length>=12)break;}return unique;
      }
      if (draft.kind === 'goal_graph') return expandGoalGraph(draft.value, world, context, this.profile);
      if (draft.kind === 'semantic_plan') return varyExecutablePlan(draft.value, world, context, this.profile);
      return [];
    }

    decide({ text, draft, candidates, simulations, world, context = {}, objective = objectiveFromText(text) }) {
      const all = candidates.map((candidate, index) => ({
        ...candidate,
        simulation: simulations[index],
        score: scoreSimulation(simulations[index], objective),
      }));
      const feasible = all.filter(candidate => Number.isFinite(candidate.score)).sort((a, b) => a.score - b.score);
      const chosen = feasible[0] || null;
      const w = worldData(world);
      const trace = {
        schema: TRACE_SCHEMA,
        id: uid('reasoning'),
        version: VERSION,
        sourceText: text,
        engine: 'hybrid-symbolic-geometric-closed-loop',
        objective,
        worldRevision: w.revision,
        goals: draft.kind === 'goal_graph'
          ? clone(draft.value.goals)
          : currentBranch(draft.value?.nodes || [], world, context).map(node => ({ kind: 'goal', goal: { type: 'execute_semantic_step', step: clone(node.step) } })),
        resident: context.resident || null,
        activitySpace: context.activitySpace || null,
        worldFacts: [
          ...(context.resident ? [`人物 ${context.resident.displayName}；身份 ${context.resident.roleName}；活动 ${context.resident.activity}`] : []),
          `场景包含 ${w.objects.length} 个物体与 ${w.zones.length} 个区域`,
          `身体位置 ${contextPosition(context).map(value => Number(value).toFixed(2)).join(', ')}`,
          `当前姿势 ${context.posture || 'standing'}`,
          muscleCapacityProfile(this.profile) ? '力量随肌群、姿势和当前状态计算；候选方案需通过身体能力检查' : `身体搬运参数 ${Number(this.profile.maxCarryMassKg).toFixed(1)} kg，推动参数 ${Number(this.profile.maxPushMassKg).toFixed(1)} kg`,
        ],
        sceneGrounding: clone(draft.value?.groundedIntent||null),
        affordances: inferredAffordances(world, this.profile),
        candidates: all.map(candidate => ({
          id: candidate.id,
          origin: candidate.origin,
          rationale: candidate.rationale,
          score: Number.isFinite(candidate.score) ? candidate.score : null,
          summary: (candidate.plan.nodes || []).map(node => Lang.describeStep(node.step, world)),
          simulation: summarizeSimulation(candidate.simulation),
          feasible: Boolean(candidate.simulation?.feasible),
          reasons: candidate.simulation?.reasons || [],
        })),
        decision: chosen
          ? {
              candidateId: chosen.id,
              score: chosen.score,
              reasons: [
                `在 ${objective} 目标下综合比较可达性、耗时、负载与净空`,
                '身体物理推演通过全部步骤',
                '选择综合代价最低的可行方案',
              ],
            }
          : { candidateId: null, reasons: ['没有候选方案通过当前身体与场景的物理推演'] },
        uncertainty: chosen ? [] : [...new Set(all.flatMap(candidate => candidate.simulation?.reasons || []))],
        selectedPlan: chosen ? clone(chosen.plan) : null,
        createdAt: new Date().toISOString(),
      };

      if (chosen) {
        chosen.plan.summary = chosen.plan.nodes.map(node => Lang.describeStep(node.step, world));
        chosen.plan.reasoningTraceId = trace.id;
        chosen.plan.assumptions = [...(chosen.plan.assumptions || []), '已通过行为候选比较与身体物理推演'];
        trace.selectedPlan = clone(chosen.plan);
      }
      this.lastTrace = trace;
      return { trace, plan: chosen?.plan || null, chosen, all };
    }

    repair(candidates, simulations, world, context = {}) {
      const results=repairCandidates(candidates, simulations, world, context, this.profile);
      return results.filter(candidate=>{
        const protectedIds=candidate.plan.constraints?.protectedIds||[];
        if(Lang.flatten(candidate.plan.nodes).some(n=>protectedIds.includes(n.step.objectId)))return false;
        // No implicit expansion of a quantified command to unrelated blockers.
        const source=candidates.find(c=>c.plan.groundedIntent||c.plan.requiresConfirmation);
        if(source)return false;
        return true;
      });
    }
  }

  return {
    VERSION,
    TRACE_SCHEMA,
    GOAL_SCHEMA,
    Reasoner,
    interpretAbstract,
    inferredAffordances,
    selectObjects,
    selectTargets,
    expandGoalGraph,
    varyExecutablePlan,
    scoreSimulation,
    repairCandidates,
    objectiveFromText,
    methodPreference,
    fallbackPreference,
    zoneFreeScore,
    fitsZone,
    candidateView,
  };
});
