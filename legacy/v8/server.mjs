import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.glb', 'model/gltf-binary'],
]);

const server = createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || host}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
    const normalizedPath = normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
    let filePath = resolve(join(rootDirectory, normalizedPath));

    if (!filePath.startsWith(rootDirectory)) {
      respondText(response, 403, 'Forbidden');
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      respondText(response, 404, 'Not Found');
      return;
    }

    const mimeType = mimeTypes.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': mimeType,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    console.error(error);
    respondText(response, 500, 'Internal Server Error');
  }
});

server.listen(port, host, () => {
  console.log(`Humanoid Rig Lab is running at http://${host}:${port}`);
  console.log('Press Ctrl+C to stop the local server.');
});

function respondText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  response.end(text);
}
