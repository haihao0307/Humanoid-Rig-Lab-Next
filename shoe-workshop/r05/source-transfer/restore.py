"""Transport-only delta restoration. Actual readable production files are written and committed.
Every original input and reconstructed output is SHA256 checked. Never writes outside R05.
"""
from pathlib import Path
import base64, gzip, hashlib, json
root = Path(__file__).resolve().parents[1]
shoe = root.parent
sha = lambda b: hashlib.sha256(b).hexdigest()
encoded = (root/'source-transfer/delta.b64').read_text().strip()
corrections = root/'source-transfer/corrections.json'
if corrections.exists():
    c = json.loads(corrections.read_text())
    assert sha(encoded.encode()) == c['inputSHA256'], 'unexpected transport bytes'
    for start, end, text in sorted(c['edits'], reverse=True):
        encoded = encoded[:start] + text + encoded[end:]
blob = base64.b64decode(encoded, validate=True)
assert sha(blob) == '9c93f2152071b9924cc249d73c6c0f0df810f9883a5bde73de76599641dc3e8f', 'source transport integrity mismatch'
items = json.loads(gzip.decompress(blob))
receipts=[]
for item in items:
    target=(root/item['path']).resolve()
    assert target.is_relative_to(root) and target.suffix in ('.mjs','.js','.css'), 'invalid target'
    if 'base' in item:
        source=(shoe/item['base']).resolve()
        assert source.is_relative_to(shoe/'r04'), 'invalid donor source path'
        data=source.read_bytes()
        assert sha(data)==item['baseSHA256'], 'source base mismatch: '+item['base']
        text=data.decode()
        for start,end,replacement in reversed(item['edits']):
            assert 0<=start<=end<=len(text)
            text=text[:start]+replacement+text[end:]
    else:
        text=item['content']
    assert sha(text.encode())==item['sha256'], 'reconstructed source mismatch: '+item['path']
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(text)
    receipts.append({'path':item['path'],'sha256':item['sha256'],'source':item.get('base'),'sourceSHA256':item.get('baseSHA256')})
(root/'SOURCE_RECEIPT.json').write_text(json.dumps({'transportSHA256':sha(blob),'files':receipts},indent=2))
print('Restored and individually verified',len(receipts),'readable production files')
