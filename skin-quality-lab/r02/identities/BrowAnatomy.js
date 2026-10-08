// Source-atlas eyebrow curves, traced against the existing R02 scan albedo.
// Coordinates are 4096px source UV pixels, not mirrored world-x assumptions.
// Barycentric UV -> surface validation is recorded in BROW_AGE_R024.md.
const curves=[
 {side:-1,points:[[1950,1100],[1900,1080],[1800,1050],[1700,1040],[1600,1080],[1510,1170]]},
 {side:1,points:[[2150,1100],[2210,1060],[2300,1040],[2430,1050],[2520,1100],[2600,1170]]}
].map(c=>({...c,points:c.points.map(p=>[p[0]/4096,1-p[1]/4096])}));
export function scanBrowGuide(u,v){let best=null;for(const curve of curves)for(let i=0;i<curve.points.length-1;i++){const a=curve.points[i],b=curve.points[i+1],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dy)/den));const d=(u-a[0]-t*dx)**2+(v-a[1]-t*dy)**2;if(!best||d<best.distanceSquared)best={side:curve.side,t:(i+t)/(curve.points.length-1),du:dx,dv:dy,distanceSquared:d};}return best;}
