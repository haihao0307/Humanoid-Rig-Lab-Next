/** Sparse trilinear shading field; octahedral coefficients decoded once. */
export function createCompactNormalField(data){
  if(data.schema!=='compact-human-normal-field/v1')throw Error('Wrong normal field schema');
  const groups=new Map(data.groups.map(g=>{
    const cells=new Map(),directions=new Float32Array(g.normalU.length*3),ends=new Uint32Array(g.normalU.length);
    let start=0;
    for(let i=0;i<g.cellOctantIndices.length;i++){
      const cell=Math.floor(g.cellOctantIndices[i]/8);
      if(!cells.has(cell)){if(i)ends[start]=i;start=i;cells.set(cell,i);}
      let x=g.normalU[i]/g.normalUnit,y=g.normalV[i]/g.normalUnit,z=1-Math.abs(x)-Math.abs(y);
      if(z<0){const ox=x;x=(1-Math.abs(y))*(ox>=0?1:-1);y=(1-Math.abs(ox))*(y>=0?1:-1);}
      const length=Math.hypot(x,y,z);directions.set([x/length,y/length,z/length],3*i);
    }
    ends[start]=g.normalU.length;
    return [g.name,{...g,cells,directions,ends,weights:Float32Array.from(g.areaWeight,Math.sqrt)}];
  }));
  return (name,p,hint,ignoreHint=false)=>{
    const g=groups.get(name);if(!g)return hint;
    const qx=p[0]/g.stepMetres-g.originCell[0]-.5,qy=p[1]/g.stepMetres-g.originCell[1]-.5,qz=p[2]/g.stepMetres-g.originCell[2]-.5;
    const bx=Math.floor(qx),by=Math.floor(qy),bz=Math.floor(qz),[dx,dy,dz]=g.dimensions,n=g.directions;
    let sx=0,sy=0,sz=0,weight=0;
    for(let x=bx;x<=bx+1;x++){if(x<0||x>=dx)continue;const wx=1-Math.abs(qx-x);
      for(let y=by;y<=by+1;y++){if(y<0||y>=dy)continue;const wxy=wx*(1-Math.abs(qy-y));
        for(let z=bz;z<=bz+1;z++){if(z<0||z>=dz)continue;const start=g.cells.get((x*dy+y)*dz+z);if(start===undefined)continue;
          const spatial=wxy*(1-Math.abs(qz-z));
          for(let i=start;i<g.ends[start];i++){const k=3*i,alignment=ignoreHint?1:n[k]*hint[0]+n[k+1]*hint[1]+n[k+2]*hint[2];if(alignment<.1)continue;
            const w=spatial*g.weights[i]*alignment*alignment;sx+=w*n[k];sy+=w*n[k+1];sz+=w*n[k+2];weight+=w;}
        }
      }
    }
    const length=Math.hypot(sx,sy,sz);return weight&&length>1e-20?[sx/length,sy/length,sz/length]:hint;
  };
}
