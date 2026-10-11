import {ShoeMaterials as R05,CATALOGUE} from '../../r05/src/materials.mjs';
export {CATALOGUE};
/** Preserve the user's R10 skin kernel. Only the hidden bottom-sheet cut edge is edge-finished. */
export class ShoeMaterials extends R05{
 shell(p,s,plane){const m=super.shell(p,s,plane);if(p.id===19&&s.material!=='clay'){m[2].color.set('#493127');m[2].roughness=.82;m[2].userData={...m[2].userData,surfaceRole:'burnished-bottom-sheet-edge'};}return m;}
}
