# Superpowers Orchestrator — Архитектура

> Версия: 1.0  
> Дата: 2026-04-24  
> Статус: Draft для утверждения

---

## 1. Цель системы

Система агентной разработки, в которой **главный агент-оркестратор** получает задачу пользователя, выполняет триаж, декомпозицию и последовательно делегирует подзадачи субагентам. Каждый субагент получает ID роли через MCP-сервер `superagents-mcp`, загружает свою персону и выполняет задачу по SOP.

Поддерживаемые среды: Cline, RooCode.

---

## 2. Репозиторий

```
superpowers-orchestrator/
├── README.md                          # Общее описание + quick start
├── package.json                       # Node.js проект MCP-сервера
├── tsconfig.json
├── install.js                         # Кроссплатформенный установщик
├── update.js                          # Обновление ролей и скиллов из репо
├── src/
│   ├── index.ts                       # Entry point — stdio MCP server
│   ├── server.ts                      # Инициализация MCP (FastMcp / @modelcontextprotocol/sdk)
│   ├── tools/
│   │   ├── getRole.ts                 # get_role(role_id)
│   │   ├── listRoles.ts               # list_roles(filter?, domain?, tags?)
│   │   ├── searchRoles.ts             # search_roles(query)
│   │   └── getRoleDomains.ts          # get_domains() — список доменов
│   ├── utils/
│   │   ├── roleParser.ts              # Парсер YAML frontmatter + markdown body
│   │   ├── indexBuilder.ts            # Сканер roles/ → индекс в памяти
│   │   └── config.ts                  # Пути, env vars
│   └── types/
│       └── role.ts                    # TypeScript типы Role, RoleMeta
├── roles/                             # 162+ ролей (YAML frontmatter + MD)
│   ├── engineering-frontend-developer.md
│   ├── product-manager.md
│   ├── agents-orchestrator.md
│   └── ...
├── skills/
│   ├── superpowers-orchestrator/
│   │   ├── SKILL.md                   # Основной скилл оркестратора
│   │   └── README.md
│   └── caveman/
│       ├── SKILL.md                   # Caveman skill для code-режима
│       └── README.md
└── workflows/                         # Инструкции по настройке IDE
    ├── cline.md
    └── roocode.md
```

---

## 3. MCP Server `superagents-mcp`

### 3.1 Транспорт

`stdio` — единственный транспорт. Запускается каждым IDE по мере необходимости.

### 3.2 Команда запуска

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

### 3.3 Инструменты

| Tool | Input | Output | Описание |
|------|-------|--------|----------|
| `get_role` | `role_id: string` | `{ id, name, description, domains, tags, content }` | Полная роль с YAML frontmatter и markdown content |
| `list_roles` | `filter?: string, domain?: string, tags?: string[]` | `{ roles: RoleMeta[], count }` | Лёгкий индекс без `content` |
| `search_roles` | `query: string` | `{ roles: RoleMeta[], count }` | Поиск по `id`, `name`, `description`. Регистронезависимый, подстрока |
| `get_domains` | — | `{ domains: string[] }` | Список уникальных доменов (engineering, testing, design, game, marketing...) |

### 3.4 Ресурсы (MCP Resources)

| URI | Тип | Описание |
|-----|-----|----------|
| `roles://index` | `application/json` | Полный индекс всех ролей (метаданные) |
| `roles://{role_id}` | `text/markdown` | Конкретная роль |

### 3.5 Формат файла роли

Каждая роль — отдельный `.md` файл с YAML frontmatter:

```markdown
---
id: engineering-frontend-developer
name: Frontend Developer
description: UI-реализация, web-компоненты, state management.
domains:
  - engineering
  - frontend
tags:
  - react
  - typescript
  - ui
version: "1.0"
---

# Frontend Developer

> Ты — опытный Frontend-разработчик...

## Обязанности
...
```

Парсер (`roleParser.ts`) разбивает файл на `frontmatter` (YAML) и `content` (всё после `---`).

