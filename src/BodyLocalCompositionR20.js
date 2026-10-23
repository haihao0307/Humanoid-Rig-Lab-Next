/* Prevent a local hand/foot replacement from carving a different body part
 * when the regions overlap during motion. Ownership refers to existing body
 * sample contributions; no face connectivity or polygon model is constructed. */
(()=>{'use strict';
function prepare(region,program,group){const hand=group<2,suffix=group%2===0?'L':'R',w=program.annyWeights,names=program.anny.boneLabels,flags=new Uint8Array(program.bodyCount),pattern=hand?/^(wrist|finger|metacarpal|lowerarm)/:/^(foot|toe|lowerleg)/;let ownedSamples=0;
 for(let i=0;i<program.bodyCount;i++){let total=0;for(let k=w.ptr[i];k<w.ptr[i+1];k++){const name=names[w.joints[k]];if(name.endsWith('.'+suffix)&&pattern.test(name))total+=w.values[k];}if(total>.30){flags[i]=1;ownedSamples++;}}
 region.ownerFlags=flags;region.composition={ownership:'complete source-derived anatomical influence totals',ownedSamples,protectedForeignVoxels:0,policy:'replace own region; union with nearby foreign surface'};return region;
}
function combine(region,index,original,proposed){const sample=region.nearestSamples?.[index];if(sample===undefined||sample===65535||region.ownerFlags?.[sample])return proposed;if(proposed>original){region.composition.protectedForeignVoxels++;return original;}return proposed;}
function finish(region){delete region.nearestSamples;delete region.ownerFlags;return region;}
globalThis.BodyLocalCompositionR20={prepare,combine,finish};
})();
