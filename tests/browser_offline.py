"""Built Worker, Chromium offline privacy, and atomic shell updates."""

import io
import json
import re
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

from playwright.sync_api import expect

from browser_fixture import ROOT, browser_fixture


TITLE = 'Private offline practice fixture'
COLLECTION = 'Practice saved while disconnected'
UPDATE_MARKER = 'Offline browser fixture update'
LEGACY_CACHE = 'echo-studio-app-v22'
OTHER_CACHE = 'fixture-unrelated-cache'

# Real built Workers share synthetic local backing stores across the releases.
BUILT_SERVER = '''
import http from 'node:http';
import {Readable} from 'node:stream';
import original from './original/dist/server/index.js';
import updated from './updated/dist/server/index.js';
import {DevDB,DevBucket} from './original/scripts/dev-state.mjs';

const env={DB:new DevDB(),BUCKET:new DevBucket()};
const host='127.0.0.1';
const port=Number(process.argv[process.argv.indexOf('--port')+1]);
let release='original';
const server=http.createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,`http://${host}:${port}`);
  const choice=url.pathname.match(/^\\/__echo_fixture_release\\/(original|mixed|updated)$/)?.[1];
  if(req.method==='POST'&&choice){
   release=choice;
   res.writeHead(200,{'content-type':'application/json'});
   return res.end(JSON.stringify({release}));
  }
  const worker=release==='original'||(release==='mixed'&&url.pathname==='/src/app.mjs')?original:updated;
  const headers=new Headers(req.headers);
  headers.set('oai-authenticated-user-email','offline-fixture@example.test');
  const body=['GET','HEAD'].includes(req.method)?undefined:req.iterator({destroyOnReturn:false});
  const response=await worker.fetch(new Request(url,{method:req.method,headers,...(body?{body,duplex:'half'}:{})}),env);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  if(response.body)Readable.fromWeb(response.body).pipe(res);
  else res.end();
 }catch(error){
  console.error(error);
  res.writeHead(500);
  res.end('Built Worker fixture failed');
 }
});
server.listen(port,host,()=>console.log(`Echo Studio preview ${host}:${server.address().port}`));
'''


def stage_releases(directory):
    original = directory / 'original'
    updated = directory / 'updated'
    for folder in ('assets', 'scripts', 'server', 'src'):
        shutil.copytree(ROOT / folder, original / folder)
    for name in ('index.html', 'manifest.webmanifest', 'sw.js', 'package.json',
                 '.openai/hosting.json', 'tests/viewport.html', 'tests/notices.html'):
        target = original / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    shutil.copytree(original, updated)
    with (updated / 'src/app.mjs').open('a') as source:
        source.write(f'\n/* {UPDATE_MARKER} */\n')
    for stage in (original, updated):
        subprocess.run(['node', 'scripts/build.mjs'], cwd=stage, check=True, timeout=30)
    helper = directory / 'worker-fixture.mjs'
    helper.write_text(BUILT_SERVER)
    return helper


def shell_manifest(fixture):
    with fixture.http.open(fixture.origin + '/sw.js', timeout=5) as response:
        first_line = response.readline().decode().strip()
    assignment = re.fullmatch(r'const SHELL = (\{.*\});', first_line)
    assert assignment, first_line
    return json.loads(assignment[1])


def seed_library(fixture):
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        audio.writeframes(b'\0\0' * 800)
    media = fixture.upload_audio(output.getvalue(), 'audio/wav')
    fixture.save_library({
        'lessons': [{
            'id': 'offline-test-lesson', 'title': TITLE, 'audio': media, 'mediaSource': 'audio',
            'phrases': [], 'statuses': {}, 'progress': {'position': 0, 'coverage': []}, 'createdAt': 1,
        }],
        'collections': [], 'sessions': [], 'lastLessonId': 'offline-test-lesson',
        'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1},
    })
    return media['url']


def cache_entries(page, name):
    return set(page.evaluate('''async name => {
        if (!(await caches.has(name))) return [];
        const cache = await caches.open(name);
        return (await cache.keys()).map(request => request.url.slice(location.origin.length));
    }''', name))


