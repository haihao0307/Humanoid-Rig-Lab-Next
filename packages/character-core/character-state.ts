import type { CharacterProfile } from './character-profile.ts';
import type { CharacterVersion } from './character-version.ts';

export interface CharacterState {
  schema: 'humanoid_rig/character_state@1.0';
  revision: number;
  updated_at: string;
  active_character_id: string | null;
  profiles: Record<string, CharacterProfile>;
  versions: Record<string, CharacterVersion[]>;
}

export * from './character-state.js';
