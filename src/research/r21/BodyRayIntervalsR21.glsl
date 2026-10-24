// The existing function is not a signed distance field. Traverse its cells
// and isolate zero crossings; never accept a merely small positive value.
uniform highp usampler3D uIntervalActive;
uniform vec3 uIntervalGrid;
float quintic(float x){float t=clamp(x,0.,1.);return t*t*t*(t*(t*6.-15.)+10.);}

float gridExit(vec3 p,vec3 rd,vec3 bmin,vec3 bmax,vec3 grid,bool centres){
 vec3 stepSize=(bmax-bmin)/grid,q=(p-bmin)/stepSize-(centres?.5:0.);
 vec3 index=floor(q+sign(rd)*.00002),next=index+step(vec3(0.),rd),plane=bmin+(next+(centres?.5:0.))*stepSize;
 vec3 delta=(plane-p)/rd;float distance=1e20;
 for(int k=0;k<3;k++)if(abs(rd[k])>1e-12&&delta[k]>0.)distance=min(distance,delta[k]);
 return distance;
}
float fineExit(vec3 p,vec3 rd){
 float distance=gridExit(p,rd,uMin,uMax,uGrid,true);
 for(int i=0;i<4;i++){
  vec3 lo,hi,g;if(i==0){lo=uLMin0;hi=uLMax0;g=uLGrid0;}else if(i==1){lo=uLMin1;hi=uLMax1;g=uLGrid1;}else if(i==2){lo=uLMin2;hi=uLMax2;g=uLGrid2;}else{lo=uLMin3;hi=uLMax3;g=uLGrid3;}
  if(all(greaterThanEqual(p,lo))&&all(lessThanEqual(p,hi)))distance=min(distance,gridExit(p,rd,lo,hi,g,true));
  // Also stop at local-region support boundaries, before a blend can start.
  for(int k=0;k<3;k++)if(abs(rd[k])>1e-12){float a=(lo[k]-p[k])/rd[k],b=(hi[k]-p[k])/rd[k];if(a>0.)distance=min(distance,a);if(b>0.)distance=min(distance,b);}
 }
 return distance;
}
float triValue(float c[8],vec3 p){return mix(mix(mix(c[0],c[1],p.x),mix(c[2],c[3],p.x),p.y),mix(mix(c[4],c[5],p.x),mix(c[6],c[7],p.x),p.y),p.z);}
vec2 blendWeightRange(vec3 a,vec3 b,vec3 lo,vec3 hi,vec3 origin,vec3 axis,vec2 axial){
 vec3 alo=a-lo,blo=b-lo,ahi=hi-a,bhi=hi-b;
 float lower=min(min(min(alo.x,blo.x),min(alo.y,blo.y)),min(alo.z,blo.z));
 lower=min(lower,min(min(min(ahi.x,bhi.x),min(ahi.y,bhi.y)),min(ahi.z,bhi.z)));
 float upper=min(min(max(alo.x,blo.x),max(alo.y,blo.y)),max(alo.z,blo.z));
 upper=min(upper,min(min(max(ahi.x,bhi.x),max(ahi.y,bhi.y)),max(ahi.z,bhi.z)));
 float pa=dot(a-origin,axis),pb=dot(b-origin,axis);
 return vec2(smoothstep(0.,.008,lower)*quintic((min(pa,pb)-axial.x)/(axial.y-axial.x)),smoothstep(0.,.008,upper)*quintic((max(pa,pb)-axial.x)/(axial.y-axial.x)));
}
// In the main field and the interior of each local field the ray restriction
// is exactly a cubic. Isolate all monotone spans instead of marching past
// a thin negative interval or exhaustively bounding a 3D enclosing box.
vec4 fieldCubic(int region,vec3 a,vec3 b,vec3 lo,vec3 hi,vec3 grid){
 vec3 qa=(a-lo)/(hi-lo)*grid-.5,qb=(b-lo)/(hi-lo)*grid-.5;ivec3 base=ivec3(floor((qa+qb)*.5)),top=ivec3(grid)-1;
 vec3 q0=qa-vec3(base),delta=qb-qa;vec4 polynomial=vec4(0.);
 for(int z=0;z<2;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec3 v=vec3(x==0?1.-q0.x:q0.x,y==0?1.-q0.y:q0.y,z==0?1.-q0.z:q0.z),d=delta*vec3(x==0?-1.:1.,y==0?-1.:1.,z==0?-1.:1.);
  float c=packedFetch(region,clamp(base+ivec3(x,y,z),ivec3(0),top),0).r;
  polynomial+=c*vec4(v.x*v.y*v.z,d.x*v.y*v.z+v.x*d.y*v.z+v.x*v.y*d.z,d.x*d.y*v.z+d.x*v.y*d.z+v.x*d.y*d.z,d.x*d.y*d.z);
 }
 return polynomial;
}
int constantField(vec3 a,vec3 b){
 int selected=-1;bool varyingWeight=false;
 for(int i=0;i<4;i++){
  vec3 lo,hi;if(i==0){lo=uLMin0;hi=uLMax0;}else if(i==1){lo=uLMin1;hi=uLMax1;}else if(i==2){lo=uLMin2;hi=uLMax2;}else{lo=uLMin3;hi=uLMax3;}
  vec2 w=blendWeightRange(a,b,lo,hi,uRefineOrigins[i],uRefineAxes[i],uRefineRanges[i]);
  if(w.y<=0.)continue;if(w.x>=1.){selected=i;varyingWeight=false;}else varyingWeight=true;
 }
 return varyingWeight?-2:selected;
}
int cubicFirst(vec3 ro,vec3 rd,float ta,float tb,out float rootT){
 vec3 a=ro+rd*ta,b=ro+rd*tb;int selected=constantField(a,b);if(selected==-2)return 0;
 vec4 c;if(selected==-1)c=fieldCubic(0,a,b,uMin,uMax,uGrid);else if(selected==0)c=fieldCubic(1,a,b,uLMin0,uLMax0,uLGrid0);else if(selected==1)c=fieldCubic(2,a,b,uLMin1,uLMax1,uLGrid1);else if(selected==2)c=fieldCubic(3,a,b,uLMin2,uLMax2,uLGrid2);else c=fieldCubic(4,a,b,uLMin3,uLMax3,uLGrid3);
 float cuts[4];int count=1;cuts[0]=0.;float A=c.w,B=c.z,C=c.y;
 if(A!=0.){float discriminant=B*B-3.*A*C;if(discriminant>=0.){float q=-B-(B<0.?-1.:1.)*sqrt(discriminant),x=q/(3.*A),y=q!=0.?C/q:0.;if(x>0.&&x<1.)cuts[count++]=x;if(y>0.&&y<1.)cuts[count++]=y;}}
 else if(B!=0.){float x=-C/(2.*B);if(x>0.&&x<1.)cuts[count++]=x;}
 cuts[count++]=1.;for(int i=0;i<4;i++)for(int j=i+1;j<4;j++)if(i<count&&j<count&&cuts[j]<cuts[i]){float v=cuts[i];cuts[i]=cuts[j];cuts[j]=v;}
 float last=ta,fl=scalar(a);if(fl==0.){rootT=ta;return 1;}
 for(int i=1;i<4;i++){if(i>=count)break;float endT=mix(ta,tb,cuts[i]),fr=scalar(ro+rd*endT);if(fl*fr<0.){float l=last,h=endT;for(int k=0;k<20;k++){float m=(l+h)*.5;if(m<=l||m>=h)break;float fm=scalar(ro+rd*m);if((fm>0.)==(fl>0.)){l=m;fl=fm;}else h=m;}rootT=(l+h)*.5;return 1;}if(fr==0.){rootT=endT;return 1;}last=endT;fl=fr;}
 return -1;
}
bool intervalTrace(vec3 ro,vec3 rd,vec2 bounds,out float hitT){
 float t=max(0.,bounds.x),end=bounds.y;
 for(int visit=0;visit<2048;visit++){
  if(t>=end)return false;vec3 p=ro+rd*t;
  ivec3 coarse=clamp(ivec3(floor((p-uMin)/(uMax-uMin)*uIntervalGrid+sign(rd)*.00002)),ivec3(0),ivec3(uIntervalGrid)-1);
  bool cellActive=texelFetch(uIntervalActive,coarse,0).r>0u;
  float stepLength=cellActive?fineExit(p,rd):gridExit(p,rd,uMin,uMax,uIntervalGrid,false),next=min(end,max(t+stepLength,uintBitsToFloat(floatBitsToUint(t)+1u)));
  if(cellActive){
   int exactCase=cubicFirst(ro,rd,t,next,hitT);if(exactCase==1)return true;
   if(exactCase==-1){t=next;continue;}
   // A varying blend is not cubic. Retain explicit finite probes here and
   // report that these transition spans have no global first-root certificate.
   float previous=t,previousValue=scalar(p);
   for(int probe=1;probe<=8;probe++){
    float current=mix(t,next,float(probe)/8.),value=scalar(ro+rd*current);
    if(previousValue==0.){hitT=previous;return true;}
    if(previousValue*value<0.){float lo=previous,hi=current;
     for(int refine=0;refine<20;refine++){float mid=(lo+hi)*.5;if(mid<=lo||mid>=hi)break;float v=scalar(ro+rd*mid);if((v>0.)==(previousValue>0.)){lo=mid;previousValue=v;}else hi=mid;}
     hitT=(lo+hi)*.5;return true;
    }
    if(value==0.){hitT=current;return true;}previous=current;previousValue=value;
   }
  }
  if(next<=t)return false;t=next;
 }
 return false;
}
