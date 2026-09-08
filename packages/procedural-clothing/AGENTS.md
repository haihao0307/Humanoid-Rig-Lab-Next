# HRL-M04 Procedural Clothing Guardrails

1. This package reads humanoid proportion and final pose state. It never mutates the humanoid rig, bind data, body geometry, or frozen regions.
2. Garment source truth is versioned DNA, pattern functions, seam graphs, material functions, and fit contracts.
3. Runtime geometry must be rebuilt from source truth into TypedArray payloads.
4. External garment meshes, imported garment geometry, remote asset references, and bitmap surface inputs are prohibited.
5. A new body proportion revision invalidates the previous fit contract and requires recompilation.
6. A pose update reuses the compiled payload and consumes `simulationRig.finalPose` skin matrices.
7. Whole-garment XYZ scaling cannot replace measurement-driven fitting.
8. Every binary payload must preserve body, garment, material, pattern, topology, and content identities.
9. Changes to the old `packages/clothing-system` require a separate migration task. This package does not silently overwrite it.
10. Dynamic cloth must consume MaterialDNA properties and retain deterministic replay inputs.
