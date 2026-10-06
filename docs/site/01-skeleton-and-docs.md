# 01. Каркас сайта и документация

> Контекст — [README.md](README.md). Перед стартом прочитай
> [HANDOFF.md](HANDOFF.md). Ни от чего не зависит.

## Цель

Папка `site/` с сайтом на Astro + Starlight, который поднимается локально:
лендинг + документация со всем содержимым нынешнего `README.md`. Код в
документации берётся из тестов, а не копируется руками.

## Шаги

1. **Пакет.** `site/package.json`: имя `@eberly-site/site`, `private: true`,
   `"type": "module"`, скрипты `dev`, `build`, `preview`. Добавить `site` в
   `pnpm-workspace.yaml`. Свежие стабильные `astro`, `@astrojs/starlight`.
   Свой `tsconfig.json` (корневой — для библиотеки, его не расширять).
   Проверить, что `npm pack --dry-run` в корне не тащит `site/`.
2. **Starlight.** Заголовок `eberly`, ссылка на GitHub, тёмная/светлая тема
   из коробки, английский. Без кастомной темы на этом шаге — только
   акцентный цвет.
3. **Лендинг** — `site/src/content/docs/index.mdx` с `template: splash`:
   - hero: одна строка из README (*Typed end-to-end API tests for any backend
     with an OpenAPI 3 spec*), `npm i -D eberly`, кнопки «Get started» и GitHub;
   - пример «до и после» (из `readme.test.ts` + блок «Before» из README);
   - блок «Why eberly» (из README, раздел с тем же названием);
   - **заглушка-место под плейграунд** (его вставит 03) и под кнопку
     StackBlitz (04).
4. **Документация.** Разложить разделы `README.md` по страницам. Примерно:
   - Getting started ← «Quick start»;
   - Guides ← «Examples» (auth, хуки, рекурсия, загрузка файла, сломанный
     контракт — по странице или одной страницей с якорями), «Writing tests
     with AI agents»;
   - Backend requirements ← «What your backend needs» + «Recipes»;
   - Gotchas ← «⚠️ Gotchas»;
   - Reference ← «Config reference», «API cheat sheet»;
   - Roadmap ← «Limitations and roadmap».
   Текст переносится без переписывания по смыслу; README на этом шаге
   **не трогать** (сократит 06).
5. **Код из тестов.** Хелпер (например, `site/src/lib/snippet.ts`):
   `snippet({ source, region })` вырезает из текста файла кусок между
   `// #region docs:<region>` и `// #endregion`, убирает общий отступ.
   Использование в `.mdx`: `import src from '../../../examples/…/x.test.ts?raw'`
   + `<Code code={snippet({ source: src, region: 'before-after' })} lang="ts" />`.
   Регион, которого нет в файле, — **ошибка сборки**, а не пустой блок.
   Расставить регионы в тестах `examples/*/test-with-eberly/tests/*`, откуда
   README уже берёт код. Если для какого-то куска README теста нет —
   записать в HANDOFF, не выдумывать код.
6. **Конфиги и шумные блоки** (`eberly.ts`, `hooks.ts`, `main.ts` Nest) — тоже
   через `?raw` целиком или регионом, а не копией.
7. `CLAUDE.md`: раздел про `site/` (структура, команды `dev`/`build`,
   правило «код в документации — только регионами из тестов»).

## Готово, когда

- `pnpm --filter @eberly-site/site dev` открывает лендинг и все страницы
  документации на `http://localhost:4321`;
- `pnpm --filter @eberly-site/site build` проходит; удаление региона из
  теста ломает сборку;
- `pnpm test`, `pnpm lint`, `pnpm e2e` зелёные (регионы — только комментарии);
- запись в HANDOFF.md.
