export const PHASE_LOCOMOTION_STATE_V4_SCHEMA = 'humanoid_rig/phase_locomotion_state@4.0';

export class PhaseLocomotionRuntime {
  constructor() {
    this.phaseData = { cyclic: false, samples: [], markers: [] };
    this.duration = 1;
    this.manualPhase = null;
    this.lastState = null;
  }

  load(phaseData = {}, duration = 1) {
    this.phaseData = structuredClone(phaseData);
    this.duration = Math.max(1e-6, Number(duration) || 1);
    this.manualPhase = null;
    this.lastState = null;
    return this;
  }

  setPhase(value = null) {
    if (value == null) this.manualPhase = null;
    else this.manualPhase = positiveModulo(Number(value) || 0, 1);
    return this.manualPhase;
  }

  sample(rawTime = 0) {
    const resolved = resolvePhaseTime(rawTime, this.duration, this.phaseData.cyclic);
    const normalizedPhase = this.manualPhase == null ? resolved.time / this.duration : this.manualPhase;
    const phaseTime = this.manualPhase == null ? resolved.time : normalizedPhase * this.duration;
    const sample = samplePhaseLane(this.phaseData.samples, phaseTime, normalizedPhase);
    const marker = nearestMarker(this.phaseData.markers, phaseTime, this.duration);
    this.lastState = {
      schema: PHASE_LOCOMOTION_STATE_V4_SCHEMA,
      normalizedPhase,
      phaseTime,
      cycle: resolved.cycle,
      cyclic: this.phaseData.cyclic === true,
      leftFootState: sample.leftFootState,
      rightFootState: sample.rightFootState,
      supportState: sample.supportState,
      transition: marker?.markerType ?? null,
      transitionFoot: marker?.foot ?? null,
      source: this.phaseData.samples?.length ? 'motion-clip-phase-data' : 'unclassified',
      synthesizesJointMotion: false,
    };
    return structuredClone(this.lastState);
  }

  getState() {
    return this.lastState ? structuredClone(this.lastState) : null;
  }
}

export function samplePhaseLocomotion(phaseData, duration, rawTime, manualPhase = null) {
  const runtime = new PhaseLocomotionRuntime().load(phaseData, duration);
  runtime.setPhase(manualPhase);
  return runtime.sample(rawTime);
}

function samplePhaseLane(samples = [], time, normalizedPhase) {
  if (!samples.length) {
    return { phase: normalizedPhase, leftFootState: 'stance', rightFootState: 'stance', supportState: 'double_support' };
  }
  let selected = samples[0];
  for (const sample of samples) {
    if (Number(sample.time) <= time + 1e-7) selected = sample;
    else break;
  }
  return selected;
}

function nearestMarker(markers = [], time, duration) {
  const epsilon = Math.max(1e-4, duration / 1000);
  let nearest = null;
  let distance = Infinity;
  for (const marker of markers) {
    const current = Math.abs(Number(marker.time) - time);
    if (current <= epsilon && current < distance) {
      nearest = marker;
      distance = current;
    }
  }
  return nearest;
}

function resolvePhaseTime(rawTime, duration, cyclic) {
  const time = Number(rawTime) || 0;
  if (!cyclic) return { time: Math.min(duration, Math.max(0, time)), cycle: 0 };
  return { time: positiveModulo(time, duration), cycle: Math.floor(time / duration) };
}

function positiveModulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}
