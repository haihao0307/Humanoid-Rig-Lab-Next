function releaseProductMaterials(root){if(!root)return;const seen=new Set();root.traverse(o=>{const m=o.customDepthMaterial;if(m&&!seen.has(m)){seen.add(m);m.dispose();}if(o.userData.beautyMaterials){for(const q of(Array.isArray(o.material)?o.material:[o.material]))q.dispose();}});if(root===hero&&heroMats){heroMats.thread.map?.dispose();heroMats.thread.normalMap?.dispose();for(const k of['back','edge','thread','brass'])heroMats[k]?.dispose();}};

// Explicitly owned specimen assets: never dispose the shared appearance catalogue.
function releaseSpecimenMaterials(root){if(!root)return;for(const m of new Set(root.userData.ownedMaterials||[])){if(!m)continue;m.map?.dispose();m.normalMap?.dispose();m.dispose();}root.userData.ownedMaterials=[];}
