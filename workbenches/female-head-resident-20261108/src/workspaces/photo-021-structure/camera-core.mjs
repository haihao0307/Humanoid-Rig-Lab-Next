export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
export function projectPoint(point,camera){const q=camera.rotationCV.map((r,i)=>dot(r,point)+camera.translationCVMM[i]);return[q[0]/q[2]*camera.focalPX+camera.principalPointPX[0],q[1]/q[2]*camera.focalPX+camera.principalPointPX[1]];}
export function nativeCamera(c,height){return{eye:c.eyeNativeMM.slice(),right:c.rotationCV[0].slice(),up:c.rotationCV[1].map(v=>-v),forward:c.rotationCV[2].slice(),tanFov:height/(2*c.focalPX),near:.5};}
export function pixelRay(c,x,y){const a=(x-c.principalPointPX[0])/c.focalPX,b=(y-c.principalPointPX[1])/c.focalPX,R=c.rotationCV;return norm([0,1,2].map(k=>R[0][k]*a+R[1][k]*b+R[2][k]));}
// Query rows are bottom-up to match the existing native material compositor.
export function cameraRays(c,width,height){const out=new Float64Array(width*height*6);for(let row=0;row<height;row++)for(let x=0;x<width;x++){const i=(row*width+x)*6;out.set(c.eyeNativeMM,i);out.set(pixelRay(c,x+.5,height-row-.5),i+3);}return out;}
export function readingWindowDistance(point,box){return Math.hypot(Math.max(box[0]-point[0],0,point[0]-box[2]),Math.max(box[1]-point[1],0,point[1]-box[3]));}
