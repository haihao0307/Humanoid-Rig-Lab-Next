# Denim R06 — layered cotton scattering candidate

Parent R05: `cca5466b1e58b09a9a5c1ce75ea47ee142eafbcb`. R01–R05 and unrelated workbenches remain unchanged. Branch `feature/denim-r06-layered-scatter-20261010`, Draft PR #39, no main merge or force push.

## Verified entry

Tested build: `f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3`.
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3/denim-workshop/r06/index.html

Standalone HTML: 80,416 bytes; SHA256 `ec4a548a9486e25be2838614cb3bf369590008cb1d85864c80647da3cbb83498`.
Actual file:// and fixed-public-HTTPS browser checks each passed 42 recorded states; the corresponding canvas hashes match. Dedicated Actions: https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38045137467 . Complete evidence and limits are in VALIDATION_REPORT.md. Later documentation commits do not alter this fixed build.

## Actual source changes

The optical response separates surface reflection, approximate local yarn-bundle diffusion and diameter-dependent thin-fiber transmission. `fiber-optics.js` integrates a Jensen radial dipole profile over four annuli. `scattering.glsl` uses a bounded center/longitudinal-neighbor approximation, not a complete measured BSSRDF, Glimpse renderer or physical cotton fit. Coefficients remain explicit unmeasured candidates. New controls are `束内柔散射` and `细纤维透光`, with a fifth `纤维逆光` inspection light. The original four lights remain.

Material radiance and transparent-fiber coverage are composited linearly before one final tone map. RGBA16F is used where supported; RGBA8 remains a limited dynamic-range fallback. Successful default rendering with a locally forced extension-off capability does not establish all-device equivalence.

The former uninterrupted outer helices are now finite, phase/length-varied staple segments whose radial position enters/exits the parent yarn. Visible segments are not claims about full cotton-fiber length. Surface flyaways are fewer/finer. A shared smooth material-coordinate field binds yarn bodies, seams and rooted frays together while preserving yarn IDs and the interlacing draft. Its analytic Jacobian is checked numerically, but there is no global collision proof. The underlying periodic draft is still periodic.

An asymmetric contour is scanned into true cut intervals. The existing two-ended bridges, single-ended tails, partially retained yarns and clumped/stray fray remain. They are static authored damage, not force-driven ripping. Gray spatial studio, background-only haze, perspective, near/mid explicit geometry, far-only intact capture, no solid side wall, twelve finish candidates, four weave drafts and five damage choices remain. Export `kaopu.denim_material_profile@2.4` records optical assumptions, geometry and damage; no external consumer is silently migrated.

## Reproduction

Initial bootstrap: `python3 upgrade.py && python3 build.py`. Migration checks the frozen R05 HTML hash `f2de9b5567c49c8085e460baeddf4b3924dfe3f0e9e2db82489453c88868fc92` and creates R06 canonical core.js, natural-yarn.js, app.js and template.html. Thereafter edit those and rebuild with build.py; do not rerun migration over later work. The optical and shared-field JavaScript modules are directly assembled by build.py. Initial scattering.glsl is injected by upgrade.py; subsequent canonical shader edits belong in app.js.

`node test-layers.cjs` verifies finite-support profile quadrature, analytic material-field derivatives, anchored curves, sampled unit tangents, indices and protected representation rules. `qa.py` exercises actual file/public rendering and controls. `--content` means authored-document only; local Chromium file navigation was policy-blocked, so actual file:// evidence comes from GitHub Actions.

Both user-specified PDFs were revisited in full, including all figures. STUDY.md records their mechanisms, hashes, supplementary primary research and precise implementation limitations. Source reading and numerical checks do not certify film-grade appearance.

## Costs and remaining defects

Default main view submits 2,373,380 triangles; close ragged view 5,964,682. Fine-ribbon buffers are 35,644,080 bytes versus R05's recorded 48,237,248, but HDR increases color-target memory; this is not an equivalent total/peak-memory saving. Shadow regeneration is an additional geometry pass. Pixel budget, far-distance representation and idle stopping remain. Tests use software ANGLE/SwiftShader, not physical GPU/phone hardware.

Actual close-up still exposes smooth tubular yarn bodies, regular packing and incomplete integration of surface staples with the yarn bulk. Some frayed ends remain too line-like; the hole contour is visibly authored. No full BSSRDF, measured material/wash calibration, dynamic tearing, global self-collision guarantee, universal no-moire result or whole-garment performance claim is made.

## Delivery gates

- [x] Real generation and renderer source changed; no generated-image substitute.
- [x] Standalone interactive HTML and fixed public page tested in actual browsers.
- [x] Runtime geometry, camera, selection and parameters actually exercised.
- [x] Old versions and unrelated systems preserved.
- [x] Mobile 390×844 viewport explicitly distinguished from real-phone testing.
- [ ] User visual and film-grade approval pending.
- [ ] Measured optics, full mechanics, global collision and hardware performance pending.

Internal screenshots are evidence only; a screenshot without the working workbench does not constitute delivery.
