# Original shorts paper: relaxed candidate 4 with a cut-in gusset

`clothing/ShortsPattern.js` is a plain script. Call
`createShortsPattern(measurements, options)`; it has no renderer, formed garment,
body mesh, asset or third-party pattern dependency. All lengths, coordinates and
seam reports use **metres**, and both input and output require `unit: 'm'`.

This is a project-authored first draft, not an industrial pattern or fitted
garment. The current triangulated domain ends at the net seam line. Seam/hem
allowances are explicit reserved metadata and are **not yet meshed or turned**.
This version has no darts; front/back centre-line and side-line shaping create
the waist reduction. Fit must be judged after physical sewing and body contact.

## Measurement contract

Required positive values:

| Key | Meaning |
| --- | --- |
| `waistFrontArc`, `waistBackArc` | Full front/back waist arc between left and right side lines, not a quarter circumference |
| `hipFrontArc`, `hipBackArc` | Full front/back arc at the measured fullest hip level |
| `waistTopFrontArc`, `waistTopBackArc` | Same arcs at the actual upper waistband height |
| `waistToHip` | Vertical waist-to-hip depth |
| `crotchDepth` | Vertical waist-to-selected anatomical crotch level; method must be recorded |
| `frontRiseLength`, `backRiseLength` | Separate measured body surface lengths from centre waist to the selected crotch split point |
| `thighCircumference.left/right` | Separately measured upper-thigh circumferences |

`metadata` preserves body shape/source/pose provenance. Optional `waistY`,
`centerZ` and `bounds.minZ/maxZ` select only rigid initial placement planes.
Fallback placement planes are marked by their construction and cannot establish
body clearance. They do not determine the paper's material coordinates.

Waist/hip/front/back lengths must come from current body surface measurements;
old skirt envelopes and authored collision radii are not measurements. The
current symmetric candidate uses the larger measured thigh for both legs.
Ease, crotch drop, inseam length and waistband height are explicit `options`;
they are design choices, not measured fabric constants. Missing or impossible
measurements throw instead of substituting generic human dimensions.

### Independent leg opening

`options.hemCircumference` is an optional **per-leg net hem circumference** in
metres. When omitted, the target is the larger measured upper thigh plus
`options.thighEase` (default 0.080 m). That default is an authored relaxed-shorts
candidate for fitting, not an industry-wide ease value or a measurement of the
body at the hem. An explicit hem circumference takes precedence over this
default. `thighEase` is the allowance used for this default opening target; it
does not assert that every horizontal row equals the upper-thigh circumference.

The target changes the original 2D side profile below the hip line. Positive
and negative offsets allow flare or taper. Waist, hip line, front/back rise
curves above the gusset cut and the original 155 mm pre-cut inseam draft are retained.
The gusset removes the last rise segment and the uppermost inseam segment before
sewing; the remaining default inseam is 124 mm. The removed lengths are recorded.
Front/back outseams share the revised profile, and all source seam lengths and
stitch intervals are recomputed. No formed garment or rest length is scaled.

`draft.hemCircumference` is measured back from actual source hem edges;
`hemTarget` and `hemTargetSource` record the request. `crotchLineWidth` now
includes the actual side offset at the crotch row; `riseAndHipBaseWidth` records
the untapered hip-plus-extension quantity and is not a minimum hem size.
Folded/zero-width paper is rejected. These dimensions do not establish fit.

## Paper and seam data

`pieces` has `FL, FR, BL, BR`, independent gusset `G`, and four waistband pieces
`WFL, WFR, WBR, WBL`. Default leg panels have 7 × 13 cells; bands have 7 × 2
cells; G has eight boundary points and one interior point: 553 distinct material
points and 848 triangles total. Each piece owns:

- `materialCoordinates: [[u,v], ...]`: immutable source-paper coordinates.
- `triangles: [[i,j,k], ...]`: positive-area material triangles with local indices.
- `boundaries`: semantic arrays of actual material vertex indices.
- `placement: {origin,basisU,basisV}`: only a rigid map into a flat 3D plane.

Each leg cell chooses the diagonal maximizing its worse triangle's source-UV
area/edge-length quality. The gusset revision is explicitly a new 2D draft: it
changes the original crotch row and all its adjacent triangles before deriving
rest metrics. It never edits UV or rest lengths on an existing simulation.

For the unmirrored right panels, +u is centre-to-side and +v is waist-to-hem.
Left panels are genuinely mirrored cut instances (`sourceMirror: -1`). Edge
direction is semantic, not inferred from polygon winding:

