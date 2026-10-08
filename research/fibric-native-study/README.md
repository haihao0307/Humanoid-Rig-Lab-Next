# Fibric native source study — 2026-10-07

Status: official source examples acquired and inspected. Native Fibric recook, Karma rendering, visual reproduction and the final interactive workbench are NOT complete.

## Locked source

Official course: https://www.fibrictoolset.com/documentation

The complete official Fibric Essentials archive was downloaded: 472,438,549 bytes; SHA-256 `f407400140d0198223e1e1e5c37bee74c7b4d53ed5122805c743d27ebc48cb02`. Its ZIP directory contains 48 members, including directories, and 15 HIP projects. CRC validation was performed for extracted members. The initial 256 MiB download cap produced a truncated file; that attempt is not the accepted source and was superseded by the complete acquisition.

All 15 HIP projects record Houdini 21.0.792 as their saved version. The read-only parser found 9,887 CPIO sections, 1,727 graph nodes and 453 Fibric node instances. All 249 Fibric fallback definitions have empty Contents containers. These are parameter/UI fallbacks, NOT complete implementation. Three node instances contain partial child networks; this does not recover the complete generator.

The complete course ZIP does not contain the core `fibric.hda` or the required original pattern library. The native dependency recorded in the examples is `fibric_core_v1.2.39/20.5.000/otls/fibric.hda`. This does not establish that the unavailable tool is encrypted or cannot be obtained legally.

## One exact original target

Source: `pattern_examples.hip`, SHA-256 `01cec2941973a6e3a4f76f371616636a57dc16ff87e70b9c158319a6901b28e4`.

Geometry: `/obj/Pattern_examples/OUT_herringbone`.
Material: `/stage/herringbone_MAT/herringbone/kma_hair1`.
Original input: `geo/cloth/clothPiece.usdc`.
Missing pattern: `$FIBRIC_LIBRARY/patterns/weave/basic/herringbone_12x12.exr`.

Saved graph: surface and pattern -> Generator -> Multifiber -> damage mask -> Damage -> Fuzz -> Export Configure. Saved material graph: weave_type -> MaterialX Mix -> Karma Hair.baseColor. The connected input overrides the socket's saved static color. Multifiber iterations=2 does not mean two active layers: the second layer is disabled.

Selected saved material controls: roughness 0.7, azimuthal roughness 0.8, IOR 1.5, shift 0.03, thicknessScale 2, melanin 0, diffuse 0, coat 0. These values are observations of the saved native graph, not proof of evaluated output or a complete reproduction.

Official Karma Hair documentation: https://www.sidefx.com/docs/houdini/nodes/vop/kma_hair.html . It identifies the Chiang-family fiber model, describes optical Thickness Scale separately from geometric width, and defines Shift over -90 to 90 degrees. The saved 0.03 therefore corresponds to 2.7 degrees, not 0.03 radians.

## Original cache inspection

OpenUSD 26.8 read the original caches without generating or replacing geometry. Basic: 2,150 curves / 227,161 control points. Complex: 14,995 curves / 1,547,559 control points. Point counts, per-curve boundaries, varying widths and finite coordinates were checked. These caches are not proven recooks of the selected herringbone HIP target and do not supply the full original look.

## Authored tools and tests

`tools/fibric_native_audit.py` is a read-only CPIO/INDX inspector, not a fabric generator. It does not execute author scripts, callbacks, HScript, VEX or asset code. It preserves connections, literal values, unresolved expressions and source hashes. Unknown formats, truncations, duplicates and unsafe paths are rejected.

Run `python -m unittest discover -s research/fibric-native-study/tests -v` from the repository root. The 19 parser tests passed locally, including the empty-input-block, connected-socket, disabled-layer and empty-HDA-fallback regression cases.

The separate local authored bundle also contains the USD inspector, dependency preflight and detailed records. It contains no redistributed original HIP/HDA, images or curve caches.

Current environment preflight: original locked HIP and cloth input exist; core HDA, selected original pattern, hython and hou are unavailable. License availability is unverified. Native cook and native render have not run. No cinematic fidelity acceptance or new public workbench is claimed.

## Boundaries and next gate

This branch does not modify the rejected RayWaveFabric R01, main, humanoids, clothing or accepted material baselines. No merge is authorized. The next native gate requires legally obtained matching Fibric core/library and a working Houdini/Karma environment, followed by an original-scene recook and visual comparison. A guessed web shader, cached teacher geometry or successful parser tests cannot substitute for that gate.

- [x] No generated image was used as a 3D substitute.
- [x] Authored source-inspection code was changed and tested.
- [ ] Fabric-generation production source has been reproduced and validated.
- [ ] A user-facing interactive 3D workbench has been delivered.
- [ ] Geometry and material are produced by the recreated runtime and match the reference.
- [ ] Camera and parameter controls have been tested.
- [ ] A fixed public workbench has been verified in a real browser.
- [x] Reports or screenshots alone do not count as final visual delivery: delivery remains incomplete.
