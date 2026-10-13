"""R10 performance-only adaptation, after the frozen R09.1 adaptation."""
from pathlib import Path
import runpy
base=runpy.run_path(str(Path(__file__).resolve().parent.parent/'r09/source_adapters.py'))
def once(s,a,b):
 if s.count(a)!=1:raise ValueError('R10 source contract drift '+a[:100]+' '+str(s.count(a)))
 return s.replace(a,b,1)
def adapt(name,s):
 if name=='grip-worker.js':return s
 s=base['adapt'](name,s)
 if name in ['runtime.js','template.html','takeover-ui.js']:s=s.replace('R09.1','R10.0')
 if name=='runtime.js':
  s=s.replace("'wallet','belt','bag','cowboy','pirate','jacket','swatch'","'wallet','belt','bag','cowboy','pirate','swatch'")
  s=once(s,"function selectProduct(id){", "function selectProduct(id){if(id==='jacket')throw Error('立领夹克已按用户要求移除；等待服装工作台提供真实形态');")
  # Physics is no longer restricted to one substep per visual RAF.
  s=once(s,"if(mode==='products'&&productSolver?.active&&!productSolver.busy&&!productSolver.testing){productSolver.step(2)?.catch(fail);}","if(mode==='products'&&productSolver?.pendingPose)productSolver.flushPose();")
  s=once(s,'updateSkin(hero,productSolver);syncGripCollider();updateGrabUI();refreshLiveMeasurements();', 'updateSkin(hero,productSolver);updateGrabUI();refreshLiveMeasurements();')
  s=once(s,"el.onpointerdown=e=>{el.setPointerCapture", "el.onpointerdown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();document.body.classList.add('leather-dragging');getSelection()?.removeAllRanges();el.setPointerCapture")
  s=once(s,"pointers.delete(e.pointerId);pinch=0;", "pointers.delete(e.pointerId);pinch=0;if(!pointers.size)document.body.classList.remove('leather-dragging');")
  s=once(s,"function setRay(x,y){", "function setRay(x,y){camera.updateMatrixWorld(true);")
 if name=='panels.js':
  start=s.index('function frameField(r,x){');end=s.index('export function reskinMaterial',start)
  s=s[:start]+(Path(__file__).resolve().parent/'site/skin-update.js').read_text()+'\n'+s[end:]
 if name=='products.js':
  import re
  s=re.sub(r"^ jacket:\{.*?\},\n",'',s,flags=re.M)
  first=s.index('function jacket(');last=s.index('const activeProducts=',first)
  s=s[:first]+s[last:]
  s=s.replace('{wallet,belt,bag,swatch,jacket,cowboy:', '{wallet,belt,bag,swatch,cowboy:')
 if name=='template.html':
  s=s.replace('成品工艺（卡包 / 肩包 / 夹克 / 皮样）','成品工艺（卡包 / 肩包 / 皮样）')
  s=s.replace('repeat(7,minmax(0,1fr))','repeat(6,minmax(0,1fr))')
  s=once(s,'</style>', '#stage,#stage *{-webkit-user-select:none;user-select:none;-webkit-user-drag:none}body.leather-dragging,body.leather-dragging *{user-select:none!important;-webkit-user-select:none!important}#inputMetrics{font:9px/1.7 monospace;white-space:pre-line;color:#526456}#stage{overscroll-behavior:contain}#grabCursor{position:absolute;pointer-events:none;width:14px;height:14px;border:1px solid #4d654b;border-radius:50%;transform:translate(-50%,-50%);display:none}body.leather-dragging #grabCursor{display:block}</style>')
  s=once(s,'<div id="grabStats"></div>','<div id="grabStats"></div><div id="inputMetrics"></div>')
 if name=='takeover-ui.js':
  s=s.replace("jacket:'patch pockets only',",'')
  s=s.replace("['wallet','bag','jacket','swatch']","['wallet','bag','swatch']")
 if name=='implicit.mjs':
  s=once(s,'(p.pt?closestPT:closestEE)(a,p.ids)', '(p.pt?closestPT:closestEE)(a,p.ids,p.previous)')
  s=once(s,'return v=>{const rhs=new Float64Array(6),z=new Float64Array(6),solution=new Float64Array(6),out=new Float64Array(v.length);', 'const rhs=new Float64Array(6),z=new Float64Array(6),solution=new Float64Array(6),out=new Float64Array(x.length);return v=>{rhs.fill(0);')
  s=once(s,'const ss=Float64Array.from(q,(x,i)=>trial[i]-x),yy=Float64Array.from(st.grad,(x,i)=>next.grad[i]-x),sy=dp(ss,yy);', 'const ss=new Float64Array(N),yy=new Float64Array(N);for(let i=0;i<N;i++){ss[i]=trial[i]-q[i];yy[i]=next.grad[i]-st.grad[i];}const sy=dp(ss,yy);')
 if name=='native-energy.mjs':
  s=once(s,'a[9].set([...p.ids,p.gap,p.pt?1:0,...q.w,...q.n,p.frictionForce],14*i);', 'const o=14*i;for(let k=0;k<4;k++){a[9][o+k]=p.ids[k];a[9][o+6+k]=q.w[k];}a[9][o+4]=p.gap;a[9][o+5]=p.pt?1:0;for(let k=0;k<3;k++)a[9][o+10+k]=q.n[k];a[9][o+13]=p.frictionForce;')
  s=once(s,'6*this.capacity];','9*this.capacity];')
  s=once(s,"w[16].set([...p.ids,p.gap,p.pt?1:0],6*i);", "w[16].set([...p.ids,p.gap,p.pt?1:0,...(p.previous?.n||[0,0,0])],9*i);")
 if name=='energy.c':
  s=once(s,'CLIP=p;p+=6*NP;', 'CLIP=p;p+=9*NP;')
  mark='__attribute__((visibility("default"))) double clip_many'
  helper='static int cached_plane(double *q){V n={q[6],q[7],q[8]};if(dot(n,n)<.99)return 0;for(int a=0;a<(q[5]?1:2);a++)for(int b=q[5]?1:2;b<4;b++){int i=(int)q[a],j=(int)q[b];if(dot(sub(point(X,i),point(X,j)),n)<q[4]+1e-10||dot(sub(point(TMP,i),point(TMP,j)),n)<q[4]+1e-10)return 0;}return 1;}\n'
  s=once(s,mark,helper+mark)
  s=once(s,'double *q=CLIP+6*i;for(int z=0;', 'double *q=CLIP+9*i;if(cached_plane(q))continue;for(int z=0;')
 if name=='contact.mjs':
  s=once(s,'function nativeResult(ids,sweep=false){', 'function nativeResult(ids,sweep=false,target=null){if(target){target.ids=ids;target.d=output[0];for(let i=0;i<4;i++)target.w[i]=output[i+1];for(let i=0;i<3;i++)target.n[i]=output[i+5];return target;}')
  s=once(s,'function nativeClosest(x,ids,pt){', 'function nativeClosest(x,ids,pt,target=null){')
  s=once(s,'return nativeResult(ids);','return nativeResult(ids,false,target);')
  s=once(s,'closestPT=(x,ids)=>nativeClosest(x,ids,true);closestEE=(x,ids)=>nativeClosest(x,ids,false);','closestPT=(x,ids,target)=>nativeClosest(x,ids,true,target);closestEE=(x,ids,target)=>nativeClosest(x,ids,false,target);')
  s+='\nContactReference.createNative=()=>new WebAssembly.Instance(new WebAssembly.Module(Uint8Array.from(atob(CONTACT_NARROW_WASM),c=>c.charCodeAt(0))),{math:{log:Math.log,atan2:Math.atan2}}).exports;\n'
 if name=='contact.c':
  # Lazy second endpoint evaluation: exact same branches, tolerances and results.
  s=once(s,'Q q0=ispt?pt(a):ee(a),q1=ispt?pt(b):ee(b);\n if(separate(a,b,q0.n,gap,ispt)||separate(a,b,q1.n,gap,ispt))return 0;', 'Q q0=ispt?pt(a):ee(a);\n if(separate(a,b,q0.n,gap,ispt))return 0;\n Q q1=ispt?pt(b):ee(b);if(separate(a,b,q1.n,gap,ispt))return 0;')
 return s
