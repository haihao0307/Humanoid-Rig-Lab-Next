const fs=require('fs'),{T,makeProduct,productMaterials,ProductShell,updateSkin,fastHinge,hinge}=require('./node-lib.cjs');
const result={checks:[],scope:'Physical-node reconstruction of the exact vertex shader. Rest-coordinate aliases on the same primary panel are compared after grip; separate construction-panel joins use the reported material-coordinate constraints.'};
function check(name,pass,data){result.checks.push({name,pass:!!pass,data});fs.writeFileSync(__dirname+'/qa-motion.json',JSON.stringify(result,null,2));if(!pass)throw Error(name);}
function surfaceVertex(g,i,r){const weights=g.attributes.simWeights.array,ids=g.attributes.simIDs.array,delta=g.attributes.simDelta.array,pix=r.pixels;const p=[0,0,0],X=[0,0,0],N=[0,0,0];for(let k=0;k<4;k++){const id=Math.round(ids[i*4+k]),w=weights[i*4+k];for(let j=0;j<3;j++){p[j]+=w*pix[id*12+j];X[j]+=w*pix[id*12+4+j];N[j]+=w*pix[id*12+8+j];}}const nl=Math.hypot(...N);for(let j=0;j<3;j++)N[j]/=nl;const dot=X.reduce((v,x,j)=>v+x*N[j],0);for(let j=0;j<3;j++)X[j]-=dot*N[j];const xl=Math.hypot(...X);for(let j=0;j<3;j++)X[j]/=xl;const Y=[N[1]*X[2]-N[2]*X[1],N[2]*X[0]-N[0]*X[2],N[0]*X[1]-N[1]*X[0]];for(let j=0;j<3;j++)p[j]+=delta[i*3]*X[j]+delta[i*3+1]*Y[j]+delta[i*3+2]*N[j];return p;}
function dist(a,b){return Math.hypot(...a.map((v,j)=>v-b[j]));}
try{
 let gradient=0;for(let i=0;i<1000;i++){const x=Float64Array.from({length:12},(_,j)=>Math.sin(i*17+j*3.124)+.03*j),a=fastHinge(x,0,1,2,3),b=hinge(x,0,1,2,3);for(let j=0;j<13;j++)gradient=Math.max(gradient,Math.abs(a[j]-b[j])/Math.max(1,Math.abs(b[j])));}check('scalar hinge matches exact frozen R04 gradient',gradient<1e-12,{samples:1000,relativeMaximum:gradient});
 for(const id of ['wallet','belt','bag','cowboy','pirate','jacket','swatch']){
  const root=makeProduct(id,productMaterials(new T.MeshStandardMaterial()),{}),r=root.userData.rig,s=new ProductShell(r.data),tri=s.tri[Math.floor(s.tri.length*.42)],p=[0,0,0];for(const i of tri.ids)for(let j=0;j<3;j++)p[j]+=s.x[i*3+j]*1000/3;s.pick(tri.ids,[1/3,1/3,1/3],p);for(let k=0;k<60;k++){s.move([p[0]+25*Math.sin(k/15),p[1]+k*1.4,p[2]+15*Math.cos(k/15)]);s.step();}updateSkin(root,s);
  let maxAlias=0,duplicates=0,minThickness=Infinity,maxRatio=0;
  for(const part of r.parts){const g=part.mesh.geometry,ps=g.attributes.position,a=ps.array,n=g.userData.paperVertices,clusters=new Map();for(let i=0;i<ps.count;i++){const key=[a[i*3],a[i*3+1],a[i*3+2]].map(x=>Math.round(x*1e5)).join(',');const old=clusters.get(key);if(old===undefined)clusters.set(key,i);else{maxAlias=Math.max(maxAlias,dist(surfaceVertex(g,i,r),surfaceVertex(g,old,r)));duplicates++;}}
   for(let i=0;i<n;i+=Math.max(1,Math.floor(n/160))){const t=dist(surfaceVertex(g,i,r),surfaceVertex(g,i+n,r)),original=Math.hypot(a[i*3]-a[(i+n)*3],a[i*3+1]-a[(i+n)*3+1],a[i*3+2]-a[(i+n)*3+2]);minThickness=Math.min(minThickness,t);maxRatio=Math.max(maxRatio,Math.abs(t/original-1));}
  }
  check(id+' coincident cut-wall and skin vertices remain joined after actual grip',duplicates>0&&maxAlias<.002,{duplicates,maxAliasMM:maxAlias});
  check(id+' generated front-back separation survives actual grip',minThickness>.15&&maxRatio<.005,{minThicknessMM:minThickness,maxRelativeChange:maxRatio});
  check(id+' force state finite during shell check',s.report().finite&&!s.failed,s.report());
 }
 result.pass=true;
}catch(e){result.pass=false;result.failure=e.message;console.error(e.stack);}
fs.writeFileSync(__dirname+'/qa-motion.json',JSON.stringify(result,null,2));console.log(JSON.stringify({pass:result.pass,checks:result.checks.length,failure:result.failure}));process.exitCode=result.pass?0:1;
