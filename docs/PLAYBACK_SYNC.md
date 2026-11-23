# Playback recovery — 23 November 2026

The playback controller has been recovered from commit `bfc7457`, the original source before ZIP courses, Mirror and the later timing patches. This supersedes the earlier seek-guard implementation documented here.

## Restored behaviour

- Manual mode owns the selected phrase and stops against its boundary. Delayed clock samples do not silently choose the next phrase.
- Automatic mode stops the selected phrase, waits for its speaking pause, then advances.
- Continuous mode follows media timestamps and retains gaps.
- Seek/replay commands go directly to the source. The controller does not pause playback to wait for a guessed exact clock position. Approximate seek preroll can advance naturally.
- The original 100ms sampling and phrase-boundary tolerance are restored. No wall-clock discontinuity detector, seek-settling thresholds or new seek-timeout state remain.
- The primary Play/Pause/Replay control always uses PlayerEngine. Mirror uses its own playback only for explicit Record/comparison actions; the primary transport exits Mirror before resuming the original controller. Closing comparison never reroutes main Play to Mirror's audio element.

## Small compatibility changes retained relative to the original

Saved positions can select a matching phrase when imported/repaired cue IDs differ. Explicit recording-timeline seeks choose a matching or upcoming phrase in gaps. Timestamp lookup handles overlapping cues. These are deterministic timestamp lookups, not playback-state guesses. Retry/destruction invalidate callbacks from discarded players. Edit previews use their requested end rather than the ordinary phrase boundary. The audio adapter ignores intentionally interrupted play promises and stale playing events from paused audio.

Caption parsing improvements and verified word/text mapping remain. They do not infer new source timestamps. No CSS or library/navigation redesign is part of recovery.

## Imports and stored data

New ZIP imports use the same balanced phrase grouper as the original manual import workflow, retaining raw caption cues and original SRT separately. Existing stored phrases, statuses, coverage and positions are not silently regrouped. The latest automatic generated-timing rewrite migration has been removed; already stored content is retained. Existing lessons can use the established Regroup preview/undo workflow when desired. Earlier recovery for genuinely empty imported transcripts remains, preserving position and audio.

## Verification

`npm test` covers the original transport contract and the two side-by-side regressions from the review: delayed clock catch-up and a seek landing 200ms before its target. Tests that enforced the deliberately removed seek-blocking state machine were retired and replaced with recovery-contract tests; parser, storage, ZIP, permission, progress and original transport tests remain.

`npm run build` builds the Worker. No lint script is configured.

For browser integration on a disposable local server:

```sh
node scripts/dev.mjs --host 127.0.0.1 --port 4192
python tests/browser_sync.py --url http://127.0.0.1:4192
```

This uses FFmpeg/flite, Playwright and Chromium to generate a spoken MP3 and test application seeking, replay, lead-in, 0.5×/1×/2× playback, Manual/Automatic/Continuous modes, navigation/resume, refresh and real ZIP import with grouped phrases. The legacy 100ms poll is tested with up to 200ms stopping tolerance at 2× speed. Screenshots cover 320, 390, 820 and 1440px. Separate browser checks cover recording and returning from comparison to main-engine Play without concurrent audio, using a simulated microphone.

Live YouTube remains unverified: the earlier browser probe could not reach its API (`ERR_TUNNEL_CONNECTION_FAILED`). API contract simulations and native MP3 playback are different evidence; no production deployment or physical-device streaming claim is made.
