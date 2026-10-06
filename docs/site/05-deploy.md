# 05. Деплой: домен, Cloudflare Pages, аналитика, CI

> Контекст — [README.md](README.md). Перед стартом прочитай
> [HANDOFF.md](HANDOFF.md). После 01–04.
> Шаги с пометкой **[ты]** делает человек: агент их не выполняет,
> а говорит, когда пора, и ждёт подтверждения.

## Шаги

1. **CI.** `.github/workflows/main.yml` и `publish.yml`: Node 16 → 22,
   pnpm 7 → версия, совместимая с `lockfileVersion: '9.0'` (pnpm 9+;
   зафиксировать в корневом `package.json` → `packageManager`).
   `actions/*@v3` → актуальные. В `main.yml` добавить сборку сайта
   (`pnpm --filter @eberly-site/site build`). Публикация пакета при этом
   не должна поменяться — проверить, что `publish.yml` по-прежнему
   запускает `changesets/action`.
2. **[ты]** Купить `eberly.dev` в Cloudflare Registrar (Cloudflare сам
   станет DNS — так и нужно).
3. **[ты]** Cloudflare → Workers & Pages → Create → Pages → Connect to Git
   → репозиторий `eberly`. Агент заранее даёт точные значения:
   - production branch: `main`;
   - build command: `pnpm install --frozen-lockfile && pnpm --filter @eberly-site/site build`
     (`build` сайта сам собирает библиотеку и проверяет пример плейграунда);
   - output directory: `site/dist`;
   - переменная `NODE_VERSION` = `22`.
   Проверить на выданном `*.pages.dev`, затем Custom domains → `eberly.dev`
   (и `www` → редирект). `.dev` открывается только по HTTPS — сертификат
   Pages выпускает сам.
4. **[ты]** Аккаунт Umami Cloud (бесплатный тариф) → добавить сайт
   `eberly.dev` → передать агенту `website id`.
5. **Аналитика в коде.** Скрипт Umami в `head` Starlight — **только** в
   продакшен-сборке (не на `localhost`, не на превью `*.pages.dev`).
   Обёртку `track()` из 03 (`site/src/lib/analytics.ts`, пока no-op)
   подключить к `umami.track`. Событие
   `open_stackblitz` на кнопку из 04 (`site/src/components/OpenInStackBlitz.astro`,
   статичная ссылка — нужен клиентский `<script>` на клик), `copy_install` на копирование
   команды установки. В футере: *Privacy-friendly analytics, no cookies.*
6. `package.json` → `homepage: "https://eberly.dev"` (changeset `patch`,
   поле обновится в npm со следующим релизом). Ссылку на сайт — в описание
   репозитория на GitHub (**[ты]**, About → Website).
7. `CLAUDE.md`: где задеплоено, как обновляется (пуш в `main`), где аналитика.

## Готово, когда

- CI зелёный на ветке, включая сборку сайта;
- `https://eberly.dev` открывается, пуш в `main` обновляет сайт;
- в Umami видны визиты и события с продакшена, а с `localhost` — нет;
- запись в HANDOFF.md.
