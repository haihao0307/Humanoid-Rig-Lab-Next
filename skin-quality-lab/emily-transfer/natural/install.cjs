const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function edit(p,fn){const s=read(p),n=fn(s);if(n===s)throw Error('No update '+p);fs.writeFileSync(path.join(root,p),n);}
function one(s,a,b){if(!s.includes(a)||s.indexOf(a)!==s.lastIndexOf(a))throw Error('Missing/nonunique '+a.slice(0,100));return s.replace(a,b);}
if(read('app.js').includes("VERSION='emily-transfer/7.0.0'")){console.log('ET07_ALREADY_INSTALLED');process.exit(0);}
if(!read('app.js').includes("VERSION='emily-transfer/6.1.0'"))throw Error('Require the ET06.1 reviewed baseline');
edit('talkinghead/IntegratedEyes.js',s=>one(s,"import {ResearchEyes} from '../research/ResearchEyes.js';","import {NaturalEyes as ResearchEyes} from '../natural/NaturalEyes.js';").replaceAll('eyes/6.1.0','eyes/7.0.0'));
edit('eyes/EyeSystem.js',s=>s.replaceAll('eyes/6.1.0','eyes/7.0.0'));
edit('research/ResearchEyes.js',s=>{
 // Refine the measured template into a relaxed, rounded arch, preserving the
 // canthal endpoints, overall scale and finite-angle Hermite transitions.
 s=one(s,'[.38441346288415335,-.013457920226416842,.4445801720372662,.056531015805420755]:[-.26980682201867545,-.07559112460541781,-.25913444501352073,-.003966655456640926]','[.38441346288415335,-.060,.10,.025]:[-.26980682201867545,-.040,-.07,-.003966655456640926]');
 s=one(s,'const A=256,R=32','const A=256,R=48');
 s=one(s,'y+=side*.00043*smooth(t/.045)*(1-smooth((t-.045)/.30))*arc*(1-blink);','y+=side*(q.ny>=0?.00019:.00012)*smooth(t/.055)*(1-smooth((t-.055)/.30))*arc*(1-blink);');
 s=one(s,'let z=q.src.z+(inner.z-q.seamSrc.z)*weight;','let z=(q.tissueZ??q.src.z)+(inner.z-(q.tissueSeamZ??q.seamSrc.z))*weight;');
 s=one(s,'const thickness=.00010+(q.ny>=0?.00074:.00056)*smooth(t/.055)*(1-smooth((t-.35)/.45));','const thickness=.00010+(q.ny>=0?.00068:.00042)*smooth(t/.09)*(1-smooth((t-.33)/.45));');
 s=one(s,'if(eyeZ!==null&&t<.82)z=Math.max(z,eyeZ+thickness);','if(eyeZ!==null&&t<.82){const b=eyeZ+thickness,k=.00010*smooth(t/.10)*(1-smooth((t-.58)/.20));z=Math.max(z,b)+(k>1e-10?k*Math.log1p(Math.exp(-Math.abs(z-b)/k)):0);}');
 s=one(s,'const fold=(q.ny>0?-.00044:.00012)*Math.exp(-Math.pow((t-(q.ny>0?.43:.38))/.105,2))*arc*(1-blink)*(1-blink);','const fold=(q.ny>0?-.00022:.000055)*Math.exp(-Math.pow((t-(q.ny>0?.48:.40))/.14,2))*arc*(1-blink)*(1-blink);');
 s=one(s,'if(eyeZ!==null&&t<.60)z=Math.max(z,eyeZ+thickness);','if(eyeZ!==null&&t<.60){const b=eyeZ+thickness,k=.000055*smooth(t/.10);z=Math.max(z,b)+(k>1e-10?k*Math.log1p(Math.exp(-Math.abs(z-b)/k)):0);}');
 s=one(s,'const theta=a/e.rim.A*TAU,i=Math.round(a/e.rim.A*lid.A),nx=Math.cos(theta),ny=Math.sin(theta);','const theta=a/e.rim.A*TAU,row=a/e.rim.A*lid.A,i=Math.floor(row),j=Math.min(lid.A,i+1),f=row-i,nx=Math.cos(theta),ny=Math.sin(theta);');
 s=one(s,'IP.getX(i)+nx*Math.cos(b)*r,IP.getY(i)+ny*Math.cos(b)*r,IP.getZ(i)+Math.sin(b)*r+.000005','lerp(IP.getX(i),IP.getX(j),f)+nx*Math.cos(b)*r,lerp(IP.getY(i),IP.getY(j),f)+ny*Math.cos(b)*r,lerp(IP.getZ(i),IP.getZ(j),f)+Math.sin(b)*r+.000005');
 return s;
});
// An edge strip has a degenerate cross-strip UV by design. Its normals must
// come from its rounded geometry, not from an ill-conditioned tangent basis.
edit('natural/NaturalEyes.js',s=>one(s,"  if(isMargin){",`  if(isMargin){
   const ns=s.fragmentShader.indexOf(' vec3 mapN=texture2D(normalMap'),ne=s.fragmentShader.indexOf('normal=normalize(tbn*normalize(mapN));',ns);
   if(ns>=0&&ne>=0)s.fragmentShader=s.fragmentShader.slice(0,ns)+' normal=nonPerturbedNormal;\\n'+s.fragmentShader.slice(ne+'normal=normalize(tbn*normalize(mapN));'.length);
`));
edit('app.js',s=>s.replaceAll('emily-transfer/6.1.0','emily-transfer/7.0.0').replaceAll('ET06.1','ET07').replace('眼睑解剖重构 × TalkingHead','眼周皮肤融合 × TalkingHead').replace('EYELID ANATOMY','NATURAL PERIOCULAR SKIN'));
edit('index.html',s=>s.replaceAll('ET06.1','ET07').replace('眼睑解剖重构','眼周皮肤融合').replace('新增上眼睑厚度','自然眼周皮肤与连续眼角'));
edit('anatomy/bundle.cjs',s=>s.replaceAll('emily-transfer/6.1.0','emily-transfer/7.0.0').replaceAll('eyes/6.1.0','eyes/7.0.0').replaceAll('ET06.1','ET07').replace("baseline:'1cfab2ef79b074fc5e4a0abfd62c061b02c66a18'","baseline:'b483a73fe7c3744c0136ff8433922efa5f3b51f3'").replace('sourceHeadMeshChanged:false','sourceHeadMeshChanged:false,naturalTissueModuleSHA256:hash(read(\'natural/NaturalEyes.js\')),neutralMaterialCoordinates:true,sharedFreeMarginSkinShader:true,tearRimContinuousInterpolation:true'));
let qa=read('takeover/qa.cjs').replaceAll('emily-transfer/6.1.0','emily-transfer/7.0.0').replaceAll("'ET06.1'","'ET07'");
qa=qa.replace("assert.equal(v.version,'ET07');","assert.equal(v.version,'ET07');for(const t of v.tissue){assert(t.boundaryUVMaxError<1e-6);assert.equal(t.sharedMarginNormalMaxError,0);assert(t.sameAlbedoTexture&&t.canthalPatch);}");
qa=qa.replace("console.log('ET06_PASS'","console.log('ET07_PASS'");fs.writeFileSync(path.join(__dirname,'qa.cjs'),qa);
console.log('ET07_INSTALLED_INHERITING_ET061');
