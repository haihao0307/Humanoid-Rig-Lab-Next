Optional local Three.js build directory

The editor loads the Three.js WebGPU module in this order:
  1. /node_modules/three/build/three.webgpu.js
  2. /vendor/three.webgpu.js
  3. pinned online fallback sources

Recommended Windows setup:
  Double-click "安装本地三维库并打开.bat" once.

Manual offline setup:
  Place the official Three.js r185 file named three.webgpu.js in this folder.
  Keep the Three.js MIT license and attribution with any redistributed copy.

No Three.js JavaScript build is bundled in this archive.
