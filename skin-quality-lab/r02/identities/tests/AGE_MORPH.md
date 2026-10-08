# R02 closed-eye scan: reversible artistic age shape

Current calibration: `r024-elder-shape-2` (2026-10-08 visual revision).

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
- A more distinct upper-lid hood, shallow sulcus above it, and outer-lid settling over the scan's existing closed-eye shape
- Local corner descent and paired nasolabial support / groove
- A restrained marionette transition
- Lower cheek and jowl tissue displacement plus a separate lateral jaw apron, continuing into an under-chin / anterior-neck drape
- Two unequal, oblique, localized neck folds; no repeating bands or circumferential rings

There are no sinusoidal bands, periodic waves, global gravity offsets, or screen-space modifiers. Spatial fields taper smoothly to zero. Equal source positions receive exactly equal translations even across duplicated UV seams. Normals are transported by the analytic inverse transpose of the displacement gradient, preserving the original imported scan's normals rather than recomputing a different smoothing solution for the whole head. The closed lid uses the same continuous 3-D map across nearby/contact surfaces.

### Scan-specific eye anchors for texture coordination

The upper surface was selected from the real mesh, not the nearest x/y vertex alone: the scan has internal/fold surfaces at similar x/y with very different depth and normal directions.

| Field | Left center | Right center | Gaussian sigma |
|---|---|---|---|
| Lower orbit pad | (-.0332, .0590, .0728) | (.0245, .0590, .0728) | (.0102, .0040, .019) |
| Upper lid fold | (-.0332, .0718, .0780) | (.0245, .0714, .0780) | (.0108, .0043, .020) |
| Tear trough | (-.0282, .0528, .077) | (.0195, .0528, .077) | (.0100, .00225, .019) |

`getAgeMorphRegions()` is the definitive source for the exact authored values and all other facial regions. Local fields overlap, so the total displacement is not the individual field's vector. The second pass separates the orbital pad from its lower trough and the upper hood from its sulcus; the first pass had allowed broad cheek reduction to cancel much of the intended orbital projection.

## Verification

Run `node identities/tests/age-morph.mjs`. It directly parses the original GLB and uses the application's existing subdivision code. It writes `age-morph-report.json` and performs 17 assertions including geometry identity, finite coordinates, unit normals, unchanged UV/index arrays, deterministic reapplication, seam coincidence, orientation/area bounds, analytic normal transport, and 20 exact-recovery cycles.

At strength 1 after final eye-anchor registration (regional examples use actual source vertices; vertex IDs and neutral positions are recorded in the JSON report):
- Maximum actual displacement: approximately 10.34 mm, localized to the lower-jaw soft-tissue region; this is not an age-acceptance metric
- Mid-cheek example: inward 1.65 mm, downward 2.16 mm, backward 4.08 mm
- Mouth-corner example: downward approximately 3.71 mm
- Jowl example: outward 3.21 mm, downward 8.43 mm, forward 4.00 mm
- 1,722 exact UV seam duplicate vertices retain zero positional gap
- No triangle direction reversals; triangle area ratio approximately 0.672–1.491
- Deformation Jacobian determinant approximately 0.687–1.416
- Maximum analytic-normal versus finite-difference error: approximately 0.00000201
- Intermediate strengths .25, .50, .75 and 1.0 have zero triangle direction reversals and minimum area ratios .913, .828, .748 and .672 respectively
- Switching restores every original position/normal byte; topology and UV hashes remain unchanged

These are geometry tests, not a claim of medical validity, full collision testing, or pixel-perfect application output. Application-level original-view pixel comparison, texture interaction, shadow invalidation, current-surface hair binding, rapid identity switching, and visual acceptance remain required after integration.

## Independent visual checks

`node identities/tests/age-morph-cpu-clay.cjs` generates three diagnostic clay pairs in `/tmp/r02-age-morph-cpu` by default. Neutral is left; aged shape is right. These are explicitly software rasterizer images, NOT WebGL/browser screenshots. They contain no texture, normal map, AO, cast shadows, or hair. They isolate contour and smooth-shading changes; they cannot validate the actual Three.js material pipeline.

