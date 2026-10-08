from pathlib import Path
import json
import struct
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from fibric_native_audit import (InvalidSource, cpio_records, index_records,
    block_lines, read_inputs, read_parameters, upstream, safe_name, fallback_audit)


def record(name, payload=b''):
    fields = [0, 0, 0o100644, 0, 0, 1, 0]
    header = b'070707' + ''.join(f'{v:06o}' for v in fields).encode()
    header += b'00000000000' + f'{len(name.encode())+1:06o}{len(payload):011o}'.encode()
    return header + name.encode() + b'\0' + payload


def cpio(*members):
    return b''.join(record(n, p) for n, p in members) + record('TRAILER!!!')


def indx(items):
    header = b'INDX' + b'\0'*8 + struct.pack('>I', len(items))
    body, data, offset = b'', b'', 0
    for name, payload in items:
        n = name.encode()
        body += struct.pack('>I', len(n)) + n + struct.pack('>III', offset, len(payload), 0)
        data += payload
        offset += len(payload)
    return header + body + data


class NativeAuditTests(unittest.TestCase):
    def test_cpio_roundtrip(self):
        self.assertEqual(cpio_records(cpio(('x', b'hello'), ('obj/a.init', b'type = null'))),
                         {'x': b'hello', 'obj/a.init': b'type = null'})

    def test_empty_container_is_not_implementation(self):
        self.assertEqual(cpio_records(cpio()), {})

    def test_cpio_truncated_header(self):
        with self.assertRaises(InvalidSource):
            cpio_records(b'070707' + b'0'*20)

    def test_cpio_truncated_payload(self):
        with self.assertRaises(InvalidSource):
            cpio_records(cpio(('x', b'hello'))[:79])

    def test_reject_cpio_duplicate(self):
        with self.assertRaises(InvalidSource):
            cpio_records(cpio(('x', b'a'), ('x', b'b')))

    def test_reject_path_traversal(self):
        with self.assertRaises(InvalidSource):
            cpio_records(cpio(('../escape', b'a')))

    def test_reject_unknown_or_protected_format(self):
        with self.assertRaises(InvalidSource):
            cpio_records(b'OTHER_FORMAT')

    def test_reject_missing_trailer(self):
        with self.assertRaises(InvalidSource):
            cpio_records(record('a', b'b'))

    def test_index_roundtrip(self):
        self.assertEqual(index_records(indx([('Contents', b'abc'), ('DialogScript', b'def')])),
                         {'Contents': b'abc', 'DialogScript': b'def'})

    def test_index_truncated(self):
        with self.assertRaises(InvalidSource):
            index_records(indx([('a', b'1234')])[:-1])

    def test_empty_inputs_do_not_consume_stat(self):
        source = 'inputs\n{\n}\nstat\n{\n create 1772968002\n author person\n}\n'
        self.assertEqual(read_inputs(source), [])

    def test_named_connection_keeps_socket(self):
        source = 'inputsNamed3\n{\n1 mix1 3 1 "baseColor"\n2 "" "" 1 "melanin"\n}\n'
        result = read_inputs(source, True)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['inputName'], 'baseColor')
        self.assertEqual(result[0]['sourceNode'], 'mix1')

    def test_saved_params_preserve_off(self):
        p, u = read_parameters('iterations [ 0 locks=0 ] ( 2 )\nenable2 [ 0 locks=0 ] ( "off" )\n')
        self.assertEqual(p['iterations']['value'], 2)
        self.assertEqual(p['enable2']['value'], 'off')
        self.assertEqual(u, [])

    def test_vector_and_expression_separate(self):
        p, u = read_parameters('color [ 0 locks=0 ] ( 0.2 0.4 0.6 )\npath [ 0 locks=0 ] ( $FIBRIC/file.exr )\n')
        self.assertEqual(p['color']['value'], [.2, .4, .6])
        self.assertEqual(p['path']['class'], 'expression_or_reference')

    def test_large_blob_is_not_tokenized(self):
        p, u = read_parameters('blob [ 0 locks=0 ] ( ' + 'a'*70000 + ' )\n')
        self.assertEqual(p['blob']['class'], 'large_raw_blob_not_decoded')
        self.assertNotIn('value', p['blob'])

    def test_empty_hda_fallback_explicit(self):
        dummy = indx([('Sop/fibric_generator', indx([('Contents', cpio()), ('DialogScript', b'UI')]))])
        a = fallback_audit(dummy)[0]
        self.assertEqual(a['contentsEntries'], 0)
        self.assertFalse(a['implementationPresent'])

    def test_graph_order(self):
        g = {'a': {'inputs': []}, 'b': {'inputs': [{'sourcePath':'a'}]}}
        self.assertEqual(upstream(g, 'b'), ['a', 'b'])

    def test_graph_cycle_rejected(self):
        g = {'a': {'inputs': [{'sourcePath':'b'}]}, 'b': {'inputs': [{'sourcePath':'a'}]}}
        with self.assertRaises(InvalidSource):
            upstream(g, 'a')

    def test_graph_missing_source_rejected(self):
        with self.assertRaises(InvalidSource):
            upstream({'a': {'inputs': [{'sourcePath':'missing'}]}}, 'a')


if __name__ == '__main__':
    unittest.main(verbosity=2)
