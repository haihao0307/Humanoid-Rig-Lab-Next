from pathlib import Path
R=Path(__file__).resolve().parents[1]
def change(path,old,new):
 p=R/path;s=p.read_text()
 if new in s:return
 assert old in s and s.count(old)==1,(path,'source drift: stop')
 p.write_text(s.replace(old,new))
# Account for width, height AND depth at the chosen orbit angle. A radius-only
# formula can crop an angled belt even when DOM horizontal overflow is zero.
old=' const h=Math.max(150,radius*1.75);'
new=''' if(id!=='macro'){
  const zAxis=V(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  const xAxis=V().crossVectors(V(0,1,0),zAxis).normalize(),yAxis=V().crossVectors(zAxis,xAxis);
  const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2)),margin=.86;let required=25;
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){
   const q=V(x,y,z).sub(target),along=q.dot(zAxis);
   required=Math.max(required,along+Math.abs(q.dot(xAxis))/(tangent*aspect*margin),along+Math.abs(q.dot(yAxis))/(tangent*margin));
  }
  distance=required;
 }
 const h=Math.max(150,radius*1.75);'''
change('site/runtime.js',old,new)
assert "if(ready&&mode!=='baseline')setView(view)" in (R/'site/runtime.js').read_text(),'R06 resize prerequisite missing'
assert 'frameAudit' in (R/'qa.py').read_text(),'Projected-bounds regression prerequisite missing'
print('R06 full-view distance now fits all eight world-space bounds corners with a 14% projection margin. Macro zoom remains intentional.')
