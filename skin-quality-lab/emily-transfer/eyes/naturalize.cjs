const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),esbuild=require('esbuild');
const d=path.resolve(__dirname,'..'),r01=path.resolve(d,'../r01');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function replaceOnce(text,from,to,label){
 if(text.includes(to))return text;
 if(!text.includes(from))throw Error('Missing natural-eye anchor: '+label);
 return text.replace(from,to);
}

let eye=fs.readFileSync(__dirname+'/EyeSystem.js','utf8');
if(!eye.includes('// ET02 natural adult-eye calibration R3')){
 eye=replaceOnce(eye,"export const EYE_VERSION='eyes/1.1.0';","export const EYE_VERSION='eyes/1.2.0';",'version');
 eye=replaceOnce(eye,
` {name:'right',x:-.0300,y:.0690,z:.0615,sign:-1,rx:.0180,ry:.0140,half:.0137,radius:.0151},
 {name:'left', x:.0217,y:.0690,z:.0613,sign: 1,rx:.0178,ry:.0140,half:.0135,radius:.0151}`,
` {name:'right',x:-.0300,y:.0690,z:.0627,sign:-1,rx:.0152,ry:.0107,half:.0118,radius:.0125},
 {name:'left', x:.0217,y:.0690,z:.0625,sign: 1,rx:.0150,ry:.0106,half:.0116,radius:.0125}`,'socket measurements');
 eye=replaceOnce(eye,
` vec2 r=(p.xy-vec2(-.0300,.0690))/vec2(.0180,.0140);
 vec2 l=(p.xy-vec2(.0217,.0690))/vec2(.0178,.0140);`,
` vec2 r=(p.xy-vec2(-.0300,.0690))/vec2(.0152,.0107);
 vec2 l=(p.xy-vec2(.0217,.0690))/vec2(.0150,.0106);`,'head opening');
 eye=replaceOnce(eye,"vec2 hit=P.xy+ray.xy*max(travel,0.);float r=length(hit)/.40;","vec2 hit=P.xy+ray.xy*max(travel,0.);const float irisRadius=.456;float r=length(hit)/irisRadius;",'iris radius');
 eye=replaceOnce(eye,"float pupil=uPupil/.40;float expanded=clamp((r-pupil)/max(.1,1.-pupil),0.,1.);","float pupil=uPupil/irisRadius;float expanded=clamp((r-pupil)/max(.1,1.-pupil),0.,1.);",'pupil scale');
 eye=replaceOnce(eye,"ctx.fillStyle='#ddd6c9';","ctx.fillStyle='#c7beb1';",'sclera base');
 eye=replaceOnce(eye,"radius*.13*t*t","radius*.075*t*t",'corneal bulge');
 eye=replaceOnce(eye,"this.config={enabled:true,mode:'camera',autoBlink:true,autoPupil:true,pupilMM:3.6,iris:'blue',wetness:1,irisDepth:.83,opening:1};","this.config={enabled:true,mode:'camera',autoBlink:true,autoPupil:true,pupilMM:3.4,iris:'blue',wetness:.82,irisDepth:.83,opening:.94};",'natural defaults');
 eye=replaceOnce(eye,"this.pupil=.0018;","this.pupil=.0017;",'default pupil');
 const oldRim=` rimPoint(c,a,blink){
  const nx=Math.cos(a),ny=Math.sin(a),s=Math.pow(Math.abs(ny),1.22),seam=c.y-.0037+.0031*Math.pow(Math.abs(nx),1.8)-.0012*nx*c.sign;
  const open=c.y-.0012-.0014*nx*c.sign+(ny>=0?.0053:-.0031)*s*this.config.opening;
  const x=c.x+c.half*nx,y=mix(open,seam,blink),dx=x-c.x,dy=y-c.y;
  const z=c.z+Math.sqrt(Math.max(.000010,c.radius*c.radius-dx*dx-dy*dy))+.00030;
  return new THREE.Vector3(x,y,z);
 }`;
 const newRim=` rimPoint(c,a,blink){
  const nx=Math.cos(a),ny=Math.sin(a),arc=Math.pow(Math.abs(ny),1.35);
  const medial=clamp((1-nx*c.sign)*.5,0,1),lateral=1-medial;
  const seam=c.y-.0035+.0028*Math.pow(Math.abs(nx),1.7)-.0007*nx*c.sign;
  const base=c.y-.00075-.00075*nx*c.sign;
  const upper=(.00390*(1-.16*medial-.06*lateral)+.00020*(.30-medial))*arc*this.config.opening;
  const lower=.00235*(.94-.10*medial)*arc*this.config.opening;
  const gazeFollow=clamp(-(c.gazePitch||0)*.00165,-.00048,.00048)*(ny>=0?1:.34);
  const open=base+(ny>=0?upper:-lower)+gazeFollow;
  const x=c.x+c.half*nx*(1-.028*medial),y=mix(open,seam,blink),dx=x-c.x,dy=y-c.y;
  const z=c.z+Math.sqrt(Math.max(.000006,c.radius*c.radius-dx*dx-dy*dy))+.00016;
  return new THREE.Vector3(x,y,z);
 }`;
 eye=replaceOnce(eye,oldRim,newRim,'anatomical eyelid opening');
 eye=replaceOnce(eye,
"const m=new THREE.MeshPhysicalMaterial({color:0xa5675f,roughness:.23,clearcoat:1,clearcoatRoughness:.09,ior:1.376,envMapIntensity:.85});",
"const m=new THREE.MeshPhysicalMaterial({color:0x8f5b55,roughness:.31,clearcoat:.72,clearcoatRoughness:.12,ior:1.376,envMapIntensity:.48,transparent:true,opacity:.52,depthWrite:false});",'tear meniscus material');
 eye=replaceOnce(eye,
"for(let upper of [true,false])for(let i=0;i<(upper?51:24);i++){let t=(i+.5)/(upper?51:24),a=upper?t*Math.PI:Math.PI+t*Math.PI,len=(upper?.0015:.0007)+this.rnd()*(upper?.0013:.0007);",
"for(let upper of [true,false])for(let i=0;i<(upper?38:10);i++){let t=(i+.5)/(upper?38:10),a=upper?t*Math.PI:Math.PI+t*Math.PI,len=(upper?.00078:.00028)+this.rnd()*(upper?.00068:.00028);",'lash density');
 eye=replaceOnce(eye,
"const mat=new THREE.MeshStandardMaterial({color:0x302016,roughness:.56,side:THREE.DoubleSide});",
"const mat=new THREE.MeshStandardMaterial({color:0x3b2b23,roughness:.72,side:THREE.DoubleSide,transparent:true,opacity:.64,depthWrite:false});",'lash material');
 eye=replaceOnce(eye,
"for(let a=0;a<=rim.A;a++){let theta=a/rim.A*TAU,pt=this.rimPoint(c,theta,blink);for(let s=0;s<=rim.S;s++){let b=s/rim.S*TAU,rad=.000105;rp.setXYZ(a*(rim.S+1)+s,pt.x+Math.cos(theta)*Math.cos(b)*rad,pt.y+Math.sin(theta)*Math.cos(b)*rad,pt.z+Math.sin(b)*rad+.00006);}}",
"for(let a=0;a<=rim.A;a++){let theta=a/rim.A*TAU,pt=this.rimPoint(c,theta,blink),lower=smooth(clamp((-Math.sin(theta)+.08)/.92,0,1)),medial=clamp((1-Math.cos(theta)*c.sign)*.5,0,1);for(let s=0;s<=rim.S;s++){let b=s/rim.S*TAU,rad=.000016+.000060*lower+.000020*medial;rp.setXYZ(a*(rim.S+1)+s,pt.x+Math.cos(theta)*Math.cos(b)*rad,pt.y+Math.sin(theta)*Math.cos(b)*rad,pt.z+Math.sin(b)*rad+.000035);}}",'tear thickness distribution');
 eye=replaceOnce(eye,
"const cy=clamp(yaw,-.50,.50),cp=clamp(pitch,-.30,.32);this.state.clamped=",
"const cy=clamp(yaw,-.46,.46),cp=clamp(pitch,-.28,.30);e.c.gazePitch=cp;this.state.clamped=",'bounded gaze and lid follow');
 eye=replaceOnce(eye,"this.setPalette('blue');","this.setPalette('blue');",'palette initialization');
 eye+='\n// ET02 natural adult-eye calibration R3\n';
 fs.writeFileSync(__dirname+'/EyeSystem.js',eye);
}

