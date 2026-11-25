import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTranscript, validateSegments } from '../src/transcript.mjs';

function preview(source, filename = '') {
  const parsed = parseTranscript(source, filename);
  const validated = validateSegments(parsed.segments);
  return { format: parsed.format, problems: [...parsed.problems, ...validated.errors], cues: validated.segments };
}

test('manual WebVTT import accepts headers, regions, styles and comments around valid cues', () => {
  const source = [
    '\uFEFFWEBVTT - rehearsal captions',
    'Kind: captions',
    'Language: en',
    'X-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:900000',
    '',
    'STYLE',
    '::cue { color: white; }',
    '',
    'REGION',
    'id:stage',
    'width:60%',
    '',
    'NOTE introductory comment',
    'This is not a spoken cue.',
    '',
    'NOTEworthy',
    '00:01.125 --> 00:02.875 region:stage line:90%',
    'The year is',
    '2024.',
    '',
    'NOTE between cues',
    '',
    'final-line',
    '00:03.125 --> 00:04.250 align:start',
    'The last cue.',
    '',
    'NOTE end of file',
  ].join('\r\n');

  const result = preview(source);
  assert.equal(result.format, 'WebVTT');
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.cues.map(({ start, end, text }) => [start, end, text]), [
    [1.125, 2.875, 'The year is 2024.'],
    [3.125, 4.25, 'The last cue.'],
  ]);
  assert.deepEqual(result.cues[0].captionLines, ['The year is', '2024.']);
});

test('unrecognised, misplaced and broken cue blocks still produce a WebVTT import error', () => {
  const valid = '00:01.000 --> 00:02.000\nA good cue.';
  for (const [badBlock, expected] of [
    ['STYLE rehearsal\nThis text has no timestamp.', /no timestamp/],
    ['STYLE\n::cue { color: white; }', /before the first cue/],
    ['REGION\nid:late', /before the first cue/],
    ['missing-timing\nA cue with no time.', /no timestamp/],
    ['bad-timing\nnot a time --> 00:04.000\nA bad cue.', /invalid time/],
    ['zero-length\n00:04.000 --> 00:04.000\nA point cue.', /end must be after start/],
  ]) {
    const result = preview(`WEBVTT\n\n${valid}\n\n${badBlock}`);
    assert.ok(result.problems.some(problem => expected.test(problem)), JSON.stringify(result.problems));
    assert.deepEqual(result.cues.map(cue => cue.text), ['A good cue.']);
  }
});

test('a WebVTT filename still permits adjacent pasted cue timing lines', () => {
  const result = preview('00:01.000 --> 00:02.000\nFirst.\n00:02.000 --> 00:03.000\nSecond.', 'captions.vtt');
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.cues.map(cue => cue.text), ['First.', 'Second.']);
});

test('rolling WebVTT preserves a leading space-only display line and normalises repeated context', () => {
  const source = [
    'WEBVTT',
    '00:00.160 --> 00:02.000\n \nFirst spoken line',
    '00:02.000 --> 00:02.010\nFirst spoken line',
    '00:02.010 --> 00:04.000\nFirst spoken line\nSecond spoken line',
    '00:04.000 --> 00:04.010\nSecond spoken line',
  ].join('\n\n');
  const result = preview(source);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.cues.map(({ start, end, text }) => [start, end, text]), [
    [.16, 2.01, 'First spoken line'],
    [2.01, 4.01, 'Second spoken line'],
  ]);
});
