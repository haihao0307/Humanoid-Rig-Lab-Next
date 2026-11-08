// Visibility estimated from the current function-derived first-hit positions.
// This shades the eye receiver only; it never modifies or masks anatomy.
// Off-screen/hidden occluders are unavailable: this is not full ray-traced GI.
export const SOURCE_VISIBILITY_GLSL=`
uniform float u_sceneContact,u_sceneTanFov;
float eyeContactVisibility(ivec2 pixel,vec3 point,vec3 normal,float pixelMM){
 if(u_sceneContact<=0.)return 1.;ivec2 size=textureSize(u_position,0);float blocked=0.;
 for(int direction=0;direction<8;direction++){float angle=(float(direction)+.5)*.7853981634,horizon=0.;vec2 axis=vec2(cos(angle),sin(angle));
  for(int ring=0;ring<4;ring++){float radius=ring==0?.35:ring==1?.8:ring==2?1.6:3.2;ivec2 at=pixel+ivec2(round(axis*max(1.,radius/max(pixelMM,.001))));if(any(lessThan(at,ivec2(0)))||any(greaterThanEqual(at,size)))continue;vec4 neighbour=texelFetch(u_position,at,0);if(neighbour.a<.5||neighbour.a>1.5)continue;vec3 delta=neighbour.xyz-point;float d=length(delta);if(d<.04||d>6.4)continue;float elevation=max(0.,dot(normal,delta)/d-.04)*exp(-d*d/24.);horizon=max(horizon,elevation);
  }blocked+=horizon*horizon;
 }return clamp(1.-u_sceneContact*blocked*.1875,.12,1.);
}
float eyeDirectionalVisibility(vec3 point,vec3 normal,vec3 light,float pixelMM){
 if(u_sceneContact<=0.||dot(normal,light)<=0.)return 1.;ivec2 size=textureSize(u_position,0);float bias=max(.045,pixelMM*.3),visibility=1.;
 for(int i=0;i<12;i++){float t=.15*exp2(float(i)*.54);vec3 at=point+light*t,view=at-u_eye;float z=dot(view,u_forward);if(z<=0.)continue;vec2 ndc=vec2(dot(view,u_right)/(z*u_sceneTanFov*float(size.x)/float(size.y)),dot(view,u_up)/(z*u_sceneTanFov)),uv=ndc*.5+.5;if(any(lessThan(uv,vec2(0)))||any(greaterThanEqual(uv,vec2(1))))continue;vec4 neighbour=texelFetch(u_position,ivec2(uv*vec2(size)),0);if(neighbour.a<.5||neighbour.a>1.5)continue;float depth=dot(at-neighbour.xyz,u_forward);if(depth>bias&&depth<3.2&&length(neighbour.xyz-point)<12.){visibility=min(visibility,1.-u_sceneContact*smoothstep(bias,bias+max(.08,pixelMM),depth));}
 }return visibility;
}
`;
