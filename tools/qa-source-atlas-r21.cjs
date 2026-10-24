'use strict';const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),g=require('./fidelity-geometry-r21.cjs');vm.runInThisContext(fs.readFileSync('src/BodySourceAtlasR21.js','utf8'));
const mode=process.argv[2]||'torso',file='qa/fidelity-r21/offline/atlas-'+mode+'.json',program=JSON.parse(fs.readFileSync(file)),evidence=JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/atlas-'+mode+'-evidence.json')),reference=JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/original.json')),atlas=BodySourceAtlasR21.create(program),errors=[],angles=[],missing=[],q={checkedUTC:new Date().toISOString(),programSHA256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),mode,acceptanceTolerance:null,sourceFidelityAccepted:false,completedMotherConversion:false,sourceFacetPartitionInformationRetained:true};
if(program.report.profile&&program.report.profile!=='baseline')Object.assign(reference,JSON.parse(fs.readFileSync('qa/fidelity-r21/offline/case-'+program.report.profile+'.json')));
const weights=[[1/3,1/3,1/3],[.17,.31,.52],[.61,.23,.16],[.11,.73,.16],[1,0,0],[0,1,0],[0,0,1]];
for(const face of evidence){const ids=reference.faces.slice(face*3,face*3+3),p=ids.map(i=>g.point(reference.positionsYUp,i)),gn=g.cross(g.sub(p[1],p[0]),g.sub(p[2],p[0])),axis=[0,1,2].sort((a,b)=>Math.abs(gn[b])-Math.abs(gn[a]))[0],chart=axis*2+(gn[axis]>0?0:1),u=(axis+1)%3,v=(axis+2)%3;
 for(const w of weights){const point=[0,1,2].map(k=>p.reduce((s,p,i)=>s+w[i]*p[k],0)),normal=g.unit([0,1,2].map(k=>ids.reduce((s,j,i)=>s+w[i]*reference.normalsYUp[j*3+k],0))),values=atlas.query(chart,point[u],point[v]);if(!values.length){missing.push({face,point});continue;}
  const best=values.map(f=>({f,value:f.coefficients[0]*point[u]+f.coefficients[1]*point[v]+f.coefficients[2]})).sort((a,b)=>Math.abs(a.value-point[axis])-Math.abs(b.value-point[axis]))[0];errors.push(Math.abs(best.value-point[axis])*1000);angles.push(Math.acos(Math.max(-1,Math.min(1,g.dot(normal,atlas.normal(best.f.function,point[u],point[v])))))*180/Math.PI);
 }
}
q.surface={measurements:errors.length,missing:missing.length,positionMM:g.summary(errors),normalAngleDegrees:g.summary(angles),missingExamples:missing.slice(0,12)};
const sourceSubset={...reference,faces:evidence.flatMap(i=>reference.faces.slice(i*3,i*3+3))},tree=g.create(sourceSubset),rayRows=[];
for(const name of['front','side','back','oblique','left-hand','left-foot']){
 const f='qa/fidelity-r21/offline/rays-initial-'+name+'.json';if(!fs.existsSync(f))continue;const data=JSON.parse(fs.readFileSync(f));let missing=0,extra=0,depth=[],normal=[];
 for(const r of data.rows){const source=tree.ray(data.eye,r.rd,6,true)[0],candidate=atlas.ray(data.eye,r.rd);if(source&&!candidate)missing++;else if(!source&&candidate)extra++;else if(source&&candidate){depth.push(Math.abs(candidate.t-source.t)*1000);normal.push(Math.acos(Math.max(-1,Math.min(1,g.dot(source.normal,candidate.normal))))*180/Math.PI);}}
 rayRows.push({view:name,missing,extra,depthMM:g.summary(depth),normalAngleDegrees:g.summary(normal)});
}
q.firstHits=rayRows;q.compilerUnresolved=program.report.unresolved.length;q.diagnosticCompleted=true;fs.writeFileSync('qa/fidelity-r21/atlas-'+mode+'-fidelity.json',JSON.stringify(q,null,2));console.log(JSON.stringify(q));
