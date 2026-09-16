from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "cat-kaopu/workbench/CAT_KAOPU_CURRENT.html"
OUT_DIR = ROOT / "cat-kaopu/phase1"
DOCS_DIR = ROOT / "cat-kaopu/docs"
BUILD_ID = "cat-kaopu-phase1-gate-a-single-npc-20260916"
DATE = "2026-09-16"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


if not SOURCE.is_file():
    raise SystemExit(f"source workbench missing: {SOURCE.relative_to(ROOT)}")

html = SOURCE.read_text(encoding="utf-8")

html = replace_once(
    html,
    "<title>CAT KAOPU V4.46 · 双眼统一区域面部载体</title>",
    "<title>CAT KAOPU Phase 1 Gate A · 单体环境 NPC</title>",
    "page title",
)

html = replace_once(
    html,
    '<aside><h1>CAT KAOPU V4.46</h1><div class="sub">V4.32 冻结整猫表面 → V4.45 眶周环带 → V4.46 眉弓、鼻根、双眼与上面颊统一区域载体</div>',
    '<aside><h1>CAT KAOPU · Phase 1 Gate A</h1><div class="sub">基础世界环境生物 NPC：先稳定单体形态、核心运动和碰撞，再进入群体与个体差异</div>',
    "phase1 heading",
)

html = replace_once(
    html,
    ".warnTag{border-color:#705f31;color:#e2ce95}",
    ".warnTag{border-color:#705f31;color:#e2ce95}.phase1Gate{border:1px solid #315a68;background:#0a1820;border-radius:9px;padding:11px}.phase1Gate h2{color:#8ed8e9}.phase1State{font-variant-numeric:tabular-nums}.phase1Pass{color:#9ee0bd}.phase1Block{color:#f4c47a}.phase1Pending{color:#e2ce95}.phase1Actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.phase1Actions button{width:100%;text-align:left}",
    "phase1 styles",
)

phase1_panel = r'''<section class="phase1Gate" id="phase1GateA"><h2>Phase 1 · Gate A 单体基础</h2><div class="note">当前生产门只检查整体形态、站立、起步/直行/停止、左右转向、足掌接触和简化碰撞代理。生活活动、群体生成和完整生态行为暂不占用主开发预算。</div><div class="phase1Actions" style="margin-top:9px"><button id="phase1Stand">单体站立检查</button><button id="phase1Walk">直行碰撞测试</button><button id="phase1TurnL">左转动作检查</button><button id="phase1TurnR">右转动作检查</button><button id="phase1Front">正面形态</button><button id="phase1Left">侧面形态</button><button id="phase1Top">顶部形态</button><button id="phase1Quarter">三分之四</button></div><div class="row" style="margin-top:8px"><button class="active" id="phase1CollisionToggle">碰撞代理开启</button><button class="active" id="phase1ProxyToggle">显示碰撞体</button><button id="phase1Reset">复位单体</button></div><div class="kpi"><b>单体生产门</b><span class="phase1Pending" id="kPhase1Gate">Gate A 执行中</span></div><div class="kpi"><b>碰撞状态</b><span class="phase1State" id="kPhase1Collision">未接触</span></div><div class="kpi"><b>最大侵入 / 修正</b><span class="phase1State" id="kPhase1Penetration">0.00 / 0.00 mm</span></div><div class="kpi"><b>碰撞减速权重</b><span class="phase1State" id="kPhase1Brake">1.00</span></div><div class="kpi"><b>代理结构</b><span>骨盆 / 胸腔 / 头部 + 静态障碍</span></div><div class="note">本门不宣称群体已经完成。只有单体形态、运动和碰撞稳定后，才开放 6–12 只实例、受限体型 DNA、空间索引和局部避让。</div></section>
'''
html = replace_once(
    html,
    '<section><h2>动作与测试姿势</h2>',
    phase1_panel + '<section><h2>动作与测试姿势</h2>',
    "phase1 panel",
)

html = replace_once(
    html,
    '<section><h2>几何眼睑、角膜、耳眼与短毛</h2>',
    '<section><h2>次要表现层（保留回归，不作为当前主线）</h2>',
    "deprioritize appearance section",
)

