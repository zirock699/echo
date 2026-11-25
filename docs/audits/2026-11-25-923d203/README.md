# Echo Studio audit · 25 November 2026

Echo Studio's existing architecture is a reasonable fit for a private, mobile-first practice app. The local native-audio loop, exact cue timing, persistent player and versioned storage provide a useful foundation. The highest-value work is keeping microphone permission tied to visible recording intent, protecting library and media references during edits and restore, and making first entry and playback state reliable. A rewrite or new infrastructure would add risk without resolving the demonstrated failures.

The team audited `work` at `923d203`, which matched GitHub and was 19 commits ahead of `main` when checked. Nine independent specialist children executed the audit and review using native Codex delegation. Each used the matching project role instructions. The session supported generic children rather than named project role selection. [Baseline and configuration evidence](baseline.md) · [Actual agent execution](orchestration.md) · [Reusable operating model](../../engineering/agent-operating-model.md)

## Most important conclusions

1. **Tie recording to the active user action.** The legacy recorder can start after a pending permission result arrives and the initiating controls have closed. Independent source inspection confirmed the lifecycle gap. Physical permission sequencing remains untested. Harden snapshot validation and account-bound browser storage alongside this work. [Privacy findings](findings.md#priv-01--legacy-recording-can-start-after-its-controls-close)
2. **Protect existing media and progress.** ZIP replacement with no artwork removed the prior image while retaining its reference. Player-side deletion broke course Continue. The independent reviewer showed Undo rewinding the saved cursor from 3.1 s to 0.1 s despite retained coverage. An analogous restore-to-retired-audio path remains conditional. [Data findings](findings.md#data-01--media-retirement-can-break-a-live-library-reference)
3. **Make the first practice session and transport dependable.** A valid Save & practise returns to Home in the tested launch flow. Continuous can finish early after filtered practice, and session summaries count older activity. Current native WAV checks stopped within 3–22 ms after the expected manual cue end in three tested runs. These results cover a bounded local fixture, while live YouTube and physical Android were unassessed. [Playback findings](findings.md#play-01--filter-state-persists-into-continuous-transport) · [First practice finding](findings.md#ux-06--save--practise-can-leave-the-user-on-home)
4. **Fix the app boundaries that degrade at larger size or under failure.** The old ZIP cap rejects a library the Worker accepts. Permanent storage rejection is retried as if offline. A valid large fixture sent 21.38 MB of progress saves in 12.6 seconds, the late-cue queue mounted 1,200 rows, and warmed offline reload reached a blank shell. [Sync findings](findings.md#sync-01--capacity-rules-and-error-outcomes-disagree) · [Measured reliability](specialists/performance-engineer.md)

## Verification at a glance

The clean archive passed **170 Node tests**, the Worker build and syntax check. The targeted subsets in specialist reports are checks on the same suite, with additional local browser and fixture probes. Chromium covered native audio, import, collection navigation, keyboard focus and sync conflicts. Three existing browser scripts stopped at stale selectors. Two completed after temporary adaptations. One adapted sync script remained incomplete, and current native seek and ZIP checks passed independently. The audit has no evidence of production access controls, live streaming, physical-device permission behavior or hosted migration success. The app, schema, tests and dependencies remain at the audited revision.

## Consolidated reports

| Report | What it contains |
| --- | --- |
| [Baseline and verification log](baseline.md) | Git, runtime, build, test and named-role discovery evidence |
| [Native agent execution ledger](orchestration.md) | Actual task IDs, wave schedule, status and follow-ups |
| [Architecture assessment](architecture.md) | Current architecture, state ownership and bounded target changes |
| [Consolidated findings](findings.md) | Deduplicated severity, evidence, remedies, regression and independent status |
| [Product and engineering scorecard](scorecard.md) | Sixteen areas, rationale, confidence and improvement criteria |
| [Root causes](root-causes.md) | Shared causes, dependencies and design trade-offs |
| [Remediation roadmap](roadmap.md) | Order of work, owners, effort, dependencies and validation gates |
| [Preserve, improve and consolidate](product-disposition.md) | Feature and architecture decisions |
| [Future development standards](../../engineering/quality-standards.md) | Shared acceptance and release rules |

## Specialist reports

| Role | Report |
| --- | --- |
| Software Architect | [Architecture and technical debt](specialists/software-architect.md) |
| Playback Engineer | [Playback and transcript processing](specialists/playback-engineer.md) |
| UX Specialist | [UX, accessibility and inspected views](specialists/ux-specialist.md) |
| Security Engineer | [Security, dependency and privacy controls](specialists/security-engineer.md) |
| Data Engineer | [Data, media and synchronisation](specialists/data-engineer.md) |
| QA Engineer | [Functional coverage and test outcomes](specialists/qa-engineer.md) |
| Performance Engineer | [Measurements, resource usage and reliability](specialists/performance-engineer.md) |
| Product Strategist | [Learning journeys and feature value](specialists/product-strategist.md) |
| Independent Reviewer | [Independent decisions and residual uncertainty](specialists/independent-reviewer.md) |
