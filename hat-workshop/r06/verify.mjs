import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {regenerate,sectionProfile,subtypeDefaults} from './core.mjs';
import {sourceFitProfile,deform} from './fit.mjs';
import {REVIEWED_HATS,assertLockedSettings,checkHeadRange,checkGeometry,lockedRecord} from './fit-contract.mjs';
import {decodeHeadInput,exportHeadInput} from './head-contract.mjs';
import {hairContactPlan,validateHairPacket} from './hair-contract.mjs';
const root=fileURLToPath(new URL('.',import.meta.url)),assets=fileURLToPath(new URL('../r03/assets/',import.meta.url)),Q=root+'qa/numeric/',G=root+'qa/geometry-dump/';fs.mkdirSync(Q,{recursive:true});fs.mkdirSync(G,{recursive:true});
const hash=p=>crypto.createHash('sha256').update(Buffer.from(p.buffer,p.byteOffset,p.byteLength)).digest('hex'),decode=(s,T)=>{const b=zlib.gunzipSync(Buffer.from(s,'base64'));return new T(b.buffer,b.byteOffset,b.byteLength/T.BYTES_PER_ELEMENT);};
const rejectedFixtures=[];
const checks=[],records=[],check=(name,passed,detail=null)=>{checks.push({name,passed:!!passed,detail});if(!passed)console.log('FAIL',name,detail);};
const hats=REVIEWED_HATS.map(id=>{const meta=JSON.parse(zlib.gunzipSync(fs.readFileSync(assets+id+'.bin'))),mesh=regenerate(meta.mother);return {id,meta,mesh,source:sourceFitProfile(mesh,meta),hash:hash(mesh.position),uv:hash(mesh.uv)};});
for(const hid of ['native-default','long_narrow','short_broad']){
 const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(assets+'head-'+hid+'.bin'))),p=decode(data.p,Float32Array),ix=decode(data.i,Uint32Array),originalHash=hash(p);
 for(const fixture of [{id:'original',scale:1},{id:'synthetic-small',scale:.96},{id:'synthetic-large',scale:1.04}]){
  const head=Float32Array.from(p,v=>v*fixture.scale),maxY=Math.max(...Array.from(head).filter((_,i)=>i%3===1)),hp=sectionProfile(head,ix,{ymin:-.07,ymax:maxY,rows:112,angles:192});
  for(const h of hats){const s={...subtypeDefaults(h.id),id:h.id,view:'wear',width:1,depth:1,height:1,lift:0,tilt:0};
   try{assertLockedSettings(s);checkHeadRange(hp,s.wearBandMM);const o=checkGeometry(deform(h.mesh,h.meta,s,hp,h.source));
    check('finite source-to-head fit '+hid+'/'+fixture.id+'/'+h.id,true);check('source and head immutable '+hid+'/'+fixture.id+'/'+h.id,hash(h.mesh.position)===h.hash&&hash(h.mesh.uv)===h.uv&&hash(p)===originalHash);
    const support=o.diagnostics.supportSection;check('actual support cut '+hid+'/'+fixture.id+'/'+h.id,support.coveredDirections>=90&&support.minimumMM>-.1&&support.medianMM<20,support);
    const r={head:hid,fixture:fixture.id,fixtureIsNewPerson:false,hat:h.id,headHash:hash(head),outputHash:hash(o.position),bandHash:o.sweatband?hash(o.sweatband.position):null,measurement:lockedRecord(h.id,hid,o.measurement).measuredHead,diagnostics:o.diagnostics};records.push(r);
    if(fixture.id==='original'){
     const repeat=deform(h.mesh,h.meta,s,hp,h.source);check('deterministic regeneration '+hid+'/'+h.id,hash(repeat.position)===hash(o.position));
     const prefix=G+hid+'--'+h.id+'--';for(const [k,v]of[['position',o.position],['normal',o.normal],['index',h.mesh.index]])fs.writeFileSync(prefix+k+'.bin',Buffer.from(v.buffer,v.byteOffset,v.byteLength));if(o.sweatband)for(const k of ['position','normal','index'])fs.writeFileSync(prefix+'band-'+k+'.bin',Buffer.from(o.sweatband[k].buffer));
    }
    console.log('FIT',hid,fixture.id,h.id);
   }catch(e){
    const knownBoundary=hid==='long_narrow'&&fixture.id==='synthetic-large'&&h.id==='cloche'&&e.message==='内汗带所需余量超过固定母型范围';
    if(knownBoundary){rejectedFixtures.push({head:hid,fixture:fixture.id,hat:h.id,scale:fixture.scale,reason:e.message,status:'REJECTED_OUTSIDE_FIXED_ARCHETYPE',renderedAsSuccess:false});check('unsupported synthetic cloche is explicitly rejected',true,e.message);}
    else check('fit accepted within original fixture '+hid+'/'+fixture.id+'/'+h.id,false,e.message);
   }
  }
 }
 const input=exportHeadInput(hid+'_copy',hid,p,ix),mm={...input,units:'mm',position:input.position.map(v=>v*1000)};const d=decodeHeadInput(mm);let error=0;for(let i=0;i<p.length;i++)error=Math.max(error,Math.abs(d.rawPositions[i]-p[i]));check('unit conversion preserves head '+hid,error<1e-7);
 for(const bad of [{units:'cm'},{datum:'unverified'},{frame:{...input.frame,x:[-1,0,0]}}]){let refused=false;try{decodeHeadInput({...input,...bad});}catch{refused=true;}check('reject invalid head contract '+hid+JSON.stringify(bad),refused);}
}
for(const h of hats){const s={...subtypeDefaults(h.id),id:h.id,width:1,depth:1,height:1,lift:0,tilt:0};for(const bad of [{width:1.03},{crownMM:10},{autoFit:false},{hairMM:3}]){let refused=false;try{assertLockedSettings({...s,...bad});}catch{refused=true;}check('locked category rule '+h.id+JSON.stringify(bad),refused);}}
const plan=hairContactPlan({headId:'fixture',headHash:'0'.repeat(64),hatId:'cable',hatHash:'1'.repeat(64),hasInnerWall:true,hasSweatband:false,sourceCommit:'test',construction:{}});check('hair solver not falsely advertised',plan.state==='DEFERRED_NO_HAIR_SOLVER'&&!plan.readiness.solverImplemented);let refused=false;try{validateHairPacket({schema:'kaopu.hair-guides/1',headHash:'2'.repeat(64)},plan);}catch{refused=true;}check('hair identity mismatch refused',refused);
check('all original head-category pairs retained',records.filter(r=>r.fixture==='original').length===33);check('exactly the measured stress boundary is refused',rejectedFixtures.length===1);
const report={rejectedFixtures,scope:'Pure production geometry; 11 categories, 3 original heads and two explicitly synthetic uniform-size stress fixtures per head. 98 fits plus one explicit fixed-archetype rejection expected; not 9 distinct people, physical hair, continuous collision or manufacturing certification.',checks,records,passed:checks.every(c=>c.passed)};fs.writeFileSync(Q+'report.json',JSON.stringify(report,null,2));console.log('VERIFY',checks.length,records.length,report.passed);if(!report.passed)process.exitCode=1;
