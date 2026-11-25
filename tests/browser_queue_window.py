"""Exercise bounded cue ranges, source order, and native playback in the phrase queue."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def seed(fixture, audio, cue_index):
    cues = [{'id': f'cue-{index}', 'start': index / 4, 'end': index / 4 + .2,
             'text': f'Practice cue {index + 1}'} for index in range(1200)]
    lesson = {
        'id': 'long-lesson', 'title': 'Long practice recording', 'videoId': 'long-queue',
        'audio': audio, 'mediaSource': 'audio', 'duration': 305, 'phrases': cues, 'segments': cues,
        'statuses': {cue['id']: {'difficult': True} for cue in cues[::3]} |
                    {'cue-1199': {'difficult': True}},
        'ambientPalette': {'version': 1, 'videoId': 'long-queue', 'source': 'fallback', 'colours': []},
        'progress': {'phraseId': cues[cue_index]['id'], 'position': cues[cue_index]['start'] + .05},
    }
    fixture.save_library({
        'lessons': [lesson], 'sessions': [], 'collections': [], 'courses': [], 'lastLessonId': lesson['id'],
        'preferences': {'theme': 'light', 'startupLesson': 'none', 'mode': 'continuous',
                        'originalPlaybackVersion': 1},
    })


def open_player(fixture, width, height, *, mobile=True):
    page, errors = fixture.open_page(width, height, mobile=mobile)
    page.emulate_media(reduced_motion='reduce')
    page.get_by_role('button', name='Resume lesson', exact=True).press('Enter')
    expect(page.locator('#mirror-main-play')).to_be_enabled()
    return page, errors


def active_row(queue, cue_id):
    row = queue.locator('.phrase-row.selected')
    expect(row).to_have_attribute('data-row-id', cue_id)
    assert row.evaluate('''row => {
        const box = row.getBoundingClientRect(), list = row.closest('#queue-list').getBoundingClientRect();
        return box.top >= list.top - 1 && box.bottom <= list.bottom + 1;
    }''')


def mobile_queue(fixture, audio):
    seed(fixture, audio, 1170)
    page, errors = open_player(fixture, 320, 568)
    transport = page.locator('#mirror-main-play')
    opener = page.get_by_role('button', name='Phrase queue', exact=True)
    queue = page.get_by_role('dialog', name='Phrase queue')
    chooser = queue.get_by_role('combobox', name='Phrase range')
    rows = queue.locator('.phrase-row')
    opener.press('Enter')
    expect(queue.get_by_role('button', name='Close queue')).to_be_focused()
    expect(rows).to_have_count(80)
    expect(chooser).to_have_value('14')
    active_row(queue, 'cue-1170')

    chooser.press('Home')
    expect(chooser).to_be_focused()
    expect(chooser).to_have_value('0')
    expect(rows.first).to_have_attribute('data-row-id', 'cue-0')
    chooser.press('ArrowDown')
    expect(chooser).to_have_value('1')
    chooser.select_option(label='Phrases 561–640')
    expect(rows.first).to_have_attribute('data-row-id', 'cue-560')
    expect(rows.last).to_have_attribute('data-row-id', 'cue-639')
    expect(rows).to_have_count(80)
    row = queue.locator('[data-row-id=cue-580]')
    row.get_by_role('button', name='Phrase actions').tap()
    mark = row.locator('[data-status=practised]')
    mark.focus()
    scroll = queue.locator('#queue-list').evaluate('list => list.scrollTop')
    assert scroll > 0
    mark.press('Enter')
    expect(mark).to_be_focused()
    expect(mark).to_have_text('Unmark practised')
    expect(row.locator('[data-status=difficult]')).to_have_text('Mark difficult')
    assert abs(queue.locator('#queue-list').evaluate('list => list.scrollTop') - scroll) <= 1

    queue.get_by_role('button', name='Current phrase').press('Enter')
    expect(chooser).to_have_value('14')
    active_row(queue, 'cue-1170')
    page.keyboard.press('Escape')
    expect(opener).to_be_focused()
    transport.click()
    page.wait_for_function('media.some(audio => !audio.paused)')
    # Short cue transitions replace the button. Dispatch through the live DOM control.
    page.evaluate('document.getElementById("phrase-queue-toggle").click()')
    page.wait_for_function('media.every(audio => audio.paused)')
    page.keyboard.press('Escape')
    page.wait_for_function('media.some(audio => !audio.paused)')
    page.evaluate('document.getElementById("mirror-main-play").click()')
    page.wait_for_function('media.every(audio => audio.paused)')

    page.get_by_role('button', name='Player settings', exact=True).press('Enter')
    options = page.get_by_role('dialog', name='Options')
    options.get_by_role('tab', name='Practice').press('Enter')
    options.locator('#practice-selection').select_option('difficult')
    options.get_by_role('button', name='Apply selection').press('Enter')
    opener.press('Enter')
    expect(queue.get_by_text('401 selected phrases', exact=True)).to_be_visible()
    chooser.select_option(label='Phrases 1–238')
    expect(rows.nth(1).locator('.phrase-row-num')).to_have_text('4')
    chooser.select_option(label='Phrase 1200')
    expect(rows).to_have_count(1)
    expect(rows.first.locator('.phrase-row-num')).to_have_text('1200')
    rows.first.get_by_role('button', name='Phrase actions').click()
    expect(rows.first.get_by_role('button', name='Merge with next')).to_be_disabled()
    rows.first.locator('[data-action=select-phrase]').press('Enter')
    expect(queue).to_be_hidden()
    expect(opener).to_be_focused()
    expect(page.locator('#active-phrase')).to_have_text('Practice cue 1200')

    opener.press('Enter')
    moved = queue.locator('[data-row-id=cue-1199]')
    moved.get_by_role('button', name='Phrase actions').click()
    moved.get_by_role('button', name='Edit text / timing').click()
    edit = page.get_by_role('dialog', name='Edit phrase')
    edit.locator('#edit-start').fill('299.1')
    edit.get_by_role('button', name='Save edits').click()
    expect(edit).to_be_hidden()
    opener.press('Enter')
    expect(chooser).to_have_value('4')
    expect(moved.locator('.phrase-row-num')).to_have_text('1198')
    moved.get_by_role('button', name='Phrase actions').click()
    expect(moved.get_by_role('button', name='Merge with next')).to_be_enabled()
    fixture.wait_for_library(page, lambda data: (
        data['lessons'][0]['phrases'][1197]['id'] == 'cue-1199' and
        data['lessons'][0]['statuses']['cue-580']['practised']
    ), 'timing edit and practice mark persisted')
    assert not errors, errors
    page.context.close()


def desktop_queue(fixture, audio):
    seed(fixture, audio, 78)
    page, errors = open_player(fixture, 1440, 900, mobile=False)
    transport = page.locator('#mirror-main-play')
    page.get_by_role('button', name='Phrase queue', exact=True).press('Enter')
    queue = page.get_by_role('complementary', name='Phrase queue')
    chooser = queue.get_by_role('combobox', name='Phrase range')
    active_row(queue, 'cue-78')
    chooser.select_option(label='Phrases 561–640')
    transport.click()
    page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > 20.5)')
    expect(chooser).to_have_value('7')
    page.evaluate('document.getElementById("mirror-main-play").click()')
    page.wait_for_function('media.every(audio => audio.paused)')

    jump = queue.get_by_role('button', name='Current phrase')
    jump.press('Enter')
    expect(chooser).to_have_value('1')
    active_row(queue, page.locator('#active-phrase').get_attribute('data-phrase'))
    queue.locator('[data-row-id=cue-159] [data-action=select-phrase]').press('Enter')
    expect(page.locator('#active-phrase')).to_have_text('Practice cue 160')
    queue.locator('#queue-list').evaluate('list => { list.scrollTop = 0; }')
    jump.evaluate('button => button.click()')
    expect(jump).to_be_focused()
    active_row(queue, 'cue-159')
    transport.click()
    page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > 40.5)')
    expect(chooser).to_have_value('2')
    expect(queue.locator('.phrase-row')).to_have_count(80)
    page.evaluate('document.getElementById("mirror-main-play").click()')
    assert not errors, errors
    page.context.close()


def run():
    recording = io.BytesIO()
    with wave.open(recording, 'wb') as wav:
        wav.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        wav.writeframes(bytes(2 * 8000 * 305))
    for scenario in (mobile_queue, desktop_queue):
        with browser_fixture(__doc__, '1,200 cue generated WAV') as fixture:
            scenario(fixture, fixture.upload_audio(recording.getvalue(), 'audio/wav'))
    print('PASS bounded mobile ranges, keyboard, filtered ordinals, marks and desktop playback following.')


if __name__ == '__main__':
    run()
