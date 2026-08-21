# Humanoid Stability Fix v001

Date: 2026-08-21

## Integration summary

This final integration combines the Character Studio v1 baseline, Face Expression, Animation Asset Metadata and semantic channels, jointAxes Runtime, complete static pose chains, extended skin deformation, pose correctives, the experimental DQS reference renderer, and the Character Studio Animation Library.

Conflict decisions:

- Kept one Character Studio sidebar and one ProjectHub/CharacterProfile write path.
- Kept the newer semantic three-track right-arm wave instead of the obsolete four-track test expectation.
- Kept Pose presets in V8 and out of Animation Runtime.
- Kept Three.js GPU LBS as the default and DQS disabled as an independent experiment.
- Updated CharacterProfile export/manifest contracts from schema 1.4 to the current 1.5.
- Kept manual animation preview in direct clip mode so it cannot fall back through the animation graph.

## Main files

- `apps/character-studio/animation-library.js`
- `apps/character-studio/panels/animation-panel.js`
- `apps/character-studio/character-studio-controller.js`
- `packages/face-system/`
- `src/modules/animation/asset-metadata.js`
- `src/modules/animation/runtime.js`
- `legacy/v8/src/skeleton-presets.js`
- `legacy/v8/src/physics-rig.js`
- `legacy/v8/src/smpl-skin.js`
- `legacy/v8/src/experimental-dqs-renderer.js`

## Test result

`npm test`: PASS.

The suite covers 143 required files; Character Core and schema migrations; all nine Character Studio panels; multi-window state synchronization; metadata, semantic channels, mirror and legacy AnimationClip playback; 89-node joint axes and static poses; GLB skin attributes and inverse binds; finger deformation; corrective non-accumulation and bind restoration; and the disabled-by-default DQS reference path.

## Known limits

- Visual browser inspection was intentionally not performed; repository instructions assign that check to the user.
- DQS is experimental and does not enter the default Character Studio renderer.
- Extended finger weights are deterministic runtime-derived weights; a future authored high-resolution finger-weight asset can improve fine hand deformation.
- Run, Jump and Combat categories are present in the Animation Library but currently have no dedicated production clips unless imported.
- Pose correctives are sparse analytic fields, not an artist-authored SMPL pose-blend-shape asset.

## Next recommended assets

1. Add authored Run, Jump and Combat clips with contacts and quality metadata.
2. Add a dedicated finger-weighted production GLB.
3. Capture user-reviewed screenshots for T Pose, finger articulation, joint dragging and walk playback.
