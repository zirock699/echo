"""Collections and same-document navigation with generated native WAV audio."""

import io
import math
import struct
import wave

from playwright.sync_api import expect

from browser_fixture import browser_fixture


def seed_library(fixture):
    audio = io.BytesIO()
    rate = 16_000
    with wave.open(audio, 'wb') as wav:
        wav.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        # One second of tone repeated for a long-running player.
        tone = b''.join(struct.pack('<h', int(900 * math.sin(2 * math.pi * 220 * i / rate))) for i in range(rate))
        wav.writeframes(tone * 30)
    asset = fixture.upload_audio(audio.getvalue(), 'audio/wav')
    phrases = [
        {'id': 'a', 'start': 0, 'end': 8, 'text': 'Listen and repeat this phrase.'},
        {'id': 'b', 'start': 10, 'end': 18, 'text': 'Continue your speaking practice.'},
    ]
    lessons = [
        {
            'id': f'l{i}', 'title': f'Practice lesson {i + 1:02d}: a clear and confident voice',
            'speaker': 'Practice library', 'videoId': f'test{i:07d}', 'audio': asset,
            'mediaSource': 'audio', 'duration': 30, 'phrases': phrases, 'segments': phrases,
            'source': '', 'format': 'SRT', 'statuses': {'a': {'practised': True}},
            'progress': {'position': .3, 'phraseId': 'a', 'coverage': [[0, .3]]},
            'createdAt': i + 1, 'tags': [], 'pauseOverrides': {}, 'ipaOverrides': {}, 'revisions': [],
        }
        for i in range(72)
    ]
    fixture.save_library({
        'lessons': lessons, 'courses': [], 'categories': [], 'tags': [],
        'collections': [{'id': 'old', 'name': 'Existing practice', 'lessonIds': ['l1', 'l2'], 'createdAt': 1}],
        'sessions': [], 'preferences': {'startupLesson': 'none', 'theme': 'dark', 'mode': 'manual', 'leadIn': 0},
        'lastLessonId': 'l0', 'schemaVersion': 2,
    })


