# Collections and mobile navigation

## Review and changes

The previous app changed screen variables without creating browser history entries. Native phone Back therefore could leave the application instead of returning from the player, and Settings offered no visible return action. Collections used a management dialog containing the entire lesson library; saving required reaching the bottom of that list and there was no focused collection listening journey.

`src/navigation.mjs` now tracks same-document screen and sheet entries. Back closes a sheet, then restores the originating screen with collection/course, search, page and scroll context. Closing/completing sheets consumes or replaces their entry; typing and playback renders replace state instead of adding entries. At the app root, native Back retains browser behavior. Settings and the player expose the same visible Back action. Reload restores the screen, without autoplay. Navigation does not serialise/recreate the playback clock or asset adapters. A pending queue scroll callback safely tolerates its sheet being removed.

`src/collections-ui.mjs` preserves the existing collection schema and persistence. Collections are playlists of existing lessons, not a second course hierarchy. The list opens a detail screen with Continue, search, bounded lesson rows, Add lessons and explicit Edit list ordering/removal. A paginated searchable picker keeps Save reachable and retains selection across pages. Rename and confirmed collection deletion do not change lessons/assets/progress. No dependencies or data migration were added.

Phone landscape uses mobile presentation instead of accidentally switching to the desktop sidebar. Back, Queue and playback option targets meet the 44px minimum. Settings switches are associated with their labels. Collection and Settings styling uses the existing neutral palette in both themes.

## Reproducible checks

- `npm test`: navigation-history and collection/persistence contract tests, plus the existing playback, parsing and storage suites.
- `npm run build`; no lint command is configured.
- `python3 tests/browser_navigation.py` owns a disposable loopback server and generated WAV library. It exercises collection creation and rename, paginated selection, ordering, removal, native Back, reload, Queue and Options dismissal, Settings return paths and continued audio. It checks phone, touch landscape, tablet and desktop layouts and verifies that deleting a test collection preserves its lessons and progress.
- `python3 tests/browser_sync.py` owns a separate disposable server and uses synthesized spoken MP3 and SRT to verify native transport, ZIP import and paused resume.

Screenshots alone do not establish playback correctness. These browser tests use Chromium and native local audio; physical Android/iOS gestures, OS microphone UI and live YouTube streaming are not verified by them. YouTube's API was blocked by this environment during recovery. The recovered timing engine is unchanged by these navigation/collection changes.
