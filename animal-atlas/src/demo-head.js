// Registered warehouse demonstration layer; identity defaults preserve the original animal.
(function(){
 if(window.__ATLAS_DEMO)return;
 const kind=window.__ATLAS_CONTEXT?.adapter,state={condition:50,health:100,color:'#ffffff',maturity:1,age:1,size:1},view=new Float32Array([1,1,1]),tint=new Float32Array([1,1,1]);
 let clockValue=performance.now()/1000,last=performance.now();
 const demo=window.__ATLAS_DEMO={state,view,tint,activity:1,clock(){const now=performance.now();clockValue+=(now-last)/1000*demo.activity;last=now;return clockValue;},configure(values){demo.clock();Object.assign(state,values);const x=Math.max(0,Math.min(1,state.age/state.maturity)),growth=.35+.65*x*x*(3-2*x),fat=.75+.5*state.condition/100;demo.activity=.15+.85*state.health/100;const axis=kind==='fish'||kind==='cat'||kind==='eagle'||kind==='palau'?0:2;for(let i=0;i<3;i++)view[i]=state.size*growth*(i===axis?1:fat);for(let i=0;i<3;i++)tint[i]=parseInt(state.color.slice(1+i*2,3+i*2),16)/255;},info(){return{rule:'kaopu/demo-map@1',scale:Array.from(view),tint:Array.from(tint),activity:demo.activity,...state};}};
 // Raw WebGL cat/eagle have no Three.js root. Apply the same model transform, not camera zoom.
 if(!['cat','eagle'].includes(kind))return;
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const source=proto.shaderSource,location=proto.getUniformLocation,matrix=proto.uniformMatrix4fv,use=proto.useProgram,names=new WeakMap(),colors=new WeakMap(),scratch=new WeakMap();
  proto.shaderSource=function(shader,text){if(/(?:outColor|gl_FragColor)\s*=\s*vec4\(/.test(text)&&!text.includes('invVP')){text=text.replace(/void\s+main\s*\(\s*\)\s*\{/,'uniform vec3 uAtlasDemoTint;void main(){').replace(/((outColor|gl_FragColor)\s*=\s*vec4\([^;]*;)/g,'$1$2.rgb*=uAtlasDemoTint;');}return source.call(this,shader,text);};
  proto.getUniformLocation=function(program,name){const v=location.call(this,program,name);if(v&&['uPV','uVP'].includes(name))names.set(v,true);return v;};
  proto.uniformMatrix4fv=function(loc,transpose,values,...args){if(names.has(loc)&&values.length===16){let out=scratch.get(this);if(!out){out=new Float32Array(16);scratch.set(this,out);}for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=values[c*4+r]*(c===3?1:view[kind==='cat'&&c>0?3-c:c]);return matrix.call(this,loc,transpose,out,...args);}return matrix.call(this,loc,transpose,values,...args);};
  proto.useProgram=function(program){use.call(this,program);if(program){let loc=colors.get(program);if(loc===undefined){loc=location.call(this,program,'uAtlasDemoTint');colors.set(program,loc);}if(loc)this.uniform3fv(loc,tint);}};
 }
})();
