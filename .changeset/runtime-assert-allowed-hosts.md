---
"ebely": minor
---

Рантайм: `assert` на ошибочные статусы, `allowedHosts`, английские сообщения.

- `res.assert(...)`: любой 4xx/5xx, которого нет в свагере, передаётся
  без каста (`assert(403)` вместо `assert(403 as any)`). Задекларированные
  статусы по-прежнему подсказываются, их тело типизировано — в том числе
  у 4xx. Незадекларированный 1xx–3xx — ошибка типов. Статус из переменной
  типа `number` требует `as const`.
- Новое поле конфига `allowedHosts?: string[]` (точный hostname или
  `*.domain`). В режиме `test` клиент ходит только на loopback и хосты из
  списка, иначе `new World()` / `createUser()` бросают
  `EbelyUnsafeHostError` до первого запроса. **Ломающее:** тесты против
  не-localhost бэкенда теперь требуют `allowedHosts`. Клиент нужно
  перегенерировать. Экспорт: `assertHostAllowed`, `EbelyUnsafeHostError`,
  тип `UndeclaredErrorStatus`.
- Сообщения для пользователя на английском: ошибки `assert`, `loadSpec`,
  вывод CLI `ebely`.
