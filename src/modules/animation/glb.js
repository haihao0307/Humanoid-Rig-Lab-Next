import { createRigContext } from './runtime.js';
import { normalizeClip, validateAnimationClip } from './model.js';

const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;
const FLOAT_COMPONENT_TYPE = 5126;

/**
 * Builds a standards-compliant glTF 2.0 binary containing the 28-joint
 * skeleton and one local-transform animation. The skin mesh is intentionally
 * external because the animation module is not allowed to alter skin assets.
 */
export function exportAnimationSkeletonGlb(clipInput, bodyProfile = {}, {
  rigVersion = 'rig@0.4.0',
  generator = 'Humanoid Rig Lab Next anim@0.4.0',
} = {}) {
  const clip = normalizeClip(clipInput, { compatibleRig: rigVersion });
  const report = validateAnimationClip(clip);
  if (!report.valid) throw new Error(`Cannot export invalid clip: ${report.errors.join(', ')}`);
  const rig = createRigContext(bodyProfile, { rigVersion });
  const nodeIndex = new Map(rig.joints.map((joint, index) => [joint.id, index]));
  const binary = new BinaryBuilder();
  const bufferViews = [];
  const accessors = [];
  const samplers = [];
  const channels = [];

  const nodes = rig.joints.map((joint) => ({
    name: joint.id,
    translation: joint.localPosition.map(Number),
    rotation: [0, 0, 0, 1],
    ...(rig.children.get(joint.id)?.length
      ? { children: rig.children.get(joint.id).map((id) => nodeIndex.get(id)) }
      : {}),
    extras: {
      humanoid_joint_id: joint.id,
      parent_id: joint.parentId,
      physical_bone: joint.physicalBone,
    },
  }));

  for (const track of clip.tracks) {
    const targetNode = nodeIndex.get(track.jointId);
    if (targetNode == null || !track.keyframes.length) continue;
    const inputValues = new Float32Array(track.keyframes.map((key) => key.time));
    const outputWidth = track.channel === 'rotation' ? 4 : 3;
    const outputValues = new Float32Array(track.keyframes.length * outputWidth);
    const bindTranslation = rig.jointMap.get(track.jointId)?.localPosition || [0, 0, 0];
    track.keyframes.forEach((key, keyIndex) => {
      const value = track.channel === 'position'
        ? key.value.map((component, componentIndex) => Number(component) + Number(bindTranslation[componentIndex] || 0))
        : key.value;
      for (let component = 0; component < outputWidth; component += 1) {
        outputValues[keyIndex * outputWidth + component] = Number(value[component] || 0);
      }
    });

    const inputAccessor = addAccessor(binary, bufferViews, accessors, inputValues, {
      type: 'SCALAR',
      count: inputValues.length,
      min: [Math.min(...inputValues)],
      max: [Math.max(...inputValues)],
    });
    const outputAccessor = addAccessor(binary, bufferViews, accessors, outputValues, {
      type: track.channel === 'rotation' ? 'VEC4' : 'VEC3',
      count: track.keyframes.length,
    });
    const samplerIndex = samplers.length;
    samplers.push({
      input: inputAccessor,
      output: outputAccessor,
      interpolation: 'LINEAR',
    });
    channels.push({
      sampler: samplerIndex,
      target: {
        node: targetNode,
        path: track.channel === 'rotation' ? 'rotation' : 'translation',
      },
      extras: {
        track_id: track.trackId,
        joint_id: track.jointId,
        source_interpolation: track.interpolation,
      },
    });
  }

  const gltf = {
    asset: { version: '2.0', generator },
    scene: 0,
    scenes: [{ name: 'Humanoid Animation Skeleton', nodes: [nodeIndex.get('root') ?? 0] }],
    nodes,
    animations: [{
      name: clip.name,
      samplers,
      channels,
      extras: {
        schema: 'humanoid_rig/motion_clip@1.0',
        clip_id: clip.clipId,
        clip_revision: clip.clipRevision,
        compatible_rig: clip.compatibleRig,
        source_proportion_revision: clip.sourceProportionRevision,
        loop_mode: clip.loopMode,
        root_motion_mode: clip.rootMotionMode,
        events: structuredClone(clip.events),
        contacts: structuredClone(clip.contacts),
        retarget_policy: structuredClone(clip.retargetPolicy),
      },
    }],
    buffers: [{ byteLength: binary.byteLength }],
    bufferViews,
    accessors,
    extras: {
      humanoid_rig_lab: {
        rig_version: rigVersion,
        body_profile: structuredClone(rig.bodyProfile),
        skeleton_profile: 'smpl24_controls28@1',
        mesh_included: false,
      },
    },
  };

  return {
    glb: packGlb(gltf, binary.toUint8Array()),
    json: gltf,
    report: {
      nodeCount: nodes.length,
      trackCount: channels.length,
      duration: clip.duration,
      binaryByteLength: binary.byteLength,
      meshIncluded: false,
    },
  };
}

