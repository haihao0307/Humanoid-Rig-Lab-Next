import {readFileSync,writeFileSync} from 'node:fs';

const path='tools/capture-face-diagnosis.cjs';
let source=readFileSync(path,'utf8');
const old="await page.waitForTimeout(250);await frame.locator('#view').screenshot({path:path.join(out,c.name+'.png'),timeout:60000});samples.push({name:c.name,requested:c,cameraReference:fixedCamera?process.env.HUMAN_FACE_CAMERA_REFERENCE:null,...state});";
const replacement="await page.waitForTimeout(250);const view=frame.locator('#view'),box=await view.boundingBox();if(!box)throw Error('Face diagnostic view bounds missing');const x=Math.max(0,box.x),y=Math.max(0,box.y),clip={x,y,width:Math.max(1,Math.min(box.width,1500-x)),height:Math.max(1,Math.min(box.height,1080-y))};await page.screenshot({path:path.join(out,c.name+'.png'),clip,animations:'disabled',timeout:60000});samples.push({name:c.name,requested:c,cameraReference:fixedCamera?process.env.HUMAN_FACE_CAMERA_REFERENCE:null,...state});";
if(source.includes(old)){
  source=source.replace(old,replacement);
  writeFileSync(path,source,'utf8');
}else if(!source.includes("Face diagnostic view bounds missing"))throw Error('Face browser capture patch anchor missing');
console.log(JSON.stringify({applied:true,directViewportCapture:true}));
