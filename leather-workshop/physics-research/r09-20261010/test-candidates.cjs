'use strict';
const fs=require('fs'),assert=require('assert');
const{T,ProductShell,makeProduct,productMaterials}=require('./load-baseline.cjs');
const {makeMaterialFrameShell}=require('./material-frame.cjs');
const{anchor,bindPassage,evaluatePassage}=require('./layered-yarn.cjs');
const Shell=makeMaterialFrameShell(ProductShell),rows=[],checks=[];
const check=(name,ok,data)=>{checks.push({name,pass:!!ok,data});assert(ok,name);};
function metric(s,q){const p=i=>Array.from(s.x.slice(3*i,3*i+3)),a=p(q.ids[0]),e=p(q.ids[1]).map((v,i)=>v-a[i]),f=p(q.ids[2]).map((v,i)=>v-a[i]),u=e.map((v,i)=>v*q.D[0]+f[i]*q.D[2]),v=e.map((x,i)=>x*q.D[1]+f[i]*q.D[3]),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);return[(dot(u,u)-1)/2,(dot(v,v)-1)/2,dot(u,v)];}
function energy(s){const q=s.tri[0],e=metric(s,q),k=s.law.tangent0,K=[[k[0],k[1],k[2]],[k[1],k[3],k[4]],[k[2],k[4],k[5]]];let out=0;for(let i=0;i<3;i++)for(let j=0;j<3;j++)out+=e[i]*K[i][j]*e[j]/2;return out;}
const chart={ids:[0,1,2],inv:[.01,0,0,.01]};
for(const order of [[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]]){
 const s=new Shell({positions:[0,100,0,100,100,0,0,200,0],triangles:[[...order,1.39,0]],frameTriangles:[chart]});for(let i=0;i<3;i++)s.x[3*i]*=1.05;rows.push({order,energyDensityPa:energy(s)});
}
check('Material axes do not rotate with vertex enumeration',Math.max(...rows.map(r=>r.energyDensityPa))-Math.min(...rows.map(r=>r.energyDensityPa))<1e-7,rows);
const s=new Shell({positions:[0,100,0,100,100,0,0,200,0],triangles:[[0,1,2,1.39,0]],frameTriangles:[chart]});for(let i=0;i<3;i++)s.x[3*i]*=1.05;const before=energy(s),R=new T.Matrix3().set(.36,-.48,.8,.8,.6,0,-.48,.64,.6);for(let i=0;i<3;i++){const p=new T.Vector3().fromArray(s.x,3*i).applyMatrix3(R).add(new T.Vector3(.123,.045,-.12));s.x.set(p.toArray(),3*i);}check('Superposed rigid motion preserves material energy',Math.abs(energy(s)-before)<1e-7);
for(const id of ['wallet','belt','bag','cowboy','pirate','jacket','swatch']){
 const root=makeProduct(id,productMaterials(new T.MeshStandardMaterial()),{thumbnail:true}),data=root.userData.rig.data;
 const patched=new Shell(data),maxRestStrain=Math.max(...patched.tri.flatMap(q=>metric(patched,q).map(Math.abs)));
 check(id+' all actual material charts yield stress-free reference metrics',maxRestStrain<1e-9,{triangles:patched.tri.length,maxRestStrain});
 root.traverse(m=>m.geometry?.dispose());root.userData.rig.texture.dispose();
}
// Controlled real-wallet anchoring using its explicit flat pattern chart, not a
// guessed generic world-axis rule. Runtime integration needs semantic path metadata.
const root=makeProduct('wallet',productMaterials(new T.MeshStandardMaterial()),{}),rig=root.userData.rig;
function at(part,u,v){let best=null,score=Infinity;for(const t of part.lookup){const x=u-t.uv[0].x,y=v-t.uv[0].y,w1=t.inv[0]*x+t.inv[1]*y,w2=t.inv[2]*x+t.inv[3]*y,w0=1-w1-w2,bad=[w0,w1,w2].reduce((s,w)=>s+Math.max(0,-w),0);if(bad<score){score=bad;best={ids:t.ids,weights:[w0,w1,w2]};if(bad<1e-10)break;}}assert(score<1e-7,'Test sample outside material chart');return best;}
const back=at(rig.parts[0],0,-25),front=at(rig.parts[2],0,-8),backNodes=new Set(rig.parts[0].lookup.flatMap(t=>t.ids)),palette=rig.pixels.slice(),restPoint=[0,18+rig.bindingShift,1.2];
const A=anchor(front.ids,front.weights,restPoint,palette),B=anchor(back.ids,back.weights,restPoint,palette),cases=[0,.25,.5,.75,1].map(f=>bindPassage(A,B,f));
const initial=cases.map(p=>evaluatePassage(p,palette));for(const id of backNodes)palette[12*id+2]-=1;
const displacement=cases.map((p,i)=>evaluatePassage(p,palette)[2]-initial[i][2]);check('Two-carrier passage follows the correct moving layer, including its interior',displacement.every((v,i)=>Math.abs(v+i*.25)<1e-6),displacement);
const moved=rig.pixels.slice();for(let i=0;i<rig.nodeCount;i++)for(const off of[0,4,8]){const q=new T.Vector3().fromArray(moved,12*i+off).applyMatrix3(R);if(off===0)q.add(new T.Vector3(5,-3,2));moved.set(q.toArray(),12*i+off);}
const target=new T.Vector3(...restPoint).applyMatrix3(R).add(new T.Vector3(5,-3,2));const err=Math.max(...cases.map(p=>new T.Vector3(...evaluatePassage(p,moved)).distanceTo(target)));check('All passage samples share common rigid motion without rest-shape drift',err<2e-5,{maxErrorMM:err});
const report={scope:'Isolated R09 research corrections only. No new website built. No self-collision/friction/material-calibration pass is implied.',releaseReady:false,pass:true,checks};fs.mkdirSync(__dirname+'/results',{recursive:true});fs.writeFileSync(__dirname+'/results/candidate-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify({pass:true,checks:checks.length,releaseReady:false}));
