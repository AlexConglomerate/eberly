# Как устроена eberly

Документ объясняет на русском, что делает библиотека, как устроен код в
`src/` после реорганизации и почему в конфиге раньше были «странные»
поля `configImport` / `userStoreImport`.

## 1. Что вообще делает библиотека

`eberly` решает одну задачу: по swagger/OpenAPI-схеме бэкенда
**сгенерировать типизированный TypeScript-клиент**, которым удобно писать
тесты.

Результат генерации — один файл (в примере это
`examples/simple/test-with-eberly/eberly/generated.ts`) с классом `World`.
В тесте это выглядит так:

```ts
const world = new World()
const user = world.createUser()

// типизировано по swagger: тело, ответ, path-параметры
const post = await user.posts.create({ body: { title: "Hi", content: "yo" } })

// режим 'test' (по умолчанию): проверяем статус и часть тела.
// статус подсказывается интеллисенсом; post.body — типизировано.
post.assert(200, { title: "Hi" })

// и тут же — хранилище внутренних переменных пользователя
user.set({ key: "lastPostId", value: post.body.id })
```

Форма возвращаемого значения зависит от режима клиента (поле `mode` в
конфиге, см. §6): в `'test'` метод возвращает `ApiResponse` с
`.status` / `.body` / `.assert(...)`; в `'frontend'` — тело напрямую
(`post.id`), а не-2xx бросает ошибку.

Две половины библиотеки:

1. **Рантайм-ядро** — класс `BaseStore` (`src/base-store.ts`).
   Это хранилище «внутренних переменных» одного пользователя
   (`get` / `set`). Оно НЕ зависит от схемы и попадает в npm-пакет как
   есть. Пользователь наследуется от него и добавляет свои поля и методы
   (см. пример `userStore.ts` → `UserStore`).

2. **Генератор** — функция `generateClient` и всё в `src/generator/`.
   Запускается один раз (скриптом `client:generate`), читает swagger и
   пишет файл с классом `World`.

## 2. Структура `src/` после реорганизации

Раньше весь генератор лежал в одном файле `src/generate-client.ts`
(~370 строк: и разбор схемы, и сетевой код в виде строки, и запись
файла). Теперь он разбит по ответственности — один шаг конвейера = один
файл:

```
src/
├── base-store.ts        # рантайм-ядро (публичное): класс BaseStore
├── response.ts              # рантайм-ядро (публичное): ApiResponse + assert
├── config.ts                # публичный тип EberlyConfig (+ ClientMode)
├── generate-client.ts       # ОРКЕСТРАТОР: публичная generateClient()
└── generator/               # внутренности генератора (не публичные)
    ├── types.ts             #   общий тип Json
    ├── swagger.ts           #   SwaggerSource + loadSpec()  — ОТКУДА брать схему
    ├── version.ts           #   assertSupportedVersion()    — КАКУЮ версию берём
    ├── names.ts             #   имена типов и групп         — КАК называть
    ├── schema.ts            #   JSON-Schema → строка TS-типа — КАК типизировать
    ├── operations.ts        #   paths → Operation[]          — ЧТО за эндпоинты
    ├── render.ts            #   Operation[] → исходник World  — ВО ЧТО рендерим
    ├── jsdoc.ts             #   renderJsDoc() + экранирование — JSDoc из описаний
    ├── docs.ts              #   Operation[] → папка api/*.md   — ЧТО читает агент
    └── test-utils.ts        #   makeSpec() для юнит-тестов (не *.test.ts)
```

Зачем именно так:

- **`generator/swagger.ts`** — единственное место, которое знает про
  файлы и сеть. `loadSpec()` берёт схему либо из файла (`pathToFile`),
  либо по `url`. Тип `SwaggerSource` устроен так, что нельзя указать оба
  поля одновременно.
- **`generator/schema.ts`** — чистая функция `schemaToType()`: узел
  JSON-Schema → строка TypeScript-типа (`{ "id": string }` и т.п.).
  Плюс помощники `resolveRef` (разворачивает `$ref`) и
  `pickResponseSchema` (берёт схему ответа `2xx`). Здесь нет ни HTTP, ни
  файлов — это легко тестировать в изоляции.
- **`generator/version.ts`** — `assertSupportedVersion()`: 3.0/3.1
  генерируем, Swagger 2.0 и прочее — понятная ошибка (§10).
- **`generator/names.ts`** — имена: `components/schemas` → имена типов
  (`buildSchemaNames`), тег → имя группы (`toGroupName`), списки
  зарезервированных имён (§10).
