"""Small invariant pass after apply-user-recipe.py.

Kept separate so the generated-source workflow can fail loudly if any legacy
adapter still routes its default/studio state to the old reference preset.
"""
from pathlib import Path

root = Path(__file__).resolve().parent
path = root / "prepare.py"
text = path.read_text()
text = text.replace(
    "['reference','rake','reference','neutral','reference']",
    "['custom','rake','custom','neutral','custom']",
)
text = text.replace(
    "os.environ.get('GITHUB_SHA','LOCAL')",
    "os.environ.get('EB1_SOURCE_SHA',os.environ.get('GITHUB_SHA','LOCAL'))",
)
required = [
    "id===\\'studio\\'?\\'custom\\':id",
    "{studio:'custom',neutral:'neutral',raking:'rake'}",
    "['custom','rake','custom','neutral','custom']",
    "||'custom'",
    "'version':'EB1-1.1.0'",
    "USER_RECIPE_20261013.json",
]
forbidden = [
    "id===\\'studio\\'?\\'reference\\':id",
    "{studio:'reference',neutral:'neutral',raking:'rake'}",
    "['reference','rake','reference','neutral','reference']",
]
missing = [item for item in required if item not in text]
legacy = [item for item in forbidden if item in text]
if missing or legacy:
    raise RuntimeError(
        'EB1 adapter recipe invariants failed: missing=' + repr(missing)
        + ' legacy=' + repr(legacy)
    )
path.write_text(text)
print('EB1 adapter mappings and source metadata are pinned to the approved custom recipe.')
