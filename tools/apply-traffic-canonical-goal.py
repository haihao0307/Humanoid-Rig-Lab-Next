from pathlib import Path

path = Path('body/NaturalLocomotion.js')
text = path.read_text(encoding='utf-8')
old = "if(population.collisionFor?.(a,point,context.radius))continue;"
new = "if((index>0||claims.size)&&population.collisionFor?.(a,point,context.radius))continue;"
if text.count(old) != 1:
    raise SystemExit('expected exactly one terminal dynamic-occupancy check')
path.write_text(text.replace(old, new), encoding='utf-8', newline='\n')
print('canonical unique-goal reservation patch applied')
