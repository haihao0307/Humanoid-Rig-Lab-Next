# Cat Kaopu module — V4.41 working baseline

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.41 builder: `tools/build_cat_v441_eyelid_cornea.py`

V4.40 frozen source: `baselines/v4.40/CAT_KAOPU_V440_EYE_EAR_SHORT_FUR_WORKBENCH_2026-09-15.html`

Run module verification:

```bash
python tools/verify_cat_kaopu_module.py
```

V4.41 adds a shader-only eyelid aperture, deterministic blink, corneal wet response and pupil adaptation. It does not alter the V4.32 neutral surface, the V4.40 binary payload, the 34-bone rig or skin weights. The procedural lid is an intermediate visual layer, not a finished geometric eyelid.

Do not modify the frozen V4.32 neutral surface to repair animation, ear-root, eye, eyelid or fur issues. `visualAcceptance=false` and `productionReady=false` remain in force until user review.
