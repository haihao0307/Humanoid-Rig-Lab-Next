# Cat Kaopu module — V4.43 orbital soft-tissue transition candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.43 build sequence:

```bash
python tools/patch_cat_v443_ui_state.py
python tools/patch_cat_v443_orbital_shaders.py
python tools/patch_cat_v443_orbital_geometry.py
python tools/patch_cat_v443_controls_api.py
python tools/finalize_cat_v443_orbital_soft_tissue.py
python tools/verify_cat_v443_module.py
```

V4.43 preserves the V4.42 four-piece geometric eyelids and adds four `head`-bone-driven orbital transition shells. The shells are sampled from the frozen V4.32 face carrier and fade from the eyelid outer edge into the brow, nasal root and cheek. A bounded blink compression field changes only this runtime Performance Deform layer.

The V4.32 body surface, CATV440 binary payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. This is still a technical candidate: `visualAcceptance=false` and `productionReady=false` remain in force until close-up review.
