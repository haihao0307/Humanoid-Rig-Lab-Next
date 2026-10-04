// Analytic product studio: no photographed HDR, image assets, or scene models.
export const PRODUCT_RIG='product-softbox-fixed@1';
export const PRODUCT_DEFAULTS={displayStage:'turntable',studioRotate:true,studioSpeed:.55,studioLightAngle:35,studioKey:4.2,studioAmbient:.35,studioRim:1.5,studioExposure:1.05,studioBackground:'#24272d'};
export const KEY_DIRECTION=[-.62,.76,.32],FILL_DIRECTION=[.65,.3,.7],EDGE_DIRECTION=[.25,.58,-.78];
export const KEY_COLOR=[1,.91,.8],FILL_COLOR=[.78,.87,1],EDGE_COLOR=[.8,.9,1];
export const PRODUCT_UNIFORMS='uniform vec3 uAtlasLightDirection,uAtlasFillDirection,uAtlasEdgeDirection,uAtlasKeyColor,uAtlasFillColor,uAtlasEdgeColor;uniform float uAtlasKey,uAtlasAmbient,uAtlasExposure,uAtlasRim;';
export const PRODUCT_GLSL=`
float atlasWide(vec3 n,vec3 l){return pow(clamp((dot(n,normalize(l))+.22)/1.22,0.,1.),1.35);}
vec3 atlasDiffuse(vec3 n){return vec3(.22*uAtlasAmbient)+.92*atlasWide(n,uAtlasLightDirection)*uAtlasKey*uAtlasKeyColor+.12*atlasWide(n,uAtlasFillDirection)*uAtlasRim*uAtlasFillColor+.46*max(dot(n,normalize(uAtlasEdgeDirection)),0.)*uAtlasRim*uAtlasEdgeColor;}
vec3 atlasReflection(vec3 n,vec3 v,float rough){vec3 r=reflect(-v,n);float fres=.025+.12*pow(1.-max(dot(n,v),0.),4.);float width=mix(70.,7.,rough);return fres*(.85*pow(max(dot(r,normalize(uAtlasLightDirection)),0.),width)*uAtlasKey*uAtlasKeyColor+.45*pow(max(dot(r,normalize(uAtlasEdgeDirection)),0.),width)*uAtlasRim*uAtlasEdgeColor);}
vec3 atlasTone(vec3 c){c=max(c,vec3(0.));vec3 film=clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);return mix(c/(vec3(1.)+c),film,.45);}
`;
const environments=new WeakMap();
export function productEnvironment(T,renderer){
 let cached=environments.get(renderer);if(cached)return cached;
 const width=128,height=64,data=new Float32Array(width*height*4);
 const directions=[KEY_DIRECTION,FILL_DIRECTION,EDGE_DIRECTION].map(v=>new T.Vector3(...v).normalize());
 const colors=[KEY_COLOR,FILL_COLOR,EDGE_COLOR],gains=[5.5,.7,3.8],widths=[.095,.18,.027];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  // Match Three equirectUv: v=0 is south, u=0 points to -X.
  const theta=Math.PI*(y+.5)/height,phi=2*Math.PI*(x+.5)/width,n=new T.Vector3(-Math.sin(theta)*Math.cos(phi),-Math.cos(theta),-Math.sin(theta)*Math.sin(phi)),i=(y*width+x)*4;
  for(let c=0;c<3;c++){let v=.035+.055*Math.max(0,n.y);for(let k=0;k<3;k++){const a=Math.max(0,1-n.dot(directions[k]));v+=colors[k][c]*gains[k]*Math.exp(-a*a/widths[k]);}data[i+c]=v;}data[i+3]=1;
 }
 const texture=new T.DataTexture(data,width,height,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;
 const generator=new T.PMREMGenerator(renderer);let target;
 try{target=generator.fromEquirectangular(texture);}finally{texture.dispose();generator.dispose();}
 cached={texture:target.texture,target,inputBytes:data.byteLength,dispose(){target.dispose();environments.delete(renderer);}};if(typeof addEventListener==='function')addEventListener('pagehide',event=>{if(!event.persisted)cached.dispose();});environments.set(renderer,cached);return cached;
}
