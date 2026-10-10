# Denim R05 — cotton fiber appearance in a gray studio

Parent: R04 `1f644eefce4282cf248653c999dedb4cfb9b9955`. R01–R04, human, skin, leather, sweater and other workbenches remain unchanged. This branch is a candidate for user review, not a main merge or film-grade certification.

## Actual changes

The yarn surface now combines a broad cloth sheen lobe, rough diffuse lighting, correlated dye/staple variation and small radial packing variation. Three representative twisted outer curves follow each retained warp/weft interval. Short rooted loop/flyaway curves supplement them. Fine-curve ribbons orient perpendicular to their actual tangent and viewing direction, with Gaussian width coverage rather than uniform opaque strokes. This is a partial fiber representation, not a model of every constituent cotton fiber.

R04 retained bridges, single-ended tails, thinned remnants, guide clumps and strays are preserved. The camera remains perspective; near/mid views retain explicit yarn geometry. Only very small intact cloth can use its own far-distance capture. The solid side wall is not reintroduced; damaged cloth stays geometric at every distance.

The black backdrop is replaced with an analytic gray floor/back-plane environment. Ray direction, plane intersection, shading, actual yarn depth shadows and background-only distance haze provide spatial cues. The haze never enters the cloth shader; fine gaps and translucent fiber coverage can naturally reveal the changing background. This is not volumetric path tracing. Four-sample key lighting, fill and rim replace the old narrow response. A 1024-pixel desktop / 768-pixel mobile-viewport depth map is cached when shape and light do not change. It includes yarns, loose-yarn tubes and optional stitches, not every fine ribbon.

All twelve finish candidates, four weave drafts, four lights, five distress choices and the `破口与线束` button remain. Two extra controls adjust studio exposure and distant background haze. Exports use `kaopu.denim_material_profile@2.3`, preserving millimeter geometry and damage data while recording studio and fiber-model settings. No other consumer is silently migrated.

## Source study

Both the Animal Logic Weave and Disney curve-garment papers were read in full, including all pages and figures. Implementation mappings and limitations are in STUDY.md. Their proprietary renderers/production tools and measured material data were not obtained. The current shader is a bounded real-time approximation, not Animal Logic's Jensen dipole model. No real swatch measurement or industrial wash calibration is claimed.

## Build and verification

First bootstrap: `python3 prepare.py && python3 upgrade.py && python3 build.py`. Bootstrap verifies the immutable R04 standalone hash and writes only R05. Once canonical `core.js`, `natural-yarn.js`, `app.js` and `template.html` exist, edit those and run `python3 build.py`; do not rerun the migration over later canonical edits. `cotton.glsl`, `studio.js` and `sheath.js` retain the initial module sources used by that migration.

`node test-fiber.cjs` checks generated geometry, pinned released endpoints, curve roles, tangent ribbon buffers and protected policies across four drafts and five damage modes. `qa.py` exercises the actual standalone file and fixed public HTTPS entry, gray pixels, background-haze isolation, all finish/weave/light controls, near/mid/far representations, real exported JSON and a 390×844 mobile viewport. `--content` is only a local authored-document rendering test; it is not public/file verification. Screenshots are internal QA evidence, not the deliverable.

## Costs and known gaps

The default intact fiber ribbon buffers alone contain about 48 MB of vertex/index data before accounting for other GPU buffers, framebuffers, JavaScript arrays or temporary build copies. This is not a peak-memory measurement. Millions of triangles are still submitted in close views. Shadow refresh adds a separate geometry pass, while camera/exposure/haze-only changes reuse the cache. Extremely distant intact cloth skips the outer-sheath draw range. The inherited render-target pixel cap and idle stopping remain; physical GPU frame rate, phone heat and whole-garment scalability remain unverified.

Weave repetition, the remaining controlled hole silhouette and simplified cotton scattering remain visual limitations. Numerical counts and successful browser execution cannot certify film-grade appearance, global yarn collision freedom, dynamic tearing, correct cotton mechanics or zero moire at all viewpoints.

## Delivery gates

- [x] No generated image substitutes for real 3D.
- [x] Actual production source changed; cloth geometry comes from its runtime.
- [x] Interactive camera, selections and parameters remain operative in the authored candidate.
- [x] Existing versions and unrelated systems remain protected.
- [ ] Fixed public URL and actual file/public browser verification: see final Actions/receipt.
- [ ] User visual and film-grade acceptance pending.
- [ ] Physical-phone/GPU and full-physics validation pending.

A screenshot without the working standalone and public workbench does not constitute delivery.
