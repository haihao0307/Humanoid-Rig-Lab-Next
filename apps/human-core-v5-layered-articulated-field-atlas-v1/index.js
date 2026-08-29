const startLayeredFieldAtlas = () => {
  const boot = window.__HRL_LAYERED_ATLAS_BOOTSTRAP__;
  const canvas = document.querySelector('canvas');
  const poseSelect = document.querySelector('#pose');
  const modeSelect = document.querySelector('#mode');
  const metricsNode = document.querySelector('#metrics');
  const state = window.__HRL_LAYERED_ARTICULATED_FIELD_ATLAS_V1__ = {
    ready: false,
    runtimeMeshAuthority: false,
    runtimeHumanGlbLoaded: false,
    globalInverseWarpEnabled: false,
    visibleHumanEntityCount: 1,
    activeChartCount: boot.atlas.charts.length,
    activeSheetCount: new Set(boot.atlas.charts.map((entry) => entry.sheetId)).size,
    chartMetrics: boot.atlas.charts.map((entry) => ({ chartId: entry.chartId, reinitialization: entry.reinitialization })),
    junctionMetrics: boot.roundReport.ninePose.poses[0].junctionMetrics,
    contactMetrics: boot.atlas.multiSheetContact,
    poseMetrics: boot.roundReport.ninePose.poses,
    rendererBackend: null,
    firstFrameRendered: false,
    consoleErrors: [],
    pageErrors: [],
    startupErrors: [],
    externalHumanAssetRequests: [],
    failedRequests: [],
    task18aR2VisualAcceptance: false,
    visualAcceptance: false,
    productionReady: false,
    userVisualAcceptance: 'pending',
  };
  addEventListener('error', (event) => state.pageErrors.push(String(event.error ?? event.message)));
  const modes = ['field-surface','field-normal','field-chart-regions','field-sheet-ids','junction-regions','contact-sheets','chart-support','chart-obb','junction-gradient','legacy-global-warp-compare','qa-isosurface'];
  const poses = boot.poseStates.poses;
  for (const pose of poses) poseSelect.add(new Option(pose.poseId.replaceAll('_',' '), pose.poseId));
  for (const mode of modes) modeSelect.add(new Option(mode, mode));
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    state.startupErrors.push('WebGL2 context unavailable');
    renderMetrics();
    return;
  }
  state.rendererBackend = 'WebGL2 layered local-field raymarch';
  const program = createProgram(gl, vertexSource, fragmentSource);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const binary = decodeBase64(boot.binaryBase64);
  const payloadOffset = new DataView(binary.buffer, binary.byteOffset, binary.byteLength).getUint32(12, true);
  const payload = new Int16Array(binary.buffer, binary.byteOffset + payloadOffset, (binary.byteLength - payloadOffset) / 2);
  const textureWidth = 2048;
  const textureHeight = Math.ceil(payload.length / textureWidth);
  const padded = new Int16Array(textureWidth * textureHeight);
  padded.set(payload);
  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16I, textureWidth, textureHeight, 0, gl.RED_INTEGER, gl.SHORT, padded);
  const locations = {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    eye: gl.getUniformLocation(program, 'uEye'),
    target: gl.getUniformLocation(program, 'uTarget'),
    mode: gl.getUniformLocation(program, 'uMode'),
    textureWidth: gl.getUniformLocation(program, 'uTextureWidth'),
    grid: gl.getUniformLocation(program, 'uGrid[0]'),
    extents: gl.getUniformLocation(program, 'uExtents[0]'),
    localFromWorld: gl.getUniformLocation(program, 'uLocalFromWorld[0]'),
  };
  gl.useProgram(program);
  gl.uniform1i(gl.getUniformLocation(program, 'uAtlas'), 0);
  gl.uniform1i(locations.textureWidth, textureWidth);
  const grids = new Int32Array(17 * 4);
  const extents = new Float32Array(17 * 3);
  boot.atlas.charts.forEach((chart, index) => {
    grids.set([...chart.grid.dimensions, chart.grid.valueOffset], index * 4);
    extents.set(chart.compactSupportOBB.halfExtents, index * 3);
  });
  gl.uniform4iv(locations.grid, grids);
  gl.uniform3fv(locations.extents, extents);
  let yaw = 0.28, pitch = 0.05, distance = 2.65, dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (event) => { dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (!dragging) return; yaw += (event.clientX-lastX)*.007; pitch = Math.max(-1.1,Math.min(1.1,pitch+(event.clientY-lastY)*.006)); lastX=event.clientX;lastY=event.clientY;draw(); });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (event) => { distance=Math.max(1.4,Math.min(5,distance*Math.exp(event.deltaY*.001)));draw(); }, { passive: true });
  poseSelect.addEventListener('change', draw);
  modeSelect.addEventListener('change', draw);
  addEventListener('resize', draw);
  draw();

  function draw() {
    const width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
    const height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width=width; canvas.height=height; }
    const pose = poses.find((entry) => entry.poseId === poseSelect.value) ?? poses[0];
    const matrices = new Float32Array(17 * 16);
    pose.charts.forEach((chart,index)=>matrices.set(chart.localFromPosedWorld,index*16));
    const eye=[Math.sin(yaw)*Math.cos(pitch)*distance,.12+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance];
    gl.viewport(0,0,width,height);
    gl.useProgram(program);
    gl.uniform2f(locations.resolution,width,height);
    gl.uniform3fv(locations.eye,eye);
    gl.uniform3f(locations.target,0,.05,.06);
    gl.uniform1i(locations.mode,modes.indexOf(modeSelect.value));
    gl.uniformMatrix4fv(locations.localFromWorld,false,matrices);
    gl.drawArrays(gl.TRIANGLES,0,3);
    state.ready=true;
    state.firstFrameRendered=true;
    state.activeChartCount=pose.charts.length;
    state.poseMetrics=boot.roundReport.ninePose.poses.find((entry)=>entry.poseId===pose.poseId) ?? null;
    renderMetrics();
  }
  function renderMetrics(){metricsNode.textContent=JSON.stringify({ready:state.ready,rendererBackend:state.rendererBackend,firstFrameRendered:state.firstFrameRendered,pose:poseSelect.value,mode:modeSelect.value,visibleHumanEntityCount:state.visibleHumanEntityCount,activeChartCount:state.activeChartCount,activeSheetCount:state.activeSheetCount,globalInverseWarpEnabled:state.globalInverseWarpEnabled,runtimeMeshAuthority:state.runtimeMeshAuthority,conclusion:boot.roundReport.conclusion,userVisualAcceptance:state.userVisualAcceptance},null,2);}
  function createProgram(context,vs,fs){const program=context.createProgram(),compile=(type,source)=>{const shader=context.createShader(type);context.shaderSource(shader,source);context.compileShader(shader);if(!context.getShaderParameter(shader,context.COMPILE_STATUS))throw new Error(context.getShaderInfoLog(shader));return shader;};context.attachShader(program,compile(context.VERTEX_SHADER,vs));context.attachShader(program,compile(context.FRAGMENT_SHADER,fs));context.linkProgram(program);if(!context.getProgramParameter(program,context.LINK_STATUS))throw new Error(context.getProgramInfoLog(program));return program;}
  function decodeBase64(value){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);return bytes;}
};

