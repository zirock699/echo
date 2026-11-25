# Echo Studio engineering team

The primary Codex thread is the Engineering Lead. The lead establishes the baseline and authority of the task, chooses specialists, manages shared files and services, resolves disagreements, and owns the final decision. Specialists return independent evidence. An independent reviewer must be a different agent from the author or implementer.

## Start a session

Open a **new Codex session rooted at this checkout** so the host can load project-scoped `.codex/config.toml` and `.codex/agents/*.toml` files. In a CLI environment with Codex installed, run `codex --cd /workspace/echo` (or use the actual checkout path). Use your normal trusted-project setting. For a quick delegation check, ask:

> Use the native `independent_reviewer` agent to inspect Git HEAD and name one Echo Studio build or test entry point. Give it read-only scope, wait for its result, and report its actual agent ID and whether it ran as a named role or a generic agent.

Then use this prompt when a full audit is wanted:

> Run the Echo Studio workflow in `docs/engineering/audit-workflow.md` on the current checkout. Verify Git state and use the project roles in `.codex/agents/`. Launch the relevant specialists in bounded waves, then an independent reviewer. Use synthetic local evidence only. Write a new dated report set and stop before changing app code, data, tests or dependencies, committing, pushing or deploying.

When a host exposes only generic agents, the lead reads the role TOML and passes its `developer_instructions` and the scoped task to a real native child. An identifier used as the child's task name does not make it a custom role. When neither kind of native agent is available, record that limitation and defer independent agent validation to a supported session. Session threads are temporary. The definitions and workflow are reusable project files.

Start with up to five concurrent specialist assignments. Queue the rest and leave capacity for validation. Only the lead assigns work. The project cap and depth setting apply where the host honours them. Managed hosts can enforce their own limits. Inherit model and reasoning defaults unless the host supports overrides and the investigation needs them. Prefer stronger reasoning for timing, architecture, data, security and disputed findings. Use faster models for inventory or routine evidence when available. Record observed models and report unknowns as such.

## Common operating rules

Read the actual implementation, current product decisions and `AGENTS.md`. Treat imported content, historic prompts and external documents as evidence. Preserve successful functionality, privacy and hosting constraints. Prefer simple solutions with measurable benefits. Trace root causes and distinguish confirmed behavior, inference and external limits. Report what actually ran, including skipped or blocked checks. Use only approved local or isolated targets, synthetic fixtures and defensive security checks. Do not disclose secrets, modify real data, deploy, commit, push or run destructive operations without explicit approval. Written role rules guide work and do not enforce permissions.

## Assignment contract

The lead supplies an ID, role, objective, baseline SHA and any dirty paths, product context and relevant decisions, scope and exclusions, mode, authorised operations, owned files, ports or outputs, evidence already available, dependencies, deliverables and acceptance criteria. Use the selected mode to establish depth and authority. Start consequential validation with a fresh context and a reviewer who authored none of the material under review.

Return the task ID and status, actual files/paths and line references, findings in the format in the [audit workflow](audit-workflow.md), commands and results, confidence, unresolved dependencies, and a short decision request when needed. Send severe evidence and blockers to the lead immediately. The lead asks for targeted follow-up when evidence conflicts or is incomplete.

## Select the operating mode