### 3.6 Индексация

При старте сервера:
1. `indexBuilder.ts` рекурсивно сканирует `$SUPERPOWERS_ROLES_PATH` (default: `~/.superpowers-orchestrator/roles`)
2. Парсит каждый `.md` файл → `RoleMeta`
3. Хранит в памяти `Map<string, Role>` и `RoleMeta[]`
4. Перечитывает при сигнале `SIGHUP` или по флагу `--reload`

---

## 4. Flow работы оркестратора

### 4.1 Подготовка сессии (один раз)

1. Пользователь прописывает workflow из `workflows/{ide}.md` в настройки своей IDE (ручной шаг, установщик только показывает инструкцию)
2. Оркестратор (главный агент) загружает скилл `superpowers-orchestrator/SKILL.md` → контекст SOP
3. Оркестратор вызывает `list_roles()` → получает индекс ролей в память

### 4.2 Обработка задачи пользователя

```
USER REQUEST
   │
   ▼
TRIAGE (Trivial / Small / Standard / Epic)
   │
   ▼
ROUTE → выбор маршрута (Fast-Path / Short-Path / Full SOP / Epic)
   │
   ▼
Для каждого шага:
   ├─► MATCH ROLE: выбор роли из индекса по названию
   ├─► Собрать промпт по мастер-шаблону §7
   ├─► new_task → субагент
   │     Промпт содержит:
   │       - "Роль ID: <agent-id>"
   │       - "Первое действие: используй get_role(role_id='<agent-id>') из MCP-сервера superagents-mcp"
   │       - [mode=code] "Skill: caveman"
   │       - Контекст SOP, шаг, артефакты, задача, iron rules, границы, формат отчёта
   ├─► Субагент вызывает get_role() → получает персону → выполняет
   ├─► Acceptance Gate (STATUS / ARTIFACTS / EVIDENCE)
   ├─► Обновить todo
   └─► Следующий шаг
```

### 4.3 Внутренние режимы скилла (mode-agnostic)

Скилл определяет внутренние режимы — это **не** нативные режимы IDE, а концептуальные фазы работы оркестратора:

| Режим | Назначение | Кто выполняет | Дефолтная роль | Особенности промпта |
|-------|-----------|---------------|----------------|---------------------|
| `orchestrator` | Триаж, декомпозиция, делегирование | Главный агент | `agents-orchestrator` | Полный SOP, планирование |
| `brainstorm` | Обсуждение альтернатив, design approval | Субагент | `product-manager` | Вопросы и альтернативы |
| `architect` | Спецификация, планирование | Субагент | `engineering-software-architect` | Структура, ADR, trade-offs |
| `code` | Написание кода | Субагент | по контексту | **+ Skill: caveman**, TDD-цикл |
| `debug` | Отладка, root cause analysis | Субагент | `engineering-sre` | Phase 1–3 systematic debugging |
| `review` | Code review | Субагент | `engineering-code-reviewer` | Two-stage review |
| `document-writer` | Документация | Субагент | `engineering-technical-writer` | Без caveman |
| `ask` | Исследование, только чтение | Субагент | `product-trend-researcher` | Границы: никаких изменений |

**Важно:** Режим — это внутренняя классификация скилла. Оркестратор передаёт в `new_task` соответствующий промпт с указанием роли, независимо от поддержки режимов в IDE.

### 4.4 Промпт-шаблон `new_task` (мастер-шаблон §7)

