/* Candidate sewing-workspace guides for the ORIGINAL nine-piece draft.
 * The guides classify material, not rendered triangles. They never bind to a
 * leg bone, alter paper coordinates/mass, or supply a target garment shell.
 * Each removable half-space belongs to authoring only; actual source stitch
 * equality, rather than elapsed time, releases it. Default runtime is opt-out
 * until a complete body/cloth/visual review has passed. */
function createShortsLegAssembly(simulation, options = {}) {
  const sim = simulation;
  if (!sim?.dofs || !sim.pattern?.pieces || !sim.ranges) throw Error('Leg assembly requires original paper and stitch DOFs');
  const compliance = options.compliance ?? 1e-5, clearance = options.clearance ?? sim.options.thickness;
  if (!(Number.isFinite(compliance) && compliance >= 0) || !(Number.isFinite(clearance) && clearance >= 0)) throw Error('Invalid leg assembly guide settings');
  const pieces = new Map(sim.pattern.pieces.map(p => [p.id, p]));
  for (const id of ['FL','BL','FR','BR','G']) if (!pieces.has(id)) throw Error('Missing identified source panel: ' + id);
  const origin = [...pieces.get('G').placement.origin];
  // Main-panel U is the actor's rigid transverse axis even after the separate
  // gusset's paper has been tilted. Do not infer body-right from the gusset U.
  const normal = [...pieces.get('FR').placement.basisU];
  if (origin.length !== 3 || normal.length !== 3 || !origin.every(Number.isFinite) || !normal.every(Number.isFinite) || Math.abs(Math.hypot(...normal)-1) > 1e-8) throw Error('Invalid rigid leg assembly frame');
  const groups = [];
  function addGroup(kind, side, sign, requiredSeams, clips) {
    const seams = requiredSeams.map(id => {const seam=sim.seams.find(s=>s.id===id);if(!seam || !seam.pairs.length)throw Error('Missing source leg seam: '+id);return seam;});
    groups.push({kind, side, sign, requiredSeams, pairs:seams.flatMap(s=>s.pairs), clips, active:true});
  }
  for (const [side, sign, ids] of [['left',-1,['FL','BL']], ['right',1,['FR','BR']]]) {
    for (const id of ids) if (pieces.get(id).side !== side) throw Error('Contradictory source leg ownership: '+id);
    const inner = sim.seams.find(s=>s.id==='inseam-'+side), outer = sim.seams.find(s=>s.id==='outseam-'+side);
    for(const seam of [inner,outer]) {
      if(!seam)throw Error('Missing source leg seam');
      for(const pair of seam.pairs)for(const index of [pair.a,pair.b])if(!ids.includes(sim.particles[index]?.pieceId))throw Error('Cross-leg source seam is not a sewing workspace problem');
    }
    const g=pieces.get('G'), index=sim.ranges.get('G').offset+g.landmarks[side];
    if (!Number.isInteger(index) || !sim.particles[index]) throw Error('Missing original gusset notch');
    addGroup('gusset-side-notch',side,sign,['gusset-'+ids[0],'gusset-'+ids[1],'inseam-'+side,'outseam-'+side],
      [{index, planeOrigin:[...sim.particles[index].pos], lambda:0}]);
    const clips=[], planeOrigin=origin.map((v,k)=>v+sign*clearance*normal[k]);
    for(const id of ids){
      const p=pieces.get(id),range=sim.ranges.get(id),first=sim.pattern.options.crotchRow+1;
      if(!range || !p.grid || !Number.isInteger(first) || first<1 || first>p.grid.rows)throw Error('Invalid original lower-leg grid');
      for(let row=first;row<=p.grid.rows;row++)for(let column=0;column<=p.grid.columns;column++)
        clips.push({index:range.offset+row*(p.grid.columns+1)+column,planeOrigin,lambda:0});
    }
    addGroup('lower-leg-workspace',side,sign,['inseam-'+side,'outseam-'+side],clips);
  }
  let epoch = -1;
  const report = () => ({enabled:true,version:'original-leg-sewing-workspaces-candidate-1',
    stage:'authoring-only',origin:[...origin],normal:[...normal],clearanceM:clearance,compliance,
    activeConstraintCount:groups.filter(g=>g.active).reduce((n,g)=>n+g.clips.length,0),
    groups:groups.map(g=>({kind:g.kind,side:g.side,sourceSeams:[...g.requiredSeams],active:g.active,indices:g.clips.map(c=>c.index),
      maximumForbiddenSideResidualM:Math.max(0,...g.clips.map(c=>-g.sign*normal.reduce((s,v,k)=>s+v*(sim.particles[c.index].pos[k]-c.planeOrigin[k]),0)))})),
    permanentLegAnchors:false,formedShapeTargets:false,restMaterialModified:false,
    guaranteesSeparateCuffs:false,visualAcceptance:false});
  return {
    hasActive:()=>groups.some(g=>g.active), report,
    solve(h) {
      if (!(Number.isFinite(h) && h>0)) throw Error('Invalid leg assembly fixed substep');
      if(epoch!==sim.contactEpoch){for(const g of groups)for(const c of g.clips)c.lambda=0;epoch=sim.contactEpoch;}
      for(const g of groups){
        if(!g.active)continue;
        if(g.pairs.every(p=>sim.dofs.same(p.a,p.b))){
          g.active=false;sim.events.push({type:'release_original_leg_workspace',kind:g.kind,side:g.side,stepIndex:sim.stepIndex,sourceSeams:[...g.requiredSeams]});continue;
        }
        const gradient=normal.map(v=>-g.sign*v);
        for(const c of g.clips){
          const value=gradient.reduce((s,v,k)=>s+v*(sim.particles[c.index].pos[k]-c.planeOrigin[k]),0);
          if(value<=0 && c.lambda===0)continue;
          c.lambda=sim.dofs.project([c.index],[gradient],value,{alpha:compliance/(h*h),lambda:c.lambda,tensionOnly:true}).lambda;
        }
      }
    }
  };
}
