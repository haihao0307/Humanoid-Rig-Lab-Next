# R05 primary-source study and implementation boundaries

Both two-page papers were retrieved in full, their text extracted, and every page/figure inspected. The user's pasted link contained two concatenated URLs; they were separated, not treated as a single document. PDF files were held temporarily as a one-day reading artifact, not included in the workbench or committed as runtime assets.

## Animal Logic — Simulating woven fabrics with Weave

Source: https://animallogic.com/wp-content/uploads/2023/08/Simulating-woven-fabrics-with-Weave.pdf
Publication: SIGGRAPH Talks 2018; the 2023 upload-directory date is not the publication date.
PDF SHA256: `4d865fabd1e75afa1f394832b6205822748017c8d2ea8e38a17114c4d9bf5e4c`.

Pages 1–2 separate UV-bound longitudinal, lateral and frayed curves; binary interlacing controls their order. Perturbations, detached fiber curves and independently generated stitches add variation. Holes split thread curves rather than paint dark marks. The rendering section uses Glimpse, camera-facing fuzz, adaptive subdivision and a measured-data-informed scattering model including a Jensen dipole. Cloth motion is a separate Houdini step. R05 adopts parent-anchored fuzz, distinct curve roles and tangent-facing ribbon coverage. It does not implement Glimpse, the dipole, measured material fitting, pillowing stitches or a physical cloth solver.

## Disney — Creating Curve-Based Garments with Custom Weave Patterns

Publication page: https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/
Full PDF: https://cdn.disneyanimation.com/uploads/publications/CurveBasedGarmentswithCustomWeavePatterns.pdf
SIGGRAPH Talks 2023, Dan Lipson and Jose Velasquez.
PDF SHA256: `d19ea89f8e561f39d2cc12aed4443c7d1b9d0735e72cf2a2807c3cf9c69ddb19`.

Both pages, including organization images, curve details and garment examples, were read. Curves bind to garment face/faceUV data, while separate maps control weave heights and variation. Multiple curves can form a yarn; a larger repeat helps avoid obvious small-tile repetition. Knitted loops are distinct from woven yarns. Hems and stitches are finishing tools, not proof of accurate garment mechanics. R05 keeps the existing metric woven graph, adds representative twisted exterior curves and correlated longitudinal variation. It does not copy Disney's proprietary tools, recreate the whole garment pipeline or claim all cotton fibers are individually represented.

## Supplementary primary implementation references

- Filament cloth model: https://google.github.io/filament/main/filament.html , section 4.12.1. Read why a conventional shiny microfacet response can make denim look plastic, the broad Charlie sheen lobe and the explicitly approximate wrap diffuse treatment. R05 uses an independently written broad-lobe, rough-diffuse shader with a bounded scatter approximation. It is not a calibrated physical BSDF or the Weave dipole.
- Cornell procedural microstructure research: https://research.cs.cornell.edu/ctcloth/index.htm . Read the public explanations of measured irregularity and fiber-level appearance; no CT sample or fitted parameters were obtained.
- SideFX Hair Clump: https://www.sidefx.com/docs/houdini/nodes/sop/hairclump.html . Guide clustering/length variation remain the geometric analogy used in R04, not a claim that denim is wool or hair.

## Validation interpretation

The gray stage is a ray-intersected floor and back plane with depth-dependent background haze. It is not a full volumetric multiple-scattering simulation. The four-sample key light and PCF center shadow are approximations, not a fully integrated area-light/path-tracing solution. Fuzz remains sparse representative geometry, with finite ribbon widths and filtered fine detail. Source study and successful shader compilation do not establish film-grade visual acceptance. No physical swatch, calibrated camera/light measurements or industrial wash recipe was acquired.
