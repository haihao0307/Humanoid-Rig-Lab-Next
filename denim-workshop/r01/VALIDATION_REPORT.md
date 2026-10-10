# R01 Validation Report

Date: 2026-10-10

## Source and package checks

- Entry: `denim-workshop/r01/index.html`
- SHA-256: `aa2b09ec9bf00ce0023a5963a6735643d53d8f3107eb0d3d316d8d9aec73962e`
- Single HTML: PASS
- Inline CSS / JavaScript / GLSL: PASS (gzip payload + native DecompressionStream bootstrap)
- External script, stylesheet, image, font, model or texture dependency: NONE
- Runtime network requests expected: 0
- JSON files parse: PASS
- Real renderer: WebGL2
- Mesh: 10,285 vertices / 20,160 triangles

## Browser checks

Executed with Chromium 144 in an Xvfb desktop session using ANGLE SwiftShader. The test loads the exact HTML source into a blank browser document because this managed runtime blocks automated navigation to `file:` and `data:` URLs with `ERR_BLOCKED_BY_ADMINISTRATOR`.

- Desktop viewport 1440 × 1000: PASS
- Mobile viewport simulation 390 × 844: PASS
- WebGL2 context: PASS
- Shader compile/link: PASS
- Console errors: 0
- Page errors: 0
- External requests: 0
- Reference/candidate split view: PASS
- 3/1 right, 2/1 right, 3/1 left, 3/1 broken controls: PASS
- Wash and wear controls produce different rendered screenshot hashes: PASS
- Macro camera and compare toggle: PASS
- `kaopu.denim_material_profile@1.0` export: PASS

## Scope boundary

This proves a self-contained interactive WebGL2 candidate. It does not prove physical denim calibration, cloth dynamics, garment fit, self-collision, Houdini parity, film-shot quality, or real-device mobile behavior. Mobile validation is viewport simulation only.
