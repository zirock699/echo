# Mobile annotation implementation review

The three sets contain 27 comments. Later comments override earlier positions for Compare and minimised YouTube behaviour. The audio/transcript synchronisation engine remains unchanged.

| Comment | Result |
| --- | --- |
| First 1 | Compare uses an icon; latest placement is beside the clock below the phrase. |
| First 2 | Player logo removed. |
| First 3 | Permanent idle Echo Mirror caption removed. Assistive recording announcements remain. |
| First 4 | Permanent phrase-position badge removed; position remains in the queue. |
| First 5 | Course heading and continuation controls compacted; latest toolbar uses one menu. |
| First 6 | Library count moved into the heading. |
| First 7 | Library type filters are slim chips with 44px touch targets. |
| First 8 | YouTube and audio mini players share a 64px strip. Video uses a small live viewport. |
| First 9 | Recognisable gear and consistent top-right settings placement. |
| First 10 | Collection count, options and Continue share a compact line. |
| First 11 | Six opt-in category presets and custom keyword/course/tag/progress filters. |
| First 12 | Single-row selection toolbar with count, Cancel, Select all and Actions. |
| First 13 | Library management separated from the top-right settings gear. |
| First 14 | Close and deliberate horizontal swipe dismiss and pause the mini player without deleting progress. |
| Second 1 | Grid-card menu has a smaller visual treatment within a 44px target. |
| Second 2 | Artwork-led cards, restrained title/creator/progress hierarchy and less container chrome. |
| Second 3 | Mobile auto-loading with a Load more fallback; desktop pagination retained. |
| Second 4 | Collection headings, gutters, rows and controls share the browsing system. |
| Second 5 | Dedicated Search screen across lessons/courses/collections, type filters and removable history. |
| Second 6 | Compact settings rows, inline native values and switches replace bulky stacked form controls. |
| Second 7 | Removed unnecessary player rows; phrase typography fits available height, with a bounded area for unusually long text. |
| Second 8 | Footer now has quiet tools and balanced transport controls; timelines are on demand. |
| Second 9 | Video occupies a fixed stage slot without a floating shadow. |
| Second 10 | Source artwork supplies a dimmed background; source thumbnails are reused throughout browsing. |
| Third 1 | One course management menu, with Continue, Filter and Layout in a deliberate action row. |
| Third 2 | Only the gear in the player top-right; other tools are beside the clock. |
| Third 3 | Minimising retains the same YouTube iframe and playback request. Closing still pauses it. |

## Verification

Node tests cover custom category matching/save/rename, search types/history removal, progressive mobile result loading and swipe discrimination, alongside existing playback/storage/import regressions. The build and packaged Worker authentication/routes were checked. No lint command is configured.

Cloud browser checks use the signed-in hosted application with real saved lessons and a same-origin responsive viewport page. Checks include phone player overflow, on-demand Compare, library chips/cards, the single course menu, selection, automatic extension from 24 to 40 lessons, collection overview/detail, settings in both themes, category presets/custom editor and Search/history removal.

The YouTube embed loads, but its video remains at readyState 0/time 0 in this cloud browser, both inside and outside the responsive frame. The same iframe is retained at 40 × 40 when minimised; actual continuous streamed playback cannot be claimed as verified here. Uploaded-audio playback was exercised. Physical phone touch gestures require device testing; the Close action was exercised and swipe intent is covered by Node tests.

Player bounds were measured at 320 × 568, 331 × 518, 390 × 844, 515 × 515, 768 × 1024, 1440 × 900 and 844 × 390. Document dimensions matched each viewport, and the footer remained within it. Screenshots were inspected for the compact phone player, library cards/selection/course controls, collection overview/detail, settings in both themes and short landscape. Final text-centering and header-style corrections are checked again after publication.

The cloud library is being updated from another device during testing. Conflicts remain explicit; test changes must not overwrite the newer cloud copy. No private transcripts, exports or source audio are committed.

## Follow-up set, 24 November 2026

| Comment | Implementation | Verification |
| --- | --- | --- |
| 1 | Final See all card in every shelf, with four real member thumbnails and the shelf's full destination. | Four image tiles and last-card position inspected; course card opens the complete Courses Library. Destination/filter matching and artwork expansion covered by tests. |
| 2 | Home category strip removed. | Hosted DOM and screenshots show no category strip; category shelves/management remain available. |
| 3 | Phrase seek slider restored beside supporting controls on the player. | Keyboard Home/Right changes the real uploaded-audio phrase position; clock updates; no page overflow. |
| 4 | Mobile swipes across the phrase stage; up to five phrases, faded by distance; context reduces with available height. | Five visible at 390 by 844, three at 320 by 568 audio, current phrase only on short YouTube/landscape. Eligible queue edge cases tested. Physical touch still needs phone testing. |
| 5 | Compact sparse shelves, real Keep practising/Not started sections, and complete-list artwork cards. | Home screenshots inspected in dark/light mobile and dark 1280 by 800 desktop. No horizontal document overflow. |
| 6 | Update search results without replacing the input; preserve search selections through other app renders; defer composition updates. | Continuous typing of philosophy and insertion of test before the last two characters retained correct order and cursor. Composition and stable-input regressions covered by tests. |

Hosted checks used the signed-in existing app and saved audio/YouTube lessons. Player dimensions were checked at 320 by 568, 390 by 844, 768 by 1024 and 844 by 390; Home also at 1280 by 800. Dark and light Home/player screenshots were inspected; original Dark preference restored. A 200% text check kept the player within its viewport. These checks do not prove real YouTube streaming or physical mobile gestures. Localhost browser QA was rejected by automatic approval review in favour of the authorised hosted Site. No new transcript or media data is committed.

## Continuous transcript follow-up, 24 November 2026

| Comment | Implementation |
| --- | --- |
| 1 | Replace spaced context blocks with a persistent transcript scroller. Closer line spacing, active-line emphasis and fading neighbours. Clicking or keyboard-activating a line plays it; scroll freely in either direction and return to the active line. Native smooth following, instant initial/reduced-motion positioning, and scroll preservation through transport renders. |
| 2 | Artwork-led music-player header with a two-line lesson title, creator, collapse control and gear. No app branding or phrase badges. |
| 3 | One artwork backdrop and gradual overlay across the full player, with transparent header/control surfaces. |

The hosted player was inspected with real uploaded audio: direct forward/backward line selection, keyboard browsing, return to the active phrase, current-word actions and native scroll positioning. Regression tests cover centring, reduced motion, and preservation of the exact reading node and manual scroll position across transport renders. These checks do not establish physical touch behaviour or successful YouTube streaming. The transcript scrolls inside the fixed player; this is distinct from unwanted document scrolling.

Final continuous-transcript screenshots were inspected at 320 by 568 and 390 by 844 in dark mode, at 390 by 844 in light mode, and at 844 by 390 and 1280 by 800 in dark mode. The main document stayed within the viewport; the transcript remained independently scrollable. The return action sits outside the transcript edge mask so it stays readable. The light header's inherited background was removed after inspection to keep the backdrop continuous.
