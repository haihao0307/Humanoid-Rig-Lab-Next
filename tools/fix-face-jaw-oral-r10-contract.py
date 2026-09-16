from pathlib import Path

path = Path('tools/check-face-anatomy.mjs')
text = path.read_text(encoding='utf-8')
old = "source.includes('compactLipOpen<.025')"
new = "source.includes('float oralOpening=max(compactLipOpen,compactJawOpen)')"
count = text.count(old)
if count != 1:
    raise SystemExit(f'R10 oral gate source contract anchor mismatch: {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
