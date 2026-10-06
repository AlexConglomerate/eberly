# 02. Слияние в main и релиз eberly@0.2.0

> Контекст — [README.md](README.md). Перед стартом прочитай
> [HANDOFF.md](HANDOFF.md). Задача 01 должна быть закрыта.
> Шаги с пометкой **[ты]** делает человек: агент их не выполняет,
> а говорит, когда пора, и ждёт подтверждения.

## Шаги

1. **[ты]** GitHub → репозиторий `evely` → Settings → Repository name →
   `eberly`.
2. Обновить remote:
   ```bash
   git remote set-url origin https://github.com/AlexConglomerate/eberly.git
   git fetch origin
   ```
3. Запушить ветку, влить в `main` fast-forward-ом (`main` — предок
   `New-features`, конфликтов нет):
   ```bash
   git push origin New-features
   git checkout main && git merge --ff-only New-features && git push origin main
   ```
4. Версия и changelog:
   ```bash
   pnpm changeset version
   ```
   Ожидается `package.json` → `"version": "0.2.0"`, в `CHANGELOG.md`
   новая секция `0.2.0`, `.changeset/*.md` (кроме README и config)
   удалены. Если версия не `0.2.0` — остановиться и разобраться, не
   публиковать. Закоммитить и запушить.
5. Проверить, что будет опубликовано:
   ```bash
   pnpm build && npm pack --dry-run
   ```
6. **[ты]** `npm whoami` (должен быть `alex_conglomerate`), затем
   `pnpm release` (сборка + `changeset publish`, попросит OTP).
   Запушить тег `eberly@0.2.0`, который создаст changesets: `git push --tags`.
7. **[ты]** Пометить старый пакет:
   ```bash
   npm deprecate ebely "Renamed to eberly: npm i -D eberly"
   ```
8. Проверка из npm (в пустой временной папке, не в репо):
   ```bash
   npx eberly@0.2.0 create demo && ls demo/eberly demo/.claude/skills
   npm view ebely deprecated   # текст из шага 7
   npm view eberly version     # 0.2.0
   ```

## Готово, когда

- `eberly@0.2.0` в npm, `npx eberly create` работает из npm;
- `ebely` помечен deprecated;
- `main` == `New-features`, всё запушено в `AlexConglomerate/eberly`;
- запись в [HANDOFF.md](HANDOFF.md) + напомнить про шаг 03 из README
  (переименовать папки).