def update_worker(page, expected_state):
    return page.evaluate('''async expectedState => {
        const registration = await navigator.serviceWorker.getRegistration();
        const candidates = new Set();
        const observeCandidates = () => {
            if (registration.installing) candidates.add(registration.installing);
            if (registration.waiting) candidates.add(registration.waiting);
        };
        const deadline = performance.now() + 10000;
        let nextAttempt = 0;
        let attempts = 0;
        let updating = false;
        let updateError;
        registration.addEventListener('updatefound', observeCandidates);
        try {
            while (performance.now() < deadline) {
                observeCandidates();
                for (const candidate of candidates) {
                    if (candidate.state === expectedState || candidate.state === 'installed') return candidate.state;
                }
                // A job queued during the mixed release can finish redundant after the switch.
                if (!registration.installing && !registration.waiting && !updating &&
                    attempts < 4 && performance.now() >= nextAttempt) {
                    attempts += 1;
                    nextAttempt = performance.now() + 500;
                    updating = true;
                    registration.update().catch(error => { updateError = error; }).finally(() => { updating = false; });
                }
                await new Promise(resolve => setTimeout(resolve, 25));
            }
            const states = [...candidates].map(candidate => candidate.state).join(', ') || 'none';
            throw new Error(`Expected ${expectedState} after ${attempts} requests. Candidates: ${states}. ${updateError ?? ''}`);
        } finally {
            registration.removeEventListener('updatefound', observeCandidates);
        }
    }''', expected_state)


def expect_library(page):
    expect(page.get_by_role('button', name='Resume lesson')).to_contain_text(TITLE)


def expect_locked(page):
    expect(page.get_by_role('heading', name='Library unavailable')).to_be_visible()
    expect(page.get_by_text('Connect and sign in to load your private library.')).to_be_visible()
    content = page.locator('#app').inner_text()
    assert TITLE not in content and COLLECTION not in content, content


def offline_recovery(fixture, page, private_media, assets):
    context = page.context
    expect_library(page)
    page.wait_for_function("navigator.serviceWorker.controller?.state === 'activated'")
    assert page.reload(wait_until='domcontentloaded').status == 200
    expect_library(page)

    # Access actual authenticated routes and supplementary files while controlled.
    paths = ['/api/state', private_media, '/tests/notices.html', '/tests/viewport.html',
             '/assets/colorthief-LICENSE.txt', '/src/app.mjs?fixture=1']
    statuses = page.evaluate('''paths => Promise.all(paths.map(async path => {
        const response = await fetch(path);
        await response.arrayBuffer();
        return response.status;
    }))''', paths)
    assert statuses == [200] * len(paths), statuses
    assert set(page.evaluate('caches.keys()')) == {assets['cache']}
    assert cache_entries(page, assets['cache']) == set(assets['assets'])

    context.set_offline(True)
    expect_library(page)
    page.locator('.mobile-nav [data-view=library]').click()
    page.locator('.library-destinations [data-view=collections]').click()
    page.get_by_role('button', name='New collection', exact=True).click()
    page.locator('#collection-name').fill(COLLECTION)
    page.get_by_role('button', name='Save collection', exact=True).click()
    expect(page.locator('.collections-screen h1')).to_have_text(COLLECTION)
    expect(page.get_by_text('Pending changes are saved on this device.', exact=False)).to_be_visible()
    assert fixture.state()['data']['collections'] == []

    # A new document shares the warm shell and owner storage, but needs live verification.
    cold = context.new_page()
    errors = []
    cold.on('pageerror', lambda error: errors.append(str(error)))
    assert cold.goto(fixture.origin, wait_until='domcontentloaded').status == 200
    expect_locked(cold)
    assert cold.reload(wait_until='domcontentloaded').status == 200
    expect_locked(cold)
    unavailable = cold.evaluate('(path) => fetch(path).then(() => false, () => true)', private_media)
    assert unavailable, 'Private media must remain a network request'
    assert not errors, errors
    cold.close()

    context.set_offline(False)
    fixture.wait_for_library(page, lambda data: [item['name'] for item in data['collections']] == [COLLECTION],
                             'the verified owner’s offline collection after reconnect')
    assert page.reload(wait_until='domcontentloaded').status == 200
    expect(page.locator('.collections-screen h1')).to_have_text(COLLECTION)
    print(f'PASS warm offline shell with {len(assets["assets"])} public assets, cold lock, and same-owner save/reconnect.')


