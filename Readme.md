### Быстрый старт с Claude Code

```sh
npx ebely create my-tests   # шаблон + скиллы в my-tests/.claude/skills
cd my-tests
claude
```

В Claude Code:

```
/ebely-setup                                    # пара вопросов → конфиг, клиент, стор, хуки, зелёные смоук-тесты
/ebely-write-tests Bob cannot delete Alice's post  # тест написан и прогнан
```

Агент читает описания эндпоинтов из `ebely/api/`, а не `generated.ts` и
не код бэкенда.

**Существующий проект:** `pnpm add -D ebely`, затем `npx ebely skills`
(или `npx ebely skills --user` — глобально в `~/.claude/skills`). Скиллы
копируются, поэтому после обновления `ebely` команду нужно запустить ещё
раз.

### Быстрый старт без агента

```sh
npx ebely create my-tests   # в новую/пустую папку (без аргумента — в текущую)
cd my-tests
pnpm install
# отредактируй ebely/ebely.ts (url, путь к swagger) под свой бэкенд
pnpm run client:generate
pnpm test
```

### Негативные тесты: `assert` на 4xx/5xx

```ts
res.assert(201, { id })        // статус из свагера: подсказывается, тело типизировано
res.assert(409, { message })   // 4xx из свагера — тоже типизирован
res.assert(403)                // любой 4xx/5xx, которого нет в свагере, — без каста
res.assert(200)                // ошибка типов, если в свагере только 201
```

Статус из переменной типа `number` нужно сузить через `as const`:
`for (const s of [401, 403] as const) res.assert(s)`.

### Защита от прода: `allowedHosts`

В режиме `test` клиент ходит только на `localhost` / `127.0.0.1` /
`[::1]` и хосты из `allowedHosts` (точное имя или `*.domain`). Иначе
`new World()` падает с `EbelyUnsafeHostError` ещё до первого запроса:

```ts
export const ebely = {
  url: 'https://api.staging.example.com',
  allowedHosts: ['*.staging.example.com'],
  // …
} satisfies EbelyConfig
```

