# Echo Studio design decision

[Compare the rendered screens](index.html) · [A · The Listening Room](a/index.html) · [B · Rehearsal Desk](b/index.html)

The review compares the app at `1497245` with two prototypes using the same fictional lesson, **Move a deadline**. Each opens at the same saved position of 0:42 on a native reference. The photographs are illustrative. The recordings are locally synthesised demonstration media. A simulated take uses supplied audio and no microphone. Neither prototype connects to an account or saves to the real library.

The owner chose **B · Rehearsal Desk** on 25 November 2026 and asked for a steadier, better-aligned player.

## Pre-approval recommendation

Choose **A · The Listening Room**. The selective hierarchy puts the active phrase, Play and the next useful action together. Desktop makes use of the passage rail, and the same reference can continue into the library and reopen at its current position. The library and history give a familiar personal reference a lasting place. **B · Rehearsal Desk** is the better fit if the main goal is to open on a fresh message to deliver and use a reference as optional help. [Compare the two starts](index.html)

## What the current app showed

- At 390 × 844, Resume was visible before the speaking prompt. An earlier fixture with a Practised mark repeated the resumed lesson in a lower shelf. Library put content tabs and a separate sorting and management row before the first result. [Current Home](baseline/01-home-390x844-dark.webp) · [Current Library](baseline/02-library-390x844-dark.webp)
- In the 390 px player, adjacent transcript lines were close in scale to the selected phrase. Transfer was near the top and transport near the bottom. The recording path used Record, Stop and a separate Compare action. Its waveform already made timing and pauses visible, and it gave the owner a choice over saving. [Current player](baseline/03-player-390x844-dark.webp) · [Current comparison](baseline/04-comparison-390x844-dark.webp)
- At 768 × 1024 the queue set aside a separate column and transport remained reachable. At 1440 × 900, the prompt moved to the far right of the Resume row. History required Settings followed by the session count. [Tablet queue](baseline/06-queue-768x1024-dark.webp) · [Desktop Home](baseline/01-home-1440x900-dark.webp) · [Current history](baseline/07-history-390x844-dark.webp)

