"""Verify Home discovery, explicit native playback and private-library startup."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


TITLE = 'Deliver a clear update'
COURSE = 'Short speaking course'
CATEGORY = 'Workplace delivery'
COLLECTION = 'Examples for later'
POSITION = 2.45
PHRASES = [
    {'id': 'start', 'start': .2, 'end': 1.4, 'text': 'Could we move the review?'},
    {'id': 'resume', 'start': 2, 'end': 5, 'text': 'The figures will be ready on Thursday.'},
]


def seed_library(fixture):
    recording = io.BytesIO()
    with wave.open(recording, 'wb') as wav:
        wav.setparams((1, 2, 8000, 0, 'NONE', 'not compressed'))
        wav.writeframes(bytes(8000 * 2 * 8))
    audio = fixture.upload_audio(recording.getvalue(), 'audio/wav')
    lessons = [{
        'id': f'home-{number}', 'title': title, 'audio': audio, 'mediaSource': 'audio',
        'duration': 8, 'createdAt': number + 1, 'phrases': PHRASES, 'segments': PHRASES,
    } for number, title in enumerate([TITLE, *(f'Practice example {i}' for i in range(1, 9))])]
    lessons[0].update(courseId='home-course', category=CATEGORY, favourite=True,
                      statuses={'start': {'practised': True}},
                      progress={'phraseId': 'resume', 'position': POSITION, 'coverage': [[.2, 1.4]]})
    fixture.save_library({
        'lessons': lessons, 'sessions': [], 'lastLessonId': lessons[0]['id'],
        'courses': [{'id': 'home-course', 'title': COURSE, 'lessonIds': [lessons[0]['id']]}],
        'categories': [CATEGORY],
        'collections': [{'id': 'home-collection', 'name': COLLECTION, 'lessonIds': [lessons[0]['id']]}],
        'preferences': {'startupLesson': 'none', 'originalPlaybackVersion': 1, 'mode': 'continuous'},
    })


def expect_home(page):
    home = page.get_by_role('main')
    expect(home.get_by_role('heading', name='Home', exact=True)).to_be_visible()
    expect(page.locator('.mobile-nav').get_by_role('button', name='Home', exact=True)).to_have_attribute('aria-current', 'page')
    for name in ('Talk now', 'Pick a speaking drill', 'Browse reference shelves', 'Hide reference shelves'):
        expect(home.get_by_role('button', name=name, exact=True)).to_have_count(0)
    return home


def check_empty(fixture):
    page, errors = fixture.open_page(320, 568)
    home = expect_home(page)
    add = home.get_by_role('button', name='Add lesson', exact=True)
    expect(add).to_be_in_viewport()
    expect(home.get_by_role('button', name='Resume lesson', exact=True)).to_have_count(0)
    expect(home.locator('.home-shelf')).to_have_count(0)
    add.press('Enter')
    chooser = page.get_by_role('dialog', name='Add lessons', exact=True)
    expect(chooser.get_by_role('button', name='YouTube lesson')).to_be_visible()
    expect(chooser.get_by_role('button', name='Import ZIP')).to_be_visible()
    page.keyboard.press('Escape')
    expect(chooser).to_be_hidden()
    expect(add).to_be_focused()
    assert not errors, errors
    page.context.close()
    print('PASS empty Home enters the real Add flow at 320×568.')


def check_populated(fixture):
    page, errors = fixture.open_page(390, 844)
    home = expect_home(page)
    resume = home.get_by_role('button', name='Resume lesson', exact=True)
    expect(resume).to_contain_text(TITLE)
    expect(resume).to_be_in_viewport()
    for shelf, action in (
        ('Your courses', f'Open course {COURSE}'),
        ('Recently added', 'Open lesson Practice example 8'),
        ('Favourites', f'Open lesson {TITLE}'),
        (CATEGORY, f'Open lesson {TITLE}'),
        ('Your collections', f'Open collection {COLLECTION}'),
    ):
        expect(home.get_by_role('region', name=shelf, exact=True).get_by_role('button', name=action, exact=True)).to_be_visible()

    home.locator('#home-more-recent').click()
    library = page.locator('.library-screen')
    expect(library).to_be_visible()
    # The oldest reference is outside the eight-item Home preview.
    expect(library.locator('.library-open').filter(has_text=TITLE)).to_be_visible()
    page.go_back()
    expect(home).to_be_visible()
    home.get_by_role('region', name='Your collections', exact=True).get_by_role('button', name=f'Open collection {COLLECTION}', exact=True).click()
    expect(page.locator('.collections-screen h1')).to_have_text(COLLECTION)
    expect(page.locator('.collection-member').filter(has_text=TITLE)).to_be_visible()
    page.go_back()
    expect(home).to_be_visible()

    home.get_by_role('button', name='Search', exact=True).press('Enter')
    search = page.get_by_role('main').get_by_role('searchbox', name='Search lessons, courses and collections')
    search.fill(COURSE)
    expect(page.locator('.search-result-open').filter(has_text=COURSE)).to_be_visible()
    page.go_back()
    expect(home).to_be_visible()

    # A same-owner tab can still carry the retired, non-transient drill chooser in its history.
    page.evaluate('''() => {
        const entry = history.state.echoNavigation;
        const snapshot = {...entry.snapshot, modal: {type: 'drills'}, overlay: true, transient: false};
        history.replaceState({...history.state, echoNavigation: {...entry, snapshot}}, '');
    }''')
    page.reload(wait_until='domcontentloaded')
    expect(resume).to_contain_text(TITLE)
    expect(page.get_by_role('dialog')).to_have_count(0)

    assert page.evaluate('media.every(audio => audio.paused)')
    resume.press('Enter')
    player = page.get_by_role('main', name='Practice player')
    expect(player.locator('#active-phrase')).to_have_text(PHRASES[1]['text'])
    play = player.get_by_role('button', name='Play', exact=True)
    expect(play).to_be_enabled()
    page.wait_for_function('''position => media.some(audio => audio.readyState >= 1 && audio.paused &&
                               !audio.seeking && Math.abs(audio.currentTime - position) < .06)''', arg=POSITION)
    expect(player.get_by_role('button', name='Try a new conversation', exact=True)).to_have_count(0)
    player.get_by_role('button', name='Player settings', exact=True).click()
    options = page.get_by_role('dialog', name='Options', exact=True)
    options.get_by_role('tab', name='Practice', exact=True).click()
    expect(options.get_by_role('button', name='Finish session', exact=True)).to_be_visible()
    expect(options.get_by_role('button', name='Try a new conversation', exact=True)).to_have_count(0)
    options.get_by_role('button', name='Close dialog', exact=True).click()
    play.click()
    page.wait_for_function('position => media.some(audio => !audio.paused && audio.currentTime > position + .1)', arg=POSITION)
    assert not errors, errors
    page.context.close()
    print('PASS direct shelves, Search, retired history handling and saved paused Resume at 390×844.')


def check_owner_verification(fixture):
    page, errors = fixture.open_page(320, 568)
    expect(expect_home(page).get_by_role('button', name='Resume lesson', exact=True)).to_contain_text(TITLE)
    account_url = fixture.origin + '/api/state'
    pending = []
    page.route(account_url, lambda route: pending.append(route), times=1)
    with page.expect_request(account_url):
        page.reload(wait_until='domcontentloaded')

    expect(page.get_by_role('heading', name='Connecting', exact=True)).to_be_visible()
    assert pending, 'The fixture must hold owner verification before inspecting the shell'
    assert all(title not in page.locator('#app').inner_text() for title in (TITLE, COURSE, COLLECTION))
    pending.pop().fulfill(status=401, json={'error': 'Sign in'})
    expect(page.get_by_role('heading', name='Library unavailable', exact=True)).to_be_visible()
    expect(page.get_by_role('button', name='Talk now', exact=True)).to_have_count(0)
    expect(page.get_by_role('button', name='Resume lesson', exact=True)).to_have_count(0)
    expect(page.locator('.home-shelf')).to_have_count(0)
    page.get_by_role('button', name='Retry', exact=True).click()
    expect(expect_home(page).get_by_role('button', name='Resume lesson', exact=True)).to_contain_text(TITLE)
    assert not errors, errors
    page.context.close()
    print('PASS held cold verification, locked shell without private contents and Retry at 320×568.')


if __name__ == '__main__':
    with browser_fixture(__doc__, 'generated native WAV, seeded shelves and a controlled owner response') as fixture:
        check_empty(fixture)
        seed_library(fixture)
        check_populated(fixture)
        check_owner_verification(fixture)
