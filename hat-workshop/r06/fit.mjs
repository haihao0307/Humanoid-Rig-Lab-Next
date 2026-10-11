import {sourceFitProfile as legacyProfile,deform as legacyDeform} from './legacy/field.mjs';
import {prepareContact,fitContact} from './contact.mjs';
import {addTailoredBand} from './tailored-band.mjs';
import {attachSupportReport} from './support.mjs';
export {CONSTRUCTION} from './core.mjs';
const aperture=new Set(['cable','fishing','flatcap','visor','patrol','chef']);
export function sourceFitProfile(mesh,meta){return aperture.has(meta.id)?prepareContact(mesh,meta):legacyProfile(mesh,meta);}
export function deform(mesh,meta,s,hp,src){
 const out=aperture.has(meta.id)&&s.autoFit&&hp?fitContact(mesh,meta,s,hp,src):legacyDeform(mesh,meta,s,hp,aperture.has(meta.id)?legacyProfile(mesh,meta):src);
 if(hp&&s.autoFit&&['trilby','bowler','top','cloche','chef'].includes(meta.id))addTailoredBand(mesh,meta,s,hp,out);
 return hp&&s.autoFit?attachSupportReport(mesh,meta,s,hp,src,out):out;
}
