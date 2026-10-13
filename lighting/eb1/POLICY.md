# EB1 — mandatory shared lighting contract

Authority: explicit user instruction, 2026-10-13, 人物 project. Learn the lighting methods of https://lo-th.github.io/head/ and implement an owned, adjustable system called EB1.

## Permanent scope

The knit/sweater, leather, denim, garment/tailor, shoe and hat workbenches MUST use EB1 by default in their new iterations. They MUST NOT silently restore legacy lighting or substitute a different system unless the user explicitly instructs a replacement. EB1 parameter adjustments remain within EB1 and must be saved/versioned. This policy is a requirement, not a claim that integration or visual acceptance is already complete.

## One authority, not six independently edited copies

Use one versioned EB1 profile/schema and common numerical core, with thin rendering-engine adapters. Bundled copies must have the same recorded source digest. A material preset, model change, geometry rebuild, action playback, archive import, context restoration or page reload must not overwrite the selected EB1 profile. Verify this in browser tests. Preserve legacy archives' non-lighting fields; document light migration. Historical frozen URLs are comparison archives, not exceptions for new versions.

## Preservation

Only the lighting/view pipeline may change in this task. Do not replace the native material, textures, yarn geometry, leather grain, seam construction, hat/shoe shape, physical solver, simulation parameters, human skeleton or action data to make a screenshot resemble the reference. Scene size and coordinate-frame adapters are explicit; do not assume all workbenches share units or shaders. Show actual WebGL/WebGPU evidence, not generated images.

## Source and licensing boundary

Reference audit is pinned to lo-th/head@21462e471d53ba8c413a96989016510ca4495a34. Its README describes custom textures, Three.js TSL, MeshSSSNodeMaterial and post-processing. Study lighting separately from those skin-specific materials. Do not copy the third-party application bundle, head model, skin textures or HDR assets into the delivered product without verified permission. Merely changing constants is not an owned reimplementation. Retain notices for any reused permissively licensed engine/math code; do not relicense older workbench assets or change the root LICENSE.

## Delivery and ongoing work

Keep old versions and active specialist branches untouched. Work in isolated branches; only fast-forward commits, Draft PRs, no merge or force push. Record exact upstream source/build revisions, adapter changes, profile digest, verified URLs and remaining limitations. A queued workflow, posted handoff or HTTP 200 is not completed integration. Require real rendered content, lighting response, preserved interactions and exact public bytes. Distinguish desktop software-renderer/viewport checks from physical mobile and consumer-GPU performance tests. If a required site is not verified, say 交付未完成 for that scope.
