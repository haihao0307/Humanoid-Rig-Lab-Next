# R03.1 verified build receipt

## Identity

Tested build: `90ce239133a3fdd129eebcb793f577f3c870befb`.
Base R02 source: `370c0cfa4098d3027042e5c788f96371095f2518`.
Branch: `fix/denim-r03-geometry-edge-perspective-20261010`.
Draft PR #33; not merged. Compare against the base confirmed 35 added files, zero deletions, confined to new R03 files and its dedicated workflow. R01, R02 and other workbenches remain unchanged.

Fixed public page:
https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/90ce239133a3fdd129eebcb793f577f3c870befb/denim-workshop/r03/index.html

Standalone HTML: 50,643 bytes.
SHA-256: `2e92a73364d0f864ce7a8077b2e220e75291bdd72da367f9ca649f40eec73b40`.
The CI artifact HTML and the standalone supplied in the conversation were compared byte-for-byte and match.

## User corrections implemented

The solid blue side-wall creation and draw have been removed. Near and middle views use real instanced warp/weft yarns, without mixing captured texture shading into those yarns. All original yarn identities are retained. Axial and cross-section geometry morph before switching between 4 samples/8 sides, 2 samples/8 sides and 2 samples/4 sides. Only an intact swatch estimated below 180 screen pixels, with warp pitch below 0.58 pixel, can use the lazily generated same-source far capture. Damaged swatches stay geometric at every distance so an opaque quad cannot close the aperture.

The normal viewing camera is perspective with a 36-degree vertical field of view. Orthographic matrices remain only in internal capture/structural tests. Edge ends have irregular extensions, longer loose fibers, and representative surface flyaways. Default intact configuration has 6,700 representative edge/surface fiber curves; this is not a complete model of every cotton fiber. Thickness remains parameterized and nominal, not laboratory-calibrated.

Four lighting arrangements: neutral, grazing side light, warm key/cool fill, soft studio. These were informed by the owner's existing material-library shader; no private source file was republished. Twelve finishing/color candidates preserve separate warp/weft identity. Five distress modes include intact cloth, surface scuff, warp removal with weft bridges, a real through-hole, and ragged openings with sparse retained bridges. The last three split the generated yarn intervals and attach cut-end fibers; they are not black painted holes. They are static authored damage, not stress-driven tear propagation.

## Final GitHub Actions evidence

Dedicated workflow: Denim R03 Geometry and Public QA.
Run: https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38035145013
Job: `114163920716`.
All steps in this dedicated workflow completed successfully.
The triggering source commit was `32536a2344722a7e291eeceaebcbe14c0c3451ea`. Its build step published the canonical HTML with a normal fast-forward push to `90ce239...` before opening that exact public URL.

Artifact: `11664305633`, `denim-r03-geometry-public-evidence`, 20,268,956 bytes.
Artifact archive SHA-256: `5eb577a1cf72382f31833f35c1172704102483a2280168df16da5bc7e1e6dadd`.
The archive was downloaded; hash, JSON results, public edge and through-hole images, and mobile first-look image were actually inspected. Passing source tests alone was not treated as browser verification.

## Observed results

- Core checks passed: four weave drafts, 106,624 crossing-center checks, 8,708 cut-interval records. The split-yarn aggregate in this fixture is 1,708. These checks do not prove global surface collision freedom.
- Actual local `file://` browser: 30 recorded states passed.
- Actual fixed public HTTPS browser: the same 30 recorded states passed. All 30 local/public canvas hashes match pairwise.
- Version R03.1 and WebGL error zero in every recorded state; page exception lists empty. The test did not separately aggregate every browser console message, so this receipt does not claim universal console-error-free execution.
- User edge regression: zoom 2.2, 1, 0.6 and 0.32 at a grazing/cropped orientation retained actual instanced geometry calls, geometry-only shading, and no solid side wall.
- Actual depth-tested GPU family-ID raster: 26,656 default crossing centers, zero wrong and zero ambiguous, for both file and public modes. This remains a crossing-center fixture, not a self-collision proof.
- Twelve finish choices produced twelve different canvas hashes; four light choices produced four different canvas hashes.
- A rendered through-hole center read `[18,20,21,255]`, matching the clear background, rather than an opaque cloth carrier.
- Far intact cloth used the permitted far capture. Far damaged cloth continued using geometry and retained the aperture.
- Rolled edge, changed nominal thickness/fray parameters and JSON export were exercised. Export schema is `kaopu.denim_material_profile@2.1` with explicit millimeters and damage intervals.
- Idle frame counters stayed at 67 -> 67 in both file and public runs.
- The actual file run issued only the file request and zero HTTP requests. The public entry additionally loads the preview host, its script and the fixed raw HTML; the workbench has no external runtime texture/model/font dependency.
- Desktop viewport: 1440 x 1000. Mobile viewport simulation: 390 x 844, not a real phone. Mobile first-look canvas x=0, y=52, width=390, height=523.265625; the initial cloth was visible and geometric. Selecting the weft-bridge damage option and returning to the view also passed with no page exceptions.

## Costs and remaining limitations

Measured submitted-triangle counts in this test, not estimated from file size:

| View/state | Submitted triangles | Draw calls |
| --- | ---: | ---: |
| Default near cloth | 3,506,128 | 5 |
| Middle-distance edge, zoom 0.32 | 1,800,144 | 5 |
| Ragged opening near view | 5,219,728 | 4 |
| Far intact capture | 118,800 | 4 |
| Far through-hole geometry | 1,252,716 | 4 |

These counts include submitted template/instance triangles, some of which can be degenerate or clipped; they are not the number of final visible fragments. Near/middle geometry costs substantially more than R02's image carrier. Instancing saves repeated buffers but not all vertex computation. Rendering targets are capped at 2.4 million pixels, idle rendering stops, and far captures are lazy. Software ANGLE/SwiftShader tests do not establish physical GPU frame rate, memory peaks, phone thermals or full-garment scalability.

Visual review: the solid side-band regression is removed and actual apertures/frays exist, but the weave remains too regular, fine highlights too hard, cotton scattering incomplete, and damage silhouettes still too controlled for the requested film-grade quality. The new geometry LOD is implemented, but this suite is not a broad temporal anti-aliasing/no-moire proof. The R02 72.6% filtering figure does not apply to this changed renderer and must not be reused as an R03 result.

Manufacturer sample photographs and SideFX materials were consulted as recorded in SOURCES.md. No physical swatch was acquired or measured; photographs are not calibrated reflectance data. The exact separate newer sweater workbench remains unlocated. No claim of all denim varieties, industrial wash recipes, dynamic cloth tearing, body/self collision, complete lockstitch simulation, film-grade acceptance or Houdini parity.

## Delivery gates

- [x] Actual production source and standalone interactive HTML changed.
- [x] No generated image or screenshot substitutes for the 3D workbench.
- [x] Yarn geometry and damage are generated by the actual runtime.
- [x] Fixed public URL, actual file browser and specified interactions verified.
- [x] R01/R02 and unrelated workbenches preserved.
- [ ] User visual acceptance pending.
- [ ] Film-grade, comprehensive temporal AA and actual-phone performance acceptance pending.

This receipt is documentation only and does not alter the immutable tested build above.