def atomic_update(fixture, page, original):
    context = page.context
    page.evaluate('''async ([legacy, unrelated]) => {
        await caches.open(legacy);
        await (await caches.open(unrelated)).put('/separate-owner-fixture', new Response('keep this'));
    }''', [LEGACY_CACHE, OTHER_CACHE])
    app_module = "fetch('/src/app.mjs').then(response => response.text())"
    original_source = page.evaluate(app_module)
    assert UPDATE_MARKER not in original_source

    fixture.request('/__echo_fixture_release/mixed', 'POST')
    updated = shell_manifest(fixture)
    assert updated['cache'] != original['cache']
    assert set(updated['assets']) == set(original['assets'])
    assert {name for name, digest in updated['assets'].items() if digest != original['assets'][name]} == {'/src/app.mjs'}
    assert update_worker(page, 'redundant') == 'redundant'
    assert cache_entries(page, updated['cache']) == set(), 'A mismatching asset left a partial candidate cache'
    assert page.evaluate(app_module) == original_source
    page.wait_for_function('''async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        return !registration.installing && !registration.waiting;
    }''')

    fixture.request('/__echo_fixture_release/updated', 'POST')
    assert update_worker(page, 'installed') == 'installed'
    assert page.evaluate("navigator.serviceWorker.getRegistration().then(reg => reg.waiting?.state)") == 'installed'
    assert cache_entries(page, updated['cache']) == set(updated['assets'])
    assert page.evaluate(app_module) == original_source
    candidate = next(worker for worker in context.service_workers if worker.evaluate('SHELL.cache') == updated['cache'])
    page.close()
    candidate.evaluate('''() => new Promise((resolve, reject) => {
        const deadline = Date.now() + 7000;
        const timer = setInterval(() => {
            if (self.registration.active?.state === 'activated' && !self.registration.waiting) {
                clearInterval(timer);
                resolve();
            } else if (Date.now() > deadline) {
                clearInterval(timer);
                reject(new Error('Waiting release did not activate after closing the old client'));
            }
        }, 25);
    })''')

    context.set_offline(True)
    cold = context.new_page()
    errors = []
    cold.on('pageerror', lambda error: errors.append(str(error)))
    assert cold.goto(fixture.origin, wait_until='domcontentloaded').status == 200
    expect_locked(cold)
    assert UPDATE_MARKER in cold.evaluate(app_module)
    assert set(cold.evaluate('caches.keys()')) == {updated['cache'], OTHER_CACHE}
    assert cache_entries(cold, updated['cache']) == set(updated['assets'])
    assert cold.evaluate('''async name => {
        const entry = await (await caches.open(name)).match('/separate-owner-fixture');
        return await entry.text();
    }''', OTHER_CACHE) == 'keep this'
    assert not errors, errors
    print('PASS incomplete update kept the active release; complete update activated offline and removed only prior app caches.')


def run():
    with tempfile.TemporaryDirectory(prefix='echo-offline-build-') as directory:
        stage = Path(directory)
        helper = stage_releases(stage)
        with browser_fixture(__doc__, 'built Worker and synthetic private WAV', script=helper) as fixture:
            original = shell_manifest(fixture)
            expected = {'/index.html', '/manifest.webmanifest', '/assets/icon.svg',
                        '/assets/icon-192.png', '/assets/icon-512.png', '/assets/rehearsal-home.webp',
                        '/assets/rehearsal-bricolage.woff2', '/assets/rehearsal-instrument.woff2'}
            expected.update(f'/src/{path.name}' for path in (stage / 'original/src').iterdir()
                            if path.is_file() and re.fullmatch(r'[\w-][\w.-]*\.(mjs|css)', path.name))
            assert set(original['assets']) == expected
            private_media = seed_library(fixture)
            page, errors = fixture.open_page(390, 844, service_workers='allow')
            offline_recovery(fixture, page, private_media, original)
            atomic_update(fixture, page, original)
            assert not errors, errors


if __name__ == '__main__':
    run()
