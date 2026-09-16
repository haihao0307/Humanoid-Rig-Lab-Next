# Cat Kaopu module — V4.44 continuous periorbital candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.44 build sequence:

```bash
python tools/patch_cat_v444_ui_state.py
python tools/patch_cat_v444_periorbital_runtime.py
python tools/patch_cat_v444_controls_api.py
python tools/finalize_cat_v444_continuous_periorbital.py
python tools/verify_cat_v444_module.py
```

V4.44 replaces the default four-strip eyelid presentation with one continuous annular carrier per eye. Each patch has a dynamic inner palpebral aperture and an outer boundary sampled from the frozen V4.32 brow, nasal root and cheek. Inner and outer canthi are therefore part of the same topology instead of endpoints of separate upper/lower strips.

The V4.32 body surface, CATV440 binary payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. V4.42/V4.43 stay available as historical baselines. This is a technical candidate: `visualAcceptance=false` and `productionReady=false` remain in force until close-up review.
