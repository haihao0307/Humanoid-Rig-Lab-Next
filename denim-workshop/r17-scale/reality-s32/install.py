"""Copied into the selected source's reality-s32 directory. Never pushes Git or changes branches."""
from pathlib import Path
import argparse, hashlib, json, os, subprocess, tempfile

def digest(b): return hashlib.sha256(b).hexdigest()
def checked(root, name, expected):
    p=root/name
    if p.is_symlink(): raise RuntimeError('SYMLINK_REJECTED')
    data=p.read_bytes()
    if digest(data)!=expected: raise RuntimeError('INSTALL_RESOURCE_CHANGED:'+name)
    return data

def compose(root, lock):
    raw=checked(root,'renderer.html',lock['inputs']['renderer.html']).decode()
    adapter=checked(root,'adapter.js',lock['inputs']['adapter.js']).decode()
    mount=checked(root,'mount.js',lock['inputs']['mount.js']).decode()
    lineage=json.loads(checked(root,'lineage.json',lock['inputs']['lineage.json']))
    marker='window.DENIM_R17='
    if raw.count(marker)!=1 or '</script' in adapter.lower() or '</script' in mount.lower():raise RuntimeError('INSTALL_ANCHOR_CHANGED')
    addition='/*RF31_NATIVE_EXPORT_BEGIN*/\nwindow.__RF31_SOURCE__='+json.dumps(lineage)+';\n'+adapter+'\n/*RF31_NATIVE_EXPORT_END*/\n'
    result=raw.replace(marker,addition+marker)
    extra='<!--RF32_SOURCE_MOUNT_BEGIN--><script>\nconst RF32_CORE='+json.dumps(lock['core'],ensure_ascii=False)+';\n'+mount+'\n</script><!--RF32_SOURCE_MOUNT_END-->\n'
    if result.count('</body>')!=1:raise RuntimeError('BODY_ANCHOR_CHANGED')
    result=result.replace('</body>',extra+'</body>')
    if result.replace(extra,'').replace(addition,'')!=raw:raise RuntimeError('REVERSIBILITY_FAILED')
    return result.encode()

def apply(root, action):
    lock=json.loads((root/'INSTALL_LOCK.json').read_text())
    entry=root.parent/'preview-v3.html'
    if entry.is_symlink():raise RuntimeError('SYMLINK_REJECTED')
    # Even a manual execution must not install into the active production branch.
    git=subprocess.run(['git','branch','--show-current'],cwd=root,text=True,capture_output=True)
    if action in ['install','uninstall'] and git.returncode==0 and git.stdout.strip()==lock['core']['productionBranch']:raise RuntimeError('PRODUCTION_BRANCH_WRITE_FORBIDDEN')
    before=checked(root,'original-preview-v3.html',lock['originalEntrySHA256'])
    candidate=compose(root,lock)
    if digest(candidate)!=lock['installedHTMLSHA256']:raise RuntimeError('INSTALLED_OUTPUT_CHANGED')
    current=entry.read_bytes();h=digest(current)
    if h not in [lock['originalEntrySHA256'],lock['installedHTMLSHA256']]:raise RuntimeError('SOURCE_DRIFT_NO_OVERWRITE')
    target=candidate if action=='install' else before if action=='uninstall' else current
    if target!=current:
        with tempfile.NamedTemporaryFile(dir=entry.parent,prefix='.rf32-',delete=False) as tmp:
            tmp.write(target);temp=Path(tmp.name)
        if digest(entry.read_bytes())!=h:
            temp.unlink();raise RuntimeError('SOURCE_CHANGED_DURING_INSTALL')
        os.replace(temp,entry)
    return {'action':action,'changed':target!=current,'status':'SOURCE_TRIAL_INSTALLED' if digest(target)==lock['installedHTMLSHA256'] else 'ORIGINAL_ENTRY_RESTORED','entrySHA256':digest(target),'productionInstalled':False,'mergePerformed':False}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=['status','install','uninstall']);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parent)
    args=parser.parse_args()
    try: print(json.dumps(apply(args.root.resolve(),args.action),ensure_ascii=False,indent=2))
    except Exception as e: raise SystemExit(str(e))
