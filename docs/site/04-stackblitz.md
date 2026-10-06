# 04. «Open in StackBlitz»

> Контекст — [README.md](README.md). Перед стартом прочитай
> [HANDOFF.md](HANDOFF.md). Ни от чего не зависит; кнопку на сайт
> ставит после 01.

## Цель

Одна кнопка на сайте открывает в браузере (StackBlitz, WebContainers)
настоящий проект: Nest-бэкенд поднимается, клиент генерируется, тесты
`vitest` проходят. Человек правит тест или DTO и перезапускает.

## Сложность

Примеры зависят от `eberly: workspace:*`, а бэкенд и тесты — два разных
пакета. Подпапку `examples/nest` отдельно StackBlitz не соберёт.

## Шаги

1. **Сначала — без дублирования кода.** Попробовать открыть весь репозиторий:
   `https://stackblitz.com/github/AlexConglomerate/eberly` с `.stackblitzrc`
   в корне (`installDependencies`, `startCommand`), где стартовая команда
   собирает библиотеку и запускает Nest-пример — например,
   `pnpm e2e --only nest` или отдельный скрипт `scripts/stackblitz.ts`
   (бэкенд с `TEST_MODE=1` → `client:generate` → `vitest` в watch-режиме,
   чтобы правки перезапускали тесты). Открыть сразу файл теста
   (`?file=examples/nest/test-with-eberly/tests/posts.test.ts`).
   Проверить: Nest стартует в WebContainer, порт `3000` доступен, время
   до зелёных тестов — записать в HANDOFF.
2. **Если не взлетает** (pnpm-workspace, Nest, время установки) —
   отдельный проект вне pnpm-workspace (например, `stackblitz/nest/`,
   не под `examples/*/*`): бэкенд и тесты в одном `package.json`,
   `eberly` — из npm (`^0.2.0`), `npm start` = бэкенд + генерация +
   `vitest`. Это копия кода Nest-примера — добавить в `pnpm e2e` проверку,
   что копия не разошлась (или синхронизировать скриптом, как
   `scripts/sync-template.ts`). Записать решение в HANDOFF.
3. Проверить условия WebContainers для open-source-проекта (бесплатно
   ли) и записать в HANDOFF.
4. Кнопка «Open in StackBlitz» на лендинге и в Getting started. Ссылка
   ведёт на ветку `main` — работает только после пуша в `main`.
5. `CLAUDE.md`: что такое `.stackblitzrc` / `stackblitz/` и как проверить.

## Готово, когда

- по ссылке в StackBlitz бэкенд поднимается и тесты зелёные без ручных
  действий; правка теста перезапускает его;
- `pnpm e2e` зелёный;
- запись в HANDOFF.md (какой вариант, время запуска, условия StackBlitz).