```markdown
Роль ID: <agent-id>
Первое действие: используй инструмент `get_role(role_id="<agent-id>")` из MCP-сервера `superagents-mcp`, чтобы получить свою инструкцию, и прими эту персону.

[Только для режима code:]
Skill: caveman — ответы максимально сжатые, код полный.

Контекст SOP: <FAST-PATH | SHORT-PATH | STANDARD | EPIC | BUGFIX | REFACTOR | DOCS | RESEARCH>
Режим: <orchestrator | brainstorm | architect | code | debug | review | document-writer | ask>
Шаг: <N> из <M>.

Артефакты входа:
- Spec: <path или —>
- Plan: <path или —>
- Предыдущий отчёт: <2–3 строки сути>

Задача:
<точный, императивный текст; для Execute — полный текст одного таска из плана>

Iron rules для этого шага:
- <TDD / Root cause first / No scope creep / только указанные файлы / …>

Границы:
- Разрешено читать: <whitelist путей>
- Разрешено менять: <whitelist путей>
- Запрещено трогать: <blacklist или «всё остальное»>

Формат отчёта (обязателен):
STATUS: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
ARTIFACTS: <файлы/пути>
EVIDENCE: <команды + ключевые строки вывода (RED/GREEN, exit 0)>
NEXT: <что логично следующим шагом, по мнению субагента>
```

---

## 5. Установка и обновление

### 5.1 Установка (одна команда)

```bash
npx superpowers-orchestrator install
```

**Что делает `install.js`:**

1. **Проверка окружения**
   - Node.js ≥ 18
   - OS: macOS / Linux / Windows (PowerShell)

2. **Клонирование / распаковка**
   - Клонирует репозиторий в `~/.superpowers-orchestrator/`
   - Или распаковывает tarball (для `npx`)

3. **Сборка MCP-сервера**
   - `cd ~/.superpowers-orchestrator && npm install && npm run build`

4. **CLI-обёртка**
   - Создаёт исполняемый скрипт `superagents-mcp` в PATH:
     - macOS/Linux: `~/.local/bin/superagents-mcp` (или `/usr/local/bin`)
     - Windows: `%LOCALAPPDATA%\superpowers-orchestrator\superagents-mcp.cmd`

