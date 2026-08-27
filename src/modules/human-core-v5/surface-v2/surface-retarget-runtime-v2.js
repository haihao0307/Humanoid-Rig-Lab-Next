import { TemplateCanonicalReferencePoseCalibratorV5 } from '../../../../apps/human-core-v5-template-reference-pose-retarget-pilot/template-canonical-reference-pose-calibrator-v5.js';

export const SURFACE_RETARGET_RUNTIME_V2_SCHEMA = 'humanoid_rig/surface_retarget_runtime@2.0';

/**
 * Reuses the exact Pilot D reference-pose and full-basis implementation.
 * The target layer changes, while the Human Core finalPose authority and the
 * tested calibration math remain singular and unchanged.
 */
export class SurfaceRetargetRuntimeV2 {
  constructor({ THREE, performanceRig, templateLayer, rigCore, sourceReferenceFrame } = {}) {
    this.calibrator = new TemplateCanonicalReferencePoseCalibratorV5({
      THREE, templateLayer, rigCore, sourceReferenceFrame,
    });
    this.performanceRig = performanceRig;
    this.performanceRig.registerCalibration(this.calibrator);
  }
  applyFinalPose(finalPose) { return this.calibrator.apply(finalPose); }
  restoreAssetBind() { this.calibrator.restoreAsset(); }
  restoreReferencePose() { return this.calibrator.applyReferencePose(); }
  runAssetRestoreGate() { return this.calibrator.runAssetRestoreGate(); }
  getFullBasisGate() { return structuredClone(this.calibrator.fullBasisGate); }
  getReferenceFingerprint() { return this.calibrator.referenceFingerprintValue; }
  getReferenceAudit() { return this.calibrator.createReferencePoseAudit(); }
  getFullBasisAudit() { return this.calibrator.createFullBasisAudit(); }
}
