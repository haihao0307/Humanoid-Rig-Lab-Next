# ET04 — TalkingHead behavior on the existing ET03 head

本次在现有皮肤与眼睑网站中实际复用 TalkingHead 源码，不嵌入另一个网站，不替换成它的示例人物，也不以生成图片替代三维结果。

## Source and license

Upstream: https://github.com/met4citizen/TalkingHead

Pinned commit: `b3e277b3b46f88e557bf28a2c5612a5b04e075c3`, package version 1.7.0.

TalkingHead is MIT licensed, copyright (c) 2024 Mika Suominen. The full license and original source are preserved in `vendor/`. The existing Lee scan, MakeHuman eye data, Three.js and skin-rendering licenses remain in their original locations; the TalkingHead MIT license does not relabel those assets.

`extract-upstream.cjs` parses the reviewed upstream source and extracts 35 unchanged source blocks: eye/blink/mood templates, yes/no gestures, animation factory and evaluator, channel initialization, interpolation, channel priority and morph-value update functions. Each original source range and its SHA-256 is recorded in `vendor/EXTRACTION.json`.

The extracted code is a real runtime dependency of `BehaviorController.js`, not merely a README reference. Initialization and the semantic output wrapper are our adapter code. Unsupported full-body animation templates are filtered explicitly. The full TalkingHead class is not instantiated.

## Why not instantiate the full class here?

The current head has custom eye surfaces and no full Mixamo-compatible character rig or mouth/viseme shape set. Calling the full class would introduce unrelated avatar, audio, renderer and animation ownership. The present task concerns the eyes and head behavior. This integration therefore reuses the applicable original blocks and adapts their outputs to the current character, instead of manufacturing dummy visible body parts or replacing the head.

TalkingHead is not a geometry reconstruction tool. Its behavior code cannot recover this scanned person's unknown open-eye shape, create a high-resolution iris scan or remove the existing ET03 anatomical fitting limitations.

## Single-owner integration contract

The existing application owns the only canvas, WebGL renderer, camera, lights and requestAnimationFrame loop. The bundle contains one copy of the existing Three.js r180 core. `BehaviorController` owns no DOM, audio, camera, renderer, networking or frame callback.

The active update chain is:

`host delta seconds → TalkingHead delta milliseconds → semantic behavior channels → explicit user override → world-space gaze solve → ET03 eyelid contact → original renderer`

`IntegratedEyes` is the final writer. When TalkingHead is enabled, the old automatic eye update does not also run. When disabled, the head pivot returns to its original transform and ET03 resumes exclusive control. Repeated switching does not create new renderers or new head geometry.

World positions are metres in the existing right-handed Y-up coordinate system. The two eyeballs retain independent rotation centers. The original head, skin and eye group share a neck pivot; the target remains in world space, then is transformed into head space for the residual eye rotation and contact calculation. Head motion does not change skin UVs, original vertex data or bone scale.

Priority is explicit: manual closure overrides automatic blinking; a locked world target overrides autonomous attention changes; camera/pointer modes are not silently replaced by social gaze. Pupil size remains under the existing light-response or manual control. Native raw blink channels are mapped once; native applied eyelid-follow offsets are not added again to ET03's own gaze-dependent eyelid geometry.

Skin anatomical masks and pores continue to use local coordinates. Light-transport thickness sampling now uses a separate world-space varying so that rotating the head does not invalidate the inherited world-space illumination lookup.

## User controls

The new panel supports direct camera attention, natural observation, native single/double blinks and anatomical left/right winks, nod/shake templates, head-motion amount, eye-contact probability and bounded manual head rotation. Eye-state presets are labelled as eye behavior, not complete facial expressions or speech.

The original eye close-up, iris close-up, manual closure/squint, light-response pupil, iris palette, skin comparison and JSON recipe controls remain available.

`kaopu/talkinghead-behavior@1` is namespaced inside the existing `kaopu/eye-rig@1` recipe. Fixed targets are saved in world coordinates. Existing eye recipes without this namespace remain accepted. ET04 uses a separate local storage key and never overwrites the ET03 saved look.

## Explicit exclusions and remaining costs

No TTS service, microphone, API key, chat service, lip synchronization or additional character model is enabled. The runtime does not load speech worklets or the full upstream class. No new paid service was introduced.

This release adds behavior and module integration, not a new scan reconstruction. The ET03 eye corners, eyelid texture stretch and limited-resolution iris remain. High-resolution skin textures and multipass skin shading remain the main loading, graphics-memory and rendering costs. No real-phone frame rate is promised from a desktop SwiftShader viewport test.

## Rebuild and tests

After the generated source has been published, use `talkinghead/bundle.cjs` directly with an immutable `ASSET_COMMIT`. Do not replay historical ET01/ET02/ET03 reconstruction scripts over the accepted modules. `install.cjs` accepts only the pinned ET03 application hash or an already-installed ET04 application.

`test-kernel.mjs` tests the real upstream behavior independently. `qa.cjs` checks actual rendered output, head-motion target locking, declared eyelid contact samples, user override priority, driver switching, parameter persistence, retained skin comparison and mobile viewport controls. Public verification must be a separate invocation using the immutable published HTTPS URL, without a local server or network interception. Passing a sampled contact check is not a guarantee about every triangle in every possible pose.

The original fixed ET03 release remains:
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022/skin-quality-lab/emily-transfer/preview.html
