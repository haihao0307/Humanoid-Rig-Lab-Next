'use strict';
// Same complete buffer and framebuffer assertions, at the retained fine setting.
const fs=require('fs'),Module=require('module'),path=require('path');let text=fs.readFileSync('tools/qa-field-pool-r27.cjs','utf8');
text=text.replace("out='qa/fidelity-r27/field-pool-browser.json'","out='qa/fidelity-r27/field-pool-fine-browser.json'").replace('request,quality=1','request,quality=2').replace('request,1,true','request,2,true');
const b="},{id:'B-pose',request:{rig:'B',set:{'pose.B.52':-.61,'pose.B.61':-.61,'pose.B.53':.93,'pose.B.62':.93},label:'Actual continuous B bend'}}";if(!text.includes(b))throw Error('Fine QA scenario source changed');text=text.replace(b,'}');
const file=path.resolve('tools/qa-field-pool-r27.cjs'),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(text,file);
