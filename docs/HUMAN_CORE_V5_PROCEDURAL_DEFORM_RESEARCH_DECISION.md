# Human Core V5 Procedural Deform Research Decision

## Scope and provenance rule

This review used original papers, author project pages, and official Three.js documentation. No third-party model, scan, training data, weights, or source implementation was copied into the repository. The implementation is an independent analytic and deterministic browser-oriented design.

## Sources reviewed

### SMPL

- Paper: [SMPL: A Skinned Multi-Person Linear Model](https://virtualhumans.mpi-inf.mpg.de/papers/SMPL15/SMPL15.pdf)
- License portal: [SMPL model license](https://smpl.is.tue.mpg.de/license.html)

Adopted conceptually: separation of identity/shape, pose, skeletal transforms, and pose-dependent deformation; explicit awareness of LBS and DQS tradeoffs.

Rejected for this phase: using the SMPL model or data as the generated Human Core surface. The procedural page must work without a human GLB and the SMPL model/data are governed by their own license. Existing repository SMPL files remain compatibility references only.

### STAR

- Project: [STAR](https://star.is.tue.mpg.de/)
- Paper: [STAR: Sparse Trained Articulated Human Body Regressor](https://download.is.tue.mpg.de/star/star_paper.pdf)
- Official repository: [ahmedosman/STAR](https://github.com/ahmedosman/STAR)

Adopted conceptually: sparse, spatially local, joint-conditioned deformation is preferable to broad global corrections.

Rejected for this phase: trained regressors, model parameters, code, and data. The official distribution is limited to non-commercial scientific research; this repository records the idea only and implements independent analytic sparse corrections.

### Implicit Skinning

- Author project page: [Implicit Skinning: Real-Time Skin Deformation with Contact Modeling](https://rodolphe-vaillant.fr/entry/31/implicit-skinning-real-time-skin-deformation-with-contact-modeli)

Adopted conceptually: local implicit fields can correct volume loss and contact artifacts around articulation regions.

Engineering choice: use small deterministic field corrections around selected joints after region/DQS deformation. The full contact-skinning system and source implementation are not imported.

### SNARF

- Project: [SNARF](https://xuchen-ethz.github.io/snarf/)
- Paper: [Differentiable Forward Skinning for Animating Non-Rigid Neural Implicit Shapes](https://openaccess.thecvf.com/content/ICCV2021/papers/Chen_SNARF_Differentiable_Forward_Skinning_for_Animating_Non-Rigid_Neural_Implicit_Shapes_ICCV_2021_paper.pdf)

Useful insight: canonical implicit shape and forward skinning can maintain a clean separation between shape and pose.

Rejected route: neural field training, iterative root finding, and learned deformation weights in the browser. They exceed this phase's deterministic runtime, licensing, latency, and reproducibility goals.

### Dyna

- Paper: [Dyna: A Model of Dynamic Human Shape in Motion](https://virtualhumans.mpi-inf.mpg.de/papers/ponsmollSIGGRAPH15Dyna/ponsmollSIGGRAPH15Dyna.pdf)

Useful insight: motion-dependent soft-tissue deformation is distinct from skeletal pose correction.

Rejected route: learned dynamic soft-tissue simulation. Task 13 has no licensed training corpus and does not claim realistic muscle or soft-tissue dynamics. AnatomyState supplies bounded semantic signals only.

### Three.js

- [MarchingCubes](https://threejs.org/docs/pages/MarchingCubes.html)
- [WebGPURenderer](https://threejs.org/docs/pages/WebGPURenderer.html)
- [WebGPU renderer manual](https://threejs.org/manual/en/webgpurenderer)
- [StorageBufferAttribute](https://threejs.org/docs/pages/StorageBufferAttribute.html)

Adopted: Three.js as a renderer adapter, WebGPU-first initialization, and WebGL2 fallback behavior.

Rejected for core extraction: coupling the canonical field/surface generator to the Three.js MarchingCubes addon. Core extraction remains Three-free and deterministic. `StorageBufferAttribute` is WebGPU-specific, so the default cross-backend path remains CPU TypedArrays uploaded through ordinary BufferGeometry. An unfinished GPU compute path is not enabled.

## Final engineering decision

Task 13 uses:

```text
analytic canonical body field
+ deterministic stable topology extraction
+ field-contribution region binding
+ local-quaternion FK
+ regional DQS blending
+ bounded local implicit correction
+ renderer-only Three.js adapter
```

This combination satisfies the current requirements without a second Rig, a second state center, per-frame remeshing, neural training, runtime weight generation, or required GLB assets. It is a development foundation whose visual quality must still be accepted in a real browser before production claims are allowed.

## License boundary

- No SMPL, STAR, SNARF, Dyna, or Implicit Skinning code/data/model was added.
- No third-party notice change is required for copied material because none was copied.
- Existing repository dependencies and compatibility assets retain their existing notices and licenses.
- Future adoption of any model parameters, datasets, or source implementation requires a separate license review and THIRD_PARTY_NOTICES update before inclusion.
