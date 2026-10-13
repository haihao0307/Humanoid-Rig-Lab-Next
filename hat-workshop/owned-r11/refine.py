"""Small visual correction to newly authored field surface, not a screenshot edit."""
from pathlib import Path
R=Path(__file__).resolve().parent
p=R/'src/field.js';text=p.read_text()
old='Math.sin((v-.74)/.26*PI)*sm((v-.74)/.08);'
new='Math.sin((v-.74)/.26*PI)*sm((v-.74)/.08)*r*r;'
if old in text:
 assert text.count(old)==1
 p.write_text(text.replace(old,new))
else:assert new in text,'Field surface changed; reconcile before refining'
print('Crown-top wrinkle fades with squared polar radius; no artificial center star')
