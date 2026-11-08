// Forward analytic derivative of the fixed female shape, built with dual
// numbers. The source functions remain unchanged; this GPU implementation is
// experimental and has not certified first-hit or cross-device precision.
export function shapeForwardJacobianGLSL(shape){
 const lit=k=>Number(shape[k]).toPrecision(17);
 return `
vec4 C(float v){return vec4(v,0.,0.,0.);}
vec4 M(vec4 a,vec4 b){return vec4(a.x*b.x,a.yzw*b.x+b.yzw*a.x);}
vec4 Q(vec4 a,vec4 b){return vec4(a.x/b.x,(a.yzw*b.x-b.yzw*a.x)/(b.x*b.x));}
vec4 AbsD(vec4 x){return x.x>0.?x:x.x<0.?-x:C(0.);}
vec4 SD(vec4 x){return vec4(S(x.x),D(x.x)*x.yzw);}
vec4 WD3(vec4 x,float a,float b,float c,float d){return vec4(W(x.x,a,b,c,d),WD(x.x,a,b,c,d)*x.yzw);}
vec4 CD(vec4 x){vec2 v=cubic(x.x);return vec4(v.x,v.y*x.yzw);}
vec4 B3D(vec4 y,float c,float h){return 1.5*CD((y-C(c))/h);}
vec4 CheekD(vec4 y){vec2 v=cheek(y.x);return vec4(v.x,v.y*y.yzw);}
vec4 RailD(vec4 x,bool low){return vec4(rail(x.x,low,false),rail(x.x,low,true)*x.yzw);}
vec4 SplineD(vec4 y){return vec4(spline(y.x,false),spline(y.x,true)*y.yzw);}
void femaleForwardJacobian(vec3 p,out vec3 world,out mat3 jac){
 vec4 x=vec4(p.x,1.,0.,0.),y=vec4(p.y,0.,1.,0.),z=vec4(p.z,0.,0.,1.);
 vec4 low=RailD(x,true),up=RailD(x,false),win=M(SD((y-low+C(7.))/7.),C(1.)-SD((y-up)/8.));
 x=x+${lit('mouthWidth')}/100.*M(M(M(x,C(1.)-SD((AbsD(x)-C(26.))/18.)),win),SD((z-C(55.))/45.));
 y=y+M(M(C(1.)-SD((AbsD(x)-C(12.))/20.),SD((z-C(55.))/45.)),SplineD(y));
 vec4 nasal=M((${lit('noseBridgeWidth')}/100.)*WD3(y,269.,280.,300.,315.)+(${lit('noseAlarWidth')}/100.)*WD3(y,245.,254.,265.,278.),SD((z-C(75.))/45.));
 x=x+M(M(x,C(1.)-SD((AbsD(x)-C(18.))/20.)),nasal);
 vec4 chin=(${lit('chinWidth')}/100.)*M(WD3(y,160.,177.,198.,229.),SD((z-C(30.))/70.));
 x=x+M(M(x,C(1.)-SD((AbsD(x)-C(32.))/28.)),chin);
 y=y-${lit('chinDrop')}*M(SD((z-C(85.))/30.),WD3(y,167.,180.,192.,211.));
 vec4 gx=WD3(AbsD(x),7.,22.,39.,59.),gz=SD((z-C(60.))/40.);
 float side=x.x<0.?${lit('lowerLidNegative')}:${lit('lowerLidPositive')};
 y=y-side*M(M(gx,gz),WD3(y,282.,295.,298.,307.));
 side=x.x<0.?${lit('upperLidNegative')}:${lit('upperLidPositive')};
 y=y+side*M(M(gx,gz),WD3(y,293.,306.,311.,328.));
 vec4 cheek=CheekD(y),jaw=B3D(y,212.,28.),c=Q(cheek,C(1.)+M(cheek,jaw)),k=Q(jaw,C(1.)+M(jaw,cheek)),left=-SD((-x-C(24.))/28.),right=SD((x-C(24.))/28.),eyeY=WD3(y,286.,296.,312.,322.),eyeZ=SD((z-C(60.))/30.);
 float center=(17.36783620674898+46.190802082022465+46.03465503487199+16.170546905931328)/4.;
 vec4 eyePos=M(x-C(center),WD3(x,0.,20.,47.,72.))/18.,neg=-x,eyeNeg=-M(neg-C(center),WD3(neg,0.,20.,47.,72.))/18.,xx=x;
 xx=xx+${lit('cheekNegative')}*M(M(c,SD(z/70.)),left);
 xx=xx+${lit('cheekPositive')}*M(M(c,SD(z/70.)),right);
 xx=xx+${lit('jawNegative')}*M(M(k,SD(z/70.)),left);
 xx=xx+${lit('jawPositive')}*M(M(k,SD(z/70.)),right);
 xx=xx+${lit('eyeWidthNegative')}*M(M(eyeY,eyeZ),eyeNeg);
 xx=xx+${lit('eyeWidthPositive')}*M(M(eyeY,eyeZ),eyePos);
 vec4 delta=C(0.);for(int j=0;j<6;j++)delta=delta-(${lit('chinLength')})*CD((y-C(90.+float(j)*20.))/20.);
 vec4 yy=y+M(delta,SD((z-C(65.))/65.));
 world=vec3(xx.x,yy.x,z.x); jac=mat3(vec3(xx.y,yy.y,z.y),vec3(xx.z,yy.z,z.z),vec3(xx.w,yy.w,z.w));
}
`;
}

export function oralForwardJacobianGLSL(shape){
 let code=shapeForwardJacobianGLSL(shape);
 const start=code.indexOf(' vec4 nasal='),chinStart=code.indexOf(' vec4 chin='),chinEnd=code.indexOf(' y=y-',chinStart);
 code=code.slice(0,start)+code.slice(chinStart,chinEnd)+` world=vec3(x.x,y.x,z.x);jac=mat3(vec3(x.y,y.y,z.y),vec3(x.z,y.z,z.z),vec3(x.w,y.w,z.w));
}
`;
 return code;
}
