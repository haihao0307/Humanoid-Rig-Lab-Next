// Unarmed camp-life sequences built from the existing motion primitives.
// Turns use placement steps, not country-specific parade heel-pivot technique.
export const CAMP_ROUTINES = Object.freeze({
  patrol: { title:'营区巡逻一圈', steps:[
    {type:'walk',target:[0,0,1.4]}, {type:'wait',seconds:2},
    {type:'walk',target:[1.4,0,1.4]}, {type:'wait',seconds:2},
    {type:'walk',target:[1.4,0,0]}, {type:'wait',seconds:2},
    {type:'walk',target:[0,0,0]}, {type:'turn',yaw:0}, {type:'wait',seconds:3}
  ]},
  sentry: { title:'岗哨左右观察', steps:[
    {type:'stop'}, {type:'wait',seconds:3}, {type:'turn',delta:-Math.PI/4},
    {type:'wait',seconds:3}, {type:'turn',delta:Math.PI/2},
    {type:'wait',seconds:3}, {type:'turn',delta:-Math.PI/4}, {type:'wait',seconds:3}
  ]},
  muster: { title:'集合点报到与返回', steps:[
    {type:'walk',target:[.8,0,1.2]}, {type:'turn',yaw:0}, {type:'wait',seconds:8},
    {type:'walk',target:[0,0,0]}, {type:'turn',yaw:0}
  ]}
});
export class CampRoutine {
  constructor(){this.cancel();}
  cancel(){this.id=null;this.index=0;this.waitRemaining=null;this.status='idle';this.reason=null;}
  start(id){if(!CAMP_ROUTINES[id])throw Error('未知军营活动');this.cancel();this.id=id;this.status='running';}
  update(engine,dt){
    if(this.status!=='running')return;
    if(engine.state.fault||engine.state.status==='blocked'){this.status='blocked';this.reason=engine.state.fault||'路线受阻';return;}
    if(engine.state.paused)return;
    if(engine.state.command)return;
    const steps=CAMP_ROUTINES[this.id].steps,step=steps[this.index];
    if(!step){this.status='completed';return;}
    if(step.type==='wait'){
      if(this.waitRemaining===null){this.waitRemaining=step.seconds;return;}
      this.waitRemaining=Math.max(0,this.waitRemaining-dt);
      if(this.waitRemaining<=1e-9){this.index++;this.waitRemaining=null;}return;
    }
    const command=step.type==='turn'?{type:'turn',yaw:step.yaw??engine.state.yaw+step.delta}:step;
    const result=engine.command(command);
    if(!result.accepted){this.status='blocked';this.reason=result.reason;return;}
    this.index++;
  }
  report(){return {id:this.id,title:this.id?CAMP_ROUTINES[this.id].title:null,status:this.status,dispatchedSteps:this.index,totalSteps:this.id?CAMP_ROUTINES[this.id].steps.length:0,waitRemaining:this.waitRemaining,reason:this.reason};}
}
