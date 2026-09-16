import { add, sub, mul, length, distance, normalize, rotateY, angle, clamp, mix, smooth, finiteVector, solveTwoBone } from './math.mjs';
import { FlatWorld } from './world.mjs';
import { FullBodyMotion } from './full-body.mjs';

export const CAPABILITIES = Object.freeze({ walk: true, turn: true, stop: true, pause: true,
  carry: false, push: false, salute: false, sit: false, lie: false });
const SIDES = ['left', 'right'];
const horizontal = v => [v[0], 0, v[2]];

export class MotionController {
  constructor(rig, world = new FlatWorld()) {
    this.rig = structuredClone(rig); this.world = world;
    if (!['hipHalf', 'ankleHeight', 'hipHeight', 'torso'].every(k => Number.isFinite(rig[k]) && rig[k] > 0) || !SIDES.every(s => ['upper', 'lower'].every(k => Number.isFinite(rig.legs?.[s]?.[k]) && rig.legs[s][k] > 0))) throw Error('Invalid rig');
    this.motion = new FullBodyMotion(this.rig.nodes);
    this.reset();
  }
  reset() {
    const root = [0, this.rig.hipHeight, 0];
    this.state = { root, yaw: 0, speed: 0, time: 0, command: null, status: 'idle',
      paused: false, fault: null, nextFoot: 'left', swing: null, feet: {}, pose: null,
      motion: { phase: 0, weight: 0, frame: null },
      metrics: { maxBoneError: 0, maxContactError: 0, maxIKResidual: 0, steps: 0, completed: 0, rejected: 0 } };
    for (const side of SIDES) this.state.feet[side] = { position: this.stance(this.state, side), yaw: 0, contact: true };
    if (!this.world.free(root, .23)) throw Error('Spawn overlaps obstacle');
    this.state.pose = this.solve(this.state);
  }
  stance(s, side, lead = 0) {
    const local = [this.rig.hipHalf * (side === 'left' ? -1 : 1), 0, lead];
    const p = add(s.root, rotateY(local, s.yaw)); p[1] = this.rig.ankleHeight; return p;
  }
  command(command) {
    if (!command || !CAPABILITIES[command.type]) return { accepted: false, reason: '实验未实现：' + command?.type };
    if (command.type === 'pause') { this.state.paused = command.value !== false; return { accepted: true }; }
    if (this.state.fault) return { accepted: false, reason: '请复位已阻断的实验' };
    if (command.type === 'walk' && (!finiteVector(command.target) || !this.world.free(command.target, .23))) return { accepted: false, reason: '目标无效或与障碍重叠' };
    if (command.type === 'turn' && !Number.isFinite(command.yaw)) return { accepted: false, reason: '朝向无效' };
    this.state.command = structuredClone(command); this.state.status = command.type === 'stop' ? 'stopping' : command.type;
    return { accepted: true };
  }
  solve(s) {
    const legs = {};
    for (const side of SIDES) {
      const hip = add(s.root, rotateY([this.rig.hipHalf * (side === 'left' ? -1 : 1), 0, 0], s.yaw));
      const pole = add(hip, rotateY([0, -.2, 1], s.yaw));
      const lengths = this.rig.legs[side];
      legs[side] = solveTwoBone(hip, s.feet[side].position, pole, lengths.upper, lengths.lower);
    }
    return { root: [...s.root], yaw: s.yaw, legs };
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 1 / 30 + 1e-12) throw Error('Use a fixed small step');
    if (this.state.paused || this.state.fault) return;
    // Propose, solve, validate, commit. Rejected poses never alter root, anchors,
    // action progress or the visible pose. Diagnostic failure is explicit.
    const prior = this.state, s = structuredClone(prior), c = s.command;
    s.time += dt;
    try {
      let wantedSpeed = 0, targetYaw = s.yaw;
      const remaining = c?.type === 'walk' ? length(horizontal(sub(c.target, s.root))) : 0;
      if (c?.type === 'walk' && remaining > .015) {
        const d = sub(c.target, s.root); targetYaw = Math.atan2(d[0], d[2]);
        wantedSpeed = Math.min(.48, Math.sqrt(2 * .9 * remaining)) * clamp(1 - Math.abs(angle(targetYaw - s.yaw)) / .6, 0, 1);
      }
      if (c?.type === 'turn') targetYaw = c.yaw;
      // Planted foot orientation constrains root turn. The stepping scheduler
      // releases one foot explicitly instead of clearing both contact locks.
      let yawDelta = clamp(angle(targetYaw - s.yaw), -1.1 * dt, 1.1 * dt);
      for (const foot of Object.values(s.feet)) if (foot.contact) {
        const twist = angle(s.yaw + yawDelta - foot.yaw);
        if (Math.abs(twist) > .28 && Math.sign(twist) === Math.sign(yawDelta)) yawDelta = 0;
      }
      s.yaw = angle(s.yaw + yawDelta);
      s.speed += clamp(wantedSpeed - s.speed, -.9 * dt, .7 * dt);
      const heading = rotateY([0, 0, 1], s.yaw);
      let travel = s.speed * dt;
      if (c?.type === 'walk') travel = Math.min(travel, remaining);
      const sweep = this.world.sweep(s.root, add(s.root, mul(heading, travel)), .23);
      s.root = sweep.position;
      if (sweep.blocked) { s.speed = 0; s.status = 'blocked'; }
      this.stepFeet(s, dt);
      this.motion.advance(s, dt);
      s.pose = this.solve(s);
      for (const side of SIDES) {
        const leg = s.pose.legs[side], foot = s.feet[side];
        // Compare solved endpoint to independent world-space anchor BEFORE any
        // update. It must not compare two copies of the freshly solved foot.
        const contactError = foot.contact ? distance(leg.end, foot.position) : 0;
        s.metrics.maxContactError = Math.max(s.metrics.maxContactError, contactError);
        s.metrics.maxBoneError = Math.max(s.metrics.maxBoneError, leg.lengthError);
        s.metrics.maxIKResidual = Math.max(s.metrics.maxIKResidual, leg.residual);
        if (leg.residual > .012 || leg.lengthError > 1e-7) throw Error('落脚超出可达范围，候选姿态未提交');
        if (prior.feet[side].contact && foot.contact && distance(prior.feet[side].position, foot.position) > 1e-8) throw Error('支撑脚锚点发生漂移');
      }
      const feetAligned = SIDES.every(side => distance(s.feet[side].position, this.stance(s, side)) < .055 && Math.abs(angle(s.yaw - s.feet[side].yaw)) < .08);
      const atGoal = c?.type === 'walk' ? remaining <= .015 : c?.type === 'turn' ? Math.abs(angle(c.yaw - s.yaw)) < .015 : true;
      if (s.speed < .001 && !s.swing && feetAligned && atGoal) {
        if (c && c.type !== 'stop') s.metrics.completed++;
        s.command = null; s.status = 'idle';
      }
      this.state = s;
    } catch (error) {
      prior.fault = error.message; prior.status = 'fault'; prior.paused = true;
      prior.metrics.rejected++; // all physical state remains at the last commit
    }
  }
  stepFeet(s, dt) {
    if (!s.swing) {
      const scores = SIDES.map(side => ({ side,
        positionError: distance(s.feet[side].position, this.stance(s, side)),
        turnError: Math.abs(angle(s.yaw - s.feet[side].yaw)) }));
      const threshold = s.speed > .03 ? .095 : .05;
      const eligible = scores.filter(x => x.positionError > threshold || x.turnError > .07);
      eligible.sort((a, b) => (b.positionError + b.turnError * .3) - (a.positionError + a.turnError * .3) || (a.side === s.nextFoot ? -1 : 1));
      if (eligible.length) {
        const side = eligible[0].side, foot = s.feet[side];
        const target = this.stance(s, side, s.speed * .38);
        const sweep = this.world.sweep(foot.position, target, .045);
        if (sweep.blocked || !this.world.free(target, .045)) throw Error('落脚路径受阻，需重新规划');
        s.swing = { side, from: [...foot.position], target, fromYaw: foot.yaw, yaw: s.yaw, elapsed: 0, duration: .36 };
        foot.contact = false;
      }
    }
    if (s.swing) {
      const step = s.swing; step.elapsed = Math.min(step.duration, step.elapsed + dt);
      const t = step.elapsed / step.duration, foot = s.feet[step.side];
      foot.position = mix(step.from, step.target, smooth(t));
      foot.position[1] += .065 * 16 * t * t * (1 - t) * (1 - t);
      foot.yaw = angle(step.fromYaw + angle(step.yaw - step.fromYaw) * smooth(t));
      if (t >= 1) {
        foot.position = [...step.target]; foot.contact = true; foot.yaw = step.yaw;
        s.nextFoot = step.side === 'left' ? 'right' : 'left'; s.swing = null; s.metrics.steps++;
      }
    }
  }
  snapshot() { return structuredClone(this.state); }
}
