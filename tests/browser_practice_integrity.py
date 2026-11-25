"""Undo preserves the recording cursor and a new session excludes old listening."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def run():
    with browser_fixture(__doc__, 'synthetic native WAV and session history') as fixture:
        raw = io.BytesIO()
        with wave.open(raw, 'wb') as audio:
            audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            audio.writeframes(bytes(16000 * 2 * 9))
        asset = fixture.upload_audio(raw.getvalue(), 'audio/wav')
        edited = [{'id': 'edit-a', 'text': 'First edit', 'start': .1, 'end': 2},
                  {'id': 'edit-b', 'text': 'Second edit', 'start': 3, 'end': 4.5},
                  {'id': 'edit-c', 'text': 'Last edit', 'start': 5, 'end': 7}]
        original = [{'id': 'cue-a', 'text': 'First original', 'start': .1, 'end': 2},
                    {'id': 'cue-b', 'text': 'Second original', 'start': 3, 'end': 4.5},
                    {'id': 'cue-c', 'text': 'Last original', 'start': 5, 'end': 7}]
        fixture.save_library({
            'lessons': [{'id': 'lesson', 'title': 'Original timing', 'audio': asset, 'mediaSource': 'audio',
                         'duration': 9, 'phrases': edited, 'segments': edited, 'statuses': {},
                         'revisions': [{'phrases': original, 'segments': original,
                                        'statuses': {'cue-a': {'practised': True}}}],
                         'progress': {'position': 3.15, 'phraseId': 'edit-b', 'coverage': [[.1, 2]]}}],
            'courses': [], 'collections': [], 'sessions': [], 'lastLessonId': 'lesson',
            'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1, 'mode': 'continuous'},
        })
        page, errors = fixture.open_page(390, 844)
        page.get_by_role('button', name='Resume lesson', exact=True).click()
        transport = page.locator('#mirror-main-play')
        expect(transport).to_be_enabled()
        expect(page.locator('#active-phrase')).to_have_text('Second edit')
        page.get_by_role('button', name='Phrase queue', exact=True).click()
        page.get_by_role('button', name='Undo last edit', exact=True).click()
        expect(page.locator('#active-phrase')).to_have_text('Second original')
        saved = fixture.wait_for_library(page, lambda value: not value['lessons'][0]['revisions'], 'undo persisted')
        assert abs(saved['lessons'][0]['progress']['position'] - 3.15) < .1
        assert saved['lessons'][0]['progress']['phraseId'] == 'cue-b'
        assert saved['lessons'][0]['progress']['coverage'] == [[.1, 2]]

        page.reload(wait_until='domcontentloaded')
        expect(transport).to_be_enabled()
        expect(page.locator('#active-phrase')).to_have_text('Second original')
        expect(transport).to_have_attribute('aria-label', 'Play')
        page.get_by_role('button', name='Phrase queue', exact=True).click()
        page.get_by_role('dialog', name='Phrase queue').get_by_role('button', name='Last original', exact=False).click()
        page.get_by_role('button', name='Finish practice', exact=True).click()
        summary = page.get_by_role('dialog', name='Session complete')
        expect(summary).to_be_visible()
        summary.get_by_role('button', name='Review difficult', exact=True).click()
        expect(summary).to_be_visible()
        expect(page.get_by_text('No phrases marked Difficult yet.', exact=True)).to_be_visible()
        library = fixture.wait_for_library(page, lambda value: len(value['sessions']) == 1, 'kept current session')
        session = library['sessions'][0]
        assert session['metricsVersion'] == 1
        assert session['coveredIds'] == [] and session['activeSeconds'] == 0
        assert session['practised'] == 1 and session['difficult'] == 0
        assert library['preferences']['mode'] == 'continuous'
        assert not errors, errors
        print('PASS paused Undo, saved cursor and session-local metrics at 390×844.')


if __name__ == '__main__':
    run()
