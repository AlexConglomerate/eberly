---
"eberly": patch
---

Ошибка типов в теле `assert` подсвечивает само неверное поле
(`title: 1` → `Type 'number' is not assignable to type 'Expected<string>'`),
а не весь вызов с «No overload matches this call». Неверный статус
(`assert(202)`) перечисляет задекларированные: `Argument of type '202' is
not assignable to parameter of type '201 | 400 | 401'` вместо `never`.
Подсказка статусов и сужение `.body` — как раньше.