- **`generator/operations.ts`** — `collectOperations()` проходит по
  `spec.paths` и строит плоский массив `Operation` (группа, имя, метод,
  path/query-параметры, типы тела и ответа). Группа — первый тег
  (`Posts` → `posts`), метод — `operationId` после точки
  (`posts.create` → `create`); фолбэки — в §10.
- **`generator/render.ts`** — `renderClient()` собирает финальный
  **текст** файла `World`: импорты, общую функцию `request` (fetch,
  подстановка path-параметров, query, заголовки, обработка ошибок),
  именованные типы схем и сгруппированные методы. Это единственное место, где
  задаётся форма публичного API сгенерированного клиента.
- **`generate-client.ts`** — больше ничего не делает сам, только
  связывает три шага и пишет результат на диск:

```
loadSpec (swagger.ts) → assertSupportedVersion (version.ts) → buildSchemaNames (names.ts)
  → collectOperations (operations.ts) → renderClient (render.ts) → writeFile
  → renderEndpointDocs (docs.ts) → writeEndpointDocs (папка api/, §11)
```

- **`config.ts`** и **`base-store.ts`** оставлены в корне `src/`,
  потому что это публичная поверхность (реэкспортится из `index.ts`),
  а не внутренности генератора.

Публичный API (`index.ts`): `BaseStore`, `ApiResponse`,
`EberlyAssertionError`, `HookRegistry`, `generateClient`, типы
`EberlyConfig`, `ClientMode`, `DeepPartial`, `SwaggerSource`,
`HooksRegistrar`, `BeforeHook`, `AfterHook`, `BeforeHookArgs`,
`AfterHookArgs`, `HookRequest`, `HookResponse`. `generate-client.ts`
реэкспортит `SwaggerSource`, чтобы внешние импорты и `config.ts` не
зависели от внутренней раскладки папки.

## 3. Про «странные» поля `configImport` и `userStoreImport`

Это поле тебя справедливо смущало. Разберём, **почему они вообще
существуют** и почему теперь их можно не писать.

### Почему они нужны

Генератор не выполняет код — он **пишет текст** в новый файл
(`generated.ts`). А этому новому файлу нужно импортировать две вещи:

```ts
import { BaseStore } from "eberly"   // ← userStoreImport
import { eberly } from "./eberly"          // ← configImport
```

- `BaseStore` нужен сгенерированному классу `World` как тип-ограничение
  (`Store extends BaseStore`).
- `eberly` (твой конфиг) нужен ему для значений по умолчанию: `eberly.url`
  (адрес бэкенда) и `eberly.userStore` (класс хранилища), чтобы можно
  было писать просто `new World()` без аргументов.

Проблема: генератор **не может сам угадать строки этих импортов**, потому
что они зависят от того, *где* окажется сгенерированный файл и *как* из
этого места резолвится библиотека:

- `userStoreImport` — обычно это имя npm-пакета `'eberly'`. Но в
  монорепо без публикации, при импорте по относительному пути или по
  alias из `tsconfig` строка будет другой. Библиотека не знает, как она
  «видна» из произвольной папки.
- `configImport` — это путь **от сгенерированного файла к твоему
  конфигу**. Ощущение «странности» именно отсюда: ты руками пишешь
  import-путь для ещё не существующего файла, который потом
  импортирует обратно тот же файл, где ты этот путь и указываешь.

То есть поля — это не каприз, а следствие того, что генерируется
**текст с импортами**, а текст нельзя «вычислить» в общем случае.

### Что изменено

В коде у этих полей **уже были значения по умолчанию**
(`userStoreImport = 'eberly'`, `configImport = './eberly'`), но в типе
`EberlyConfig` они были помечены как **обязательные** — поэтому пример был
вынужден их указывать, хотя значения совпадали с дефолтами один в один.

Теперь оба поля в `EberlyConfig` сделаны **необязательными** (`?`) с
задокументированными дефолтами. Для стандартной раскладки (конфиг лежит
рядом с генерируемым файлом, библиотека стоит как npm-пакет `eberly`) их
можно просто **не писать** — что и сделано в примере `eberly.ts`.

Поведение не изменилось: повторная генерация даёт **байт-в-байт тот же**
`generated.ts`.

### Когда их всё-таки указывать

- `userStoreImport` — если в сгенерированном файле `import ... from
  "eberly"` не резолвится: монорепо без публикации, импорт по
  относительному пути, alias в `tsconfig`. Тогда поставь сюда ту строку,
  которой реально резолвится библиотека из места `generateClientTo`.
