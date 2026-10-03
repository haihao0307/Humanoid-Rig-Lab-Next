import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {playwright} from './dependencies.mjs';
const browser=await playwright().chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:1680,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const images={},entries=[];
try{
 await page.goto(pathToFileURL(path.resolve('打开动物集成工作台.html')).href,{timeout:180000});await page.waitForFunction(()=>window.__ATLAS__?.ready,null,{timeout:180000});
 const catalog=await page.evaluate(()=>__ATLAS__.catalog);
 for(const a of catalog){
  await page.evaluate(id=>__ATLAS_BOOT__.select(id,{reset:true,initial:{studioRotate:false,playing:false}}),a.id);await page.waitForFunction(id=>__ATLAS__?.ready&&__ATLAS__.current===id,a.id,{timeout:180000});
  if(a.adapter==='palau')await page.evaluate(()=>__ATLAS__.set('view','side'));
  const elevation=a.adapter==='palau'?.20:0;
  const yaw=a.adapter==='palau'?-.25:['dog','shark','cat','chicken'].includes(a.id)?Math.PI:['crab','coconut'].includes(a.id)?Math.PI/3:0;
  if(yaw||elevation){const box=await page.locator('#stage').boundingBox(),x=box.x+box.width*.55,y=box.y+box.height*.5;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x-yaw/.006,y+elevation/.006,{steps:12});await page.mouse.up();}
  await page.waitForTimeout(100);images[a.id]=(await page.evaluate(()=>__ATLAS__.request('capture'))).image;entries.push({id:a.id,yaw,view:a.adapter==='palau'?'side':'three',source:'actual original 3D renderer'});console.log('THUMB',a.id);
 }
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync('qa/thumbnails.json',JSON.stringify(images));fs.writeFileSync('qa/THUMB_LEFT_REPORT.json',JSON.stringify({passed:true,entries,errors},null,2));
 await page.setContent('<body style="background:#111;color:#fff;font:14px Arial;display:grid;grid-template-columns:repeat(4,1fr);gap:8px">'+Object.entries(images).map(([id,src])=>'<div>'+id+'<img style="width:250px;display:block" src="'+src+'"></div>').join(''));await page.screenshot({path:'qa/THUMB_LEFT_SHEET.png',fullPage:true});
}finally{await browser.close();}
