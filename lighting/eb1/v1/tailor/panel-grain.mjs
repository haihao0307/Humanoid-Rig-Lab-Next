/** Metric appearance coordinates. No garment position, pattern or physical material is changed.
 * The selected native sleeve patterns are drafted with their arm-length axis along X;
 * torso and trouser panels use Y. Rotations below preserve every cutting-space edge length.
 * This is a reviewed display-grain convention for these seven original shapes, not a
 * manufacturing grain certificate or a change to the original solver's material axes.
 */
export function grainAxes(panelID){
 if(panelID.startsWith('left_sleeve_'))return [0,1,-1,0];
 if(panelID.startsWith('right_sleeve_'))return [0,-1,1,0];
 return [1,0,0,1];
}
export function mapPanelUV(panelID,xMM,yMM){
 if(typeof panelID!=='string'||!Number.isFinite(xMM)||!Number.isFinite(yMM))throw new TypeError('Invalid original panel coordinate');
 const [a,b,c,d]=grainAxes(panelID);
 return [(a*xMM+b*yMM)*.001,(c*xMM+d*yMM)*.001];
}
