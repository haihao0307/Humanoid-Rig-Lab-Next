# Human Core V5 Procedural Deform Visual Failure Analysis

## Audit boundary

This report records the failure baseline for task 14C before implementation.

- Exact code baseline: `fb7544a19f1869cf763b2d436542e96f2d0c9aba`
- Target branch: `feature/human-core-v5-procedural-deform-visual-repair-v2`
- Referenced GitHub Actions run: `32827622989`
- Referenced artifact: `9555667580`
- Referenced artifact digest: `dbc8226ec33a56277bd766665e7f53abf756ecd9599783c924ce64ed1b7aefcd`
- Baseline contract: WebGL2 pass, WebGPU fail, user visual acceptance fail

The exact CI artifact could not be downloaded in this environment because the available GitHub credential is not exposed to commands. A later local evidence directory with the same screenshot names exists in another worktree, but its timestamps and renderer metadata prove that it is not artifact `9555667580`; it is not treated as the CI baseline.

Per the repository operator rule, Codex did not open or subjectively inspect PNG files. The symptom column below is therefore a registration of the task-provided failure evidence, not a new visual claim. Final image review remains the user's responsibility.

## Source-level failure map

| Failure class | Confirmed source location | Code-level cause to verify/fix |
| --- | --- | --- |
| Full-body triangle striping | `src/modules/human-core-v5/procedural-deform/surface-extractor-v5.js` (`polygonizeTetra`, extraction finalization) | Tetrahedra emit locally wound triangles, but no shared-edge propagation or outward component orientation runs before normals are generated. |
| Incorrect normals after deformation | `src/modules/human-core-v5/procedural-deform/procedural-deform-runtime-v5.js` (`update`, `applyPreparedLocalImplicitCorrection`) | DQS normals are retained after local position correction changes the final surface. |
| Back faces visible as ordinary surface | `src/renderers/three/three-procedural-human-adapter-v5.js` (constructor material) | The normal material uses `THREE.DoubleSide`, hiding winding faults instead of rejecting them. |
| Shoulder/armpit dent and sharp bridge | `src/modules/human-core-v5/procedural-deform/body-field-definition-v5.js` (`createCanonicalRegions`, `createAnatomicalSubtractions`) and `anatomical-field-composition-v5.js` (`junctionRadius`) | Shoulder is a torso/upper-arm union plus an axilla subtraction; there is no deform-only deltoid, clavicle, axillary bridge, or scapular field. |
| Forearm twist collapse | `src/modules/human-core-v5/procedural-deform/procedural-deform-runtime-v5.js` (`deriveRegionTransforms`, DQS update) and `surface-region-binding-v5.js` | The lower arm is treated as one rigid deform region and vertices do not retain elbow-to-wrist axial coordinate `u`. |
| Elbow layering | `procedural-deform-runtime-v5.js` (`applyPreparedLocalImplicitCorrection`) and `region-deformation-driver-v5.js` | Correction is radial scale/compression only; it does not preserve outer bend arc length or separate the inner bend surfaces. |
| Hip squeeze and groin fusion | `body-field-definition-v5.js` (`createCanonicalRegions`, `createAnatomicalSubtractions`) and `procedural-deform-runtime-v5.js` | Pelvis/thigh union and bilateral groin relief are static; no bend-aware hip field protects left/right separation under flexion. |
| Hard knee fold | `procedural-deform-runtime-v5.js` and `region-deformation-driver-v5.js` | The knee has no front-arc/back-compression corrective field and no local foldover gate. |
| Floating squat/lunge feet | `procedural-deform-validation-poses-v5.js` (`createProceduralDeformValidationPoseV5`) | Static fixtures rotate joints but do not compile a root/contact solution; returned contacts are empty. |
| WebGPU empty canvas/device error | `apps/human-core-v5-procedural-deform/index.js` (`createRenderer`) | The page requests an adapter and an extra device before Three.js creates its own renderer/device. |
| WebGPU mapped buffer range error | `src/renderers/three/three-procedural-human-adapter-v5.js` (`update`) | Attributes are created/replaced without an explicit dynamic upload contract or software-adapter chunk fallback. |
| Missing screenshot content gate | `scripts/run-procedural-deform-browser-qa.mjs` (`runBackend`, evidence finalization) | Screenshots are hashed as files but foreground occupancy, bounding box, silhouette, perceptual hash, and cross-backend IoU are not measured. |

## Screenshot registration

