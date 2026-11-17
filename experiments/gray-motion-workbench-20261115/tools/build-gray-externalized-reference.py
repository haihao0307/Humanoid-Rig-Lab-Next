"""Externalize the unchanged reference page's embedded non-image assets.

All records remain available and retain their bytes, MIME and compression;
the browser reads them lazily from content-addressed local files and verifies
each payload. This is an isolated gray-display research dependency, not an
engine format or a replacement for the original character functions.
"""
from pathlib import Path
import base64, hashlib, json, mmap

work=Path('G:/Three.js/Human/Human-Motion-Continuity-R07-20261106')
source=work/'.runtime/gray-without-skin-graph-research-20261115.html'
target=work/'.runtime/gray-externalized-reference-research-20261115.html'
folder=work/'.runtime/gray-reference-assets';folder.mkdir(parents=True,exist_ok=True)
manifest={};source_records=0;inline_images=0;original_encoded=0
def externalize(entries):
 global source_records,inline_images,original_encoded
 result={}
 for url,record in entries.items():
  source_records+=1;item=dict(record);data=item.get('data')
  if not isinstance(data,str):raise ValueError('missing original data '+url)
  original_encoded+=len(data)
  if str(item.get('mime','')).startswith('image/'):
   inline_images+=1;result[url]=item;continue
  payload=base64.b64decode(data,validate=True);sha=hashlib.sha256(payload).hexdigest();path=folder/(sha+'.bin')
  if path.exists():
   with path.open('rb') as f:
    if hashlib.sha256(f.read()).hexdigest()!=sha:raise ValueError('existing local reference asset corrupt '+sha)
  else:path.write_bytes(payload)
  item.pop('data');item['path']='/offline-asset/'+sha;item['payloadSHA256']=sha;result[url]=item
  previous=manifest.get(sha)
  if previous and (previous['bytes']!=len(payload) or previous['mime']!=item.get('mime')):raise ValueError('asset metadata collision '+sha)
  if not previous:manifest[sha]={'bytes':len(payload),'mime':item.get('mime','application/octet-stream'),'urls':[]}
  manifest[sha]['urls'].append(url)
 return result

with source.open('rb') as f:
 m=mmap.mmap(f.fileno(),0,access=mmap.ACCESS_READ)
 first=m.find(b'window.__SKIN_OFFLINE__=')+len(b'window.__SKIN_OFFLINE__=');end=m.find(b';/* Complete byte-preserving resource transport',first);assert first>0 and end>first
 config=json.loads(m[first:end]);config['entries']=externalize(config['entries'])
 body=m.find(b'<script data-body-r01-source="data/BodyFieldPackR01.js">');start=m.find(b'const entries=',body)+len(b'const entries=');stop=m.find(b';if(!window.__SKIN_OFFLINE__?.entries)',start);assert body>=0 and start>body and stop>start
 body_entries=externalize(json.loads(m[start:stop]))
 old=b'const binary=atob(record.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));'
 idx=m.find(old);assert idx>=0 and m.find(old,idx+1)<0
 replacement=b"""const bytes=record.path?await(async()=>{const r=await nativeFetch(record.path);if(!r.ok)throw Error('Local reference asset unavailable: '+record.path);const data=await r.arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');if(hash!==record.payloadSHA256)throw Error('Local reference asset identity mismatch: '+record.path);return new Uint8Array(data);})():Uint8Array.from(atob(record.data),c=>c.charCodeAt(0));"""
 edits=[(first,end,json.dumps(config,separators=(',',':'),ensure_ascii=True).encode()),(idx,idx+len(old),replacement),(start,stop,json.dumps(body_entries,separators=(',',':'),ensure_ascii=True).encode())];edits.sort();cursor=0
 with target.open('wb') as out:
  for lo,hi,data in edits:
   assert lo>=cursor
   for p in range(cursor,lo,1024*1024):out.write(m[p:min(p+1024*1024,lo)])
   out.write(data);cursor=hi
  for p in range(cursor,len(m),1024*1024):out.write(m[p:min(p+1024*1024,len(m))])
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
meta={'schema':'gray-externalized-reference-build/1','sourceSHA256':sha(source),'outputSHA256':sha(target),'sourceBytes':source.stat().st_size,'outputBytes':target.stat().st_size,'sourceRecordCount':source_records,'inlineImageCount':inline_images,'externalPayloadCount':len(manifest),'originalEncodedBytes':original_encoded,'externalPayloadBytes':sum(x['bytes'] for x in manifest.values()),'allRecordsRetained':True,'skinGraphOmitted':True,'skinMaterialSupported':False,'sourceDerived':True,'releaseReady':False,'assets':manifest}
(work/'.runtime/gray-reference-assets-manifest-20261115.json').write_text(json.dumps(meta,indent=2,ensure_ascii=True)+'\n',encoding='utf8')
summary={k:v for k,v in meta.items() if k!='assets'}
(work/'review/gray-externalized-reference-build-20261115.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf8')
print(json.dumps(summary))
