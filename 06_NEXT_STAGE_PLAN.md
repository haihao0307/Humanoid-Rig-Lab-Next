# Next Stage — Chicken Phase 1 Environmental NPC

## Fixed priority

1. Morphology
2. Motion
3. Grounding and collision
4. Controlled individual variation
5. Minimal behavior
6. Complex life activity later

## Execution order

### 1. Gameplay-distance morphology freeze

Review R9.8.3 at an equivalent 3–5 m scene distance. Correct only low-frequency errors that prevent immediate chicken recognition, natural head/neck motion, stable leg articulation or collision-proxy placement. Do not continue unlimited close-up reconstruction.

Required views: left, right, front, top, three-quarter and whole body.

### 2. Single-agent motion foundation

Implement and validate:

- idle_stand
- look
- peck
- walk
- stop
- turn
- short_run
- wing_balance

Motion must preserve bone length, update facing direction, use foot-contact events and avoid whole-body pivot shortcuts.

### 3. Single-agent physical stability

Add simplified body/head collision proxies, two foot-ground contacts, obstacle response and temporary-blockage replanning. Contact must not terminate the task.

### 4. Small-herd test

After one chicken is stable, test 6–12 individuals with bounded seeded differences in body scale, gait speed, motion phase, comb scale, tail angle and plumage parameters. Use soft separation and neighborhood queries instead of full mesh rigid-body simulation.

### 5. Phase 1 freeze

Freeze the reusable Chicken environmental NPC mother only after morphology, motion, grounding, collision and small-herd stability pass. Nesting, breeding, detailed feeding ecology and other life activities remain deferred.

See:

- `CHICKEN_PHASE1_ENVIRONMENT_NPC_SCOPE.md`
- `data/CHICKEN_PHASE1_NPC_CONTRACT.json`
