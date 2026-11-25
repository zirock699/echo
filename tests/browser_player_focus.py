"""Verify sheet focus and keyboard editing in an owned loopback player."""

import io
import re
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def seed_lesson(fixture):
    recording = io.BytesIO()
    with wave.open(recording, 'wb') as wav:
        wav.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        wav.writeframes(bytes(8000 * 2 * 80))
    audio = fixture.upload_audio(recording.getvalue(), 'audio/wav')
    phrases = [{'id': 'repeated', 'start': 0, 'end': 31, 'text': 'Repeat repeat the phrase.'}]
    phrases += [
        {'id': f'q{index}', 'start': 32 + index * 2, 'end': 33 + index * 2, 'text': f'Context phrase {index}'}
        for index in range(20)
    ]
    fixture.save_library({
        'lessons': [{'id': 'focus-lesson', 'title': 'Focus practice', 'audio': audio, 'mediaSource': 'audio',
                     'duration': 80, 'phrases': phrases, 'segments': phrases,
                     'progress': {'phraseId': 'repeated', 'position': 0}}],
        'sessions': [], 'collections': [],
        'lastLessonId': 'focus-lesson',
        'preferences': {'startupLesson': 'none', 'mode': 'continuous', 'theme': 'dark', 'leadIn': 0},
    })


def verify_playback_options(fixture, page):
    transport = page.locator('#mirror-main-play')
    settings = page.get_by_role('button', name='Player settings', exact=True)
    options = page.get_by_role('dialog', name='Options')
    expect(transport).to_be_enabled()
    transport.click()
    page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > .3)')
    settings.press('Enter')
    expect(options.get_by_role('button', name='Close dialog')).to_be_focused()

    speaking_pause = options.locator('#player-pause-detail')
    speaking_pause.locator('summary').press('Enter')
    expect(speaking_pause).to_have_attribute('open', '')
    pause_type = speaking_pause.locator('#player-pause')
    pause_type.focus()
    old_sheet = options.element_handle()
    scroll_top = page.evaluate('''() => {
        const sheet = document.querySelector('[data-focus-dialog="app:player-settings"]');
        sheet.scrollTop = sheet.scrollHeight;
        return sheet.scrollTop;
    }''')
    assert scroll_top > 0
    fixture.wait_for_library(page, lambda data: data['lessons'][0]['progress']['position'] > 4,
                             'coalesced playback progress', timeout=25)
    page.wait_for_function('(previous) => !previous.isConnected', arg=old_sheet)
    expect(speaking_pause).to_have_attribute('open', '')
    expect(pause_type).to_be_focused()
    assert page.evaluate('document.querySelector(\'[data-focus-dialog="app:player-settings"]\').scrollTop') == scroll_top
    assert options.evaluate('(sheet) => getComputedStyle(sheet).animationName') == 'none'
    assert page.evaluate('media.filter(audio => !audio.paused).length') == 1

    options.get_by_role('tab', name='Playback').press('ArrowRight')
    practice = options.get_by_role('tab', name='Practice')
    practice.press('Enter')
    expect(practice).to_be_focused()
    expect(options.locator('[role=tab][tabindex="0"]')).to_have_count(1)
    expect(options.locator('button[data-status=practised]')).to_have_count(1)
    expect(options.locator('button[data-status=difficult]')).to_have_count(1)
    page.go_back()
    expect(options).to_be_hidden()
    expect(settings).to_be_focused()
    transport.click()
    page.wait_for_function('media.every(audio => audio.paused)')


