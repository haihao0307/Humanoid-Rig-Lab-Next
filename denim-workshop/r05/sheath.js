 // Representative outer staple strands are geometrical, not a cloth texture.
 for(let kind=0;kind<2;kind++)for(const span of p.spans[kind]){
  let [start,end,id]=span,pitch=kind?g.p.warpPitch:g.p.weftPitch;
  for(let strand=0;strand<3;strand++){
   let seed=id*311+kind*989+strand*127,phase=H(seed+31)*6.283;
   let pts=[],steps=Math.ceil((end-start)*2);
   for(let j=0;j<=steps;j++){
    let t=mix(start,end,j/steps),q=organicPoint(C,g,kind,id,t),theta=phase+t*pitch*(.9+.5*H(seed+51));
    let deriv=(C.sample(g.d,kind,id,t+.01)-C.sample(g.d,kind,id,t-.01))*g.lift/(.02*pitch);
    let T=norm(kind?[1,0,deriv]:[0,1,deriv]),B=kind?[0,1,0]:[1,0,0],V=norm(kind?cross(T,B):cross(B,T));
    let ra=kind?g.p.weftPitch*.235:g.p.warpPitch*.49,rz=g.rz*(kind?.68:1);
    let radiusScale=1.015+.018*Math.sin(t*.9+phase);
    q=add(q,add(mul(B,(ra*radiusScale)*Math.cos(theta)),mul(V,(rz*radiusScale)*Math.sin(theta))));pts.push(q);
   }
   fiber(pts,kind,.008+.004*H(seed+21),`sheath:${kind}:${id}`,'sheath');
  }
 }
