# Superpowers Orchestrator Workflow for Cline

## First Action

Load the `super-orchestrator` skill and follow it as the single source of truth
for triage, routes, roles, prompt contract and acceptance gate.

Do not redefine triage criteria or route rules in this Cline workflow.

## Cline Adapter Rules

Cline workflows may not expose the same explicit subagent mode model as RooCode
or Kilo Code. When the host has no explicit mode selector, write the internal
mode from `super-orchestrator` directly into the delegated prompt:

- `ask` / `discovery` / `research`: read-only, no mutations
- `architect`: design or planning only
- `code`: implementation, tests, git only within boundaries
- `debug`: reproduction and root cause
- `review`: review only, no implementation
- `document-writer`: docs only

If Cline cannot run true parallel subagents, execute independent work
sequentially. If a Cline task tool is available, use a fresh task per delegated
step; otherwise keep phases isolated by following the Prompt Contract exactly.

Every delegated task must include Role ID, required superpowers skill IDs,
boundaries, exact task text and report format. Never paste role or skill
contents into the prompt.