`node identities/tests/age-morph-visual.cjs` is an optional real Three.js/Chromium clay harness. Its browser executable can be supplied as `CHROMIUM_PATH`. Chromium was attempted on this executor but blocked by its Unix socket sandbox; this browser stage was not passed here. Do not interpret the software images as a substitute for the main workbench's real browser acceptance.

Suggested actual workbench review uses the same camera/light for neutral and aged, then disables hair and textures: front; three-quarter approximately p [.22,.042,.38], target [-.003,.04,.04]; profile p [.36,.045,.12], target [-.003,.04,.035]; eye/cheek close-up p [.065,.066,.285], target [-.003,.055,.065]. Compare under a soft studio key and a separate raking-light pass. A hairless clay mode is useful because a gray beard can otherwise hide the actual jowl outline.


## Visual-reference revision: why the first shape pass was insufficient

The parent reviewed actual R02.4 quarter, profile, high and eyebrow images. The first pass remained visually middle-aged despite its measured displacement. The specific remaining problems were a smooth unbroken upper lid, a weak pad/trough distinction, insufficient lower-cheek support relative to mid-cheek depletion, and a tight side-view jaw-to-neck connection. Passing byte restoration, bounds and triangle tests did not establish the intended apparent age.

Three independent real photographs were opened and actually observed on their source pages in the cloud browser on 2026-10-08. No reference image was downloaded into this project or published; these are visual observations, not identity templates or medical evidence:

1. Janak Patel, closed-eye side-front portrait: https://www.pexels.com/photo/close-up-shot-of-an-elderly-person-with-eyes-closed1-13943908/
   - Observed: the upper lid has a low, compressed fold beneath the brow and a layered transition into the outer eye; the closed eye is not a uniformly full smooth dome.
2. Mirac Sendil, frontal portrait: https://www.pexels.com/photo/black-and-white-portrait-of-a-man-8388507/
   - Observed: the lower orbital pads, their borders, cheek hollows, mouth-side folds and under-jaw neck structures remain readable together. They are not merely dark drawn lines on an unchanged facial volume.
3. Kindel Media, side profile: https://www.pexels.com/photo/a-side-view-of-an-elderly-man-8172237/
   - Observed: lower cheek and under-chin soft tissue interrupt the taut jaw-to-neck transition. The photo's individual proportions and body mass were not copied.

These people differ in facial structure, body mass, lighting, expression and apparent age. The authored scan keeps its own nose, skull, closed-eye condition and asymmetric registration. The revision borrows only general visual relationships: support next to loss of volume, localized hanging tissue and fold transitions. It does not assert that every older person has these features.

The revision is not a uniform strength increase. New fields include an upper-lid sulcus, outer lid hood, outer brow settling, lateral orbital drape, lateral jaw apron, central neck drape and two nonperiodic folds. Cheek field centers/extents and support/groove placement changed independently. The nose tip's displacement remains approximately 0.34 mm while the targeted jaw and orbital structures change more.

`AgeMorph-r024-first-pass.js.txt` and `age-morph-first-pass-report.json` retain the earlier implementation/report only for development comparison. They are not runtime imports and are separate from the protected original R02 baseline.

Software clay pairs for this revision are in `/tmp/r02-age-pass2-cpu/{front,three-quarter,profile}.png` after invoking the renderer with `AGE_MORPH_VISUAL_OUT=/tmp/r02-age-pass2-cpu`. Their geometry-only changes have been inspected, but the cloud-browser/real-WebGL integration review must decide whether the intended elder shape reads convincingly and whether the mouth corners look too severe. The parent is replacing the early application clay view with a genuinely untextured MeshStandardMaterial because its prior material path contained lighting artifacts; those artifacts are not evidence of geometric failure.
