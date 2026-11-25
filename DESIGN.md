# Echo Studio design system

## Authority and scope

Echo Studio is a personal spoken-practice studio. The player remains phrase-led, with direct transport and private practice. The approved Rehearsal Desk direction sets the current visual and navigation hierarchy. Earlier composition and palette sections below record the previous interface and its functional requirements.

## Rehearsal Desk · approved 25 November 2026

- **Rehearse** leads with an original situation and **Talk now**. A saved reference opens at its position for deliberate playback. A separate drill choice offers short, text-only exercises. Existing reference shelves are available on request.
- **Library** groups references, favourites, collections and search. **Journal** shows completed activity and optional notes saved on the verified account. Reopening a Journal item uses the lesson's current saved position and stays paused. An earlier session records what happened in that session.
- Warm paper and ink blue give the light appearance its base. The dark appearance uses deep ink surfaces. The player uses an ink stage and yellow primary transport. Bricolage Grotesque directs attention to the task, and Instrument Sans supports controls and longer reading. Both fonts are served locally. [Shell styles](src/rehearsal.css)
- Replay, Play and Next sit on one aligned row. Record and the optional conversation action use a quieter reserved area. Phrase seek and utility controls share a centre line, with the phrase time underneath. Comparison opens from a successful explicit Stop, and the person chooses whether to listen or keep a take. [Player styles](src/player.css) · [Echo Mirror](docs/ECHO_MIRROR.md)

Read `spec.md`, especially **Confirmed updates and precedence**, and `docs/PLAYER_DECISIONS.md`. Later confirmed requirements override older specification sections and reference compositions. The latest user-supplied references are described below. `docs/reference-mobile.png` and `docs/reference-desktop.png` are earlier references, not the sole visual authority or current video dimensions. `docs/screenshots/` contains an older, larger-video revision. Do not restore that layout.

## Latest reference direction

The user supplied three images after this document was first created. They are conversation attachments, not files currently saved under `docs/`; the descriptions here preserve their intended guidance for future tasks.

| Reference | Apply to Echo Studio | Preserve Echo-specific rules |
| --- | --- | --- |
| Zendocs mobile Library: dark surfaces, large cover thumbnails, clear titles, filter pills and a play action per lesson row | Make resuming the last lesson immediate. Give artwork, title and progress a clear reading order; reduce competing buttons and put management actions in a secondary menu. Use comfortable vertical lesson rows on mobile. | Keep real lesson thumbnails and existing search, favourites and collections. Retain Echo's violet tokens and typography; the reference's gold palette, serif branding and briefing categories are not requested replacements. |
| Expanded music player: dark sheet, clear title/secondary text, progress and dominant transport controls | Keep the active transcript and audio experience dominant, with a clear primary transport and quieter replay/Next. Group speed, speaking pauses and shadowing settings where they are easy to find without crowding practice. | The active phrase takes the visual space occupied by album artwork in the reference. Keep the visible YouTube iframe at 200 × 200, no video for uploaded audio, and existing playback modes. Do not add sleep/favourite/volume controls merely because they appear in the image. |
| Mini player: one horizontal strip above bottom navigation, thumbnail, title, pause and thin progress edge | Use a compact persistent audio bar with a large expansion target, separate transport action and subtle progress. Keep a clear physical gap from navigation. | Preserve lesson, phrase, source, playback state and position during navigation and expansion. A paused YouTube source uses the same artwork strip as audio. YouTube continues in the compact bar with a small live viewport. The expanded player retains the 200 × 200 viewport. |

These references establish hierarchy and interaction intent rather than a pixel-for-pixel copy. Keep expression quiet while the user listens or reads. Transcript highlighting must be accurate and scrolling predictable; avoid decorative animation during spoken-language practice.

Implementation references: `src/style.css` (shell and shared components), `src/player.css` (player), `src/mobile-player.css` (final viewport overrides), `src/ambient.mjs` (palette), and `src/player-layout.mjs` (feedback and fitting). Preserve this cascade until a scoped refactor is requested.

### Established rules versus proposals

Product behaviour and latest user instructions are binding. Existing CSS values below describe the current implementation; they are not evidence that its accessibility or responsiveness is already correct. Proposed semantic token names, component refinements and reference-led library rows guide future scoped implementation, and have not been applied to the app. Resolve uncertain choices by fitting the existing visual language and testing realistic content, not by introducing a new font, palette or framework.

