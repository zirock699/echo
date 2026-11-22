# Current review

See [REVIEW.md](REVIEW.md) for the 18 November 2026 repairs and current verification. The report below records the original source delivery and is historical.

# Echo Studio | Factual verification report

**Date:** 17 November 2026

## Implemented and inspected in source

- Responsive library/home/collections/settings and immersive player interface.
- SRT, WebVTT and JSON transcript parsing; timestamp validation and global offset.
- Natural phrase grouping using reliable segment boundaries without invented word timings.
- Phrase correction, timing adjustment, manual split, merge, regroup preview and recent structural undo.
- Independent Practised and Difficult statuses, phrase selections and listening interval coverage tracking.
- One YouTube IFrame API adapter with Manual, Automatic and Continuous modes, stop/seek/replay/loop/speed controls and playback state handling.
- Word IPA popover, starter broad British IPA dictionary and saved manual overrides.
- Personal library search, favourites, lesson metadata, collections and practice-session history.
- JSON backup export/import, IndexedDB cache, conditional D1 snapshot service, optimistic revisions, offline retries and conflict UI.
- Light/dark/system theme, keyboard shortcuts, touch swipe, wake lock request, PWA shell and responsive media dock.

## Tests actually run

| Test | Outcome | What it covers |
| --- | --- | --- |
| Node `node --test tests/*.test.mjs` | **11 passed, 0 failed** | Transcript formats/times, validation, grouping, editing, progress remapping, selection/pause/coverage, IPA, URL parsing, server auth/optimistic revisions and owner isolation (fake D1). |
| Playwright browser smoke, desktop 1440×900 | **Passed** | Import, preview, save, phrase display, status toggle, mode, next, phrase queue, practice selection, no uncaught JS errors or horizontal overflow. Uses in-memory YouTube adapter and inlined modules because sandbox browser HTTP access was blocked. |
| Playwright browser smoke, mobile 390×844 | **Passed** | Same UI journey with mobile layout; specifically verified no horizontal overflow and corrected a video/control overlay issue. Uses in-memory YouTube adapter. |
| Playwright extended desktop journey | **Passed** | Phrase text/timing edit and pause override UI, split, undo, lesson rename, favourite, collection create, theme toggle, no uncaught JS errors. Uses in-memory YouTube adapter. |
| `node --check` app/player/store | **Passed** | Source syntax. |

A real YouTube network test, actual authenticated Sites execution, D1 migration in Sites, cross-device synchronisation, offline recovery on real devices and PWA installation **were not performed**. No deployed Sites URL was created.

## Not fully verified / restricted

1. **Sites deployment**: this chat's toolset cannot create a Sites project, provision D1 or publish a deployment. Only project files and a server adapter were produced.
2. **D1/auth integration**: server code and fake-D1 logic were tested, but actual bindings and identity forwarding must be checked on a hosted Site.
3. **Real playback**: source uses the official IFrame API; real YouTube embedded playback and mobile autoplay restrictions must be checked against an available embeddable video.
4. **IPA**: limited dictionary coverage, not an authoritative connected-speech transcription.
5. **Mobile PWA**: assets and service worker are present, but installation and wake lock remain unverified.
6. **Large libraries**: no queue virtualisation; performance under very long transcripts remains unverified.
7. **Database schema**: a D1 JSON snapshot with revision control replaces the originally requested fully relational tables. This is a deliberate incomplete area of the specification.
8. **Session analytics**: active listening and coverage are measured by player samples. Exact active speaking time is not captured because no microphone is recorded.

## Mandatory deployment checks

- Confirm the hosted Site requires sign-in and the `/api/state` endpoint rejects signed-out and other-user access.
- Apply `server/schema.sql` to the actual D1 binding and verify save/reload, two-device synchronisation, conflict and restore.
- Open a real permitted YouTube video and verify play, seek, Manual stop, Automatic pauses and full Continuous playback without skipping gaps.
- Check mobile Chrome/Android player visibility (at least 200×200), manual and Automatic operation, touch and keyboard interactions.
- Test lost network mid-practice; ensure pending local changes survive refresh and appear on another device after sync.
- Test installed PWA and service worker, including that YouTube video/audio do not play offline.
- Inspect browser console and network error handling at deployment address.

**Release assessment:** useful functional source and browser-tested prototype, **not a production-complete or deployed Site**.
