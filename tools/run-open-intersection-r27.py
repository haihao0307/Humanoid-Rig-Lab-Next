from pathlib import Path

source = Path("tools/apply-open-intersection-r27.py")
text = source.read_text(encoding="utf-8")
old = '''    (
        "prepare task release",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);\\n  if(this.traffic.intersectionTaskKey&&this.traffic.intersectionTaskKey!==currentTaskKey)trafficReleaseIntersection(this);",
    ),
'''
new = '''    (
        "prepare task release",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);\\n  if(a.skill?.type==='walk'",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);\\n  if(this.traffic.intersectionTaskKey&&this.traffic.intersectionTaskKey!==currentTaskKey)trafficReleaseIntersection(this);\\n  if(a.skill?.type==='walk'",
    ),
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"prepare-release script patch count: {count}")
text = text.replace(old, new, 1)
text = text.replace(
    "const intersectionTarget=trafficMaintainOpenIntersection(this,context,target);if(intersectionTarget)return intersectionTarget;",
    "const intersectionTarget=typeof trafficMaintainOpenIntersection==='function'?trafficMaintainOpenIntersection(this,context,target):null;if(intersectionTarget)return intersectionTarget;",
)
text = text.replace(
    "const intersection=trafficResolveOpenIntersection(this,predicted,context);",
    "const intersection=typeof trafficResolveOpenIntersection==='function'?trafficResolveOpenIntersection(this,predicted,context):null;",
)
compiled = compile(text, str(source), "exec")
exec(compiled, {"__name__": "__main__", "__file__": str(source)})

locomotion = Path("body/NaturalLocomotion.js")
locomotion_text = locomotion.read_text(encoding="utf-8")
method_anchor = """ maintainCorridor(context,target){
"""
method = """ corridorOwnerManeuverTarget(lease,context,target){
  const a=this.a,t=this.traffic,root=this.engine.state.root,d=lease?.descriptor;if(!d)return null;
  if(t.advancePoint&&t.advanceRouteIndex===a.routeIndex&&horizontal(root,t.advancePoint)>.025&&this.world.free(t.advancePoint,.23)&&trafficSegmentClear(a,root,t.advancePoint,context))return [...t.advancePoint];
  t.advancePoint=null;t.advanceRouteIndex=-1;
  const axis=[0,0,0];axis[d.axisIndex]=lease.direction||1;
  const lateral=[0,0,0];lateral[d.lateralIndex]=1;
  const preferred=trafficPairSide(a.npcId,lease.ownerId||d.key),neighbours=[...a.w.population.values()].filter(actor=>actor.agent!==a&&!actor.disposed).map(actor=>({actor,threshold:context.radius+bodyPhysicalProfile(actor.human).bodyRadiusM+.06}));
  let best=null;
  for(const back of [.12,.20,.30,.42,.58,.76])for(const side of [0,preferred*.08,-preferred*.08,preferred*.14,-preferred*.14,preferred*.20,-preferred*.20]){
   const point=add(add(root,mul(axis,-back)),mul(lateral,side));point[1]=0;
   if(!this.world.free(point,.23)||!trafficSegmentClear(a,root,point,context))continue;
   const clearance=neighbours.length?Math.min(...neighbours.map(row=>horizontal(point,row.actor.agent.pos)-row.threshold)):2,score=clearance*4-back*.08-Math.abs(side)*.04;
   if(!best||score>best.score)best={point,score};
  }
  if(!best)return null;
  t.advancePoint=[...best.point];t.advanceRouteIndex=a.routeIndex;t.active=false;t.mode='corridor-owner-maneuver';t.reason='corridor-owner-active-clearance';
  if(a.time>=(t.nextPlanAtS||0)){t.nextPlanAtS=a.time+.45;a.log?.('狭窄通道前方人员仍在主动撤离，方向权持有者已同步向后机动保持净空');}
  return [...best.point];
 }
 maintainCorridor(context,target){
"""
if locomotion_text.count(method_anchor) != 1:
    raise SystemExit(f"corridor owner manoeuvre anchor count: {locomotion_text.count(method_anchor)}")
locomotion_text = locomotion_text.replace(method_anchor, method, 1)
old_owner = """   return this.corridorAdvanceTarget(target,context)||this.rollingTrafficTarget(target,context);
"""
new_owner = """   return this.corridorAdvanceTarget(target,context)||this.rollingTrafficTarget(target,context)||this.corridorOwnerManeuverTarget(lease,context,target);
"""
if locomotion_text.count(old_owner) != 1:
    raise SystemExit(f"corridor owner fallback anchor count: {locomotion_text.count(old_owner)}")
locomotion.write_text(locomotion_text.replace(old_owner, new_owner, 1), encoding="utf-8", newline="\n")

four_way = Path("tools/test-npc-four-way-crossing.mjs")
source_text = four_way.read_text(encoding="utf-8")
old_code = "+'\\n'+read('body/MotionLabPose.js')+'\\n'+read('body/NaturalLocomotion.js');"
new_code = "+'\\n'+read('body/MotionLabPose.js')+'\\n'+read('body/CrowdIntersectionCoordinator.js')+'\\n'+read('body/NaturalLocomotion.js');"
count = source_text.count(old_code)
if count != 1:
    raise SystemExit(f"four-way coordinator harness anchor count: {count}")
four_way.write_text(source_text.replace(old_code, new_code, 1), encoding="utf-8", newline="\n")

browser = Path("tools/test-task-crowd-browser.mjs")
browser_text = browser.read_text(encoding="utf-8")
old_ids = "const ids=['TASK_TEST_CORRIDOR_L','TASK_TEST_CORRIDOR_R'];"
new_ids = "const ids=['TCORRIDORL','TCORRIDORR'];"
if browser_text.count(old_ids) != 1:
    raise SystemExit(f"temporary corridor id patch count: {browser_text.count(old_ids)}")
browser.write_text(browser_text.replace(old_ids, new_ids, 1), encoding="utf-8", newline="\n")
