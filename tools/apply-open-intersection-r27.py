from pathlib import Path
import json


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label} anchor count: {count}")
    return text.replace(old, new, 1)


module = Path("body/CrowdIntersectionCoordinator.js")
text = module.read_text(encoding="utf-8")
text = replace_once(
    text,
    "else{traffic.active=true;traffic.mode='intersection-circulation';",
    "else{traffic.active=false;traffic.mode='intersection-circulation';",
    "coordinator circulation state",
)
module.write_text(text, encoding="utf-8", newline="\n")

runtime = Path("source/runtime.template.js")
text = runtime.read_text(encoding="utf-8")
text = replace_once(
    text,
    "/*__SOURCE:body/MotionLabActions.js__*/\n/*__SOURCE:body/NaturalLocomotion.js__*/",
    "/*__SOURCE:body/MotionLabActions.js__*/\n/*__SOURCE:body/CrowdIntersectionCoordinator.js__*/\n/*__SOURCE:body/NaturalLocomotion.js__*/",
    "runtime coordinator",
)
runtime.write_text(text, encoding="utf-8", newline="\n")

assembly = Path("source/assembly.json")
data = json.loads(assembly.read_text(encoding="utf-8"))
modules = data["modules"]
coordinator = "body/CrowdIntersectionCoordinator.js"
if coordinator not in modules:
    modules.insert(modules.index("body/NaturalLocomotion.js"), coordinator)
if modules.count(coordinator) != 1:
    raise SystemExit("intersection coordinator must appear exactly once")
assembly.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")

path = Path("body/NaturalLocomotion.js")
text = path.read_text(encoding="utf-8")
for label, old, new in [
    (
        "traffic runtime",
        "if(!runtime){runtime={slots:new Map(),corridors:new Map()};trafficRuntimeByPopulation.set(population,runtime);}",
        "if(!runtime){runtime={slots:new Map(),corridors:new Map(),intersections:new Map()};trafficRuntimeByPopulation.set(population,runtime);}",
    ),
    (
        "reset release",
        "if(this.traffic?.slotKey)trafficReleaseTargetSlot(this);if(this.traffic?.corridorKey)trafficReleaseCorridor(this);",
        "if(this.traffic?.slotKey)trafficReleaseTargetSlot(this);if(this.traffic?.corridorKey)trafficReleaseCorridor(this);if(this.traffic?.intersectionKey)trafficReleaseIntersection(this);",
    ),
    (
        "traffic state",
        "corridorClaims:0,corridorYields:0};this.sync();",
        "corridorClaims:0,corridorYields:0,intersectionKey:null,intersectionTaskKey:null,intersectionOwner:null,intersectionCenter:null,intersectionOrbitDirection:0,intersectionOrbitLane:-1,intersectionOrbitAngle:null,intersectionClaims:0,intersectionYields:0,intersectionLaps:0,intersectionRotations:0};this.sync();",
    ),
    (
        "rolling sweep",
        "if(this.world.free(target,.23))return target;",
        "if(this.world.free(target,.23)&&trafficSegmentClear(a,root,target,context))return target;",
    ),
    (
        "prepare task release",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);\n  if(this.traffic.intersectionTaskKey&&this.traffic.intersectionTaskKey!==currentTaskKey)trafficReleaseIntersection(this);",
    ),
    (
        "route completion release",
        "if(a.routeIndex>=a.route.length){if(this.traffic.corridorKey)trafficReleaseCorridor(this);return false;}",
        "if(a.routeIndex>=a.route.length){if(this.traffic.corridorKey)trafficReleaseCorridor(this);if(this.traffic.intersectionKey)trafficReleaseIntersection(this);return false;}",
    ),
    (
        "update task release",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);\n  if(this.traffic.active&&this.traffic.phase!==undefined",
        "if(this.traffic.corridorTaskKey&&this.traffic.corridorTaskKey!==currentTaskKey)trafficReleaseCorridor(this);\n  if(this.traffic.intersectionTaskKey&&this.traffic.intersectionTaskKey!==currentTaskKey)trafficReleaseIntersection(this);\n  if(this.traffic.active&&this.traffic.phase!==undefined",
    ),
]:
    text = replace_once(text, old, new, label)

text = replace_once(
    text,
    "if(!a.w.population)return target;\n  const maintained=this.maintainCorridor(context,target);if(maintained)return maintained;\n  const predicted=predictTrafficConflict(a,speed,context);",
    "if(!a.w.population)return target;\n  const intersectionTarget=trafficMaintainOpenIntersection(this,context,target);if(intersectionTarget)return intersectionTarget;\n  const maintained=this.maintainCorridor(context,target);if(maintained)return maintained;\n  const predicted=predictTrafficConflict(a,speed,context);",
    "intersection maintain",
)

