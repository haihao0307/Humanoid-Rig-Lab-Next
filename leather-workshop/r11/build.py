"""Scoped R11 rights-remediation linker; accepted R10 is a read-only input.

This is a newly authored packaging tool, not a claimed rewrite of Three.js or
of the preserved physics solver. No hidden network/source fallback is allowed.
"""
from __future__ import annotations
import argparse
import base64
import gzip
import hashlib
import html
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASELINE_SHA256 = '7da84eec41b6db9fe69c62ea17a3194283522004df92f47f0cd707d11b642622'
VERSION = 'R11.0-IP-CANDIDATE'
ARCHIVES = ('LEGACY_CRAFT_GZIP', 'BASELINE_GZIP')
# Exact source anchors, not copyright-removal or name-obfuscation rules.
OLD_HASH = 'float h(vec2 p){vec3 a=fract(vec3(p.xyx)*.1031+uSeed*.037);a+=dot(a,a.yzx+33.33);return fract((a.x+a.y)*a.z);}'
OLD_SINE = 'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*7.13)*43758.5453);}'
LOADER = "document.querySelector('#referenceDetails').addEventListener('toggle',e=>{if(e.target.open&&location.protocol!=='file:'&&!$('reference').src)$('reference').src=$('reference').dataset.src;});"

def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def constant_span(text: str, name: str) -> tuple[int, int, str]:
    matches = list(re.finditer(r'\bconst\s+' + re.escape(name) + r'\s*=', text))
    if len(matches) != 1:
        raise ValueError(f'Expected one immutable payload {name}, got {len(matches)}')
    start = matches[0].end()
    value, length = json.JSONDecoder().raw_decode(text[start:])
    if not isinstance(value, str):
        raise TypeError(f'{name} is not a string payload')
    return start, start + length, value

def payload(text: str, name: str) -> str:
    return constant_span(text, name)[2]

def replace_once(text: str, source: str, replacement: str) -> str:
    count = text.count(source)
    if count != 1:
        raise ValueError(f'Source anchor drift: count={count}, anchor={source[:100]!r}')
    return text.replace(source, replacement, 1)

def notice_html(boundary: dict, notices: dict[str, str], archive: bool) -> str:
    title = 'R11 兼容工艺页说明' if archive else 'R11 来源、许可与独立重写范围'
    note = ('这是 R11 修改后的兼容工艺页，不是未改动的历史原件。' if archive else '')
    note += '新随机场会改变程序化皮纹的具体排列；物理、几何与扫描贴图保留。第三方引擎仍依各自许可使用，不宣称整套系统完全独占原创。此候选尚未获得用户视觉验收和法律放行。'
    parts = [f'<details class="r11-rights"><summary>{title}</summary><p>{note}</p>']
    for name, text in notices.items():
        parts.append(f'<h4>{html.escape(name)}</h4><pre>{html.escape(text)}</pre>')
    parts.append('</details>')
    return ''.join(parts)

def rewrite_document(text: str, name: str, field: str, notices: dict[str, str], boundary: dict) -> tuple[str, dict]:
    before = text
    text = replace_once(text, OLD_HASH, field)
    sine = text.count(OLD_SINE)
    if name == 'LEGACY_CRAFT_GZIP':
        text = replace_once(text, OLD_SINE, field)
        image = re.compile(r'<img\b(?=[^>]*\bid="reference")[^>]*>')
        text, count = image.subn('<p class="note">参考图片不随本版展示；保留原文链接。</p>', text)
        if count != 1: raise ValueError('Expected one external reference image')
        text = replace_once(text, LOADER, '// External reference image loader removed in R11.')
        text = text.replace('按住查看 R01 粒面', '旧工艺曲面 / R11 随机场')
    elif sine:
        raise ValueError('Unexpected legacy seed function outside compatibility page')
    text = text.replace("rights:'Original code; no Adobe SBS/SBSAR or textures.'", "rights:'KAOPU R11 seed field; inherited and third-party portions retain their licenses.'")
    text = text.replace("algorithm:'multi-scale-irregular-grain-r02'", "algorithm:'multi-scale-irregular-grain-r02-with-kaopu-integer-field-r1'")
    # Append notices outside the computation script; do not mutate library code.
    style = '<style>.r11-rights{font:11px/1.6 system-ui;padding:10px;overflow-wrap:anywhere}.r11-rights pre{white-space:pre-wrap;font-size:10px}.r11-rights h4{margin:10px 0 4px}</style>'
    text = replace_once(text, '</head>', style + '</head>')
    if name == 'outer':
        text = replace_once(text, 'const VERSION=\'R10.0\'', 'const VERSION='+json.dumps(VERSION))
        text = text.replace('数字皮匠 R10.0', '数字皮匠 '+VERSION)
        parts = text.rsplit('</aside>', 1)
        if len(parts) != 2: raise ValueError('Current page sidebar is missing')
        text = parts[0] + notice_html(boundary, notices, False) + '</aside>' + parts[1]
    else:
        # In old templates the last aside is the control sidebar.
        split = text.rsplit('</aside>', 1)
        if len(split) != 2: raise ValueError('Compatibility page sidebar is missing')
        text = split[0] + notice_html(boundary, notices, True) + '</aside>' + split[1]
    return text, {'name': name, 'beforeSHA256': digest(before.encode()), 'afterSHA256': digest(text.encode()), 'replacedHashHelpers': 1+sine, 'referenceImageRemoved': name == 'LEGACY_CRAFT_GZIP'}

