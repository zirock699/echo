# Transformation roadmap

The direction is a private practice studio built around the existing reference player. Start by continuing a chosen reference or saying one original update. Make the move from hearing a phrase to saying something new easy to discover. Confirm the value of later practice before adding scheduling. [Strategy](strategy.md) · [Concepts](design-concepts.md) · [Interactive prototype](practice-prototype.html)

## Priorities and dependencies

| Order | Proposed epic | Primary discipline | Relative complexity and gate |
| --- | --- | --- | --- |
| 1 | T1 · Make a useful start obvious | Design and core learning | Medium. First owner decision. Use the existing cues and a disposable prototype to test the experience before specifying navigation changes. |
| 1 in parallel | T4 · Protect private work across tabs and devices | Data and reliability | Medium for scoped writer safety. High for replacing synchronisation. Confirm the final recovery contract before any release that increases saved activity. |
| 2 | T2 · Give practice its own state boundary | Engineering foundation | Medium. Specify alongside the approved T1 flow. Build only the smallest slice that needs it. |
| 3 | T3 · Make references easier to prepare and trust | Content and media | Medium for the native pilot. High for unsupervised alignment. A rights-cleared take and device evidence gate audio distribution. |
| 4 | T5 · Give returning learners a worthwhile next try | Core learning and product innovation | Small for a paper comparison. Medium for in-app authored return cues if the comparison supports them. |
| Cross-cutting | T6 · Make releases prove user outcomes | Quality and trust | Medium. Establish the evidence contract during specification. Require relevant hosted, device and provider checks at release. |

Effort reflects the shape of work and known dependencies. It is neither a delivery commitment nor a reason to build a larger option. Routine maintenance follows the existing audit and maintenance workflow.

### T1 · Make a useful start obvious

**Current and future experience.** Today a person can open one original prompt from Home. A prepared reference has a direct Resume and explicit Play. Applying a phrase in a new conversation sits inside Practice settings. A proposed Practice destination retains both fast starts and offers an optional handoff to a different message from the reference flow. Library gathers discovery and management. History explains what happened and can eventually lead to an authorised return exercise.

**Alternatives and evidence.** Preserve existing Home and add a clearer cue, use a guided Today sequence, organise by communication skill, or test the selected hybrid. The current fast paths make a change worthwhile only if it preserves the starts and gives users a clearer path through optional practice. Competitor patterns and prototype checks support the interaction hypothesis. They do not establish user preference. [Observed journeys](current-experience.md) · [Compare three concepts](design-concepts.md) · [Prototype](practice-prototype.html)

**Before and after.** Prepared reference previously starts with Resume → Play. Keep that route. Once a reference is selected, compare the current Settings → Practice → cue with one disclosed transfer action. Empty accounts can speak from a built-in scenario in one activation in both models. Keep voluntary exit, Back and the persistent progress/transport contract. Test a clearer home-only option against the new IA so a wholesale navigation change can lose.

**Benefit, complexity and risk.** Medium. Less orientation and fewer secondary decisions may improve repeat practice. The proposed navigation may instead disrupt familiar Library access and user control. With no change, both cues remain usable, with an advanced speaker still having to discover the transfer path.

**Measures and acceptance.** Count actual tasks completed, decisions, steps, time to first voluntary spoken response, recoveries and whether both start choices are understood. Compare the same jobs and stopping points on phone first. Keep Resume within its current activation count, open the original cue in one activation, and open transfer in one action from the relevant reference state. Preserve full-player and queue position, native/device Back, focus return and private-library gate. Demonstrate 320 px reflow, 200% zoom and keyboard navigation before release. Treat moving Search and Collections, and promoting History, as separately rejectable hypotheses. Keep their present placement if task access, frequency or recoverability does not improve. Direction requires owner approval and a comparison with the existing path.

