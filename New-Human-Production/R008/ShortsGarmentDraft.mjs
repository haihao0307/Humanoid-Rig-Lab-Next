import {resolveShortsWaistFit} from './ShortsWaistFit.mjs';
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
    handlingPoints: [0, 2, 4, 6].map(index => ({ index, releaseWhenStitched: true })),
    // This source-frame sagittal placement remains flat and rigid. Its top is
    // 10 mm below the measured crotch; all pieces subsequently receive the
    // same hips rigid transform. Clearance is checked on the actual body, not
    // inferred for every future body shape from this placement rule alone.
    placement: { kind: 'rigid_flat_panel', origin: [centerX, crotchY - halfWidth - .010, centerZ],
      basisU: [0, 1, 0], basisV: [0, 0, -1], rightSide: 'opposite_uv_normal', sourceShapeUnchanged: true,
      method: 'sagittal_hand_held_paper_below_measured_crotch', topBelowMeasuredCrotchM: .010 },
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

/* End canonical two-dimensional source cut; R008 consumer follows. */
/* R008 low-rise garment authoring. Source two-dimensional R24 cut is appended
 * below verbatim from c595390448b7c307ebf1fcd26566bd947411c319.
 * No stored garment vertex array, skin weights or per-frame bone placement.
 * Sections are supplied by the actual generated subject's body adapter.
 * The currently measurable R008 hip/thigh surface is an existing-clothing
 * envelope: this module never relabels it bare skin or fills missing skin. */
