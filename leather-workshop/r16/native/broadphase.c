/* R10 double-precision pooled native spatial-hash broadphase, no change to the narrow phase.
   Surface thickness and swept AABBs exactly match the R09 reference. The output
   is exhaustive or explicitly fails capacity; no budget silently drops a pair. */
static int BN,BF,BE,BCAP,BSTRIDE;
static unsigned int *GKEY,*GTAG;static int *GHEAD,*GTAIL,*GITEM,*GNEXT,*GSEEN;
static int GSLOTS,GENTRIES,GCOUNT,GQUERY;static unsigned int GEPOCH;
static double *BA,*BB,*BTRI,*BEDGE,*BPART,*BTHICK,*BFHALF,*BEHALF,*BFBOX,*BEBOX;
static unsigned int *BADJ,*BHIT;
static int *BFTREE,*BETREE,*BSTACK;
typedef struct {int x,y,z,id;} OrderKey;
static OrderKey *BORDER;static void *BSEC[14];
__attribute__((visibility("default"))) int bp_layout(int n,int f,int e,int capacity){
 BN=n;BF=f;BE=e;BCAP=capacity;BSTRIDE=(n+31)/32;unsigned int p=((unsigned int)&__heap_base+7u)&~7u;
 #define BD(name,idx,size) name=(double*)p;BSEC[idx]=(void*)p;p+=8*(size)
 #define BI(name,idx,size,typ) name=(typ*)p;BSEC[idx]=(void*)p;p+=4*(size);p=(p+7u)&~7u
 BD(BA,0,3*n);BD(BB,1,3*n);BD(BTRI,2,3*f);BD(BEDGE,3,2*e);BD(BPART,4,n);
 BI(BADJ,5,n*BSTRIDE,unsigned int);BI(BFTREE,6,6*f,int);BI(BETREE,7,6*e,int);
 BD(BFBOX,8,12*f);BD(BEBOX,9,12*e);BD(BTHICK,10,n);BD(BFHALF,11,f);BD(BEHALF,12,e);
 BI(BHIT,13,3*capacity,unsigned int);BSTACK=(int*)p;p+=4*2*(f>e?f:e);BORDER=(OrderKey*)p;p+=sizeof(OrderKey)*(f>e?f:e);
 #undef BD
 #undef BI
 GSLOTS=65536;GENTRIES=capacity*4;
 GKEY=(unsigned int*)p;p+=4*GSLOTS;GTAG=(unsigned int*)p;p+=4*GSLOTS;GHEAD=(int*)p;p+=4*GSLOTS;GTAIL=(int*)p;p+=4*GSLOTS;
 GITEM=(int*)p;p+=4*GENTRIES;GNEXT=(int*)p;p+=4*GENTRIES;GSEEN=(int*)p;p+=4*(f>e?f:e);
 if(p>120000000u)return 0;unsigned int available=__builtin_wasm_memory_size(0)*65536u;
 if(p>available&&__builtin_wasm_memory_grow(0,(p-available+65535u)/65536u)==(unsigned int)-1)return 0;return 1;
}
__attribute__((visibility("default"))) void *bp_section(int i){return BSEC[i];}
static int b_overlap(double *a,double *b){return a[0]<=b[3]&&a[3]>=b[0]&&a[1]<=b[4]&&a[4]>=b[1]&&a[2]<=b[5]&&a[5]>=b[2];}
static int b_adj(int i,int j){return i==j||((BADJ[i*BSTRIDE+(j>>5)]>>(j&31))&1u);}
static void b_bounds(double *box,double *ids,int count,double pad){
 for(int k=0;k<3;k++){double lo=__builtin_inf(),hi=-__builtin_inf();for(int j=0;j<count;j++){int q=3*(int)ids[j]+k;lo=min(lo,min(BA[q],BB[q]));hi=max(hi,max(BA[q],BB[q]));}box[k]=lo-pad;box[3+k]=hi+pad;}
}
static void b_refit(int count,int *tree,double *boxes,double *ids,int arity,double *half,double pad){
 for(int i=2*count-2;i>=0;i--){double *box=boxes+6*i;int leaf=tree[3*i+2];if(leaf>=0)b_bounds(box,ids+arity*leaf,arity,half[leaf]+pad);else{double *a=boxes+6*tree[3*i],*b=boxes+6*tree[3*i+1];for(int k=0;k<3;k++){box[k]=min(a[k],b[k]);box[k+3]=max(a[k+3],b[k+3]);}}}
}
/* Preserve the original hash bucket traversal order as well as its candidate
   set: the bounded nonlinear optimizer is sensitive to floating sum order. */

