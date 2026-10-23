from PIL import Image
from collections import deque
import json
paths=['qa/final-implicit-r03/female-full.png','qa/final-implicit-r04/female-full.png']
results=[]
for path in paths:
    im=Image.open(path).convert('RGB'); w,h=im.size; p=im.load(); active=set()
    for y in range(100,min(h-70,940)):
        for x in range(120,min(w-70,990)):
            r,g,b=p[x,y]
            if r>82 and r>g*1.075 and r>b*1.12:
                active.add(y*w+x)
    components=[]
    while active:
        seed=active.pop(); queue=deque([seed]); count=0; lo=[w,h]; hi=[0,0]
        while queue:
            n=queue.popleft(); x=n%w; y=n//w; count+=1
            lo[0]=min(lo[0],x);lo[1]=min(lo[1],y);hi[0]=max(hi[0],x);hi[1]=max(hi[1],y)
            for dy in (-1,0,1):
                for dx in (-1,0,1):
                    q=(y+dy)*w+x+dx
                    if q in active: active.remove(q);queue.append(q)
        if count>=3: components.append({'pixels':count,'bounds':lo+hi})
    components.sort(key=lambda x:-x['pixels'])
    results.append({'file':path,'foregroundComponentsAtLeast3Pixels':len(components),'largest':components[:12],'metric':'skin-colour foreground connectivity in fixed comparison crop; not a full geometric topology test'})
with open('qa/floating-components.json','w',encoding='utf8') as f:json.dump(results,f,indent=2)
print(json.dumps(results))