| Edge | Direction |
| --- | --- |
| `waist` | Centre waist → side waist |
| `outseam` | Side waist → outer hem |
| `hem` | Outer hem → inner hem |
| `inseam` | Inner hem → new gusset/inseam endpoint |
| `rise` | New gusset/rise endpoint → centre waist |
| `gusset` | Rise endpoint → half-arclength notch → inseam endpoint |

Front/back side curves are translations of the same original 2D line profile.
Their inseam profiles also share their original lengths. Rise extension is
solved in the original paper against measured rise plus explicit ease. Nothing
rescales the rest metric to conceal mismatch.

Each `seam` has `a/b: {pieceId,edge,indices}`, local `pairs: [{a,b,t}]`,
`restLengthA/B`, full-length and maximum stitch-interval mismatch. `kind` is
`sewn` or `closure`; every seam starts inactive. Stages are:

0. Front and back rise seams ending at separate gusset endpoints.
1. Four original gusset cut edges, with the insert held at its corners.
2. Leg inner/outer seams, leaving the upper left side opening.
3. Joins between waistband sections.
4. Waistband lower edge to the actual trouser waist.
5. Left side opening and waistband end closure, after physical dressing.

These stages describe sewing relationships; the solver must supply actual
handling and contact rather than claiming scheduling alone performs sewing.

`junctions` records four separate three-piece junctions at the gusset's front,
back, left and right corners. Every member retains its own source UV identity.
There is no residual seam through the former four-way crotch, overlay cap,
extra weld, shape target or preformed leg tube.
`auditShortsPatternTopology(pattern, includeWaistband)` identifies declared seam
pairs only for an independent combinatorial check. The sewn quotient has
Euler characteristic −1 and three boundary loops: waist and two leg openings.
This check assumes all closures and does not claim they have been simulated.

### Independent original gusset

For each leg panel, the rise now ends at row `crotchRow-1` and the inseam ends
at row `crotchRow+1`. Their straight connection is the new cut edge. Row
`crotchRow` starts at its exact midpoint, and the whole row is redrafted to the
unchanged outer edge. The old crotch corner is removed from the actual triangle
domain. `gussetCut.removedCornerUV` is provenance only, never a particle.

G is a two-dimensional asymmetric kite. With half-width w and measured new
front/back cut lengths Lf/Lb, its corners are F=(0,-sqrt(Lf²-w²)), R=(w,0),
B=(0,sqrt(Lb²-w²)), L=(-w,0). Each edge includes its exact midpoint. Its four
seams therefore match both total length and every stitch interval without ease
scaling. `options.gussetWidth` defaults to 0.060 m; impossible widths throw.
This is an authored candidate, not a commercial pattern or a fitted size rule.

For the recorded real-body tape measurements, G is 60 × 137.724870 mm; front
edges are 57.382206 mm and back edges 93.739639 mm. Removed front/back rise
segments are 45.410739 / 88.724348 mm and each removed inseam segment is 31 mm.
The insert's central front-to-back paper route is 3.589784 mm longer than the
two removed rise segments. The net hem is 605.449276 mm per leg. These are source-paper
facts, not proof of stretch-free sitting or walking.

`draft.frontRiseLength/backRiseLength` and `cutRiseLengths` report the remaining
rise seam lengths; `originalRiseLengthsBeforeGussetCut` preserves the draft
before cutting. `draft.gusset` records the insert dimensions and route change.
Removing G and its seams exposes a genuine fourth boundary loop (Euler −2);
sewing it in restores the waist plus two leg openings (Euler −1).

### Relaxed original-paper revision

The default now uses `hipEase:0.100`, `frontRiseEase:0.024`,
`backRiseEase:0.038` and `thighEase:0.080`. These are authored style allowances
for a looser toile, not measured fabric constants or a universal tailoring rule.
They replace the previous 50 / 14 / 18 / 60 mm allowances. `waistEase:0.014`
is retained: the four waistband pieces keep their exact prior source coordinates
and triangles. The rest of the trousers remains free cloth.

On the recorded actual-body dimensions, the net hip increases from 960.838 to
1010.838 mm and each hem from 585.449 to 605.449 mm. At the hip row, each front
panel gains 12.813 mm and each back panel 12.187 mm. The rise extensions are
redrafted from the longer original rise targets; this changes their horizontal
wrap, without increasing the anatomical crotch-depth input. New paired side
profiles and all four gusset edges are derived again from the revised paper.

The actual central source path (remaining front rise, G centre and remaining
back rise) increases from 718.815 to 747.187 mm, by 28.372 mm. The input rise
allowances increase by 10 / 20 mm before cutting the gusset, so the final centre
path must not be reported as exactly 30 mm longer. All 19 seams remain paired
interval by interval. Default main-panel minimum source angle is 23.708° and
the gusset minimum is 18.665°. The previous simulation's open seam gaps are
preserved as evidence, not treated as direct measurements of missing fabric:
that run also contained material strain and non-seam crossings.

