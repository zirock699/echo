"""Check transcript field names, import recovery and both ends of a long preview."""

import re

from playwright.sync_api import expect

from browser_fixture import browser_fixture


VIDEO_URL = 'https://www.youtube.com/watch?v=qaVtt123456'
LESSON_NAME = 'Reference preparation fixture'
FILE_NAME = 'synthetic-long.srt'
REPLACEMENT_FILE = 'synthetic-replacement.srt'
CUE_COUNT = 43


def srt_clock(seconds, milliseconds):
    return f'00:{seconds // 60:02d}:{seconds % 60:02d},{milliseconds:03d}'


def transcript_fixture(*, shift=0, caption='Fictional timed phrase'):
    return '\n\n'.join(
        f'{index + 1}\n{srt_clock(index * 3 + 1 + shift, 250)} --> {srt_clock(index * 3 + 2 + shift, 750)}\n'
        f'{caption} {index + 1}.'
        for index in range(CUE_COUNT)
    )


def transcript_controls(form):
    transcript = form.get_by_role('textbox', name='Timestamped transcript', exact=True)
    expect(transcript).to_have_attribute('id', 'transcript-text')
    upload = form.get_by_label('Upload transcript file', exact=True)
    expect(upload).to_have_attribute('id', 'transcript-file')
    expect(upload).to_have_attribute('type', 'file')
    expect(upload).to_have_accessible_description(re.compile(r'TXT.*SRT.*VTT.*JSON'))
    upload.focus()
    expect(upload).to_be_focused()
    return transcript, upload


def check_preview_row(form, caption, bounds):
    row = form.locator('.preview-list .preview-row').filter(has_text=caption)
    expect(row.locator('time')).to_have_text(bounds)
    row.scroll_into_view_if_needed()
    expect(row).to_be_in_viewport()


