const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),shorts=process.env.SHORTS_PREVIEW==='1',port=Number(process.env.LINEN_PORT||(shorts?8793:8792)),page=shorts?'/shorts.html':'/linen.html';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.gz':'application/octet-stream'};
http.createServer((req,res)=>{
 let file;try{const route=decodeURIComponent(new URL(req.url,'http://localhost').pathname);file=path.resolve(root,'.'+(route==='/'?page:route));}catch{res.writeHead(400);return res.end();}
 const relative=path.relative(root,file);if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))){res.writeHead(403);return res.end();}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');res.end(data);});
}).listen(port,'127.0.0.1',()=>console.log('Human garment workbench: http://127.0.0.1:'+port+page+(shorts?'?shorts=1':'?linen=1')));
