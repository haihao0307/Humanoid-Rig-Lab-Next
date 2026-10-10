# Denim R04 — retained, broken and clustered yarns

Parent: `04c345ea1e7113f9023d96966057b6aace0a6c50`; immutable R03.1 HTML SHA256 `2e92a73364d0f864ce7a8077b2e220e75291bdd72da367f9ca649f40eec73b40`. R01–R03 and other workbenches are unchanged. This is an isolated candidate branch, not a main merge.

## Actual source changes

`natural-yarn.js` generates a correlated damage plan and explicitly distinguishes two-ended retained bridges, thinner partly retained yarns and one-ended broken tails. Both bridge endpoints stay on their parent yarn; a tail keeps one anchored root. Drapes are statically authored curves in the cloth material frame, with downward bend and local outward lift. This is NOT dynamic gravity, stress-driven tearing or a collision solver.

Scaffold intervals are cut around each released segment so the old straight yarn cannot duplicate the new sagged bridge. Fraying uses shared guides and clump IDs, unequal member lengths, finite-width loose yarns, and a mixture of clumped and stray child fibers. The groups gather without collapsing every tip to the same point. Representative surface flyaways remain short; these are cotton-denim fibers, not wool knitting or a fur shell.

The inherited yarn shader has bounded width/height variation and lateral wander that vanishes at crossing centers, plus a softer diffuse-normal response and reduced hard specular response. Nominal thickness is still a design parameter, not a measured swatch fit. No claim of complete fiber scattering or film-grade realism.

The normal camera remains perspective. Near/middle views retain the same complete warp/weft population as explicit geometry. Only a very small intact swatch can use the inherited same-source far capture; damaged swatches stay geometric. The pure-color side wall is not restored. Twelve appearance presets, four weave drafts, four lights, five distress choices, rolled edge and the versioned export remain. The top toolbar's `破口与线束` button opens this turn's review configuration directly.

## Reproduction and source ownership

Initial migration: `python3 upgrade.py && python3 polish.py && python3 build.py`. The upgrade checks the frozen R03 HTML hash, writes only this R04 directory and reuses the existing core/renderer/UI. After migration, edit R04 `app.js`, `core.js`, `natural-yarn.js`, `template.html`; rebuild with `python3 build.py`. The canonical generated authoring files are committed by the dedicated Actions workflow with a normal fast-forward push.

The output is a standalone HTML with inline source and zero external runtime assets. Export schema is `kaopu.denim_material_profile@2.2`, with millimeters, cut intervals, parent anchors, released curves and clump metadata. This does not silently change any other workbench consumer.

## Regression and cost boundaries

`node test-natural.cjs` exercises all four drafts and five damage modes: finite meshes, valid indices, deterministic curves, anchored endpoints, simultaneous retained/broken yarns, sag and mixed clump/stray distribution. These checks do not prove global contact/collision validity.

`qa.py` opens the actual file and a fixed public HTTPS build, exercises real UI controls, captures rendered evidence, checks the prior edge/LOD/perspective regressions, export and idle stopping, then tests a 390×844 viewport. `--content` is only an authored-document local test and must not be called file/public verification. Physical phone hardware and GPU performance are not tested by software-rendered CI.

New loose-yarn and fiber meshes have finite cost. Normal viewing uses the retained lower geometric subdivision; close-up still increases to the high subdivision. All yarns are retained. The 2.4-million-pixel render budget and idle stopping remain. Submitted triangles, actual GPU time, first-use cost and full-garment scalability must not be inferred from the small HTML file size.

## Sources consulted in this turn

- SideFX Hair Clump: https://www.sidefx.com/docs/houdini/nodes/sop/hairclump.html . Read guide-based clustering, varying length preservation, accurate bundling and stray-rate concepts. This code is independently implemented; no Houdini binary or proprietary source is included.
- SideFX Clump Guides: https://www.sidefx.com/docs/houdini/shelf/sop_groom_hairclump.html . Read the role of secondary clump curves and their influence radius. Applied as a geometric analogy for frayed cotton bundles, not as a claim that denim is hair.
- Zhao, Luan, Bala, SIGGRAPH 2016 research page: https://research.cs.cornell.edu/ctcloth/index.htm and https://escholarship.org/uc/item/2fw2w3gs . Read the published abstract explaining why over-regular procedural yarns need measured fiber/flyaway variation. No CT fitting or measured parameters are claimed here.
- Disney curve-based garments publication entry revisited: https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/ . No claim to have its proprietary implementation or complete film production rendering.
- Prior material-library and manufacturer-reference provenance remains in R03 SOURCES.md. This turn's direct visual regression target is the user's feedback on R03, not an invented replacement cloth.

## Delivery gates

- [x] Actual generation and renderer source changed.
- [x] No generated image or screenshot substitutes for the interactive workbench.
- [x] R01–R03 and unrelated systems preserved.
- [ ] Fixed public and actual file-browser verification: see final Actions and validation receipt.
- [ ] User visual, film-grade, global collision and actual-phone performance acceptance pending.
