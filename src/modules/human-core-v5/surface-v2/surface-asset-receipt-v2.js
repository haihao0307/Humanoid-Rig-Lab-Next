export const SURFACE_ASSET_RECEIPT_V2_SCHEMA = 'humanoid_rig/surface_asset_receipt@2.0';

export function validateSurfaceAssetReceiptV2(receipt) {
  const required = [
    'schema', 'assetId', 'displayName', 'sourceProject', 'sourceRepository',
    'sourceCommit', 'sourceFiles', 'originalHashes', 'convertedHash',
    'convertedSize', 'license', 'conversionRoute', 'conversionScript',
    'coordinateSystem', 'unit', 'vertexCount', 'triangleCount', 'jointCount',
    'maximumInfluences', 'weightTruncationMaximum', 'weightTruncationMean',
    'validatorResult', 'productionApproved', 'userVisualAcceptance',
  ];
  for (const key of required) {
    if (!(key in (receipt ?? {}))) throw new Error(`Candidate asset receipt is missing ${key}.`);
  }
  if (receipt.license !== 'CC0-1.0') throw new Error('Candidate A must be a verified CC0 asset.');
  if (receipt.productionApproved !== false || receipt.userVisualAcceptance !== 'pending') {
    throw new Error('Candidate A receipt must remain productionApproved=false and userVisualAcceptance=pending.');
  }
  return Object.freeze(structuredClone(receipt));
}

export async function loadSurfaceAssetReceiptV2(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Unable to load surface asset receipt: HTTP ${response.status}.`);
  return validateSurfaceAssetReceiptV2(await response.json());
}