static unsigned int gkey(int x,int y,int z){return ((unsigned int)x*73856093u)^((unsigned int)y*19349663u)^((unsigned int)z*83492791u);}
static int gslot(unsigned int key,int create){unsigned int mixed=key;mixed^=mixed>>16;mixed*=0x7feb352du;mixed^=mixed>>15;int i=(int)(mixed&(GSLOTS-1)),start=i;while(GTAG[i]==GEPOCH){if(GKEY[i]==key)return i;i=(i+1)&(GSLOTS-1);if(i==start)return create?-2:-1;}if(!create)return -1;GTAG[i]=GEPOCH;GKEY[i]=key;GHEAD[i]=GTAIL[i]=-1;return i;}
static int ginsert(double *b,double cell,int item){int lo[3],hi[3];for(int k=0;k<3;k++){lo[k]=(int)__builtin_floor(b[k]/cell);hi[k]=(int)__builtin_floor(b[k+3]/cell);}if((double)(hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>500000)return -3;
 for(int x=lo[0];x<=hi[0];x++)for(int y=lo[1];y<=hi[1];y++)for(int z=lo[2];z<=hi[2];z++){if(GCOUNT>=GENTRIES)return -2;int s=gslot(gkey(x,y,z),1);if(s<0)return s;int j=GCOUNT++;GITEM[j]=item;GNEXT[j]=-1;if(GTAIL[s]<0)GHEAD[s]=j;else GNEXT[GTAIL[s]]=j;GTAIL[s]=j;}return 0;}
static int gquery(double *box,double cell,int id,int ispt,int out){int lo[3],hi[3];for(int k=0;k<3;k++){lo[k]=(int)__builtin_floor(box[k]/cell);hi[k]=(int)__builtin_floor(box[k+3]/cell);}if((double)(hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)*(hi[2]-lo[2]+1)>500000)return -3;GQUERY++;
 for(int x=lo[0];x<=hi[0];x++)for(int y=lo[1];y<=hi[1];y++)for(int z=lo[2];z<=hi[2];z++){int slot=gslot(gkey(x,y,z),0);if(slot<0)continue;for(int entry=GHEAD[slot];entry>=0;entry=GNEXT[entry]){int j=GITEM[entry];if(GSEEN[j]==GQUERY)continue;GSEEN[j]=GQUERY;double *other=(ispt?BFBOX:BEBOX)+6*j;if(!b_overlap(box,other))continue;
  int skip=0;if(ispt){double *t=BTRI+3*j;int same=BPART[id]==BPART[(int)t[0]];for(int k=0;k<3;k++)if(id==(int)t[k]||(same&&b_adj(id,(int)t[k]))){skip=1;break;}}
  else{int a=(int)BEDGE[2*id],b=(int)BEDGE[2*id+1],c=(int)BEDGE[2*j],d=(int)BEDGE[2*j+1],same=BPART[a]==BPART[c];skip=a==c||a==d||b==c||b==d||(same&&(b_adj(a,c)||b_adj(a,d)||b_adj(b,c)||b_adj(b,d)));}if(skip)continue;
  if(out>=BCAP)return -1;BHIT[3*out]=ispt;BHIT[3*out+1]=id;BHIT[3*out+2]=j;out++;
 }}return out;
}
__attribute__((visibility("default"))) int bp_candidates(double pad,double cell){
 GEPOCH++;GCOUNT=0;GQUERY=0;for(int i=0;i<(BF>BE?BF:BE);i++)GSEEN[i]=0;
 for(int f=0;f<BF;f++){b_bounds(BFBOX+6*f,BTRI+3*f,3,BFHALF[f]+pad);int s=ginsert(BFBOX+6*f,cell,f);if(s<0)return s;}
 int out=0;for(int v=0;v<BN;v++){double id=v,box[6];b_bounds(box,&id,1,BTHICK[v]+pad);out=gquery(box,cell,v,1,out);if(out<0)return out;}
 GEPOCH++;GCOUNT=0;
 for(int e=0;e<BE;e++){double *box=BEBOX+6*e;b_bounds(box,BEDGE+2*e,2,BEHALF[e]+pad);out=gquery(box,cell,e,0,out);if(out<0)return out;int s=ginsert(box,cell,e);if(s<0)return s;}
 return out;
}
