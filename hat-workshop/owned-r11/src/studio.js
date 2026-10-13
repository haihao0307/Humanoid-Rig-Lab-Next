/* Hat-local EB1 studio interface. Authored projection-contact approximation.
   Self shadows come from the renderer; the ground mask is not ray tracing. */
(function(G){
'use strict';const H=G.HAT10,T=G.OwnHatThree;
function convexHull(points){
 points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const lower=[],upper=[];for(const p of points){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
 for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
 lower.pop();upper.pop();return lower.concat(upper);
}
H.makeContactFootprint=function(data){
 const w=.52,h=.52,res=256,cn=document.createElement('canvas');cn.width=cn.height=res;
 const ctx=cn.getContext('2d'),pts=[];
 for(const piece of data.pieces){if(!/crown|peak|brim|band/.test(piece.name))continue;for(let i=0;i<piece.position.length;i+=15)pts.push([piece.position[i],piece.position[i+2]]);}
 const hull=convexHull(pts);
 function path(){ctx.beginPath();for(let i=0;i<hull.length;i++){const x=(hull[i][0]/w+.5)*res,y=(.5-hull[i][1]/h)*res;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();}
 ctx.fillStyle='#000';ctx.filter='blur(12px)';ctx.globalAlpha=.28;path();ctx.fill();
 ctx.filter='blur(4px)';ctx.globalAlpha=.24;path();ctx.fill();ctx.filter='none';
 const tx=new T.CanvasTexture(cn);tx.colorSpace=T.SRGBColorSpace;
 const mat=new T.MeshBasicMaterial({map:tx,transparent:true,depthWrite:false,toneMapped:false,opacity:.70,polygonOffset:true,polygonOffsetFactor:-1});
 const mesh=new T.Mesh(new T.PlaneGeometry(w,h),mat);mesh.rotation.x=-Math.PI/2;mesh.renderOrder=1;mesh.name='projected-contact-approximation';mesh.userData.dispose=()=>{tx.dispose();mat.dispose();mesh.geometry.dispose();};return mesh;
};
})(globalThis);
