# Denim R02 — verified build receipt

## Identity and preservation

- Tested build: `e847f671808dc93c4590a0d71dfe859a327b1b1e`.
- Base: `f64eb3aaaedec738ae3d73661ea967713ede8e39` (R01).
- Branch: `experiment/denim-yarn-r02-20261010`; Draft PR #31, not merged.
- Changes are confined to new R02 files and its dedicated workflow; R01 and other workbenches are not replaced.
- Fixed public URL: https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/e847f671808dc93c4590a0d71dfe859a327b1b1e/denim-workshop/r02/index.html
- Standalone HTML: 41,722 bytes; SHA-256 `f1c64c1033e14fe602c97889ec451424e17a1eca794af7f2966a1a153739af71`.

## Actual implementation, not implied capabilities

R01 was shader relief on a cloth mesh, not explicit individual yarns. R02 creates a stable-ID, millimeter-scale continuous yarn graph from a weave draft: 238 warp yarns and 112 weft yarns, 350 total, with 26,656 intersections in the default approximately 100 x 72 mm swatch. Elliptical swept cross-sections and closed cut ends supply geometric yarn volume; nominal cloth thickness is 0.70 mm, a design parameter, not a laboratory measurement. The surface also has 2,100 sparse cut-edge fiber curves; internal cotton fibers are not all individually modeled.

Near views use explicit swept yarn geometry. Default and farther views use front/back color and normal captures generated from the same complete yarn graph, with mipmaps, anisotropic filtering, pixel-footprint suppression and bounded supersampling. These are runtime geometry-derived textures, not external photos, nor a separate invented far-distance weave. Rendering stops while idle. Internal structure inspection is a test facility, not a required user-facing microscopic view.

Four weave candidates and six finish candidates are available. Overall fading, exposed-warp abrasion and weft back-staining are separate controls. Finish coefficients are unmeasured artistic parameters, not Jeanologia industrial wash recipes. The gold stitch sample is geometric stitching illustration, not a complete lockstitch or seam solver. Cloth bending and slight animation remain presentation deformations, not a physical cloth simulation.

## Final machine evidence

Actions https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38029466390 completed successfully. Its triggering source commit is `68e7657662a50eac17c154423e61130bc8a70f78`; the build step fast-forwarded canonical output to the tested `e847f671...` commit before browser verification.

Artifact: `11661596631`, `denim-r02-yarn-browser-evidence`, 9,630,039 bytes. Archive SHA-256: `3004cc6a93495cf4ffadcb34abef1f9b49695b846d127b27eed7b2ab6235c9ea`. The archive was downloaded and its JSON evidence and public/mobile images inspected.

- Core tests: 2,843 assertions passed; all four draft candidates passed finite-data and crossing-order checks.
- Actual depth-tested GPU crossing-center raster: 26,656 checked, zero incorrect and zero ambiguous in the default flat-carrier fixture. This is NOT a proof of globally collision-free yarn surfaces or cloth self-collision.
- Actual `file://` standalone Chromium execution: passed; no HTTP runtime requests; no reported application errors; GL error zero.
- Actual fixed-public-HTTPS Chromium execution: passed; correct R02 version, finish changes, back view and folded-edge interaction checked; application errors empty and GL error zero.
- Local and public canvas hashes agree exactly for baseline, washed and back views; these three states differ from each other.
- Idle frame counters stayed unchanged: 48 to 48 locally, 6 to 6 publicly.
- Desktop viewport: 1440 x 1000. Software ANGLE/SwiftShader testing, not a physical-GPU performance certification.
- Mobile viewport: 390 x 844, not a real phone. Initial canvas bounds x=0, y=52, width=390, height=523.265625; canvas remains visible after selecting a finish and returning to the view. Error list empty.

The earlier mobile test only checked dimensions and missed a negative initial scroll position caused by reverse-column flex layout. Internal image review caught this. `mobile-first-look.css` fixes the scroll origin; the new test requires the entire initial cloth canvas to lie inside the viewport. The earlier screenshot is not presented as evidence that the first-look layout was correct.

## Anti-aliasing evidence and scope

Final CI controlled fixture: flat swatch, fixed light, eight camera phases spaced by 0.125 pixel, 160-pixel interior sample. Mean adjacent-frame RGB difference fell from 9.752245163690477 (own nearest level-0 baseline) to 2.6723511904761903 (filtered), a relative reduction of 72.5976%. This is a bounded regression comparison, not a claim of no moire/flicker under arbitrary motion, angle, display density or hardware. The manifest's earlier local 68.1% fixture result remains a separate local measurement.

## Cost and visual limitations

Default-view evidence records 81,120 submitted triangles and six draw calls. Close-range explicit yarn geometry and initial capture generation cost substantially more; default-view triangle counts must not be presented as worst-case costs. Render-target supersampling is capped at 2,400,000 pixels. Capture sizes are 1536 square on the desktop fixture and 1024 square on the mobile fixture. In the earlier successful CI run 38028821085, the first public draw recorded about 8.6 seconds of CPU wall time during cold initialization; subsequent CPU submission timings do not establish GPU time or frame rate. Hardware FPS, peak memory and phone thermals remain unverified.

Visual review: structural volume and crossing logic have improved, but yarn repetition is still conspicuous and the highlights/white-weft contrast remain too hard for the intended film-grade cotton character. Finish variation is not yet calibrated to an identified real swatch. Numerical checks do not promote this candidate to film-grade visual acceptance.

## Learning provenance and remaining gaps

Read the repository native weave-draft compiler and the owner's Human-Fabric-Workbench knitted-acrylic near/mid/far shader sections. Adopted stable-ID curve/draft organization, material-space anchoring and footprint-based suppression of unresolved patterns. The exact separate newer sweater yarn workbench referred to by the user was NOT definitively located, so this is not described as a complete migration of that system.

Disney's public curve-garment abstract was read; the full PDF and production implementation were not obtained. Jeanologia's public Digital Wash/eDesigner workflow was read, without obtaining proprietary solver code or process calibration. CottonWorks' denim construction, ring dye and finishing references informed the mechanism choices. Full references and precise boundaries are in SOURCES.md.

No claim of measured material mechanics, real industrial wash prediction, complete fiber scattering, cloth self-collision, body contact, Houdini equivalence or film-grade output. Export uses the new versioned `kaopu.denim_material_profile@2.0` graph in millimeters; other workbenches are not yet integrated and need an explicit adapter.

## Delivery gates

- [x] No generated image substitutes for the actual 3D workbench.
- [x] Production source and standalone interactive HTML actually changed.
- [x] Yarn geometry and material are generated by the actual runtime.
- [x] Camera, finish, weave, thickness and export controls are operational.
- [x] Fixed public link, real local-file browser and mobile first-look viewport verified.
- [ ] User visual acceptance remains pending.
- [ ] Film-grade and actual-phone acceptance remain pending.

Internal QA images are evidence only; screenshots without the workbench would not constitute delivery.
