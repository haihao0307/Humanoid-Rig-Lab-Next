# Build references and scope

Python gzip/zlib: https://docs.python.org/3.13/library/gzip.html . Gzip header/mtime behavior varies by Python version; the exact gate compares the actual emitted stream. R12 uses explicit level9 and zero-time zlib gzip framing, not a timestamped archive.

Node syntax-only validation: https://nodejs.org/download/release/latest-v20.x/docs/api/cli.html . Tests use node --check and do not represent a browser render. The recorded local Node version is v22.16.0.

Pinned build packages are for developers only: https://pypi.org/project/pillow/12.3.0/ and https://pypi.org/project/numpy/2.3.5/ . They are not runtime dependencies of the standalone workbench. Existing asset/license notices are preserved; this document does not replace the separate R11 permission audit.

The fixed R10 whole-file hash is the equivalence oracle. Deliberate source-mutation and missing-source tests ensure the new linker does not silently return the historical HTML. The math regressions test the newly emitted Node library. No new browser, physical-device, runtime-speed or legal-clearance claim is made.