def build(baseline: Path, destination: Path) -> dict:
    raw = baseline.read_bytes()
    if digest(raw) != BASELINE_SHA256:
        raise ValueError('R10 input does not match the locked accepted review build')
    baseline_text = raw.decode('utf-8')
    field = (ROOT/'site/seed-field.glsl').read_text().strip()
    boundary = json.loads((ROOT/'RIGHTS_BOUNDARY.json').read_text())
    notices = {'KAOPU new R11 contributions': (ROOT/'OWNERSHIP_SCOPE.txt').read_text()}
    for part in boundary['components']:
        path = ROOT/part['notice']
        if not path.is_file() or path.stat().st_size < 120:
            raise ValueError('Missing complete component notice: '+part['id'])
        notices[part['id']+' / '+part['license']] = path.read_text()
    notices['Asset provenance'] = (ROOT/'licenses/ASSET-PROVENANCE.json').read_text()
    records=[]
    text=baseline_text
    for name in ARCHIVES:
        start,end,encoded=constant_span(text,name)
        decoded=gzip.decompress(base64.b64decode(encoded,validate=True)).decode('utf-8')
        rewritten,record=rewrite_document(decoded,name,field,notices,boundary)
        records.append(record)
        value=base64.b64encode(gzip.compress(rewritten.encode(),mtime=0)).decode()
        text=text[:start]+json.dumps(value)+text[end:]
    text,record=rewrite_document(text,'outer',field,notices,boundary);records.append(record)
    # Do not pass the inherited R10 source identity off as an R11 source commit.
    marker = 'const BUILD_INFO='
    start = text.index(marker) + len(marker)
    info, length = json.JSONDecoder().raw_decode(text[start:])
    info['inheritedSourceCommit'] = info.get('sourceCommit')
    info['sourceCommit'] = os.environ.get('R11_SOURCE_SHA', 'UNCOMMITTED-R11-CANDIDATE')
    info['version'] = VERSION
    info['seedField'] = 'kaopu-integer-field-r1'
    info['ownershipReview'] = 'candidate; not legal clearance or exclusive ownership certification'
    text = text[:start] + json.dumps(info,ensure_ascii=True) + text[start+length:]
    # Protect full computation payloads, not just config labels.
    immutable={}
    for name in ('PRODUCT_WORKER_CODE','WORKER_CODE'):
        a,b=payload(baseline_text,name),payload(text,name)
        if a!=b:raise AssertionError('Physics payload changed: '+name)
        immutable[name]=digest(a.encode())
    for key in ('scanData',):
        pattern=r'<div id="'+key+r'" hidden>(.*?)</div>'
        A=re.search(pattern,baseline_text,re.S);B=re.search(pattern,text,re.S)
        if not A or not B or A[1]!=B[1]:raise AssertionError('Protected scan payload changed')
        immutable[key]=digest(A[1].encode())
    if OLD_HASH in text or OLD_SINE in text:raise AssertionError('Old random helper remains')
    manifest={
        'version':VERSION,'sourceCommit':info['sourceCommit'],'inheritedSourceCommit':info['inheritedSourceCommit'],'baselineBuild':'af389cc216ddd01e3b1aa66c972f42b2587bc797',
        'baselineSHA256':BASELINE_SHA256,'baselinePreserved':digest(baseline.read_bytes())==BASELINE_SHA256,
        'immutablePayloads':immutable,'documents':records,'seedFieldSHA256':digest(field.encode()),
        'noticeSHA256':{k:digest(v.encode())for k,v in notices.items()},
        'componentBoundary':boundary,'randomTexturePixelIdentity':False,
        'userVisualAcceptance':'PENDING','commercialLegalClearance':False,
        'publicBrowserVerified':False,'promotionAllowed':False,
        'sourceHashes':{str(p.relative_to(ROOT)):digest(p.read_bytes())for p in sorted(ROOT.rglob('*'))if p.is_file() and 'qa' not in p.parts and p.suffix in ('.py','.glsl','.mjs','.json','.txt') and p.name not in ('BUILD_MANIFEST.json',)}
    }
    manifest['htmlSHA256']=digest(text.encode());manifest['htmlBytes']=len(text.encode())
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(text)
    (ROOT/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    # A report is not a release receipt. Never write DELIVERY.json here.
    return manifest

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--baseline',type=Path,default=ROOT.parent/'r10/public-lite.html')
    parser.add_argument('--output',type=Path,default=ROOT/'candidate.html')
    args=parser.parse_args()
    result=build(args.baseline,args.output)
    print(json.dumps({k:result[k]for k in ('version','htmlBytes','htmlSHA256','baselinePreserved','randomTexturePixelIdentity','promotionAllowed')},indent=2))
