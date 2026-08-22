import { createClothingAsset } from './clothing-asset.js';
import { createClothingDefinition } from './clothing-definition.js';

export const CLOTHING_REGISTRY_SCHEMA = 'humanoid_rig/clothing_registry@1.0';

export class ClothingRegistry {
  #assets = new Map();
  #definitions = new Map();

  constructor(snapshot = null) {
    if (snapshot != null) this.restore(snapshot);
  }

  registerAsset(assetInput, { replace = false } = {}) {
    const asset = createClothingAsset(assetInput);
    if (!replace && this.#assets.has(asset.clothingId)) {
      throw new Error(`ClothingAsset ${asset.clothingId} is already registered.`);
    }
    this.#assets.set(asset.clothingId, structuredClone(asset));
    return structuredClone(asset);
  }

  getAsset(clothingId) {
    const asset = this.#assets.get(String(clothingId || '').trim());
    return asset ? structuredClone(asset) : null;
  }

  removeAsset(clothingId) {
    const id = String(clothingId || '').trim();
    if (!this.#assets.has(id)) return false;
    this.#assets.delete(id);
    for (const [definitionId, definition] of this.#definitions) {
      if (definition.clothingId === id) this.#definitions.delete(definitionId);
    }
    return true;
  }

  listAssets({ category = null, layer = null } = {}) {
    return [...this.#assets.values()]
      .filter((asset) => category == null || asset.category === category)
      .filter((asset) => layer == null || asset.layer === layer)
      .sort((left, right) => left.clothingId.localeCompare(right.clothingId))
      .map((asset) => structuredClone(asset));
  }

  registerDefinition(definitionInput, { replace = false } = {}) {
    const definition = createClothingDefinition(definitionInput);
    if (!this.#assets.has(definition.clothingId)) {
      throw new Error(`ClothingDefinition references unknown ClothingAsset ${definition.clothingId}.`);
    }
    if (!replace && this.#definitions.has(definition.definitionId)) {
      throw new Error(`ClothingDefinition ${definition.definitionId} is already registered.`);
    }
    this.#definitions.set(definition.definitionId, structuredClone(definition));
    return structuredClone(definition);
  }

  getDefinition(definitionId) {
    const definition = this.#definitions.get(String(definitionId || '').trim());
    return definition ? structuredClone(definition) : null;
  }

  removeDefinition(definitionId) {
    return this.#definitions.delete(String(definitionId || '').trim());
  }

  listDefinitions({ clothingId = null } = {}) {
    return [...this.#definitions.values()]
      .filter((definition) => clothingId == null || definition.clothingId === clothingId)
      .sort((left, right) => left.definitionId.localeCompare(right.definitionId))
      .map((definition) => structuredClone(definition));
  }

  toJSON() {
    return {
      schema: CLOTHING_REGISTRY_SCHEMA,
      assets: this.listAssets(),
      definitions: this.listDefinitions(),
    };
  }

  restore(snapshot) {
    if (!isPlainObject(snapshot)) throw new TypeError('ClothingRegistry snapshot must be an object.');
    if (snapshot.schema != null && snapshot.schema !== CLOTHING_REGISTRY_SCHEMA) {
      throw new TypeError(`Unsupported ClothingRegistry schema ${snapshot.schema}.`);
    }
    if (snapshot.assets != null && !Array.isArray(snapshot.assets)) throw new TypeError('ClothingRegistry assets must be an array.');
    if (snapshot.definitions != null && !Array.isArray(snapshot.definitions)) {
      throw new TypeError('ClothingRegistry definitions must be an array.');
    }
    const nextAssets = new Map();
    for (const input of snapshot.assets || []) {
      const asset = createClothingAsset(input);
      if (nextAssets.has(asset.clothingId)) throw new Error(`Duplicate ClothingAsset ${asset.clothingId}.`);
      nextAssets.set(asset.clothingId, asset);
    }
    const nextDefinitions = new Map();
    for (const input of snapshot.definitions || []) {
      const definition = createClothingDefinition(input);
      if (!nextAssets.has(definition.clothingId)) {
        throw new Error(`ClothingDefinition references unknown ClothingAsset ${definition.clothingId}.`);
      }
      if (nextDefinitions.has(definition.definitionId)) {
        throw new Error(`Duplicate ClothingDefinition ${definition.definitionId}.`);
      }
      nextDefinitions.set(definition.definitionId, definition);
    }
    this.#assets = nextAssets;
    this.#definitions = nextDefinitions;
    return this;
  }
}

export function createClothingRegistry(snapshot = null) {
  return new ClothingRegistry(snapshot);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
