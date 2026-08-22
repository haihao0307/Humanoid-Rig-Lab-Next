export interface ClothingDefinition {
  definitionId: string;
  clothingId: string;
  attachmentBones: string[];
  bindingTarget: 'simulationRig';
  metadata: Record<string, unknown>;
}

export * from './clothing-definition.js';
