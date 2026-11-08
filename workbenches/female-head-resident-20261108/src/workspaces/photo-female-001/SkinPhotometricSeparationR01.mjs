// Isolated material candidate. The photograph-derived field was fitted to
// display RGB, without an intrinsic-albedo constraint. This bridge separates
// its achromatic multiplier from chromatic optical density. It does not claim
// to recover measured illumination, melanin, blood, or BRDF from one portrait.
//
// The optical-density directions are the existing authored project priors in
// BaseSkinColour.mjs: melanin=(.32,.52,.88), blood=(.015,.58,.37). The remaining
// independent vector is neutral illumination=(1,1,1). Their inverse's third
// row is used below; no learned image or per-view data is introduced.
export const SKIN_PHOTOMETRIC_SEPARATION_R01=Object.freeze({
 revision:'human.skin-photometric-separation/20261107-r01',
 defaults:Object.freeze({u_skinIntrinsicStrength:1}),
 opticalDensityMelanin:Object.freeze([.32,.52,.88]),
 opticalDensityBlood:Object.freeze([.015,.58,.37]),
 neutralIlluminationRow:Object.freeze([1.2958435207823962,.4286878565607174,-.7245313773431136]),
 lipOpticalDensityMelanin:Object.freeze([.42,.64,.84]),
 lipOpticalDensityBlood:Object.freeze([.012,.20,.12]),
 mucosalNeutralIlluminationRow:Object.freeze([.9466746554823247,-.2219892150988619,.2753145596165368]),
 mucosalPolicy:'Retain explicit source melanin; least-squares blood residual and neutral illumination only. Wet film introduces no new melanin.',
 observationError8:6.46560517649219,
 observationChromaError95:.008438342099614382,
 observationErrorSource:'qa/female-material-repair-20261107/chromatic-error-calibration.json; 20000 same-capture held-out pixels, published binary16 v10 field',
 energyConstraint:'minimize (E-Eprior)^2 subject to all Aobserved[c]*exp(-E)<=1; E=max(Eprior,log(maxRGB(Aobserved))); active output uses the equivalent joint RGB ratio for numerical stability',
 accepted:false,
 scope:'source-derived chromatic-density prior; single-image intrinsic ambiguity remains',
});

// Offline fitting/verification counterpart. The viewer never calls this per
// pixel; its GLSL below performs the same constrained inverse on the GPU.
export function projectNeutralExposureR01(rgb,priorExposure){
 if(!Array.isArray(rgb)||rgb.length!==3||rgb.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(priorExposure))throw Error('Invalid neutral exposure observation');
 const peak=Math.max(...rgb);if(peak===0)return{rgb:[0,0,0],exposure:priorExposure,extraExposure:0,active:false};
 const lower=Math.log(peak),exposure=Math.max(priorExposure,lower),active=lower>priorExposure;
 const scale=Math.exp(lower-exposure),colour=rgb.map(x=>x/peak*scale);
 return{rgb:colour,exposure,extraExposure:exposure-priorExposure,active};
}

