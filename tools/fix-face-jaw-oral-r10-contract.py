from pathlib import Path

path = Path('tools/check-face-anatomy.mjs')
text = path.read_text(encoding='utf-8')
replacements = {
    "source.includes('compactLipOpen<.025')": "source.includes('float oralOpening=max(compactLipOpen,compactJawOpen)')",
    "renderer.includes('mouth?10:0')": "renderer.includes('mouth?10:upperTeeth?11:lowerTeeth?12:upperGum?13:lowerGum?14:tongue?15:0')",
}
for old, new in replacements.items():
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'R10 source contract anchor mismatch: {old!r}, count={count}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8', newline='\n')
