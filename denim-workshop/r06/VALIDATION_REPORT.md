# R06.0 — tested candidate receipt

## Identity and preservation

Parent R05: `cca5466b1e58b09a9a5c1ce75ea47ee142eafbcb`.
Tested immutable build: `f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3`.
Branch: `feature/denim-r06-layered-scatter-20261010`; Draft PR #39, not merged; no force push.

Fixed public URL:
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3/denim-workshop/r06/index.html

Standalone HTML is 80,416 bytes, SHA256 `ec4a548a9486e25be2838614cb3bf369590008cb1d85864c80647da3cbb83498`. The CI artifact, local canonical build and `/mnt/data/Denim_Material_Workbench_R06.html` were compared byte-for-byte and match. Compare against the parent confirmed 17 additions at the tested build, confined to R06 and its dedicated workflow, with zero changes/deletions to R01–R05 or unrelated files. This receipt does not change that immutable build.

## Actual changes, and what they do not imply

The optical response separates surface reflection, approximate local yarn-bundle diffusion and diameter-dependent fine-strand transmission. CPU code evaluates and integrates a Jensen radial dipole profile over four annuli in millimeters. The shader reduces this to a center/longitudinal-neighbor approximation of local illumination. It is NOT full surface-to-surface BSSRDF integration, a measured cotton fit or the Weave production renderer. Coefficients are explicitly unmeasured artist candidates. Individual fine strands use a finite-path attenuation/phase approximation, not a dipole model applied to isolated hairs.

The renderer now composites linear radiance and fiber coverage before a single final exposure/tone map. Actual final CI frames use RGBA16F. The RGBA8 path remains a limited dynamic-range fallback, not an equivalent film-quality renderer.

Full-length regular outer helices were replaced by finite, phase/length-varied visible staple segments that move radially into/out of the yarn body. Their visible segment length is not a claim about complete biological cotton-fiber length. Surface flyaways are fewer/finer. Parent yarn IDs and the interlacing draft remain; shared smooth material-coordinate deformation binds yarn bodies, frays, loose strands and seams consistently. The damage boundary is now asymmetric and scanned into actual cut intervals, not a painted hole. Retained two-ended bridges, one-ended tails and clumped/stray fray remain static authored curves, not force-driven tearing.

Gray studio, background-only haze, perspective, near/middle explicit yarn geometry, far-only intact capture and no solid side wall remain. Twelve finish candidates, four weave drafts and five damage choices remain. The original four lighting modes are preserved and a fifth fiber-rim inspection mode added. New controls independently expose bundle scattering and thin-strand transmission. Export schema is `kaopu.denim_material_profile@2.4` with optical assumptions and geometry data.

## Final GitHub browser evidence

Dedicated workflow: https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38045137467
Job `114193030230`; all steps succeeded.
Triggering source commit: `d199016c8b3a3cb651ec4a5dfc34985ac5d359c3`. Its build step published the canonical `f8a0e0ab...` with a normal fast-forward push before testing that exact public URL.
Artifact `11666848814`, `denim-r06-layered-evidence`, 36,639,453 bytes.
Archive SHA256: `a867aa2fac4661693c843e04a49b8cb38a2ea4414e8a21894c6c4c771ed47ca6`.
The downloaded archive hash, JSON and HTML were checked. Actual public default/close/ragged and mobile-rim screenshots were visually inspected; screenshots are evidence, not the delivered product.

- Actual file:// execution: 42 recorded states passed; zero HTTP requests, page exceptions, console errors and HTTP errors.
- Actual fixed-public-HTTPS execution: 42 recorded states passed; all 42 corresponding file/public canvas hashes match exactly; WebGL error zero in every recorded state.
- All 12 finish choices, 5 light choices and 4 weave choices produced distinct hashes within their respective groups.
- Tests exercise the new fray/rim buttons, separate scattering/transmission controls, background haze, front/back/edge/roll/close views, inherited middle/far representation rules, thickness/slub/fray and actual JSON download. Near/middle and far damaged views remain geometric.
- Idle frame number remains 44 to 44 in both runs. Main render target is 1586 x 1514 in the desktop fixture, within the approximately 2.4-million-pixel budget.
- Desktop viewport: 1100 x 840, software ANGLE/SwiftShader; not physical GPU FPS validation.
- Mobile viewport simulation: 390 x 844, not a real phone. Initial canvas x=0,y=52,w=390,h=523.265625. Initial visibility and fray/rim UI operation passed; mobile page/console/HTTP errors empty; GL error zero. Mobile target 780 x 1046 and shadow map 768 square.

