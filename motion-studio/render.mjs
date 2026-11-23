// Render offline determinista de la escena a video MP4 (H.264) usando Chromium headless + ffmpeg.
// Uso: node render.mjs [salida.mp4] [segundos=12] [fps=30] [ancho=1920] [alto=1080]
// Variables opcionales: LIBS=<carpeta con node_modules de three y gsap> para no depender del CDN,
//                       STILLS=1 para exportar sólo algunos PNG de prueba.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// playwright se resuelve con require para respetar NODE_PATH (instalación global)
const { chromium } = createRequire(import.meta.url)('playwright');
const here = dirname(fileURLToPath(import.meta.url));
const [out = 'nucleo-energetico.mp4', secs = '12', fpsArg = '30', wArg = '1920', hArg = '1080'] = process.argv.slice(2);
const fps = +fpsArg, W = +wArg, H = +hArg, frames = Math.round(+secs * fps);
const libs = process.env.LIBS ? resolve(process.env.LIBS) : null;

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.hostname === 'studio.local') {
    return route.fulfill({ body: readFileSync(join(here, 'index.html')), contentType: 'text/html' });
  }
  if (libs && url.hostname === 'cdn.jsdelivr.net') {
    const m = url.pathname.match(/^\/npm\/(three|gsap)@[^/]+\/(.*)$/);
    const file = m && join(libs, 'node_modules', m[1], m[2]);
    if (file && existsSync(file)) {
      return route.fulfill({ body: readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' });
    }
  }
  return route.continue();
});

await page.goto(`http://studio.local/index.html?render&w=${W}&h=${H}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });

const grab = async (t) => Buffer.from((await page.evaluate((tt) => window.__frame(tt), t)).split(',')[1], 'base64');

if (process.env.STILLS) {
  for (const t of [0.6, 1.2, 3.0, 4.5]) {
    const f = join(dirname(resolve(out)), `still-${t}.png`);
    writeFileSync(f, await grab(t));
    console.log('still', f);
  }
} else {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(out)],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const buf = await grab(i / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 15 === 0) console.log(`frame ${i + 1}/${frames}  (${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/frame)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log('listo:', resolve(out));
}
await browser.close();
