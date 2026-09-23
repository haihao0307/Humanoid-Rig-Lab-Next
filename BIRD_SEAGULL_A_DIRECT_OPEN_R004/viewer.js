(async()=>{
'use strict';
const status=document.getElementById('status');
const canvas=document.getElementById('c');
const fail=(message,error)=>{
  const text=String(message||error?.message||error||'未知错误');
  status.textContent='打开失败：'+text;
  status.classList.remove('ready');
  status.classList.add('error');
  window.__BIRD_QA={ready:false,error:text};
  if(error)console.error(error);else console.error(text);
};
try{
  if(!canvas||!status)throw new Error('页面结构缺失');
  if(!('DecompressionStream' in window))throw new Error('浏览器不支持本地 gzip 解码，请使用最新版 Chrome、Edge 或 Safari');

  function base64Bytes(input){
    let s=String(input||'').replace(/[\t\n\r ]+/g,'').replace(/-/g,'+').replace(/_/g,'/');
    const bad=s.match(/[^A-Za-z0-9+/=]/);
    if(bad)throw new Error(`形态载荷含非法字符（位置 ${bad.index}）`);
    s=s.replace(/=+$/,'');
    while(s.length%4)s+='=';
    let text;
    try{text=atob(s)}catch(error){throw new Error('形态载荷 Base64 校验失败：'+error.message)}
    const out=new Uint8Array(text.length);
    for(let i=0;i<text.length;i++)out[i]=text.charCodeAt(i);
    return out;
  }

  const encoded=window.__BIRD_FORM;
  if(typeof encoded!=='string'||encoded.length<1000)throw new Error('同仓形态载荷没有完整到达');
  const compressed=base64Bytes(encoded);
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const ab=await new Response(stream).arrayBuffer();
  const dv=new DataView(ab);
  let offset=0;
  const need=(n,label)=>{if(offset+n>dv.byteLength)throw new Error(`${label} 越界`)};
  const u32=(label)=>{need(4,label);const v=dv.getUint32(offset,true);offset+=4;return v};
  const f32=(label)=>{need(4,label);const v=dv.getFloat32(offset,true);offset+=4;return v};

  const vertexCount=u32('顶点数');
  const indexCount=u32('索引数');
  if(vertexCount!==4416||indexCount!==16872)throw new Error(`形态计数不符：${vertexCount} 顶点 / ${indexCount} 索引`);
  const lower=[f32('边界'),f32('边界'),f32('边界')];
  const upper=[f32('边界'),f32('边界'),f32('边界')];
  const positionBytes=u32('位置载荷长度');
  const indexBytes=u32('索引载荷长度');
  const headerBytes=offset;

  function readVarints(count,label){
    const out=new Uint32Array(count);
    for(let i=0;i<count;i++){
      let value=0;
      let shift=0;
      let byte=0;
      do{
        need(1,label);
        byte=dv.getUint8(offset++);
        value+=(byte&127)*(2**shift);
        shift+=7;
        if(shift>49)throw new Error(`${label} varint 过长`);
      }while(byte&128);
      out[i]=value;
    }
    return out;
  }
  const zigzag=(v)=>(v&1)?-((v+1)/2):(v/2);

  const packedPositions=readVarints(vertexCount*3,'位置载荷');
  if(offset!==headerBytes+positionBytes)throw new Error('位置载荷长度不匹配');
  const packedIndices=readVarints(indexCount,'索引载荷');
  if(offset!==headerBytes+positionBytes+indexBytes||offset!==dv.byteLength)throw new Error('索引载荷长度不匹配');

  const positions=new Float32Array(vertexCount*3);
  const previous=[0,0,0];
  for(let i=0;i<packedPositions.length;i++){
    const axis=i%3;
    previous[axis]+=zigzag(packedPositions[i]);
    positions[i]=lower[axis]+(previous[axis]/65535)*(upper[axis]-lower[axis]);
  }

  const indices=new Uint16Array(indexCount);
  let previousIndex=0;
  for(let i=0;i<indexCount;i++){
    previousIndex+=zigzag(packedIndices[i]);
    if(previousIndex<0||previousIndex>=vertexCount)throw new Error(`索引越界：${previousIndex}`);
    indices[i]=previousIndex;
  }

  const normals=new Float32Array(positions.length);
  for(let i=0;i<indexCount;i+=3){
    const ia=indices[i]*3,ib=indices[i+1]*3,ic=indices[i+2]*3;
    const abx=positions[ib]-positions[ia],aby=positions[ib+1]-positions[ia+1],abz=positions[ib+2]-positions[ia+2];
    const acx=positions[ic]-positions[ia],acy=positions[ic+1]-positions[ia+1],acz=positions[ic+2]-positions[ia+2];
    const nx=aby*acz-abz*acy,ny=abz*acx-abx*acz,nz=abx*acy-aby*acx;
    for(const k of[ia,ib,ic]){normals[k]+=nx;normals[k+1]+=ny;normals[k+2]+=nz}
  }
  for(let i=0;i<normals.length;i+=3){
    const length=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
    normals[i]/=length;normals[i+1]/=length;normals[i+2]/=length;
  }

  const wireIndices=new Uint16Array(indexCount*2);
  for(let i=0,j=0;i<indexCount;i+=3){
    const a=indices[i],b=indices[i+1],c=indices[i+2];
    wireIndices[j++]=a;wireIndices[j++]=b;
    wireIndices[j++]=b;wireIndices[j++]=c;
    wireIndices[j++]=c;wireIndices[j++]=a;
  }

  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});
  if(!gl)throw new Error('浏览器没有可用 WebGL');
  canvas.addEventListener('webglcontextlost',(event)=>{event.preventDefault();fail('WebGL 上下文丢失，请刷新页面')});

  function compile(type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error('着色器编译失败：'+gl.getShaderInfoLog(shader));
    return shader;
  }
  function link(vertex,fragment){
    const program=gl.createProgram();
    gl.attachShader(program,compile(gl.VERTEX_SHADER,vertex));
    gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('着色器链接失败：'+gl.getProgramInfoLog(program));
    return program;
  }

  const solidProgram=link(
    'attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uMvp;varying vec3 vNormal;void main(){vNormal=aNormal;gl_Position=uMvp*vec4(aPosition,1.0);}',
    'precision mediump float;varying vec3 vNormal;void main(){vec3 n=normalize(vNormal);vec3 key=normalize(vec3(0.55,0.86,0.62));vec3 fill=normalize(vec3(-0.35,0.28,-0.88));float a=max(dot(n,key),0.0);float b=max(dot(n,fill),0.0);float rim=pow(1.0-abs(n.z),2.0);vec3 base=vec3(0.62,0.66,0.67);vec3 color=base*(0.55+0.58*a+0.20*b)+vec3(0.18,0.22,0.23)*rim;gl_FragColor=vec4(color,1.0);}'
  );
  const wireProgram=link(
    'attribute vec3 aPosition;uniform mat4 uMvp;void main(){gl_Position=uMvp*vec4(aPosition,1.0);}',
    'precision mediump float;void main(){gl_FragColor=vec4(0.15,0.68,0.90,0.50);}'
  );

  function makeBuffer(data,target=gl.ARRAY_BUFFER){
    const buffer=gl.createBuffer();
    gl.bindBuffer(target,buffer);
    gl.bufferData(target,data,gl.STATIC_DRAW);
    return buffer;
  }
  const positionBuffer=makeBuffer(positions);
  const normalBuffer=makeBuffer(normals);
  const indexBuffer=makeBuffer(indices,gl.ELEMENT_ARRAY_BUFFER);
  const wireBuffer=makeBuffer(wireIndices,gl.ELEMENT_ARRAY_BUFFER);

  const identity=()=>{const m=new Float32Array(16);m[0]=m[5]=m[10]=m[15]=1;return m};
  function multiply(a,b){
    const out=new Float32Array(16);
    for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }
  function perspective(fov,aspect,near,far){
    const f=1/Math.tan(fov/2),m=new Float32Array(16);
    m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=(2*far*near)/(near-far);
    return m;
  }
  const normalize=(v)=>{const length=Math.hypot(...v)||1;return v.map(x=>x/length)};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function lookAt(eye,target,up){
    const z=normalize(eye.map((x,i)=>x-target[i]));
    const x=normalize(cross(up,z));
    const y=cross(z,x);
    const m=identity();
    m[0]=x[0];m[1]=y[0];m[2]=z[0];
    m[4]=x[1];m[5]=y[1];m[6]=z[1];
    m[8]=x[2];m[9]=y[2];m[10]=z[2];
    m[12]=-(x[0]*eye[0]+x[1]*eye[1]+x[2]*eye[2]);
    m[13]=-(y[0]*eye[0]+y[1]*eye[1]+y[2]*eye[2]);
    m[14]=-(z[0]*eye[0]+z[1]*eye[1]+z[2]*eye[2]);
    return m;
  }

  const target=[(lower[0]+upper[0])/2,(lower[1]+upper[1])/2,(lower[2]+upper[2])/2];
  const extent=[upper[0]-lower[0],upper[1]-lower[1],upper[2]-lower[2]];
  const radius=Math.max(0.1,Math.hypot(...extent)/2);
  const baseDistance=radius*2.75;
  let yaw=0.74,pitch=0.30,distance=baseDistance,view='persp',wire=false,dragging=false,lastX=0,lastY=0;
  const directions={
    top:[[0,1,0],[0,0,-1]],
    bottom:[[0,-1,0],[0,0,1]],
    front:[[0,0,1],[0,1,0]],
    back:[[0,0,-1],[0,1,0]],
    side:[[1,0,0],[0,1,0]],
  };

  function resize(){
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const width=Math.max(1,Math.floor(canvas.clientWidth*dpr));
    const height=Math.max(1,Math.floor(canvas.clientHeight*dpr));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height}
    gl.viewport(0,0,width,height);
  }
  function camera(){
    const aspect=Math.max(0.01,canvas.width/canvas.height);
    const fov=0.55;
    let eye,up;
    if(view==='persp'){
      const portraitBoost=Math.max(1,0.80/aspect);
      const d=distance*portraitBoost;
      const cp=Math.cos(pitch);
      eye=[target[0]+d*cp*Math.sin(yaw),target[1]+d*Math.sin(pitch),target[2]+d*cp*Math.cos(yaw)];
      up=[0,1,0];
    }else{
      const [dir,fixedUp]=directions[view];
      const d=baseDistance*Math.max(1,0.80/aspect);
      eye=[target[0]+dir[0]*d,target[1]+dir[1]*d,target[2]+dir[2]*d];
      up=fixedUp;
    }
    return {eye,viewMatrix:lookAt(eye,target,up),projection:perspective(fov,aspect,Math.max(0.001,radius*0.01),radius*20)};
  }
  function attribute(program,name,buffer,size){
    const location=gl.getAttribLocation(program,name);
    if(location<0)throw new Error('缺少顶点属性：'+name);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);
  }

  function draw(){
    resize();
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.035,0.060,0.075,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const {viewMatrix,projection}=camera();
    const mvp=multiply(projection,viewMatrix);

    gl.useProgram(solidProgram);
    attribute(solidProgram,'aPosition',positionBuffer,3);
    attribute(solidProgram,'aNormal',normalBuffer,3);
    gl.uniformMatrix4fv(gl.getUniformLocation(solidProgram,'uMvp'),false,mvp);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);
    gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);

    if(wire){
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(wireProgram);
      attribute(wireProgram,'aPosition',positionBuffer,3);
      gl.uniformMatrix4fv(gl.getUniformLocation(wireProgram,'uMvp'),false,mvp);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,wireBuffer);
      gl.drawElements(gl.LINES,wireIndices.length,gl.UNSIGNED_SHORT,0);
      gl.disable(gl.BLEND);
    }
    requestAnimationFrame(draw);
  }

  canvas.addEventListener('pointerdown',(event)=>{dragging=true;lastX=event.clientX;lastY=event.clientY;canvas.setPointerCapture(event.pointerId)});
  canvas.addEventListener('pointerup',()=>{dragging=false});
  canvas.addEventListener('pointercancel',()=>{dragging=false});
  canvas.addEventListener('pointermove',(event)=>{
    if(!dragging)return;
    view='persp';
    yaw+=(event.clientX-lastX)*0.008;
    pitch=Math.max(-1.35,Math.min(1.35,pitch+(event.clientY-lastY)*0.008));
    lastX=event.clientX;lastY=event.clientY;
    document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('active',x.dataset.v==='persp'));
  });
  canvas.addEventListener('wheel',(event)=>{
    event.preventDefault();
    view='persp';
    distance=Math.max(radius*1.45,Math.min(radius*6.5,distance*Math.exp(event.deltaY*0.001)));
    document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('active',x.dataset.v==='persp'));
  },{passive:false});

  document.getElementById('views').addEventListener('click',(event)=>{
    const button=event.target.closest('button[data-v]');
    if(!button)return;
    view=button.dataset.v;
    document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('active',x===button));
  });
  document.getElementById('wire').addEventListener('click',(event)=>{
    wire=!wire;
    event.currentTarget.textContent='线框：'+(wire?'开':'关');
  });
  document.getElementById('reset').addEventListener('click',()=>{
    yaw=0.74;pitch=0.30;distance=baseDistance;view='persp';
    document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('active',x.dataset.v==='persp'));
  });
  document.getElementById('menu').addEventListener('click',()=>document.getElementById('panel').classList.toggle('open'));

  status.textContent=`形态载入完成｜${vertexCount.toLocaleString()} 顶点｜${(indexCount/3).toLocaleString()} 三角面`;
  status.classList.add('ready');
  window.__BIRD_QA={ready:true,vertexCount,indexCount,triangleCount:indexCount/3,bounds:{lower,upper},payloadChars:encoded.length};
  requestAnimationFrame(draw);
}catch(error){
  fail(error.message,error);
}
})();
