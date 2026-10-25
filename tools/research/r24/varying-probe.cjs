'use strict';
exports.install=function(){
 window.__QA_DEBUG_MODE__=0;
 const P=WebGL2RenderingContext.prototype,source=P.shaderSource,locations=new WeakMap();
 P.shaderSource=function(shader,text){
  if(text.includes('gmMesoMap')&&text.includes('vCSRest')&&/void\s+main\s*\(/.test(text)){
   text=text.replace(/void\s+main\s*\(\s*\)/,'void qaOriginalMain()')+`
uniform int qaDebugMode;
void main(){qaOriginalMain();if(qaDebugMode>0){int k=qaDebugMode-1;float v=k<3?vViewPosition[k]:k<6?vNormal[k-3]:k<9?vCSRest[k-6]:vCSExtra[k-8];uint b=floatBitsToUint(v);gl_FragColor=vec4(float(b&255u),float((b>>8)&255u),float((b>>16)&255u),float((b>>24)&255u))/255.;}}
`;
  }
  return source.call(this,shader,text);
 };
 for(const name of ['drawArrays','drawElements']){const draw=P[name];P[name]=function(...args){const p=this.getParameter(this.CURRENT_PROGRAM);if(p){let location=locations.get(p);if(location===undefined){location=this.getUniformLocation(p,'qaDebugMode');locations.set(p,location);}if(location)this.uniform1i(location,window.__QA_DEBUG_MODE__);}return draw.apply(this,args);};}
};
exports.probe=async function(original,candidate,id,view){
 const selected={'lean/front':[[43,307],[597,307]],'lean/back':[[521,318]],'muscular/side':[[281,242]],'A-reach/front':[[397,706],[243,706]],'B-bend/side':[[262,565],[294,663]]},points=selected[id+'/'+view];if(!points)return null;
 async function capture(page,kind,mode){return page.evaluate(({kind,mode,points})=>{
  window.__QA_DEBUG_MODE__=mode;
  let data,width,height;if(kind==='source'){const v=__IDENTITY_QA__.viewer();v.render();data=__BODY_QA_LAYERS__[0];width=v.renderer.domElement.width;height=v.renderer.domElement.height;}else{bodySourceAtlasR23.renderer.bodySurface({});const layers=bodySourceAtlasR23.renderer.precisionLayers();data=layers.values[0];width=layers.width;height=layers.height;}
  return points.map(([x,y])=>{const at=(x+(height-1-y)*width)*4,bytes=Uint8Array.from(data.subarray(at,at+4),v=>Math.round(v*255));return{x,y,value:new DataView(bytes.buffer).getFloat32(0,true),bytes:[...bytes],width,height};});
 },{kind,mode,points});}
 const result={points,channels:[]};for(let mode=1;mode<=11;mode++){const a=await capture(original,'source',mode),b=await capture(candidate,'candidate',mode);result.channels.push({mode,source:a,candidate:b,differences:a.map((p,i)=>b[i].value-p.value)});}
 await original.evaluate(()=>{window.__QA_DEBUG_MODE__=0;__IDENTITY_QA__.viewer().render();});await candidate.evaluate(()=>{window.__QA_DEBUG_MODE__=0;bodySourceAtlasR23.renderer.bodySurface({});});return result;
};
