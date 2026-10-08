# R02 closed-eye scan: reversible artistic age shape

This module is an art-directed age study of the existing Lee Perry Smith scan. It is not a biological simulation, medical model, age estimator, or independently validated prediction. It imports no outside model, scan, texture or groom. Original asset attribution remains in the workbench's existing license file.

## Scope and integration

Only `identities/AgeMorph.js` and this independent test directory were authored for the shape task. The implementation does not edit the main application, identity runtime, build script, textures, general character workbench, materials, or original GLB.

```js
import { createScanAgeMorph, getAgeMorphRegions } from './identities/AgeMorph.js';
const scanAge = createScanAgeMorph(mesh.geometry); // once, after two subdivisions + scale(.04)
scanAge.apply(id === 'weathered' ? 1 : 0);
// Now rebuild/resample brows, beard AND fine fuzz from current position/normal.
// Anatomical masks must read neutral UV/skinNeutralPosition, not aged position.
// Invalidate entry depth and native shadow maps and request a fresh frame.
scanAge.restore(); // original position and normal arrays copied back byte for byte
```

`createScanAgeMorph` returns the same controller for the same geometry. `apply` clamps finite strengths to 0–1 and always starts from its captured neutral arrays; calls cannot accumulate displacement. `apply(0)` and `restore()` use identical exact-copy recovery. Nonfinite strength throws. The module validates this scan's vertex/index counts and metre-space bounds before capture.

Public controller members:
- `apply(strength)`, `restore()` return the controller
- `neutralPosition`, `neutralNormal` are lookup attributes for masks
- `strength` is read-only
- `diagnostics()` returns live strength, invariants and measured unit-amplitude geometry statistics
- `getAgeMorphRegions()` returns copies of field centers, extents and authored vectors for coordinated texture painting
- Convenience exports: `applyAgeMorph(geometry,strength)`, `restoreAgeMorph(geometry)`, `sampleAgeDisplacement(x,y,z,strength)`

Geometry attribute names are `skinNeutralPosition` and `skinNeutralNormal`. The actual recovery arrays are separate internal copies. The module owns the original `position`/`normal` attribute references; replacing those attributes after capture is not supported. Do not morph another workbench or an independently posed/scaled version of this scan with these coordinates.

## Shape design and source registration

The actual two-subdivision mesh contains 143,196 vertices and 282,944 triangles. Neutral bounds (metres) are x [-0.17120013, 0.17116457], y [-0.15955338, 0.15921721], z [-0.10378598, 0.10362940]. The face points toward +Z; the central facial axis is approximately x -0.0034, not exactly zero. All values below are object-space metres. Side differences and original scan asymmetry are preserved.

The fields combine:
- Broad malar and submalar volume loss, rather than simply sliding every facial point down
- Local temple reduction
- A lower orbital pad with a separate small tear-trough depression
- Upper-lid tissue settling over the scan's existing closed-eye shape
- Local corner descent and paired nasolabial support / groove
- A restrained marionette transition
- Lower cheek and jowl tissue displacement, continuing into one smooth under-chin / anterior-neck envelope

There are no sinusoidal bands, periodic waves, global gravity offsets, or screen-space modifiers. Spatial fields taper smoothly to zero. Equal source positions receive exactly equal translations even across duplicated UV seams. Normals are transported by the analytic inverse transpose of the displacement gradient, preserving the original imported scan's normals rather than recomputing a different smoothing solution for the whole head. The closed lid uses the same continuous 3-D map across nearby/contact surfaces.

### Scan-specific eye anchors for texture coordination

The upper surface was selected from the real mesh, not the nearest x/y vertex alone: the scan has internal/fold surfaces at similar x/y with very different depth and normal directions.

| Field | Left center | Right center | Gaussian sigma |
|---|---|---|---|
| Lower orbit pad | (-.0332, .0585, .0723) | (.0245, .0585, .0723) | (.0105, .0041, .020) |
| Upper lid fold | (-.0332, .0730, .0778) | (.0245, .0726, .0778) | (.0105, .0047, .021) |
| Tear trough | (-.0262, .0535, .077) | (.0175, .0535, .077) | (.0090, .0025, .019) |

`getAgeMorphRegions()` is the definitive source for the exact authored values and all other facial regions. Local fields overlap, so the total displacement is not the individual field's vector. In particular, the eye bag remains prominent relative to the reduced cheek even when their combined absolute Z movement is slightly backward.

## Verification

Run `node identities/tests/age-morph.mjs`. It directly parses the original GLB and uses the application's existing subdivision code. It writes `age-morph-report.json` and performs 15 assertions including geometry identity, finite coordinates, unit normals, unchanged UV/index arrays, deterministic reapplication, seam coincidence, orientation/area bounds, analytic normal transport, and 20 exact-recovery cycles.

At strength 1 after final eye-anchor registration (regional examples use actual source vertices; vertex IDs and neutral positions are recorded in the JSON report):
- Maximum actual displacement: approximately 4.36 mm
- Mid-cheek example: inward 1.26 mm, downward 1.25 mm, backward 3.34 mm
- Mouth-corner example: downward approximately 2.50 mm
- Jowl example: outward 1.40 mm, downward 3.35 mm, forward 2.18 mm
- 1,722 exact UV seam duplicate vertices retain zero positional gap
- No triangle direction reversals; triangle area ratio approximately 0.833–1.234
- Deformation Jacobian determinant approximately 0.885–1.163
- Maximum analytic-normal versus finite-difference error: approximately 0.00000130
- Switching restores every original position/normal byte; topology and UV hashes remain unchanged

These are geometry tests, not a claim of medical validity, full collision testing, or pixel-perfect application output. Application-level original-view pixel comparison, texture interaction, shadow invalidation, current-surface hair binding, rapid identity switching, and visual acceptance remain required after integration.

## Independent visual checks

`node identities/tests/age-morph-cpu-clay.cjs` generates three diagnostic clay pairs in `/tmp/r02-age-morph-cpu` by default. Neutral is left; aged shape is right. These are explicitly software rasterizer images, NOT WebGL/browser screenshots. They contain no texture, normal map, AO, cast shadows, or hair. They isolate contour and smooth-shading changes; they cannot validate the actual Three.js material pipeline.

`node identities/tests/age-morph-visual.cjs` is an optional real Three.js/Chromium clay harness. Its browser executable can be supplied as `CHROMIUM_PATH`. Chromium was attempted on this executor but blocked by its Unix socket sandbox; this browser stage was not passed here. Do not interpret the software images as a substitute for the main workbench's real browser acceptance.

Suggested actual workbench review uses the same camera/light for neutral and aged, then disables hair and textures: front; three-quarter approximately p [.22,.042,.38], target [-.003,.04,.04]; profile p [.36,.045,.12], target [-.003,.04,.035]; eye/cheek close-up p [.065,.066,.285], target [-.003,.055,.065]. Compare under a soft studio key and a separate raking-light pass. A hairless clay mode is useful because a gray beard can otherwise hide the actual jowl outline.
