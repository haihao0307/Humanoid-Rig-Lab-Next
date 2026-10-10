from pathlib import Path
p=Path(__file__).resolve().parent
app=(p/'app.js').read_text()
# UI synchronization follows preset changes as well as checkbox clicks.
old="$('frayVal').textContent=state.fray.toFixed(1)+'×';}"
new="$('frayVal').textContent=state.fray.toFixed(1)+'×';$('seam').checked=state.seam;}"
if old in app: app=app.replace(old,new)
(p/'app.js').write_text(app)
t=(p/'template.html').read_text()
button='<button id="showFray" style="width:100%;margin-bottom:10px">查看本轮：线束与悬垂破口</button>'
if button in t:
 t=t.replace(button,'').replace('<button id="full">','<button id="showFray">破口与线束</button><button id="full">')
(p/'template.html').write_text(t)
