# Repository instructions for Codex

## Engineering team

- The main Codex session is the Engineering Lead. Use native Codex specialists for independent domain investigations and consequential reviews. Select only the roles the task needs, keep assignments bounded, and reserve a separate reviewer for consequential findings or changes.
- Select the mode from the [operating model](docs/engineering/agent-operating-model.md). Give delegates the mode, baseline, permissions, owned paths or services, required evidence and acceptance criteria. Agents share the checkout by default. The lead coordinates writes, delegation and integration.
- Strategic transformation and product discovery deliver evidence, alternatives and decisions for the owner. Keep experiments and prototypes outside production. Epic approval opens specification work. Obtain authority for application implementation, deployment and destructive actions.
- The owner has given standing authorisation to commit and push completed repository work. After verification, commit the task's changes, push to the agreed remote branch and confirm the remote commit. Leave unrelated changes out of the commit.
- The Principal Product Designer coordinates UX research, interaction, visual, mobile and design-system work through the lead. Reserve the Independent Design Critic for concept critique and the Independent Reviewer for consequential roadmap or implementation decisions.
- See [agent operating model](docs/engineering/agent-operating-model.md), [audit workflow](docs/engineering/audit-workflow.md) and [quality standards](docs/engineering/quality-standards.md) for the task contract, evidence rules and review gates. Use the project role instructions in `.codex/agents/` even when a host exposes only generic native subagents.

## Before changing the UI

- Read `DESIGN.md` and `spec.md` before modifying UI code. Read the relevant feature sections and `docs/PLAYER_DECISIONS.md`; the specification's confirmed updates override older compositions. Inspect affected source and reference images before choosing an approach.
- Preserve Echo Studio's existing audio-first visual direction and functionality. A polish request does not authorise replacing the product identity, rewriting playback or adding unrelated features.
- Apply relevant installed skills by reading their `SKILL.md`: `.agents/skills/frontend-design` for design work, `.agents/skills/web-design-guidelines` (including its bundled guidelines) for interface/accessibility reviews, and `.agents/skills/impeccable` for applicable review/refinement workflows. Project requirements and user instructions take precedence. Report unavailable skills rather than pretending to use them. Do not enable automatic hooks or send external messages without authorisation.

## Implementation discipline

- Prefer existing rendering helpers, reusable components and established CSS tokens. Inspect `src/style.css`, `src/player.css` and the final overrides in `src/mobile-player.css` together. Avoid accumulating conflicting override blocks or unnecessary dependencies.
- Reuse the existing vanilla JavaScript ESM, plain CSS, inline SVGs and Node workflow. Do not migrate to a framework, UI kit or new dependency to carry out routine design work. Keep playback, parsing and storage responsibilities in their existing modules and preserve the persistent media host.
- Apply the visual hierarchy and component/state contracts in `DESIGN.md` consistently. Distinguish implemented tokens from proposals: introduce a proposed token only as part of a scoped implementation, updating its usage and documentation together. Do not represent proposals as shipped behaviour.
- Review hierarchy, navigation, responsive reflow and accessibility before and after implementation. Prioritise resume/playback over management controls; assess long content, empty/error states, focus order, touch reachability and both themes. Use the latest reference direction without copying unrelated branding or controls.
- Keep changes small and within the requested scope. For a review-only request, report findings and a concrete plan before editing. For an implementation request, the requested scope is authorisation; do not repeatedly seek approval for routine implementation choices.
- Protect existing user changes. Use the existing checkout; do not create a Git worktree unless requested.
- Preserve playback state across navigation/minimise/expand, the 200 × 200 visible YouTube iframe, uploaded-audio source switching and offsets, and startup without autoplay. Do not extract YouTube media or add unlimited looping.
- Preserve Manual/Automatic/Continuous behavior, Next marking rules, dedicated mobile gestures, transcript formats and timing, IPA, phrase editing/regrouping/undo, filters, progress, collections and sync conflict handling. Keep playback logic in the existing engine/adapters rather than reimplementing it in presentation code.

## Required verification for UI changes

1. Start the actual local app from `/workspace/echo` with `npm start` or `node scripts/dev.mjs`. Reuse an existing working server where appropriate. Both commands use the disposable local database and audio store.
2. Inspect and test affected screens with Playwright, **mobile before desktop**. Start at 320 × 568 and 390 × 844; then cover tablet, desktop and relevant short landscape sizes. Check safe areas, text scaling, long phrases/titles and absence of horizontal overflow. Player controls must remain visible without page scrolling.
3. Exercise affected interactions: navigation, import, transport, queue, options, text/IPA, seeking, source switching and compact-player persistence as applicable. Check loading, buffering, errors, empty states and both themes. Use deterministic fixtures without modifying personal or production data.
4. Capture fresh screenshots after visual changes and open/inspect them. Compare against `DESIGN.md`, current requirements and approved references; a screenshot saved without inspection is insufficient. Keep captures in an ignored or external artifact directory unless requested as deliverables.
5. After implementation changes, inspect `package.json` and repository/CI instructions and run the available relevant build, lint and test checks. Currently `npm test` runs Node tests and `npm run build` produces the Worker. No lint script is currently configured: report lint as unavailable, not passed; do not invent a lint command or add tooling merely to satisfy this instruction. Run relevant checks added by future project changes. Investigate failures. Do not equate a passing build, a PID, or mocked playback with successful real streaming.
6. Fix issues introduced by the change and identified in-scope visual/interaction problems, then recheck affected behavior and inspect fresh screenshots before declaring completion. Report unrelated defects and external blockers explicitly; do not silently expand scope or conceal unverified behavior.

Documentation-only edits need link/path and diff review, not a fabricated browser verification claim. If Playwright or another required check is unavailable, diagnose it, complete independent checks, and state the precise limitation; do not claim the UI was verified.

## Completion report

State what changed, which screens/interactions and viewport sizes were actually checked, test results, and remaining issues. Distinguish mocked playback from real YouTube/audio playback, local development from production hosting, and screenshots inspected now from historical references. Do not declare the task complete while fixable in-scope issues remain.

Never claim visual verification unless a screenshot or rendered interface was actually inspected. State which surface, viewport, theme and state were observed. Reading CSS, running tests, generating an unopened screenshot, or inspecting a historical reference does not verify the current UI. Documentation-only work may report source/reference review, but must not imply a fresh application check.