- `configImport` — если `generateClientTo` указывает не в ту же папку,
  где лежит `eberly.ts`. Значение — относительный путь **от
  сгенерированного файла к `eberly.ts`** (без расширения), например
  `'../config/eberly'`.

## 4. Полный поток использования (на примере `examples/simple`)

1. **`your-app`** — тестируемый бэкенд (oRPC CRUD). Скрипт `swagger`
   собирает `your-app/swagger/swagger.json`. От `eberly` не зависит.
2. Схема копируется в `test-with-eberly/swagger.json`.
3. **`test-with-eberly/eberly/eberly.ts`** — конфиг: адрес бэкенда, класс
   хранилища (`UserStore`), источник схемы, куда писать клиент.
4. **`client:generate`** запускает `generate-client.ts`, тот вызывает
   `generateClient(eberly)` → конвейер из §2 → пишется
   `eberly/generated.ts` с классом `World`.
5. **`tests/test1.ts`** импортирует `World`, создаёт пользователей и
   дёргает типизированные методы (`user.posts.create(...)`), попутно
   складывая данные в `BaseStore` (`user.set/get`).

## 5. Проверка

- `pnpm build` — пересобрать `dist/` (типы пакета берутся из
  `dist/index.d.ts`, поэтому после правок типов пакет надо пересобрать,
  иначе примеры будут видеть старый тип `EberlyConfig`).
- `pnpm lint` — `tsc` по библиотеке и `scripts/` (примеры проверяются
  своими `tsconfig` — шагом `typecheck` в `pnpm e2e`).
- `pnpm test` — юнит-тесты библиотеки (`src/**/*.test.ts`, `tsx --test`):
  чистые функции `assertResponse` / `matchPartial` и генератор
  `renderClient` — без сети и без записи на диск.
- Тесты типов — `src/**/*.type-test.ts` (`@ts-expect-error`): их
  проверяет `pnpm lint`, в рантайме они не запускаются.
- `pnpm --filter @eberly-examples/test-with-eberly run client:generate` —
  перегенерировать клиент.
- `pnpm e2e` (`scripts/e2e.ts`) — интеграция на живых бэкендах. Сначала
  `pnpm build` (примеры берут `eberly` из `dist/`) и сборка шаблона. Затем
  для `simple`, `simple-auth`, `nest` **по очереди** (все слушают `:3000`;
  занят — скрипт сразу выходит): `swagger` в `your-app` → копия в
  `test-with-eberly/swagger.json` → `your-app start` (`PORT=3000`,
  `TEST_MODE=1`, отдельная группа процессов) → ждём любой HTTP-ответ
  (60 с) → `client:generate` → `typecheck` (`tsc --noEmit`: vitest типы
  не проверяет, поломку контракта ловит только он) → `test`. Бэкенд
  гасится всей группой в `finally` и на `SIGINT` / `SIGTERM`. Его лог
  печатается, только если пример упал. В конце — смоук
  `eberly create` во временную папку и таблица ✓/✗ с упавшим шагом.
  `--only <пример>` — один пример. Прогон перегенерирует `swagger.json`,
  `generated.ts` и `eberly/api/` — изменения в них коммитятся.
- Тест-файлы примеров идут строго последовательно
  (`vitest.config.ts`: `fileParallelism: false`): база у бэкенда одна, и
  каждый файл чистит её в `beforeAll`.

### Шаблон `eberly create`

`clone/tests` (его копирует `npx eberly create`) **генерируется** из
`examples/simple/test-with-eberly` скриптом `scripts/sync-template.ts`
(без `node_modules` и `tests/draw.ts`; папка сначала очищается). Запуск —
в `prepublishOnly` и в начале `pnpm e2e`. `clone/` в `.gitignore`, руками
не правится, поэтому с примером не расходится. В `files` пакета — целиком
`clone/tests`. `bin/eberly.mjs create` поверх копии пишет свой
`package.json` (имя по папке, `eberly: ^<версия>`), standalone
`tsconfig.json`, `.gitignore` и кладёт скиллы в `.claude/skills/`.

### Скиллы для Claude Code

`skills/eberly-setup` и `skills/eberly-write-tests` (в `files` пакета).
Ставятся копией: `npx eberly create` — сразу в новый проект,
`npx eberly skills [--user]` — в существующий (или обновить после
апдейта `eberly`). Пишутся на английском и короче ~150 строк: скилл сам
попадает в контекст агента. Главный принцип — агент узнаёт API из
`eberly/api/` (§11), а не из `generated.ts` и не из кода бэкенда;
шпаргалка по `assert` / сторам / хукам лежит в `eberly-write-tests`, её
же читает `eberly-setup`. Смоук шаблона в `pnpm e2e` проверяет, что
скиллы попали в созданный проект.