collision_runtime = r'''
const PHASE1_COLLISION_PROFILE={
 schema:'cat_kaopu/environment_collision_proxy@1.0',
 buildId:'cat-kaopu-phase1-gate-a-single-npc-20260916',
 proxies:[
  {id:'pelvis',label:'骨盆',local:[-.092,0,.135],radius:.076},
  {id:'chest',label:'胸腔',local:[.075,0,.165],radius:.084},
  {id:'head',label:'头部',local:[.218,0,.205],radius:.064}
 ],
 obstacles:[
  {id:'wall_A',label:'测试墙',min:[.355,-.19,0],max:[.375,.19,.245]}
 ]
};
let phase1CollisionEnabled=true,showPhase1Collision=true;
const phase1Collision={enabled:true,blocked:false,obstacle:null,maxPenetrationM:0,correctionM:0,brake:1,minClearanceM:1e9,contacts:[],testedFrames:0};
function phase1Clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function phase1ProxyWorld(p,proxy){const yaw=p.a[names.root*3+2]||0,c=Math.cos(yaw),s=Math.sin(yaw),lx=proxy.local[0],ly=proxy.local[1];return[p.r[0]+lx*c-ly*s,p.r[1]+lx*s+ly*c,p.r[2]+proxy.local[2]]}
function phase1CircleAabb(proxyCenter,r,box){
 const x=proxyCenter[0],y=proxyCenter[1],z=proxyCenter[2];
 if(z+r<box.min[2]||z-r>box.max[2])return null;
 const nx=phase1Clamp(x,box.min[0],box.max[0]),ny=phase1Clamp(y,box.min[1],box.max[1]),dx=x-nx,dy=y-ny,d=Math.hypot(dx,dy);
 if(d>=r)return null;
 if(d>1e-8){const penetration=r-d;return{px:dx/d*penetration,py:dy/d*penetration,penetration}}
 const options=[
  {px:box.min[0]-x-r,py:0,penetration:x-box.min[0]+r},
  {px:box.max[0]-x+r,py:0,penetration:box.max[0]-x+r},
  {px:0,py:box.min[1]-y-r,penetration:y-box.min[1]+r},
  {px:0,py:box.max[1]-y+r,penetration:box.max[1]-y+r}
 ];
 options.sort((a,b)=>Math.hypot(a.px,a.py)-Math.hypot(b.px,b.py));return options[0]
}
function phase1DeepestCollision(p){let best=null;for(const proxy of PHASE1_COLLISION_PROFILE.proxies){const center=phase1ProxyWorld(p,proxy);for(const obstacle of PHASE1_COLLISION_PROFILE.obstacles){const hit=phase1CircleAabb(center,proxy.radius,obstacle);if(hit&&(!best||hit.penetration>best.penetration))best={...hit,proxy:proxy.id,obstacle:obstacle.id}}}return best}
function phase1MinClearance(p){let min=1e9;for(const proxy of PHASE1_COLLISION_PROFILE.proxies){const c=phase1ProxyWorld(p,proxy);for(const o of PHASE1_COLLISION_PROFILE.obstacles){const nx=phase1Clamp(c[0],o.min[0],o.max[0]),ny=phase1Clamp(c[1],o.min[1],o.max[1]),d=Math.hypot(c[0]-nx,c[1]-ny)-proxy.radius;min=Math.min(min,d)}}return min}
function phase1ClampPose(p){let correction=0,maxPen=0,first=null,contacts=[];for(let pass=0;pass<6;pass++){const hit=phase1DeepestCollision(p);if(!hit)break;if(!first)first=hit;maxPen=Math.max(maxPen,hit.penetration);contacts.push({proxy:hit.proxy,obstacle:hit.obstacle,penetrationM:hit.penetration});p.r[0]+=hit.px;p.r[1]+=hit.py;correction+=Math.hypot(hit.px,hit.py)}return{hit:first,correction,maxPen,contacts}}
function phase1PublishCollision(p){phase1Collision.enabled=phase1CollisionEnabled;phase1Collision.minClearanceM=phase1MinClearance(p);phase1Collision.testedFrames++;motionDiagnostics.phase1Collision=JSON.parse(JSON.stringify(phase1Collision));p.meta=p.meta||{};p.meta.phase1Collision=JSON.parse(JSON.stringify(phase1Collision))}
function applyPhase1Collision(p,g){
 phase1Collision.blocked=false;phase1Collision.obstacle=null;phase1Collision.maxPenetrationM=0;phase1Collision.correctionM=0;phase1Collision.brake=1;phase1Collision.contacts=[];
 if(!phase1CollisionEnabled){phase1PublishCollision(p);return p}
 const result=phase1ClampPose(p);if(result.hit){phase1Collision.blocked=true;phase1Collision.obstacle=result.hit.obstacle;phase1Collision.maxPenetrationM=result.maxPen;phase1Collision.correctionM=result.correction;phase1Collision.contacts=result.contacts;phase1Collision.brake=g?phase1Clamp(1-result.maxPenetrationM/.018,0,1):1;if(g){const keep=.12+.88*phase1Collision.brake;for(let i=3;i<p.a.length;i++)p.a[i]*=keep;p.r[2]*=keep}}
 phase1PublishCollision(p);return p
}
function finalizePhase1Collision(p){if(!phase1CollisionEnabled){phase1PublishCollision(p);return p}const result=phase1ClampPose(p);if(result.hit){phase1Collision.blocked=true;phase1Collision.obstacle=result.hit.obstacle;phase1Collision.maxPenetrationM=Math.max(phase1Collision.maxPenetrationM,result.maxPen);phase1Collision.correctionM+=result.correction;phase1Collision.contacts.push(...result.contacts)}phase1PublishCollision(p);return p}
function updatePhase1Panel(){const c=phase1Collision,$c=$('#kPhase1Collision'),$p=$('#kPhase1Penetration'),$b=$('#kPhase1Brake'),$g=$('#kPhase1Gate');if($c){$c.textContent=c.enabled?(c.blocked?'已阻挡 · '+(c.obstacle||'障碍'):'未接触'):'关闭';$c.className=c.blocked?'phase1Block phase1State':'phase1Pass phase1State'}if($p)$p.textContent=(c.maxPenetrationM*1000).toFixed(2)+' / '+(c.correctionM*1000).toFixed(2)+' mm';if($b)$b.textContent=c.brake.toFixed(2);if($g){$g.textContent='Gate A · 单体形态/运动/碰撞';$g.className='phase1Pending'}if(c.blocked&&statusBox&&!statusBox.innerHTML.includes('碰撞阻挡'))statusBox.innerHTML+='｜碰撞阻挡 '+(c.maxPenetrationM*1000).toFixed(2)+' mm'}
'''

