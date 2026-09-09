// Couple broad muscle rest geometry to the skin actually generated for this rig.
// A projected triangle index is temporary constructor data, never an imported asset.
function makeSkinSectionIndex(g,axis=2){
  const coordinates=[0,1,2].filter(k=>k!==axis),[U,V]=coordinates;
  const cell=.012,bins=new Map(),p=new Float32Array(g.p.length),indices=g.i;
  for(let k=0;k<g.p.length;k+=3)p.set([g.p[k+U],g.p[k+V],g.p[k+axis]],k);
  for(let t=0;t<indices.length;t+=3){
    const a=indices[t]*3,b=indices[t+1]*3,c=indices[t+2]*3;
    const x0=Math.floor(Math.min(p[a],p[b],p[c])/cell),x1=Math.floor(Math.max(p[a],p[b],p[c])/cell);
    const y0=Math.floor(Math.min(p[a+1],p[b+1],p[c+1])/cell),y1=Math.floor(Math.max(p[a+1],p[b+1],p[c+1])/cell);
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
      const key=x+':'+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(t);
    }
  }
  return original=>{
    const P=[original[U],original[V],original[axis]];
    const z=[];
    for(const t of bins.get(Math.floor(P[0]/cell)+':'+Math.floor(P[1]/cell))||[]){
      const a=indices[t]*3,b=indices[t+1]*3,c=indices[t+2]*3;
      const abx=p[b]-p[a],aby=p[b+1]-p[a+1],acx=p[c]-p[a],acy=p[c+1]-p[a+1],d=abx*acy-aby*acx;
      if(Math.abs(d)<1e-12)continue;
      const dx=P[0]-p[a],dy=P[1]-p[a+1],u=(dx*acy-dy*acx)/d,v=(abx*dy-aby*dx)/d;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)z.push(p[a+2]+u*(p[b+2]-p[a+2])+v*(p[c+2]-p[a+2]));
    }
    z.sort((a,b)=>a-b);return z.filter((v,k)=>!k||Math.abs(v-z[k-1])>1e-6);
  };
}
function fitBroadMusclesToSkin(tissue,skin){
  const indexes=new Map(),margin=.0025,report={method:'paired fibre-chart fit to generated skin',marginM:margin,verticesAdjusted:0,maxAdjustmentM:0,unresolvedVertices:0,adjustments:[]};
  for(const m of tissue.muscles)if(m.sheet&&!m.lowerLimbSheet&&!/_(trapezius|latissimus|erector_spinae|gluteus_maximus|gluteus_medius)$/.test(m.id)){
    const {axis,outward,nodes}=m.sheetChart,g=m.sheet.g,p=Array.from(g.p);
    if(!indexes.has(axis))indexes.set(axis,makeSkinSectionIndex(skin,axis));const section=indexes.get(axis);
    let changed=0,maxAdjustment=0,missing=0;
    for(const node of nodes){
      const hits=section(node.base),pairs=[];
      for(let k=0;k+1<hits.length;k+=2){const low=hits[k],high=hits[k+1];
        // A shoulder muscle may not jump to the opposite side of the torso.
        if(axis===0&&outward*((low+high)/2)<-.001)continue;
        pairs.push({low,high,d:Math.max(low-node.base[axis],node.base[axis]-high,0)});
      }
      pairs.sort((a,b)=>a.d-b.d);const pair=pairs[0];
      if(!pair){missing++;continue;}
      const thickness=Math.min(m.sheetThickness*.5,(pair.high-pair.low)*.40),ratio=thickness/(m.sheetThickness*.5);
      const surface=outward>0?pair.high:pair.low,center=surface-outward*(margin+thickness);
      node.center=[...node.base];node.center[axis]=center;
      for(const [id,sign] of [[node.a,1],[node.b,-1]]){
        const Q=[...node.base];Q[axis]=center+outward*sign*node.half*ratio;
        // A shared rim has zero thickness, including exact floating point ends.
        if(node.a===node.b)Q[axis]=center;
        maxAdjustment=Math.max(maxAdjustment,Math.abs(Q[axis]-p[id*3+axis]));p.splice(id*3,3,...Q);g.tissueData[id*4+1]=node.half*ratio;changed++;
      }
    }
    let revised=mesh(p,Array.from(g.i)),volume=0;
    for(let k=0;k<revised.i.length;k+=3){const [a,b,c]=Array.from(revised.i.subarray(k,k+3)).map(v=>Array.from(revised.p.subarray(v*3,v*3+3)));volume+=dot(a,cross(b,c))/6;}
    if(volume<0){for(let k=0;k<revised.i.length;k+=3)[revised.i[k+1],revised.i[k+2]]=[revised.i[k+2],revised.i[k+1]];for(let k=0;k<revised.n.length;k++)revised.n[k]*=-1;}
    g.p=revised.p;g.n=revised.n;g.i=revised.i;refreshMuscleSamples(m);
    report.verticesAdjusted+=changed;report.maxAdjustmentM=Math.max(report.maxAdjustmentM,maxAdjustment);report.unresolvedVertices+=missing;
    report.adjustments.push({id:m.id,verticesAdjusted:changed,maxAdjustmentM:maxAdjustment,missingChartNodes:missing});
  }
  tissue.envelopeFit=report;return report;
}
