/* Runtime measurements are allocation accounting and API submission time,
   NOT OS utilization percentages. GPU queries are optional/asynchronous. */
(function(root){'use strict';
function sphereVisible(vp,c,r){for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){let a=vp[3]+sign*vp[axis],b=vp[7]+sign*vp[4+axis],d=vp[11]+sign*vp[8+axis],w=vp[15]+sign*vp[12+axis];if(a*c[0]+b*c[1]+d*c[2]+w < -r*Math.hypot(a,b,d))return false;}return true;}
function carrier(m,state,size){let [x,y]=root.KAOPUClothStructure.field(m[0],m[1],state.structure),z=0;
 if(state.shape===1){let a=(x+9+.20*y)/11,b=(x-24-.08*y)/18;z=9*Math.exp(-a*a)+3*Math.exp(-b*b)+.014*y+.5*Math.sin(y*.065+x*.032);}
 if(state.shape===2){let yy=y+size[1]/2;if(yy<10){let t=(10-yy)*.302,r=10/3.02;y=-size[1]/2+10-r*Math.sin(t);z=r*(1-Math.cos(t));}z+=.8*Math.exp(-(((x+11)/22)**2));}
 if(state.shape===3)z=3*Math.sin(x*.073+.2)*(.55+.45*(.5-y/size[1]))+1.1*Math.sin(x*.137+1.1)*(.5-y/size[1]);
 z+=.13*Math.sin(x*.293+y*.187)*Math.sin(y*.117+1.31)+.07*Math.sin(x*.131-y*.337+.79);return [x,y,z];
}
function bounds(range,kind,g,state){const [lo,hi,id]=range,points=[],size=[g.p.width,g.p.height];for(let j=0;j<=8;j++){const t=lo+(hi-lo)*j/8,m=kind?[t*g.p.warpPitch-size[0]/2,(id+.5)*g.p.weftPitch-size[1]/2]:[(id+.5)*g.p.warpPitch-size[0]/2,t*g.p.weftPitch-size[1]/2];points.push(carrier(m,state,size));}const center=points[4];return {center,radius:Math.max(...points.map(p=>Math.hypot(...p.map((v,i)=>v-center[i]))))+2.5};}
class Timer{
 constructor(gl){this.gl=gl;this.ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.pending=[];this.current=null;this.lastMs=null;this.samples=0;this.disjoint=false;}
 begin(){const g=this.gl,e=this.ext;if(!e||this.current||this.pending.length>=3)return;const q=g.createQuery();g.beginQuery(e.TIME_ELAPSED_EXT,q);this.current=q;}
 end(){if(this.current){this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);this.pending.push(this.current);this.current=null;}}
 poll(){const g=this.gl,e=this.ext;if(!e||!this.pending.length)return;if(g.getParameter(e.GPU_DISJOINT_EXT)){this.pending.forEach(q=>g.deleteQuery(q));this.pending=[];this.lastMs=null;this.disjoint=true;return;}const q=this.pending[0];if(g.getQueryParameter(q,g.QUERY_RESULT_AVAILABLE)){this.lastMs=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;this.samples++;g.deleteQuery(q);this.pending.shift();this.disjoint=false;}}
}
root.KAOPURuntimeBudget={sphereVisible,bounds,carrier,Timer};if(typeof module!=='undefined')module.exports=root.KAOPURuntimeBudget;
})(globalThis);
