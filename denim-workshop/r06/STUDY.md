# R06 — source mechanisms, not appearance claims

The two user-specified papers remain the primary teachers. Both complete two-page PDFs, including every figure, were revisited. They were read from the existing temporary study download rather than committed into the production assets.

## Animal Logic: Simulating woven fabrics with Weave (SIGGRAPH 2018)

https://animallogic.com/wp-content/uploads/2023/08/Simulating-woven-fabrics-with-Weave.pdf
PDF SHA256 `4d865fabd1e75afa1f394832b6205822748017c8d2ea8e38a17114c4d9bf5e4c`.

The paper separates the interlacing description, UV-bound parent curves, frayed curves and fuzz. Controlled coordinate and amplitude variation should not destroy yarn order. It uses a production renderer with surface response, single scattering and a Jensen dipole treatment; its visual results also depend on measured material properties. R06 keeps ordered parent yarns and applies one common smooth material-coordinate field to bodies, anchored loose ends and fibers. This avoids independently wobbling the layers apart.

R06 also explicitly separates reflection, approximate local bundle diffusion and finite-optical-depth transmission. It now evaluates the mathematical dipole radial profile, rather than merely naming a diffuse brightening term after the paper. However, its shader collapses the radial annuli into center and longitudinal-neighbor visibility taps. It does NOT evaluate the full surface-to-surface BSSRDF, measured material table, Glimpse integrator or multiple-bounce light transport. These limitations prevent claiming an equivalent implementation of Weave.

## Disney: Creating Curve-Based Garments with Custom Weave Patterns (SIGGRAPH 2023)

https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/
PDF: https://cdn.disneyanimation.com/uploads/publications/CurveBasedGarmentswithCustomWeavePatterns.pdf
PDF SHA256 `d19ea89f8e561f39d2cc12aed4443c7d1b9d0735e72cf2a2807c3cf9c69ddb19`.

The paper's binding of curve control vertices to a shared garment reference is important: yarns, folds, hems and stitches must remain coherent. Its pattern controls, different curve configurations and larger variation domain reduce small repeated motifs. Woven and knitted organizations are distinct. R06 does not replace denim with knitted wool loops; it preserves the current metric weave, changes its common spatial binding and adds finite constituent curves. Disney's proprietary face-binding/toolchain and full garment finishing pipeline are not reproduced here.

## Additional primary references used for specific gaps

Jensen et al., A Practical Model for Subsurface Light Transport:
https://graphics.stanford.edu/papers/bssrdf/bssrdf.pdf

R06 uses the radial dipole terms, refractive diffuse-boundary approximation and reduced transport coefficients. CPU midpoint quadrature over four annuli is checked against the analytic integral over the SAME finite 1.2 mm support. Comparing a truncated numerical integral against an infinite-domain integral would be an invalid test; this was corrected before final verification without relaxing the tolerance. The selected refractive index, reduced scattering and absorption coefficients are unmeasured artist candidates. Planar diffusion is not by itself a physically valid exact model of isolated cylindrical cotton fibers.

A Multi-scale Yarn Appearance Model with Fiber Details, arXiv:2401.12724v2:
https://arxiv.org/html/2401.12724v2

The fiber-migration discussion explains why constant-radius full-length helices appear too regular. R06 replaces its former three uninterrupted sheath curves with shorter, phase-varied staple segments whose radial position enters and exits the parent yarn. Optical attenuation is diameter-dependent. This is a limited geometric/optical adaptation, not a port of the paper's complete multi-lobe appearance model, importance sampling or energy-conservation proof.

Filament official rendering documentation:
https://google.github.io/filament/main/filament.html

The R06 renderer accumulates material and transparent-fiber contributions in linear radiance and performs exposure/tone mapping once after compositing. RGBA16F is used where supported; an explicit RGBA8 linear fallback remains. The fallback can clip highlights and is not claimed equivalent to HDR. No full hardware compatibility matrix was tested.

## What this iteration does not establish

No physical sample, spectrophotometer data, fiber tomography, wash chemistry or mechanical calibration was acquired. Numerical correctness of a radial function does not validate a complete optical material. Shader controls changing rendered pixels do not certify realism. Finite generated yarns and static anchored tears do not imply collision-free geometry or stress-driven tearing. Final film-grade acceptance remains a visual and measured-reference task, not a test-count claim.
