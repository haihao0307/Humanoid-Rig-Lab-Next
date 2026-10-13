import{closestTriangle}from './mesh-contact.mjs';
// Actual material waist attachment: barycentric body triangle plus local offset.
// It moves only the declared waistband anchors, not all cloth vertices.
const basis=(p,F,f)=>{const a=F[f]*3,b=F[f+1]*3,c=F[f+2]*3,u=[p[b]-p[a],p[b+1]-p[a+1],p[b+2]-p[a+2]],v=[p[c]-p[a],p[c+1]-p[a+1],p[c+2]-p[a+2]],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...u)||1,h=Math.hypot(...n)||1;for(let k=0;k<3;k++){u[k]/=l;n[k]/=h;}return[u,[n[1]*u[2]-n[2]*u[1],n[2]*u[0]-n[0]*u[2],n[0]*u[1]-n[1]*u[0]],n];};
export class WaistAttachments{
 constructor(world){this.world=world;const s=world.solvers[1],body=world.body;this.rows=s.pins.map(id=>{const v=s.p.slice(id*3,id*3+3),f=body.nearest(...v),q=closestTriangle(body.p,body.faces,f,...v),axes=basis(body.p,body.faces,f),offset=axes.map(axis=>axis.reduce((sum,x,k)=>sum+x*(v[k]-q[1+k]),0));return{id,f,bary:Array.from(q.slice(4)),offset};});this.previous=new Float64Array(this.rows.length*3);this.target=this.previous.slice();this.update();this.previous.set(this.target);}
 update(){const p=this.world.actor.positions,F=this.world.body.faces;for(let i=0;i<this.rows.length;i++){const r=this.rows[i],axes=basis(p,F,r.f);for(let k=0;k<3;k++){let value=0;for(let j=0;j<3;j++)value+=p[F[r.f+j]*3+k]*r.bary[j]+axes[j][k]*r.offset[j];this.target[i*3+k]=value;}}}
 begin(){this.previous.set(this.target);this.update();}
 apply(fraction=1){const p=this.world.solvers[1].p;for(let i=0;i<this.rows.length;i++)for(let k=0;k<3;k++)p[this.rows[i].id*3+k]=this.previous[i*3+k]*(1-fraction)+this.target[i*3+k]*fraction;}
}
