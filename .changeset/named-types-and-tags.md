---
"eberly": minor
---

Генератор: версии OpenAPI, именованные типы, группы по тегам.

- OpenAPI 3.0 поддерживается наравне с 3.1: `nullable: true` → `| null`,
  `format: binary` → `FileInput`. Swagger 2.0 и неизвестные версии дают
  понятную ошибку вместо мусорного клиента.
- Схемы из `components/schemas` рендерятся именованными типами
  (`export type PostDto = …`), `$ref` — именем. Рекурсивные схемы больше
  не роняют генератор (`Maximum call stack size exceeded`). Типы можно
  импортировать: `import type { PostDto } from './generated'`.
- Типы вызовов описаны один раз — в `WorldApi` (там же JSDoc `summary`);
  `buildApiTree` возвращает `WorldApi`, `generated.ts` стал заметно короче.
- **Ломающее:** группа методов теперь берётся из первого тега
  (`User Management` → `userManagement`), а не из префикса `operationId`.
  Фолбэки: префикс `operationId` → первый сегмент пути → `default`.
  Если теги не совпадают с префиксом `operationId`, имена групп
  поменяются. Группы `get`/`set`/`api`/`store`/… получают суффикс `Api`.
