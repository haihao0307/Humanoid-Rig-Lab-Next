# HRL-M04 C2.2 Authoritative Drape Reference

Date: 2026-09-11

Status: `authoritative_reference_generated_pending_visual_acceptance`

## Fixed source set

- GarmentCode commit: `d449629979028123a5c4dc9e732a2ec19b7fce31`
- NvidiaWarp-GarmentCode reference commit: `63baf6855efdd89b2834b74640f84b3bb0d86b50`
- Pattern: `assets/Patterns/shirt_mean_specification.json`
- Body: `assets/bodies/mean_all.obj`
- Measurements: `assets/bodies/mean_all.yaml`
- Simulation config: `assets/Sim_props/default_sim_props.yaml`
- Official entry: `test_garment_sim.py`

## Completed in C2.2

1. Built the fixed GarmentCode-specific Warp reference simulator in CPU mode.
2. Generated the official box mesh from the fixed shirt pattern.
3. Ran the official simulation against the fixed `mean_all` body.
4. Saved the final draped garment reference and collision statistics.
5. Built a self-contained WebGL2 Direct Reference viewer with the body, final drape, and initial panel placement in one world coordinate system.
6. Kept the imported reference out of the HRL production runtime.

## Evidence state

- fixed source gate: passed
- simulation advanced gate: passed
- upstream body-collision threshold gate: passed
- upstream self-collision threshold gate: passed
- finite/non-empty geometry gate: passed
- browser desktop and 390x844 mobile gate: passed locally
- user visual acceptance: pending
- productionReady: false

## License boundary

GarmentCode is retained under its MIT license. The fixed NvidiaWarp-GarmentCode fork is used only to generate a research reference and is excluded from the future production and App Store runtime because it has a separate NVIDIA source-license boundary.

## Next task

C2.3 will measure the final reference around the neckline, shoulder, armscye, axilla, side seam, sleeve opening, and hem. Those measurements will become a versioned parameter record for the independent HRL procedural reconstruction. No imported garment mesh becomes the production garment authority.
