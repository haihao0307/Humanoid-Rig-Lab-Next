from pathlib import Path
import re,subprocess
r=Path(__file__).resolve().parent
three=(r.parent/'r02/site/three.module.js').read_text();m=re.search(r'export\s*\{([^}]+)\}\s*;?\s*$',three)
pairs=[re.split(r'\s+as\s+',p.strip()) for p in m[1].split(',')]
code='const T=(()=>{'+three[:m.start()]+';return {'+','.join(a[-1]+':'+a[0] for a in pairs)+'};})();\n'
s=(r/'site/products.js').read_text();s=re.sub(r'^import[^\n]*\n','',s,flags=re.M);s=re.sub(r'\bexport (?=(?:class|const|function))','',s)
code+="global.document={createElement:()=>({width:512,height:160,getContext:()=>({clearRect(){},fillText(){}})})};\n"+s
code+='''
const records=[],assertions=[];
for(const id of Object.keys(PRODUCT_SPECS)){
 const mat=new T.MeshStandardMaterial(),root=makeProduct(id,productMaterials(mat));const audit=productAudit(root);const meshChecks=[];
 root.traverse(o=>{if(!o.userData.leather)return;const g=o.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index;let wrong=0,nonzero=0;const totals=g.index?g.index.count:p.count;for(let k=0;k<totals;k+=3){const ids=[0,1,2].map(i=>index?index.getX(k+i):k+i);const a=V().fromBufferAttribute(p,ids[0]),b=V().fromBufferAttribute(p,ids[1]),c=V().fromBufferAttribute(p,ids[2]);const face=b.sub(a).cross(c.sub(a));if(face.lengthSq()<1e-12)continue;nonzero++;const normal=V();for(const i of ids)normal.add(V().fromBufferAttribute(n,i));if(face.dot(normal)<-1e-8)wrong++;}meshChecks.push({name:o.name,wrong,nonzero});});
 records.push({id,audit,meshChecks});assertions.push({test:id+' finite geometry',pass:audit.finite});assertions.push({test:id+' surface winding matches normals',pass:meshChecks.every(m=>m.wrong===0)});
 if(['wallet','belt'].includes(id)){const svg=patternSVG(id);assertions.push({test:id+' metric SVG',pass:svg.includes('width=')&&svg.includes('100 mm calibration')&&svg.includes('circle')});}
}
console.log(JSON.stringify({records,assertions},null,2));if(assertions.some(x=>!x.pass))process.exitCode=1;
'''
p=r/'test-generated.cjs';p.write_text(code);result=subprocess.run(['node',str(p)],text=True,capture_output=True);p.unlink();(r/'qa-products.json').write_text(result.stdout);print(result.stdout,result.stderr);raise SystemExit(result.returncode)
