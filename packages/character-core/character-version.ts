import type { CharacterProfile } from './character-profile.ts';

export interface CharacterVersion {
  schema: 'humanoid_rig/character_version@1.0';
  character_id: string;
  version: number;
  saved_at: string;
  module_revisions: Record<string, number>;
  profile: CharacterProfile;
}

export * from './character-version.js';
