// Scalar style measurements, not stored cloth positions or a physics result.
// The user selected the ORIGINAL subject's forearm midpoint. Transfer its
// downward drop proportion; a new arm pose must not move this style target.
export const SHORTS_WAIST_REFERENCE = Object.freeze({
  revision: 'original-forearm-midpoint-waist@1',
  originalHTMLSHA256: '2b9158f76cd75aef5605be86bd7092c406d333467ce116eca130f166580635da',
  statureM: 1.7194712,
  upperWaistSourceY: .985185535326129,
  forearmMidpointSourceY: .925531375,
  upperWaistMeasurement: 'arithmetic mean of 32 original W.upper source boundary points; rigid actor frame removed',
  authority: 'user selected original reference forearm midpoint; independently measured same-frame scalar heights',
});
export function resolveShortsWaistFit(measurements, {waistDropM} = {}) {
  const heightM=measurements?.heightM, referenceY=measurements?.referenceWaist?.y;
  if(!(Number.isFinite(heightM)&&heightM>0))throw Error('Finite measured subject stature required for waist fitting');
  const reference=SHORTS_WAIST_REFERENCE;
  const dropToStatureRatio=(reference.upperWaistSourceY-reference.forearmMidpointSourceY)/reference.statureM;
  const dropM=waistDropM===undefined?heightM*dropToStatureRatio:waistDropM;
  if(!(Number.isFinite(dropM)&&dropM/heightM>=.015&&dropM/heightM<=.10))throw Error('Waist drop outside the declared stature-relative tailoring range');
  if(referenceY!==undefined&&!Number.isFinite(referenceY))throw Error('Finite measured waistband reference required');
  return {revision:reference.revision,waistDropM:dropM,upperY:referenceY===undefined?null:referenceY-dropM,
    dropToStatureRatio,automatic:waistDropM===undefined,reference,preserveHemLength:true,
    referencePoseTransferredByStature:true,newArmPoseDoesNotSetWaistHeight:true,finalDrapeValidated:false};
}
