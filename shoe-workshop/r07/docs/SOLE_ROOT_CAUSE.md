# R07 sole deformation root-cause review

The first R07 fit moved native cupsole lip vertices while retaining the coarse original CAD indices. Recomputing vertex normals introduced large heel facets. Inverse-transpose transport of native normals improved the field, but actual source49b2e70 early-render side inspection still showed narrow heel streaks: those long triangles could not represent the curved warp.

The isolated diagnostic branch at1c2eec61500d6549f439b3c4c70b3500d8dd926f kept the exact same displacement function and subdivided the ORIGINAL CAD faces before applying it. The actual diagnostic side frame removed the visible heel streaks. No new sole shape, cover mesh, generated image, shader darkening or flattened lighting substituted for the geometry correction.

Each child triangle carries its original parent during construction. Before deformation the children cover the same parent surface with matched area and orientation. Every shared indexed edge is split once, avoiding T-junctions. Consequently the original data and surface are retained, but the rendered index buffer is explicitly NOT unchanged. Earlier index-retention language is superseded by this stronger source-surface preservation check.

At default thickness the diagnostic produced42985 vertices/79636 triangles from10772 vertices/15528 source triangles. Nine bounded refinement passes left61 edges above the0.03mm diagnostic threshold, maximum measured midpoint interpolation discrepancy about0.1525mm. Do not advertise the0.025mm target as a achieved global bound or manufacturing tolerance. Face-area equality is a source-preservation check, not a full collision proof. Final numbers must be read from the current QA receipt.

Normals are normalized after interpolation and transported through the same deformation, not averaged over coarse warped triangles. The default/current session cache restores geometry and its contact frames together; no baked sole data is shipped. Earlier running R07 verification is superseded when newer source arrives; the workflow cancels only the same R07 branch's obsolete job.

- [x] Real source and procedural geometry modified, not a generated-image substitute.
- [x] Original-derived shoe and inherited leather retained.
- [ ] Final current-source file/public browser and immutable-byte verification; see current evidence.
- [ ] User visual or manufacturing approval.
