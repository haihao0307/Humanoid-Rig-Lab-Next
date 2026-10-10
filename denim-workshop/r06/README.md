# Denim R06 — layered cotton scattering candidate

Parent: R05 `cca5466b1e58b09a9a5c1ce75ea47ee142eafbcb`. The frozen parent HTML hash is `f2de9b5567c49c8085e460baeddf4b3924dfe3f0e9e2db82489453c88868fc92`. R01–R05 and unrelated workbenches remain unchanged. Work is isolated on `feature/denim-r06-layered-scatter-20261010`; no main merge or force push.

## Actual changes

The fiber appearance is divided into surface reflection, local yarn-bundle diffusion and finite-thickness transmission. `fiber-optics.js` numerically integrates a Jensen radial dipole profile in millimeters. `scattering.glsl` uses a bounded three-tap longitudinal approximation, not a full measured BSSRDF or production path tracer. Diameter-dependent attenuation distinguishes thick yarn bodies from thin protruding ends. The optical coefficients are explicit unmeasured candidates. New controls are `束内柔散射` and `细纤维透光`; the fifth `纤维逆光` view is an inspection setup, not an artistic substitute for the existing four lights.

Linear material radiance and fine-fiber alpha coverage are now accumulated before a single final tone map. Where supported, the color target is RGBA16F; RGBA8 is an explicitly lower-dynamic-range fallback. This corrects the old order of tone-mapping each contribution before blending.

A shared smooth material-coordinate field affects the weave, loose yarns, fine strands and seams together, preserving parent IDs and the interlacing draft. The field has an analytic Jacobian and sampled no-fold-over checks. These tests do not establish global surface collision freedom. The legacy periodic draft remains periodic; it is not claimed that all repetition has been eliminated.

Three uninterrupted regular sheath helices have been replaced by finite, phase/length-varied outer staples with radial migration. Roots and tips enter the yarn body rather than forming full-length exposed wire spirals. Surface flyaways are fewer and finer. These are still representative curves, not every cotton fiber. The original two-ended retained bridges, one-ended tails, partly retained yarns and clumped/stray fray remain. An asymmetric scan-intersected contour replaces the earlier nearly oval hole boundary. Damage is static authored structure, not force-driven ripping.

Gray spatial studio, background-only haze, perspective, near/mid explicit yarns, far-only intact capture, absence of a solid side wall, all twelve finish candidates, four weave drafts and five damage choices remain. The new export schema `kaopu.denim_material_profile@2.4` records optical assumptions and shared binding strength alongside the inherited millimeter geometry and damage. No other consumer is silently migrated.

## Reproduction

Initial bootstrap: `python3 upgrade.py && python3 build.py`. The migration checks the immutable parent hash and creates R06 canonical `core.js`, `natural-yarn.js`, `app.js` and `template.html`. Once those exist, edit them and rebuild with `python3 build.py`; do not overwrite later work by rerunning the migration. The optical and material-field JavaScript modules are included directly by build.py. The initial GLSL module is injected by upgrade.py; subsequent canonical shader edits belong in app.js.

`node test-layers.cjs` verifies finite-support optical quadrature against its analytic integral, shared-coordinate Jacobian, generated anchors, sampled tangents, indices and preserved representation rules. `qa.py` opens the actual file and an immutable public URL, exercises controls and captures real rendering evidence. Its `--content` mode is only an authored-document local test. Local Chromium file navigation is policy-blocked; actual file:// verification must come from the dedicated GitHub browser workflow, not a claimed local run.

## Cost and known limitations

Shorter representative curves reduce fine-ribbon buffer size and main-view geometry compared with R05, but HDR increases color-buffer memory and shading still has substantial cost. Per-layer buffer bytes are not peak memory. Shadow invalidation adds a separate geometry pass; idle rendering still stops. Software Chromium tests do not establish physical GPU FPS, phone heat or full-garment scalability.

Weave regularity, some hard fine strands and controlled damage remain possible visual limitations. No physical cloth/optical calibration, complete microscopic fiber model, full BSSRDF, dynamic tearing, all-yarn collision proof or universal no-moire result is claimed. Reading the source papers and passing numeric tests cannot certify film-grade appearance.

## Delivery gates

- [x] No generated image replaces the real 3D workbench.
- [x] Actual production generation and renderer source changed.
- [x] Yarn geometry comes from the runtime rather than a static preview.
- [x] Existing versions and unrelated systems preserved.
- [ ] Actual file/public browser, camera and parameter verification: see dedicated Actions and final receipt.
- [ ] User visual and film-grade approval pending.
- [ ] Physical-device performance and complete physics validation pending.

Internal screenshots are evidence only. A screenshot without the standalone/public interactive page does not constitute delivery.
