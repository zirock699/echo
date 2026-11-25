# Root causes and cross-domain decisions

## One library has several mutation paths

The Player and Library perform different lesson-deletion operations. ZIP replacement, JSON restore and background media cleanup independently decide which references survive. The D1 compare-and-swap protects metadata revision order for a single owner, while it places no constraint on the lifecycle of an R2 object. Both the observed missing artwork and the conditional backup/audio loss are consequences of that gap. Unify the small set of library operations and test reference reachability before changing storage architecture.

## Storage health, capacity and identity share a weak contract

The browser still uses the older ZIP capacity rule after the Worker gained a compressed storage format. The save state collapses transient connectivity, permanent size rejection and local cache failure. Separately, revisions bound to a server owner are treated as meaningful in an unscoped browser cache. Preserve snapshots, revision checks and explicit conflict choice. Make acceptance limits and save outcomes consistent and establish ownership before presenting or flushing private cached content.

## Practice intent and recorded outcomes need separate state

A media clock can tell the controller what interval played. It cannot tell the UI whether the user intended a full recording, a subset, a recorded comparison or a deliberate Practised mark. A stale selection currently affects Continuous transport, whole-lesson history supplies current-session counters, and separate recording paths disagree about whether the whole source phrase played. Fix those decisions where they are made. Keep shared helpers at the level of clocks, source bounds and lifecycle ownership.

## Untrusted or asynchronous state can outlive its intended boundary

Restored snapshot data is accepted with only top-level validation, then some fields become part of HTML templates. Legacy capture's permission request can outlive the initiating UI. Fix the corresponding data-to-DOM and user-intent-to-capture boundaries first. A shared account cache and non-loopback previews raise separate trust questions that require explicit local and hosted acceptance checks.

## Full renders interact with browser-managed focus and history

`render()` rebuilds the shell and then restores selected state. Some controls lack a durable focus key, and a periodic save can trigger the same rebuild as a deliberate modal transition. Saving a first lesson also crosses Store, Player and route commits while closing an overlay. These are two concrete failure modes at the same orchestration boundary. Stabilize focus-critical regions and make route transitions atomic at the action boundary. The evidence does not warrant replacing the rendering stack.

## Release assets and executable coverage can drift from the app

The service-worker list and the real module graph are independent. Historical browser checks also name controls that the approved UI no longer renders. A passing Node suite and successful Worker syntax check are valuable but cannot catch either kind of drift. Verify actual packaged behavior and update a small browser suite around accessible names and end-to-end outcomes.

## Trade-offs resolved

- **Offline readiness and privacy.** Cache public application assets. Only display persisted private metadata under an explicit owner/offline policy. Do not use a successful static boot as evidence that private media or YouTube work offline.
- **Media retirement versus predictable restore.** Delay physical cleanup when ownership or reachability is uncertain. Explain clearly that a JSON export cannot re-create deleted audio. Consider retention and recovery limits separately from the immediate reference-preservation fix.
- **Practice simplicity versus feature removal.** Keep a useful first recording and review workflow. Consolidate overlapping entry points only after confirming the legacy recorder still has an equivalent untimed path.
- **Fixing focus versus general refactor.** Recover focus and avoid background replacement in the affected queue, Options, IPA and import journeys first. Measured render cost can inform later work but does not justify a full UI migration by itself.
