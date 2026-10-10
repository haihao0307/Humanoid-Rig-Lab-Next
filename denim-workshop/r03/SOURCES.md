# R03 sources and boundaries

## Existing code actually read

- R02 branch head `370c0cfa4098d3027042e5c788f96371095f2518`, README, BUILD_MANIFEST and app.js. The mounted R02 standalone SHA-256 is `f1c64c1033e14fe602c97889ec451424e17a1eca794af7f2966a1a153739af71`, matching the fixed `e847f671808dc93c4590a0d71dfe859a327b1b1e` build. R03 extends that runtime, preserving its metric draft, instancing, shape controls and standalone approach.
- Owner's `haihao0307/Human-Fabric-Workbench/ClothSurfaceR6Dual.frag.glsl`, blob `72149bc1771b0d05c3f6186b839e439861bb8e20`, lighting and knitted/coarse-material sections. Read the two-light neutral/grazing arrangements, warm key with cool fill, material-colored bounce, broad fiber highlights and footprint suppression. R03 writes its own simpler light function; it does not copy or republish the private source file.
- The exact separate new sweater system remains unlocated. This does not claim to have acquired that code or validated a complete transfer.

## Primary references consulted in this task

1. SideFX: https://www.sidefx.com/tutorials/lynx-fabric-asset/ . Author's fabric-generation overview: adaptive curve resampling, rest-frame mesh generation, detangling, consistent seeds. R03 uses deterministic IDs and geometric representation levels, not LYNX source or a Houdini dependency.
2. SideFX: https://www.sidefx.com/docs/houdini/vellum/fabric.html and https://www.sidefx.com/contentlibrary/fabric-samples/ . Eight fabric setups include denim. The public rendered sample montage was actually viewed. It motivates separate material appearance and physical behavior; the HIP was not executed in Houdini, so no parity claim.
3. SideFX: https://www.sidefx.com/docs/houdini/vellum/breaking_tearing.html . Breakable welds, stress normalization and prescribed cuts. R03 only implements seeded static cut intervals in the actual yarn representation, NOT Vellum stress-based tearing or physical simulation.
4. CottonWorks: https://cottonworks.com/learning-hub/denim/denim-basics/ . Woven denim organization and warp/weft distinction. R03 preserves the four existing draft candidates, not knit loops.
5. Naked & Famous Denim: https://nakedandfamousdenim.com/blogs/naked-and-famous-denim/embrace-natural-imperfection-with-the-slub-stretch-selvedge and its official legacy gallery https://nakedandfamousdenim.squarespace.com/en/news/2023/7/28/embrace-natural-imperfection-with-the-slub-stretch-selvedge . The public macro images (Macro_01/05/06 and folded cuff) were viewed via image search. They show narrow white-weft exposure, blue warp floats, irregular slub, close-packed cloth, subdued diffuse response and edge stitching. Images are visual references only, not calibrated measurements or runtime textures. Some direct image fetch attempts failed; no claim to have downloaded laboratory sample data.
6. Naked & Famous: https://nakedandfamousdenim.squarespace.com/en/golden-hour-slub-stretch-selvedge . Its public flat-fabric image was viewed for density and broad cloth reflectance, not as a texture asset.
7. Iron Heart manufacturer product pages: https://ironheart.co.uk/products/ih-634s-142 , https://ironheart.co.uk/products/ih-634s-142ib , https://ironheart.co.uk/products/ih-634s-14ii . Read construction differences between blue/white, blue/black and double-indigo. R03 appearance presets reference these families; no brand replication or measured material fit is claimed.
8. Disney: https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/ . Public curve-garment publication entry revisited. Not its proprietary source or full production implementation.
9. Jeanologia: https://www.jeanologia.com/digital-wash/ . Digital finishing/product workflow revisited. This is not an open-source industrial wash recipe, and current wash coefficients remain artistic candidates.

No Chinese website was used in this research. No sample purchase, paid subscription, account creation or industrial processing was performed. Physical sample possession, calibrated light/camera and material measurements are unavailable. Internal comparisons against manufacturer photographs cannot replace those measurements.