The public desktop fixture retains one exact preview-host favicon.ico 404 warning in its evidence. Only `https://htmlpreview.github.io/favicon.ico` is classified separately; no workbench resource/JavaScript error is suppressed. The host as a whole is not claimed to have no console messages.

## Causal pixel and numerical checks

Turning bundle scattering from 0 to 1 changed mean image RGB by 6.800999; turning thin transmission from 0 to 1 in the fixed rim setup changed it by 7.956522. Haze 0 to 1 changed the background test patch by 17.77. These are causal-control checks, not realism scores or measured optical accuracy. Gray corner samples were [161,164,167], [157,160,163], [151,154,157], [147,150,152]. The background-only haze code is preserved; R05's earlier percentage of unchanged foreground pixels is not reused as an R06 result.

428,709 bounded numeric/geometry assertions passed. The count is largely sampled data checks, not a visual quality score. The finite-support radial quadrature differs from its independent analytic finite-support integral by at most 1.624e-6. On the sampled material domain, minimum deformation-Jacobian determinant is 0.850746; maximum displacement is 0.492067 mm, and derivative error against finite differences is below 1.32e-10. These do not prove global yarn-surface collision freedom.

The tested default ragged state contains 26 retained bridges, 332 single-ended tails and 22 partly retained bridges, 141 outer clumps and 103 broken-yarn groups. The guide check covers 384 endpoints with maximum numerical error about 7.11e-15 mm. These are generated configuration data, not real textile measurements or full surface-contact proofs.

A separate local authored-document probe deliberately reported EXT_color_buffer_float unavailable and verified a default RGBA8-linear frame without WebGL/page errors. This forced capability test is not actual low-end-hardware testing, nor proof of HDR-equivalent appearance. Local file navigation was policy-blocked; actual file:// evidence above comes from GitHub Actions, not from that local probe.

## Cost and visual review

Main-view submitted triangles / draw calls:
- Default intact: 2,373,380 / 7.
- Close ragged: 5,964,682 / 6.
- Close fiber inspection: 4,071,204 / 6.
- Far intact capture: 302,316 / 6.
- Far damaged geometry: 2,014,930 / 6.

A damaged shadow refresh separately submits 2,807,448 triangles in 3 calls when invalidated. Scattering/transmission-only changes reuse it. These are submitted counts, not visible fragments or FPS.

Default fine-ribbon buffers total 35,644,080 bytes, compared with the recorded R05 48,237,248 bytes. HDR increases the main color target from 4 to 8 bytes per pixel where supported, adding about 9.6 MB at this desktop target. Therefore the ribbon saving is NOT an equal reduction in total/peak memory. Other buffers, temporary arrays and driver resources are additional. Physical GPU latency, phone heat, peak memory and whole-garment scaling remain unverified.

Compared with the inspected R05 default image, the default hard dark/bright striping is reduced and the material response is softer. However, the actual R06 close-up still clearly reveals smooth tubular yarn bodies, overly regular packing, and incomplete integration between surface staples and yarn bulk. Some dangling ends still read as hard lines; the hole contour remains authored. These are visible remaining defects, not hidden behind the gray background or a claim of film-grade quality. No full BSSRDF, measured cotton response, dynamic tearing, universal no-moire or global collision guarantee is made.

## Delivery gates

- [x] Real production source and runtime geometry changed; no generated-image substitute.
- [x] Interactive standalone HTML and immutable public page verified in actual browsers.
- [x] Camera, selection and parameter operations tested; earlier versions protected.
- [x] Two specified papers revisited; implementation boundaries documented in STUDY.md.
- [x] Mobile viewport explicitly distinguished from phone hardware.
- [ ] User visual and film-grade acceptance pending.
- [ ] Full optical calibration, mechanics, global collision and physical-device performance pending.

Only screenshots without the working standalone/public workbench would not constitute delivery.