### Visual hierarchy

- Home: resume the last lesson first, browse lessons second, organise/manage third. Add lesson stays obvious without competing with every card action.
- Practice: active phrase first, primary transport second, supporting context third. Give secondary actions less contrast and visual weight, not illegible labels.
- Use spacing, type weight and tonal surfaces before adding containers or dividers. Do not turn every statistic or option into a separate dashboard card.
- Limit each local action group to one dominant action. Reserve the player gradient and glow for the primary transport and meaningful active-word feedback.
- Keep action placement and vocabulary consistent between full player, queue, options and mini player. Disabled, selected, busy and error states must remain distinguishable.

## Implemented course-library direction

The latest charcoal music-player references supersede the earlier violet-player screenshots as visual targets. Mobile Home and the course library now use neutral charcoal surfaces with a restrained warm accent; imported audio players use a quiet charcoal stage and dimmed artwork. The legacy values below still document untouched screens, not a requirement to restore purple glow. Preserve existing playback and the visible YouTube viewport.

## Colour and identity

Reuse existing CSS custom properties rather than inventing parallel palettes.

| Token | Dark | Light | Role |
| --- | --- | --- | --- |
| `--bg` | `#101017` | `#f4f3f8` | Canvas |
| `--bg2` | `#171720` | `#ffffff` | Navigation and cards |
| `--panel` | `#1d1d29` | `#ffffff` | Inputs and raised surfaces |
| `--panel2` | `#262635` | `#eeecf5` | Secondary controls |
| `--line` | `#30303f` | `#dedbe9` | Quiet separation |
| `--text` | `#f2f1f8` | `#282436` | Primary text |
| `--sub` | `#aaa8bc` | `#656073` | Secondary text |
| `--muted` | `#868499` | `#797285` | Supporting metadata |
| `--accent` | `#b7a9ff` | `#6851c5` | Primary action and selection |
| `--accent2` | `#c8bdff` | `#5943b4` | Accent variation |
| `--soft` | `#2d2843` | `#e9e3fb` | Selected surface |
| `--success` | `#9fd3b3` | `#26764b` | Saved/success state |
| `--warning` | `#e2bb81` | `#946022` | Recoverable warning |

Player tokens are `--player-text: #f8f5ff`, `--player-sub: #cbc4df`, `--player-line: #c2a6ff35`, and `--player-accent: #bd8aff`, with a dark `#0c0c20` base. Retain the existing light-theme overrides and persisted Dark/Light/System preference. Validate contrast in both themes; muted colours are not permission to use unreadable small text. Errors use existing alert/danger styles, with text and an action rather than colour alone.

Ambient colour comes from the thumbnail through the vendored ColorThief implementation, never the cross-origin video. Preserve cached, versioned palettes and deterministic fallbacks. `src/ambient.mjs` constrains saturation to 30–60%, dark primary/secondary lightness to 24%/22%, glow to 35%, and light tones to 86%/88%. Extraction failure must not delay playback. Keep gradients subdued behind readable content; respect reduced motion.

## Typography and geometry

Use the existing Inter/system sans-serif stack without requiring a remote font. Body baseline is 14px/1.5; page headings 28px mobile and 32px desktop; section headings 18px; controls generally 12–14px. Small metadata must remain legible under text scaling. Use tabular numerals for times and counts. Keep sentence case and plain British English, including “Practised”.

The active phrase has the strongest hierarchy. Mobile short phrases use `clamp(29px, 7.2vw, 42px)`; longer variants use the existing 25–36px and 23–30px ranges. Desktop uses the existing 36–62px responsive range with long-text variants. Preserve runtime fitting with an approximately 18px/1.125rem minimum; unusually long or enlarged text scrolls within its own bounded reading area. Never truncate the practice phrase to make controls fit.

Use a 4px spacing rhythm, with existing 8/12/16/20/24/32px gaps as the baseline and documented exceptions for viewport fitting. Mobile shell gutters are 18px; player gutters at least 16px plus safe-area protection. Use 1px quiet borders, 8–10px control radii, 12–16px card radii, and 18–20px dialog radii. Circular transport controls remain distinctive. Reuse `--shadow` for elevated overlays; avoid decorating every card with a shadow.