const DRAFT_VERSION='r008-low-rise-linen-casing-elastic-source-draft@3';
const REFERENCE_STATURE_M=1.7194712;
const ACCEPTED_R24_GUSSET_WIDTH_M=.060;
const PAPER_SOURCE={commit:'c595390448b7c307ebf1fcd26566bd947411c319',file:'clothing/ShortsPattern.js',sha256:'c2722ae9742d66c7cda4638a6fee2a4a8c148a0faccb61bf96861c648d1a9d4d'};
const positive=(x,name)=>{if(!Number.isFinite(x)||x<=0)throw Error('Shorts draft requires positive '+name);return x;};
const finite=(x,name)=>{if(!Number.isFinite(x))throw Error('Shorts draft requires finite '+name);return x;};
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
const yOf=(x,name)=>finite(typeof x==='number'?x:x?.y??x?.yM??x?.heightY,name);
function pointsOf(section){
 if(Array.isArray(section?.points))return section.points;
 const contours=section?.contours??section?.loops??section?.connectedContours;
 if(Array.isArray(contours)){
  const lists=contours.map(c=>Array.isArray(c)?c:c.points??c.positions??[]).filter(c=>c.length>=3);
  if(lists.length)return lists.flat();
 }
 throw Error('Actual closed generated-envelope section points required');
}
function convexHull(points){
 const sorted=points.map(p=>{if(p.length!==3||p.some(v=>!Number.isFinite(v)))throw Error('Nonfinite actual section');return [p[0],p[2]];}).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),lo=[],hi=[];
 for(const p of sorted){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=0)lo.pop();lo.push(p);}
 for(let i=sorted.length-1;i>=0;i--){const p=sorted[i];while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=0)hi.pop();hi.push(p);}lo.pop();hi.pop();const hull=[...lo,...hi];if(hull.length<3)throw Error('Degenerate generated body envelope');return hull;
}
function offsetContour(hull,pad){
 const normals=hull.map((p,i)=>{const q=hull[(i+1)%hull.length],d=Math.hypot(q[0]-p[0],q[1]-p[1]);return [(q[1]-p[1])/d,-(q[0]-p[0])/d];}),out=[];
 for(let i=0;i<hull.length;i++){const p=hull[i],a=normals[(i+hull.length-1)%hull.length],b=normals[i],start=Math.atan2(a[1],a[0]);let angle=Math.atan2(b[1],b[0])-start;while(angle<0)angle+=2*Math.PI;const steps=Math.max(1,Math.ceil(angle/(Math.PI/32)));for(let j=0;j<=steps;j++){const q=start+angle*j/steps;out.push([p[0]+pad*Math.cos(q),p[1]+pad*Math.sin(q)]);}}return out;
}
function splitLengths(hull,centerZ){let front=0,back=0;for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length],d=distance(a,b),za=a[1]-centerZ,zb=b[1]-centerZ;if(za*zb<0){const t=-za/(zb-za);if(za>=0){front+=d*t;back+=d*(1-t);}else{back+=d*t;front+=d*(1-t);}}else if((za+zb)/2>=0)front+=d;else back+=d;}return {frontM:front,backM:back,circumferenceM:front+back};}
function sectionRecord(section,y,pad,side=null){
 const all=pointsOf(section),selected=side&&section?.legContours?.[side]?pointsOf(section.legContours[side]):all,hull=convexHull(selected),minX=Math.min(...hull.map(p=>p[0])),maxX=Math.max(...hull.map(p=>p[0])),minZ=Math.min(...hull.map(p=>p[1])),maxZ=Math.max(...hull.map(p=>p[1])),centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2,offset=offsetContour(hull,pad),arcs=splitLengths(offset,centerZ);
 return {y,hull,offset,centerX,centerZ,minX,maxX,minZ,maxZ,...arcs,authority:section?.authority??section?.sourceSurfaceScope??'actual generated existing-clothing envelope, convex tensioned tape',closed:section?.closed!==false};
}
function rayPoint(record,theta){
 const direction=[Math.sin(theta),Math.cos(theta)],origin=[record.centerX,record.centerZ],poly=record.offset;let best=-Infinity,result=null;
 for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],e=[b[0]-a[0],b[1]-a[1]],q=[a[0]-origin[0],a[1]-origin[1]],det=direction[0]*e[1]-direction[1]*e[0];if(Math.abs(det)<1e-12)continue;const r=(q[0]*e[1]-q[1]*e[0])/det,t=(q[0]*direction[1]-q[1]*direction[0])/det;if(t>=-1e-8&&t<=1+1e-8&&r>best){best=r;result=[origin[0]+r*direction[0],record.y,origin[1]+r*direction[1]];}}
 if(!result||!(best>0))throw Error('Cannot sample actual generated body tape');return result;
}
function sectorPoint(record,side,front,t,easeM=0){
 const sign=side==='left'?-1:1,start=front?0:Math.PI,end=front?sign*Math.PI/2:side==='left'?3*Math.PI/2:Math.PI/2,route=Array.from({length:65},(_,i)=>rayPoint(record,start+(end-start)*i/64)),lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths.at(-1)+distance(route[i-1],route[i]));const s=Math.max(0,Math.min(1,t))*lengths.at(-1);let i=1;while(i<lengths.length-1&&lengths[i]<s)i++;const point=mix(route[i-1],route[i],(s-lengths[i-1])/(lengths[i]-lengths[i-1]));const factor=1+easeM/(2*Math.PI*Math.max(.01,(record.maxX-record.minX+record.maxZ-record.minZ)/4));point[0]=record.centerX+(point[0]-record.centerX)*factor;point[2]=record.centerZ+(point[2]-record.centerZ)*factor;return point;
}
function legRecord(section,y,pad,side,centerX){
 const raw=Array.isArray(section?.contours)?section.contours.flatMap(c=>c.points??[]):pointsOf(section),half=raw.filter(p=>side==='left'?p[0]<centerX:p[0]>centerX);if(half.length<3)throw Error('Distinct actual left/right leg envelope required');return sectionRecord({points:half,authority:section.authority},y,pad);
}
function legPoint(record,side,front,t,easeM){
 // Inner to outer via the actual front or back half of a separate leg tape.
 const inner=side==='left'?Math.PI/2:-Math.PI/2,outer=-inner;
 const route=Array.from({length:65},(_,i)=>rayPoint(record,front?inner+(outer-inner)*i/64:inner+(side==='left'?Math.PI:-Math.PI)*i/64)),lengths=[0];for(let i=1;i<route.length;i++)lengths.push(lengths.at(-1)+distance(route[i-1],route[i]));const s=t*lengths.at(-1);let i=1;while(i<64&&lengths[i]<s)i++;const point=mix(route[i-1],route[i],(s-lengths[i-1])/(lengths[i]-lengths[i-1])),factor=1+easeM/positive(record.circumferenceM,'leg circumference');point[0]=record.centerX+(point[0]-record.centerX)*factor;point[2]=record.centerZ+(point[2]-record.centerZ)*factor;return point;
}
function paperArea(piece){return piece.triangles.reduce((sum,t)=>{const[a,b,c]=t.map(i=>piece.materialCoordinates[i]);return sum+Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;},0);}
export function evaluateElasticWaistEdge(edge,positions){
 const a=Array.from(positions.subarray(edge.a*3,edge.a*3+3)),b=Array.from(positions.subarray(edge.b*3,edge.b*3+3)),currentLengthM=distance(a,b),extension=currentLengthM/positive(edge.restLengthM,'elastic source rest length')-1;
 positive(edge.axialRigidityN,'finite elastic axial rigidity');if(!Number.isFinite(currentLengthM))throw Error('Nonfinite elastic material positions');
 return {currentLengthM,restLengthM:edge.restLengthM,extension,tensionN:edge.axialRigidityN*Math.max(0,extension),complianceMPerN:edge.compliance,withinDeclaredElasticDomain:extension<=edge.maximumExtension,linenRestChanged:false};
}
export function createShortsGarmentDraft(measurements,options={}){
 const waistFit=resolveShortsWaistFit(measurements,options),waistDropM=waistFit.waistDropM;
 const {waistbandWidthM=.038,elasticReduction=.10,elasticAxialRigidityN=100,elasticMaximumExtension=.35,bodyClearanceM=.0025,densityKgM2=.22,sectionAt=measurements?.sectionAt,sagittalAtY=measurements?.sagittalAtY}=options;
 if(measurements?.unit!==undefined&&measurements.unit!=='m')throw Error('R008 shorts measurements require metres');if(typeof sectionAt!=='function')throw Error('Actual generated subject sectionAt(y) callback required');
 if(!Number.isFinite(waistbandWidthM)||waistbandWidthM<.035||waistbandWidthM>.040||!Number.isFinite(elasticReduction)||elasticReduction<.08||elasticReduction>.12)throw Error('Requested casing/elastic parameters exceed the declared authoring range');
 for(const[x,name]of [[elasticAxialRigidityN,'finite elastic EA N'],[elasticMaximumExtension,'elastic maximum extension'],[bodyClearanceM,'body clearance'],[densityKgM2,'linen areal density']])positive(x,name);
 if(elasticMaximumExtension<elasticReduction/(1-elasticReduction)||elasticMaximumExtension>1)throw Error('Elastic extension limit excludes the declared wearing stretch');
 const heightM=positive(measurements.heightM,'generated subject height'),scale=heightM/REFERENCE_STATURE_M,referenceY=yOf(measurements.referenceWaist,'source visible waistband reference Y'),upperY=referenceY-waistDropM,lowerY=upperY-waistbandWidthM,middleY=(upperY+lowerY)/2,hipY=yOf(measurements.hip,'actual hip plane Y'),crotchY=yOf(measurements.crotchY??measurements.crotch,'actual crotch Y');
 if(!(lowerY>hipY&&hipY>crotchY))throw Error('Low waist, hip and crotch source planes must be anatomically ordered');
 const cache=new Map(),sample=y=>{const key=y.toPrecision(14);if(!cache.has(key)){const raw=sectionAt(y);cache.set(key,{raw,record:sectionRecord(raw,y,bodyClearanceM)});}return cache.get(key);};
 const upper=sample(upperY).record,lower=sample(lowerY).record,middle=sample(middleY).record,hip=sample(hipY).record;
 if([upper,lower,middle,hip].some(r=>!r.closed))throw Error('Closed actual low-waist and hip envelope sections required');
 // The full two-leg polar origin lies in empty space below the crotch. Query
 // each actual source leg independently, including its visible lower skin.
 // L/R retain the original paper's negative/positive actor-X convention;
 // they are not a new assignment of the R008 skeleton's anatomical names.
 const sourceLegParts={left:[19,18,12],right:[9,1,26]},sampleLeg=(y,side)=>{
  const raw=sectionAt(y,{partIds:sourceLegParts[side]});
  if(raw.valid===false||raw.closed===false)throw Error('Actual '+side+' single-leg section failed at '+y+'m');
  return legRecord(raw,y,bodyClearanceM,side,hip.centerX);
 };
 const thighY=measurements.thighs?.y??measurements.thighY??crotchY-.035*scale,thighs={left:sampleLeg(thighY,'left'),right:sampleLeg(thighY,'right')};
 // The actual throat air gap is a wearing audit, not a material cut-width
 // constraint: a gusset may bend through a narrower opening. Version B now
 // retains the user's accepted R24 design width proportion under actual
 // stature scaling. It is not selected from a solver residual or a scan.
 const gapM=finite(thighs.right.minX-thighs.left.maxX,'actual clothed-envelope interleg gap'),derivedClearGapM=gapM-2*bodyClearanceM;
 const riseSamples={front:[],back:[]};
 const route=front=>{let length=0,previous=null;for(let i=0;i<=12;i++){
  const y=i===12?crotchY:lowerY+(crotchY-lowerY)*i/12;let p;
  if(typeof sagittalAtY==='function'){
   const actual=sagittalAtY(y),side=front?'front':'back',witness=actual[side+'Witness'];
   if(!actual.valid||actual[side+'Valid']===false||(i<12&&actual.hitCount<2&&actual[side+'Valid']!==true))throw Error('Actual '+side+' sagittal rise section ambiguous or missing at '+y+'m; a front hit cannot substitute for the back');
   p=actual[side];const referenceX=measurements.lowWaist?.centerX??measurements.crotchPoint?.[0];
   if(witness&&Number.isFinite(referenceX)&&Math.abs(p[0]-referenceX)>.005+1e-10)throw Error('Actual rise bypass exceeds five millimetres of the source sagittal plane');
   riseSamples[side].push({y,point:p?.slice(),hitCount:actual.hitCount,witness:witness??null,authority:actual.authority});
  }
  else if(i===12&&Array.isArray(measurements.crotchPoint))p=measurements.crotchPoint;
  else p=rayPoint(sample(y).record,front?0:Math.PI);
  if(!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)))throw Error('Actual sagittal rise point required');if(previous)length+=distance(previous,p);previous=p;
 }return length;};
 const m={unit:'m',waistFrontArc:lower.frontM,waistBackArc:lower.backM,waistTopFrontArc:upper.frontM,waistTopBackArc:upper.backM,hipFrontArc:hip.frontM,hipBackArc:hip.backM,waistToHip:lowerY-hipY,crotchDepth:lowerY-crotchY,frontRiseLength:route(true),backRiseLength:route(false),thighCircumference:{left:thighs.left.circumferenceM,right:thighs.right.circumferenceM},waistCenter:[lower.centerX,lowerY,lower.centerZ],metadata:{source:'actual R008 generated existing-clothing envelope plane intersections plus declared mid-surface pad',sourceSurfaceScope:measurements.sourceSurfaceScope??'existing-clothing envelope; missing covered bare skin remains unknown',waistY:lowerY,waistTopY:upperY,hipY,crotchY,thighY,centerZ:hip.centerZ,bounds:{minZ:hip.minZ,maxZ:hip.maxZ},closedSections:true,bodyShapeKey:measurements.bodyShapeKey??measurements.sourceIdentity??null}};
 const design={columns:7,rows:13,hipRow:5,crotchRow:8,waistbandRows:2,waistEase:.014*scale,hipEase:.100*scale,thighEase:.080*scale,crotchDrop:.012*scale,frontRiseEase:.024*scale,backRiseEase:.038*scale,inseamLength:.155*scale,waistbandHeight:waistbandWidthM,sideIntake:.014*scale,inseamTaper:.018*scale,backWaistRaise:.018*scale,seamAllowance:.010*scale,hemAllowance:.022*scale,openingExtraDepth:.020*scale,initialClearance:.045*scale,gussetWidth:ACCEPTED_R24_GUSSET_WIDTH_M*scale};
 const pattern=createShortsPattern(m,design),topology=auditShortsPatternTopology(pattern,true);if(!topology.valid||!pattern.checks.seamLengthsMatched)throw Error('New source-paper topology/feed failed');
 const ranges=[],byId=new Map();let count=0;for(const piece of pattern.pieces){const range={pieceId:piece.id,offset:count,count:piece.materialCoordinates.length};ranges.push(range);byId.set(piece.id,range);count+=range.count;}
 if(count!==553||pattern.pieces.reduce((n,p)=>n+p.triangles.length,0)!==848||pattern.seams.length!==19)throw Error('Original 9-piece 553/848/19 structural source contract changed');
 const positions=new Float64Array(count*3),sourceUV=new Float64Array(count*2),triangles=new Uint32Array(848*3),masses=new Float64Array(count),parent=Array.from({length:count},(_,i)=>i),find=i=>parent[i]===i?i:(parent[i]=find(parent[i])),write=(i,p)=>positions.set(p,i*3),read=i=>Array.from(positions.subarray(i*3,i*3+3));
 const hemY=crotchY-design.inseamLength,frontCorner=[hip.centerX,crotchY+(hipY-crotchY)/3,rayPoint(sample(crotchY+(hipY-crotchY)/3).record,0)[2]],backCorner=[hip.centerX,frontCorner[1],rayPoint(sample(frontCorner[1]).record,Math.PI)[2]],leftCorner=[thighs.left.maxX+bodyClearanceM,crotchY-(crotchY-hemY)/5,thighs.left.centerZ],rightCorner=[thighs.right.minX-bodyClearanceM,leftCorner[1],thighs.right.centerZ],gCorners=[frontCorner,rightCorner,backCorner,leftCorner];
 for(const piece of pattern.pieces){const off=byId.get(piece.id).offset;piece.materialCoordinates.forEach((uv,i)=>sourceUV.set(uv,(off+i)*2));if(piece.kind==='leg-panel')for(let r=0;r<=13;r++){
  const y=r<=5?lowerY+(hipY-lowerY)*r/5:r<=8?hipY+(crotchY-hipY)*(r-5)/3:crotchY+(hemY-crotchY)*(r-8)/5,ease=r<=5?design.waistEase+(design.hipEase-design.waistEase)*r/5:r<=8?design.hipEase:design.thighEase;
  let record;if(r>=9)record=sampleLeg(y,piece.side);else record=sample(y).record;
  for(let c=0;c<=7;c++){let p=r>=9?legPoint(record,piece.side,piece.bodySide==='front',c/7,ease):sectorPoint(record,piece.side,piece.bodySide==='front',c/7,ease);if(r===7&&c===0)p=piece.bodySide==='front'?frontCorner:backCorner;if(r===8&&c===0)p=mix(piece.bodySide==='front'?frontCorner:backCorner,piece.side==='left'?leftCorner:rightCorner,.5);if(r===9&&c===0)p=piece.side==='left'?leftCorner:rightCorner;write(off+r*8+c,p);}
 }else if(piece.kind==='gusset'){for(let i=0;i<8;i++)write(off+i,i%2?mix(gCorners[(i-1)/2],gCorners[((i-1)/2+1)%4],.5):gCorners[i/2]);write(off+8,gCorners.reduce((p,q)=>p.map((v,k)=>v+q[k]/4),[0,0,0]));}
 }
 // A skin-envelope extremum at the abdomen is not a gusset endpoint. The
 // previous loft mapped 7 mm of material half-width to 43 mm of vertical
 // displacement, and doubled the longitudinal cut length. Start this one
 // material piece as its actual rigid source paper immediately below the
 // witnessed crotch instead. Bending/contact belong to the runtime solver.
 const gPiece=pattern.pieces.find(p=>p.kind==='gusset'),gOffset=byId.get('G').offset,
  crotchAnchor=Array.isArray(measurements.crotchPoint)?measurements.crotchPoint:[hip.centerX,crotchY,hip.centerZ],
  gOrigin=[crotchAnchor[0],crotchY-bodyClearanceM,crotchAnchor[2]],
  sourceGPositions=gPiece.materialCoordinates.map(uv=>[gOrigin[0]+uv[0],gOrigin[1],gOrigin[2]-uv[1]]);
 for(let i=0;i<sourceGPositions.length;i++)write(gOffset+i,sourceGPositions[i]);
 const localAssembly=[];
 for(const piece of pattern.pieces.filter(p=>p.kind==='leg-panel')){
  const off=byId.get(piece.id).offset,front=piece.bodySide==='front',side=piece.side==='left',
   sourceBoundary=front?(side?[0,7,6]:[0,1,2]):(side?[4,5,6]:[4,3,2]),
   controls=[{row:5,delta:[0,0,0]}];
  for(let r=7;r<=9;r++){
   const prior=read(off+r*8),target=sourceGPositions[sourceBoundary[r-7]];
   controls.push({row:r,delta:target.map((v,k)=>v-prior[k]),sourceGIndex:sourceBoundary[r-7],prior,target});
  }
  controls.push({row:13,delta:[0,0,0]});
  // Propagate the changed material-boundary placement continuously across
  // the complete row, and interpolate adjacent source rows to the unchanged
  // hip and hem. No single c=0 vertex is teleported away from its triangle.
  for(let r=6;r<13;r++){
   let j=1;while(controls[j].row<r)j++;
   const a=controls[j-1],b=controls[j],delta=mix(a.delta,b.delta,(r-a.row)/(b.row-a.row));
   for(let c=0;c<7;c++){
    const index=off+r*8+c,p=read(index),weight=1-c/7;
    write(index,p.map((v,k)=>v+weight*delta[k]));
   }
  }
  // The true corresponding material endpoints are copied exactly before
  // the caller's original source seam equivalences are consolidated.
  for(let r=7;r<=9;r++)write(off+r*8,sourceGPositions[sourceBoundary[r-7]]);
  localAssembly.push({pieceId:piece.id,sourceBoundary,controls});
 }
 for(const piece of pattern.pieces.filter(p=>p.kind==='waistband')){const off=byId.get(piece.id).offset,main=pattern.pieces.find(p=>p.id===piece.parentPanel),reverse=['FL','BR'].includes(main.id);for(let r=0;r<=2;r++)for(let c=0;c<=7;c++){const t=reverse?1-c/7:c/7,a=sectorPoint(lower,main.side,main.bodySide==='front',t,design.waistEase),b=sectorPoint(upper,main.side,main.bodySide==='front',t,design.waistEase),p=mix(a,b,r/2);if(r===1){const dx=p[0]-middle.centerX,dz=p[2]-middle.centerZ,len=Math.hypot(dx,dz);p[0]+=.0015*dx/len;p[2]+=.0015*dz/len;}write(off+r*8+c,p);}}
 const seams=pattern.seams.map(s=>({...s,pairs:s.pairs.map(p=>({a:byId.get(s.a.pieceId).offset+p.a,b:byId.get(s.b.pieceId).offset+p.b,t:p.t}))}));for(const seam of seams)for(const p of seam.pairs)parent[find(p.b)]=find(p.a);
 const grouped=new Map();for(let i=0;i<count;i++){const root=find(i);if(!grouped.has(root))grouped.set(root,[]);grouped.get(root).push(i);}const seamGroups=[...grouped.values()],quotientMap=new Uint32Array(count);seamGroups.forEach((members,id)=>{const mean=members.reduce((p,i)=>p.map((v,k)=>v+positions[i*3+k]/members.length),[0,0,0]);for(const i of members){quotientMap[i]=id;write(i,mean);}});
 let ti=0;for(const piece of pattern.pieces){const off=byId.get(piece.id).offset;for(const t of piece.triangles){for(const i of t)triangles[ti++]=off+i;const[a,b,c]=t.map(i=>piece.materialCoordinates[i]),mass=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2*densityKgM2;for(const i of t)masses[off+i]+=mass/3;}}
 const ring=pattern.pieces.filter(p=>p.kind==='waistband'),middleChain=ring.flatMap(p=>Array.from({length:7},(_,c)=>byId.get(p.id).offset+8+c)),waistIndices=ring.flatMap(p=>p.boundaries.upper.slice(0,-1).map(i=>byId.get(p.id).offset+i)),casingStitchPaths=['lower','upper'].map(edge=>({edge,indices:ring.flatMap(p=>p.boundaries[edge].slice(0,-1).map(i=>byId.get(p.id).offset+i)),closed:true}));
 const segmentSource=ring.flatMap(p=>Array.from({length:7},(_,c)=>distance(p.materialCoordinates[8+c],p.materialCoordinates[9+c]))),sourceMiddleCircumferenceM=segmentSource.reduce((a,b)=>a+b,0),elasticRestCircumferenceM=middle.circumferenceM*(1-elasticReduction),elasticEdges=middleChain.map((a,i)=>{const restLengthM=elasticRestCircumferenceM*segmentSource[i]/sourceMiddleCircumferenceM,b=middleChain[(i+1)%middleChain.length];return {a,b,restLengthM,restLength:restLengthM,compliance:restLengthM/elasticAxialRigidityN,axialRigidityN:elasticAxialRigidityN,maximumExtension:elasticMaximumExtension,tensionOnly:true,channel:'independent_elastic_inside_linen_casing',currentLengthM:distance(read(a),read(b))};});
 const material={materialId:'wartime_utility_coarse_linen_plain_weave_r3',densityKgM2,densityStatus:'uncalibrated_engineering_input',fullThicknessM:.0005,bodyClearanceM,linenMaximumPrincipalStrain:.05,elasticIsSeparateChannel:true,sourceUVUnit:'m',linenShaderCoordinateScaleFromSourceUV:100};
 const receipt={version:DRAFT_VERSION,paperSource:PAPER_SOURCE,sourceSurfaceScope:m.metadata.sourceSurfaceScope,authority:'actual generated R008 clothed envelope; no covered bare-skin claim',placement:'temporary measured contour loft with rigid source-paper gusset and continuous boundary-displacement propagation; no stored R24 coordinate preload; not sewing or physics acceptance',referenceStyle:'original relaxed R24 allowances and 7x13 grid, scaled by actual subject stature',referenceY,upperY,lowerY,middleY,waistDropM,waistbandWidthM,actualHeightM:heightM,measurements:m,design,sourceTopology:topology,sourceCounts:{pieces:9,particles:553,triangles:848,seams:19,quotientDofs:seamGroups.length},elastic:{wornMeasuredCircumferenceM:middle.circumferenceM,sourceCasingMiddleCircumferenceM:sourceMiddleCircumferenceM,restCircumferenceM:elasticRestCircumferenceM,reduction:elasticReduction,axialRigidityN:elasticAxialRigidityN,maximumExtension:elasticMaximumExtension,calibrated:false,reference:'https://matthias-research.github.io/pages/publications/XPBD.pdf',forceAuthority:'finite compliant extension of separate elastic channel; no bone pins'},material,sourceRestAuthority:'new two-dimensional paper before three-dimensional placement',areaM2:pattern.pieces.reduce((s,p)=>s+paperArea(p),0),massKg:masses.reduce((s,p)=>s+p,0),allMaterialDofsFree:true,bodyFitValidated:false,realSeamSewingValidated:false,motionValidated:false,visualAcceptance:false,productionReady:false};
 receipt.gussetInitialAssembly={method:'rigid original source-paper UV U-to-actor-X and V-to-minus-actor-Z below actual witnessed crotch',origin:gOrigin,sourceGPositions,priorIncorrectEnvelopeCorners:gCorners,mainBoundaryPropagation:localAssembly,sourceUVRestMassChangedDuringPlacement:false,finalBodyContactValidated:false,tailoringWidthReview:'Version B retains accepted R24 source width proportion; measured air gap is only a fitting audit and does not limit bendable cloth cut width'};
 receipt.generatedSubjectSource=measurements.source??null;receipt.canonicalActorFrame='actor translation/rotation removed; subject actual scale retained; metres';receipt.actualLegSectionParts=sourceLegParts;receipt.paperPanelSideConvention='L negative actor X, R positive actor X; no anatomical-bone hard bindings';receipt.riseMeasurementAuthority=typeof sagittalAtY==='function'?'thirteen actual generated-source triangle points; sagittal or witnessed posterior bypass within five millimetres; actual crotch endpoint':Array.isArray(measurements.crotchPoint)?'twelve actual generated source envelope samples and actual triangle-edge crotch witness endpoint':'TEST_FIXTURE_OR_EXTERNAL_SECTIONS_ONLY thirteen supplied closed-envelope samples';receipt.actualRiseSamples=riseSamples;receipt.crotchWitness=measurements.crotchWitness??null;receipt.gusset={sourceRecipeVersion:2,actualLegSectionY:thighY,measuredExistingClothingGapM:gapM,bodyClearancePerSideM:bodyClearanceM,derivedClearGapM,selectedPaperWidthM:design.gussetWidth,selection:'user-authorized accepted R24 original gusset design width scaled by actual generated stature; actual gap does not prescribe cut width',baseAcceptedDesignWidthM:ACCEPTED_R24_GUSSET_WIDTH_M,referenceStatureM:REFERENCE_STATURE_M,actualStatureScale:scale,gapIsCutWidthConstraint:false,sourceFrontHeightM:gPiece.sourceContour.frontHeight,sourceBackHeightM:gPiece.sourceContour.backHeight,sourceFrontEdgeLengthM:gPiece.sourceContour.frontEdgeLength,sourceBackEdgeLengthM:gPiece.sourceContour.backEdgeLength,frontBackLengthsAuthority:'fresh R008 actual witnessed front/back rise measurement and original two-dimensional cut algorithm; not old accepted lengths or formed cloth feedback',acceptedGFullSimilarityPreserved:false,physicsImprovementClaimed:false};
 receipt.waistFit=waistFit;receipt.hem={y:hemY,inseamLengthM:design.inseamLength,independentOfWaistDrop:true};
 delete receipt.allMaterialDofsFree;receipt.allMaterialDofsIntendedFree=true;receipt.runtimeDofMobilityValidated=false;
 pattern.authoringPlacement={kind:'temporary_measured_loft_with_rigid_source_gusset',historicalRigidFlatPiecePlacementMetadataUsed:false,sourceRestChangedFrom3D:false,bodyFitValidated:false};
 receipt.initialElasticResponse=elasticEdges.map(e=>evaluateElasticWaistEdge(e,positions));
 return {version:DRAFT_VERSION,positions,triangles,uvs:sourceUV,sourceUV,pieces:pattern.pieces,ranges,pattern,seams,seamGroups,quotientMap,masses,mass:masses,densityKgM2,waistIndices:new Uint32Array(waistIndices),elasticEdges,casingStitchPaths,casing:{finishedWidthM:waistbandWidthM,channelBulgeM:.0015,middleIndices:new Uint32Array(middleChain),stitchPaths:casingStitchPaths,independentElastic:true},material,receipt};
}
