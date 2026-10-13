/** Inherited run labels describe formerly rejected samples, not separate physical
 * seams. Recover each ordered native rear-strip rail, then let compileJoins
 * revalidate every dense sample and receiving ply before it punches any hole.
 * This never directly bridges an unsupported region in the output needle path.
 */
export function sourceRearRails(seams){
 const rear=new Map(),other=[];
 for(const s of seams){
  if(!s.id.startsWith('back-binding')){other.push(s);continue;}
  const id=s.id.replace(/-run-\d+$/,'');
  if(!rear.has(id))rear.set(id,{...s,id,pairs:[]});
  rear.get(id).pairs.push(...s.pairs);
 }
 for(const s of rear.values())s.pairs.sort((a,b)=>a.a[0]-b.a[0]);
 return [...other,...rear.values()];
}
