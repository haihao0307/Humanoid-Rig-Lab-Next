# Photo-driven NPC Fit R0

Branch: `feature/photo-driven-npc-fit-r0`

Entry point: `photo-fit-test.html`

## Purpose

This is an isolated test board for turning one local reference photo into an auditable candidate set of the existing procedural NPC parameters. It does not replace the shared mother body, does not embed the source image in the character preset, and does not claim that a single image uniquely reconstructs a complete three-dimensional person.

The test flow is:

```text
local photo
→ manual image landmarks
→ normalized measurements and warnings
→ bounded character-morph candidate
→ staged application to the current NPC
→ exported photo-fit profile
```

The current workbench remains the rendering and character-authority source. The test page loads the branch `index.html`, obtains the existing `HumanLab.character` API from the embedded body workbench, and applies only a validated character preset.

## Why R0 starts with manual landmarks

A single front image can constrain visible projected widths and segment ratios, but it cannot uniquely recover body depth, the true side profile, the back of the head, or body dimensions hidden by clothing. R0 therefore implements the manual-observation loop before adding an automatic landmark adapter. This keeps the first result inspectable and prevents uncertain values from being silently promoted to facts.

The first version supports:

- front full-body mode;
- front head mode;
- draggable image landmarks;
- known-height recording without bypassing the current fixed `1.75 m` rig contract;
- visible warnings for perspective, loose clothing, crop, non-neutral pose, asymmetry, and single-view depth uncertainty;
- photo-to-parameter candidates for shoulder, chest, waist, hip, neck, and face width;
- explicit manual controls for limb volume and softness;
- staged application: rig width, torso outline, face width, and manual volume;
- restoration of the captured NPC baseline;
- JSON export without image pixels, object URLs, data URLs, or base64 image data.

## Files

```text
photo-fit-test.html
photo-fit/PhotoFitCore.mjs
schemas/photo-fit-profile.schema.json
tools/check-photo-fit.mjs
PHOTO_FIT_START_HERE.md
```

`PhotoFitCore.mjs` is a pure-data module. It does not access the DOM, browser storage, the network, WebGL, or the running NPC. The page owns image display and cross-frame workbench integration.

## Current parameter boundary

The current mother body exposes these bounded character morphs:

```text
shoulderWidth       0.80–1.18
chestWidth          0.82–1.18
waistWidth          0.78–1.20
hipWidth            0.86–1.25
neckWidth           0.82–1.14
limbVolume          0.78–1.22
softness             0.65–1.45
breastProjectionM   0.00–0.10
faceWidth            0.90–1.08
```

R0 does not enlarge these limits. Reaching a limit is exported as a warning because it means the reference may exceed the current mother body's expressive range.

`shoulderWidth` and `hipWidth` participate in the rig signature, so applying the rig stage may reload the embedded body workbench. The parent photo-fit page retains the photo, landmarks, baseline preset, candidate, and applied-stage history during that reload.

The known height is recorded as an observation only. The present character-preset contract still requires `statureM: 1.75`, so R0 does not disguise height scaling as a successful fit.

## Data separation

The exported `humanoid_rig/photo_fit_profile@0.1` contains:

- local image metadata and optional SHA-256 digest;
- normalized manual landmarks;
- measurements with confidence and source landmarks;
- warnings and unknown states;
- bounded candidate morphs;
- per-morph evidence;
- the captured base preset facts;
- the list of stages that were actually applied.

It does not contain:

- image bytes;
- data URLs or object URLs;
- a generated mesh;
- a texture;
- a scan;
- a pose or animation overwrite;
- a claim of exact identity reconstruction.

The output remains separate from `ProportionProfile`, `PoseFrame`, and `MotionClip`. A later integration can promote confirmed measurements into the project-wide proportion system through an explicit transaction and revision, rather than writing directly from an unreviewed image result.

## Local check

```sh
node tools/check-photo-fit.mjs
```

The check is pure data and does not start the application, browser, renderer, or GPU. It covers landmark validation, single-view uncertainty, bounded candidate mapping, staged preset writes, preservation of task and stature contracts, profile export, and rejection of embedded image bytes.

## Browser test

Serve the repository from its root, then open:

```text
/photo-fit-test.html
```

The page must be served over HTTP or HTTPS. Opening it directly from `file://` can prevent module loading and nested-frame access.

Suggested first acceptance sequence:

1. Open a front full-body image.
2. Move every visible landmark to the corresponding image feature.
3. Record the current NPC as the baseline.
4. Review warnings and the candidate table.
5. Apply the rig-width stage and wait for the body workbench to reconnect.
6. Apply torso and face stages.
7. Rotate the NPC to the side and verify that the front-view fit has not created an implausible side profile.
8. Restore the baseline.
9. Export the photo-fit JSON and confirm that it contains no image payload.

## Deliberately deferred

R0 does not yet include:

- automatic landmark inference;
- front-and-side multi-view fusion;
- camera calibration;
- automatic silhouette segmentation;
- depth or circumference reconstruction;
- eye, nose, lip, jaw, or skull-depth identity parameters not currently exposed by the mother body;
- project-wide SharedWorker revision integration;
- IndexedDB or OPFS persistence;
- cloud upload;
- identity similarity scoring.

The next safe step is to add a replaceable landmark adapter that produces exactly the same landmark schema used by the manual workflow. Automatic output must remain editable, carry confidence, and never remove the manual fallback.
