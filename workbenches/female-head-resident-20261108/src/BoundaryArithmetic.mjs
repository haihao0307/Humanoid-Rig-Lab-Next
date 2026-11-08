// Error terms are reconstructed from integer mantissas. This prevents a GPU
// fast-math optimizer from cancelling the very residual used by a predicate.
export const BOUNDARY_ARITHMETIC_GLSL=`
uniform uint u_bdRoundMask;
float bdRound(float value){return uintBitsToFloat(floatBitsToUint(value)^u_bdRoundMask);}
void bdSum(float a,float b,out float high,out float low){
 high=bdRound(a+b);uint ua=floatBitsToUint(a),ub=floatBitsToUint(b);int ea=int((ua>>23u)&255u),eb=int((ub>>23u)&255u);
 if((ua&0x7fffffffu)==0u||(ub&0x7fffffffu)==0u){low=0.;return;}
 if(ea<eb||(ea==eb&&(ua&0x7fffffffu)<(ub&0x7fffffffu))){uint v=ua;ua=ub;ub=v;int e=ea;ea=eb;eb=e;}
 int shift=ea-eb;if(shift>31){low=uintBitsToFloat(ub);return;}
 uint ma=(ua&0x7fffffu)|0x800000u,mb=(ub&0x7fffffu)|0x800000u,al=ma<<uint(shift),ah=shift==0?0u:ma>>uint(32-shift);
 bool subtract=((ua^ub)&0x80000000u)!=0u;
 if(subtract){uint before=al;al-=mb;ah-=before<mb?1u:0u;}else{uint before=al;al+=mb;ah+=al<before?1u:0u;}
 uint us=floatBitsToUint(high),ms=(us&0x7fffffu)|0x800000u;int s=int((us>>23u)&255u)-eb;
 if((us&0x7fffffffu)==0u||s<=0){low=0.;return;}
 uint sl=s==32?0u:ms<<uint(s),sh=s==32?ms:ms>>uint(32-s);bool above=sh>ah||(sh==ah&&sl>al);uint difference=above?sl-al:al-sl;
 float signValue=(ua&0x80000000u)!=0u?-1.:1.;low=(above?-signValue:signValue)*float(difference)*exp2(float(eb-150));
}
void bdProduct(float a,float b,out float high,out float low){
 high=bdRound(a*b);uint ua=floatBitsToUint(a),ub=floatBitsToUint(b),up=floatBitsToUint(high);
 if((ua&0x7fffffffu)==0u||(ub&0x7fffffffu)==0u){low=0.;return;}
 int ea=int((ua>>23u)&255u),eb=int((ub>>23u)&255u),ep=int((up>>23u)&255u),shift=ep-ea-eb+150;
 uint ma=(ua&0x7fffffu)|0x800000u,mb=(ub&0x7fffffu)|0x800000u,mp=(up&0x7fffffu)|0x800000u,ph,pl;uint a0=ma&65535u,a1=ma>>16u,b0=mb&65535u,b1=mb>>16u,middle=a1*b0+a0*b1,base=a0*b0;pl=base+(middle<<16u);ph=a1*b1+(middle>>16u)+(pl<base?1u:0u);
 uint rh=mp>>uint(32-shift),rl=mp<<uint(shift);bool above=rh>ph||(rh==ph&&rl>pl);uint difference=above?rl-pl:pl-rl;
 float signValue=((ua^ub)&0x80000000u)!=0u?-1.:1.;low=(above?-signValue:signValue)*float(difference)*exp2(float(ea+eb-300));
}
vec2 bdSumDS(vec2 a,vec2 b){float s,e,h,l;bdSum(a.x,b.x,s,e);e+=a.y+b.y;bdSum(s,e,h,l);return vec2(h,l);}
vec2 bdProductDS(vec2 a,vec2 b){float p,e,h,l;bdProduct(a.x,b.x,p,e);e+=a.x*b.y+a.y*b.x+a.y*b.y;bdSum(p,e,h,l);return vec2(h,l);}
`;