let fitted=fs.readFileSync(__dirname+'/FittedEyes.js','utf8');
if(!fitted.includes('// ET02 natural ocular appearance R3')){
 fitted=replaceOnce(fitted,
`       float seam=-.0037+.0031*pow(abs(nx),1.8)-.0012*nx*uSocket.w;
       float upper=mix(-.0012-.0014*nx*uSocket.w+.0053*ny*uOpening,seam,uBlink);
       float lower=mix(-.0012-.0014*nx*uSocket.w-.0031*ny*uOpening,seam,uBlink);
       float a=.28+.72*smoothstep(0.,.0032,upper-p.y);
       float b=.65+.35*smoothstep(0.,.0018,p.y-lower);`,
`       float medial=clamp((1.-nx*uSocket.w)*.5,0.,1.);float lateral=1.-medial;
       ny=pow(max(0.,1.-nx*nx),.675);
       float seam=-.0035+.0028*pow(abs(nx),1.7)-.0007*nx*uSocket.w;
       float base=-.00075-.00075*nx*uSocket.w;
       float upper=mix(base+(.00390*(1.-.16*medial-.06*lateral)+.00020*(.30-medial))*ny*uOpening,seam,uBlink);
       float lower=mix(base-.00235*(.94-.10*medial)*ny*uOpening,seam,uBlink);
       float a=.16+.84*smoothstep(0.,.0025,upper-p.y);
       float b=.50+.50*smoothstep(0.,.0015,p.y-lower);`,'contact shadow aperture');
 fitted=replaceOnce(fitted,
"      vec3 sclera=texture2D(uEyePhoto,photoCenter+P.xy*.285).rgb*.66;",
`      vec3 scleraTex=texture2D(uEyePhoto,photoCenter+P.xy*.255).rgb;
      float corner=smoothstep(.48,.96,abs(edge.x));float lowerWarm=smoothstep(.05,-.78,edge.y);
      vec3 sclera=scleraTex*vec3(.52,.46,.42);
      sclera=mix(sclera,vec3(.27,.105,.082),corner*.105+lowerWarm*.035);`,'warm sclera');
 fitted=replaceOnce(fitted,"      vec3 iris=photo*uIrisColor*.56;","      vec3 iris=photo*uIrisColor*.43;",'iris brightness');
 fitted=replaceOnce(fitted,"float ring=smoothstep(.89,1.02,r);iris*=1.-ring*.62;","float ring=smoothstep(.86,1.01,r);iris*=1.-ring*.72;",'limbal ring');
 fitted=replaceOnce(fitted,"    e.ball.material.envMapIntensity=.30;e.ball.material.specularIntensity=.50;","    e.ball.material.envMapIntensity=.18;e.ball.material.specularIntensity=.40;e.ball.material.clearcoat=.78;e.ball.material.clearcoatRoughness=.075;",'corneal reflection');
 fitted=replaceOnce(fitted,
"  const colors={blue:[.64,.86,1.],hazel:[1.,.68,.30],brown:[.38,.19,.07],green:[.60,.84,.42]};",
"  const colors={blue:[.34,.46,.50],hazel:[.48,.31,.14],brown:[.24,.105,.045],green:[.31,.40,.21]};",'natural iris palettes');
 fitted=replaceOnce(fitted,"height=s+r*.13*t*t;","height=s+r*.075*t*t;",'fitted corneal envelope');
 fitted=replaceOnce(fitted,"const slope=1+6.24*t*a*(1-a)","const slope=1+3.60*t*a*(1-a)",'fitted corneal derivative');
 fitted=replaceOnce(fitted,"if(z!==null)p.z=Math.max(p.z,z+.00030);","if(z!==null)p.z=Math.max(p.z,z+.00016);",'rim depth');
 fitted=replaceOnce(fitted,
"const q=e.lid.entries[i],seam=e.c.y-.0037+.0031*Math.pow(Math.abs(q.nx),1.8)-.0012*q.nx*e.c.sign;",
"const q=e.lid.entries[i],seam=e.c.y-.0035+.0028*Math.pow(Math.abs(q.nx),1.7)-.0007*q.nx*e.c.sign;",'blink seam');
 fitted=replaceOnce(fitted,"ET02-fitted-CC0-iris-1.2","ET02-fitted-CC0-iris-1.3",'shader cache');
 fitted=replaceOnce(fitted,"ET02-lids-C1-boundary-1.2","ET02-lids-C1-boundary-1.3",'lid shader cache');
 fitted=replaceOnce(fitted,"boundaryContinuity:'C1 local displacement'","boundaryContinuity:'C1 local displacement',adultScaleFit:true,eyeRadiusMM:12.5,defaultApertureMM:[23.4,5.9]",'reported fit');
 fitted+='\n// ET02 natural ocular appearance R3\n';
 fs.writeFileSync(__dirname+'/FittedEyes.js',fitted);
}

