# Denim R04.0 — verified candidate receipt

## Tested identity and preservation

- Parent R03: `04c345ea1e7113f9023d96966057b6aace0a6c50`.
- Initial canonical R04 build: `c6eb0fa5230dd163b79ca4a21ff9c74b06549a33`.
- Final tested commit: `854d7426c9b340c2bbf9e195eb11e50fe8e6d9fb`. This changes only QA logging/classification after the initial build; its HTML bytes are identical.
- Branch: `fix/denim-r04-clumped-fray-sag-20261010`; Draft PR #36; no merge and no force push.
- Compare against R03 confirmed changes confined to new R04 files and the dedicated workflow, with no changes to R01–R03 or unrelated workbenches.
- Fixed public URL: https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/854d7426c9b340c2bbf9e195eb11e50fe8e6d9fb/denim-workshop/r04/index.html
- Standalone HTML: 60,868 bytes; SHA256 `1535f35e53c75091dad619489cc352cd5a9b8647618225043d08f0f458aea515`.
- Final CI artifact HTML and `/mnt/data/Denim_Material_Workbench_R04.html` were compared byte-for-byte and match.

## Actual changes

The damage generator now distinguishes two-ended retained yarn bridges, thinner partly retained yarns and one-ended broken tails. Old straight spans are removed before released curves are added, so a sagging bridge does not merely overlay an intact straight yarn. Roots retain the parent yarn ID and parameter location. The new top-toolbar `破口与线束` button opens the vintage ragged-hole review configuration directly.

Fray is generated as correlated guide groups with shared clump identity, variable member lengths, finite-width loose yarns, clumped child fibers and a minority of stray fibers. It is no longer only an independent scatter of identical fine strokes. Representative surface flyaways remain short and sparse; this is not a model of every cotton fiber and does not turn denim into wool knitting.

The yarn body has bounded thickness/path variation, crossing-centered wander suppression and a softer diffuse/specular response. Perspective, near/middle explicit geometry, no solid side wall, far-only same-source captures, all existing 12 appearance presets, four weave drafts, four light arrangements and five damage choices remain. Exports use `kaopu.denim_material_profile@2.2` with explicit millimeters, scaffold cut intervals, released-curve anchors and clump data.

The drapes are statically authored in the cloth material frame, not time-integrated gravity, stress-driven tearing or a collision simulation. Nominal thickness, damage probabilities and finishing parameters are design candidates, not measured textile properties.

## Final machine verification

Dedicated Actions run: https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38038620481
Job `114174229569`; all steps completed successfully.
Artifact `11664807425`, `denim-r04-natural-yarn-evidence`, 42,850,544 bytes.
ZIP SHA256 `0bc3adb5b5670d85962ae5de82b4ad20d4916f82d02748cac4c78b58bcee0ba8`.
The ZIP was downloaded, its digest checked, its JSON inspected, and public/mobile rendered images reviewed. These are actual runtime evidence, not generated images.

- Core regression: 12,397 assertions passed across four weave drafts and five damage states. Checks include finite mesh data, valid indices, deterministic generation, exact CPU parent anchors, simultaneous retained/broken yarns, sag and mixed clump/stray distribution.
- Actual local `file://` Chromium: 25 recorded rendered/interaction states passed; zero HTTP requests, page exceptions and console errors; WebGL error zero.
- Actual fixed-public-HTTPS Chromium: the same 25 states passed. All 25 corresponding local/public canvas hashes agree exactly. WebGL error zero in every recorded state; no page exceptions or workbench runtime resource errors.
- States include the real review button, three geometric damage choices, front/back/edge/roll, middle/far representations, fray length, four light controls, four representative finish controls, all four weave controls, thickness/slub updates and actual downloaded JSON export.
- Idle frame counters remained 26 to 26 in both file and public modes.
- Desktop viewport was 1280 x 900. These runs use ANGLE/SwiftShader, not a physical-GPU performance certification.
- Mobile viewport simulation was 390 x 844, not a real phone. Initial canvas x=0, y=52, width=390, height=523.265625. Initial cloth visibility and selecting the new review button/returning to the cloth passed. Its page/console/HTTP error lists were empty, and WebGL error was zero.

## The failed first run is not hidden

Run `38038062307` failed after the 25 public states because the original test recorded one unattributed resource-404 console message. It did not reach its mobile step and is not described as a successful full run.

The revised test records exact console locations and HTTP statuses and retains evidence before assertions. The final rerun identified the console message at `https://htmlpreview.github.io/favicon.ico`, the preview host's browser-tab icon. The only allowed warning is a 404 at that exact origin/path; application errors, missing raw HTML and other resource failures still fail the test. The icon warning remains in `consoleErrors` and `previewHostWarnings`, not discarded. It does not affect the cloth rendering, but this receipt does not claim that the whole external host has zero console messages.

## Actual default ragged configuration statistics

The rendered review state contains 26 two-ended yarn bridges, 305 single-ended tails and 22 thinner/partly retained bridges. The generator records 141 outer-edge clumps and 95 broken-yarn guide groups, with 6,278 representative fine-fiber curves. Of those, 2,939 are clustered child fibers and 845 are stray child fibers; the remaining ones are surface flyaways. These counts are generated configuration data, not measurements of real fabric.

All 26 bridges have downward guide sag. The CPU guide audit checked 357 anchored endpoints with maximum numerical error about 7.1e-15 mm. This checks centerline anchor equations only; it does not prove globally collision-free surfaces, tangent continuity, measured yarn mechanics or correct fiber scattering.

## Observed cost and visual limits

Default intact view submitted 1,910,060 triangles in six draw calls. The close ragged review submitted 5,465,180 triangles in five calls; its loose-yarn tube layer accounts for 162,528 triangles. A far intact swatch submitted 228,716 triangles, while the far damaged swatch remained geometric and submitted 1,608,284. These are submitted counts, not visible-fragment counts or frames per second.

Normal viewing selects a lower geometric subdivision while preserving the full yarn population. The inherited 2.4-million-pixel render budget and idle stopping remain. Instancing and a small HTML file do not eliminate GPU work. Actual hardware frame rate, memory peaks, phone thermals and whole-garment scalability remain unverified.

Visual review confirms retained connections, hanging ends and clustered/stray fray in the actual public render. Main weave repetition remains conspicuous, some fine strands still look wire-like, and the opening silhouette remains too controlled for the requested film-grade naturalness. This is a structural/natural-fray iteration, not film-grade or Houdini-parity approval. No broad temporal no-moire claim is made, and earlier R02 filtering percentages must not be reused for R04.

Research and prior-source provenance are recorded in README.md. No physical swatch or calibrated wash/fiber measurements were acquired. The exact separate newer sweater workbench was not definitively located; this implementation does not claim a complete transfer of it.

## Delivery gates

- [x] Actual production source, geometric yarn damage and standalone interactive HTML changed.
- [x] No generated image or screenshot substitutes for the workbench.
- [x] Existing versions and unrelated workbenches preserved.
- [x] Real file browser, fixed public HTTPS and listed controls verified.
- [x] Mobile viewport distinguished from a physical-phone test.
- [ ] User visual and film-grade acceptance pending.
- [ ] Dynamic tearing, global collision, full cotton scattering and real-device performance acceptance pending.

This receipt changes documentation only; the tested fixed build above remains unchanged.
