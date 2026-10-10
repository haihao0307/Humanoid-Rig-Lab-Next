# Denim R05.0 — verified candidate receipt

## Identity and protected baseline

Parent R04: `1f644eefce4282cf248653c999dedb4cfb9b9955`.
Final tested immutable build: `58b9f92f2457eb73f76e67d57a7a5b33d1d04d9e`.
Branch: `feature/denim-r05-fiber-studio-20261010`; Draft PR #38; not merged, no force push.

Fixed public entry:
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/58b9f92f2457eb73f76e67d57a7a5b33d1d04d9e/denim-workshop/r05/index.html

Standalone HTML: 72,927 bytes; SHA256 `f2de9b5567c49c8085e460baeddf4b3924dfe3f0e9e2db82489453c88868fc92`.
The final CI artifact HTML, locally assembled HTML and `/mnt/data/Denim_Material_Workbench_R05.html` were compared byte-for-byte and match.
Compare against R04 confirmed 20 added files at the tested build, zero deletions or changes to old files; all additions are R05 source/docs and its two dedicated workflows. Subsequent README correction and this receipt are documentation-only and do not change the tested HTML. R01–R04 and unrelated workbenches remain unchanged.

## Actual implementation

The new cloth response combines broad sheen, rough diffuse lighting, bounded approximate scattering and correlated staple/dye variation on actual yarn surfaces. Small packing-shape variation, three representative twisted outer curves per retained interval, and short rooted loop/flyaway curves supplement the inherited yarn body. Fine-curve ribbons are aligned with their tangent and viewing direction, with Gaussian coverage rather than opaque constant-width strokes. A final correction separates pale released cotton from the packed dark-blue body so white-weft bridges do not inherit the same dark wire-like response.

R04 two-ended sagging bridges, one-ended tails, partly retained thin yarns, outer-edge clumps and scattered strands remain. Their drapes are static authored curves with retained parent anchors, not stress-driven tearing or time-integrated gravity. Perspective, near/middle explicit woven geometry, the far-only intact capture rule and removal of the solid side wall remain. The twelve finishes, four drafts, four lights, five damage states, rolled-edge controls and direct `破口与线束` review button remain.

The background is now a ray-intersected gray floor and rear plane with lighting variation, cached yarn depth shadows and background-only distance haze. It is neither a flat black clear color nor a volumetric path-traced scene. Four samples approximate a soft key; fill and rim lighting provide separate directions. The shadow map is 1024 square for the desktop fixture and 768 square for the mobile viewport. Yarn bodies, loose-yarn tubes and optional stitches cast shadows; the map does not include every fine ribbon. Camera, exposure and haze changes reuse the shadow cache.

Export schema is `kaopu.denim_material_profile@2.3`, including millimeter geometry, cut intervals, retained anchors and studio/fiber settings. No external consumer was silently migrated.

## Research provenance

Both two-page user-specified papers were retrieved completely and their text and all figures inspected. The Animal Logic paper is SIGGRAPH 2018; its 2023 upload-directory date is not the publication date. Disney's is SIGGRAPH 2023. Exact PDF hashes and bounded implementation mappings are recorded in STUDY.md. No private production renderer, measured scattering parameters, full Disney toolchain, physical swatch or industrial wash calibration was obtained. The current scatter approximation is not the paper's Jensen dipole model.

## Final dedicated workflow

https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38042066931
Job `114184176641`; every step completed successfully.
Triggering source commit: `fa2bb63a041a414b7b68bcea7f9c0c541d442a4a`. The build step then published `58b9f92...` with a normal fast-forward push before opening that exact fixed public URL.

Artifact `11666373568`, name `denim-r05-fiber-studio-evidence`, 49,945,031 bytes.
Archive SHA256: `b5de7b3574d5c0f5335511319d1418d4577bb55f8c2c02d2517fa766811855bd`.
The artifact was downloaded; its hash, HTML, JSON, and actual public default/ragged and mobile screenshots were reviewed. Earlier studio runs were superseded by the pale released-fiber correction; their partial evidence is not used as final acceptance.

## Browser evidence actually observed

