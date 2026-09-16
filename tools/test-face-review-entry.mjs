// Verify that the public face-review URL loads one actor without changing normal population startup.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../source/runtime.template.js',import.meta.url),'utf8');
assert(source.includes("const runtimeQuery=(()=>{try{return new URLSearchParams(window.parent.location.search)}catch{return new URLSearchParams(location.search)}})(),reviewMode=runtimeQuery.get('review');"),'review mode must read the public parent URL');
assert(source.includes("auto=!runtimeQuery.has('qa')&&!reviewMode"),'review mode must not advance the task simulation automatically');
const compact=source.indexOf('await installCompactWorkbench(window.HumanLab,compactSurfaceReady);');
const review=source.indexOf("if(reviewMode==='face'){");
const population=source.indexOf('installNPCPopulation(window.HumanLab);');
assert(compact>=0&&review>compact&&population>review,'face review branch must run after the first body and before population construction');
assert(source.includes("window.HumanLab.review={mode:'face',singleActor:true,populationSkipped:true,hairSkipped:true};"),'runtime must expose the single-actor review contract');
assert(source.includes("window.HumanLab.face.closeup(reviewMode==='face'?'front':'front')")||source.includes("window.HumanLab.face.closeup('front')"),'face review must enter the front close-up');
assert(source.includes("}else{\n installNPCPopulation(window.HumanLab);"),'normal sessions must retain population startup');
assert(source.includes('installMotherPair()')&&source.includes('installReviewCast()'),'normal population variants must remain available');
assert(source.includes("if(reviewMode!=='face')scheduleCompactHair(window.HumanLab.population?.active||window.HumanLab);"),'face review must skip hair work while normal mode keeps the population-aware fallback');
console.log(JSON.stringify({publicReviewQuery:true,singleActorReview:true,populationSkippedOnlyInFaceReview:true,hairSkippedOnlyInFaceReview:true,normalPopulationPreserved:true,browserExecuted:false,visualAcceptance:false}));
