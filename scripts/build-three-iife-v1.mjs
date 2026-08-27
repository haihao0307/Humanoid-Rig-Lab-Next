import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corePath = resolve(root, 'node_modules/three/build/three.core.min.js');
const webglPath = resolve(root, 'node_modules/three/build/three.module.min.js');
const outputPath = resolve(root, 'artifacts/review/task16a-r2b-production-surface-v1/vendor/three.iife.min.js');

const coreSource = await readFile(corePath, 'utf8');
const webglSource = await readFile(webglPath, 'utf8');
const core = transformModule(coreSource, { coreNamespace: null });
const webgl = transformModule(webglSource, { coreNamespace: '__THREE_CORE' });
const output = `/* Three.js r185.1 project-local IIFE build; derived mechanically from MIT-licensed package files. */\n(function(g){const __THREE_CORE=(function(){${core.body};return ${core.exports};})();const __THREE_WEBGL=(function(){${webgl.body};return ${webgl.exports};})();g.THREE=Object.assign({},__THREE_CORE,__THREE_WEBGL);})(globalThis);\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, 'utf8');
process.stdout.write(`${JSON.stringify({ outputPath: outputPath.slice(root.length + 1).replaceAll('\\', '/'), bytes: Buffer.byteLength(output), coreExportCount: core.exportCount, webglExportCount: webgl.exportCount }, null, 2)}\n`);

function transformModule(source, { coreNamespace }) {
  let body = source.replace(/^\/\*[\s\S]*?\*\//, '');
  if (coreNamespace) {
    body = body.replace(/import\{([^}]*)\}from"\.\/three\.core\.min\.js";/, (_, list) => `const{${toDestructure(list)}}=${coreNamespace};`);
    body = body.replace(/export\{[^}]*\}from"\.\/three\.core\.min\.js";/g, '');
  }
  const exportStart = body.lastIndexOf('export{');
  if (exportStart < 0) throw new Error('Unable to locate final Three.js export table.');
  const exportEnd = body.indexOf('};', exportStart);
  if (exportEnd < 0) throw new Error('Unable to locate end of Three.js export table.');
  const exportList = body.slice(exportStart + 7, exportEnd);
  const entries = parseEntries(exportList);
  body = `${body.slice(0, exportStart)}${body.slice(exportEnd + 2)}`.trim();
  return {
    body,
    exports: `{${entries.map(({ local, exported }) => `${JSON.stringify(exported)}:${local}`).join(',')}}`,
    exportCount: entries.length,
  };
}

function toDestructure(list) {
  return parseEntries(list).map(({ local, exported }) => local === exported ? exported : `${local}:${exported}`).join(',');
}

function parseEntries(list) {
  return list.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const match = entry.match(/^([^\s]+)\s+as\s+([^\s]+)$/);
    return match ? { local: match[1], exported: match[2] } : { local: entry, exported: entry };
  });
}
