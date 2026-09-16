// Parameter algebra only. Never imports application code or generates a human.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export function checkFaceMuscleParameters(recipe,assert){
  let checks=0;const check=(value,message)=>{assert(value,'Face muscle parameters: '+message);checks++;};
  const fields=recipe.muscleFields,channels=new Set(recipe.channels.map(c=>c.id));
  check(fields.length===24&&new Set(fields.map(f=>f.id)).size===24,'24 distinct regional strain fields');
  check(recipe.legacyRevisions.includes('r1-local-fields'),'prior face recipes remain importable');
  const determinant=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const identity=()=>[[1,0,0],[0,1,0],[0,0,1]];
  const definitions=fields.map(field=>{
    check(field.centre.length===3&&field.radius.length===3&&field.radius.every(r=>r>0&&r<=.05)&&[...field.centre,...field.radius,...field.liftMm].every(Number.isFinite),'finite regional support '+field.id);
    check(field.centre[1]-field.radius[1]>=1.39&&field.centre[1]+field.radius[1]<=1.585&&field.centre[2]-field.radius[2]>=.1&&Math.abs(field.centre[0])+field.radius[0]<=.092,'C2 support inside head gate '+field.id);
    check(Object.entries(field.activation).every(([id,gain])=>channels.has(id)&&gain>0&&gain<=1),'bounded known activations '+field.id);
    let strain=field.diagonal?field.diagonal.map((v,row)=>[0,1,2].map(col=>row===col?v:0)):null;
    if(field.axis){
      check(Math.abs(Math.hypot(...field.axis)-1)<1e-10&&field.contraction>0&&field.contraction<.25,'unit fiber axis and bounded shortening '+field.id);
      // Independent dyad expansion from the parameter definition.
      strain=[0,1,2].map(row=>[0,1,2].map(col=>(row===col?field.transverseExpansion:0)-(field.contraction+field.transverseExpansion)*field.axis[row]*field.axis[col]));
      const core=strain.map((row,i)=>row.map((v,j)=>v+(i===j?1:0)));
      check(Math.abs(determinant(core)-1)<1e-10,'fiber core compensates transverse volume '+field.id);
    }
    const bias=field.liftMm.map((v,i)=>(v+(field.axis?field.axis[i]*field.contraction*field.anchorMm:0))*.001);
    check(strain.flat().every(Number.isFinite)&&Math.hypot(...bias)<.009,'finite bounded strain and anchored pull '+field.id);
    return {field,strain,bias};
  });
  function evaluate(point,weights){
    const J=identity(),delta=[0,0,0];
    for(const {field,strain,bias}of definitions){
      const activation=Math.min(1,Object.entries(field.activation).reduce((sum,[id,gain])=>sum+(weights[id]||0)*gain,0));if(!activation)continue;
      const relative=point.map((v,i)=>v-field.centre[i]),q=relative.map((v,i)=>v/field.radius[i]),r2=q.reduce((sum,v)=>sum+v*v,0);if(r2>=1)continue;
      const t=1-r2,w=t**3,gradient=q.map((v,i)=>-6*t*t*v/field.radius[i]);
      const d=bias.map((v,i)=>v+strain[i].reduce((sum,e,j)=>sum+e*relative[j],0));
      for(let i=0;i<3;i++){delta[i]+=activation*w*d[i];for(let j=0;j<3;j++)J[i][j]+=activation*(w*strain[i][j]+d[i]*gradient[j]);}
    }
    // Residual lip-part channel still uses the independent manual-point kernel.
    for(const node of recipe.nodes){
      const offset=[0,0,0];for(const channel of recipe.channels){const d=channel.offsets[node.id];if(d)d.forEach((v,i)=>offset[i]+=v*.001*(weights[channel.id]||0));}
      if(!offset.some(Boolean))continue;
      const q=point.map((v,i)=>(v-node.centre[i])/node.radius[i]),r=Math.hypot(...q);if(r>=1)continue;
      const w=(1-r)**4*(4*r+1),g=q.map((v,i)=>-20*(1-r)**3*v/node.radius[i]);
      for(let i=0;i<3;i++){delta[i]+=w*offset[i];for(let j=0;j<3;j++)J[i][j]+=offset[i]*g[j];}
    }
    return {delta,J,determinant:determinant(J)};
  }
  const points=[];
  for(let x=-.09;x<=.0901;x+=.006)for(let y=1.4;y<=1.584;y+=.006)for(let z=.105;z<=.219;z+=.009)points.push([x,y,z]);
  let minimumDeterminant=Infinity,maximumDisplacementMm=0,sampledParameterPoints=0;
  const poses=[...recipe.channels.map(c=>({id:c.id,weights:{[c.id]:1}})),...recipe.presets,{id:'all-channels',weights:Object.fromEntries([...channels].map(id=>[id,1]))}];
  for(const pose of poses){let minimum=Infinity,maximum=0;
    for(const point of points){const result=evaluate(point,pose.weights);minimum=Math.min(minimum,result.determinant);maximum=Math.max(maximum,Math.hypot(...result.delta)*1000);}
    sampledParameterPoints+=points.length;minimumDeterminant=Math.min(minimumDeterminant,minimum);maximumDisplacementMm=Math.max(maximumDisplacementMm,maximum);
    check(minimum>.20,'positive sampled Jacobian for '+pose.id+' (minimum '+minimum.toFixed(4)+')');
    check(maximum<recipe.muscleModel.deformationBudgetMm,'combined displacement budget for '+pose.id+' (maximum '+maximum.toFixed(3)+' mm)');
  }
  // Cross-check the full analytic derivative against a central finite difference
  // of the independent displacement function, including overlapping regions.
  let maxDerivativeError=0;
  const smile=recipe.presets.find(p=>p.id==='smile').weights,h=1e-6;
  for(const point of [[.028,1.470,.18],[.047,1.496,.16],[-.039,1.483,.17],[.020,1.536,.18],[0,1.451,.192]]){
    const {J}=evaluate(point,smile);
    for(let col=0;col<3;col++){const a=point.slice(),b=point.slice();a[col]+=h;b[col]-=h;const da=evaluate(a,smile).delta,db=evaluate(b,smile).delta;
      for(let row=0;row<3;row++)maxDerivativeError=Math.max(maxDerivativeError,Math.abs((da[row]-db[row])/(2*h)+(row===col?1:0)-J[row][col]));
    }
  }
  check(maxDerivativeError<1e-6,'full affine and envelope derivative agrees with finite difference');
  const cheekA=evaluate([.029,1.469,.183],smile).delta,cheekB=evaluate([.047,1.496,.16],smile).delta;
  check(Math.hypot(...cheekA)>0.002&&Math.hypot(...cheekB)>.002&&Math.hypot(...cheekA.map((v,i)=>v-cheekB[i]))>.001,'smile changes regional shape with different cheek and mouth motion');
  return {checks,fields:fields.length,sampledParameterPoints,minimumDeterminant,maximumDisplacementMm,maxDerivativeError,applicationExecuted:false,humanSurfaceGenerated:false,physicalMuscleSimulation:false};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const recipe=JSON.parse(readFileSync(new URL('../body/FaceControlRecipe.json',import.meta.url),'utf8'));
  console.log(JSON.stringify(checkFaceMuscleParameters(recipe,(value,message)=>{if(!value)throw Error(message);}),null,2));
}
