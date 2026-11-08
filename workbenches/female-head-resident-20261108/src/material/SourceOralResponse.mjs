// Frozen R15 oral response for original components 5, 6 and 7 only.
// Inputs are native interpolated attributes, not guessed world-space masks.
// Source csCover/fA/fB/eOwned/l19State.x are zero on these components.
// Continuous type/depth binding for both jaw components is still pending.
export const SOURCE_ORAL_RESPONSE_PROFILE=Object.freeze({
 sourceSHA256:'f63c538a548108f3f61657ddbec3c0c05fbb4f4456770ba7668c67b948247edd',
 response:'Frozen common-surface linear albedo, oral roughness and ET19 depth visibility',
 sourceTypeMeaning:'1 teeth; 2 gums; 3 tongue. Source interpolation across type boundaries is retained.',
 depthUnits:'metres',ior:1.42,specularIntensity:.52,
 originalGeometryChanged:false,liveAttributeBindingAccepted:false,
 sourceFidelityAccepted:false,fullOriginalOpticsAccepted:false
});
export function sourceOralResponse(type,depthMetres){
 if(!Number.isFinite(type)||type<.5||type>3.5||!Number.isFinite(depthMetres))throw Error('Original oral type/depth required');
 return{albedo:type>.5&&type<1.5?[.74,.69,.58]:[.33,.12,.105],roughness:.46,
  visibility:type<3.5?.12+.88*Math.exp(-Math.max(0,depthMetres)*120):1,
  ior:1.42,specularIntensity:.52,coat:0,height:0};
}
export const SOURCE_ORAL_RESPONSE_GLSL=`
vec3 sourceOralAlbedo(float type){return type>.5&&type<1.5?vec3(.74,.69,.58):vec3(.33,.12,.105);}
float sourceOralRoughness(){return .46;}
float sourceOralVisibility(float type,float nativeDepthMetres){return type>=.5&&type<3.5?.12+.88*exp(-max(0.,nativeDepthMetres)*120.):1.;}
`;
