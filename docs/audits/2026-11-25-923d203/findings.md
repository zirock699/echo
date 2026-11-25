# Consolidated findings register

Baseline `923d203` on `work`. Severity reflects observed or credibly bounded user impact. Effort is implementation and local verification, in engineering days. The specialist reports supply detailed evidence, including revision-relative source references and actual fixture results. Independent review labels distinguish source confirmation from browser reproduction. [Baseline](baseline.md) · [Independent decisions](specialists/independent-reviewer.md) · [Roadmap](roadmap.md)

## Priority and cross-references

| ID | Finding | Severity | Specialist evidence |
| --- | --- | --- | --- |
| PRIV-01 | Pending legacy mic request can outlive the recording controls | High | SEC-03 |
| PRIV-02 | Imported snapshot fields cross the HTML boundary | Medium | SEC-01, narrowed from High |
| PRIV-03 | Pending cache is scoped to origin rather than signed-in owner | Medium, conditional | SEC-02 |
| PRIV-04 | Reachable local preview has a synthetic shared identity and broad asset surface | Medium, conditional | SEC-04 |
| DATA-01 | Media retirement can leave broken references in an accepted library | Medium observed, potentially higher for audio | D1-01 and D1-02 |
| DATA-02 | Player lesson deletion leaves stale course membership | Medium | ARC-01 |
| DATA-03 | Undo can overwrite the saved resume position | Medium | D1-03 |
| PLAY-01 | Mode and filter changes disagree with transport | Medium | PB-01 and PROD-02 |
| PLAY-02 | Echo Mirror treats early media end as a complete listening turn | Medium | PB-03 |
| PLAY-03 | Valid WebVTT metadata blocks manual import | Medium | PB-04 |
| LEARN-01 | Session and lesson measures describe different activity as practice | Medium | PB-02 and PROD-01 |
| SYNC-01 | Client capacity estimates and error handling drift from Worker limits | Medium | ARC-02, D1-04 and SEC-05 |
| SYNC-02 | Local cache errors suppress available authenticated saves | Medium | D1-05 |
| UX-01 | Queue and dialog focus is lost during navigation or background save | Medium | UX-01 and ARC-04 |
| UX-02 | Practice repeats equivalent status controls | Low | UX-02 |
| UX-03 | A selectable transcript line is below large-text contrast in a checked state | Medium | UX-03 |
| UX-04 | Recording timeline omits current phrase elapsed and total time | Low | UX-04 |
| UX-05 | Accessible setting names differ from visible labels | Low | UX-05 |
| UX-06 | Save & practise can return to Home after saving a first lesson | Medium | UX-06, independently observed by QA |
| OPS-01 | Warm service worker can serve a blank offline shell | Medium | ARC-03 |
| OPS-02 | Browser verification paths no longer match the current app | Medium | QA |
| OPS-03 | Alternate `npm start` entry point cannot run the application | Low | Performance |
| PERF-01 | Playback progress repeatedly transfers the entire library | Medium | Performance |
| PERF-02 | Opening the queue at a late cue mounts a long prefix | Medium | Performance |
| PERF-03 | Paused native player retains a frequent polling timer | Low | Performance |

