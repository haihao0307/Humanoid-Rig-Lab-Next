# Sources actually consulted, and limits

## Existing project code

1. `haihao0307/Humanoid-Rig-Lab-Next@da7fc4cd22e424a7bab2cadc1aa866067b1fd5fa/research/fibric-native-study/open-kernel/weave-draft-compiler.mjs`, blob `49b9c0aae2c74f41b0444e5c5449b3c339608a4a`. Read in full. R02 adopts its draft → stable-ID metric centerline contract; this new evaluator uses bounded smoothstep rather than Catmull-Rom interpolation and explicitly declares millimeters. It is not licensed Fibric/LYNX code.
2. Owner's existing `ClothSurfaceR6Dual.frag.glsl`, blob `72149bc1771b0d05c3f6186b839e439861bb8e20`. Read the knitted acrylic `patternAcrylicNaturalR59` and screen-footprint filtering sections. Learned principles: material-space anchoring, derivative-based LOD, suppression of unresolved periodic signals, separate near/mid/far appearance. No private source file is republished. This source itself is a shader, not proof that the separately mentioned new sweater yarn model was located.
3. R01 README, BUILD_MANIFEST, standalone source, and repository AGENTS were read. R01 remains unchanged. Its earlier “yarn” descriptions did not establish explicit yarn geometry.

## Primary external references

- Disney Animation, Dan Lipson and Jose Velasquez, SIGGRAPH 2023, *Creating Curve-Based Garments with Custom Weave Patterns*. https://disneyanimation.com/publications/creating-curve-based-garments-with-custom-weave-patterns/ . Publication abstract read; it describes curve-based fabric authoring, complex weave patterns, hems and stitches. The linked large PDF was not successfully retrieved. No claim to have read the full paper, reproduced proprietary source, or matched its production rendering.
- Jeanologia, Digital Product Development / Digital Wash. https://www.jeanologia.com/digital-wash/ . Read the public eDesigner workflow and visualization description. It motivates separate construction, finishing and production records; no public numerical wash model or machine calibration was obtained. The company is headquartered in Spain, not Japan. https://www.jeanologia.com/contact-us/ . No account, purchase, or paid service was created.
- CottonWorks / Cotton Incorporated, Denim Basics. https://cottonworks.com/learning-hub/denim/denim-basics/ . Read the yarn, ring-dye, construction, twill, broken-twill, and count sections. Three-over/one-under and indigo-warp/natural-weft identities are mapped to the kernel. The 4×4 broken draft is one out-of-sequence variant, not a claim that every industrial broken twill uses that exact draft.
- CottonWorks, Denim Finishing. https://cottonworks.com/learning-hub/denim/denim-finishing/ . Abrasion, wash and related finishing mechanisms are learning references; the current coefficients remain artistic/unmeasured.

Sources are references, not redistributed image assets or proprietary implementations. Microscopic structural inspection is internal; user acceptance is based on the material view.
