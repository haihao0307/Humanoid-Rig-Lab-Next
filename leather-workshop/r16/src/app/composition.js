/** Stable application composition root.
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
 const edition=document.querySelector('.edition');if(edition)edition.textContent=VERSION+' · SEWN / GRABBABLE';
 // setupUI has already registered the primary pointer handlers. Keep this order.
 initRestoredControls();initEdgeInspection();initCraftControls();initInputPerformance();initFrameLifecycle();
}
boot().catch(fail);