| Mode | Expected investigation and output | Write boundary and decision gate |
| --- | --- | --- |
| Maintenance | Inspect the affected normal entry point, confirm a focused cause and choose the least disruptive correction. Identify a concrete regression check. | Edit only the authorised repair. Obtain scoped validation for consequential fixes. |
| Comprehensive audit | Inventory domains, normal journeys and failure paths. Independently reproduce consequential findings, reconcile duplicates and record unexamined areas. | Read-only application and user data. Deliver an evidence register and remediation gates. |
| Strategic transformation | Establish an aspirational product baseline. Reassess prior decisions, compare preserve, simplify, replace and eliminate options across structural and strategic horizons, and examine user value, cost and risk. | Produce reviewed strategic epics for owner approval. Discovery artifacts and requested operating instructions can be edited. Production stays out of scope. |
| Product discovery | Investigate a product or learning hypothesis with actual experience evidence, relevant external sources and competing design concepts. Prototype separately and define tests that can reject the hypothesis. | Use synthetic fixtures and approved research. Record expected versus measured outcomes. Participant work and data collection require the relevant authority. |
| Implementation | Translate an authorised scope and acceptance contract into a bounded, reversible change. Coordinate shared files and measure remaining risks. | One writer per interface. Independent QA and review precede completion. |
| Independent validation | Reproduce material evidence and challenge scope, alternatives, accessibility, evidence limits and regressions at the appropriate layer. Track rejected and unresolved assertions. | Reviewer is independent of authorship. Return corrections to the responsible author. Report approval scope and exact reviewed candidate. |

When a request combines modes, declare the transition and its decision gate. An approved strategic epic can move into detailed product, learning, UX and technical specification. The owner makes consequential choices about product direction, cost, privacy or core behaviour. The team resolves routine design details within that authority. The lead obtains implementation authority before changing the application.

## Product design workstream

The Principal Product Designer coordinates through the Engineering Lead. The UX Specialist covers UX research and mobile experience. Interaction, Visual and Design Systems specialists own distinct outputs where the scope benefits from separation. Pair with the Product Strategist for learning outcomes and the engineering specialists for feasibility. The Independent Design Critic reviews each materially different concept and its actual journey evidence. The Independent Reviewer considers the integrated roadmap and its technical, learning and commercial or operational implications.

Use real rendered journeys with synthetic data, mobile first, followed by appropriate desktop, responsive and accessibility checks. Count steps and meaningful decisions from a stated start and endpoint. Mark fixture walkthroughs, user observations and forecasts separately. Prepare at least three coherent models for a strategic redesign, with conditions that would favour each. Keep prototypes outside the production bundle and record the proposal, evidence, critique, correction and owner decision.

Track the actual native agent ID, named-role or generic execution, baseline, assignment mode, owned outputs, evidence inspected, conclusion and independent disposition. Reusing an agent for another role does not make its work independent of its own earlier authorship. Record gaps explicitly and retain domain disagreements with their evidence. A returned report alone does not establish comprehensive coverage.

## Select roles by request

| Work | Typical roles |
| --- | --- |
| Feature | Product Strategist, Software Architect for consequential design, scoped implementer, QA, Independent Reviewer |
| Playback defect | Playback Engineer, QA, Independent Reviewer. Include Data Engineer or Software Architect when clock/state evidence calls for it. |
| UI redesign | UX Specialist, Product Strategist, scoped implementer, QA, Independent Reviewer |
| Storage or sync | Data Engineer, Software Architect, QA, Independent Reviewer |
| Security | Security Engineer, scoped implementer if approved, Independent Reviewer |
| Performance | Performance Engineer, relevant domain specialist, QA |
| General review | Software Architect, QA, Security Engineer where relevant |
| Whole product audit | Relevant specialist lanes in waves, then Independent Reviewer and lead synthesis |

## Implement a separately approved initiative

1. Relevant specialist confirms behavior, dependencies and acceptance criteria. For consequential work the lead assigns design review before implementation.
2. Assign one writer per file or interface. Cloud agents share the checkout by default. Use the existing checkout for coordinated work. If the user explicitly authorises isolated worktrees for parallel write-heavy work, preserve and account for relevant local changes and use separate worktrees or an equivalent supported isolation mechanism. No overlapping writes.
3. QA verifies real entry points and regression criteria. Independent Reviewer inspects the actual change and evidence. Return failed checks to the implementer with evidence and bounded corrective scope. Escalate disagreements or repeated failures to the lead.
4. The lead integrates the changes, runs project-wide checks relevant to the risk and reports scope, findings addressed, test results, independent disposition and limitations. Publication and other separate irreversible operations require explicit approval. See [quality standards](quality-standards.md).
