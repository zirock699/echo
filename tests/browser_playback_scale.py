"""Measure checkpoint traffic, native idle work and bounded queue opening on loopback.

Requires Chromium, Playwright and FFmpeg with libmp3lame.
"""

import json
import subprocess
from pathlib import Path
from statistics import median
from tempfile import TemporaryDirectory
from uuid import NAMESPACE_OID, uuid5

from playwright.sync_api import expect

from browser_fixture import browser_fixture


FOCUS_CUES = 1200
DURATION = 2 * FOCUS_CUES + 4
TOTAL_CUES = 16_950
STEADY_MS = 12_600


def upload_tone(fixture):
    with TemporaryDirectory(prefix='echo-scale-audio-') as directory:
        track = Path(directory) / 'tone.mp3'
        subprocess.run([
            'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
            'sine=frequency=220:sample_rate=8000', '-t', str(DURATION), '-ac', '1',
            '-c:a', 'libmp3lame', '-b:a', '8k', str(track),
        ], check=True)
        audio = track.read_bytes()
    return fixture.request('/api/audio', 'POST', audio, {
        'Content-Type': 'audio/mpeg', 'x-file-size': str(len(audio)), 'x-file-name': 'generated-tone.mp3',
    })


def seed_library(fixture, asset, focus_index):
    # Match the audit's cue IDs, text, timing, transcript and asset metadata.
    lessons = []
    for n in range(36):
        count = FOCUS_CUES if n == 0 else 450
        video = f'bench{n:06d}'
        phrases = [
            {'id': str(uuid5(NAMESPACE_OID, f'phrase-{n}-{i}')), 'start': 2*i, 'end': 2*i+1.85,
             'text': f'Synthetic practice line {n} part {i}. Keep the sentence flowing naturally.'}
            for i in range(count)
        ]
        segments = [dict(cue, id=str(uuid5(NAMESPACE_OID, f'segment-{n}-{i}'))) for i, cue in enumerate(phrases)]
        source = '\n\n'.join(
            f'{i+1}\n00:{(2*i)//60:02d}:{(2*i)%60:02d},000 --> 00:{(2*i+1)//60:02d}:{(2*i+1)%60:02d},850\n{cue["text"]}'
            for i, cue in enumerate(phrases)
        )
        focus = phrases[focus_index if n == 0 else 0]
        lessons.append({
            'id': str(uuid5(NAMESPACE_OID, f'lesson-{n}')), 'title': f'Benchmark practice lesson {n}',
            'createdAt': n+1, 'grouping': 'original', 'speaker': 'Synthetic Phrase', 'duration': DURATION,
            'source': source, 'mediaSource': 'audio', 'audio': asset, 'videoId': video,
            'importedAt': n+1, 'format': 'SRT', 'audioOffset': 0,
            'ambientPalette': {'version': 1, 'videoId': video, 'colours': ['#5b24a8'], 'source': 'fixture'},
            'phrases': phrases, 'segments': segments, 'statuses': {}, 'revisions': [],
            'progress': {'position': focus['start']+.15, 'phraseId': focus['id'], 'coverage': []},
        })
    assert sum(len(lesson['phrases']) for lesson in lessons) == TOTAL_CUES
    data = {'schemaVersion': 2, 'lessons': lessons, 'courses': [], 'collections': [], 'sessions': [],
            'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1, 'mode': 'continuous'},
            'lastLessonId': lessons[0]['id']}
    revision = fixture.state()['revision']
    body = json.dumps({'expectedRevision': revision, 'data': data}, separators=(',', ':')).encode()
    saved = fixture.request('/api/state', 'PUT', body, {'Content-Type': 'application/json'})
    assert saved['revision'] == revision + 1
    print(f'Fixture cue {focus_index + 1}, state envelope {len(body):,} bytes', flush=True)
    return lessons[0]['progress']['phraseId']


def open_ready(fixture, expected):
    page, errors = fixture.open_page(390, 844)
    page.emulate_media(reduced_motion='reduce')
    page.evaluate('''() => {
        window.scaleTrace = {reads:0, puts:[]};
        const clock = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'currentTime');
        Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {...clock, get() {
            if (this instanceof HTMLAudioElement) scaleTrace.reads++;
            return clock.get.call(this);
        }});
        const fetch = window.fetch.bind(window);
        window.fetch = (resource, options) => {
            if (resource === '/api/state' && options?.method === 'PUT') {
                scaleTrace.puts.push(new TextEncoder().encode(options.body).byteLength);
            }
            return fetch(resource, options);
        };
    }''')
    page.get_by_role('button', name='Resume lesson', exact=True).click()
    expect(page.get_by_role('button', name='Play', exact=True)).to_be_enabled()
    expect(page.locator('#active-phrase')).to_have_attribute('data-phrase', expected)
    page.wait_for_function('media.some(audio => audio.paused && !audio.seeking && audio.readyState >= 2)')
    return page, errors