motion_marker = "const motionDiagnostics={support:[],maxSlipM:0,meanSlipM:0,maxPadTiltDeg:0,rootDistanceM:0,rootCorrectionM:0,turnAngleDeg:0,paws:{},pads:{},anchors:{},desiredPose:true,finalPose:true};"
html = replace_once(
    html,
    motion_marker,
    motion_marker + collision_runtime,
    "collision runtime",
)

html = replace_once(
    html,
    "function resolveFinalPose(desired){const p=clonePose(desired),g=desired.meta&&desired.meta.gait;",
    "function resolveFinalPose(desired){const p=clonePose(desired),g=desired.meta&&desired.meta.gait;applyPhase1Collision(p,g);",
    "collision before final pose solve",
)

html = replace_once(
    html,
    "motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;return p}",
    "motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;finalizePhase1Collision(p);motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);return p}",
    "non-gait final collision clamp",
)

html = replace_once(
    html,
    "motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;p.meta.final={contacts:motionDiagnostics.support,maxSlipM:max,maxPadTiltDeg:maxTilt};return p}",
    "motionDiagnostics.turnAngleDeg=(p.a[names.root*3+2]||0)/DEG;finalizePhase1Collision(p);motionDiagnostics.rootDistanceM=Math.hypot(p.r[0],p.r[1]);p.meta.final={contacts:motionDiagnostics.support,maxSlipM:max,maxPadTiltDeg:maxTilt,phase1Collision:JSON.parse(JSON.stringify(phase1Collision))};return p}",
    "gait final collision clamp",
)