Reuse `.btn`, `.icon-btn`, form groups, lesson cards, tabs, queue rows and modal patterns. Extend existing rendering helpers before creating competing component variants. Keep the existing inline SVG icon language. Future extracted tokens should describe roles and replace repeated values, not introduce a new theme.

### Geometry and elevation token contract

These semantic names are **proposals for future CSS consolidation**, not variables already defined in source. Prefer the existing component rule until implementing an explicitly scoped extraction; preserve documented viewport exceptions.

| Proposed token | Value | Use |
| --- | --- | --- |
| `--space-1` through `--space-8` | 4, 8, 12, 16, 20, 24, 28, 32px | Consistent internal spacing and related groups |
| `--space-section` | 32px | Separation between content sections |
| `--radius-field` | 8px | Inputs and small controls |
| `--radius-button` | 9px | Standard buttons |
| `--radius-card` | 13px | Lesson and settings cards |
| `--radius-feature` | 16px | Resume/first-lesson panels |
| `--radius-dialog` | 18px | Desktop dialogs |
| `--radius-sheet` | 24px | Player mobile sheet top corners |
| `--radius-round` | 50% | Circular transport controls |
| `--border-width` | 1px | Quiet boundaries using `--line` |
| `--focus-width`, `--focus-offset` | 2px, 3px | Accent focus outline, never removed without replacement |
| `--touch-min` | 44px | Minimum intended mobile action hit area |

Elevation is primarily tonal: canvas → navigation/card → control/overlay. Flat cards use background and a subtle border; floating surfaces use the existing `--shadow` (`0 20px 70px #0004` dark, `0 16px 60px #31244f12` light). Keep the special primary-transport glow local to the player. Do not use stronger shadows as the only signal of selection.

Preserve a deliberate stacking order: content, dock/mini player, navigation, queue backdrop/panel, modal backdrop/dialog, then toast. A visible iframe must never sit above an active dialog or intercept its input. Coordinate dock positioning and overlays together rather than arbitrarily increasing z-index. Reserve content space for persistent overlays.

## Reusable components and patterns

The current application uses vanilla ESM rendering helpers in `src/app.mjs`, not a framework component library. Reuse their structure and delegated actions, retaining accessible semantics and playback identity.

| Component | Appearance and behaviour contract |
| --- | --- |
| Primary button | Accent fill, canvas-colour text, 9px radius; existing 42px visual minimum, with a 44px mobile hit target. One dominant action per local group. |
| Secondary / ghost button | Panel fill or transparent surface with line border. Hover increases contrast; focus has a visible outline; pressed state remains clear without relying on motion. |
| Icon action | Existing SVG language, typically 18–22px glyph. Accessible name and independent keyboard target; touch area can exceed visual bounds without overlapping neighbours. |
| Destructive action | Existing danger treatment plus a specific label and confirmation or supported undo. Keep away from primary playback actions. |
| Search / field / select | Panel background, line border, 8px radius, persistent label. Preserve pasted input and show errors with a recovery step. Placeholders supplement labels. |
| Filter / status chip | Quiet unselected surface; selected accent/soft surface plus pressed/selected semantics. Practised and Difficult remain independent markers. |
| Lesson / resume card | Stable thumbnail ratio, strong title, subordinate speaker/time, explicit progress and one clear resume/play action. Missing images retain geometry with a neutral fallback. |
| Navigation item | Consistent icon and label; active accent/soft state plus semantic current state. Touch/keyboard use must work without hover. |
| Options tabs | Playback, Practice and Lesson in the established sheet; clear active tab, keyboard navigation and associated panels. Show range fields only when relevant. |
| Queue row | Active phrase identifiable by surface and semantics, readable text and secondary time/status. Row selection and overflow actions remain separate targets. |
| Dialog / sheet | Single clear heading, close action, logical focus order, internal scrolling, focus containment and return. Avoid competing nested sheets; retain unsaved input during recoverable failures. |
| Timeline | Tabular times, labelled keyboard-operable range control and sufficient hit area. Distinguish current phrase from full recording; do not add redundant progress displays. |
| Toast / inline feedback | Brief confirmation in a nonblocking status region; actionable errors remain available rather than vanishing before they can be read. Do not cover transport or navigation. |