**Accountable roles.** Principal Product Designer, UX Researcher and Mobile Specialist, Interaction Designer, Product Strategist, Playback, QA and Independent Design Critic.

### T2 · Give practice its own state boundary

**Current and future.** Player, recorder, Store, full-root rendering, history and focus share responsibilities around each overlay. The current prompts illustrate the resulting coordination. An explicit bounded practice flow can own intent, optional steps, one exit and distinguishable outcomes, leaving the clock and durable snapshots with their current owners. Keep the persistent media element mounted.

**Alternatives and evidence.** Preserve current orchestration for a one-off copy change. Consider a feature-local flow and stable DOM region for the approved T1 slice. Compare wholesale reducer/framework replacement or a greenfield implementation on the same preserve list. The latter options carry higher regression, migration and team costs. [Architecture assessment](architecture-data.md) · [Current practice mechanics](playback-performance.md)

**Benefit and risk.** Medium. Fewer focus resets, fewer unintended transport changes and easier extension to a second exercise. Inactivity avoids migration risk today and accumulates orchestration with each added exercise. Sequence the first stable slice behind T1 specification and keep compatibility with existing routes before expanding it.

**Measures and acceptance.** Trace one intent from entry through finish and interruption. Show fewer independent places making the same decision. Verify background saves and clock callbacks cannot remount the focused action, restart audio, or create progress. Preserve Back/Forward, the exact phrase/time, explicit marks, original imports, mini-player and all three modes. Compare app-shell cost and idle/per-interaction work on the same fixture. Architecture, Playback, Interaction Design, QA and Independent Reviewer own the gate.

### T3 · Make references easier to prepare and trust

**Current and future.** User-supplied captions, ZIP and clock repair give control but delay an initial exercise. A valid remote video may still lack an available transcript or predictable exact playback. Offer original text immediately, trial one short cleared native reference in a device player, and make existing private uploads easier to preview. Use YouTube as a deliberate reference route with visible supported controls.

