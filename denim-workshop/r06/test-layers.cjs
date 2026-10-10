'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const C=require('./core.js'),N=require('./natural-yarn.js'),O=require('./fiber-optics.js'),S=require('./structure.js');let checks=0;function ok(v,m){assert.ok(v,m);checks++;}
const optical=O.integrate();
let maxIntegralError=0;
for(let c=0;c<3;c++){
 const a=O.config.absorptionPerMm[c],st=a+18,alpha=18/st,eta=O.config.eta,F=-1.440/eta**2+.710/eta+.668+.0636*eta,A=(1+F)/(1-F),z=1/st,zv=z+4*A/(3*st),tr=Math.sqrt(3*a*st);
 const R=O.config.supportMm,dr=Math.hypot(R,z),dv=Math.hypot(R,zv);const analytic=alpha/2*(Math.exp(-tr*z)-z/dr*Math.exp(-tr*dr)+Math.exp(-tr*zv)-zv/dv*Math.exp(-tr*dv));
 maxIntegralError=Math.max(maxIntegralError,Math.abs(analytic-optical.reflectance[c]));
 ok(optical.reflectance[c]>0&&optical.reflectance[c]<1,'Finite subunit diffuse albedo');
 ok(Math.abs(optical.weights.reduce((s,b)=>s+b[c],0)-1)<1e-10,'Normalized diffusion weights');
 let prev=Infinity;for(let r=0;r<2;r+=.01){let v=O.profile(r,a);ok(Number.isFinite(v)&&v>0&&v<=prev,'Monotone radial kernel');prev=v;}
}
ok(maxIntegralError<.0001,'Radial quadrature agrees with analytic finite-support integral');
let minDet=Infinity,maxJacError=0,maxShift=0;
for(let x=-51;x<=51;x+=1.3)for(let y=-37;y<=37;y+=1.7){
 let m=S.field(x,y),j=S.jacobian(x,y),d=j[0]*j[3]-j[1]*j[2];minDet=Math.min(minDet,d);maxShift=Math.max(maxShift,Math.hypot(m[0]-x,m[1]-y));ok(d>.70,'No sampled material fold-over');
 const e=.0001,px=S.field(x+e,y),nx=S.field(x-e,y),py=S.field(x,y+e),ny=S.field(x,y-e);let jn=[(px[0]-nx[0])/(2*e),(py[0]-ny[0])/(2*e),(px[1]-nx[1])/(2*e),(py[1]-ny[1])/(2*e)];maxJacError=Math.max(maxJacError,...j.map((v,i)=>Math.abs(v-jn[i])));
}
ok(maxJacError<1e-7,'Analytic shared Jacobian');ok(maxShift<.51,'Bounded positional variation');
let rows=[];
for(let weave=0;weave<4;weave++)for(let damage=0;damage<5;damage++){
 const g=C.compile({weave,slub:.55}),d=N.generate(C,g,damage),a=N.audit(d),hm=N.hairMesh(d.fibers),tm=N.tubeMesh(d.tubes);
 ok(a.finite&&a.maxAnchorErrorMm<1e-9,'Retained release anchors');ok(a.clumpedFibers>a.strayFibers&&a.strayFibers>0,'Clumps and strays');
 if(damage>=2){ok(a.bridges>0&&a.tails>0&&a.partialBridges>0,'Mixed breakage');ok(a.saggedBridges===a.bridges,'Sagging bridges');}
 ok(hm.vertices.length%12===0,'Ribbon stride');ok(hm.vertices.every(Number.isFinite),'Finite fiber data');ok(hm.indices.every(i=>i>=0&&i<hm.vertices.length/12),'Fiber indices');ok(tm.vertices.every(Number.isFinite),'Finite radius-normal tubes');
 for(let i=0;i<hm.vertices.length;i+=12*347){const tangent=hm.vertices.slice(i+8,i+11);ok(Math.abs(Math.hypot(...tangent)-1)<1e-5,'Unit tangent');ok(hm.vertices[i+6]>0&&hm.vertices[i+6]<.03,'Bounded fine-fiber radius');}
 for(const f of d.fibers.filter(f=>f.role==='sheath')){ok(Number.isInteger(f.parentId),'Outer staple parent identity');ok(f.points.length>=9,'Smooth finite staple');}
 ok(C.audit(g).wrongCrossingOrder===0,'Weave draft order');
 if(weave===0)rows.push({damage,...a,mainFiberTriangles:hm.indices.length/3,ribbonBytes:(hm.vertices.length+hm.indices.length)*4,looseTriangles:tm.indices.length/3});
}
const app=fs.readFileSync(__dirname+'/app.js','utf8');ok(!app.includes('edges=mesh'),'No solid wall');ok(app.includes('state.damage===0')&&app.includes('<180'),'Far-only intact captures');ok(app.includes('RGBA16F')&&app.includes('uniform float exposure'),'Linear-light target and final exposure');ok(!app.includes('wire highlight.O='),'GLSL comment cannot swallow output');
const report={passed:true,checks,optical,integralMaxAbsError:maxIntegralError,materialField:{minDet,maxShiftMm:maxShift,maxJacobianError:maxJacError},rows,limits:'Numerical profile/finite geometry/sample-order checks; not calibrated BSDF, global collision proof or film-grade score'};
fs.writeFileSync(__dirname+'/layers-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