def run():
    with browser_fixture(__doc__, 'native generated WAV') as fixture:
        seed_library(fixture)
        page, errors = fixture.open_page(320, 568)
        expect(page.get_by_role('button', name='Resume lesson', exact=True)).to_be_visible()
        nav = page.locator('.mobile-nav')
        heading = page.locator('.collections-screen h1')
        collection = page.locator('.collection-open').filter(has_text='Daily practice')
        members = page.locator('.collection-member')
        picker = page.locator('.collection-tools [data-cx=pick]')

        def button(name):
            return page.get_by_role('button', name=name, exact=True)

        nav.locator('[data-view=collections]').click()
        button('New collection').click()
        page.locator('#collection-name').fill('Focused practice')
        button('Save collection').click()
        expect(heading).to_have_text('Focused practice')

        picker.click()
        expect(page.locator('[data-cx-pick]')).to_have_count(24)
        page.locator('[data-cx-pick=l0]').check()
        page.locator('[data-cx-pick=l1]').check()
        page.locator('[data-cx=picker-page][data-page="2"]').click()
        page.locator('[data-cx-pick=l24]').check()
        button('Save selection').click()
        expect(members).to_have_count(3)

        button('Edit list').click()
        page.locator('[data-cx=move][data-id=l1][data-direction="-1"]').click()
        expect(members.first.locator('[data-cx=lesson]')).to_have_attribute('data-id', 'l1')
        page.locator('[data-cx=remove][data-id=l24]').click()
        expect(members).to_have_count(2)
        button('Done').click()
        button('Collection options').click()
        page.locator('#collection-name').fill('Daily practice')
        button('Save collection').click()
        expect(heading).to_have_text('Daily practice')

        # Native Back closes the picker before leaving the collection.
        picker.click()
        page.go_back()
        expect(page.locator('.collection-overlay')).to_be_hidden()
        expect(heading).to_have_text('Daily practice')
        page.go_back()
        expect(heading).to_have_text('Collections')
        collection.click()
        page.reload(wait_until='domcontentloaded')
        expect(heading).to_have_text('Daily practice')
        page.go_back()
        expect(heading).to_have_text('Collections')
        page.go_forward()
        expect(heading).to_have_text('Daily practice')

        player = page.get_by_role('main', name='Practice player')
        transport = page.locator('#mirror-main-play')
        options = page.get_by_role('dialog', name='Options')
        members.first.locator('[data-cx=lesson]').click()
        expect(transport).to_be_enabled()
        button('Player settings').click()
        options.locator('#player-mode').select_option('continuous')
        options.get_by_role('button', name='Close dialog', exact=True).click()
        expect(options).to_be_hidden()
        transport.click()

        def playing(expected):
            page.wait_for_function('count => window.media.filter(a => !a.paused && !a.ended).length === count', arg=expected)

        playing(1)
        button('Phrase queue').click()
        expect(page.locator('.queue-panel')).to_be_visible()
        playing(0)
        page.go_back()
        expect(page.locator('.queue-panel')).to_be_hidden()
        playing(1)
        button('Player settings').click()
        expect(options).to_be_visible()
        page.go_back()
        expect(options).to_be_hidden()
        expect(transport).to_be_visible()

        for width, height in [(320, 568), (390, 844), (844, 390)]:
            page.set_viewport_size({'width': width, 'height': height})
            expect(player).to_be_visible()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, height)
            for control in [
                button('Back'), button('Phrase queue'), transport, button('Listen then record'),
                button('Next phrase'), button('Restart current phrase'), button('Player settings'),
            ]:
                rect = control.bounding_box()
                assert rect and rect['width'] >= 44 and rect['height'] >= 44, (control, rect, width)
                assert rect['x'] >= 0 and rect['y'] >= 0, (control, rect, width)
                assert rect['x'] + rect['width'] <= width + 1 and rect['y'] + rect['height'] <= height + 1, (control, rect)

        page.set_viewport_size({'width': 320, 'height': 568})
        page.go_back()
        expect(heading).to_have_text('Daily practice')
        playing(1)
        expect(page.locator('.compact-audio')).to_be_visible()
        page.get_by_role('button', name='Open player:', exact=False).click()
        player.get_by_role('button', name='Back', exact=True).click()
        expect(heading).to_have_text('Daily practice')

        nav.locator('[data-view=home]').click()
        settings = page.get_by_role('heading', name='Settings', exact=True)
        home_settings = page.locator('.home-appbar').get_by_role('button', name='Settings', exact=True)
        home_settings.click()
        expect(settings).to_be_visible()
        button('Back').click()
        expect(page.locator('.home-screen')).to_be_visible()
        home_settings.click()
        expect(settings).to_be_visible()
        page.go_back()
        expect(page.locator('.home-screen')).to_be_visible()
        playing(1)

        nav.locator('[data-view=library]').click()
        page.locator('.library-app-actions').get_by_role('button', name='Settings', exact=True).click()
        expect(settings).to_be_visible()
        button('Back').click()
        expect(page.locator('.library-screen')).to_be_visible()

        page.locator('#compact-toggle').click()
        playing(0)
        nav.locator('[data-view=collections]').click()
        collection.click()
        expect(heading).to_have_text('Daily practice')
        for width, height in [(320, 568), (390, 844), (430, 932), (844, 390), (820, 1180), (1440, 900)]:
            page.set_viewport_size({'width': width, 'height': height})
            expect(heading).to_have_text('Daily practice')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, height)
            if (width, height) == (844, 390):
                expect(page.locator('.sidebar')).to_be_hidden()
                expect(nav).to_be_visible()

        page.set_viewport_size({'width': 390, 'height': 844})
        nav.locator('[data-view=home]').click()
        home_settings.click()
        page.locator('[data-pref=theme]').select_option('light')
        expect(page.locator('body.light')).to_be_visible()
        button('Back').click()
        expect(page.locator('.home-screen')).to_be_visible()
        nav.locator('[data-view=collections]').click()
        collection.click()
        expect(heading).to_have_text('Daily practice')

        # Deleting the collection must preserve the seeded lessons and progress.
        before = fixture.wait_for_library(
            page,
            lambda data: any(c['name'] == 'Daily practice' for c in data['collections']),
            'renamed test collection before deletion',
        )
        collection_id = next(c['id'] for c in before['collections'] if c['name'] == 'Daily practice')
        button('Collection options').click()
        page.once('dialog', lambda dialog: dialog.accept())
        button('Delete collection').click()
        saved = fixture.wait_for_library(
            page,
            lambda data: all(c['id'] != collection_id for c in data['collections']),
            'deleted test collection',
        )
        assert [c['id'] for c in saved['collections']] == ['old']
        assert len(saved['lessons']) == 72
        assert saved['lessons'][0]['statuses']['a']['practised']
        assert not errors, errors
        print('PASS Collections, player audio, Queue/Options, Back/Forward, settings and saved deletion. '
              'Player viewports 320×568, 390×844 and 844×390. Collections also 430×932, 820×1180 and 1440×900.')


if __name__ == '__main__':
    run()
