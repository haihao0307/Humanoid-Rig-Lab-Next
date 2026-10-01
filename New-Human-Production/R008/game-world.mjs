// World dimensions in metres; the same boxes drive rendering and collisions.
export const WORLD = {
 spawn:{x:0,y:0,z:3.6,yaw:Math.PI}, limit:11.5,
 boxes:[
  ...[.18,.36,.54,.72].map((height,i)=>({id:'step-'+(i+1),x:-3.4,z:1.2-i*.86,width:2.2,depth:.86,height,color:0x445c65,accent:0x73d9c0,label:`STEP ${i+1} / ${height.toFixed(2)} m`})),
  {id:'low-wall',x:0,z:-.9,width:2.25,depth:1.05,height:.65,color:0x655b49,accent:0xf2c47a,label:'JUMP / 0.65 m'},
  {id:'platform',x:0,z:-3.4,width:2.25,depth:2,height:.8,color:0x445c65,accent:0x73d9c0,label:'LAND / 0.80 m'},
  {id:'high-wall',x:3.4,z:-1.3,width:1.6,depth:1.3,height:1.7,color:0x3d4a57,accent:0x90a9be,label:'SOLID WALL / 1.70 m'}
 ]
};
export function bounds(b){return {minX:b.x-b.width/2,maxX:b.x+b.width/2,minZ:b.z-b.depth/2,maxZ:b.z+b.depth/2};}
export function circleOverlaps(x,z,r,b){const a=bounds(b),cx=Math.max(a.minX,Math.min(x,a.maxX)),cz=Math.max(a.minZ,Math.min(z,a.maxZ));return (x-cx)**2+(z-cz)**2<r*r;}
export function supportAt(x,z,ceiling=Infinity,world=WORLD){let h=0,id='ground';for(const b of world.boxes){const a=bounds(b);if(x>=a.minX&&x<=a.maxX&&z>=a.minZ&&z<=a.maxZ&&b.height<=ceiling&&b.height>h){h=b.height;id=b.id;}}return {height:h,id};}
