/** Run inherited six craft cases unchanged against the new kernel. */
const fs=require('node:fs'),path=require('node:path');const source=fs.readFileSync(path.join(__dirname,'../r09/qa-crafts.cjs'),'utf8').replaceAll('R09.1','R10.0');module._compile(source,__filename);