export function skinPhotometricSeparationR01(source,{guardDirectionalVisibility=true}={}){
 const dec='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;';
 const start='if(u_photoFitStrength>0.||abs(u_photoGlobalProbe)>0.)';
 const entry='if(u_nativeMode==1){';
 for(const anchor of [dec,start,entry])if(source.split(anchor).length!==2)throw Error('Skin photometric interface changed: '+anchor);
 let result=source.replace(dec,'uniform float u_skinIntrinsicStrength;vec4 skinIntrinsicDiagnostic=vec4(0.),skinIntrinsicConstraintDiagnostic=vec4(0.);\n'+dec)
  .replace(start,'vec3 skinIntrinsicBase=material.diffuseColor;\n'+start);
 const photoDisabled=source.includes('uniform float femProjection;')?'femProjection<.5':'true';
 const hook=`
 if(u_skinIntrinsicStrength>0.&&${photoDisabled}){
  // Photo RGB micro-colour retains its channel ratios. The correction is a
  // single neutral factor and cannot modify surface, normal, roughness, oil,
  // scattering, or the already separate specular terms.
  vec3 photoDensity=log(max(material.diffuseColor,vec3(1e-8))/max(skinIntrinsicBase,vec3(1e-8)));
  float skinNeutralLight=dot(photoDensity,vec3(1.2958435207823962,.4286878565607174,-.7245313773431136));
  // Source melanin is an existing explicit parameter. At vermilion/wet
  // mucosa keep that parameter and fit blood (.012,.20,.12) plus neutral light,
  // rather than inventing negative melanin to explain reflected white/ink.
  // This row is pinv([-blood,ones])[1], not a brightness clamp.
  float lipNeutralLight=dot(photoDensity,vec3(.9466746554823247,-.2219892150988619,.2753145596165368));
  float orbitalNeutralLight=lipNeutralLight;
  float lipTissue=clamp(psLipFeather,0.,1.),wetTissue=clamp(lidGate,0.,1.);
  float photoNeutralLight=mix(mix(skinNeutralLight,lipNeutralLight,lipTissue),orbitalNeutralLight,wetTissue);
  // Brow hair has additional nearly neutral absorption. Preserve its negative
  // density residual; positive exposure is not eyebrow pigmentation. The
  // procedural case envelope supplies the continuous anatomical boundary.
  vec3 observedEncoded=sceneEncode(max(material.diffuseColor,vec3(0.)));
  vec3 observedChroma=observedEncoded/max(dot(observedEncoded,vec3(1.)),1e-8);
  float unsupportedAbsorber=max(observedChroma.g,observedChroma.b)-observedChroma.r;
  // Neutral-lit blood/melanin skin cannot explain a non-red-dominant colour.
  // This case contains dark eyeliner beside the measured lid boundary. Treat
  // a confidently incompatible DARK layer as additional absorption; do not
  // inverse-light it into reflectance >1. The continuous confidence band uses
  // this field's measured normalized sRGB-chroma error on 20000 held-out
  // pixels. It is not a histological classifier or independent validation.
  float absorberError=.008438342099614382;
  float observedAbsorber=smoothstep(absorberError,2.*absorberError,unsupportedAbsorber);
  float absorberGate=max(max(clamp(femEnvelope,0.,1.),clamp(vLidMargin.w,0.,1.)),observedAbsorber);
  photoNeutralLight=mix(photoNeutralLight,max(photoNeutralLight,0.),absorberGate);
  float priorExposure=photoNeutralLight*u_skinIntrinsicStrength*fbHead;
  vec3 intrinsicCandidate=material.diffuseColor*exp(-priorExposure);
  float candidatePeak=max(intrinsicCandidate.r,max(intrinsicCandidate.g,intrinsicCandidate.b));
  float extraExposure=0.;
  // Constrained inverse-light solve, not independent RGB clipping. At an
  // active constraint E*=Eprior+log(candidatePeak). The equivalent joint
  // ratio preserves RGB proportions and every pigment coefficient. Setting
  // the exact peak quotient x/x=1 avoids exp(log(x)) round-off above 1.
  if(candidatePeak>1.){
   extraExposure=log(candidatePeak);
   bvec3 exactPeak=equal(intrinsicCandidate,vec3(candidatePeak));
   intrinsicCandidate/=candidatePeak;
   if(exactPeak.r)intrinsicCandidate.r=1.;if(exactPeak.g)intrinsicCandidate.g=1.;if(exactPeak.b)intrinsicCandidate.b=1.;
  }
  material.diffuseColor=intrinsicCandidate;
  skinIntrinsicDiagnostic=vec4(skinNeutralLight,lipNeutralLight,orbitalNeutralLight,priorExposure+extraExposure);
  skinIntrinsicConstraintDiagnostic=vec4(extraExposure>0.?1.:0.,extraExposure,priorExposure,priorExposure+extraExposure);
 }
 `;
 result=result.replace(entry,hook+entry);
 if(guardDirectionalVisibility){
  const stale='return mix(1.,clamp(visible,0.,1.),clamp(vE6Weight,0.,1.)*uE6Enabled);';
  if(result.split(stale).length!==2)throw Error('Directional visibility interface changed');
  // Those three numbers are samples at three directions, not a full angular
  // visibility function. A nearest direction can be many degrees away and
  // must not masquerade as an exact shadow for a newly moved inspection lamp.
  result=result.replace(stale,'if(agreement<.999999)return 1.;'+stale);
 }
 return result;
}
