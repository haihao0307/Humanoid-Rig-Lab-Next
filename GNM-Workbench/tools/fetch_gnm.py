"""Fetch the explicitly requested official GNM source and model, not baked outputs."""
from pathlib import Path
import hashlib,json,urllib.request,time
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'runtime-cache'
def get(url):
    request=urllib.request.Request(url,headers={'User-Agent':'Human-GNM-Workbench'})
    return urllib.request.urlopen(request,timeout=90)
def main():
    CACHE.mkdir(parents=True,exist_ok=True)
    with get('https://api.github.com/repos/google/GNM/commits/main') as response:
        commit=json.load(response)['sha']
    with get(f'https://api.github.com/repos/google/GNM/git/trees/{commit}?recursive=1') as response:
        tree=json.load(response)['tree']
    names=[e['path'] for e in tree if e['type']=='blob' and ((e['path'].startswith('gnm/shape/') and (e['path'].endswith('.py') or e['path'].startswith('gnm/shape/data/landmarks/') or e['path'].endswith('README.md'))) or e['path'] in ['LICENSE','README.md','gnm/__init__.py'])]
    def fetch(name):
        destination=CACHE/'upstream'/name
        destination.parent.mkdir(parents=True,exist_ok=True)
        with get(f'https://raw.githubusercontent.com/google/GNM/{commit}/{name}') as response:
            data=response.read()
        destination.write_bytes(data)
        return name,hashlib.sha256(data).hexdigest()
    hashes=dict(ThreadPoolExecutor(6).map(fetch,names))
    print(json.dumps({'sourceCommit':commit,'sourceFiles':len(hashes)}),flush=True)
    model=CACHE/'gnm_head.npz'
    model_url='https://huggingface.co/google/gnm-v3/resolve/main/v3_0/gnm_head.npz'
    expected='61d78bbfb4ad8e0b38495804a4caef3214d3df00f8c3f68761e63b41ce3747eb'
    if not model.exists() or hashlib.sha256(model.read_bytes()).hexdigest()!=expected:
        part=model.with_suffix('.npz.download')
        with get(model_url) as response,part.open('wb') as output:
            total=int(response.headers.get('content-length',53328601));size=0;last=0
            while chunk:=response.read(1024*1024):
                output.write(chunk);size+=len(chunk)
                if time.monotonic()-last>2:
                    print(json.dumps({'downloadedBytes':size,'totalBytes':total}),flush=True);last=time.monotonic()
        if hashlib.sha256(part.read_bytes()).hexdigest()!=expected:raise RuntimeError('Official model checksum mismatch')
        part.replace(model)
    record={'schema':'human/gnm-source@1','source':'https://github.com/google/GNM','commit':commit,'files':hashes,'modelURL':model_url,'modelSHA256':expected,'modelBytes':model.stat().st_size,'cacheOnly':True,'authorization':'User requested GNM as replacement source on 2026-10-06; prior external-head restriction superseded for this source only.'}
    (ROOT/'source-provenance.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'modelReady':True,'bytes':model.stat().st_size,'sha256':expected}),flush=True)
if __name__=='__main__':main()
