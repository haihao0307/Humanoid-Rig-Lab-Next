// Source-owned R15 continuous eye functions. No raster atlas generation.
// Artistic authored fields; not photographs, measured tissue or eye geometry.
const W=2048,H=2048,TAU=2*Math.PI,seed=20261022,centers=[[.7104,.3032],[.2896,.6988]];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
function rank(i,s=seed){let x=Math.imul(i+s,1597334677);x=Math.imul(x^(x>>>15),2246822519);return((x^(x>>>13))>>>0)/4294967296}
function noise(x,y,s=seed){const ix=Math.floor(x),iy=Math.floor(y),tx=smooth(0,1,x-ix),ty=smooth(0,1,y-iy),r=(a,b)=>rank(Math.imul(a,38113)^Math.imul(b,19139),s);return mix(mix(r(ix,iy),r(ix+1,iy),tx),mix(r(ix,iy+1),r(ix+1,iy+1),tx),ty)}
function angularNoise(a,n,s){const x=((a/TAU)%1+1)%1*n,i=Math.floor(x),t=smooth(0,1,x-i);return mix(rank(i%n,s),rank((i+1)%n,s),t)}
function angleDistance(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
const crypts=Array.from({length:4},(_,side)=>Array.from({length:52},(_,i)=>{const id=side*1907+i*13;return{a:rank(id)*TAU,q:i<35?.19+rank(id+1)*.22:.40+rank(id+1)*.43,w:.012+rank(id+2)*.061,h:.014+rank(id+3)*.065,d:(.10+rank(id+4)*.32)*(i<35?1:.35)}}));
const bundles=Array.from({length:4},(_,side)=>Array.from({length:320},(_,i)=>{const id=side*2903+i*19;return{a:(i+.12+.76*rank(id))/320*TAU,w:.0018+.0038*rank(id+1),phase:rank(id+2)*TAU,frequency:4+rank(id+3)*7,split:.25+rank(id+4)*.5,gain:.4+.6*rank(id+5),gap:.2+rank(id+6)*.6}}));
function iris(r,a,side,style){
 const pupil=style===0?.405:.295,q=clamp((r-pupil)/(1-pupil)),id=side+style*2,phase=id*.91;
 const xx=Math.cos(a)*(.30+.70*q),yy=Math.sin(a)*(.30+.70*q),warp=a+.010*Math.sin(a*7+q*5+phase)+.005*Math.sin(a*19-q*8);
 const n=bundles[id].length,cell=Math.floor((((warp/TAU)%1+1)%1)*n);let fiber=0,furrow=0;
 for(let j=-3;j<=3;j++){const b=bundles[id][(cell+j+n)%n],bend=.020*Math.sin(q*b.frequency+b.phase)+.008*Math.sin(q*24-b.phase),width=b.w*(.86+.36*Math.sin(q*15+b.phase))/(.40+.60*q),d=angleDistance(warp,b.a+bend)/width;
  const lengthGate=.15+.85*smooth(.018,.075,Math.abs(q-b.gap)),ridge=Math.exp(-d*d*1.5)*b.gain*lengthGate;
  fiber=Math.max(fiber,ridge);furrow=Math.max(furrow,Math.exp(-((d+1.4)**2)*1.8)*b.gain);
  const split=smooth(b.split,b.split+.2,q)*.025*Math.sin((q-b.split)*7+b.phase*.2),branch=angleDistance(warp,b.a+bend+split)/(width*.58);
  fiber=Math.max(fiber,Math.exp(-branch*branch*1.6)*b.gain*.66*smooth(b.split-.03,b.split+.04,q));
 }
 const cloud=.62*noise(xx*10.1,yy*10.1,seed+id*111)+.26*noise(xx*23.7,yy*23.7,seed+id*149)+.12*noise(xx*47.3,yy*47.3,seed+id*193);
 const sectors=angularNoise(a,29,seed+id*97),collar=.27+.055*Math.sin(a*7+phase)+.037*(angularNoise(a,21,seed+id*191)-.5),ridge=Math.exp(-(((q-collar)/.027)**2))*(.4+.6*angularNoise(a,71,seed+id*313));
 let cavity=0,rim=0;for(const c of crypts[id]){const da=angleDistance(a,c.a)/c.w,dr=(q-c.q)/c.h,dist=da*da+dr*dr;if(dist<7){cavity=Math.max(cavity,Math.exp(-dist*1.45)*c.d);rim=Math.max(rim,Math.exp(-(((Math.sqrt(dist)-1.1)/.20)**2))*c.d*.6)}}
 const outerArc=(.75+.10*Math.sin(a*4+phase)+.035*Math.sin(a*13)),fold=Math.exp(-(((q-outerArc)/.013)**2))*smooth(.25,.7,angularNoise(a,17,seed+id*31));
 const grain=noise(xx*83.1,yy*83.1,seed+id*29),light=clamp(.07+.40*cloud+.15*sectors+.40*fiber-.22*furrow+.19*ridge+.29*rim-.80*cavity-.14*fold+.035*(grain-.5),.012,1.02);
 const limbus=1-.70*smooth(.84,1.045,r),ruff=1-.33*(1-smooth(0,.045,q));
 const amber=smooth(.43,.8,noise(xx*7.7+3,yy*7.7,seed+id*331))*(1-smooth(.8,1,q));
 const dark=style===0?[25,29,25]:[27,32,38],bright=style===0?[213,218,186]:[192,211,221];
 const rgb=dark.map((v,k)=>clamp(mix(v,bright[k],light)*limbus*ruff,0,255));
 rgb[0]=mix(rgb[0],rgb[0]*1.20+13,amber*.55);rgb[1]=mix(rgb[1],rgb[1]*.94,amber*.45);rgb[2]=mix(rgb[2],rgb[2]*.63,amber*.6);
 const height=clamp(.43+.24*fiber+.13*ridge+.12*rim-.32*cavity-.10*fold-.08*furrow);
 return{rgb,height};
}
function sclera(u,v,side,r){const c=centers[side],x=(u-c[0])/.1185,y=-(v-c[1])/.1185,id=seed+side*1709;
 const cloud=.66*noise(x*2.7,y*2.7,id)+.24*noise(x*7.1,y*7.1,id+29)+.10*noise(x*17.3,y*17.3,id+59),outer=smooth(1.16,2.42,r),flank=Math.pow(Math.abs(x)/Math.max(r,.01),1.5),warm=outer*(.40+.60*flank),limbal=Math.exp(-(((r-1.09)/.19)**2));
 const patch=smooth(.48,.8,noise(x*2.1+5,y*2.1,id+991))*outer;
 const blush=smooth(.48,.74,noise(x*6.3+7,y*6.3,id+881))*smooth(1.08,1.9,r),cool=smooth(.4,.76,noise(x*4.8-3,y*4.8,id+713))*(1-smooth(1.2,2.1,r));
 const rgb=[230,226,217].map((v,k)=>v+(cloud-.5)*[11,12,14][k]-warm*[10,29,36][k]-patch*[0,5,6][k]-limbal*[13,9,3][k]-blush*[1,12,13][k]-cool*[9,4,-2][k]);
 const collagen=.5+.5*Math.sin(x*43+y*22+noise(x*9,y*9,id+101)*7),height=clamp(.5+(collagen-.5)*.09+(cloud-.5)*.20);
 return{rgb,height};
}

function vesselField(){const lines=[];let segments=0;const scale=W/1024;
 function draw(a,b,width,strength,density){lines.push({a:a.slice(),b:b.slice(),width,strength,density});segments++;} for(let side=0;side<2;side++)for(let trunk=0;trunk<30;trunk++){const id=side*2003+trunk*43,c=centers[side],angle=(trunk+rank(id)*.85)/30*TAU,reach=2.20+rank(id+1)*.75,end=1.11+rank(id+2)*.50,turn=(rank(id+3)-.5)*.23,density=.015+rank(id+4)*.40;
  const at=t=>{const r=mix(reach,end,t),a=angle+turn*t+.018*Math.sin(t*15+rank(id+5)*TAU)+.009*Math.sin(t*33+rank(id+6)*TAU);return[c[0]+Math.cos(a)*r*.1185,c[1]-Math.sin(a)*r*.1185]};
  for(let j=0;j<32;j++)draw(at(j/32),at((j+1)/32),mix(.75,.18,j/32),mix(.67,.32,j/32),density);
  for(let branch=0;branch<4;branch++){const t0=.13+branch*.16,p=at(t0),a0=angle+turn*t0,rr=mix(reach,end,t0),length=.18+rank(id+branch+11)*.52,direction=(branch%2?-1:1)*(.16+rank(id+branch+19)*.38);let prev=p;
   for(let j=1;j<=18;j++){const t=j/18,a=a0+direction*smooth(0,.8,t)+.012*Math.sin(t*17+id),r=rr-length*t,point=[c[0]+Math.cos(a)*r*.1185,c[1]-Math.sin(a)*r*.1185];draw(prev,point,mix(.34,.09,t),mix(.44,.18,t),density+.07);prev=point;}
  }
 }return{lines,segments};}

export const sourceEyeVesselFunctions=vesselField;
export const SOURCE_EYE_FIELD_REVISION='source-r15-continuous-eye/1';
export const sourceIrisField=iris;
export const sourceScleraField=sclera;
export const sourceEyeFieldLayout=Object.freeze({seed,width:W,height:H,centers:centers.map(v=>Object.freeze(v)),radiusA:.1185,radiusB:.1215});
