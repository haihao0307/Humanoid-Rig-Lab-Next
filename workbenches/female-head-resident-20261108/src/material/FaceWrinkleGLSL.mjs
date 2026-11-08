import{FACE_WRINKLE_MICRO_GLSL}from'./FaceWrinkleMicroFunctions.mjs';
export const FACE_WRINKLE_GLSL=`
${FACE_WRINKLE_MICRO_GLSL}
uniform vec4 u_fwA[96],u_fwB[96],u_fwC[96],u_fwD[96],u_fwE[96];uniform int u_fwCount,u_fwView;
float fwProtection(vec3 p,float lip,float ear,vec2 lid){return smoothstep(72.,96.,p.z)*(1.-smoothstep(.01,.12,lip))*(1.-smoothstep(.01,.08,ear))*mix(1.,smoothstep(.0009,.0026,abs(lid.x)),clamp(lid.y,0.,1.));}
float fwHash(int i,uint seed){uint a=uint(i)+seed*374761393u;a=(a^(a>>13u))*1274126177u;a=a^(a>>16u);return float(a&65535u)/65535.;}
vec2 fwNoise(float x,float scale,uint seed){float u=x/scale,t=fract(u),f=t*t*t*(t*(t*6.-15.)+10.),df=30.*t*t*(t-1.)*(t-1.)/scale;int i=int(floor(u));float a=fwHash(i,seed),b=fwHash(i+1,seed);return vec2(a+(b-a)*f,(b-a)*df);}
vec2 fwPolynomial(vec4 d,vec4 e,float t){vec2 previous=vec2(1.,0.),current=vec2(t,1.),result=d.x*previous+d.y*current;for(int k=2;k<7;k++){vec2 next=vec2(2.*t*current.x-previous.x,2.*current.x+2.*t*current.y-previous.y);result+=(k<4?d[k]:e[k-4])*next;previous=current;current=next;}return result;}
vec3 fwProfile(float w0,float w0u,float offset,float slope,float footprint,float depth,float fade,float df,float lobe,float dl){float w=sqrt(w0*w0+.16*footprint*footprint),wu=w0*w0u/w,q=offset/w;if(abs(q)>7.)return vec3(0.);float e1=exp(-.5*q*q),e2=exp(-q*q/8.),profile=e2-2.*e1,dp=q*(2.*e1-.25*e2),ratio=w0/w,dr=(w0u*w-w0*wu)/(w*w),amp=depth*ratio*fade*lobe,da=depth*((dr*fade+ratio*df)*lobe+ratio*fade*dl);return vec3(amp*profile,da*profile+amp*dp*(-slope/w-q*wu/w),amp*dp/w);}
vec4 fwCurves(vec2 p,float footprint){
 vec4 result=vec4(0.);float best=0.;for(int i=0;i<96;i++){if(i>=u_fwCount)break;vec4 a=u_fwA[i],b=u_fwB[i],c=u_fwC[i],d=u_fwD[i],e=u_fwE[i];vec2 delta=p-a.xy;float u=dot(delta,a.zw),v=dot(delta,vec2(-a.w,a.z)),t=u/b.x;if(abs(t)>=1.)continue;
 float fade=smoothstep(0.,.35,1.-abs(t)),ft=clamp((1.-abs(t))/.35,0.,1.),df=abs(t)>.65?-6.*ft*(1.-ft)*sign(t)/(.35*b.x):0.;uint seed=uint(floor(c.z*1024.+.5));vec2 n6=fwNoise(u,6.,seed),n17=fwNoise(u,1.7,seed+17u),n7=fwNoise(u,7.,seed+31u),n12=fwNoise(u,12.,seed+53u),poly=fwPolynomial(d,e,t);float morph=min(.32,b.y*.8),fine=min(.055,b.y*.18),center=b.w*t*t+c.x*sin(c.y*t+c.z)+poly.x+morph*(n6.x-.5)+fine*(n17.x-.5),slope=2.*b.w*t/b.x+c.x*c.y/b.x*cos(c.y*t+c.z)+poly.y/b.x+morph*n6.y+fine*n17.y,wf=.72+.56*n7.x,w0=b.y*(.35+.65*fade)*wf,w0u=b.y*(.65*df*wf+(.35+.65*fade)*.56*n7.y),base=.80+.20*cos(4.1*t+c.z),growth=.4+.8*n12.x,lobe=base*growth,dl=-.82*sin(4.1*t+c.z)/b.x*growth+base*.8*n12.y;
 vec3 value=mix(fwProfile(w0,w0u,v-center,slope,footprint,b.z,fade,df,lobe,dl),fwProfile(w0*3.4,w0u*3.4,v-center,slope,footprint,b.z,fade,df,lobe,dl),e.w);result.xyz+=vec3(value.x,value.y*a.z-value.z*a.w,value.y*a.w+value.z*a.z);if(abs(value.x)>best){best=abs(value.x);result.w=c.w+1.;}
 }return result;
}
`;
export function faceWrinkleFragment(source){
 const declaration='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;',anchor='if(u_nativeMode==1)';
 if(!source.includes(declaration)||!source.includes(anchor))throw Error('皱纹材质接入位置已改变');
 return source.replace(declaration,FACE_WRINKLE_GLSL+'\n'+declaration).replace(anchor,`
 // Existing rest-coordinate chart and tissue masks remain authoritative.
 float fwFoot=max(length(dFdx(psMM)),length(dFdy(psMM)));vec4 fw=fwCurves(psMM.xy,fwFoot);fw.xyz+=fwMicro(psMM.xy,fwFoot);
 float fwMask=fwProtection(psMM,psL,psE,vLidMargin.xw);
 float fwH=fw.x*fwMask*.001;vec3 fwGrad=vec3(fw.yz,0.)*.001;
 float fwHx=dot(fwGrad,dFdx(psMM))*fwMask+fw.x*.001*dFdx(fwMask),fwHy=dot(fwGrad,dFdy(psMM))*fwMask+fw.x*.001*dFdy(fwMask);
 vec3 fwDx=dFdx(-vViewPosition),fwDy=dFdy(-vViewPosition),fwR1=cross(fwDy,normal),fwR2=cross(normal,fwDx);float fwDet=dot(fwDx,fwR1);
 vec3 fwSurfaceGradient=sign(fwDet)*(fwHx*fwR1+fwHy*fwR2)/max(abs(fwDet),1e-16);normal=normalize(normal-fwSurfaceGradient);
 #ifdef USE_CLEARCOAT
 clearcoatNormal=normalize(clearcoatNormal-fwSurfaceGradient);
 #endif
 psH+=fwH;
 if(u_fwView==1){gl_FragColor=vec4(vec3(.5)+vec3(fwH*400.),1.);return;}
 if(u_fwView==3){float hue=fw.w*.733;vec3 tint=.5+.5*cos(hue+vec3(0.,2.1,4.2));float visible=smoothstep(.00005,.0008,abs(fwH)*1000.);gl_FragColor=vec4(mix(vec3(.16),tint,visible),1.);return;}
 if(u_fwView==2){gl_FragColor=vec4(normalize(inverseTransformDirection(normal,viewMatrix))*.5+.5,1.);return;}
 `+anchor);
}
