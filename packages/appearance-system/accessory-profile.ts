export type AccessoryType = 'hat' | 'glasses' | 'ornament';

export interface AccessoryProfile {
  accessory_id: string;
  revision: number;
  name: string;
  type: AccessoryType;
  rig_profile: {
    target: 'simulationRig';
    attachment_point: string;
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

export * from './accessory-profile.js';
