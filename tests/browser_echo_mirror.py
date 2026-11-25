"""Record a take and verify Listen back using real Chromium media on loopback."""

import io
import math
import struct
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


CUE_START = .35
CUE_END = 1.9

# Replace the microphone only. Chromium still decodes, records and plays the media.
SYNTHETIC_MICROPHONE = '''
    window.mirrorFixture = {starts: [], streams: [], plays: [], hasData: false};
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {value: async () => {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        const oscillator = new OscillatorNode(context, {frequency: 195});
        const gain = new GainNode(context, {gain: .12});
        oscillator.connect(gain);
        gain.connect(destination);
        oscillator.start();
        await context.resume();
        mirrorFixture.streams.push(destination.stream);
        return destination.stream;
    }});

    const NativeRecorder = window.MediaRecorder;
    window.MediaRecorder = class extends NativeRecorder {
        start(timeslice) {
            mirrorFixture.starts.push(media.at(-1).currentTime);
            this.addEventListener('dataavailable', event => {
                if (event.data.size) mirrorFixture.hasData = true;
            });
            return super.start(timeslice);
        }
    };

    const playMedia = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
        mirrorFixture.plays.push(this.src);
        return playMedia.call(this);
    };
'''


def seed_library(fixture):
    samples = io.BytesIO()
    rate = 8_000
    with wave.open(samples, 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        tone = b''.join(struct.pack('<h', int(1800 * math.sin(2 * math.pi * 220 * i / rate)))
                        for i in range(rate))
        wav.writeframes(tone * 5)
    audio = fixture.upload_audio(samples.getvalue(), 'audio/wav')
    phrase = {'id': 'reference', 'start': CUE_START, 'end': CUE_END,
              'text': 'We can meet on Friday after lunch.'}
    fixture.save_library({
        'lessons': [{
            'id': 'mirror-lesson', 'title': 'Move a meeting', 'audio': audio, 'mediaSource': 'audio',
            'duration': 5, 'phrases': [phrase], 'segments': [phrase], 'statuses': {},
            'progress': {'position': .52, 'phraseId': phrase['id'], 'coverage': []},
        }],
        'courses': [], 'collections': [], 'sessions': [], 'lastLessonId': 'mirror-lesson',
        'preferences': {'startupLesson': 'none', 'mode': 'manual', 'originalPlaybackVersion': 1},
    })


def run():
    with browser_fixture(__doc__, 'generated WAV, synthetic microphone and native MediaRecorder') as fixture:
        seed_library(fixture)
        page, errors = fixture.open_page(390, 844)
        page.add_init_script(SYNTHETIC_MICROPHONE)
        page.reload(wait_until='domcontentloaded')

        uploads = []

        def track_upload(request):
            if request.method == 'POST' and request.url == fixture.origin + '/api/audio':
                uploads.append(request.url)

        page.on('request', track_upload)
        page.get_by_role('button', name='Resume lesson', exact=True).click()
        record = page.get_by_role('button', name='Listen then record', exact=True)
        stop = page.get_by_role('button', name='Stop and listen back', exact=True)
        compare = page.get_by_role('dialog', name='Listen back', exact=True)
        opener = page.get_by_role('button', name='Compare recordings', exact=True)

        record.click()
        expect(stop).to_be_enabled()
        page.wait_for_function('mirrorFixture.hasData')
        starts = page.evaluate('mirrorFixture.starts')
        assert len(starts) == 1 and CUE_END <= starts[0] < CUE_END + .2, starts
        expect(compare).to_have_count(0)
        plays = page.evaluate('mirrorFixture.plays.length')

        stop.click()
        expect(compare.get_by_role('heading', name='Listen back', exact=True)).to_be_focused()
        waveforms = compare.get_by_role('img', name='Waveform', exact=False)
        expect(waveforms).to_have_count(2)
        reference_wave, take_wave = (waveform.bounding_box() for waveform in waveforms.all())
        assert reference_wave and take_wave and all(
            abs(reference_wave[key] - take_wave[key]) <= 1 for key in ('x', 'width')
        ), (reference_wave, take_wave)
        assert page.evaluate('count => mirrorFixture.plays.length === count && media.every(a => a.paused)', plays)
        assert page.evaluate('mirrorFixture.streams[0].getTracks().every(track => track.readyState === "ended")')

        compare.get_by_role('button', name='Play reference', exact=True).click()
        page.wait_for_function('''start => {
            const playing = media.filter(audio => !audio.paused);
            return playing.length === 1 && playing[0].currentSrc.includes('/api/audio/') &&
                   playing[0].currentTime > start;
        }''', arg=CUE_START)
        compare.get_by_role('button', name='Play your take', exact=True).click()
        page.wait_for_function('''() => {
            const playing = media.filter(audio => !audio.paused);
            return playing.length === 1 && playing[0].src.startsWith('blob:') && playing[0].currentTime > 0;
        }''')
        compare.get_by_role('button', name='Pause your take', exact=True).click()
        page.wait_for_function('media.every(audio => audio.paused)')

        compare.get_by_role('button', name='Save attempt', exact=True).click()
        expect(compare.get_by_role('button', name='Saved', exact=True)).to_be_disabled()
        compare.get_by_role('button', name='Back to reference', exact=True).click()
        expect(compare).to_have_count(0)
        expect(record).to_be_focused()

        page.reload(wait_until='domcontentloaded')
        expect(opener).to_be_enabled()
        opener.press('Enter')
        saved = compare.get_by_text('Saved attempts (1)', exact=True)
        expect(saved).to_be_visible()
        saved.click()
        compare.get_by_role('button', name='Play saved attempt', exact=True).click()
        page.wait_for_function("media.some(a => !a.paused && a.src.startsWith('blob:') && a.currentTime > 0)")
        page.keyboard.press('Escape')
        expect(compare).to_have_count(0)
        expect(opener).to_be_focused()
        page.wait_for_function('media.every(audio => audio.paused)')
        assert not uploads, uploads
        assert not errors, errors
        print(f'PASS Listen back at 390×844. Capture began at {starts[0]:.3f}s for a {CUE_END:.3f}s cue end.')
        print('PASS paired playback, focus return and playable local save after reload, with no media uploads.')


if __name__ == '__main__':
    run()
