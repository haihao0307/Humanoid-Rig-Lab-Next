import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {regenerate,sourceFitProfile,deform,sectionProfile,measurements,subtypeDefaults,categoryPresets} from './mother.mjs';
const ROOT=path.dirname(fileURLToPath(import.meta.url)),read=p=>JSON.parse(zlib.gunzipSync(fs.readFileSync(p))),array=(s,Type)=>{const b=zlib.gunzipSync(Buffer.from(s,'base64'));return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));},hash=a=>crypto.createHash('sha256').update(Buffer.from(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const report={checks:[],fits:[],reference:[],heads:[],scope:'Numerical self-review. Sampled radial distance is not full continuous collision or pressure.'};
const check=(name,passed,detail)=>{report.checks.push({name,passed,detail});console.log(name,passed,detail??'');assert(passed,name);};
fs.mkdirSync(path.join(ROOT,'qa/numeric'),{recursive:true});
try{
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'ASSET_MANIFEST.json')));
 const heads=manifest.native.heads.map(h=>{const d=read(path.join(ROOT,'assets',h.packageFile)),p=array(d.p,Float32Array),index=array(d.i,Uint32Array),before=hash(p),profile=sectionProfile(p,index,{ymin:-.07,ymax:.10000000149011612,rows:112,angles:144});check('immutable measured head '+h.id,hash(p)===before);const m=measurements(profile,.012);check('actual section measurement '+h.id,m.headCircumferenceMM>400&&m.headCircumferenceMM<700&&m.widthMM>100&&m.widthMM<210,m);report.heads.push({id:h.id,positionHash:before,...m,ring:undefined});return {...h,p,index,profile,before};});
 for(const h of manifest.hats){const d=read(path.join(ROOT,'assets',h.packageFile)),old=read(path.join(ROOT,'../r02/assets',h.packageFile));check('no baked display mesh in mother '+h.id,!d.geometry&&!d.cage&&!d.originalUV&&Boolean(d.mother.controls));
  const a=regenerate(d.mother),expected=array(old.geometry.p,Float32Array),expectedI=array(old.geometry.i,Uint32Array);let delta=Infinity,uvDelta=Infinity;
  if(a.position.length===expected.length){delta=0;for(let i=0;i<a.position.length;i++)delta=Math.max(delta,Math.abs(a.position[i]-expected[i]));}
  const eu=array(old.geometry.u,Float32Array);if(a.uv.length===eu.length){uvDelta=0;for(let i=0;i<a.uv.length;i++)uvDelta=Math.max(uvDelta,Math.abs(a.uv[i]-eu[i]));}
  const r={id:h.id,controls:d.mother.controls.length,generatedVertices:a.position.length/3,expectedVertices:expected.length/3,maximumPositionDeltaM:delta,maximumUVDelta:uvDelta,indexCount:a.index.length,expectedIndexCount:expectedI.length};report.reference.push(r);
  check('regenerated R02 position fidelity '+h.id,delta<2e-7&&a.index.length===expectedI.length,r);check('regenerated UV fidelity '+h.id,uvDelta<2e-6,uvDelta);
  const source=sourceFitProfile(a,d),baseHash=hash(a.position);
  for(const head of heads){const s={id:h.id,...subtypeDefaults(h.id)},out=deform(a,d,s,head.profile,source);check('finite fitted geometry '+h.id+'/'+head.id,Array.from(out.position).every(Number.isFinite)&&Array.from(out.normal).every(Number.isFinite));check('head and mother preserved '+h.id+'/'+head.id,hash(head.p)===head.before&&hash(a.position)===baseHash);check('sampled outward clearance '+h.id+'/'+head.id,out.diagnostics.minimumRadialClearanceMM===null||out.diagnostics.minimumRadialClearanceMM>=-.001,out.diagnostics.minimumRadialClearanceMM);report.fits.push({hat:h.id,head:head.id,...out.diagnostics});
   if(h.id==='cable')check('knit cuff is not floating '+head.id,out.diagnostics.bandSampleBins>=48&&out.diagnostics.bandMedianMM<10,out.diagnostics);
  }
  const standard=deform(a,d,{id:h.id,...subtypeDefaults(h.id)},heads[0].profile,source),relaxed=deform(a,d,{id:h.id,...categoryPresets(h.id)[2].values},heads[0].profile,source);check('archetype variants affect geometry '+h.id,hash(standard.position)!==hash(relaxed.position));
 }
 check('all eleven source mothers covered',report.reference.length===11);check('all thirty-three head combinations covered',report.fits.length===33);report.passed=true;
}catch(e){report.passed=false;report.error=String(e);throw e;}finally{fs.writeFileSync(path.join(ROOT,'qa/numeric/report.json'),JSON.stringify(report,null,2));}
