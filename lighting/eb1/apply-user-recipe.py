"""Apply the user-approved EB1 recipe to the shared core and every generated adapter.

This is intentionally idempotent. It changes only EB1 configuration, tests and
release metadata; native geometry, materials and physics remain outside scope.
"""
from __future__ import annotations

from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent
RECIPE_PATH = ROOT / "USER_RECIPE_20261013.json"
RECIPE = json.loads(RECIPE_PATH.read_text())
STORAGE_KEY = "kaopu:lighting:eb1:v1:user-20261013-r1"
VERSION = "EB1-1.1.0"

EXPECTED_KEYS = {
    "schema", "preset", "exposure", "key", "rim", "environment",
    "keyAzimuth", "keyElevation", "rimAzimuth", "rimElevation",
    "environmentRotation", "keyColor", "rimColor", "background",
    "shadowSize",
}
assert set(RECIPE) == EXPECTED_KEYS
assert RECIPE == {
    "schema": "kaopu.eb1/1",
    "preset": "custom",
    "exposure": 0.7,
    "key": 1.6,
    "rim": 3.5,
    "environment": 0.9,
    "keyAzimuth": -154,
    "keyElevation": 8,
    "rimAzimuth": 71,
    "rimElevation": 11.309932,
    "environmentRotation": -69,
    "keyColor": "#ffffff",
    "rimColor": "#efa37e",
    "background": 0.85,
    "shadowSize": 2048,
}


def write(path: Path, text: str) -> None:
    old = path.read_text()
    if old != text:
        path.write_text(text)


def regex_one(text: str, pattern: str, replacement: str, label: str) -> str:
    result, count = re.subn(pattern, replacement, text, count=1)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, got {count}")
    return result


