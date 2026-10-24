// Original R15 body csNoise and csHeight; original masks are checked offline.
// csThin=csT=csLip=lpMask=fA.x=eaM=0, csCover=1 for these body states.
vec3 sourceEB1(vec3 normal,vec3 view,float roughness,float oil,vec3 albedo);
uniform mat3 sourceNormalToView;
uniform float sourceSpecularF90;
uniform vec2 sourceMicro;
uniform vec4 sourceOptics;
float csHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float csNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(csHash(i),csHash(i+vec3(1,0,0)),f.x),mix(csHash(i+vec3(0,1,0)),csHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(csHash(i+vec3(0,0,1)),csHash(i+vec3(1,0,1)),f.x),mix(csHash(i+vec3(0,1,1)),csHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float sourceHeight(vec3 rest,float dry){
 float csPores=csNoise(rest*1650.)-.5,csFine=csNoise(rest*4900.+vec3(11.7))-.5;
 float csMeso=csNoise(rest*370.+vec3(4.3))-.5;
 float csSurface=(csPores*.000015+csFine*.0000025+csMeso*.000020)*(1.+dry*.45)*(0.7+sourceMicro.y*.45);
 return csSurface*sourceMicro.x;
}
float sourceRoughness(float dry){float sdDryness=clamp((1.-sourceOptics.y)*.7+sourceOptics.z*.6+dry*.28,0.,1.);float sdOil=clamp(sourceOptics.x*.28+sourceOptics.w*.58,0.,1.);return clamp(.56+sdDryness*.105-sdOil*.19,.33,.84);}
vec3 sourceReliefNormal(vec3 p,vec3 n,float height){vec3 dx=dFdx(p),dy=dFdy(p),r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);if(abs(det)>1e-14)n=normalize(abs(det)*n-sign(det)*(dFdx(height)*r1+dFdy(height)*r2));return n;}
// Frozen original GGX functions. Inspection lights remain explicitly separate
// from the original scene/environment, diffusion and shadow pipeline.
float pow2( const in float x ) { return x*x; }
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
 float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
 return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
 float a2 = pow2( alpha );
 float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
 float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
 return 0.5 / max( gv + gl, 1e-6 );
}
float D_GGX( const in float alpha, const in float dotNH ) {
 float a2 = pow2( alpha );
 float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
 return 0.3183098861837907 * a2 / pow2( denom );
}
vec3 sourceGGX(vec3 lightDir,vec3 viewDir,vec3 normal,float roughness){float alpha=pow2(roughness);vec3 halfDir=normalize(lightDir+viewDir);float dotNL=clamp(dot(normal,lightDir),0.,1.),dotNV=clamp(dot(normal,viewDir),0.,1.),dotNH=clamp(dot(normal,halfDir),0.,1.),dotVH=clamp(dot(viewDir,halfDir),0.,1.);return F_Schlick(vec3(.028),sourceSpecularF90,dotVH)*(V_GGX_SmithCorrelated(alpha,dotNL,dotNV)*D_GGX(alpha,dotNH));}
vec3 sourceInspectDerivatives(vec3 p,vec3 n,vec3 rest,float dry,float palm,vec3 rd,int mode,vec3 dx,vec3 dy,vec3 nx,vec3 ny,float hx,float hy){
 if(mode==2)return n*.5+.5;
 vec3 albedo=sourceBodyAlbedo(palm);if(mode==5)return sourceToSRGB(albedo);
 if(mode==9)return vec3(sourceRoughness(dry));
 vec3 geometricNormal=n;if(mode==1||mode==12){vec3 r1=cross(dy,n),r2=cross(n,dx);float det=dot(dx,r1);if(abs(det)>1e-14)n=normalize(abs(det)*n-sign(det)*(hx*r1+hy*r2));}
 if(mode==12){vec3 dxy=max(abs(sourceNormalToView*nx),abs(sourceNormalToView*ny));float rough=min(max(sourceRoughness(dry),.0525)+max(max(dxy.x,dxy.y),dxy.z),1.);float oil=clamp(sourceOptics.x*.28+sourceOptics.w*.58,0.,1.);return sourceEB1(n,-rd,rough,oil,albedo);}
 vec3 key=normalize(vec3(-.5,.65,1.)),rim=normalize(vec3(.7,.25,-1.)),view=-rd;
 float diffuse=max(0.,dot(n,key)),edge=pow(1.-max(0.,dot(n,view)),4.),shine=pow(max(0.,dot(n,normalize(key+view))),45.);
 vec3 colour=(mode==1?albedo:vec3(.62,.66,.61))*(.36+.61*diffuse+.18*max(0.,dot(n,rim)))+vec3(.10)*shine+vec3(.06,.07,.055)*edge;
 if(mode==1){vec3 dxy=max(abs(nx),abs(ny));float rough=min(max(sourceRoughness(dry),.0525)+max(max(dxy.x,dxy.y),dxy.z),1.);float oil=clamp(sourceOptics.x*.28+sourceOptics.w*.58,0.,1.),lobe=.06+oil*.25;vec3 specular=mix(sourceGGX(key,view,n,rough),sourceGGX(key,view,n,max(.25,rough*.62)),lobe);colour=albedo*(.36+.61*diffuse+.18*max(0.,dot(n,rim)))+specular*(diffuse*.61*3.141592653589793);return sourceToSRGB(colour);}
 return pow(max(colour,vec3(0.)),vec3(1./2.2));
}

vec3 sourceInspect(vec3 p,vec3 n,vec3 rest,float dry,float palm,vec3 rd,int mode){float h=sourceHeight(rest,dry);return sourceInspectDerivatives(p,n,rest,dry,palm,rd,mode,dFdx(p),dFdy(p),dFdx(n),dFdy(n),dFdx(h),dFdy(h));}
