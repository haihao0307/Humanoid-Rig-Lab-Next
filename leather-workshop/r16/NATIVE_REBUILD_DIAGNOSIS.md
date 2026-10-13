# Native exact-build root cause

Run 38338136830 stopped before release because Clang18 generated SHA256 7a7f9d70f6e3b60290bfb41892fcb10e67571adaeddffe23c271d08d846b8dca instead of the accepted 2f9550559469e184d18bce32989c975aae67da580e95924b1e4f8c0a0f02abb6.

Diagnosis: the original link target basename was contact.wasm. The new builder used kernel.wasm. The WebAssembly name custom section records that basename. Transforming only the original module-name subsection from contact.wasm to kernel.wasm and updating its two length fields reproduces the failed hash exactly: 28,696 bytes and 7a7f9d70f6e3b60290bfb41892fcb10e67571adaeddffe23c271d08d846b8dca. All code, data, imports, exports and other bytes are the same. This diagnostic transformation is not used in production.

The correction restores the original linker output basename contact.wasm. The compiler must still produce every byte from C, twice in independent directories; no metadata stripping or post-build binary patch is performed. The accepted hash and byte count are unchanged. Native-source and toolchain provenance remain in native/toolchain.json. A fresh successful run is required before release.
