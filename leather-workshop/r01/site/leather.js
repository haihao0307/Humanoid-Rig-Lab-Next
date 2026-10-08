// KAOPU Leather R01. Original procedural implementation; not Adobe source code.
// Geometry, material coordinates and appearance are intentionally independent.
import * as T from 'three';
export const VERSION='R01.0';
export const PRESETS={
 tan:{name:'原色粒面',kind:0,color:'#a7784f',grain:1.12,depth:0.14,roughness:0.48,coat:0.12,wear:0.10},
 wax:{name:'油蜡棕革',kind:0,color:'#713921',grain:0.88,depth:0.11,roughness:0.36,coat:0.32,wear:0.34},
 black:{name:'黑色压粒',kind:1,color:'#25272a',grain:1.85,depth:0.24,roughness:0.44,coat:0.20,wear:0.08},
 nubuck:{name:'磨砂革',kind:2,color:'#8b745c',grain:0.7,depth:0.05,roughness:0.86,coat:0,wear:0.15},
 cross:{name:'交叉压纹',kind:3,color:'#32433f',grain:1.15,depth:0.13,roughness:0.48,coat:0.16,wear:0.12}
};
export const DEFAULT={...PRESETS.tan,preset:'tan',seed:27,tileMM:96,resolution:2048,fold:1,stitches:true,object:'roll',light:'studio',exposure:1.1,rotation:0};
const vert=`varying vec2 vUV;void main(){vUV=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const noise=`
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*7.13)*43758.5453);}
vec2 hash2(vec2 p){return vec2(h(p),h(p+vec2(19.7,41.3)));}
float n(vec2 p,float period){vec2 i=floor(p),f=fract(p);vec2 w=f*f*(3.-2.*f);return mix(mix(h(mod(i,period)),h(mod(i+vec2(1,0),period)),w.x),mix(h(mod(i+vec2(0,1),period)),h(mod(i+1.,period)),w.x),w.y);}
float fb(vec2 uv){return n(uv*4.,4.)*.56+n(uv*8.,8.)*.27+n(uv*16.,16.)*.12+n(uv*32.,32.)*.05;}
vec3 cells(vec2 p,float period){vec2 id=floor(p),f=fract(p);float a=8.,b=8.,v=0.;for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y));vec2 rnd=hash2(mod(id+g,period));vec2 d=g+.12+.76*rnd-f;float q=dot(d,d);if(q<a){b=a;a=q;v=rnd.x;}else if(q<b){b=q;}}}return vec3(sqrt(a),sqrt(b)-sqrt(a),v);}
`;
const field=`precision highp float;varying vec2 vUV;uniform float uSeed,uCells,uKind;${noise}
void main(){vec2 uv=vUV;float broad=fb(uv);vec2 warp=vec2(n(uv*8.,8.),n(uv*8.+13.7,8.))-.5;
vec2 p=uv*uCells+warp*.85;vec3 g=cells(p,uCells);vec3 fine=cells(p*3.,uCells*3.);vec3 coarse=cells(uv*16.+warp*.45,16.);
float grain=smoothstep(.015,.24,g.y);float pores=1.-smoothstep(.025,.115,fine.x);float micro=n(uv*1024.,1024.);float secondary=smoothstep(.012,.15,coarse.y);
float height=.22+.48*grain+.045*n(p*4.,uCells*4.)+.025*micro-.12*pores+.035*secondary;
if(uKind>.5&&uKind<1.5){height=.20+.52*pow(grain,.58)-.065*g.x+.05*micro-.075*pores;}
if(uKind>1.5&&uKind<2.5){height=.42+.055*grain+.22*micro+.08*n(uv*512.,512.);grain=.7;pores=0.;}
if(uKind>2.5){vec2 q=uv*uCells;float a=abs(sin(6.2831853*(q.x+q.y))),b=abs(sin(6.2831853*(q.x-q.y)));float rib=max(pow(a,8.),pow(b,8.));height=.25+.42*rib+.055*micro;grain=.3+.65*rib;pores*=.3;}
gl_FragColor=vec4(clamp(height,0.,1.),grain,pores,broad);}`;
const maps=`precision highp float;varying vec2 vUV;uniform sampler2D uField;uniform vec3 uColor;uniform float uMode,uResolution,uDepthMM,uTileMM,uRough,uWear,uKind;
void main(){vec4 d=texture2D(uField,vUV);float wear=smoothstep(.42,.73,d.a)*uWear;float polished=smoothstep(.55,.87,d.g);if(uMode<.5){vec3 c=uColor*(.84+.12*d.g+.11*d.a);c*=1.-.035*d.b;c=mix(c,c*1.27+vec3(.025,.012,.003),wear*(.22+.32*polished));gl_FragColor=vec4(c,1.);}
else if(uMode<1.5){vec2 e=vec2(1./uResolution,0.);float dx=texture2D(uField,vUV-e.xy).r-texture2D(uField,vUV+e.xy).r;float dy=texture2D(uField,vUV-e.yx).r-texture2D(uField,vUV+e.yx).r;vec3 nn=normalize(vec3(vec2(dx,dy)*uDepthMM*uResolution/(2.*uTileMM),1.));gl_FragColor=vec4(nn*.5+.5,1.);}
else if(uMode<2.5){float r=clamp(uRough+.095*(1.-d.g)+.018*d.b-wear*.11,.11,.98);gl_FragColor=vec4(vec3(r),1.);}
else if(uMode<3.5){gl_FragColor=vec4(vec3(d.r),1.);}else{gl_FragColor=vec4(vec3(1.-.09*(1.-d.g)-.06*d.b),1.);}}`;
export class LeatherKernel{
 constructor(renderer){this.renderer=renderer;this.scene=new T.Scene();this.camera=new T.Camera();this.quad=new T.Mesh(new T.PlaneGeometry(2,2));this.scene.add(this.quad);this.targets=[];this.maps={};this.material=null;this.generation=0;}
 bake(p){const r=this.renderer,old=r.getRenderTarget(),t0=performance.now();const res=p.resolution;const target=(type=T.UnsignedByteType)=>{let rt=new T.WebGLRenderTarget(res,res,{type,depthBuffer:false,stencilBuffer:false,minFilter:T.LinearMipmapLinearFilter,magFilter:T.LinearFilter,generateMipmaps:true});rt.texture.wrapS=rt.texture.wrapT=T.RepeatWrapping;rt.texture.anisotropy=Math.min(8,r.capabilities.getMaxAnisotropy());return rt;};
 const fieldTarget=target(T.HalfFloatType);fieldTarget.texture.generateMipmaps=false;fieldTarget.texture.minFilter=T.LinearFilter;
 this.quad.material=new T.ShaderMaterial({vertexShader:vert,fragmentShader:field,uniforms:{uSeed:{value:p.seed},uCells:{value:Math.max(8,Math.round(p.tileMM/p.grain))},uKind:{value:p.kind}},depthTest:false,depthWrite:false});
 r.setRenderTarget(fieldTarget);r.render(this.scene,this.camera);this.quad.material.dispose();
 const uniforms={uField:{value:fieldTarget.texture},uColor:{value:new T.Color(p.color)},uMode:{value:0},uResolution:{value:res},uDepthMM:{value:p.depth},uTileMM:{value:p.tileMM},uRough:{value:p.roughness},uWear:{value:p.wear},uKind:{value:p.kind}};
 const shader=new T.ShaderMaterial({vertexShader:vert,fragmentShader:maps,uniforms,depthTest:false,depthWrite:false});this.quad.material=shader;
 const newTargets=[];const names=['baseColor','normal','roughness','height','ao'];
 for(let i=0;i<names.length;i++){let rt=target();uniforms.uMode.value=i;rt.texture.colorSpace=i===0?T.LinearSRGBColorSpace:T.NoColorSpace;r.setRenderTarget(rt);r.render(this.scene,this.camera);newTargets.push(rt);this.maps[names[i]]=rt.texture;}
 r.setRenderTarget(old);shader.dispose();fieldTarget.dispose();for(const t of this.targets)t.dispose();this.targets=newTargets;this.params={...p};this.generation++;this.bakeMS=performance.now()-t0;
 if(!this.material)this.material=new T.MeshPhysicalMaterial({side:T.FrontSide,metalness:0,ior:1.46,roughness:1,color:0xffffff});
 Object.assign(this.material,{map:this.maps.baseColor,normalMap:this.maps.normal,roughnessMap:this.maps.roughness,aoMap:this.maps.ao,aoMapIntensity:.45,clearcoat:p.coat,clearcoatRoughness:Math.max(.16,p.roughness*.72),clearcoatNormalMap:this.maps.normal,sheen:p.kind===2?.55:0,sheenColor:new T.Color(p.color).multiplyScalar(1.4),sheenRoughness:.92});this.material.clearcoatNormalScale.set(.48,.48);this.material.needsUpdate=true;return this.material;
 }
 recipe(){return {schema:'kaopu/leather_material@1',version:VERSION,algorithm:'warped-periodic-cellular-grain-r01',units:'meter',tileSizeM:this.params.tileMM/1000,normalConvention:'OpenGL +Y',baseColorEncoding:'linear-sRGB GPU; sRGB PNG export',dataMapEncoding:'linear',parameters:{...this.params},rights:'Original implementation. Adobe page is visual reference only; no Adobe SBS/SBSAR or textures included.',integration:{maps:['baseColor','normal','roughness','height','ao'],metalness:0,uvRule:'one UV unit = tileSizeM; preserve target geometry and rest UVs',physics:'not provided; static appearance only'},validation:{visualAcceptance:'PENDING_USER',adobeOneToOne:'NOT_VERIFIED'}};}
 exportMap(name){const idx=['baseColor','normal','roughness','height','ao'].indexOf(name);if(idx<0)throw Error('Unknown map');let n=this.params.resolution,a=new Uint8Array(n*n*4);this.renderer.readRenderTargetPixels(this.targets[idx],0,0,n,n,a);const c=document.createElement('canvas');c.width=c.height=n;let ctx=c.getContext('2d'),image=ctx.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){let src=((n-1-y)*n+x)*4,dst=(y*n+x)*4;for(let k=0;k<3;k++){let v=a[src+k]/255;if(idx===0)v=v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;image.data[dst+k]=Math.round(v*255);}image.data[dst+3]=255;}ctx.putImageData(image,0,0);return c;}
 dispose(){this.targets.forEach(t=>t.dispose());this.material?.dispose();this.quad.geometry.dispose();}
}
