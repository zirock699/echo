"""Keep the active transcript and player controls aligned while media and the queue change state."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def seed(fixture, audio):
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
        'sessions': [], 'collections': [], 'courses': [], 'lastLessonId': 'desk-reference',
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


def open_player(fixture, audio, width, height, *, mobile=True):
    seed(fixture, audio)
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


def check_docked_queue(fixture, audio):
    page, errors = open_player(fixture, audio, 1440, 900, mobile=False)
    opener = page.get_by_role('button', name='Phrase queue', exact=True)
    queue = page.get_by_role('complementary', name='Phrase queue', exact=True)
    closed = positions(page, transcript=False)
    opener.press('Enter')
    expect(queue.locator('.phrase-row.selected')).to_have_attribute('data-row-id', 'deadline')
    assert_aligned(closed, positions(page, transcript=False), '1440×900 docked queue opened')
    assert page.evaluate('''selectors => {
        const stage = document.querySelector('.phrase-panel').getBoundingClientRect();
        const queue = document.querySelector('.queue-panel').getBoundingClientRect();
        return stage.right <= queue.left + 1 && selectors.every(selector => {
            const button = document.querySelector(selector);
            const {left, top, width, height} = button.getBoundingClientRect();
            return button.contains(document.elementFromPoint(left + width / 2, top + height / 2));
        });
    }''', list(closed)), 'The queue must leave the transcript and transport usable'
    opener.press('Enter')
    expect(queue).to_have_count(0)
    assert_aligned(closed, positions(page, transcript=False), '1440×900 docked queue closed')
    assert not errors, errors
    page.context.close()


def run():
    with browser_fixture(__doc__, 'native generated WAV and measured transcript/control positions') as fixture:
        wav = io.BytesIO()
        with wave.open(wav, 'wb') as pcm:
            pcm.setparams((1, 2, 8000, 0, 'NONE', ''))
            pcm.writeframes(bytes(16 * 8000 * 2))
        audio = fixture.upload_audio(wav.getvalue(), 'audio/wav')
        for width, height in ((320, 568), (844, 390)):
            check_transport(fixture, audio, width, height)
        check_docked_queue(fixture, audio)
        print('PASS paused Resume and stable transcript, Replay, Play, and Next through playback and docked queue changes.')


if __name__ == '__main__':
    run()
