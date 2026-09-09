/* R7 anterior preset details; posterior tissues are owned by AxialEnvelope. */
function refineBackAndPresetSurface(tissue,cage){
 if(BODY_SEX!=='female')return;
 const hy=tissue.bind.get('hips').p[1];
 for(const v of cage.v){const[x,y,z]=v.p,t=bodyAuthorY(y-hy),a=Math.abs(x);if(t<.28||t>.67||a>.20)continue;
  const r=TORSO_REFERENCE_PROFILE(t),cs=clamp((z-r[4])/Math.max(.02,r[1]),0,1),front=tissueSmooth(0,.65,cs);
  let arm=0;for(const[id,w]of v.w)if(/_(upperArm|forearm|hand)$/.test(id))arm+=w;
  const mask=front*(1-tissueSmooth(.08,.65,arm));
  const breast=BODY_PRESET.breastM*torsoG(a-.067,.049)*torsoG(t-.395,.055)*torsoS(.015,.037,a)*(1-torsoS(.125,.165,a));
  v.p[2]+=breast*mask;v.p[0]*=1+(BODY_PRESET.neckWidth-1)*torsoG(t-.589,.065)*(1-torsoS(.045,.09,a))*mask;
 }
}