def replace_once_or_present(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one old anchor, got {count}")
    return text.replace(old, new, 1)


# Shared JavaScript core. A new storage namespace performs a one-time migration:
# old saved values are ignored, while subsequent edits to this recipe persist.
core_path = ROOT / "eb1.js"
core = core_path.read_text()
core = regex_one(
    core,
    r"const VERSION='EB1-[^']+', SCHEMA='kaopu\.eb1/1', KEY='[^']+';",
    f"const VERSION='{VERSION}', SCHEMA='kaopu.eb1/1', KEY='{STORAGE_KEY}';",
    "core version/storage namespace",
)
core = regex_one(
    core,
    r"const DEFAULT=Object\.freeze\(\{[^\n]+\}\);",
    "const DEFAULT=Object.freeze({schema:SCHEMA,preset:'custom',exposure:.7,key:1.6,rim:3.5,environment:.9,keyAzimuth:-154,keyElevation:8,rimAzimuth:71,rimElevation:11.309932,environmentRotation:-69,keyColor:'#ffffff',rimColor:'#efa37e',background:.85,shadowSize:2048});",
    "core default recipe",
)
core = regex_one(
    core,
    r"const PRESETS=\{[^\n]+\};",
    "const PRESETS={custom:{},reference:{exposure:1,key:3,rim:3.5,environment:.8,keyAzimuth:45,keyElevation:41.472934,rimAzimuth:180,rimElevation:11.309932,environmentRotation:100,keyColor:'#ffffff',rimColor:'#efa37e',background:.05,shadowSize:2048},neutral:{key:2.4,rim:.8,environment:.65,keyColor:'#ffffff',rimColor:'#ffffff'},rake:{key:3.2,rim:.45,environment:.22,keyAzimuth:-75,keyElevation:12,rimColor:'#ffffff'}};",
    "core presets",
)
core = replace_once_or_present(
    core,
    '<button data-preset="reference">参考布光</button>',
    '<button data-preset="custom">当前统一配方</button>',
    "core UI custom button",
)
write(core_path, core)


# Every native adapter must map its former studio/default selector back to the
# approved custom recipe, not merely share the same numeric values accidentally.
prepare_path = ROOT / "prepare.py"
prepare = prepare_path.read_text()
prepare = replace_once_or_present(
    prepare,
    "for name in ['README.md','THIRD_PARTY_NOTICES.md']:shutil.copyfile(ROOT/name,OUT/name)",
    "for name in ['README.md','THIRD_PARTY_NOTICES.md']:shutil.copyfile(ROOT/name,OUT/name)\nshutil.copyfile(ROOT/'USER_RECIPE_20261013.json',OUT/'USER_RECIPE_20261013.json')",
    "copy public recipe",
)
prepare = prepare.replace("id==='studio'?'reference':id", "id==='studio'?'custom':id")
prepare = prepare.replace("{studio:'reference',neutral:'neutral',raking:'rake'}", "{studio:'custom',neutral:'neutral',raking:'rake'}")
prepare = prepare.replace("[\'reference\',\'rake\',\'reference\',\'neutral\',\'reference\']", "['custom','rake','custom','neutral','custom']")
prepare = prepare.replace("||'reference'", "||'custom'")
prepare = replace_once_or_present(
    prepare,
    "{'version':'EB1-1.0.0','coreSHA256':CORE_SHA,",
    "{'version':'EB1-1.1.0','coreSHA256':CORE_SHA,'defaultRecipe':json.loads((ROOT/'USER_RECIPE_20261013.json').read_text()),'storageNamespace':'kaopu:lighting:eb1:v1:user-20261013-r1',",
    "manifest version and recipe",
)
write(prepare_path, prepare)


# Unit tests now lock the exact approved JSON while retaining old reference as an
# explicit optional preset rather than a default.
expected_js = json.dumps(RECIPE, separators=(",", ":"), ensure_ascii=False)
test_core = f"""const assert=require('node:assert/strict');require('./eb1.js');const E=globalThis.KAOPU_EB1;let checks=0;
const expected={expected_js};
const test=(name,fn)=>{{fn();checks++;console.log('PASS',name)}};
test('version and custom preset locked',()=>{{assert.equal(E.VERSION,'{VERSION}');assert.equal(E.DEFAULT.preset,'custom');}});
test('user-approved recipe locked',()=>assert.deepEqual(E.DEFAULT,expected));
for(const p of [{{x:1}},{{exposure:NaN}},{{key:-1}},{{rim:Infinity}},{{shadowSize:1536}},{{schema:'wrong'}},{{environment:5}},{{keyColor:'url(x)'}}])test('reject '+JSON.stringify(p),()=>assert.throws(()=>E.validate(p)));
test('strict immutable recipe',()=>{{assert.equal(Object.isFrozen(E.validate({{key:2}})),true);assert.equal(E.DEFAULT.key,1.6);}});
test('unit direction for approved key',()=>{{const d=E.direction(expected.keyAzimuth,expected.keyElevation);assert(Math.abs(Math.hypot(...d)-1)<1e-12);assert(d[0]<0&&d[1]>0&&d[2]<0);}});
test('sRGB conversion',()=>{{assert.deepEqual(E.linearColor('#ffffff'),[1,1,1]);assert.deepEqual(E.linearColor('#000000'),[0,0,0]);}});
test('positive bounded deterministic original HDR',()=>{{const f=E.studioField(),g=E.studioField();assert.equal(f.data.length,256*128*4);assert.deepEqual(f.data,g.data);assert.equal(f.bins.length,8);f.bins.forEach(b=>{{assert(b.color.every(x=>x>=0&&Number.isFinite(x)));assert(Math.abs(Math.hypot(...b.direction)-1)<1e-6)}});}});
test('no light energy with independent switches off',()=>{{const p=E.sampleProfile({{...E.DEFAULT,key:0,rim:0,environment:0}});assert.deepEqual(p.keyColor,[0,0,0]);assert.deepEqual(p.rimColor,[0,0,0]);assert(p.environment.every(x=>x.color.every(v=>v===0)));}});
test('background cannot affect lighting',()=>{{assert.deepEqual(E.sampleProfile(E.DEFAULT),E.sampleProfile({{...E.DEFAULT,background:1}}));}});
test('custom preset resets exact recipe',()=>{{const s=E.createStore({{persist:false,broadcast:false}});s.patch({{exposure:1.2,key:4}});s.preset('custom');assert.deepEqual(s.get(),expected);s.dispose();}});
test('legacy reference remains explicit only',()=>{{const s=E.createStore({{persist:false,broadcast:false}});s.preset('reference');assert.equal(s.get().preset,'reference');assert.equal(s.get().exposure,1);assert.equal(s.get().key,3);assert.equal(s.get().background,.05);s.dispose();}});
test('state survives import and invalid input is atomic',()=>{{const s=E.createStore({{persist:false,broadcast:false}});s.patch({{exposure:.8}});const before=s.get();assert.throws(()=>s.patch({{key:9}}));assert.equal(s.get(),before);s.import(expected);assert.deepEqual(s.get(),expected);s.dispose();assert.throws(()=>s.patch({{key:1}}));}});
console.log(JSON.stringify({{passed:true,checks,version:E.VERSION,defaultRecipe:expected}}));
"""
write(ROOT / "test-core.cjs", test_core)


# Browser QA verifies the exact fresh profile. The old storage namespace is
# deliberately pre-seeded so the test proves it cannot override the new default.
qa_path = ROOT / "qa.py"
qa = qa_path.read_text()
qa = replace_once_or_present(
    qa,
    "ROOT=pathlib.Path(__file__).resolve().parent;DEST=ROOT/'qa';DEST.mkdir(exist_ok=True)",
    "ROOT=pathlib.Path(__file__).resolve().parent;DEST=ROOT/'qa';DEST.mkdir(exist_ok=True);USER_RECIPE=json.loads((ROOT/'USER_RECIPE_20261013.json').read_text());LEGACY_RECIPE={'schema':'kaopu.eb1/1','preset':'reference','exposure':1,'key':3,'rim':3.5,'environment':.8,'keyAzimuth':45,'keyElevation':41.472934,'rimAzimuth':180,'rimElevation':11.309932,'environmentRotation':100,'keyColor':'#ffffff','rimColor':'#efa37e','background':.05,'shadowSize':2048}",
    "qa recipe constants",
)
qa = qa.replace("'version':'EB1-1.0.0'", "'version':'EB1-1.1.0'")
qa = replace_once_or_present(
    qa,
    "ctx=browser.new_context(viewport={'width':1360,'height':900},device_scale_factor=1,ignore_https_errors=False);page=ctx.new_page();errors=[];shader=[];failed=[]",
    "ctx=browser.new_context(viewport={'width':1360,'height':900},device_scale_factor=1,ignore_https_errors=False);ctx.add_init_script(\"try{localStorage.setItem('kaopu:lighting:eb1:v1',JSON.stringify(\"+json.dumps(LEGACY_RECIPE,separators=(',',':'))+\"));}catch(e){}\");page=ctx.new_page();errors=[];shader=[];failed=[]",
    "qa legacy cache seed",
)
qa = replace_once_or_present(
    qa,
    "row['initialLighting']=page.evaluate('__EB1__.audit()');row['native']=page.evaluate(audit[name]);assert row['initialLighting']['profile']['exposure']==1,'unexpected persisted default in fresh browser'",
    "row['initialLighting']=page.evaluate('__EB1__.audit()');row['native']=page.evaluate(audit[name]);assert row['initialLighting']['profile']==USER_RECIPE,'fresh workbench did not use the approved recipe';row['userRecipeVerified']=True",
    "qa exact recipe assertion",
)
write(qa_path, qa)


section = "\n\n## User-approved default recipe — 2026-10-13\n\nAll EB1 workbenches open with the following profile. The storage namespace was advanced once so an older saved EB1 profile cannot silently override it. Later user adjustments continue to persist under the new namespace.\n\n```json\n" + json.dumps(RECIPE, ensure_ascii=False, indent=2) + "\n```\n"
for name in ["README.md", "POLICY.md"]:
    path = ROOT / name
    text = path.read_text()
    if "## User-approved default recipe — 2026-10-13" not in text:
        write(path, text.rstrip() + section)

print(json.dumps({
    "applied": True,
    "version": VERSION,
    "storageNamespace": STORAGE_KEY,
    "recipe": RECIPE,
}, ensure_ascii=False, indent=2))
