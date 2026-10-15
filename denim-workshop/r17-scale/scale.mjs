/** Denim R17 dimensional baseline. Values are engineering candidates for the
 * garment-scale viewer, not universal specifications for every denim product. */
export const MM_PER_INCH = 25.4;
export const BASELINE = Object.freeze({
  warpEndsPerInch: 60,
  fillingPicksPerInch: 40,
  topstitchesPer30mm: 11,
  topstitchThreadProxyMM: 0.45,
  garmentOuterLengthM: 1.22,
});
export function pitchMM(countPerInch) {
  if (!(countPerInch > 0) || !Number.isFinite(countPerInch)) throw new RangeError('countPerInch');
  return MM_PER_INCH / countPerInch;
}
export function stitchPitchMM(stitchesPer30mm) {
  if (!(stitchesPer30mm > 0) || !Number.isFinite(stitchesPer30mm)) throw new RangeError('stitchesPer30mm');
  return 30 / stitchesPer30mm;
}
/** Coverage-preserving width used by the shader for a thread narrower than a pixel.
 * It changes raster support, not the stored physical diameter. */
export function subpixelCoverage(physicalMM, pixelFootprintMM, readability = 1.3) {
  for (const [name, value] of Object.entries({ physicalMM, pixelFootprintMM, readability })) {
    if (!(value > 0) || !Number.isFinite(value)) throw new RangeError(name);
  }
  const expandedMM = Math.max(physicalMM, pixelFootprintMM * 1.15);
  return Math.min(1, (physicalMM / expandedMM) * readability);
}
export function twillRepeatMM(warpEndsPerInch = BASELINE.warpEndsPerInch) {
  return pitchMM(warpEndsPerInch) * 4;
}
