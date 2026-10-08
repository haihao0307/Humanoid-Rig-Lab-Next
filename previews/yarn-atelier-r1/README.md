# Yarn Atelier R1 / 织物显微室

Independent procedural herringbone study inspired by the Fibric learning route. This is an interactive browser candidate, NOT the author's Fibric tool, official example recook, matched fiber BSDF, or accepted cinematic reproduction.

Open `index.html` directly or through the immutable public URL. The complete runtime is inline: no external model, original teacher cache, image texture download, font request, or runtime HTTP dependency is required. The pinned MIT renderer notices are in `source/licenses` and the bundled runtime.

## Actual implemented geometry
36 warp and 36 weft yarns, a 15.12 by 14.4 mm sample, elliptical bulk envelopes, explicit over/under order, 2,304 fine filament curves and 3,200 tapered fuzz curves. These are generated at runtime from the independently authored draft and metric kernel. The default detailed mesh has 4,632,576 triangles; this is a small hero sample, not a low-cost full garment solution.

Contact projection checks sampled bulk elliptical envelopes in flat material coordinates. It does not prove continuous collision freedom, strand-to-strand or fuzz collision freedom, constitutive material mechanics, or garment self/body collision. Bending is a geometric demonstration, not physics. The opening metric is the projected flat bulk-envelope opening and excludes the finer fibers and fuzz.

## Controls
Whole sample, macro and grazing cameras; orbit, pan and zoom; three light rigs; warp/weft colors; density; flattening; fine fibers; flat/bent shape; exposure; recipe and actual frame downloads; progressive WebGL path tracing and optional depth of field. Stop moving the camera to accumulate path-tracing samples. A low sample count is visibly noisy and is not a converged cinematic frame. The renderer uses a physical surface model on explicit fiber geometry, not Karma Hair or a complete specialized yarn-scattering model.

## Validation
Immutable source build: a364a99bcf3c5879cba2cee87bace372e0d77eba. Passing original browser run: 37603814043. The standalone test exercised real pixels, camera/light changes, fiber toggling, three densities, flat/bent geometry, recipe download, a 390x844 viewport and progressive path tracing. It recorded zero page errors, zero console errors and zero HTTP requests. Software-GPU test timings are not desktop GPU performance measurements. The mobile test is viewport emulation, NOT real-device validation.

The complete original browser evidence remains in the run artifact; a separate publication run tests the immutable HTTPS link with a clean browser. The free githack host may require a first-visit anti-phishing confirmation; this is recorded rather than bypassed invisibly. No paid hosting was provisioned. This isolated preview does not replace the repository's existing Pages site or change main.

## Outstanding visual work
Same-camera teacher matching, realistic yarn irregularity and packing calibration, native fiber-scattering response, more efficient near/far representations, proper cloth mechanics and garment integration remain open. Parser tests, geometry counts and nonblank images alone are not visual acceptance.
