'use strict';
// Isolated shader-input-order experiment. Source trim equations already belong
// to the unaccepted source-derived candidate; geometry and intersections stay
// unchanged. Never use as the selected product without matched native checks.
const fs=require('fs'),crypto=require('crypto'),H=b=>crypto.createHash('sha256').update(b).digest('hex'),src=JSON.parse(fs.readFileSync('BUILD-SOURCE-R29.json'));let material=fs.readFileSync('src/BodyOriginalSkinR26.js','utf8'),ray=fs.readFileSync('src/BodyAtlasRayR26.js','utf8');
function once(s,a,b){if(s.split(a).length!==2)throw Error('Trial anchor changed: '+a.slice(0,90));return s.replace(a,()=>b);}
const old='vViewPosition=-(viewMatrix*vec4(p,1.)).xyz;vNormal=mat3(viewMatrix)*n;vCSRest=rest;vCSExtra=vec4(0.,dry,palm,0.);for(int i=0;i<2;i++)vDirectionalShadowCoord[i]=directionalShadowMatrix[i]*vec4(p+n*directionalLightShadows[i].shadowNormalBias,1.);originalBodyMain();';
const trial=`
 // Reconstruct original vertex-stage inputs from the existing trim functions.
 // These are scalar evaluations only: no character geometry is emitted.
 vec3 line0=ownRecord(ownPalms,18416+field*3).xyz,line1=ownRecord(ownPalms,18416+field*3+1).xyz,line2=ownRecord(ownPalms,18416+field*3+2).xyz;
 vec3 h0=cross(line2,line0),h1=cross(line0,line1),h2=cross(line1,line2);
 vec2 t0=h0.xy/h0.z,t1=h1.xy/h1.z,t2=h2.xy/h2.z;
 vec2 e1=t1-t0,e2=t2-t0,zuv=uv-t0;float det=e1.x*e2.y-e1.y*e2.x;
 if(det!=0. && h0.z!=0. && h1.z!=0. && h2.z!=0.){
  float l1=(zuv.x*e2.y-zuv.y*e2.x)/det,l2=(e1.x*zuv.y-e1.y*zuv.x)/det;vec3 w=vec3(1.-l1-l2,l1,l2);
  vec2 tc[3];tc[0]=t0;tc[1]=t1;tc[2]=t2;vec3 vv[3],nn[3],rr[3];vec4 xx[3],shadow0[3],shadow1[3];
  for(int j=0;j<3;j++){vec2 t=tc[j];float ordinate=dot(a.xyz,vec3(t,1.));vec3 pt=axis==0?vec3(ordinate,t.x,t.y):axis==1?vec3(t.y,ordinate,t.x):vec3(t.x,t.y,ordinate);
   vec3 no=vec3(a.w*t.x+b.x*t.y+b.y,b.z*t.x+b.w*t.y+c.x,c.y*t.x+c.z*t.y+c.w),viewN=mat3(viewMatrix)*no,shadowN=normalize((vec4(viewN,0.)*viewMatrix).xyz);
   vv[j]=-(viewMatrix*vec4(pt,1.)).xyz;nn[j]=normalize(viewN);
   rr[j]=vec3(dot(sa.xyz,vec3(t,1.)),sa.w*t.x+sb.x*t.y+sb.y,sb.z*t.x+sb.w*t.y+sc.x);
   xx[j]=vec4(0.,clamp(dot(sc.yzw,vec3(t,1.)),0.,1.),clamp(dot(ownRecord(ownPalms,field).xyz,vec3(t,1.)),0.,1.),0.);
   shadow0[j]=directionalShadowMatrix[0]*vec4(pt+shadowN*directionalLightShadows[0].shadowNormalBias,1.);
   shadow1[j]=directionalShadowMatrix[1]*vec4(pt+shadowN*directionalLightShadows[1].shadowNormalBias,1.);
  }
  vViewPosition=w.x*vv[0]+w.y*vv[1]+w.z*vv[2];vNormal=w.x*nn[0]+w.y*nn[1]+w.z*nn[2];vCSRest=w.x*rr[0]+w.y*rr[1]+w.z*rr[2];vCSExtra=w.x*xx[0]+w.y*xx[1]+w.z*xx[2];
  vDirectionalShadowCoord[0]=w.x*shadow0[0]+w.y*shadow0[1]+w.z*shadow0[2];vDirectionalShadowCoord[1]=w.x*shadow1[0]+w.y*shadow1[1]+w.z*shadow1[2];
 }else{vViewPosition=-(viewMatrix*vec4(p,1.)).xyz;vNormal=mat3(viewMatrix)*n;vCSRest=rest;vCSExtra=vec4(0.,dry,palm,0.);for(int i=0;i<2;i++)vDirectionalShadowCoord[i]=directionalShadowMatrix[i]*vec4(p+n*directionalLightShadows[i].shadowNormalBias,1.);}
 originalBodyMain();`;
material=once(material,old,trial);
const anchor='const palms=new Float32Array(next.sourcePalmCoefficients.length/3*4);for(let i=0;i<palms.length/4;i++)palms.set(next.sourcePalmCoefficients.subarray(i*3,i*3+3),i*4);';
const replace='const countPalms=next.sourcePalmCoefficients.length/3,encoded=window.__P1_TRIM_LINES__[next.id];if(countPalms!==18416||!encoded)throw Error("实验裁剪函数缺失");const decoded=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),trim=new Float32Array(decoded.buffer),palms=new Float32Array(countPalms*4+trim.length);for(let i=0;i<countPalms;i++)palms.set(next.sourcePalmCoefficients.subarray(i*3,i*3+3),i*4);palms.set(trim,countPalms*4);';
ray=once(ray,anchor,replace);
let html=fs.readFileSync(src.file,'utf8');html=once(html,fs.readFileSync('src/BodyOriginalSkinR26.js','utf8'),material);html=once(html,fs.readFileSync('src/BodyAtlasRayR26.js','utf8'),ray);const trim=Object.fromEntries(['baseline','calibration-soft'].map(id=>[id,fs.readFileSync('qa/p1-torso/offline/trim-lines-'+id+'.bin').toString('base64')]));html=once(html,'</style>','</style><script>window.__P1_TRIM_LINES__='+JSON.stringify(trim)+'</script>');html=once(html,'<title>身体 R29','<title>隔离 P1 顶点输入顺序实验');
const file='qa/p1-torso/offline/vertex-order-trial.html';fs.writeFileSync(file,html);const build={...src,file,sha256:H(Buffer.from(html)),bytes:Buffer.byteLength(html),offlineTrial:true,sourceFidelityAccepted:false,visualAccepted:false,selectedByDefault:false};fs.writeFileSync('qa/p1-torso/offline/BUILD-P1-VERTEX-ORDER.json',JSON.stringify(build,null,2)+'\n');console.log(JSON.stringify({file,sha256:build.sha256,bytes:build.bytes,selected:false}));
