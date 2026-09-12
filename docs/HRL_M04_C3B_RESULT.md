# HRL-M04 C3B authoritative parameterized T-shirt reference

## Status

C3A visual route was accepted by the user. C3B generated the fixed GarmentCode T-shirt preset for the official neutral body, ran a controlled drape, and generated the same pattern program for the official neutral, mean male, and mean female measurement files.

`visualAcceptance=false`

`productionReady=false`

## Fixed sources

GarmentCode commit: `d449629979028123a5c4dc9e732a2ec19b7fce31`

GarmentCode Warp reference commit: `63baf6855efdd89b2834b74640f84b3bb0d86b50`

Controlled drape workflow run: `34669622397`

Controlled drape workflow commit: `abf95f87e5eb57d52ffccd20511d18d621e3cbec`

Cross-body pattern workflow run: `34670323047`

Cross-body pattern workflow commit: `42a99d66fdead59b90958e0b035e75463b350ffd`

## Neutral controlled drape

- vertices: 7,149
- triangles: 14,034
- connected components: 1
- boundary loops: 4
- non-manifold edges: 0
- degenerate faces: 0
- body intersections: 0
- self intersections: 0
- final frame: 406

The four open boundary loops correspond to the neckline, hem, left sleeve opening, and right sleeve opening.

## Cross-body patterns

- neutral: 8 panels, 16 stitch pairs, no pre-drape self-intersection
- mean male: 8 panels, 14 stitch pairs, no pre-drape self-intersection
- mean female: 8 panels, 16 stitch pairs, no pre-drape self-intersection

The varying stitch count is a valid result of the authoritative program. HRL must not assume that every body instance has one fixed stitch graph.

## Style boundary

The fixed upstream preset uses `CircleNeckHalf`, collar width `0.2`, front depth `0.4`, back depth `0`, shirt length `1.2`, width ease `1.05`, and sleeve length `0.3`. Its visual result is a broad neckline and relatively short shirt. It is accepted only as the authoritative program and parameterization reference. A classic crew-neck style still requires its own locked design parameters and visual review.

## Production boundary

The upstream Warp fork remains reference-only. HRL production runtime must retain its own license-compatible simulation and binary function pipeline. Original sources, controlled reference outputs, and generated HRL results remain separate assets.