def verify_queue_and_ipa(page):
    opener = page.get_by_role('button', name='Phrase queue', exact=True)
    queue = page.get_by_role('dialog', name='Phrase queue')
    close = queue.get_by_role('button', name='Close queue')
    opener.press('Enter')
    expect(close).to_be_focused()
    page.keyboard.press('Shift+Tab')
    expect(queue.get_by_role('button', name='Regroup phrases')).to_be_focused()
    page.keyboard.press('Tab')
    expect(close).to_be_focused()
    page.keyboard.press('Escape')
    expect(opener).to_be_focused()

    second_word = page.locator('#active-phrase .word').nth(1)
    pronunciation = page.get_by_role('dialog', name='Pronunciation')
    second_word.press('Enter')
    expect(pronunciation.get_by_role('button', name='Close dialog')).to_be_focused()
    pronunciation.get_by_role('button', name='Edit IPA').press('Enter')
    expect(page.get_by_role('dialog', name='Correct British IPA')).to_be_visible()
    page.keyboard.press('Escape')
    expect(second_word).to_be_focused()
    second_word.tap()
    expect(pronunciation).to_be_visible()
    page.go_back()
    expect(pronunciation).to_be_hidden()
    expect(second_word).to_be_focused()

    page.get_by_role('button', name='Recording timeline', exact=True).press('Enter')
    timeline = page.get_by_role('dialog', name='Playback position')
    inline_clock = page.locator('#phrase-clock').text_content()
    assert inline_clock and '/' in inline_clock
    expect(timeline.locator('#dialog-phrase-clock')).to_have_text(inline_clock)
    page.keyboard.press('Escape')

    opener.tap()
    expect(queue).to_be_visible()
    row = queue.locator('[data-row-id=q18]')
    menu = row.get_by_role('button', name='Phrase actions')
    menu.click()
    expect(menu).to_be_focused()
    mark = row.get_by_role('button', name='Mark practised')
    mark.focus()
    read_scroll = '() => document.getElementById("queue-list").scrollTop'
    position = page.evaluate('''() => {
        const list = document.getElementById('queue-list');
        list.scrollTop -= 32;
        return list.scrollTop;
    }''')
    assert position > 0
    page.keyboard.press('Enter')
    expect(row.get_by_role('button', name='Unmark practised')).to_be_focused()
    assert abs(page.evaluate(read_scroll) - position) <= 1
    positions = page.evaluate('''() => {
        return ['difficult', 'practised'].map(status => {
            const list = document.querySelector('#queue-list');
            list.querySelector(`[data-row-id=q18] [data-status=${status}]`).click();
            const replacement = document.querySelector('#queue-list');
            return [replacement !== list, replacement.scrollTop];
        });
    }''')
    assert all(replaced and abs(scroll - position) <= 1 for replaced, scroll in positions), positions
    page.evaluate('() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))')
    assert abs(page.evaluate(read_scroll) - position) <= 1
    assert queue.evaluate('(sheet) => getComputedStyle(sheet).animationName') == 'none'
    row.locator('[data-action=select-phrase]').press('Enter')
    expect(queue).to_be_hidden()
    expect(opener).to_be_focused()
    expect(page.locator('#active-phrase')).to_have_text('Context phrase 18')
    opener.press('Enter')
    page.go_back()
    expect(queue).to_be_hidden()
    expect(opener).to_be_focused()


