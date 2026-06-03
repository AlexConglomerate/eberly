# auth-test-with-ebely

Пример теста библиотеки `ebely` против бэкенда из `../your-app` (BetterAuth +
SQLite + роли + фейковый Google OAuth).

Главная фишка примера — **глобальные хуки** ebely (`h.globalBefore` /
`h.globalRetry`, см. `ebely/hooks.ts`):

- `globalBefore` — один хук подставляет `Authorization: Bearer <token>` во
  **все** запросы (вместо семи поэндпоинтных `before`).
- `globalRetry` — на `401` дёргает `ctx.refresh()` (повторный `signIn`
  сохранёнными кредами — у BetterAuth для bearer-сессий нет refresh-token
  флоу), кладёт свежий токен и возвращает `true`. ebely **прозрачно
  переигрывает** упавший запрос: заново прогоняет `globalBefore` (берёт
  обновлённый токен) и шлёт fetch — поэтому один вызов сразу отдаёт `200`,
  без ручного повтора (см. `tests/refresh.test.ts`). Число повторов
  ограничено `maxRetries` в ядре (по умолчанию 3).

## Запуск

В одном терминале:

```bash
pnpm --filter @ebely-examples/auth-your-app run start
```

В другом:

```bash
# Один раз скопировать свежий swagger из your-app:
cp ../your-app/swagger/swagger.json swagger.json
# (или: pnpm --filter @ebely-examples/auth-your-app run swagger && cp ...)

pnpm --filter @ebely-examples/auth-test-with-ebely run client:generate
pnpm --filter @ebely-examples/auth-test-with-ebely run test
```

## Что где

- `ebely/ebely.ts` — конфиг (url бэкенда, путь к swagger, режим test).
- `ebely/userStore.ts` — сценарии одного юзера: `signUp`, `signIn`,
  `refresh`, `loginWithGoogle`.
- `ebely/worldStore.ts` — сценарии уровня world: `clearDatabase`, `promote`, `revoke`.
- `ebely/hooks.ts` + `ebely/handlers.ts` — глобальные хуки: `globalBefore`
  (`withBearer`) и `globalRetry` (refresh + прозрачный повтор на 401).
- `ebely/generated.ts` — сгенерированный типизированный клиент (не редактировать).
- `tests/auth.test.ts` — регистрация/логин/session/wrong password.
- `tests/roles.test.ts` — user vs admin (создание, удаление, правка чужого).
- `tests/oauth.test.ts` — полный OAuth-флоу через фейковый Google.
- `tests/refresh.test.ts` — протухший токен → globalRetry рефрешит и ebely
  прозрачно переигрывает запрос → один вызов сразу даёт 200.
