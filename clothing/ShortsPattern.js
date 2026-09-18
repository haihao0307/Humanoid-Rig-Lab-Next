/* Original two-dimensional candidate shorts draft. All material lengths are metres.
 * This file is a plain script for source/assembly.json concatenation. It has no
 * body mesh, formed-garment surface, rendering or simulation dependency. */
const SHORTS_PATTERN_VERSION = 'original-relaxed-gusset-shorts-4';

function createShortsPattern(measurements, options = {}) {
  const m = measurements;
  if (!m || m.unit !== 'm') throw Error('Shorts measurements must explicitly use metres');
  const positive = (value, name) => {
    if (!Number.isFinite(value) || value <= 0) throw Error('Invalid shorts measurement: ' + name);
    return value;
  };
  const required = ['waistFrontArc', 'waistBackArc', 'hipFrontArc', 'hipBackArc',
    'waistTopFrontArc', 'waistTopBackArc', 'waistToHip', 'crotchDepth', 'frontRiseLength', 'backRiseLength'];
  for (const key of required) positive(m[key], key);
  for (const side of ['left', 'right']) positive(m.thighCircumference?.[side], 'thighCircumference.' + side);
  const waist = m.waistFrontArc + m.waistBackArc, hip = m.hipFrontArc + m.hipBackArc;
  if (waist > 3 || hip > 3 || m.crotchDepth > 1) throw Error('Shorts dimensions exceed the metre-sized human draft domain');
  const o = { columns: 7, rows: 13, hipRow: 5, crotchRow: 8, waistbandRows: 2,
    waistEase: .014, hipEase: .100, thighEase: .080, hemCircumference: null, crotchDrop: .012,
    frontRiseEase: .024, backRiseEase: .038, inseamLength: .155,
    waistbandHeight: .028, sideIntake: .014, inseamTaper: .018,
    backWaistRaise: .018, seamAllowance: .010, hemAllowance: .022,
    openingExtraDepth: .020, initialClearance: .045, gussetWidth: .060, ...options };
  for (const key of ['columns', 'rows', 'hipRow', 'crotchRow', 'waistbandRows'])
    if (!Number.isInteger(o[key])) throw Error('Shorts grid dimensions must be integers');
  if (o.columns < 3 || o.columns > 32 || o.rows > 48 || o.hipRow < 2 || o.crotchRow <= o.hipRow + 1 || o.rows <= o.crotchRow + 1 || o.waistbandRows < 1 || o.waistbandRows > 8)
    throw Error('Invalid structured shorts grid');
  for (const key of ['inseamLength', 'waistbandHeight', 'initialClearance', 'gussetWidth']) positive(o[key], key);
  if (o.hemCircumference != null) positive(o.hemCircumference, 'hemCircumference');
  for (const key of ['waistEase', 'hipEase', 'thighEase', 'crotchDrop', 'frontRiseEase', 'backRiseEase', 'sideIntake', 'backWaistRaise', 'seamAllowance', 'hemAllowance', 'openingExtraDepth'])
    if (!Number.isFinite(o[key]) || o[key] < 0) throw Error('Invalid shorts option: ' + key);
  if (!Number.isFinite(o.inseamTaper) || Math.abs(o.inseamTaper) >= o.inseamLength)
    throw Error('Shorts inseam taper must be shorter than the inseam');
  const depth = m.crotchDepth + o.crotchDrop;
  if (m.waistToHip >= depth) throw Error('Hip line must be above the crotch line');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  const length = points => points.slice(1).reduce((sum, p, i) => sum + dist(points[i], p), 0);
  const cubic = (a, b, c, d, t) => a.map((v, k) => v * (1 - t) ** 3 + 3 * b[k] * (1 - t) ** 2 * t + 3 * c[k] * (1 - t) * t * t + d[k] * t ** 3);
  const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));
  const last = a => a[a.length - 1];
  const pieces = [], seams = [], drafts = {};
  const sideRatio = m.waistFrontArc / waist;
  const hipRatio = m.hipFrontArc / hip;
  const verticalInseam = Math.sqrt(o.inseamLength ** 2 - o.inseamTaper ** 2);
  const hemY = depth + verticalInseam;
  const index = (r, c) => r * (o.columns + 1) + c;
  const triangleQuality = (uv, ids, orientation) => {
    const [a, b, c] = ids.map(i => uv[i]);
    const area2 = orientation * ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    if (area2 <= 0) return -Infinity;
    return area2 / (dist(a, b) ** 2 + dist(b, c) ** 2 + dist(c, a) ** 2);
  };

  // The shared side-line profile and translated inseam guarantee true seam
  // lengths without scaling material after cutting. Centre-rise shaping absorbs
  // front/back waist differences. Darts and their folds are not faked here.
  for (const kind of ['front', 'back']) {
    const front = kind === 'front';
    const hipWidth = ((front ? m.hipFrontArc : m.hipBackArc) + o.hipEase * (front ? hipRatio : 1 - hipRatio)) / 2;
    const waistWidth = ((front ? m.waistFrontArc : m.waistBackArc) + o.waistEase * (front ? sideRatio : 1 - sideRatio)) / 2;
    const raise = front ? 0 : o.backWaistRaise;
    if (raise >= waistWidth) throw Error('Back waist raise exceeds original waist seam length');
    const cw = [hipWidth - o.sideIntake - Math.sqrt(waistWidth ** 2 - raise ** 2), -raise];
    const hipCenter = [0, m.waistToHip];
    const makeRise = extension => seq(o.crotchRow + 1, r => {
      if (r <= o.hipRow) return lerp(cw, hipCenter, r / o.hipRow);
      const t = (r - o.hipRow) / (o.crotchRow - o.hipRow), h = depth - m.waistToHip;
      return cubic(hipCenter, [0, m.waistToHip + h * .72], [-extension * .32, depth], [-extension, depth], t);
    });
    const desiredRise = (front ? m.frontRiseLength + o.frontRiseEase : m.backRiseLength + o.backRiseEase);
    let low = 0, high = hip * .30;
    if (length(makeRise(low)) > desiredRise || length(makeRise(high)) < desiredRise)
      throw Error('Measured ' + kind + ' rise cannot be drafted at this crotch depth; revise the measured draft inputs');
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (length(makeRise(mid)) < desiredRise) low = mid; else high = mid;
    }
    const extension = (low + high) / 2;
    drafts[kind] = { kind, hipWidth, waistWidth, raise, extension, rise: makeRise(extension), desiredRise };
  }
  const riseAndHipBaseWidth = drafts.front.hipWidth + drafts.back.hipWidth + drafts.front.extension + drafts.back.extension;
  const thighTarget = Math.max(m.thighCircumference.left, m.thighCircumference.right) + o.thighEase;
  // Each leg opening has its own net paper target. The default uses the larger
  // upper-thigh measurement plus an explicit design allowance; it is a first
  // relaxed-shorts candidate, not a universal tailoring rule. An explicit hem
  // target overrides this default without altering waist, hip or rise lengths.
  const hemTarget = o.hemCircumference ?? thighTarget;
  // This can be negative (taper) or positive (flare). Do not clamp the opening
  // to hip+rise width: that formerly made thighEase ineffective over 0..120 mm.
  // Front/back use the same original side profile, so every stitch still mates.
  const sideHemOffset = (hemTarget - riseAndHipBaseWidth + 2 * o.inseamTaper) / 2;
  const outerOffset = r => r <= o.hipRow
    ? -o.sideIntake * (1 - r / o.hipRow)
    : sideHemOffset * (r - o.hipRow) / (o.rows - o.hipRow);
  const outerY = r => r <= o.hipRow ? m.waistToHip * r / o.hipRow
    : r <= o.crotchRow ? m.waistToHip + (depth - m.waistToHip) * (r - o.hipRow) / (o.crotchRow - o.hipRow)
      : depth + verticalInseam * (r - o.crotchRow) / (o.rows - o.crotchRow);

  // This is a new source-paper cut, before any placement or simulation. Remove
  // the old four-way crotch corners, and terminate rise/inseam at either end of
  // a straight gusset seam. The middle row is its half-arclength notch. Rebuild
  // that row's interior and adjacent triangles; do not layer a patch over C.
  for (const d of Object.values(drafts)) {
    const riseEnd = d.rise[o.crotchRow - 1].slice();
    const inseamEnd = [-d.extension + o.inseamTaper / (o.rows - o.crotchRow), outerY(o.crotchRow + 1)];
    d.gussetCut = { riseEnd, inseamEnd, midpoint: lerp(riseEnd, inseamEnd, .5),
      oldCorner: d.rise[o.crotchRow].slice(), edgeLength: dist(riseEnd, inseamEnd),
      removedRiseLength: dist(riseEnd, d.rise[o.crotchRow]),
      removedInseamLength: dist(inseamEnd, d.rise[o.crotchRow]) };
    if (o.gussetWidth / 2 >= d.gussetCut.edgeLength)
      throw Error('Gusset width cannot span the measured original cut edges');
  }

  for (const id of ['FL', 'FR', 'BL', 'BR']) {
    const kind = id[0] === 'F' ? 'front' : 'back', side = id[1] === 'L' ? 'left' : 'right';
    const mirror = side === 'left' ? -1 : 1, d = drafts[kind];
    const materialCoordinates = [];
    for (let r = 0; r <= o.rows; r++) {
      const inner = r === o.crotchRow ? d.gussetCut.midpoint : r < o.crotchRow ? d.rise[r] : [-d.extension + o.inseamTaper * (r - o.crotchRow) / (o.rows - o.crotchRow), outerY(r)];
      const outer = [d.hipWidth + outerOffset(r), outerY(r)];
      if (outer[0] <= inner[0]) throw Error('Original shorts paper has a folded or zero-width row');
      for (let c = 0; c <= o.columns; c++) {
        const uv = lerp(inner, outer, c / o.columns);
        materialCoordinates.push([uv[0] * mirror, uv[1]]);
      }
    }
    const triangles = [];
    for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.columns; c++) {
      const a = index(r, c), b = index(r, c + 1), z = index(r + 1, c), e = index(r + 1, c + 1);
      const one = [[a, b, z], [b, e, z]], two = [[a, b, e], [a, e, z]];
      const quality = pair => Math.min(...pair.map(t => triangleQuality(materialCoordinates, t, mirror)));
      const pair = quality(one) > quality(two) ? one : two;
      if (!Number.isFinite(quality(pair))) throw Error('Original shorts grid contains a folded material cell');
      triangles.push(...pair.map(t => mirror < 0 ? [t[0], t[2], t[1]] : t));
    }
    const boundaries = {
      waist: seq(o.columns + 1, c => index(0, c)),
      outseam: seq(o.rows + 1, r => index(r, o.columns)),
      hem: seq(o.columns + 1, c => index(o.rows, o.columns - c)),
      inseam: seq(o.rows - o.crotchRow, r => index(o.rows - r, 0)),
      rise: seq(o.crotchRow, r => index(o.crotchRow - 1 - r, 0)),
      gusset: [index(o.crotchRow - 1, 0), index(o.crotchRow, 0), index(o.crotchRow + 1, 0)]
    };
    const bounds = m.metadata?.bounds || {
      minZ: Number.isFinite(m.metadata?.hip?.minZ) && Number.isFinite(m.metadata?.waist?.minZ) ? Math.min(m.metadata.hip.minZ, m.metadata.waist.minZ) : undefined,
      maxZ: Number.isFinite(m.metadata?.hip?.maxZ) && Number.isFinite(m.metadata?.waist?.maxZ) ? Math.max(m.metadata.hip.maxZ, m.metadata.waist.maxZ) : undefined
    };
    const waistY = Number.isFinite(m.metadata?.waistY) ? m.metadata.waistY : 0;
    const centerZ = Number.isFinite(m.metadata?.centerZ) ? m.metadata.centerZ : (m.metadata?.waist?.centerZ ?? 0);
    const plane = kind === 'front' ? (bounds.maxZ ?? centerZ + hip / 5) + o.initialClearance : (bounds.minZ ?? centerZ - hip / 5) - o.initialClearance;
    pieces.push({ id, kind: 'leg-panel', side, bodySide: kind, unit: 'm', materialCoordinates, triangles, boundaries,
      sourceMirror: mirror, grainDirection: [0, 1], grid: { columns: o.columns, rows: o.rows },
      landmarks: { gussetRise: index(o.crotchRow - 1, 0), gussetNotch: index(o.crotchRow, 0), gussetInseam: index(o.crotchRow + 1, 0), centerWaist: index(0, 0), sideWaist: index(0, o.columns),
        innerHem: index(o.rows, 0), outerHem: index(o.rows, o.columns), centerHip: index(o.hipRow, 0) },
      gussetCut: { removedCornerUV: [d.gussetCut.oldCorner[0] * mirror, d.gussetCut.oldCorner[1]],
        riseCutback: d.gussetCut.removedRiseLength, inseamCutback: d.gussetCut.removedInseamLength,
        newBoundary: boundaries.gusset.slice(), sourceRedraftedRows: [o.crotchRow], removesOldCorner: true },
      placement: { kind: 'rigid_flat_panel', origin: [mirror * (d.extension + .015), waistY, plane], basisU: [1, 0, 0], basisV: [0, -1, 0],
        rightSide: kind === 'front' ? 'opposite_uv_normal' : 'along_uv_normal', sourceShapeUnchanged: true },
      seamAllowance: o.seamAllowance, hemAllowance: o.hemAllowance,
      allowanceImplementation: 'reserved_metadata_not_yet_meshed', cutDomain: 'net_seamline_candidate' });
  }

  const piece = id => pieces.find(p => p.id === id);
  const edgeLength = (p, indices) => length(indices.map(i => p.materialCoordinates[i]));

  const halfWidth = o.gussetWidth / 2;
  const frontHeight = Math.sqrt(drafts.front.gussetCut.edgeLength ** 2 - halfWidth ** 2);
  const backHeight = Math.sqrt(drafts.back.gussetCut.edgeLength ** 2 - halfWidth ** 2);
  // Positive-UV polygon traversal: front, right, back, left. The same independent
  // material piece has four cut edges; no centre-rise or inseam crosses it.
  const gussetCorners = [[0, -frontHeight], [halfWidth, 0], [0, backHeight], [-halfWidth, 0]];
  const gussetUV = [];
  for (let i = 0; i < 4; i++) gussetUV.push(gussetCorners[i], lerp(gussetCorners[i], gussetCorners[(i + 1) % 4], .5));
  gussetUV.push([0, 0]);
  const gussetBoundaries = { frontLeft: [0, 7, 6], frontRight: [0, 1, 2], backLeft: [4, 5, 6], backRight: [4, 3, 2] };
  const frontPlacement = piece('FR').placement;
  const crotchY = Number.isFinite(m.metadata?.crotchY) ? m.metadata.crotchY : frontPlacement.origin[1] - m.crotchDepth;
  const centerX = Number.isFinite(m.waistCenter?.[0]) ? m.waistCenter[0] : 0;
  const centerZ = m.waistCenter?.[2] ?? m.metadata?.centerZ ?? m.metadata?.waist?.centerZ ?? 0;
  pieces.push({ id: 'G', kind: 'gusset', unit: 'm', materialCoordinates: gussetUV,
    triangles: seq(8, i => [8, i, (i + 1) % 8]), boundaries: gussetBoundaries,
    landmarks: { front: 0, right: 2, back: 4, left: 6 }, grainDirection: [0, 1],
    sourceContour: { width: o.gussetWidth, frontHeight, backHeight, frontEdgeLength: drafts.front.gussetCut.edgeLength,
      backEdgeLength: drafts.back.gussetCut.edgeLength, midpointFraction: .5 },
    handlingPoints: [0, 4].map(index => ({ index, releaseWhenStitched: true })),
    // Preserve one flat rigid paper, opening its transverse direction by 10 degrees
    // to distinguish left/right notches without turning the paper across both thighs.
    // Only front/back boundary tips are held, leaving transverse roll free.
    // This is an assembly candidate, not a universal body-clearance certificate.
    placement: { kind: 'rigid_flat_panel', origin: [centerX, crotchY - halfWidth - .010, centerZ],
      basisU: [Math.sin(Math.PI / 18), Math.cos(Math.PI / 18), 0], basisV: [0, 0, -1], rightSide: 'opposite_uv_normal', sourceShapeUnchanged: true,
      method: 'side_identified_flat_gusset_two_axis_grips_candidate', topBelowMeasuredCrotchM: .010 + halfWidth * (1 - Math.cos(Math.PI / 18)) },
    seamAllowance: o.seamAllowance, allowanceImplementation: 'reserved_metadata_not_yet_meshed', cutDomain: 'net_seamline_candidate' });
  const addSeam = (id, aid, ae, bid, be, kind = 'sewn', ai, bi) => {
    const a = piece(aid), b = piece(bid), ia = ai || a.boundaries[ae], ib = bi || b.boundaries[be];
    if (ia.length !== ib.length) throw Error('Shorts stitch sample counts must agree: ' + id);
    const la = edgeLength(a, ia), lb = edgeLength(b, ib);
    const cumulative = [0];
    for (let i = 1; i < ia.length; i++) cumulative.push(last(cumulative) + dist(a.materialCoordinates[ia[i - 1]], a.materialCoordinates[ia[i]]));
    const stage = kind === 'closure' ? 5 : id.startsWith('center-') ? 0 : id.startsWith('gusset-') ? 1 : id.startsWith('waistband-') ? 3 : id.startsWith('waist-') ? 4 : 2;
    seams.push({ id, kind, stage, initiallyActive: false, a: { pieceId: aid, edge: ae, indices: ia.slice() }, b: { pieceId: bid, edge: be, indices: ib.slice() },
      pairs: ia.map((x, i) => ({ a: x, b: ib[i], t: la > 0 ? cumulative[i] / la : 0 })),
      restLengthA: la, restLengthB: lb, lengthMismatch: Math.abs(la - lb),
      maximumSegmentMismatch: Math.max(0, ...ia.slice(1).map((x, i) => Math.abs(dist(a.materialCoordinates[ia[i]], a.materialCoordinates[x]) - dist(b.materialCoordinates[ib[i]], b.materialCoordinates[ib[i + 1]])))) });
  };
  addSeam('center-front', 'FL', 'rise', 'FR', 'rise');
  addSeam('center-back', 'BL', 'rise', 'BR', 'rise');
  for (const [id, edge] of [['FL', 'frontLeft'], ['FR', 'frontRight'], ['BL', 'backLeft'], ['BR', 'backRight']])
    addSeam('gusset-' + id, id, 'gusset', 'G', edge);
  addSeam('inseam-left', 'FL', 'inseam', 'BL', 'inseam');
  addSeam('inseam-right', 'FR', 'inseam', 'BR', 'inseam');
  addSeam('outseam-right', 'FR', 'outseam', 'BR', 'outseam');
  const openingDepth = Math.min(depth, m.waistToHip + o.openingExtraDepth);
  let openingRow = 1;
  while (openingRow < o.crotchRow && outerY(openingRow) < openingDepth) openingRow++;
  const leftA = piece('FL').boundaries.outseam, leftB = piece('BL').boundaries.outseam;
  addSeam('outseam-left', 'FL', 'outseam', 'BL', 'outseam', 'sewn', leftA.slice(openingRow), leftB.slice(openingRow));
  addSeam('side-opening-left', 'FL', 'outseam', 'BL', 'outseam', 'closure', leftA.slice(0, openingRow + 1), leftB.slice(0, openingRow + 1));

  // Waist ring order is left side -> centre front -> right side -> centre back
  // -> left side. Each band is cut as an annular sector in 2D. Its sampled
  // lower and upper edge lengths equal the recorded measurements exactly.
  const ring = ['FL', 'FR', 'BR', 'BL'];
  let lowerStart = 0, upperStart = 0;
  const upperTotal = m.waistTopFrontArc + m.waistTopBackArc + o.waistEase;
  for (const pid of ring) {
    const p = piece(pid), isFront = p.bodySide === 'front';
    const waistIndices = ['FL', 'BR'].includes(pid) ? p.boundaries.waist.slice().reverse() : p.boundaries.waist.slice();
    const lowerLength = edgeLength(p, waistIndices);
    const upperLength = ((isFront ? m.waistTopFrontArc : m.waistTopBackArc) + o.waistEase * (isFront ? sideRatio : 1 - sideRatio)) / 2;
    const delta = lowerLength - upperLength, h = o.waistbandHeight, n = o.columns;
    if (Math.abs(delta) >= 2 * n * h) throw Error('Waistband contour difference is too large for this draft');
    const angle = Math.abs(delta) < 1e-12 ? 0 : 2 * n * Math.asin(delta / (2 * n * h));
    const radius = angle ? lowerLength * h / delta : 0;
    const materialCoordinates = [];
    for (let r = 0; r <= o.waistbandRows; r++) for (let c = 0; c <= n; c++) {
      const v = h * r / o.waistbandRows, phi = angle * c / n;
      materialCoordinates.push(angle ? [(radius - v) * Math.sin(phi), radius - (radius - v) * Math.cos(phi)] : [lowerLength * c / n, v]);
    }
    const wi = (r, c) => r * (n + 1) + c, triangles = [];
    for (let r = 0; r < o.waistbandRows; r++) for (let c = 0; c < n; c++) {
      const a = wi(r, c), b = wi(r, c + 1), z = wi(r + 1, c), e = wi(r + 1, c + 1);
      triangles.push([a, b, e], [a, e, z]);
    }
    const id = 'W' + pid, boundaries = { lower: seq(n + 1, c => wi(0, c)), upper: seq(n + 1, c => wi(o.waistbandRows, c)),
      start: seq(o.waistbandRows + 1, r => wi(r, 0)), end: seq(o.waistbandRows + 1, r => wi(r, n)) };
    const parentWorld = i => p.placement.origin.map((x, k) => x + p.placement.basisU[k] * p.materialCoordinates[i][0] + p.placement.basisV[k] * p.materialCoordinates[i][1]);
    const waistStart = parentWorld(waistIndices[0]), waistEnd = parentWorld(last(waistIndices));
    const direction = waistEnd.map((x, k) => x - waistStart[k]), directionLength = Math.hypot(...direction);
    const bandU = direction.map(x => x / directionLength);
    // The actual parent waist traversal fixes the band direction, including
    // reversed back sections. Lift in that same flat plane, perpendicular to
    // the waist, so no band begins on its parent or on the opposite section.
    const bandV = [-bandU[1], bandU[0], 0];
    if (bandV[1] < 0) for (let k = 0; k < 3; k++) bandV[k] *= -1;
    const handlingGap = .025 - Math.min(0, ...materialCoordinates.map(uv => uv[1]));
    const bandOrigin = waistStart.map((x, k) => x + bandV[k] * handlingGap);
    pieces.push({ id, kind: 'waistband', unit: 'm', parentPanel: pid, materialCoordinates, triangles, boundaries, grainDirection: [1, 0],
      grid: { columns: n, rows: o.waistbandRows }, sourceContour: { lowerLength, upperLength, height: h, angle },
      waistRange: { order: ring.indexOf(pid), sector: p.bodySide + '-' + p.side, lowerStart, lowerEnd: lowerStart + lowerLength,
        upperStart, upperEnd: upperStart + upperLength, direction: 'left-side_front_right-side_back_left-side' },
      supportPoints: boundaries.upper.map((vertex, c) => ({ vertex, fraction: c / n, circumferenceS: (upperStart + upperLength * c / n) / upperTotal,
        sector: p.bodySide + '-' + p.side, purpose: 'optional_temporary_waistband_handling_not_a_leg_shape_target' })),
      waistSupports: boundaries.upper.map((index, c) => ({ index, side: p.side, front: isFront, t: ['FL', 'BR'].includes(pid) ? 1 - c / n : c / n })),
      placement: { kind: 'rigid_flat_panel', origin: bandOrigin,
        basisU: bandU, basisV: bandV, rightSide: 'along_uv_normal', sourceShapeUnchanged: true,
        method: 'parallel_to_actual_parent_waist_traversal_with_clear_flat_handling_gap', handlingGapM: .025 },
      seamAllowance: o.seamAllowance, allowanceImplementation: 'reserved_metadata_not_yet_meshed', cutDomain: 'net_seamline_candidate' });
    addSeam('waist-' + pid, pid, 'waist', id, 'lower', 'sewn', waistIndices, boundaries.lower);
    lowerStart += lowerLength; upperStart += upperLength;
  }
  for (let i = 0; i < ring.length; i++) addSeam('waistband-' + ring[i] + '-' + ring[(i + 1) % ring.length], 'W' + ring[i], 'end', 'W' + ring[(i + 1) % ring.length], 'start', i === ring.length - 1 ? 'closure' : 'sewn');
  const junctions = [
    ['front', [['FL', 'gussetRise'], ['FR', 'gussetRise'], ['G', 'front']], ['center-front', 'gusset-FL', 'gusset-FR']],
    ['back', [['BL', 'gussetRise'], ['BR', 'gussetRise'], ['G', 'back']], ['center-back', 'gusset-BL', 'gusset-BR']],
    ['left', [['FL', 'gussetInseam'], ['BL', 'gussetInseam'], ['G', 'left']], ['inseam-left', 'gusset-FL', 'gusset-BL']],
    ['right', [['FR', 'gussetInseam'], ['BR', 'gussetInseam'], ['G', 'right']], ['inseam-right', 'gusset-FR', 'gusset-BR']]
  ].map(([id, members, sewnBy]) => ({ id: 'gusset-' + id, kind: 'three_independent_original_material_points',
    members: members.map(([pieceId, landmark]) => { const p = piece(pieceId), index = p.landmarks[landmark]; return { pieceId, index, uv: p.materialCoordinates[index].slice() }; }),
    sewnBy, extraWeld: false }));
  const maximumMismatch = Math.max(...seams.map(s => Math.max(s.lengthMismatch, s.maximumSegmentMismatch)));
  const hemCircumference = edgeLength(piece('FL'), piece('FL').boundaries.hem) + edgeLength(piece('BL'), piece('BL').boundaries.hem);
  const crotchWidth = ['FL', 'BL'].reduce((sum, id) => { const p = piece(id); return sum + dist(p.materialCoordinates[index(o.crotchRow, 0)], p.materialCoordinates[index(o.crotchRow, o.columns)]); }, 0);
  if (Math.abs(hemCircumference - hemTarget) > 1e-10) throw Error('Cut hem does not match its original paper target');
  const topology = auditShortsPatternTopology({ pieces, seams }, false);
  return { version: SHORTS_PATTERN_VERSION, unit: 'm', status: 'original_candidate_pattern_not_fitted_or_accepted',
    measurements: JSON.parse(JSON.stringify(m)), options: o, pieces, seams, junctions,
    opening: { side: 'left', closureSeams: ['side-opening-left', 'waistband-BL-FL'], row: openingRow, sourceDepth: outerY(openingRow),
      closedWaistLength: lowerStart, hipLength: hip + o.hipEase, minimumOpenBoundaryLength: lowerStart + 2 * edgeLength(piece('FL'), leftA.slice(0, openingRow + 1)),
      donningClearanceValidated: false, closureRequiredAfterDonning: true },
    draft: { frontCrotchExtension: drafts.front.extension, backCrotchExtension: drafts.back.extension,
      frontRiseLength: edgeLength(piece('FR'), piece('FR').boundaries.rise),
      backRiseLength: edgeLength(piece('BR'), piece('BR').boundaries.rise), crotchLineWidth: crotchWidth, riseAndHipBaseWidth, thighTarget, hemCircumference, hemTarget,
      originalRiseLengthsBeforeGussetCut: { front: length(drafts.front.rise), back: length(drafts.back.rise) },
      cutRiseLengths: { front: edgeLength(piece('FR'), piece('FR').boundaries.rise), back: edgeLength(piece('BR'), piece('BR').boundaries.rise) },
      gusset: { width: o.gussetWidth, frontHeight, backHeight, length: frontHeight + backHeight,
        frontEdgeLength: drafts.front.gussetCut.edgeLength, backEdgeLength: drafts.back.gussetCut.edgeLength,
        centerRouteAddedLength: frontHeight + backHeight - drafts.front.gussetCut.removedRiseLength - drafts.back.gussetCut.removedRiseLength,
        replacesRemovedFourPanelCorners: true },
      hemTargetSource: o.hemCircumference == null ? 'measured_upper_thigh_plus_design_ease' : 'explicit_net_leg_opening',
      waistLength: lowerStart, waistTopLength: upperStart, leftRightSizing: 'symmetric_draft_uses_larger_measured_thigh', darts: 'none_in_this_candidate' },
    checks: { maximumSeamMismatch: maximumMismatch, seamLengthsMatched: maximumMismatch < 1e-10,
      topologyAfterAllClosures: topology, hipEase: o.hipEase, crotchThighWidthSufficient: crotchWidth >= thighTarget,
      sourceUVOnly: true, meshStartsAsRigidFlatPieces: true, materialCalibrated: false, bodyFitValidated: false, garmentAccepted: false },
    sewingOrder: ['join_front_and_back_rise_to_new_gusset_endpoints', 'hold_and_sew_four_gusset_edges_at_original_notches',
      'join_leg_side_and_inseams_leave_left_opening', 'join_contoured_waistband_sections', 'attach_contoured_waistband', 'dress_with_left_opening_unfastened',
      'close_left_opening_and_waistband', 'turn_and_sew_hem_when_allowance_mesh_is_implemented'] };
}

