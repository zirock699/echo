# Player redesign, 18 November 2026

This revision implements the supplied desktop and mobile player references and the attached media-player redesign brief. It supersedes the earlier compact player presentation in PLAYER_DECISIONS.md where they differ.

- The main view uses a single ambient background, lesson header, phrase, visible YouTube player, phrase progress and three circular transport controls.
- Secondary phrase position and markers are discreet on desktop. Mobile keeps position and moves markers into Practice options.
- The original recording timeline is collapsed by default and removes its row when closed.
- Queue reclaims main-page width on desktop and opens as a sheet on mobile. Desktop open preference is saved with existing preferences. Jumping preserves the playback state; mobile selection closes the sheet.
- Playback, Practice and Lesson options retain mode, supported speed, pause, lead-in, filters, editing, private audio replacement and existing data controls. IPA opens on demand instead of remaining below the phrase.
- Unlimited-loop controls and shortcut are removed. Replay, restart, manual Next marking and mobile swipe rules remain connected to the existing controller.
- Color Thief 3.5.0 is locally vendored with its MIT licence. Thumbnail extraction runs once per lesson, refines colours to dark backgrounds, caches metadata through the existing store, and falls back to a stable lesson-specific palette on failure. It never inspects iframe video pixels or blocks playback.
- No framework migration, database migration, database reset or storage binding change.

## Verification

36 Node tests pass, including asynchronous YouTube speed changes, replay/Next semantics, Manual/Automatic/Continuous, audio adapter/API isolation, transcript import, sync conflicts, palette refinement and fallback caching. The Worker build and git whitespace check pass.

The browser preview used existing test lessons and actual transcript text. Inspected desktop and mobile against both supplied references. Checked widths 320, 375, 390, 430, 768, 1280, 1440 and 1920, plus 844 by 390 landscape. No horizontal overflow. YouTube viewport remains at least 200 by 200. On the shortest phone, More options may need a small natural scroll; primary controls remain within the initial viewport for the checked phrases. At 200% phrase text, words wrap and the page scrolls rather than clipping content.

Checked the queue, all three options tabs, IPA sheet, collapsed recording details, saved speed selection and Next's Practised marker. Thumbnail palette extraction succeeded in the preview and its persisted palette was reused after reload.

YouTube metadata and iframe initialise, but streaming stalls in the cloud test browser. Real end-to-end YouTube streaming therefore remains unverified. Browser audio uploads were not retried after the earlier declined file-upload action. Audio code and private storage tests pass. This revision does not claim that production streaming or full browser upload-to-play was verified.
