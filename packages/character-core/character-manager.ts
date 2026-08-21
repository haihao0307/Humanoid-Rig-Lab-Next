import type { CharacterProfile } from './character-profile.ts';
import type { CharacterState } from './character-state.ts';

export interface OperationEvent {
  schema: 'humanoid_rig/operation_event@1.0';
  event_id: string;
  operation: 'character.create' | 'character.load' | 'character.save' | 'character.restore';
  character_id: string;
  base_revision: number;
  revision: number;
  actor: string;
  at: string;
  changes: Record<string, unknown>;
}

export interface CharacterOperationResult {
  state: CharacterState;
  profile: CharacterProfile;
  event: OperationEvent;
}

export * from './character-manager.js';
