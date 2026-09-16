# Chicken V4.6 R9.8.3 — Phase 1 Environmental NPC Intake

## Active executable

`CHICKEN_V46_R9_8_3_CLEAN_FACE.html`

## Current technical baseline

R9.8.3 keeps the frozen R9.1 rollback, excludes the remaining legacy eye/ear-lobe artifacts from the candidate path, and embeds the short bill root farther into the face. Browser QA passed, but the whole visual gate remains open.

## Phase 1 direction

The project is now scoped as a lightweight environmental creature NPC rather than a full close-up anatomical reconstruction.

Priority is fixed as:

1. morphology;
2. motion;
3. grounding and collision;
4. bounded individual variation;
5. minimal behavior;
6. complex life activity later.

Morphology will be frozen once the chicken reads correctly at gameplay distance and supports stable head, neck, leg and foot motion. The first motion set is idle, look, peck, walk, stop, stepped turn, short run and wing balance. A small herd is allowed only after the single-agent shape, motion and collision loop is stable.

## Contracts

- `CHICKEN_PHASE1_ENVIRONMENT_NPC_SCOPE.md`
- `data/CHICKEN_PHASE1_NPC_CONTRACT.json`
- `06_NEXT_STAGE_PLAN.md`

## Current gates

```text
technicalGatePassed=true
wholeVisualGatePassed=false
morphologyBaselineFrozen=false
singleAgentMotionComplete=false
singleAgentCollisionComplete=false
smallHerdStable=false
phase1EnvironmentNpcReady=false
```

Rig and Motion are no longer blocked by an unlimited close-up reconstruction requirement. They remain blocked only until the low-frequency gameplay-distance morphology gate is passed.
