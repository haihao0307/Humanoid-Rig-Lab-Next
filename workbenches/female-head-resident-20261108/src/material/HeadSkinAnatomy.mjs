import{HEAD_SKIN_ANATOMY_PROFILE}from'./HeadSkinAnatomyProfile.mjs';
// Shared material-region evaluator. Its person-specific variables are semantic
// anchors and compact fitted boundary curves, not an image or a surface mesh.
export const HEAD_SKIN_ANATOMY=HEAD_SKIN_ANATOMY_PROFILE;
const number=x=>{if(!Number.isFinite(x))throw Error('Anatomical parameter is not finite');return Number(x).toExponential(8);};
function curveGLSL(name,p){
 const n=p.knots.length-1;if(n<1||p.coefficients.length!==n||p.knots.some((x,i)=>!Number.isFinite(x)||i&&x<=p.knots[i-1]))throw Error('Anatomical curve parameters invalid');
 const K=p.knots.map(number).join(','),C=component=>p.coefficients.map(c=>'vec4('+c.map(v=>number(v[component])).join(',')+')').join(',');
 return`const float ${name}K[${n+1}]=float[${n+1}](${K});\nconst vec4 ${name}X[${n}]=vec4[${n}](${C(0)});\nconst vec4 ${name}Z[${n}]=vec4[${n}](${C(1)});\nvec4 ${name}(float t){t=clamp(t,${name}K[0],${name}K[${n}]);int j=0,hi=${n-1};for(int i=0;i<${Math.ceil(Math.log2(n))+1};i++){if(j<hi){int mid=(j+hi+1)/2;if(t>=${name}K[mid])j=mid;else hi=mid-1;}}float u=t-${name}K[j];vec4 b=vec4(u*u*u,u*u,u,1.);vec4 d=vec4(3.*u*u,2.*u,1.,0.);return vec4(dot(${name}X[j],b),dot(${name}Z[j],b),dot(${name}X[j],d),dot(${name}Z[j],d));}\n`;
}
export function headSkinAnatomyGLSL(profile=HEAD_SKIN_ANATOMY_PROFILE){
 if(profile.semanticLandmarks.length!==68||profile.semanticLandmarks.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x))))throw Error('Missing semantic head structure');
 const lm=profile.semanticLandmarks,curveNames={nose_left:'asNoseL',nose_right:'asNoseR',lip_upper:'asLipU',lip_lower:'asLipD',eye_left_upper:'asEyeLU',eye_left_lower:'asEyeLD',eye_right_upper:'asEyeRU',eye_right_lower:'asEyeRD'};
 const constants=Object.entries(curveNames).map(([key,name])=>curveGLSL(name,profile.profiles[key])).join('\n');
 const noseBottom=lm.slice(31,36).sort((a,b)=>a[0]-b[0]);
 return constants+`
const vec3 asNoseBase[5]=vec3[5](${noseBottom.map(p=>'vec3('+p.map(number).join(',')+')').join(',')});
float asNoseBaseY(float x){for(int i=0;i<4;i++){vec3 a=asNoseBase[i],b=asNoseBase[i+1];if(x<=b.x)return mix(a.y,b.y,clamp((x-a.x)/(b.x-a.x),0.,1.));}return asNoseBase[4].y;}
struct SkinAnatomy{float eyelid;float orbital;float nose;float ala;float perioral;float cheek;float facial;float boundary;};
vec3 asEyeRegion(vec3 p,bool left,float foot){
 vec4 u=left?asEyeLU(p.x):asEyeRU(p.x),d=left?asEyeLD(p.x):asEyeRD(p.x);
 float x0=left?max(asEyeLUK[0],asEyeLDK[0]):max(asEyeRUK[0],asEyeRDK[0]),x1=left?min(asEyeLUK[${profile.profiles.eye_left_upper.knots.length-1}],asEyeLDK[${profile.profiles.eye_left_lower.knots.length-1}]):min(asEyeRUK[${profile.profiles.eye_right_upper.knots.length-1}],asEyeRDK[${profile.profiles.eye_right_lower.knots.length-1}]);
 float t=clamp((p.x-x0)/(x1-x0),0.,1.),end=smoothstep(0.,.15,t)*(1.-smoothstep(.85,1.,t));
 float aa=max(clamp((u.x-d.x)*.12,1.25,3.0),foot),top=(u.x-p.y)/sqrt(1.+u.z*u.z),bottom=(p.y-d.x)/sqrt(1.+d.z*d.z);
 float anterior=smoothstep(min(u.y,d.y)-5.,min(u.y,d.y)-2.,p.z);
 // The true source eyelid coverage is kept separately below. The wider
 // orbital response is a continuous, uncalibrated distance falloff around
 // that observed source boundary, not a second hard tissue boundary.
 float outside=max(0.,-min(top,bottom)),reach=max(foot,clamp((x1-x0)*.20,3.,6.));
 float inside=(1.-smoothstep(0.,reach,outside))*end*anterior;
 float cheekBelow=(1.-smoothstep((x1-x0)*.35,(x1-x0)*.9,max(0.,-bottom)))*smoothstep(-aa,aa,-bottom)*end*anterior;
 float line=min(abs(top),abs(bottom));return vec3(inside,cheekBelow,(1.-smoothstep(.15,.40+foot,line))*end*anterior);
}
SkinAnatomy skinAnatomyAt(vec3 p,vec3 n,vec4 lid,float lip,float wet,float ear,float foot){
 SkinAnatomy a;vec3 eye=max(asEyeRegion(p,true,foot),asEyeRegion(p,false,foot));
 a.eyelid=clamp(lid.w,0.,1.)*(1.-clamp(wet,0.,1.));a.orbital=max(eye.x,a.eyelid);
 vec4 l=asNoseL(p.y),r=asNoseR(p.y);float aa=max(clamp((r.x-l.x)*.05,1.2,2.5),foot);
 float lateral=min((p.x-l.x)/sqrt(1.+l.z*l.z),(r.x-p.x)/sqrt(1.+r.z*r.z));
 float y0=max(asNoseLK[0],asNoseRK[0]),y1=min(asNoseLK[${profile.profiles.nose_left.knots.length-1}],asNoseRK[${profile.profiles.nose_right.knots.length-1}]);
 float vertical=min(p.y-max(y0,asNoseBaseY(p.x)),y1-p.y);
 float anterior=smoothstep(min(l.y,r.y)-4.,min(l.y,r.y)-1.,p.z);
 a.nose=smoothstep(-aa,aa,lateral)*smoothstep(-max(2.5,aa*1.5),max(2.5,aa*1.5),vertical)*anterior;
 float width=max(1.,(r.x-l.x)*.5),side=abs(p.x-(l.x+r.x)*.5)/width;
 a.ala=a.nose*(1.-smoothstep(${number(lm[30][1])},${number(lm[29][1])},p.y))*smoothstep(.25,.72,side);
 vec4 lu=asLipU(p.x),ld=asLipD(p.x);float xx=clamp(p.x,asLipUK[0],asLipUK[${profile.profiles.lip_upper.knots.length-1}]);
 float du=length(vec3(p.x-xx,(p.y-lu.x)/sqrt(1.+lu.z*lu.z),p.z-lu.y));
 float dd=length(vec3(p.x-xx,(p.y-ld.x)/sqrt(1.+ld.z*ld.z),p.z-ld.y));
 float lipDistance=min(du,dd);a.perioral=(1.-smoothstep(1.0,5.0,lipDistance))*(1.-clamp(lip,0.,1.))*(1.-clamp(wet,0.,1.));
 a.cheek=eye.y*(1.-a.nose)*(1.-clamp(lip,0.,1.));
 a.facial=smoothstep(-.10,.65,n.z)*(1.-clamp(ear,0.,1.));
 float noseLine=(1.-smoothstep(.15,.40+foot,abs(lateral)))*smoothstep(-aa,aa,vertical)*anterior;
 float lipLine=(1.-smoothstep(.15,.40+foot,lipDistance));
 a.boundary=max(eye.z,max(noseLine,lipLine));return a;
}
`;
}
