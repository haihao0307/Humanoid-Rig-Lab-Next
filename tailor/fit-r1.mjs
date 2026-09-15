import {BodyBVH,add} from './geometry.mjs';
import {createMeasuredTop,sampleClearance} from './garment.mjs';
import {createClothRenderer} from './render.mjs';
const BASE='2c10edaec6e8515bc64f9df8b3da78cb34c89e61';
export async function installTailor(ctx){
 const {lab,data}=ctx,parent=window.parent,doc=parent.document,$=id=>doc.getElementById(id),yieldUI=()=>new Promise(r=>setTimeout(r,20));
 lab.setAuto(false);lab.agent.paused=true;lab.setCameraFollow(false);
 const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
 const hands={};for(const side of ['left','right']){const shoulder=lab.human.byId.get(side+'_upperArm').world.p,palm=lab.human.palm(side),sign=shoulder[0]<lab.human.root.world.p[0]?-1:1,a=sign*12*Math.PI/180,q=[0,0,Math.sin(a/2),Math.cos(a/2)],d=palm.p.map((v,k)=>v-shoulder[k]);hands[side]={p:[shoulder[0]+Math.cos(a)*d[0]-Math.sin(a)*d[1],shoulder[1]+Math.sin(a)*d[0]+Math.cos(a)*d[1],palm.p[2]],q:qmul(q,palm.q)};}
 lab.human.pose({hands,controlledFeet:true});lab.compact.updatePalette();
 const palette=lab.compact.palette,transforms=lab.human.joints.map((_,i)=>({q:Array.from(palette.slice(i*8,i*8+4)),d:Array.from(palette.slice(i*8+4,i*8+8))})),muscles=ctx.muscles(lab.human),scale=lab.compact.statureScale;
 const skin=[];let total=0;$('progress').textContent='提取原 NPC 在试衣站姿下的实际皮肤曲面…';await yieldUI();
 for(const mesh of data.meshes){if(mesh.name!=='skin')continue;const p=new Float32Array(mesh.positions.length);
  for(let i=0;i<mesh.vertices;i++){const influences=[];for(let k=0;k<8;k++){const w=mesh.binding.weights[i*8+k]/65535;if(w)influences.push([mesh.binding.ids[i*8+k],w]);}const s=mesh.positions.subarray(i*3,i*3+3),d=mesh.axillaDelta?.subarray(i*3,i*3+3);p.set(ctx.deform([-s[0],s[1],s[2]],influences,transforms,muscles,scale,d?[-d[0],d[1],d[2]]:null),i*3);}
  skin.push({p,indices:mesh.indices});total+=mesh.vertices;await yieldUI();
 }
 if(!total)throw Error('未获得原始皮肤曲面，禁止用替代人体继续');
 const joints=Object.fromEntries(lab.human.joints.map(j=>[j.id,[...j.world.p]]));
 $('progress').textContent='建立衣片与身体间隙查询…';await yieldUI();const bvh=new BodyBVH(skin),cloth=await createClothRenderer(lab.renderer);
 const source={repository:'haihao0307/Humanoid-Rig-Lab-Next',commit:BASE,branch:'upload/human-workbench-20260915',character:lab.character.export(),joints,bodySurfaceReport:data.report,materialShaderSHA256:cloth.hashes,bodyVertices:total,externalBodyModelUsed:false,bodyParametersAltered:false};
 let mesh=null,clearance=null,renderReport=null,revision=0;
 const originalRender=lab.renderer.render.bind(lab.renderer);lab.renderer.render=(...args)=>{originalRender(...args);cloth.draw();};
 if(lab.compact.skirt)lab.compact.skirt.draw=()=>{};
 lab.renderer.setQuality('fast');
 function view(name){const r=lab.renderer;r.projection='orthographic';r.distance=3;r.pitch=.045;r.yaw=({front:0,quarter:.5,side:Math.PI/2,back:Math.PI,full:.25,close:-.35,neck:.3})[name]??.5;
  const height=lab.human.bodyMetrics.statureM,cx=joints.hips[0],cz=joints.hips[2];r.target=[cx,height*.52,cz];r.orthoHeight=height*1.13;
  if(name==='close'){r.target=add(mesh.chestTarget,[.025,-.07,.04]);r.orthoHeight=.24;r.distance=1.2;}
  if(name==='neck'){r.target=add(mesh.neckTarget,[0,-.02,.03]);r.orthoHeight=.48;r.distance=1.6;}
  if(name!=='full'&&name!=='close'&&name!=='neck'){r.target=[cx,(mesh.hemY+height)*.5,cz];r.orthoHeight=(height-mesh.hemY)*1.13;}
  for(const button of doc.querySelectorAll('[data-view]'))button.classList.toggle('active',button.dataset.view===name);lab.render();
 }
 function report(){return{schema:'npc-tailor/static-fit-candidate@1',version:'R1',source,recipe:mesh.parameters,measurements:mesh.metrics,clearance,render:renderReport,thicknessMm:1.2,physicalCoordinates:'panel-edge-arclength-centimetres',materialUniformMultipliers:1,bodyPose:'original-pose-controller-12-degree-abducted-fitting-stance',historicalPatternApproved:false,manufacturingPatternApproved:false,dynamicCollisionApproved:false,visualApproved:false};}
 function showMeasurements(){const b=mesh.metrics.body,g=mesh.metrics.garment,rows=[['胸部截围',b.chestCm,g.chestEnvelopeCm],['腰部截围',b.waistCm,g.waistEnvelopeCm],['肩部宽度¹',b.shoulderJointWidthCm,g.shoulderWidthCm],['上衣长',null,g.lengthCm]];
  $('measurements').innerHTML=rows.map(r=>'<tr><td>'+r[0]+'</td><td>'+(r[1]===null?'—':r[1].toFixed(1))+'</td><td>'+r[2].toFixed(1)+'</td></tr>').join('');
  $('fitReport').innerHTML=`原身体皮肤顶点 ${total.toLocaleString()}；衣服中面 ${mesh.metrics.vertices.toLocaleString()} 顶点。<br>曲面采样 ${clearance.samples.toLocaleString()} 点；小于 ${clearance.requiredGapMm.toFixed(2)} mm 的样点：<b class="${clearance.violatingSamples?'warn':'good'}">${clearance.violatingSamples}</b>。<br>最小采样间隙 ${clearance.minSampledMidSurfaceGapMm?.toFixed(2)??'—'} mm。<br>¹ 人体列是肩关节间距，衣服列是外肩宽，定义不同。<br>衣围是设计包络估计，不是已验收的成衣实测。`;
 }
 async function rebuild(){const token=++revision;for(const id of ['ease','length'])$(id).disabled=true;$('renderState').textContent='正在按身体尺寸生成衣片…';await yieldUI();
  try{const next=createMeasuredTop(bvh,joints,{easeCm:Number($('ease').value),lengthCm:Number($('length').value)});next.metrics.body.heightCm=lab.human.bodyMetrics.statureM*100;if(token!==revision)return;mesh=next;renderReport=cloth.setMesh(mesh);lab.render();await yieldUI();clearance=sampleClearance(mesh,bvh);showMeasurements();$('renderState').textContent='R1 · 12° 试衣站姿 / '+(clearance.violatingSamples||clearance.ambiguousSamples?'间隙待复核':'静态采样通过');}
  finally{for(const id of ['ease','length'])$(id).disabled=false;}
 }
 await rebuild();
 parent.TailorApp=window.TailorApp={ready:true,lab,data,skin,joints,bodyVertices:total,source,get mesh(){return mesh},get report(){return report()},view,rebuild,render:()=>lab.render(),state:cloth.state};
 for(const button of doc.querySelectorAll('[data-view]'))button.onclick=()=>view(button.dataset.view);
 for(const id of ['ease','length']){$(id).oninput=()=>$(id+'Value').textContent=$(id).value+' cm';$(id).onchange=()=>rebuild().catch(e=>{$('renderState').textContent=e.message;console.error(e)});}
 for(const id of ['neutral','seams','garment','swatch'])$(id).onchange=()=>{cloth.state[id]=$(id).checked;lab.render();};$('light').onchange=()=>{cloth.state.light=Number($('light').value);lab.render();};
 $('height').textContent=(lab.human.bodyMetrics.statureM*100).toFixed(1)+' cm';
 $('exportRecipe').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=u;a.download='NPC_TAILOR_R1_MEASUREMENTS.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};
 $('showPattern').onclick=()=>{$('patternDrawing').innerHTML='<p>本轮为前片、后片和肩部连接的数字试衣坯。前中线可显示缝合职责，但没有把三维曲面假称为已展平的生产纸样。</p><p>上传的 P.Q.D.437 包是未定尺度的量测框架；未批准的历史尺寸、生产缝份及二维展平结果仍然保留为未知。长袖试验未通过，未加入本轮试穿。</p>';$('patternModal').classList.add('open');};
 $('closePattern').onclick=()=>$('patternModal').classList.remove('open');
 view('quarter');$('loading').style.display='none';document.getElementById('loading').hidden=true;console.log('TAILOR_READY',JSON.stringify(report()));
}
