// Furnishings are generated from metric dimensions. Their collision envelope
// uses the same footprint the world planner sees; no decorative hidden obstacle.
function activityFurniture(def) {
  // The editor can turn a furniture entity into another primitive. Its visual
  // shape must follow that edit so collision and rendering keep agreeing.
  if(def.shape!=='box')return null;
  const {w,h,d}=def;
  const part=(x,y,z,W,H,D)=>transform(box(W,H,D),[x,y,z]);
  if(def.templateId==='worktable') {
    const pieces=[part(0,h/2-.025,0,w,.05,d)];
    for(const x of [-1,1])for(const z of [-1,1])pieces.push(part(x*(w/2-.055),-.025,z*(d/2-.055),.045,h-.05,.045));
    return combine(pieces);
  }
  if(def.templateId==='shelf') {
    const pieces=[part(-w/2+.025,0,0,.05,h,d),part(w/2-.025,0,0,.05,h,d),part(0,0,-d/2+.018,w,h,.036)];
    for(let i=0;i<4;i++)pieces.push(part(0,-h/2+.025+i*(h-.05)/3,0,w,.05,d));
    return combine(pieces);
  }
  if(def.templateId==='bench') {
    return combine([part(0,h/2-.028,0,w,.056,d),part(-w*.36,-.028,0,.07,h-.056,d*.8),part(w*.36,-.028,0,.07,h-.056,d*.8)]);
  }
  return null;
}

function installLivingPreset(world, addObject) {
  addObject('worktable','T1','工作台',[-3.45,0,-1.30],{aliases:['工作台','桌子'],color:[.35,.255,.16]});
  addObject('shelf','F1','储物架',[3.38,0,-2.00],{aliases:['储物架','书架'],color:[.26,.22,.17]});
  addObject('bench','F2','休息长凳',[3.2,0,1.45],{aliases:['休息长凳','长凳'],color:[.27,.32,.29]});
  addObject('wall','W1','左侧空间边界',[-3.0,0,-3.12],{w:2.5,h:.95,d:.12,aliases:['左侧空间边界'],color:[.29,.33,.32]});
  addObject('wall','W2','中央空间边界',[0,0,-3.12],{w:2.5,h:.95,d:.12,aliases:['中央空间边界'],color:[.29,.33,.32]});
  addObject('wall','W3','右侧空间边界',[3.0,0,-3.12],{w:2.5,h:.95,d:.12,aliases:['右侧空间边界'],color:[.29,.33,.32]});
  addObject('box','A','红色训练箱',[-1.70,0,.22],{aliases:['红色','红箱','训练箱']});
  addObject('sphere','B','蓝色训练球',[1.62,0,.14],{aliases:['蓝色','蓝球','训练球']});
  addObject('cylinder','C','黄色训练圆柱',[-.45,0,-.50],{aliases:['黄色','黄柱','训练圆柱']});
  addObject('cone','D','绿色训练圆锥',[2.08,0,-.80],{aliases:['绿色','绿锥','训练圆锥']});
  addObject('prism','E','紫色训练三棱柱',[-2.30,0,1.20],{aliases:['紫色','三棱柱','棱柱']});
  world.zones=[
    {id:'Z1',name:'工作区 · 一区',shape:'square',p:[-1.95,0,-1.95],r:.66,color:[.28,.51,.47],aliases:['工作区','整理区','一区','一号','区域一']},
    {id:'Z2',name:'交流区 · 二区',shape:'circle',p:[0,0,-1.88],r:.64,color:[.63,.48,.28],aliases:['交流区','会客区','二区','二号','区域二']},
    {id:'Z3',name:'休息区 · 三区',shape:'hexagon',p:[1.65,0,1.78],r:.67,color:[.42,.45,.63],aliases:['休息区','三区','三号','区域三']}
  ].map(z=>world.normalizeZone(z,z.id));
}

function activitySpaceSnapshot(world) {
  return {schema:'jarvis/activity_space@1.0',units:'meter',
    navigationBounds:{...sceneBounds(world)},
    spaces:world.zones.map(z=>({id:z.id,name:z.name,position:[...z.p],radiusM:z.r,
      activities:world.presetId==='living'
        ? ({Z1:['walk','carry','push'],Z2:['walk','greet','wave','salute'],Z3:['walk','sit_ground','lie_ground','stand_up']}[z.id]||['walk'])
        : world.theme==='camp'?(CAMP_WORLD.zones.find(item=>item.id===z.id)?.activities||['walk']):['walk']})),
    chairSittingSupported:false,multiResidentNavigation:false};
}
