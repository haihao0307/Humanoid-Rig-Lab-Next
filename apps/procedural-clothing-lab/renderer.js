import { evaluateMaterialAppearance } from '../../packages/procedural-clothing/index.js';

export function createRenderer(canvas, getState) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let yaw = -.42, pitch = -.08, zoom = 1, rotating = true, wireframe = false, dragging = false, last = [0, 0], frame = 0;
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2), rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * ratio));
    canvas.height = Math.max(1, Math.floor(rect.height * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  function project(x, y, z, centerY, scale, width, height) {
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const rx=cy*x+sy*z,rz0=-sy*x+cy*z,ry0=y-centerY,ry=cp*ry0-sp*rz0,rz=sp*ry0+cp*rz0;
    const perspective=2.8/Math.max(1.4,2.8-rz);
    return [width*.5+rx*scale*perspective,height*.53-ry*scale*perspective,rz];
  }
  function body(width,height,centerY,scale,state) {
    const m=state.bodyProfile.measurements,r=state.payload.fitContract.resolved;
    const rings=[[m.shoulderY-m.bodyHeight*.1,r.chestSemiWidth-r.surfaceClearance,m.chestDepth*.5],[m.waistY,r.waistSemiWidth-r.surfaceClearance,m.waistDepth*.5],[m.pelvisY,Math.max(r.chestSemiWidth*.84,r.hemSemiWidth*.96),m.waistDepth*.56]];
    ctx.strokeStyle='rgba(133,188,235,.20)';ctx.lineWidth=1;
    for(const [y,a,b] of rings){ctx.beginPath();for(let i=0;i<=42;i+=1){const q=i/42*Math.PI*2,p=project(a*Math.cos(q),y,b*Math.sin(q),centerY,scale,width,height);i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]);}ctx.stroke();}
    const h=project(0,m.shoulderY+m.bodyHeight*.105,0,centerY,scale,width,height),hs=scale*.082;
    ctx.beginPath();ctx.ellipse(h[0],h[1],hs*.72,hs,0,0,Math.PI*2);ctx.stroke();
  }
  function garment(width,height,centerY,scale,state) {
    const {payload,materialDNA}=state,points=Array(payload.topology.vertexCount);
    for(let v=0;v<points.length;v+=1){const o=v*3;points[v]=project(payload.positions[o],payload.positions[o+1],payload.positions[o+2],centerY,scale,width,height);}
    const faces=[];
    for(let i=0;i<payload.indices.length;i+=3){const a=payload.indices[i],b=payload.indices[i+1],c=payload.indices[i+2];faces.push([a,b,c,(points[a][2]+points[b][2]+points[c][2])/3]);}
    faces.sort((a,b)=>a[3]-b[3]);
    for(const [a,b,c] of faces){const no=a*3,nx=payload.normals[no],ny=payload.normals[no+1],nz=payload.normals[no+2],cy=Math.cos(yaw),sy=Math.sin(yaw);
      const light=Math.max(.18,Math.min(1,.46+((cy*nx+sy*nz)*-.42+ny*.72+(-sy*nx+cy*nz)*.54)*.44));
      const co=a*2,sample=evaluateMaterialAppearance(materialDNA,[payload.materialCoords[co],payload.materialCoords[co+1]],frame),color=sample.colorLinear.map((v)=>Math.round(Math.pow(v*light,1/2.2)*255));
      ctx.beginPath();ctx.moveTo(points[a][0],points[a][1]);ctx.lineTo(points[b][0],points[b][1]);ctx.lineTo(points[c][0],points[c][1]);ctx.closePath();ctx.fillStyle=`rgba(${color[0]},${color[1]},${color[2]},.94)`;ctx.fill();
      if(wireframe){ctx.strokeStyle='rgba(220,240,255,.16)';ctx.lineWidth=.45;ctx.stroke();}}
  }
  function render(){const state=getState(),rect=canvas.getBoundingClientRect(),width=rect.width,height=rect.height;if(rotating&&!dragging)yaw+=.0025;ctx.fillStyle='#070a10';ctx.fillRect(0,0,width,height);const g=ctx.createRadialGradient(width*.53,height*.48,0,width*.53,height*.48,Math.max(width,height)*.64);g.addColorStop(0,'rgba(28,45,70,.32)');g.addColorStop(1,'rgba(5,8,13,0)');ctx.fillStyle=g;ctx.fillRect(0,0,width,height);if(state.payload){const r=state.payload.fitContract.resolved,centerY=(r.hemY+r.shoulderY)*.5+state.bodyProfile.measurements.bodyHeight*.05,scale=Math.min(width,height)*.70/state.bodyProfile.measurements.bodyHeight*zoom;body(width,height,centerY,scale,state);garment(width,height,centerY,scale,state);}frame+=1;requestAnimationFrame(render);}
  canvas.onpointerdown=(e)=>{dragging=true;last=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=(e)=>{if(!dragging)return;yaw+=(e.clientX-last[0])*.008;pitch=Math.max(-.65,Math.min(.65,pitch+(e.clientY-last[1])*.005));last=[e.clientX,e.clientY];};
  canvas.onpointerup=()=>{dragging=false;};
  canvas.addEventListener('wheel',(e)=>{e.preventDefault();zoom=Math.max(.55,Math.min(1.8,zoom*Math.exp(-e.deltaY*.001)));},{passive:false});
  addEventListener('resize',resize);
  return {start(){resize();render();},setView(view){yaw=view==='front'?0:view==='side'?Math.PI*.5:Math.PI;pitch=-.05;rotating=false;},toggleRotation(){rotating=!rotating;return rotating;},toggleWireframe(){wireframe=!wireframe;return wireframe;}};
}
