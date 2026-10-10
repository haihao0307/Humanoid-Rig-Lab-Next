/** Reusable, dimensionless medial profile. No head, texture, skeleton or
 * global scene references. Distances are metres in the caller's local frame. */
export const MEDIAL_PROFILE_VERSION='kaopu/medial-recess@1';
export const smooth01=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function medialRecess({s,closure,anterior,support,radius}){
 if(![s,closure,anterior,support,radius].every(Number.isFinite)||radius<=0)throw Error('Invalid medial support sample');
 const open=1-smooth01(closure),zone=1-smooth01(s/.18);
 // Recess the shared attachment, not just the disconnected-looking central patch.
 const clearance=radius*(.025+.020*smooth01(s/.12));
 const excess=Math.max(0,anterior-support-clearance);
 const displacement=Math.min(radius*.148,excess*.78)*zone*open;
 return {z:anterior-displacement,displacement,zone,clearance};
}
