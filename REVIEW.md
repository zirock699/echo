# Echo Studio implementation review, 18 November 2026

The original specification is preserved in docs/ORIGINAL_SPEC.md. The subsequent confirmed interview decisions are in docs/PLAYER_DECISIONS.md and override the earlier player composition.

## Implemented changes

The practice screen is reduced to the phrase, a compact visible YouTube player when that source is selected, a contextual Play/Pause/Replay button, a quiet reset control, and Next after phrase completion. Queue and gear access sit in the header. Counts, flags, mode selection, speed, loop and seek tools are no longer permanent player components.

Next marks the phrase Practised and starts the next. Auto advancement does not mark practice. Mobile's dedicated swipe gap shares the Next action and supports previous-phrase navigation without marking. The queue preserves navigation state and loads long lists incrementally.

Startup preparation uses the same paused media controller, starting with cached lesson metadata while synchronisation runs. A pinned lesson or the last-used lesson can be selected. Native audio requests preloading; YouTube decides its own media buffering. No unsupported quality API is used.

Lesson options now support user-supplied audio files up to 50 MB, a source selector and audio timing offset. Production file storage uses the Sites R2 BUCKET binding. Every upload/read/delete requires the signed-in owner's identity; reads support byte ranges. Files are not embedded in JSON backups. File removal waits for the source change to synchronise, so an offline edit does not break the saved cloud copy.

Home retains resume, recent lessons, search, favourites and collection access. Transcript import/editing/regrouping, IPA overrides, independent practice statuses, sessions, backup and synchronisation remain available.

## Verification

31 Node tests pass, covering transcript and phrase logic, IPA, transport labels, gesture thresholds/direction, Manual/Automatic/Continuous control, Next practice marking, Reset/Replay, audio offset and pending seeks, audio source switching, upload bounds, owner isolation, partial range reads, revision conflicts and retry handling.

Actual browser checks used the preview's local API, with real application code and the real YouTube embed. Confirmed lesson creation, saved metadata after reload, Next moving to the next phrase and marking the prior phrase Practised in the queue, gear menu access, and responsive layouts. The 360×640 phone and 844×390 landscape layouts measured exactly the viewport height with no horizontal or page overflow, with video viewports at least 200 px high and controls inside the screen. The 390×844 layout was also checked. The live production site remains private.

The browser upload approval gate declined the synthetic test-file upload. That file-picker upload was not retried or bypassed. The backend/native-audio tests pass, but the full browser upload-to-play journey and cross-device production file access are not claimed as verified. Real YouTube streaming also stalled in this cloud browser; successful real-media phrase playback remains a real-device acceptance check. Swipe direction and action semantics are tested as code; physical Android touch interaction remains unverified.

## Existing limits

The IPA dictionary is limited and marks unknown words explicitly. Automatic transcript retrieval is not implemented. Tactiq captions supply start times only, so end boundaries remain estimated. Durable state uses per-owner versioned JSON snapshots in D1, with explicit conflict resolution rather than field-level merging. Real Android PWA installation, background playback and cross-device production synchronisation have not been fully verified. No microphone, pronunciation scoring or YouTube-media extraction is implemented.

## Follow-up UI correction

Replaced the accumulated CSS overrides with one responsive stylesheet. Reduced the desktop stage and phrase scale, restored Next as a visible secondary action, labelled Queue and Options, and grouped the existing controls into three option tabs. Short playback/sync notices expose details only on request. Removed repeated navigation taglines and the invented profile block. Corrected nested thumbnail buttons and added keyboard navigation to option tabs.

Browser checks confirmed all three option tabs, conditional phrase-range fields, compact sync-conflict review, and no page overflow at 360×640 and 844×390. Main transport and YouTube rectangles remained inside the viewport. Existing playback, upload and synchronisation limits above remain unchanged.

## Reference-driven player redesign

See docs/PLAYER_REDESIGN.md for the current visual decisions, preserved behaviour, browser viewport checks and verification limits. This supersedes earlier visual descriptions. All 36 Node tests and the Worker build pass. Production lessons and database records are not rewritten by deployment.
