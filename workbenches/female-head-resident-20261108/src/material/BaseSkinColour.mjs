import{BASE_COLOUR_GLSL as R1_GLSL,validateBaseColour as validateR1}from'./BaseSkinColourR1.mjs';
import{SKIN_PIGMENT_GLSL}from'./SkinPigmentFields.mjs';
// Separate pigment fields in optical-density space. No imported skin imagery.
export const BASE_COLOUR_REVISION='human.base-skin-colour/20261030-3';
export const BASE_COLOUR_DEFAULTS=Object.freeze({model:2,enabled:false,redness:.58,yellowBrown:.30,spots:.52,regional:.78,spotScale:1,seed:731});
export const BASE_COLOUR_SPECS=Object.freeze({redness:['红润与血色',0,1],yellowBrown:['黄褐色色素',0,1],spots:['色素点浓度',0,1],regional:['区域与色差',0,1],spotScale:['色素点大小',.5,1.8]});
export const BASE_COLOUR_PRESETS=Object.freeze({
 natural:{label:'自然肤色',skin:{tone:.84,warmth:.40,blood:.40,variation:.9,freckles:.12},colour:{redness:.42,yellowBrown:.22,spots:.36,regional:.68,spotScale:1}},
 rosy:{label:'红润血色',skin:{tone:.89,warmth:.35,blood:.42,variation:.9,freckles:.10},colour:{redness:.82,yellowBrown:.12,spots:.22,regional:.90,spotScale:.8}},
 golden:{label:'暖黄褐色',skin:{tone:.78,warmth:.62,blood:.24,variation:.9,freckles:.10},colour:{redness:.14,yellowBrown:.68,spots:.30,regional:.80,spotScale:1}},
 freckles:{label:'色素点与雀斑',skin:{tone:.87,warmth:.39,blood:.36,variation:.9,freckles:.08},colour:{redness:.38,yellowBrown:.23,spots:.92,regional:.82,spotScale:1.10}},
 regional:{label:'分区肤色层次',skin:{tone:.86,warmth:.40,blood:.36,variation:.9,freckles:.10},colour:{redness:.52,yellowBrown:.48,spots:.55,regional:1,spotScale:1}}
});
export function validateBaseColour(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==Object.keys(BASE_COLOUR_DEFAULTS).length||Object.keys(BASE_COLOUR_DEFAULTS).some(k=>!Object.hasOwn(value,k)))throw Error('基础肤色配方不完整或含未知参数');
 if(typeof value.enabled!=='boolean'||![1,2].includes(value.model))throw Error('基础肤色模型或开关无效');
 for(const[k,s]of Object.entries(BASE_COLOUR_SPECS))if(!Number.isFinite(value[k])||value[k]<s[1]||value[k]>s[2])throw Error('基础肤色参数超出范围：'+k);
 if(!Number.isInteger(value.seed)||value.seed<1||value.seed>99999)throw Error('基础肤色种子无效');return{...value};
}
export function migrateR1Colour(value){return{model:1,...validateR1(value)};}
export function baseColourUniforms(value){const v=validateBaseColour(value);return{bcModel:v.model,bcEnabled:Number(v.enabled),bcRedness:v.redness,bcBrown:v.yellowBrown,bcSpots:v.spots,bcRegional:v.regional,bcSpotScale:v.spotScale,bcSeed:v.seed};}
export const BASE_COLOUR_GLSL=R1_GLSL.replace('vec3 bcColour(','vec3 bcColourLegacy(')+SKIN_PIGMENT_GLSL+`
uniform float bcModel,bcLayer;
float bcPlaneSpots(vec2 p,float foot,int plane,float cell,bool broad){
 return pgPigmentPlane(p,foot,plane,bcSeed,broad,bcSpotScale);
}
vec2 bcSpotField(vec3 p,vec3 n,float foot){
 vec3 w=pow(abs(n),vec3(8.));w/=max(dot(w,vec3(1.)),.000001);vec2 v=vec2(0);
 // Triplanar material coordinates put spots ON the surface. The R1 volumetric
 // seed cloud missed most visible skin, making points disappear at full views.
 if(w.x>.001)v+=w.x*vec2(bcPlaneSpots(p.yz,foot,0,2.5,false),bcPlaneSpots(p.yz,foot,3,8.,true));
 if(w.y>.001)v+=w.y*vec2(bcPlaneSpots(p.xz,foot,1,2.5,false),bcPlaneSpots(p.xz,foot,4,8.,true));
 if(w.z>.001)v+=w.z*vec2(bcPlaneSpots(p.xy,foot,2,2.5,false),bcPlaneSpots(p.xy,foot,5,8.,true));
 return v;
}
vec3 bcColourR2(vec3 base,vec3 p,vec3 n,float foot,float cheek,float nose,float ear,float forehead,float jaw,float protect){
 float lowerCheek=cheek*(1.-.60*exp(-pow((p.y-292.)/8.,2.)));
 float redArea=clamp(.48*lowerCheek+.35*nose+.25*ear,0.,1.);
 float tanArea=clamp(.85*forehead+.22*jaw+.32*cheek+.25*nose,0.,1.);
 float redBroad=bcMottle(p+vec3(7.,19.,3.),foot,601u);
 float capillary=(bcNoise(p/1.4,607u)-.5)*bcBand(foot,1.4);
 float red=(.28+.40*mix(.40,redArea,bcRegional))*bcRedness*max(.50,1.+.55*redBroad+.10*capillary);
 float melanin=bcMottle(p+vec3(13.,5.,31.),foot,701u);
 float patches=smoothstep(.46,.72,bcNoise((p+vec3(3.,17.,7.))/9.+2.*melanin,709u));
 float tan=bcBrown*(.22+.78*mix(.40,tanArea,bcRegional))*(.94+.8*melanin+.10*bcRegional*patches);
 vec2 spots=bcSpots>.001&&(bcLayer<.5||bcLayer>2.5)?bcSpotField(p,n,foot):vec2(0);
 float spotArea=.12+.88*clamp(cheek+.55*nose+.22*forehead,0.,1.);
 float freckles=spots.x*bcSpots*spotArea,macules=spots.y*bcSpots*bcRegional*spotArea;
 vec3 redDepth=vec3(.015,.58,.37)*red,tanDepth=vec3(.32,.52,.88)*tan;
 vec3 spotDepth=vec3(.60,.90,1.18)*freckles;
 vec3 regionalDepth=vec3(.19,.29,.41)*macules+vec3(.045,.075,.11)*melanin*bcRegional;
 vec3 depth=redDepth+tanDepth+spotDepth+regionalDepth;
 if(bcLayer>.5&&bcLayer<1.5)depth=redDepth;
 else if(bcLayer>1.5&&bcLayer<2.5)depth=tanDepth;
 else if(bcLayer>2.5&&bcLayer<3.5)depth=spotDepth;
 else if(bcLayer>3.5)depth=regionalDepth;
 return base*exp(-depth*protect);
}
`;
export function baseColourFragment(source){
 const entry='void main() {',anchor='material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );';
 if(source.split(anchor).length!==2||source.split(entry).length!==2)throw Error('基础肤色挂接点改变');
 const hook=`if((u_nativeMode==0||u_nativeMode==1) && bcEnabled>.5 && psView<.5 && gmView<.5){
 float bcProtect=fbHead*(1.-psLipFeather)*(1.-clamp(lidGate,0.,1.));
 if(bcModel<1.5){float bcLegacyProtect=fbHead*(1.-psLipFeather)*(1.-smoothstep(.02,.35,fbLid+fbCanthus))*(1.-lidGate);diffuseColor.rgb=bcColourLegacy(diffuseColor.rgb,psMM,psFoot,fbCheek,fbNose,psE,r7Forehead,r7Jaw,bcLegacyProtect);}
 else diffuseColor.rgb=bcColourR2(diffuseColor.rgb,psMM,psRestN,psFoot,fbCheek,fbNose,psE,r7Forehead,r7Jaw,bcProtect);
 }
 `;
 return source.replace(entry,BASE_COLOUR_GLSL+'\n'+entry).replace(anchor,hook+anchor);
}
