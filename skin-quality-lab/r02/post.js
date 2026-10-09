const blurFragment=`precision highp float;
 varying vec2 vUv;uniform sampler2D tColor,tDepth,tAlbedo;uniform vec2 direction;
 uniform float radius,projectionScale,nearPlane,farPlane,firstPass;uniform vec4 kernel[25];
 float vz(float d){return nearPlane*farPlane/(farPlane-d*(farPlane-nearPlane));}
 vec3 splitColor(vec2 p){vec3 c=texture2D(tColor,p).rgb;if(firstPass>.5)c/=sqrt(max(texture2D(tAlbedo,p).rgb,vec3(.025)));return c;}
 void main(){vec4 center=texture2D(tColor,vUv);if(center.a<.5){gl_FragColor=center;return;}
 vec3 albedo=texture2D(tAlbedo,vUv).rgb;float z=vz(texture2D(tDepth,vUv).r);float absorb=mix(.62,1.,smoothstep(.04,.45,dot(albedo,vec3(.2126,.7152,.0722))));float pixels=clamp(radius*.001*projectionScale/z*absorb,.1,35.);
 vec3 middle=splitColor(vUv),sum=middle*kernel[0].rgb;
 for(int i=1;i<25;i++){vec2 p=vUv+direction*pixels*kernel[i].w;float nz=vz(texture2D(tDepth,p).r);float visible=step(.5,texture2D(tColor,p).a);float distance=abs(nz-z);float sameSurface=exp(-distance/max(.0004,radius*.0015))*visible;sum+=mix(middle,splitColor(p),sameSurface)*kernel[i].rgb;}
 gl_FragColor=vec4(sum,center.a);
}`;
const composeFragment=`precision highp float;varying vec2 vUv;uniform sampler2D tFull,tDiffuse,tBlur,tAlbedo;uniform float strength,exposure,mode;
 vec3 srgb(vec3 c){return mix(12.92*c,1.055*pow(max(c,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
 vec3 film(vec3 x){x=max(x,vec3(0.));return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
 void main(){vec4 f=texture2D(tFull,vUv);vec3 d=texture2D(tDiffuse,vUv).rgb,b=texture2D(tBlur,vUv).rgb;b*=sqrt(max(texture2D(tAlbedo,vUv).rgb,vec3(.025)));vec3 diff=mix(d,b,strength);vec3 c=max(vec3(0.),f.rgb+diff-d);if(mode>3.5&&mode<4.5)c=max(vec3(0.),f.rgb-d);if(mode>4.5)c=diff;vec2 p=(vUv-.5)*vec2(1.2,1.);float halo=exp(-dot(p,p)*4.5);vec3 bg=mix(vec3(.008,.0095,.013),vec3(.026,.03,.038),halo);if(mode>.5&&mode<3.5){gl_FragColor=vec4(mix(srgb(bg),mode>1.5&&mode<2.5?f.rgb:srgb(max(f.rgb,0.)),f.a),1.);}else{gl_FragColor=vec4(srgb(film(mix(bg,c,f.a)*exposure)),1.);}}
`;
