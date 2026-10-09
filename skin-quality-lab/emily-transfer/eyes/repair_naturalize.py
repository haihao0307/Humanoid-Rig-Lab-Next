from pathlib import Path

path = Path(__file__).with_name("naturalize.cjs")
text = path.read_text(encoding="utf-8")
lines = text.splitlines()
expected_prefix = "const code=bundled.replaceAll('../r01/'"
replacement = r"const code=bundled.replaceAll('../r01/',root+'r01/').replaceAll('../r02/',root+'r02/').replace(/<\/script/gi,'<\\/script');new vm.Script(code);"
found = False
for i, line in enumerate(lines):
    if line.startswith(expected_prefix):
        lines[i] = replacement
        found = True
        break
if not found:
    raise RuntimeError("naturalize portable-script line not found")
text = "\n".join(lines) + "\n"
text = text.replace(
    "float lowerWarm=smoothstep(.05,-.78,edge.y);",
    "float lowerWarm=1.-smoothstep(-.78,.05,edge.y);",
)
path.write_text(text, encoding="utf-8")
print("NATURALIZE_SOURCE_REPAIRED")