## 6. Режимы клиента (`mode`) и `ApiResponse`

Поле `mode` в конфиге (`EberlyConfig.mode`, тип `ClientMode`, по умолчанию
`'test'`) выбирается на **этапе генерации** и задаёт форму
сгенерированного файла — никаких рантайм-условий и conditional-типов:

- **`'test'`** — метод возвращает `Promise<ApiResponse<{ <статус>: <тело> }>>`.
  Карта «статус → тело» собирается из всех задекларированных в swagger
  ответов (`collectResponseSchemas`). `request` НЕ бросает на не-2xx —
  любой статус доступен через `res.status` / `res.body`, проверка
  делается явным `res.assert(status, body?)`:
  - первый аргумент — две перегрузки. Первая: `keyof` карты статусов →
    IDE подсказывает задекларированные коды, тело типизировано (в том
    числе у 4xx: `assert(409, { wrong: 1 })` — ошибка типов). Вторая:
    любой 4xx/5xx, которого НЕТ в карте (`UndeclaredErrorStatus`), — без
    каста, тело `unknown`; союза литералов у неё нет, поэтому автокомплит
    не забит кодами 400–599. Задекларированные статусы из второй
    перегрузки исключены — иначе неверное тело 409 молча прошло бы через
    неё. Незадекларированный 1xx–3xx (`assert(200)` при наличии только
    `201`) — ошибка типов. Статус из переменной типа `number`
    (`for (const s of [401, 403])`) требует `as const`. Поведение
    закреплено `src/response.type-test.ts`;
  - второй аргумент опционален и имеет тип `DeepPartial<тело>` —
    проверяются только переданные поля (глубоко-частично);
  - возвращает тот же объект, но после задекларированного статуса `.body`
    сужен до тела этого статуса (`this & { body: M[S] }`):
    `res.assert(201).body.id` — без каста, хотя `res.body` до проверки —
    союз тел всех статусов (`UserDto | ErrorDto`).
- **`'frontend'`** — метод возвращает тело 2xx-ответа напрямую
  (`Promise<тело>`), не-2xx бросает `Error`; `ApiResponse` / `.assert`
  отсутствуют. Такой клиент можно использовать из приложения, а не
  только в тестах.

Логика проверки (`assertResponse`, `matchPartial`) живёт в `src/response.ts`
**чистыми функциями** — без `fetch` и без I/O, поэтому покрыта обычными
юнит-тестами (`src/response.test.ts`). Генератор `renderClient` тоже
чистая функция «модель → текст» и тестируется на форму вывода по режимам
(`src/generator/render.test.ts`).

## 7. Хуки `before` / `after` / `retry`

Хук — это код, который выполняется ДО запроса (может править запрос),
ПОСЛЕ ответа (может, например, записать что-то во внутренние переменные)
и — для глобального `retry` — решает, переиграть ли запрос. Дизайн узкий
по `ROADMAP §7`: точки наблюдения + одна точка повтора, без права
переписать движок.

Разделение «чистое ядро / генератор», как и везде:

- **`src/hooks.ts`** (рантайм-ядро, в npm-пакете, без сети) —
  `HookRegistry`: реестр с ключом `"<группа>.<метод>"`, очередь хуков на
  ключ, `runBefore` / `runAfter` / `runRetry` (await на async). Чистый
  класс → юнит-тесты в `src/hooks.test.ts`. Плюс типы `BeforeHook` /
  `AfterHook` / `RetryHook` / `HookRequest` / `HookResponse` /
  `HooksRegistrar`. Сам реестр сети НЕ знает: `runRetry` лишь возвращает
  «повторять?», а цикл повторов крутит сгенерированный `request`.
- **`src/generator/render.ts`** эмитит две вещи: типизированное дерево
  `EberlyHookTree` + экспортируемый `Hooks` (форма `h.<группа>.<метод>.
  before/after`, тело/ответ из swagger той же операции) и рантайм-сборку
  `buildHookTree`, связывающую имена с одним `HookRegistry` на `World`.

Поток: `new World()` один раз вызывает `eberly.hooks` (если задан),
регистрируя функции в общий `HookRegistry`. Общий `request` прогоняет
`runBefore` ДО fetch (по мутируемому `hookReq`: `headers` / `query` /
`body` / `pathParams`) и `runAfter` ПОСЛЕ разбора ответа. Работает в
обоих режимах (`'test'` / `'frontend'`).

