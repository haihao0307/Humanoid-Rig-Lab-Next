# Task 14C Projection Visual Pilot A

## Scope

- Baseline: `f3bc99f0f88bf5eadd946ae022ed9a0b79e53d35`
- Branch: `experiment/human-core-v5-projection-visual-pilot-r48`
- Resolution: 48
- Presets: Reference and Muscular
- Modes: default `legacy` and explicit `collision-aware-pilot`

This is an isolated experiment. The production default remains `legacy`; the candidate remains experimental, `visualAcceptance=false`, and `productionReady=false`.

## Result

| Scenario | Legacy total / target | Candidate total / target | Topology candidate | Field error delta | Measurement deltas |
| --- | ---: | ---: | --- | ---: | --- |
| Reference T | 0 / 0 | 0 / 0 | 1 component, 0 boundary, 0 non-manifold, 0 degenerate ratio | 0 | height 0, shoulder 0, hip 0 m |
| Muscular T | 16 / 0 | 16 / 0 | 1 component, 0 boundary, 0 non-manifold, 0 degenerate ratio | 0 | height 0, shoulder 0, hip 0 m |
| Muscular A | 22 / 0 | 22 / 0 | 1 component, 0 boundary, 0 non-manifold, 0 degenerate ratio | 0 | height 0, shoulder 0, hip 0 m |

The Muscular intersections are limited to pre-existing `lowerTorso/lowerTorso` and `upperTorso/upperTorso` pairs. No new Region Pair appeared. All six target Region Pairs remain at zero in T and A poses.

The candidate guard ran ten checks per generated surface. It reverted no Muscular vertices because resolution 48 introduced no target-pair intersection. On Reference it locally restored 34 unique vertices across the two projection substages and returned both stages to zero target intersections, which proves the explicit candidate path was active without changing the final reported shape metrics.

Candidate generation took 14,817.5772 ms versus 1,373.8310 ms for Reference and 13,498.3754 ms versus 1,487.2923 ms for Muscular. Performance is recorded but is not a stop gate for this pilot.

## WebGL2 and visual audit

The independent WebGL2 page produced all twelve 960 x 960 comparison images plus the 1920 x 1080 contact sheet. Each captured page reported zero console errors, zero page errors, zero GLB requests, and a present geometry buffer.

With identical cameras, lights, material, and viewport, Candidate and Legacy are visually equal in the Muscular T and A full-body silhouettes, pelvis front views, pelvis side view, thigh roots, and groin gap. No candidate-only dent, planar cut, bulge, facet regression, or Reference silhouette regression was observed. The existing resolution-48 surface faceting and the non-target torso intersections are unchanged and are not claimed as repaired.

## Conclusion

`CONTINUE_PROCEDURAL`

The candidate satisfies the pilot's target-pair, topology, measurement, Reference, and visual-equality gates. This result supports continued procedural investigation at resolution 48; it does not promote the candidate to the production default and does not establish an improvement for Muscular where the legacy surface already had zero target-pair intersections.

The experiment follows the narrow collision-aware principle described in research on intersection-avoiding mesh smoothing while retaining the existing non-shrinking fairing path rather than replacing it: [Intersection-Free Contour Smoothing](https://pmc.ncbi.nlm.nih.gov/articles/PMC5590917/) and [Taubin, A Signal Processing Approach to Fair Surface Design](https://graphics.stanford.edu/courses/cs468-01-fall/Papers/taubin-smoothing.pdf).
