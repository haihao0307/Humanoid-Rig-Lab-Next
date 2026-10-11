import {MeshRay as InheritedRay} from '../../r03b/src/surface.mjs';
/** Same ray/triangle equations; streaming bounds avoid JS argument-count overflow on dense shells. */
export class MeshRay extends InheritedRay{
 node(ts){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const t of ts)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}const o={min,max};if(ts.length<12){o.ts=ts;return o;}let k=0;for(let j=1;j<3;j++)if(max[j]-min[j]>max[k]-min[k])k=j;ts.sort((a,b)=>a.center[k]-b.center[k]);const m=ts.length>>1;o.a=this.node(ts.slice(0,m));o.b=this.node(ts.slice(m));return o;}
}
