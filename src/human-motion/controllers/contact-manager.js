import { clamp, normalizeQuaternion, normalizeVector3, smoothstep, unit, vector3 } from '../solver/motion-math.js';

export const CONTACT_MODES = Object.freeze(['world_lock', 'position', 'orientation', 'surface', 'grasp', 'seat']);

export class ContactManager {
  constructor({ contactBlendIn = 0.12, contactBlendOut = 0.18 } = {}) {
    this.defaultBlendIn = Math.max(1e-4, Number(contactBlendIn) || 0.12);
    this.defaultBlendOut = Math.max(1e-4, Number(contactBlendOut) || 0.18);
    this.contacts = new Map();
  }

  createContact(input = {}) {
    const contactId = String(input.contactId || input.id || `${input.jointId || 'joint'}_contact`);
    if (!input.jointId) throw new TypeError(`Contact ${contactId} requires jointId.`);
    const existing = this.contacts.get(contactId);
    const contact = {
      contactId,
      jointId: String(input.jointId),
      mode: CONTACT_MODES.includes(input.mode) ? input.mode : 'world_lock',
      targetPosition: vector3(input.targetPosition ?? input.position ?? existing?.targetPosition),
      targetRotation: input.targetRotation == null ? (existing?.targetRotation ?? null) : normalizeQuaternion(input.targetRotation),
      normal: normalizeVector3(input.normal ?? existing?.normal, [0, 1, 0]),
      friction: Math.max(0, finite(input.friction, existing?.friction ?? 0.8)),
      positionWeight: unit(input.positionWeight, existing?.positionWeight ?? 1),
      rotationWeight: unit(input.rotationWeight, existing?.rotationWeight ?? 0.8),
      phase: unit(input.phase, existing?.phase ?? 0),
      priority: finite(input.priority, existing?.priority ?? 100),
      active: existing?.active || false,
      desiredActive: input.active !== false,
      blendWeight: clamp(existing?.blendWeight ?? 0, 0, 1),
      releaseProgress: clamp(existing?.releaseProgress ?? 0, 0, 1),
      contactBlendIn: Math.max(1e-4, finite(input.contactBlendIn, existing?.contactBlendIn ?? this.defaultBlendIn)),
      contactBlendOut: Math.max(1e-4, finite(input.contactBlendOut, existing?.contactBlendOut ?? this.defaultBlendOut)),
      assetId: input.assetId == null ? existing?.assetId ?? null : String(input.assetId),
    };
    this.contacts.set(contactId, contact);
    return this.getContact(contactId);
  }

  activateContact(contactId, updates = {}) {
    const current = this.contacts.get(String(contactId));
    if (!current) throw new Error(`Unknown contact: ${String(contactId)}.`);
    this.createContact({ ...current, ...updates, contactId: current.contactId, active: true });
    this.contacts.get(current.contactId).desiredActive = true;
    return this.getContact(current.contactId);
  }

  releaseContact(contactId) {
    const current = this.contacts.get(String(contactId));
    if (!current) return false;
    current.desiredActive = false;
    return true;
  }

  updateContact(contactId, updates = {}) {
    const current = this.contacts.get(String(contactId));
    if (!current) throw new Error(`Unknown contact: ${String(contactId)}.`);
    return this.createContact({ ...current, ...updates, contactId: current.contactId, active: current.desiredActive });
  }

  syncGoalContacts(goalContacts = []) {
    const incoming = new Set();
    for (const input of goalContacts) {
      const contact = this.createContact(input);
      incoming.add(contact.contactId);
      if (input.active === false) this.releaseContact(contact.contactId);
      else this.activateContact(contact.contactId, input);
    }
    for (const contactId of this.contacts.keys()) {
      if (!incoming.has(contactId)) this.releaseContact(contactId);
    }
  }

  update(deltaTime = 1 / 60) {
    const dt = clamp(deltaTime, 0, 0.25);
    for (const contact of this.contacts.values()) {
      const duration = contact.desiredActive ? contact.contactBlendIn : contact.contactBlendOut;
      const direction = contact.desiredActive ? 1 : -1;
      contact.blendWeight = clamp(contact.blendWeight + direction * dt / duration, 0, 1);
      contact.active = contact.blendWeight > 1e-6;
      contact.releaseProgress = contact.desiredActive ? 0 : 1 - contact.blendWeight;
    }
    return this.getActiveContacts();
  }

  getContact(contactId) {
    const contact = this.contacts.get(String(contactId));
    return contact ? serialize(contact) : null;
  }

  getActiveContacts() {
    return [...this.contacts.values()]
      .filter((contact) => contact.active)
      .sort((a, b) => b.priority - a.priority)
      .map(serialize);
  }

  clear({ immediate = true } = {}) {
    if (immediate) this.contacts.clear();
    else for (const contact of this.contacts.values()) contact.desiredActive = false;
  }

  dispose() {
    this.contacts.clear();
  }
}

function serialize(contact) {
  const blend = smoothstep(contact.blendWeight);
  return {
    contactId: contact.contactId,
    jointId: contact.jointId,
    mode: contact.mode,
    targetPosition: [...contact.targetPosition],
    targetRotation: contact.targetRotation == null ? null : [...contact.targetRotation],
    normal: [...contact.normal],
    friction: contact.friction,
    positionWeight: contact.positionWeight * blend,
    rotationWeight: contact.rotationWeight * blend,
    phase: contact.phase,
    active: contact.active,
    releaseProgress: contact.releaseProgress,
    blendWeight: blend,
    priority: contact.priority,
    contactBlendIn: contact.contactBlendIn,
    contactBlendOut: contact.contactBlendOut,
    assetId: contact.assetId,
  };
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
