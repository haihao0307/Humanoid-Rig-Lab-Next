const{ProductShell}=require('./node-lib.cjs');const fs=require('fs');
const old=function(q,dt){
  const a=q.ids[0]*3,b=q.ids[1]*3,c=q.ids[2]*3,D=q.D,x=this.x,F=this._F,G=this._G,M=this._M,rhs=this._rhs,alpha=q.alpha;
  for(let j=0;j<3;j++){const e=x[b+j]-x[a+j],f=x[c+j]-x[a+j];F[j]=e*D[0]+f*D[2];F[j+3]=e*D[1]+f*D[3];
   G[3+j]=F[j]*D[0];G[6+j]=F[j]*D[2];G[j]=-G[3+j]-G[6+j];
   G[12+j]=F[j+3]*D[1];G[15+j]=F[j+3]*D[3];G[9+j]=-G[12+j]-G[15+j];
   G[21+j]=F[j+3]*D[0]+F[j]*D[1];G[24+j]=F[j+3]*D[2]+F[j]*D[3];G[18+j]=-G[21+j]-G[24+j];}
  rhs[0]=-(F[0]*F[0]+F[1]*F[1]+F[2]*F[2]-1)*.5;rhs[1]=-(F[3]*F[3]+F[4]*F[4]+F[5]*F[5]-1)*.5;rhs[2]=-(F[0]*F[3]+F[1]*F[4]+F[2]*F[5]);M.set(alpha);
  for(let k=0;k<3;k++)for(let l=0;l<3;l++){rhs[k]-=alpha[k*3+l]*q.lambda[l];let sum=0;for(let i=0;i<3;i++){const p=k*9+i*3,r=l*9+i*3;sum+=this.inv[q.ids[i]]*(G[p]*G[r]+G[p+1]*G[r+1]+G[p+2]*G[r+2]);}M[k*3+l]+=sum;}
  const l00=Math.sqrt(Math.max(1e-20,M[0])),l10=M[3]/l00,l20=M[6]/l00,l11=Math.sqrt(Math.max(1e-20,M[4]-l10*l10)),l21=(M[7]-l20*l10)/l11,l22=Math.sqrt(Math.max(1e-20,M[8]-l20*l20-l21*l21));
  const y0=rhs[0]/l00,y1=(rhs[1]-l10*y0)/l11,y2=(rhs[2]-l20*y0-l21*y1)/l22,d2=y2/l22,d1=(y1-l21*d2)/l11,d0=(y0-l10*d1-l20*d2)/l00;
  q.lambda[0]+=d0;q.lambda[1]+=d1;q.lambda[2]+=d2;for(let i=0;i<3;i++)for(let j=0;j<3;j++){const k=i*3+j;x[3*q.ids[i]+j]+=this.inv[q.ids[i]]*(d0*G[k]+d1*G[9+k]+d2*G[18+k]);}
 };
const d={positions:[0,120,0,50,125,3,6,126,50],triangles:[[0,1,2,1.4,0]]};let max=0;
for(let trial=0;trial<1000;trial++){const a=new ProductShell(d),b=new ProductShell(d);for(let i=0;i<a.x.length;i++)a.x[i]+=.003*Math.sin(trial*3.193+i*1.711);b.x.set(a.x);for(let j=0;j<3;j++)a.tri[0].lambda[j]=b.tri[0].lambda[j]=Math.sin(trial+j)*.0001;old.call(a,a.tri[0],a.cfg.dt/a.cfg.substeps);b.membrane(b.tri[0],b.cfg.dt/b.cfg.substeps);for(let i=0;i<a.x.length;i++)max=Math.max(max,Math.abs(a.x[i]-b.x[i]));}
const result={pass:max<1e-12,maximumPositionDifferenceM:max,cases:1000,scope:'Algebraic reference-vs-optimized single-triangle update, same compliance, same input state, not real material measurement'};fs.writeFileSync(__dirname+'/qa-membrane.json',JSON.stringify(result,null,2));console.log(result);if(!result.pass)process.exitCode=1;