### WebGL2 baseline screenshots

These entries use the screenshot names present in the baseline-compatible evidence layout. Symptoms are the task-provided failures associated with each view.

| Screenshot | Registered failure evidence | Primary source mapping |
| --- | --- | --- |
| `webgl2/reference-front.png` | Full-body triangle striping; pelvis/groin fusion | Surface winding; pelvis/thigh field composition |
| `webgl2/reference-back.png` | Full-body triangle striping; shoulder-back discontinuity | Surface winding; missing scapular back field |
| `webgl2/t-pose-front.png` | Shoulder line discontinuity and axilla dent | Shoulder field union and axilla subtraction |
| `webgl2/arm-raise-90-front.png` | Shoulder/armpit cavity | Missing shoulder corrective fields |
| `webgl2/arm-raise-150-front.png` | Sharp shoulder connection and possible upper-arm separation | Missing deltoid/clavicle/axillary bridge fields |
| `webgl2/forearm-twist-closeup.png` | Forearm collapse and dark cavity | Single rigid lower-arm region; no continuous twist coordinate |
| `webgl2/elbow-bend-closeup.png` | Elbow surface layering | No bend-aware inner/outer elbow correction |
| `webgl2/hip-flex-side.png` | Hip squeeze and sharp groin crease | Static pelvis/thigh union and groin subtraction |
| `webgl2/knee-bend-side.png` | Hard knee fold | No knee front-arc/back-compression correction |
| `webgl2/squat-front.png` | Feet not grounded; hip/groin compression | Validation fixture has no contact/root solution; hip correction absent |
| `webgl2/squat-side.png` | Feet not grounded | Validation fixture has no contact/root solution |
| `webgl2/lunge-front.png` | Front/rear contact not established | Validation fixture has no contact/root solution |
| `webgl2/lean-front.png` | Triangle striping remains across a thin body | Surface winding/normals |
| `webgl2/muscular-front.png` | Triangle striping and shoulder bridge remain at larger volume | Surface winding; shoulder field composition |
| `webgl2/heavy-front.png` | Triangle striping and pelvis blending remain at larger volume | Surface winding; pelvis/thigh field composition |
| `webgl2/tall-front.png` | Triangle striping across changed proportions | Surface winding/normals; deterministic fairing absent |
| `webgl2/short-front.png` | Triangle striping across changed proportions | Surface winding/normals; deterministic fairing absent |
| `webgl2/asymmetric-front.png` | Surface defects remain under independent left/right scaling | Winding plus non-independent shoulder correction |

### WebGPU baseline screenshots

The exact CI run reported an empty canvas with a dropped device/error scope and an oversized `mappedAtCreation` buffer. Every listed WebGPU image is therefore registered as “human not proven visible” until pixel-content gates pass.

