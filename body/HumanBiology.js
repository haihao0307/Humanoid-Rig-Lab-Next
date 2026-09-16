/* Source-backed anatomy relationships plus explicit, authored ecology.
 * This catalog is embedded in the delivered file; it performs no web requests. */
const HUMAN_BIOLOGY=/*__HUMAN_BIOLOGY_JSON__*/;
function validateBiologySnapshot(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['schema','environment','state'].includes(k)))throw Error('人体环境数据格式无效');
 if(input.schema!=null&&input.schema!=='jarvis/biology_state@1')throw Error('人体环境数据版本无效');
 const spec=HUMAN_BIOLOGY.ecology;
 const validate=(raw,defaults,limits)=>{raw=raw??{};if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!Object.hasOwn(limits,k)))throw Error('人体环境参数无效');return Object.fromEntries(Object.entries(limits).map(([key,[lo,hi]])=>{const v=raw[key]??defaults[key];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw Error('人体环境参数超出范围：'+key);return [key,v];}));};
 return {schema:'jarvis/biology_state@1',environment:validate(input.environment,spec.defaults,spec.limits),state:validate(input.state,spec.initialState,spec.stateLimits)};
}
class HumanEcology {
 constructor(tissue,snapshot){this.tissue=tissue;const data=validateBiologySnapshot(snapshot);this.environment=data.environment;this.state=data.state;this.condition=1;this.flux=null;this.limited=false;this.step(0);}
 export(){return validateBiologySnapshot({schema:'jarvis/biology_state@1',environment:{...this.environment},state:{...this.state}});}
 configure(environment){const next=validateBiologySnapshot({...this.export(),environment:{...this.environment,...environment}});this.environment=next.environment;this.step(0);}
 reset(){this.state={...HUMAN_BIOLOGY.ecology.initialState};this.limited=false;this.step(0);}
 step(dt){
  // Use simulation time only; paused rendering and geometry rebuilds do not age.
  dt=Number.isFinite(dt)?clamp(dt,0,.1):0;
  const h=this.tissue.human,e=this.environment,s=this.state,c=HUMAN_BIOLOGY.ecology.coefficients;
  const mass=Math.max(35,h.strength?.bodyMassKg||70),area=c.areaAt70KgM2*Math.pow(mass/70,2/3);
  const groups=Object.values(h.strength?.state.groups||{}),activity=groups.reduce((a,g)=>a+g.activation,0)/Math.max(1,groups.length);
  const warm=clamp((s.coreC-37)*1.2+(s.skinC-34)*.12,0,1),cold=clamp((33-s.skinC)/10,0,1);
  const perfusion=clamp(.5+warm*.5-cold*.45,.05,1),fat=this.tissue.human.characterPreset.appearance.skinLayers.subcutaneousScale;
  const internal=(c.coreSkinBaseWPerK+c.perfusionWPerK*perfusion)/fat*(s.coreC-s.skinC);
  const hc=c.convectiveBaseWPerM2K+c.convectiveWindWPerM2K*Math.sqrt(e.windMps),r=e.insulationClo*c.cloM2KPerW;
  const convection=area*hc*(s.skinC-e.airC)/(1+hc*r),radiation=area*c.radiativeWPerM2K*(s.skinC-e.radiantC)/(1+c.radiativeWPerM2K*r);
  const sweatKgPerS=warm*c.maxSweatKgPerHour/3600,evaporatedKgPerS=sweatKgPerS*clamp((1-e.humidity)*(.65+.2*e.windMps)/(1+e.insulationClo*.4),0,1);
  const evaporation=evaporatedKgPerS*c.latentHeatJPerKg,metabolism=c.restHeatW+c.activityHeatW*activity;
  if(dt>0){
   const core=s.coreC+(metabolism-internal)*dt/(mass*(1-c.skinMassFraction)*c.specificHeatJPerKgK),skin=s.skinC+(internal-convection-radiation-evaporation)*dt/(mass*c.skinMassFraction*c.specificHeatJPerKgK);
   s.coreC=clamp(core,...HUMAN_BIOLOGY.ecology.stateLimits.coreC);s.skinC=clamp(skin,...HUMAN_BIOLOGY.ecology.stateLimits.skinC);this.limited ||=core!==s.coreC||skin!==s.skinC;
   s.waterLossKg=clamp(s.waterLossKg+sweatKgPerS*dt,0,10);s.elapsedS=Math.min(1e9,s.elapsedS+dt);
  }
  const waterDeficit=s.waterLossKg/(mass*c.waterMassFraction),thermalStress=Math.max(0,Math.abs(s.coreC-37)-.6);
  this.condition=clamp(1-thermalStress*.12-waterDeficit*2,.4,1);
  this.flux={metabolicW:metabolism,coreToSkinW:internal,convectionW:convection,radiationW:radiation,evaporationW:evaporation,netStoredW:metabolism-convection-radiation-evaporation,sweatKgPerHour:sweatKgPerS*3600,evaporatedKgPerHour:evaporatedKgPerS*3600,perfusionIndex:perfusion,activityIndex:activity};
  if(h.strength)h.strength.environmentFactor=this.condition;
 }
 report(){return {...this.export(),conditionFactor:this.condition,heatFlux:{...this.flux},numericalBoundReached:this.limited,coefficientBasis:HUMAN_BIOLOGY.ecology.basis,calibrated:false};}
}
function buildHumanBindingKnowledge(tissue){return {schema:'r2/binding_knowledge@1',source:R2_RIG.source,
 jointCentres:tissue.human.resolvedRig.nodes,referenceJointCentres:R2_RIG.nodes,shape:validateCharacterShape(tissue.human.characterPreset.shape),shapeDerived:true,regions:R2_REGIONS,sourceSurface:tissue.surface?.report||null,
 rigControllers:tissue.human.joints.map(j=>({id:j.id,parent:j.parent?.id||null})),
 calibrated:false,measuredSoftTissueDeformation:false,limitations:R2_RIG.limitations};}