**Изоляция между пользователями — бесплатно.** Реестр общий и ключуется
по операции, но `ctx` подставляется не при регистрации, а в момент
запроса = store КОНКРЕТНОГО `createUser()`. Поэтому `ctx.set(...)` из
хука пишет в переменные именно того юзера, что сделал вызов.

**Глобальные хуки `h.globalBefore` / `h.globalAfter`.** Кроме поименных
(`h.<группа>.<метод>.before/after`) есть две верхнеуровневые точки,
срабатывающие на КАЖДУЮ операцию. `HookRegistry` хранит их отдельными
списками (`globalBefore` / `globalAfter`); порядок прогона:
`runBefore` = глобальные → поименные, `runAfter` = поименные →
глобальные (глобальный after «оборачивает» точечные). `Body`/`ResBody`
у них не уточняются (`unknown`) — хук общий для всех операций.
Типичные применения: подстановка `Authorization` из `ctx` во ВСЕ
запросы юзера (токен кладётся в стор при регистрации), сквозное
логирование. Изоляция та же: `ctx` — store сделавшего запрос юзера.

**Глобальный `h.globalRetry` (повтор запроса).** Отдельная третья
категория — НЕ наблюдение, а решение «переиграть ли запрос». Хук
вызывается ПОСЛЕ всех `after`-хуков и возвращает `boolean`: `true` →
`request` идёт на новый виток (заново собирает `hookReq`, прогоняет
`runBefore` и шлёт fetch), поэтому правки из хука (напр. свежий токен в
`ctx`) подхватываются повторным `before`. Любой не-истинный возврат →
ответ отдаётся как есть. Канонический кейс — refresh на 401: хук делает
`ctx.refresh()` и возвращает `true`, eberly прозрачно повторяет запрос,
вызывающий код видит сразу `200` (никакого ручного повтора). Несколько
retry-хуков прогоняются по очереди, выигрывает ПЕРВЫЙ вернувший истину
(`runRetry` короткозамыкается). Почему это `after`-сигнал, а не право
`after` менять ответ: контракт `after` остаётся «только чтение», а
управление потоком вынесено в явную точку — не «каша» из логирования и
ретраев в одном хуке. **Защита от цикла — в ядре, а не на совести
хука:** цикл повторов крутит сгенерированный `request` с жёстким
потолком `EberlyConfig.maxRetries` (по умолчанию 3 повтора сверх первой
попытки), поэтому даже хук, упрямо возвращающий `true`, не зациклит
тест. Изоляция та же: `ctx` — store сделавшего запрос юзера.

**Цикл типов `eberly` ⇄ `Hooks`.** `hooks` лежит ВНУТРИ объекта `eberly`,
поэтому тип `Hooks` НЕ может выводить store из `typeof
eberly.userStore` (как это делает `World`) — иначе `eberly` ссылается
сам на себя. Решение: `Hooks<Store extends BaseStore =
BaseStore>` без `eberly`-дефолта; пользователь передаёт свой класс
явно — `Hooks<UserStore>` в отдельном файле `eberly/hooks.ts`. Это и есть
заложенный шов: добавить позже второй уровень контекста (общий
account/session для «один юзер с двух устройств») можно аддитивно, не
трогая `HookRegistry`.

## 8. Сценарии (actions): `this.api` и world-store

Хук реагирует на ОДИН запрос. Сценарий — наоборот: один именованный
метод, который ПОД КАПОТОМ дёргает один или несколько эндпоинтов и
складывает результат во внутренние переменные. Пример — `fullRegister`:
`auth.register` → `auth.confirm` → сохранить `accessToken`. В тесте это
одна строка `await user.fullRegister({ email, password })`, без копипасты
многошаговой подготовки.

Решение — **не новый слой, а доращивание существующего класса-store**
(см. оценку вариантов в истории; выбран «методы на классе + типизированный
`this.api`», т.к. он 1-в-1 повторяет `userStore.ts`, который
пользователь уже пишет):

- **`src/base-store.ts`** получил второй дженерик и `protected api`:
  `BaseStore<Vars, Api>`. Значение НЕ инициализируется в ядре — его
  подставляет генерируемый `World`. Тип `Api` пользователь задаёт сам,
  подставляя сгенерированный `WorldApi` (как `Hooks<UserStore>` для хуков).
- **`src/generator/render.ts`** эмитит ТИП `export type WorldApi` —
  дерево типизированных вызовов (`{ posts: { create(input) =>
  Promise<…> } }`, форма зависит от `mode`, как у методов). Рантайм-
  дерево строит общий `buildApiTree(request)`, а `request` —
  `makeRequest({ headers, store })` (один движок и для юзера, и для
  world; `store` = он же `ctx` хуков).
