/* Sparse styling directions for space curves. Head-local +Z is forward.
 * Style is independent of follicle density and the root attachment surface. */
const HAIR_GROOM_GUIDES=Object.freeze([
 {root:[-.35,.88,.32],exit:[-.25,.05,.85],tip:[-.70,-.25,.45],length:.062,lift:.013,part:-1},
 {root:[.05,.95,.25],exit:[.65,.15,.65],tip:[.90,-.25,.30],length:.070,lift:.017,part:1},
 {root:[.48,.80,.35],exit:[.70,.05,.55],tip:[.50,-.65,.30],length:.058,lift:.014,part:1},
 {root:[-.55,.55,.62],exit:[-.45,-.10,.65],tip:[-.45,-.65,.25],length:.037,lift:.006,part:-1},
 {root:[.50,.55,.65],exit:[.65,-.05,.45],tip:[.40,-.75,.20],length:.041,lift:.009,part:1},
 {root:[-.93,.25,.28],exit:[-.05,-.90,.20],tip:[0,-1,.08],length:.024,lift:.004,part:-1},
 {root:[.93,.25,.28],exit:[.05,-.90,.20],tip:[0,-1,.08],length:.024,lift:.004,part:1},
 {root:[-.75,.53,-.40],exit:[-.35,-.65,-.40],tip:[-.10,-1,-.10],length:.036,lift:.006,part:-1},
 {root:[.75,.53,-.40],exit:[.35,-.65,-.40],tip:[.10,-1,-.10],length:.036,lift:.006,part:1},
 {root:[.08,.94,-.32],exit:[.65,.05,-.60],tip:[.70,-.40,-.40],length:.053,lift:.012,part:1},
 {root:[-.28,.88,-.36],exit:[-.65,.05,-.55],tip:[-.55,-.55,-.25],length:.046,lift:.010,part:-1},
 {root:[0,.50,-.87],exit:[.15,-.80,-.30],tip:[0,-1,0],length:.033,lift:.006,part:0},
 {root:[-.45,-.20,-.87],exit:[-.05,-1,0],tip:[0,-1,.10],length:.022,lift:.003,part:0},
 {root:[.45,-.20,-.87],exit:[.05,-1,0],tip:[0,-1,.10],length:.022,lift:.003,part:0}
]);
// Short side-swept pixie; a styling choice, not a biological sex rule.
const FEMALE_HAIR_GROOM_GUIDES=Object.freeze([
 {root:[-.40,.87,.30],exit:[.70,.15,.65],tip:[.85,-.45,.30],length:.078,part:1},
 {root:[.05,.96,.22],exit:[.85,.10,.40],tip:[.65,-.65,.28],length:.080,part:1},
 {root:[.50,.80,.32],exit:[.65,-.20,.45],tip:[.20,-.95,.18],length:.065,part:1},
 {root:[-.58,.55,.60],exit:[-.30,-.55,.50],tip:[-.12,-1,.12],length:.039,part:-1},
 {root:[.55,.55,.60],exit:[.25,-.60,.40],tip:[.08,-1,.15],length:.052,part:1},
 {root:[-.93,.25,.22],exit:[-.05,-.95,-.10],tip:[0,-1,.08],length:.032,part:-1},
 {root:[.93,.25,.22],exit:[.05,-.95,-.10],tip:[0,-1,.08],length:.042,part:1},
 {root:[-.72,.54,-.43],exit:[-.20,-.75,-.30],tip:[-.05,-1,.05],length:.045,part:-1},
 {root:[.72,.54,-.43],exit:[.20,-.75,-.30],tip:[.05,-1,.05],length:.049,part:1},
 {root:[.08,.94,-.32],exit:[.50,-.10,-.70],tip:[.20,-.90,-.25],length:.066,part:1},
 {root:[-.30,.86,-.40],exit:[-.35,-.25,-.70],tip:[-.10,-.95,-.18],length:.056,part:-1},
 {root:[0,.50,-.87],exit:[0,-.85,-.30],tip:[0,-1,.10],length:.038,part:0},
 {root:[-.45,-.20,-.87],exit:[-.05,-1,.05],tip:[0,-1,.15],length:.024,part:0},
 {root:[.45,-.20,-.87],exit:[.05,-1,.05],tip:[0,-1,.15],length:.024,part:0}
]);
function hairGroomAt(d,bodySex='male'){
 const partBlend=hairSmooth(-.32,-.14,d[0]);let total=0,length=0,lift=0,exit=[0,0,0],tip=[0,0,0];
 for(const g of bodySex==='female'?FEMALE_HAIR_GROOM_GUIDES:HAIR_GROOM_GUIDES){
  // Styling is a continuous bias, never a missing strip of follicles.
  const sideWeight=d[1]>.55&&g.part ? .25+.75*(g.part<0?1-partBlend:partBlend) : 1;
  const w=sideWeight/(.035+Math.max(0,1-dot(d,norm(g.root))))**3;
  total+=w;length+=g.length*w;lift+=(g.lift||0)*w;exit=add(exit,mul(g.exit,w));tip=add(tip,mul(g.tip,w));
 }
 return {length:length/total,lift:lift/total,exit:mul(exit,1/total),tip:mul(tip,1/total)};
}
