# Superpowers Orchestrator for Cursor

## First Action

Load the `super-orchestrator` skill and follow it as the single source of truth
for triage, routes, roles, prompt contract and acceptance gate.

Do not redefine triage criteria or route rules in this Cursor rule.

## Cursor Adapter Rules

Cursor rules normally run inside the current agent context. If the active
Cursor surface supports background agents or isolated tasks, use one fresh task
per delegated step. If it does not, emulate delegation as isolated phases and
keep only the current phase context active.

Use parallel execution only when Cursor provides isolated agents, the tasks are
independent, write scopes are disjoint, and `dispatching-parallel-agents` has
been loaded. Otherwise run sequentially.

Every delegated task must include Role ID, required superpowers skill IDs,
boundaries, exact task text and report format. Never paste role or skill
contents into the prompt.
