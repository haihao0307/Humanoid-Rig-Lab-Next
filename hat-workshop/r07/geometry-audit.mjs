/* Independent final-triangle checks, rather than trusting fit diagnostics. */
import fs from 'node:fs';import zlib from 'node:zlib';import {fileURLToPath} from 'node:url';
import {sectionProfile,sample} from './core.mjs';
import {cavityRadius,cavityRadiusReference} from './support.mjs';
const R=fileURLToPath(new URL('.',import.meta.url)),A=fileURLToPath(new URL('../r03/assets/',import.meta.url)),G=R+'qa/geometry-dump/';
const read=(f,T)=>{const b=fs.readFileSync(f);return new T(b.buffer,b.byteOffset,b.byteLength/T.BYTES_PER_ELEMENT)};
const dec=(s,T)=>{const b=zlib.gunzipSync(Buffer.from(s,'base64'));return new T(b.buffer,b.byteOffset,b.byteLength/T.BYTES_PER_ELEMENT)};
const records=[];
for(const head of ['native-default','long_narrow','short_broad']){
 const meta=JSON.parse(zlib.gunzipSync(fs.readFileSync(A+'head-'+head+'.bin'))),h=dec(meta.p,Float32Array),hi=dec(meta.i,Uint32Array);let ymax=-Infinity;for(let i=1;i<h.length;i+=3)ymax=Math.max(ymax,h[i]);const hp=sectionProfile(h,hi,{ymin:-.07,ymax,rows:112,angles:192});
 for(const hat of ['trilby','cloche','chef']){
  const prefix=G+head+'--'+hat+'--',p=read(prefix+'position.bin',Float32Array),ix=read(prefix+'index.bin',Uint32Array),b=read(prefix+'band-position.bin',Float32Array),bi=read(prefix+'band-index.bin',Uint32Array);
  let maxOutside=-Infinity,minHead=Infinity,finite=true,count=0;
  function probe(x,y,z){const center=sample(hp,y,0).center,a=Math.atan2(z-center[1],x-center[0]),r=Math.hypot(x-center[0],z-center[1]),cavity=cavityRadius(p,ix,y,center,a);finite&&=Number.isFinite(cavity);maxOutside=Math.max(maxOutside,r-cavity);minHead=Math.min(minHead,r-sample(hp,y,a).r);count++;}
  for(let i=0;i<b.length;i+=3)probe(b[i],b[i+1],b[i+2]);
  for(let i=0;i<bi.length;i+=3){const a=bi[i]*3,c=bi[i+1]*3,d=bi[i+2]*3;probe((b[a]+b[c]+b[d])/3,(b[a+1]+b[c+1]+b[d+1])/3,(b[a+2]+b[c+2]+b[d+2])/3);}
  let error=0;for(let k=0;k<7;k++){const y=b[1]+k*.0025,c=sample(hp,y,0).center;for(let j=0;j<17;j++){const a=j*2*Math.PI/17,v=cavityRadius(p,ix,y,c,a),ref=cavityRadiusReference(p,ix,y,c,a);if(Number.isFinite(v)&&Number.isFinite(ref))error=Math.max(error,Math.abs(v-ref));else if(v!==ref)error=Infinity;}}
  records.push({head,hat,samples:count,maximumOutsideCrownMM:maxOutside*1000,minimumRadialHeadGapMM:minHead*1000,cavityCacheVersusReferenceMaxErrorM:error,passed:finite&&maxOutside<-.0001&&minHead>-.0001&&error<1e-12});console.log(records.at(-1));
 }
}
const old=JSON.parse(fs.readFileSync(R+'../r06/qa/numeric/report.json')),now=JSON.parse(fs.readFileSync(R+'qa/numeric/report.json')),unchanged=[];
for(const n of now.records)if(n.fixture==='original'&&!['cable','flatcap','trilby','cloche','chef'].includes(n.hat)){const b=old.records.find(x=>x.head===n.head&&x.hat===n.hat&&x.fixture==='original');unchanged.push({hat:n.hat,head:n.head,positionsByteIdentical:b.outputHash===n.outputHash,bandByteIdentical:b.bandHash===n.bandHash});}
const report={method:'All final sweatband vertices and triangle centroids versus exact crown radial triangle cuts; independently recomputed head profile. Not a full continuous self-intersection proof.',records,unchanged,passed:records.every(r=>r.passed)&&unchanged.every(r=>r.positionsByteIdentical&&r.bandByteIdentical)};
fs.writeFileSync(R+'qa/numeric/GEOMETRY_AUDIT.json',JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;
