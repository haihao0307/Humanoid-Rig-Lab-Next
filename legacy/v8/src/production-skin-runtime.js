import { assertPoseFrameV4, isPoseFrameV4 } from '../../../src/modules/pose/pose-frame-v4.js';
import { PoseCorrectiveRuntime } from './pose-corrective-runtime.js';
import {
  createSkinBindingProfileV4,
  validateSkinBindingProfileV4,
} from './skin-binding-profile-v4.js';

const IDENTITY = Object.freeze([0, 0, 0, 1]);

export class ProductionSkinRuntime {
  constructor({ bindingProfile = null } = {}) {
    this.bindingProfile = bindingProfile ? createSkinBindingProfileV4(bindingProfile) : null;
    this.correctiveRuntime = null;
    this.bound = false;
    this.lockedProportionRevision = null;
    this.sourceRootPosition = [0, 0, 0];
    this.asset = null;
    this.lastResult = null;
    this.lastError = null;
    this.validation = null;
  }

  bindCharacter({
    simulationRig = null,
    skinAsset,
    bindingProfile = this.bindingProfile,
    sourceRootPosition = [0, 0, 0],
  } = {}) {
    const profile = createSkinBindingProfileV4(bindingProfile ?? {});
    const asset = normalizeAssetDescriptor(skinAsset);
    const validation = validateSkinBindingProfileV4(profile, asset);
    if (!validation.valid) {
      this.lastError = validation.errors.join(' ');
      throw new Error(`ProductionSkinRuntime bind failed: ${this.lastError}`);
    }
    this.bindingProfile = profile;
    this.asset = asset;
    this.validation = validation;
    this.sourceRootPosition = normalizeVector3(sourceRootPosition);
    this.lockedProportionRevision = Number.isInteger(profile.boundProportionRevision)
      ? profile.boundProportionRevision
      : null;
    this.correctiveRuntime = new PoseCorrectiveRuntime(profile.correctiveMap);
    this.bound = true;
    this.lastError = null;
    this.lastResult = null;
    if (simulationRig) this.updatePose(simulationRig);
    return this.getDiagnostics();
  }

  updatePose(input) {
    if (!this.bound) throw new Error('ProductionSkinRuntime must bindCharacter() before updatePose().');
    const finalPose = extractFinalPose(input);
    assertPoseFrameV4(finalPose);
    if (finalPose.compatibleRig !== this.bindingProfile.compatibleRig) {
      return this.block(`Rig ${finalPose.compatibleRig} is incompatible with ${this.bindingProfile.compatibleRig}.`, finalPose);
    }
    if (this.lockedProportionRevision == null) {
      this.lockedProportionRevision = finalPose.proportionRevision;
    } else if (this.lockedProportionRevision !== finalPose.proportionRevision) {
      return this.block(
        `Proportion revision changed from ${this.lockedProportionRevision} to ${finalPose.proportionRevision}; a rebound skin asset is required.`,
        finalPose,
      );
    }

    const assetJointIds = new Set(this.asset.jointIds);
    const localRotations = {};
    for (const [sourceJointId, targetJointId] of Object.entries(this.bindingProfile.coreJointMap)) {
      if (!assetJointIds.has(targetJointId)) continue;
      localRotations[targetJointId] = sourceRotation(finalPose, sourceJointId);
    }
    for (const [targetJointId, mapping] of Object.entries(this.bindingProfile.deformJointMap)) {
      if (!assetJointIds.has(targetJointId)) continue;
      const source = sourceRotation(finalPose, mapping.sourceJointId);
      localRotations[targetJointId] = mapping.mode === 'fractional'
        ? fractionalQuaternion(source, Number(mapping.weight) || 0)
        : mapping.mode === 'identity'
          ? [...IDENTITY]
          : source;
    }
    for (const jointId of this.asset.jointIds) {
      if (!localRotations[jointId]) localRotations[jointId] = [...IDENTITY];
    }

    const corrective = this.correctiveRuntime.applyCorrectives(finalPose, null);
    const rootDelta = [0, 1, 2].map((index) => (
      Number(finalPose.rootPosition[index]) - Number(this.sourceRootPosition[index])
    ));
    this.lastError = null;
    this.lastResult = {
      applied: true,
      authority: 'finalPose.localRotations',
      finalPose,
      rootJointId: finalPose.rootJointId,
      rootDelta,
      localRotations,
      correctiveActivations: corrective.activations,
      correctiveDiagnostics: corrective.diagnostics,
      proportionRevision: finalPose.proportionRevision,
    };
    return structuredClone(this.lastResult);
  }