| Screenshot | Registered failure evidence | Primary source mapping |
| --- | --- | --- |
| `webgpu/reference-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/reference-side.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/t-pose-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/arm-raise-90-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/arm-raise-150-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/forearm-twist-closeup.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/elbow-bend-closeup.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/squat-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/squat-side.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/lunge-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |
| `webgpu/asymmetric-front.png` | Empty/unproven foreground | Duplicate device request; buffer upload path |

## Repair order and non-negotiable gates

1. Orient every closed connected component outward and regenerate canonical normals.
2. Fair only the canonical surface, project it back to the zero set, and bump the generator/cache version.
3. Recompute area-weighted normals after all runtime position corrections.
4. Add objective flip, area-ratio, foldover, critical-region intersection, and normal-discontinuity diagnostics.
5. Add deform-only shoulder fields, continuous forearm twist, and bend-aware elbow/hip/knee corrections without adding rig joints.
6. Compile squat/lunge validation fixtures with explicit root/contact evidence.
7. Remove the extra WebGPU device and keep dynamic attribute capacity stable; chunk only in the renderer adapter when required.
8. Fail browser evidence when screenshot foreground/silhouette gates fail.

## Post-baseline WebGPU topology-lifecycle finding

GitHub Actions run `32854645300` proved that the original oversized mapped buffer was no longer the first blocker: the forced WebGL2 matrix completed all 21 captures, while SwiftShader WebGPU failed when the QA sequence changed BodyDNA topology from one preset to the next. The precise stack ended in `WebGPUAttributeUtils.destroyAttribute()` after `ChunkedProceduralHumanAdapterV5.replaceTopology()` called `BufferGeometry.dispose()` during the live render session. Three.js r185 assumes a frontend attribute record always owns a created backend buffer; that assumption is unsafe while WebGPU render-object and buffer state are being replaced.

The renderer-only repair keeps Core surface topology independent and changes the software adapter to a fixed-capacity chunk pool:

- topology changes rewrite existing position, normal, color, local-index arrays and `drawRange`;
- unused chunks are hidden and retained for later reuse;
- existing `BufferGeometry` and `BufferAttribute` objects are not disposed or replaced during runtime topology changes;
- local indices use native `Uint32Array`, preventing Three.js from silently expanding `Uint16Array` buffers after the 48 KiB safety calculation;
- final adapter teardown still owns explicit disposal, but preset and slider edits do not enter the disposal path.

The regression contract records zero runtime geometry-dispose events across compact and expanded topology replacements. Browser/WebGPU acceptance remains pending a clean CI rerun and does not change `visualAcceptance=false` or `productionReady=false`.

## CI generation-timing follow-up

GitHub Actions run `32858618180` reached the complete file/data suite but stopped before browser QA because one-time medium canonical-surface extraction measured 3022.85 ms on the shared runner, 22.85 ms over an extra 3000 ms wall-clock assertion. Task 14C defines hard Node performance gates for steady-state deformation (`median < 5 ms`, `P95 < 8 ms`) and explicitly excludes surface generation from browser steady-state timing. Canonical extraction remains worker-eligible and its actual duration remains recorded, while correctness no longer depends on shared-runner speed. Geometry, orientation, self-intersection, contact, angle, and deformation-performance gates are unchanged.

No item in this report changes `visualAcceptance=false`, `productionReady=false`, or the requirement for explicit user visual review.

## Auxiliary-preview WebGPU lifecycle follow-up

GitHub Actions run `32860135235` passed the complete file/data suite and all 21 forced-WebGL2 captures, but SwiftShader WebGPU failed after the renderer-only human-surface chunk pool had already removed itself from the error stack. The new precise stack ended in `WebGPUAttributeUtils.destroyAttribute()` after the page-level `disposeGroupChildren()` destroyed SimulationRig preview geometry during a pose update. The same disposal pattern also existed in procedural-anchor and field-primitive previews, so fixing only the first stack site would have exposed the next one.

The page-level repair now treats all auxiliary previews as renderer-owned live resources:

- SimulationRig segments, SimulationRig joints, and procedural anchors use fixed-capacity `Float32Array`/`BufferAttribute` objects configured with `DynamicDrawUsage` before first render;
- pose changes update existing arrays, update ranges, and draw ranges without replacing or disposing geometry;
- field primitives share one sphere geometry and four cached materials, while a persistent mesh pool grows only within an explicit fixed capacity and hides unused entries;
- QA diagnostics expose active/capacity counts and record zero runtime geometry-dispose operations.

This removes the known auxiliary-preview `BufferGeometry.dispose()` path without changing Core surface topology, PoseFrame semantics, Rig hierarchy, or the task status. WebGPU acceptance remains pending a clean CI rerun, and user visual acceptance remains pending.

## Auxiliary-preview mapped-creation follow-up

GitHub Actions run `32863341767` confirmed that the `destroyAttribute()` lifecycle failure was removed: WebGPU completed the preset, pose, display, camera, and all 13 screenshot actions. The next reported buffer error named the stable SimulationRig line preview's 6144-byte mapped-at-creation position buffer. This was initially interpreted as a capacity problem because the pool was larger than the actual 89-node-class preview requires; run `32865619476` later showed that interpretation was incorrect and that device loss had to be diagnosed first.

The stable-resource design remains in place, and auxiliary capacities are bounded to the actual semantic contract: 256 line vertices (128 segments), 128 joint vertices, and 128 procedural anchors. Their largest position buffer is 3072 bytes. At this point that size was provisionally treated as the likely blocker; the next CI run disproved that interpretation.

This follow-up does not weaken screenshot, silhouette, geometry, contact, or performance gates. `visualAcceptance=false`, `productionReady=false`, and explicit user visual review remain required.

## WebGPU adapter-selection correction

GitHub Actions run `32865619476` failed with the same `mappedAtCreation` message after the largest auxiliary position buffer was reduced from 6144 to 3072 bytes. The device was reported destroyed about 25 ms after runtime readiness. Chromium emits the “size is too large” `RangeError` whenever Dawn returns no mapped-at-creation buffer; the message is therefore not evidence that 3072 bytes exceeds a WebGPU limit. The temporary 4096-byte ceiling was removed rather than preserving a false hardware contract.

The deterministic CI path now follows Chromium's own WebGPU SwiftShader test configuration instead of merely enabling an unspecified WebGPU adapter. It explicitly selects `--use-webgpu-adapter=swiftshader`, enables GPU initialization for tests, and records the exact launch arguments with the renderer diagnostics. The application still owns no extra `GPUDevice`, the stable-resource and pooled-chunk paths remain unchanged, and the normal browser path continues to let Three.js select the user's real adapter.

## Pinned browser binary correction

GitHub Actions run `32868675265` proved that the SwiftShader adapter-selection flags were active: the renderer reported Google's fallback SwiftShader adapter and reached the runtime-ready state. The WebGPU device was then destroyed on the first render, before the later 3072-byte auxiliary-preview allocation error. That later error is therefore downstream evidence, not a valid buffer-size limit.

The same report exposed a separate reproducibility defect in the QA harness. Although the workflow installs the Chromium revision owned by pinned `playwright@1.62.1` and explicitly requests the `chromium` channel, candidate resolution selected `/usr/bin/chromium` first. The browser report consequently identified `System Chromium 151.0.7922.0`, not the installed Playwright browser. The runner now resolves the pinned Playwright Chromium before any same-channel system fallback. Chrome and Edge remain available when explicitly requested, and `--browser-path` remains the highest-priority override.

This change does not claim that the renderer defect is fixed. It restores the deterministic browser/runtime pairing required to decide whether the first-render device destruction belongs to application resource lifecycle or to the previously mismatched browser stack. WebGPU must still pass with visible, distinct screenshots and zero page/unhandled errors before its contract can be accepted. `visualAcceptance=false`, `productionReady=false`, and explicit user review remain unchanged.

## Renderer-owned adapter follow-up

GitHub Actions run `32871662057` used the pinned Playwright Chromium `151.0.7922.34` and still reproduced first-render device destruction. Runtime readiness was recorded at `2026-08-25T16:29:36.081Z`; the renderer-owned device reported `reason=destroyed` at `2026-08-25T16:29:36.124Z`, only 43 ms later. The subsequent 3072-byte mapped-at-creation failure is therefore downstream of device loss and is not treated as a buffer capacity limit.

The page previously requested one diagnostic `GPUAdapter` and then let Three.js request the renderer adapter/device. Although the page did not create an extra device, this left two independent adapter lifetimes in the same SwiftShader page and made the diagnostic probe an unnecessary variable in the first-render failure. The page now makes no direct `navigator.gpu.requestAdapter()` call. `WebGPURenderer` exclusively creates the production adapter/device, and adapter metadata is read from `webgpuRenderer.backend.adapter` after `init()`. This is an application lifecycle correction, not a claim that WebGPU has passed; CI must still prove a visible surface with zero page and rejection errors.

## Unified Three.js module follow-up

GitHub Actions run `32874219119` disproved the separate-diagnostic-adapter hypothesis. The pinned Chromium reached runtime readiness, then the renderer-owned device was destroyed 34 ms later. The same downstream 3072-byte mapped-at-creation error followed. Forced WebGL2 continued to pass its content and distinctness gates, while all 13 WebGPU captures remained empty. No direct page-level adapter/device request remained, so repeating adapter-lifecycle changes would not be evidence-based.

Source inspection then identified a concrete module-identity defect: the page mapped `three` to `three.module.js`, while `createRenderer()` dynamically imported `WebGPURenderer` from the independent `three.webgpu.js` build. Scene objects, geometry, materials, `OrbitControls`, and the renderer therefore did not share a single Three.js module instance. The repair maps `three` directly to `three.webgpu.js` and uses that same namespace for both the WebGPU backend and its built-in forced-WebGL2 backend. It removes the separate dynamic renderer import and direct `WebGLRenderer` context path. Renderer backend identity is now checked through `isWebGPUBackend` / `isWebGLBackend`; Three.js remains the sole owner of adapter and device creation.

This is one isolated source-grounded repair. Screenshot, silhouette, cross-backend, geometry, contact, and performance gates remain unchanged. It does not constitute visual acceptance: `userVisualAcceptance=pending`, `visualAcceptance=false`, and `productionReady=false` remain mandatory until the next single CI run and explicit user review.