function installHumanBiology(lab){
 const current=()=>lab.human.tissue.ecology;
 const api={catalog:()=>JSON.parse(JSON.stringify(HUMAN_BIOLOGY)),bindings:()=>buildHumanBindingKnowledge(lab.human.tissue),report:()=>current().report(),
  export:()=>({schema:'jarvis/human_knowledge_document@1',catalog:api.catalog(),bindings:api.bindings(),hair:lab.compact?.hair?.report||null,ecology:api.report()}),
  configure(environment){current().configure(environment);syncWind();refresh();return api.report();},reset(){requireCharacterIdle(lab.agent,'重置身体状态');current().reset();refresh();return api.report();}};
 const syncWind=()=>{if(!lab.hair)return;lab.hair.windSpeed=current().environment.windMps;lab.hair.windEnabled=lab.hair.windSpeed>0;const speed=document.getElementById('hair-speed'),on=document.getElementById('hair-wind'),value=document.getElementById('hair-speed-value');if(speed)speed.value=lab.hair.windSpeed;if(on)on.checked=lab.hair.windEnabled;if(value)value.textContent=lab.hair.windSpeed.toFixed(1)+' m/s';};
 for(const [id,event]of [['hair-speed','input'],['hair-wind','change']])document.getElementById(id)?.addEventListener(event,()=>{current().configure({windMps:lab.hair.windEnabled?lab.hair.windSpeed:0});refresh();});
 const panel=document.createElement('section');panel.id='human-biology-panel';panel.hidden=true;
 panel.innerHTML='<p>保存 R2 同源关节位置、表皮分区及公开动作来源。关节中心仍待功能标定。</p><div data-biology-systems></div><details><summary>环境与身体状态（简化模型）</summary><p>环境输入会影响散热、水分损失和出力系数；风速与头发共用。数值是模型估计。</p><div data-biology-inputs></div><button data-biology-apply>应用环境</button><button data-biology-reset>恢复身体状态</button><button data-biology-refresh>刷新状态</button><output data-biology-state style="display:block;white-space:pre-wrap"></output></details><button data-biology-export>导出人体知识与绑定</button><p data-biology-status role="status"></p>';
 const controls=[];for(const [key,label,unit]of [['airC','空气温度','°C'],['radiantC','周围辐射温度','°C'],['humidity','相对湿度','0—1'],['windMps','风速','m/s'],['insulationClo','衣物隔热参数','clo']]){const row=document.createElement('label');row.style.cssText='display:block;margin:8px 0';row.textContent=label+'（'+unit+'） ';const input=document.createElement('input');input.type='number';input.style.width='80px';input.min=HUMAN_BIOLOGY.ecology.limits[key][0];input.max=HUMAN_BIOLOGY.ecology.limits[key][1];input.step=key==='humidity'?.05:.1;input.dataset.ecology=key;row.append(input);panel.querySelector('[data-biology-inputs]').append(row);controls.push(input);}
 for(const system of HUMAN_BIOLOGY.systems){const detail=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent=system.label;p.textContent=system.facts+' '+system.implementation;detail.append(summary,p);for(const key of system.sources){const a=document.createElement('a');a.href=HUMAN_BIOLOGY.sources[key];a.target='_blank';a.rel='noopener noreferrer';a.textContent='来源 · '+key;a.style.marginRight='10px';detail.append(a);}panel.querySelector('[data-biology-systems]').append(detail);}
 document.body.append(panel);
 const refresh=()=>{const r=api.report();for(const input of controls)input.value=r.environment[input.dataset.ecology];panel.querySelector('[data-biology-state]').textContent='模型时间 '+r.state.elapsedS.toFixed(1)+' s\n核心温度 '+r.state.coreC.toFixed(2)+' °C · 皮肤温度 '+r.state.skinC.toFixed(2)+' °C\n累计汗液损失 '+(r.state.waterLossKg*1000).toFixed(1)+' g\n环境出力系数 '+r.conditionFactor.toFixed(3)+'\n净储热 '+r.heatFlux.netStoredW.toFixed(1)+' W'+(r.numericalBoundReached?'\n已触及模型数值边界；不能继续作生理解释。':'');};
 const act=fn=>{try{fn();panel.querySelector('[data-biology-status]').textContent='已更新。';}catch(e){panel.querySelector('[data-biology-status]').textContent=e.message;}};
 panel.querySelector('[data-biology-apply]').onclick=()=>act(()=>api.configure(Object.fromEntries(controls.map(i=>[i.dataset.ecology,Number(i.value)]))));
 panel.querySelector('[data-biology-reset]').onclick=()=>act(()=>api.reset());panel.querySelector('[data-biology-refresh]').onclick=refresh;
 panel.querySelector('[data-biology-export]').onclick=()=>act(()=>hfDownload('human-biology-and-bindings.json',JSON.stringify(api.export(),null,2),'application/json'));
 api.refresh=()=>{syncWind();refresh();};api.refresh();return api;
}
