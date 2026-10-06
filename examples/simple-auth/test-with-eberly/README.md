# auth-test-with-eberly

Пример теста библиотеки `eberly` против бэкенда из `../your-app` (BetterAuth +
SQLite + роли + фейковый Google OAuth).

Главная фишка примера — **глобальные хуки** eberly (`h.globalBefore` /
`h.globalRetry`, см. `eberly/hooks.ts`):

- `globalBefore` — один хук подставляет `Authorization: Bearer <token>` во
  **все** запросы (вместо семи поэндпоинтных `before`).
- `globalRetry` — на `401` дёргает `ctx.refresh()` (повторный `signIn`
  сохранёнными кредами — у BetterAuth для bearer-сессий нет refresh-token
  флоу), кладёт свежий токен и возвращает `true`. eberly **прозрачно
  переигрывает** упавший запрос: заново прогоняет `globalBefore` (берёт
  обновлённый токен) и шлёт fetch — поэтому один вызов сразу отдаёт `200`,
  без ручного повтора (см. `tests/refresh.test.ts`). Число повторов
  ограничено `maxRetries` в ядре (по умолчанию 3).

## Запуск

В одном терминале:

```bash
pnpm --filter @eberly-examples/auth-your-app run start
```

В другом:

```bash
# Один раз скопировать свежий swagger из your-app:
cp ../your-app/swagger/swagger.json swagger.json
# (или: pnpm --filter @eberly-examples/auth-your-app run swagger && cp ...)

pnpm --filter @eberly-examples/auth-test-with-eberly run client:generate
pnpm --filter @eberly-examples/auth-test-with-eberly run test
```

## Что где

- `eberly/eberly.ts` — конфиг (url бэкенда, путь к swagger, режим test).
- `eberly/userStore.ts` — сценарии одного юзера: `signUp`, `signIn`,
  `refresh`, `loginWithGoogle`.
- `eberly/worldStore.ts` — сценарии уровня world: `clearDatabase`, `promote`, `revoke`.
- `eberly/hooks.ts` + `eberly/handlers.ts` — глобальные хуки: `globalBefore`
  (`withBearer`) и `globalRetry` (refresh + прозрачный повтор на 401).
- `eberly/generated.ts` — сгенерированный типизированный клиент (не редактировать).
- `tests/auth.test.ts` — регистрация/логин/session/wrong password.
- `tests/roles.test.ts` — user vs admin (создание, удаление, правка чужого).
- `tests/oauth.test.ts` — полный OAuth-флоу через фейковый Google.
- `tests/refresh.test.ts` — протухший токен → globalRetry рефрешит и eberly
  прозрачно переигрывает запрос → один вызов сразу даёт 200.
