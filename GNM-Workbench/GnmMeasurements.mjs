import {measurementRows} from '/shared/FaceMeasurements.mjs';
// GNM's metres and landmarks are calibrated independently of the old avatar.
export const GNM_FRONT_CAMERA=Object.freeze({fov:28,position:[0,.285,.95],target:[0,.285,.080]});
export function measureGNM(landmarks){return measurementRows(landmarks,null,p=>[p[0]/(.95-p[2]),(.285-p[1])/(.95-p[2])]);}
export function measurementComparison(current,baseline){const previous=new Map(baseline.map(row=>[row.id,row]));return current.map(row=>{const base=previous.get(row.id);return {...row,baseline:base?.actual??null,change:row.actual!==null&&base?.actual?100*(row.actual/base.actual-1):null};});}
