# Life Behavior Room R06 — isolated workstream

This directory is an isolated experiment on branch
`experiment/life-behavior-room-r06-20261024`. It is not imported by the production
runtime, is not merged into `main`, and must not modify the canonical character
identity, proportions, rig topology, inverse bind matrices, skin weights, or
source motion clips.

## Primary objective

Improve a *continuous household task*, not a collection of isolated button demos:

1. approach the table and decelerate into a stable stance;
2. coordinate pelvis, spine, shoulders, elbows, wrists, hands, knees and feet while reaching;
3. establish two-hand contact without penetrating the object;
4. lift with the object kept close to a feasible carrying envelope;
5. walk and turn while preserving stance-foot contacts and object grip;
6. align with a shelf, lower the object onto real support, confirm it is settled;
7. release and withdraw both hands along a checked path;
8. return to a stable standing posture and continue to another task without resetting.

The same skills should then be tested against changed table heights, shelf heights,
object sizes/masses, approach angles, and blocked routes. Passing one fixed scene is
not evidence of generalization.

## Implementation boundary

- `trajectory.mjs` contains pure interpolation and per-update step-limit helpers.
- `canAdvanceLifePhase` requires explicit evidence for support, joint limits,
  body clearance, contact, and object state. Elapsed time alone is not a completion gate.
- These helpers are not a full-body dynamics policy, collision engine, or learned
  locomotion controller. The caller must supply measurements from the real rig,
  collision checks, and physics world.
- The canonical Humanoid Rig Lab modules are referenced as dependencies, not copied
  or changed by this experiment.

## Acceptance gates

A skill is not marked usable unless all of the following pass in the real runtime:

- unchanged character proportions, rig topology, bone lengths, skin weights and bind data;
- no unverified phase transition;
- support-foot drift and object-grip residual stay inside calibrated tolerances;
- no body/object, body/furniture, or self-intersection beyond the validated collision tolerance;
- release only after object support and settling are confirmed;
- no abrupt pose/velocity discontinuity at phase boundaries;
- real-time browser review at normal playback speed, not only accelerated simulation;
- held-out scene variations pass without tuning on those same scenes;
- failures are preserved and cannot overwrite the last known-good skill parameters.

## Multi-task evaluation sequence

Run the same character and physics world without resetting between steps:

A. walk → stop → reach → pick up crate → carry → place → release → withdraw;
B. retrieve the crate from the shelf and return it to the table;
C. repeat with a book and a canister (different grasp geometry);
D. open a door while one hand is occupied, then pass through and close it;
E. ascend/descend stairs with and without a carried object;
F. open a high window using a reachable stance, then close it;
G. repeat with altered dimensions and a blocked preferred route.

A failed task is a valid test result, not a successful training sample. Keep baseline,
candidate, and held-out reports separate.

## Current state

R06 branch scaffolding and pure-helper regression tests have been added. The helpers
have not yet been integrated into the live hosted R05 page; no claim is made that
the hosted runtime has changed, that browser/GPU physics has been validated, or that
naturalness has passed visual acceptance. Continue implementation in this branch
and publish a new standalone page only after runtime integration and real-browser
review. Keep the old hosted page available as the baseline.