**Alternatives and evidence.** Continue owner imports, provide a very small human-checked starter set, author one local timed clip, or test licensed offline alignment followed by manual edge review. A link alone is insufficient to promise caption access, frame-exact boundaries or audio download rights. Large bundled catalogues and automatic ingestion have a continuing rights, editorial and maintenance cost. [Playback and preparation](playback-performance.md) · [Rights and clip trial](../product/speaking-prompt-handoff.md#e3-f1-and-e3-f2--try-one-permissioned-reference-off-app)

**Before and after.** Today a first timed lesson can require a source, timed text, preview, repair, save and then Play. Compare a ready fictional situation or an optional cleared sample in one short journey. For owner imports choose the known source first and check the first and last cue before saving.

**Benefit, dependencies and risk.** Less setup before useful speech and more predictable boundary repeat on authorised native material. Without change, the owner must continue to prepare references or take the text shortcut. Start with a real gap in favourites, the necessary rights, physical playback evidence and an ear review. App delivery needs rights for that channel and an unavailable/withdrawal route.

**Measures and acceptance.** Compare time spent locating, preparing and repairing material and first successful speech. Document provenance, exact take and permissions. Check both cue edges, replay and interruption on the intended device, plus text fallback. Verify the built-in and native routes stay free of YouTube requests until deliberate activation, and check current provider requirements and recovery for the supported embed. Preserve source provenance, offsets and existing media controls. Product R&D, Playback, Security, Interaction Design and QA own the gate.

### T4 · Protect private work across tabs and devices

**Current and future.** The owner-bound server revision prevents silent cloud overwrite and preserves a pending conflict choice. A single mutable IndexedDB cache slot can lose one tab's previously saved local edit when a second stale tab writes another field. With two disposable Chromium tabs and interrupted writes, a later theme edit replaced a locally durable 3.93-second checkpoint with the stale zero position. Reopening the same verified account displayed the theme and the old position. Field incidence is unknown. Provide recoverable local work and clear conflict status before considering finer-grained sync.

**Alternatives and evidence.** Keep explicit whole-library conflict, coordinate one active writer with durable per-tab pending recovery, isolate a narrow high-frequency record, or move to operation logs/CRDTs or a device-first system. Per-domain sync is justified only if observed concurrency or quotas outweigh migration cost. A general merge can misrepresent incompatible transcript edits and audio deletion. [Architecture and data](architecture-data.md) · [Quality and trust](quality-trust.md)

**Benefit, dependencies and risk.** Medium for the bounded case. Preserve the speaker's work if two views exist or a network transition intervenes. If behaviour remains unchanged, larger use of draft and history surfaces increases reliance on that shared slot. Use real IndexedDB tabs to test candidate recovery policies, including when browser coordination fails. Demand an additive upgrade and reversible data contract.

**Measures and acceptance.** No silent loss of either accepted durable pending change in controlled two-tab ordering, crash/reload and offline recovery. A single-writer design must prevent the second mutation before presenting it as saved and provide a recoverable handover. On a conflict the speaker can compare meaningful pending work before choosing. Exercise owner switch, legacy restore, failed cache, quota and retirement. Confirm hosted identity and migration assertions when release reaches them. Data Engineer, Architect, Security, QA and Independent Reviewer own the gate.

### T5 · Give returning learners a worthwhile next try

**Current and future.** Resume, Difficult and session counts show activity. They do not establish fresh recall. A learner can optionally try one new scenario before replay and answer how clearly they conveyed the intended change. A paper comparison can test the hypothesis before designing persisted follow-ups.

**Alternatives and evidence.** Continue media-only practice, compare replay plus a changed message with equal-time replay, leave the prompt on a card, or add one simple voluntary entry after results. Exclude streak pressure, clinical guidance and inferred pronunciation scores from the pilot. [Learning evidence and measures](product-learning.md) · [History prototype](practice-prototype.html#history)

**Before and after.** Resume may return directly to a familiar phrase. An optional new prompt can come first when chosen, then Resume remains available. History presents what Echo observed and leaves other judgements with the user or listener.

**Benefit, dependencies and risk.** Small to test, medium to ship. The larger potential benefit is using a selected feature in unfamiliar speech. Without change, Echo remains good at repeatable listening and rehearsal, with transfer unmeasured. Content requires more fresh examples and storage needs a privacy decision if the paper comparison earns a product change.

**Measures and acceptance.** Take an unfamiliar baseline. Compare equal practice windows and fresh later probes before replay, vary the order and report uncertainty. Keep voluntary reuse, self-reported ease, expression retrieval and an unaware listener's understanding distinct. If results are tied, mixed or adequately served by paper, defer product investment. Product R&D, Learning/UX Research, Privacy and Independent Reviewer own the decision.

### T6 · Make releases prove user outcomes

**Current and future.** The maintained local tests catch important failures and release bundle drift. A hosted auth or native-media failure can still escape. Keep a small set of critical end-to-end outcomes with independent fixture, device, assistive technology and hosted evidence where the change reaches those boundaries.

**Alternatives and evidence.** Preserve the suite and add area-specific checks, create a small journey-oriented release contract with durable state/clock oracles, or use an external full-device provider. Local fixtures offer the simplest repeatable evidence. Use controlled hosted or device environments for what the fixtures cannot know. [Reliability and trust plan](quality-trust.md)

**Benefit, dependencies and risk.** Medium. Evidence remains useful across a redesign and keeps the release decision legible. Without change, a passing suite remains strong local evidence but incomplete evidence of a user's device or account experience. Hosted verification needs explicit access and intended environment.

**Measures and acceptance.** Each critical scenario has a named outcome, fixture, relevant observable invariant, release tier and evidence owner. Coverage includes first spoken start, resume, import/prepare and retry, exact native playback, capture cancellation, preserved progress, offline/owner transitions and correction after interrupted work. Restore and rollback contracts are exercised against packaged artifacts before changing data formats. QA leads with Security, Performance, Data, Design and Independent Reviewer.

## Scoped maintenance findings

The matched baseline exposed a timed-transcript field without a programmatic label and a queue overlay that intercepted Next, Queue and Compare at 820 × 1180. The implementation labels the textarea and file picker separately and gives the open tablet queue its own space beside the player. [Baseline observations](current-experience.md) · [Verification](release-evidence.md)

## Owner decision

The owner approved all six initiatives for work on 25 November 2026. T1 and T4 proceeded in parallel, with T2 scoped to the implemented cue. The [implementation design](implementation-design.md) records the existing navigation choice and the one-action practice and preview contracts. The [pilot materials](pilot-materials.md) contain the remaining off-app comparisons. Real speech observations, clip rights and physical-device evidence govern the dependent choices. T6 supplies the [verification contract](release-evidence.md) for release.

## Implementation outcomes · 25 November 2026

| Epic | Delivered in the local candidate | Remaining decision or release evidence |
| --- | --- | --- |
| T1 | Home exposes the one-action speaking start and keeps the two-action Resume and Play route. A selected quiet phrase exposes one direct transfer action, including when its media is loading. The 820 × 1180 queue leaves transport reachable. | Compare whether a voluntary speaker finds both starts and returns successfully. Use that evidence before moving navigation. |
| T2 | The speaking cue keeps its mounted element, focus and scroll during background changes. It preserves the selected phrase, queue, paused transport and options draft through exit and supported Back and Forward. | Exercise actual system Back, device interruptions and a relevant screen reader during release validation. |
| T3 | Add and Replace have separate named transcript and file controls, recoverable validation and precise first and final bounds. A file still loading invalidates the previous preview. Native playback and browsing stay clear of provider requests until a video is deliberately chosen. | A complete human recording needs permission for the intended use and a phone playback trial. Live YouTube playback and compact behavior need provider verification. |
| T4 | Verified owners can compare, export, use or discard distinct pending browser copies. Restore and cloud acceptance remain explicit when revisions diverge. A retirement save checks pending device references before removing an asset from account storage. | Verify hosted identity, migrations and old-shell rollout with a disposable release account. Recovery depends on verified access to this browser’s durable storage. |
| T5 | Matched fictional cards, an unfamiliar baseline, a later comparison before replay and separate listener and speaker outcomes are ready to run privately. | Participant evidence determines whether a later in-app cue or scheduler earns a place. |
| T6 | The journey runner exercises the app and packaged Worker against disposable local fixtures, with independent QA and review of the candidate. | Collect the hosted, physical-device, assistive-technology and live-source results for the release that reaches those boundaries. |

[Verification results and independent review](release-evidence.md#candidate-outcome--25-november-2026) · [Private pilot materials](pilot-materials.md)

## Rehearsal Desk follow-through · 25 November 2026

After the rendered comparison, the owner chose B · Rehearsal Desk and requested steadier player controls. The implemented navigation, aligned transport, Listen back and Journal passed local QA and independent design review. At that revision the acceptance runner covered capture, exact Journal return and drill focus. The physical-device, hosted, live-source and participant evidence above remains open. [Design decision and actual screens](../design-review-2026-11-25/review-notes.md#implemented-rehearsal-desk) · [Verification outcomes](release-evidence.md#rehearsal-desk-closeout--25-november-2026)

## Home and practice correction · 25 November 2026

The owner found the standalone text prompts gave no follow-through and the disclosure hid their library. Home now shows the saved lesson and populated shelves directly. The static Home prompt, drill chooser and phrase-to-conversation prompt were retired. The off-app pilot in T5 remains an open product question. [Current design](../../DESIGN.md#home-and-practice-correction--25-november-2026) · [Verified outcomes](release-evidence.md#home-and-practice-correction--25-november-2026)
