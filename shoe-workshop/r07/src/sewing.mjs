import {buildSeam,continuousRoutes,auditSeam} from '../../r05/src/seam-adapter.mjs';
import {mix,add,mul,dist,unit,cross} from './geometry.mjs';
export {yarnGeometry,simplifyPath} from '../../r05/src/sewing.mjs';
/** Same donor saddle topology; replace chord frames by the actual curved host surface.
 * Groove and skin response are prescribed static appearance, never labelled force-solving.
 */
export function seatedSaddle(stations,frame,diameter=.32){
 const count=stations.length;if(count<2)return [];
 const half=Math.min(8,Math.max(.2,stations.reduce((s,h)=>s+dist(h.outer,h.inner),0)/count/2));
 const donor=buildSeam({count,pitch:3.8,diameter,layerThickness:half,tightness:1,holeAngle:48,groove:.095}),offset=(count-1)*3.8/2,raw=continuousRoutes(donor)[0].points,points=[];
 for(let j=0;j<raw.length;j++){const p=raw[j];if(j&&dist(p,raw[j-1])<.02)continue;const u=Math.max(0,Math.min(count-1,(p[0]+offset)/3.8)),h=frame(u),side=unit(cross(h.n,h.tangent));let q;
  if(p[1]>half)q=add(h.outer,mul(h.n,p[1]-half));else if(p[1]<-half)q=add(h.inner,mul(h.n,p[1]+half));else q=mix(h.inner,h.outer,.5+p[1]/(2*half));
  points.push(add(q,mul(side,p[2]+5)));
 }
 return [{points,diameter,radiusMm:diameter/2,normalHint:stations[0].n,sourceAudit:auditSeam(donor),sourceHoleCount:count,surfaceCoupling:'Curved surface chart + shared compressed shell field; no station-chord interpolation',prescribedGrooveMm:.095,physics:false}];
}
