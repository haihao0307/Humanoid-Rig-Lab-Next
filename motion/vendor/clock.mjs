export class FixedClock {
  constructor(step = 1 / 120, maxSteps = 24) {
    if (!(Number.isFinite(step) && step > 0 && Number.isInteger(maxSteps) && maxSteps > 0)) throw Error('Invalid clock');
    this.step = step; this.maxSteps = maxSteps; this.accumulator = 0; this.droppedSeconds = 0; this.ticks = 0;
  }
  advance(elapsed, update, paused = false) {
    if (!Number.isFinite(elapsed) || elapsed < 0) throw Error('Invalid elapsed time');
    if (paused) { this.accumulator = 0; return 0; }
    this.accumulator += elapsed;
    const available = Math.floor((this.accumulator + 1e-12) / this.step);
    const steps = Math.min(available, this.maxSteps);
    const dropped = Math.max(0, available - steps) * this.step;
    this.droppedSeconds += dropped; this.accumulator -= dropped;
    for (let i = 0; i < steps; i++) { update(this.step); this.ticks++; this.accumulator -= this.step; }
    this.accumulator = Math.max(0, this.accumulator);
    return this.accumulator / this.step;
  }
}
