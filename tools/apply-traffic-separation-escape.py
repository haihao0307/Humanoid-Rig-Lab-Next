from pathlib import Path

path = Path('body/NaturalLocomotion.js')
text = path.read_text(encoding='utf-8')
old = "if(c<=0)return 0;if(a<1e-16)return 1;"
new = "if(c<=0)return p[0]*d[0]+p[2]*d[2]>1e-9?1:0;if(a<1e-16)return 1;"
if text.count(old) != 1:
    raise SystemExit('expected exactly one starting-overlap sweep rule')
path.write_text(text.replace(old, new), encoding='utf-8', newline='\n')
print('separating-motion sweep patch applied')
