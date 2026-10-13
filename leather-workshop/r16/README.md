# R16 rendering batch — verified and merged

Current status: S2C_BATCH_DELIVERED_AND_MERGED_USER_REVIEW_PENDING. Integration branch perf/leather-r10-input-20261011. PR70 merged as dc0b6e3832c1e4bf5356ef7e86322570c48e4d17; main and old R01–R15 remain unchanged. User requested coherent larger increments rather than per-function releases.

## Open the standalone public mirror

https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/0a9f4dad16f6005da9b0fa8b5e8040323d24d9df/leather-workshop/r16/public-lite.html

Runtime source43d7fde7bc6646032a2154fc25f800807b60a0c7; test observation correction50a0126b1e2c099c956bdab72b5461a0819f256a; immutable build0a9f4dad16f6005da9b0fa8b5e8040323d24d9df; receipt58f2d391a9dfb61baa16f3cafbd775e2814fe642. HTML3,632,731 bytes; SHA256e6ae062e2e6bdf0cca2630e8bb12895dd95db0c8a532609d541142ffb290f67a. It runs as a standalone file without a server.

## Integrated changes

WebGL2 integer texel reads preserve the same three-column nearest-filtered node data. Scene and thumbnail invalidation are separate, so card animation does not redraw an unchanged hero. One demand-driven animation-frame loop stops when settled. Completed real solver poses, camera/material/craft events, page lifecycle restoration and specimen resume wake the display. Explicit application composition and the bounded pose transport remain in use.

Normal build reads canonical R16 source only. Preparation is historical registration, not a production dependency. Native C/WASM and autonomous simulation pump are unchanged; no physical step, candidate, CCD, friction, timestep, iteration, geometry, material, wear, thickness, lighting, shadow or resolution is reduced.

## Verified evidence and failures retained

38362866018: CPU, basic browser and GPU lanes succeeded; the extended observation failed, so the entire run was not successful. 38363713867 corrected only the observation window and completed extended plus public browser gates using the same tested runtime bytes. DELIVERY.json records both provenance paths.

142 source gates,22 frame/address checks,18 numeric cases,25 geometry cases including six52-step trajectories,45 transport protocol checks and25 app interface cases.45 basic offline,47 extended and16 public browser checks passed. Tests include200 synchronous view commands,24 product rebuilds,26 material changes,12 craft changes, actual pointer cancellation, explicit lifecycle events and specimen pause/resume. Counts are nested, not additive.

Nine original static image pairs are pixel-identical. Two additional deformed pairs are exact; the deformed wallet meanRGB difference0.0049200492 and maximum channel difference4/255 remain inside the predefined tolerance. Do not claim all12 pairs are exact. Six controlled physical trajectories retain zero position difference.

The initial extended test assumed two thumbnail frames would complete within800ms. It now observes two actual draw events and records duration, with10s only as a deadlock bound. The measured duration was about3997ms; no performance threshold or production code was changed to hide that cost.

The recovery re-downloaded finalArtifact11796670440 and checked its ZIP digest, the HTML and10 report hashes, and12 original image pairs. See qa/render-batch/RECOVERY_20261013.json. That artifact recheck is not an additional local browser execution.

## Performance and scope

Demand rendering eliminates redundant work; it does not establish a general reduction of each active draw. Software Chrome ABBA GPU-query medians remain around509–523ms for the wallet and1767–1780ms for the bag. Do not market this as60fps or50ms mouse-to-screen latency. See PERFORMANCE_OBSERVATIONS.md. GPU query is not physical monitor latency;390x844 and explicit lifecycle events are not physical-device certification.

FullS2, real-material calibration, user visual acceptance and commercial legal clearance remain pending. Third-party attributions and archived rights issues have not been erased. R11 random field stays disabled; jacket remains removed.

Sources retained: https://threejs.org/manual/pages/rendering-on-demand.html ; https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query . Integer texel addressing is checked against generated node indices and actual render comparisons.

Recovery: Issue52 → ../START_HERE.md → ../TASK_STATE.json → DELIVERY.json → NEXT_BATCH.md. Do not restart completed S1/S2A/S2B/S2C from inherited task files.

- [x] Actual production source and procedural 3D/physics, not generated pictures or proxy meshes.
- [x] Interactive camera, selection, grab and parameter controls verified.
- [x] Offline standalone and immutable public browser verified; PR70 merged only to leather integration.
- [ ] User acceptance, physical-device performance, fullS2 and legal clearance remain independent open items.
