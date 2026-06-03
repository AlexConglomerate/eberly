# Релиз новой версии

Библиотека `ebely` публикуется в npm. Версионирование — через
[Changesets](https://github.com/changesets/changesets).

## Шаги

### 1. Описать изменения (changeset)

```bash
pnpm changeset
```

Интерактивно выбери тип бампа (`patch` / `minor` / `major`) и опиши изменения.
Команда создаст файл в `.changeset/`. Закоммить его вместе с изменениями кода.

### 2. Поднять версию в package.json

```bash
pnpm changeset version
```

Применяет накопленные changeset-файлы: обновляет `version` в `package.json`
и `CHANGELOG.md`. Закоммить результат.

### 3. Опубликовать в npm

```bash
pnpm release
```

Эта команда (см. `package.json` → `scripts.release`) собирает пакет и
публикует его:

```
pnpm run build && changeset publish
```

> Для публикации нужно быть залогиненным в npm: `npm whoami` проверяет,
> `npm login` — авторизует. Доступ к пакету — `public` (см. `.changeset/config.json`).

## Кратко

```bash
pnpm changeset          # 1. описать изменения
pnpm changeset version  # 2. поднять версию + CHANGELOG
pnpm release            # 3. собрать и опубликовать
```
