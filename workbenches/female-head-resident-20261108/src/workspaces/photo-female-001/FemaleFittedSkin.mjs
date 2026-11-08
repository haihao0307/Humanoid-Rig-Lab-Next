// Continuous photo-derived appearance functions, with no image or UV sampling.
// The GPU buffers hold only kernel parameters and a spatial search index.
import {baseColourFragment} from '../../material/BaseSkinColour.mjs';
import {measuredMicroFragment,microUniforms,MICRO_DEFAULTS} from '../../material/MeasuredMicrogeometry.mjs';
import {surfaceTextureFragment,textureUniforms,TEXTURE_DEFAULTS} from '../../material/SurfaceSkinTexture.mjs';
const width=2048;
export async function createFemaleFittedSkin(gl,record,base=new URL('./',import.meta.url)){
 if(record.schema!=='human.photo-female-001.procedural-skin/1'||record.accepted!==false)throw Error('程序肤色候选记录不匹配');
 async function read(ref){const r=await fetch(new URL(ref.file,base),{cache:'no-store'});if(!r.ok)throw Error('肤色参数不可读取');const b=await r.arrayBuffer();if(b.byteLength!==ref.bytes)throw Error('肤色参数长度不匹配');const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');if(hash!==ref.sha256)throw Error('肤色参数校验失败');return new Float32Array(b);}
 const [parameters,cells,indices]=await Promise.all([read(record.files.parameters),read(record.files.cells),read(record.files.indices)]),N=record.centresCount,dims=record.grid.dimensions;if(parameters.length!==N*12||cells.length!==dims.reduce((a,b)=>a*b,1)*2)throw Error('肤色参数尺寸不匹配');
 function texture(data,w,h,format,internal,channels){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);let pixels=data;if(data.length!==w*h*channels){pixels=new Float32Array(w*h*channels);pixels.set(data);}gl.texImage2D(gl.TEXTURE_2D,0,internal,w,h,0,format,gl.FLOAT,pixels);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;}
 const kernels=texture(parameters,N,3,gl.RGBA,gl.RGBA32F,4),cell=texture(cells,width,Math.ceil(cells.length/2/width),gl.RG,gl.RG32F,2),index=texture(indices,width,Math.ceil(indices.length/width),gl.RED,gl.R32F,1);if(gl.getError())throw Error('无法上传肤色函数参数');
 const header=`uniform highp sampler2D u_photoKernels,u_photoCells,u_photoIndex;uniform vec3 u_photoGridMin,u_photoGridDims;uniform float u_photoGridStep,u_photoFitStrength,u_photoGlobalProbe,u_photoScalpTexture;\n`;
 const helper=`vec3 photoFitGain(vec3 p,vec3 n){ivec3 dims=ivec3(u_photoGridDims),g=ivec3(floor((p-u_photoGridMin)/u_photoGridStep));if(any(lessThan(g,ivec3(0)))||any(greaterThanEqual(g,dims)))return vec3(0.);int cellNo=g.x+dims.x*(g.y+dims.y*g.z);vec2 range=texelFetch(u_photoCells,ivec2(cellNo%${width},cellNo/${width}),0).rg;int start=int(range.x+.5),count=int(range.y+.5);float total=0.,sideTotal=0.;vec3 sum=vec3(0.),sideSum=vec3(0.);for(int j=0;j<${record.grid.maximumCandidates};j++){if(j>=count)break;int idx=start+j;int k=int(texelFetch(u_photoIndex,ivec2(idx%${width},idx/${width}),0).r+.5);vec4 c=texelFetch(u_photoKernels,ivec2(k,0),0);vec3 d=(p-c.xyz)/max(c.w,.001);float r=length(d);if(r<3.){vec4 spec=texelFetch(u_photoKernels,ivec2(k,2),0);vec3 nn=normalize(spec.xyz);float orientation=smoothstep(.1,.7,dot(normalize(n),nn));float w=exp(-.5*r*r)*(1.-smoothstep(2.5,3.,r))*orientation;vec3 gain=texelFetch(u_photoKernels,ivec2(k,1),0).xyz;if(spec.w>.5){sideSum+=w*gain;sideTotal+=w;}else{sum+=w*gain;total+=w;}}}return sum/max(total,1.5)+sideSum/max(sideTotal,1.5);}
 uint femDetailHash(uint a){a^=a>>16;a*=2246822519u;a^=a>>13;a*=3266489917u;return a^(a>>16);}
 float femDetailRand(ivec2 q,uint salt){return float(femDetailHash(uint(q.x)*1597334677u^uint(q.y)*3812015801u^salt)>>8)*(1./16777216.);}
 float femFollicles(vec2 p,float foot,uint salt){
  const float cell=.55;ivec2 c=ivec2(floor(p/cell));float pigment=0.;
  for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){
   ivec2 q=c+ivec2(i,j);float occupied=step(.28,femDetailRand(q,salt+13u));
   vec2 centre=(vec2(q)+.035+.93*vec2(femDetailRand(q,salt+19u),femDetailRand(q,salt+29u)))*cell;
   float r=mix(.045,.105,femDetailRand(q,salt+37u));float w=r*r+foot*foot/6.;vec2 d=p-centre;
   float spot=exp(-dot(d,d)/(2.*w))*r*r/w;float contrast=mix(.45,1.,femDetailRand(q,salt+43u));pigment+=spot*contrast*occupied;
  }return pigment;
 }
 float femSurfaceFollicles(vec3 p,vec3 n,float foot){vec3 w=pow(abs(normalize(n)),vec3(8.));w/=max(w.x+w.y+w.z,.000001);float v=0.;if(w.x>.001)v+=w.x*femFollicles(p.yz,foot,801u);if(w.y>.001)v+=w.y*femFollicles(p.xz,foot,1109u);if(w.z>.001)v+=w.z*femFollicles(p.xy,foot,1601u);return v;}
 `;
 function fragment(source){let s=surfaceTextureFragment(measuredMicroFragment(baseColourFragment(source))),dec='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;',entry='if(u_nativeMode==1){';if(s.split(dec).length!==2||s.split(entry).length!==2)throw Error('程序肤色着色接口改变');const scalpAnchor='float gate=facial*fbHead*';if(s.split(scalpAnchor).length!==2)throw Error('侧面纹理区域接口改变');s=s.replace(scalpAnchor,'facial=max(facial,u_photoScalpTexture*smoothstep(265.,315.,psMM.y));float gate=facial*fbHead*');const hook=`
 if(u_photoFitStrength>0.||abs(u_photoGlobalProbe)>0.){vec3 gain=clamp(photoFitGain(vFRest*1000.,nativeNormal.xyz)*u_photoFitStrength+vec3(u_photoGlobalProbe),vec3(-1.35),vec3(1.35));material.diffuseColor*=exp(gain);}
 // Sparse, jittered, subpixel-filtered pigment points. Parameters are an
 // authored estimate; they are not recovered pores from this individual.
 float sideDetail=fbHead*(1.-psLipFeather)*(1.-psE)*(1.-clamp(lidGate,0.,1.))*smoothstep(32.,55.,abs(psMM.x))*smoothstep(235.,285.,psMM.y)*u_photoScalpTexture;
 if(sideDetail>.001){float v=.72*femSurfaceFollicles(psMM,psRestN,psFoot)*sideDetail;material.diffuseColor*=exp(-vec3(.75,.92,1.)*v);}
 `;return s.replace(dec,header+helper+dec).replace(entry,hook+entry);}
 function bind(g,program){for(const [unit,t,name] of [[6,kernels,'u_photoKernels'],[7,cell,'u_photoCells'],[8,index,'u_photoIndex']]){g.activeTexture(g.TEXTURE0+unit);g.bindTexture(g.TEXTURE_2D,t);g.uniform1i(g.getUniformLocation(program,name),unit);}}
 function uniforms({strength=1,detail=true,probe=0,scalpTexture=.65}={}){if(!Number.isFinite(strength)||strength<0||strength>1||!Number.isFinite(probe)||Math.abs(probe)>.5||!Number.isFinite(scalpTexture)||scalpTexture<0||scalpTexture>1)throw Error('肤色强度越界');return{...microUniforms({...MICRO_DEFAULTS,enabled:false}),...textureUniforms({...TEXTURE_DEFAULTS,enabled:!!detail,pores:.39,furrows:.28,grain:.25,oil:.025,colour:.25,seed:731,view:0}),bcEnabled:0,u_photoFitStrength:strength,u_photoGlobalProbe:probe,u_photoScalpTexture:scalpTexture,u_photoGridMin:record.grid.minimum,u_photoGridDims:dims,u_photoGridStep:record.grid.stepMM};}
 return{fragment,bind,uniforms,dispose(){gl.deleteTexture(kernels);gl.deleteTexture(cell);gl.deleteTexture(index);}};
}