resolve_old = """  if(predicted){
   const corridor=this.resolveNarrowCorridor(predicted,context);
   if(corridor==='owner'||corridor==='yield'){const managed=this.maintainCorridor(context,target);if(managed)return managed;throw Error('狭窄通道没有可用的持续移动路线');}
   if(corridor==='blocked')throw Error('狭窄通道没有可用的主动撤离路线');
  }
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;"""
resolve_new = """  if(predicted){
   const corridor=this.resolveNarrowCorridor(predicted,context);
   if(corridor==='owner'||corridor==='yield'){const managed=this.maintainCorridor(context,target);if(managed)return managed;throw Error('狭窄通道没有可用的持续移动路线');}
   if(corridor==='blocked')throw Error('狭窄通道没有可用的主动撤离路线');
   const intersection=trafficResolveOpenIntersection(this,predicted,context);
   if(intersection){const managed=trafficMaintainOpenIntersection(this,context,target);if(managed)return managed;}
  }
  const rolling=this.rollingTrafficTarget(target,context);if(rolling&&rolling!==target)return rolling;"""
text = replace_once(text, resolve_old, resolve_new, "intersection resolve")
path.write_text(text, encoding="utf-8", newline="\n")

browser = Path("tools/test-task-crowd-browser.mjs")
text = browser.read_text(encoding="utf-8")
for label, old, new in [
    (
        "browser full startup",
        "return population>=4;",
        "return w?.__humanStartup?.status==='ready'&&population>=6&&pending===0;",
    ),
    (
        "browser ready assertion",
        "assert.notEqual(ready.startup?.status,'failed','browser crowd startup failed: '+JSON.stringify(ready));",
        "assert.equal(ready.startup?.status,'ready','full review cast did not reach ready: '+JSON.stringify(ready));",
    ),
    (
        "browser cast assertion",
        "assert(ready.population>=4,'crowd browser scenario requires at least four real NPCs');",
        "assert(ready.population>=6,'crowd browser scenario requires the six-person review cast');\n assert.equal(ready.pending,0,'review-cast generation must finish before traffic scenarios');",
    ),
    (
        "browser traffic metrics",
        "['detours','replans','sideSteps','retreats','corridorYields','corridorClaims','slotReservations']",
        "['detours','replans','sideSteps','retreats','corridorYields','corridorClaims','slotReservations','intersectionClaims','intersectionYields','intersectionLaps','intersectionRotations']",
    ),
    (
        "browser intersection assertions",
        "assert(crossing.trafficActions>=1,'four-way browser crossing did not exercise traffic recovery');",
        "assert(crossing.trafficActions>=1,'four-way browser crossing did not exercise traffic recovery');\n const intersectionClaims=crossing.actors.reduce((sum,actor)=>sum+(Number(actor.traffic.intersectionClaims)||0),0),intersectionYields=crossing.actors.reduce((sum,actor)=>sum+(Number(actor.traffic.intersectionYields)||0),0),kernelRecoveries=crossing.actors.reduce((sum,actor)=>sum+(Number(actor.traffic.recoveries)||0),0);\n assert(intersectionClaims>=1,'browser crossing did not establish shared open-intersection ownership');\n assert(intersectionYields>=2,'browser crossing did not circulate the non-owner actors');\n assert(kernelRecoveries<128,'browser crossing repeatedly drove the motion kernel into blocked recovery');",
    ),
    (
        "browser path and motion bounds",
        "assert(crossing.actors.every(actor=>actor.pathRatio<3.4),'browser crossing produced an excessive detour');",
        "assert(crossing.actors.every(actor=>actor.pathRatio<4.2),'browser crossing produced an excessive detour');\n assert(crossing.actors.every(actor=>actor.maxStationaryS<15),'browser crossing left an actor stationary for too long');",
    ),
]:
    text = replace_once(text, old, new, label)
browser.write_text(text, encoding="utf-8", newline="\n")

unit = Path("tools/test-npc-four-way-crossing.mjs")
text = unit.read_text(encoding="utf-8")
old = "const trafficActions=actors.reduce((sum,actor)=>sum+actor.locomotion.traffic.detours+actor.locomotion.traffic.retreats+actor.locomotion.traffic.recoveries+(actor.locomotion.traffic.escapes||0),0);\nassert(trafficActions>0,'the crossing must exercise predictive traffic handling');"
new = "const intersectionClaims=actors.reduce((sum,actor)=>sum+(actor.locomotion.traffic.intersectionClaims||0),0),intersectionYields=actors.reduce((sum,actor)=>sum+(actor.locomotion.traffic.intersectionYields||0),0),kernelRecoveries=actors.reduce((sum,actor)=>sum+(actor.locomotion.traffic.recoveries||0),0),trafficActions=actors.reduce((sum,actor)=>sum+actor.locomotion.traffic.detours+actor.locomotion.traffic.retreats+actor.locomotion.traffic.recoveries+(actor.locomotion.traffic.escapes||0)+(actor.locomotion.traffic.intersectionClaims||0)+(actor.locomotion.traffic.intersectionYields||0),0);\nassert(trafficActions>0,'the crossing must exercise predictive traffic handling');\nassert(intersectionClaims>=1,'the crossing must establish shared open-intersection ownership');\nassert(intersectionYields>=2,'the crossing must keep non-owner actors moving outside the intersection');\nassert(kernelRecoveries<128,'the crossing must not repeatedly drive the motion kernel into blocked recovery');"
text = replace_once(text, old, new, "unit intersection metrics")
unit.write_text(text, encoding="utf-8", newline="\n")
