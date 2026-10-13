import {layerLayout} from './material-settings.mjs';
import {inside,knitPoint,stitchColour,COURSE,tileBounds,yarnBatches as inheritedBatches} from './geometry-core.mjs';
export function solidBatches(chart,info,layer=0){if(info.family!=='knit')return inheritedBatches(chart,info);
 const pitch=info.settings.gauge,pattern=info.parameters['knit-pattern']||0,reverse=info.settings.wrongSide,shift=layer===1?[pitch*.5,pitch*COURSE*.5]:[0,0],batches=new Map(),tile=72,span=Math.max(1,Math.floor(tile/pitch));
 const split=(a,b)=>{const out=[];for(let t=a;t<b-1e-7;){const end=Math.min(b,(Math.floor((t+1e-7)/span)+1)*span);if(end<=t)break;out.push([t,end,t===a?1:0,end===b?1:0]);t=end;}return out;};
 const add=(row,carrier,a,b,capA,capB)=>{const q=knitPoint((a+b)*.5,row,pitch,pattern,carrier,reverse),tx=Math.floor((q[0]+shift[0])/tile),ty=Math.floor((q[1]+shift[1])/tile),key=tx+':'+ty;let batch=batches.get(key);if(!batch){batch={kind:0,tx,ty,intervals:[],flags:[],bounds:tileBounds(chart,tx*tile-2*pitch,ty*tile-2*pitch,(tx+1)*tile+2*pitch,(ty+1)*tile+2*pitch,(layerLayout(info).thickness+2)*.001)};batches.set(key,batch);}batch.intervals.push(a,b,row,carrier);batch.flags.push(capA,capB);};
 const t0=Math.floor((chart.lo[0]-shift[0])/pitch)-1,t1=Math.ceil((chart.hi[0]-shift[0])/pitch)+1,r0=Math.floor((chart.lo[1]-shift[1])/(pitch*COURSE))-2,r1=Math.ceil((chart.hi[1]-shift[1])/(pitch*COURSE))+2,dt=1/20;
 for(let row=r0;row<=r1;row++){
  // A row stripe changes the working yarn between rows. It must not expose a
  // second, unused straight float across the ENTIRE row as MP02 did.
  const carriers=pattern===3?[stitchColour(0,row,pattern)]:pattern?[0,1]:[0];
  for(const carrier of carriers){const valid=t=>{const q=knitPoint(t,row,pitch,pattern,carrier,reverse);return inside(chart.poly,q[0]+shift[0],q[1]+shift[1]);};let last=t0,was=valid(t0),start=was?t0:null;
   for(let j=1;j<=Math.ceil((t1-t0)/dt);j++){const now=Math.min(t1,t0+j*dt),yes=valid(now);if(yes!==was){let lo=last,hi=now;for(let k=0;k<12;k++){const mid=(lo+hi)*.5;if(valid(mid)===was)lo=mid;else hi=mid;}const edge=(lo+hi)*.5;if(yes)start=edge;else if(start!==null){for(const r of split(start,edge))add(row,carrier,...r);start=null;}}was=yes;last=now;}
   if(start!==null)for(const r of split(start,t1))add(row,carrier,...r);
  }
 }
 return [...batches.values()].map(b=>({...b,intervals:new Float32Array(b.intervals),flags:new Float32Array(b.flags)}));
}
