# Cat Kaopu module — V4.42 geometric eyelid candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.42 builder: `tools/build_cat_v442_geometric_eyelid.py`

V4.41 frozen source: `baselines/v4.41/CAT_KAOPU_V441_EYELID_CORNEA_WORKBENCH_2026-09-15.html`

Run module verification:

```bash
python tools/verify_cat_v442_module.py
```

V4.42 removes the fake shader lid mask from the eye sphere and adds four bounded procedural eyelid shell volumes. The shells are generated outside the CATV440 payload, follow the existing head bone, expose a real edge-thickness control and retain deterministic blink, pupil adaptation and corneal response.

The V4.32 body surface, CATV440 binary payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. `visualAcceptance=false` and `productionReady=false` remain in force until user review.
