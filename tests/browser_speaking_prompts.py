"""Check local speaking prompts, focus and paused native playback in Chromium."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


HOME_ACTION = 'Talk now'
HOME_TITLE = 'Speaking prompt'
HOME_EXIT = 'Back to Rehearse'
TRANSFER_ACTION = 'Try a new conversation'
TRANSFER_TITLE = 'Take a phrase into a new conversation'
TRANSFER_EXIT = 'Back to Practice options'
PLAYER_TRANSFER_EXIT = 'Back to player'
LESSON_TITLE = 'Speaking prompt fixture'
LESSON_VIDEO = 'EchoPrompt1'
PHRASES = [
    {'id': 'first', 'start': .25, 'end': 1.15, 'text': 'Could you send the example?'},
    {'id': 'second', 'start': 2, 'end': 3.2, 'text': 'Leave it by the side door.'},
]
SPEAKING_PAUSE = 3
CUE_CLOCK = 'window.media.find(audio => audio.currentSrc.includes("/api/audio/"))'


def seed_lesson(fixture, audio, *, theme, mode, queue=False, with_course=False):
    course = {'id': 'speaking-course', 'title': 'Short speaking course', 'lessonIds': ['speaking-prompt-lesson']}
    collection = {'id': 'speaking-collection', 'name': 'Workday examples', 'lessonIds': ['speaking-prompt-lesson']}
    fixture.save_library({
        'lessons': [{
            'id': 'speaking-prompt-lesson', 'title': LESSON_TITLE, 'videoId': LESSON_VIDEO,
            'audio': audio, 'mediaSource': 'audio', 'duration': 8, 'createdAt': 1,
            'favourite': True, 'courseId': course['id'] if with_course else None,
            'phrases': PHRASES, 'segments': PHRASES,
            'ambientPalette': {'version': 1, 'videoId': LESSON_VIDEO, 'colours': [], 'source': 'fallback'},
            'statuses': {'first': {'practised': True}, 'second': {'difficult': True}},
            'progress': {'phraseId': 'first', 'position': .25, 'coverage': [[.25, .5]]},
        }],
        'sessions': [{'id': 'previous-session', 'lessonId': 'speaking-prompt-lesson',
                      'coveredIds': ['first'], 'activeSeconds': .25}],
        'courses': [course] if with_course else [], 'collections': [collection] if with_course else [],
        'lastLessonId': 'speaking-prompt-lesson',
        'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1, 'theme': theme,
                        'mode': mode, 'pauseType': 'fixed', 'fixedPause': SPEAKING_PAUSE,
                        'leadIn': 0, 'queueOpen': queue},
    })


def make_recording(fixture):
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        wav.writeframes(bytes(8000 * 2 * 8))
    return fixture.upload_audio(buffer.getvalue(), 'audio/wav')


def observe_prompt_effects(page):
    page.evaluate('''() => {
        window.promptMicrophoneCalls = 0;
        navigator.mediaDevices.getUserMedia = async () => {
            window.promptMicrophoneCalls++;
            throw new Error('A prompt must not request the microphone');
        };
    }''')
    requests = []
    page.on('request', lambda request: requests.append((request.method, request.url)))
    return requests


def expect_no_prompt_effects(page, fixture, requests):
    assert page.evaluate('window.promptMicrophoneCalls') == 0
    ordinary_gets = {
        fixture.origin + '/api/state',
        *(f'https://i.ytimg.com/vi/{LESSON_VIDEO}/{size}default.jpg' for size in ('mq', 'hq')),
    }
    extra = [(method, url) for method, url in requests if method != 'GET' or url not in ordinary_gets]
    assert not extra, f'Unexpected requests during prompts: {extra}'


def enter_prompt(page, trigger, title):
    trigger.press('Enter')
    sheet = page.get_by_role('dialog', name=title, exact=True)
    expect(sheet).to_be_visible()
    expect(sheet).to_have_attribute('aria-modal', 'true')
    expect(sheet.get_by_role('heading', name=title, exact=True)).to_be_focused()
    return sheet


def expect_keyboard_containment(page, sheet):
    for key in ('Tab', 'Tab', 'Shift+Tab', 'Shift+Tab'):
        page.keyboard.press(key)
        assert sheet.evaluate('dialog => dialog.contains(document.activeElement)'), key


def expect_reachable_exit(sheet, name):
    exit_button = sheet.get_by_role('button', name=name, exact=True)
    assert sheet.evaluate('dialog => dialog.scrollWidth <= dialog.clientWidth + 1')
    exit_button.scroll_into_view_if_needed()
    expect(exit_button).to_be_in_viewport()


def scroll_open_prompt(page, sheet):
    page.evaluate("document.documentElement.style.zoom = '2'")
    position = sheet.evaluate('dialog => { dialog.scrollTop = dialog.scrollHeight; return dialog.scrollTop; }')
    assert position > 0, 'The enlarged cue must have a nonzero scroll position to retain'
    return sheet.element_handle(), position


def expect_retained_prompt(sheet, previous, position):
    assert sheet.evaluate('(dialog, previous) => dialog === previous && dialog.isConnected', previous)
    assert abs(sheet.evaluate('dialog => dialog.scrollTop') - position) <= 1


def close_prompt(page, sheet, exit_label, method, trigger):
    if method == 'button':
        sheet.get_by_role('button', name=exit_label, exact=True).click()
    elif method == 'escape':
        page.keyboard.press('Escape')
    else:
        page.go_back()
    expect(sheet).to_be_hidden()
    expect(trigger).to_be_focused()


def expect_home_prompt(sheet):
    expect(sheet.locator('.prompt-situation')).to_contain_text('Your colleague expects the figures on Tuesday')
    expect(sheet.locator('.prompt-task')).to_have_text('Say the update in your own words.')


def verify_empty_home(fixture):
    page, errors = fixture.open_page(320, 568)
    home = page.get_by_role('main')
    trigger = home.get_by_role('button', name=HOME_ACTION, exact=True)
    add = home.get_by_role('button', name='Add lessons', exact=True)
    expect(add).to_be_visible()
    assert trigger.evaluate("button => button.classList.contains('primary')")
    assert trigger.bounding_box()['y'] < add.bounding_box()['y']
    expect(trigger).to_be_in_viewport()
    expect(page.locator('body.dark')).to_be_visible()
    requests = observe_prompt_effects(page)
    before = fixture.state()
    for method in ('button', 'escape', 'back'):
        sheet = enter_prompt(page, trigger, HOME_TITLE)
        expect_home_prompt(sheet)
        expect_keyboard_containment(page, sheet)
        expect_reachable_exit(sheet, HOME_EXIT)
        close_prompt(page, sheet, HOME_EXIT, method, trigger)
    # Allow an ordinary Store edit to hit its debounce before checking for absence.
    page.wait_for_timeout(1200)
    expect_no_prompt_effects(page, fixture, requests)
    assert fixture.state() == before

    sheet = enter_prompt(page, trigger, HOME_TITLE)
    page.evaluate("document.documentElement.style.zoom = '2'")
    expect_home_prompt(sheet)
    expect_reachable_exit(sheet, HOME_EXIT)
    page.reload(wait_until='domcontentloaded')
    expect(home.get_by_role('heading', name='Rehearse the change.', exact=True)).to_be_visible()
    expect(sheet).to_be_hidden()
    assert not errors, errors
    page.context.close()
    print('PASS primary/cue-first empty dark Home, keyboard containment, all exits, 200% content zoom and reload at 320×568.')


def verify_stalled_account(fixture):
    page, errors = fixture.open_page(320, 568)
    expect(page.get_by_role('heading', name='Rehearse the change.', exact=True)).to_be_visible()
    # Leave the fresh document's account request pending while the cue is used.
    pending = []
    page.context.route(fixture.origin + '/api/state', lambda route: pending.append(route), times=1)
    with page.expect_request(fixture.origin + '/api/state'):
        page.reload(wait_until='domcontentloaded')
    expect(page.get_by_role('heading', name='Connecting')).to_be_visible()
    trigger = page.get_by_role('button', name=HOME_ACTION, exact=True)
    sheet = enter_prompt(page, trigger, HOME_TITLE)
    expect_home_prompt(sheet)
    previous, position = scroll_open_prompt(page, sheet)
    assert pending, 'The fixture must actually have held a state request'
    pending.pop(0).continue_()
    expect(page.locator('.home-screen h1')).to_have_text('Rehearse the change.')
    expect_home_prompt(sheet)
    expect_retained_prompt(sheet, previous, position)
    expect(sheet.get_by_role('heading', name=HOME_TITLE, exact=True)).to_be_focused()
    page.evaluate("document.documentElement.style.removeProperty('zoom')")
    close_prompt(page, sheet, HOME_EXIT, 'button', trigger)
    assert not errors, errors
    page.context.close()
    print('PASS Home cue node, scroll and heading focus across delayed owner verification at 320×568.')


def verify_offline_home(fixture):
    page, errors = fixture.open_page(390, 844, service_workers='allow')
    context = page.context
    resume = page.get_by_role('button', name='Resume lesson', exact=True)
    trigger = page.get_by_role('button', name=HOME_ACTION, exact=True)
    expect(resume).to_contain_text(LESSON_TITLE)
    expect(page.locator('body.light')).to_be_visible()
    page.wait_for_function("navigator.serviceWorker.controller?.state === 'activated'")
    requests = observe_prompt_effects(page)
    before = fixture.state()

    context.set_offline(True)
    sheet = enter_prompt(page, trigger, HOME_TITLE)
    expect_home_prompt(sheet)
    expect_reachable_exit(sheet, HOME_EXIT)
    close_prompt(page, sheet, HOME_EXIT, 'escape', trigger)
    expect(resume).to_contain_text(LESSON_TITLE)
    expect_no_prompt_effects(page, fixture, requests)

    # A cached shell must not unlock private metadata in a new offline document.
    cold = context.new_page()
    assert cold.goto(fixture.origin, wait_until='domcontentloaded').status == 200
    expect(cold.get_by_role('heading', name='Library unavailable')).to_be_visible()
    cold_trigger = cold.get_by_role('button', name=HOME_ACTION, exact=True)
    cold_sheet = enter_prompt(cold, cold_trigger, HOME_TITLE)
    expect_home_prompt(cold_sheet)
    close_prompt(cold, cold_sheet, HOME_EXIT, 'button', cold_trigger)
    expect(cold.get_by_role('button', name='Resume lesson', exact=True)).to_have_count(0)
    assert LESSON_TITLE not in cold.locator('#app').inner_text()
    assert fixture.state() == before
    assert not errors, errors
    context.close()
    print('PASS populated warm offline Home and cold cached private-library lock at 390×844.')


def wait_for_audio(page, predicate, target=None):
    page.wait_for_function(f'target => {{ const audio = {CUE_CLOCK}; return audio && ({predicate}); }}', arg=target)


def expect_paused_phrase(page, cue, position):
    expect(page.locator('#active-phrase')).to_have_text(cue['text'])
    expect(page.locator('#active-phrase')).to_have_attribute('data-phrase', cue['id'])
    wait_for_audio(page, 'audio.paused && !audio.seeking && Math.abs(audio.currentTime - target) < .06', position)


def verify_playing_home_prompt(fixture):
    page, errors = fixture.open_page(320, 568)
    before = fixture.state()['data']
    home = page.get_by_role('main')
    resume = home.get_by_role('button', name='Resume lesson', exact=True)
    trigger = home.get_by_role('button', name=HOME_ACTION, exact=True)
    expect(resume).to_contain_text(LESSON_TITLE)
    expect(trigger).to_be_visible()
    page.wait_for_function('''() => {
        const resume = document.querySelector('.home-resume');
        const cue = document.querySelector('#home-speaking-prompt');
        return resume && cue && cue.getBoundingClientRect().top < resume.getBoundingClientRect().top;
    }''')
    resume.click()
    expect_paused_phrase(page, PHRASES[0], PHRASES[0]['start'])
    page.get_by_role('button', name='Play', exact=True).click()
    wait_for_audio(page, '!audio.paused && audio.currentTime > .35')

    # Hold the first ordinary checkpoint request so it settles with the cue open.
    checkpoint_request = []
    state_url = fixture.origin + '/api/state'

    def hold_first_save(route):
        if route.request.method == 'PUT' and not checkpoint_request:
            checkpoint_request.append(route)
        else:
            route.continue_()

    page.route(state_url, hold_first_save)
    page.get_by_role('button', name='Back', exact=True).click()
    expect(page.get_by_role('heading', name='Rehearse the change.', exact=True)).to_be_visible()
    compact = page.get_by_role('region', name='Current audio lesson', exact=True)
    expect(compact.get_by_role('button', name='Pause audio', exact=True)).to_be_visible()
    wait_for_audio(page, '!audio.paused && audio.currentTime > .55')
    position_before_prompt = page.evaluate(CUE_CLOCK + '.currentTime')

    requests = observe_prompt_effects(page)
    sheet = enter_prompt(page, trigger, HOME_TITLE)
    expect_home_prompt(sheet)
    wait_for_audio(page, 'audio.paused && !audio.seeking')
    position = page.evaluate(CUE_CLOCK + '.currentTime')
    assert position >= position_before_prompt - .06, 'Opening the cue must not seek backward'

    previous, _ = scroll_open_prompt(page, sheet)
    exit_button = sheet.get_by_role('button', name=HOME_EXIT, exact=True)
    exit_button.focus()
    expect(exit_button).to_be_focused()
    focused_control = exit_button.element_handle()
    scroll_position = sheet.evaluate('dialog => dialog.scrollTop')
    assert scroll_position > 0
    old_home = page.locator('.home-screen').element_handle()
    assert checkpoint_request, 'The ordinary playback save must be held while the cue is open'
    with page.expect_response(lambda response: response.url == state_url and response.request.method == 'PUT') as saved_response:
        checkpoint_request[0].continue_()
    assert saved_response.value.ok
    page.wait_for_function('previous => !previous.isConnected', arg=old_home)
    expect_retained_prompt(sheet, previous, scroll_position)
    expect(exit_button).to_be_focused()
    assert focused_control.evaluate('button => button.isConnected && button === document.activeElement')

    # One normal playback checkpoint is allowed when Home interrupts listening.
    saved = fixture.wait_for_library(
        page, lambda data: abs(data['lessons'][0]['progress']['position'] - position) < .06
        and any(end > .5 for _, end in data['lessons'][0]['progress']['coverage']),
        'native Home cue playback checkpoint',
    )
    lesson = saved['lessons'][0]
    assert saved['lastLessonId'] == before['lastLessonId']
    assert [item['id'] for item in saved['lessons']] == [item['id'] for item in before['lessons']]
    assert lesson['courseId'] == before['lessons'][0]['courseId']
    assert lesson['favourite'] == before['lessons'][0]['favourite']
    assert lesson['statuses'] == before['lessons'][0]['statuses']
    assert saved['sessions'] == before['sessions'] and saved['collections'] == before['collections']
    assert [{k: v for k, v in course.items() if k != 'lastPlayedAt'} for course in saved['courses']] == before['courses']
    assert all(end <= position + .06 for _, end in lesson['progress']['coverage'])
    selected = next(cue for cue in PHRASES if cue['id'] == lesson['progress']['phraseId'])
    expect(page.locator('#compact-expand')).to_contain_text(selected['text'])
    checkpoint = fixture.state()

    # The original controls still exist, but cannot get focus or run shortcuts.
    control = page.locator('#compact-toggle')
    heading = sheet.get_by_role('heading', name=HOME_TITLE, exact=True)
    heading.focus()
    assert control.evaluate('element => Boolean(element.closest("[inert]"))')
    control.evaluate('element => element.focus()')
    expect(heading).to_be_focused()
    for key in ('Space', 'ArrowRight', 'r', 'q'):
        page.keyboard.press(key)
    expect(sheet).to_be_visible()

    expect_reachable_exit(sheet, HOME_EXIT)
    assert sheet.evaluate('''dialog => {
        const rect = dialog.getBoundingClientRect();
        const viewport = window.visualViewport;
        return rect.left >= -1 && rect.top >= -1 && rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1;
    }'''), 'The populated Home sheet should fit the visual viewport at 200% content zoom'
    page.evaluate("document.documentElement.style.removeProperty('zoom')")
    close_prompt(page, sheet, HOME_EXIT, 'button', trigger)
    page.wait_for_timeout(1200)
    wait_for_audio(page, 'audio.paused && Math.abs(audio.currentTime - target) < .06', position)
    expect(compact.get_by_role('button', name=f'Open player: {LESSON_TITLE}', exact=True)).to_contain_text(selected['text'])
    expect_no_prompt_effects(page, fixture, [r for r in requests if r != ('PUT', fixture.origin + '/api/state')])
    assert fixture.state() == checkpoint

    compact.get_by_role('button', name='Play audio', exact=True).click()
    wait_for_audio(page, '!audio.paused && audio.currentTime > target + .05', position)
    assert not errors, errors
    page.context.close()
    print('PASS Resume paused until explicit Play, native Home compact pause, and stable focused cue during checkpoint save at 320×568.')


def practice_options(page):
    page.get_by_role('button', name='Player settings', exact=True).click()
    options = page.get_by_role('dialog', name='Options', exact=True)
    options.get_by_role('tab', name='Practice', exact=True).click()
    expect(options.get_by_role('tab', name='Practice', exact=True)).to_have_attribute('aria-selected', 'true')
    return options, options.get_by_role('button', name=TRANSFER_ACTION, exact=True)


def expect_transfer_prompt(sheet):
    expect(sheet.locator('.prompt-situation')).to_contain_text('A teammate expects tomorrow’s meeting to be online.')
    expect(sheet.locator('.prompt-note')).to_contain_text(
        'borrow an expression or a way of emphasising a detail from your selected phrase',
    )


def verify_automatic_transfer(fixture):
    page, errors = fixture.open_page(390, 844)
    page.get_by_role('button', name='Resume lesson', exact=True).click()
    expect_paused_phrase(page, PHRASES[0], .25)
    before = fixture.state()['data']
    transport = page.locator('#mirror-main-play')
    expect(transport).to_be_enabled()
    transport.click()
    wait_for_audio(page, '!audio.paused && audio.currentTime > .25')
    direct = page.locator('#player-transfer-prompt')
    expect(direct).to_be_hidden()
    wait_for_audio(page, 'audio.paused && Math.abs(audio.currentTime - target) < .08', PHRASES[0]['end'])
    expect(transport).to_have_attribute('aria-label', 'Pause')
    expect(direct).to_be_visible(timeout=1500)
    options, trigger = practice_options(page)
    expect(transport).to_have_attribute('aria-label', 'Pause')
    position = page.evaluate(CUE_CLOCK + '.currentTime')
    assert abs(position - PHRASES[0]['end']) < .08

    sheet = enter_prompt(page, trigger, TRANSFER_TITLE)
    expect_transfer_prompt(sheet)
    expect_keyboard_containment(page, sheet)
    expect_reachable_exit(sheet, TRANSFER_EXIT)
    close_prompt(page, sheet, TRANSFER_EXIT, 'button', trigger)
    # A delayed Automatic timer must not advance after the sheet has closed.
    page.wait_for_timeout((SPEAKING_PAUSE + .2) * 1000)
    expect_paused_phrase(page, PHRASES[0], position)
    expect(options.get_by_role('tab', name='Practice', exact=True)).to_have_attribute('aria-selected', 'true')
    # Leaving the player flushes its ordinary playback checkpoint.
    options.get_by_role('button', name='Close dialog', exact=True).click()
    page.get_by_role('button', name='Back', exact=True).click()
    saved = fixture.wait_for_library(
        page, lambda data: abs(data['lessons'][0]['progress']['position'] - position) < .08,
        'ordinary playback checkpoint with the preserved position',
    )
    lesson = saved['lessons'][0]
    assert lesson['statuses'] == before['lessons'][0]['statuses']
    assert saved['sessions'] == before['sessions']
    assert lesson['progress']['phraseId'] == PHRASES[0]['id']
    assert all(end <= position + .06 for _, end in lesson['progress']['coverage'])
    assert not errors, errors
    page.context.close()
    print('PASS native Automatic pause cancellation and return to Practice at 390×844.')


def verify_direct_transfer(fixture):
    page, errors = fixture.open_page(820, 1180, mobile=False)
    page.get_by_role('button', name='Resume lesson', exact=True).click()
    player = page.get_by_role('main', name='Practice player', exact=True)
    queue = page.get_by_role('complementary', name='Phrase queue', exact=True)
    expect(queue).to_be_visible()
    expect_paused_phrase(page, PHRASES[0], .25)
    trigger = player.locator('#player-transfer-prompt')
    expect(trigger).to_have_accessible_name(TRANSFER_ACTION)
    expect(trigger).to_be_in_viewport()
    assert trigger.bounding_box()['height'] >= 44

    for name in ('Next phrase', 'Phrase queue', 'Compare recordings', 'Play'):
        control = player.get_by_role('button', name=name, exact=True)
        expect(control).to_be_in_viewport()
        control.click(trial=True)
        assert control.evaluate('''button => {
            const rect = button.getBoundingClientRect();
            return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
        }'''), f'The open tablet queue intercepts {name}'

    requests = observe_prompt_effects(page)
    before = fixture.state()
    audio = page.evaluate_handle(CUE_CLOCK)
    for method in ('button', 'escape', 'back'):
        sheet = enter_prompt(page, trigger, TRANSFER_TITLE)
        expect_transfer_prompt(sheet)
        assert PHRASES[0]['text'] not in sheet.inner_text()
        expect_keyboard_containment(page, sheet)
        close_prompt(page, sheet, PLAYER_TRANSFER_EXIT, method, trigger)
        expect(queue.locator('.phrase-row.selected')).to_have_attribute('data-row-id', PHRASES[0]['id'])
        expect(page.get_by_role('dialog', name='Options', exact=True)).to_be_hidden()
        expect_paused_phrase(page, PHRASES[0], .25)
        assert audio.evaluate(f'previous => previous === {CUE_CLOCK}'), 'Cue exit replaced the native source'

    page.go_forward()
    expect(sheet).to_be_visible()
    expect(sheet.get_by_role('heading', name=TRANSFER_TITLE, exact=True)).to_be_focused()
    wait_for_audio(page, 'audio.paused && !audio.seeking && Math.abs(audio.currentTime - target) < .06', .25)
    close_prompt(page, sheet, PLAYER_TRANSFER_EXIT, 'button', trigger)
    expect(queue.locator('.phrase-row.selected')).to_have_attribute('data-row-id', PHRASES[0]['id'])
    page.wait_for_timeout(1200)
    expect_no_prompt_effects(page, fixture, requests)
    assert fixture.state() == before
    assert not errors, errors
    page.context.close()
    print('PASS 820×1180 tablet queue hit targets, direct transfer exits/Forward, native clock and selected queue row.')


def verify_transfer_context(fixture):
    page, errors = fixture.open_page(1280, 900, mobile=False)
    page.get_by_role('button', name='Resume lesson', exact=True).click()
    queue = page.get_by_role('complementary', name='Phrase queue', exact=True)
    expect(queue).to_be_visible()
    expect_paused_phrase(page, PHRASES[0], .25)
    options, trigger = practice_options(page)
    selection = options.locator('#practice-selection')
    range_start = options.locator('#range-start')
    selection.select_option('range')
    range_start.fill('2')
    options.locator('#range-end').fill('2')
    requests = observe_prompt_effects(page)
    before = fixture.state()

    for method in ('escape', 'back'):
        sheet = enter_prompt(page, trigger, TRANSFER_TITLE)
        expect_transfer_prompt(sheet)
        cue = sheet.locator('.prompt-situation').inner_text()
        assert PHRASES[0]['text'] not in sheet.inner_text()
        close_prompt(page, sheet, TRANSFER_EXIT, method, trigger)
        expect(options.get_by_role('tab', name='Practice', exact=True)).to_have_attribute('aria-selected', 'true')
        expect(selection).to_have_value('range')
        expect(range_start).to_be_visible()
        expect(range_start).to_have_value('2')
        expect_paused_phrase(page, PHRASES[0], .25)
    page.wait_for_timeout(1200)
    expect_no_prompt_effects(page, fixture, requests)
    assert fixture.state() == before

    options.get_by_role('button', name='Close dialog', exact=True).click()
    expect(queue).to_be_visible()
    queue.locator('[data-action=select-phrase][data-id=second]').click()
    expect_paused_phrase(page, PHRASES[1], PHRASES[1]['start'])
    options, trigger = practice_options(page)
    sheet = enter_prompt(page, trigger, TRANSFER_TITLE)
    expect(sheet.locator('.prompt-situation')).to_have_text(cue)
    assert PHRASES[1]['text'] not in sheet.inner_text()
    close_prompt(page, sheet, TRANSFER_EXIT, 'button', trigger)
    expect_paused_phrase(page, PHRASES[1], PHRASES[1]['start'])
    options.get_by_role('button', name='Close dialog', exact=True).click()
    expect(queue).to_be_visible()
    queue.get_by_role('button', name='Close queue', exact=True).click()

    # Opening the queue during desktop playback remembers a prior playback intent.
    page.get_by_role('button', name='Play', exact=True).click()
    wait_for_audio(page, '!audio.paused && audio.currentTime > 2.05')
    page.get_by_role('button', name='Phrase queue', exact=True).click()
    expect(queue).to_be_visible()
    wait_for_audio(page, '!audio.paused')
    options, trigger = practice_options(page)
    sheet = enter_prompt(page, trigger, TRANSFER_TITLE)
    wait_for_audio(page, 'audio.paused && !audio.seeking')
    position = page.evaluate(CUE_CLOCK + '.currentTime')
    close_prompt(page, sheet, TRANSFER_EXIT, 'button', trigger)
    options.get_by_role('button', name='Close dialog', exact=True).click()
    page.set_viewport_size({'width': 320, 'height': 568})
    page.get_by_role('button', name='Close queue', exact=True).click()
    expect(page.get_by_role('button', name='Close queue', exact=True)).to_have_count(0)
    page.wait_for_timeout(250)
    expect_paused_phrase(page, PHRASES[1], position)

    expect(page.locator('body.dark')).to_be_visible()
    options, trigger = practice_options(page)
    sheet = enter_prompt(page, trigger, TRANSFER_TITLE)
    expect_reachable_exit(sheet, TRANSFER_EXIT)
    close_prompt(page, sheet, TRANSFER_EXIT, 'button', trigger)
    assert not errors, errors
    page.context.close()
    print('PASS stable transfer cue, Practice tab and queue, paused after narrow queue close at 320×568.')


def run():
    with browser_fixture(__doc__, 'local text prompts and generated native WAV') as fixture:
        verify_empty_home(fixture)
        verify_stalled_account(fixture)
        audio = make_recording(fixture)
        seed_lesson(fixture, audio, theme='light', mode='automatic')
        verify_offline_home(fixture)
        verify_automatic_transfer(fixture)
        seed_lesson(fixture, audio, theme='dark', mode='continuous', queue=True)
        verify_direct_transfer(fixture)
        verify_transfer_context(fixture)
        seed_lesson(fixture, audio, theme='dark', mode='continuous', with_course=True)
        verify_playing_home_prompt(fixture)


if __name__ == '__main__':
    run()