def verify_import_focus(fixture, page):
    page.go_back()
    expect(page.get_by_role('heading', name='Rehearse the change.')).to_be_visible()
    opener = page.locator('#rehearsal-add')
    opener.press('Enter')
    page.get_by_role('dialog', name='Add lessons').get_by_role('button', name='YouTube lesson').click()
    importer = page.get_by_role('dialog', name='Create a lesson')
    url = importer.locator('#import-url')
    url.fill('Incomplete video URL')
    url.evaluate('(field) => field.setSelectionRange(3, 8, "backward")')

    def refresh_library(held):
        old_control = held.element_handle()
        data = fixture.state()['data']
        preferences = data['preferences']
        preferences['reduceMotion'] = not preferences.get('reduceMotion', False)
        fixture.save_library(data)
        page.evaluate("window.dispatchEvent(new Event('online'))")
        page.wait_for_function('(previous) => !previous.isConnected', arg=old_control)
        expect(held).to_be_focused()

    refresh_library(url)
    assert url.evaluate('(field) => [field.selectionStart,field.selectionEnd,field.selectionDirection]') == [3, 8, 'backward']
    expect(url).to_have_value('Incomplete video URL')

    def unavailable(route):
        if route.request.method == 'GET':
            route.fulfill(status=503)
        else:
            route.continue_()

    page.route('**/api/state', unavailable)
    composing = url.element_handle()
    composing.evaluate("field => field.dispatchEvent(new CompositionEvent('compositionstart', {bubbles:true}))")
    with page.expect_response(lambda response: response.url.endswith('/api/state') and response.status == 503):
        page.evaluate("window.dispatchEvent(new Event('online'))")
    page.wait_for_timeout(200)
    assert composing.evaluate('field => field === document.activeElement && field.isConnected')
    composing.evaluate("field => field.dispatchEvent(new CompositionEvent('compositionend', {bubbles:true}))")
    page.wait_for_function('(previous) => !previous.isConnected', arg=composing)
    expect(url).to_be_focused()
    page.unroute('**/api/state', unavailable)

    importer.get_by_role('button', name='Preview phrases').press('Enter')
    alert = importer.get_by_role('alert')
    expect(alert).to_have_text(re.compile(r'Enter a valid YouTube'))
    expect(alert).to_be_focused()
    refresh_library(alert)
    page.keyboard.press('Escape')
    expect(importer).to_be_hidden()
    expect(opener).to_be_focused()


def verify_native_select(fixture, page):
    transport = page.locator('#mirror-main-play')
    settings = page.get_by_role('button', name='Player settings', exact=True)
    queue = page.get_by_role('complementary', name='Phrase queue')
    queue.locator('[data-action=select-phrase][data-id=repeated]').press('Enter')
    page.get_by_role('button', name='Phrase queue', exact=True).press('Enter')
    expect(transport).to_be_enabled()
    transport.click()
    page.wait_for_function('media.some(audio => !audio.paused && audio.currentTime > .3)')
    settings.press('Enter')
    options = page.get_by_role('dialog', name='Options')
    lead = options.get_by_label('Lead-in')
    lead.press('Space')
    expect(options.locator('select:open')).to_have_count(1)
    picker = lead.element_handle()
    fixture.wait_for_library(page, lambda data: 4 < data['lessons'][0]['progress']['position'] < 31,
                             'coalesced progress with open native picker', timeout=25)
    assert picker.evaluate('select => select.isConnected && select.matches(":open")')
    page.keyboard.press('Escape')
    expect(options.locator('select:open')).to_have_count(0)
    expect(options).to_be_visible()
    page.wait_for_function('(previous) => !previous.isConnected', arg=picker)
    expect(lead).to_be_focused()
    page.keyboard.press('Escape')
    expect(options).to_be_hidden()
    expect(settings).to_be_focused()


def run():
    with browser_fixture(__doc__, 'native WAV and keyboard/touch navigation') as fixture:
        seed_lesson(fixture)
        page, errors = fixture.open_page(320, 568)
        page.get_by_role('button', name='Resume lesson', exact=True).click()
        verify_playback_options(fixture, page)
        verify_queue_and_ipa(page)
        verify_import_focus(fixture, page)
        assert not errors, errors
        page.context.close()

        page, errors = fixture.open_page(1440, 900, mobile=False)
        page.get_by_role('button', name='Resume lesson', exact=True).click()
        opener = page.get_by_role('button', name='Phrase queue', exact=True)
        opener.press('Enter')
        expect(page.get_by_role('complementary', name='Phrase queue')).to_be_visible()
        expect(opener).to_be_focused()
        page.keyboard.press('Tab')
        assert not page.evaluate('document.activeElement.closest(".queue-panel")')
        verify_native_select(fixture, page)
        assert not errors, errors
        print('PASS sheet focus, passive saves, validation, composition, desktop queue and native picker.')


if __name__ == '__main__':
    run()