  getDiagnostics() {
    return {
      schema: 'humanoid_rig/production_skin_diagnostics@4.0',
      skinVersion: 'production-skin-v4-runtime@1',
      bindingVersion: this.bindingProfile?.bindingVersion ?? null,
      rigVersion: this.bindingProfile?.compatibleRig ?? null,
      vertexCount: this.asset?.vertexCount ?? 0,
      jointCount: this.asset?.jointIds?.length ?? 0,
      deformRigStatus: this.bound ? 'mapped-read-only' : 'unbound',
      correctiveStatus: this.correctiveRuntime ? 'bone-driven-ready' : 'unbound',
      correctiveDiagnostics: this.correctiveRuntime?.getDiagnostics() ?? null,
      deformationMode: this.bindingProfile?.deformationMode ?? null,
      skinQuality: this.bindingProfile?.quality?.level ?? 'unknown',
      productionReady: this.bindingProfile?.productionReady === true,
      assetClass: this.bindingProfile?.assetClass ?? null,
      weightSource: this.bindingProfile?.weightSource ?? null,
      inverseBindSource: this.bindingProfile?.inverseBindSource ?? null,
      runtimeWeightGeneration: this.bindingProfile?.runtimeWeightGeneration ?? null,
      poseAuthority: this.lastResult?.authority ?? null,
      lockedProportionRevision: this.lockedProportionRevision,
      proportionCompatible: !this.lastError,
      lastError: this.lastError,
      bound: this.bound,
      validation: this.validation ? structuredClone(this.validation) : null,
    };
  }

  block(reason, finalPose) {
    this.lastError = reason;
    this.lastResult = {
      applied: false,
      authority: 'finalPose.localRotations',
      finalPose,
      reason,
      proportionRevision: finalPose.proportionRevision,
    };
    return structuredClone(this.lastResult);
  }
}

function extractFinalPose(input) {
  if (isPoseFrameV4(input)) return input;
  if (isPoseFrameV4(input?.finalPose)) return input.finalPose;
  if (isPoseFrameV4(input?.frame?.finalPose)) return input.frame.finalPose;
  throw new Error('ProductionSkinRuntime requires PoseFrame V4 or SimulationRig.finalPose.');
}

function sourceRotation(finalPose, jointId) {
  if (jointId === finalPose.rootJointId) return normalizeQuaternion(finalPose.rootRotation);
  return normalizeQuaternion(finalPose.localRotations?.[jointId] ?? IDENTITY);
}

function fractionalQuaternion(value, amount) {
  const target = normalizeQuaternion(value);
  const t = Math.min(1, Math.max(0, amount));
  const angle = Math.acos(Math.min(1, Math.max(-1, target[3])));
  if (angle < 1e-8) return [...IDENTITY];
  const scale = Math.sin(angle * t) / Math.sin(angle);
  return normalizeQuaternion([
    target[0] * scale,
    target[1] * scale,
    target[2] * scale,
    Math.cos(angle * t),
  ]);
}

function normalizeQuaternion(value) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? Array.from(value, Number) : [...IDENTITY];
  const length = Math.hypot(...source) || 1;
  const normalized = source.map((component) => component / length);
  return normalized[3] < 0 ? normalized.map((component) => -component) : normalized;
}

function normalizeVector3(value) {
  const source = Array.isArray(value) || ArrayBuffer.isView(value) ? value : [0, 0, 0];
  return [0, 1, 2].map((index) => Number(source[index]) || 0);
}

function normalizeAssetDescriptor(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    assetReference: String(source.assetReference ?? ''),
    compatibleRig: String(source.compatibleRig ?? ''),
    vertexCount: Math.max(0, Math.floor(Number(source.vertexCount) || 0)),
    jointIds: Array.isArray(source.jointIds) ? source.jointIds.map(String) : [],
    attributes: Array.isArray(source.attributes) ? source.attributes.map(String) : [],
    inverseBindMatrixCount: Math.max(0, Math.floor(Number(source.inverseBindMatrixCount) || 0)),
    productionReady: source.productionReady === true,
  };
}
