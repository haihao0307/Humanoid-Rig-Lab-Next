"""Read only FBX object metadata inside user archives; never extract/store meshes."""
import collections
import hashlib
import json
import struct
import sys
import zipfile


def audit_archive(path):
    with zipfile.ZipFile(path) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith('.fbx')]
        if len(names) != 1:
            raise ValueError('Specify a source containing exactly one FBX')
        name = names[0]
        data = archive.read(name)
    if not data.startswith(b'Kaydara FBX Binary'):
        raise ValueError('Not a binary FBX')
    version = struct.unpack_from('<I', data, 23)[0]
    size, fmt = (25, '<QQQB') if version >= 7500 else (13, '<IIIB')
    objects = []

    def properties(offset, count):
        values = []
        scalars = {'Y': ('<h', 2), 'C': ('<?', 1), 'I': ('<i', 4),
                   'F': ('<f', 4), 'D': ('<d', 8), 'L': ('<q', 8)}
        for _ in range(count):
            kind = chr(data[offset])
            offset += 1
            if kind in scalars:
                form, length = scalars[kind]
                value = struct.unpack_from(form, data, offset)[0]
                offset += length
            elif kind in 'SR':
                length = struct.unpack_from('<I', data, offset)[0]
                offset += 4
                value = data[offset:offset + length].decode('utf8', 'replace') if kind == 'S' else '<binary>'
                offset += length
            elif kind in 'fdilcb':
                count_array, encoding, length = struct.unpack_from('<III', data, offset)
                offset += 12 + length
                value = {'arrayType': kind, 'count': count_array}
            else:
                raise ValueError('Unknown FBX property ' + kind)
            if offset > len(data):
                raise ValueError('Invalid property range')
            values.append(value)
        return values

    def walk(offset, limit, depth=0):
        if depth > 100:
            raise ValueError('Excessive FBX depth')
        while offset + size <= limit:
            end, count, length, name_length = struct.unpack_from(fmt, data, offset)
            if not end:
                return
            if end <= offset or end > len(data):
                raise ValueError('Invalid node range')
            node = data[offset + size:offset + size + name_length].decode('utf8')
            start = offset + size + name_length
            if node in ('Model', 'Geometry', 'Deformer', 'NodeAttribute'):
                values = properties(start, count)
                objects.append({'type': node,
                                'name': values[1].split('\x00')[0] if len(values) > 1 and isinstance(values[1], str) else '',
                                'kind': values[2] if len(values) > 2 else ''})
            child = start + length
            if child < end - size:
                walk(child, end - size, depth + 1)
            offset = end

    walk(27, len(data))
    counts = collections.Counter(o['type'] + '/' + str(o['kind']) for o in objects)
    return {'archive': path, 'fbx': name, 'fbxSha256': hashlib.sha256(data).hexdigest(),
            'version': version, 'objectCounts': dict(counts),
            'geometryNames': [o['name'] for o in objects if o['type'] == 'Geometry'],
            'explicitInternalNames': [o for o in objects if any(word in o['name'].lower()
                for word in ('muscle', 'bone_surface', 'femur', 'humerus', 'tibia', 'skeleton_mesh'))],
            'scope': 'metadata inventory only; names do not prove tissue identity or anatomical accuracy'}


if __name__ == '__main__':
    print(json.dumps({'archives': [audit_archive(path) for path in sys.argv[1:]],
                      'acceptance': 'internal anatomical correspondence not verified'}, ensure_ascii=False, indent=2))
