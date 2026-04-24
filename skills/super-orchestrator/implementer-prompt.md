# Implementer Addendum

> **Это аддендум к §8 Master Template из [`SKILL.md`](SKILL.md:287).**
> Оркестратор сначала собирает базовый промпт по §8 (Роль ID, First actions
> №1/№2 для `get_role`/`get_skill`, Required superpowers skills, Границы,
> Формат отчёта), **потом** добавляет секции ниже. Здесь НЕ повторяем
> базовые правила (персона, загрузка скиллов, формат STATUS/…).

## Специфика шага [4] Execute

**Контекст SOP:** STANDARD, Execute Loop §3.3.1.

**Required superpowers skills (минимум; оркестратор подставляет в §8):**
- `subagent-driven-development` — роль implementer, цикл Two-Stage Review
- `test-driven-development` — Red-Green-Refactor
- `verification-before-completion` — не заявлять DONE без evidence
- `caveman` — токено-экономия (режим `code`)

**Доп. Iron Rules (добавить в раздел §8 «Iron rules»):**
1. TDD обязателен. RED → минимальный GREEN → commit. Нет теста — нет кода.
2. Границы файлов — whitelist. «Пока я тут» правок не делаем.
3. Commit per task step. Conventional Commits.
4. Self-review до отчёта: пропущенные edge cases, оставленный debug-код,
   типы.
5. Неясно что-то — `NEEDS_CONTEXT`, не угадывать.

**Доп. поля в EVIDENCE** (на случай, если базовый §8 их не требует явно):
- Команда запуска тестов.
- Финальные 2–5 строк вывода с PASS/FAIL и exit code.
- SHA коммита + subject.
