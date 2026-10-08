"""Read original Houdini study containers, without Houdini or execution.

Scope: old-ASCII CPIO .hip and INDX fallback-definition indexes observed in the
public Fibric Essentials package. This is a source-inspection tool, NOT Fibric.
Unknown formats, truncation, duplicate records and unsafe paths fail closed.
It never executes .hou.session, Python callbacks, HScript, VEX or asset code.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import posixpath
import re
import shlex
import struct
from collections import Counter
from pathlib import Path, PurePosixPath
from typing import Any


class InvalidSource(ValueError):
    pass


def safe_name(name: str) -> bool:
    p = PurePosixPath(name)
    return bool(name) and not p.is_absolute() and '..' not in p.parts and '\\' not in name


def cpio_records(data: bytes) -> dict[str, bytes]:
    result: dict[str, bytes] = {}
    cursor = 0
    while cursor < len(data):
        if data[cursor:cursor + 6] != b'070707':
            raise InvalidSource(f'Unsupported CPIO signature at byte {cursor}')
        h = data[cursor:cursor + 76]
        if len(h) != 76:
            raise InvalidSource('Truncated CPIO header')
        try:
            size_name, size_value = int(h[59:65], 8), int(h[65:76], 8)
        except ValueError as exc:
            raise InvalidSource('Invalid octal CPIO length') from exc
        if not 1 <= size_name <= 65536:
            raise InvalidSource('Invalid CPIO name length')
        begin = cursor + 76
        finish = begin + size_name
        if finish + size_value > len(data):
            raise InvalidSource('Truncated CPIO member')
        name_bytes = data[begin:finish]
        if not name_bytes.endswith(b'\0'):
            raise InvalidSource('Missing CPIO name terminator')
        name = name_bytes[:-1].decode('utf-8', 'strict')
        value = data[finish:finish + size_value]
        cursor = finish + size_value
        if name == 'TRAILER!!!':
            if size_value or data[cursor:].strip(b'\0'):
                raise InvalidSource('Unexpected data after CPIO trailer')
            return result
        if not safe_name(name) or name in result:
            raise InvalidSource(f'Unsafe or repeated CPIO member: {name!r}')
        result[name] = value
    raise InvalidSource('Missing CPIO trailer')


def index_records(data: bytes) -> dict[str, bytes]:
    if len(data) < 16 or data[:4] != b'INDX':
        raise InvalidSource('Unsupported INDX header')
    count = struct.unpack_from('>I', data, 12)[0]
    if count > 100000:
        raise InvalidSource('Excessive INDX directory size')
    cursor, directory = 16, []
    for _ in range(count):
        if cursor + 4 > len(data):
            raise InvalidSource('Truncated INDX name length')
        n = struct.unpack_from('>I', data, cursor)[0]
        cursor += 4
        if not 0 < n <= 65536 or cursor + n + 12 > len(data):
            raise InvalidSource('Invalid INDX entry size')
        name = data[cursor:cursor + n].decode('utf-8', 'strict')
        cursor += n
        offset, size, timestamp = struct.unpack_from('>III', data, cursor)
        cursor += 12
        directory.append((name, offset, size))
    result: dict[str, bytes] = {}
    for name, offset, size in directory:
        if not safe_name(name) or name in result or cursor + offset + size > len(data):
            raise InvalidSource(f'Invalid INDX bounds/name: {name!r}')
        result[name] = data[cursor + offset:cursor + offset + size]
    return result


def block_lines(text: str, heading: str) -> list[str]:
    """Do not let an empty `inputs {}` block consume the following stat block."""
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.strip() != heading:
            continue
        j = i + 1
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j == len(lines) or lines[j].strip() != '{':
            raise InvalidSource(f'Invalid {heading} block')
        result = []
        for value in lines[j + 1:]:
            if value.strip() == '}':
                return result
            result.append(value)
        raise InvalidSource(f'Unclosed {heading} block')
    return []


def read_inputs(text: str, named: bool = False) -> list[dict[str, Any]]:
    result = []
    for line in block_lines(text, 'inputsNamed3' if named else 'inputs'):
        if not line.strip():
            continue
        fields = shlex.split(line, posix=True)
        if len(fields) < 4 or not fields[0].isdigit():
            raise InvalidSource(f'Invalid connection entry: {line}')
        if not fields[1]:
            continue
        entry: dict[str, Any] = {'inputIndex': int(fields[0]), 'sourceNode': fields[1],
                                'sourcePort': fields[2]}
        if named:
            if len(fields) != 5:
                raise InvalidSource(f'Invalid named connection: {line}')
            entry['inputName'] = fields[4]
        result.append(entry)
    return result


PARM = re.compile(r'^([A-Za-z_][A-Za-z_0-9]*)\s*\[[^\n]*?\]\s*\((.*)\)\s*$', re.M)
NUMBER = re.compile(r'^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$')


def read_parameters(text: str) -> tuple[dict[str, Any], list[str]]:
    """Keep saved literal values and expressions separate; never evaluate expressions.

    Only single-line serialized literal tuples are decoded. Multi-line/animated
    records remain explicit UNPARSED metadata, rather than guessed values.
    """
    result, unparsed = {}, []
    parsed = set()
    for m in PARM.finditer(text):
        name, raw = m[1], m[2]
        if len(raw) > 65536:
            result[name] = {'class': 'large_raw_blob_not_decoded', 'bytes': len(raw.encode()),
                            'sha256': hashlib.sha256(raw.encode()).hexdigest()}
            parsed.add(name)
            continue
        try:
            tokens = shlex.split(raw, posix=True)
        except ValueError:
            unparsed.append(name)
            continue
        vals = []
        for token in tokens:
            if NUMBER.fullmatch(token):
                value = float(token)
                if not math.isfinite(value):
                    raise InvalidSource('Nonfinite numeric parameter')
                vals.append(int(value) if value.is_integer() and '.' not in token.lower() and 'e' not in token.lower() else value)
            else:
                vals.append(token)
        value = vals[0] if len(vals) == 1 else vals
        result[name] = {'value': value, 'raw': raw.strip(),
                        'class': 'expression_or_reference' if any('$' in t or '`' in t or re.match(r'\w+\(', t) for t in tokens) else 'saved_literal'}
        parsed.add(name)
    for line in text.splitlines():
        m = re.match(r'^([A-Za-z_]\w*)\s*\[', line)
        if m and m[1] not in parsed and m[1] not in unparsed:
            unparsed.append(m[1])
    return result, unparsed


def node_graph(rec: dict[str, bytes]) -> dict[str, Any]:
    nodes = {}
    for name, data in rec.items():
        if not name.endswith('.init'):
            continue
        path = name[:-5]
        text = data.decode('utf-8', 'replace')
        typ = re.search(r'^type = (.+)$', text, re.M)
        if not typ:
            continue
        definition = rec.get(path + '.def', b'').decode('utf-8', 'replace')
        params, missing = read_parameters(rec.get(path + '.parm', b'').decode('utf-8', 'replace'))
        input_list = read_inputs(definition)
        named = read_inputs(definition, named=True)
        for inp in input_list + named:
            inp['sourcePath'] = posixpath.normpath(posixpath.join(posixpath.dirname(path), inp['sourceNode']))
        nodes[path] = {'type': typ[1].strip(), 'matchesDefinition': 'matchesdef = 1' in text,
                       'bypass': 'bypass on' in definition, 'display': 'display on' in definition,
                       'render': 'render on' in definition, 'inputs': input_list,
                       'namedInputs': named, 'parameters': params, 'unparsedParameters': missing,
                       'sourceSections': {key: hashlib.sha256(rec[path + key]).hexdigest()
                                          for key in ['.init', '.def', '.parm'] if path + key in rec}}
    for path, node in nodes.items():
        node['embeddedChildNodes'] = sum(p.startswith(path + '/') for p in nodes)
    return nodes


def upstream(graph: dict[str, Any], target: str) -> list[str]:
    ordered, done, active = [], set(), set()
    def visit(path: str) -> None:
        if path in done:
            return
        if path in active:
            raise InvalidSource(f'Connection cycle at {path}')
        if path not in graph:
            raise InvalidSource(f'Missing connected node: {path}')
        active.add(path)
        for inp in graph[path]['inputs']:
            visit(inp['sourcePath'])
        active.remove(path)
        done.add(path)
        ordered.append(path)
    visit(target)
    return ordered


def fallback_audit(data: bytes) -> list[dict[str, Any]]:
    report = []
    if not data:
        return report
    for name, payload in index_records(data).items():
        if '/fibric_' not in name:
            continue
        sections = index_records(payload)
        c = sections.get('Contents')
        members = cpio_records(c) if c else {}
        report.append({'type': name, 'bytes': len(payload), 'sections': list(sections),
                       'contentsBytes': len(c) if c else 0,
                       'contentsEntries': len(members), 'contentsSha256': hashlib.sha256(c).hexdigest() if c else None,
                       'implementationPresent': bool(members),
                       'classification': 'embedded_content' if members else 'EMPTY_CONTENTS_PARAMETER_FALLBACK_ONLY'})
    return report


def inspect_hip(path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    raw = path.read_bytes()
    rec = cpio_records(raw)
    graph = node_graph(rec)
    fallback = fallback_audit(rec.get('.OPdummydefs', b''))
    dependencies = sorted({line.split(' ', 1)[1] for line in rec.get('.OPfallbacks', b'').decode('utf-8', 'replace').splitlines()
                           if '/fibric_' in line.split(' ', 1)[0] and ' ' in line})
    f = [dict(path=p, type=n['type'], embeddedChildNodes=n['embeddedChildNodes'])
         for p, n in graph.items() if n['type'].startswith('fibric_')]
    variables = rec.get('.variables', b'').decode('utf-8', 'replace')
    ver = re.search(r"_HIP_SAVEVERSION\s*=\s*['\"]([^'\"]+)", variables)
    report = {'filename': path.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(),
              'saveVersion': ver[1] if ver else None, 'cpioSections': len(rec), 'graphNodeCount': len(graph),
              'fibricNodes': f, 'fallbackDefinitions': fallback,
              'externalFibricLibraries': sorted({re.sub(r'^.*?(?=fibric_(?:core|weave_canvas)_v)', '', d, flags=re.I) if re.search(r'fibric_(?:core|weave_canvas)_v', d, re.I) else PurePosixPath(d.replace('\\', '/')).name for d in dependencies}),
              'unparsedParameterEntries': sum(len(n['unparsedParameters']) for n in graph.values()),
              'authorCodeExecuted': False, 'nativeRenderExecuted': False}
    return report, graph


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('source_directory', type=Path)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    report = {'schema': 'fibric_source_audit@1', 'authorCodeExecuted': False,
              'productionReady': False, 'nativeRenderExecuted': False, 'files': []}
    for path in sorted(args.source_directory.glob('*.hip')):
        item, graph = inspect_hip(path)
        report['files'].append(item)
        if path.name == 'pattern_examples.hip':
            target = 'obj/Pattern_examples/OUT_herringbone'
            material = 'stage/herringbone_MAT/herringbone/kma_hair1'
            geo_chain = upstream(graph, target)
            mat_chain = upstream(graph, material)
            recipe = {'schema': 'fibric_native_reference_recipe@1', 'source': item['sha256'],
                      'sourceFile': path.name, 'targetId': 'official_herringbone_sample', 'geometryOutput': target, 'materialOutput': material,
                      'authority': 'saved_original_graph_not_runtime_evaluation',
                      'geometryUpstreamOrder': geo_chain, 'materialUpstreamOrder': mat_chain,
                      'nodes': {n: graph[n] for n in dict.fromkeys(geo_chain + mat_chain)},
                      'warning': 'The selected HIP graph is not proven equivalent to the packaged USD caches. Connected inputs override socket defaults. Expressions and external assets remain unresolved.'}
            (args.out/'herringbone_reference_recipe.json').write_text(json.dumps(recipe, ensure_ascii=False, indent=2))
    report['summary'] = {'hipFiles': len(report['files']),
        'cpioSections': sum(f['cpioSections'] for f in report['files']),
        'graphNodes': sum(f['graphNodeCount'] for f in report['files']),
        'fibricNodeInstances': sum(len(f['fibricNodes']) for f in report['files']),
        'instancesWithChildNetworks': sum(n['embeddedChildNodes'] > 0 for f in report['files'] for n in f['fibricNodes']),
        'nonemptyFallbackContents': sum(x['implementationPresent'] for f in report['files'] for x in f['fallbackDefinitions'])}
    (args.out/'native_source_audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report['summary'], ensure_ascii=False))

if __name__ == '__main__':
    main()
