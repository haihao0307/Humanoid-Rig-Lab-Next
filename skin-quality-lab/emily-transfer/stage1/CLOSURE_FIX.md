# ET08-S1.1 closed-surface correction

Continues PR25 from bbd6de3ed7904429c7720e74c2297d1f04862314. Same head, radius, iris proportions, XY ocular centres, texture files, and gray review. No merge or history rewrite.

The old update propagated the difference between the observed closed crease and a globe-contact free margin across the whole patch. Closing the two rim curves did not restore the closed scan envelope. Their zero mutual gap was not a whole-surface test. That left a U-shaped pocket and inflated pads.

ClosedSurface.js now stores the observed closed-scan outer envelope, supports fixed canthal depths from that same scan, and returns the whole upper/lower skin surface to that envelope at full closure. Intermediate states retain a smooth contact-protected blend. This is a geometric rest-surface correction, not tissue physics or volume/arc-length conservation.

The old depth fit only inspected the central 0.8r disc. The full-surface regression revealed an incompatible peripheral inferior part of the right globe. The new fit checks the entire projected globe and closed patch, moving only the minimum necessary Z distance for 0.12 mm numerical clearance; the radius and XY centre do not change. Exact shifts are recorded in the runtime calibration and QA report, not asserted as medical measurements.

The original motion was ALREADY upper-lid dominated (roughly 81% at the central neutral section). No unsupported universal 75–85% motion rule was added, and the accepted XY contours are not arbitrarily flattened. The previous prose-only diagnosis of symmetric closure was incorrect.

Verification adds whole-surface residuals, complete-closure object-ID visibility checks at six angles, and near-closure steps from 0.75 to 1.0. The detector must also see the open globe, preventing an always-zero false pass. The eyeballs remain enabled throughout.

The initial candidate was rejected by its new regression because right lower closed-surface residual was 0.833 mm. This exposed the incomplete old depth fit rather than being accepted with looser test thresholds. Final results depend on the latest successful Actions report and visual screenshots.

First-stage gray review only. No claim that eyelid folds, canthal micro-anatomy, true individual open-eye capture, or all continuous motions are finished. Desktop and mobile viewport checks are not mobile hardware tests.