For all actionable components, define rest, hover where supported, focus-visible, pressed/selected, disabled and busy states as applicable. Busy actions prevent duplicate submissions but must preserve recovery controls. Do not use reduced opacity alone to convey critical state or make explanatory text unreadable.

## Responsive structure and navigation

Design and verify mobile first. At widths up to 760px use the bottom navigation and mobile brand; above 760px use the sidebar. The sidebar is 185px in the 761–1050px range and 218px on larger screens. Main content has a 1580px maximum and fluid desktop gutters. Let toolbars wrap and grids shrink without horizontal page overflow.

The current implementation uses two lesson columns on mobile. For future library improvements, the latest reference favours a single column of thumbnail-led lesson rows: artwork, readable title and progress, then one clear play/resume action. Do not preserve two columns at the expense of readability. Desktop can retain auto-fill cards of at least 210px or use roomy rows as appropriate. Collections can retain their existing responsive grid. Tablet is a real intermediate layout, not a compressed desktop screenshot.

The expanded player occupies `100dvh` without page scrolling. Preserve safe areas, short-height rules (650px and below), and landscape rules (600px wide and 520px high thresholds). Internal phrase, queue and sheet scrolling is allowed. Opening settings, buffering, or showing an error must not move primary controls off-screen. Desktop queue is a sidebar; mobile queue is a sheet with its own scrolling area. Keep Queue and Options discoverable with labels.

At tablet sizes, adjust content width and density while preserving reachable controls and readable titles. When the desktop queue opens, allow the practice stage to reflow without shrinking the video below its required size or clipping the phrase. Account for the on-screen keyboard in import/edit sheets. Validate 200% text enlargement and browser zoom; use layout reflow and bounded reading regions rather than disabling zoom or hiding content.

## Home and lesson library

Use a single compact Home app bar with Search and Settings. Keep Add available through bottom navigation, the desktop sidebar and the empty-state action. Preserve continue practising/resume, recently added lessons, favourites, collections and all lessons. Cards show thumbnail, title, known speaker, duration or phrase count, practice progress, favourite state and management access. Long titles may truncate on cards with the full title available accessibly; the player phrase may not.

Give the last lesson a direct Resume action on the landing screen and in its library entry, restoring the saved position without an intervening details screen. Preparing it on startup must still avoid autoplay. Prioritise resume over administrative actions. Use strong thumbnails and plainly labelled practice progress; separate listened position from the percentage explicitly marked Practised. Keep favourite and management access secondary rather than giving every lesson multiple equally prominent buttons. Allow titles enough room to be recognised, preferably two lines in mobile rows.

Keep library search by title/speaker, sorting, favourites and collection organisation. Preserve lesson rename, resume, multi-collection membership and confirmed deletion. Import follows recording URL → uploaded/pasted timestamped transcript → validation → phrase preview → save and practise. Preserve SRT/VTT/JSON/timestamped text, offsets and progress-aware editing; do not invent automatic transcription guarantees.

## Expanded and minimised players

The expanded hierarchy is phrase, playback controls, then supporting metadata and video. YouTube stays visible at **200 × 200 CSS pixels** with native controls unobstructed. Uploaded personal audio has no video. Never extract YouTube media or promise forced buffering/quality.

Use one primary Play/Pause/Replay button, a quieter restart-current-phrase action on the left, and visible Next on the right. Mobile primary size is 88px, 76px on short screens; desktop final override is 96px. Next gains subtle emphasis at phrase completion. It marks the current phrase Practised and immediately plays the next eligible phrase; listening and automatic advancement do not mark practice. Preserve Manual, Automatic and Continuous semantics, speed, lead-in and speaking pauses. No unlimited-loop control or permanent Previous button.

Secondary tools belong in Playback/Practice/Lesson options and the queue. Keep full-recording seeking in a sheet. Preserve the existing concise phrase-progress row; do not add duplicate timelines or status rows. Keep phrase markers and detailed editing accessible without cluttering the main phrase.

