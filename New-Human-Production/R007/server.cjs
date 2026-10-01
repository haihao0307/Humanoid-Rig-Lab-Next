const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;
const allowIntake=process.env.R007_INTAKE==='1',port=Number(process.env.R007_PORT||8877);
const publicFiles=new Set(['/index.html','/app.mjs','/SubjectRuntime.mjs','/surface-generator.mjs','/parameter-codec.mjs','/parameters.phf.gz','/vendor/earcut.js']);
http.createServer((req,res)=>{
 let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(req.method==='GET'&&p==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({subject:'new-human-r007',mode:allowIntake?'intake':'preview',pid:process.pid}));}
 if(allowIntake&&req.method==='POST'&&p==='/capture') {let chunks=[];req.on('data',x=>chunks.push(x));req.on('end',()=>{fs.writeFileSync(path.join(root,'qa','capture.json'),Buffer.concat(chunks));res.end('ok')});return;}
 if(p==='/favicon.ico'){res.writeHead(204);return res.end();}
 if(!allowIntake&&!publicFiles.has(p==='/'?'/index.html':p)){res.writeHead(404);return res.end('Not in runtime package');}
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
 const ext=path.extname(file).toLowerCase();res.setHeader('Content-Type',({'.html':'text/html;charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.jpeg':'image/jpeg','.png':'image/png'})[ext]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log(`R007 workbench http://127.0.0.1:${port}/ (pid ${process.pid})`));
