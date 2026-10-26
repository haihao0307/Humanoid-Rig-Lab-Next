/* Original display response compiled as scalar expressions. No source vertex
 * positions, face connections, refined geometry or character buffers are made.
 * Source support relationships remain; this is not an autonomous mother. */
(()=>{'use strict';
function evaluate(program,surface){
 if(program?.schema!=='body-original-display-normal-functions-r29/1')throw Error('原显示法线函数版本不匹配');
 const start=performance.now(),{ops,a,b,c,constants,roots}=program,values=new Float64Array(ops.length);
 for(let i=0;i<ops.length;i++){const x=values[a[i]],y=values[b[i]];switch(ops[i]){case 0:values[i]=constants[i];break;case 1:values[i]=surface.valueAtDomainExtremum(a[i],b[i])[c[i]];break;case 2:values[i]=x+y;break;case 3:values[i]=x-y;break;case 4:values[i]=x*y;break;case 5:values[i]=x/y;break;case 6:values[i]=Math.sqrt(x);break;case 7:values[i]=Math.fround(x);break;case 8:values[i]=x>.72?1:0;break;case 9:values[i]=x?y:values[c[i]];break;case 10:values[i]=x===0?1:x;break;case 11:values[i]=surface.supportValueByOperatorInput(a[i])[b[i]];break;case 12:values[i]=surface.uncorrectedValueAtDomainExtremum(a[i],b[i])[c[i]];break;case 13:values[i]=surface.sourceHeadTransforms[a[i]][b[i]];break;case 14:values[i]=Math.hypot(x,y,values[c[i]]);break;case 15:values[i]=Math.max(.65,Math.min(1.5,x));break;case 16:values[i]=-x;break;case 17:values[i]=x<0?1:0;break;case 18:if(x<1e-8)throw Error('原头颈支撑坐标架退化；保留上一人物');values[i]=x;break;default:throw Error('未知原法线标量指令');}if(!Number.isFinite(values[i]))throw Error('原显示法线函数未能求值；保留上一人物');}
 const coefficients=new Float64Array(program.functions*9);let zeroNormals=0;
 for(let f=0;f<program.functions;f++){const uv=surface.domainParameters(f),[[x0,y0],[x1,y1],[x2,y2]]=uv,det=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(det===0)throw Error('原法线函数域退化');for(let k=0;k<3;k++){const p=[0,1,2].map(corner=>values[roots[f*9+corner*3+k]]),A=((p[1]-p[0])*(y2-y0)-(p[2]-p[0])*(y1-y0))/det,B=((x1-x0)*(p[2]-p[0])-(x2-x0)*(p[1]-p[0]))/det;coefficients.set([A,B,p[0]-A*x0-B*y0],f*9+k*3);}for(let corner=0;corner<3;corner++)if([0,1,2].every(k=>values[roots[f*9+corner*3+k]]===0))zeroNormals++;}
 return{coefficients,normalAtDomainExtremum:(f,corner)=>[0,1,2].map(k=>values[roots[f*9+corner*3+k]]),report:{schema:program.schema,method:'original ordered Float32 area accumulation, current landmark-frame morphology support, and normal-dependent display response expressed as scalar functions',instructions:ops.length,originalFloat32WritesPreserved:true,sourceSupportRelationshipsRetained:true,originalHeadMorphBoundary:program.originalHeadMorphBoundary||null,headSurfaceGenerated:false,zeroNormalObservations:zeroNormals,buildMS:performance.now()-start,sourceFidelityAccepted:false,completedMotherConversion:false}};
}
globalThis.BodyDisplayNormalsR29={evaluate};
})();