Minimising preserves the same playback session, source, phrase and position while navigating. The compact player shows lesson/phrase context, play/pause and Open player. Audio can use a short bar; YouTube requires a visible media area, not a hidden audio-only substitute. Position above mobile navigation and safe areas; reserve enough page space so library actions remain reachable. Expanding must not recreate playback unnecessarily.

For the compact audio bar, the artwork/title area expands the player and the play/pause button remains an independent action. A thin progress edge can communicate position without adding another dense control row; provide its meaning accessibly. Calculate the bottom offset from navigation height plus safe-area inset rather than assuming one fixed device height. The bar must not cover navigation or the last lesson row, disappear during ordinary screen changes, or reset the session. Verify library → expanded → minimised → another screen → expanded preserves position and playback state.

If a viewport cannot accommodate visible compliant YouTube playback alongside essential navigation, preserve session position, explain the restriction and pause playback, as specified in `spec.md` §16.2. Never substitute hidden YouTube audio to imitate the compact audio reference.

## Transcript and shadowing

Keep accurate original timestamps and source offsets. Highlight words only when word timing exists; do not imply precise karaoke timing from phrase-only data. Words remain selectable/tappable for British IPA and corrections; full-phrase IPA is optional. Preserve phrase text visibility settings.

Make replay actions unambiguous: restart/replay operates on the current phrase, not the entire lesson. Keep the active phrase visually distinct without pulsing, bouncing or animating each word. Following playback may scroll the internal transcript/queue to keep the active content visible, but must not fight deliberate user scrolling, text selection or editing. Avoid per-tick scroll jumps; respect reduced motion and keep the outer player viewport stationary.

Queue rows identify the active phrase, text, timestamps, known speaker and independent Practised/Difficult markers. Preserve selection, replay, editing, split/merge, regroup preview, undo, range and speaker filters. Continuous mode retains the original recording timeline and gaps. Progress is practice history, not a claim of mastery.

## Accessibility and interaction

Target WCAG AA contrast (4.5:1 ordinary text, 3:1 large text and meaningful control boundaries). Use semantic controls, accessible names for icons, associated labels, visible focus and keyboard activation. Aim for at least 44 × 44px touch hit areas even where an icon is smaller; avoid overlapping word targets. Test browser text enlargement, long titles and long phrases.

Dialogs/sheets must manage focus, support Escape, restore focus and keep focused controls visible. Announce meaningful async status politely without narrating every playback tick. Preserve keyboard shortcuts without intercepting typing in form fields. Mobile swipes apply only in the dedicated gap: left equals Next, right plays the previous phrase without marking; never hijack text selection, queue scrolling or desktop input. Provide button/queue alternatives to gestures. Respect reduced-motion preferences and keep motion brief and purposeful.

## Motion and micro-interactions

Use motion to explain a response to input, not to compete with listening. Current timings establish the baseline: controls/toasts approximately 150ms, card changes 160ms, mobile sheet entry 220ms ease-out, ambient palette settling 800ms ease. Proposed names for later consolidation are `--motion-fast: 150ms`, `--motion-surface: 220ms` and `--motion-ambient: 800ms`; these are not installed CSS tokens.

Prefer opacity/transform for entering surfaces. List transition properties explicitly; avoid `transition: all`. The existing ambient colour interpolation is a restrained exception, not a licence for continuous animated backgrounds. Stop motion after the new palette settles. Do not animate layout height around controls, pulse transcript words, cascade lesson-card entrances or add celebratory interruptions.

Hover/press feedback is brief and reversible; existing transport scale feedback must not shift adjacent controls. Sheets should enter once and remain stable. Loading may use the existing transport spinner with accessible busy text; reduced motion removes rotation while preserving the loading meaning. Honour both `prefers-reduced-motion` and any effective in-app reduced-motion setting. Automatic following scroll must become immediate or remain stationary under reduced motion, without taking control away from the reader.

## Implementation boundaries and outstanding proposals

Retain browser ESM, plain CSS and the vendored colour extraction asset. Playback belongs in `src/player.mjs`/`src/audio.mjs`, transport decisions in `src/practice.mjs`, parsing/editing in `src/transcript.mjs`, pronunciation in `src/ipa.mjs`, persistence in `src/store.mjs`, and private state/audio APIs in `server/`. The persistent YouTube dock lives outside rerendered screen content. Visual refactors must respect those boundaries and preserve its instance when navigating.

