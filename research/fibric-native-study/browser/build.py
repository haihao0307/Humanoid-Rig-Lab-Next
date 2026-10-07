"""Reproduce the browser source and single-file website with explicit integrity checks."""
import base64,gzip,hashlib,json,pathlib,sys
root=pathlib.Path('out');src=root/'source';src.mkdir(parents=True,exist_ok=True)
project=pathlib.Path('research/fibric-native-study')
if len(sys.argv)>1 and sys.argv[1]=='pack':
    h=(src/'index.html').read_text()
    for name in ['vendor.js','kernel.js','app.js']:
        h=h.replace('<script src="'+name+'"></script>','<script>'+(src/name).read_text().replace('</script','<\\/script')+'</script>')
    (root/'index.html').write_text(h)
    receipt={'schema':'kaopu/dense_yarn_browser_build@1','sourceCommit':__import__('os').environ.get('GITHUB_SHA'),'version':'YARN_ATELIER_R1','entrySha256':hashlib.sha256(h.encode()).hexdigest(),'entryBytes':len(h.encode()),'officialFibricReproduction':False,'visualAcceptance':False,'physicsSimulation':False,'sourceFiles':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in src.glob('*.js')}}
    (root/'BUILD_MANIFEST.json').write_text(json.dumps(receipt,indent=2))
    print(json.dumps(receipt))
else:
    p=json.loads((project/'browser/source-payload.json').read_text())
    for name,v in p['files'].items():
        assert name in ['app.js','index.html']
        text=v['gzipBase64']
        if name=='app.js':
            # Three ASCII transport errors in the initial API write. Repair only
            # the audited offsets and then require the ORIGINAL source SHA.
            for a,b,old,new in [(9836,9837,'e',''),(9823,9824,'l','v'),(9606,9607,'v','')]:
                assert text[a:b]==old
                text=text[:a]+new+text[b:]
        raw=gzip.decompress(base64.b64decode(text,validate=True))
        assert len(raw)==v['bytes'] and hashlib.sha256(raw).hexdigest()==v['sha256'],name
        (src/name).write_bytes(raw)
    base=project/'open-kernel'
    k=(base/'weave-draft-compiler.mjs').read_text().replace('export ','')
    f=(base/'herringbone-fixture.mjs').read_text();f=f[f.index('export function'):].replace('export ','')
    (src/'kernel.js').write_text('(function(){\n'+k+'\n'+f+'\nwindow.WeaveKernel={compileWeaveDraft,validateWeaveDraft,draftCell,makeHerringbone12x12Fixture,crossingSampleIndex,pointAt};\n})();\n')
    app=(src/'app.js').read_text()
    def replace(old,new):
        global app
        assert app.count(old)==1,(old,app.count(old))
        app=app.replace(old,new,1)
    replace('function generateGeometry(data){', 'function flipWinding(g){const a=g.index.array;for(let i=0;i<a.length;i+=3){const t=a[i+1];a[i+1]=a[i+2];a[i+2]=t;}g.computeVertexNormals();return g;}\nfunction generateGeometry(data){')
    replace('weft:builders.weft.geometry()', 'weft:flipWinding(builders.weft.geometry())')
    replace('fibers:{warp:fbuilders.warp.geometry(),weft:fbuilders.weft.geometry()}', 'fibers:{warp:flipWinding(fbuilders.warp.geometry()),weft:flipWinding(fbuilders.weft.geometry())}')
    replace('const start=bu.v,col=tint(c,s,variance),r=.0022;', 'const start=bu.v,col=tint(c,s,variance),r=.0022;')
    (src/'app.js').write_text(app)
    (root/'evidence').mkdir(exist_ok=True)
    print('Recovered and oriented browser source; no geometry or screenshots imported.')
