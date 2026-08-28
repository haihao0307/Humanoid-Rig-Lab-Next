# Task 17A.3 user-operated visual QA

Codex intentionally did not operate the browser. Use `human-core-v5-production-rig-detail-v1.html` and record the files listed in `browser-capture-manifest.json` in this directory.

For every capture, wait for `window.__HUMAN_CORE_V5_PRODUCTION_RIG_DETAIL_V1__.ready === true`, then confirm:

- `coreRigContractPassed === true`;
- `finalPoseReadOnlyPassed === true`;
- `geometryPresent === true`;
- `webgl2 === true`;
- `consoleErrors.length === 0`;
- `pageErrors.length === 0`.

Evaluate the 25 visual rows in `metrics.json` using only `pass`, `partial`, `fail`, or `unsupported`. Do not change `visualAcceptance`, `productionReady`, or `userVisualAcceptance` until the complete screenshot set and contact sheet have been reviewed.