The reference-led mobile lesson rows, larger effective touch targets, semantic geometry tokens, and compact audio progress edge are documented directions for future work, not completed changes. Accessibility contracts (contrast, focus, text enlargement and announcements) require rendered and interaction checks when implemented. Existing small icon targets or decorative muted colours should be corrected within the affected task rather than copied as proof of compliance. No new dependency, font download, icon library or framework is needed to establish these patterns.

## State standards

- Loading/buffering: indicator inside the primary transport, accessible busy status, stable geometry; no new notice row.
- Ready/paused/playing/phrase complete: correct transport label and icon; completion offers Replay and Next without a blocking celebration.
- Blocked/stalled/error: concise feedback in the fixed metadata area with details/retry on demand; retain phrase and position. Do not claim streaming success from a ready iframe.
- Empty studio: explain how to add the first lesson. Empty search/filter: explain how to adjust the selection. Never show fabricated lessons or progress.
- Import/upload: preserve input, show actionable validation near the relevant field, prevent duplicate in-flight submissions and retain recovery paths. Private uploads retain the existing 50MB limit and source-switch/offset tools.
- Offline/sync failure: distinguish local saving, pending sync, unavailable storage and conflicts. Use one floating, dismissible notice above navigation/mini-player or below the player header; never insert a notice row into the page. Keep pending edits and explicit copy selection; dismissal hides only the current issue, and a newer conflict revision is announced again. Review remains in Settings/player options; never silently overwrite another device.
- Thumbnail/palette failure: neutral deterministic fallback with stable geometry. Missing media must not erase transcripts or lessons.

## Verification standard

For UI changes, use Playwright on the actual local app (`node scripts/dev.mjs`), mobile before desktop. Include 320 × 568, 390 × 844, tablet (e.g. 820 × 1180), desktop (e.g. 1440 × 900), short landscape and enlarged text where affected. Inspect fresh screenshots in both themes and relevant states. Test live interactions, not just element presence. Run `npm test` and `npm run build` when UI/playback code changes. Mock playback only with an explicit statement that real streaming remains unverified. This documentation-only change does not itself verify application accessibility or playback.

## Compact library navigation

Library uses a single compact app bar: title, Search icon and an overflow menu. Keep search input hidden until requested; Cancel clears and closes search. Mobile bottom navigation provides Home, Library, Add, Collections and Search. Settings remains available through Home’s gear and Library options; desktop retains its sidebar. Search from bottom navigation spans the library rather than the currently open course. Use horizontally scrollable content chips for All, Courses, Lessons and Unassigned. The next row provides native sort and category dropdowns, an accessible filter icon and a single icon that switches list/grid presentation. Selection starts through Library options or long-press and offers a visible Cancel action. Keep result counts and 24-item pagination; switching sort/category/layout preserves the remaining filters.

## Home discovery shelves

The latest YouTube Music references guide browsing interactions: compact content chips, a sort dropdown and view toggle in Library; artwork-led horizontal shelves with a see-all arrow on Home. Preserve Echo’s existing neutral palette, typography and product vocabulary. Do not copy music-specific labels, oversized headings or decorative branding.

Home leads with a compact resume row. Below it, show shelves for courses, recently added lessons, favourites, populated user categories and collections when available. Each shelf previews at most eight items. Show the final four-thumbnail See all card and labelled heading link only when additional results exist beyond that preview. Overflowing tracks expose labelled left/right buttons that disable at their respective edges and disappear when content fits. Single-item shelves must fit their track without scrolling. The complete destination retains its matching filters. Horizontal tracks support touch scrolling, keyboard arrows/Home/End and visible focus. Keep titles to two lines, subordinate creator/lesson counts and understated progress; management remains secondary. Preserve horizontal positions through ordinary rerenders. Do not change playback state when browsing.

The default Home shows at most four populated category shelves. All managed categories remain available in the horizontal category picker; selecting one shows its own preview and full Library destination. Empty categories offer clear guidance. Manage categories reuses the existing category/tag editor; no categories or lesson content are fabricated. The compact Home composition and neutral palette apply on desktop as well as mobile.

## Collections and return navigation

