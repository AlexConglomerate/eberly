# NEXT — YAML-схемы и URL без расширения

> Самодостаточная задача для отдельного чата. Пришла из обсуждения
> лендинга, но от него не зависит: это фича библиотеки.

## Цель

1. eberly принимает OpenAPI-схему в **YAML** (файл и URL), а не только JSON.
2. `swagger.url` принимает URL **без** `.json` на конце: `/docs-json`
   (дефолт Nest), `/v3/api-docs` (дефолт springdoc), `/openapi` и т.п.
3. Разбор текста схемы — чистая функция, которую потом переиспользует
   плейграунд на лендинге (в браузере, без `node:fs`).

## Как сейчас (проверено)

- `src/generator/swagger.ts`: `SwaggerSource` пускает только
  `pathToFile: \`${string}.json\`` и `url: \`http${string}.json\``.
  `loadSpec` делает `JSON.parse` файла или `response.json()`.
- Из-за `.json` в типе URL README учит обходному пути — скачать
  `/docs-json` curl-ом или перенастроить Nest (`README.md`, раздел
  «What your backend needs», ~строка 288, и таблица «Config reference»,
  ~строка 365).
- Скиллы тоже говорят про файл/URL: `skills/eberly-setup/SKILL.md`
  (строка про `swagger`), `skills/eberly-write-tests/SKILL.md`.
- У пакета **нет ни одной рантайм-зависимости** (`package.json` — только
  `devDependencies`). YAML-парсер будет первой.

## Решения

| Тема | Решение |
|------|---------|
| Парсер | пакет `yaml` (eemeli/yaml): без транзитивных зависимостей, поддерживает YAML 1.2, работает в браузере. Импортировать **лениво** (`await import('yaml')`), только когда текст не JSON |
| Как определить формат | по тексту, не по расширению и не по `content-type`: после `trim()` начинается с `{` → `JSON.parse`, иначе → YAML. Одно правило для файла и URL |
| Чистая функция | `parseSpecText({ text, source })` в `swagger.ts` (или новом `parse.ts`): текст → `Json`. `source` — только для сообщения об ошибке. `loadSpec` = прочитать текст + `parseSpecText` |
| Тип `pathToFile` | `\`${string}.json\` \| \`${string}.yaml\` \| \`${string}.yml\`` — ограничение по расширению оставляем, оно ловит опечатки |
| Тип `url` | `\`http${string}\`` — любой http(s)-URL |
| Ошибка разбора | английская, с источником: *"eberly: failed to parse the OpenAPI spec from <source> as JSON or YAML: <причина>"* |
| Не объект на выходе | (YAML-строка, пустой файл) — та же ошибка, а не падение дальше в `assertSupportedVersion` |

## Что сделать

1. `swagger.ts`: типы `SwaggerSource`, `parseSpecText`, `loadSpec` через
   `readFile(..., 'utf8')` / `response.text()`.
2. `package.json`: `yaml` в `dependencies`. Проверить, что `tsup`
   оставляет его внешним (не бандлит) и что `dist` собирается.
3. Юнит-тесты `src/generator/swagger.test.ts` (новый, подхватится glob-ом):
   JSON-текст; YAML-текст; JSON с ведущими пробелами/переводом строки;
   битый текст → понятная ошибка; YAML-скаляр → та же ошибка.
4. Тест типов (`*.type-test.ts`): `.yaml`/`.yml` в `pathToFile` проходят,
   `.txt` — `@ts-expect-error`; `url` без `.json` проходит.
5. README: убрать обходной путь для Nest (можно прямо
   `url: 'http://localhost:3000/docs-json'`), обновить строку `swagger` в
   «Config reference», упомянуть YAML. Сниппеты — только из зелёных тестов.
6. Скиллы `eberly-setup` / `eberly-write-tests`: упомянуть YAML и URL
   без расширения.
7. `CLAUDE.md` (строка про `swagger.ts`), `ARCHITECTURE.md` (раздел про
   загрузку схемы), changeset (minor: новая возможность, не ломает).

## Готово, когда

- `pnpm test`, `pnpm lint`, `pnpm e2e` зелёные;
- можно указать `swagger: { pathToFile: 'openapi.yaml' }` и
  `swagger: { url: 'http://localhost:3000/docs-json' }`.

По желанию: перевести один пример (например, `examples/simple`) на
YAML-схему, чтобы `pnpm e2e` проверял YAML вживую.
