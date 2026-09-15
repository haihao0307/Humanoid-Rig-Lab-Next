# Cat Kaopu module — V4.40 fixed baseline

Current entry: `workbench/CAT_KAOPU_CURRENT.html`

Current state: `CURRENT.json`

Runtime payload: `runtime/cat_v440.bin`

Portable builder: `tools/build_cat_v440_eye_ear_short_fur.py`

The portable builder reads the included V4.39 predecessor from `baselines/v4.39/` and writes to `build/v4.40/`. The original historical builder with `/mnt/data` absolute paths is preserved separately for audit.

Run module verification:

```bash
python tools/verify_cat_kaopu_module.py
```

Do not modify the frozen V4.32 neutral surface to repair animation, ear-root, eye or fur issues.
