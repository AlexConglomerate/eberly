# auth-test-with-ebely

Пример теста библиотеки `ebely` против бэкенда из `../your-app` (BetterAuth +
SQLite + роли + фейковый Google OAuth).

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
- `ebely/userStore.ts` — сценарии одного юзера: `signUp`, `signIn`, `loginWithGoogle`.
- `ebely/worldStore.ts` — сценарии уровня world: `clearDatabase`, `promote`.
- `ebely/hooks.ts` + `ebely/handlers.ts` — before-хук `withBearer`, который
  автоматически подставляет `Authorization: Bearer <token>` после логина.
- `ebely/generated.ts` — сгенерированный типизированный клиент (не редактировать).
- `tests/auth.test.ts` — регистрация/логин/session/wrong password.
- `tests/roles.test.ts` — user vs admin (создание, удаление, правка чужого).
- `tests/oauth.test.ts` — полный OAuth-флоу через фейковый Google.
