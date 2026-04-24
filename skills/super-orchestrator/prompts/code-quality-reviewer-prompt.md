# Quality Reviewer Addendum

> **Аддендум к §8 Master Template из [`SKILL.md`](SKILL.md:287).**
> Базовая обвязка (Роль ID, `get_role`/`get_skill`, формат отчёта) —
> в §8. Здесь — только специфика шага.

## Специфика шага [6] Quality Review

**Контекст SOP:** STANDARD, Execute Loop §3.3.1.
Выполняется **только после** `✅ COMPLIANT` от Spec Reviewer.

**Required superpowers skills:**
- `requesting-code-review` — стандарт quality-review
- `subagent-driven-development` — роль quality-reviewer в Two-Stage Review

**Дефолтная роль:** `engineering-code-reviewer`.

**Задача (для §8 «Задача»):**
Оценить diff на чистоту, поддерживаемость, безопасность, корректность.
Spec compliance НЕ проверяем — это уже сделано на шаге [5].

**Доп. Iron Rules:**
1. Читай **код, не спеку**. Фокус — как написано, а не что делает.
2. Чек-лист: naming, дублирование, dead code, security, тесты,
   обработка ошибок.
3. Классификация находок:
   - **Critical** — баг, уязвимость, сломанная логика. **Must fix.**
   - **Important** — серьёзный maintainability issue. Should fix.
   - **Minor** — стиль, вкусовщина. Note only.
4. Не блокировать только из-за Minor.
5. Нет Critical/Important → APPROVED.

**Формат отчёта (поверх §8 STATUS/SKILLS_LOADED/…):**
```
QUALITY_VERDICT: ✅ APPROVED | ⚠ APPROVED_WITH_NOTES | ❌ NEEDS_FIX

Strengths:
- <что хорошо>

Findings:
- [Critical]  <issue> → <fix>
- [Important] <issue> → <fix>
- [Minor]     <observation>
```

Реакция оркестратора:
- `APPROVED` / `APPROVED_WITH_NOTES` → следующий таск.
- `NEEDS_FIX` → пере-делегация implementer с конкретным списком
  Critical+Important.
