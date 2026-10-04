import {HUMAN_SPECIES_ID} from './HumanBodySpecies.mjs';
import {SCAR_REGIONS}from './ScarState.mjs';
// Only this adapter knows the current subject's material IDs and eye collar.
// Future subjects supply their own calibration; common functions do not change.
export function r008CompositionCalibration(anatomy,materials){
 if(anatomy.sourceId!=='new-human-r008')throw Error('R008 校准只能用于原人物；新来源必须提供自己的校准');
 return {schema:'human/composition-calibration@1',species:HUMAN_SPECIES_ID,sourceId:anatomy.sourceId,status:'candidate',referenceAge:32,
  provenance:'authored-fit-to-current-surface; internal anatomy not observed',
  protectedMaterials:[],
  samplingExcludedMaterials:materials.flatMap((m,i)=>/^tripo_part_(1|2|9)$/.test(m.name)?[i]:[]),
  appearanceExcludedMaterials:materials.flatMap((m,i)=>/^tripo_part_(1|2|9)$/.test(m.name)?[i]:[]),
  reliefProtectedMaterials:materials.flatMap((m,i)=>/^tripo_part_(1|2|3|9)$/.test(m.name)?[i]:[]),
  regions:{abdomen:{coreFraction:.55,satFraction:.14},thorax:{coreFraction:.64,satFraction:.08}},
  protectedFeatures:[{id:'left-eye-collar',centre:[.035,1.661,.096],radii:[.050,.030,.060]},{id:'right-eye-collar',centre:[-.035,1.661,.096],radii:[.050,.030,.060]}],
  reliefProtectedFeatures:[{centre:[.079,1.342,.106],radii:[.019,.025,.035]},{centre:[-.079,1.342,.106],radii:[.019,.025,.035]},{centre:[0,1.075,.097],radii:[.019,.025,.035]},...SCAR_REGIONS.map(s=>({centre:s.centre||s.center,radii:s.radii||[.06,.08,.06]})).filter(s=>s.centre)]};
}
