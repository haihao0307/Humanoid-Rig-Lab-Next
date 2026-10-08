import{SurfaceLaw,hinge,closestBary,LeatherDynamics}from'./site/dynamics.mjs';
import{LeatherMaterial}from'../r03/site/physics.mjs';
import{ClampedLeather}from'./site/clamp.mjs';
import{mkdirSync,writeFileSync}from'node:fs';
const tests=[];function check(name,yes,values={}){tests.push({name,pass:!!yes,...values});if(!yes)throw Error(name);}
const eq=(a,b,tol)=>Math.abs(a-b)<tol;
for(const id of ['AL','NL','PNL'])for(const angle of [0,45,90]){
 const law=new SurfaceLaw(id,angle),old=new LeatherMaterial(id,angle),F=[1.04,0,.03,.01,0,.98],p=law.evaluate(F),q=old.evaluate([1.04,.01,.03,.98]);
 check(`${id}/${angle}: 3D tangent surface retains R03 energy`,eq(p[0]/1e6,q.W,1e-8));let err=0;
 for(let i=0;i<6;i++){let f=F.slice();f[i]+=1e-6;let a=law.evaluate(f)[0];f[i]-=2e-6;let b=law.evaluate(f)[0];err=Math.max(err,Math.abs((a-b)/2e-6-p[1+i]));}check(`${id}/${angle}: stress gradient`,err<.02,{maxErrorPa:err});
 const rot=[F[0],F[2],-F[1],F[3],F[5],-F[4]];check(`${id}/${angle}: rotation objectivity`,eq(p[0],law.evaluate(rot)[0],1e-5));
}
let x=Float64Array.from([0,.04,.1,0,-.02,-.1,-.1,0,0,.1,0,0]),r=hinge(x,0,1,2,3),err=0;
for(let i=0;i<12;i++){let y=x.slice();y[i]+=1e-7;let p=hinge(y,0,1,2,3)[0];y[i]-=2e-7;let q=hinge(y,0,1,2,3)[0];err=Math.max(err,Math.abs(r[i+1]-(p-q)/2e-7));}check('signed bending-angle gradient',err<1e-6,{maxError:err});
const d=new LeatherDynamics();check('mass = initial area x thickness x density',eq(d.mass.reduce((a,b)=>a+b,0),.24*.24*.00139*700,1e-12));check('contact includes triangle interiors',eq(closestBary([.25,1,.25],[0,0,0],[1,0,0],[0,0,1])[0],.5,1e-12));
// Contact-force balance: subtract identical no-contact objective gradients.
d.stone.pos[1]=.016;d.stone.active=true;const N=d.N,all=Float64Array.from([...d.x,...d.stone.pos]);const contact=d.objective(all,all,1/240);d.stone.active=false;const empty=d.objective(all,all,1/240);let net=[0,0,0];for(let i=0;i<N+1;i++)for(let j=0;j<3;j++)net[j]+=contact.grad[i*3+j]-empty.grad[i*3+j];check('contact action-reaction on both bodies',Math.hypot(...net)<1e-6,{netForceN:net});
let forces={};for(const angle of [0,90]){let c=new ClampedLeather({profile:'AL',angle});c.command(.08);c.solve(2000);check('clamp equilibrates at '+angle,c.report().converged);forces[angle]=c.report().forceN;const old=c.geometry();c.command(0);c.solve(2000);check('clamp unload returns elastic rest at '+angle,c.report().converged&&c.report().energyNmm<1e-6);}
check('same clamp displacement uses actual material direction',Math.abs(forces[0]-forces[90])>20,{forcesN:forces});
mkdirSync('qa',{recursive:true});writeFileSync('qa/numerics.json',JSON.stringify({pass:true,scope:'mathematical consistency, not measured leather validation',tests},null,2));console.log(tests.length,'numerical checks pass');
