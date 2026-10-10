# Denim R05 — cotton fiber appearance in a gray studio

Parent: R04 `1f644eefce4282cf248653c999dedb4cfb9b9955`. R01–R04 and unrelated workbenches remain unchanged. This is a candidate for user review, not a main merge or film-grade certification.

## Verified entry

Tested build: `58b9f92f2457eb73f76e67d57a7a5b33d1d04d9e`.
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/58b9f92f2457eb73f76e67d57a7a5b33d1d04d9e/denim-workshop/r05/index.html

Standalone HTML: 72,927 bytes; SHA256 `f2de9b5567c49c8085e460baeddf4b3924dfe3f0e9e2db82489453c88868fc92`.
Dedicated Actions: https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38042066931 . Actual file:// and fixed public HTTPS each passed 37 recorded states. Full scope and remaining limitations are in VALIDATION_REPORT.md.

## Actual changes

The yarn surface combines broad cloth sheen, rough diffuse lighting, correlated dye/staple variation and small radial packing variation. Three representative twisted exterior curves follow each retained warp/weft interval. Short rooted loop/flyaway curves supplement them. Fine ribbons orient perpendicular to their own tangent and viewing direction, with Gaussian coverage rather than opaque strokes. This is partial fiber representation, not every constituent cotton fiber. The final appearance correction distinguishes pale released cotton from the packed dark-blue body.

R04 bridges, one-ended tails, thinned remnants, clumps and strays remain. The camera stays perspective. Near/middle views use explicit yarn geometry; only very small intact cloth can use its same-source far capture. The solid side wall is not restored; damaged cloth remains geometric at every distance.

The black backdrop is replaced with a ray-intersected gray floor/back-plane environment. Shading, actual yarn depth shadows and background-only distance haze provide spatial cues. Haze does not enter the cloth shader; fine gaps and translucent fiber coverage can reveal background changes. This is not volumetric path tracing. Four-sample key lighting, fill and rim replace the old response. A cached 1024-pixel desktop / 768-pixel mobile-viewport depth map includes yarns, loose-yarn tubes and optional stitches, not every fine ribbon.

All twelve finish candidates, four drafts, four lights, five distress choices and the `破口与线束` button remain. Two controls adjust studio exposure and background haze. Export `kaopu.denim_material_profile@2.3` preserves millimeter geometry and damage data while recording studio/fiber settings. No external consumer is silently migrated.

## Source study

Both two-page Animal Logic Weave and Disney curve-garment papers were read in full, including all figures. Exact provenance and implementation boundaries are in STUDY.md. Their proprietary production tools and measured material data were not obtained. Current scattering is a bounded real-time approximation, not Animal Logic's Jensen dipole. No real swatch or industrial wash calibration is claimed.

## Reproduction

From an unbootstrapped R05 directory, run `python3 prepare.py && python3 upgrade.py && python3 appearance.py && python3 build.py`. Bootstrap verifies the immutable R04 HTML and writes only R05. `appearance.py` is necessary to reproduce the final pale released-fiber correction.

Once canonical `core.js`, `natural-yarn.js`, `app.js` and `template.html` exist, edit those and run `python3 build.py`; do not rerun migration over subsequent edits. `cotton.glsl`, `studio.js` and `sheath.js` preserve initial module sources; build.py assembles the canonical files and does not independently re-inject those modules.

`node test-fiber.cjs` checks finite geometry, anchors, curve roles, tangent ribbons and protected policies across four drafts and five damage modes. `qa.py` opens the actual file and public build, checks gray pixels/haze isolation, controls, geometry levels, JSON export and a 390×844 viewport. `--content` is only a local authored-document test. Internal screenshots are evidence, not a substitute deliverable.

## Cost and remaining limitations

Default fine-ribbon vertex/index buffers occupy 48,237,248 bytes alone, excluding other buffers, framebuffers, JavaScript and temporary copies; this is not peak memory. Final default view submits 2,713,404 triangles; close ragged view submits 6,111,690. Shadow regeneration adds a separate geometry pass; camera/exposure/haze-only changes reuse it. Far intact cloth skips the exterior-sheath draw range. The approximately 2.4-million-pixel render-target budget and idle stopping remain.

Tests use software ANGLE/SwiftShader, not physical GPU or phone hardware. Actual FPS, thermals, peak memory and whole-garment scaling remain unverified. Visible weave repetition, some wire-like fine strands, controlled damage silhouettes and simplified scattering still prevent film-grade approval. No dynamic tearing, global collision freedom or all-view no-moire claim is made.

## Delivery gates

- [x] No generated image replaces real 3D; source and runtime-generated geometry changed.
- [x] Interactive camera, choices and parameters operated in the actual browser.
- [x] Existing versions and unrelated systems preserved.
- [x] Fixed public URL and actual file/public browser verified; see final receipt.
- [x] Mobile viewport is explicitly distinguished from physical-phone validation.
- [ ] User visual and film-grade acceptance pending.
- [ ] Physical GPU/phone, full physics and global collision validation pending.

Only screenshots without the working standalone/public workbench would not constitute delivery.
