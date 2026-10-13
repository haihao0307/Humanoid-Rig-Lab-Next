/** Source identity, not visual similarity, is the acceptance condition. */
export const canonical=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(canonical):Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const stable=x=>JSON.stringify(canonical(x));
export async function sha(bytes){const b=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export const identityKeys=['geometrySHA256','topologySHA256','stateSHA256','adapterFingerprint'];
export function samePerson(a,b){return !!a&&!!b&&identityKeys.every(k=>/^[0-9a-f]{64}$/.test(a[k]||'')&&a[k]===b[k]);}
export function requirePerson(a,b){if(!samePerson(a,b))throw Error('人物身份已变化：原结果、原碰撞场及原尺码不得冒用于当前人物。');}
export async function modelIdentity(model){const archive=model.archive();return {geometrySHA256:await sha(model.positions.buffer),topologySHA256:await sha(model.faces.buffer),stateSHA256:await sha(stable(model.state)),adapterFingerprint:archive.adapterFingerprint};}
export async function materialHash(spec){return sha(stable({panels:spec.panels.map(p=>({id:p.id,uvMm:p.uvMm,triangles:p.triangles})),seams:spec.seams.map(s=>({id:s.id,a:s.a,b:s.b,stitchVertexPairs:s.stitchVertexPairs}))}));}
export function facesOf(spec){let offset=0;return spec.panels.flatMap(p=>{const f=p.triangles.flatMap(t=>t.map(i=>i+offset));offset+=p.uvMm.length;return f});}
export function assertFiniteCoordinates(spec,p){const count=spec.panels.reduce((s,p)=>s+p.uvMm.length,0)*3;if(p.length!==count||Array.from(p).some(x=>!Number.isFinite(x)))throw Error('求解坐标与原裁片顶点顺序/数量不一致。');return count/3;}
export function checkPacket(packet,expected){if(!packet?.binding||!expected)throw Error('缺少原系统来源绑定，拒绝显示替代服装。');requirePerson(packet.binding.person,expected.person);for(const k of ['presetId','recipeHash','paperSHA256','materialSHA256'])if(packet.binding[k]!==expected[k])throw Error('原纸样或材料网格身份不符：'+k);}
