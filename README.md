# Superpowers Orchestrator

Система агентной разработки с субагентами, ролями и поведенческими скиллами. Оркестратор-агент получает задачу, классифицирует сложность, декомпозирует на подзадачи и последовательно делегирует специализированным субагентам — каждый из которых динамически загружает свою роль (персону) и набор скиллов (SOP) через MCP-сервер.

## Что внутри

- **120+ специализированных ролей** — engineering, design, marketing, testing, sales, game dev и другие домены. Каждая роль — готовая персона с инструкциями для AI-агента
- **Поведенческие скиллы** — TDD, systematic debugging, code review, parallel dispatch, verification before completion и другие стандартные операционные процедуры
- **Оркестратор (Engineering Manager)** — скилл, превращающий агента в лида: триаж задач (Trivial → Epic), декомпозиция, делегирование с обязательной загрузкой профильных скиллов субагентом
- **MCP-сервер** — stdio-сервер, отдающий роли и скиллы через [Model Context Protocol](https://modelcontextprotocol.io/). Совместим с Cline и RooCode
- **Автоматический установщик** — определяет IDE, копирует ресурсы, регистрирует MCP-сервер

## Быстрый старт

### Требования

- Node.js ≥ 18
- Cline или RooCode (VS Code)

### Установка

```bash
git clone https://github.com/kononenko/superpowers-orchestrator.git
cd superpowers-orchestrator
npm install
npm run build
node install.js
```

Установщик автоматически:
1. Копирует роли в `~/.superpowers-orchestrator/roles`
2. Копирует скиллы в `~/.superpowers-orchestrator/skills` и публичные — в `~/.agents/skills`
3. Регистрирует MCP-сервер `superagents-mcp` в настройках обнаруженной IDE

### Обновление

```bash
node update.js
```

### Ручная конфигурация MCP-клиента

Если установщик не обнаружил IDE, добавьте вручную в настройки MCP:

```json
{
  "mcpServers": {
    "superagents-mcp": {
      "command": "superagents-mcp",
      "args": [],
      "env": {
        "SUPERPOWERS_ROLES_PATH": "~/.superpowers-orchestrator/roles"
      }
    }
  }
}
```

Подробные инструкции: [workflows/cline.md](workflows/cline.md), [workflows/roocode.md](workflows/roocode.md).

## Как это работает

```
Пользователь → Оркестратор (Engineering Manager skill)
                    │
                    ├─ Триаж: Trivial / Small / Standard / Epic
                    ├─ Декомпозиция → TODO-цепочка
                    │
                    └─ Делегирование субагентам:
                         ├─ get_role("engineering-frontend-developer")  → персона
                         ├─ get_skill("test-driven-development")        → SOP
                         └─ субагент выполняет задачу по роли + скиллам
```

### Уровни триажа

| Уровень | Признаки | Маршрут |
|---------|----------|---------|
| **Trivial** | 1 файл, ≤30 строк, без новой логики | Fast-Path — один вызов code-субагента |
| **Small** | 1–3 файла, дизайн очевиден | Short-Path — code + review |
| **Standard** | Новая фича, несколько модулей, API | Full SOP — spec → plan → implement → review |
| **Epic** | >5 тасков, кросс-зависимости | Decompose & Loop |

## MCP Tools

| Tool | Параметры | Описание |
|------|-----------|----------|
| `get_role` | `role_id` | Полная роль с YAML frontmatter и markdown content |
| `list_roles` | `filter?`, `domain?`, `tags?` | Список ролей (метаданные, без content) |
| `search_roles` | `query` | Поиск по id, name, description (подстрока, регистронезависимый) |
| `get_domains` | — | Уникальные домены: engineering, testing, design, marketing… |
| `get_skill` | `skill_id` | Содержимое SKILL.md по идентификатору |
| `list_skills` | — | Список всех доступных скиллов |

## MCP Resources

| URI | MIME | Описание |
|-----|------|----------|
| `roles://index` | `application/json` | Полный индекс ролей (метаданные) |
| `roles://{role_id}` | `text/markdown` | Конкретная роль |

## Структура проекта

```
superpowers-orchestrator/
├── src/
│   ├── index.ts              # Entry point (stdio MCP server)
│   ├── server.ts             # Инициализация MCP, регистрация tools/resources
│   ├── tools/                # Реализация MCP tools
│   └── utils/                # Парсер ролей, индексатор, конфиг
├── roles/                    # 120+ ролей (YAML frontmatter + MD)
├── skills/
│   ├── behavioral/           # Поведенческие скиллы (TDD, debugging, review…)
│   ├── super-orchestrator/   # Скилл Engineering Manager оркестратора
│   └── caveman/              # Token-saving communication mode
├── workflows/                # Инструкции для Cline / RooCode
├── install.js                # Кроссплатформенный установщик
└── update.js                 # Обновление ролей и скиллов из репо
```

## Формат роли

Каждая роль — `.md` файл с YAML frontmatter:

```markdown
---
id: engineering-frontend-developer
name: Frontend Developer
description: Специалист по React/Next.js
domains: [engineering]
tags: [react, nextjs, typescript]
---

# Frontend Developer

Инструкции для агента...
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `SUPERPOWERS_ROLES_PATH` | `~/.superpowers-orchestrator/roles` | Путь к директории ролей |
| `SUPERPOWERS_SKILLS_PATH` | `~/.superpowers-orchestrator/skills` | Путь к директории скиллов |

## Разработка

```bash
npm run dev       # TypeScript watch mode
npm run build     # Сборка в dist/
npm start         # Запуск MCP-сервера
```

## Благодарности

Проект основан на работах:

- **[superpowers](https://github.com/obra/superpowers)** by [Jesse Vincent](https://github.com/obra) — архитектура скиллов, поведенческие паттерны и система оркестрации агентов (MIT License)
- **[agency-agents](https://github.com/msitarzewski/agency-agents)** by [Mike Sitarzewski](https://github.com/msitarzewski) — коллекция специализированных ролей для AI-агентов (MIT License)

## Лицензия

MIT