collision_draw = r'''
function phase1PushBoxLines(dst,b){const x0=b.min[0],y0=b.min[1],z0=b.min[2],x1=b.max[0],y1=b.max[1],z1=b.max[2],p=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],e=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];for(const q of e)dst.push(...p[q[0]],...p[q[1]])}
function phase1PushRing(dst,c,r,z){const n=28;for(let i=0;i<n;i++){const a=2*Math.PI*i/n,b=2*Math.PI*(i+1)/n;dst.push(c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),z,c[0]+r*Math.cos(b),c[1]+r*Math.sin(b),z)}}
function drawPhase1Collision(pv,pose){if(!showPhase1Collision)return;const obstacles=[],proxies=[];for(const o of PHASE1_COLLISION_PROFILE.obstacles)phase1PushBoxLines(obstacles,o);for(const p of PHASE1_COLLISION_PROFILE.proxies){const c=phase1ProxyWorld(pose,p);phase1PushRing(proxies,c,p.radius,c[2]);phase1PushRing(proxies,c,p.radius,Math.max(.012,c[2]-p.radius*.55))}gl.useProgram(lpr);gl.uniformMatrix4fv(LU.pv,false,pv);gl.bindVertexArray(contactVao);gl.bindBuffer(gl.ARRAY_BUFFER,contactBuf);if(obstacles.length){gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(obstacles),gl.DYNAMIC_DRAW);gl.uniform4f(LU.color,phase1Collision.blocked?1:.95,phase1Collision.blocked?.18:.62,.12,.96);gl.drawArrays(gl.LINES,0,obstacles.length/3)}if(proxies.length){gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(proxies),gl.DYNAMIC_DRAW);gl.uniform4f(LU.color,.20,.88,1.,.92);gl.drawArrays(gl.LINES,0,proxies.length/3)}gl.bindVertexArray(null)}
'''
html = replace_once(
    html,
    "function frame(){resize();",
    collision_draw + "function frame(){resize();",
    "collision debug drawing",
)

html = replace_once(
    html,
    "drawLines(pv,mats.jpos);lastPose=pose;",
    "drawLines(pv,mats.jpos);drawPhase1Collision(pv,pose);lastPose=pose;",
    "collision draw call",
)

html = replace_once(
    html,
    "camera:{az,el,dist,target:target.slice(),autoFollow:false}};requestAnimationFrame(frame)}",
    "camera:{az,el,dist,target:target.slice(),autoFollow:false},phase1Collision:JSON.parse(JSON.stringify(phase1Collision))};updatePhase1Panel();requestAnimationFrame(frame)}",
    "phase1 metrics",
)

controls = r'''
function phase1SetAction(name,time=0){window.__CAT_V446_SET_SAMPLE__(name,time);paused=true;pauseStamp=time;$('#pause').textContent='继续';return true}
$('#phase1Stand').onclick=()=>phase1SetAction('stand',0.2);$('#phase1Walk').onclick=()=>phase1SetAction('walk_forward',5.25);$('#phase1TurnL').onclick=()=>phase1SetAction('turn_left',2.8);$('#phase1TurnR').onclick=()=>phase1SetAction('turn_right',2.8);$('#phase1Front').onclick=()=>setView('front',true);$('#phase1Left').onclick=()=>setView('left',true);$('#phase1Top').onclick=()=>setView('top',true);$('#phase1Quarter').onclick=()=>setView('quarter',true);$('#phase1CollisionToggle').onclick=e=>{phase1CollisionEnabled=!phase1CollisionEnabled;e.currentTarget.classList.toggle('active',phase1CollisionEnabled);resetContactRuntime();updatePhase1Panel()};$('#phase1ProxyToggle').onclick=e=>{showPhase1Collision=!showPhase1Collision;e.currentTarget.classList.toggle('active',showPhase1Collision)};$('#phase1Reset').onclick=()=>{resetWorldMotion();phase1SetAction('stand',0.2)};
'''
html = replace_once(
    html,
    "resize();setView('quarter',true);setAction('stand');",
    controls + "resize();setView('quarter',true);setAction('stand');",
    "phase1 controls",
)

