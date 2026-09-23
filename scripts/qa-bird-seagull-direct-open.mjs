import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  try {
    const raw = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = raw === '/' ? '/index.html' : raw;
    const safe = normalize(rel).replace(/^([/\\])+/, '');
    const file = join(root, safe);
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (error) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(String(error));
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/BIRD_SEAGULL_A_DIRECT_OPEN_R003/index.html`;
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const consoleMessages = [];
const pageErrors = [];
page.on('console', (msg) => consoleMessages.push(`${msg.type()}: ${msg.text()}`));
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

let report;
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForTimeout(4_000);
  report = await page.evaluate(async () => {
    const canvas = document.getElementById('c');
    const status = document.getElementById('status');
    const gl = canvas?.getContext('webgl');
    let changedSamples = -1;
    let glError = null;
    if (gl) {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const w = canvas.width;
      const h = canvas.height;
      const sample = new Uint8Array(4);
      changedSamples = 0;
      for (let yi = 1; yi < 20; yi += 1) {
        for (let xi = 1; xi < 30; xi += 1) {
          const x = Math.min(w - 1, Math.floor((xi / 30) * w));
          const y = Math.min(h - 1, Math.floor((yi / 20) * h));
          gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample);
          // Clear color is approximately rgb(9, 15, 19). Count materially different pixels.
          if (Math.abs(sample[0] - 9) + Math.abs(sample[1] - 15) + Math.abs(sample[2] - 19) > 24) changedSamples += 1;
        }
      }
      glError = gl.getError();
    }
    return {
      title: document.title,
      statusText: status?.textContent || null,
      statusDisplay: status ? getComputedStyle(status).display : null,
      statusRect: status?.getBoundingClientRect().toJSON?.() || null,
      canvasClient: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null,
      canvasBuffer: canvas ? { width: canvas.width, height: canvas.height } : null,
      hasWebGL: Boolean(gl),
      changedSamples,
      glError,
      birdPayloadChars: window.__BIRD_FORM?.length || 0,
    };
  });
  await page.screenshot({ path: 'bird-seagull-direct-open-qa.png', fullPage: true });
} finally {
  await browser.close();
  server.close();
}

const output = { url, report, consoleMessages, pageErrors };
console.log(JSON.stringify(output, null, 2));

if (!report?.statusText?.includes('形态载入完成')) {
  throw new Error(`Workbench did not finish loading: ${report?.statusText || 'missing status'}`);
}
if (!report.hasWebGL || report.changedSamples < 2) {
  throw new Error(`Workbench canvas appears blank: ${JSON.stringify(report)}`);
}
if (pageErrors.length) {
  throw new Error(`Page errors detected: ${pageErrors.join('\n')}`);
}
