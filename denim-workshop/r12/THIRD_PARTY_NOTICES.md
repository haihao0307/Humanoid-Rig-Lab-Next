# R11 helper sources (scope: denim swatch runtime)

This notice does not relicense the repository, its historical versions, other
workbenches, or external references. The existing Haihao MIT license is supplied
unchanged. Research attribution is not an authorship certificate or patent license.

## Austin Appleby: MurmurHash3 finalizer

Author: Austin Appleby. The original source expressly places MurmurHash3 in the
public domain and disclaims copyright. Only the small 32-bit finalizer is used as
a reference, not the complete smhasher library.
Pinned source: https://github.com/aappleby/smhasher/blob/92cf3702fcfaadc84eb7bef59825a23e0cd84f56/src/MurmurHash3.cpp
Git blob: aa7982d3eef2d891098d46afb191be87f31a5a29

noise-kernel.js ports fmix32 arithmetic to JavaScript and GLSL, then applies local
coordinate encoding, ASCII salts and tensor interpolation. natural-yarn.js:H and
app.js:hash retain their earlier public-domain-finalizer-tail adaptation, XOR seed
and normalization to preserve the accepted generated geometry. They are not
claimed as project-invented hashing. core.js:cutRanges has a replacement jitter
adapter from the same documented arithmetic; it is not the active damage planner.
This identification resolves a usable upstream source and permission basis;
it does not prove the exact historical website visited when the old code was made.

## Krzysztof Narkowicz: ACES Filmic Tone Mapping Curve

Author: Krzysztof Narkowicz. Original publication, 2016-01-06:
https://knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
The author offers this fitted code under CC0 or MIT. This release records the
CC0 option: https://creativecommons.org/publicdomain/zero/1.0/
sampling.js keeps the existing fitted curve unchanged. It is not the complete
ACES transform system, an ACES certification or a project-invented curve.

## Mathematical methods

Cubic interpolation weights follow the four endpoint value/derivative equations;
Hermite curve bases follow their endpoint/tangent constraints. They are not new
mathematical inventions. XPBD, the Jensen diffusion model and filtering references
remain as documented in R10. No referenced paper, picture or proprietary renderer
is bundled by this notice. Additional permission cannot be inferred for such items.

## Tools and hosting, outside the HTML runtime

Python, Node, Playwright, Chromium, NumPy, SciPy, Pillow and GitHub Actions are
external build/test infrastructure, not redistributed runtime dependencies here.
GitHub/htmlpreview hosting is separate from the standalone program. Packaging
those tools, a browser or other project assets requires a separate review.
