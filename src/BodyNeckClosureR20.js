/* Close only the retained body-side neck boundary. The plane is fitted from
 * that boundary at the current pose; raised limbs are protected by their
 * reference coordinates. Head geometry and head variables are untouched. */
(()=>{'use strict';const M=BodyMathR01;
function apply(region,result,curve,positions,smallestEigen){const centre=[0,0,0];for(const i of curve)for(let k=0;k<3;k++)centre[k]+=positions[i*3+k]/curve.length;const covariance=Array(9).fill(0);for(const i of curve){const p=[positions[i*3]-centre[0],positions[i*3+1]-centre[1],positions[i*3+2]-centre[2]];for(let r=0;r<3;r++)for(let c=0;c<3;c++)covariance[r*3+c]+=p[r]*p[c];}const up=M.vector(result.attachment.neck02.bodySkin,[0,0,1]),normal=smallestEigen(covariance,M.unit([up[0],up[2],-up[1]])),g=region.dimensions,b=region.bounds,field=region.field,f=result.calibration.torsoFrame;let changed=0;
 for(let z=0;z<g[2];z++){const pz=b[2][0]+(z+.5)*(b[2][1]-b[2][0])/g[2];for(let y=0;y<g[1];y++){const py=b[1][0]+(y+.5)*(b[1][1]-b[1][0])/g[1];for(let x=0;x<g[0];x++){const at=(x+g[0]*(y+g[1]*z))*4,u=(field[at+2]-f.origin[2])/f.height,a=Math.abs(field[at+1]-f.origin[0])/f.halfWidth;if(u<.93||a>.90)continue;const px=b[0][0]+(x+.5)*(b[0][1]-b[0][0])/g[0],plane=(px-centre[0])*normal[0]+(py-centre[1])*normal[1]+(pz-centre[2])*normal[2];if(plane>field[at]){field[at]=plane;if(region.normalField){region.normalField[at]=normal[0];region.normalField[at+1]=normal[1];region.normalField[at+2]=normal[2];}changed++;}}}}
 region.neckClosure={method:'current boundary least-squares plane in the body-side neck domain',sourceDerivedBoundary:true,headGenerated:false,centre,normal,changedVoxels:changed};return region;
}
globalThis.BodyNeckClosureR20={apply};
})();
