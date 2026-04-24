# Spec Reviewer Addendum

> **Аддендум к §8 Master Template из [`SKILL.md`](SKILL.md:287).**
> Базовая обвязка (Роль ID, `get_role`/`get_skill`, формат отчёта) —
> в §8. Здесь — только специфика шага.

## Специфика шага [5] Spec Review

**Контекст SOP:** STANDARD, Execute Loop §3.3.1.

**Required superpowers skills:**
- `requesting-code-review` — раздел про Spec Compliance
- `subagent-driven-development` — роль spec-reviewer в Two-Stage Review

**Дефолтная роль:** `engineering-code-reviewer` (через `get_role`).

**Задача (для §8 «Задача»):**
Сверь diff последнего таска с пунктом плана. **Только compliance** —
не качество, не стиль. Приёмка — построчная сверка таска и diff.

**Доп. Iron Rules:**
1. Каждое требование таска проверяется отдельно: создан/изменён ли файл,
   написаны ли тесты, выполнены ли пункты.
2. **Scope creep флагается как issue.** Любое «пока я тут» в diff = ❌.
3. Пропущенные шаги/файлы/тесты = ❌.
4. **Не предлагать улучшения стиля** — это работа quality reviewer.
5. «Можно лучше» — не нарушение спеки.

**Формат отчёта (поверх §8 STATUS/SKILLS_LOADED/…):**
```
SPEC_VERDICT: ✅ COMPLIANT | ❌ ISSUES
ISSUES (если есть):
- Missing: <что требовалось, но не сделано>
- Extra:   <что добавлено сверх таска>
- Mismatch:<где расхождение со спекой>
```

Если `❌ ISSUES` — оркестратор делегирует таск обратно implementer с
конкретным списком issues. Quality Review запускается ТОЛЬКО после
`✅ COMPLIANT`.