The benchmark questions were how quickly Spotify and Apple Podcasts help a listener continue, how Headspace stages a clear start, and how Elevate distinguishes an exercise from its result. The official app galleries and product pages refused this environment’s requests. We used those questions as comparison criteria and inspected the owner’s existing mobile and desktop references. The most useful reference decisions were a distinct current phrase, a clearly dominant Play action, and separate secondary phrase tools. The actual app’s confirmed provider and private-media requirements also govern implementation. [Owner’s mobile reference](https://github.com/zirock699/echo/blob/1497245/docs/reference-mobile.png) · [Owner’s desktop reference](https://github.com/zirock699/echo/blob/1497245/docs/reference-desktop.png) · [Player decisions](https://github.com/zirock699/echo/blob/1497245/docs/PLAYER_DECISIONS.md)

## Designed journeys

| Job | Current app | Direction A | Direction B |
| --- | --- | --- | --- |
| Speak without setup | Choose the Home prompt in one action below Resume. | Choose a fresh speaking prompt beside the selected reference. | Start on an everyday rehearsal brief and give the response directly. |
| Continue a personal reference | Open Resume, then Play. | Continue the last lesson into a focused, paused listening stage. | Keep the reference at hand alongside the current rehearsal. Open it paused before playing. |
| Discover and keep references | Search is a separate destination. Library, course and collection views have their own navigation. | A single reference library brings search, collections and favourites together with reading-led rows. | A compact Library groups search and saved references behind a persistent destination. |
| Repeat, transfer or compare | Player transfer is one action when paused. Recording, stopping and switching to Compare are separate. | Keep the reference as a workspace. Open record and compare with the active line retained. | Start with the message goal. Use the model, capture or compare as optional work on the same rehearsal. |
| Finish and return | Finish is inside Player settings. History is under Settings. | Use a visible finishing action and review the previous session in Activity. | Finish with one ordinary entry in Journal. Resume the same reference or choose a fresh speaking turn. |

The purpose of the activity record is to show material used, attempts explicitly kept and chosen next steps. The prototypes demonstrate interface choices. The owner trial is how we will observe real discoverability and any learning benefit. [Existing private trial materials](https://github.com/zirock699/echo/blob/1497245/docs/transformation/pilot-materials.md)

On the matched 390 px walkthrough, both alternatives kept the **one-action speaking cue** and **two-action Resume and Play**. Finding and favouriting the named reference took **three actions** in each prototype and **six** in the current flow. From a paused phrase, the prepared path reaches paired comparison in **three actions** in both concepts. A second deliberate listen adds an action to that prototype path. The current app automatically listens first within its own three-action path. A has a visible one-action finish during reference practice. B offers a finish and an optional observation in Journal. [Baseline counts](baseline/README.md) · [A recording screen](screens/a-recording-390x844.webp) · [B recording screen](screens/b-recording-390x844.webp)

An independent critic examined the rendered alternatives at all four target widths and retested the revisions. The repeat checks verified the shorter capture path, separate original and transfer situations, Back and keyboard-focus return, continued media in Library, and correct identity and timing when returning from History or Journal. At 844 × 390, Play was reachable at first paint in both, as were both starts in B. Text remained usable with an unavailable source. [A empty](a/index.html?empty) · [A unavailable](a/index.html?unavailable) · [B empty](b/index.html?case=empty#rehearse) · [B unavailable](b/index.html?case=unavailable#practice/deadline)

## Design system foundations

| | A · The Listening Room | B · Rehearsal Desk |
| --- | --- | --- |
| Colour | Pale mineral canvas `#f1f3ef`, pine stage `#15373a`, mint transport `#b8e3d6`. | Warm paper `#f6f4e9`, ink blue stage `#18394f`, pale yellow action `#efda83`. |
| Type | Serif for titles and the active phrase. Quiet system sans for controls and metadata. | Bricolage for titles and phrasing. Instrument Sans for controls and reading. |
| Composition | A material-led home, editorial library rows and a paired passage rail alongside the desktop player. | A rehearsal-led home, horizontal desktop navigation and single-purpose exercise pages. A compact reference sits just below the main brief. |
| Imagery | An intimate recording room introduces the personal reference library. | Natural human rehearsal sets the context. The reference library uses its own room artwork. |

Use three stable type levels for navigation and reading, plus a dedicated current-phrase scale. Keep inactive phrase context readable and visually quieter. Reserve saturated action colour for the current action, selection and focus. Pair tonal role, label and state for paused, playing, recording, saved and unavailable. Keep main touch targets at least 44 CSS px.

The home composition has one clear primary task with another explicit way into practice. Search, favourites, collections and preparation sit within Library. Use a reusable reference row with source, title and real progress, and a shared transport family for Play, Replay and Next. Give recording its own visible stage and a recoverable Stop/Retry path. Identify the two comparison rows by name and use the same time scale. Keep optional settings from shifting the primary controls.

On phones use a single reading column, preserve thumb access and allow long phrases or accessibility enlargement to scroll within their reading area. A tablet can bring related context alongside the main stage. Desktop adds useful persistent context and keeps the phrase within a reading width. Keyboard focus is explicit. User-initiated reveals can use short transitions and honour reduced motion. An empty library offers a useful start and a way to add a reference. An unavailable source keeps useful text and offers a retry. An active transport announces checking or loading beside the related controls.

## Constraints for the approved build

Reuse Echo’s playback, media, transcript, recording and persistence modules. Preserve exact selected cues and paused resume, the managed native source and the deliberately loaded visible YouTube player at no smaller than 200 × 200. Maintain Manual, Automatic and Continuous, replay, phrase marks and editing, IPA, imports, mini-player continuity, owner verification and recovery. Keep actual capture permission and saving explicit. Progress belongs to recorded activity and intentional owner choices. Use the current app's responsive and browser regressions alongside the approved render comparison.

[A control and provider placement](a/README.md#production-placement-if-selected) · [B interaction design](b/README.md)
