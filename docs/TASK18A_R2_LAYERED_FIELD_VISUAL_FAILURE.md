# Task 18A R2 Layered Field Visual Failure

## Decision

The user-provided real Chrome visual adjudication supersedes the earlier automated `BROWSER_EVIDENCE_INCONCLUSIVE` status.

Final Task 18A R2 conclusion:

`LAYERED_FIELD_DYNAMIC_ARCHITECTURE_FAILED`

This is a terminal architecture decision under the Task 18A R2 two-round limit. It is not a request for a third tuning round.

## User-observed visual failures

1. Hip Flexion 90 produces a large circular cap at the thigh root.
2. The underside of the pelvis terminates in a flat cut plane.
3. Reference T Pose contains triangular hanging patches around the shoulder and axilla.
4. A visible seam crosses the chest center and the shoulder/chest connection.
5. Spine Twist 45 separates the thorax, abdomen, and pelvis into multiple visible blocks.
6. The 17 Local Charts and 17 Junction Fields do not form one continuous visible human zero-isosurface.

## QA contradiction

The recorded structural counters did not inspect the final visible zero-isosurface. In particular:

- `junctionGapMaximum = 0` contradicts the user-observed chest, shoulder, and torso gaps.
- `ghostChartCount = 0` did not detect hanging or duplicated visible chart surfaces.
- `missingRegionCount = 0` did not detect visible anatomical loss at cut boundaries.
- `illegalFusionCount = 0` described graph policy rather than final rendered-pixel topology.

These counters remain preserved as historical failed metrics. They must not be rewritten as passing visual evidence.

## Frozen architecture elements

The following are permanently retired from visible-human authority:

- Local Chart as an independent visible human surface.
- Junction Field as an independent gap-filling visible entity.
- Chart support OBB participation in the zero-isosurface.
- A third round of junction width, chart support, sheet ownership, or ray-candidate tuning.

The Local Chart and Junction assets remain archived as failure evidence only. They are not runtime authority for the successor architecture.

## Successor boundary

Task 19A must begin from this frozen failure checkpoint and establish a single canonical human SDF over a shared connected volumetric deformation domain. The successor must not hide or delete this record, the two-round reports, the standalone page, or the review package.