5. **Автоконфигурация MCP в IDE**
   - **Cline**: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
   - **RooCode**: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json` глобально
   - Добавляет блок:
     ```json
     {
       "superagents-mcp": {
         "command": "superagents-mcp",
         "args": [],
         "env": {
           "SUPERPOWERS_ROLES_PATH": "~/.superpowers-orchestrator/roles"
         }
       }
     }
     ```

6. **Установка скиллов**
   - Копирует `skills/superpowers-orchestrator/` → `~/.agents/skills/superpowers-orchestrator/`
   - Копирует `skills/caveman/` → `~/.agents/skills/caveman/`

7. **Роли**
   - Роли остаются в `~/.superpowers-orchestrator/roles/` (сервер читает оттуда)

8. **Инструкция пользователю**
   - Выводит цветной текст: "Пропиши workflow в свою IDE:"
   - Показывает путь к `workflows/cline.md` или `workflows/roocode.md` (в зависимости от обнаруженной IDE)

### 5.2 Обновление

```bash
superagents-mcp --update
# или
npx superpowers-orchestrator update
```

**Что делает `update.js`:**
1. `git pull` в `~/.superpowers-orchestrator/`
2. `npm install && npm run build`
3. Пересоздаёт индекс ролей (сервер перечитает при следующем старте)
4. Синхронизирует скиллы в `~/.agents/skills/`

---

## 6. Интеграция с IDE

### 6.1 Cline

**Настройка MCP:** Авто (через `install.js`)

**Настройка оркестратора (ручная):**
- Settings → Custom Instructions → вставить содержимое `workflows/cline.md`:
  ```markdown
  При получении любой задачи от пользователя:
  1. Загрузи скилл `superpowers-orchestrator` из `~/.agents/skills/superpowers-orchestrator/SKILL.md`
  2. Следуй SOP из этого скилла строго
  3. Не пиши код сам — только триаж, декомпозиция, делегирование через new_task
  4. Для code-режима всегда указывай `Skill: caveman`
  5. Роли передавай только через MCP-сервер `superagents-mcp`, никогда текстом
  ```

### 6.2 RooCode

**Настройка MCP:** Авто (через `install.js`)

**Настройка оркестратора:**
- Создать Custom Mode `superpowers-orchestrator` в `.roo/rules/` или через UI:
  ```yaml
  mode: orchestrator
  system_prompt: |
    Ты — Engineering Manager. Загрузи скилл superpowers-orchestrator...
  ```

---

## 7. Изменения в существующем скилле `superpowers-orchestrator`

### 7.1 Убираем встроенный AGENTS_INDEX_INLINE

> **§4.1 Источник истины (новая версия):**
> Индекс ролей загружается через MCP-сервер `superagents-mcp` при старте сессии. Вызови `list_roles()` один раз и используй результат для матчинга.

### 7.2 Алгоритм матчинга

> **§4.2 Алгоритм матчинга (новая версия):**
> ```
> 1. Извлеки из задачи 2–4 ключевых концепта.
> 2. Вызови `list_roles()` из MCP-сервера `superagents-mcp` и получи полный индекс.
> 3. Найди в индексе роли по названию (id / name / description) вручную, используя свои знания о ролях.
> 4. Выбери подходящую роль по названию и назначении. При сомнении — выбирай самую специфичную (узкий домен > общий).
> 5. Если подходящей роли нет — используй дефолт из §4.3 и сообщи пользователю одной строкой.
> ```
> 
> **Принцип:** Оркестратор принимает решение по роли самостоятельно, основываясь на названиях и описаниях ролей из индекса. `search_roles()` может использоваться как вспомогательный инструмент, но финальный выбор — осознанное решение оркестратора.

### 7.3 Обновляем Iron Law 4

> **Iron Law 4:** `ROLE BY MCP, NEVER BY TEXT.` Делегируешь — передаёшь `id` роли. Субагент обязан загрузить её через `get_role` из MCP-сервера `superagents-mcp`. Текст роли в промпт не копируешь.

### 7.4 Добавляем режимы в скилл

Добавить секцию «Внутренние режимы оркестратора» с таблицей из §4.3, чтобы оркестратор знал, какой промпт и какую роль использовать для каждой фазы.

### 7.5 Обновляем мастер-шаблон

Добавить поле `Режим:` в мастер-шаблон §7.

---

## 8. Технологический стек

| Компонент | Технология |
|-----------|-----------|
| MCP-сервер | Node.js 18+, TypeScript |
| MCP SDK | `@modelcontextprotocol/sdk` |
| YAML парсер | `yaml` или `js-yaml` |
| CLI | Нативный Node.js (`#!/usr/bin/env node`) |
| Сборка | `tsc` |
| Установщик | Node.js script (`install.js`) |

---

## 9. Безопасность и изоляция

- MCP-сервер работает **только локально**, stdio, нет сетевых портов
- Читает только из `SUPERPOWERS_ROLES_PATH` — файловая система read-only для ролей
- Не выполняет произвольный код
- Не хранит состояние между сессиями

---

## 10. Roadmap (MVP → v1.0)

### MVP (сейчас)
- [ ] MCP-сервер с `get_role`, `list_roles`, `search_roles`
- [ ] Установщик `install.js` (macOS/Linux)
- [ ] Автоконфиг Cline
- [ ] Обновлённый скилл `superpowers-orchestrator`
- [ ] Скилл `caveman`
- [ ] Workflow-инструкции для Cline и RooCode

### v1.0
- [ ] Поддержка Windows в установщике
- [ ] Автоконфиг RooCode (глобально)
- [ ] Команда `superagents-mcp --validate` — проверка целостности ролей
- [ ] Версионирование ролей (semver в YAML frontmatter)
- [ ] Фильтрация ролей по `domains` и `tags`

### v1.1
- [ ] Интеграция с GitHub MCP для автоматического создания issues/PR из оркестратора
- [ ] Web-dashboard для просмотра ролей (локальный)
- [ ] Плагин для VS Code (UI для оркестратора)

---

## 11. Решённые вопросы

1. **SDK:** `@modelcontextprotocol/sdk`
2. **Watch-режим:** не нужен
3. **Проверка конфликтов MCP:** не делаем