- **User-scoped** (`user.fullRegister`): `createUser()` строит дерево с
  заголовками этого юзера и кладёт его И в `Object.assign(store, tree)`
  (внешний вызов `user.posts.create`), И в `store.api` (вызов изнутри
  методов-сценариев). Один и тот же `tree` → сценарий ходит от лица
  именно этого пользователя (его заголовки, его переменные, его `ctx`).

**World-scoped** (`world.clearDatabase`, `world.seed`): не привязано к
юзеру — глобальная подготовка/очистка. Введён необязательный
`EberlyConfig.worldStore` (тот же `BaseStore`, но «весь мир»).
Генерируемый `World` **наследует** сконфигурированный `worldStore`
(`class World … extends WorldStoreBase`), поэтому `world.<сценарий>()` и
`world.get/set` доступны и типизированы ровно как у юзера. `this.api`
world-store — АНОНИМНЫЙ клиент (без per-user заголовков), `ctx` хуков для
таких вызовов = сам world.

**Тот же приём против цикла, что у хуков (§7).** `WorldApi`
импортируется в `userStore.ts` / `worldStore.ts` как
`import type` → рантайм-цикла нет (тип стирается). Тип базы `World`
берётся из `eberly` тем же conditional-приёмом, что и `Store`
(`typeof eberly extends { worldStore: new () => infer I … } ? I : …`) —
никаких рантайм-условий, форма решается на этапе генерации.

## 9. Файлы / multipart

Цель: отправлять файлы типизированным методом клиента, передав **путь к
файлу** (или `File`/`Blob`), а не собирая `multipart/form-data` руками
через `fetch`. Один или несколько файлов — генератор понимает из swagger.

```ts
const upload = await user.wordCard.wordCardUploadScreenshots({
  body: { files: ["./a.jpg", new URL("./b.jpg", import.meta.url)] },
})
upload.assert(200)
```

**Детект файла.** Файловый узел схемы — это
`{ type: 'string', contentMediaType: '<mime>' }` (OpenAPI 3.1, ровно
`isFileSchema` из `@orpc/openapi`) или `{ type: 'string', format:
'binary' }` (OpenAPI 3.0, так пишет `@nestjs/swagger`). `format: 'byte'`
(base64-строка) — НЕ файл. `schema.ts → isFileSchema` детектит узел, а
`schemaToType` возвращает для него публичный тип `FileInput` (ДО ветки
`type: 'string'`), поэтому массив файлов автоматически становится
`Array<FileInput>`. Swagger 2.0 (`in: formData`) не поддерживается вовсе
(§10).

**Две точки врезки** (как и для JSON):

1. *Генератор знает, какие поля файловые.* `operations.ts` берёт схему
   тела «multipart-aware» (`content['multipart/form-data'] ??
   content['application/json']` — oRPC кладёт оба с одинаковой схемой) и
   собирает плоские `fileFields` (`{ name, array }`) обходом top-level
   свойств. `render.ts` эмитит статическую карту `FILE_OPS: opKey →
   FileFieldMeta[]`.
2. *Рантайм собирает FormData.* В общем `request` (после `runBefore`,
   когда тело — обычный объект, и хуки уже его видели/правили как JSON):
   если `FILE_OPS[opKey]` есть → `toMultipartFormData(...)` строит
   `FormData`, а `content-type` НЕ ставится (fetch сам выставит boundary).
   На retry форма пересобирается заново.

**`src/files.ts` (рантайм-ядро, в npm-пакете).** Чистые функции:
`toBlob(FileInput)` (путь читается через ленивый `import('node:fs/...')`,
поэтому модуль импортируется и во фронтенд-сборке), `toMultipartFormData`
и `mimeFromName` (mime по расширению — нужен для серверного барьера
`image/*`). Тип `FileInput` — union: строка-путь (абсолютный как есть,
относительный от `process.cwd()`), `URL`/`file://`, `{ path, name?,
type? }`, `{ content, name, type? }`, `Blob`/`File`.

**Кодировка имён полей для МАССИВА файлов (`EberlyConfig.files.encoding`).**
Сам wire-формат multipart (RFC 7578) везде одинаков; различается ТОЛЬКО
именование полей при массиве, и надёжно вытащить его из swagger нельзя
(генераторы не эмитят `encoding`/`explode` для бинарей) — поэтому это
**явная рантайм-настройка** (как `maxRetries`, перегенерация не нужна):

