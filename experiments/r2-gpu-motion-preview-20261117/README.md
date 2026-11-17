# R2 GPU Motion Preview · 2026-11-17

This is a separate, self-contained HTML preview. It does not modify the formal main runtime or replace the 2026-11-15 gray-motion research snapshot.

## Preview scope

- One live copy of the formal R2 character is loaded. The default second mother-copy and four authored comparison NPCs are skipped in this preview only; the formal source remains unchanged.
- Hair generation is retained. The face-review mode is not used.
- Real-time shadows default to off for the motion preview so software and integrated renderers are not forced into an expensive second full-character pass. The existing character-panel shadow toggle remains available.
- The formal 128-joint rig, eight uint16 skinning weights per binding root, and existing GPU dual-quaternion skinning shader (DQS) are reused.
- The formal R2 body function parameters, topology, binding, and Worker are bundled into the standalone HTML. No baked display vertices or triangle-index cache is added.
- Walk, sit, lie, stand, wave, and salute are submitted through the formal JarvisEmbodimentLab / MotionLab command interface.

## Measurements

The panel reads the live R2 runtime FPS, GPU timer, render CPU, draw calls, triangle count, and geometry-buffer measurements. GPU timer unsupported states are reported as unsupported, not estimated. CI uses Chrome/SwiftShader, so its FPS is not a hardware performance benchmark.

## Acceptance boundaries

- The first browser run exposed a serious preview-only loading mistake: it inherited the full default population setup (mother-copy plus four comparison NPCs). The standalone preview now bypasses those extra actors while preserving the original R2 character and hair. CI asserts the population contains exactly one actor.
- The gray research branch's separate 104-joint candidate has not yet been retargeted to the 128-joint R2 rig. No external gray motion is claimed as integrated.
- R7 still records shoulder/axilla posed-surface folding. This preview does not pass skin visual acceptance and must not be frozen as a production NPC.
- The browser smoke must pass real body/brain startup and complete four action tasks before the generated HTML is committed. A failed browser smoke fails the workflow.

Open `index.html` directly in a modern Chromium browser.