html = replace_once(
    html,
    "window.__CAT_V446_READY__='webgl2';",
    "window.__CAT_V446_READY__='webgl2';window.__CAT_PHASE1_READY__='gate-a-webgl2';",
    "phase1 ready flag",
)

html = replace_once(
    html,
    "desiredFinalPose:true,externalModel:false",
    "desiredFinalPose:true,phase1EnvironmentNpc:true,phase1Gate:'A',collisionProxy:true,groupRuntime:false,variationRuntime:false,externalModel:false",
    "phase1 stats",
)

phase1_exports = r'''
window.__CAT_PHASE1_PROFILE__=JSON.parse(JSON.stringify(PHASE1_COLLISION_PROFILE));
window.__CAT_PHASE1_GET_STATE__=()=>({schema:'cat_kaopu/environment_npc_phase1_state@1.0',buildId:'cat-kaopu-phase1-gate-a-single-npc-20260916',ready:window.__CAT_PHASE1_READY__,gate:'A',priorities:{morphology:.48,locomotion:.42,collision:.10},collision:JSON.parse(JSON.stringify(phase1Collision)),collisionProfile:JSON.parse(JSON.stringify(PHASE1_COLLISION_PROFILE)),groupRuntime:false,variationRuntime:false,shapeMutation:false,action,camera:window.__CAT_V446_GET_CAMERA__(),metrics:window.__CAT_V446_GET_METRICS__()});
window.__CAT_PHASE1_SET_COLLISION__=v=>{phase1CollisionEnabled=!!v;const b=$('#phase1CollisionToggle');if(b)b.classList.toggle('active',phase1CollisionEnabled);resetContactRuntime();return phase1CollisionEnabled};
window.__CAT_PHASE1_SET_PROXY_VIS__=v=>{showPhase1Collision=!!v;const b=$('#phase1ProxyToggle');if(b)b.classList.toggle('active',showPhase1Collision);return showPhase1Collision};
window.__CAT_PHASE1_SET_OBSTACLE__=(id,min,max)=>{const o=PHASE1_COLLISION_PROFILE.obstacles.find(x=>x.id===id);if(!o)return false;o.min=[+min[0],+min[1],+min[2]];o.max=[+max[0],+max[1],+max[2]];return true};
window.__CAT_PHASE1_AUDIT__={morphologyViews:['front','left','top','quarter'],coreActions:['stand','walk_forward','turn_left','turn_right'],secondaryActions:['idle','look','tail','alert','sniff','sit_cycle','lie_cycle','groom'],collision:{proxyCount:3,obstacleCount:1,response:'bounded-pushout-plus-gait-brake'},gates:{singleNpc:'active',group:'locked',variation:'locked',avoidance:'next'}};
'''
html = replace_once(
    html,
    "window.__CAT_V446_EAR_AUDIT__=",
    phase1_exports + "window.__CAT_V446_EAR_AUDIT__=",
    "phase1 exports",
)

