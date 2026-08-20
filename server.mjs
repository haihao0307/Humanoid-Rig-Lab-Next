import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const requestedPort = Number(process.env.PORT || 4173);
const maxPort = requestedPort + 17;
const host = '127.0.0.1';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.wasm': 'application/wasm'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = normalize(decoded).replace(/^([.][.][/\\])+/, '');
  const relative = clean === '/' || clean === '\\' ? 'index.html' : clean.replace(/^[/\\]+/, '');
  const full = resolve(join(root, relative));
  return full === root || full.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`) ? full : null;
}

const server = http.createServer((request, response) => {
  let filePath;
  try {
    filePath = safePath(request.url || '/');
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request');
    return;
  }

  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden');
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html');
  if (!existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }

  const headers = {
    'Content-Type': mime[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': /\.(?:html|js|mjs|css|json)$/i.test(filePath) ? 'no-cache' : 'public, max-age=120',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Content-Type-Options': 'nosniff'
  };

  response.writeHead(200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
});

server.on('clientError', (_error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

function openBrowser(url) {
  if (process.env.NO_OPEN === '1') return;
  try {
    const command = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (error) {
    console.warn(`浏览器未自动打开，请手动访问 ${url}`);
    console.warn(error instanceof Error ? error.message : String(error));
  }
}

function listen(port) {
  const onError = (error) => {
    server.off('listening', onListening);
    if (error?.code === 'EADDRINUSE' && port < maxPort) {
      console.warn(`端口 ${port} 已被占用，尝试端口 ${port + 1}。`);
      setTimeout(() => listen(port + 1), 50);
      return;
    }
    console.error('本地服务器启动失败。');
    console.error(error);
    process.exitCode = 1;
  };

  const onListening = () => {
    server.off('error', onError);
    const url = `http://${host}:${port}/`;
    console.log(`\nHumanoid Rig Lab Next 已启动\n${url}\n`);
    console.log('请保持此命令窗口开启。按 Ctrl+C 可以停止服务器。\n');
    openBrowser(url);
  };

  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, host);
}

listen(requestedPort);