export function parseGlbHeader(bufferInput) {
  const bytes = bufferInput instanceof Uint8Array ? bufferInput : new Uint8Array(bufferInput);
  if (bytes.byteLength < 20) throw new Error('GLB is too small.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  const version = view.getUint32(4, true);
  const length = view.getUint32(8, true);
  if (magic !== GLB_MAGIC) throw new Error('Invalid GLB magic.');
  if (version !== GLB_VERSION) throw new Error(`Unsupported GLB version ${version}.`);
  if (length !== bytes.byteLength) throw new Error('GLB length header does not match the buffer.');
  const jsonLength = view.getUint32(12, true);
  const jsonType = view.getUint32(16, true);
  if (jsonType !== JSON_CHUNK_TYPE) throw new Error('First GLB chunk is not JSON.');
  const jsonBytes = bytes.subarray(20, 20 + jsonLength);
  const json = JSON.parse(new TextDecoder().decode(jsonBytes).trim());
  return { magic, version, length, jsonLength, json };
}

function addAccessor(binary, bufferViews, accessors, values, {
  type,
  count,
  min = undefined,
  max = undefined,
} = {}) {
  const byteOffset = binary.append(values);
  const bufferViewIndex = bufferViews.length;
  bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: values.byteLength,
  });
  const accessorIndex = accessors.length;
  accessors.push({
    bufferView: bufferViewIndex,
    byteOffset: 0,
    componentType: FLOAT_COMPONENT_TYPE,
    count,
    type,
    ...(min ? { min } : {}),
    ...(max ? { max } : {}),
  });
  return accessorIndex;
}

function packGlb(json, binaryBytes) {
  const encoder = new TextEncoder();
  const jsonRaw = encoder.encode(JSON.stringify(json));
  const jsonLength = align4(jsonRaw.byteLength);
  const binaryLength = align4(binaryBytes.byteLength);
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, GLB_VERSION, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, JSON_CHUNK_TYPE, true);
  output.fill(0x20, 20, 20 + jsonLength);
  output.set(jsonRaw, 20);
  const binHeader = 20 + jsonLength;
  view.setUint32(binHeader, binaryLength, true);
  view.setUint32(binHeader + 4, BIN_CHUNK_TYPE, true);
  output.set(binaryBytes, binHeader + 8);
  return output;
}

class BinaryBuilder {
  constructor() {
    this.chunks = [];
    this.byteLength = 0;
  }

  append(typedArray) {
    const aligned = align4(this.byteLength);
    if (aligned > this.byteLength) {
      this.chunks.push(new Uint8Array(aligned - this.byteLength));
      this.byteLength = aligned;
    }
    const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const copy = new Uint8Array(bytes);
    const offset = this.byteLength;
    this.chunks.push(copy);
    this.byteLength += copy.byteLength;
    return offset;
  }

  toUint8Array() {
    const output = new Uint8Array(this.byteLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }
}

function align4(value) {
  return (value + 3) & ~3;
}