html = replace_once(
    html,
    "window.__CAT_V446_READY__='static-fallback';",
    "window.__CAT_V446_READY__='static-fallback';window.__CAT_PHASE1_READY__='static-fallback';",
    "phase1 fallback flag",
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
DOCS_DIR.mkdir(parents=True, exist_ok=True)
workbench = OUT_DIR / "CAT_KAOPU_PHASE1_GATE_A_SINGLE_NPC_2026-09-16.html"
index = OUT_DIR / "index.html"
workbench.write_text(html, encoding="utf-8")
index.write_text(html, encoding="utf-8")

contract = {
    "schema": "cat_kaopu/environment_npc_phase1_contract@1.0",
    "buildId": BUILD_ID,
    "date": DATE,
    "priority": {"morphology": 0.48, "locomotion": 0.42, "collision": 0.10},
    "singleNpcGate": {
        "status": "active",
        "requiredViews": ["front", "left", "top", "quarter"],
        "requiredActions": ["stand", "walk_forward", "turn_left", "turn_right"],
        "requiredSystems": ["ground_contact", "root_motion", "direction_sync", "collision_proxy"],
    },
    "collision": {
        "profile": "environment_collision_proxy@1.0",
        "proxies": ["pelvis", "chest", "head"],
        "staticObstacle": "wall_A",
        "response": "bounded_pushout_plus_gait_brake",
        "fullMeshCollision": False,
    },
    "deferred": {
        "groupRuntime": False,
        "variationRuntime": False,
        "localAvoidance": False,
        "lifeBehaviorPriority": "secondary",
        "thirdEyelid": False,
        "whiskerDetail": False,
    },
    "nextGate": "single NPC morphology and locomotion audit, then stop-or-bypass response",
    "productionReady": False,
}
contract_path = OUT_DIR / "PHASE1_NPC_CONTRACT.json"
contract_path.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

report = f"""# CAT KAOPU Phase 1 Gate A 执行报告

日期：{DATE}  
Build ID：`{BUILD_ID}`  
状态：`visualAcceptance=false`，`productionReady=false`

## 本轮实际完成

1. 从 V4.46 建立独立的 Phase 1 单体环境 NPC 工作台，旧工作台和历史基线不覆盖。
2. 将当前生产重点固定为整体形态、核心运动和碰撞；眼睑、角膜、短毛和生活序列保留为次要回归层。
3. 增加正面、侧面、顶部、三分之四固定形态检查入口。
4. 增加单体核心动作入口：站立、向前运动、左转和右转。
5. 增加骨盆、胸腔、头部三个低成本碰撞代理，以及一面可配置静态测试墙。
6. 增加有界穿透修正、碰撞诊断和渐进式步态减速，避免使用逐三角形全表面碰撞。
7. 暴露 `__CAT_PHASE1_GET_STATE__`、碰撞开关、代理显示和障碍位置接口，供浏览器自动 QA 使用。

## 尚未完成

- 本轮没有宣称猫整体形态已经通过视觉验收；V4.32 中性表面只作为当前测试输入。
- 当前碰撞是单体低成本代理门，不是最终复杂环境物理。
- 群体、个体差异、空间索引、局部避让和群体性能测试仍被锁定。
- 碰撞后的绕行策略尚未进入，本轮只实现不穿透与减速基础。

## 下一生产门

浏览器证据通过后，下一轮直接并行处理：

1. 固定四视图下的头颈坡度、胸腹骨盆、四肢和足掌轮廓复核。
2. 起步、直行、停止和转向的连续性、脚滑与朝向同步复核。
3. 在现有碰撞代理上增加停止或绕行二选一的稳定响应。

只有这三项通过，才进入 6–12 只实例、受限 DNA 和局部避让。
"""
report_path = DOCS_DIR / "CAT_KAOPU_PHASE1_GATE_A_EXECUTION_REPORT_2026-09-16.md"
report_path.write_text(report, encoding="utf-8")

manifest = {
    "schema": "cat_kaopu/phase1_gate_build@1.0",
    "buildId": BUILD_ID,
    "source": str(SOURCE.relative_to(ROOT)),
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "outputs": [
        {"path": str(workbench.relative_to(ROOT)), "bytes": workbench.stat().st_size, "sha256": sha256(workbench)},
        {"path": str(index.relative_to(ROOT)), "bytes": index.stat().st_size, "sha256": sha256(index)},
        {"path": str(contract_path.relative_to(ROOT)), "bytes": contract_path.stat().st_size, "sha256": sha256(contract_path)},
        {"path": str(report_path.relative_to(ROOT)), "bytes": report_path.stat().st_size, "sha256": sha256(report_path)},
    ],
    "technicalReady": True,
    "visualAcceptance": False,
    "productionReady": False,
}
manifest_path = OUT_DIR / "PHASE1_GATE_A_MANIFEST.json"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(json.dumps({"buildId": BUILD_ID, "workbench": str(workbench.relative_to(ROOT)), "bytes": workbench.stat().st_size}, ensure_ascii=False))
