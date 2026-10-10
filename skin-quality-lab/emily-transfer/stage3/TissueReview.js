import * as THREE from 'three';
import {STAGE3_BASELINE} from './ChartEyes.js';
const MODES={gray:0,grid:1,material:2,strain:3,regions:4};
const declarations=`
uniform float uS3Mode;uniform sampler2D uS3Color,uS3Normal,uS3Surface;
varying vec2 vS3Chart,vS3Asset,vS3Donor;varying vec4 vS3Region,vS3Strain;
float s3Line(vec2 mm){vec2 d=abs(fract(mm-.5)-.5)/max(fwidth(mm),vec2(.001));return 1.-clamp(min(d.x,d.y),0.,1.);}
vec3 s3NormalAt(vec2 uv){vec3 n=texture2D(uS3Normal,uv).xyz*2.-1.;vec3 broad=textureLod(uS3Normal,uv,2.).xyz*2.-1.;return normalize(vec3((n.xy-broad.xy)*.35,1.));}
vec3 s3TangentNormal(vec3 n,vec3 detail,vec2 uv){
 vec3 p=dFdx(-vViewPosition),q=dFdy(-vViewPosition);vec2 a=dFdx(uv),b=dFdy(uv);
 vec3 qp=cross(q,n),pp=cross(n,p),T=qp*a.x+pp*b.x,B=qp*a.y+pp*b.y;
 float scale=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-20));return normalize(mat3(T*scale,B*scale,n)*detail);
}
`;
function installMaterial(m,host,mode){
 const before=m.onBeforeCompile,old=m.customProgramCacheKey();
 m.onBeforeCompile=s=>{
  before(s);Object.assign(s.uniforms,{uS3Mode:mode,uS3Color:{value:host.skin.map},uS3Normal:{value:host.skin.normalMap},uS3Surface:{value:host.surface}});
  s.vertexShader='attribute vec2 s3Chart,s3AssetUV,s3DonorUV;attribute vec4 s3Region,s3Strain;varying vec2 vS3Chart,vS3Asset,vS3Donor;varying vec4 vS3Region,vS3Strain;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvS3Chart=s3Chart;vS3Asset=s3AssetUV;vS3Donor=s3DonorUV;vS3Region=s3Region;vS3Strain=s3Strain;');
  s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\n'+declarations);
  s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
   if(uS3Mode>.5&&uS3Mode<1.5){float grid=s3Line(vS3Chart);float major=s3Line(vS3Chart/5.);diffuseColor.rgb=mix(vec3(.49),vec3(.055),max(grid*.80,major));}
   if(uS3Mode>1.5&&uS3Mode<2.5){
    vec3 base=texture2D(uS3Color,vS3Asset).rgb,donor=texture2D(uS3Color,vS3Donor).rgb;
    diffuseColor.rgb=mix(base,donor,clamp(vS3Region.x,0.,1.));
    diffuseColor.rgb*=mix(vec3(1.),vec3(1.02,.73,.70),vS3Region.y*.7);
   }
   if(uS3Mode>2.5&&uS3Mode<3.5){float compression=clamp(1.-vS3Strain.x,0.,1.),extension=clamp((vS3Strain.y-1.)*.7,0.,1.);diffuseColor.rgb=mix(vec3(.13,.42,.23),vec3(.035,.17,.75),compression);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.065,.025),extension);}
   if(uS3Mode>3.5){vec3 skin=mix(vec3(.38,.46,.52),vec3(.53,.41,.24),vS3Region.z);diffuseColor.rgb=mix(skin,vec3(.36,.13,.19),vS3Region.y);}
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   if(uS3Mode>1.5&&uS3Mode<2.5){
    vec3 a=s3NormalAt(vS3Asset),b=s3NormalAt(vS3Donor);
    float densityGuard=1.-smoothstep(1.8,3.5,max(vS3Strain.y,1./max(vS3Strain.x,.1)));
    float gain=(1.-vS3Region.y)*mix(1.,.35,vS3Region.z)*densityGuard;
    vec3 na=s3TangentNormal(normal,a,vS3Asset),nb=s3TangentNormal(normal,b,vS3Donor);
    normal=normalize(mix(normal,normalize(mix(na,nb,vS3Region.x)),gain));
   }
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
   if(uS3Mode>1.5&&uS3Mode<2.5){float a=texture2D(uS3Surface,vS3Asset).g,b=texture2D(uS3Surface,vS3Donor).g;float r=mix(a,b,vS3Region.x);roughnessFactor=mix(clamp(.60+(r-.5)*.15,.5,.8),.65,vS3Region.y);}
  `);
 };
 m.userData.s3CommonChannels=true;m.customProgramCacheKey=()=>old+'/ET10-rest-chart-v1';m.needsUpdate=true;
}
export function createTissueReview(host,gray){
 const {rig,mesh,camera,controls,state,requestRender}=host,U={value:0};
 for(const b of rig.chartBindings)installMaterial(b.mesh.material,host,U);
 const oldPanel=document.getElementById('s2Panel'),parent=oldPanel.parentElement,legacy=document.createElement('details');legacy.className='s1-legacy';legacy.innerHTML='<summary>第二阶段结构检查（保留）</summary>';oldPanel.replaceWith(legacy);legacy.appendChild(oldPanel);
 const panel=document.createElement('section');panel.className='s1-panel';panel.id='s3Panel';
 panel.innerHTML=`<div class="s1-kicker">ET10 / STAGE 03</div><h2>眉弓支撑<br>与静息材质坐标</h2><span class="s1-tag">补结构 · 内眼角收整 · 闭眼保留</span><p class="s1-copy">眉弓是原表面上的连续体积，不是贴上的眉毛。新眼睑使用一次绑定的静息坐标，颜色、法线和粗糙度共用坐标及区域权重。</p><button id="s3Neutral" class="s1-primary">中性睁眼 / 回到正面</button><button id="s3Compare" class="s1-primary">按住：本轮结构修改前</button><div class="s1-subhead">检查方式</div><div class="s1-grid"><button data-s3-mode="gray">无贴图灰模</button><button data-s3-mode="grid">毫米标尺坐标网格</button><button data-s3-mode="material">同源材质坐标预览</button><button data-s3-mode="strain">拉伸 / 压缩诊断</button><button data-s3-mode="regions">组织区域权重</button><button id="s3Export">导出坐标与参数</button></div><div class="s1-pose"><button data-s3-close=".25">¼ 闭眼</button><button data-s3-close=".5">半闭眼</button><button data-s3-close=".75">¾ 闭眼</button><button data-s3-close="1">完全闭眼</button></div><div class="s1-grid"><button data-s3-view="brow">眉弓 / 眉下近景</button><button data-s3-view="browSide">眉弓侧斜角</button><button data-s3-view="medialR">右内眼角近景</button><button data-s3-view="medialL">左内眼角近景</button><button data-s3-view="right">人物右眼</button><button data-s3-view="left">人物左眼</button><button data-s3-view="under">深仰视检查</button><button data-s3-view="portrait">原头模全貌</button></div><div class="s1-grid"><button data-s3-look="up">向上看</button><button data-s3-look="down">向下看</button><button data-s3-look="left">向左看</button><button data-s3-look="right">向右看</button></div><div class="s1-grid"><button data-s3-light="left">左侧柔光</button><button data-s3-light="right">右侧柔光</button></div><label class="s1-check"><input id="s3Iris" type="checkbox" checked>灰色虹膜参照（非最终光学）</label><p id="s3Status" class="s1-fine"></p><details><summary>实际几何、坐标与应变检测</summary><pre id="s3Report"></pre></details><p class="s1-fine">网格使用毫米标尺的静息坐标；曲面展开并非处处等距。运动后的变化反映实际几何应变，不通过滑动 UV 假装消失。组织折叠物理仍在第四阶段；这里不宣称毛孔密度已经守恒，也不启用最终皮肤、睫毛或泪膜光学。</p><a class="s1-original" target="_blank" rel="noopener" href="https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/${STAGE3_BASELINE}/skin-quality-lab/emily-transfer/preview.html">保留的 ET09-S2 ↗</a>`;
 parent.prepend(panel);
 document.title='眉弓与静息材质坐标 · ET10 第三阶段';document.querySelector('.version').textContent='ET10 · S3 / REST TISSUE';document.querySelector('.caption-title').textContent='第三阶段 / 眉弓与静息坐标';document.querySelector('.caption-small').textContent='同一头模 · 不加眉毛替代眉弓 · 颜色不是最终皮肤';
 const refresh=()=>{const r=rig.chartReport();document.getElementById('s3Report').textContent=JSON.stringify(r,null,2);document.getElementById('s3Status').textContent=(rig.s3Geometry?'ET10 新结构':'ET09 修改前')+' · 闭合 '+Math.round(rig.config.manualBlink*100)+'% · 静息属性 '+(r.coordinates.entries.every(e=>e.immutableRestAttributes)?'未漂移':'异常');panel.querySelectorAll('[data-s3-mode]').forEach(b=>b.classList.toggle('active',b.dataset.s3Mode===rig.chartMode));requestRender();return r;};
 const mode=m=>{if(!(m in MODES))throw Error('Unknown stage3 view');rig.chartMode=m;U.value=MODES[m];return refresh();};
 const pose=(b=0,angles={})=>{rig.stage3Pose(b,angles);return refresh();};
 const compare=on=>{rig.compareStage2(on);document.getElementById('s3Compare').classList.toggle('active',!!on);return refresh();};
 const view=name=>{
  if(name==='brow'){controls.target.set(-.004,.085,.072);camera.position.set(-.004,.086,camera.aspect<.9?.39:.205);controls.update();}
  else if(name==='browSide'){controls.target.set(-.018,.084,.070);camera.position.set(-.107,.096,.19);controls.update();}
  else window.__STAGE2__.view(name);state.camera='s3-'+name;requestRender();
 };
 document.getElementById('s3Neutral').onclick=()=>{compare(false);pose(0);view('front');};
 for(const b of panel.querySelectorAll('[data-s3-mode]'))b.onclick=()=>mode(b.dataset.s3Mode);
 for(const b of panel.querySelectorAll('[data-s3-close]'))b.onclick=()=>pose(+b.dataset.s3Close);
 for(const b of panel.querySelectorAll('[data-s3-view]'))b.onclick=()=>view(b.dataset.s3View);
 const angles={up:{pitch:-.18},down:{pitch:.18},left:{yaw:-.26},right:{yaw:.26}};
 for(const b of panel.querySelectorAll('[data-s3-look]'))b.onclick=()=>pose(0,angles[b.dataset.s3Look]);
 for(const b of panel.querySelectorAll('[data-s3-light]'))b.onclick=()=>gray.setLight(b.dataset.s3Light);
 document.getElementById('s3Iris').onchange=e=>window.__STAGE1__.iris(e.target.checked);
 const button=document.getElementById('s3Compare');button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);compare(true);};for(const n of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(n,()=>compare(false));button.onkeydown=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();compare(true);}};button.onkeyup=()=>compare(false);window.addEventListener('blur',()=>{if(!rig.s3Geometry)compare(false);});
 document.getElementById('s3Export').onclick=()=>{const data={schema:'kaopu/eye-stage3-review@1',recipe:rig.snapshot(),report:rig.chartReport()},a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));a.href=u;a.download='ET10-tissue-chart.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);};
 for(const b of document.querySelectorAll('[data-quick]'))b.onclick=()=>pose(+b.dataset.quick);
 document.getElementById('s1QuickCompare').onclick=()=>compare(rig.s3Geometry);
 document.getElementById('reset').addEventListener('click',()=>{compare(false);mode('gray');pose(0);view('front');});
 const oldRender=gray.render;gray.render=()=>{U.value=MODES[rig.chartMode]??0;oldRender();document.getElementById('s1Status').textContent=(rig.s3Geometry?'ET10-S3':'ET09-S2 对照')+' · 闭合 '+Math.round(rig.config.manualBlink*100)+'% · '+rig.chartMode;};
 window.__STAGE3__={version:'ET10-S3',baseline:STAGE3_BASELINE,mode,pose,compare,view,report:()=>rig.chartReport(),audit:d=>rig.audit(d),globePixels:()=>window.__STAGE1__.globePixels(),setLight:v=>gray.setLight(v),headProbe:()=>({sourceUUID:mesh.geometry.uuid,positions:Array.from(mesh.geometry.attributes.position.array.filter((v,i)=>i%3===2)).slice(0,20),brow:rig.browReport}),refresh};
 mode('gray');pose(0);view('front');state.stage='ET10-S3';return gray;
}
