# Skin Quality Lab R02.1 — rendered review

Version: skin-quality-lab/r02.1. Baseline R01.2 is preserved unchanged. Source lives in skin-quality-lab/r02 on experiment/skin-quality-lab-r01-20261007; main and existing Pages were not changed.

Public preview: https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/1d4a616672f2a45e869d4ef3e36e710b11f5cf41/skin-quality-lab/r02/preview.html

The final render was verified by GitHub Actions run 37611165032, artifact 11478089283. Public validation completed 2026-10-07T11:12:37.880Z. Nine local checks and the same nine public checks passed, with zero JavaScript/network errors. Controls actually changed captured WebGL pixels; checks included microstructure, mesostructure, scatter, oil, occlusion, transmission, save/restore, held baseline, and mobile panel layout. Zero-oil rendering was also captured without shader errors.

Desktop viewport: 1440 x 1040. Mobile viewport: 390 x 844. These were Chromium/SwiftShader tests, not a physical phone or a hardware-GPU performance benchmark. The raw test report's top-level label still names the R02 family r02.0, while both recorded runtime states correctly say r02.1; original evidence has not been rewritten.

## Changes that affect the skin

Original 8K, 16-bit scan displacement was partitioned into independent 4K mesostructure, microstructure and relief fields, instead of only adding more generic noise. The inherited 1K base normal is retained for its original broad detail; it is not advertised as 4K. The color map remains the native 4K reference.

The surface responds to independent fine-wrinkle, scan-micropore and vertex-relief parameters. A coupled clearcoat normal makes oil highlights follow the same surface detail, rather than a smooth overlay. Procedural pores remain a supplemental artistic layer with pixel-footprint attenuation, not biologically calibrated measurements.

Scattering uses the attributed 25-sample RGB Separable SSS kernel, with albedo split between entry and exit. The exit-point color is retained instead of blurring the entire painted surface. Thin-part transmission estimates the light-space path length from actual geometry. It is a real-time approximation, not a random-walk volume renderer.

A 593856-ray static hemispherical-visibility calculation supplies cavity occlusion. It affects indirect illumination, not painted skin color. The face/ear cavities therefore respond more plausibly than the earlier unoccluded environment lighting. The baked visibility is tied to the current static scan and would need updating for another geometry or major deformation.

Peach fuzz now uses 14000 tapered area-weighted strands with subpixel coverage. The head has 282944 triangles and fuzz adds 84000. This is an authoring-quality static portrait experiment, not a finished low-cost NPC material.

The selected balanced profile was compared against three other real captured light/material variants. A further official-Three LTC area-light experiment (run 37612541472) was NOT adopted: it brightened cavities in a way that was less convincing without matching area-light visibility. Its successful shader compilation was not treated as visual acceptance.

## Quality decision and remaining gap

R02.1 is the selected, public-browser-verified result of this iteration. Its microgeometry response and highlight breakup are visibly stronger than R01.2. It has NOT been accepted as equivalent to Kyka. Source-scan artifacts around the eyelids/lips, non-volumetric scatter, limited high-quality displacement and incomplete anatomical-region microstructure still limit extreme closeups. The scan is static and closed-eye; eyes, expression deformation, hair grooming and original NPC integration were not added.

The exact user-selected Kyka image was inspected separately. It was not copied into the runtime or redistributed with the source. Artist material/scene/source-data parameters are not available from the artwork alone. The external target remains a visual benchmark, not a claim of code or asset equivalence.

Initial assets plus the bundled preview total 60036156 file bytes (about 60 MB, before network compression/caching). More detailed texture separation has increased bandwidth and GPU memory costs. The lighter-quality switch reduces screen-pixel cost; it does not make this an optimized mobile asset set.

## Sources and licenses

Infinite, 3D Head Scan by Lee Perry-Smith, CC BY 3.0, distributed in Three.js and Pixar's Photorealistic Head tutorial. Original 4K color and 8K uint16 displacement were used; no Pixar-painted utility maps or proprietary shaders were copied. Derivative scan assets are attributed in source metadata.

Uses Separable SSS. Copyright (C) 2012 by Jorge Jimenez and Diego Gutierrez. Required license and modification notice are retained in skin-quality-lab/r02/THIRD_PARTY.txt. Three.js r180 uses its included MIT license.

The release manifest is skin-quality-lab/releases/R02_1_BUILD_MANIFEST.json. The source package must preserve both r01 shared dependencies and the r02 directory. A standalone r02 folder without its ../r01 dependencies is not a complete source handoff.
