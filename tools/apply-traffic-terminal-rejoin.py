from pathlib import Path

path = Path('body/NaturalLocomotion.js')
text = path.read_text(encoding='utf-8')

old = "const a=this.a,root=this.engine.state.root,current=a.route[a.routeIndex],other=conflict.actor;if(!current||!other)return false;"
new = "const a=this.a,root=this.engine.state.root,current=a.route[a.routeIndex],other=conflict.actor,canonicalGoal=this.traffic.slotPoint||a.route.at(-1);if(!current||!other||!canonicalGoal)return false;"
if text.count(old) != 1:
    raise SystemExit('expected one local-detour declaration')
text = text.replace(old, new)

old = """   let resume=[...a.route[resumeIndex]],terminalShift=false;
   if(horizontal(root,resume)<baseExit+.10){
    if(a.skill?.type!=='walk')continue;
    resume=add(resume,mul(right,side*clearance*1.15));resume[1]=0;terminalShift=true;
   }
   if(!trafficSegmentClear(a,root,entry,context)||!trafficSegmentClear(a,entry,exit,context)||!trafficSegmentClear(a,exit,resume,context))continue;
   const deleteCount=terminalShift?resumeIndex-a.routeIndex+1:resumeIndex-a.routeIndex;
   a.route.splice(a.routeIndex,deleteCount,entry,exit,...(terminalShift?[resume]:[]));
   this.requestKey=null;Object.assign(this.traffic,{active:true,mode:'detour',reason:'predicted-npc-conflict',blockers:[other.id],side,detourEndIndex:a.routeIndex+1,originalTarget:[...current],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.detours++;"""
new = """   let resume=[...a.route[resumeIndex]],terminalShift=false;
   if(horizontal(root,resume)<baseExit+.10){
    if(a.skill?.type!=='walk')continue;
    resume=add(canonicalGoal,mul(right,side*clearance*1.15));resume[1]=0;terminalShift=true;
   }
   if(!trafficSegmentClear(a,root,entry,context)||!trafficSegmentClear(a,entry,exit,context)||!trafficSegmentClear(a,exit,resume,context))continue;
   if(terminalShift&&!trafficSegmentClear(a,resume,canonicalGoal,context,{dynamic:false}))continue;
   const deleteCount=terminalShift?resumeIndex-a.routeIndex+1:resumeIndex-a.routeIndex,insert=terminalShift?[entry,exit,resume,[...canonicalGoal]]:[entry,exit];
   a.route.splice(a.routeIndex,deleteCount,...insert);
   this.requestKey=null;Object.assign(this.traffic,{active:true,mode:'detour',reason:'predicted-npc-conflict',blockers:[other.id],side,detourEndIndex:a.routeIndex+(terminalShift?2:1),originalTarget:[...canonicalGoal],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.detours++;"""
if text.count(old) != 1:
    raise SystemExit('expected one terminal detour block')
text = text.replace(old, new)

path.write_text(text, encoding='utf-8', newline='\n')
print('terminal detour rejoin patch applied')
