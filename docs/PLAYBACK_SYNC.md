# Playback synchronisation repair, 23 November 2026

## Correct baseline

The user's original engine is **`f69042d`**, the first application commit on `main`. The preceding root commit `8b20d8a` contains only a README. The earlier `205bf45` recovery used the later replacement `bfc7457`; its original-engine claim was incorrect.

In `f69042d`, `src/components/Player.tsx`, mounted by `src/App.tsx`, reads native `audio.currentTime` on `timeupdate`, finds the **first** original SRT cue satisfying `start <= time < end`, and updates the displayed cue. In overlaps the first matching cue wins; in gaps the previous displayed cue stays visible. It does not automatically pause at caption ends. Replay starts exactly at the cue start. The separate `src/services/audioSync.ts` is not the player mounted by App.

## Restored contract

- Normal listening defaults to Continuous, zero lead-in and original transcript cues. It does not stop or replay when a caption ends. Source-clock matching uses the first application's exact interval rule, including overlaps and gaps.
- Native `timeupdate` and `seeked` events update the controller. The existing 100ms sampling also supports the YouTube adapter. Media time remains authoritative; asynchronous seeks retain their selected phrase until the source confirms the destination.
- Continuous replay/Next/phrase selection seek to the cue start, regardless of the separate shadowing lead-in preference.
- Manual and Automatic remain explicit shadowing choices, with their existing lead-in, speaking pauses and marking rules. Their end guard no longer deliberately pauses 45ms before the phrase end. Polling/browser/media latency still bounds physical stopping accuracy.
- Mirror remains separate: Record/comparison may use its own original-segment playback. Main Play/Pause/Replay always returns to PlayerEngine. No automatic playback of the user's attempt is added.
- Startup/reload never autoplay. Audio offsets, YouTube source switching, progress, navigation, recording and editing remain supported. This ports the first player's timing contract to the current architecture; it does not replace the application with the old React UI or claim that the first application supported YouTube.

## Existing data and preferences

`src/playback-recovery.mjs` runs once per eligible lesson. For unedited lessons it reparses a usable retained source transcript with its stored global offset, or uses validated stored segments when no source exists. It restores individual cue boundaries/text instead of retaining generated phrase cuts. Invalid source timestamps are not fabricated or silently replaced.

Changed lessons retain a `playbackRecoveryBackup` with the previous phrases, segments, statuses and progress, plus an ordinary Undo revision. Current media/assets, position, coverage, completion, collections and course references remain in place. Exact cue IDs are reused when possible; flags on an encompassing practised/difficult phrase transfer to its contained source cues. Old flags and the old position remain in the backup. Undo does not overwrite the current playback position. Deliberate edits/regrouping with existing revisions are left intact. Such lessons can explicitly use Regroup → Original transcript cues after reviewing the preview; Undo remains available.

Timing recovery now preserves the selected mode, lead-in and grouping preferences. It only records its version marker. Earlier deployments may already have saved `previousPlaybackDefaults`; those values are retained, but this repair does not guess whether the current preferences were subsequently chosen deliberately. Fresh libraries start with the correct defaults without generating a pending write or startup conflict. Legacy libraries loaded from cache/cloud retain their missing version marker until migration runs, so defaults merging cannot hide the recovery. Normal sync conflict rules remain in effect.

New ZIP imports preserve SRT cues and source text. Manual import/regroup/settings expose Original transcript cues alongside the existing optional grouped lengths. The service worker cache version is updated and includes the recovery module.

## Verification and limits

`npm test` includes a direct comparison against the first application's cue-selection algorithm across cue ends, gaps, overlaps and backward/forward clock changes. It verifies no boundary pauses in normal listening, exact replay, explicit shadowing boundaries, recovery backups/status/progress, edit preservation, idempotence and cloud persistence. Existing playback, import, storage, recording and permission tests remain.

`npm run build` builds the Worker. No lint command is configured.

`tests/browser_sync.py` runs real synthesized spoken MP3 and ZIP/SRT import regression checks on a disposable local server, including explicit Manual/Automatic/Continuous, speeds, lead-in, native-clock/text samples, navigation and reload. `tests/browser_original_playback.py` checks legacy grouped-data recovery, uninterrupted native playback over short cue ends, cue display/replay, persistence/backups, later Manual choice and responsive layouts. These tests replace only disposable localhost fixture libraries.

