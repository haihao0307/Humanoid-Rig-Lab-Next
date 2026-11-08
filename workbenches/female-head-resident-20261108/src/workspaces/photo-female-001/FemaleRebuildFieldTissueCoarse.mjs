// Continuous 3D appearance gains from source-derived coefficients.
// The coefficients may include photographic light; this is not measured BRDF.
// No photo or UV image is sampled by this field at runtime.
export async function createFemaleRebuildFieldTissueCoarse(gl,record,base=new URL('./',import.meta.url)){
 if(record.schema!=='human.female.procedural-rebuild-field/1'||record.accepted!==false)throw Error('函数重建参数版本不匹配');
 const {file,bytes,sha256,bits,width,rowsPerLevel}=record.storage,levels=record.spacingMM.length,size=1<<bits;
 if(!Number.isInteger(bits)||bits<17||bits>20||width!==2048||rowsPerLevel!==size/width||bytes!==size*levels*4*2||levels!==7||width>gl.getParameter(gl.MAX_TEXTURE_SIZE)||rowsPerLevel*levels>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('函数重建参数尺寸无效');
 const response=await fetch(new URL(file,base),{cache:'no-store'});if(!response.ok)throw Error('无法读取重建函数参数');const buffer=await response.arrayBuffer();if(buffer.byteLength!==bytes)throw Error('重建函数参数长度不符');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==sha256)throw Error('重建函数参数校验失败');
 const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE12);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,width,rowsPerLevel*levels,0,gl.RGBA,gl.HALF_FLOAT,new Uint16Array(buffer));if(gl.getError())throw Error('无法上传重建函数参数');
 const num=x=>Number(x).toPrecision(10),spacing=record.spacingMM.map(num).join(','),origin=record.originMM.map(num).join(','),filterK=record.pixelFilterK||0,footMax=record.pixelFootMaxMM||0,observed=record.observedSupport;if(!Number.isFinite(filterK)||filterK<0||filterK>2||!Number.isFinite(footMax)||footMax<0||footMax>100)throw Error('函数足迹滤波参数无效');
 if(observed&&(!Array.isArray(observed.originMM)||observed.originMM.length!==3||observed.originMM.some(x=>!Number.isFinite(x))||!Number.isFinite(observed.spacingMM)||observed.spacingMM<=0||!Array.isArray(observed.dimensions)||observed.dimensions.length!==3||observed.dimensions.some(x=>!Number.isInteger(x)||x<2)||observed.dimensions.reduce((a,b)=>a*b,1)>size||observed.alphaLayer!==0))throw Error('函数观察范围参数无效');
 const code=`uniform highp sampler2D u_femaleRebuild;uniform float u_femaleRebuildStrength,u_femaleCoarseCorrection;
 float femaleCoarseLuminance=0.;
 const float femaleRebuildSpacing[7]=float[7](${spacing});
 vec3 femaleRebuildGain(vec3 p,float foot){
  vec3 total=vec3(0.),coarse=vec3(0.);p-=vec3(${origin});${footMax>0?`foot=min(foot,${num(footMax)});`:''}
  for(int level=0;level<7;level++){
   vec3 q=p/femaleRebuildSpacing[level],cell=floor(q),t=q-cell;vec3 w=t*t*t*(t*(t*6.-15.)+10.);ivec3 c=ivec3(cell);
   for(int k=0;k<8;k++){
    int x=(k>>2)&1,y=(k>>1)&1,z=k&1;ivec3 a=c+ivec3(x,y,z);
    uint h=(uint(a.x)^(uint(a.y)*2654435761u)^(uint(a.z)*805459861u))&${size-1}u;
    float s=(x==1?w.x:1.-w.x)*(y==1?w.y:1.-w.y)*(z==1?w.z:1.-w.z);
    vec3 value=texelFetch(u_femaleRebuild,ivec2(int(h%${width}u),level*${rowsPerLevel}+int(h/${width}u)),0).rgb*s*${filterK>0?`exp(-min(80.,${num(filterK)}*foot*foot/(femaleRebuildSpacing[level]*femaleRebuildSpacing[level])))`:'1.'};total+=value;if(level<2)coarse+=value;
   }
  }
  femaleCoarseLuminance=dot(coarse,vec3(.2126,.7152,.0722))+.08437393075;return clamp(total,vec3(-2.5),vec3(2.5));
 }
 ${observed?`float femaleRebuildObserved(vec3 p){
  vec3 q=(p-vec3(${observed.originMM.map(num).join(',')}))/${num(observed.spacingMM)};ivec3 c=ivec3(floor(q)),d=ivec3(${observed.dimensions.join(',')});
  if(any(lessThan(c,ivec3(0)))||any(greaterThanEqual(c+ivec3(1),d)))return 0.;
  vec3 t=q-floor(q),w=t*t*t*(t*(t*6.-15.)+10.);float coverage=0.;
  for(int k=0;k<8;k++){int x=(k>>2)&1,y=(k>>1)&1,z=k&1;ivec3 a=c+ivec3(x,y,z);int index=a.x+d.x*(a.y+d.y*a.z);float weight=(x==1?w.x:1.-w.x)*(y==1?w.y:1.-w.y)*(z==1?w.z:1.-w.z);coverage+=texelFetch(u_femaleRebuild,ivec2(index%${width},index/${width}),0).a*weight;}
  return clamp(coverage,0.,1.);
 }`:''}
 `;
 function fragment(source,{shareSampler=false}={}){const decl='uniform highp sampler2DArray u_nativeGeometry,u_nativeInputs;',entry='if(u_nativeMode==1){';if(source.split(decl).length!==2||source.split(entry).length!==2)throw Error('函数重建着色接口已改变');const shaderCode=shareSampler?code.replace('uniform highp sampler2D u_femaleRebuild;','').replace(/\bu_femaleRebuild\b/g,'femSideNegative'):code;if(shareSampler&&!source.includes('uniform sampler2D femReference,femEdited,femSidePositive,femSideNegative;'))throw Error('共用观察采样器不存在');return source.replace(decl,shaderCode+'\n'+decl).replace(entry,`if(u_femaleRebuildStrength>.0){vec3 p=vFRest*1000.;float support=smoothstep(-82.,-66.,p.z);${observed?'support*=femaleRebuildObserved(p);':''}vec3 gain=femaleRebuildGain(p,psFoot);float tissueProtect=(1.-clamp(psLipFeather,0.,1.))*(1.-clamp(lidGate,0.,1.))*femaleFineFrontObserved(p);gain=clamp(gain-vec3(femaleCoarseLuminance*u_femaleCoarseCorrection*tissueProtect),vec3(-2.5),vec3(2.5));material.diffuseColor*=exp(gain*u_femaleRebuildStrength*support);}\n`+entry);}
 // Unit 12 is shared with the photo-only negative-side sampler. Both uniforms
 // are sampler2D; the caller binds the photo in observation mode and this
 // coefficient texture in function mode. No per-view upload is required.
 function bind(g,program,photoMode){if(!photoMode){g.activeTexture(g.TEXTURE12);g.bindTexture(g.TEXTURE_2D,texture);}g.uniform1i(g.getUniformLocation(program,'u_femaleRebuild'),12);g.uniform1i(g.getUniformLocation(program,'femSideNegative'),12);}
 return{fragment,bind,report:()=>({bytes,sha256,levels,bits,sourceDerived:true,photoSampled:false,accepted:false}),dispose(){gl.deleteTexture(texture);}};
}
