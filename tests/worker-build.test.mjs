import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DevBucket, DevDB } from '../scripts/dev-state.mjs';
import { shellAssets } from '../scripts/shell-assets.mjs';

function shellManifest(script) {
  const firstLine = script.slice(0, script.indexOf('\n'));
  const match = /^const SHELL = (\{.*\});$/.exec(firstLine);
  assert.ok(match, 'Built service worker must contain its shell manifest');
  const shell = JSON.parse(match[1]);
  assert.match(shell.cache, /^echo-studio-app-[a-f0-9]{64}$/);
  return shell;
}

const integrity = bytes => 'sha256-' + createHash('sha256').update(bytes).digest('base64');

test('built Worker serves app assets and routes state and audio requests', async (t) => {
  const source = fileURLToPath(new URL('../', import.meta.url));
  const staging = mkdtempSync(join(tmpdir(), 'echo-worker-build-'));
  t.after(() => rmSync(staging, { recursive: true, force: true }));

  // The builder reads paths relative to cwd and replaces its dist directory.
  for (const input of [
    'scripts/build.mjs', 'scripts/shell-assets.mjs', '.openai/hosting.json', 'server', 'src', 'assets',
    'package.json', 'index.html', 'manifest.webmanifest', 'sw.js',
    'tests/viewport.html', 'tests/notices.html',
  ]) {
    const destination = join(staging, input);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(source, input), destination, { recursive: true });
  }
  symlinkSync('app.mjs', join(staging, 'src', 'app-alias.mjs'));
  writeFileSync(join(staging, 'src', 'local-notes.txt'), 'Synthetic file outside the module allowlist.');
  const build = () => execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: staging, timeout: 10000 });
  build();
  const artifact = join(staging, 'dist/server/index.js');
  const workerURL = pathToFileURL(artifact).href;
  const { default: worker } = await import(workerURL);
  const env = { DB: new DevDB(), BUCKET: new DevBucket() };
  const route = (pathname, init) => worker.fetch(new Request(`https://echo.test${pathname}`, init), env);

  const html = await route('/');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /^text\/html/);
  assert.equal(html.headers.get('cache-control'), 'no-cache');
  assert.equal(html.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(html.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  const index = await html.text();
  assert.match(index, /src="\/src\/app\.mjs"/);
  assert.equal(await (await route('/index.html')).text(), index);
  const head = await route('/sw.js', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.match(head.headers.get('content-type'), /^text\/javascript/);
  assert.equal(await head.text(), '');
  const method = await route('/src/app.mjs', { method: 'POST' });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get('allow'), 'GET, HEAD');
  const module = await route('/src/app.mjs');
  assert.equal(module.status, 200);
  assert.match(module.headers.get('content-type'), /^text\/javascript/);
  assert.match(await module.text(), /import\s/);
  for (const path of ['/missing-asset', '/.openai/hosting.json', '/server/worker.mjs', '/src/app-alias.mjs', '/src/local-notes.txt']) {
    assert.equal((await route(path)).status, 404, path);
  }
  for (const path of ['/tests/viewport.html', '/tests/notices.html', '/assets/colorthief-LICENSE.txt']) {
    assert.equal((await route(path)).status, 200, path);
  }

  const script = await (await route('/sw.js')).text();
  const shell = shellManifest(script);
  assert.equal(script, shellAssets(staging).get('/sw.js').toString('utf8'));
  const manifestResponse = await route('/manifest.webmanifest');
  assert.equal(manifestResponse.headers.get('content-type'), 'application/manifest+json');
  const manifest = await manifestResponse.json();
  const icons = manifest.icons.map(icon => icon.src);
  assert.deepEqual(icons, ['/assets/icon-192.png', '/assets/icon-512.png']);
  const entryFiles = [...index.matchAll(/<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  const modulesAndStyles = readdirSync(join(staging, 'src'), { withFileTypes: true })
    .filter(entry => entry.isFile() && /^[\w-][\w.-]*\.(?:mjs|css)$/.test(entry.name))
    .map(entry => '/src/' + entry.name);
  const expected = new Set(['/index.html', ...entryFiles, ...icons, ...modulesAndStyles]);
  assert.deepEqual(Object.keys(shell.assets), [...expected].sort());
  for (const [path, digest] of Object.entries(shell.assets)) {
    const cached = await route(path);
    assert.equal(cached.status, 200, path);
    const bytes = Buffer.from(await cached.arrayBuffer());
    assert.equal(integrity(bytes), digest, path);
    if (!path.endsWith('.mjs')) continue;
    const imports = /^\s*(?:import\s+(?:[^'";]+?\s+from\s+)?|export\s+(?:\*[^'";]*|\{[^}]+\})\s+from\s+)['"]([^'"]+)['"]/gm;
    for (const [, specifier] of bytes.toString('utf8').matchAll(imports)) {
      const dependency = new URL(specifier, 'https://echo.test' + path);
      assert.equal(dependency.origin, 'https://echo.test', specifier);
      assert.ok(Object.hasOwn(shell.assets, dependency.pathname), `${path} requires ${specifier}`);
    }
  }

  const firstBuild = readFileSync(artifact);
  build();
  assert.deepEqual(readFileSync(artifact), firstBuild, 'Same files must produce identical Worker bytes');
  writeFileSync(join(staging, 'src', 'additional-module.mjs'), 'export const release = 2;\n');
  appendFileSync(join(staging, 'src', 'app.mjs'), "\nimport './additional-module.mjs';\n");
  build();
  const { default: updatedWorker } = await import(workerURL + '?updated');
  const updated = path => updatedWorker.fetch(new Request('https://echo.test' + path), env);
  const newer = shellManifest(await (await updated('/sw.js')).text());
  assert.notEqual(newer.cache, shell.cache);
  assert.notEqual(newer.assets['/src/app.mjs'], shell.assets['/src/app.mjs']);
  assert.equal(newer.assets['/index.html'], shell.assets['/index.html']);
  assert.equal(newer.assets['/src/additional-module.mjs'], integrity(Buffer.from(await (await updated('/src/additional-module.mjs')).arrayBuffer())));
  assert.deepEqual(readFileSync(join(staging, 'dist/.openai/hosting.json')), readFileSync(join(staging, '.openai/hosting.json')));

  assert.equal((await route('/api/state')).status, 401);
  const headers = { 'oai-authenticated-user-email': 'worker-smoke@example.test' };
  const fresh = await route('/api/state', { headers });
  assert.equal(fresh.status, 200);
  assert.equal(fresh.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await fresh.json(), { revision: 0, data: null });
  const owner = fresh.headers.get('x-echo-owner');
  assert.ok(owner);
  headers['x-echo-owner'] = owner;
  const data = { lessons: [], collections: [], sessions: [], preferences: { theme: 'dark' } };
  const saved = await route('/api/state', {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expectedRevision: 0, data }),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { revision: 1 });
  const reloaded = await route('/api/state', { headers });
  assert.equal(reloaded.status, 200);
  assert.deepEqual(await reloaded.json(), { revision: 1, data });

  assert.equal((await route('/api/audio')).status, 401);
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const upload = await route('/api/audio', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'audio/wav', 'Content-Length': String(bytes.length) },
    body: bytes,
  });
  assert.equal(upload.status, 201);
  const asset = await upload.json();
  assert.match(asset.url, /^\/api\/audio\//);
  const audio = await route(asset.url, { headers: { ...headers, Range: 'bytes=1-2' } });
  assert.equal(audio.status, 206);
  assert.equal(audio.headers.get('content-range'), 'bytes 1-2/4');
  assert.equal(audio.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(new Uint8Array(await audio.arrayBuffer()), bytes.slice(1, 3));
});