Fresh screenshots are separate visual evidence; source tests are not visual checks. Live YouTube streaming and the user's affected personal lessons remain unverified without access to them. Simulated YouTube API tests and actual local MP3 playback are different evidence. Pushing this code is not production deployment.

## Seek alignment repair

The earlier recovery still accepted the previous media clock immediately after `seekTo`. A backward Replay could therefore hit the new phrase end before the seek arrived; Continuous Next could replace the requested text with the old cue. These failures are reproduced by `tests/seek-alignment.test.mjs`, independently of caption grouping.

A pending seek now retains the requested position/text until the source clock reaches the destination and native seeking has finished. Decoder/keyframe preroll is allowed to run towards the target. Stale samples do not add coverage or complete the requested phrase; successive seeks replace prior intent. An eight-second failure pauses with retry guidance instead of trusting an unrelated clock. Pause remains effective during pending seeks. Native seek completion also reconciles externally scrubbed positions.

Manual/Automatic resume before the first phrase now starts at that phrase's configured lead-in, rather than playing an unrelated introduction beneath its text. A pause in the last 100ms resumes the remaining speech. Source offset bounds are checked before playing a phrase; a trimmed recording cannot silently substitute the beginning/end of its audio. Sampling is 20ms, backed by native time events. This reduces foreground boundary latency but is not a sample-accurate or background-mobile playback guarantee.

Verification for this repair: 134 Node tests pass, including twelve new seek-alignment regressions. The initial five new regressions failed before the repair. Browser checks used the actual app/PlayerEngine/AudioAdapter with a disposable in-memory library and generated spoken WAV, with fixture-only source URL mapping. Native audio decoding and media events were real. Dark-theme player layouts were inspected at 320 × 568, 390 × 844, 844 × 390 and 1440 × 900 without page overflow. At 320 × 568 and 390 × 844, Manual playback started at 3.000s for a cue at 3.000s, stopped near 4.904s for its 4.900s end, and selected the second phrase at 5.400s. At 2×, the first cue stopped near 4.937s. Backward queue selection/Replay, Next, Automatic progression and Continuous progression were exercised. These are fixture results, not verification of the user's production lesson files or live YouTube streaming. Production sign-in was blocked by automatic approval review; no production library data was changed during diagnosis.

## Saved rolling captions and library persistence

Testing the signed-in production library exposed a different root cause from seeking. Forty of 42 lessons contained YouTube roll-up SRT captions: whitespace-only display lines, 10ms transition cues, and repeated previous-line context. The old blank-line parser discarded the first spoken cue and interpreted display updates as practice phrases. For example, Mini Philosophy had 86 entries including effectively zero-duration phrases; normalising the same source produces 44 spoken intervals.

SRT/VTT parsing now uses timestamp boundaries, preserves the first spoken line, recognises repeated short display transitions and removes only carried display context. Ordinary repeated speech remains unchanged. Eligible unedited saved lessons repair once with an ordinary Undo revision. Deliberate revisions are excluded. Original source, audio references and offsets, coverage, position and preferences remain intact; exact matching phrase statuses survive, difficult flags transfer by overlap, and changed phrases are conservatively unpractised. No source word timings are invented.

The actual library also exceeded the old 3MB request cap and D1's 2MB row limit. The additive `0001_snapshot_payload` migration retains the existing JSON column/constraint and adds a nullable BLOB. Large snapshots use lossless UUID interning plus native gzip; small and legacy JSON snapshots remain readable. The tested repaired export was approximately 6.53MB JSON and 1.73MB compressed. Requests are bounded at 16MB and stored payloads at 1.95MB. CAS conflict handling and owner isolation remain in place. This is bounded storage, not unlimited library capacity.

Regression tests cover rolling captions, first-line preservation, ordinary repeated speech, edit/Undo protection and idempotent migration. Real SQLite tests apply the original and additive migrations, preserve legacy rows, exercise compressed round trips, JSON constraints, CAS and owner isolation. The private exported library was checked separately and is not committed to the repository. Deployment and live saved-lesson playback must be verified separately from these tests.

Live testing then reproduced a separate lead-in regression on adjacent cues. After a native seek completed, a delayed playing callback or small paused-clock drift could reinterpret the 0.5-second lead-in as the previous phrase. Manual/Automatic now retain the selected phrase throughout its lead-in context; explicit recording scrubs still reconcile normally. Two regressions fail before this change and pass after it.
