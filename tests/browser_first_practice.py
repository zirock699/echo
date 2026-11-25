"""Exercise import, prepared playback, Back and Forward with isolated local media."""

import io
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


VIDEO_FIXTURE = '''() => {
  window.fixtureVideo = {loads: 0, starts: 0};
  window.YT = {Player: class {
    constructor(_host, {events}) {
      window.fixtureVideo.loads++;
      this.events = events;
      this.time = 0;
      this.state = 5;
      queueMicrotask(() => events.onReady({target: this}));
    }
    cueVideoById({startSeconds}) { this.time = startSeconds; }
    seekTo(time) { this.time = time; }
    getCurrentTime() { return this.time; }
    getPlayerState() { return this.state; }
    getDuration() { return 15; }
    getAvailablePlaybackRates() { return [1]; }
    setPlaybackRate() {}
    playVideo() { window.fixtureVideo.starts++; this.state = 1; this.events.onStateChange({data: 1}); }
    pauseVideo() { this.state = 2; this.events.onStateChange({data: 2}); }
    destroy() {}
  }};
}'''

TRANSCRIPT = '''1
00:00:01,000 --> 00:00:02,000
First fixture cue.

2
00:00:03,000 --> 00:00:04,000
Second fixture cue.'''


def earlier_lesson(fixture):
    output = io.BytesIO()
    with wave.open(output, 'wb') as recording:
        recording.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        recording.writeframes(bytes(16000 * 2 * 20))
    audio = fixture.upload_audio(output.getvalue(), 'audio/wav')
    cue = {'id': 'previous-cue', 'text': 'Earlier local audio.', 'start': 0, 'end': 18}
    return {'id': 'previous', 'title': 'Earlier lesson', 'audio': audio, 'mediaSource': 'audio',
            'phrases': [cue], 'statuses': {}, 'progress': {'position': 0, 'coverage': []}}


def wait_for_screen(page, name):
    page.wait_for_function('''name => {
      const route = history.state?.echoNavigation?.snapshot;
      return route?.view === name && !route.overlay;
    }''', arg=name)


def check_import(fixture, populated):
    fixture.save_library({
        'lessons': [earlier_lesson(fixture)] if populated else [],
        'collections': [], 'courses': [], 'sessions': [],
        'preferences': {'startupLesson': 'recent', 'originalPlaybackVersion': 1},
        'lastLessonId': 'previous' if populated else None,
    })
    page, errors = fixture.open_page(390, 844) if populated else fixture.open_page(320, 568)
    page.evaluate(VIDEO_FIXTURE)
    player = page.get_by_role('main', name='Practice player')
    mobile = page.locator('.mobile-nav')
    origin = 'library' if populated else 'home'

    if populated:
        page.get_by_role('button', name='Resume lesson', exact=True).click()
        player.get_by_role('button', name='Play', exact=True).click()
        page.wait_for_function('window.media.some(audio => !audio.paused)')
        player.get_by_role('button', name='Back', exact=True).click()
        wait_for_screen(page, 'home')
        mobile.get_by_role('button', name='Library', exact=True).click()
        page.wait_for_function('window.media.some(audio => !audio.paused)')

    wait_for_screen(page, origin)
    previous_index = page.evaluate('history.state.echoNavigation.index')
    page.locator('#rehearsal-add').click()
    page.get_by_role('button', name='YouTube lesson').click()
    form = page.get_by_role('dialog', name='Create a lesson')
    form.get_by_label('YouTube URL').fill('https://www.youtube.com/watch?v=qaVtt123456')
    form.get_by_label('Lesson title').fill('Synthetic first practice')
    transcript = form.locator('#transcript-text')
    preview = form.get_by_role('button', name='Preview phrases', exact=True)
    save = form.get_by_role('button', name='Save & practise', exact=True)

    transcript.fill('No timestamped cues')
    preview.click()
    expect(save).to_be_disabled()
    assert len(fixture.state()['data']['lessons']) == int(populated)
    transcript.fill(TRANSCRIPT)
    preview.click()
    expect(save).to_be_enabled()
    assert page.evaluate('history.state.echoNavigation.index') == previous_index + 1
    save.click()

    wait_for_screen(page, 'player')
    expect(player.get_by_text('Synthetic first practice', exact=True)).to_be_visible()
    expect(player.locator('#active-phrase')).to_have_text('First fixture cue.')
    expect(player.get_by_role('button', name='Play', exact=True)).to_be_enabled()
    assert page.evaluate('history.state.echoNavigation.index') == previous_index + 1
    if populated:
        assert page.evaluate('window.media.every(audio => audio.paused)')
    saved = fixture.wait_for_library(page, lambda data: len(data['lessons']) == int(populated) + 1,
                                     'one new lesson persisted')
    assert saved['lessons'][0]['title'] == 'Synthetic first practice'

    player.get_by_role('button', name='Back', exact=True).click()
    wait_for_screen(page, origin)
    expect(form).to_have_count(0)
    assert page.evaluate('history.state.echoNavigation.index') == previous_index
    page.go_forward()
    wait_for_screen(page, 'player')
    expect(player.get_by_text('Synthetic first practice', exact=True)).to_be_visible()
    assert page.evaluate('window.fixtureVideo') == {'loads': 1, 'starts': 0}
    assert len(fixture.state()['data']['lessons']) == int(populated) + 1
    assert not errors, errors
    print(f'PASS Save & practise from {origin}, Back/Forward and no autoplay.', flush=True)
    page.context.close()


if __name__ == '__main__':
    with browser_fixture(__doc__, 'generated native WAV and deterministic YouTube adapter') as fixture:
        check_import(fixture, False)
        check_import(fixture, True)
