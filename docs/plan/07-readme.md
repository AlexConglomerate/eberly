# 07 — README на английском

> Самодостаточная задача. Общие решения, порядок и принципы тестов — в
> [README.md](README.md). Делается последней: примеры в README берутся из
> реально проходящих тестов.

## Цель

Первый экран README и есть лендинг. Рекрутер за 30 секунд понимает, что
это и зачем. Разработчик за 2 минуты запускает.

## Решения

- `README.md` на **английском**. Сейчас файл называется `Readme.md`; на
  macOS регистр в имени не различается, поэтому переименовывать в два
  шага: `git mv Readme.md tmp.md && git mv tmp.md README.md`.
- Русскую версию пока не делаем: два README неизбежно разойдутся.
- **Каждый фрагмент кода в README скопирован из теста, который проходит
  в `pnpm e2e`.** Никакого выдуманного API.
- `docs/forUser.md` вливается сюда (задача 06) и удаляется.

## Структура

1. **Заголовок и одна фраза:** *"Typed end-to-end API tests for any backend
   with an OpenAPI 3 spec."* Бейджи: версия npm и лицензия (CI — позже).
2. **До и после** — сценарий из `examples/nest`: два пользователя, Боб не
   может удалить пост Алисы → 403.
   - *До:* голый `fetch`, токены вручную, `any`.
   - *После:* ebely, ~6 строк.
3. **Why ebely** (5–7 пунктов):
   - типизированный клиент из свагера: бэкенд поменял контракт → тест
     красный;
   - несколько пользователей, у каждого своё состояние;
   - хуки сами сохраняют токены и id;
   - статус с подсказкой и частичная проверка тела;
   - прозрачный refresh токена;
   - загрузка файла по пути;
   - описания эндпоинтов для ИИ-агентов (`ebely/api/`).
4. **Quick start:** `npx ebely create my-tests` → поправить `ebely.ts` →
   `pnpm install` → `pnpm run client:generate` → `pnpm typecheck && pnpm test`.
   С Claude Code — `/ebely-setup`.
5. **Examples** — коротко, каждый со ссылкой на тест-файл:
   - auth + refresh (`globalRetry`, `simple-auth`);
   - id созданной сущности сохраняется хуком;
   - рекурсивные комментарии + deep-partial;
   - загрузка файла;
   - поломка контракта: какую ошибку `tsc` видно после переименования поля.
6. **Writing tests with AI agents:** что такое `ebely/api/INDEX.md` и файлы
   эндпоинтов, почему так тратится меньше контекста, скиллы.
7. **What your backend needs:**
   - OpenAPI 3.0/3.1 (2.0 не поддерживается);
   - `tags` для группировки;
   - тестовый режим: эндпоинт сброса, предсказуемые коды подтверждения,
     никаких реальных писем и SMS. Ссылка на `TEST_MODE` в Nest-примере.
   - **Рецепты:**
     - NestJS — `operationIdFactory` (фрагмент), свагер на `/docs-json`;
     - oRPC — `files: { encoding: 'bracket-index' }`.
8. **⚠️ Gotchas:**
   - тесты последовательные (`fileParallelism: false` уже в шаблоне;
     объяснить почему — для тех, у кого свой конфиг vitest);
   - `allowedHosts`: по умолчанию только localhost, прод — никогда;
   - vitest не проверяет типы → в CI нужен `pnpm typecheck`;
   - после изменения свагера перегенерировать клиент;
   - коммитить `generated.ts` и `ebely/api/`;
   - статус из переменной требует `as const`.
9. **Config reference:** таблица полей `EbelyConfig` (url, swagger,
   generateClientTo, mode, userStore, worldStore, hooks, maxRetries, files,
   allowedHosts).
10. **API cheat sheet:** `World`, `createUser`, `assert`, `get`/`set`, хуки.
11. **Limitations & roadmap:**
    - Swagger 2.0 не поддерживается;
    - имена методов из дефолтных operationId NestJS/FastAPI;
    - параллельные тесты;
    - примеры на Python/Go/Rust.
12. **License:** MIT.

Ещё в `package.json` проверить и заполнить `description`, `keywords`,
`repository`, `homepage`, `bugs` — это страница пакета на npm.

## Готово когда

- все фрагменты кода взяты из тестов, зелёных в `pnpm e2e`;
- ссылки на файлы примеров работают;
- README просмотрен в превью GitHub (таблицы и блоки кода рендерятся);
- `docs/forUser.md` удалён, CLI-справка (`npx ebely help`) не
  противоречит README.
