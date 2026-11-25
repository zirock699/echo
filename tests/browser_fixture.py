"""Loopback-only fixtures for the maintained Playwright checks."""

import argparse
import json
import shutil
import socket
import subprocess
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from urllib.request import ProxyHandler, Request, build_opener

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
HOST = '127.0.0.1'


class BrowserFixture:
    def __init__(self, origin, server, browser):
        self.origin = origin
        self.server = server
        self.browser = browser
        self.http = build_opener(ProxyHandler({}))
        self.owner_key = None

    def request(self, path, method='GET', body=None, headers=None):
        if self.server.poll() is not None:
            raise RuntimeError('The disposable development server stopped')
        request_headers = dict(headers or {})
        if method in ('POST', 'PUT', 'DELETE'):
            assert self.owner_key, 'Expected a verified fixture owner before writing'
            request_headers['x-echo-owner'] = self.owner_key
        request = Request(self.origin + path, body, request_headers, method=method)
        with self.http.open(request, timeout=5) as response:
            if method == 'GET' and path == '/api/state':
                self.owner_key = response.headers['x-echo-owner']
            return json.load(response)

    def state(self):
        return self.request('/api/state')

    def save_library(self, data):
        body = json.dumps({'expectedRevision': self.state()['revision'], 'data': data}).encode()
        return self.request('/api/state', 'PUT', body, {'Content-Type': 'application/json'})

    def upload_audio(self, body, mime):
        return self.request('/api/audio', 'POST', body, {'Content-Type': mime, 'x-file-size': str(len(body))})

    def wait_for_library(self, page, condition, description, *, timeout=8):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            saved = self.state()['data']
            if saved is not None and condition(saved):
                return saved
            # Let Playwright dispatch route callbacks for the browser's save requests.
            page.wait_for_timeout(50)
        raise AssertionError(f'Expected saved library: {description}')

    def open_page(self, width, height, *, mobile=True, service_workers='block'):
        context = self.browser.new_context(
            viewport={'width': width, 'height': height},
            is_mobile=mobile,
            has_touch=mobile,
            service_workers=service_workers,
        )
        # Context routing also covers pages opened during a fixture journey.
        def fixture_requests_only(route):
            if route.request.url.startswith(self.origin + '/'):
                route.continue_()
            else:
                route.abort()

        context.route('**/*', fixture_requests_only)
        page = context.new_page()
        page.set_default_timeout(7000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        # Observe the real native decoders created by the player.
        page.add_init_script('''
            window.media = [];
            const NativeAudio = window.Audio;
            window.Audio = function (...args) {
                const audio = new NativeAudio(...args);
                window.media.push(audio);
                return audio;
            };
        ''')
        page.goto(self.origin, wait_until='domcontentloaded')
        return page, errors


@contextmanager
def browser_fixture(description, media, *, script='scripts/dev.mjs'):
    # These suites seed and mutate state, so they never take a target URL.
    argparse.ArgumentParser(description=description).parse_args()
    chromium = shutil.which('chromium')
    if not chromium:
        raise SystemExit('Chromium must be installed on PATH')

    with socket.socket() as reservation:
        reservation.bind((HOST, 0))
        port = reservation.getsockname()[1]

    with tempfile.TemporaryDirectory(prefix='echo-browser-') as directory:
        log = Path(directory) / 'server.log'
        with log.open('wb') as output:
            server = subprocess.Popen(
                ['node', str(script), '--host', HOST, '--port', str(port)],
                cwd=ROOT, stdout=output, stderr=subprocess.STDOUT,
            )
        try:
            # Only the newly spawned child can satisfy this check. A port
            # collision fails without sending any request to the other owner.
            ready = f'Echo Studio preview {HOST}:{port}'
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline and server.poll() is None:
                if ready in log.read_text().splitlines():
                    break
                time.sleep(0.05)
            else:
                raise RuntimeError(f'Disposable server did not start:\n{log.read_text()}')

            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(executable_path=chromium, args=[
                    '--disable-background-networking', '--no-proxy-server',
                    f'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE {HOST}',
                ])
                try:
                    fixture = BrowserFixture(f'http://{HOST}:{port}', server, browser)
                    assert fixture.state() == {'revision': 0, 'data': None}, 'Expected a fresh fixture'
                    print(f'Chromium {browser.version} | {media} | disposable loopback fixture', flush=True)
                    yield fixture
                finally:
                    browser.close()
        finally:
            if server.poll() is None:
                server.terminate()
                try:
                    server.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
