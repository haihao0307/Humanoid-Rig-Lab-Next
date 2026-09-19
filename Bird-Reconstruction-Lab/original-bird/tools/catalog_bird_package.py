#!/usr/bin/env python3
from __future__ import annotations
import argparse, hashlib, json, tempfile, zipfile
from pathlib import Path

MODEL_EXT={'.glb','.gltf','.obj','.fbx','.ply','.stl'}
IMAGE_EXT={'.png','.jpg','.jpeg','.webp','.tif','.tiff','.exr'}
TEXT_EXT={'.json','.md','.txt','.csv','.yml','.yaml','.sha256'}

def sha256_path(path: Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024),b''): h.update(c)
    return h.hexdigest()

def classify(name:str)->str:
    p=Path(name); ext=p.suffix.lower(); low=name.lower()
    if ext in MODEL_EXT: return 'model'
    if ext in IMAGE_EXT: return 'image'
    if ext=='.zip': return 'nested-archive'
    if 'manifest' in low or ext=='.sha256': return 'manifest-or-hash'
    if ext in TEXT_EXT: return 'text-metadata'
    return 'other'

def catalog(path:Path)->dict:
    if path.suffix.lower()!='.zip': raise ValueError('Expected .zip')
    rows=[]; role_counts={}
    with zipfile.ZipFile(path,'r') as zf:
        bad=zf.testzip()
        for zi in zf.infolist():
            if zi.is_dir(): continue
            role=classify(zi.filename); role_counts[role]=role_counts.get(role,0)+1
            rows.append({
                'path':zi.filename,'bytes':zi.file_size,'compressedBytes':zi.compress_size,
                'crc32':f'{zi.CRC:08x}','extension':Path(zi.filename).suffix.lower(),'role':role
            })
    rows.sort(key=lambda r:r['path'].lower())
    return {
        'schema':'bird/original-package-catalog@0.0.1',
        'archive':{'filename':path.name,'bytes':path.stat().st_size,'sha256':sha256_path(path)},
        'zipIntegrity':{'testzipFirstBadMember':bad,'ok':bad is None},
        'entryCount':len(rows),'roleCounts':role_counts,'entries':rows,
        'truthBoundary':{
            'packageIdentityVerifiedBySha256':True,
            'containedModelAnatomyVerified':False,
            'taxonomyVerified':False,
            'visualAcceptance':False,
            'productionReady':False
        }
    }

def selftest():
    with tempfile.TemporaryDirectory() as td:
        root=Path(td); zp=root/'bird.zip'
        with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
            z.writestr('models/sparrow.glb',b'glTF'+b'\x00'*28)
            z.writestr('manifest.json','{"species":"Passer domesticus"}')
            z.writestr('images/ref.png',b'png')
        out=catalog(zp)
        assert out['zipIntegrity']['ok']
        assert out['entryCount']==3
        assert out['roleCounts']['model']==1
        assert out['roleCounts']['manifest-or-hash']==1
        assert len(out['archive']['sha256'])==64
    print('SELF_TEST_OK')

def main():
    ap=argparse.ArgumentParser(description='Catalog a recovered Bird ZIP without extracting or upgrading it to truth.')
    ap.add_argument('input',nargs='?'); ap.add_argument('-o','--output'); ap.add_argument('--self-test',action='store_true')
    a=ap.parse_args()
    if a.self_test: selftest(); return
    if not a.input: ap.error('input required unless --self-test')
    out=json.dumps(catalog(Path(a.input)),ensure_ascii=False,indent=2)+'\n'
    if a.output: Path(a.output).write_text(out,encoding='utf-8')
    else: print(out,end='')

if __name__=='__main__': main()
