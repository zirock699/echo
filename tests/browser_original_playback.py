"""Original playback and existing-data recovery using native MP3 audio.

Requires Playwright, Chromium and FFmpeg with flite and libmp3lame.
Generated cue text is a deterministic UI fixture, independent of the spoken audio.
"""

import subprocess
import tempfile
from pathlib import Path

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def seed_legacy_lesson(fixture):
    with tempfile.TemporaryDirectory(prefix='echo-legacy-audio-') as folder:
        file = Path(folder) / 'speech.mp3'
        subprocess.run([
            'ffmpeg', '-v', 'error', '-f', 'lavfi', '-i',
            'flite=text=Listen to this complete spoken sentence without cutting the sound at caption boundaries.:voice=slt',
            '-c:a', 'libmp3lame', str(file),
        ], check=True)
        asset = fixture.upload_audio(file.read_bytes(), 'audio/mpeg')
    cues = [
        {'id': 'one', 'start': 0, 'end': .65, 'text': 'A short original cue'},
        {'id': 'two', 'start': .65, 'end': 1.5, 'text': 'The next original cue'},
        {'id': 'three', 'start': 2, 'end': 4, 'text': 'Another original cue'},
    ]
    lesson = {
        'id': 'first-engine', 'videoId': 'syncTest001', 'title': 'Original playback recovery',
        'mediaSource': 'audio', 'audio': asset, 'importedAt': 1, 'format': 'SRT',
        'pauseOverrides': {}, 'ipaOverrides': {}, 'createdAt': 1, 'source': '',
        'segments': cues, 'phrases': [
            {'id': 'generated', 'start': 0, 'end': 4, 'text': ' '.join(cue['text'] for cue in cues)},
        ],
        'grouping': 'balanced', 'revisions': [], 'statuses': {'generated': {'practised': True}},
        'progress': {'position': .2, 'phraseId': 'generated', 'coverage': [[0, .2]]},
    }
    fixture.save_library({
        'schemaVersion': 2, 'lessons': [lesson], 'courses': [], 'collections': [], 'sessions': [],
        'preferences': {'theme': 'dark', 'startupLesson': 'none', 'mode': 'continuous', 'leadIn': 0, 'grouping': 'original'},
        'lastLessonId': lesson['id'],
    })


def run():
    with browser_fixture(__doc__, 'native generated speech MP3') as fixture:
        seed_legacy_lesson(fixture)
        page, errors = fixture.open_page(320, 568)
        transport = page.locator('#mirror-main-play')
        options = page.get_by_role('dialog', name='Options')
        mode = options.locator('#player-mode')

        page.get_by_role('button', name='Resume lesson', exact=True).click()
        expect(transport).to_be_enabled()
        transport.click()
        page.wait_for_function('media.find(a => !a.paused)?.currentTime > 2.3')
        expect(page.locator('#active-phrase')).to_have_text('Another original cue')
        expect(transport).to_have_attribute('aria-label', 'Pause')
        transport.click()

        page.get_by_role('button', name='Restart current phrase', exact=True).click()
        page.wait_for_function('media.find(a => !a.paused)?.currentTime >= 2')
        position = page.evaluate('media.find(a => !a.paused).currentTime')
        assert 2 <= position < 2.5, position
        transport.click()

        saved = fixture.wait_for_library(
            page,
            lambda data: data['lessons'][0].get('playbackRecoveryBackup'),
            'original cue backup',
        )
        lesson = saved['lessons'][0]
        assert saved['preferences']['mode'] == 'continuous'
        assert saved['preferences']['leadIn'] == 0
        assert len(lesson['phrases']) == 3
        assert lesson['playbackRecoveryBackup']['phrases'][0]['id'] == 'generated'
        assert all(lesson['statuses'][cue['id']]['practised'] for cue in lesson['phrases'])
        assert lesson['progress']['coverage'][0][0] == 0

        page.reload(wait_until='domcontentloaded')
        expect(transport).to_be_enabled()
        assert page.evaluate('media.length > 0 && media.every(a => a.paused)')
        for width, height in [(320, 568), (390, 844), (844, 390), (820, 1180), (1440, 900)]:
            page.set_viewport_size({'width': width, 'height': height})
            expect(transport).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, height)

        page.set_viewport_size({'width': 390, 'height': 844})
        page.get_by_role('button', name='Player settings', exact=True).click()
        expect(mode).to_have_value('continuous')
        mode.select_option('manual')
        options.get_by_role('button', name='Close dialog', exact=True).click()
        fixture.wait_for_library(page, lambda data: data['preferences']['mode'] == 'manual', 'explicit Manual preference')
        page.reload(wait_until='domcontentloaded')
        expect(transport).to_be_enabled()
        page.get_by_role('button', name='Player settings', exact=True).click()
        expect(mode).to_have_value('manual')
        options.get_by_role('button', name='Close dialog', exact=True).click()
        assert not errors, errors
        print('PASS legacy cue recovery, saved backup/marks, exact replay, paused reload and Manual preference. '
              'Viewports 320×568, 390×844, 844×390, 820×1180 and 1440×900.')


if __name__ == '__main__':
    run()
