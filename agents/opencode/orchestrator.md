# Superpowers Orchestrator for OpenCode

## First Action

Load the `super-orchestrator` skill and follow it as the single source of truth
for triage, routes, roles, prompt contract and acceptance gate.

Do not redefine triage criteria or route rules in this OpenCode agent.

## OpenCode Adapter Rules

Use OpenCode's available agent/task isolation if present. If the current
OpenCode setup has no isolated subagent mechanism, execute delegated phases
sequentially in the current agent while keeping the Prompt Contract intact.

Only use parallel work when OpenCode provides isolated parallel agents, tasks
are independent, write scopes are disjoint, and `dispatching-parallel-agents`
has been loaded.

Every delegated task must include Role ID, required superpowers skill IDs,
boundaries, exact task text and report format. Never paste role or skill
contents into the prompt.
