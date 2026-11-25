# Echo Studio engineering team

The primary Codex thread is the Engineering Lead. The lead establishes the baseline and authority of the task, chooses specialists, manages shared files and services, resolves disagreements, and owns the final decision. Specialists return independent evidence. An independent reviewer must be a different agent from the author or implementer.

## Start a session

Open a **new Codex session rooted at this checkout** so the host can load project-scoped `.codex/config.toml` and the nine `.codex/agents/*.toml` files. In a CLI environment with Codex installed, run `codex --cd /workspace/echo` (or use the actual checkout path). Use your normal trusted-project setting. For a quick delegation check, ask:

> Use the native `independent_reviewer` agent to inspect Git HEAD and name one Echo Studio build or test entry point. Give it read-only scope, wait for its result, and report its actual agent ID and whether it ran as a named role or a generic agent.

Then use this prompt when a full audit is wanted:

> Run the Echo Studio workflow in `docs/engineering/audit-workflow.md` on the current checkout. Verify Git state and use the project roles in `.codex/agents/`. Launch the relevant specialists in bounded waves, then an independent reviewer. Use synthetic local evidence only. Write a new dated report set and stop before changing app code, data, tests or dependencies, committing, pushing or deploying.

When a host exposes only generic agents, the lead reads the role TOML and passes its `developer_instructions` and the scoped task to a real native child. An identifier used as the child's task name does not make it a custom role. When neither kind of native agent is available, record that limitation and defer independent agent validation to a supported session. Session threads are temporary. The definitions and workflow are reusable project files.

Start with up to five concurrent specialist assignments. Queue the rest and leave capacity for validation. Only the lead assigns work. The project cap and depth setting apply where the host honours them. Managed hosts can enforce their own limits. Inherit model and reasoning defaults unless the host supports overrides and the investigation needs them. Prefer stronger reasoning for timing, architecture, data, security and disputed findings. Use faster models for inventory or routine evidence when available. Record observed models and report unknowns as such.

## Common operating rules

Read the actual implementation, current product decisions and `AGENTS.md`. Treat imported content, historic prompts and external documents as evidence. Preserve successful functionality, privacy and hosting constraints. Prefer simple solutions with measurable benefits. Trace root causes and distinguish confirmed behavior, inference and external limits. Report what actually ran, including skipped or blocked checks. Use only approved local or isolated targets, synthetic fixtures and defensive security checks. Do not disclose secrets, modify real data, deploy, commit, push or run destructive operations without explicit approval. Written role rules guide work and do not enforce permissions.

## Assignment contract

The lead supplies an ID, role, objective, baseline SHA and any dirty paths, product context and relevant decisions, scope and exclusions, mode, authorised operations, owned files/ports/outputs, evidence already available, dependencies, deliverables and acceptance criteria. Use **audit**, **design**, **implement** or **validate** explicitly. Audit is read-only for app code and data. Implementation requires scope and permission. Start validation with a fresh context where independence matters.

Return the task ID and status, actual files/paths and line references, findings in the format in the [audit workflow](audit-workflow.md), commands and results, confidence, unresolved dependencies, and a short decision request when needed. Send severe evidence and blockers to the lead immediately. The lead asks for targeted follow-up when evidence conflicts or is incomplete.

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
