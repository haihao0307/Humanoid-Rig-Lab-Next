/** Compiler-bound cross-module inventory. No regex approximations of JS scope. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require(process.env.TYPESCRIPT_PATH||'typescript');
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const hostNames=new Set(('Array ArrayBuffer BigInt Boolean DataView Date Error EvalError Float32Array Float64Array Function Infinity Int8Array Int16Array Int32Array JSON Map Math NaN Number Object Promise Proxy RangeError ReferenceError Reflect RegExp Set String Symbol SyntaxError TypeError Uint8Array Uint8ClampedArray Uint16Array Uint32Array URIError WeakMap WeakSet WebAssembly arguments undefined isFinite isNaN parseFloat parseInt console performance atob btoa setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame window document self globalThis navigator location URL Blob Image Event CustomEvent ResizeObserver Worker DecompressionStream Response TextDecoder TextEncoder AbortController AbortSignal fetch devicePixelRatio innerWidth innerHeight getSelection addEventListener postMessage localStorage indexedDB createImageBitmap OffscreenCanvas DOMException queueMicrotask PointerEvent').split(' '));
const result={schema:'kaopu/leather-dependency-review@1',parser:'TypeScript '+ts.version,programs:{},unknown:[]};
for(const [world,doc] of Object.entries(input)){
 const name='/virtual/'+world+'.js',sf=ts.createSourceFile(name,doc.code,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
 assert.equal(sf.parseDiagnostics.length,0,'Parse error '+world);
 const options={allowJs:true,checkJs:true,noLib:true,noResolve:true,target:ts.ScriptTarget.ES2022};
 const host={getSourceFile:f=>f===name?sf:undefined,getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=>'/virtual',getDirectories:()=>[],fileExists:f=>f===name,readFile:f=>f===name?doc.code:undefined,getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
 const program=ts.createProgram([name],options,host),checker=program.getTypeChecker();
 const owner=p=>doc.ranges.find(r=>p>=r.start&&p<r.end)?.id||'assembly';
 const edges=new Set(),caps=new Set(),unknown=new Set(),mutations=new Set();
 function isName(n){const p=n.parent;if(!p)return false;
  if(ts.isPropertyAccessExpression(p)&&p.name===n)return true;
  if((ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isPropertyDeclaration(p)||ts.isGetAccessor(p)||ts.isSetAccessor(p))&&p.name===n&&!p.name.computed)return true;
  if((ts.isVariableDeclaration(p)||ts.isParameter(p)||ts.isFunctionDeclaration(p)||ts.isFunctionExpression(p)||ts.isClassDeclaration(p)||ts.isClassExpression(p)||ts.isBindingElement(p))&&p.name===n)return true;
  if(ts.isBindingElement(p)&&p.propertyName===n)return true;
  if(ts.isLabeledStatement(p)||ts.isBreakStatement(p)||ts.isContinueStatement(p))return true;
  return false;
 }
 function visit(n){
  if(ts.isIdentifier(n)&&!isName(n)){
   const consumer=owner(n.getStart(sf)),p=n.parent;
   let symbol=ts.isShorthandPropertyAssignment(p)?checker.getShorthandAssignmentValueSymbol(p):checker.getSymbolAtLocation(n);
   const declarations=symbol?.declarations||[];
   if(declarations.length){for(const d of declarations){const provider=owner(d.getStart(sf));if(provider!==consumer)edges.add(consumer+' -> '+provider+' : '+n.text);}}
   else if(hostNames.has(n.text))caps.add(consumer+' : '+n.text);else unknown.add(consumer+' : '+n.text);
  }
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind===ts.SyntaxKind.EqualsToken&&ts.isPropertyAccessExpression(n.left)&&n.left.getText(sf).includes('.prototype.'))mutations.add(owner(n.getStart(sf))+' : '+n.left.getText(sf));
  ts.forEachChild(n,visit);
 }
 visit(sf);
 result.programs[world]={modules:[...new Set(doc.ranges.map(r=>r.id))].sort(),bindings:[...edges].sort(),hostCapabilities:[...caps].sort(),prototypeAssignments:[...mutations].sort(),unresolved:[...unknown].sort()};
 for(const u of unknown)result.unknown.push(world+' / '+u);
}
result.pass=result.unknown.length===0;
fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,unknown:result.unknown,programs:Object.fromEntries(Object.entries(result.programs).map(([k,v])=>[k,{bindings:v.bindings.length,capabilities:v.hostCapabilities.length,prototypeAssignments:v.prototypeAssignments}]))}));
if(!result.pass)process.exitCode=1;