def verify_reference_preparation(fixture):
    page, errors = fixture.open_page(320, 568)
    home = page.get_by_role('main')
    home.get_by_role('button', name='Add lesson', exact=True).click()
    add = page.get_by_role('dialog', name='Add lessons', exact=True)
    add.get_by_role('button', name=re.compile(r'^YouTube lesson')).click()
    form = page.get_by_role('dialog', name='Create a lesson', exact=True)
    transcript, upload = transcript_controls(form)
    url = form.get_by_label('YouTube URL', exact=True)
    title = form.get_by_label('Lesson title', exact=True)
    grouping = form.get_by_label('Phrase length', exact=True)
    offset = form.get_by_label('Global offset (seconds)', exact=True)
    preview = form.get_by_role('button', name='Preview phrases', exact=True)
    save = form.get_by_role('button', name='Save & practise', exact=True)

    url.fill(VIDEO_URL)
    title.fill(LESSON_NAME)
    grouping.select_option('original')
    offset.fill('0.5')
    transcript.fill('This draft has no timestamp.')
    before = fixture.state()
    preview.click()
    alert = form.get_by_role('alert')
    expect(alert).to_be_focused()
    expect(alert).to_contain_text(re.compile(r'timestamp', re.IGNORECASE))
    expect(transcript).to_have_attribute('aria-invalid', 'true')
    expect(transcript).to_have_accessible_description(re.compile(r'timestamp', re.IGNORECASE))
    expect(save).to_be_disabled()
    expect(transcript).to_have_value('This draft has no timestamp.')
    expect(url).to_have_value(VIDEO_URL)
    expect(title).to_have_value(LESSON_NAME)
    expect(grouping).to_have_value('original')
    expect(offset).to_have_value('0.5')
    assert fixture.state() == before

    text = transcript_fixture()
    upload.set_input_files({'name': FILE_NAME, 'mimeType': 'text/plain', 'buffer': text.encode()})
    expect(transcript).to_have_value(text)
    expect(upload).to_have_accessible_name('Upload transcript file')
    expect(upload).to_have_accessible_description(re.compile(r'synthetic-long\.srt'))
    expect(form.get_by_text(FILE_NAME, exact=True)).to_be_visible()
    preview.click()
    count = form.get_by_role('heading', name=f'Preview · {CUE_COUNT} phrases', exact=True)
    expect(count).to_be_visible()
    check_preview_row(form, 'Fictional timed phrase 1.', '0:01.750–0:03.250')
    check_preview_row(form, f'Fictional timed phrase {CUE_COUNT}.', '2:07.750–2:09.250')
    assert form.evaluate('dialog => dialog.scrollWidth <= dialog.clientWidth + 1')
    expect(save).to_be_enabled()

    # Editing a reviewed input must invalidate the old preview before saving.
    offset.fill('0')
    expect(save).to_be_disabled()
    expect(count).to_be_hidden()
    assert fixture.state() == before
    expect(transcript).to_have_value(text)
    offset.fill('0.5')
    preview.click()
    expect(save).to_be_enabled()
    expect(count).to_be_visible()

    # Hold only this file's read so the previous preview is still the one being replaced.
    page.evaluate('''filename => {
        const readText = File.prototype.text;
        File.prototype.text = async function () {
            if (this.name === filename) {
                await new Promise(resolve => { window.releaseTranscriptRead = resolve; });
                File.prototype.text = readText;
            }
            return readText.call(this);
        };
    }''', REPLACEMENT_FILE)
    replacement_caption = 'Replacement timed phrase'
    replacement_text = transcript_fixture(shift=4, caption=replacement_caption)
    upload.set_input_files({'name': REPLACEMENT_FILE, 'mimeType': 'text/plain', 'buffer': replacement_text.encode()})
    page.wait_for_function("typeof window.releaseTranscriptRead === 'function'")
    expect(count).to_be_hidden()
    expect(form.get_by_text('0:01.750–0:03.250', exact=True)).to_have_count(0)
    expect(preview).to_be_disabled()
    expect(save).to_be_disabled()
    expect(transcript).to_have_value(text)

    # Exercise the delegated guards even if an activation was already queued.
    preview.dispatch_event('click')
    save.dispatch_event('click')
    expect(count).to_be_hidden()
    expect(form).to_be_visible()
    assert fixture.state() == before, 'No lesson may be saved while the replacement file is still reading'

    page.evaluate('() => window.releaseTranscriptRead()')
    expect(transcript).to_have_value(replacement_text)
    expect(preview).to_be_enabled()
    expect(save).to_be_disabled()
    preview.click()
    expect(count).to_be_visible()
    check_preview_row(form, f'{replacement_caption} 1.', '0:05.750–0:07.250')
    check_preview_row(form, f'{replacement_caption} {CUE_COUNT}.', '2:11.750–2:13.250')
    save.click()

    player = page.get_by_role('main', name='Practice player', exact=True)
    expect(player.get_by_text(LESSON_NAME, exact=True)).to_be_visible()
    expect(player.locator('#active-phrase')).to_have_text(f'{replacement_caption} 1.')
    saved = fixture.wait_for_library(page, lambda data: len(data['lessons']) == 1, 'one reviewed transcript saved')
    phrases = saved['lessons'][0]['phrases']
    assert len(phrases) == CUE_COUNT
    assert (phrases[0]['start'], phrases[0]['end']) == (5.75, 7.25)
    assert (phrases[-1]['start'], phrases[-1]['end']) == (131.75, 133.25)
    assert phrases[-1]['text'] == f'{replacement_caption} {CUE_COUNT}.'

    player.get_by_role('button', name='Player settings', exact=True).click()
    options = page.get_by_role('dialog', name='Options', exact=True)
    options.get_by_role('tab', name='Lesson', exact=True).click()
    options.get_by_role('button', name='Replace transcript', exact=True).click()
    replacement = page.get_by_role('dialog', name='Replace transcript', exact=True)
    saved_transcript, _ = transcript_controls(replacement)
    expect(saved_transcript).to_have_value(replacement_text)
    replacement.get_by_role('button', name='Cancel', exact=True).click()
    expect(replacement).to_be_hidden()
    assert not errors, errors
    page.context.close()
    print('PASS separate Add/Replace transcript labels, invalid draft recovery, staged file switch and exact bounds at 320×568.')


if __name__ == '__main__':
    with browser_fixture(__doc__, 'local 43-cue SRT fixture with external media blocked') as fixture:
        verify_reference_preparation(fixture)