let runtime=fs.readFileSync(__dirname+'/runtime.js','utf8');
runtime=runtime.replaceAll("pupilMM:3.6,iris:'blue',wetness:1,irisDepth:.83,opening:1","pupilMM:3.4,iris:'blue',wetness:.82,irisDepth:.83,opening:.94");
fs.writeFileSync(__dirname+'/runtime.js',runtime);

let js=fs.readFileSync(d+'/app.js','utf8'),html=fs.readFileSync(d+'/index.html','utf8');
js=js.replace("portrait:{p:[.105,.047,narrow?.76:.59],t:[0,.044,.016]}","portrait:{p:[.052,.052,narrow?.73:.57],t:[-.004,.047,.020]}");
js=js.replaceAll("pupilMM:3.6,iris:'blue',wetness:1,irisDepth:.83,opening:1","pupilMM:3.4,iris:'blue',wetness:.82,irisDepth:.83,opening:.94");
html=html.replace('双眼朝同一个三维目标收敛；超出转眼范围时限幅。','成人眼球尺度与眼睑开口已重新拟合；双眼朝同一个三维目标收敛，超出转眼范围时限幅。');
fs.writeFileSync(d+'/app.js',js);fs.writeFileSync(d+'/index.html',html);

const bundled=esbuild.buildSync({entryPoints:[d+'/app.js'],bundle:true,minify:true,format:'iife',target:'es2022',write:false,legalComments:'inline',alias:{three:r01+'/vendor/three.module.js','three/addons':r01+'/vendor/addons'}}).outputFiles[0].text;
const commit=process.env.ASSET_COMMIT;if(!/^[0-9a-f]{40}$/.test(commit||''))throw Error('Immutable asset commit required');
const root='https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/'+commit+'/skin-quality-lab/';
const code=bundled.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/').replace(/<\\/script/gi,'<\\\\/script');new vm.Script(code);
let preview=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'').replace('<script type="module" src="./app.js"></script>',()=>'<script>'+code+'</script>');
preview=preview.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/');
const scripts=[...preview.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];if(scripts.length!==1||scripts[0][1]!==code)throw Error('Final natural-eye script mismatch');new vm.Script(scripts[0][1]);fs.writeFileSync(d+'/preview.html',preview);
const manifest=JSON.parse(fs.readFileSync(d+'/BUILD_MANIFEST.json','utf8'));Object.assign(manifest,{version:'ET02.1',eyeVersion:'eyes/1.2.0',eyeModuleSHA256:hash(fs.readFileSync(__dirname+'/EyeSystem.js')),fittedEyeModuleSHA256:hash(fs.readFileSync(__dirname+'/FittedEyes.js')),generatedSHA256:hash(js),previewSHA256:hash(preview),adultEyeScaleFit:true,eyeRadiusMM:12.5,defaultVisibleApertureMM:[23.4,5.9],defaultPupilMM:3.4,defaultWetness:.82,cornealBulgeRatio:.075});fs.writeFileSync(d+'/BUILD_MANIFEST.json',JSON.stringify(manifest,null,2));
console.log('ET02_NATURAL_EYE_BUILD',JSON.stringify({bytes:Buffer.byteLength(preview),sourceCommit:commit,eyeVersion:'eyes/1.2.0'}));