- Actual `file://` execution: 37 recorded states passed. Zero HTTP runtime requests, page exceptions, console errors and HTTP errors.
- Actual fixed public HTTPS execution: the same 37 states passed. All 37 corresponding local/public canvas PNG hashes match exactly; all recorded WebGL errors are zero.
- Twelve finish choices, four lighting choices and four weave choices each produce the corresponding number of distinct rendered hashes. Tests exercise their actual UI controls.
- Tests include exposure/haze controls, the new-fray review button, damage states, back/edge/roll/close views, middle/far representation rules, thickness/slub/fray changes and actual JSON download. Far damaged cloth remains geometric; near/middle cloth does not use the captured image carrier.
- Idle frame counter remains 41 to 41 for file and public runs.
- Desktop viewport: 1100 x 840. Rendering uses ANGLE/SwiftShader; this is not physical GPU performance certification.
- Mobile viewport: 390 x 844, not a real phone. Initial canvas x=0, y=52, width=390, height=523.265625. Initial visibility and selecting the fray review button passed. Mobile page/console/HTTP errors are empty, WebGL error is zero and the shadow map is 768 square.

The public desktop run recorded one exact preview-host favicon warning at `https://htmlpreview.github.io/favicon.ico` (404). It remains in the evidence under consoleErrors and previewHostWarnings; only this precise host-icon error is distinguished. No application resource error or page exception was hidden. The external preview host as a whole is not claimed to be console-message-free.

## Gray background and haze isolation

Four sampled background RGB values are [162,164,167], [157,160,163], [152,155,157] and [148,150,153], verifying gray spatial variation rather than a black clear.

With haze changed from 0 to 1, the controlled background patch mean RGB difference is 17.773125; the center patch including real gaps and translucent fibers changes by 0.6921296296. Of 14,314 selected blue-material pixels, 94.830236% remain exactly unchanged. This is consistent with background-only haze: fine openings and alpha coverage reveal changed background while the opaque cloth itself is not fog-shaded. It is not a proof that all foreground image pixels remain identical. Both local and public fixtures agree. Haze/exposure-only changes reuse the shadow cache.

## Generated fiber data and finite tests

104,449 assertions passed across four drafts and five damage modes. These include sampled unit tangents, buffer/index validity, deterministic curve roles, retained endpoint positions, mixed breakage and protected representation rules. Assertion count is not a visual quality score or global collision proof.

The default intact fixture has 350 parent yarns, 1,050 representative exterior curves, 11,500 surface/flyaway curves and 14,635 total fine curves including clumped/stray children. The default ragged fixture retains 26 two-ended bridges, 305 one-ended tails, 22 partly retained bridges, 141 outer clumps and 95 break guide groups. Its representative exterior/surface/total fine-curve counts are 1,620 / 9,232 / 14,636. The CPU release-guide audit covers 357 parent endpoints with a maximum numerical difference of about 7.1e-15 mm. These are generated data, not material measurements, and they do not prove full surface/tangent contact or physical collision validity.

## Cost and visual acceptance limits

Observed submitted triangle counts, excluding a separate shadow refresh unless explicitly listed:

| State | Main-view submitted triangles | Main-view draw calls |
| --- | ---: | ---: |
| Default intact | 2,713,404 | 7 |
| Close ragged review | 6,111,690 | 6 |
| Close fiber view | 4,411,228 | 6 |
| Very far intact | 392,316 | 6 |
| Very far damaged | 2,254,794 | 6 |

The ragged shadow refresh separately submits 2,739,552 triangles in three calls, only when invalidated. It is not incurred on every camera-only redraw. Counts describe submitted geometry, not visible fragments or FPS. Default fine-ribbon vertex/index buffers alone total 48,237,248 bytes; other buffers, render targets, JavaScript arrays and temporary build copies are additional. This is not a peak-memory reading. The approximately 2.4-million-pixel render-target cap, far intact sheath skipping and idle stopping remain. Physical GPU frame rates, actual phone heat, memory peaks and full-garment scalability are unverified.

Visual review confirms the gray-lit stage, visible spatial shading, geometric frayed silhouette and pale released weft response. It does not certify film-grade appearance: the main weave is still conspicuously regular, parts of the fine-curve layer remain too wire-like, and damaged silhouettes remain controlled. Cotton scattering is approximate. No claim of Houdini/Glimpse equivalence, measured fiber response, complete cotton-fiber modeling, dynamic tearing, global self-collision freedom or all-view no-moire is made.

## Delivery gates

- [x] Real generation/renderer source changed; no generated image substitutes for 3D.
- [x] User entry is a working interactive three-dimensional workbench.
- [x] Geometry comes from the actual runtime and retained yarn data.
- [x] Camera, choices and parameters actually operated in the browser.
- [x] Immutable public URL and standalone file browser verified.
- [x] Earlier versions and unrelated systems protected.
- [x] Viewport simulation is not misreported as real-phone validation.
- [ ] User visual and film-grade approval pending.
- [ ] Full mechanics, global collision and physical-device performance approval pending.

Internal screenshots are verification evidence only; screenshots without the standalone and public page would not constitute delivery. This receipt is documentation-only and does not alter the tested build.
