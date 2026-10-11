# Leather Atelier R09.1 — takeover candidate

Baseline webpage: `f1ab73a7b289461a7d81e65eed935ec62369ed34:leather-workshop/r08/public-lite.html`.
Unfinished physics source inherited from `a1c7ab8a1774e69f929488e7ce8abdca9e1df3bc`.
This lane does not edit R01–R08, the original material kernels, or other workbenches. It does not merge main. User visual acceptance remains pending.

## Audit and implemented repairs

R08 already had real inner/outer skins, cut walls and diamond/grid/channel craft generators. They were not entirely absent. However, thickness used static untransformed vertex coordinates; rear saddle yarn depended only on the front wallet sheet; the full old atelier was hidden in an archive dialog; particle-only contact missed face and edge crossings; and unfinished R09 nonlinear/contact source was not assembled into the webpage.

Six visible craft buttons now rebuild real current-product geometry: plain, diamond quilting, square quilting, channels, perforations, interlaced strips. Thirteen materials and seven products remain. Default: diamond leather sample. Supported regions: wallet front pocket, bag front, jacket patch pockets, entire sample. Belt and hats retain original structure and explicitly disable unadapted crafts.

The grab worker now evaluates the inherited full R04 nonlinear law in fixed material coordinates, thickness-cubed bending, implicit integration, seam anchors, finite-thickness vertex/triangle and edge/edge barriers, swept safe steps and lagged friction. Double-precision C/WASM is embedded. This is an independent integrator, not the official IPC optimizer.

Wallet saddle yarn has separate semantic front/rear carriers, with continuous interpolation inside the hole. This fixes rear-only motion, not independent yarn sliding/damage or complete thread-force propagation.

Thickness now evaluates the live GPU-equivalent embedding and world matrix. Inner/outer distances are measured after deformation; quilting loft is not leather gauge. The close-cut probe no longer reports a vertex z coordinate as thickness. Assembly clearances for wallet layers, keeper, hatband, bag flap, cuffs and underarm were corrected and connected to actual gauge. Only genuinely quilted panels receive quilt rest-curvature assumptions.

Interlaced strips receive bounded ribbon-only pre-seating to establish finite-thickness clearance. Backing, rest geometry, constitutive law and seam rest lengths stay unchanged. Movement over 1 mm or unresolved crossing causes explicit failure. Default pre-seating measured about 0.3125 mm; inspect fresh diagnostic outputs for the exact revision.

Memory is bounded; no contact pair is discarded. Native sweeps are chunked. Secondary carrier attributes are allocated only where used; temporary packed attribute copies and abandoned depth materials/textures are released without deleting visual detail.

## Source and verification

`build.py` assembles frozen inherited modules plus readable new modules. `source_adapters.py` is production source: exact-match, fail-on-drift adaptations, not an after-the-fact test patch. Builder and adapter hashes appear in `BUILD_MANIFEST.json`. HTML embeds the runtime, WASM, materials and legacy archives; no model/runtime download is required after opening it.

Commands: `python leather-workshop/r09/build.py`; `node leather-workshop/r09/qa-numeric.cjs`; `node leather-workshop/r09/qa-products.cjs`; `node leather-workshop/r09/qa-crafts.cjs`; `xvfb-run -a python leather-workshop/r09/qa-browser.py`. Set `KAOPU_CHROMIUM_EXECUTABLE` to installed Chrome. Build requires clang with wasm32/wasm-ld; Python QA requires Playwright/Pillow. The webpage itself requires neither installation nor Python.

Actions builds from the source commit, verifies numeric and real-browser gates, commits the standalone, then opens its immutable public URL in another browser pass. Delivery requires a successful `DELIVERY.json` public receipt. Bootstrap workflows, finite coordinates alone, screenshots or old R08 links are not new delivery evidence. Physical-phone testing is not claimed by a mobile viewport.

## Limits and realistic costs

This is a review candidate, not production acceptance. Material parameters, density and friction are not calibrated for each displayed leather finish. Appearance selection is not measured mechanics. Bounded iterative solves expose residuals and may not converge to the original R04 tolerance. Large products and particularly interlaced strips may run slower than real time; calculation speed is shown instead of skipping physical time.

Contact assertions cover the simulation surface, not every high-resolution yarn/skin triangle. Perforation/needle holes are genuinely cut visually but mechanically homogenized in the coarse shell: exact perforated mass and local stress concentration are not claimed. Quilt filler compression, separate lining, complete thread sliding/friction, viscoelastic memory, fatigue and damage remain unsolved. Controlled test trajectories do not certify arbitrary throws, every parameter combination/browser or physical phones. Jacket crafts currently affect patch pockets, not the entire garment.

Primary algorithm references: https://ipc-sim.github.io/C-IPC/ and https://ipctk.xyz/ . Toolkit contact components are not a full simulator; their guarantees are not automatically inherited. R04 research provenance remains in `physics-research/r09-20261010/README.md`.

## Review gates

Actual production source, interactive 3D geometry, craft controls and physical grabbing are implemented. Generated pictures do not substitute for them. Public delivery is recorded only by the workflow receipt. User visual acceptance and production readiness remain pending. R01–R08 remain unchanged.
