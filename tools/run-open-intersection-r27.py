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

four_way = Path("tools/test-npc-four-way-crossing.mjs")
source_text = four_way.read_text(encoding="utf-8")
old_code = "+'\\n'+read('body/MotionLabPose.js')+'\\n'+read('body/NaturalLocomotion.js');"
new_code = "+'\\n'+read('body/MotionLabPose.js')+'\\n'+read('body/CrowdIntersectionCoordinator.js')+'\\n'+read('body/NaturalLocomotion.js');"
count = source_text.count(old_code)
if count != 1:
    raise SystemExit(f"four-way coordinator harness anchor count: {count}")
four_way.write_text(source_text.replace(old_code, new_code, 1), encoding="utf-8", newline="\n")
