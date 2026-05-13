# Superpowers Orchestrator for Windsurf

## First Action

Load the `super-orchestrator` skill and follow it as the single source of truth
for triage, routes, roles, prompt contract and acceptance gate.

Do not redefine triage criteria or route rules in this Windsurf workflow.

## Windsurf Adapter Rules

Use Windsurf's available workflow/agent isolation if present. If the active
surface has no isolated subagent mechanism, execute delegated phases
sequentially in the current context and keep each phase narrow.

Parallel execution is allowed only when Windsurf provides isolated parallel
agents, tasks are independent, write scopes are disjoint, and
`dispatching-parallel-agents` has been loaded.

Every delegated task must include Role ID, required superpowers skill IDs,
boundaries, exact task text and report format. Never paste role or skill
contents into the prompt.
