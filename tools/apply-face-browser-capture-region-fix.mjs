import {readFileSync,writeFileSync} from 'node:fs';

const path='tools/capture-face-diagnosis.cjs';
let source=readFileSync(path,'utf8');
const original="await page.waitForTimeout(250);await frame.locator('#view').screenshot({path:path.join(out,c.name+'.png'),timeout:60000});samples.push({name:c.name,requested:c,cameraReference:fixedCamera?process.env.HUMAN_FACE_CAMERA_REFERENCE:null,...state});";
const prior="await page.waitForTimeout(250);const view=frame.locator('#view'),box=await view.boundingBox();if(!box)throw Error('Face diagnostic view bounds missing');const x=Math.max(0,box.x),y=Math.max(0,box.y),clip={x,y,width:Math.max(1,Math.min(box.width,1500-x)),height:Math.max(1,Math.min(box.height,1080-y))};await page.screenshot({path:path.join(out,c.name+'.png'),clip,animations:'disabled',timeout:60000});samples.push({name:c.name,requested:c,cameraReference:fixedCamera?process.env.HUMAN_FACE_CAMERA_REFERENCE:null,...state});";
const replacement="await page.waitForTimeout(120);const view=frame.locator('#view'),box=await view.boundingBox();if(!box)throw Error('Face diagnostic view bounds missing');const x=Math.max(0,box.x),y=Math.max(0,box.y),clip={x,y,width:Math.max(1,Math.min(box.width,1500-x)),height:Math.max(1,Math.min(box.height,1080-y)),scale:1};const cdp=await page.context().newCDPSession(page);const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false,clip});await cdp.detach();if(!shot.data||shot.data.length<4096)throw Error('Face diagnostic screenshot was empty');fs.writeFileSync(path.join(out,c.name+'.png'),Buffer.from(shot.data,'base64'));samples.push({name:c.name,requested:c,cameraReference:fixedCamera?process.env.HUMAN_FACE_CAMERA_REFERENCE:null,...state});";
if(source.includes(original))source=source.replace(original,replacement);
else if(source.includes(prior))source=source.replace(prior,replacement);
else if(!source.includes("Page.captureScreenshot"))throw Error('Face browser capture patch anchor missing');
writeFileSync(path,source,'utf8');
console.log(JSON.stringify({applied:true,captureMethod:'cdp-Page.captureScreenshot'}));
