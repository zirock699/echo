# First-application playback recovery — 23 November 2026

## Correct baseline

The user's original engine is **`f69042d`**, the first application commit on `main`. The preceding root commit `8b20d8a` contains only a README. The earlier `205bf45` recovery used the later replacement `bfc7457`; its original-engine claim was incorrect.

In `f69042d`, `src/components/Player.tsx`, mounted by `src/App.tsx`, reads native `audio.currentTime` on `timeupdate`, finds the **first** original SRT cue satisfying `start <= time < end`, and updates the displayed cue. In overlaps the first matching cue wins; in gaps the previous displayed cue stays visible. It does not automatically pause at caption ends. Replay starts exactly at the cue start. The separate `src/services/audioSync.ts` is not the player mounted by App.

## Restored contract

- Normal listening defaults to Continuous, zero lead-in and original transcript cues. It does not stop or replay when a caption ends. Source-clock matching uses the first application's exact interval rule, including overlaps and gaps.
- Native `timeupdate` and `seeked` events update the controller. The existing 100ms sampling also supports the YouTube adapter. No synthetic wall clock or seek-blocking state machine is introduced.
- Continuous replay/Next/phrase selection seek to the cue start, regardless of the separate shadowing lead-in preference.
- Manual and Automatic remain explicit shadowing choices, with their existing lead-in, speaking pauses and marking rules. Their end guard no longer deliberately pauses 45ms before the phrase end. Polling/browser/media latency still bounds physical stopping accuracy.
- Mirror remains separate: Record/comparison may use its own original-segment playback. Main Play/Pause/Replay always returns to PlayerEngine. No automatic playback of the user's attempt is added.
- Startup/reload never autoplay. Audio offsets, YouTube source switching, progress, navigation, recording and editing remain supported. This ports the first player's timing contract to the current architecture; it does not replace the application with the old React UI or claim that the first application supported YouTube.

## Existing data and preferences

`src/playback-recovery.mjs` runs once per eligible lesson. For unedited lessons it reparses a usable retained source transcript with its stored global offset, or uses validated stored segments when no source exists. It restores individual cue boundaries/text instead of retaining generated phrase cuts. Invalid source timestamps are not fabricated or silently replaced.

Changed lessons retain a `playbackRecoveryBackup` with the previous phrases, segments, statuses and progress, plus an ordinary Undo revision. Current media/assets, position, coverage, completion, collections and course references remain in place. Exact cue IDs are reused when possible; flags on an encompassing practised/difficult phrase transfer to its contained source cues. Old flags and the old position remain in the backup. Undo does not overwrite the current playback position. Deliberate edits/regrouping with existing revisions are left intact. Such lessons can explicitly use Regroup → Original transcript cues after reviewing the preview; Undo remains available.

The one-time preference recovery stores the previous mode/lead-in/grouping under `previousPlaybackDefaults`, then restores Continuous/0/Original. Later explicit choices persist and are never reset by this migration again. Fresh libraries start with the correct defaults without generating a pending write or startup conflict. Legacy libraries loaded from cache/cloud retain their missing version marker until migration runs, so defaults merging cannot hide the recovery. Normal sync conflict rules remain in effect.

New ZIP imports preserve SRT cues and source text. Manual import/regroup/settings expose Original transcript cues alongside the existing optional grouped lengths. The service worker cache version is updated and includes the recovery module.

## Verification and limits

`npm test` includes a direct comparison against the first application's cue-selection algorithm across cue ends, gaps, overlaps and backward/forward clock changes. It verifies no boundary pauses in normal listening, exact replay, explicit shadowing boundaries, recovery backups/status/progress, edit preservation, idempotence and cloud persistence. Existing playback, import, storage, recording and permission tests remain.

`npm run build` builds the Worker. No lint command is configured.

`tests/browser_sync.py` runs real synthesized spoken MP3 and ZIP/SRT import regression checks on a disposable local server, including explicit Manual/Automatic/Continuous, speeds, lead-in, native-clock/text samples, navigation and reload. `tests/browser_original_playback.py` checks legacy grouped-data recovery, uninterrupted native playback over short cue ends, cue display/replay, persistence/backups, later Manual choice and responsive layouts. These tests replace only disposable localhost fixture libraries.

Fresh screenshots are separate visual evidence; source tests are not visual checks. Live YouTube streaming and the user's affected personal lessons remain unverified without access to them. Simulated YouTube API tests and actual local MP3 playback are different evidence. Pushing this code is not production deployment.
