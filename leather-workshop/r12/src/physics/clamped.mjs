/** R03.1 membrane model retained. Both visible jaws restrain their entire end edges.
 * This mode is quasistatic: iterations are NEVER labelled as elapsed physical time.
 */
import {LeatherMaterial,makeSpecimen,MembraneSolver} from '../../r03/site/physics.mjs';
export class ClampedLeather extends MembraneSolver{
 constructor({profile='NL',angle=0,length=240,width=180,nx=16,ny=12,thickness}={}){
  const material=new LeatherMaterial(profile,angle),mesh=makeSpecimen({length,width,nx,ny});super(material,mesh,thickness||material.profile.thickness);
  for(let i=0;i<mesh.X.length/2;i++)if(Math.abs(Math.abs(mesh.X[2*i])-length/2)<1e-7)this.fixed.set(i*2+1,mesh.X[2*i+1]);
  this.free=Array.from({length:this.x.length},(_,i)=>i).filter(i=>!this.fixed.has(i));this.q=Float64Array.from(this.free.map(i=>this.x[i]));this.state=this.evaluate(this.q);this.history=[];this.events=[];
 }
 command(v){this.setStrain(v);this.events.push({type:'gripDisplacement',nominalStrain:v});}
 solve(count=500){this.iterate(count);return this.report();}
 geometry(){const n=this.x.length/2,out=new Float64Array(n*3);for(let i=0;i<n;i++){out[i*3]=this.x[i*2]/1000-this.mesh.length*this.strain/2000;out[i*3+1]=0;out[i*3+2]=this.x[i*2+1]/1000;}return out;}
 snapshot(){return{schema:'kaopu/leather_clamp@1',profile:this.material.recipe(),state:this.report(),nominalStrain:this.strain,thicknessMM:this.thickness,positionsM:Array.from(this.geometry()),triangles:Array.from(this.mesh.tri),boundary:this.mesh.boundary,events:this.events,physicalTime:false,limitations:['quasistatic planar clamping: no dynamic recoil or gravity in this mode']};}
}