| Конвенция | Имена полей | Кто ждёт |
|---|---|---|
| `'repeat'` (**дефолт**) | `files`, `files` | busboy: Express/Nest/Fastify, Go, Rust |
| `'bracket-index'` | `files[0]`, `files[1]` | **oRPC OpenAPI-хендлер**, PHP, Rails |
| `'bracket-empty'` | `files[]`, `files[]` | PHP/Rails вариант |
| функция | — | кастомный escape hatch |

Дефолт `'repeat'` — мейнстрим (веб-стандарт). Проекты на **oRPC** ставят
`files: { encoding: 'bracket-index' }` одной строкой в конфиге. Для
ОДНОГО файла вопрос не стоит — поле без скобок, кодировка игнорируется.

Не делаем сейчас (задел): raw-body (тело — сам файл без объекта-обёртки), глубокая bracket-сериализация ВЛОЖЕННЫХ объектов в
смешанном теле (сейчас скаляры → `String()`, объекты → `JSON.stringify`).

## 10. Версии OpenAPI, именованные типы и группы

**Версии** (`generator/version.ts`, вызывается сразу после `loadSpec`):

| `spec` | Действие |
|--------|----------|
| `openapi: 3.1.x` | генерируем |
| `openapi: 3.0.x` | генерируем; `nullable: true` → `\| null`, `format: binary` → `FileInput` |
| `swagger: "2.0"` | ошибка с подсказкой (swagger2openapi) |
| что-то ещё / нет поля | ошибка с найденным значением |

`nullable` и `format: binary` обрабатываются без оглядки на версию: в 3.1
их просто нет, а если генератор их всё же написал — смысл тот же.
`nullable` применяется ПОВЕРХ результата любой ветки `schemaToType`
(`$ref`, `allOf`/`oneOf`/`anyOf`, `type`): Nest пишет nullable-DTO как
`{ nullable: true, type: 'object', allOf: [{ $ref }] }` → `UserDto | null`.

**Именованные типы** (`generator/names.ts` + `schema.ts`). Каждая схема из
`components/schemas` рендерится один раз блоком `export type <Имя> = …`
сразу после импортов, а `$ref: '#/components/schemas/X'` — просто именем
`X`. Поэтому рекурсивные схемы (`CommentDto.replies: CommentDto[]`)
становятся обычной рекурсией TypeScript, а не бесконечным разворотом.
`$ref` в другие разделы (`components/responses` и т.п.) по-прежнему
разворачивается через `resolveRef`. Инлайн-схемы (как у oRPC) остаются
инлайновыми.

Имя типа = ключ схемы в PascalCase (`post.create` → `PostCreate`,
`Page<Post>` → `PagePost`); с цифры — префикс `Schema`. Имена, которые
файл объявляет или использует сам (`World`, `Store`, `FileInput`,
`Array`, `File`, … — `RESERVED_TYPE_NAMES`), получают суффикс `Schema`.
Коллизии после санитизации — `PostCreate2` по порядку ключей. Таблица
«ключ → имя» (`buildSchemaNames`) строится один раз и передаётся в
`schemaToType` аргументом `names`. Пользователь может импортировать
типы: `import type { PostDto } from './generated'`.

**Один источник типов вызовов.** Типы параметров и ответов описаны только
в `WorldApi` (там же JSDoc `summary`). Реализация —
`buildApiTree(request): WorldApi` — типизируется контекстно и типы не
повторяет (`input as RequestInput`, результат `as never`). `createUser()`
возвращает `Store & WorldApi`, так что IDE показывает JSDoc из `WorldApi`.
Дерево хуков пока рендерит типы само (с именами — коротко).

**Группы** (`collectOperations` → `toGroupName`). Группа = первый тег в
camelCase (`User Management` → `userManagement`). Фолбэки по порядку:
префикс `operationId` до точки (oRPC без тегов) → первый статический
сегмент пути (`/posts/{id}` → `posts`) → `default`. Группа становится
свойством объекта пользователя (`Object.assign(store, tree)`) и дерева
хуков, поэтому `get`, `set`, `api`, `store`, `globalBefore`,
`globalAfter`, `globalRetry`, `constructor` (`RESERVED_GROUP_NAMES`)
получают суффикс `Api`: `store` → `storeApi`. Имя метода не меняется
(после первой точки `operationId`, иначе целиком, иначе
`${method}${path}`).

## 11. Описания: JSDoc и папка `api/` для агента

Цель — понять эндпоинт, не открывая код бэкенда и не читая весь
`generated.ts` (на 200 эндпоинтах это десятки тысяч строк). Всё пишет
код генератора из свагера, детерминированно, той же командой
`client:generate` — разойтись с клиентом описания не могут.

