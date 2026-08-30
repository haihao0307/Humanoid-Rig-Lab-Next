# Anatomical Skeleton S1 Derivation Notes

## Scope and authority

This S1 package compiles a core joint-center scaffold and two project-authored procedural femora. It does not claim a complete 206-bone surface, medical accuracy, muscle, fascia, fat, skin, motion, or behavior implementation.

The authority chain is:

```text
BodyDNA dimensions
→ SkeletalDNA revision
→ AnatomicalGraph
→ LongBoneGeneratorV1
→ Compiled AnatomicalProfile
→ read-only HumanRigCore mapping report
```

`HumanRigCore` and `finalPose` are never written. The geometry compiler has no loader for GLB, glTF, OBJ, FBX, STL, Blend, DAE, external POSITION, external index, external topology, external skin weights, or hidden base64 assets.

## Coordinate and numeric rules

- right-handed coordinates
- `+Y` up, `+Z` character forward, `+X` character right
- meters and degrees in JSON
- Float32 positions/normals and Uint32 indices in `.hrlbone`
- deterministic seed `7312026`
- precision identity `float32-deterministic`

## Skeleton scaffold derivation

The existing BodyDNA reference dimensions provide height, shoulder/pelvis width and limb lengths. S1 establishes stable anatomical IDs and builds straight core line segments between computed joint centers. These lines are motion-contract and placement scaffolds; they are not final anatomical bone surfaces.

Left/right joint centers are evaluated from the same parameter contract with explicit side signs. The asymmetry variant changes left and right femur length parameters independently. No object, mesh, scene, or bone uses negative scale.

## Femur generator derivation

`LongBoneGeneratorV1` produces a closed generalized tube with explicit lower and upper poles, independently sampled cross-section rings, project-owned triangle topology, and area-weighted normals. Its regions are parameterized as:

1. distal condylar envelope and intercondylar posterior indentation;
2. metaphyseal transition;
3. elliptical diaphyseal shaft on a curved centerline;
4. greater and lesser trochanter analytic bumps;
5. neck transition driven by neck length and neck-shaft angle;
6. proximal head envelope driven by head radius.

Femoral anteversion rotates proximal cross sections progressively around the long axis. The right side executes the same formula with right-side signs and its own output buffers; it is not a mirrored mesh.

LOD sampling is fixed by generator version:

| LOD | Longitudinal segments | Radial segments |
| ---: | ---: | ---: |
| 0 | 72 plus bounded surface-detail rows | 32 |
| 1 | 40 | 20 |
| 2 | 24 | 12 |

## Reference normalization

- Proximal femur millimeters and centimeters are converted to meters; head diameter is divided by two for radius.
- The PLOS CT cohort mean antecurvation radius, `943 mm`, is retained as `0.943 m` provenance. S1 uses a bounded analytic centerline offset; it does not reconstruct any CT surface.
- Distal AP/ML defaults are the arithmetic means of the reported male and female means in the 100-subject Malay cohort, converted to meters.
- Femoral version `11.0°` and neck-shaft angle `129.9°` use the reported means from the 1,576-hip CT cohort.

## Pending parameters

The pilot values for greater-trochanter size, lesser-trochanter size, intercondylar-notch width, cortical thickness, and local surface-detail amplitude do not yet have a locked population/measurement contract. Their receipt confidence is `pending`. They remain bounded generator controls and cannot be presented as clinical reference values.

The task is not blocked because femur length, head/neck scale, neck-shaft angle, anteversion, shaft curvature, and distal envelope dimensions have traceable sources. A later anatomy revision must replace pending values before claiming population-specific or medical accuracy.

## Variants and invalidation

| Variant | Revision | Changed inputs | Regenerated IDs |
| --- | ---: | --- | --- |
| baseline | 1 | baseline | both femora and compiled package |
| long_femur_plus_08_percent | 2 | thigh/femur length `+0.8%` | both femora, knees/ankles/feet, profile hashes |
| anteversion_plus_10_degrees | 3 | femoral anteversion `+10°` | both femur surfaces and profile revision |
| left_right_asymmetry_02 | 4 | left `+0.2%`, right `-0.2%` | both femora and same-side distal joint chains |

Returning to revision 1 reconstructs the original baseline byte sequence and SHA256.
