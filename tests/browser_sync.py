"""Rendered transcript and recording-clock regressions with real native MP3.

Requires Playwright, Chromium and FFmpeg with flite and libmp3lame.
Synthetic speech has exact cue boundaries. No microphone or external media.
"""

import math
import subprocess
import tempfile
import wave
import zipfile
from pathlib import Path

from playwright.sync_api import expect

from browser_fixture import browser_fixture


CLOCK = 'window.media.find(a => a.src.includes("/api/audio/"))'


def speech_fixture(folder):
    rate = 16_000
    frames = bytearray(b'\0' * int(rate * .35) * 2)
    phrases = []
    for index, text in enumerate([
        'This is the first phrase.',
        'Now the second phrase is playing.',
        'Finally we hear the third phrase.',
    ]):
        part = folder / f'{index}.wav'
        subprocess.run([
            'ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', f'flite=text={text}:voice=slt',
            '-ar', str(rate), '-ac', '1', '-c:a', 'pcm_s16le', str(part),
        ], check=True)
        start = len(frames) / 2 / rate
        with wave.open(str(part)) as wav:
            frames.extend(wav.readframes(wav.getnframes()))
        end = len(frames) / 2 / rate
        phrases.append({'id': f'p{index}', 'start': round(start, 3), 'end': round(end, 3), 'text': text})
        frames.extend(b'\0' * int(rate * .2) * 2)

    source = folder / 'speech.wav'
    with wave.open(str(source), 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        wav.writeframes(frames)
    mp3 = folder / 'speech.mp3'
    subprocess.run([
        'ffmpeg', '-v', 'error', '-i', str(source), '-c:a', 'libmp3lame', str(mp3),
    ], check=True)
    return mp3.read_bytes(), phrases


def library_with(lesson=None):
    return {
        'schemaVersion': 2, 'lessons': [lesson] if lesson else [], 'courses': [],
        'collections': [], 'sessions': [],
        'preferences': {
            'originalPlaybackVersion': 1, 'startupLesson': 'none', 'leadIn': 0,
            'mode': 'manual', 'speed': 1, 'pauseType': 'fixed', 'fixedPause': .8,
        },
        'lastLessonId': lesson['id'] if lesson else None,
    }


def check_clock(fixture, recording, phrases):
    lesson = {
        'id': 'clock-check', 'videoId': 'syncTest001', 'title': 'Speech timing regression',
        'audio': fixture.upload_audio(recording, 'audio/mpeg'), 'audioOffset': 0, 'mediaSource': 'audio',
        'phrases': phrases, 'segments': phrases, 'source': '', 'format': 'SRT', 'statuses': {},
        'progress': {'position': phrases[0]['start'], 'phraseId': 'p0', 'coverage': []},
        'importedAt': 1, 'createdAt': 1, 'pauseOverrides': {}, 'ipaOverrides': {}, 'revisions': [],
    }
    fixture.save_library(library_with(lesson))
    page, errors = fixture.open_page(320, 568)
    transport = page.locator('#mirror-main-play')
    active_phrase = page.locator('#active-phrase')
    options_dialog = page.get_by_role('dialog', name='Options')
    seek_dialog = page.get_by_role('dialog', name='Playback position')
    slider = seek_dialog.get_by_role('slider', name='Seek within recording')

    def button(name):
        return page.get_by_role('button', name=name, exact=True)

    def close(dialog):
        dialog.get_by_role('button', name='Close dialog', exact=True).click()
        expect(dialog).to_be_hidden()

    def phrase(index):
        expect(active_phrase).to_have_text(phrases[index]['text'])

    def current():
        return page.evaluate(CLOCK + '.currentTime')

    def wait_for_audio(predicate, arg=None):
        page.wait_for_function(
            f'arg => {{ const audio = {CLOCK}; return audio && ({predicate}); }}',
            arg=arg, timeout=7000,
        )

    def seek(index, offset=.1):
        button('Recording timeline').click()
        expect(slider).to_be_enabled()
        step = float(slider.get_attribute('step'))
        steps = math.ceil((phrases[index]['start'] + offset) / step)
        target = steps * step
        # Native keyboard events trigger the same range change as a user.
        # Focus prevents the playing clock from replacing the input value.
        slider.focus()
        page.keyboard.press('Home')
        for _ in range(steps):
            page.keyboard.press('ArrowRight')
        wait_for_audio('!audio.seeking && Math.abs(audio.currentTime - arg) < .04', target)
        close(seek_dialog)
        phrase(index)
        assert abs(current() - target) < .04, (current(), target)

    def options(mode=None, speed=None, lead=None):
        button('Player settings').click()
        options_dialog.get_by_role('tab', name='Playback', exact=True).click()
        if mode:
            options_dialog.locator('#player-mode').select_option(mode)
        if speed is not None:
            options_dialog.get_by_role('combobox', name='Playback speed').select_option(str(speed))
        if lead is not None:
            options_dialog.locator('#player-lead').select_option(str(lead))
        close(options_dialog)

    def replay_ready(timeout=6000):
        expect(transport).to_have_attribute('aria-label', 'Replay', timeout=timeout)

    button('Resume lesson').click()
    expect(transport).to_be_enabled()
    seek(1)
    transport.click()
    wait_for_audio('!audio.paused && audio.currentTime > arg', phrases[1]['start'])
    phrase(1)
    replay_ready()
    assert abs(current() - phrases[1]['end']) < .1, (current(), phrases[1]['end'])
    phrase(1)
    print('PASS recording seek and Manual boundary at 320×568', flush=True)

    # Seek forward/back through native inputs, then reset the selected phrase.
    seek(0)
    seek(2)
    seek(1)
    button('Replay current phrase').click()
    wait_for_audio('!audio.paused && audio.currentTime >= arg', phrases[1]['start'])
    phrase(1)
    assert phrases[1]['start'] <= current() < phrases[1]['end']
    transport.click()

    options(lead=.5)
    seek(1)
    button('Replay current phrase').click()
    wait_for_audio('!audio.paused && audio.currentTime < arg', phrases[1]['start'])
    phrase(1)
    assert current() < phrases[1]['start']
    transport.click()
    options(lead=0)
    print('PASS forward/back seeks, reset and lead-in', flush=True)

    for speed in [.5, 1, 2]:
        options(mode='manual', speed=speed)
        seek(0)
        wait_for_audio('audio.playbackRate === arg', speed)
        transport.click()
        replay_ready(timeout=10000)
        assert abs(current() - phrases[0]['end']) < .2, (speed, current(), phrases[0]['end'])
        phrase(0)
    options(mode='automatic', speed=1)
    seek(0)
    transport.click()
    wait_for_audio('audio.paused && Math.abs(audio.currentTime - arg) < .2', phrases[0]['end'])
    phrase(0)
    phrase(1)
    wait_for_audio('!audio.paused')
    transport.click()
    print('PASS 0.5×/1×/2× boundaries, Automatic pause and advancement', flush=True)

    options(mode='continuous')
    seek(0)
    transport.click()
    samples = page.evaluate('''async () => {
        const samples = [];
        for (let i = 0; i < 95; i++) {
            const audio = window.media.find(a => a.src.includes('/api/audio/'));
            samples.push({time: audio.currentTime, id: document.querySelector('#active-phrase')?.dataset.phrase});
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        return samples;
    }''')
    verified = 0
    for sample in samples:
        expected = next(
            (cue for cue in phrases if cue['start'] + .12 < sample['time'] < cue['end'] - .12), None,
        )
        if expected:
            assert sample['id'] == expected['id'], sample
            verified += 1
    assert verified > 30, verified

    transport.click()
    seek(2, offset=.25)
    position = current()
    button('Back').click()
    page.get_by_role('button', name='Open player:', exact=False).click()
    phrase(2)
    assert abs(current() - position) < .08
    fixture.wait_for_library(
        page,
        lambda data: abs(data['lessons'][0]['progress']['position'] - position) < .05,
        'resume position close to the selected cue',
    )
    page.reload(wait_until='domcontentloaded')
    expect(transport).to_be_enabled()
    phrase(2)
    wait_for_audio('audio.paused && !audio.seeking')
    assert abs(current() - position) < .1, (current(), position)
    for width, height in [(320, 568), (390, 844), (820, 1180), (1440, 900)]:
        page.set_viewport_size({'width': width, 'height': height})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, height)
    assert not errors, errors
    page.context.close()
    print(f'PASS Continuous clock alignment ({verified} samples), mini player, saved resume and paused reload. '
          'Viewports 320×568, 390×844, 820×1180 and 1440×900.', flush=True)


