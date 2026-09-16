# Chicken V4.6 R9.3 — Independent Visual Audit

## Decision

`R9.3` passes its static, browser, bounded-displacement and capture gates, but it is **rejected as the next visual baseline**.

This is not a technical rollback. The executable, parameters, QA and evidence remain valid historical records. The rejection concerns the visible head construction only.

```text
r9_3TechnicalGatePassed=true
r9_3BrowserQAPassed=true
r9_3VisualBaselineAccepted=false
manualVisualAcceptance=false
wholeVisualGatePassed=false
rigAuthorized=false
motionAuthorized=false
productionReady=false
```

## Why technical success does not prove visual success

Finite geometry, a running browser page, bounded edits and generated screenshots only demonstrate that the candidate executes reproducibly. They do not demonstrate that the head silhouette, facial carrier or local anatomical relationships match the approved construction reference. Treating these gates as visual acceptance would conflate implementation integrity with morphology.

## Evidence reviewed

- `reference/head/APPROVED_HEAD_SHAPE_REFERENCE_2026-09-15.png`
- `evidence/r93/R91_BASELINE_HEAD_NEUTRAL_LEFT.png`
- `evidence/r93/R91_BASELINE_HEAD_NEUTRAL_THREE_QUARTER.png`
- `evidence/r93/R93_HEAD_NEUTRAL_LEFT.png`
- `evidence/r93/R93_HEAD_NEUTRAL_RIGHT.png`
- `evidence/r93/R93_HEAD_NEUTRAL_FRONT.png`
- `evidence/r93/R93_HEAD_NEUTRAL_TOP.png`
- `evidence/r93/R93_HEAD_NEUTRAL_THREE_QUARTER.png`
- `evidence/r93/R93_WHOLE_NEUTRAL_THREE_QUARTER.png`
- `evidence/r93/R93_WHOLE_PROCEDURAL_THREE_QUARTER.png`

## Visible failures

### 1. Whole-head carrier

The cranium remains too long and wedge-like. R9.3 adds local upper volume, but the eye-to-occiput and crown-to-bill relationships still read as one stretched carrier rather than a compact rounded skull joined to a distinct bill.

### 2. Crown and forehead

The crown is fuller than R9.1, but the surface still contains planar breaks. The approved reference requires a smooth crown–forehead–bill-root slope. R9.3 retains an angular transition and a visible notch near the bill root.

### 3. Bill construction

The bill is shorter, but shortening alone does not repair its shape. It remains a thin wedge with weak upper/lower bill differentiation and an abrupt facial insertion. The frontal view also shows an incoherent mouth/throat cavity rather than a clean closed keratin envelope.

### 4. Eye and eyelid

The enlarged eye patch reads as a shallow circular plate. The iris/pupil is visually tiny relative to the geometric patch, and the eyelid does not convincingly seat the eye into the cranium.

### 5. Ear-lobe candidate

The ear-lobe patch still reads as a second eye or hanging circular marker. It is too isolated from the surrounding facial surface.

### 6. Comb attachment

The continuous-comb generator remains technically valid, but the current narrow peaks and carrier attachment create a jagged silhouette. The comb cannot be accepted independently of the corrected skull roof.

### 7. Frontal and top views

The frontal view exposes severe folding/cavity-like forms around the bill and throat. The top view remains too pointed and does not maintain a smooth width transition from cranium to bill.

## Cause assessment

R9.3 still edits a problematic inherited head carrier with local offsets. Local offsets can improve dimensions while preserving the wrong low-frequency organization. Further tuning of the same small offsets has diminishing returns and risks accumulating folds or self-crossing near the bill.

## R9.4 implementation rule

R9.4 must begin again from the exact frozen R9.1 executable and replace the upper head carrier field, not merely add another offset layer.

Required rules:

1. Preserve the exact R9 and R9.1 rollback files.
2. Keep body, plumage, wings, tail and feet unchanged.
3. Re-establish regular constant-X head stations before deformation.
4. Build a smooth rounded upper-cranium field with explicit posterior, crown, forehead and cheek profiles.
5. Rebuild the bill as a closed asymmetric parametric envelope with consistent station compression and a shared cap transform.
6. Add geometric checks for station monotonicity, finite values, triangle degeneracy, local foldovers and non-head movement.
7. Refit eye, eyelid, nostril, ear-lobe, wattle and comb only after the carrier is stable.
8. Produce fixed left, right, front, top, three-quarter and whole-body captures.
9. Keep all visual and rig gates false until manual review.

## Status after audit

The active accepted baseline remains frozen R9/R9.1 historical geometry. R9.3 remains an auditable rejected candidate. Development proceeds on an isolated R9.4 branch.
