// Browser QA counters only. No drawing state is changed.
window.__R25_PREVIEW_DRAWS__=0;
window.__R25_SURFACE_UPLOADS__=0;
const reuseQA=WebGL2RenderingContext.prototype;
const reuseSource=reuseQA.shaderSource,reuseAttach=reuseQA.attachShader,reuseDraw=reuseQA.drawArrays,reuseUpload=reuseQA.texSubImage2D;
reuseQA.shaderSource=function(shader,source){shader.__R25_INTERSECTION__=source.includes('bool intersectAtlas(');return reuseSource.call(this,shader,source);};
reuseQA.attachShader=function(program,shader){if(shader.__R25_INTERSECTION__)program.__R25_INTERSECTION__=true;return reuseAttach.call(this,program,shader);};
reuseQA.drawArrays=function(...args){if(this.getParameter(this.CURRENT_PROGRAM)?.__R25_INTERSECTION__)__R25_PREVIEW_DRAWS__++;return reuseDraw.apply(this,args);};
reuseQA.texSubImage2D=function(...args){__R25_SURFACE_UPLOADS__++;return reuseUpload.apply(this,args);};
