/* Additive sidecar inserted inside the verified original R17.2 closure.
 * Reads native state/uniforms only. No native setters, draw calls, matrix updates,
 * gl.getError, buffer transfer, or production persistence. */
{
 const source=Object.freeze(JSON.parse(JSON.stringify(window.__RF31_SOURCE__)));
 let sequence=0;
 const clone=x=>JSON.parse(JSON.stringify(x));
 const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
 function hashText(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 function hashNumbers(values){const a=new Float64Array(values),b=new Uint8Array(a.buffer);let h=2166136261;for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
 function uniformValues(){return {weaveScale:gl.getUniform(prog,U.scale),stitchPitch:gl.getUniform(prog,U.pitch),threadWidth:gl.getUniform(prog,U.thread),readability:gl.getUniform(prog,U.read),wash:gl.getUniform(prog,U.wash),light:gl.getUniform(prog,U.light)};}
 function guard(){return {state:hashText(JSON.stringify(state)),vertices:hashNumbers(vertices),indices:hashNumbers(indices),vertexShader:hashText(VS),fragmentShader:hashText(FS),uniforms:uniformValues()};}
 function read(){
  const started=performance.now();
  if(!state.ready||gl.isContextLost())throw Error('NATIVE_NOT_READY');
  const before=guard(),actual=before.uniforms;
  for(const name of Object.keys(actual)){
   if(typeof actual[name]!=='number'||!Number.isFinite(actual[name]))throw Error('INVALID_NATIVE_UNIFORM:'+name);
   const target=state[name];
   if(Math.abs(actual[name]-target)>1e-6*Math.max(1e-3,Math.abs(target)))throw Error('NATIVE_FRAME_PENDING:'+name);
  }
  if(actual.weaveScale<=0||actual.stitchPitch<=0||actual.threadWidth<=0)throw Error('INVALID_NATIVE_LENGTH');
  const values=[
   ['material.warp_spacing_m','经纱中心间距',.0254/60*actual.weaveScale,'m','PASS','runtime_computed','实际 uWeaveScale × 源着色器 25.4/60 mm；不是实物测量'],
   ['material.weft_spacing_m','纬纱中心间距',.0254/40*actual.weaveScale,'m','PASS','runtime_computed','实际 uWeaveScale × 源着色器 25.4/40 mm；不是实物测量'],
   ['material.twill_repeat_m','固定 V 时的 U 向四纱周期',.0254/60*4*actual.weaveScale,'m','PASS','runtime_computed','材料参考坐标中的 U 向周期；不等于任意方向的世界空间长度'],
   ['material.stitch_pitch_m','实际上传的针脚节距',actual.stitchPitch,'m','PASS','runtime_computed','直接读取 gl.getUniform(uStitchPitch)，不是复述滑块文字'],
   ['material.visible_thread_width_m','实际可见线宽代理',actual.threadWidth,'m','WARNING','runtime_computed','读取 uThreadWidth；抗锯齿覆盖可改变屏幕支撑范围，不是实物线径或 Tex'],
   ['material.thickness_m','材料物理厚度',null,'m','UNKNOWN','unknown','本 R17.2 外观工作台未给出物理厚度；不借用 R15 的其他版本候选'],
   ['material.yarn_diameter_m','纱线几何直径',null,'m','UNKNOWN','unknown','程序化纱线遮罩与几何线径没有等价证据'],
   ['material.linear_density_tex','纱线 / 缝线 Tex',null,'tex','UNKNOWN','unknown','线密度不能由显示代理宽度反推']
  ].map(([id,label,value,unit,status,basis,method])=>({id,label,value,unit,status,basis,method}));
  const after=guard(),unchanged=JSON.stringify(before)===JSON.stringify(after);
  if(!unchanged)throw Error('READ_PRESERVATION_FAILED');
  const result={schema:'kaopu/reality-workbench-export@1',exporterVersion:'0.3.1-a',objectId:'fabric-denim-r17-2',domain:'fabric',family:'denim',source:clone(source),capture:{capturedAt:new Date().toISOString(),sequence:++sequence,sourceMode:'native_callback',nativeFrame:state.frames,view:state.view,elapsedMs:performance.now()-started},nativeControls:{weaveScale:state.weaveScale,stitchPitch:state.stitchPitch,threadWidth:state.threadWidth,readability:state.readability,wash:state.wash,light:state.light},shaderInputs:clone(actual),measurements:values,materialSpace:{unit:'m',basis:'source_declared',coordinate:'aMaterial=[generated local X, generated local Y] before shader motion',uMeaning:'cross-warp-yarn direction',vMeaning:'cross-weft-yarn direction',garmentBindingVerified:false,physicalCalibration:false},camera:{distance:state.distance,target:[...state.target],yaw:state.yaw,pitch:state.pitch,fovYDeg:31,bufferPx:[canvas.width,canvas.height]},mesh:{vertices:vertices.length/stride,triangles:indices.length/3},preservation:{passed:true,before,after,method:'same-task FNV-1a diagnostic fingerprints; source provenance separately uses SHA-256',checked:['native state','CPU geometry arrays','vertex/fragment shader text','listed GPU uniforms'],notChecked:['all driver state','all framebuffer pixels','real-world sample dimensions']},comparison:{nominalStitchPitchM:.03/11,actualStitchPitchM:actual.stitchPitch,interpretation:'源候选11针/30mm与运行时上传值分别保留；未给工艺公差，不自动判制造缺陷'},authorities:{sourceWriteAPI:false,repairAuthorized:false,physicalCertification:false,manufacturingCertification:false,productionReady:false}};
  return freeze(result);
 }
 window.KAOPU_REALITY=Object.freeze({version:'0.3.1-a',read,exportJSON:()=>JSON.stringify(read(),null,2),source});
}