// Independent combinatorial check on the actual generated triangles after
// identifying only declared seam pairs. No source coordinates are welded.
function auditShortsPatternTopology(pattern, includeWaistband = true) {
  const parts = includeWaistband ? pattern.pieces : pattern.pieces.filter(p => p.kind !== 'waistband');
  const offsets = new Map(); let count = 0;
  for (const p of parts) { offsets.set(p.id, count); count += p.materialCoordinates.length; }
  const parent = Array.from({ length: count }, (_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  for (const seam of pattern.seams) if (offsets.has(seam.a.pieceId) && offsets.has(seam.b.pieceId))
    for (const pair of seam.pairs) join(offsets.get(seam.a.pieceId) + pair.a, offsets.get(seam.b.pieceId) + pair.b);
  const edges = new Map(), vertices = new Set(); let faces = 0, degenerateFaces = 0;
  for (const p of parts) for (const t of p.triangles) {
    const ids = t.map(i => find(offsets.get(p.id) + i)); ids.forEach(i => vertices.add(i)); faces++;
    if (new Set(ids).size !== 3) degenerateFaces++;
    for (let k = 0; k < 3; k++) {
      const a = ids[k], b = ids[(k + 1) % 3], key = a < b ? a + ':' + b : b + ':' + a;
      const e = edges.get(key); if (e) e.count++; else edges.set(key, { a, b, count: 1 });
    }
  }
  const boundary = new Map(); let nonManifoldEdges = 0;
  for (const e of edges.values()) {
    if (e.count > 2) nonManifoldEdges++;
    if (e.count === 1) { if (!boundary.has(e.a)) boundary.set(e.a, []); if (!boundary.has(e.b)) boundary.set(e.b, []); boundary.get(e.a).push(e.b); boundary.get(e.b).push(e.a); }
  }
  const seen = new Set(); let boundaryLoops = 0;
  for (const start of boundary.keys()) if (!seen.has(start)) {
    boundaryLoops++; const queue = [start]; seen.add(start);
    while (queue.length) for (const n of boundary.get(queue.pop())) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
  let unexpectedOpenSeamEdges = 0;
  for (const p of parts) for (const [name, indices] of Object.entries(p.boundaries)) {
    const intendedOpening = p.kind === 'leg-panel' ? name === 'hem' || (!includeWaistband && name === 'waist') : name === 'upper';
    if (intendedOpening) continue;
    for (let i = 1; i < indices.length; i++) {
      const a = find(offsets.get(p.id) + indices[i - 1]), b = find(offsets.get(p.id) + indices[i]);
      const key = a < b ? a + ':' + b : b + ':' + a;
      if (edges.get(key)?.count === 1) unexpectedOpenSeamEdges++;
    }
  }
  const eulerCharacteristic = vertices.size - edges.size + faces;
  const boundaryVerticesHaveDegreeTwo = [...boundary.values()].every(a => a.length === 2);
  return { vertices: vertices.size, edges: edges.size, faces, eulerCharacteristic, boundaryLoops, boundaryVerticesHaveDegreeTwo,
    nonManifoldEdges, degenerateFaces, unexpectedOpenSeamEdges,
    valid: eulerCharacteristic === -1 && boundaryLoops === 3 && boundaryVerticesHaveDegreeTwo && nonManifoldEdges === 0 && degenerateFaces === 0 && unexpectedOpenSeamEdges === 0,
    scope: 'combinatorial_all_seams_and_closures_identified_not_a_physical_sewing_result' };
}
