# Task 14C-1A2a canonical intersection provenance

## Scope and baseline

- Starting branch: `feature/human-core-v5-task14c-geometry-v1`
- Starting commit: `277622955c13e9ad52fb4a2ed29b211a35c1e859`
- Recovery bundle SHA256: `5EE31404D66395DDECDF29420EB409B98B566B5620D66E06CA95C73BC85B75C2`
- Diagnostic matrix: one completed matrix after one preflight aborted before evidence generation because the diagnostics-only fairing-disabled surface did not meet the production orientation mean gate. The production gate and formal output were not changed.
- Formal output remains unchanged in this diagnostic commit.

The machine-readable evidence is under
`artifacts/qa/task14c-geometry-v1/canonical-intersection-provenance/`.

## Root-cause decision

`firstIntroductionStage` is `fairing-projection`.

The zero-set projection moves locally separated surface triangles into penetrating configurations. In the formal Muscular resolution-36 legacy case, raw extraction, topology filtering, compaction, initial orientation, and the first lambda/mu passes all contain zero penetrating pairs. The first projection creates 42 penetrating pairs. The second projection raises the current count from 4 to 142. Half-space clamping and unsafe-triangle repair reduce these counts but leave 104 penetrating pairs in `canonical-final`.

The fixed initial gradient direction, vertex-by-vertex projection, and absence of an intersection-separation constraint are the primary mechanism. The existing unsafe repair guards area and orientation relative to the compacted surface; it does not test triangle-triangle penetration. Resolution sensitivity and incomplete cleanup by later fairing substages are secondary contributors.

## Stage evidence

| Case | Raw | Initial | Iteration 1 λ | Iteration 1 μ | Iteration 1 projected | Iteration 1 halfspace | Iteration 1 safe | Iteration 2 λ | Iteration 2 μ | Iteration 2 projected | Iteration 2 halfspace | Iteration 2 safe | Canonical | T | A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Muscular r36 legacy | 0 | 0 | 0 | 0 | 42 | 29 | 4 | 4 | 4 | 142 | 129 | 104 | 104 | 104 | 118 |
| Muscular r36 uniform | 0 | 0 | 0 | 1 | 39 | 28 | 18 | 4 | 18 | 137 | 126 | 116 | 116 | 116 | 123 |
| Muscular r36 fairing disabled | 0 | 0 | — | — | — | — | — | — | — | — | — | — | 0 | 0 | 0 |
| Muscular r48 legacy | 0 | 0 | 0 | 0 | 2 | 2 | 2 | 0 | 2 | 32 | 32 | 16 | 16 | 16 | 22 |
| Reference r36 legacy | 0 | 0 | 0 | 0 | 27 | 22 | 0 | 0 | 0 | 27 | 22 | 0 | 0 | 0 | 0 |

The uniform mode is not a repair: it ends with more Muscular intersections than legacy. Resolution 48 reduces but does not eliminate the projection-stage failure. Disabling fairing proves that the raw surface remains separated, but is diagnostic-only and is not a production option. Reference is the control: projection creates temporary contacts that its existing safe repair fully removes.

## Muscular target clusters

Muscular T Pose contains two target-only pelvis/root-of-thigh clusters. Each has 43 penetrating pairs: 41 `pelvis/pelvis` and 2 pelvis/thigh. The left cluster covers triangles near x `[-0.0774, -0.0123]`, y `[0.8140, 0.8720]`; the right cluster is its bilateral counterpart. The remaining T Pose pairs are four non-target torso clusters and are outside this task's repair scope.

The nine supplied representative pairs all first become penetrating at
`fairing-iteration-2-projected`; none is penetrating in its raw-source pair.

| Final pair | Left source cube/tetra | Right source cube/tetra | Shared source relation |
| --- | --- | --- | --- |
| 80 / 2743 | 49,16,2 / 4 | 49,16,3 / 0 | face and edge |
| 80 / 2756 | 49,16,2 / 4 | 50,16,3 / 2 | edge |
| 80 / 2758 | 49,16,2 / 4 | 50,16,3 / 3 | none |
| 82 / 2755 | 49,16,2 / 5 | 50,16,3 / 1 | edge |
| 82 / 2756 | 49,16,2 / 5 | 50,16,3 / 2 | edge |
| 82 / 2757 | 49,16,2 / 5 | 50,16,3 / 2 | edge |
| 82 / 2758 | 49,16,2 / 5 | 50,16,3 / 3 | none |
| 83 / 2759 | 49,16,2 / 5 | 50,16,3 / 3 | none |
| 83 / 2760 | 49,16,2 / 5 | 50,16,3 / 4 | none |

The JSON evidence additionally contains grid corner IDs and positions, sampled corner field values, interpolated edges, source cell/tetrahedron bounds, exact scalar-field composition traces, and local OBJ witnesses. Every traced sample agrees with the formal field sampler to less than `1e-10`.

## Rejected hypotheses

- Raw extraction: legacy and uniform raw surfaces both have zero penetrating pairs.
- Initial orientation: compacted and initial-oriented are both zero.
- Legacy λ or μ as the earliest source: both are zero before the first projection.
- T-bind runtime: canonical and T counts are identical, while maximum and RMS T-bind displacement are exactly zero.
- Resolution-36 aliasing as the sole source: resolution 48 raw remains zero but formal fairing still ends at 16.
- A-pose-only runtime failure: T Pose already contains 104 penetrating pairs.

## Authorized repair direction

The applicable path is case B: intersection-preserving fairing. The repair must stay in `canonical-surface-fairing-v5.js`, constrain only newly introduced target-region penetrations, preserve topology, and keep all non-target counts from increasing. It must not change the body field, presets, detector thresholds, or disable fairing.

`visualAcceptance` remains `false`; `productionReady` remains `false`; dynamic joint work remains frozen.
