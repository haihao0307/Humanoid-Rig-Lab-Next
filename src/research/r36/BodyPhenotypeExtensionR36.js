/* Optional source-derived scalar responses on existing function domains.
 * Coefficients use a local linear Bernstein basis; no global character point
 * table or face connectivity is constructed. */
(()=>{'use strict';
function validate(extension,domains,baseSHA){
 if(extension?.schema!=='body-phenotype-domain-extension-r36/1'||!extension.sourceDerived||extension.sourceBodyProgramSHA256!==baseSHA||extension.domainCount!==domains||extension.characterVertexArrays!==false||extension.characterFaces!==false)throw Error('年龄与性别的身体函数数据不匹配');
 const n=extension.fields.length;if(extension.offsets.length!==domains*2+1||extension.offsets[0]!==0||extension.offsets.at(-1)!==n||extension.presence.length!==n||extension.coefficients.length!==n*9)throw Error('年龄与性别的身体函数数据不完整');
 for(let i=1;i<extension.offsets.length;i++)if(extension.offsets[i]<extension.offsets[i-1])throw Error('身体函数范围无效');
 return extension;
}
function prepare(program,weights){
 const extensions=(program.phenotypeExtensions||[]).filter(e=>e.fieldsIncluded.some(i=>weights[i]!==0));
 if(!extensions.length)return null;
 const byDomain=Array.from({length:program.charts.length*2},()=>[]);
 for(const e of extensions)for(let domain=0;domain<byDomain.length;domain++)for(let i=e.offsets[domain];i<e.offsets[domain+1];i++){const field=e.fields[i];if(weights[field]!==0)byDomain[domain].push({field,e,i});}
 for(const list of byDomain)if(list.length>1)list.sort((a,b)=>a.field-b.field);
 return byDomain;
}
function apply(rest,base,extra,weights,q,corner,scalar){
 let b=0,e=0;while(b<base.length||e<(extra?.length||0)){
  const baseField=b<base.length?base[b].field:Infinity,extraField=e<(extra?.length||0)?extra[e].field:Infinity;
  if(baseField===extraField)throw Error('身体形态函数存在重复项');
  if(baseField<extraField){const op=base[b++],w=weights[op.field];if(w===0)continue;for(let k=0;k<3;k++){const present=scalar(op.presence[k],q);if(present!==0&&present!==1)throw Error('身体形态函数范围未解决');if(present)rest[k]+=w*scalar(op.delta[k],q);}}
  else{const op=extra[e++],w=weights[op.field],mask=op.e.presence[op.i];for(let k=0;k<3;k++)if(mask&(1<<(k*3+corner)))rest[k]+=w*op.e.coefficients[op.i*9+k*3+corner];}
 }
}
globalThis.BodyPhenotypeExtensionR36={validate,prepare,apply};
})();