def measure_queue(page, active_id, label):
    samples = []
    for _ in range(7):
        sample = page.evaluate('''async () => {
            const start = performance.now();
            document.querySelector('.player-tools [data-action=queue]').click();
            const direct = performance.now() - start;
            const rows = document.querySelectorAll('.queue-panel .phrase-row').length;
            await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
            const list = document.getElementById('queue-list'), selected = list.querySelector('.selected');
            const row = selected?.getBoundingClientRect(), viewport = list.getBoundingClientRect();
            return {direct, painted:performance.now()-start, rows, active:selected?.dataset.rowId,
                visible:row && row.top >= viewport.top-1 && row.bottom <= viewport.bottom+1};
        }''')
        assert 0 < sample['rows'] <= 120 and sample['active'] == active_id and sample['visible'], sample
        samples.append(sample)
        page.get_by_role('button', name='Close queue', exact=True).click()
        page.wait_for_timeout(100)
    print(f'Queue {label}: rows {[s["rows"] for s in samples]}, '
          f'direct ms {[round(s["direct"], 1) for s in samples]}, '
          f'medians {median(s["direct"] for s in samples):.1f} ms synchronous / '
          f'{median(s["painted"] for s in samples):.1f} ms to two frames', flush=True)


def measure_steady(fixture, page):
    page.wait_for_timeout(350)
    before = page.evaluate('scaleTrace.reads')
    page.wait_for_timeout(2000)
    reads = page.evaluate('scaleTrace.reads') - before
    print(f'Idle native clock reads over 2 s: {reads}', flush=True)
    assert reads <= 5, reads

    start_revision = fixture.state()['revision']
    page.evaluate('''() => {
        const audio = media.at(-1);
        scaleTrace.puts = [];
        scaleTrace.pauses = 0;
        audio.addEventListener('pause', () => scaleTrace.pauses++);
        audio.addEventListener('playing', () => {
            scaleTrace.started = performance.now();
            scaleTrace.position = audio.currentTime;
        }, {once:true});
    }''')
    page.get_by_role('button', name='Play', exact=True).click()
    page.wait_for_function('Number.isFinite(scaleTrace.started)')
    steady = page.evaluate('''duration => new Promise(resolve => {
        const remaining = scaleTrace.started + duration - performance.now();
        setTimeout(() => {
            const audio = media.at(-1);
            resolve({elapsed:performance.now()-scaleTrace.started, playing:!audio.paused,
                advanced:audio.currentTime-scaleTrace.position, pauses:scaleTrace.pauses, bytes:scaleTrace.puts});
        }, Math.max(0, remaining));
    })''', STEADY_MS)
    assert steady['playing'] and not steady['pauses'] and steady['advanced'] >= 11.9, steady
    assert len(steady['bytes']) <= 1, steady
    print(f'Steady {steady["elapsed"]/1000:.3f} s: {len(steady["bytes"])} PUTs, '
          f'{sum(steady["bytes"]):,} bytes, native clock advanced {steady["advanced"]:.3f} s', flush=True)

    local = page.evaluate('''owner => new Promise((resolve, reject) => {
        const open = indexedDB.open('echo-studio-cache-v1', 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result, transaction = db.transaction('kv');
            const prefix = `state:${owner}:draft:`;
            const read = transaction.objectStore('kv').getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'));
            read.onerror = () => reject(read.error);
            read.onsuccess = () => resolve(read.result.find(copy => copy.pending)?.data?.lessons?.[0]?.progress);
            transaction.oncomplete = () => db.close();
        };
    })''', fixture.owner_key)
    assert local and local['position'] > 8 and local['coverage'], local

    # Resolve and focus the live button together. Cue changes replace its DOM node.
    assert page.evaluate('''() => {
        const button = document.getElementById('mirror-main-play');
        if (button?.getAttribute('aria-label') !== 'Pause' || button.disabled) return false;
        button.focus({preventScroll:true});
        return document.activeElement === button;
    }''')
    page.keyboard.press('Enter')
    page.wait_for_function('media.at(-1).paused')
    clock = page.evaluate('media.at(-1).currentTime')
    saved = fixture.wait_for_library(page, lambda data: abs(data['lessons'][0]['progress']['position'] - clock) < .25,
                                     'explicit Pause captured the native cursor', timeout=12)
    progress = saved['lessons'][0]['progress']
    assert fixture.state()['revision'] > start_revision and progress['coverage']
    assert len(saved['lessons']) == 36 and sum(len(lesson['phrases']) for lesson in saved['lessons']) == TOTAL_CUES
    page.reload(wait_until='domcontentloaded')
    expect(page.get_by_role('button', name='Play', exact=True)).to_be_enabled()
    page.wait_for_function('t => media.some(a => a.paused && !a.seeking && Math.abs(a.currentTime-t) < .25)', arg=clock)
    print(f'Progress: local {local["position"]:.3f} s, Pause {clock:.3f} s, '
          f'saved {progress["position"]:.3f} s, reload remained paused', flush=True)


def run():
    with browser_fixture(__doc__, '36 lessons, 16,950 cues, 2,404 s native MP3 at 390×844') as fixture:
        asset = upload_tone(fixture)
        for index, label in [(0, 'early'), (1170, 'late')]:
            active_id = seed_library(fixture, asset, index)
            page, errors = open_ready(fixture, active_id)
            measure_queue(page, active_id, label)
            if index == 0:
                measure_steady(fixture, page)
            assert not errors, errors
            page.context.close()


if __name__ == '__main__':
    run()
