/* Strictly scoped source-template matching. Only independently driven limb
 * rotations/translations are removed from the comparison. Head, shape, owner,
 * unknown fields and negative-zero spelling remain significant. */
(()=>{'use strict';
function create(contract){const identity=BodyStateIdentityR26.create(contract);function match(profiles,state){
 const s=identity.canonical(state),a=s?.anny;if(!a)return null;
 if(s.owners?.rig==='mhr'){
  const pose=s.mhr?.pose;if(s.mhr?.correctives!==false||!Array.isArray(pose)||pose.length!==204||pose.some(v=>!Number.isFinite(v)||Object.is(v,-0)))return null;s.mhr.pose=Array(204).fill(0);const profile=profiles.find(p=>p.rigKind==='mhr-no-correctives'&&identity.equal(p.state,s)&&pose.every((v,i)=>v===0||p.allowedPoseIndices.includes(i)));return profile?{profile,pose:pose.slice()}:null;
 }
 if(s.owners?.rig!=='anny')return null;
 const rotations=a.pose||{},translations=a.translations||{};if(!rotations||!translations||Array.isArray(rotations)||Array.isArray(translations)||typeof rotations!=='object'||typeof translations!=='object')return null;
 const pose={};for(const name of new Set([...Object.keys(rotations),...Object.keys(translations)])){const raw=rotations[name];if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).some(k=>!['rotation','translation'].includes(k)))return null;const r=raw?.rotation||raw||[0,0,0],t=translations[name]||raw?.translation||[0,0,0];if(!Array.isArray(r)||!Array.isArray(t)||r.length!==3||t.length!==3||![...r,...t].every(v=>typeof v==='number'&&Number.isFinite(v)&&!Object.is(v,-0)))return null;pose[name]={rotation:r.slice(),translation:t.slice()};}
 a.pose={};a.translations={};const profile=profiles.find(p=>identity.equal(p.state,s)&&Object.keys(pose).every(name=>p.allowedJoints.includes(name)));return profile?{profile,pose}:null;
}return{match};}
globalThis.BodyPoseIdentityR28={create};
})();
