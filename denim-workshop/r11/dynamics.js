/* R09.1: coarse XPBD cloth in SI units; dense cotton is only its render skin.
 * Macklin et al. 2016/2019 method, own implementation. Coefficients unmeasured.
 * No self collision, physical tear, yarn-level tensile or human-rig integration.
 */
(function(root){'use strict';
function restPoint(x,y,s){
 const h=.072;let z=0;if(s.shape===1){let a=(x+.009+.20*y)/.011,b=(x-.024-.08*y)/.018;z=.009*Math.exp(-a*a)+.003*Math.exp(-b*b)+.014*y+.0005*Math.sin(y*65+x*32);}
 if(s.shape===2){const yy=y+h/2;if(yy<.01){const t=(.01-yy)*302,r=.01/3.02;y=-h/2+.01-r*Math.sin(t);z=r*(1-Math.cos(t));}z+=.0008*Math.exp(-(((x+.011)/.022)**2));}
 if(s.shape===3)z=.003*Math.sin(x*73+.20)*(.55+.45*(.5-y/h))+.0011*Math.sin(x*137+1.1)*(.5-y/h);
 return [x,y,z];
}
class Cloth {
 constructor(options={}){this.nx=25;this.ny=19;this.n=this.nx*this.ny;this.h=1/240;this.options={shape:1,wind:.7,drive:false,damping:1.5,...options};this.x=new Float64Array(this.n*3);this.previous=new Float64Array(this.n*3);this.v=new Float64Array(this.n*3);this.rest=new Float64Array(this.n*3);this.inv=new Float64Array(this.n);this.time=0;this.steps=0;this.dropped=0;this.spheres=[];this.anchorOffsets=new Float64Array(this.nx*3);this.reset();}
 reset(){const nx=this.nx,ny=this.ny;for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const id=j*nx+i,p=restPoint((i/(nx-1)-.5)*.1,(j/(ny-1)-.5)*.072,this.options);this.rest.set(p,id*3);this.inv[id]=j===ny-1?0:1/(.45*.1*.072/this.n);}
 this.x.set(this.rest);this.previous.set(this.rest);this.v.fill(0);this.anchorOffsets.fill(0);this.time=0;this.steps=0;
 const links=[];const add=(a,b,c,type)=>{const k=a*3,l=b*3;links.push(a,b,Math.hypot(this.rest[k]-this.rest[l],this.rest[k+1]-this.rest[l+1],this.rest[k+2]-this.rest[l+2]),c,type);};
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const id=j*nx+i;if(i+1<nx)add(id,id+1,1e-5,0);if(j+1<ny)add(id,id+nx,1e-5,0);if(i+1<nx&&j+1<ny){add(id,id+nx+1,.005,1);add(id+1,id+nx,.005,1);}if(i+2<nx)add(id,id+2,.4,2);if(j+2<ny)add(id,id+2*nx,.4,2);}
 this.links=new Float64Array(links);this.lambda=new Float64Array(links.length/5);this.tether=new Float64Array(this.n);for(let i=0;i<nx;i++)for(let j=ny-2;j>=0;j--){const a=(j*nx+i)*3,b=a+nx*3;this.tether[j*nx+i]=this.tether[(j+1)*nx+i]+Math.hypot(this.rest[a]-this.rest[b],this.rest[a+1]-this.rest[b+1],this.rest[a+2]-this.rest[b+2]);}this.revision=0;}
 controls(o){const old=this.options.shape;Object.assign(this.options,o);if(this.options.shape!==old)this.reset();}
 kick(){for(let i=0;i<this.n;i++){const k=i*3;if(this.inv[i]){const a=this.rest[k]/.024,b=(this.rest[k+1]+.012)/.024;this.v[k+2]+=.055*Math.exp(-a*a-b*b);}}}
 anchors(a){if(!Array.isArray(a)||a.length!==this.nx*3||!a.every(v=>Number.isFinite(v)&&Math.abs(v)<=.015))throw Error('Anchor offsets require 25 xyz offsets in metres within +/-0.015 m');this.anchorOffsets.set(a);}
 colliders(s){if(!Array.isArray(s)||s.length>16||s.some(v=>!Array.isArray(v)||v.length!==4||!v.every(Number.isFinite)||v[3]<=0||v[3]>.2))throw Error('At most 16 spheres [x,y,z,r] in metres');this.spheres=s;}
 step(){const h=this.h,x=this.x,v=this.v,w=this.inv,prev=this.previous,nx=this.nx;this.time+=h;this.steps++;prev.set(x);const damping=Math.exp(-this.options.damping*h),wind=this.options.wind*(.85+.15*Math.sin(this.time*1.7));
 // Local aerodynamic normal from current neighbours, plus gravity; not prescribed position motion.
 for(let j=0;j<this.ny;j++)for(let i=0;i<nx;i++){const id=j*nx+i,k=id*3;if(!w[id]){const phase=this.time*2.3,drive=this.options.drive;const a=i/(nx-1)-.5;x[k]=this.rest[k]+this.anchorOffsets[i*3]+(drive?.0015*Math.sin(phase):0);x[k+1]=this.rest[k+1]+this.anchorOffsets[i*3+1];x[k+2]=this.rest[k+2]+this.anchorOffsets[i*3+2]+(drive?.0025*Math.sin(phase*.81+a):0);continue;}
 const l=(j*nx+Math.max(0,i-1))*3,r=(j*nx+Math.min(nx-1,i+1))*3,d=(Math.max(0,j-1)*nx+i)*3,u=(Math.min(this.ny-1,j+1)*nx+i)*3;
 let ax=prev[r]-prev[l],ay=prev[r+1]-prev[l+1],az=prev[r+2]-prev[l+2],bx=prev[u]-prev[d],by=prev[u+1]-prev[d+1],bz=prev[u+2]-prev[d+2];let xx=ay*bz-az*by,yy=az*bx-ax*bz,zz=ax*by-ay*bx,q=1/Math.max(1e-12,Math.hypot(xx,yy,zz));xx*=q;yy*=q;zz*=q;
 const vn=-v[k]*xx-v[k+1]*yy+(wind-v[k+2])*zz;const acceleration=1.2/.45*.5*vn*Math.abs(vn);
 v[k]=(v[k]+h*xx*acceleration)*damping;v[k+1]=(v[k+1]+h*(-9.81+yy*acceleration))*damping;v[k+2]=(v[k+2]+h*zz*acceleration)*damping;
 x[k]+=h*v[k];x[k+1]+=h*v[k+1];x[k+2]+=h*v[k+2];}
 this.lambda.fill(0);const ls=this.links;for(let pass=0;pass<2;pass++)for(let ci=0;ci<this.lambda.length;ci++){const z=(pass?this.lambda.length-1-ci:ci),k=z*5,a=ls[k],b=ls[k+1],aa=a*3,bb=b*3;let dx=x[aa]-x[bb],dy=x[aa+1]-x[bb+1],dz=x[aa+2]-x[bb+2],len=Math.sqrt(dx*dx+dy*dy+dz*dz);if(len<1e-12)continue;const alpha=ls[k+3]/(h*h),dl=(-(len-ls[k+2])-alpha*this.lambda[z])/(w[a]+w[b]+alpha);this.lambda[z]+=dl;dx*=dl/len;dy*=dl/len;dz*=dl/len;x[aa]+=w[a]*dx;x[aa+1]+=w[a]*dy;x[aa+2]+=w[a]*dz;x[bb]-=w[b]*dx;x[bb+1]-=w[b]*dy;x[bb+2]-=w[b]*dz;}
 // Geodesic upper-bound tethers prevent iteration-limited global elongation; they do not impose a pose.
 for(let i=0;i<this.n;i++){if(!w[i])continue;const k=i*3,a=((this.ny-1)*nx+i%nx)*3;let dx=x[k]-x[a],dy=x[k+1]-x[a+1],dz=x[k+2]-x[a+2],d=Math.sqrt(dx*dx+dy*dy+dz*dz),limit=this.tether[i]*1.005;if(d>limit){const q=limit/d;x[k]=x[a]+dx*q;x[k+1]=x[a+1]+dy*q;x[k+2]=x[a+2]+dz*q;}}
 for(let i=0;i<this.n;i++){const k=i*3;if(w[i])for(const s of this.spheres){let dx=x[k]-s[0],dy=x[k+1]-s[1],dz=x[k+2]-s[2],d=Math.hypot(dx,dy,dz),r=s[3]+.0005;if(d<r){const scale=r/Math.max(1e-12,d);x[k]=s[0]+dx*scale;x[k+1]=s[1]+dy*scale;x[k+2]=s[2]+(d<1e-12?r:dz*scale);}}for(let c=0;c<3;c++)v[k+c]=(x[k+c]-prev[k+c])/h;}
 this.revision++;}
 advance(seconds){const count=Math.min(24,Math.floor(seconds/this.h+1e-6));for(let i=0;i<count;i++)this.step();return count;}
 sample(){const out=new Float32Array(this.n*3);for(let k=0;k<out.length;k++)out[k]=(this.x[k]-this.rest[k])*1000;return out;}
 report(){let maxStretch=0,maxDisplacement=0,kinetic=0,pinError=0;for(let i=0;i<this.n;i++){const k=i*3;maxDisplacement=Math.max(maxDisplacement,Math.hypot(this.x[k]-this.rest[k],this.x[k+1]-this.rest[k+1],this.x[k+2]-this.rest[k+2])*1000);if(this.inv[i])kinetic+=(this.v[k]**2+this.v[k+1]**2+this.v[k+2]**2)/(2*this.inv[i]);}
 for(let k=0;k<this.links.length;k+=5)if(this.links[k+4]===0){const a=this.links[k]*3,b=this.links[k+1]*3;maxStretch=Math.max(maxStretch,Math.abs(Math.hypot(this.x[a]-this.x[b],this.x[a+1]-this.x[b+1],this.x[a+2]-this.x[b+2])/this.links[k+2]-1));}
 return {nodes:this.n,constraints:this.lambda.length,stepHz:240,substepIterations:2,steps:this.steps,simulationSeconds:this.time,maxStretch,maxDisplacementMm:maxDisplacement,kineticJ:kinetic,workerArrayBytes:[this.x,this.previous,this.v,this.rest,this.inv,this.links,this.lambda,this.anchorOffsets,this.tether].reduce((s,a)=>s+a.byteLength,0),unmeasuredCoefficients:true,selfCollision:false,independentYarnPhysics:false};}
}
function workerMain(){let sim=null,playing=false,last=0,acc=0,totalMs=0,slowTime=0;onmessage=e=>{const m=e.data;try{if(m.type==='init'){sim=new Cloth(m.options);last=performance.now();}if(!sim)return;if(m.type==='controls')sim.controls(m.options);if(m.type==='play'){playing=m.value;last=performance.now();acc=0;}if(m.type==='reset')sim.reset();if(m.type==='kick')sim.kick();if(m.type==='anchors')sim.anchors(m.value);if(m.type==='colliders')sim.colliders(m.value);if(m.type==='step')sim.advance(m.seconds);if(m.type==='sample'){const data=sim.sample();postMessage({type:'sample',data,report:{...sim.report(),solverMs:totalMs,droppedWallSeconds:slowTime,playing}},[data.buffer]);totalMs=0;}}catch(err){postMessage({type:'error',message:String(err.message||err)});playing=false;}};
 setInterval(()=>{if(!sim||!playing)return;const now=performance.now(),delta=(now-last)/1000;last=now;const bounded=Math.min(delta,.05);slowTime+=Math.max(0,delta-bounded);acc+=bounded;const start=performance.now();let n=0;while(acc>=sim.h&&n++<12){sim.step();acc-=sim.h;}totalMs+=performance.now()-start;},8);}
