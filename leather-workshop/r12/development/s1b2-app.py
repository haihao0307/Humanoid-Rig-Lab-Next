"""One-time application source edit. Never invoked by the production linker."""
from pathlib import Path
r=Path(__file__).resolve().parents[1];a=r/'src/app'
def one(s,x,y):
 if s.count(x)!=1:raise ValueError((x[:90],s.count(x)))
 return s.replace(x,y,1)
s=(a/'runtime.js').read_text()
for name in ['destroyGeometry','setView','selectProduct','updateDetails','recipe','prepareGrab','updateGrabUI']:
 s=one(s,'function '+name+'(', 'function '+name+'Base(')
s=one(s,"const VERSION='R10.0'", "const VERSION='R12.0-S1B2'")
s=one(s, "'R10.0 / CRAFT · LIVE THICKNESS · SURFACE CONTACT'", "VERSION+' / CRAFT · LIVE THICKNESS · SURFACE CONTACT'")
s=one(s,'setupUI();library=new AtelierMaterials(', 'setupUI();initializeAppControls();library=new ArtistAtelierMaterials(')
s=one(s,"boot().catch(fail);",'')
begin="window.LEATHER_ATELIER={auditContact:()=>productSolver.ask('audit'),stepProduct:async(n=1)=>{await productSolver.ready;await productSolver.ask('active',{value:true});for(let i=0;i<n;i++)await productSolver.ask('step',{count:1});await productSolver.ask('active',{value:false});return productSolver.report();},"
s=one(s,begin,"window.LEATHER_ATELIER={")
s=one(s,"return physState.report;}};\n}","return physState.report;}};\n bindPublicAppAPI();\n}")
(a/'runtime.js').write_text(s)
s=(a/'view-polish.js').read_text()
s=one(s,'const inheritedAtelierView=setView;\nsetView=function(id){\n inheritedAtelierView(id);', 'function applyMacroView(id){')
s=s.rstrip();assert s.endswith('};');s=s[:-2]+'}\n'
(a/'view-polish.js').write_text(s)
s=(a/'atelier-controls.js').read_text();i=s.index('// R08 keeps');s=s[i:]
s=one(s,'const createSurface=AtelierMaterials.prototype.create;\nAtelierMaterials.prototype.create=function(c,res){', '/** App-local material extension. The shared catalogue prototype stays untouched. */\nclass ArtistAtelierMaterials extends AtelierMaterials {\n create(c,res){')
s=one(s,'const e=createSurface.call(this,recipe,res)', 'const e=super.create(recipe,res)')
s=one(s,"m.customProgramCacheKey=()=>key+'-R08-artist';return e;\n};", "m.customProgramCacheKey=()=>key+'-R08-artist';return e;\n }\n}")
s=one(s,'const oldUpdateDetails=updateDetails;\nupdateDetails=function(){oldUpdateDetails();', 'function updateShellDetails(){')
s=one(s,"initRestoredControls();\nconst originalSelectProduct=selectProduct;\nselectProduct=function(id){isThicknessView=false;$('thicknessView').classList.remove('active');return originalSelectProduct(id);};\nconst originalPrepare=prepareGrab;\nprepareGrab=function(){originalPrepare();if(window.LEATHER_ATELIER){window.LEATHER_ATELIER.measureShell=measureShell;window.LEATHER_ATELIER.thicknessView=thicknessView;}};", "function resetThicknessMode(){isThicknessView=false;$('thicknessView').classList.remove('active');}\nfunction inspectGrip(){return {report:productSolver.report(),positionsMM:Array.from(productSolver.x,v=>v*1000),triangles:hero.userData.rig.data.triangles.map(t=>t.slice(0,3))};}")
s=one(s,"$('viewEdge').onclick=inspectCut;", "function initEdgeInspection(){ $('viewEdge').onclick=inspectCut; }")
(a/'atelier-controls.js').write_text(s+'\n')
s=(a/'craft-ui.js').read_text()
s=one(s,"const ribbon=$('craftRibbon');\n", "let ribbon,craftNote;\nfunction initCraftControls(){\n ribbon=$('craftRibbon');\n")
s=one(s,"const craftNote=document.createElement('span');craftNote.className='craft-note';ribbon.append(craftNote);", "craftNote=document.createElement('span');craftNote.className='craft-note';ribbon.append(craftNote);\n}")
s=one(s,"const updateBeforeR09=updateDetails;\nupdateDetails=function(){updateBeforeR09();", "function updateCraftDetails(){")
s=one(s,"const previousRecipe=recipe;recipe=function(){return{...previousRecipe(),version:'R10.0',", "function appendCraftRecipe(base){return{...base,version:VERSION,")
start=s.index('const previousPrepareR09=prepareGrab;');end=s.index('const updateGrabBeforeR09',start);s=s[:start]+s[end:]
s=one(s,'const updateGrabBeforeR09=updateGrabUI;updateGrabUI=function(){updateGrabBeforeR09();', 'function updateSlowPhysicsNote(){')
(a/'craft-ui.js').write_text(s+'\n')
s=(a/'lifecycle.js').read_text()
s=one(s,'const destroyBeforeR09=destroyGeometry;\ndestroyGeometry=function(root)', 'function releaseProductMaterials(root)')
s=one(s,'destroyBeforeR09(root);','')
(a/'lifecycle.js').write_text(s+'\n')
s=(a/'input-performance.js').read_text()
s=one(s,'const oldGrabUI=updateGrabUI;let lastStats=0;\nupdateGrabUI=function(){const now=performance.now();if(productSolver?.active&&!productSolver?.failed&&now-lastStats<200)return;lastStats=now;oldGrabUI();', 'let lastStats=0;\nfunction shouldRefreshGrabUI(){const now=performance.now();if(productSolver?.active&&!productSolver?.failed&&now-lastStats<200)return false;lastStats=now;return true;}\nfunction updateInputMetrics(){')
s=one(s,"const stage=$('stage'),cursor=document.createElement('span');cursor.id='grabCursor';cursor.title='鼠标输入目标，不代表物理已到达';stage.append(cursor);let activePointer=null;", "let stage,cursor,activePointer=null;\nfunction initInputPerformance(){\n stage=$('stage');cursor=document.createElement('span');cursor.id='grabCursor';cursor.title='鼠标输入目标，不代表物理已到达';stage.append(cursor);\n")
# Preserve exactly the source string used by the tested edit (no extra blank LF).
s=s.replace("stage.append(cursor);\n\nfunction cursorAt", "stage.append(cursor);\nfunction cursorAt",1)
s=one(s,'// Stable public diagnostics for regression and future integration.', '}\n// Recipe annotation is explicit and does not wrap or reassign recipe.')
start=s.index('const previousPreparePerf=prepareGrab;');end=s.index('const oldRecipePerf',start);s=s[:start]+s[end:]
s=one(s,'const oldRecipePerf=recipe;recipe=function(){const r=oldRecipePerf();', 'function appendPerformanceRecipe(r){')
(a/'input-performance.js').write_text(s+'\n')
(a/'composition.js').write_text('''/** Stable application composition root.
 * Declared once before boot; callbacks never capture a superseded wrapper.
 * The physics worker, renderer, shader and geometry kernels are not modified.
 */
function setView(id){setViewBase(id);applyMacroView(id);}
function selectProduct(id){resetThicknessMode();return selectProductBase(id);}
function updateDetails(){updateDetailsBase();updateShellDetails();updateCraftDetails();}
function destroyGeometry(root){if(!root)return;releaseProductMaterials(root);destroyGeometryBase(root);}
function recipe(){return appendPerformanceRecipe(appendCraftRecipe(recipeBase()));}
function updateGrabUI(){
 if(!shouldRefreshGrabUI())return;
 updateGrabUIBase();updateSlowPhysicsNote();updateInputMetrics();
}
function prepareGrab(){prepareGrabBase();bindPublicAppAPI();}
function bindPublicAppAPI(){
 const api=window.LEATHER_ATELIER;if(!api)return;
 // All closures look up the current solver, not a disposed previous product.
 Object.assign(api,{
  inspectGrip,measureShell,thicknessView,recipe,
  auditContact:()=>productSolver.ask('audit'),
  stepProduct:n=>productSolver.step(n||1),
  performance:()=>productSolver.report()
 });
}
let appControlsInitialized=false;
function initializeAppControls(){
 if(appControlsInitialized)throw Error('Application controls initialized twice');
 appControlsInitialized=true;
 // setupUI has already registered the primary pointer handlers. Keep this order.
 initRestoredControls();initEdgeInspection();initCraftControls();initInputPerformance();
}
boot().catch(fail);
''')
