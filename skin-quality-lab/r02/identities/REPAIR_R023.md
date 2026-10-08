# R02.3 skin + hair repair candidate

## Evidence and scope

The fixed R02.2 anchor aac1c1b808141d5eb47f4d05b5d1419945de1890 remains available unchanged. Original R02.1 anchor 1d4a616672f2a45e869d4ef3e36e710b11f5cf41 and its in-app original profile remain unchanged. This repair affects the closed-eye scan only, not the parametric full-body platform.

Fresh real Chromium front/side/macro captures of the old public page: Actions run 37750154863. These expose oversized blurred pigment stamps, horizontal freckle concentration, a rectangular beard mask near the ears, and broken dark/silver hair lines. Older 26-check success did not establish visual acceptance.

## Changes to verify visually

- Pigment positions are sampled from the three-dimensional scan surface with regional exposure probabilities; stamps are smaller, irregular and varied instead of projected into one x/y band.
- Four independent 2048 channels per identity are retained. Original 4K measured meso/micro structure and all 14,000 original peach-fuzz strands remain.
- Eyebrow and beard roots use the current subdivided scan triangles and barycentric weights. Base and identity relief are sampled at triangle vertices and interpolated by exactly those weights, matching the skin's vertex displacement. Root lift is preserved while length changes.
- Beard coverage has curved, soft anatomical boundaries. Strands use 7 or 10 curved segments with varied flow and physical radii, not a rectangular field of 3-segment downward dashes.
- Real bounded longitudinal/azimuthal fibre lighting is adapted from the user's Kaopu hair workbench. Current key/fill/rim powers and colors light the strands. Per-strand grey/dark pigment remains independent.
- All shading stays linear HDR until the existing final skin compose pass. No second tone-map or sRGB conversion is added to the fibres.
- Analytic blend is used explicitly for fine-strand coverage. Existing VSM skin shadow settings remain. New fibre shadows are disabled because the source module's PCF shadow setup is not adopted.

## Source and rights

Adapted code: haihao0307/guilin-dem-pipeline at commit 23f1f408f961749c49e9747d45072c761825b158, kaopu-hair-workbench/qa/gnm-groom-editor/src/FiberMaterial.js. Source blob 8d5669571abc8cc98b23f21530adbf1f77d25488, SHA256 7e495d981281f4a9612bbc1a7c80486d857892ea9268e2d6dfc1df731c67017d. This is user-owned workbench integration code; no unrelated upstream license is falsely applied. Three.js remains MIT with the existing full license. No GNM mesh, GNM topology bindings, or CC BY-SA teacher groom curves are copied. Scan attribution remains in ../THIRD_PARTY.txt.

The source shader is a bounded real-time fibre approximation, not Marschner/Chiang, multiple scattering, or a physically validated production hair model. The parent's source workbench's unresolved visual/contact acceptance is not inherited as a pass here. Candidate images require fresh review before delivery.
