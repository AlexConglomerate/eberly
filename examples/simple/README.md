# Пример: simple

Самостоятельный проект-пример использования библиотеки `ebely`.
Помечен `private: true` и вынесен в pnpm workspace `examples/*`, поэтому
**не попадает** в публикуемый npm-пакет (`files: ["dist"]`) и не утечёт
в `node_modules` тех, кто установит библиотеку.

## Запуск

Из корня репозитория установите зависимости (`pnpm install`) — workspace
сам слинкует `ebely` в этот пример.

```bash
pnpm --filter @ebely-examples/simple run backend:start    # тестовый бэкенд на :3000
pnpm --filter @ebely-examples/simple run client:generate  # сгенерировать src/world.ts из swagger
pnpm --filter @ebely-examples/simple run start            # запустить пример (src/index.ts)
```

## Что где

- `test-backend/` — игрушечный oRPC-бэкенд и его swagger-схема.
- `src/ebely.ts` — конфиг ebely (пути генерации, url, класс хранилища).
- `src/internalVariable.ts` — пользовательские внутренние переменные.
- `src/world.ts` — сгенерированный типизированный клиент (не редактировать).
- `src/index.ts` — пример того, как пишутся тесты поверх клиента.
