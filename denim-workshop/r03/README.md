# Denim R03.1 — geometry-first edges, perspective and static distress

Extends the R02 source at `370c0cfa4098d3027042e5c788f96371095f2518` without replacing R01, R02, human, skin, leather or other material systems. Draft-only branch; no main merge, no force push.

## Actual changes

The solid-colored side-wall mesh/draw is removed. Near and mid views draw real instanced yarn geometry without blending a baked image into its material. Longitudinal and cross-sectional geometry can morph to lower resolution. Only an intact swatch whose screen-size estimate is below 180 pixels AND warp pitch below 0.58 pixel may use the same-source filtered capture. All damaged swatches continue drawing yarns even at distance. Far captures are lazy rather than a cold-start dependency.

The presentation camera now uses 36-degree vertical-field-of-view perspective, with front, back, edge, close and reset controls. Orthographic projection exists ONLY for internal crossing-center audits/captures. Shift/right-button drag pans the camera target. Mobile first-look layout is inherited.

Yarn ends now vary in length; 2,100 sparse edge fibers reach farther, alongside 4,600 sparse surface flyaways. Damage cases add attached cut-end tufts. These are representative fibers, not every constituent cotton fiber. Approximate yarn cross-section, dye variation and broad diffuse cotton lighting are updated. Four light choices include neutral, grazing, warm-key/cool-fill and soft studio light, informed by the owner's material library.

Twelve appearance candidates: raw indigo, rinsed, vintage, light bleach, slubby, washed black, grey, ecru, indigo/black, double indigo, softened wash and mottled wash. They are not measured industrial recipes, do not validate elastic mechanics, and do not cover every denim category.

Five distress choices: intact, surface scuff (no hole), warp removal with pale weft retained, open through-hole, and a broader ragged hole retaining sparse yarn bridges. Cut intervals are represented in the exported yarn data and rendered as separate capped spans, not a black decal. Current openings are deliberately controlled static shapes; no force-based tear propagation or full lockstitch solver is claimed.

## Editing/building

Edit `core.js`, `app.js`, `template.html`; run `python3 build.py`. `index.html` is a standalone artifact with no external runtime assets. Runtime output is generated from source; source payload/bootstrap are transport provenance, not a runtime dependency.

Export is additive `kaopu.denim_material_profile@2.1`, millimeters, including finish, static damage cut intervals and presentation settings. No other workbench consumer was silently changed.

## Tests and known costs

`node test-core.cjs` checks the four drafts (106,624 crossing centers), 8,708 interval records, deleted intervals, retained weft bridges, invalid input and the removed-wall/no-capture-shading regressions. This does not prove global collision freedom.

`qa.py` checks actual draw calls and rendered pixels, near/mid geometry preservation at multiple distances, perspective, cut holes, material/lighting changes, lazy far capture, export, idle stop and 390x844 mobile first-look. `--content` is only the local authored-document test. CI runs actual file:// and fixed public HTTPS. Passing tests does not mean the user approved the appearance.

Keeping yarn geometry nearby is intentionally more expensive than R02's 81k-triangle image carrier. Default/high detail may submit roughly 3.5 million triangles; damaged split spans can increase that. Instancing keeps geometry buffers compact but does not eliminate vertex work. Supersample targets are capped at 2.4 million pixels and idle rendering stops. Hardware FPS, battery, thermals and full-garment scaling are NOT yet validated.

No claim of film-grade rendering, industrial wash prediction, measured mechanics, full fiber scattering, self-collision, body collision or universal no-flicker. Authoring rules and manufacturer photographs are referenced in SOURCES.md. Screenshots are internal evidence only; the actual interactive page is the deliverable.

## Delivery gates

- [x] Real source modified; not a generated-image substitute.
- [x] Actual yarn geometry, topology and working interactive controls.
- [x] R01/R02 and other systems preserved.
- [ ] Fixed public build and actual file-browser validation: see final Actions and receipt.
- [ ] Actual-phone performance and user visual acceptance pending.