def srt_stamp(seconds):
    milliseconds = round(seconds * 1000)
    return f'{milliseconds // 3600000:02}:{milliseconds // 60000 % 60:02}:{milliseconds // 1000 % 60:02},{milliseconds % 1000:03}'


def check_zip(fixture, folder, recording, phrases):
    # Protect parser behavior when cue blocks are adjacent without blank lines.
    source = '\n'.join(
        f"{index + 1}\n{srt_stamp(cue['start'])} --> {srt_stamp(cue['end'])}\n{cue['text']}"
        for index, cue in enumerate(phrases)
    )
    archive = folder / 'speech.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        zip_file.writestr('echo_media/lesson/audio.mp3', recording)
        zip_file.writestr('echo_media/lesson/transcript.srt', source)

    fixture.save_library(library_with())
    page, errors = fixture.open_page(390, 844)
    page.locator('#rehearsal-add').click()
    page.get_by_role('button', name='Import ZIP').click()
    page.locator('#zip-file').set_input_files(str(archive))
    page.get_by_role('button', name='Import lessons', exact=True).click()
    course = page.get_by_role('button', name='Open course', exact=True)
    expect(course).to_be_visible(timeout=30000)
    course.click()
    page.locator('.library-open[data-kind=l]').click()
    transport = page.locator('#mirror-main-play')
    expect(transport).to_be_enabled()
    saved = fixture.wait_for_library(page, lambda data: len(data['lessons']) == 1, 'imported ZIP lesson')
    imported = saved['lessons'][0]
    assert imported['grouping'] == 'original'
    assert [(p['start'], p['end'], p['text']) for p in imported['phrases']] == [
        (p['start'], p['end'], p['text']) for p in phrases
    ]
    expect(page.locator('#active-phrase')).to_have_text(phrases[0]['text'])
    transport.click()
    expect(transport).to_have_attribute('aria-label', 'Replay', timeout=8000)
    page.get_by_role('button', name='Next phrase', exact=True).click()
    expect(page.locator('#active-phrase')).to_have_text(phrases[1]['text'])
    expect(transport).to_have_attribute('aria-label', 'Replay', timeout=8000)
    assert not errors, errors
    print('PASS ZIP MP3/SRT original cue times/text, Manual stop and Next at 390×844.')


def run():
    with browser_fixture(__doc__, 'native generated speech MP3') as fixture, tempfile.TemporaryDirectory(
        prefix='echo-sync-audio-',
    ) as directory:
        folder = Path(directory)
        recording, phrases = speech_fixture(folder)
        check_clock(fixture, recording, phrases)
        check_zip(fixture, folder, recording, phrases)


if __name__ == '__main__':
    run()
