// Project-authored colour study, not a fit to USC measurements or a replacement
// for the source shader. All scales below are millimetres in original rest space.
export const BASE_COLOUR_REVISION='human.base-skin-colour/20261029-1';
export const BASE_COLOUR_DEFAULTS=Object.freeze({enabled:false,redness:.48,yellowBrown:.38,spots:.45,regional:.70,spotScale:1,seed:731});
export const BASE_COLOUR_SPECS=Object.freeze({redness:['红润',0,1],yellowBrown:['黄褐色',0,1],spots:['色素点',0,1],regional:['区域变化',0,1],spotScale:['色素点大小',.5,1.8]});
export function validateBaseColour(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==Object.keys(BASE_COLOUR_DEFAULTS).length||Object.keys(BASE_COLOUR_DEFAULTS).some(k=>!Object.hasOwn(value,k)))throw Error('基础肤色配方不完整或含未知参数');
 if(typeof value.enabled!=='boolean')throw Error('基础肤色开关无效');
 for(const [k,s]of Object.entries(BASE_COLOUR_SPECS))if(!Number.isFinite(value[k])||value[k]<s[1]||value[k]>s[2])throw Error('基础肤色参数超出范围：'+k);
 if(!Number.isInteger(value.seed)||value.seed<1||value.seed>99999)throw Error('基础肤色种子无效');
 return {...value};
}
export function baseColourUniforms(value){const v=validateBaseColour(value);return{bcEnabled:Number(v.enabled),bcRedness:v.redness,bcBrown:v.yellowBrown,bcSpots:v.spots,bcRegional:v.regional,bcSpotScale:v.spotScale,bcSeed:v.seed};}
export const BASE_COLOUR_GLSL=`
uniform float bcEnabled,bcRedness,bcBrown,bcSpots,bcRegional,bcSpotScale,bcSeed;
uint bcHash(uvec3 p,uint salt){uint h=p.x*1597334677u^p.y*3812015801u^p.z*2798796415u^uint(bcSeed)*2246822519u^salt;h^=h>>16;h*=2246822519u;h^=h>>13;h*=3266489917u;return h^(h>>16);}
float bcRandom(ivec3 p,uint salt){return float(bcHash(uvec3(p),salt)>>8)*(1./16777216.);}
float bcNoise(vec3 p,uint salt){ivec3 c=ivec3(floor(p));vec3 f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(mix(bcRandom(c,salt),bcRandom(c+ivec3(1,0,0),salt),f.x),mix(bcRandom(c+ivec3(0,1,0),salt),bcRandom(c+ivec3(1,1,0),salt),f.x),f.y),mix(mix(bcRandom(c+ivec3(0,0,1),salt),bcRandom(c+ivec3(1,0,1),salt),f.x),mix(bcRandom(c+ivec3(0,1,1),salt),bcRandom(c+ivec3(1,1,1),salt),f.x),f.y),f.z);}
float bcBand(float foot,float period){return 1.-smoothstep(period*.22,period*.65,foot);}
float bcMottle(vec3 p,float foot,uint salt){return .55*(bcNoise(p/18.,salt)-.5)*bcBand(foot,18.)+.30*(bcNoise(p/5.5,salt+31u)-.5)*bcBand(foot,5.5)+.15*(bcNoise(p/1.7,salt+71u)-.5)*bcBand(foot,1.7);}
float bcDots(vec3 p,float foot){
 // Compact C2 support: neighboring cells participate, so cell borders do not
 // clip spots. The broadening is an explicit display filter, not new geometry.
 const float cell=2.6;ivec3 c=ivec3(floor(p/cell));float value=0.;
 for(int z=-1;z<=1;z++)for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  ivec3 q=c+ivec3(x,y,z);float density=bcRandom(q,211u);if(density>.56)continue;
  vec3 centre=(vec3(q)+vec3(bcRandom(q,223u),bcRandom(q,227u),bcRandom(q,229u)))*cell;
  float radius=mix(.20,.64,bcRandom(q,233u))*bcSpotScale;
  float filtered=sqrt(radius*radius+min(foot,1.8)*min(foot,1.8)*.22);
  float t=length(p-centre)/filtered;if(t>=1.)continue;
  float a=1.-t;value+=a*a*a*a*(1.+4.*t)*(radius*radius/(filtered*filtered))*mix(.55,1.,bcRandom(q,239u));
 }
 return value;
}
vec3 bcColour(vec3 base,vec3 p,float foot,float cheek,float nose,float ear,float forehead,float jaw,float protect){
 float bloodNoise=bcMottle(p,foot,101u),pigmentNoise=bcMottle(p,foot,307u);
 // Regions are the original shader's masks, not new anatomical proxies.
 float redRegion=clamp(.95*cheek+.75*nose+.50*ear,0.,1.);
 float brownRegion=clamp(.75*forehead+.30*jaw+.18*cheek,0.,1.);
 float blood=bcRedness*(.20+.80*bcRegional*redRegion)*max(.25,1.+1.25*bloodNoise);
 float brown=bcBrown*(.22+.78*bcRegional*brownRegion)*max(.25,1.+1.6*pigmentNoise);
 float dots=bcDots(p,foot)*bcSpots*(.28+.72*cheek);
 vec3 opticalDepth=vec3(.025,.31,.23)*blood+vec3(.20,.34,.56)*brown+vec3(.42,.69,.94)*dots;
 opticalDepth+=vec3(.07,.12,.18)*pigmentNoise*bcRegional;
 return base*exp(-opticalDepth*protect);
}
`;
export function baseColourFragment(source){
 const entry='void main() {',anchor='material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );';
 if(source.split(anchor).length!==2||source.split(entry).length!==2)throw Error('基础肤色挂接点改变；保留原版，停止构建');
 const hook=`if(bcEnabled>.5 && psView<.5 && gmView<.5){
  float bcProtect=fbHead*(1.-psLipFeather)*(1.-smoothstep(.02,.35,fbLid+fbCanthus))*(1.-lidGate);
  diffuseColor.rgb=bcColour(diffuseColor.rgb,psMM,psFoot,fbCheek,fbNose,psE,r7Forehead,r7Jaw,bcProtect);
 }
 `;
 return source.replace(entry,BASE_COLOUR_GLSL+'\n'+entry).replace(anchor,hook+anchor);
}
