"""Check provider requests on normal routes with a loopback library and a simulated iframe."""

import io
import wave
from urllib.parse import urlsplit

from playwright.sync_api import expect

from browser_fixture import browser_fixture


VIDEO_ID = 'fixture1234'
VIDEO = 'Fixture video reference'
NATIVE = 'Fixture native reference'
PROVIDER_DOMAINS = ('youtube.com', 'youtube-nocookie.com', 'youtu.be', 'ytimg.com', 'googlevideo.com')
IFRAME_API = '''
window.echoVideo = {calls: [], mounts: 0};
window.YT = {Player: function(id, config) {
    echoVideo.mounts++;
    echoVideo.config = config.playerVars;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${config.videoId}`;
    document.getElementById(id).replaceWith(iframe);
    let clock = 0, state = 5;
    function emit(value) { state = value; config.events.onStateChange({data: state}); }
    const source = {
        cueVideoById({startSeconds}) { echoVideo.calls.push(['cue', startSeconds]); emit(5); },
        seekTo(time) { echoVideo.calls.push(['seek', time]); clock = time; if (state !== 2) emit(1); },
        playVideo() { echoVideo.calls.push(['play']); if (state !== 1) emit(1); },
        pauseVideo() { emit(2); }, getPlayerState() { return state; },
        getCurrentTime() { return clock; }, getDuration() { return 14; },
        getAvailablePlaybackRates() { return [.5, 1, 1.5]; }, setPlaybackRate() {},
        getIframe() { return iframe; }, destroy() { iframe.remove(); },
    };
    queueMicrotask(() => config.events.onReady({target: source}));
    return source;
}};
window.onYouTubeIframeAPIReady();
'''


def seed_library(fixture):
    samples = io.BytesIO()
    with wave.open(samples, 'wb') as wav:
        wav.setparams((1, 2, 8_000, 0, 'NONE', 'not compressed'))
        wav.writeframes(b'\0\0' * 8_000 * 12)
    audio = fixture.upload_audio(samples.getvalue(), 'audio/wav')
    legacy_art = {'url': f'https://i.ytimg.com/vi/{VIDEO_ID}/hqdefault.jpg'}
    phrases = [{'id': 'a', 'start': .7, 'end': 4, 'text': 'Try the first reference.'},
               {'id': 'b', 'start': 5, 'end': 8, 'text': 'Then prepare a different reply.'}]
    lessons = [
        {'id': 'video', 'title': VIDEO, 'videoId': VIDEO_ID, 'thumbnail': legacy_art, 'duration': 14},
        {'id': 'native', 'title': NATIVE, 'videoId': 'fixture5678', 'thumbnail': legacy_art,
         'audio': audio, 'mediaSource': 'audio', 'duration': 12},
    ]
    for lesson in lessons:
        lesson.update(phrases=phrases, segments=phrases, statuses={}, createdAt=1, courseId='course',
                      progress={'position': 1.25, 'phraseId': 'a', 'coverage': []})
    fixture.save_library({
        'lessons': lessons, 'sessions': [], 'lastLessonId': 'video',
        'courses': [{'id': 'course', 'title': 'Fixture course', 'cover': legacy_art,
                     'lessonIds': ['video', 'native']}],
        'collections': [{'id': 'collection', 'name': 'Fixture collection', 'lessonIds': ['video', 'native']}],
        'preferences': {'startupLesson': 'recent', 'originalPlaybackVersion': 1, 'mode': 'continuous'},
    })


def open_page(fixture):
    context = fixture.browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                                          has_touch=True, service_workers='block')
    provider, errors = [], []

    def requests(route):
        url = route.request.url
        if url.startswith(fixture.origin + '/'):
            return route.continue_()
        target = urlsplit(url)
        if any(target.hostname == domain or target.hostname.endswith('.' + domain)
               for domain in PROVIDER_DOMAINS if target.hostname):
            provider.append(url)
            if target.hostname == 'www.youtube.com' and target.path == '/iframe_api':
                return route.fulfill(content_type='text/javascript', body=IFRAME_API)
            if target.hostname == 'www.youtube.com' and target.path == f'/embed/{VIDEO_ID}':
                return route.fulfill(content_type='text/html', body='<p>Simulated provider frame</p>')
            if target.hostname == 'i.ytimg.com':
                return route.fulfill(content_type='image/svg+xml', headers={'Access-Control-Allow-Origin': '*'},
                                     body='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"/>')
        return route.abort()

    context.route('**/*', requests)
    page = context.new_page()
    page.set_default_timeout(7000)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script('''
        window.fixtureAudio = [];
        const NativeAudio = window.Audio;
        window.Audio = function (...args) {
            const audio = new NativeAudio(...args);
            fixtureAudio.push(audio);
            return audio;
        };
    ''')
    page.goto(fixture.origin, wait_until='domcontentloaded')
    return page, provider, errors


