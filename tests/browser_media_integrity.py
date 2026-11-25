"""Player lesson removal preserves course continuation and shared media."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def run():
    with browser_fixture(__doc__, 'synthetic native WAV and metadata') as fixture:
        raw = io.BytesIO()
        with wave.open(raw, 'wb') as audio:
            audio.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
            audio.writeframes(bytes(16000 * 2 * 12))
        asset = fixture.upload_audio(raw.getvalue(), 'audio/wav')
        course = {'id': 'course', 'title': 'Two item course', 'lessonIds': ['first', 'second']}
        cue = {'id': 'cue', 'start': .1, 'end': 1.1, 'text': 'Synthetic phrase.'}
        lessons = [{
            'id': lesson, 'title': title, 'courseId': course['id'], 'audio': asset,
            'mediaSource': 'audio', 'duration': 12, 'phrases': [cue], 'segments': [cue],
            'statuses': {'cue': {'practised': True}},
            'progress': {'position': .2, 'phraseId': 'cue', 'coverage': [[.1, .2]]},
        } for lesson, title in [('first', 'First fixture'), ('second', 'Second fixture')]]
        fixture.save_library({
            'lessons': lessons, 'courses': [course],
            'collections': [{'id': 'my-list', 'name': 'Practice list', 'lessonIds': ['first', 'second']}],
            'sessions': [], 'lastLessonId': 'first',
            'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1},
        })
        page, errors = fixture.open_page(390, 844)
        page.get_by_role('button', name='Resume lesson', exact=True).click()
        transport = page.locator('#mirror-main-play')
        expect(transport).to_be_enabled()
        transport.click()
        page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > .2)')
        page.get_by_role('button', name='Player settings', exact=True).click()
        page.get_by_role('tab', name='Lesson', exact=True).click()
        page.get_by_role('button', name='Delete', exact=True).click()
        page.get_by_role('button', name='Delete lesson', exact=True).click()
        saved = fixture.wait_for_library(page, lambda value: len(value['lessons']) == 1, 'lesson removed')
        assert saved['courses'][0]['lessonIds'] == ['second']
        assert saved['collections'][0]['lessonIds'] == ['second']
        assert saved['lessons'][0]['statuses']['cue']['practised']
        assert saved['lessons'][0]['progress']['coverage'] == [[.1, .2]]
        assert page.request.get(fixture.origin + asset['url']).status == 200
        page.locator('.mobile-nav [data-view=home]').click()
        page.get_by_role('button', name='Browse reference shelves', exact=True).click()
        page.locator('[data-action=home-course]').first.click()
        page.get_by_role('button', name='Continue', exact=True).click()
        expect(page.locator('.player-title')).to_contain_text('Second fixture')
        expect(transport).to_be_enabled()
        transport.click()
        page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > .2)')
        page.get_by_role('button', name='Finish practice', exact=True).click()
        saved = fixture.wait_for_library(page, lambda value: len(value['sessions']) == 1, 'surviving lesson session')
        assert saved['sessions'][0]['lessonId'] == 'second'
        assert not errors, errors
        print('PASS Player delete, course Continue, shared audio and saved progress at 390×844.')


if __name__ == '__main__':
    run()
