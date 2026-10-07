# Fibric-class native reference R0 receipt

Date: 2026-10-07
Commit: `a1cbae9c18abacc0d9a4f1eb4cf169ef90df9dd5`
Workflow: `Fibric native multifiber reference render`
Run: `37597069575`
Status: geometry/render pipeline passed; Fibric visual match NOT accepted.

## What ran

- Independently authored 12x12 algorithm-test herringbone draft repeated 3x3.
- Deterministic metric centerline compiler: 72 warp/weft curves, 20,808 centerline points.
- Three helical plies per yarn: 216 true 3D curve splines.
- 240 additional fuzz splines.
- Blender 4.0.2, Cycles CPU, Principled Hair BSDF, 48 samples.
- Two real path-traced views: normal/macro and grazing.
- Saved editable native scene: `multifiber_reference.blend`.

All generation, scene construction, Cycles rendering, nonblank-image checks and artifact upload passed in GitHub Actions. This is not a screenshot substitute: the scene was built from generated curve geometry, synchronized into Cycles, BVH-built and path traced.

## Immutable QA facts

- `macro.png`: 3,270,937 bytes; SHA-256 `1ce25f5ce5ff14a249a340309b3bdaeb6225fccd9b203c08fc281f77dc270d8c`.
- `grazing.png`: 2,684,266 bytes; SHA-256 `7143f9cf49c19bc9b4dcc049efa40f802c56b5b8a34d4f1f194eeab9a65e79a0`.
- Native `.blend`: 3,266,820 bytes; SHA-256 `f68c7faa7419608715fb6204f93c662c174f68bb458fd77c74e8f56b0028fc9b`.
- Shader mode used: `principled_hair`.
- Official Fibric pattern used: `false`.
- Accepted as Fibric match: `false`.
- Public workbench delivered: `false`.

## Direct visual diagnosis

The key route has been proven: actual over/under yarn geometry, multifiber twist, fuzz and a fiber path tracer now run end to end. The current R0 is still visibly a sparse technical weave specimen, not a cinematic Fibric sample. The largest defects are:

1. The algorithm fixture is not the missing official `herringbone_12x12.exr`.
2. Yarn packing is too open; the gap ratio dominates the read as a mesh/net rather than dense cloth.
3. The yarn envelope is too cylindrical and regular; compressed contact cross-sections and flattening are missing.
4. Crimp is generated from centerline height only; contact-aware detangling and local tangent/curvature redistribution are not yet applied.
5. Ply fibers are too uniformly spaced, while real yarn requires stochastic radius, orbit and phase variation constrained by the parent yarn.
6. Fuzz is present but not yet anchored to measured density, direction and length distributions.
7. The path-traced material has not been calibrated against the official target camera, lighting and color management.
8. No deformation transfer or browser LOD runtime has entered this native reference gate.

## Next bounded defect

`FIBRIC_OPEN_HERRINGBONE_R01 / DENSE_CONTACT_YARN`

Implement contact-aware elliptical yarn envelopes and dense packing before adding more visual decoration. The next numeric gates are:

- explicit yarn-to-yarn contact clearance at every crossing;
- no parallel-yarn overlap;
- controllable ellipse major/minor axes and local flattening at contacts;
- target open-area ratio recorded rather than guessed;
- deterministic over/under IDs preserved after contact relaxation;
- same metric geometry exported to native reference and browser tiers.

The project must not compensate for sparse/wrong geometry with stronger shader contrast, bloom, noise or a flat normal map.
