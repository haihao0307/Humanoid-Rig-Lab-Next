"""Explicit R08 -> R09 production adapters; frozen R01-R08 bytes are never written."""
def once(s,a,b):
    if s.count(a)!=1:raise ValueError('Source contract drift: '+a[:110])
    return s.replace(a,b,1)
def adapt(name,s):
    if name=='runtime.js':
        s=s.replace("'R08.0'","'R09.1'")
        s=once(s,"craft:'plain',loft:3.4","craft:'diamond',loft:3.4")
        s=once(s,"initThumbs();selectProduct('wallet');","initThumbs();selectProduct('swatch');")
        s=once(s,"renderer.shadowMap.needsUpdate=true;dirty=true;};if(gripCollider)","refreshLiveMeasurements();renderer.shadowMap.needsUpdate=true;dirty=true;};if(gripCollider)")
        s=s.replace('自接触为粒子级，不保证极端甩动不穿透。','已接入面级接触；细分显示网格与极端工况尚未全面认证。')
        s=s.replace('抓手是 R08 壳体求解','抓手是 R09 非线性壳体求解')
        s=s.replace('独立 R08 壳体受力','R09 非线性壳体受力')
        s=s.replace('R05 SEWING / R08 SHELL / MILLIMETRES','R09.1 / CRAFT · LIVE THICKNESS · SURFACE CONTACT')
        s=s.replace('Particle self-contact is not triangle CCD; fast folds can still intersect','Finite-thickness simulation triangle contact; fine display geometry and extreme cases not certified')
        s=s.replace('R08 uses actual nodal shell dynamics while grabbing; no real-material calibration','R09 full R04 nonlinear law in fixed material charts; uncalibrated real leather')
        s=s.replace('R080.json','R091.json')
        s=once(s,"window.LEATHER_ATELIER={inspectCut", "window.LEATHER_ATELIER={auditContact:()=>productSolver.ask('audit'),stepProduct:async(n=1)=>{await productSolver.ready;await productSolver.ask('active',{value:true});for(let i=0;i<n;i++)await productSolver.ask('step',{count:1});await productSolver.ask('active',{value:false});return productSolver.report();},inspectCut")
    elif name=='grip-worker.js':
        s=once(s,'set active(value){this._active=!!value;','set active(value){if(this._active===!!value)return;this._active=!!value;')
    elif name=='products.js':
        s=once(s,'return{map:fn,paths,holes};','fn.craftProfile=quilt?{type,pitchMM:q,loftMM:config.loft??3.4}:null;return{map:fn,paths,holes};')
        s=once(s,'baseT=s.t*cfg.thicknessScale,ps=[]','baseT=s.t*cfg.thicknessScale,layerStep=baseT+.08,ps=[]')
        s=once(s,'k*baseT);const craft=k===2','k*layerStep);const craft=k===2')
        s=once(s,'totalThickness:baseT*3,center:k===2?-baseT:0','totalThickness:baseT*3+.16,center:k===2?-layerStep:0')
        s=once(s,'return p.addScaledVector(n,.65);','return p.addScaledVector(n,1.4*cfg.thicknessScale+.5);')
        s=once(s,'return p.addScaledVector(n,2);','return p.addScaledVector(n,Math.max(2,1.5*cfg.thicknessScale+.15));')
        s=once(s,'body.normal(uc+u,-125+v),2.1','body.normal(uc+u,-125+v),Math.max(2.1,1.2*cfg.thicknessScale+.15)')
        # The flap centreline is offset from BOTH finished skins, not a thinner
        # zero-thickness proxy. Retains the original curve and sewn endpoints.
        s=once(s,'p.x=u*(1-.04*Math.max(0,v/curve.length*2));return p;',
            "p.x=u*(1-.04*Math.max(0,v/curve.length*2));const tangent=curve.curve.getTangentAt(Math.max(0,Math.min(1,(v+curve.length/2)/curve.length)));return p.addScaledVector(V(0,tangent.z,-tangent.y).normalize(),3*cfg.thicknessScale);")
        s=once(s,'rectangle(7.4,39,2)', 'rectangle(Math.max(8.2,3.2*cfg.thicknessScale+4.5),Math.max(40.6,35+4.3*cfg.thicknessScale+1.3),2)')
        s=once(s,'return centre.clone().add(rad).add(d);','return centre.clone().add(rad).add(d).add(V(sign*14*(1-Math.exp(-16*Math.max(0,f)))*Math.exp(-3*Math.max(0,f))*(1-Math.max(0,Math.min(1,f))),0,0));')
        s=once(s,'loft=builder.config.weaveLoft||.85','loft=(builder.config.weaveLoft||1.7)*builder.config.thicknessScale')
        s=once(s,'(t+1.1+loft*wave)','(basePart.t/2+.35*builder.config.thicknessScale+loft+.25+loft*wave)')
        s=once(s,'(dir?-1:1)*Math.cos(Math.PI*(along+i))','(dir?-1:1)*Math.tanh(3*Math.cos(Math.PI*(along+i)))/Math.tanh(3)')
    elif name=='sewing.js':
        s=once(s,'bind.push(builder.binding(panel,q.uv.x,q.uv.y,p,n));','bind.push(builder.yarnBinding(path,panel,q.uv.x,q.uv.y,p,n));')
    elif name=='panels.js':
        s=once(s,"['ageMask','age',3]", "['ageMask','age',3],['simIDsB','idsB',4],['simWeightsB','weightsB',4],['simDeltaB','deltaB',3],['simNormalB','normalB',3],['simBlend','blend',1]")
        s=once(s,'g.setAttribute(name,new T.Float32BufferAttribute(bindings.flatMap(v=>v[key]),size));',"{const dual=bindings.some(v=>v.blend!==undefined);if(key.endsWith('B')||key==='blend'){if(!dual)continue;}const packed=new Float32Array(bindings.length*size);for(let i=0;i<bindings.length;i++){const v=bindings[i],q=v[key]??(key==='blend'?[0]:v[key.slice(0,-1)]);for(let k=0;k<size;k++)packed[i*size+k]=q[k];}g.setAttribute(name,new T.BufferAttribute(packed,size));}")
        s=once(s,'const m=source.clone(),prior=source.onBeforeCompile;',"const m=source.clone(),prior=source.onBeforeCompile;m.defaultAttributeValues={...(source.defaultAttributeValues||{}),simIDsB:[0,0,0,0],simWeightsB:[0,0,0,0],simDeltaB:[0,0,0],simNormalB:[0,0,1],simBlend:[0]};")
        s=once(s,'attribute vec4 simIDs;attribute vec4 simWeights;attribute vec3 simDelta;attribute vec3 simNormal;attribute vec3 ageMask;', 'attribute vec4 simIDs;attribute vec4 simWeights;attribute vec3 simDelta;attribute vec3 simNormal;attribute vec3 ageMask;\nattribute vec4 simIDsB;attribute vec4 simWeightsB;attribute vec3 simDeltaB;attribute vec3 simNormalB;attribute float simBlend;')
        start=s.index('mat3 productBasis(){');end=s.index('}`;',start)+1
        s=s[:start]+'''mat3 basisFor(vec4 ids,vec4 weights){vec3 x=nodeFrame(ids.x,.5)*weights.x+nodeFrame(ids.y,.5)*weights.y+nodeFrame(ids.z,.5)*weights.z+nodeFrame(ids.w,.5)*weights.w;vec3 n=nodeFrame(ids.x,5./6.)*weights.x+nodeFrame(ids.y,5./6.)*weights.y+nodeFrame(ids.z,5./6.)*weights.z+nodeFrame(ids.w,5./6.)*weights.w;vec3 z=normalize(n+vec3(0.,1e-15,0.));x=normalize(x-z*dot(x,z)+vec3(1e-15,0.,0.));return mat3(x,cross(z,x),z);}
mat3 productBasis(){return basisFor(simIDs,simWeights);}
vec3 pointFor(vec4 ids,vec4 w,vec3 delta,mat3 basis){return nodePos(ids.x)*w.x+nodePos(ids.y)*w.y+nodePos(ids.z)*w.z+nodePos(ids.w)*w.w+basis*delta;}
vec3 productPoint(mat3 basis){vec3 p=pointFor(simIDs,simWeights,simDelta,basis);if(simBlend<=0.)return p;return mix(p,pointFor(simIDsB,simWeightsB,simDeltaB,basisFor(simIDsB,simWeightsB)),simBlend);}'''+s[end:]
        s=once(s,'objectNormal=normalize(skinBasis*simNormal);','objectNormal=normalize(skinBasis*simNormal);if(simBlend>0.)objectNormal=normalize(mix(objectNormal,basisFor(simIDsB,simWeightsB)*simNormalB,simBlend));')
    elif name=='atelier-controls.js':
        s=once(s,'u=p.w*.1;v=-p.h/2+.7;',"u=p.w*.1;v=(product==='wallet'?1:-1)*(p.h/2-.7);")
        s=once(s,'thicknessMM:pos.getZ(pick)','thicknessMM:evaluateBoundVertex(part.mesh,rig,pick).distanceTo(evaluateBoundVertex(part.mesh,rig,pick+n))')
        a=s.index('function measureShell(){');b=s.index('\nconst oldUpdateDetails',a)
        s=s[:a]+'function measureShell(){return worldShellMeasurements(hero);}\n'+s[b:]
    elif name=='template.html':
        s=s.replace('R08.0','R09.1').replace('R08','R09.1')
        s=once(s,'<div class="tools">','''<div id="craftRibbon" class="craft-ribbon" aria-label="成品工艺快捷切换"></div><div class="tools">''')
        s=once(s,'</style>','''.craft-ribbon{pointer-events:auto;display:flex;gap:5px;flex-wrap:wrap;padding:0 28px 12px}.craft-ribbon button{font-size:11px;padding:6px 10px}.craft-ribbon button:disabled{opacity:.4;cursor:not-allowed}.craft-ribbon .craft-note{font-size:9px;color:var(--muted);flex-basis:100%;margin-top:2px}#liveThicknessNote{white-space:pre-line;font-size:10px;line-height:1.7;padding:8px 0;color:#526456}@media(max-width:760px){.craft-ribbon{padding:0 12px 6px;gap:3px}.craft-ribbon button{font-size:9px;padding:4px 6px}}</style>''')
        s=s.replace('皮革工艺（卡包 / 肩包 / 皮样）','成品工艺（卡包 / 肩包 / 夹克 / 皮样）')
        s=once(s,'<div id="grabStats"></div>','<div id="grabStats"></div><div id="liveThicknessNote"></div>')
    elif name=='closed-shell.js':
        # surfacePoint retains this function's lexical environment. Release
        # construction-only arrays after GPU buffers and edge binding are built.
        s=once(s,'P,physicalKey);', 'P,physicalKey);P.length=N.length=UV.length=I.length=bindings.length=0;points.length=tris.length=boundary.length=0;edges.clear();edgeVertices.clear();alongMap.clear();outgoing.clear();incoming.clear();')
    elif name=='assembly-contract.js':
        s=once(s,"if(['diamond','grid','channels'].includes(this.config.craft))d.formed=true;","if(d.map.craftProfile){d.formed=true;d.simStep=Math.min(d.simStep||18,Math.max(4,d.map.craftProfile.pitchMM/3));d.restCurvatureProvenance='quilted shape rest-curvature approximation; filler is not independently solved';}")
        s=once(s,'Math.max(2,(this.config.weaveMM||8)/3)','Math.max(3,(this.config.weaveMM||8)/2)')
    elif name=='contact.mjs':
        s=once(s,'bounds(x0,x1,f.ids,f.h+this.maxHalf+pad)','bounds(x0,x1,f.ids,f.h+pad)')
        s=once(s,'bounds(x0,x1,[v],pad)','bounds(x0,x1,[v],this.shell.contactThickness[v]+pad)')
        s=once(s,'bounds(x0,x1,e.ids,e.h+this.maxHalf+pad)','bounds(x0,x1,e.ids,e.h+pad)')
    elif name=='native-energy.mjs':
        s=once(s,'constructor(shell){','constructor(shell,capacityHint=0){')
        s=once(s,'Math.max(100000,20*s.tri.length+10*N)','Math.max(100000,Math.ceil(capacityHint*1.2),20*s.tri.length+10*N)')
        s=once(s,"if(pairs.length>this.capacity)throw Error('Contact candidate budget exceeded; no contact is dropped');","if(pairs.length>this.capacity){if(pairs.length>450000)throw Error('Surface contact exceeds the bounded browser memory budget; no contact is dropped');Object.assign(this,new NativeEnergy(this.shell,pairs.length));}")
        s=once(s,'energy:r[0],residual:r[1]','energy:r[0],minimumClearanceMM:Number.isFinite(r[11])?r[11]*1000:null,residual:r[1]')
        s=once(s,' clip(a,b,pairs){const n=pairs.length;if(n>this.capacity)return null;const w=this.sections;w[0].set(a);w[14].set(b);if(pairs!==this.lastClipRef){for(let i=0;i<n;i++){const p=pairs[i];w[16].set([...p.ids,p.gap,p.pt?1:0],6*i);}this.lastClipRef=pairs;}const fraction=this.native.clip_many(n),r=w[15],stats=this.shell.contact.stats;stats.ccdEvents+=r[8];stats.ptEvents+=r[9];stats.eeEvents+=r[10];return fraction;}',' clip(a,b,pairs){const w=this.sections;w[0].set(a);w[14].set(b);let fraction=1;const stats=this.shell.contact.stats;for(let offset=0;offset<pairs.length;offset+=this.capacity){const n=Math.min(this.capacity,pairs.length-offset);if(offset||pairs!==this.lastClipRef||pairs.length>this.capacity){for(let i=0;i<n;i++){const p=pairs[offset+i];w[16].set([...p.ids,p.gap,p.pt?1:0],6*i);}}fraction=Math.min(fraction,this.native.clip_many(n));const r=w[15];stats.ccdEvents+=r[8];stats.ptEvents+=r[9];stats.eeEvents+=r[10];}this.lastClipRef=pairs.length<=this.capacity?pairs:null;return fraction;}')
    elif name=='implicit.mjs':
        s=once(s,'convergedToR04Residual:this.lastResidual<.0002','convergedToR04Residual:!this.failed&&this.steps>0&&this.lastResidual<.0002')
    elif name=='energy.c':
        s=once(s,'p-arena>6000000','p-arena>12000000')
        s=once(s,'int active=0,friction=0;','double minGap=__builtin_inf();RESULT[11]=__builtin_inf();int active=0,friction=0;')
        s=once(s,'barrier(q.d-p[4],B);','minGap=min(minGap,q.d-p[4]);RESULT[11]=minGap;barrier(q.d-p[4],B);')
        s=once(s,'RESULT[7]=__builtin_sqrt(grabforce);','RESULT[7]=__builtin_sqrt(grabforce);RESULT[11]=minGap;')
    return s
