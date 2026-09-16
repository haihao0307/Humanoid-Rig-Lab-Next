# Chicken V4.6 R9.3 — Independent Visual Audit

Date: 2026-09-16
Branch: `codex/chicken-r9-2-head-restore`
Reviewed executable: `CHICKEN_V46_R9_3_HEAD_SHAPE.html`
Reviewed commit: `8ca6e46e29086503fcb65666c5ebfcf879ac22ce`

## Evidence reviewed

A fresh browser rerun was requested for the existing R9.3 workflow. The browser/shape QA and fixed-view capture steps completed successfully. The resulting artifact was downloaded and the following images were inspected directly:

- `reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png`
- `evidence/r93/R93_HEAD_NEUTRAL_LEFT.png`
- `evidence/r93/R93_HEAD_NEUTRAL_RIGHT.png`
- `evidence/r93/R93_HEAD_NEUTRAL_FRONT.png`
- `evidence/r93/R93_HEAD_NEUTRAL_TOP.png`
- `evidence/r93/R93_HEAD_NEUTRAL_THREE_QUARTER.png`
- `evidence/r93/R93_WHOLE_NEUTRAL_THREE_QUARTER.png`
- `evidence/r93/R93_WHOLE_PROCEDURAL_THREE_QUARTER.png`
- R9.1 baseline left and three-quarter captures

## Decision

```text
r9_3TechnicalGatePassed=true
r9_3BrowserCapturePassed=true
r9_3ManualVisualAcceptance=false
r9_3WholeHeadVisualGatePassed=false
rigAuthorized=false
motionAuthorized=false
```

R9.3 is rejected as the canonical head baseline. It is technically reproducible, but its whole-head morphology remains outside the approved visual target.

## Direct visual findings

### 1. Cranium and neck still read as one long wedge

The left and three-quarter silhouettes do not produce a distinct compact head mass. The upper contour remains a long, nearly planar slope from the neck into the bill. The posterior cranium is not separated clearly from the neck carrier.

### 2. Plan-view head shape is too long and triangular

The top capture shows an elongated triangular plan rather than a compact ovoid cranium tapering into a short bill. The comb is seen as a thin blade/strip instead of a fleshy structure rooted into the skull envelope.

### 3. Bill proportions and mouth relationship are incorrect

The bill remains too long and too thin at the tip. The root is insufficiently deep, while the lower bill/throat transition forms a deep V-shaped cavity. In the front view the bill and mouth surfaces read as overlapping or open rather than as a stable, closed bilateral form.

### 4. Eye system does not read as a natural eye

The outer eye/eyelid patch reads as a large circular disc while the actual visible iris/pupil remains pin-sized. The eye-to-cranium scale and facial placement do not match the approved reference relationship.

### 5. Comb and soft-tissue attachments remain detached

The comb reads as separated spikes and a thin sheet rather than one continuous thick single-comb body with rounded lobes and a broad embedded base. Ear-lobe and wattle candidates read as small floating patches rather than tissue attached to the jaw/face carrier.

### 6. Left/right surface quality is inconsistent

The right view exposes pronounced faceting and ridge artifacts across the cranium. This is not merely a material issue; it indicates that the current localized deformation is still fighting the longitudinal sweep topology.

### 7. Whole-body view confirms poor head/neck integration

The head reads as a small pointed termination on a long neck rather than a distinct cranial mass joined to the neck. The body, wing, tail and feet are outside this correction scope and remain frozen.

## Root-cause assessment

The principal blocker is structural. The current main carrier is a longitudinal station sweep shared by body, neck and head. R9.2 showed that full-ring edits inflate neck and head together. R9.3 restricted displacement to upper bands, but that restriction still cannot create an independently rounded cranium, stable jaw support and compact bill root without producing ridges or a wedge silhouette.

Continuing to tune the same station-band deformation would be an incremental-patch fallacy: it assumes more parameter adjustment can solve a topology/representation problem. The next stage must change the head representation, not merely push the same rings again.

The approved image remains a visual construction target, not measured anatomy and not proof of breed, sex, age or individual identity. R9.4 must therefore remain a generic domestic-chicken visual candidate with explicit uncertainty.

## R9.4 correction route

1. Keep exact R9, R9.1, R9.2 and R9.3 rollback files.
2. Freeze body, plumage, wing, tail and feet.
3. Introduce a compact head-local coordinate cage or independent procedural cranial carrier around the eye/occipital region.
4. Form a rounded posterior cranium and crown before touching local face modules.
5. Build the bill root and lower jaw as separately controlled local fields, with a short deeper bill and a closed mouth seam.
6. Reproject eye, eyelid and nostril modules to the corrected carrier; enlarge the visible eye rather than the outer socket disc.
7. Rebuild the comb as one continuous thick blade with rounded lobes and a broad embedded root.
8. Reattach ear-lobe and wattle tissue to the jaw/face support surface.
9. Correct the fixed review cameras: identical head scale, stable top-view camera up vector, and centered front/top framing.
10. Repeat left, right, front, top, three-quarter and whole-body neutral-gray captures before procedural material review.

## Gate for the next candidate

R9.4 may advance only when all of the following are visually true:

- a distinct rounded cranium is visible in left and three-quarter views;
- the posterior head transitions into the neck without a straight wedge;
- top view is compact and ovoid rather than triangular;
- the bill is short, deeper at the root and bilaterally stable;
- the mouth seam is closed and the throat transition is supported;
- the eye reads as an eye rather than a disc plus pinhole;
- comb, wattle and ear-lobe tissue are visibly attached;
- left/right silhouettes are consistent and free of large ridges;
- whole-body head/neck integration reads as a domestic chicken;
- manual visual acceptance remains false until direct review confirms these gates.
