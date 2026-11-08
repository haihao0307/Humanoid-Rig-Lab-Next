// Manual observations of the user-selected 615x900 photograph. These are 2D
// wrinkle centreline annotations, not measured 3D depth or subject anatomy.
// Maps transfer regional relationships to this workbench's own source chart.
const annotations=[];
function line(region,width,depth,points,bank=.4){annotations.push({region,width,depth,points,bank});}
line('forehead',.58,.29,[[142,254],[200,249],[240,248],[277,261],[304,255],[346,244],[395,246],[451,246]]);
line('forehead',.54,.30,[[135,281],[190,275],[238,271],[271,282],[303,282],[334,268],[368,271],[411,269],[467,286]]);
line('forehead',.62,.28,[[135,309],[170,295],[214,291],[249,297],[268,311]]);
line('forehead',.48,.20,[[322,294],[351,292],[386,304],[422,304],[464,328]]);
line('forehead',.29,.09,[[180,216],[220,213],[254,222],[288,224],[320,213],[365,212],[411,219]],.25);
line('forehead',.20,.055,[[165,267],[193,263],[225,267],[247,272]],.15);
line('forehead',.19,.045,[[344,254],[369,258],[395,255],[426,257]],.15);
line('forehead',.17,.035,[[156,294],[184,288],[210,290]],.12);
line('glabella',.65,.35,[[279,280],[281,304],[285,322],[285,348],[275,367]],.5);
line('glabella',.60,.32,[[319,281],[316,303],[313,328],[309,352]],.5);
line('glabella',.45,.18,[[340,295],[347,318],[354,336],[350,358]],.4);
line('glabella',.24,.08,[[268,310],[262,332],[257,349]],.2);
line('root',.36,.12,[[289,365],[302,370],[322,368]],.35);
line('root',.20,.045,[[288,375],[300,378],[315,375]],.2);
for(const [w,d,p]of[
 [.32,.13,[[133,378],[119,376],[99,365]]],
 [.46,.24,[[128,387],[110,387],[91,377]]],
 [.50,.29,[[130,394],[111,398],[93,400]]],
 [.36,.19,[[133,402],[114,413],[103,424]]],
 [.24,.10,[[139,410],[123,427],[112,439]]],
 [.31,.12,[[478,375],[491,371],[511,365]]],
 [.42,.21,[[482,383],[498,381],[518,376]]],
 [.48,.27,[[480,391],[499,396],[518,400]]],
 [.34,.16,[[476,400],[492,410],[511,420]]],
 [.22,.09,[[467,411],[486,427],[503,435]]]
])line('canthus',w,d,p,.42);
for(const [w,d,p]of[
 [.75,.38,[[132,404],[154,416],[183,417],[212,411],[235,402]]],
 [.50,.25,[[134,418],[155,430],[183,431],[207,425],[233,413]]],
 [.26,.09,[[137,433],[161,446],[190,444],[214,431]]],
 [.20,.07,[[121,425],[132,442],[157,451]]],
 [.14,.04,[[162,413],[166,424],[174,433]]],
 [.70,.35,[[352,401],[376,410],[404,416],[431,414],[464,402]]],
 [.48,.23,[[355,414],[380,428],[411,430],[442,419],[472,409]]],
 [.24,.085,[[365,432],[394,444],[421,441],[453,427]]],
 [.19,.065,[[451,424],[471,441],[488,449]]],
 [.13,.035,[[401,420],[412,434],[429,444]]]
])line('infraorbital',w,d,p,d>.2?.55:.2);
for(const p of[
 [[205,581],[210,566],[211,553]],[[223,586],[228,567],[230,551]],
 [[242,588],[245,572],[247,557]],[[262,587],[265,574],[267,561]],
 [[339,586],[340,571],[339,558]],[[356,589],[355,574],[353,558]],
 [[376,586],[374,571],[369,554]],[[395,580],[392,567],[386,553]]
])line('perioral',.28,.105,p,.38);
for(const p of[
 [[230,628],[235,641],[247,650]],[[256,629],[261,644],[266,652]],[[281,631],[285,642],[287,650]],
 [[330,630],[325,643],[320,650]],[[355,628],[351,642],[346,652]],[[380,626],[375,640],[365,650]]
])line('perioral',.24,.085,p,.35);
for(const [w,d,p]of[
 [.55,.26,[[219,650],[256,661],[300,665],[340,660],[386,652]]],
 [.48,.22,[[225,677],[267,685],[307,684],[354,674],[391,666]]],
 [.38,.17,[[232,698],[278,706],[320,702],[360,695],[391,683]]],
 [.27,.10,[[253,718],[292,720],[333,716],[371,703]]],
 [.16,.045,[[235,658],[236,677],[245,693]]],
 [.16,.045,[[373,659],[366,682],[355,698]]]
])line('chin',w,d,p,d>.15?.45:.15);
for(const p of[
 [[154,448],[168,461],[181,469]],[[130,450],[139,467],[151,480]],[[139,482],[154,494],[171,506]],
 [[150,507],[165,517],[178,526]],[[154,477],[166,478],[177,484]],
 [[453,449],[440,463],[430,472]],[[483,448],[473,468],[459,480]],[[470,483],[456,496],[442,507]],
 [[458,508],[446,520],[435,530]],[[456,477],[444,480],[433,488]]
])line('cheek',.14,.033,p,.18);
function map(region,p){const[x,y]=p;if(region==='canthus'){const sign=x<307?-1:1,px=sign<0?125:480;return[sign*45.8+(x-px)*.30,300-(y-389)*.28];}if(region==='infraorbital'){const left=x<307;return[(left?-32:32)+(x-(left?190:418))*.27,300-(y-388)*.28];}if(region==='perioral')return[(x-307)*.23,y<610?242+(592-y)*.26:222+(624-y)*.25];if(region==='chin')return[(x-307)*.23,218+(640-y)*.20];return[(x-307)*.27,300+(388-y)*.28];}
function basis(t,degree){const r=[1,t];for(let i=2;i<=degree;i++)r.push(2*t*r[i-1]-r[i-2]);return r.slice(0,degree+1);}
function solve(A,b){A=A.map((r,i)=>[...r,b[i]]);const n=b.length;for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[p][i]))p=j;[A[i],A[p]]=[A[p],A[i]];if(Math.abs(A[i][i])<1e-12)throw Error('Degenerate wrinkle curve');const z=A[i][i];for(let k=i;k<=n;k++)A[i][k]/=z;for(let j=0;j<n;j++){if(j===i)continue;const f=A[j][i];for(let k=i;k<=n;k++)A[j][k]-=f*A[i][k];}}return A.map(r=>r[n]);}
export function photoWrinkleLayout(){return annotations.map((a,index)=>{const p=a.points.map(q=>map(a.region,q)),first=p[0],last=p.at(-1),cx=(first[0]+last[0])*.5,cy=(first[1]+last[1])*.5,length=Math.hypot(last[0]-first[0],last[1]-first[1]),tx=(last[0]-first[0])/length,ty=(last[1]-first[1])/length,L=length*.53;
 const degree=Math.min(6,p.length-1),rows=p.map(([x,y])=>{const u=((x-cx)*tx+(y-cy)*ty)/L,v=-(x-cx)*ty+(y-cy)*tx;return{b:basis(u,degree),v};}),A=Array.from({length:degree+1},(_,i)=>Array.from({length:degree+1},(_,j)=>rows.reduce((s,r)=>s+r.b[i]*r.b[j],0)+(i===j?1e-7:0))),b=Array.from({length:degree+1},(_,i)=>rows.reduce((s,r)=>s+r.b[i]*r.v,0)),coefficients=solve(A,b),maxFitErrorMM=Math.max(...rows.map(r=>Math.abs(r.v-r.b.reduce((s,x,i)=>s+x*coefficients[i],0))));
 return{region:a.region,x:cx,y:cy,tx,ty,L,w:a.width,depth:a.depth,bend:0,wave:0,freq:1,poly:[...coefficients,...Array(7-coefficients.length).fill(0)],bank:a.bank,annotation:index,provenance:'user-reference-2D-centrelines; authored-depth-and-width',maxFitErrorMM};
});}
export function photoWrinkleLayoutReport(){const q=photoWrinkleLayout();return{image:'user-target.jpg',photoSize:[615,900],curves:q.length,source:'user-selected photograph',centrelines:'manual 2D annotations mapped by regional landmarks',depthAndWidth:'authored, not measured from image',function:'degree <= 6 Chebyshev graph with finite smooth endpoints',maximumAnnotationFitErrorMM:Math.max(...q.map(x=>x.maxFitErrorMM)),subjectGeometryTransferred:false};}
