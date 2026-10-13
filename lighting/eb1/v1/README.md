# KAOPU EB1 / 1.0.0

The user mandated this lighting family on 2026-10-13 for knit, leather, denim, garment/tailor, shoe and hat workbenches, until an explicit replacement instruction. See POLICY.md. This is a lighting-only, additive integration: frozen historical entries and active specialist branches remain unchanged.

## Reference findings and ownership

The reviewed reference is lo-th/head@21462e471d53ba8c413a96989016510ca4495a34. The observed application uses a white directional key (3 at .4,.5,.4), a warm #efa37e rim (3.5 at 0,.2,-1), an environment (0.8, rotation 100 degrees), background blur 0.5 and intensity 0.05, and Neutral tone mapping at exposure 1. Its skin SSS, textures, head, HDR and focus/post-processing are separate from its lighting. No teacher application code, HDR pixels, model or texture is shipped here. The app repository did not establish permission to redistribute those assets.

EB1 independently authors a procedural spherical softbox radiance field, common parameter schema/store, positive environment quadrature, engine adapters, UI, persistence, source protection and tests. Three.js provides its existing renderer/PMREM/Neutral implementation; the WebGL2 adapter expresses the Khronos PBR Neutral view transform with attribution. Changing a teacher's constants alone would not establish ownership. This is a method reconstruction with an original environment, NOT a pixel-identical reproduction or calibrated real photography claim.

## Rebuild and verification

`prepare.py` uses exact original runtime inputs recorded in SOURCE_PATCH_RECEIPT.json and source audit snapshots. Every native file outside the explicit adapter/build allowlist must retain its SHA-256. The R16 leather native binary is reused unchanged; no claim of a fresh deterministic native-physics compilation is made. Hats and denim use their native deterministic linkers; shoes use the native R08 esbuild dependency graph. The latest completed R08 shoe is used because the parallel R09 was incomplete at audit. Garment assets and native action/physics data are retained in full.

Run `node test-core.cjs` for schema/math/state tests. Serve `v1/` over HTTP or HTTPS and run `python qa.py` with EB1_BASE_URL. Browser evidence is real Chromium/SwiftShader output. A mobile viewport is not a real phone, test elapsed time is not end-user FPS, and source preservation is not proof that all original physics/material limitations have been solved. Review qa/REPORT.json per workbench, not just the overall process exit status. Never equate a build, HTTP 200, queued Action or policy comment with complete delivery.

## Shared control

All entries embed the exact same eb1.js SHA-256. Browser settings are stored as `kaopu.eb1/1` under one same-origin key. Same-origin windows share changes via BroadcastChannel; unrelated hosts do not magically synchronize. JSON export/import explicitly carries settings across origins. Domain-specific material presets must not replace EB1. The original single-lamp orbit is retained only as an EB1 diagnostic path in the garment app; returning to studio preserves the current EB1 recipe. A background change is display-only and cannot change incident light.

Three.js uses PMREM while the native denim adapter integrates the same original field using eight positive solid-angle bins. That is an explicit angular approximation, not pixel-identical environment sampling. Shader kernels that define wool/cotton/leather optical response are not interchangeable with lighting. Materials are not changed into skin and no SSS, depth of field, bloom or vignette is used to hide defects.

## Runtime cost and boundaries

Two shadow-casting lights are capped at 2048 square maps. Environment convolution occurs at creation/context restoration rather than every slider move. Material inspection remains sharp. New light directions can still expose pre-existing thin shells, open seams, material energy errors and absent transmission shadows. Passing a lighting smoke test does not certify all styles, all cameras, physical calibration, smartphone speed or manufacturing correctness.

The knit implementation and its native source remain in the original private repository. No full private source is included in this public release. Its implementation/public-delivery state must be reported separately. Frozen originals are comparison archives; new iterations should consume the pinned EB1 core and follow POLICY.md instead of silently reverting to legacy lighting.

## User-approved default recipe — 2026-10-13

All EB1 workbenches open with the following profile. The storage namespace was advanced once so an older saved EB1 profile cannot silently override it. Later user adjustments continue to persist under the new namespace.

```json
{
  "schema": "kaopu.eb1/1",
  "preset": "custom",
  "exposure": 0.7,
  "key": 1.6,
  "rim": 3.5,
  "environment": 0.9,
  "keyAzimuth": -154,
  "keyElevation": 8,
  "rimAzimuth": 71,
  "rimElevation": 11.309932,
  "environmentRotation": -69,
  "keyColor": "#ffffff",
  "rimColor": "#efa37e",
  "background": 0.85,
  "shadowSize": 2048
}
```
