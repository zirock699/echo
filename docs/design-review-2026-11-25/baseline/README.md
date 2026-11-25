# Current Echo Studio screens

Rendered from `work` at `1497245` on 25 November 2026 in Chromium 156.0.8078.79. The disposable local library contained ten fictional lessons, three courses, two collections and three prior sessions. The reference **Move a deadline**, attributed to the fictional Nina Patel, opened paused at 0:42 in a 2:18 synthetic WAV. The comparison used local audio decoding with a simulated microphone. The browser blocked external services. [Browser fixture](https://github.com/zirock699/echo/blob/1497245/tests/browser_fixture.py)

| Surface | 390×844 dark | 430×932 light | 768×1024 dark | 1440×900 dark |
| --- | --- | --- | --- | --- |
| Home | [390](01-home-390x844-dark.webp) | [430](01-home-430x932-light.webp) | [768](01-home-768x1024-dark.webp) | [1440](01-home-1440x900-dark.webp) |
| Library | [390](02-library-390x844-dark.webp) | [430](02-library-430x932-light.webp) | [768](02-library-768x1024-dark.webp) | [1440](02-library-1440x900-dark.webp) |
| Paused player | [390](03-player-390x844-dark.webp) | [430](03-player-430x932-light.webp) | [768](03-player-768x1024-dark.webp) | [1440](03-player-1440x900-dark.webp) |
| Recording comparison | [390](04-comparison-390x844-dark.webp) | [430](04-comparison-430x932-light.webp) | [768](04-comparison-768x1024-dark.webp) | [1440](04-comparison-1440x900-dark.webp) |
| Practice selection | [390](05-practice-selection-390x844-dark.webp) | [430](05-practice-selection-430x932-light.webp) | [768](05-practice-selection-768x1024-dark.webp) | [1440](05-practice-selection-1440x900-dark.webp) |
| Queue | [390](06-queue-390x844-dark.webp) | [430](06-queue-430x932-light.webp) | [768](06-queue-768x1024-dark.webp) | [1440](06-queue-1440x900-dark.webp) |
| Practice history | [390](07-history-390x844-dark.webp) | [430](07-history-430x932-light.webp) | [768](07-history-768x1024-dark.webp) | [1440](07-history-1440x900-dark.webp) |

The 390 px walk also captured first use and the actual completion dialog. [Empty Home](08-empty-home-390x844-dark.webp) · [Speaking cue](09-first-speaking-cue-390x844-dark.webp) · [Session complete](10-session-complete-390x844-dark.webp)

## Current journey counts

These counts are one activation or meaningful field entry per step. They exclude listening, formulating a reply, and permission recovery. The test used Manual mode for its phrase filter and recording checks.

| Task | Observed actions |
| --- | --- |
| Open a speaking cue with no lessons | **1** via Try a speaking prompt. Escape restores focus. |
| Resume and play a reference | **2** via Resume and Play. Resume alone restores the saved source and cue paused. |
| Find a title or continue a course | **4** via Search, query, result and Play, or Library, course, Continue and Play. |
| Find and favourite a title | **6** via Search, query, result, Player settings, Lesson and Favourite. |
| Repeat a known difficult phrase | **3** from the paused player via Queue, the marked row and Play. **5** to apply Difficult only and play from the default Options tab. |
| Record and compare an eligible phrase | **3** via Listen then record, Stop and Compare with permission available. Saving is a separate choice. |
| Use a phrase in a new conversation | **1** from the paused player. Back retains cue, position and focus. |
| Finish an active session | **3** from the default Options tab via gear, Practice and Finish session. The summary links back to the marked phrase. |
| Review past sessions | **2** from Home via Settings and the session count. The history rows describe an activity and offer no Resume action. |

At 390 px the first Library item begins at y168 after separate filter tabs and management controls. The selected phrase spans y363–440, the new-conversation action sits at y76, and the primary transport starts at y763. The comparison sheet is 693 px high and displays an instruction to open Compare while already in Compare. These provide direct comparison points for the proposed hierarchy and flow. [Side-by-side review](../index.html)
