/* HAT-SURFACE-S1. Source geometry/UV remain attributed reference assets.
 * This module authors surface fields, not a new ownership claim over the carrier.
 * No original image pixels, normal samples or geometry displacement enter the owned material.
 */
(()=>{'use strict';
const $=id=>document.getElementById(id), VERSION='HAT-SURFACE-S1', KEY='kaopu:hat:surface-s1:recipe:1';
const SPEC={
 cable:{kind:0,color:'#c4cbc8',roughness:.90,pitch:2.4,relief:.48,title:'绞花／针圈／分股纤维',note:'原帽冠与翻边不动；绞花由细针圈交叉组成，不用几根几何圆管代替。'},
 fishing:{kind:1,color:'#5b684a',roughness:.82,pitch:.52,relief:.08,title:'帆布／棕色织带',note:'独立连通带区保留；经纬起伏与色差来自同一纱线场。'},
 flatcap:{kind:2,color:'#55524d',roughness:.91,pitch:.65,relief:.09,title:'细人字纹粗花呢',note:'人字斜纹方向交替，混色纱与绒面分开；不更改圆润后冠与短檐。'},
 trilby:{kind:3,color:'#bca05c',roughness:.86,pitch:.42,relief:.035,title:'压毡／点纹织带',note:'冠、檐及既有装饰全部保留；织带区域按连通关系映射，仍待人工精标。'},
 sherpa:{kind:4,color:'#b0ab8e',roughness:.91,pitch:2.0,relief:.35,title:'针织／提花／系带',note:'条带与菱形由针目编号生成；耳片和长系带几何不删减。'},
 patrol:{kind:5,color:'#87876b',roughness:.85,pitch:.46,relief:.075,title:'棉斜纹／程序迷彩',note:'迷彩为重新生成的色块，不是原图改色；帽型与缝合载体不改。'},
 bowler:{kind:6,color:'#292923',roughness:.88,pitch:.35,relief:.025,title:'细毛毡／缎带',note:'毛毡纤维短而交错，不做粗糙石粒；独立帽带有定向反光。'},
 top:{kind:7,color:'#242422',roughness:.73,pitch:.4,relief:.035,title:'黑绒／蓝织带／金属扣',note:'绒面与带饰分别响应光线；金属扣沿用其几何位置。'},
 visor:{kind:8,color:'#e1e0d6',roughness:.81,pitch:.48,relief:.075,title:'棉布／红色包边',note:'空顶与檐的实体关系不改；包边为程序色区，边界精标仍待完善。'},
 cloche:{kind:9,color:'#94b69c',roughness:.86,pitch:.55,relief:.055,title:'印花织物／深色带饰',note:'连续程序印花重新构成，非原图描摹；保留钟口和斜带实体。'},
 chef:{kind:10,color:'#dddcd4',roughness:.91,pitch:.35,relief:.045,title:'细棉布／褶部纤维',note:'不重排、不均匀化原有褶裥；细布纹依附原曲面。'}
};
const DEFAULT={density:1,relief:1,fiber:.65,irregularity:.3,wear:.08,seed:17,color:null};
const RANGES={density:[.65,1.6],relief:[0,1.8],fiber:[0,1],irregularity:[0,.8],wear:[0,1],seed:[1,9999]};
let T,api,active=null,mode='owned',space='source',busy=true,seq=0,eb=null,latest='',recipes={},errors=[],lastBuildMS=0;
const allocated=new WeakMap();
function validated(o){if(!o||typeof o!=='object')throw Error('表面配方必须是对象');const v={...DEFAULT};for(const[k,x]of Object.entries(o)){if(k==='color'){if(x!==null&&!/^#[0-9a-f]{6}$/i.test(x))throw Error('无效颜色');v[k]=x;continue;}if(!RANGES[k]||!Number.isFinite(x)||x<RANGES[k][0]||x>RANGES[k][1])throw Error('表面参数越界 '+k);v[k]=k==='seed'?Math.round(x):x;}return v;}
function current(){const id=active?.asset.meta.id||'cable';return recipes[id]||(recipes[id]={...DEFAULT});}
function persist(){try{localStorage.setItem(KEY,JSON.stringify({schema:'kaopu.hat.surface/1',recipes}));}catch(e){$('surface-state').textContent='此浏览器无法保存配方：'+e.message;}}
const GLSL=`
varying vec3 vPSRest;
varying vec2 vPSUV;
varying float vPSRegion;
uniform float psKind,psDensity,psRelief,psFiber,psIrregularity,psWear,psSeed,psPitch,psDepth,psRough,psMode;
uniform vec3 psColor,psLow,psHigh;
const float PS_TAU=6.28318530718;
float psHash(vec2 p){return fract(sin(dot(p,vec2(73.1569,19.8731))+psSeed*1.61803)*4371.3127);}
float psNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(psHash(i),psHash(i+vec2(1,0)),f.x),mix(psHash(i+vec2(0,1)),psHash(i+vec2(1,1)),f.x),f.y);}
float psFbm(vec2 p){return .57*psNoise(p)+.28*psNoise(p*2.03+19.7)+.15*psNoise(p*4.11-3.4);}
float psAA(float x){return 1.-smoothstep(.18,.75,x);}
float psTube(float d,float r){return sqrt(max(0.,1.-d*d/(r*r)));}
// A needle loop is two curved legs joined by a rounded head, not a sinusoidal rib.
vec3 psStitch(vec2 q,float width){
 vec2 cell=floor(q),f=fract(q);float row=psHash(cell),y=f.y;
 float bow=.12+.235*sin(3.141593*clamp(y*.88+.1,0.,1.));
 float dx=abs(abs(f.x-.5)-bow);
 float body=psTube(dx,width);
 float head=psTube(abs(length(vec2((f.x-.5)*1.0,(y-.94)*1.45))-.20),width*.76);
 float h=max(body*(.81+.15*sin(y*3.14159)),head*.84);
 float ply=.5+.5*cos((y*2.7+abs(f.x-.5)*3.6+cell.x*.31)*PS_TAU);
 float small=psAA(max(length(dFdx(q)),length(dFdy(q))));
 h=mix(.43,h,small);
 return vec3(h*(1.+psIrregularity*.10*(row-.5)),mix(.58,ply,small),row);
}
// 2/2 over-under twill, optionally reversing direction in narrow herringbone bands.
vec3 psWeave(vec2 q,float herring){
 float flip=mix(1.,mod(floor(q.x/9.),2.)<1.?1.:-1.,herring);
 vec2 f=fract(q),c=floor(q);float over=mod(c.x+flip*c.y,4.)<2.?1.:0.;
 float warp=psTube(f.x-.5,.43),weft=psTube(f.y-.5,.43);
 float h=mix(weft,warp,over),ply=.5+.5*cos((mix(q.x,q.y,over)*3.1+mix(q.y,q.x,over)*.36)*PS_TAU);
 float aa=psAA(max(length(dFdx(q)),length(dFdy(q))));
 return vec3(mix(.7,h,aa),mix(.5,ply,aa),mix(.5,psHash(c),aa));
}
vec3 psField(out float height,out float rough){
 vec3 p=vPSRest;vec3 span=max(psHigh-psLow,vec3(.001));vec3 pn=(p-psLow)/span;
 vec2 uv=vPSUV;vec2 flat=uv*vec2(.51,.34);float rgn=floor(vPSRegion+.1);
 float large=psFbm(flat*27.);float micro=psNoise(flat*3700.);
 float grainAA=psAA(max(length(dFdx(flat*3700.)),length(dFdy(flat*3700.))));
 micro=mix(.5,micro,grainAA);
 vec3 col=psColor;vec3 yarn=vec3(.65,.5,.5);float band=0.;height=0.;rough=psRough;
 if(psKind<.5){
  vec2 a=uv-vec2(.5,.512);float rad=length(a),theta=atan(a.y,a.x)/PS_TAU+.5;
  float repeats=floor(10.*psDensity+.5),columns=repeats*12.;
  vec2 q=vec2(theta*columns,rad*153.*psDensity);
  q.y+=psIrregularity*.12*sin(theta*PS_TAU*3.+rad*11.);
  float cuff=1.-smoothstep(.18,.25,pn.y);
  vec3 rib=psStitch(vec2(q.x,q.y),.135);
  float x=mod(q.x,12.)-6.,phase=q.y*PS_TAU/14.,s=sin(phase),a1=-1.25*s,a2=1.25*s;
  vec3 k1=psStitch(vec2(x-a1+20.,q.y+.20*cos(phase)),.15);
  vec3 k2=psStitch(vec2(x-a2+20.,q.y-.20*cos(phase)),.15);
  float m1=1.-smoothstep(1.28,1.62,abs(x-a1)),m2=1.-smoothstep(1.28,1.62,abs(x-a2));
  float h1=m1*(.48+.40*k1.x+.12*cos(phase)),h2=m2*(.48+.40*k2.x-.12*cos(phase));
  float cable=max(h1,h2),m=max(m1,m2),win=step(h1,h2);
  vec3 woven=mix(rib,vec3(cable,mix(k1.y,k2.y,win),mix(k1.z,k2.z,win)),m);
  float ribLane=.75+.25*smoothstep(.05,.30,abs(fract(q.x*.5)-.5));
  yarn=mix(woven,vec3(rib.x*ribLane,rib.yz),cuff);
  float pole=smoothstep(.006,.03,rad);yarn.x=mix(.55,yarn.x,pole);
  height=psDepth*(.75*yarn.x+.11*yarn.y*psFiber);
  col*=.77+.24*yarn.x+.035*(yarn.y-.5)*psFiber;
 }else if(abs(psKind-4.)<.5){
  vec2 q=flat/(psPitch/1000.)*psDensity;yarn=psStitch(q,.14);height=psDepth*(yarn.x+.08*yarn.y*psFiber);
  float stripe=mod(floor((p.y-.69)*350.),16.);vec3 dark=vec3(.115,.15,.135),blue=vec3(.13,.21,.23),red=vec3(.31,.13,.095);
  if(stripe<2.)col=dark;else if(stripe<4.)col=blue;
  float theta=atan(p.z-.057,p.x)/PS_TAU+.5;vec2 d=abs(fract(vec2(theta*12.,(p.y-.765)*34.))-.5);
  float diamond=1.-smoothstep(.31,.38,d.x+d.y);float zone=smoothstep(.735,.755,p.y)*(1.-smoothstep(.82,.835,p.y));
  col=mix(col,mod(floor(theta*12.),2.)<1.?red:blue,diamond*zone);
  col*=.82+.22*yarn.x;
 }else if(psKind<2.5||abs(psKind-5.)<.5||abs(psKind-8.)<.5||psKind>9.5){
  yarn=psWeave(flat/(psPitch/1000.)*psDensity,abs(psKind-2.)<.5?1.:0.);
  height=psDepth*(yarn.x+.13*yarn.y*psFiber);
  if(abs(psKind-1.)<.5&&rgn>.5){col=vec3(.105,.07,.044);rough=.83;}
  if(abs(psKind-2.)<.5)col*=.76+.42*yarn.z;
  if(abs(psKind-5.)<.5){float n=psFbm(flat*42.+vec2(psNoise(flat*28.)*3.));col=mix(vec3(.24,.255,.17),vec3(.36,.35,.245),smoothstep(.36,.41,n));col=mix(col,vec3(.115,.15,.112),smoothstep(.57,.60,n));col=mix(col,vec3(.38,.375,.28),smoothstep(.71,.73,n));col*=psColor/vec3(.242,.242,.147);}
  if(abs(psKind-8.)<.5){float edge=smoothstep(.85,.93,pn.y)*(1.-smoothstep(.46,.58,pn.z));col=mix(col,vec3(.58,.047,.021),edge);}
  col*=.87+.16*yarn.x;
 }else{
  vec2 fq=flat*2100.*psDensity;float aa=psAA(max(length(dFdx(fq)),length(dFdy(fq))));
  float fibers=.5+.5*sin((fq.x+psNoise(fq*.09)*5.)*PS_TAU);
  float crossFiber=.5+.5*sin((fq.y*.7-fq.x*.6+psNoise(fq*.07)*3.)*PS_TAU);
  float felt=mix(.5,.55*fibers+.45*crossFiber,aa);height=psDepth*(felt*.75+micro*.25)*psFiber;
  yarn=vec3(felt,.5,micro);col*=.95+.06*(micro-.5);
  if(abs(psKind-3.)<.5&&rgn>3.5){band=1.;col=vec3(.11,.085,.047);vec2 dots=fract(flat*290.);float dotMask=1.-smoothstep(.09,.16,length(dots-.5));col=mix(col,vec3(.36,.31,.18),dotMask*.55);}
  if(abs(psKind-6.)<.5&&rgn>.5){band=1.;col=psColor*.58;}
  if(abs(psKind-7.)<.5&&rgn>.5){band=1.;col=rgn>1.5?vec3(.62,.45,.05):vec3(.032,.065,.32);rough=rgn>1.5?.32:.57;}
  if(abs(psKind-9.)<.5){float n=psFbm(flat*78.);float line=1.-smoothstep(.025,.055,abs(n-.5));col=mix(col,vec3(.05,.10,.059),line*.93);if(rgn>.5){band=1.;col=vec3(.042,.055,.036);}}
  if(band>.5){yarn=psWeave(flat/.00042*psDensity,0.);height=psDepth*(.3*yarn.x+.1*yarn.y);col*=.89+.13*yarn.x;rough=min(rough,.65);}
 }
 float weather=psWear*(.45*large+.55*psFbm(flat*9.+7.));
 col*=1.+psIrregularity*.09*(large-.5)+psFiber*.025*(micro-.5);
 col=mix(col,col*1.16+vec3(.018,.013,.008),weather*.35);
 height*=psRelief*(1.-psWear*.25);rough=clamp(rough+.07*(1.-yarn.x)+.035*(micro-.5)+weather*.035,.4,.98);
 return max(col,vec3(.001));
}
`;
function regionAttribute(a){
 const mesh=a.mesh,parent=new Uint32Array(mesh.groupCount);for(let i=0;i<parent.length;i++)parent[i]=i;
 const root=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
 const ix=mesh.index,group=mesh.groups;
 for(let i=0;i<ix.length;i+=3){const r=root(group[ix[i]]);parent[root(group[ix[i+1]])]=r;parent[root(group[ix[i+2]])]=r;}
 const count=new Map();for(let i=0;i<parent.length;i++){const r=root(i);count.set(r,(count.get(r)||0)+1);}
 const rank=new Map([...count].sort((a,b)=>b[1]-a[1]).map(([r],i)=>[r,i]));
 const out=new Float32Array(group.length);for(let i=0;i<out.length;i++)out[i]=rank.get(root(group[i]));
 return {attribute:new T.BufferAttribute(out,1),components:[...count].sort((a,b)=>b[1]-a[1]).map(([r,n],i)=>({rank:i,vertices:n}))};
}
function materialFor(a){
 if(allocated.has(a))return allocated.get(a);
 const start=performance.now(),s=SPEC[a.meta.id],regions=regionAttribute(a);
 a.geometry.setAttribute('psRest',new T.BufferAttribute(new Float32Array(a.mesh.position),3));a.geometry.setAttribute('psRegion',regions.attribute);
 const uniforms={psKind:{value:s.kind},psDensity:{value:1},psRelief:{value:1},psFiber:{value:.65},psIrregularity:{value:.3},psWear:{value:.08},psSeed:{value:17},psPitch:{value:s.pitch},psDepth:{value:s.relief/1000},psRough:{value:s.roughness},psMode:{value:0},psColor:{value:new T.Color(s.color)},psLow:{value:new T.Vector3(...a.meta.sourceBounds[0])},psHigh:{value:new T.Vector3(...a.meta.sourceBounds[1])}};
 const mat=new T.MeshPhysicalMaterial({color:0xffffff,roughness:s.roughness,metalness:0,side:T.DoubleSide,sheen:.44,sheenColor:new T.Color('#c2bfad'),sheenRoughness:.87,specularIntensity:.22,envMapIntensity:.45});
 mat.name=VERSION+' / '+a.meta.id;mat.userData.surfaceOrigin='analytic-no-source-pixels';
 mat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 psRest;attribute float psRegion;varying vec3 vPSRest;varying vec2 vPSUV;varying float vPSRegion;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPSRest=psRest;vPSUV=uv;vPSRegion=psRegion;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+GLSL);
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','float psH,psR;vec3 psAlbedo=psField(psH,psR);diffuseColor.rgb=psAlbedo;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=psR;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','float metalnessFactor=(abs(psKind-7.)<.5&&vPSRegion>1.5)?.7:0.;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`// Surface gradient in the deformed view-space tangent plane (millimetre field).
vec3 psDx=dFdx(-vViewPosition),psDy=dFdy(-vViewPosition);
vec3 psR1=cross(psDy,normal),psR2=cross(normal,psDx);
float psDet=dot(psDx,psR1);
vec3 psGrad=dFdx(psH)*psR1+dFdy(psH)*psR2;
normal=normalize(abs(psDet)*normal-sign(psDet)*psGrad+normal*1.e-20);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
if(psMode>.5&&psMode<1.5)gl_FragColor=vec4(sqrt(max(psAlbedo,vec3(0.))),1.);
if(psMode>1.5&&psMode<2.5)gl_FragColor=vec4(vec3(clamp(psH/max(psDepth*1.8,.000001),0.,1.)),1.);
if(psMode>2.5&&psMode<3.5)gl_FragColor=vec4(vec3(psR),1.);
if(psMode>3.5)gl_FragColor=vec4(normal*.5+.5,1.);`);
 };
 mat.customProgramCacheKey=()=>VERSION+'-field-v1';
 const clay=new T.MeshStandardMaterial({color:'#b6b3ab',roughness:.9,side:T.DoubleSide});
 const rec={material:mat,clay,uniforms,components:regions.components};allocated.set(a,rec);
 a.geometry.addEventListener('dispose',()=>{mat.dispose();clay.dispose();});lastBuildMS=performance.now()-start;return rec;
}
function updateUniforms(){if(!active)return;const rec=materialFor(active.asset),s=SPEC[active.asset.meta.id],v=current();for(const k of Object.keys(RANGES))rec.uniforms['ps'+k[0].toUpperCase()+k.slice(1)].value=v[k];rec.uniforms.psColor.value.set(v.color||s.color);rec.uniforms.psMode.value=({color:1,height:2,roughness:3,normal:4})[mode]||0;}
function beforeRender(){if(!active||!api?.ready())return;const now=api.debugParts();if(now.asset!==active.asset)return;eb?.ensure();const rec=materialFor(active.asset);if(mode==='reference')now.hat.material=now.asset.material;else now.hat.material=mode==='shape'?rec.clay:rec.material;}
function info(){
 if(!active)return;const id=active.asset.meta.id,s=SPEC[id],rec=materialFor(active.asset),v=current();
 $('surface-name').textContent=s.title;$('surface-note').textContent=s.note;
 $('surface-state').textContent=mode==='reference'?(active.asset.meta.normalSource&&!active.asset.maps.normal?'参考原色已显示，高清法线加载中；尚非完整参考。':'原表面参考；与程序表面共用当前 EB1 灯光与几何。'):'自有程序表面：不采样原颜色图或原法线图；几何与 UV 仍是署名参考载体。';
 $('surface-stats').textContent=`${api.metrics().vertices.toLocaleString()} 顶点 · 表面切换不增面 · ${rec.components.length} 连通区域 · ${lastBuildMS.toFixed(1)} ms 字段准备（不含首编译）`;
 $('surface-mode').value=mode;$('surface-space').value=space;
 for(const k of Object.keys(RANGES)){if($('ps-'+k)){$('ps-'+k).value=v[k];$('ps-'+k+'-v').textContent=k==='seed'?v[k]:v[k].toFixed(2);}}
 $('ps-color').value=v.color||s.color;
 $('build-id').textContent='SURFACE S1 · '+(globalThis.HAT_SURFACE_BUILD?.sourceSha||'LOCAL').slice(0,8)+' · EB1 1.1';
}
function setMode(value){if(!['owned','reference','shape','color','height','roughness','normal'].includes(value))throw Error('未知表面观察模式');mode=value;globalThis.HAT_SURFACE_OWNED=value!=='reference';if(value==='reference'&&active?.asset.meta.normalSource&&!active.asset.maps.normal)api.retryDetail();updateUniforms();beforeRender();info();api.render();return snapshot();}
function setParameters(p){const v=validated({...current(),...p});recipes[active.asset.meta.id]=v;updateUniforms();info();persist();api.render();return snapshot();}
async function choose(id){
 if(!SPEC[id])throw Error('未知帽型');const mine=++seq;busy=true;
 try{await api.select(id);if(mine!==seq)return;await api.set({repair:space==='fitted',view:'product',layer:'material',textureMode:'source',useCustomColor:false,dye:'original',roughness:.86,detail:1,sheen:.65});if(mine!==seq)return;active=api.debugParts();materialFor(active.asset);updateUniforms();if(eb){active.hat.updateMatrixWorld(true);const b=new T.Box3().setFromObject(active.hat);eb.setBounds(b.getCenter(new T.Vector3()).toArray(),Math.max(b.getSize(new T.Vector3()).length()*.7,.3));}api.frame('three');beforeRender();info();api.render();}
 catch(e){if(e.name!=='AbortError'){errors.push(e.message);$('surface-state').textContent='未完成：'+e.message;throw e;}}
 finally{if(mine===seq)busy=false;}
}
async function setSpace(value){if(!['source','fitted'].includes(value))throw Error('未知空间');space=value;await api.set({repair:value==='fitted'});active=api.debugParts();updateUniforms();beforeRender();info();api.frame('three');api.render();return snapshot();}
function snapshot(){if(!active)return{ready:false};const rec=materialFor(active.asset);return{version:VERSION,sourceSha:globalThis.HAT_SURFACE_BUILD?.sourceSha,hat:active.asset.meta.id,mode,space,parameters:{...current()},geometryHash:api.geometryHash(),camera:api.cameraPose(),triangles:api.metrics().triangles,surfaceTextures:0,surfaceMaps:{map:!!rec.material.map,normalMap:!!rec.material.normalMap,bumpMap:!!rec.material.bumpMap,roughnessMap:!!rec.material.roughnessMap},restBinding:active.asset.geometry.getAttribute('psRest').count,components:rec.components,attribution:{author:active.asset.meta.author,licence:active.asset.meta.licence,geometry:'reference retained',surface:'authored analytic field'},lighting:eb?.audit()||null,referenceNormalReady:!!active.asset.maps.normal,filmReady:false,equivalentToSource:false,errors:[...errors]};}
function mount(){
 api=window.hatLab;T=globalThis.__hatEngine.THREE;active=api.debugParts();
 try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved?.schema==='kaopu.hat.surface/1')for(const[id,v]of Object.entries(saved.recipes))if(SPEC[id])recipes[id]=validated(v);}catch(e){errors.push('保存配方未采用：'+e.message);}
 const panel=document.createElement('section');panel.id='surface-panel';
 const sliders=[['density','针目／织纹密度',.65,1.6,.05],['relief','起伏深度',0,1.8,.05],['fiber','分股纤维',0,1,.05],['irregularity','自然不均匀',0,.8,.05],['wear','使用磨耗',0,1,.05]];
 panel.innerHTML=`<p class="surface-kicker">SHAPE-BOUND SURFACE / S1</p><h1>程序表面重建</h1><p class="surface-warning">帽形保留 · 表面独立生成 · 尚待视觉验收</p><label>观察层<select id="surface-mode"><option value="owned">自有程序表面</option><option value="reference">原表面参考（同 EB1 光照）</option><option value="shape">只看原帽形</option><option value="color">程序颜色场</option><option value="height">程序高度场</option><option value="roughness">程序粗糙度场</option><option value="normal">程序着色法线</option></select></label><div class="surface-buttons">${['three','front','side','back','top','inside','detail'].map((v,i)=>`<button data-view="${v}">${['全貌','正面','侧面','背面','顶部','内侧','近景'][i]}</button>`).join('')}</div><h2 id="surface-name"></h2><p id="surface-state" role="status"></p><p id="surface-note"></p><label>绑定空间<select id="surface-space"><option value="source">原帽形（冻结对照）</option><option value="fitted">既有量头适配（绑定测试）</option></select></label><p class="surface-small">适配时保留材质坐标，纹理随曲面伸缩；不是物理织造或帽形重建。</p>${sliders.map(([k,n,a,b,s])=>`<label>${n}<output id="ps-${k}-v"></output><input id="ps-${k}" type="range" min="${a}" max="${b}" step="${s}"></label>`).join('')}<label>纱线／底色 <input id="ps-color" type="color"></label><label>变化种子<output id="ps-seed-v"></output><input id="ps-seed" type="number" min="1" max="9999" step="1" value="17"></label><div class="surface-buttons"><button id="ps-natural">自然</button><button id="ps-clean">紧密新料</button><button id="ps-worn">旧料</button><button id="ps-reset">恢复本款</button></div><p id="surface-stats" class="surface-small"></p><details><summary>配方与来源边界</summary><p>当前改的是表面函数。原帽形、控制网、UV、原参考材质仍保留其作者和许可，不因重写表面变成整顶帽子原创。</p><p>高度场只改变着色法线，不改变轮廓、真实自遮挡或毛羽剪影。十一款均可运行，但区域边界、花纹等效及实机性能仍需逐款审查。</p><button id="ps-copy">显示可复制配方</button><textarea id="ps-json" hidden spellcheck="false"></textarea></details>`;
 document.querySelector('.right').prepend(panel);document.title='KAOPU · 程序表面重建 S1';document.querySelector('.catalogue-note').textContent='十一款原帽形保留。缩略图为原版参考；点击查看程序表面候选。';
 $('surface-mode').onchange=e=>setMode(e.target.value);$('surface-space').onchange=e=>setSpace(e.target.value).catch(e=>errors.push(e.message));
 for(const[k]of sliders)$('ps-'+k).oninput=e=>setParameters({[k]:Number(e.target.value)});
 $('ps-seed').onchange=e=>{try{setParameters({seed:Number(e.target.value)});}catch(e){$('surface-state').textContent=e.message;}};$('ps-color').oninput=e=>setParameters({color:e.target.value});
 for(const b of panel.querySelectorAll('[data-view]'))b.onclick=()=>api.frame(b.dataset.view);
 $('ps-natural').onclick=()=>setParameters({density:1,relief:1,fiber:.65,irregularity:.3,wear:.08});$('ps-clean').onclick=()=>setParameters({density:1.2,relief:.75,fiber:.45,irregularity:.15,wear:0});$('ps-worn').onclick=()=>setParameters({density:1,relief:.85,fiber:.85,irregularity:.6,wear:.65});$('ps-reset').onclick=()=>setParameters(DEFAULT);
 $('ps-copy').onclick=()=>{const box=$('ps-json');box.hidden=false;box.value=JSON.stringify({schema:'kaopu.hat.surface/1',hat:active.asset.meta.id,parameters:current(),geometrySource:globalThis.HAT_SURFACE_BUILD?.baseSha},null,2);};
 $('catalogue').addEventListener('click',e=>{const b=e.target.closest('.hat-card');if(b){e.stopImmediatePropagation();void choose(b.dataset.id).catch(()=>{});}},true);
 if(globalThis.KAOPU_EB1){const p=api.debugParts();eb=KAOPU_EB1.attachThree(T,{renderer:p.renderer,scene:p.scene,center:[0,.11,0],radius:.35,requestRender:()=>{},ui:true});p.scene.fog=null;}
 globalThis.__hatSurfaceBeforeRender=beforeRender;
 window.hatSurface={ready:()=>!busy&&!!active&&api.ready(),select:choose,mode:setMode,space:setSpace,set:setParameters,snapshot,recipe:()=>({schema:'kaopu.hat.surface/1',hat:active.asset.meta.id,parameters:{...current()}}),restore:async r=>{if(r?.schema!=='kaopu.hat.surface/1'||!SPEC[r.hat])throw Error('配方版本或帽型不匹配');const p=validated(r.parameters);await choose(r.hat);return setParameters(p);},specs:()=>SPEC,render:()=>api.render()};
 const wanted=new URLSearchParams(location.hash.slice(1)).get('hat')||'cable';void choose(SPEC[wanted]?wanted:'cable').catch(()=>{});
 setInterval(()=>{if(!active||busy)return;const s=mode+':'+active.asset.meta.id+':'+active.asset.detailState;if(s!==latest){latest=s;info();}},500);
}
globalThis.HAT_SURFACE_OWNED=true;const start=performance.now(),timer=setInterval(()=>{if(window.hatLab?.ready()){clearInterval(timer);try{mount();}catch(e){console.error(e);errors.push(e.message);}}else if(performance.now()-start>120000){clearInterval(timer);console.error('程序表面未取得就绪的帽子载体');}},100);
})();
