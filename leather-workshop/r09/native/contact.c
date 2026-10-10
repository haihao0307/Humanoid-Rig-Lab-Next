/* R09 freestanding contact narrow phase. Double precision; no external library.
   Same equations and tolerances as contact.mjs reference. No simulation state
   or response is hidden in this helper. Conservative advancement never accepts
   an unconverged iteration cap as collision-free. */
typedef struct { double x,y,z; } V;
typedef struct { double w[4],d; V n; } Q;
static double input[24],output[16];
static V add(V a,V b){return(V){a.x+b.x,a.y+b.y,a.z+b.z};}
static V sub(V a,V b){return(V){a.x-b.x,a.y-b.y,a.z-b.z};}
static V mul(V a,double b){return(V){a.x*b,a.y*b,a.z*b};}
static double dot(V a,V b){return a.x*b.x+a.y*b.y+a.z*b.z;}
static V cross(V a,V b){return(V){a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};}
static double norm(V a){return __builtin_sqrt(dot(a,a));}
static double min(double a,double b){return a<b?a:b;}
static double max(double a,double b){return a>b?a:b;}
static double clamp(double x){return min(1,max(0,x));}
static double abs(double a){return a<0?-a:a;}
static Q result(V *p,double w0,double w1,double w2,double w3,V fallback){
 Q q={{w0,w1,w2,w3},0,{0,0,0}};V n={0,0,0};for(int i=0;i<4;i++)n=add(n,mul(p[i],q.w[i]));q.d=norm(n);q.n=q.d>1e-13?mul(n,1/q.d):fallback;return q;
}
static Q pt(V *p){
 V ab=sub(p[2],p[1]),ac=sub(p[3],p[1]),ap=sub(p[0],p[1]);double d1=dot(ab,ap),d2=dot(ac,ap);
 V bp=sub(p[0],p[2]),cp=sub(p[0],p[3]);double d3=dot(ab,bp),d4=dot(ac,bp),d5=dot(ab,cp),d6=dot(ac,cp);
 double s=0,t=0,vc=d1*d4-d3*d2,vb=d5*d2-d1*d6,va=d3*d6-d5*d4;
 if(d1<=0&&d2<=0){}
 else if(d3>=0&&d4<=d3)s=1;
 else if(vc<=0&&d1>=0&&d3<=0)s=d1/(d1-d3);
 else if(d6>=0&&d5<=d6)t=1;
 else if(vb<=0&&d2>=0&&d6<=0)t=d2/(d2-d6);
 else if(va<=0&&d4-d3>=0&&d5-d6>=0){t=(d4-d3)/((d4-d3)+(d5-d6));s=1-t;}
 else{double den=va+vb+vc;if(abs(den)<1e-28){Q best;best.d=1e30;for(int i=1;i<=3;i++){int j=i==3?1:i+1;V e=sub(p[j],p[i]);double f=clamp(dot(sub(p[0],p[i]),e)/max(1e-28,dot(e,e)));double w[4]={1,0,0,0};w[i]=f-1;w[j]=-f;Q q=result(p,w[0],w[1],w[2],w[3],(V){0,1,0});if(q.d<best.d)best=q;}return best;}s=vb/den;t=vc/den;}
 V n=cross(ab,ac);double L=norm(n);return result(p,1,s+t-1,-s,-t,L>1e-16?mul(n,1/L):(V){0,1,0});
}
static Q ee(V *p){
 V d1=sub(p[1],p[0]),d2=sub(p[3],p[2]),r=sub(p[0],p[2]);double a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r),s=0,t=0;
 if(a<1e-24&&e<1e-24){}
 else if(a<1e-24)t=clamp(f/e);
 else{double c=dot(d1,r);if(e<1e-24)s=clamp(-c/a);else{double b=dot(d1,d2),den=a*e-b*b;s=den>1e-24?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 V n=cross(d1,d2);double L=norm(n);return result(p,1-s,s,t-1,-t,L>1e-16?mul(n,1/L):(V){0,1,0});
}
static int separate(V *p,V *q,V n,double gap,int ispt){
 for(int a=0;a<(ispt?1:2);a++)for(int b=ispt?1:2;b<4;b++)if(dot(sub(p[a],p[b]),n)<gap+1e-10||dot(sub(q[a],q[b]),n)<gap+1e-10)return 0;return 1;
}
static void store(Q q,double t,int cap){output[0]=q.d;for(int i=0;i<4;i++)output[i+1]=q.w[i];output[5]=q.n.x;output[6]=q.n.y;output[7]=q.n.z;output[8]=t;output[9]=cap;}
__attribute__((visibility("default"))) double *inptr(){return input;}
__attribute__((visibility("default"))) double *outptr(){return output;}
__attribute__((visibility("default"))) void closest(int ispt){V p[4];for(int i=0;i<4;i++)p[i]=(V){input[3*i],input[3*i+1],input[3*i+2]};store(ispt?pt(p):ee(p),0,0);}
__attribute__((visibility("default"))) int swept(double gap,int ispt){
 V a[4],b[4],delta[4],p[4];for(int i=0;i<4;i++){a[i]=(V){input[3*i],input[3*i+1],input[3*i+2]};b[i]=(V){input[12+3*i],input[13+3*i],input[14+3*i]};delta[i]=sub(b[i],a[i]);}
 Q q0=ispt?pt(a):ee(a),q1=ispt?pt(b):ee(b);
 if(separate(a,b,q0.n,gap,ispt)||separate(a,b,q1.n,gap,ispt))return 0;
 double bound=0;for(int i=0;i<(ispt?1:2);i++)for(int j=ispt?1:2;j<4;j++)bound=max(bound,norm(sub(delta[i],delta[j])));
 if(bound<1e-13){if(q0.d<gap){store(q0,0,0);return 1;}return 0;}
 double t=0;Q q=q0;
 for(int i=0;i<96;i++){if(q.d<=gap+1e-9){store(q,t,0);return 1;}double step=.9*(q.d-gap)/bound;if(t+step>=1)return 0;if(step<1e-10){store(q,t,0);return 1;}t+=step;for(int j=0;j<4;j++)p[j]=add(a[j],mul(delta[j],t));q=ispt?pt(p):ee(p);}
 store(q,t,1);return 1;
}