def run():
    with browser_fixture(__doc__, 'recorded request attempts, generated native WAV and simulated iframe') as fixture:
        seed_library(fixture)
        page, provider, errors = open_page(fixture)
        nav = page.locator('.mobile-nav')
        player = page.get_by_role('main', name='Practice player')

        def button(name):
            return page.get_by_role('button', name=name, exact=True)

        expect(button('Resume lesson')).to_contain_text(VIDEO)
        expect(nav.get_by_role('button', name='Home', exact=True)).to_have_attribute('aria-current', 'page')
        assert not provider, provider

        nav.locator('[data-view=library]').click()
        page.locator('.library-open').filter(has_text='Fixture course').click()
        expect(page.locator('.library-open').filter(has_text=VIDEO)).to_be_visible()
        page.locator('.library-destinations [data-view=search]').click()
        page.get_by_role('searchbox', name='Search lessons, courses and collections').fill('Fixture')
        expect(page.locator('.search-result').filter(has_text=VIDEO)).to_be_visible()
        page.locator('.library-destinations [data-view=collections]').click()
        page.locator('.collection-open').filter(has_text='Fixture collection').click()
        expect(page.locator('.collection-member').filter(has_text=VIDEO)).to_be_visible()

        page.locator('.collection-member .collection-open').filter(has_text=NATIVE).click()
        expect(player).to_be_visible()
        expect(button('Play')).to_be_enabled()
        button('Play').click()
        page.wait_for_function('fixtureAudio.some(audio => !audio.paused && audio.currentTime > 1.35)')
        button('Pause').click()
        assert not provider, provider
        player.get_by_role('button', name='Back', exact=True).click()

        api_url = 'https://www.youtube.com/iframe_api'
        waiting = []

        def hold_api(route):
            provider.append(route.request.url)
            waiting.append(route)

        page.route(api_url, hold_api)
        with page.expect_request(api_url):
            page.locator('.collection-member .collection-open').filter(has_text=VIDEO).click()
        expect(player).to_be_visible()
        expect(button('Play')).to_be_disabled()
        expect(player.locator('#active-phrase')).to_have_text('Try the first reference.')
        expect(page.locator('iframe[title="YouTube lesson video"]')).to_have_count(0)
        assert waiting, 'The provider script must be pending before checking the transcript'
        waiting.pop().fulfill(content_type='text/javascript', body=IFRAME_API)
        page.unroute(api_url, hold_api)
        expect(button('Play')).to_be_enabled()
        iframe = page.locator('iframe[title="YouTube lesson video"]')
        expect(iframe).to_be_visible()
        page.wait_for_function('echoVideo?.calls.length === 1')
        for width, height in [(390, 844), (320, 568)]:
            page.set_viewport_size({'width': width, 'height': height})
            rect = iframe.bounding_box()
            assert rect and rect['width'] >= 200 and rect['height'] >= 200, rect
        assert page.evaluate('echoVideo.config.autoplay === 0 && echoVideo.config.controls === 1')
        assert page.evaluate('echoVideo.calls') == [['cue', 1.25]]
        assert any(url.endswith('/iframe_api') for url in provider), provider
        assert any(url.endswith(f'/embed/{VIDEO_ID}') for url in provider), provider
        button('Play').click()
        expect(button('Pause')).to_be_visible()
        assert page.evaluate('echoVideo.calls.slice(-2)') == [['seek', 1.25], ['play']]
        button('Pause').click()

        # Drain artwork requests from the explicitly selected document before measuring reload.
        page.wait_for_load_state('networkidle')
        count = len(provider)
        page.reload(wait_until='domcontentloaded')
        expect(button('Load YouTube video')).to_be_visible()
        expect(iframe).to_have_count(0)
        assert len(provider) == count, provider[count:]
        assert not errors, errors
        page.context.close()

        library = fixture.state()['data']
        library['preferences']['startupLesson'] = 'native'
        fixture.save_library(library)
        page, provider, errors = open_page(fixture)
        expect(page.get_by_role('main').get_by_role('heading', name='Home', exact=True)).to_be_visible()
        page.wait_for_function('fixtureAudio.some(audio => audio.paused && audio.readyState >= 1)')
        assert not provider, provider
        assert not errors, errors
        print('PASS provider-free Home, Library, Search, Collections, native playback and warm preparation.')
        print('PASS deliberate video loads one visible controlled iframe, cues paused, plays on request and reloads cold.')


if __name__ == '__main__':
    run()
