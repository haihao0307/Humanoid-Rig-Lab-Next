import { applyModulePatch, normalizeProjectState } from '../src/state-schema.js';

let state = null;
const ports = new Set();
const presence = new Map();

function postAll(message, except = null) {
  for (const port of ports) {
    if (port === except) continue;
    try { port.postMessage(message); } catch (_) {}
  }
}

function presencePayload() {
  return [...presence.values()];
}

function adoptFullState(incoming) {
  const normalized = normalizeProjectState(incoming);
  if (!state) {
    state = normalized;
    return true;
  }
  const currentRevision = Number(state.revision || 0);
  const incomingRevision = Number(normalized.revision || 0);
  const currentTime = Date.parse(state.updatedAt || 0) || 0;
  const incomingTime = Date.parse(normalized.updatedAt || 0) || 0;
  if (incomingRevision > currentRevision || (incomingRevision === currentRevision && incomingTime >= currentTime)) {
    state = normalized;
    return true;
  }
  return false;
}

onconnect = (event) => {
  const port = event.ports[0];
  ports.add(port);
  port.start();

  port.onmessage = (messageEvent) => {
    const message = messageEvent.data || {};

    if (message.type === 'HELLO') {
      presence.set(port, {
        clientId: message.clientId,
        module: message.module || 'dashboard',
        title: message.title || 'Humanoid Rig Lab',
        connectedAt: new Date().toISOString(),
      });
      adoptFullState(message.state);
      port.postMessage({ type: 'STATE', state, source: 'shared-worker' });
      postAll({ type: 'PRESENCE', clients: presencePayload() });
      return;
    }

    if (message.type === 'MODULE_PATCH') {
      if (!state) state = normalizeProjectState(message.state);
      const result = applyModulePatch(state, message.patch);
      if (result.accepted) {
        state = result.state;
        postAll({ type: 'STATE', state, source: message.clientId });
      } else {
        port.postMessage({ type: 'STATE', state, source: 'shared-worker-correction' });
      }
      return;
    }

    if (message.type === 'REPLACE_STATE') {
      state = normalizeProjectState(message.state);
      postAll({ type: 'STATE', state, source: message.clientId });
      return;
    }

    if (message.type === 'TRANSIENT') {
      postAll({
        ...message,
        type: 'TRANSIENT',
        issuedAt: Number(message.issuedAt) || Date.now(),
      }, port);
      return;
    }

    if (message.type === 'STATE_UPDATE') {
      if (adoptFullState(message.state)) postAll({ type: 'STATE', state, source: message.clientId });
      else port.postMessage({ type: 'STATE', state, source: 'shared-worker-correction' });
      return;
    }

    if (message.type === 'PING') port.postMessage({ type: 'PONG', at: Date.now() });
  };

  port.onmessageerror = () => {};
  port.addEventListener('close', () => {
    ports.delete(port);
    presence.delete(port);
    postAll({ type: 'PRESENCE', clients: presencePayload() });
  });
};