const vertexSource = `#version 300 es
precision highp float;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}`;
const fragmentSource = `#version 300 es
precision highp float;precision highp int;precision highp isampler2D;
out vec4 outColor;uniform vec2 uResolution;uniform vec3 uEye,uTarget;uniform int uMode,uTextureWidth;uniform isampler2D uAtlas;uniform ivec4 uGrid[17];uniform vec3 uExtents[17];uniform mat4 uLocalFromWorld[17];
float gridValue(int i,ivec3 c){ivec4 g=uGrid[i];c=clamp(c,ivec3(0),g.xyz-1);int index=g.w+c.x+g.x*(c.y+g.y*c.z);return float(texelFetch(uAtlas,ivec2(index%uTextureWidth,index/uTextureWidth),0).r)*.00025;}
float chartField(int i,vec3 world,out float support){vec3 local=(uLocalFromWorld[i]*vec4(world,1)).xyz,ext=uExtents[i],q=abs(local)-ext;support=length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);if(support>0.025)return support;vec3 uv=(local+ext)/(2.0*ext),g=uv*vec3(uGrid[i].xyz-1);ivec3 a=ivec3(floor(g)),b=min(a+1,uGrid[i].xyz-1);vec3 t=fract(g);float x00=mix(gridValue(i,ivec3(a.x,a.y,a.z)),gridValue(i,ivec3(b.x,a.y,a.z)),t.x),x10=mix(gridValue(i,ivec3(a.x,b.y,a.z)),gridValue(i,ivec3(b.x,b.y,a.z)),t.x),x01=mix(gridValue(i,ivec3(a.x,a.y,b.z)),gridValue(i,ivec3(b.x,a.y,b.z)),t.x),x11=mix(gridValue(i,ivec3(a.x,b.y,b.z)),gridValue(i,ivec3(b.x,b.y,b.z)),t.x);return mix(mix(x00,x10,t.y),mix(x01,x11,t.y),t.z);}
vec2 scene(vec3 p){float best=1e3;int winner=-1;for(int i=0;i<17;i++){float support;float value=chartField(i,p,support);float candidate=support>0.025?support:abs(value);if(candidate<best){best=candidate;winner=i;}}return vec2(best,float(winner));}
vec3 normalAt(vec3 p){float e=.0015;return normalize(vec3(scene(p+vec3(e,0,0)).x-scene(p-vec3(e,0,0)).x,scene(p+vec3(0,e,0)).x-scene(p-vec3(0,e,0)).x,scene(p+vec3(0,0,e)).x-scene(p-vec3(0,0,e)).x));}
vec3 palette(float id){return .52+.45*cos(6.28318*(vec3(.12,.37,.67)+id*.071));}
void main(){vec2 uv=(gl_FragCoord.xy*2.0-uResolution.xy)/uResolution.y;vec3 f=normalize(uTarget-uEye),r=normalize(cross(f,vec3(0,1,0))),u=cross(r,f),rd=normalize(f+uv.x*r+uv.y*u);float t=0.0;vec2 hit=vec2(1e3,-1);int steps=0;for(int i=0;i<128;i++){steps=i;vec3 p=uEye+rd*t;hit=scene(p);if(hit.x<.0015||t>5.0)break;t+=max(hit.x*.62,.001);}
vec3 color=vec3(.025,.055,.08);if(hit.x<.0015&&t<=5.0){vec3 p=uEye+rd*t,n=normalAt(p),light=normalize(vec3(-.6,.8,.5));float diffuse=.2+.8*max(dot(n,light),0.0),rim=pow(1.0-max(dot(n,-rd),0.0),3.0);if(uMode==1||uMode==8)color=n*.5+.5;else if(uMode==2||uMode==3||uMode==4||uMode==5)color=palette(hit.y);else if(uMode==6||uMode==7)color=mix(vec3(.12,.28,.42),palette(hit.y),.55);else if(uMode==9)color=mix(vec3(.55,.16,.16),vec3(.1,.7,.8),step(8.5,hit.y));else color=vec3(.56,.72,.8)*diffuse+rim*vec3(.35,.65,.9);color*=.78+.22*(1.0-float(steps)/128.0);}
outColor=vec4(pow(color,vec3(.4545)),1);}`;

startLayeredFieldAtlas();
