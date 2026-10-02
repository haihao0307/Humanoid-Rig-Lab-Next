const scBendGradient=new Float64Array(12),scBendCorrection=new Float64Array(12);
function scSolveBending(c,particles,h,compliance,dofs=null){
  if(!Number.isFinite(h)||h<=0||!Number.isFinite(compliance)||compliance<0)throw Error('assembly-bending: invalid timestep or compliance');
  const p0=particles[c.indices[0]],p1=particles[c.indices[1]],p2=particles[c.indices[2]],p3=particles[c.indices[3]],a=p0.pos,b=p1.pos,u=p2.pos,v=p3.pos;
  const ex=v[0]-u[0],ey=v[1]-u[1],ez=v[2]-u[2],e2=ex*ex+ey*ey+ez*ez;
  const ax=u[0]-a[0],ay=u[1]-a[1],az=u[2]-a[2],bx=v[0]-a[0],by=v[1]-a[1],bz=v[2]-a[2];
  const cx=v[0]-b[0],cy=v[1]-b[1],cz=v[2]-b[2],dx=u[0]-b[0],dy=u[1]-b[1],dz=u[2]-b[2];
  const nax=ay*bz-az*by,nay=az*bx-ax*bz,naz=ax*by-ay*bx,nbx=cy*dz-cz*dy,nby=cz*dx-cx*dz,nbz=cx*dy-cy*dx;
  const na2=nax*nax+nay*nay+naz*naz,nb2=nbx*nbx+nby*nby+nbz*nbz,scale2=Math.max(e2,ax*ax+ay*ay+az*az,dx*dx+dy*dy+dz*dz);
  if(!Number.isFinite(scale2)||e2<=1e-20||na2<=1e-20*scale2*scale2||nb2<=1e-20*scale2*scale2)return false;
  const length=Math.sqrt(e2),angle=Math.atan2(((nby*naz-nbz*nay)*ex+(nbz*nax-nbx*naz)*ey+(nbx*nay-nby*nax)*ez)/length,nax*nbx+nay*nby+naz*nbz);
  const error=Math.atan2(Math.sin(angle-c.restAngle),Math.cos(angle-c.restAngle));
  const a2=(-bx*ex-by*ey-bz*ez)/length,b2=(-cx*ex-cy*ey-cz*ez)/length,a3=(ax*ex+ay*ey+az*ez)/length,b3=(dx*ex+dy*ey+dz*ez)/length;
  scBendGradient[0]=nax/na2*length;scBendGradient[1]=nay/na2*length;scBendGradient[2]=naz/na2*length;
  scBendGradient[3]=nbx/nb2*length;scBendGradient[4]=nby/nb2*length;scBendGradient[5]=nbz/nb2*length;
  scBendGradient[6]=nax/na2*a2+nbx/nb2*b2;scBendGradient[7]=nay/na2*a2+nby/nb2*b2;scBendGradient[8]=naz/na2*a2+nbz/nb2*b2;
  scBendGradient[9]=nax/na2*a3+nbx/nb2*b3;scBendGradient[10]=nay/na2*a3+nby/nb2*b3;scBendGradient[11]=naz/na2*a3+nbz/nb2*b3;
  if(dofs){const gradients=c.dofGradients||(c.dofGradients=[[0,0,0],[0,0,0],[0,0,0],[0,0,0]]);for(let i=0;i<4;i++)for(let k=0;k<3;k++)gradients[i][k]=scBendGradient[i*3+k];const result=dofs.project(c.indices,gradients,error,{alpha:compliance/(h*h),lambda:c.lambda});c.lambda=result.lambda;return result.applied;}
  let denominator=0;for(let i=0;i<4;i++){const weight=particles[c.indices[i]].invMass,j=i*3;denominator+=weight*(scBendGradient[j]*scBendGradient[j]+scBendGradient[j+1]*scBendGradient[j+1]+scBendGradient[j+2]*scBendGradient[j+2]);}
  if(denominator<=0)return false;
  const alpha=compliance/(h*h),delta=(-error-alpha*c.lambda)/(denominator+alpha);if(!Number.isFinite(delta)||!Number.isFinite(c.lambda+delta))return false;
  for(let i=0;i<4;i++){const p=particles[c.indices[i]];for(let k=0;k<3;k++){const j=i*3+k;scBendCorrection[j]=scBendGradient[j]*p.invMass*delta;if(!Number.isFinite(p.pos[k]+scBendCorrection[j]))return false;}}
  c.lambda+=delta;for(let i=0;i<4;i++)for(let k=0;k<3;k++)particles[c.indices[i]].pos[k]+=scBendCorrection[i*3+k];return true;
}


export {scSolveBending};

