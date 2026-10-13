"""One-time, hash-locked R12.1 -> R13 materialization.
The capsule contains project-authored edits. CI writes and commits all readable
canonical sources before public QA. Never overwrite changed canonical source.
"""
from pathlib import Path
import base64,gzip,hashlib,json
P=Path(__file__).resolve().parent;B=P.parent/'r12-1'
PAYLOAD=''.join((P/n).read_text().strip() for n in ['payload-0.b64','payload-1.b64']+[f'piece-{i}.b64' for i in range(8)])
def main():
    lock=json.loads((P/'SOURCE_LOCK.json').read_text())
    assert hashlib.sha256((B/'index.html').read_bytes()).hexdigest()==lock['parentHtmlSha256']
    edits=json.loads(gzip.decompress(base64.b64decode(PAYLOAD)))
    for name,e in edits.items():
        assert '/' not in name and '..' not in name
        if 'text' in e:s=e['text']
        else:
            s=(B/name).read_text();assert hashlib.sha256(s.encode()).hexdigest()==e['parentSha256'],name
            for a,b,v in reversed(e['edits']):s=s[:a]+v+s[b:]
        assert hashlib.sha256(s.encode()).hexdigest()==lock['sourceHashes'][name],name
        f=P/name
        if f.exists():assert f.read_text()==s,(name,'Refuse to overwrite changed canonical source')
        else:f.write_text(s)
    print('All readable canonical R13 sources verified')
if __name__=='__main__':main()
