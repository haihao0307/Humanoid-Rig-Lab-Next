/* Versioned body motion settings. Head state and bone lengths are not edited. */
(()=>{'use strict';
const defaults=Object.freeze({schema:'body-motion-contact-r41/1',jointVolume:.65,ground:true,plantFeet:true,floor:0,collision:true,stride:.28,clearance:.075,duration:2.2,gaitPhase:null,travel:0});
const ranges={jointVolume:[0,1],floor:[-.5,.5],stride:[.08,.5],clearance:[.025,.18],duration:[1,6],gaitPhase:[0,1],travel:[-10000,10000]};
function validate(value){if(value==null)return true;if(typeof value!=='object'||Array.isArray(value)||value.schema!==defaults.schema)return false;for(const [k,v]of Object.entries(value)){if(!Object.hasOwn(defaults,k))return false;if(k==='schema')continue;if(['ground','plantFeet','collision'].includes(k)){if(typeof v!=='boolean')return false;}else if(k==='gaitPhase'&&v===null)continue;else if(!Number.isFinite(v)||v<ranges[k][0]||v>ranges[k][1])return false;}return true;}
function get(state){const value=state?.bodyCalibration?.motionR41;if(!validate(value))throw Error('动作接地设置无效，原人物已保留');return{...defaults,...value};}
globalThis.BodyMotionSettingsR41={defaults,ranges,validate,get};
})();
