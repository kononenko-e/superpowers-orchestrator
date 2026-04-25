# Windsurf Workflow — Superpowers Orchestrator

## Setup

The installer automatically configures Windsurf by:
1. Adding MCP server configuration to `~/.codeium/windsurf/mcp_config.json`
2. Installing the orchestrator workflow to `~/.codeium/windsurf/global_workflows`
3. Skills `super-orchestrator` and `caveman` are installed globally and are already visible

## Manual Setup (if needed)

If you need to manually configure Windsurf:

### MCP Server Configuration

Add this to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "superagents-mcp": {
      "command": "superagents-mcp",
      "args": [],
      "env": {
        "SUPERPOWERS_ROLES_PATH": "~/.superpowers-orchestrator/roles",
        "SUPERPOWERS_SKILLS_PATH": "~/.superpowers-orchestrator/skills/behavioral"
      }
    }
  }
}
```

### Orchestrator Workflow

The workflow file should be in `~/.codeium/windsurf/global_workflows/.windsurfrules`:

```markdown
# Superpowers Orchestrator

Engineering Manager для агентного программирования.

## Первое действие

При получении задачи **ОБЯЗАТЕЛЬНО** загрузи скилл `super-orchestrator`.

## Следуй скиллу

После загрузки скилла следуй **всем** инструкциям из него:

- Триаж сложности (Trivial/Small/Standard/Epic)
- Выбор роли субагента
- Делегирование с загрузкой профильных скиллов
- Two-Stage Review (Spec Review → Code Quality Review)
- Acceptance Gate перед возвратом пользователю

## Запрещено

- Работать без загрузки скилла `super-orchestrator`
- Пропускать триаж
- Делегировать без указания скиллов субагенту
- Возвращать результат без Acceptance Gate
```

## System Prompt (for reference)

When using the orchestrator mode in Windsurf, the agent should:

1. **Load the skill** `super-orchestrator` from `~/.agents/skills/super-orchestrator/SKILL.md`
2. **Follow the SOP** from this skill strictly
3. **Don't write code yourself** — only triage, decomposition, delegation through `new_task`
4. **For code mode** always specify `Skill: caveman`
5. **Pass roles only through MCP server** `superagents-mcp`, never as text

### Iron Laws

- NO PROD CODE WITHOUT FAILING TEST FIRST
- NO FIX WITHOUT ROOT CAUSE
- NO COMPLETION WITHOUT EVIDENCE
- ROLE BY MCP, NEVER BY TEXT
- ONE TASK AT A TIME
- CONTEXT HYGIENE
- TRIAGE FIRST, PROCESS SECOND

### MCP Server

Ensure that the MCP server `superagents-mcp` is connected:
- Command: `superagents-mcp`
- Tools: `get_role`, `list_roles`, `search_roles`, `get_domains`

### Internal Modes

| Mode | Purpose | Default Role |
|------|----------|--------------|
| `brainstorm` | Discussing alternatives | `product-manager` |
| `architect` | Specification, planning | `engineering-software-architect` |
| `code` | Writing code | context-dependent |
| `debug` | Debugging | `engineering-sre` |
| `review` | Code review | `engineering-code-reviewer` |
| `document-writer` | Documentation | `engineering-technical-writer` |
| `ask` | Research | `product-trend-researcher` |

## Verification

After setup, send a test request: "Создай простой React компонент кнопки".
The orchestrator should:
1. Declare Triage (Small)
2. Create a todo list
3. Delegate through `new_task` with role specification