Collections are reusable playlists, separate from courses: a lesson may belong to several collections without copying its media or progress. Use a focused collection detail screen with a compact app bar, Continue action, readable lesson rows and secondary management. List and picker pages display at most 24 results. The searchable Add lessons sheet keeps its selection count and Save action in a fixed footer; selections survive search and pagination. Reordering uses explicit accessible controls in Edit list. Removing membership or deleting a collection never deletes lessons or their learning history; deletion requires confirmation.

Use browser-backed screen history for mobile Back and the visible Back control. Close the current sheet before leaving its screen; return from the player to the actual originating screen, including the opened collection/course and saved browsing context. Settings always exposes Back. Ordinary typing, playback ticks and preference changes must not create navigation entries. Browsing and reopening the mini-player retain the existing playback instance and position; restoring a screen after reload must not autoplay. Keep native Back usable at the app entry point rather than trapping the user. Touch-phone landscape retains mobile navigation, with essential controls at least 44 × 44 pixels.

## Mobile annotation refinements, 23 November 2026

The current phrase owns the player. Remove its logo, phrase badge and idle Mirror caption; Compare and Queue are icons beside the clock below the phrase; only the gear remains at the top right. Position lives in the queue, practice flags in options. Preserve the dedicated empty swipe area, recording controls and playback synchronisation.

Use one recognisable gear in the top-right of browsing pages; put local management in explicitly named action menus. Counts share the Library heading, type chips are visually 32px within 44px touch targets, and course/collection continuation fits on one action line. Selection uses a compact single-row toolbar with Cancel, count, Select all and Actions.

A 64px mini strip serves both sources and includes separate expansion, transport and Close controls. Horizontal swipes dismiss and pause it without removing the lesson or progress. Audio keeps playing when merely navigating. YouTube continues playing in a small live viewport in the compact bar.

Category presets are offered in Manage categories without being automatically enabled. A saved category filter combines optional keyword alternatives with course, tag and progress conditions. Manual category assignments continue to match.

## Additional mobile annotations, 23 November 2026

Search is a separate screen for lessons, courses and collections, with type chips and account-saved recent queries. Save a query on explicit search or opening a result, retain at most 20, and allow individual removal and Clear all. The Library's local search remains scoped to the Library.

Mobile Library results extend automatically near the end of the loaded list, with a Load more fallback. Desktop retains paginated results. Reset the loaded count when changing filters or content types; preserve existing selection while extending results. Grid cards use source artwork with a small visual menu inside a 44px touch target, title and creator, and quiet progress. Settings use compact inset rows and native value selectors; collection headings, spacing and controls share the same browsing system.

The player reserves space for the phrase before secondary chrome. Timelines move into Options, leaving one balanced transport row and a dedicated swipe area. A dimmed source image supplies context behind readable text. The visible YouTube viewport stays 200 × 200 and occupies a defined stage slot, with no floating shadow. Short portrait and landscape layouts must keep the phrase and all controls reachable without page scrolling.

## Home and phrase-stage refinements, 24 November 2026

Remove Home's category chip strip; category shelves, filters and management remain. Every shelf ends in a See all destination with a 2 by 2 collage of real member-lesson thumbnails. With fewer than four members, repeat available artwork; never invent lesson content. Sparse shelves use compact horizontal entries to avoid an oversized single-card section. Keep practising and Not started are deterministic progress filters, not generated recommendations.

Current-phrase seeking is visible in the utility row beside Queue and the other tools. The full-recording timeline remains on demand. Up to two neighbouring phrases on each side supply reading context, at decreasing opacity and with shorter-screen reductions. Current text remains the primary readable content. Search preserves the actual input element while updating results, including composition and cursor edits.

## Continuous transcript follow-up

The transcript is a persistent reading surface, not independently spaced before/current/after panels. Adjacent lines use a natural 24px mobile gap and consistent type size. The active line gains weight and contrast. Distance fading remains while following; manual browsing raises inactive text contrast for reading. Native smooth scrolling follows selections and playback; initial positioning and reduced motion are instant. Keep scroll position and DOM identity through transport renders.

Source artwork, two-line title and creator form one compact header cluster between collapse/back and the gear. The full player uses a single artwork backdrop and gradual overlay; header and footer have no separate background slabs.
