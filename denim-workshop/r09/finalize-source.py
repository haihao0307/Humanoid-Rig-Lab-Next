"""Idempotent UI truth correction after the source transfer, before building."""
from pathlib import Path
p=Path(__file__).resolve().parent/'template.html'
s=p.read_text()
a='节能档降低内部像素数，并将摆动阴影更新限制到 10 Hz。物理代理独立运行，不随画质档关闭。旧解析摆动另列作对照。'
b='节能档降低内部像素数；旧解析摆动的阴影限频 10 Hz，XPBD 的动态阴影跟随物理快照。物理子步独立运行，不随画质档关闭。'
assert s.count(a)==1 or s.count(b)==1
if a in s:p.write_text(s.replace(a,b))
