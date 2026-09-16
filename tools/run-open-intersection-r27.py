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
compiled = compile(text.replace(old, new, 1), str(source), "exec")
exec(compiled, {"__name__": "__main__", "__file__": str(source)})