**JSDoc** (`generator/jsdoc.ts` → `renderJsDoc({ lines, deprecated, indent })`)
в трёх местах:

| Где | Что | Кто рендерит |
|-----|-----|--------------|
| метод в `WorldApi` | summary, description, `` `POST /posts` ``, `@deprecated` | `render.ts` (`renderEndpointJsDoc`) |
| поле `path` / `query` во входном типе | description параметра | `render.ts` (`buildInputType`) |
| поле объекта схемы | description, `@deprecated` | `schema.ts` (объектная ветка `schemaToType`) |

Маршрут у эндпоинта есть всегда — при наведении сразу видно, куда идёт
запрос. Нет описания — нет комментария (никаких пустых `/** */`); один
короткий абзац — `/** text */` в одну строку. Параметры без описаний
рендерятся в одну строку, как раньше. Описание — внешний текст: `*/`
внутри него закрыл бы комментарий и превратил остаток в КОД, поэтому
`escapeJsDoc` заменяет его на `*\/`.

**Папка `api/`** лежит рядом со сгенерированным клиентом
(`<папка generateClientTo>/api/`, в примерах — `eberly/api/`), отдельной
опции нет. Поток агента: `INDEX.md` (строка на эндпоинт:
`- posts.create — POST /posts — Create a post`) → 2–3 файла
`<группа>.<метод>.md` → тест. В файле эндпоинта: заголовок с маршрутом,
`**Deprecated.**`, summary/description, `## Call` (готовый вызов),
`## Input`, `## Responses` (статус → тип, описание ответа комментарием),
`## Types` (все именованные типы, на которые транзитивно ссылаются вход и
ответы, каждый один раз; обход защищён от рекурсии).

Пример вызова (`renderExampleValue`): только обязательные поля; значение
— `example` → `examples[0]` → первое `enum` / `const` → заглушка по типу
(`"string"`, `0`, `true`, `[]`, файл — `"./path/to/file"`). Вложенные
объекты рекурсивно до глубины 3; `$ref`, уже открытый выше по пути, → `{}`.
Path-параметр всегда строка. В режиме `test` — `res.assert(<первый 2xx>)`,
в `frontend` — без `assert`.

Почему `.md`, а не `.ts`: `.ts` в папке `eberly/` попал бы в `include`
tsconfig, и IDE предлагала бы автоимпорт `PostDto` из двух мест.

**Очистка.** Первая строка каждого файла — маркер `DOCS_MARKER`
(`<!-- AUTO-GENERATED by eberly. … -->`). Перед записью
`writeEndpointDocs` удаляет в папке только `.md`-файлы с этим маркером:
при `generateClientTo: 'src/generated.ts'` папка `src/api/` может
оказаться кодом пользователя, поэтому никакого `rm -rf`.

Эти файлы стоит коммитить: в PR изменение API видно в читаемом виде.

## 12. Защита от прода: `allowedHosts`

Тесты создают и удаляют данные, поэтому клиент в режиме `'test'`
отказывается ходить на чужой хост. Правило: **loopback (`localhost`,
`127.0.0.1`, `[::1]`) можно всегда, остальное — только из
`EberlyConfig.allowedHosts`**.

```ts
export const eberly = {
  url: 'https://api.staging.example.com',
  allowedHosts: ['*.staging.example.com'],
  // …
} satisfies EberlyConfig
```

- Элемент списка — точный hostname или `*.domain`: `*.staging.x.com`
  совпадает с `api.staging.x.com`, но не со `staging.x.com`. Регистр не
  важен, порт игнорируется (и в URL, и в элементе списка).
- Логика — чистые функции в `src/safety.ts` (`isHostAllowed`,
  `assertHostAllowed`), бросают `EberlyUnsafeHostError` с хостом и
  подсказкой. Тесты — `src/safety.test.ts`.
- Где проверяется: в сгенерированном `makeRequest` сразу после
  вычисления `baseUrl`. `makeRequest` зовут `new World()` и
  `createUser()`, поэтому ошибка вылетает **до первого запроса** и
  покрывает переопределение `new World({ url })`. `allowedHosts`
  читается из `eberly` в рантайме (как `maxRetries`) — перегенерация не
  нужна.
- Только `'test'`: рендер (`renderHostCheck` в `render.ts`) вставляет
  импорт и вызов `assertHostAllowed` лишь в этом режиме. Клиент
  `'frontend'` работает из приложения и законно ходит в прод.
