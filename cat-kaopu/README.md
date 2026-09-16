# Cat Kaopu module — V4.45 MLS periorbital candidate

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Runtime payload: `runtime/cat_v440.bin` (intentionally unchanged from V4.40)

V4.45 build:

```bash
python tools/build_cat_v445_mls_periorbital.py
python tools/verify_cat_v445_module.py
```

V4.45 keeps V4.44's one-continuous-carrier-per-eye topology but replaces raw coarse-triangle copying with a local weighted quadratic moving-least-squares surface, periodic low-pass filtering and an exact final return to the frozen V4.32 boundary. It also introduces a curved upper-lid-dominant closure, bounded geometric crease and opaque polygon-offset skin pass.

The V4.32 body surface, CATV440 payload, 34-bone rig, skin weights, V4.39 posture correctives and V4.36 locomotion/contact remain unchanged. `visualAcceptance=false` and `productionReady=false` remain in force until close-up review.
