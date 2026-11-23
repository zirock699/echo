# Mobile UX audit — 23 November 2026

Reviewed with Echo UX Expert, installed Impeccable audit guidance, Frontend Design and the bundled Vercel accessibility guidelines, against DESIGN.md. This is a scoped audit plus the requested sync-notice implementation; the remaining findings below are not claimed fixed.

## Evidence

Actual local app, using disposable lesson/course fixtures. Browser inspections covered Home, Library, Collections, Settings, Add lessons, 40-lesson ZIP preview, expanded audio player, transcript queue, Options and mini-player. Viewports: 320×568 and 390×844 first, then 820×1180, 1440×900 and 844×390. Dark and light Home and light player/mini-player were inspected. Measurements are CSS pixels, not proof of physical-device ergonomics or a complete WCAG conformance test. Tiny floating-point differences around 44px were excluded from findings.

No horizontal page overflow was detected in these checks. The ZIP confirmation footer remained visible at 320px, results remain paginated, and Home shelves remain bounded. The main playback and Record controls fit the inspected mobile viewport. Live YouTube and physical-device streaming/microphone checks were not performed for this audit.

## Implemented: floating sync notice

The offline/device-only message no longer occupies document flow. It floats above bottom navigation and the audio mini-player; in the expanded player or with a YouTube mini-player it uses a top position away from transport. Retry and Dismiss have at least 44px targets. Retry prevents duplicate clicks and shows progress. Dismissal survives navigation and ordinary rerenders for the current unavailable-sync period; successful cloud reconnection resets it so a future outage can be reported. Reloading also resets dismissal. Retry remains accessible in Settings after dismissal.

The notice is hidden while dialogs or the mobile phrase queue are open. Dismiss returns keyboard focus to an available screen control. The message is a polite status, not a focus-stealing modal. Sync-conflict and storage-failure warnings remain separate: dismissing an offline notice does not suppress those warnings or change persistence/synchronisation behaviour.

Browser assertions verified: Retry after a failed connection, dismissal, navigation without reappearance, unchanged header geometry on dismissal, no overlap with audio mini-player/navigation, no coverage of primary playback controls, and suppression during Add, ZIP, Options and queue overlays. Screenshots inspected under `/tmp/audit-*.png` are local evidence, not production screenshots.

## Prioritised remaining findings

| Priority | Finding and evidence | User impact and recommendation | Acceptance criteria |
| --- | --- | --- | --- |
| High | Settings switches have inconsistent accessible labels. Source: `settings()` in `src/app.mjs` uses adjacent spans instead of associated labels; Show phrase text has an aria-label, while wake-lock and other switches are inconsistent. The checkbox itself measured 19×19px; the whole described row is not its associated click target. | Make each description an associated label and give the control/label a generous shared target. | Every Settings input has a meaningful accessible name. Tapping its visible label toggles the intended switch. Each switch row offers a 44px target; keyboard focus and checked state are evident in both themes. |
| High | Rotating to 844×390 activates the desktop sidebar because navigation uses width alone. Confirmed in rendered Home: the rail consumes about 185px and bottom navigation disappears. | Treat short, touch-oriented landscape as a phone layout rather than inferring desktop solely from width. Preserve explicit desktop keyboard/mouse behaviour. | Phone landscape keeps reachable navigation and clear transport; 844×390 has no clipping, no unexpected desktop-only actions and correct safe-area clearance. Test real touch devices as well as emulation. |
| Medium | Player Back and Queue measure 38×38px; recording timeline and settings icons 40×40px. The phrase seek input is 24px high. Source: `src/mobile-player.css`; measurements confirmed at 320px. | Expand effective hit areas to the project's 44px standard while preserving compact icon artwork and stable transport geometry. These measurements alone do not establish a WCAG AA failure. | Relevant hit areas reach 44×44px without overlapping neighbouring targets or pushing playback controls below 568px. Test portrait, landscape and enlarged text. |
| Medium | Collections/Settings header gear and shared dialog Close controls measure 38×38px. Confirmed in the browser. | Apply one consistent icon-button target contract across secondary screens and sheets. | Header and Close hit areas are at least 44px; focus rings remain visible and no new header-height inflation occurs. |
| Medium | Active bottom/side navigation is expressed by CSS class, without an accessible current-page state. Source confirmed in `shell()`/`navitem()` in `src/app.mjs`. | Add an appropriate current-page semantic state and retain visible labels. | Assistive technology can identify the active destination after navigation, including Library/Search transitions; there is exactly one applicable current destination. |
| Medium | Narrow Library dropdowns truncate both sort and category labels, such as “Recent…” and “All cat…”. Confirmed at 320px, especially beside filter/view icons. | Keep the requested dropdown pattern, but shorten default sort copy or rebalance widths and expose the complete selected category in an accessible detail surface. | At 320px the selected type/category is identifiable without guessing; full values remain available through native options, and the row never overflows. |
| Medium | The mobile visual language is inconsistent across secondary surfaces: neutral Home/Library versus violet Settings/Options/player chrome and dense form rows. Confirmed in dark Settings and light player/Options; CSS retains legacy tokens. | Consolidate secondary surfaces in a separate scoped pass, following DESIGN.md's neutral reference direction. Retain state colours and readable contrast. | Matching controls use the same surface, spacing, type and focus tokens in both themes; contrast is measured, and Settings/Options remain usable at 320px and with enlarged text. |
| Low | Legacy collection lesson cards still specify 27px management/favourite controls in `lessonCard()`. Source confirmed; collection-detail cards were not individually measured in this audit. | Bring legacy controls under the shared target standard when that surface is updated. | Rendered collection-detail targets are measured at 44px or provide an equivalent accessible action; full lesson titles remain recognisable. |

## Suggested implementation order

1. Correct Settings labels and hit areas, then shared Close/header targets.
2. Fix phone-landscape navigation and verify player/mini-player clearance on real devices.
3. Add navigation semantics and improve narrow dropdown legibility.
4. Consolidate secondary-surface tokens and verify contrast/text scaling.

Do not combine this work with a playback-engine rewrite. Synchronisation remains covered by the dedicated regression suite and `docs/PLAYBACK_SYNC.md`.
