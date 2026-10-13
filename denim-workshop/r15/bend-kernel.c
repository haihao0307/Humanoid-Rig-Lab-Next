/* R15 performance kernel, authored for KAOPU. Fixed 49x13 R14 swatch.
   Same 240Hz integration and 12+16 projection passes, double precision.
   No fast-math, no constraint thinning, no collision sampling reduction.
   Spatial candidate cells and contact order match the R14 hash algorithm.
   Browser JS owns validation, reports and control/command ordering. */
typedef unsigned int u32;
extern double atan2(double,double);
extern double sin(double);extern double cos(double);extern double exp(double);
#define NX 49
#define NY 13
#define N (NX*NY)
#define NR (NX+NY)
#define MAXLINK 3000
#define NG 1150
#define NT 1152
#define HASH 16384
#define MEMBERS 65536
#define MAXPAIRS (N*NT)
static double X[N*3],P[N*3],V[N*3],R[N*3],M[N],I[N],CF[40];
/* link: a,b,rest length, compliance, lambda,type */
static double LI[MAXLINK][6],AL[MAXLINK],GA[NG];
static int LC,GN,RC,TR[NT][3],RL[NR][48],RN[NR][49],RLN[NR],CN[NR];
static double CA[NR],CD[NR][47],C1[NR][47],C2[NR][47],CL[NR][47][3];
/* guard: id0,id1,id2,angle,cosAngle,compliance,lambda */
static double GU[NG][7],GR[NY*6];
static int PIN[N],HUSED[HASH],HX[HASH],HY[HASH],HZ[HASH],HFIRST[HASH],HLAST[HASH],MT[MEMBERS],MN[MEMBERS],MC;
static int PA[MAXPAIRS],PT[MAXPAIRS],PC;
static double normal[48][3],diag[48],rhs[48],upper[48],delta[48],corr[49][3];
static double min(double a,double b){return a<b?a:b;}static double max(double a,double b){return a>b?a:b;}
static double clamp(double a,double l,double h){return min(h,max(l,a));}
static double norm(double a,double b,double c){return __builtin_sqrt(a*a+b*b+c*c);}
static int absI(int v){return v<0?-v:v;}
static double dot3(const double*a,const double*b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
static double *vec(int id){return X+id*3;}
/* explicit byte memory functions avoid a runtime/allocator dependency */
void *memset(void *p,int v,unsigned long n){unsigned char *s=p;for(unsigned long i=0;i<n;i++)s[i]=v;return p;}
void *memcpy(void *p,const void*q,unsigned long n){unsigned char*s=p;const unsigned char*t=q;for(unsigned long i=0;i<n;i++)s[i]=t[i];return p;}
int addr(int slot){switch(slot){case 0:return (int)X;case 1:return (int)P;case 2:return (int)V;case 3:return (int)R;case 4:return (int)M;case 5:return (int)I;case 6:return (int)CF;case 7:return (int)LI;case 8:return (int)RL;case 9:return (int)RN;case 10:return (int)RLN;case 11:return (int)CN;case 12:return (int)CA;case 13:return (int)CD;case 14:return (int)C1;case 15:return (int)C2;case 16:return (int)GU;case 17:return (int)PIN;case 18:return (int)TR;default:return 0;}}
void configure(int links,int guards,int runs){LC=links;GN=guards;RC=runs;PC=0;CF[30]=0;for(int i=0;i<LC;i++)AL[i]=LI[i][3]/(CF[0]*CF[0]);for(int i=0;i<GN;i++)GA[i]=GU[i][5]/(CF[0]*CF[0]);}
static void distance_link(int idx){double *l=LI[idx];int a=(int)l[0],b=(int)l[1];double*x=vec(a),*y=vec(b),dx=x[0]-y[0],dy=x[1]-y[1],dz=x[2]-y[2],L=norm(dx,dy,dz);if(L<1e-12)return;double alpha=AL[idx],dl=(-(L-l[2])-alpha*l[4])/(I[a]+I[b]+alpha);l[4]+=dl;double A=I[a]*dl/L,B=I[b]*dl/L;x[0]+=A*dx;x[1]+=A*dy;x[2]+=A*dz;y[0]-=B*dx;y[1]-=B*dy;y[2]-=B*dz;}
static void chain(int r){int n=RLN[r];for(int k=0;k<n;k++){double*l=LI[RL[r][k]];int a=(int)l[0],b=(int)l[1];double*x=vec(a),*y=vec(b),dx=x[0]-y[0],dy=x[1]-y[1],dz=x[2]-y[2],L=max(1e-12,norm(dx,dy,dz)),alpha=AL[RL[r][k]];normal[k][0]=dx/L;normal[k][1]=dy/L;normal[k][2]=dz/L;diag[k]=I[a]+I[b]+alpha;rhs[k]=-(L-l[2])-alpha*l[4];if(k){double d=0;for(int c=0;c<3;c++)d+=normal[k-1][c]*normal[k][c];double off=-I[a]*d;upper[k-1]=off;double ratio=off/diag[k-1];diag[k]-=ratio*off;rhs[k]-=ratio*rhs[k-1];}}
 for(int k=n-1;k>=0;k--)delta[k]=(rhs[k]-(k<n-1?upper[k]*delta[k+1]:0))/diag[k];for(int k=0;k<=n;k++)for(int c=0;c<3;c++)corr[k][c]=0;for(int k=0;k<n;k++){double*l=LI[RL[r][k]],dl=delta[k];int a=(int)l[0],b=(int)l[1];for(int c=0;c<3;c++){double d=normal[k][c]*dl;corr[k][c]+=I[a]*d;corr[k+1][c]-=I[b]*d;}}
 double peak2=0;for(int k=0;k<=n;k++)peak2=max(peak2,corr[k][0]*corr[k][0]+corr[k][1]*corr[k][1]+corr[k][2]*corr[k][2]);double peak=__builtin_sqrt(peak2);double f=min(1,.2*min(CF[4],CF[5])/max(1e-14,peak));for(int k=0;k<n;k++)LI[RL[r][k]][4]+=delta[k]*f;for(int k=0;k<=n;k++)for(int c=0;c<3;c++)X[RN[r][k]*3+c]+=f*corr[k][c];}
static void curvature(int r){int n=CN[r];for(int c=0;c<3;c++){for(int k=0;k<n;k++){double C=X[RN[r][k]*3+c]-2*X[RN[r][k+1]*3+c]+X[RN[r][k+2]*3+c];rhs[k]=-C-CA[r]*CL[r][k][c]-(k?C1[r][k]*rhs[k-1]:0)-(k>1?C2[r][k]*rhs[k-2]:0);}for(int k=n-1;k>=0;k--)delta[k]=rhs[k]/CD[r][k]-(k+1<n?C1[r][k+1]*delta[k+1]:0)-(k+2<n?C2[r][k+2]*delta[k+2]:0);for(int k=0;k<n;k++){double d=delta[k];CL[r][k][c]+=d;X[RN[r][k]*3+c]+=I[RN[r][k]]*d;X[RN[r][k+1]*3+c]-=2*I[RN[r][k+1]]*d;X[RN[r][k+2]*3+c]+=I[RN[r][k+2]]*d;}}}
static void guard(int gi){double*g=GU[gi];int ids[3]={(int)g[0],(int)g[1],(int)g[2]};double*a=vec(ids[0]),*b=vec(ids[1]),*c=vec(ids[2]);double ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-b[0],vy=c[1]-b[1],vz=c[2]-b[2],l1sq=ux*ux+uy*uy+uz*uz,l2sq=vx*vx+vy*vy+vz*vz,uv=ux*vx+uy*vy+uz*vz;if(l1sq<1e-24||l2sq<1e-24)return;if(g[6]==0&&uv>=0&&uv*uv>=g[4]*g[4]*l1sq*l2sq)return;double l1=__builtin_sqrt(l1sq),l2=__builtin_sqrt(l2sq);double U[3]={ux/l1,uy/l1,uz/l1},W[3]={vx/l2,vy/l2,vz/l2},q=clamp(dot3(U,W),-1,1);if(g[6]==0&&q>=g[4])return;double sn=__builtin_sqrt(max(0,1-q*q));if(sn<1e-7)return;double C=atan2(sn,q)-g[3],J[3][3],fa=1/(l1*sn),fc=-1/(l2*sn);for(int k=0;k<3;k++){J[0][k]=(W[k]-U[k]*q)*fa;J[2][k]=(U[k]-W[k]*q)*fc;J[1][k]=-(J[0][k]+J[2][k]);}double alpha=GA[gi],sum=alpha;for(int k=0;k<3;k++)sum+=I[ids[k]]*dot3(J[k],J[k]);double lambda=min(0,g[6]+(-C-alpha*g[6])/sum),d=lambda-g[6];g[6]=lambda;for(int k=0;k<3;k++)for(int j=0;j<3;j++)X[ids[k]*3+j]+=I[ids[k]]*J[k][j]*d;}
static void fixture(){for(int id=0;id<N;id++)if(PIN[id])for(int c=0;c<3;c++)X[id*3+c]=R[id*3+c];if(!CF[12])return;double alpha=(1/(110*CF[2]/(NY-1)))/(CF[0]*CF[0]);for(int j=0;j<NY;j++)for(int e=0;e<2;e++){int id=j*NX+NX-1-e;double target[3]={CF[20]-e*CF[4]*CF[22],R[id*3+1],CF[21]-e*CF[4]*CF[23]};for(int c=0;c<3;c++){int at=(j*2+e)*3+c;double dl=(-(X[id*3+c]-target[c])-alpha*GR[at])/(I[id]+alpha);GR[at]+=dl;X[id*3+c]+=I[id]*dl;}}}
static void table(){if(!CF[13])return;for(int id=0;id<N;id++)if(I[id]&&X[id*3+2]<0){double p=-X[id*3+2];X[id*3+2]=0;double dx=X[id*3]-P[id*3],dy=X[id*3+1]-P[id*3+1],L=norm(dx,dy,0),f=min(1,CF[10]*p/max(1e-12,L));X[id*3]-=f*dx;X[id*3+1]-=f*dy;}}
static void closest(int id,int ti,double*q,double*w){double*p=vec(id),*a=vec(TR[ti][0]),*b=vec(TR[ti][1]),*c=vec(TR[ti][2]);double ab[3],ac[3],ap[3];for(int k=0;k<3;k++){ab[k]=b[k]-a[k];ac[k]=c[k]-a[k];ap[k]=p[k]-a[k];}double d00=dot3(ab,ab),d01=dot3(ab,ac),d11=dot3(ac,ac),d20=dot3(ap,ab),d21=dot3(ap,ac),den=d00*d11-d01*d01;
 if(__builtin_fabs(den)>1e-22){double v=(d11*d20-d01*d21)/den,z=(d00*d21-d01*d20)/den;if(v>=0&&z>=0&&v+z<=1){for(int k=0;k<3;k++)q[k]=a[k]+(ab[k]*v+ac[k]*z);w[0]=1-v-z;w[1]=v;w[2]=z;return;}}
 double*vs[3]={a,b,c},best=1e300;for(int e=0;e<3;e++){double*u=vs[e],*v=vs[(e+1)%3],d[3],rel[3],point[3];for(int k=0;k<3;k++){d[k]=v[k]-u[k];rel[k]=p[k]-u[k];}double t=clamp(dot3(rel,d)/max(1e-18,dot3(d,d)),0,1);for(int k=0;k<3;k++)point[k]=u[k]+d[k]*t;double d0=p[0]-point[0],d1=p[1]-point[1],d2=p[2]-point[2],ds=d0*d0+d1*d1+d2*d2;if(ds<best){best=ds;for(int k=0;k<3;k++){q[k]=point[k];w[k]=(k==e?1-t:0)+(k==(e+1)%3?t:0);}}}}
static void collision(int id,int ti,double*q,double*bw,double dist){int ids[4]={id,TR[ti][0],TR[ti][1],TR[ti][2]};double w[4]={1,-bw[0],-bw[1],-bw[2]},n[3],*p=vec(id),penetration=CF[3]*1.04-dist;if(penetration<=0)return;
 if(dist>1e-10){for(int c=0;c<3;c++)n[c]=(p[c]-q[c])/dist;}else{double ab[3],ac[3];for(int c=0;c<3;c++){ab[c]=X[ids[2]*3+c]-X[ids[1]*3+c];ac[c]=X[ids[3]*3+c]-X[ids[1]*3+c];}n[0]=ab[1]*ac[2]-ab[2]*ac[1];n[1]=ab[2]*ac[0]-ab[0]*ac[2];n[2]=ab[0]*ac[1]-ab[1]*ac[0];double l=max(1e-18,norm(n[0],n[1],n[2]));for(int c=0;c<3;c++)n[c]/=l;}
 double ew[4],sum=0;for(int k=0;k<4;k++){ew[k]=CF[13]&&X[ids[k]*3+2]<1e-7&&n[2]*w[k]<0?0:I[ids[k]];sum+=ew[k]*w[k]*w[k];}if(sum>1e-16)for(int k=0;k<4;k++)for(int c=0;c<3;c++)X[ids[k]*3+c]+=n[c]*penetration*ew[k]*w[k]/sum;
 double d[3],tan[3];for(int c=0;c<3;c++){double a=0,b=0;for(int k=0;k<4;k++){a+=X[ids[k]*3+c]*w[k];b+=P[ids[k]*3+c]*w[k];}d[c]=a-b;}double dot=dot3(d,n);for(int c=0;c<3;c++)tan[c]=d[c]-n[c]*dot;double l=norm(tan[0],tan[1],tan[2]);if(l>1e-12){double f=-min(l,CF[10]*penetration)/l;sum=0;for(int k=0;k<4;k++)sum+=I[ids[k]]*w[k]*w[k];if(sum<1e-16)return;for(int k=0;k<4;k++)for(int c=0;c<3;c++)X[ids[k]*3+c]+=(tan[c]*f)*I[ids[k]]*w[k]/sum;}}
static u32 hashI(int x,int y,int z){return (((u32)x*73856093u)^((u32)y*19349663u)^((u32)z*83492791u))&(HASH-1);}
static int bucket(int x,int y,int z,int add){u32 h=hashI(x,y,z);for(int k=0;k<HASH;k++,h=(h+1)&(HASH-1)){if(!HUSED[h]){if(!add)return -1;HUSED[h]=1;HX[h]=x;HY[h]=y;HZ[h]=z;HFIRST[h]=HLAST[h]=-1;return h;}if(HX[h]==x&&HY[h]==y&&HZ[h]==z)return h;}CF[30]=1;return -1;}
static void self_contact(){PC=0;MC=0;for(int i=0;i<HASH;i++)HUSED[i]=0;double h=CF[3]*1.04,size=max(.004,CF[5]);for(int ti=0;ti<NT;ti++){int lo[3],hi[3];for(int c=0;c<3;c++){double v0=X[TR[ti][0]*3+c],v1=X[TR[ti][1]*3+c],v2=X[TR[ti][2]*3+c];lo[c]=(int)__builtin_floor((min(v0,min(v1,v2))-h)/size);hi[c]=(int)__builtin_floor((max(v0,max(v1,v2))+h)/size);}
  for(int z=lo[2];z<=hi[2];z++)for(int y=lo[1];y<=hi[1];y++)for(int x=lo[0];x<=hi[0];x++){if(MC>=MEMBERS){CF[30]=2;return;}int b=bucket(x,y,z,1);if(b<0)return;MT[MC]=ti;MN[MC]=-1;if(HLAST[b]>=0)MN[HLAST[b]]=MC;else HFIRST[b]=MC;HLAST[b]=MC++;}}
 CF[25]=0;CF[26]=0;for(int id=0;id<N;id++){int kx=(int)__builtin_floor(X[id*3]/size),ky=(int)__builtin_floor(X[id*3+1]/size),kz=(int)__builtin_floor(X[id*3+2]/size),b=bucket(kx,ky,kz,0);if(b<0)continue;int ci=id%NX,cj=id/NX;for(int m=HFIRST[b];m>=0;m=MN[m]){int ti=MT[m],skip=0,allpin=!I[id];for(int k=0;k<3;k++){int a=TR[ti][k];if(absI(a%NX-ci)<=1&&absI(a/NX-cj)<=1)skip=1;if(I[a])allpin=0;}if(skip||allpin)continue;CF[26]++;double q[3],w[3];closest(id,ti,q,w);double*p=vec(id),dist=norm(p[0]-q[0],p[1]-q[1],p[2]-q[2]);if(dist<h*1.25){if(PC>=MAXPAIRS){CF[30]=3;return;}PA[PC]=id;PT[PC++]=ti;}if(dist>=h)continue;collision(id,ti,q,w,dist);CF[25]++;}}
 CF[24]+=CF[25];CF[27]=max(CF[27],CF[25]);CF[28]=PC;CF[29]=MC;}
static void project_contacts(){double h=CF[3]*1.04;for(int k=0;k<PC;k++){int id=PA[k],ti=PT[k];double q[3],w[3];closest(id,ti,q,w);double*p=vec(id),l=norm(p[0]-q[0],p[1]-q[1],p[2]-q[2]);if(l<h){collision(id,ti,q,w,l);CF[24]++;}}}
void step(){double h=CF[0];for(int i=0;i<N*3;i++)P[i]=X[i];CF[14]+=clamp(CF[6]-CF[14],-h*.45,h*.45);CF[15]+=h;CF[16]++;double damp=exp(-h*CF[9]);for(int id=0;id<N;id++)if(I[id])for(int c=0;c<3;c++){double acc=c==2?-CF[7]+CF[8]*.06:0;V[id*3+c]=(V[id*3+c]+acc*h)*damp;X[id*3+c]+=V[id*3+c]*h;}
 double a=CF[14]*3.141592653589793;CF[22]=cos(a);CF[23]=sin(a);CF[20]=.004+(CF[1]*.5-.004)*CF[22];CF[21]=CF[1]*.5*CF[23]+CF[3]*.55*(1-CF[22]);
 for(int i=0;i<LC;i++)LI[i][4]=0;for(int r=0;r<RC;r++)for(int k=0;k<CN[r];k++)for(int c=0;c<3;c++)CL[r][k][c]=0;for(int k=0;k<GN;k++)GU[k][6]=0;for(int k=0;k<NY*6;k++)GR[k]=0;
 for(int pass=0;pass<12;pass++){fixture();for(int ii=0;ii<LC;ii++){int k=pass&1?LC-1-ii:ii;if(LI[k][5]==1)distance_link(k);}for(int ii=0;ii<RC;ii++)chain(pass&1?RC-1-ii:ii);for(int ii=0;ii<RC;ii++)curvature(pass&1?RC-1-ii:ii);for(int r=0;r<RC;r++)chain(r);for(int k=0;k<GN;k++)guard(pass&1?GN-1-k:k);table();}
 if(CF[11])self_contact();else {PC=0;CF[25]=CF[26]=0;}for(int pass=0;pass<16;pass++){for(int r=0;r<RC;r++)chain(r);for(int k=0;k<GN;k++)guard(pass&1?GN-1-k:k);project_contacts();table();}
 for(int i=0;i<N*3;i++)V[i]=(X[i]-P[i])/h;
}
