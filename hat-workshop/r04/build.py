from pathlib import Path
import argparse,base64,gzip,json,hashlib,subprocess,copy,shutil
R=Path(__file__).resolve().parent;OLD=R.parent/'r03'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--data');a=p.parse_args();data=a.data or a.source
 assert sha(R.parent/'r02/index.html')=='9e11dfc07e8296ffe80afd7e78b710c074ae9cce285cb4d373f449d83e2b112b'
 m=json.loads((OLD/'ASSET_MANIFEST.json').read_text());m['version']='HAT-R04.0';m['sourceCommit']=a.source;m['dataCommit']=data;m['baseline']='d56bc8498a152ff501ffaf80ec80a109b2ec4865';m['rejectedFit']='f8c448c1392fd1d51ca1adc51dce819204ec0896'
 # Fixed existing assets are not duplicated into another branch package directory.
 base=f'https://raw.githubusercontent.com/haihao0307/Humanoid-Rig-Lab-Next/{data}/hat-workshop/r03/assets/'
 full=copy.deepcopy(m)
 for h in m['hats']+m['native']['heads']:h['packageURL']=base+h['packageFile']
 for h in full['hats']+full['native']['heads']:h.update(json.loads(gzip.decompress((OLD/'assets'/h['packageFile']).read_bytes())))
 subprocess.run(['node_modules/.bin/esbuild',str(R/'app.js'),'--bundle','--format=iife','--minify','--outfile='+str(R/'app.bundle.js')],check=True)
 app=(R/'app.bundle.js').read_text().replace('</script','<\\/script');shell=(R/'shell.html').read_text()
 for name,v in [('index.html',m),('standalone.html',full)]:
  payload=base64.b64encode(gzip.compress(json.dumps(v,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode();(R/name).write_text(shell.replace('<!--PAYLOAD-->',payload).replace('/*APP*/',app))
 shutil.copyfile(OLD/'THREE_LICENSE.txt',R/'THREE_LICENSE.txt')
 manifest={'version':m['version'],'sourceSha':a.source,'dataSha':data,'baselineSha':m['baseline'],'rejectedFitSha':m['rejectedFit'],'htmlSHA256':sha(R/'index.html'),'publicBytes':(R/'index.html').stat().st_size,'standaloneSHA256':sha(R/'standalone.html'),'standaloneBytes':(R/'standalone.html').stat().st_size,'sourceAssetsUnchanged':True,'R04UserAccepted':False,'dynamicSimulationImplemented':False,'materialCalibrated':False}
 (R/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print(json.dumps(manifest),flush=True)
