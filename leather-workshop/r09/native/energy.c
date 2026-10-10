/* Freestanding numerical evaluation only. Exact R04 nonlinear SurfaceLaw and
   hinge gradient, plus documented R09 contact/seam/grab potentials. Parameters
   are supplied from the JS structural model; never hidden learned constants.
   This file is included after contact.c when building the shared module. */
__attribute__((import_module("math"),import_name("log"))) extern double math_log(double);
__attribute__((import_module("math"),import_name("atan2"))) extern double math_atan2(double,double);
extern unsigned char __heap_base;
static double *arena;
static int N,NT,NB,NL,NP,NF;
static double *X,*OLD,*PRED,*MASS,*INV,*THICK,*TRI,*BEND,*LINK,*PAIR,*GRAD,*DIAG,*LAW,*GRAB,*TMP,*RESULT,*CLIP;
static double DT,RANGE,BK,MU;
__attribute__((visibility("default"))) double *arena_ptr(){return arena;}
__attribute__((visibility("default"))) int layout(int n,int nt,int nb,int nl,int np,int nf){
 N=n;NT=nt;NB=nb;NL=nl;NP=np;NF=nf;arena=(double*)(((unsigned int)&__heap_base+7u)&~7u);double *p=arena;
 X=p;p+=3*N;OLD=p;p+=3*N;PRED=p;p+=3*N;MASS=p;p+=N;INV=p;p+=N;THICK=p;p+=N;
 TRI=p;p+=8*NT;BEND=p;p+=6*NB;LINK=p;p+=20*NL;PAIR=p;p+=14*NP;GRAD=p;p+=3*N;DIAG=p;p+=3*N;
 LAW=p;p+=9+4*NF;GRAB=p;p+=11;TMP=p;p+=3*N;RESULT=p;p+=12;CLIP=p;p+=6*NP;
 if(p-arena>6000000)return 0;unsigned int need=(unsigned int)p,available=__builtin_wasm_memory_size(0)*65536u;if(need>available){unsigned int pages=(need-available+65535u)/65536u;if(__builtin_wasm_memory_grow(0,pages)==(unsigned int)-1)return 0;}return 1;
}
__attribute__((visibility("default"))) double *section(int id){switch(id){case 0:return X;case 1:return OLD;case 2:return PRED;case 3:return MASS;case 4:return INV;case 5:return THICK;case 6:return TRI;case 7:return BEND;case 8:return LINK;case 9:return PAIR;case 10:return GRAD;case 11:return DIAG;case 12:return LAW;case 13:return GRAB;case 14:return TMP;case 15:return RESULT;case 16:return CLIP;}return arena;}
__attribute__((visibility("default"))) void energy_config(double dt,double range,double k,double mu){DT=dt;RANGE=range;BK=k;MU=mu;}
static V point(double *x,int i){return(V){x[3*i],x[3*i+1],x[3*i+2]};}
static void law(double *F,double *out){
 V u={F[0],F[1],F[2]},v={F[3],F[4],F[5]};double A=dot(u,u),B=dot(v,v),C=dot(u,v),D=A*B-C*C;
 if(!(D>1e-8)){out[0]=__builtin_inf();return;}double q=max(0,A+B+1/D-3),c1=LAW[0],c2=LAW[1],c3=LAW[2];
 double W=c1*q+c2*q*q/2+c3*q*q*q/3,coef=c1+c2*q+c3*q*q;V P={0,0,0},Q={0,0,0};
 for(int i=0;i<NF;i++){double *p=LAW+9+4*i,alpha=p[0],k=p[1],a=p[2],b=p[3];V f=add(mul(u,a),mul(v,b));double e=k*q+(1-3*k)*(dot(f,f)-1);W+=.5*alpha*e*e;coef+=alpha*e*k;double s=2*alpha*e*(1-3*k);P=add(P,mul(f,s*a));Q=add(Q,mul(f,s*b));}
 double z=2/(D*D);P=add(P,mul(sub(mul(u,2),mul(sub(mul(u,B),mul(v,C)),z)),coef));Q=add(Q,mul(sub(mul(v,2),mul(sub(mul(v,A),mul(u,C)),z)),coef));
 out[0]=W;out[1]=P.x;out[2]=P.y;out[3]=P.z;out[4]=Q.x;out[5]=Q.y;out[6]=Q.z;
}
static double bend(double *x,double *p,double *g){
 V a=point(x,(int)p[0]),b=point(x,(int)p[1]),c=point(x,(int)p[2]),d=point(x,(int)p[3]),e=sub(d,c);double L=norm(e);V N0=cross(sub(c,a),sub(d,a)),N1=cross(sub(d,b),sub(c,b));double l0=norm(N0),l1=norm(N1);
 if(L<1e-9||l0<1e-12||l1<1e-12){for(int i=0;i<12;i++)g[i]=0;return 0;}
 V n0=mul(N0,1/l0),n1=mul(N1,1/l1);double theta=math_atan2(dot(cross(n0,n1),e)/L,min(1,max(-1,dot(n0,n1))));
 double k0=dot(sub(a,d),e)/L,k1=dot(sub(b,d),e)/L,k2=dot(sub(c,a),e)/L,k3=dot(sub(c,b),e)/L;V t0=mul(N0,1/(l0*l0)),t1=mul(N1,1/(l1*l1));
 V gs[4]={mul(t0,-L),mul(t1,-L),mul(add(mul(t0,k0),mul(t1,k1)),-1),mul(add(mul(t0,k2),mul(t1,k3)),-1)};for(int i=0;i<4;i++){g[3*i]=gs[i].x;g[3*i+1]=gs[i].y;g[3*i+2]=gs[i].z;}return theta;
}
static void barrier(double d,double *out){if(d>=RANGE){out[0]=out[1]=out[2]=0;return;}if(d<=0){out[0]=__builtin_inf();return;}double r=d-RANGE,l=math_log(d/RANGE);out[0]=-BK*r*r*l;out[1]=-BK*(2*r*l+r*r/d);out[2]=BK*(-2*l-4*r/d+r*r/(d*d));}
__attribute__((visibility("default"))) void potential(int np,int withdiag){
 double E=0,U=0,BC=0,force=0,grabforce=0;int active=0,friction=0;for(int i=0;i<N;i++)for(int j=0;j<3;j++){int k=3*i+j;double m=MASS[i]/(DT*DT),d=X[k]-PRED[k];E+=.5*m*d*d;GRAD[k]=m*d;if(withdiag)DIAG[k]=m;}
 for(int i=0;i<NT;i++){double *q=TRI+8*i;int ids[3]={(int)q[0],(int)q[1],(int)q[2]};double *D=q+3,volume=q[7],F[6],out[7];
  for(int j=0;j<3;j++){double e=X[3*ids[1]+j]-X[3*ids[0]+j],f=X[3*ids[2]+j]-X[3*ids[0]+j];F[j]=e*D[0]+f*D[2];F[j+3]=e*D[1]+f*D[3];}
  law(F,out);if(!__builtin_isfinite(out[0])){RESULT[0]=__builtin_inf();return;}U+=volume*out[0];E+=volume*out[0];double du[3]={-D[0]-D[2],D[0],D[2]},dv[3]={-D[1]-D[3],D[1],D[3]},*K=LAW+3;
  for(int z=0;z<3;z++)for(int j=0;j<3;j++){int k=3*ids[z]+j;GRAD[k]+=volume*(out[1+j]*du[z]+out[4+j]*dv[z]);if(withdiag){double a=F[j]*du[z],b=F[j+3]*dv[z],c=F[j+3]*du[z]+F[j]*dv[z];DIAG[k]+=volume*(K[0]*a*a+K[3]*b*b+K[5]*c*c+2*K[1]*a*b+2*K[2]*a*c+2*K[4]*b*c);}}
 }
 for(int i=0;i<NB;i++){double *q=BEND+6*i,g[12],C=bend(X,q,g)-q[4];while(C>3.141592653589793)C-=6.283185307179586;while(C< -3.141592653589793)C+=6.283185307179586;double f=q[5]*C;E+=.5*f*C;U+=.5*f*C;for(int z=0;z<4;z++)for(int j=0;j<3;j++){int k=3*(int)q[z]+j;double a=g[3*z+j];GRAD[k]+=f*a;if(withdiag)DIAG[k]+=q[5]*a*a;}}
 for(int i=0;i<NL;i++){double *q=LINK+20*i;int count=(int)q[0];V d={0,0,0};for(int z=0;z<count;z++)d=add(d,mul(point(X,(int)q[1+z]),q[9+z]));double L=norm(d);if(L<1e-14)continue;double C=L-q[17],K=q[18],unit[3]={d.x/L,d.y/L,d.z/L};E+=.5*K*C*C;for(int z=0;z<count;z++)for(int j=0;j<3;j++){int k=3*(int)q[1+z]+j;double g=q[9+z]*unit[j];GRAD[k]+=K*C*g;if(withdiag)DIAG[k]+=K*g*g;}}
 if(GRAB[0]){for(int j=0;j<3;j++){double d=-GRAB[7+j];for(int z=0;z<3;z++)d+=GRAB[4+z]*X[3*(int)GRAB[1+z]+j];double K=GRAB[10];E+=.5*K*d*d;grabforce+=K*K*d*d;for(int z=0;z<3;z++){int k=3*(int)GRAB[1+z]+j;GRAD[k]+=K*d*GRAB[4+z];if(withdiag)DIAG[k]+=K*GRAB[4+z]*GRAB[4+z];}}}
 for(int i=0;i<np;i++){double *p=PAIR+14*i;int ids[4]={(int)p[0],(int)p[1],(int)p[2],(int)p[3]};V pts[4];for(int z=0;z<4;z++)pts[z]=point(X,ids[z]);Q q=p[5]?pt(pts):ee(pts);double B[3]={0,0,0};barrier(q.d-p[4],B);if(!__builtin_isfinite(B[0])){RESULT[0]=__builtin_inf();return;}E+=B[0];BC+=B[0];if(B[0]>0){active++;force-=B[1];double n[3]={q.n.x,q.n.y,q.n.z};for(int z=0;z<4;z++)for(int j=0;j<3;j++){int k=3*ids[z]+j;double g=q.w[z]*n[j];GRAD[k]+=B[1]*g;if(withdiag)DIAG[k]+=max(0,B[2])*g*g;}}
  if(p[13]>0&&MU>0){V r={0,0,0},n={p[10],p[11],p[12]};for(int z=0;z<4;z++)r=add(r,mul(sub(point(X,ids[z]),point(OLD,ids[z])),p[6+z]));r=sub(r,mul(n,dot(r,n)));double eps=.00002,L=__builtin_sqrt(dot(r,r)+eps*eps),f=MU*p[13],d[3]={r.x,r.y,r.z};E+=f*(L-eps);friction++;for(int z=0;z<4;z++)for(int j=0;j<3;j++){int k=3*ids[z]+j;GRAD[k]+=f*p[6+z]*d[j]/L;if(withdiag)DIAG[k]+=f*p[6+z]*p[6+z]/L;}}
 }
 for(int i=0;i<N;i++){int k=3*i+1;double d=X[k]-THICK[i]-.0005;if(d<0){E+=1e5*d*d;GRAD[k]+=2e5*d;if(withdiag)DIAG[k]+=2e5;}}
 double residual=0;for(int i=0;i<N;i++)for(int j=0;j<3;j++){int k=3*i+j;if(INV[i]==0)GRAD[k]=0;residual=max(residual,abs(GRAD[k]));if(withdiag)DIAG[k]=1/max(1e-6,DIAG[k]);}
 RESULT[0]=E;RESULT[1]=residual;RESULT[2]=U;RESULT[3]=BC;RESULT[4]=active;RESULT[5]=force;RESULT[6]=friction;RESULT[7]=__builtin_sqrt(grabforce);
}
__attribute__((visibility("default"))) double clip_many(int n){double fraction=1;int events=0,np=0,ne=0;for(int i=0;i<n;i++){double *q=CLIP+6*i;for(int z=0;z<4;z++){int id=(int)q[z];for(int j=0;j<3;j++){input[3*z+j]=X[3*id+j];input[12+3*z+j]=TMP[3*id+j];}}if(swept(q[4],(int)q[5])){fraction=min(fraction,output[8]*.9);events++;if(q[5])np++;else ne++;}}RESULT[8]=events;RESULT[9]=np;RESULT[10]=ne;return fraction;}
