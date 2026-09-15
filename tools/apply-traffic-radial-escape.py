from pathlib import Path

path = Path('body/NaturalLocomotion.js')
text = path.read_text(encoding='utf-8')

old = "recoveries:0,slotReservations:0"
new = "recoveries:0,escapes:0,slotReservations:0"
if text.count(old) != 1:
    raise SystemExit('expected one traffic counter state')
text = text.replace(old, new)

marker = """  return false;
 }
 rollingTrafficTarget(target,context){"""
method = """  return false;
 }
 installRadialEscape(conflict,context){
  const a=this.a,population=a.w.population,root=this.engine.state.root,goal=this.traffic.slotPoint||a.route.at(-1);if(!population||!goal)return false;
  const neighbours=[...population.values()].filter(other=>other.agent!==a&&other.id!==a.npcId&&!other.disposed).map(other=>{
   const radius=bodyPhysicalProfile(other.human).bodyRadiusM,threshold=context.radius+radius+.06,distance=horizontal(root,other.agent.pos);
   return{actor:other,radius,threshold,distance,clearance:distance-threshold};
  }).filter(row=>row.distance<3.0);
  if(!neighbours.length)return false;
  let repel=[0,0,0];for(const row of neighbours){let away=sub(root,row.actor.agent.pos);away[1]=0;if(len(away)<1e-6)away=[trafficPairSide(a.npcId,row.actor.id),0,1];const weight=1/Math.max(.12,row.distance-row.threshold+.32)**2;repel=add(repel,mul(norm(away),weight));}
  if(len(repel)<1e-6&&conflict?.actor){repel=sub(root,conflict.actor.agent.pos);repel[1]=0;}if(len(repel)<1e-6)repel=[1,0,0];
  const goalDirection=norm([goal[0]-root[0],0,goal[2]-root[2]]),repelAngle=Math.atan2(repel[0],repel[2]),goalAngle=Math.atan2(goalDirection[0],goalDirection[2]),seed=(trafficHash(String(a.npcId||''))%24)/24*Math.PI*2;
  const angles=[repelAngle,repelAngle+.35,repelAngle-.35,repelAngle+.7,repelAngle-.7,repelAngle+1.1,repelAngle-1.1,goalAngle+.75,goalAngle-.75,...Array.from({length:24},(_,i)=>seed+i*Math.PI*2/24)];
  const currentMinimum=Math.min(...neighbours.map(row=>row.clearance)),seen=new Set();let best=null;
  for(const radius of [.30,.42,.56,.72,.92,1.16])for(const angle of angles){
   const key=Math.round(angle*1000);if(seen.has(radius+':'+key))continue;seen.add(radius+':'+key);
   const direction=[Math.sin(angle),0,Math.cos(angle)],point=add(root,mul(direction,radius));point[1]=0;
   if(!trafficSegmentClear(a,root,point,context)||!this.world.free(point,.23))continue;
   const minimum=Math.min(...neighbours.map(row=>horizontal(point,row.actor.agent.pos)-row.threshold));
   if(minimum<Math.max(.015,currentMinimum+.035))continue;
   let continuation;try{continuation=a.w.path(point,goal,context.radius,context.ignore);}catch{continue;}
   if(!Array.isArray(continuation)||!continuation.length)continue;
   const progress=horizontal(root,goal)-horizontal(point,goal),alignment=dot(direction,goalDirection),score=minimum*5+progress*.45+alignment*.12-radius*.03;
   if(!best||score>best.score)best={point,continuation,minimum,score};
  }
  if(!best)return false;
  a.route.splice(a.routeIndex,a.route.length-a.routeIndex,[...best.point],...best.continuation.map(point=>[...point]));this.requestKey=null;
  Object.assign(this.traffic,{active:true,mode:'escape',reason:'multi-agent-radial-separation',blockers:neighbours.filter(row=>row.clearance<.5).map(row=>row.actor.id),side:0,detourEndIndex:a.routeIndex,originalTarget:[...goal],lastPlanAtS:a.time,nextPlanAtS:a.time+TRAFFIC_AVOIDANCE.planCooldownS,lastError:null,advancePoint:null,advanceRouteIndex:-1});this.traffic.escapes++;
  a.log?.('交叉区域拥堵，已选择净空最大的移动脱困方向并重新接回原路线');return true;
 }
 rollingTrafficTarget(target,context){"""
if text.count(marker) != 1:
    raise SystemExit('expected one radial escape insertion marker')
text = text.replace(marker, method)

old = "if(this.installLocalDetour(conflict,context)||this.installDeterministicRetreat(conflict,context))return a.route[a.routeIndex];"
new = "if(this.installLocalDetour(conflict,context)||this.installDeterministicRetreat(conflict,context)||this.installRadialEscape(conflict,context))return a.route[a.routeIndex];"
if text.count(old) != 1:
    raise SystemExit('expected one conflict recovery chain')
text = text.replace(old, new)

old = "预测到多人路线冲突，但局部偏移和移动让行均无可用净空："
new = "预测到多人路线冲突，但局部偏移、移动让行和径向脱困均无可用净空："
if text.count(old) != 1:
    raise SystemExit('expected one conflict failure message')
text = text.replace(old, new)

path.write_text(text, encoding='utf-8', newline='\n')
print('radial multi-agent escape patch applied')