No Critical issue was found. High severity for PRIV-01 concerns the impact of capture starting after the initiating UI closes. This is a source-confirmed lifecycle defect with physical consent sequencing unmeasured. Several medium findings can affect core practice, but retain a recovery path or have a bounded trigger. Deployment and external-device limits remain unassessed under [verification boundaries](baseline.md#authority-and-limits).

### PRIV-01 · Legacy recording can start after its controls close

**Security Engineer · microphone privacy · High · high confidence in code · confirmed lifecycle defect by source.** Options reaches the legacy recorder (`src/app.mjs:134,353`). Close, route and hidden transitions call `stop()` (`app.mjs:306,317,431`). `PracticeRecorder.start` awaits permission and tests a `disposed` flag that those paths never change, while `stop` only stops an existing recorder (`src/recorder.mjs:2–5`). A permission result that arrives after exit can start device-local capture out of view. Browser permission still applies. Physical reproduction and upload were outside the evidence.

**Remediation and acceptance.** Invalidate the request at each recognised exit and release a late stream before constructing a recorder. Reuse the tested Mirror lifecycle pattern selectively. A delayed synthetic grant after close, navigation or visibility change must leave no active track and produce no recording. Normal granted, blocked, stopped and repeated use should still work. Keep the untimed workflow while deciding which controls to consolidate. **Effort 0.5–2 days · medium risk · depends on the agreed recorder lifecycle.** **Independent:** confirmed source, retained High. [Security evidence](specialists/security-engineer.md#sec-03--legacy-recorder-can-begin-capture-after-options-close)

### PRIV-02 · Imported snapshot fields cross the HTML boundary

**Security Engineer · imported data and UI integrity · Medium · high confidence in code · design weakness.** JSON restore and Worker PUT check containers rather than nested values (`src/store.mjs:48`, `server/worker.mjs:40–48`). Stored lesson/course IDs and other fields enter template attributes (`src/library-ui.mjs:20–25`, `src/app.mjs:96,119,190`). Loading a modified or unsuitable backup can allow imported values to influence markup in the application origin. The scope is user-confirmed backup import or already accepted data. Regular escaped caption text and server owner checks are separate controls. No exploit or runtime execution claim.

**Remediation and acceptance.** Validate legacy-compatible snapshot shape and URL fields before accepting replacements. Use safe attribute and text assignment, or context-specific escaping where needed. Verify benign delimiter-containing values render literally, invalid shapes leave the prior snapshot intact, and valid old exports round-trip. Keep IDs and references stable. **Effort 2–4 days · medium/high risk · depends on Data Engineer's compatibility policy and supported hosting headers.** **Independent:** confirmed the code boundary, narrowed from High to Medium for the private baseline. [Security evidence](specialists/security-engineer.md)

### PRIV-03 · Cached library is not bound to the signed-in owner

**Security Engineer and Data Engineer · identity, confidentiality and sync · Medium conditional · high code confidence, production condition unknown · design weakness.** `Store.init` loads and publishes an origin-wide `state` cache before identity response, then `connect` uses only revision equality to decide whether pending changes may flush (`src/store.mjs:7–29`). GET is scoped server-side but does not bind client cache entries to an owner (`server/worker.mjs:30–38`). When different authorised accounts share a profile and origin, the old library can be displayed. If pending data and matching revisions coincide, it can be saved to the current account. Mirror attempts have separate device-local storage but are likewise reached by shared origin and lesson IDs. Effective Sites membership and account switching were unverified.

**Remediation and acceptance.** Bind private cache, pending changes and local attempts to an opaque authenticated account using an explicit policy for unowned legacy data. In synthetic multi-account tests cover initial unauthenticated load, account switch, equal and differing revisions, offline restart and same-owner recovery. No cross-account render or write. **Effort 3–5 days · high risk to offline recovery · depends on supported identity and migration.** **Independent:** source and conditional scope confirmed. [Security evidence](specialists/security-engineer.md)

### PRIV-04 · Local preview assumes one trusted development audience

**Security Engineer · dev isolation · Medium if shared outside its trust boundary · high code confidence · design weakness.** `scripts/dev.mjs:7–16` injects one synthetic owner regardless of caller and serves from the checkout root. Default loopback and isolated synthetic fixtures are appropriate. If shared beyond the trusted host, the server's asset scope and common identity extend to all reachable clients. No portal or filesystem probing supported a live exposure claim.

**Remediation and acceptance.** Limit shared preview assets and establish the intended access boundary before publishing a port. Keep localhost fixture behavior. Verify module and API checks plus exclusion of a benign non-app marker from a shared preview surface. **Effort 0.5–1 day · low/medium risk · depends on accepted preview use.** **Independent:** source-confirmed, scoped to reachable dev preview. [Security evidence](specialists/security-engineer.md)

### DATA-01 · Media retirement can break a live library reference

**Data Engineer · media lifecycle and recovery · Medium observed, potentially higher for audio · high confidence for artwork, medium for restore sequence · confirmed defect with a related suspected path.** Chromium proved that replacing a lesson from a valid WAV/SRT ZIP with no incoming artwork retained its thumbnail reference but changed the thumbnail response from 200 to 404 (`src/library-ui.mjs:84–89`, `src/app.mjs:283–287`). New audio remained usable and identity was preserved. JSON restore also overlays existing keys, so a pending retirement key can survive even when a restored backup references that audio (`src/store.mjs:5,47–48`). The artwork and audio cases share retirement by queued URL without checking whether accepted references still need it. The audio restore sequence was uncompleted in the browser. The JSON export cannot restore physically deleted audio bytes.

**Remediation and acceptance.** Decide keep/replace/remove per field, separate portable metadata and operational deletion intent, and make retirement reference- and revision-aware. Fixtures must cover optional art omitted/failing, retained references, delayed ack, restore of old formats, conflicts, shared references and cleanup retries. Intentionally retired assets may be deleted only when the policy guarantees no live reference. **Effort 3–5 days in slices · medium/high risk · depends on media reference inventory and restore compatibility.** **Independent:** observed artwork defect supported, conditional audio case scoped as suspected until the end-to-end sequence is shown. [Data evidence](specialists/data-engineer.md)

### DATA-02 · Deleting from the player leaves course links behind

**Software Architect · library integrity · Medium · high confidence · confirmed defect.** Player Options → Lesson → Delete removed the first of two synthetic lessons in Chromium but retained the stale course ID. Course Continue then showed “Lesson not found” instead of opening the remaining lesson. Player delete and Library `removeLesson` apply different membership and asset cleanup (`src/app.mjs:390–391`, `src/library-ui.mjs:95–96,138`).

**Remediation and acceptance.** Use a shared lesson-domain deletion operation. Ensure course continuation skips missing historical members safely and associated cover/reference decisions stay consistent. Exercise both entry points, keep the remaining lesson's progress, and verify fresh and legacy course state after reload. **Effort 1–2 days · medium risk · depends on shared retirement semantics in DATA-01.** **Independent:** see item ARC-01. [Architecture evidence](specialists/software-architect.md)

### DATA-03 · Undo can save an earlier resume position

**Data Engineer and Playback Engineer · progress preservation · Medium · high confidence · confirmed defect.** Current timing guidance says Undo should preserve the recording position (`docs/PLAYBACK_SYNC.md:22`). Undo restores phrases and statuses and calls `seekPhrase` on the first cue (`src/app.mjs:380`). A valid seek saves player state (`src/player.mjs:174–179`, `src/app.mjs:242,304`). The Independent Reviewer used a native WAV fixture and observed Undo move the stored cursor from 3.1 s to 0.1 s through reload while coverage survived. Regroup behavior needs separate acceptance.

**Remediation and acceptance.** Preserve recording time and map the restored cue by time under current gap/overlap and offset rules. Validate later cue, changed IDs, gaps, overlaps, paused and active transport, and persisted resume on reload. An explicit Restart remains distinct. **Effort 1–2 days · medium risk · depends on the playback mode and cue contract.** **Independent:** confirmed through the real UI, superseding the initial source-only assessment. [Data evidence](specialists/data-engineer.md) · [Playback evidence](specialists/playback-engineer.md)

### PLAY-01 · Filter state persists into Continuous transport

**Playback Engineer and Product Strategist · core transport · Medium · high confidence · confirmed defect with a related empty-selection source path.** In the actual mobile player, select Difficult only in Manual then switch to Continuous. Next becomes Finish and completes on the first cue even with later cues available. `eligible` always filters and `setMode` retains old selection (`src/player.mjs:166–171,202–203`), while the UI says filters apply in Manual or Automatic (`src/app.mjs:120`). Separately, the summary's zero-match difficult review applies selection before checking eligibility (`app.mjs:384`), unlike Options. Continuous audio clock and manual Next use different intents for the same mode.

**Remediation and acceptance.** Use one active eligible sequence for transport, text and completion, preserving a remembered filtered selection for deliberate shadowing. Validate before changing state for empty review. Regression covers Manual/Automatic filter ↔ Continuous, Next/Previous/swipe, exact marking and finish, both sources and zero matches. **Effort 1–2 days · medium risk · depends on explicit current mode semantics.** **Independent:** see item PB-01. [Playback evidence](specialists/playback-engineer.md) · [Product evidence](specialists/product-strategist.md)

### PLAY-02 · Mirror starts a response after incomplete original playback

**Playback Engineer · comparison timing · Medium · high confidence · confirmed defect in synthetic native media and simulated capture.** A 1.6–2.8 s cue on a 2 s WAV is refused by the main transport, but Mirror's original segment resolves at early media end and progresses to Record (`src/mirror.mjs:36–43`, `src/player.mjs:158–164,190–196`). A user can compare against a truncated cue. This concerns completing the original segment, separate from PRIV-01's pending legacy permission lifecycle.

**Remediation and acceptance.** Validate the whole interval against playable time and use a distinct incomplete result on early end. Keep native offset and exact cue behavior. Test valid and partial bounds, media ended/error, attempt cancellation and release of simulated resources. Capture never begins on an invalid original. **Effort 1–2 days · medium risk · depends on shared source bounds and separate capture lifecycle.** **Independent:** see item PB-03. [Playback evidence](specialists/playback-engineer.md)

### PLAY-03 · Valid WebVTT STYLE blocks prevent manual import

**Playback Engineer · transcript processing · Medium · high confidence · confirmed defect.** Mobile manual import returned “A caption block has no timestamp” and disabled Save for a valid WebVTT with a `STYLE` block before the cue. The same cue without the metadata saved. The caption path treats that block as a bad cue and preview makes parser problems fatal (`src/transcript.mjs:19–34,53–57,103`, `src/app.mjs:246–247`). ZIP's recovery wrapper is separate and handles parser notes differently.

**Remediation and acceptance.** Parse or skip standard non-caption header blocks in valid positions while preserving the exact cue times and real malformed-cue feedback. Test STYLE, standard other metadata, settings, multiline text and a bad cue, through parse and manual save. **Effort 0.5–1 day · low/medium risk · depends on the manual/ZIP parser contract.** **Independent:** see item PB-04. [Playback evidence](specialists/playback-engineer.md)

### LEARN-01 · Session and lesson indicators conflate practice, listening and position

**Playback Engineer and Product Strategist · progress meaning · Medium · high confidence · confirmed defect plus source-based label mismatch.** Browser Summary and History included earlier heard cues and old statuses in a session with zero active listening (`src/player.mjs:234–250`, `src/app.mjs:163–166`). Home uses the same “practised” wording for timed marks, completed state and audio-only playhead percentage (`src/courses.mjs:6,12–14`, `src/app.mjs:79`, `src/home.mjs:15–17`), so listening progress and direct seeks can say something different from actual deliberate practice. The session issue has runtime evidence. The Home label mismatch is static.

**Remediation and acceptance.** Record session-local coverage and explicit actions separately from lifetime measures. Label the most useful metric for the source and surface. Zero-listening sessions do not inherit prior counts. Timed listening without marks and uncaptioned seeks report the right resume or listening state. Restore old history without inventing metrics. **Effort 1–3 days · medium risk · depends on metric definitions and legacy compatibility.** **Independent:** reproduced session counter mismatch in a focused controller check. Source confirmed progress wording. [Playback evidence](specialists/playback-engineer.md) · [Product evidence](specialists/product-strategist.md)

### SYNC-01 · Capacity rules and error outcomes disagree

**Data Engineer, Software Architect and Security Engineer · import and persistence · Medium · high confidence in the demonstrated mismatch and retry, memory impact conditional · confirmed defects with a related design weakness.** ZIP preflight still rejects estimated raw JSON near 2.7 MB (`src/library-ui.mjs:83`). A valid synthetic 3,379,761-byte request was accepted by the actual Worker with a 22,567-byte compressed row. The Worker caps raw input at 16,000,000 and stored payload at 1,950,000 bytes (`server/worker.mjs:5,40–49`). If a library hits a real limit, `flush()` categorises 413 as offline and retries unchanged with backoff (`src/store.mjs:31–42`). The Worker materialises the body before the measured-byte check and restore reads the whole file (`src/app.mjs:404`), with environment-specific resource impacts unmeasured.

**Remediation and acceptance.** Align import acceptance with Worker limits. Bound backup and request reads, return actionable permanent capacity outcomes while preserving local pending edits, and retain transient retry and explicit 409 conflict behavior. Regression covers compressible data above the obsolete guard, genuine raw/stored overage, near-limit old exports, connection failure, corrected reattempt and no repeat of unchanged rejected data. **Effort 2–4 days · medium risk · depends on accepted sizes/codec and the host's real ingress limits.** **Independent:** separately confirmed accepted large state (3,168,449 bytes raw, 9,636-byte row) and repeated 413 behavior. Resource headroom remains unmeasured. [Architecture evidence](specialists/software-architect.md) · [Data evidence](specialists/data-engineer.md) · [Security evidence](specialists/security-engineer.md)

### SYNC-02 · A local write failure suppresses cloud saves

**Data Engineer · local durability and remote availability · Medium · high confidence in Store behavior · confirmed through a synthetic storage fixture.** After valid cloud connection, local cache write failure sets `storage-error`, and `flush()` and `retry()` do not send saves in that mode (`src/store.mjs:26–42`). While practising with storage quota or restrictions, pending state can remain volatile despite a reachable server. The mode field describes two different stores.

**Remediation and acceptance.** Track cache durability alongside connectivity, auth and revision. After validating owner and revision, allow a successful authenticated save while reporting that local storage is unavailable. Verify cloud-save/reload with blocked IDB, both stores failing, durable offline edits and later conflict. **Effort 1–2 days · medium risk · depends on account binding and existing retry semantics.** **Independent:** confirmed in a synthetic Store fixture. Real browser quota failure remains unmeasured. [Data evidence](specialists/data-engineer.md)

### UX-01 · Focus can fall to the body in queue, Options, IPA and imports

**UX Specialist and Software Architect · accessibility and view lifecycle · Medium · high confidence · confirmed defect.** At 320 × 568, keyboard open/close transitions in queue and IPA and a Practice tab change lost focus. Invalid import preview also left focus on the body with no live error announcement. During native playback at 1280 × 800, opening Options and focusing Playback at 2.077 s lost focus at 5.091 s while the dialog stayed open. `PlayerEngine.tick` saves progress, `Store` calls its change callback, and the shell rebuilds while retaining only selected ID-based focus targets (`src/player.mjs:244`, `src/app.mjs:179–203,242,297–304`). Queue entry also lacks explicit focus ownership.

**Remediation and acceptance.** Give affected overlays durable triggers, explicit entry and return focus, tab navigation and announcements. Keep focus-critical subtrees stable through periodic progress saves. Test keyboard open, Tab/arrow/Enter, Escape/Back, error, focus containment and periodic updates during actual playback. Verify scroll and compact playback still work. **Effort 2–4 days · medium risk · depends on overlay/history ownership and bounded notifications.** **Independent:** reviewed as a single issue with ARC-04 source and distinct browser trigger evidence. [UX evidence](specialists/ux-specialist.md) · [Architecture evidence](specialists/software-architect.md)

### UX-02 · Practice repeats equivalent status actions

**UX Specialist · interaction clarity · Low · high confidence · confirmed defect.** Options → Practice has two accessible controls of each status in inspected mobile markup and the accessibility tree. Both the options container and `practiceForm` call `statusControls` (`src/app.mjs:120,127`). Users hear or see duplicate controls for one action.

**Remediation and acceptance.** Keep one control group for Practised and Difficult. Use keyboard and accessibility tree assertions for distinct names, a single each, their independent pressed states and retained actions from the queue. **Effort 0.5 day · low risk · depends on chosen placement.** **Independent:** see UX review dispositions. [UX evidence](specialists/ux-specialist.md)

### UX-03 · Faded selectable transcript line misses large-text contrast

**UX Specialist · accessibility and transcript readability · Medium · high confidence in observed state · confirmed defect in the measured state.** At 1440 × 900 in the light fixture, a distance-two selectable phrase measured about 2.1:1 while large text requires 3:1. Its `opacity` is reduced by the transcript CSS while the phrase remains interactive (`src/mobile-player.css:27–33`). Current text had strong contrast. Scope the defect to checked contexts and test real backdrop variation before certifying others.

**Remediation and acceptance.** Preserve active phrase emphasis with sufficient text/background contrast in selectable states. Verify both themes, representative artwork lightness, keyboard/manual browse and current/non-current text against WCAG large/normal thresholds as applicable. **Effort 0.5–1 day · low/medium risk · depends on backdrop and design tokens.** **Independent:** see UX review dispositions and measurement limitation. [UX evidence](specialists/ux-specialist.md)

### UX-04 · Current phrase clock is blank in the seek dialog

**UX Specialist · seek feedback · Low · high confidence · confirmed defect.** At 320 × 568, Recording timeline showed full-recording time while Current phrase omitted elapsed/total. Player and dialog both use `phrase-clock`, and timeline updates target the first match (`src/app.mjs:106,149,237`). Scope is feedback, with current seek corroborated separately by QA.

**Remediation and acceptance.** Give visible clock regions unique identity and synchronise each to the same current phrase clock. Open at a non-zero position and seek by keyboard/pointer. Both clocks update and no duplicate IDs remain. **Effort 0.5 day · low risk · depends on clock/render ownership.** **Independent:** see UX review dispositions. [UX evidence](specialists/ux-specialist.md) · [QA evidence](specialists/qa-engineer.md)

### UX-05 · Settings select names differ from visible labels

**UX Specialist · accessible naming · Low · high confidence · confirmed defect.** In the 390 × 844 accessibility tree, visible “Phrase length” mapped to `grouping` and “Lead-in” mapped to `leadIn`. The select's internal key is used as `aria-label` and overrides its visible wrapped label (`src/app.mjs:87`). This makes controls harder to find by visible text and voice.

**Remediation and acceptance.** Derive accessible names from visible labels. Verify keyboard navigation and the accessible-name tree for settings selects. Preserve already correct toggles. **Effort 0.5 day · low risk · depends on settings label contract.** **Independent:** see UX review dispositions. [UX evidence](specialists/ux-specialist.md)

### UX-06 · Save & practise can leave the user on Home

**UX Specialist and QA Engineer · first practice journey · Medium · high confidence · independently reproduced defect.** In a fresh synthetic mobile library, valid YouTube transcript save persisted a lesson but ended at Home. Resume opens the player. This also reproduces with a deterministic adapter, separately from streaming availability. `saveImport` clears the sheet before `openLesson`. The synchronous `load` callback renders the old Home view before the player route commits. Closing the overlay schedules `history.back()` and the ensuing pop restores Home (`src/app.mjs:241,247–248,296–304`, `src/player.mjs:107–124`, `src/navigation.mjs:10–18`).

**Remediation and acceptance.** Commit the intended first-practice route as one action and preserve proper Back behavior. Verify empty and populated libraries, successful and invalid import, current audio state, no autoplay and explicit Back after the new player is prepared. **Effort 1–2 days · medium risk · depends on stable render/history boundaries.** **Independent:** reproduced in a separate browser run by QA and by the Independent Reviewer. [UX evidence](specialists/ux-specialist.md) · [QA evidence](specialists/qa-engineer.md)

### OPS-01 · Service worker can boot an empty shell offline

**Software Architect · PWA readiness · Medium · high confidence · independently reproduced defect.** After service-worker installation and an online reload, offline reload returned HTML 200 but `#app` remained empty. Nine eager modules fell outside the fixed list and fetch caches only listed paths (`sw.js:1–4`, `src/app.mjs:1–20`). Local cache contents cannot be used before the full module graph boots. No audio or full-stream offline promise follows.

**Remediation and acceptance.** Derive or test the app-shell cache against the emitted module graph. Verify an updated shell installs and offline reload boots cached data for an authorised same-owner context. Confirm private state and media responses avoid the static cache, and stale assets update after reconnect. **Effort 1–2 days · medium risk · depends on an explicit owner policy, build and cache version strategy.** **Independent:** reproduced via warm service-worker and offline reload in isolated Chromium. [Architecture evidence](specialists/software-architect.md)

### OPS-02 · Browser verification scripts have drifted from current behavior

**QA Engineer · regression confidence · Medium · high confidence · confirmed test harness defect.** Active scripts hit removed `.mobile-more` and `.recording-toggle` selectors and do not finish the advertised workflows. Older smoke/extended scripts rely on inlining outdated modules and disabling browser web security. Temporary adaptations let Original Playback and Navigation complete. Adapted Sync still stopped at a programmatic seek assertion. Targeted current-entry tests passed specific new seek, ZIP and local conflict cases. A general transport failure remains unsupported. (`tests/browser_navigation.py`, `tests/browser_original_playback.py`, `tests/browser_sync.py`, `tests/browser_smoke.py`, `tests/browser_extended.py`).

**Remediation and acceptance.** Maintain a compact current-app suite using stable accessible actions, native synthetic media and isolated fixture services. Keep historical scripts documented. Require clean checkouts to reach all assertions with normal browser controls and distinct reporting for mocked YouTube, hosted and physical-device behavior. **Effort 1–2 days · low/medium risk · depends on current UI contracts and fixture tooling.** **Independent:** see verification dispositions. [QA evidence](specialists/qa-engineer.md)

### OPS-03 · Alternate `npm start` entry point fails in a clean checkout

**Performance Engineer · developer reliability · Low · high confidence · confirmed defect.** `package.json` calls undeclared `http-server` and exits 127 in the measured clean environment. It would only provide static files even if installed. The README's `npm run dev`/`node scripts/dev.mjs` path works and provides the API stub. Impact concerns an advertised script and onboarding, with a documented workaround.

**Remediation and acceptance.** Keep a single supported development command, or point the alias at the working dev server with a smoke check for HTML and fixture API. Verify a fresh archive and no added dependency. **Effort 0.5 day · low risk · depends on documented commands and callers.** **Independent:** verified scripts and reviewed the clean environment results. [Performance evidence](specialists/performance-engineer.md)

### PERF-01 · Playback progress repeatedly uploads the entire snapshot

**Performance Engineer and Data Engineer · client/network/Worker efficiency · Medium · high confidence in local measured request volume · confirmed behavior cost.** With 36 synthetic lessons and 16,950 cues, normal native playback sent three 7.13 MB state PUTs during 12.6 s, about 21.38 MB of bodies and 5 s spacing. Successful local responses took 0.70–0.95 s. The progress timer invokes a full local write, full JSON encode and Worker save (`src/player.mjs:244`, `src/app.mjs:242`, `src/store.mjs:29–40`). Baseline long tasks were observed separately and are not attributed to any one operation. Hosted/device impact unmeasured.

**Remediation and acceptance.** Separate durable local progress checkpoints from the frequency of network snapshot saves. Start with safe coalescing and deliberate transition flush, retain CAS and avoid losing pending data. Compare the same large fixture with no more than one scheduled upload during 12.6 s of uninterrupted playback, durable local resume within the agreed tolerance after interruption, and correct final flush, retry and conflict. **Effort 2–4 days · medium/high risk · depends on sync outcome and progress ownership contracts.** **Independent:** source and method review, no duplicated benchmark. [Performance evidence](specialists/performance-engineer.md)

### PERF-02 · A late active cue expands the queue to the full prefix

**Performance Engineer and UX Specialist · queue responsiveness · Medium · high confidence in local baseline · confirmed performance defect.** At cue 1,171 in a 1,200-cue fixture, opening the queue rendered all 1,200 rows, compared with 80 at the first cue. Five local runs had 167 ms median synchronous opening handler versus 45 ms. `queueHTML` extends the prefix to the active index plus 30 and does a repeated full-phrase lookup, while render replaces the shell (`src/app.mjs:117,190`). This is a foreground measured cost on the tested workload.

**Remediation and acceptance.** Use a bounded window around the active cue with navigation to other windows and stable cue position/status lookup. In the same 1,200-cue fixture, render at most 120 initial rows near the active cue, maintain keyboard and touch navigation and target under 100 ms median synchronous opening under comparable conditions. Verify focus, scroll restoration, edit/mark and navigation to first/middle/last cues. **Effort 1–3 days · medium risk · depends on focus and queue contract.** **Independent:** source and method reviewed. Headless timings are hardware-specific. [Performance evidence](specialists/performance-engineer.md)

### PERF-03 · Paused native playback retains frequent polling

**Performance Engineer and Playback Engineer · idle resource use · Low · high confidence in measured cadence, battery impact unknown · improvement opportunity.** A paused page with a loaded audio adapter ran 101 poll callbacks over roughly two seconds. `PlayerEngine` maintains a 20 ms sampling interval even while idle (`src/player.mjs:62–78,222–246`). Native events already drive parts of the clock path. Active boundary timing still needs frequent checks.

**Remediation and acceptance.** Suspend or slow routine polling in stable idle states while preserving pending seek, readiness and background/recovery transitions. Measure a material reduction from the paused baseline and repeat exact-cue, boundary, delayed seek and visibility checks under active audio and YouTube adapter doubles. **Effort 1–2 days · medium risk · depends on playback event ownership and device checks.** **Independent:** verified the cadence mechanism in source. Battery impact remains unassessed. [Performance evidence](specialists/performance-engineer.md)