function create(gl,request){const n=25*19,linear=!!gl.getExtension('OES_texture_float_linear');const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA32F,25,19*3);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,linear?gl.LINEAR:gl.NEAREST],[gl.TEXTURE_MAG_FILTER,linear?gl.LINEAR:gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
 const field=new Float32Array(n*12);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,25,57,gl.RGBA,gl.FLOAT,field);
 const src=restPoint.toString()+'\n'+Cloth.toString()+'\n('+workerMain.toString()+')();';const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'}));const worker=new Worker(url);URL.revokeObjectURL(url);
 const out={worker,texture,field,linear,gpuBytes:field.byteLength,cpuBytes:field.byteLength,report:null,active:false,revision:0,pending:false,dirty:false,pad:[0,0,0]};
 worker.onmessage=e=>{const m=e.data;if(m.type==='error'){out.error=m.message;out.active=false;request();return;}if(m.type!=='sample')return;out.pending=false;out.report=m.report;const d=m.data;out.pad.fill(0);for(let j=0;j<19;j++)for(let i=0;i<25;i++){const id=j*25+i;for(let c=0;c<3;c++){const v=d[id*3+c];field[id*4+c]=v;out.pad[c]=Math.max(out.pad[c],Math.abs(v));const l=j*25+Math.max(0,i-1),r=j*25+Math.min(24,i+1),b=Math.max(0,j-1)*25+i,t=Math.min(18,j+1)*25+i;field[(n+id)*4+c]=(d[r*3+c]-d[l*3+c])/((r-l)*100/24);field[(n*2+id)*4+c]=(d[t*3+c]-d[b*3+c])/((t-b)/25*72/18);}}
 out.revision++;out.dirty=true;if(!out.playing)request();};
 out.send=(type,extra={})=>worker.postMessage({type,...extra});out.sample=()=>{if(!out.pending){out.pending=true;out.send('sample');}};out.play=value=>{if(out.playing===value)return;out.playing=value;out.send('play',{value});};out.upload=()=>{if(!out.dirty)return;gl.activeTexture(gl.TEXTURE10);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,25,57,gl.RGBA,gl.FLOAT,field);out.dirty=false;};out.reset=options=>{out.send('controls',{options});out.send('reset');out.sample();};out.send('init',{options:{}});return out;
}
const glsl=`
uniform highp sampler2D uClothDelta;uniform int uPhysics;
vec3 clothDelta(vec2 m,int row){vec2 uv=clamp((m/vec2(100.,72.)+.5)*vec2(24.,18.),vec2(0),vec2(24.,18.));ivec2 lo=ivec2(min(floor(uv),vec2(23.,17.)));vec2 f=uv-vec2(lo);lo.y+=row*19;return mix(mix(texelFetch(uClothDelta,lo,0).xyz,texelFetch(uClothDelta,lo+ivec2(1,0),0).xyz,f.x),mix(texelFetch(uClothDelta,lo+ivec2(0,1),0).xyz,texelFetch(uClothDelta,lo+ivec2(1,1),0).xyz,f.x),f.y);}
void dynamicFrame(vec2 m,inout vec3 base,inout mat3 b){if(uPhysics==0)return;base+=clothDelta(m,0);vec3 x=b[0]+clothDelta(m,1),y=b[1]+clothDelta(m,2);b=mat3(x,y,normalize(cross(x,y)));}
`;
function shader(linear){if(!linear)return glsl;return glsl.replace(/vec3 clothDelta[\s\S]*?\nvoid dynamicFrame/,`vec3 clothDelta(vec2 m,int row){vec2 q=clamp(m/vec2(100.,72.)+.5,vec2(0),vec2(1))*vec2(24.,18.);return textureLod(uClothDelta,(q+vec2(.5,float(row*19)+.5))/vec2(25.,57.),0.).xyz;}
void dynamicFrame`);}
root.KAOPUClothDynamics={Cloth,restPoint,create,glsl,shader};if(typeof module!=='undefined')module.exports=root.KAOPUClothDynamics;
})(globalThis);
