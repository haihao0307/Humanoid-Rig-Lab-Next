# ET08-S1.1 — closed-surface repair

Continues Draft PR25 from `bbd6de3ed7904429c7720e74c2297d1f04862314`. Same head asset, eye radius, iris ratio, XY ocular centres, texture files, and gray review. No merge or history rewrite.

## Root cause

The old update propagated the difference between the observed closed crease and a globe-contact free margin across the whole skin patch. Two rim curves coinciding did not restore the closed outer surface. Their zero mutual gap was not a whole-surface test, and left a U-shaped pocket and inflated pads.

The original motion was already upper-lid dominated (about81% at the central neutral section). No unsupported universal75–85% rule was added. The independent XY contours and closed curve are not arbitrarily flattened. The earlier prose-only diagnosis of symmetric closure was incorrect.

## Geometry repair

ClosedSurface.js builds a boundary-constrained fair rest surface from the SAME captured closed scan. Full closure returns the whole upper/lower patch to that rest target; intermediate states retain continuous, globe-protected blending. Corners remain fixed to the captured facial anchors. Posterior corner rows are brought towards those anchors so a long membrane does not connect directly back to the globe equator.

Raw frontmost-ray samples through a closed eyelid overhang are discontinuous. Directly triangulating those samples produced a stair-shaped line; a boundary-constrained fairing pass removes this resampling artifact. The fair rest surface is NOT an exact copy of every raw scan vertex. Its maximum change from the raw resampled height field is recorded in `closedTargetMaxDeviationFromRawScanMM` (about1.70mm right and1.30mm left in the current fit). Tiny closure-target residuals in QA measure adherence to this fitted target, NOT medical/identity accuracy. This is geometric correction, not volume or arc-length conserving tissue physics.

The old depth fit inspected only a central0.8r disc. Full closed-envelope tests exposed an incompatible inferior peripheral part of the right globe. The refined fit checks the whole projected globe against the same scan: minimum required backward Z corrections are about0.893mm right and0.063mm left for0.12mm numerical clearance. Radius12.2mm, iris reference radius5.307mm and XY centres remain unchanged. Exact values are in the runtime calibration/QA; these are model measurements, not clinical data.

A three-pixel oblique-view leak was traced to the exact-equality boundary cut, not the closed free edge. The existing finite overlap ring now joins the surrounding head without an analytic gap. No eyeball is hidden and no black cover object is introduced. Face-edge normals are locked after the closed-target blend, removing the circular lighting boundary.

## Regression and review

The UI adds `完全闭眼 / 检查修复`, held `修复前的 U 形`, and `深仰视角 / 检查闭合`. New and old are compared at the same camera and lighting; the old geometry/calibration are genuinely restored for the held comparison.

Whole-surface residuals and contact samples are tested in addition to shared rim vertices. Object-ID passes test whether any eyeball is actually visible through a closed surface, with an open-eye positive control. Six ordinary camera views and three steep under-eye views are tested. `extreme.cjs` deliberately goes beyond the original mild low-angle preset, matching the user's underside inspection. Closure samples include0.75/0.85/0.9/0.95/0.98/1.0, and the immutable public entry is tested separately after publication.

Initial candidates were rejected for a0.833mm incompatible rest/contact residual, a three-pixel oblique leak, and visual resampling/normal seams; test thresholds were not weakened to accept them. Current build success and screenshots belong to the latest Actions run, not earlier failed candidates.

## Limits

This remains first-stage gray geometry. Upper-lid sectional detail, folds, lower-lid volume, inner-canthus anatomy, final material coordinates and eye optics are not claimed finished. A true individual open-eye reconstruction requires missing person-specific observations. Finite sampled tests are not exhaustive continuous collision certification. Desktop and390×844 mobile viewport checks are not mobile hardware tests. The user still performs visual acceptance.
