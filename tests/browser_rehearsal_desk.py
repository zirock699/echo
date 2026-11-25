"""Verify player alignment, docked queue access, and the Journal return journey."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def seed(fixture, audio, *, sessions=()):
    phrases = [
        {'id': 'deadline', 'start': 1, 'end': 11,
         'text': 'We can move the deadline to Thursday. In the meantime, could you check the figures?'},
        {'id': 'next', 'start': 12, 'end': 15, 'text': 'Let me know on Friday.'},
    ]
    fixture.save_library({
        'lessons': [{
            'id': 'desk-reference', 'title': 'Move a deadline', 'videoId': 'deskTest001',
            'audio': audio, 'mediaSource': 'audio', 'duration': 16,
            'phrases': phrases, 'segments': phrases, 'statuses': {},
            'ambientPalette': {'version': 1, 'videoId': 'deskTest001', 'source': 'fallback', 'colours': []},
            'progress': {'phraseId': 'deadline', 'position': 2},
        }],
        'sessions': list(sessions), 'collections': [], 'courses': [], 'lastLessonId': 'desk-reference',
        'preferences': {'theme': 'dark', 'startupLesson': 'none', 'mode': 'manual',
                        'queueOpen': False, 'originalPlaybackVersion': 1},
    })


def positions(page, *, transcript=True):
    expect(page.locator('#active-phrase')).to_have_attribute('data-phrase', 'deadline')
    return page.evaluate('''transcript => {
        const selectors = transcript ? ['#active-phrase', '.phrase-panel'] : [];
        selectors.push('.reset-phrase', '#mirror-main-play', '.practice-next');
        return Object.fromEntries(selectors.map(selector => {
            const {left, top, width, height} = document.querySelector(selector).getBoundingClientRect();
            return [selector, [left, top, width, height]];
        }));
    }''', transcript)


def assert_aligned(before, after, transition):
    for selector, origin in before.items():
        delta = [round(end - start, 2) for start, end in zip(origin, after[selector])]
        assert all(abs(change) <= 1 for change in delta), (transition, selector, delta)


def open_player(fixture, audio, width, height, *, mobile=True, sessions=()):
    seed(fixture, audio, sessions=sessions)
    page, errors = fixture.open_page(width, height, mobile=mobile)
    page.emulate_media(reduced_motion='reduce')
    page.get_by_role('button', name='Resume lesson', exact=True).press('Enter')
    expect(page.get_by_role('button', name='Play', exact=True)).to_be_enabled()
    page.wait_for_function('''media.some(audio => audio.readyState >= 2 && audio.paused &&
                            !audio.seeking && Math.abs(audio.currentTime - 2) < .04)''')
    page.evaluate('document.fonts.ready')
    return page, errors


def check_transport(fixture, audio, width, height):
    page, errors = open_player(fixture, audio, width, height)
    paused = positions(page)
    page.get_by_role('button', name='Play', exact=True).click()
    page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > 2.15)')
    expect(page.get_by_role('button', name='Pause', exact=True)).to_be_visible()
    assert_aligned(paused, positions(page), f'{width}×{height} Play')
    page.get_by_role('button', name='Pause', exact=True).click()
    page.wait_for_function('media.every(audio => audio.paused)')
    assert_aligned(paused, positions(page), f'{width}×{height} Pause')
    assert not errors, errors
    page.context.close()


def check_docked_queue(fixture, audio, width, height):
    page, errors = open_player(fixture, audio, width, height, mobile=width < 1000)
    opener = page.get_by_role('button', name='Phrase queue', exact=True)
    queue = page.get_by_role('complementary', name='Phrase queue', exact=True)
    closed = positions(page, transcript=False)
    opener.press('Enter')
    expect(queue.locator('.phrase-row.selected')).to_have_attribute('data-row-id', 'deadline')
    assert_aligned(closed, positions(page, transcript=False), f'{width}×{height} docked queue opened')
    assert page.evaluate('''selectors => {
        const stage = document.querySelector('.phrase-panel').getBoundingClientRect();
        const queue = document.querySelector('.queue-panel').getBoundingClientRect();
        return stage.right <= queue.left + 1 && selectors.every(selector => {
            const button = document.querySelector(selector);
            const {left, top, width, height} = button.getBoundingClientRect();
            return button.contains(document.elementFromPoint(left + width / 2, top + height / 2));
        });
    }''', [*closed, '#phrase-queue-toggle', '#mirror-compare']), 'The queue must leave the transcript and transport usable'
    opener.press('Enter')
    expect(queue).to_have_count(0)
    assert_aligned(closed, positions(page, transcript=False), f'{width}×{height} docked queue closed')
    assert not errors, errors
    page.context.close()


def check_journal(fixture, audio):
    older_session = {'id': 'older-desk-session', 'lessonId': 'desk-reference', 'mode': 'manual'}
    page, errors = open_player(fixture, audio, 390, 844, sessions=(older_session,))
    player = page.get_by_role('main', name='Practice player')
    player.get_by_role('button', name='Play', exact=True).press('Enter')
    page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > 2.35)')
    player.get_by_role('button', name='Player settings', exact=True).press('Enter')
    options = page.get_by_role('dialog', name='Options', exact=True)
    options.get_by_role('tab', name='Practice', exact=True).press('Enter')
    options.get_by_role('button', name='Finish session', exact=True).press('Enter')

    summary = page.get_by_role('dialog', name='Session complete', exact=True)
    expect(summary).to_be_visible()
    draft = fixture.wait_for_library(page, lambda data: len(data['sessions']) == 2, 'completed session before adding a note')
    completed = draft['sessions'][0]
    assert completed['lessonId'] == 'desk-reference' and completed['coveredIds'] == ['deadline']
    assert completed['activeSeconds'] > 0
    page.wait_for_function('media.every(audio => audio.paused && !audio.seeking)')
    position = page.evaluate("media.find(audio => audio.currentSrc.includes('/api/audio/')).currentTime")

    note = 'Keep <Thursday> clear before asking.'
    summary.get_by_text('Note for next time', exact=True).click()
    summary.get_by_role('textbox', name='What would you like to try again?', exact=True).fill(note)
    # Let the ordinary one-second Store debounce elapse before inspecting the account copy.
    page.wait_for_timeout(1200)
    assert 'journalNote' not in fixture.state()['data']['sessions'][0], 'Typing must leave the note a private draft'
    summary.get_by_role('button', name='Save note', exact=True).press('Enter')
    saved = fixture.wait_for_library(
        page, lambda data: data['sessions'][0].get('journalNote') == note, 'explicit Journal note save',
    )
    assert saved['sessions'][0]['id'] == completed['id']
    assert saved['sessions'][0]['coveredIds'] == completed['coveredIds']
    assert abs(saved['lessons'][0]['progress']['position'] - position) < .08

    summary.get_by_role('button', name='View Journal', exact=True).click()
    journal = page.locator('.rehearsal-journal')
    expect(journal.get_by_role('heading', name='Journal', exact=True)).to_be_visible()
    expect(journal.get_by_text(note, exact=True)).to_be_visible()
    expect(journal.locator('thursday')).to_have_count(0)
    expect(journal.get_by_role('button', name='Open saved reference', exact=True)).to_have_count(2)

    # Open the older of two rows for this lesson so focusing the first match fails the check.
    opener = journal.locator('#journal-resume-older-desk-session')
    opener.press('Enter')
    expect(player.locator('#active-phrase')).to_have_attribute('data-phrase', 'deadline')
    expect(player.get_by_role('button', name='Play', exact=True)).to_be_enabled()
    page.wait_for_function('''position => media.some(audio => audio.currentSrc.includes('/api/audio/') &&
                            audio.paused && !audio.seeking && Math.abs(audio.currentTime - position) < .08)''', arg=position)
    page.go_back()
    expect(journal).to_be_visible()
    expect(opener).to_be_focused()
    page.reload(wait_until='domcontentloaded')
    expect(journal.get_by_text(note, exact=True)).to_be_visible()
    assert not errors, errors
    page.context.close()
    print('PASS 390×844 Journal completion, explicit note save, exact paused resume, and Back to the initiating row.')


def run():
    with browser_fixture(__doc__, 'native generated WAV and measured transcript/control positions') as fixture:
        wav = io.BytesIO()
        with wave.open(wav, 'wb') as pcm:
            pcm.setparams((1, 2, 8000, 0, 'NONE', ''))
            pcm.writeframes(bytes(16 * 8000 * 2))
        audio = fixture.upload_audio(wav.getvalue(), 'audio/wav')
        for width, height in ((320, 568), (844, 390)):
            check_transport(fixture, audio, width, height)
        for width, height in ((820, 1180), (1440, 900)):
            check_docked_queue(fixture, audio, width, height)
        print('PASS paused Resume and stable transcript, Replay, Play, and Next through playback and docked queue changes.')
        check_journal(fixture, audio)


if __name__ == '__main__':
    run()
