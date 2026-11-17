// Gray-reference optimization of the original eyelid section application.
// Same vertex order, face order, Float32 accumulation and normal support;
// replaces repeated Set membership with a dense support mask. It is not used
// by the character mother or by skin/eyelash material views.
export function installGrayFastLidApply(referenceWindow){
 if(referenceWindow.__GRAY_LID_APPLY__)throw Error('眼睑优化已经安装');let enabled=true,calls=0,totalMS=0;
 function apply(record,strength,done){if(!enabled)throw Error('眼睑优化已停用');if(!record)return;const t=performance.now(),g=record.geometry,a=g.attributes,p=a.position.array,n=a.normal.array;p.set(record.basePosition);n.set(record.baseNormal);
  if(strength>0){const N=a.position.count,affected=new Uint8Array(N),support=new Uint8Array(N);for(let k=0;k<record.ids.length;k++){const id=record.ids[k],offset=record.offsets[k]*strength;affected[id]=1;for(let j=0;j<3;j++)p[id*3+j]+=offset*record.frame.front[j];}
   const index=g.index.array;let supportCount=0;for(let j=0;j<index.length;j+=3){const x=index[j],y=index[j+1],z=index[j+2];if(affected[x]||affected[y]||affected[z]){if(!support[x]){support[x]=1;supportCount++;}if(!support[y]){support[y]=1;supportCount++;}if(!support[z]){support[z]=1;supportCount++;}}}
   const acc=new Float32Array(p.length);for(let j=0;j<index.length;j+=3){const x=index[j],y=index[j+1],z=index[j+2];if(!support[x]&&!support[y]&&!support[z])continue;const p0=x*3,p1=y*3,p2=z*3,b=p[p1]-p[p0],u=p[p1+1]-p[p0+1],v=p[p1+2]-p[p0+2],r=p[p2]-p[p0],s=p[p2+1]-p[p0+1],q=p[p2+2]-p[p0+2],i=u*q-v*s,jj=v*r-b*q,k=b*s-u*r;if(support[x]){acc[p0]+=i;acc[p0+1]+=jj;acc[p0+2]+=k;}if(support[y]){acc[p1]+=i;acc[p1+1]+=jj;acc[p1+2]+=k;}if(support[z]){acc[p2]+=i;acc[p2+1]+=jj;acc[p2+2]+=k;}}
   for(let i=0;i<N;i++)if(support[i]){const j=i*3,len=Math.hypot(acc[j],acc[j+1],acc[j+2])||1;n[j]=acc[j]/len;n[j+1]=acc[j+1]/len;n[j+2]=acc[j+2]/len;}record.normalVertices=supportCount;
  }
  a.position.needsUpdate=true;a.normal.needsUpdate=true;done();calls++;totalMS+=performance.now()-t;
 }
 referenceWindow.__GRAY_LID_APPLY__=apply;
 return Object.freeze({setEnabled(x){enabled=!!x;referenceWindow.__GRAY_LID_APPLY__=enabled?apply:null;},report:()=>({calls,totalMS,grayOnly:true}),dispose(){if(referenceWindow.__GRAY_LID_APPLY__===apply)delete referenceWindow.__GRAY_LID_APPLY__;enabled=false;}});
}
