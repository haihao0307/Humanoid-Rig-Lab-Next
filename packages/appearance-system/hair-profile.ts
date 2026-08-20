export type HairStyle = 'short' | 'long' | 'ponytail';

export interface HairProfile {
  hair_id: string;
  revision: number;
  name: string;
  style: HairStyle;
  rig_profile: {
    target: 'simulationRig';
    attachment_points: string[];
  };
  material: {
    base_color: string;
    roughness: number;
    metalness: number;
    opacity: number;
  };
  transform: {
    offset: [number, number, number];
    rotation: [number, number, number, number];
    scale: number;
  };
}

export * from './hair-profile.js';
