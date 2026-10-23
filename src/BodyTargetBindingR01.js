/* Authored common-rest rig fitting using the existing named correspondence.
 * Source joint positions and labels remain retained calibration data. This
 * computes an animation bind, not a recovered anatomical skeleton. */
(()=>{'use strict';const M=BodyMathR01;
function buildBodyTargetBindingR01({sourceBind,jointNames,parents,annyBoneNames,annyRestHeads}){
 const lookup=Object.fromEntries(jointNames.map((s,i)=>[s,i])),bodyLookup=Object.fromEntries(annyBoneNames.map((s,i)=>[s,i])),origin=name=>M.position(sourceBind[lookup[name]]),target=name=>Array.from(annyRestHeads.slice(bodyLookup[name]*3,bodyLookup[name]*3+3)),locations=[],rotations=[],scales=jointNames.map(()=>1),provenance=[];
 const put=(name,p,r=M.I(),s=1,note='named correspondence')=>{const j=lookup[name];if(j===undefined)throw Error('Missing body joint '+name);locations[j]=p;rotations[j]=r;scales[j]=s;provenance[j]=note;};
 function segment(from,to,a,b){const p=target(a),q=target(b),before=M.sub(origin(to),origin(from)),after=M.sub(q,p);put(from,p,M.align(before,after),M.norm(after)/M.norm(before),a+' -> '+b);}
 const offset=M.sub(target('root'),origin('root'));put('body_world',M.add(origin('body_world'),offset));put('root',target('root'));
 for(const[from,to,a,b]of[['c_spine0','c_spine1','spine05','spine04'],['c_spine1','c_spine2','spine04','spine03'],['c_spine2','c_spine3','spine03','spine01'],['c_spine3','c_neck','spine01','neck01'],['c_neck','c_head','neck01','head']])segment(from,to,a,b);put('c_head',target('head'));
 for(const[side,suffix]of[['l','L'],['r','R']]){
  for(const[from,to,a,b]of[['upleg','lowleg','upperleg01','lowerleg01'],['lowleg','foot','lowerleg01','foot'],['foot','ball','foot','toe2-1'],['clavicle','uparm','clavicle','upperarm01'],['uparm','lowarm','upperarm01','lowerarm01'],['lowarm','wrist','lowerarm01','wrist']])segment(side+'_'+from,side+'_'+to,a+'.'+suffix,b+'.'+suffix);
  const oldPalm=M.palm(M.sub(origin(side+'_middle1'),origin(side+'_wrist')),M.sub(origin(side+'_index1'),origin(side+'_pinky1'))),newPalm=M.palm(M.sub(target('finger3-1.'+suffix),target('wrist.'+suffix)),M.sub(target('finger2-1.'+suffix),target('finger5-1.'+suffix))),palmRotation=M.mul(newPalm,M.uniformInverse(oldPalm)),palmScale=M.norm(M.sub(target('finger3-1.'+suffix),target('wrist.'+suffix)))/M.norm(M.sub(origin(side+'_middle1'),origin(side+'_wrist')));
  put(side+'_wrist',target('wrist.'+suffix),palmRotation,palmScale,'three-point palm frame');put(side+'_wrist_twist',target('wrist.'+suffix),rotations[lookup[side+'_lowarm']],scales[lookup[side+'_lowarm']],'forearm frame at wrist');
  for(const[digit,number]of[['index',2],['middle',3],['ring',4],['pinky',5],['thumb',1]]){
   for(let phalanx=1;phalanx<=3;phalanx++){const name=side+'_'+digit+phalanx,label='finger'+number+'-'+phalanx+'.'+suffix;if(phalanx<3)segment(name,side+'_'+digit+(phalanx+1),label,'finger'+number+'-'+(phalanx+1)+'.'+suffix);else{const before=M.sub(origin(name),origin(side+'_'+digit+2)),after=M.sub(target(label),target('finger'+number+'-2.'+suffix));put(name,target(label),M.align(before,after),M.norm(after)/M.norm(before),'terminal phalanx preceding segment');}}
   const end=side+'_'+digit+'_null',last=side+'_'+digit+3,j=lookup[last];put(end,M.add(locations[j],M.scale(M.vector(rotations[j],M.sub(origin(end),origin(last))),scales[j])),rotations[j],scales[j],'terminal extension');
  }
  put(side+'_pinky0',target('metacarpal4.'+suffix),palmRotation,palmScale,'pinky metacarpal');put(side+'_thumb0',M.add(target('wrist.'+suffix),M.scale(M.vector(palmRotation,M.sub(origin(side+'_thumb0'),origin(side+'_wrist'))),palmScale)),palmRotation,palmScale,'palm-frame proximal thumb estimate');
  for(const limb of['upleg','lowleg','uparm','lowarm']){const from=side+'_'+limb,to=side+'_'+{upleg:'lowleg',lowleg:'foot',uparm:'lowarm',lowarm:'wrist'}[limb],j=lookup[from];for(let k=0;k<=4;k++){const name=from+'_twist'+k+'_proc';if(lookup[name]===undefined)continue;const u=M.norm(M.sub(origin(name),origin(from)))/M.norm(M.sub(origin(to),origin(from)));put(name,M.add(locations[j],M.scale(M.sub(locations[lookup[to]],locations[j]),u)),rotations[j],scales[j],'source segment fraction '+u);}}
  for(const local of['talocrural','subtalar','transversetarsal','ball']){const name=side+'_'+local,j=lookup[side+'_foot'];put(name,M.add(locations[j],M.scale(M.vector(rotations[j],M.sub(origin(name),origin(side+'_foot'))),scales[j])),rotations[j],scales[j],'foot frame offset');}
 }
 for(const name of['c_neck_twist0_proc','c_neck_twist1_proc']){const j=lookup.c_neck,u=M.norm(M.sub(origin(name),origin('c_neck')))/M.norm(M.sub(origin('c_head'),origin('c_neck')));put(name,M.add(locations[j],M.scale(M.sub(locations[lookup.c_head],locations[j]),u)),rotations[j],scales[j],'neck fraction');}
 for(let j=0;j<jointNames.length;j++)if(!locations[j])put(jointNames[j],M.add(locations[lookup.c_head],M.sub(M.position(sourceBind[j]),origin('c_head'))),M.I(),1,'retained head-only provisional frame; head module owns geometry');
 const bind=sourceBind.map((m,j)=>{const b=M.mul(rotations[j],m);[b[3],b[7],b[11]]=locations[j];return b;}),local=bind.map((m,j)=>parents[j]<0?m:M.mul(M.uniformInverse(bind[parents[j]]),m));return{bind,local,scales,rotations,provenance};
}
globalThis.buildBodyTargetBindingR01=buildBodyTargetBindingR01;
})();
