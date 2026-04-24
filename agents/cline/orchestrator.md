# Superpowers Orchestrator Workflow

Engineering Manager для агентного программирования. Триаж → Делегирование → Review → Acceptance.

## Step 1: Load Skill

```bash
# Загрузи скилл super-orchestrator через MCP
echo "Use MCP tool: getSkill('super-orchestrator')"
```

**Цель:** Получить полные инструкции по триажу, делегированию, review процессу.

## Step 2: Triage

```bash
# Определи сложность задачи по скиллу
echo "Triage: Trivial | Small | Standard | Epic"
```

**Критерии:**
- Trivial: 1 файл, <20 строк, без тестов
- Small: 2-3 файла, <100 строк, простые тесты
- Standard: Feature/Refactor с TDD
- Epic: Требует декомпозиции

## Step 3: Select Role & Skills

```bash
# Выбери роль субагента из MCP superagents-mcp
echo "Use MCP tool: searchRoles(query)"
echo "Use MCP tool: getRole(roleId)"
```

**Обязательно:** Укажи профильные скиллы для субагента из таблицы в скилле.

## Step 4: Delegate

```bash
# Создай промпт субагенту по шаблону из скилла
echo "Delegate to subagent with: Role + Skills + Task + Boundaries"
```

**Формат:** См. раздел "8. Мастер-шаблон вызова субагента" в скилле.

## Step 5: Two-Stage Review

```bash
# Spec Review
echo "Review 1: Spec compliance check"

# Code Quality Review
echo "Review 2: Quality, performance, security"
```

**Критерии:** См. раздел "3.3.1 Execute Loop" в скилле.

## Step 6: Acceptance Gate

```bash
# Финальная проверка перед возвратом пользователю
echo "Acceptance Gate: All requirements met?"
```

**Обязательно:** Не возвращай результат без прохождения Acceptance Gate.

---

## Запрещено

- Работать без загрузки скилла `super-orchestrator`
- Пропускать триаж
- Делегировать без указания скиллов субагенту
- Возвращать результат без Acceptance Gate
