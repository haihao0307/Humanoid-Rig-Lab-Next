# Cat Reference Inversion Method V4.22

## Canonical rule

Every cat surface must be derived from an identified reference, an explicit coordinate frame and a measured reconstruction error. Visual tuning without source-space comparison cannot freeze a region.

## Processing stages

```text
A. Source identity and license lock
B. Immutable source hash and receipt
C. Coordinate, unit, pose and anatomical-region registration
D. Reference geometry or image-volume extraction
E. Region-specific function recording
F. Independent procedural reconstruction
G. Bidirectional surface-distance measurement
H. Local refinement of failed regions
I. Pose and joint-transition audit
J. Deterministic binary packing and byte-identical recovery
K. User visual acceptance
```

## Region function families

* Trunk and broad cranial envelope: longitudinal sections with Fourier radial functions.
* Limbs and tail: centerline sweep with anisotropic cross sections and curvature-controlled frames.
* Paw and digits: shared palm field with individual digit branches and contact-surface constraints.
* Ear pinnae: thin-shell charts with a shared root boundary on the head surface.
* Axilla, groin and joint folds: bounded local charts or signed-distance residual fields.
* Cavities, teeth and separated mandible surfaces: separate topological charts. A single radial envelope cannot represent them faithfully.

## Error measurements

The audit must calculate both directions:

```text
reference → replica
replica → reference
```

For each region, record count, mean, RMS, p50, p95, p99, maximum distance and the position of the maximum error. One-way distance cannot establish one-to-one fidelity because it can miss extra volume, collapsed cavities and false protrusions.

## Freeze conditions

A region can freeze only when:

1. source identity, unit, pose and coordinate frame are locked;
2. reference coverage is adequate for that region;
3. direct and reverse distance gates pass;
4. topology and normal orientation checks pass;
5. adjacent-region seams remain continuous;
6. the required joint poses do not collapse, penetrate or stretch incorrectly;
7. deterministic regeneration and byte-identical packed-data recovery pass;
8. the user accepts the fixed public preview.

Until all conditions pass, `oneToOneAccepted`, `visualAcceptance` and `productionReady` remain false.
