# R01 Validation Report

Date: 2026-10-10

## Validated build

- Build commit: `f62d9cdafebd142d01b6d1f778f9e201a6d852c6`
- Fixed public URL: https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/f62d9cdafebd142d01b6d1f778f9e201a6d852c6/denim-workshop/r01/index.html
- GitHub Actions run: https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38023705873
- Evidence artifact ID: `11659910849`
- Evidence artifact digest: `sha256:6348d71555600772c9d4d323035afa6e14e7a69d3c0fd81b7147d6aaac0c178c`

## Source and package checks

- Entry: `denim-workshop/r01/index.html`
- HTML SHA-256: `aa2b09ec9bf00ce0023a5963a6735643d53d8f3107eb0d3d316d8d9aec73962e`
- Single HTML: PASS
- Inline CSS / JavaScript / GLSL: PASS (gzip payload + native DecompressionStream bootstrap)
- External script, stylesheet, image, font, model or texture dependency: NONE
- Runtime network requests required by the workbench: 0
- JSON files parse: PASS
- Real renderer: WebGL2
- Mesh: 10,285 vertices / 20,160 triangles

## Browser checks

GitHub Actions used Chromium 140 in an Xvfb desktop session with ANGLE SwiftShader. The same workflow validated both a checked-out local HTTP copy and the fixed public `htmlpreview.github.io` commit URL.

- Checked-out workbench browser run: PASS
- Fixed public commit URL browser run: PASS
- Desktop viewport 1440 × 1000: PASS
- Mobile viewport simulation 390 × 844: PASS in the earlier local regression; not a real mobile device
- WebGL2 context: PASS
- Shader compile/link: PASS
- Page errors: 0
- Workbench runtime error panel: false
- Reference/candidate split view: PASS
- 3/1 right, 2/1 right, 3/1 left, 3/1 broken controls: PASS
- Wash and wear controls produce different rendered screenshot hashes: PASS
- Macro camera and compare toggle: PASS
- `kaopu.denim_material_profile@1.0` export: PASS

The public host automatically requested its own `/favicon.ico`. The final QA intercepts only that host-level icon request; every workbench resource and runtime assertion remains strict.

## Scope boundary

This proves a self-contained interactive WebGL2 candidate and a working public URL. It does not prove physical denim calibration, cloth dynamics, garment fit, self-collision, Houdini parity, film-shot quality, or real-device mobile behavior.