## Waistband, opening and handling

Ring traversal is left side → centre front → right side → centre back → left
side. Each waistband is an original 2D annular sector; its sampled lower length
equals its trouser waist segment and its upper length equals the higher body
arc plus ease. Equal lengths give the rectangular limit. The sector is cut
first; it is not UV unwrapped from a formed waistband.

`waistSupports` exists only on each band's upper edge:
`{index, side:'left'|'right', front:boolean, t}`. Here t=0 is centre front/back
and t=1 is the side line. This can address temporary handling/body placement;
it does not authorize permanent limb/leg targets or render-time displacement.

Each initial band plane follows its actual parent waist's first-to-last sewing
direction, including the reversed back sections. It is offset 25 mm upwards in
that same plane, with extra compensation if the original contour bends below
its baseline. The nine initial flat pieces are tested for separation; no UV,
cut edge or rest length changes to accomplish that placement.

G starts as flat paper in the sagittal plane between the legs: source +u maps
to +Y, and +v to −Z, so its front/back tips point forward/backward. Its highest
point is 10 mm below the measured anatomical crotch; its centre X/Z comes from
the measured waist centre. Every piece then receives the same source-hips to
current-hips rigid transform. On the recorded actual fixture, an independent
full triangle-feature distance audit found G/body minimum separation 8.528 mm
and G/other-cloth separation 66.705 mm, with no triangle intersections. Its
longest initial thread was 175.692 mm, versus 428.182 mm for the previous
smaller-paper forward horizontal handling position. This is a static initial-pose result,
not a clearance guarantee for other body shapes or subsequent sewing motion.
No material coordinate, mass or triangle changes for this placement. It is
not a formed crotch surface. `handlingPoints` lists only
the four original boundary corners, each `{index, releaseWhenStitched:true}`.
The solver holds their original height until an associated real stitch has
started, finished closure progress and actually approached within twice the
cloth thickness. There is no timeout or permanent body binding for G. Actual
needle closure must release every hold before engineering acceptance.

The upper left outseam remains open to at least the measured hip level and its
waistband ends remain unfastened. A closed nonelastic waist smaller than the
hips is not assumed to pass over them. `minimumOpenBoundaryLength` is only a
necessary geometric size check; `donningClearanceValidated` stays false until
the body-contact dressing operation is actually checked.

All `garmentAccepted`, `bodyFitValidated` and `materialCalibrated` flags remain
false in this pure pattern module. Strain, contact, seam progress, waist slip,
physical dressing and motion acceptance belong to subsequent actual solver
measurements.

## Sources and checks

Measurement separation, excluding seam/dart allowances from net dimensions,
and a sewing sequence through leg seams, crotch, closure, waistband and hems
follow the principles described in [NMSU, Making Perfect Pants](https://pubs.nmsu.edu/_c/C227/).
That source also distinguishes crotch depth from front/back crotch lengths;
the candidate does not copy its sample ease values as material laws.
Side-opening shorts and distinct waistband operations are documented by the
pattern author in [Megan Nielsen, Flint Sewalong](https://blog.megannielsen.com/flint-sewalong/).
No commercial pattern coordinates or clothing assets are imported.

The cut-away corners, independent gusset and changed construction order follow
the method explained by the pattern designer in [Thread Theory, Adding a
Gusset](https://threadtheoryblog.wordpress.com/2014/12/03/jutland-sew-along-adding-a-gusset-and-removable-knee-pads/).
Matching original notches and sewing without stretching the edges is also
shown in [5 out of 4, Installing a Full Gusset](https://5outof4.com/wp-content/uploads/2019/01/Installing-a-full-gusset.pdf).
That latter knit-garment tutorial supplies a sewing principle, not the woven
fabric properties or numeric dimensions used here.

The distinction between insufficient crotch depth and insufficient wrap, working
on original seam lines, and checking the related pattern pieces after expansion
follows [Thread Theory, Creating a Roomier Trouser Crotch](https://threadtheoryblog.wordpress.com/2015/03/20/tutorial-easy-ways-to-create-a-roomier-trouser-crotch/).
Its fitted-toile method informs the process; the numeric increments here are a
new candidate to be physically sewn and reviewed, not inferred from a 3D shell.

Run `node --test tools/test-shorts-pattern.mjs`. These are pure source-geometry
tests, not a webpage, GPU, person simulation or visual-fit certification.
