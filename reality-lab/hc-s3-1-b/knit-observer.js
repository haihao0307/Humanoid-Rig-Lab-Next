/* Factory inserted additively into the exact retained P02 C2 closure. */
(function makeKnitObserver(access, source) {
'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);Object.values(x).forEach(freeze);}return x;};
const sourceCopy=freeze(copy(source));let sequence=0;
function hashBytes(a){const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function smallUniform(u){const v=u?.value;if(v==null||typeof v==='number'||typeof v==='string'||typeof v==='boolean')return v;if(v.isTexture)return {texture:v.uuid,version:v.version,width:v.image?.width,height:v.image?.height};if(v.elements)return Array.from(v.elements);if(v.toArray)return v.toArray();if(Array.isArray(v))return v.map(x=>smallUniform({value:x}));return 'unsupported';}
function objects(n){return [n.mesh,n.fur,n.jacket?.mesh].filter(Boolean);}
function geometryState(g,full){const out={uuid:g.uuid,index:g.index?{count:g.index.count,version:g.index.version}:null,attributes:{},instanceCount:Number.isFinite(g.instanceCount)?g.instanceCount:null};const arrays=Object.entries(g.attributes);if(g.index)arrays.push(['$index',g.index]);for(const [k,a] of arrays){const x=a.array;const sample=[0,1,2,Math.floor(x.length/2),x.length-3,x.length-2,x.length-1].filter(i=>i>=0&&i<x.length).map(i=>[i,x[i]]);out.attributes[k]={count:a.count,itemSize:a.itemSize,version:a.version,bytes:x.byteLength,sample};if(full)out.attributes[k].fnv1a=hashBytes(x);}return out;}
function guard(n,full){return JSON.stringify({settings:n.settings,ready:n.ready,dirty:n.dirty,building:n.building,builds:n.builds,frames:n.frames,camera:{position:n.camera.position.toArray(),matrix:n.camera.matrix.elements,world:n.camera.matrixWorld.elements,projection:n.camera.projectionMatrix.elements,target:n.controls.target.toArray()},objects:objects(n).map(o=>({uuid:o.uuid,visible:o.visible,matrix:o.matrix.elements,world:o.matrixWorld.elements,geometry:geometryState(o.geometry,full),material:{uuid:o.material.uuid,version:o.material.version,roughness:o.material.roughness,sheen:o.material.sheen,vertexShader:o.material.vertexShader,fragmentShader:o.material.fragmentShader,uniforms:Object.fromEntries(Object.entries(o.material.uniforms||{}).map(([k,v])=>[k,smallUniform(v)]))}}))});}
function ringCenter(a,cell,step){const first=(cell*65*13+step*13)*3,p=[0,0,0];for(let j=0;j<12;j++)for(let k=0;k<3;k++)p[k]+=a[first+j*3+k]/12;return p;}
function gpuInputs(n){const gl=n.renderer.getContext();if(gl.isContextLost())throw Error('NATIVE_CONTEXT_LOST');let found=null;for(const p of n.renderer.info.programs||[]){if(!p.program||!p.vertexShader)continue;const text=gl.getShaderSource(p.vertexShader)||'';if(text.includes('p=root+uLength*(strand*t+curve*t*t)')){if(found)throw Error('GPU_PROGRAM_AMBIGUOUS');found=p.program;}}if(!found)throw Error('NATIVE_PROGRAM_NOT_READY');const value=name=>{const location=gl.getUniformLocation(found,name);if(location===null)throw Error('GPU_UNIFORM_MISSING:'+name);const x=gl.getUniform(found,location);if(typeof x!=='number'||!Number.isFinite(x))throw Error('GPU_UNIFORM_INVALID:'+name);return x;};const result={length:value('uLength'),density:value('uDensity'),active:n.fur.visible};if(result.active){for(const [a,b] of [[result.length,n.uniforms.len.value],[result.density,n.uniforms.fuzz.value]])if(Math.abs(a-b)>1e-6*Math.max(1,Math.abs(b)))throw Error('NATIVE_FRAME_PENDING');}return result;}
function read(options={}){
 if(!options||typeof options!=='object'||Object.keys(options).some(k=>k!=='fullIntegrity')||(options.fullIntegrity!==undefined&&typeof options.fullIntegrity!=='boolean'))throw Error('READ_OPTIONS_INVALID');
 const start=performance.now(),n=access(),full=options.fullIntegrity===true;
 if(!n.ready||!n.mesh||!n.fur||n.building)throw Error('NATIVE_NOT_READY');if(n.dirty)throw Error('NATIVE_FRAME_PENDING');
 if(n.version!=='KNIT-PUBLIC-P02'||n.cols!==16||n.rows!==20)throw Error('NATIVE_IDENTITY_CHANGED');
 const before=guard(n,full),gpu=gpuInputs(n),position=n.mesh.geometry.attributes.position.array;
 if(position.length!==n.cols*n.rows*65*13*3)throw Error('CARRIER_LAYOUT_CHANGED');
 const c0=ringCenter(position,0,16),c1=ringCenter(position,1,16),r1=ringCenter(position,n.cols,16);
 const colPitch=c1[0]-c0[0],rowPitch=r1[1]-c0[1];
 if(Math.abs(colPitch-n.pitch)>2e-8||Math.abs(rowPitch-n.spacing)>2e-8)throw Error('GENERATED_GRID_DECLARATION_MISMATCH');
 const offset=16*13*3,diameter=Math.hypot(...[0,1,2].map(k=>position[offset+k]-position[offset+6*3+k]));
 const s=n.fur.geometry.attributes.strand.array,curve=n.fur.geometry.attributes.curve.array;
 const sampleTip=Math.hypot(...[0,1,2].map(k=>(s[k]+curve[k])*gpu.length));
 const rows=[
 ['knit.grid_columns','生成针目列数',n.cols,'1','PASS','runtime_computed','源拓扑列数；与实际载纱顶点布局核对'],
 ['knit.grid_rows','生成针目行数',n.rows,'1','PASS','runtime_computed','源拓扑行数；与实际载纱顶点布局核对'],
 ['knit.column_pitch_m','生成列间距（局部 X 投影）',colPitch,'m','PASS','runtime_computed','实际载纱网格相邻针目同一截面中心差；不是标准机号'],
 ['knit.row_pitch_m','生成行间距（局部 Y 投影）',rowPitch,'m','PASS','runtime_computed','实际载纱网格相邻针目截面中心差；不是成衣拉伸后的密度'],
 ['knit.carrier_nominal_diameter_m','载纱名义直径',2*n.radius,'m','WARNING','source_declared','自有数字几何配方；截面存在起伏，非实物纱径'],
 ['knit.carrier_sample_diameter_m','载纱截面采样直径',diameter,'m','WARNING','runtime_computed','第一个针目第16环上两个相对顶点距离；不是布料厚度'],
 ['knit.short_fiber_instances','短绒几何实例数',n.fur.geometry.instanceCount,'1','PASS','runtime_computed','数字代表纤维数量，不代表每根实物羊毛'],
 ['knit.surface_fiber_instances','贴伏长纤维实例数',n.jacket.mesh.geometry.instanceCount,'1','PASS','runtime_computed','当前原生实例几何数量'],
 ['knit.fuzz_density_control','当前短绒密度控制值',n.uniforms.fuzz.value,'1','PASS','runtime_computed','当前材质输入；GPU实际上传值单独保存，隐藏模式不冒充正在绘制'],
 ['knit.length_multiplier','当前短绒长度倍率',n.uniforms.len.value,'1','PASS','runtime_computed','无量纲倍率，不是毫米'],
 ['knit.short_fiber_sample_offset_m','短绒样本端点偏移（最近上传）',sampleTip,'m','WARNING','runtime_computed','按原shader root+length*(strand+curve)读取第0实例局部端点；非纤维弧长，隐藏模式只作最近上传记录'],
 ['knit.physical_thickness_m','实物材料厚度',null,'m','UNKNOWN','unknown','P02外观样片没有实物厚度证据，禁止借用R15估计'],
 ['knit.areal_density_g_m2','实物面密度',null,'g/m2','UNKNOWN','unknown','没有实物标定或本版本物理模型'],
 ['knit.linear_density_tex','纱线 Tex',null,'tex','UNKNOWN','unknown','几何载纱直径不能反推线密度']
 ].map(([id,label,value,unit,status,basis,method])=>({id,label,value,unit,status,basis,method}));
 const after=guard(access(),full);if(before!==after)throw Error('READ_PRESERVATION_FAILED');
 return freeze({schema:'kaopu/reality-workbench-export@1',exporterVersion:'0.3.1-b',objectId:'fabric-knit-public-p02-c2',domain:'fabric',family:'knit',source:copy(sourceCopy),capture:{capturedAt:new Date().toISOString(),sequence:++sequence,nativeFrame:n.frames,nativeBuild:n.builds,elapsedMs:performance.now()-start,integrityMode:full?'full_cpu_arrays':'metadata_and_samples'},measurements:rows,requested:copy(n.settings),shaderInputs:gpu,geometry:{carrierVertices:n.mesh.geometry.attributes.position.count,carrierTriangles:n.mesh.geometry.index.count/3,gridColumns:n.cols,gridRows:n.rows,declaredColumnPitchM:n.pitch,declaredRowPitchM:n.spacing,nominalCarrierRadiusM:n.radius,sampleStrand:[s[0],s[1],s[2]],sampleCurve:[curve[0],curve[1],curve[2]],shortInstances:n.fur.geometry.instanceCount,surfaceInstances:n.jacket.mesh.geometry.instanceCount},capabilities:{clothPhysics:false,materialSpaceBindingToGarment:false,physicalCalibration:false},preservation:{passed:true,before,after,scope:full?'all carrier/fur/jacket CPU geometry buffers plus state/material/shader data':'metadata, selected geometry samples, state/material/shader data',notChecked:['driver internal state','every GPU texture texel','physical specimen properties'],method:'same synchronous task; FNV-1a for optional full CPU arrays; source provenance separately pinned by SHA256'},authorities:{sourceWriteAPI:false,repairAuthorized:false,physicalCertification:false,manufacturingCertification:false,productionReady:false}});
}
return Object.freeze({version:'0.3.1-b',source:sourceCopy,read,exportJSON:()=>JSON.stringify(read(),null,2)});
})
