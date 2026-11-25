"""Recover two pending library copies in a real shared Chromium IndexedDB."""

import io
import json
import time
import wave
from pathlib import Path

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def library(title, asset=None):
    cue = {'id': 'cue', 'start': 0, 'end': 9, 'text': 'A synthetic practice cue.'}
    lesson = {
        'id': 'lesson', 'title': title, 'videoId': 'syncTest001', 'duration': 10,
        'phrases': [cue], 'segments': [cue], 'grouping': 'original', 'statuses': {}, 'originalPlaybackVersion': 1,
        'progress': {'position': 0, 'phraseId': 'cue', 'coverage': []},
    }
    if asset:
        lesson.update(mediaSource='audio', audio=asset)
    return {
        'schemaVersion': 2, 'courses': [], 'lessons': [lesson], 'collections': [], 'sessions': [],
        'preferences': {'mode': 'continuous', 'theme': 'dark', 'startupLesson': 'none',
                        'originalPlaybackVersion': 1},
        'lastLessonId': 'lesson',
    }


def upload_tone(fixture):
    bytes_out = io.BytesIO()
    with wave.open(bytes_out, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(8000)
        wav.writeframes(bytes(160_000))
    return fixture.upload_audio(bytes_out.getvalue(), 'audio/wav')


def run():
    with browser_fixture(__doc__, 'generated native WAV and real IndexedDB') as fixture:
        fixture.save_library(library('Earlier owner practice', upload_tone(fixture)))
        playback, errors = fixture.open_page(390, 844)
        context = playback.context
        account = {'other': False, 'writes': False}
        other = {'revision': 1, 'data': library('Other owner practice')}
        wrong_account_writes = []

        def state(route):
            if account['other']:
                verified = {'x-echo-owner': 'b' * 64}
                if route.request.method != 'PUT':
                    return route.fulfill(headers=verified, json=other)
                if route.request.headers.get('x-echo-owner') != verified['x-echo-owner']:
                    return route.fulfill(status=412)
                proposal = route.request.post_data_json
                if proposal['data']['lessons'][0]['title'] != 'Other owner practice':
                    wrong_account_writes.append(proposal['expectedRevision'])
                    return route.fulfill(status=422, headers=verified, json={'error': 'Unexpected fixture snapshot'})
                if proposal['expectedRevision'] != other['revision']:
                    return route.fulfill(status=409, headers=verified, json=other)
                other.update(revision=other['revision'] + 1, data=proposal['data'])
                return route.fulfill(headers=verified, json={'revision': other['revision']})
            if route.request.method == 'PUT' and not account['writes']:
                return route.abort()
            return route.continue_()

        context.route(fixture.origin + '/api/state', state)
        settings = context.new_page()
        settings.on('pageerror', lambda error: errors.append(str(error)))
        settings.goto(fixture.origin, wait_until='domcontentloaded')
        for page in [playback, settings]:
            expect(page.get_by_role('button', name='Resume lesson', exact=True)).to_be_visible()

        stored_copies = '''async owner => {
          const db = await new Promise((resolve, reject) => {
            const open = indexedDB.open('echo-studio-cache-v1', 1);
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
          });
          const copies = await new Promise((resolve, reject) => {
            const prefix = `state:${owner}:draft:`;
            const request = db.transaction('kv').objectStore('kv').getAll(IDBKeyRange.bound(prefix, prefix + '\uffff'));
            request.onsuccess = () => resolve(request.result.filter(record => record.pending));
            request.onerror = () => reject(request.error);
          });
          db.close();
          return copies.map(copy => ({
            position: copy.data.lessons[0].progress.position, theme: copy.data.preferences.theme
          }));
        }'''

        def wait_for_copies(page, ready):
            deadline = time.monotonic() + 6
            while time.monotonic() < deadline:
                copies = page.evaluate(stored_copies, fixture.owner_key)
                if ready(copies):
                    return copies
                page.wait_for_timeout(50)
            raise AssertionError(f'Pending device copies did not settle: {copies}')

        playback.get_by_role('button', name='Resume lesson', exact=True).click()
        transport = playback.locator('#mirror-main-play')
        expect(transport).to_be_enabled()
        transport.click()
        playback.wait_for_function('media.some(audio => audio.currentTime > 1.1 && !audio.paused)')
        # A seek/cue render can replace the transport during Playwright's stability
        # check. Activate the connected control synchronously on the ordinary path.
        playback.evaluate("document.querySelector('#mirror-main-play[aria-label=Pause]').click()")
        position = wait_for_copies(playback, lambda copies: len(copies) == 1 and copies[0]['position'] > 1)[0]['position']
        settings.locator('.home-appbar').get_by_role('button', name='Settings', exact=True).click()
        settings.locator('[data-pref=theme]').select_option('light')
        copies = wait_for_copies(settings, lambda copies: len(copies) == 2)
        playback_copy = next(copy for copy in copies if copy['theme'] == 'dark')
        assert playback_copy['position'] >= position, copies
        assert {'position': 0, 'theme': 'light'} in copies, copies
        assert fixture.state()['revision'] == 1
        playback.close()
        settings.close()

        reopened = context.new_page()
        reopened.on('pageerror', lambda error: errors.append(str(error)))
        reopened.goto(fixture.origin, wait_until='domcontentloaded')
        notice = reopened.get_by_role('complementary', name='Synchronisation status')
        review = reopened.get_by_role('dialog', name='Review device copies')
        notice.get_by_role('button', name='Review', exact=True).click()
        expect(review.get_by_role('region')).to_have_count(2)
        expect(review.get_by_text('light theme', exact=False)).to_be_visible()
        expect(review.get_by_text('dark theme', exact=False)).to_be_visible()
        theme_copy = review.get_by_role('region').filter(has_text='light theme')
        with reopened.expect_download() as downloaded:
            theme_copy.get_by_role('button', name='Export copy', exact=True).click()
        backup = json.loads(Path(downloaded.value.path()).read_text())
        assert backup['app'] == 'Echo Studio' and backup['data']['preferences']['theme'] == 'light'
        assert 'pendingAudioDeletes' not in backup['data']

        account['other'] = True
        reopened.evaluate("window.dispatchEvent(new Event('focus'))")
        expect(reopened.get_by_role('button', name='Resume lesson', exact=True)).to_contain_text('Other owner practice')
        expect(review).to_have_count(0)
        expect(reopened.get_by_text('Earlier owner practice', exact=False)).to_have_count(0)
        assert not wrong_account_writes, wrong_account_writes
        account.update(other=False, writes=True)
        reopened.evaluate("window.dispatchEvent(new Event('focus'))")
        notice.get_by_role('button', name='Review', exact=True).click()
        expect(review.get_by_role('region')).to_have_count(2)
        review.get_by_role('region').filter(has_text='dark theme').get_by_role(
            'button', name='Use this copy', exact=True).click()
        saved = fixture.wait_for_library(reopened, lambda data: data['lessons'][0]['progress']['position'] >= position,
                                         'selected progress copy on the account')
        remaining = wait_for_copies(reopened, lambda copies: len(copies) == 1)
        assert remaining == [{'position': 0, 'theme': 'light'}], remaining
        assert fixture.state()['revision'] == 2
        reopened.reload(wait_until='domcontentloaded')
        expect(notice.get_by_role('status')).to_contain_text('An earlier device copy is available.')
        reopened.get_by_role('button', name='Resume lesson', exact=True).click()
        expect(reopened.locator('#mirror-main-play')).to_have_attribute('aria-label', 'Play')
        expected = saved['lessons'][0]['progress']['position']
        reopened.wait_for_function("expected => Math.abs(Number(document.querySelector('#phrase-seek')?.value) - expected) < .07",
                                   arg=expected)
        assert not errors, errors
        print('PASS two-tab progress and theme retention, verified reload, separate backup, crossed account and selected sync.')
        context.close()


if __name__ == '__main__':
    run()
