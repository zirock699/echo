# Echo Studio review checklist

Read only the surface sections relevant to the task. Root DESIGN.md and the latest product requirements remain authoritative; this checklist does not duplicate their token values.

## Source map

- `src/app.mjs`: screen templates, lesson cards, home/library, queue, options, import/edit dialogs, compact player and delegated actions.
- `src/style.css`: shell, forms, shared controls, navigation, cards and compact player.
- `src/player.css` then `src/mobile-player.css`: player presentation and final viewport overrides. Check both before adding CSS.
- `src/player-layout.mjs`, `src/practice.mjs`: fitting, feedback, transport states and dedicated mobile gestures.
- `src/player.mjs`, `src/audio.mjs`: playback engine and uploaded-audio adapter; preserve their responsibilities.
- `src/transcript.mjs`, `src/ipa.mjs`: parsing, grouping, editing, timing and pronunciation.
- `src/store.mjs`, `server/`: local/cloud state, conflict handling and private uploaded audio.
- `docs/reference-mobile.png`, `docs/reference-desktop.png`: earlier visual direction; `docs/screenshots/`: historical larger-video implementation. Latest conversation-image guidance is described in DESIGN.md.

## Home and lesson library

- Can the user resume the last lesson directly at its saved position?
- Do thumbnail, recognisable title and explicit progress lead the reading order?
- Are management/favourite actions subordinate to play/resume?
- Do search, filters, collections and empty-result recovery remain available?
- Are listened position and Practised percentage distinguished?
- Can long titles and the last lesson row remain readable/reachable above persistent UI?

## Expanded player

- Does the active phrase dominate, followed by the primary transport?
- Are restart-current-phrase and Next clear, with speed/modes and other options discoverable but secondary?
- Do loading, buffering, speaking pause, failure and phrase completion preserve stable control placement?
- Does Next mark practice while automatic advancement/listening do not?
- Are the 200 × 200 YouTube viewport and uploaded-audio/no-video distinction preserved?
- Can long/enlarged text scroll internally without hiding controls or scrolling the outer practice viewport?

## Minimised player

- Does it retain lesson, source, phrase, speed, play/pause and position through navigation and expansion?
- Are expand and play/pause separate, understandable actions?
- Does it clear bottom navigation, safe areas and the last content row?
- Is YouTube still visible/compliant? If essential navigation and visible video cannot fit, preserve position and pause with a clear explanation rather than hiding playback.

## Transcript and shadowing

- Is the text readable with correct wrapping and predictable internal scrolling?
- Is highlighting based on actual word timing, without distracting pulsing or animation?
- Does deliberate scrolling/text selection avoid fighting automatic following?
- Do replay, text visibility, IPA, edits, split/merge, regroup/undo and filters retain their meaning?
- Do gestures stay in the mobile gesture area with button/keyboard alternatives?

## Cross-screen quality

- Check spacing rhythm, type hierarchy, semantic colours, borders/radii, focus and contrast in both themes.
- Review 320 × 568 and 390 × 844 mobile constraints before tablet (820 × 1180), desktop (1440 × 900), short landscape and enlarged text. These are review targets, not automatic claims of tested viewports.
- Check labels, keyboard paths, nonoverlapping touch targets, focus restoration, reduced motion and noncolour state cues.
- Check actionable empty/error feedback, preserved input and progress, sync conflicts and source failures.
- Prefer restrained music-player structure over decorative dashboard statistics and competing controls.

## Evidence record

For each important finding record: severity; surface/source; observed evidence or code-based risk; user impact; proposed correction; verification method and result. For supplied screenshots, note unknown viewport/theme/freshness rather than guessing. Finish with the highest-impact remaining issue, not an endless list of speculative refinements.
