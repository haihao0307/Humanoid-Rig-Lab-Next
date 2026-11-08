export const MATERIAL_GGX_GLSL=`float skinGGX(float nh,float nv,float nl,float rough){float a=max(.035,rough*rough),a2=a*a,D=a2/(3.14159265*pow(nh*nh*(a2-1.)+1.,2.)),k=pow(rough+1.,2.)/8.,G=nv/(nv*(1.-k)+k)*nl/(nl*(1.-k)+k);return D*G/max(4.*nl*nv,.001);}
`;
